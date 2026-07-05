-- 2026-07-05 · Trazabilidad de la nave (Fase B: ventas)
-- Espejo de arrenPropiedades.motivoBaja (Fase A). Guarda el "por qué" de la
-- desvinculación de una propiedad de venta (baja lógica: propiedades.status=false).
--
-- El actor y la fecha de la baja YA los captura el trigger de auditoría
-- (fn_auditoria: uid del JWT + fc); esta columna guarda solo el motivo de negocio,
-- que el mismo trg_auditoria auditará cuando desvincularNave lo escriba. Aditiva,
-- nullable, sin RLS nueva (tabla existente).
ALTER TABLE public."propiedades"
  ADD COLUMN IF NOT EXISTS "motivoBaja" text;

COMMENT ON COLUMN public."propiedades"."motivoBaja"
  IS 'Motivo de negocio de la desvinculacion de la propiedad de venta (status=false). Lo escribe desvincularNave y lo audita trg_auditoria; el actor/fecha viven en la tabla auditoria.';
