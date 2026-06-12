-- =============================================================================
-- Migración v2: Agente de IA de Soporte  ·  2026-06-12
-- Objetos NUEVOS de v2 (regla 2: NO toca nada del sistema viejo).
-- Autorización: REQUIERE autorización explícita del usuario antes de aplicar (regla 1).
--
-- Qué crea:
--   1. Rol de SOLO LECTURA  public->  v2_soporte_ro  (garantía dura: el agente
--      JAMÁS puede escribir en la BD, ni bajo prompt-injection). Solo SELECT sobre
--      un conjunto MÍNIMO de tablas (permisos del usuario y catálogo de módulos).
--   2. Tablas de la conversación de soporte: v2_soporte_sesiones, v2_soporte_mensajes.
--   3. Tabla de tickets de escalación: v2_soporte_tickets.
--      (Las 3 con RLS ON sin políticas -> solo backend service_role; + trg_auditoria.)
--   4. Parámetros de configuración en SPHConfiguraciones: SOPORTE_IA_MODELO y
--      SOPORTE_IA_PROMPT (editables sin redeploy).
--
-- NOTA sobre el secreto del proveedor de IA:
--   La OPENROUTER_API_KEY NO va en la BD ni en el backend: se guarda como SECRETO
--   de Supabase (Edge Functions), accesible solo desde la edge `soporte-chat`.
--   Configúrala con:  supabase secrets set OPENROUTER_API_KEY=sk-or-...
--
-- Tras aplicar: regenerar packages/types/src/database.types.ts (MCP
--   generate_typescript_types) para tipar las nuevas tablas, luego
--   `pnpm --filter @erp/types build`.
-- =============================================================================

-- =============================================================================
-- 1) ROL DE SOLO LECTURA  ·  v2_soporte_ro
-- -----------------------------------------------------------------------------
-- Es un rol Postgres NUEVO, sin login. PostgREST lo asume cuando el JWT trae
-- `role: v2_soporte_ro`. El backend (SupabaseService.soporteRo) y la tool de
-- datos de la edge usan ESTE rol para TODAS las lecturas del agente. Como solo
-- tiene GRANT SELECT (y de columnas acotadas en catUsers), cualquier intento de
-- INSERT/UPDATE/DELETE falla con "permission denied" a nivel de motor.
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'v2_soporte_ro') THEN
    CREATE ROLE v2_soporte_ro NOLOGIN;
  END IF;
END $$;

COMMENT ON ROLE v2_soporte_ro IS
  'Rol de SOLO LECTURA del Agente de IA de Soporte (v2). Solo SELECT sobre permisos/catálogo. Nunca escribe. Lo asume PostgREST cuando el JWT trae role=v2_soporte_ro.';

-- PostgREST conmuta a este rol vía SET ROLE desde `authenticator`: hay que
-- permitir que authenticator pueda asumirlo.
GRANT v2_soporte_ro TO authenticator;

-- Acceso de lectura al esquema.
GRANT USAGE ON SCHEMA public TO v2_soporte_ro;

-- SELECT mínimo necesario para el DIAGNÓSTICO de permisos del usuario:
--   - segModulosUsuarios: qué claves tiene el usuario (uid, clave, acceso).
--   - segModulos: catálogo de módulos/secciones (para nombrar las claves).
-- (Sin PII; son tablas de control de acceso.)
GRANT SELECT ON public."segModulosUsuarios" TO v2_soporte_ro;
GRANT SELECT ON public."segModulos"          TO v2_soporte_ro;

-- catUsers contiene PII (correos, etc.): se conceden SOLO las columnas no
-- sensibles que el agente necesita para personalizar (rol/soporte/estado/nombre).
GRANT SELECT (uid, nombre, "nomCompleto", "isSupport", "idPerfil", status)
  ON public."catUsers" TO v2_soporte_ro;

-- Políticas ADITIVAS solo para este rol (inertes si la tabla NO tiene RLS;
-- activas si la tiene). No afectan a anon/authenticated ni al sistema Flutter.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname='public' AND tablename='segModulosUsuarios'
                   AND policyname='v2_soporte_ro_select') THEN
    CREATE POLICY v2_soporte_ro_select ON public."segModulosUsuarios"
      FOR SELECT TO v2_soporte_ro USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname='public' AND tablename='segModulos'
                   AND policyname='v2_soporte_ro_select') THEN
    CREATE POLICY v2_soporte_ro_select ON public."segModulos"
      FOR SELECT TO v2_soporte_ro USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname='public' AND tablename='catUsers'
                   AND policyname='v2_soporte_ro_select') THEN
    CREATE POLICY v2_soporte_ro_select ON public."catUsers"
      FOR SELECT TO v2_soporte_ro USING (true);
  END IF;
END $$;

-- =============================================================================
-- 2) TABLAS DE LA CONVERSACIÓN DE SOPORTE
-- =============================================================================

-- 2.1) Sesiones (hilos de chat por usuario) ----------------------------------
CREATE TABLE IF NOT EXISTS public.v2_soporte_sesiones (
  uuid          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  uid_usuario   uuid        NOT NULL,            -- dueño (del JWT verificado)
  titulo        text,                            -- auto-derivado del 1er mensaje
  status        boolean     NOT NULL DEFAULT true, -- false = "eliminada" (baja lógica)
  fc            timestamptz NOT NULL DEFAULT now(),
  "fum"         timestamptz,
  "fumUser"     uuid
);

COMMENT ON TABLE public.v2_soporte_sesiones IS
  'Sesiones (hilos) del Agente de IA de Soporte v2. Objeto nuevo v2; solo lo lee/escribe el backend (service_role).';

CREATE INDEX IF NOT EXISTS ix_v2_soporte_sesiones_uid
  ON public.v2_soporte_sesiones (uid_usuario, fc DESC);

-- 2.2) Mensajes (pregunta + respuesta por registro) --------------------------
CREATE TABLE IF NOT EXISTS public.v2_soporte_mensajes (
  uuid              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        uuid        NOT NULL REFERENCES public.v2_soporte_sesiones(uuid) ON DELETE CASCADE,
  uid_usuario       uuid        NOT NULL,        -- duplicado para aislamiento rápido
  pregunta          text        NOT NULL,
  respuesta         text        NOT NULL DEFAULT '',
  modulos_detectados text[]     NOT NULL DEFAULT '{}', -- KB seleccionada (auditoría del RAG)
  ruta_origen       text,                        -- pantalla desde la que se preguntó
  escalable         boolean     NOT NULL DEFAULT false, -- el agente sugirió ticket
  tokens_entrada    integer,
  tokens_salida     integer,
  fc                timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.v2_soporte_mensajes IS
  'Mensajes del Agente de IA de Soporte v2 (pregunta/respuesta). modulos_detectados = documentos de la KB usados (trazabilidad del RAG).';

CREATE INDEX IF NOT EXISTS ix_v2_soporte_mensajes_sesion
  ON public.v2_soporte_mensajes (session_id, fc ASC);

-- 2.3) Tickets de escalación -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.v2_soporte_tickets (
  uuid          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  uid_usuario   uuid        NOT NULL,
  session_id    uuid        REFERENCES public.v2_soporte_sesiones(uuid) ON DELETE SET NULL,
  modulo        text,                            -- módulo detectado por el agente
  ruta          text,                            -- pantalla de origen
  asunto        text        NOT NULL,
  resumen       text        NOT NULL,            -- resumen redactado por la IA, confirmado por el usuario
  estado        text        NOT NULL DEFAULT 'abierto',  -- abierto|en_proceso|cerrado
  fc            timestamptz NOT NULL DEFAULT now(),
  "fum"         timestamptz,
  "fumUser"     uuid,
  CONSTRAINT v2_soporte_tickets_estado_chk
    CHECK (estado IN ('abierto','en_proceso','cerrado'))
);

COMMENT ON TABLE public.v2_soporte_tickets IS
  'Tickets de escalación del Agente de IA de Soporte v2. Se crean SOLO tras confirmación explícita del usuario. Objeto nuevo v2.';

CREATE INDEX IF NOT EXISTS ix_v2_soporte_tickets_estado
  ON public.v2_soporte_tickets (estado, fc DESC);

-- 2.4) Seguridad: RLS ON sin políticas -> solo service_role (backend) ---------
-- El rol v2_soporte_ro NO recibe acceso a estas tablas (no las necesita).
ALTER TABLE public.v2_soporte_sesiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_soporte_mensajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_soporte_tickets  ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.v2_soporte_sesiones FROM anon, authenticated, v2_soporte_ro;
REVOKE ALL ON public.v2_soporte_mensajes FROM anon, authenticated, v2_soporte_ro;
REVOKE ALL ON public.v2_soporte_tickets  FROM anon, authenticated, v2_soporte_ro;

-- 2.5) Auditoría obligatoria (regla 6) ---------------------------------------
DROP TRIGGER IF EXISTS trg_auditoria ON public.v2_soporte_sesiones;
CREATE TRIGGER trg_auditoria
  AFTER INSERT OR UPDATE OR DELETE ON public.v2_soporte_sesiones
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria('uuid');

DROP TRIGGER IF EXISTS trg_auditoria ON public.v2_soporte_mensajes;
CREATE TRIGGER trg_auditoria
  AFTER INSERT OR UPDATE OR DELETE ON public.v2_soporte_mensajes
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria('uuid');

DROP TRIGGER IF EXISTS trg_auditoria ON public.v2_soporte_tickets;
CREATE TRIGGER trg_auditoria
  AFTER INSERT OR UPDATE OR DELETE ON public.v2_soporte_tickets
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria('uuid');

-- =============================================================================
-- 3) PARÁMETROS DE CONFIGURACIÓN  (SPHConfiguraciones — solo filas nuevas de v2)
-- =============================================================================
-- Modelo de OpenRouter a usar y prompt base del sistema. Editables sin redeploy.
-- El backend usa defaults si estas filas no existen (degradación elegante).
-- (La columna `tipo` es numérica; 1 = texto. El backend solo lee `valor`.)
-- Idempotente sin asumir índice único en `parametro` (solo inserta si falta).
INSERT INTO public."SPHConfiguraciones" (parametro, valor, detalle, tipo, status)
SELECT 'SOPORTE_IA_MODELO',
       'openai/gpt-4o-mini',
       'Modelo de OpenRouter para el Agente de IA de Soporte.',
       1, true
WHERE NOT EXISTS (SELECT 1 FROM public."SPHConfiguraciones" WHERE parametro = 'SOPORTE_IA_MODELO');

INSERT INTO public."SPHConfiguraciones" (parametro, valor, detalle, tipo, status)
SELECT 'SOPORTE_IA_PROMPT',
       'Eres el asistente de soporte del ERP de SPH Bienes Raíces. Ayudas a los usuarios a USAR la aplicación: explicas cómo hacer las cosas, qué significa cada campo y por qué algo no aparece o no se puede. Respondes SIEMPRE en español, de forma breve y con pasos claros. Te basas EXCLUSIVAMENTE en la documentación proporcionada (base de conocimiento); si no está en ella o no estás seguro, dilo con honestidad y ofrece escalar a un ticket de soporte. NUNCA inventas funciones, rutas ni permisos. NUNCA puedes modificar datos: solo informas.',
       1, true
WHERE NOT EXISTS (SELECT 1 FROM public."SPHConfiguraciones" WHERE parametro = 'SOPORTE_IA_PROMPT');

-- =============================================================================
-- 4) VERIFICACIÓN
-- =============================================================================
-- Rol y grants:
--   SELECT rolname FROM pg_roles WHERE rolname='v2_soporte_ro';
--   SELECT table_name, privilege_type FROM information_schema.role_table_grants
--     WHERE grantee='v2_soporte_ro';
-- Que el rol NO pueda escribir (debe dar permission denied):
--   SET ROLE v2_soporte_ro;
--   INSERT INTO public."segModulos"(clave) VALUES (99999);  -- ERROR esperado
--   RESET ROLE;
-- Tablas nuevas:
--   SELECT relname, relrowsecurity FROM pg_class
--     WHERE relname LIKE 'v2_soporte_%';
-- Parámetros:
--   SELECT parametro, valor FROM public."SPHConfiguraciones"
--     WHERE parametro LIKE 'SOPORTE_IA_%';

-- =============================================================================
-- 5) CHANGELOG (regla 9) — YA APLICADO: versión 2.22.0 (2026-06-12) vía MCP.
-- -----------------------------------------------------------------------------
-- El número de versión lo ASIGNA la BD (no se hardcodea). Se ejecutó una vez al
-- publicar el Agente de Soporte y devolvió 2.22.0. No re-ejecutar. (Salto 'minor'.)
-- =============================================================================
-- SELECT public.v2_changelog_registrar(
--   'minor',
--   'Asistente de IA de Soporte',
--   '[
--      {"tipo":"Agregado","descripcion":"Nuevo Asistente de ayuda (botón 💬 abajo a la derecha): te explica cómo usar el sistema y por qué algo no te aparece, en cualquier pantalla."},
--      {"tipo":"Agregado","descripcion":"Si el asistente no resuelve tu duda, puede generar un ticket de soporte para que una persona te ayude."},
--      {"tipo":"Seguridad","descripcion":"El asistente solo consulta información (nunca modifica datos): usa un acceso de solo lectura dedicado."}
--    ]'::jsonb
-- );
