-- =============================================================================
-- Migración v2: Soporte a Inquilinos (Arrendatarios)  ·  2026-06-23
-- Objetos NUEVOS de v2 (sin prefijo v2_, regla 2). NO toca nada del sistema viejo.
-- Autorización: REQUIERE autorización explícita del usuario antes de aplicar (regla 1).
--
-- Contexto: sistema de gestión de incidentes 100% por correo. Los inquilinos
-- escriben a contacto@portal.gruposph.mx; operaciones de SPH atiende desde el ERP.
-- Reutiliza la infraestructura de Correo (correo_cuentas/correo_mensajes/
-- correo_adjuntos): la cuenta de inquilinos es una fila más en correo_cuentas
-- (se da de alta desde la UI, NO es DDL). Aquí solo se crea la capa de incidentes.
--
-- Qué crea:
--   1. Tabla  incidentes            -> un incidente por HILO (conversationId).
--   2. Tabla  incidentes_remitentes -> mapeo APRENDIDO email->inquilino/nave
--                                       (patrón arre_ordenante).
--   3. Secuencia incidentes_folio_seq -> folio legible INC-00001.
--   4. Permisos nuevos en segModulos: claves 31-34 (sección "Soporte a Inquilinos").
--   5. (Opcional) Job pg_cron diario que marca "Detenido" por inactividad >7 días.
--
-- Ambas tablas: RLS ON sin políticas -> solo backend service_role; + trg_auditoria.
-- Sin FKs estrictas a tablas de v1 (idArrendador/idNave/idParque), igual que arre_pagos.
--
-- Tras aplicar: regenerar packages/types/src/database.types.ts (MCP
--   generate_typescript_types) + `pnpm --filter @erp/types build`.
-- =============================================================================

-- =============================================================================
-- 1) SECUENCIA DE FOLIO
-- =============================================================================
CREATE SEQUENCE IF NOT EXISTS public.incidentes_folio_seq;

-- =============================================================================
-- 2) TABLA  incidentes  (un incidente por hilo de correo)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.incidentes (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  folio           text        NOT NULL UNIQUE
                              DEFAULT ('INC-' || lpad(nextval('public.incidentes_folio_seq')::text, 5, '0')),
  "idCuenta"      uuid        NOT NULL REFERENCES public.correo_cuentas(id) ON DELETE CASCADE,
  "conversationId" text       NOT NULL,           -- hilo (correo_mensajes.conversationId)
  asunto          text,
  -- Vínculo con el inquilino/nave/parque (manual la 1ª vez; luego se autocompleta
  -- desde incidentes_remitentes). Sin FK estricta a v1 (igual que arre_pagos).
  "idArrendador"  uuid,                            -- inquilino (inversionista.idInversionista)
  "idNavArrend"   uuid,                            -- vínculo arrenPropiedades
  "idNave"        uuid,
  "idParque"      uuid,
  -- Pipeline
  estado          text        NOT NULL DEFAULT 'Nuevo'
                              CHECK (estado IN ('Nuevo','En Proceso','Resuelto','Detenido','Cerrado')),
  "detenidoOrigen" text       CHECK ("detenidoOrigen" IN ('auto','manual')), -- NULL si no está detenido
  -- Listo para fases futuras (asignación F3, clasificación IA F4)
  "asignadoA"     uuid,
  categoria       text,
  prioridad       text,
  -- Control
  "ultimaActividad" timestamptz NOT NULL DEFAULT now(),  -- para el cálculo de "Detenido"
  "creadoEn"      timestamptz NOT NULL DEFAULT now(),
  status          boolean     NOT NULL DEFAULT true,      -- baja lógica
  fc              timestamptz NOT NULL DEFAULT now(),
  "fum"           timestamptz,
  "fumUser"       uuid,
  -- Un incidente por hilo dentro de la cuenta
  CONSTRAINT incidentes_cuenta_hilo_uk UNIQUE ("idCuenta", "conversationId")
);

COMMENT ON TABLE public.incidentes IS
  'Soporte a Inquilinos (v2): un incidente por hilo de correo de la cuenta de inquilinos. Objeto nuevo v2; solo backend (service_role).';

CREATE INDEX IF NOT EXISTS ix_incidentes_estado
  ON public.incidentes (estado, "ultimaActividad" DESC);
CREATE INDEX IF NOT EXISTS ix_incidentes_arrendador
  ON public.incidentes ("idArrendador");
CREATE INDEX IF NOT EXISTS ix_incidentes_asignado
  ON public.incidentes ("asignadoA");

-- =============================================================================
-- 3) TABLA  incidentes_remitentes  (mapeo APRENDIDO email -> inquilino/nave)
--    Patrón arre_ordenante: al vincular manualmente un incidente se hace upsert
--    aquí; al crear un incidente nuevo, si el email ya está mapeado, se previncula.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.incidentes_remitentes (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text        NOT NULL UNIQUE,     -- normalizado (lower/trim) en el backend
  "idArrendador" uuid,
  "idNavArrend"  uuid,
  "idNave"       uuid,
  "idParque"     uuid,
  veces          integer     NOT NULL DEFAULT 1,
  "primeraVez"   timestamptz NOT NULL DEFAULT now(),
  "ultimaVez"    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.incidentes_remitentes IS
  'Mapeo aprendido remitente(email)->inquilino/nave/parque para auto-vincular incidentes futuros (patrón arre_ordenante). Objeto nuevo v2.';

-- =============================================================================
-- 4) SEGURIDAD: RLS ON sin políticas -> solo service_role (backend)
-- =============================================================================
ALTER TABLE public.incidentes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidentes_remitentes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.incidentes            FROM anon, authenticated;
REVOKE ALL ON public.incidentes_remitentes FROM anon, authenticated;

-- =============================================================================
-- 5) AUDITORÍA OBLIGATORIA (regla 6)
-- =============================================================================
DROP TRIGGER IF EXISTS trg_auditoria ON public.incidentes;
CREATE TRIGGER trg_auditoria
  AFTER INSERT OR UPDATE OR DELETE ON public.incidentes
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria('id');

DROP TRIGGER IF EXISTS trg_auditoria ON public.incidentes_remitentes;
CREATE TRIGGER trg_auditoria
  AFTER INSERT OR UPDATE OR DELETE ON public.incidentes_remitentes
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria('id');

-- =============================================================================
-- 6) PERMISOS (segModulos) — Sección "Soporte a Inquilinos" bajo Arrendatarios
--    NOTA: clave 30 ya existe (Cobro de Agua); se usan 31-34.
--    Idempotente (solo inserta si la clave falta).
-- =============================================================================
INSERT INTO public."segModulos" (modulo, seccion, area, clave)
SELECT 'Arrendatarios', 'Soporte a Inquilinos', 'Modulo', 31
WHERE NOT EXISTS (SELECT 1 FROM public."segModulos" WHERE clave = 31);

INSERT INTO public."segModulos" (modulo, seccion, area, clave)
SELECT 'Arrendatarios', 'Soporte a Inquilinos', 'Responder', 32
WHERE NOT EXISTS (SELECT 1 FROM public."segModulos" WHERE clave = 32);

INSERT INTO public."segModulos" (modulo, seccion, area, clave)
SELECT 'Arrendatarios', 'Soporte a Inquilinos', 'Clasificar', 33
WHERE NOT EXISTS (SELECT 1 FROM public."segModulos" WHERE clave = 33);

INSERT INTO public."segModulos" (modulo, seccion, area, clave)
SELECT 'Arrendatarios', 'Soporte a Inquilinos', 'Configuracion', 34
WHERE NOT EXISTS (SELECT 1 FROM public."segModulos" WHERE clave = 34);

-- =============================================================================
-- 7) (OPCIONAL) Job pg_cron diario: marcar "Detenido" por inactividad >7 días.
--    Solo afecta a incidentes activos (Nuevo/En Proceso). Marca detenidoOrigen='auto'.
--    La REACTIVACIÓN (al haber movimiento) la hace el BACKEND, no el cron, y solo
--    sobre los 'auto' (los 'manual' permanecen hasta que el operador los cambie).
--    Requiere extensión pg_cron (ya usada por v2-arrepdp-activar-renovaciones).
-- =============================================================================
-- SELECT cron.schedule(
--   'incidentes-marcar-detenidos',
--   '15 7 * * *',  -- 07:15 diario
--   $$UPDATE public.incidentes
--       SET estado = 'Detenido', "detenidoOrigen" = 'auto', "fum" = now()
--     WHERE status = true
--       AND estado IN ('Nuevo','En Proceso')
--       AND "ultimaActividad" < now() - interval '7 days';$$
-- );

-- =============================================================================
-- 8) VERIFICACIÓN
-- =============================================================================
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('incidentes','incidentes_remitentes');
-- SELECT clave, modulo, seccion, area FROM public."segModulos" WHERE clave BETWEEN 31 AND 34 ORDER BY clave;

-- =============================================================================
-- 9) CHANGELOG (regla 9): lo registra la BD al cierre «documenta todo» (no aquí).
-- =============================================================================
