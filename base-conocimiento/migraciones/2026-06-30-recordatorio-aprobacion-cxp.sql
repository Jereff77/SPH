-- =====================================================================
-- 2026-06-30 · Recordatorio diario a aprobadores de CxP — bitácora de correos
-- Objeto NUEVO de v2 (sin prefijo v2_, regla 2). NO se toca nada del sistema viejo.
--   - 1 tabla para registrar cada correo de recordatorio enviado a un aprobador.
-- =====================================================================

-- Bitácora de los correos de recordatorio de aprobación (un renglón por correo
-- intentado a un aprobador, incluye los fallidos). Telemetría del sistema (no son
-- datos de negocio del usuario): por eso NO lleva trigger de auditoría. Solo el
-- backend (service_role) la escribe/lee; el front nunca toca Supabase (regla 4).
CREATE TABLE IF NOT EXISTS public.mail_recordatorios_aprobacion (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  enviado_en     timestamptz NOT NULL DEFAULT now(),
  uid_aprobador  uuid        NOT NULL,                 -- aprobador destinatario (catUsers.uid)
  email          text        NOT NULL,                 -- correo al que se envió
  nombre         text,                                 -- nombre del aprobador (display)
  num_pendientes integer     NOT NULL,                 -- nº de solicitudes en el correo
  asunto         text        NOT NULL,
  html           text        NOT NULL,                 -- cuerpo enviado (previsualización)
  solicitudes    jsonb       NOT NULL DEFAULT '[]'::jsonb, -- [{idCxp, proveedor, total, moneda, folio}]
  estado         text        NOT NULL,                 -- 'enviado' | 'fallido'
  error          text,                                 -- detalle si falló
  CONSTRAINT mail_recordatorios_aprobacion_estado_chk
    CHECK (estado IN ('enviado', 'fallido'))
);
ALTER TABLE public.mail_recordatorios_aprobacion ENABLE ROW LEVEL SECURITY;
-- Sin políticas: accesible solo para service_role (backend).
CREATE INDEX IF NOT EXISTS ix_mail_recordatorios_aprobacion_enviado
  ON public.mail_recordatorios_aprobacion (enviado_en DESC);
GRANT SELECT, INSERT ON public.mail_recordatorios_aprobacion TO service_role;

COMMENT ON TABLE public.mail_recordatorios_aprobacion IS
  'Bitácora de correos de recordatorio de aprobación CxP (telemetría, append-only, solo backend).';
