-- =============================================================================
-- Avisos de Complemento de Pago (REP) consolidados — bitácora de envíos
-- Fecha: 2026-08-26 · Autor: Toribio/Opus 5
-- Plan: base-conocimiento/PLAN-avisos-rep-consolidados.md
--
-- CONTEXTO
-- El scheduler de avisos de REP enviaba UN correo por parcialidad: el 16-ago-2026
-- Paul-Henri Gauvin recibió 19 correos en un día (de solo 6 proveedores) y 81 en la
-- ventana completa. La regla de negocio nueva (Jereff, 2026-08-26) es un correo
-- CONSOLIDADO por persona y MÁXIMO UNO AL DÍA.
--
-- QUÉ HACE ESTA MIGRACIÓN
--   1. Tabla `mail_avisos_rep`: bitácora de cada aviso enviado (o no enviado).
--   2. Índice ÚNICO (fecha_mx, tipo, destinatario): es el candado DURO de la regla
--      "máximo un correo al día". No basta con el flag en memoria del scheduler:
--      hay evidencia en `v2_cron_ejecuciones` de DOS instancias del API corriendo
--      el cron a horas distintas (07:00 y 13:00 MX hasta el 15-ago-2026), y el flag
--      no cruza procesos. El índice sí.
--   3. RLS ON sin políticas + REVOKE → solo el backend (service_role) la toca.
--   4. trg_auditoria (regla 6 del proyecto).
--
-- ES 100 % ADITIVA: crea objetos nuevos, no altera ni lee nada existente.
-- Reversible con el bloque del final.
-- =============================================================================

-- 1) Bitácora de avisos --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mail_avisos_rep (
  id              bigserial PRIMARY KEY,
  fc              timestamptz NOT NULL DEFAULT now(),
  -- Día de calendario de México: es la unidad de la regla "uno al día".
  fecha_mx        date        NOT NULL,
  tipo            text        NOT NULL,
  destinatario    text        NOT NULL,
  -- catUsers.uid cuando el destinatario es interno (solicitante/gerente).
  uid             uuid        NULL,
  -- catProveedores.idProveedor cuando el destinatario es el proveedor.
  id_proveedor    text        NULL,
  num_pendientes  integer     NOT NULL DEFAULT 0,
  asunto          text        NOT NULL,
  html            text        NOT NULL,
  -- Folios/montos incluidos en ese correo, para poder reconstruir qué se avisó.
  detalle         jsonb       NOT NULL DEFAULT '[]'::jsonb,
  estado          text        NOT NULL,
  error           text        NULL,

  CONSTRAINT mail_avisos_rep_tipo_chk
    CHECK (tipo IN ('proveedor', 'solicitante', 'gerente', 'solicitante_bloqueo')),
  CONSTRAINT mail_avisos_rep_estado_chk
    CHECK (estado IN ('en_curso', 'enviado', 'fallido', 'omitido_sin_correo')),
  CONSTRAINT mail_avisos_rep_detalle_chk
    CHECK (jsonb_typeof(detalle) = 'array')
);

COMMENT ON TABLE public.mail_avisos_rep IS
  'Bitácora de los avisos de Complemento de Pago (REP) enviados por el cron cxp-aviso-complementos. Objeto nuevo de v2; solo lo escribe el backend (service_role). El índice único (fecha_mx, tipo, destinatario) hace cumplir la regla de negocio "máximo un correo al día por persona" incluso si el cron corre en dos instancias.';

COMMENT ON COLUMN public.mail_avisos_rep.fecha_mx IS
  'Día de calendario en hora de México (UTC-6) al que pertenece el aviso. Unidad del candado "uno al día".';
COMMENT ON COLUMN public.mail_avisos_rep.tipo IS
  'A quién va: proveedor (externo, aviso diario los últimos 5 días de su plazo) | solicitante (diario, misma ventana) | gerente (único, la víspera del corte del proveedor) | solicitante_bloqueo (víspera de que se le bloquee el sistema).';
COMMENT ON COLUMN public.mail_avisos_rep.estado IS
  'en_curso: renglón reservado antes de enviar (evita que otra instancia mande el mismo correo). enviado: el SMTP lo aceptó. fallido: el SMTP lo rechazó o falló. omitido_sin_correo: el destinatario no tiene correo utilizable (p.ej. proveedores con el texto literal "null" en catProveedores.email).';
COMMENT ON COLUMN public.mail_avisos_rep.detalle IS
  'Arreglo de las parcialidades incluidas en el correo: idCxp, folio, proveedor, monto, fecPago.';

-- 2) Candado de la regla "máximo un correo al día" ----------------------------
CREATE UNIQUE INDEX IF NOT EXISTS ux_mail_avisos_rep_dia
  ON public.mail_avisos_rep (fecha_mx, tipo, destinatario);

CREATE INDEX IF NOT EXISTS ix_mail_avisos_rep_fc
  ON public.mail_avisos_rep (fc DESC);

-- 3) Seguridad: RLS ON sin políticas -> solo service_role (backend) -----------
ALTER TABLE public.mail_avisos_rep ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mail_avisos_rep FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.mail_avisos_rep_id_seq FROM anon, authenticated;

-- 4) Auditoría obligatoria (regla 6) ------------------------------------------
DROP TRIGGER IF EXISTS trg_auditoria ON public.mail_avisos_rep;
CREATE TRIGGER trg_auditoria
  AFTER INSERT OR UPDATE OR DELETE ON public.mail_avisos_rep
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria('id');

-- 5) Parámetro nuevo: cuenta remitente fija -----------------------------------
-- Hoy el scheduler toma `cuentasActivas[0]` SIN ORDER BY y hay 2 cuentas activas
-- (agente@ y soporteaclientes@portal.gruposph.mx): el remitente puede cambiar solo
-- de un día a otro. Al escribirle a proveedores externos eso es spam asegurado.
-- Si el parámetro no existe o no corresponde a una cuenta activa, el código cae a
-- la primera cuenta ORDENADA POR id (determinista), así que este INSERT es opcional.
INSERT INTO public."SPHConfiguraciones" (parametro, valor, status)
SELECT 'PPD_REP_CUENTA_REMITENTE', 'soporteaclientes@portal.gruposph.mx', true
WHERE NOT EXISTS (
  SELECT 1 FROM public."SPHConfiguraciones" WHERE parametro = 'PPD_REP_CUENTA_REMITENTE'
);

-- =============================================================================
-- VERIFICACIÓN (ejecutar después)
-- =============================================================================
-- SELECT to_regclass('public.mail_avisos_rep') AS tabla,
--        (SELECT count(*) FROM pg_indexes
--          WHERE tablename='mail_avisos_rep' AND indexname='ux_mail_avisos_rep_dia') AS candado,
--        (SELECT relrowsecurity FROM pg_class WHERE oid='public.mail_avisos_rep'::regclass) AS rls_on,
--        (SELECT count(*) FROM pg_trigger
--          WHERE tgrelid='public.mail_avisos_rep'::regclass AND tgname='trg_auditoria') AS auditoria;
--
-- Prueba del candado (debe fallar el segundo INSERT):
--   INSERT INTO public.mail_avisos_rep (fecha_mx,tipo,destinatario,asunto,html,estado)
--     VALUES (current_date,'gerente','x@y.mx','a','<p>a</p>','enviado');
--   INSERT INTO public.mail_avisos_rep (fecha_mx,tipo,destinatario,asunto,html,estado)
--     VALUES (current_date,'gerente','x@y.mx','b','<p>b</p>','enviado');  -- ⛔ 23505
--   DELETE FROM public.mail_avisos_rep WHERE destinatario='x@y.mx';

-- =============================================================================
-- ROLLBACK
-- =============================================================================
-- DROP TRIGGER IF EXISTS trg_auditoria ON public.mail_avisos_rep;
-- DROP TABLE IF EXISTS public.mail_avisos_rep;
-- DELETE FROM public."SPHConfiguraciones" WHERE parametro = 'PPD_REP_CUENTA_REMITENTE';
