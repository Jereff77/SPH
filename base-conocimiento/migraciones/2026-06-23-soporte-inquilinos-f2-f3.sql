-- =============================================================================
-- Migración v2: Soporte a Inquilinos · Fase 2 (asignación + visibilidad) y
--               Fase 3 (pipeline + árbol de seguimientos)  ·  2026-06-23
-- Objetos NUEVOS de v2 (sin prefijo v2_). NO toca nada del sistema viejo.
-- Autorización: REQUIERE autorización explícita del usuario antes de aplicar (regla 1).
--
-- Qué crea:
--   1. Permisos nuevos en segModulos: 35 (Asignar — gerente) y 36 (Ver todos / Pipeline).
--   2. Tabla incidentes_seguimientos -> "árbol de seguimientos" de cada incidente:
--      eventos automáticos (creado/asignado/estado/respondido/vinculado) + notas internas.
--
-- Tras aplicar: regenerar database.types.ts + `pnpm --filter @erp/types build`.
-- =============================================================================

-- =============================================================================
-- 1) PERMISOS (segModulos) — sección "Soporte a Inquilinos"
--    Idempotente (solo inserta si la clave falta).
-- =============================================================================
INSERT INTO public."segModulos" (modulo, seccion, area, clave)
SELECT 'Arrendatarios', 'Soporte a Inquilinos', 'Asignar', 35
WHERE NOT EXISTS (SELECT 1 FROM public."segModulos" WHERE clave = 35);

INSERT INTO public."segModulos" (modulo, seccion, area, clave)
SELECT 'Arrendatarios', 'Soporte a Inquilinos', 'VerTodos', 36
WHERE NOT EXISTS (SELECT 1 FROM public."segModulos" WHERE clave = 36);

-- =============================================================================
-- 2) TABLA incidentes_seguimientos  (bitácora automática + notas internas)
--    tipo: 'evento' (lo escribe el sistema) | 'nota' (la escribe un agente).
--    Las notas son INTERNAS (no se envían al inquilino).
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.incidentes_seguimientos (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "idIncidente" uuid        NOT NULL REFERENCES public.incidentes(id) ON DELETE CASCADE,
  tipo          text        NOT NULL DEFAULT 'evento' CHECK (tipo IN ('evento','nota')),
  texto         text        NOT NULL,
  detalle       jsonb,                                  -- metadatos del evento (opcional)
  uid           uuid,                                   -- autor (null = evento del sistema)
  fc            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.incidentes_seguimientos IS
  'Árbol de seguimientos de Soporte a Inquilinos: eventos automáticos + notas internas por incidente. Objeto nuevo v2.';

CREATE INDEX IF NOT EXISTS ix_incidentes_seguimientos_inc
  ON public.incidentes_seguimientos ("idIncidente", fc ASC);

-- 3) Seguridad + auditoría
ALTER TABLE public.incidentes_seguimientos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.incidentes_seguimientos FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_auditoria ON public.incidentes_seguimientos;
CREATE TRIGGER trg_auditoria
  AFTER INSERT OR UPDATE OR DELETE ON public.incidentes_seguimientos
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria('id');

-- =============================================================================
-- 4) VERIFICACIÓN
-- =============================================================================
-- SELECT clave, area FROM public."segModulos" WHERE clave IN (35,36);
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname='incidentes_seguimientos';
