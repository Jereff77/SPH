-- =============================================================================
-- Capturas de pantalla del Agente de Soporte — persistencia
-- Autorizado por Jereff 2026-08-05 · APLICADA en prod vía apply_migration
-- (migración `soporte_capturas_bucket_y_columna`).
-- -----------------------------------------------------------------------------
-- El widget del agente puede adjuntar una captura de la pantalla del usuario
-- (botón 📷 o petición del propio modelo vía `request_screenshot`). La imagen
-- viaja inline al modelo y, desde esta migración, se PERSISTE para poder verla
-- en la conversación (widget) y en la auditoría (Configuraciones → Soporte).
--
--  - Bucket PRIVADO `soporteCapturas`: solo lo accede el backend (service_role);
--    al cliente siempre se sirve con URL FIRMADA temporal (2 h). Sin policies
--    para roles de cliente a propósito.
--  - `v2_soporte_mensajes."capturaPath"`: liga cada mensaje con su captura
--    (null si el turno no llevó). El base64 NUNCA se guarda en la tabla.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('soporteCapturas', 'soporteCapturas', false)
on conflict (id) do nothing;

alter table public.v2_soporte_mensajes add column "capturaPath" text null;

comment on column public.v2_soporte_mensajes."capturaPath" is
  'Path de la captura de pantalla adjunta en el bucket privado soporteCapturas (null si el mensaje no llevó captura). Se sirve con URL firmada.';
