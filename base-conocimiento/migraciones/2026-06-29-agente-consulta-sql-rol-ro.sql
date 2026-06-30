-- =============================================================================
-- 2026-06-29 · Agente de Soporte/Analítica: motor text-to-SQL acotado (rol RO)
-- -----------------------------------------------------------------------------
-- Permite que el Agente responda preguntas de DATOS (no solo soporte) ejecutando
-- SELECT generados por el LLM, con DOS barreras:
--   1) Rol `v2_agente_ro` (NOLOGIN, BYPASSRLS) con SELECT SOLO sobre tablas/vistas de
--      NEGOCIO; nunca sistema/sensibles (auth/usuarios/permisos, config/secretos,
--      correos, conversaciones IA/soporte/tickets, incidentes, comentarios libres,
--      auditoría, cron, invitaciones, versiones). → Postgres impide leer lo excluido.
--   2) Función `agente_consulta_sql(query)` SECURITY INVOKER: valida que sea solo
--      SELECT (sin DML/DDL/comentarios/multi-sentencia) y cap de 5000 filas.
-- El backend la invoca con un cliente cuyo JWT lleva role=v2_agente_ro (igual patrón
-- que v2_soporte_ro). La barrera por CLAVE de permiso (qué módulos puede consultar
-- cada usuario) se aplica en el backend (mapa clave→tablas) ANTES de ejecutar.
--
-- NOTA: requiere que `authenticator` sea miembro de v2_agente_ro (GRANT incluido)
-- para que PostgREST pueda conmutar al rol según el JWT.
--
-- REVERSIBLE:
--   DROP FUNCTION public.agente_consulta_sql(text);
--   REVOKE v2_agente_ro FROM authenticator, postgres;
--   DROP OWNED BY v2_agente_ro;  DROP ROLE v2_agente_ro;
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'v2_agente_ro') THEN
    CREATE ROLE v2_agente_ro NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
END$$;

GRANT USAGE ON SCHEMA public TO v2_agente_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO v2_agente_ro;
REVOKE SELECT ON
  "catUsers", "segModulos", "segModulosUsuarios", "segPlantillasPermisos",
  "segDetallesPlantilla", "perfil", "SPHConfiguraciones", "parametros",
  "auditoria", "v2_changelog", "v2_cron_ejecuciones", "v2_invitaciones",
  "versiones", "manuales", "catReportes", "crm_reporte_permisos", "crm_config",
  "crm_widgets", "crm_reports",
  "correo_adjuntos", "correo_cuentas", "correo_mensajes", "emails",
  "email_attachments", "messages",
  "iaConversaciones", "iaSesiones", "v2_soporte_mensajes", "v2_soporte_sesiones",
  "v2_soporte_tickets", "soportes", "soporte_imagenes", "soporte_seguimiento",
  "tickets", "activity_history",
  "incidentes", "incidentes_remitentes", "incidentes_seguimientos",
  "comentarios", "cxpComentarios", "seguimientoComentarios", "v_comentarios",
  "reporte_html_parts"
FROM v2_agente_ro;

GRANT v2_agente_ro TO authenticator;  -- PostgREST conmuta al rol según el JWT

CREATE OR REPLACE FUNCTION public.agente_consulta_sql(query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  q  text := btrim(regexp_replace(coalesce(query, ''), ';\s*$', ''));
  up text := upper(regexp_replace(btrim(coalesce(query, '')), '\s+', ' ', 'g'));
  result jsonb;
BEGIN
  IF q = '' THEN RAISE EXCEPTION 'Consulta vacía'; END IF;
  IF NOT (up LIKE 'SELECT %' OR up LIKE 'WITH %') THEN
    RAISE EXCEPTION 'Solo se permiten consultas SELECT';
  END IF;
  IF up ~ '\y(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE|COPY|VACUUM|CALL|MERGE|REFRESH|SET|RESET|SECURITY|LISTEN|NOTIFY)\y' THEN
    RAISE EXCEPTION 'Operación no permitida en la consulta';
  END IF;
  IF position('--' in q) > 0 OR position('/*' in q) > 0 OR position(';' in q) > 0 THEN
    RAISE EXCEPTION 'Sintaxis no permitida (comentarios o múltiples sentencias)';
  END IF;
  EXECUTE format(
    'SELECT coalesce(jsonb_agg(t), ''[]''::jsonb) FROM (SELECT * FROM (%s) sub LIMIT 5000) t',
    q
  ) INTO result;
  RETURN result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.agente_consulta_sql(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agente_consulta_sql(text) TO v2_agente_ro;

-- Metadatos (nombres de columnas, NO datos) para armar el esquema dinámico del
-- prompt del agente. La llama el backend con service_role, filtrando por el universo
-- de tablas permitido por las claves del usuario.
CREATE OR REPLACE FUNCTION public.agente_esquema(p_tablas text[])
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT coalesce(jsonb_object_agg(table_name, cols), '{}'::jsonb)
  FROM (
    SELECT table_name, jsonb_agg(column_name ORDER BY ordinal_position) AS cols
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ANY(p_tablas)
    GROUP BY table_name
  ) t;
$$;
REVOKE ALL ON FUNCTION public.agente_esquema(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agente_esquema(text[]) TO service_role;
