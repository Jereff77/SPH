-- 2026-07-04 · Trazabilidad de la nave (Fase A: arrendatarios)
-- Agrega el "por qué" de la liberación de una nave arrendada.
--
-- El actor y la fecha de la liberación YA los captura el trigger de auditoría
-- (fn_auditoria: uid del JWT verificado + fc), así que NO se duplican aquí. Esta
-- columna guarda únicamente el motivo de negocio, que el mismo trg_auditoria
-- auditará automáticamente cuando `liberarNave` lo escriba (aparecerá en
-- auditoria.cambios / registro_nuevo). Es el espejo de arrePdp.motivoCancelacion.
--
-- Aditiva (columna nullable) y reversible. No requiere RLS nueva (tabla existente).
ALTER TABLE public."arrenPropiedades"
  ADD COLUMN IF NOT EXISTS "motivoBaja" text;

COMMENT ON COLUMN public."arrenPropiedades"."motivoBaja"
  IS 'Motivo de negocio de la liberación de la nave (status=false). Lo escribe liberarNave y lo audita trg_auditoria; el actor/fecha viven en la tabla auditoria.';
