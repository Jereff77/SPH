--[Fecha y Hora]: 15/05/2026 12:07:00
--[Descripción]: Trigger que actualiza automáticamente uidGerente y nomGerente en cxp
--                cuando se inserta o actualiza un registro con idCategoria.
--
--[Evento]: BEFORE INSERT OR UPDATE
--
--[Tabla]: cxp
--
--[Función asociada]: cxp_actualizar_gerente()
--
--[Comportamiento]:
--   - Se activa ANTES de cada inserción o actualización en la tabla cxp
--   - Llama a cxp_actualizar_gerente() para sincronizar uidGerente y nomGerente
--   - En UPDATE: solo recalcula si el campo idCategoria cambió (optimización interna)
--
--[Relaciones]:
--   - Tabla: cxp
--   - Función: cxp_actualizar_gerente()
--
--[Consideraciones de rendimiento]:
--   - Tipo BEFORE: modifica NEW directamente sin necesitar una segunda operación
--   - La función interna evita consultas innecesarias cuando idCategoria no cambia

CREATE OR REPLACE TRIGGER trigger_cxp_actualizar_gerente
BEFORE INSERT OR UPDATE ON public.cxp
FOR EACH ROW
EXECUTE FUNCTION public.cxp_actualizar_gerente();
