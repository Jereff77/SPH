-- =====================================================================
-- 2026-06-11 · Pantalla "Cron" (Configuraciones, solo soporte)
-- Objetos NUEVOS de v2. NO se toca nada del sistema viejo.
-- Aplicada vía MCP (autorizada por el usuario). Se conserva aquí para el
-- repo y para replicarla en otros entornos.
--   - 2 funciones de SOLO LECTURA sobre el schema cron (pg_cron).
--   - 1 tabla para el historial de los schedulers NestJS (@Cron).
-- =====================================================================

-- 1) Jobs de pg_cron + resumen de su última ejecución -----------------
CREATE OR REPLACE FUNCTION public.v2_cron_jobs()
RETURNS TABLE (
  jobid bigint,
  jobname text,
  schedule text,
  active boolean,
  command text,
  ultima_ejecucion timestamptz,
  ultimo_estado text,
  ultimo_mensaje text,
  total_ejecuciones bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, cron
STABLE
AS $$
  SELECT
    j.jobid, j.jobname, j.schedule, j.active, j.command,
    r.start_time, r.status, r.return_message,
    (SELECT count(*) FROM cron.job_run_details d WHERE d.jobid = j.jobid)
  FROM cron.job j
  LEFT JOIN LATERAL (
    SELECT start_time, status, return_message
    FROM cron.job_run_details d
    WHERE d.jobid = j.jobid
    ORDER BY start_time DESC
    LIMIT 1
  ) r ON true
  ORDER BY j.jobid;
$$;
REVOKE ALL ON FUNCTION public.v2_cron_jobs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v2_cron_jobs() TO service_role;

-- 2) Historial de ejecuciones (de un job o de todos) ------------------
CREATE OR REPLACE FUNCTION public.v2_cron_run_details(
  p_jobid bigint DEFAULT NULL,
  p_limit int DEFAULT 50
)
RETURNS TABLE (
  runid bigint,
  jobid bigint,
  jobname text,
  status text,
  return_message text,
  start_time timestamptz,
  end_time timestamptz,
  duracion_ms numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, cron
STABLE
AS $$
  SELECT
    d.runid, d.jobid, j.jobname, d.status, d.return_message,
    d.start_time, d.end_time,
    EXTRACT(EPOCH FROM (d.end_time - d.start_time)) * 1000
  FROM cron.job_run_details d
  LEFT JOIN cron.job j ON j.jobid = d.jobid
  WHERE (p_jobid IS NULL OR d.jobid = p_jobid)
  ORDER BY d.start_time DESC
  LIMIT GREATEST(1, LEAST(p_limit, 500));
$$;
REVOKE ALL ON FUNCTION public.v2_cron_run_details(bigint, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v2_cron_run_details(bigint, int) TO service_role;

-- 3) Historial de los schedulers NestJS (@Cron) -----------------------
-- Telemetría del sistema (no son datos de negocio del usuario): por eso NO
-- lleva trigger de auditoría. Solo el backend (service_role) la escribe/lee.
CREATE TABLE IF NOT EXISTS public.v2_cron_ejecuciones (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tarea         text        NOT NULL,                      -- nombre del scheduler
  origen        text        NOT NULL DEFAULT 'programada', -- 'programada' | 'manual'
  estado        text        NOT NULL,                      -- 'exito' | 'error'
  mensaje       text,                                      -- resumen / log corto
  detalle       jsonb,                                     -- resultado estructurado
  inicio        timestamptz NOT NULL DEFAULT now(),
  fin           timestamptz,
  duracion_ms   integer,
  ejecutado_por uuid,                                      -- uid si fue manual; NULL si programada
  creado_en     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.v2_cron_ejecuciones ENABLE ROW LEVEL SECURITY;
-- Sin políticas: accesible solo para service_role (backend). El front nunca
-- toca Supabase (regla 4).
CREATE INDEX IF NOT EXISTS ix_v2_cron_ejec_tarea_inicio
  ON public.v2_cron_ejecuciones (tarea, inicio DESC);
CREATE INDEX IF NOT EXISTS ix_v2_cron_ejec_inicio
  ON public.v2_cron_ejecuciones (inicio DESC);
GRANT SELECT, INSERT ON public.v2_cron_ejecuciones TO service_role;
