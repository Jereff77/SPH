-- =============================================================================
-- Migración v2: invitaciones de registro de usuarios  ·  2026-06-12
-- Objeto NUEVO de v2 (regla 2: no toca nada del sistema viejo).
-- Autorización: concedida explícitamente por el usuario. APLICADA vía MCP.
--
-- Qué crea:
--   1. Tabla public.v2_invitaciones (una fila por invitación enviada).
--   2. RLS ON sin políticas -> solo el backend (service_role) accede; el frontend
--      NUNCA toca la tabla.
--   3. Trigger trg_auditoria (regla 6: toda tabla de datos lleva auditoría).
--
-- Flujo: el módulo Usuarios crea la invitación (token aleatorio; en BD solo el
-- hash SHA-256) y envía un correo con el link {APP_WEB_URL}/registro?token=XXX.
-- El invitado define su contraseña y datos; el backend crea el usuario en
-- Supabase Auth + catUsers y marca la invitación 'aceptada'. Si el dominio del
-- correo no está autorizado, el correo se agrega automáticamente a
-- CORREOS_AUTORIZADOS (SPHConfiguraciones); si la invitación se cancela y fue ese
-- flujo el que lo agregó (agregadoACorreos=true), se revierte. Solo puede haber
-- UNA invitación activa (pendiente y no expirada) por correo.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.v2_invitaciones (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email              text        NOT NULL,
  nombre             text,
  apellidos          text,
  "idPerfil"         integer     NOT NULL DEFAULT 5,           -- perfil base (Ventas); permisos reales en segModulosUsuarios
  "tokenHash"        text        NOT NULL UNIQUE,              -- SHA-256 del token (el token crudo solo va en el correo)
  estado             text        NOT NULL DEFAULT 'pendiente', -- pendiente | aceptada | cancelada
  "invitadoPor"      uuid,                                     -- catUsers.uid del actor
  "uidCreado"        uuid,                                     -- uid del usuario creado al aceptar
  "agregadoACorreos" boolean     NOT NULL DEFAULT false,       -- se añadió a CORREOS_AUTORIZADOS automáticamente
  "fecExpira"        timestamptz NOT NULL,
  "fecAcepta"        timestamptz,
  "creadoEn"         timestamptz NOT NULL DEFAULT now(),
  "fum"              timestamptz,
  "fumUser"          uuid,
  CONSTRAINT v2_invitaciones_estado_chk CHECK (estado IN ('pendiente','aceptada','cancelada'))
);

COMMENT ON TABLE public.v2_invitaciones IS
  'Invitaciones de registro de usuarios del ERP v2 (objeto nuevo). Solo lo lee/escribe el backend (service_role). El token crudo solo viaja en el correo; en BD se guarda su hash SHA-256.';

CREATE INDEX IF NOT EXISTS ix_v2_invitaciones_email ON public.v2_invitaciones (lower(email));

-- Seguridad: RLS ON sin políticas -> solo service_role (backend)
ALTER TABLE public.v2_invitaciones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.v2_invitaciones FROM anon, authenticated;

-- Auditoría obligatoria (regla 6)
DROP TRIGGER IF EXISTS trg_auditoria ON public.v2_invitaciones;
CREATE TRIGGER trg_auditoria
  AFTER INSERT OR UPDATE OR DELETE ON public.v2_invitaciones
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria('id');

-- Verificación rápida:
-- SELECT id, email, estado, "fecExpira" FROM public.v2_invitaciones ORDER BY "creadoEn" DESC;
