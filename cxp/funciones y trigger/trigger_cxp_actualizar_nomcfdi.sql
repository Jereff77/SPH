--[Fecha y Hora]: 07/11/2025 09:16:00
--[Descripción]: Trigger que se ejecuta después de insertar un registro en la tabla cxp
--                para verificar y actualizar el campo nomCFDI si está vacío.
--
--[Evento]: AFTER INSERT
--
--[Tabla]: cxp
--
--[Función asociada]: cxp_actualizar_nomcfdi_vacio()
--
--[Comportamiento]: 
--   - Se activa después de cada inserción en la tabla cxp
--   - Llama a la función cxp_actualizar_nomcfdi_vacio() para verificar y actualizar nomCFDI
--
--[Relaciones]: 
--   - Tabla: cxp
--   - Función: cxp_actualizar_nomcfdi_vacio()
--
--[Consideraciones de rendimiento]:
--   - El trigger se ejecuta solo cuando se insertan registros
--   - La actualización solo ocurre cuando nomCFDI está vacío y nombreProveedor tiene valor

CREATE OR REPLACE TRIGGER trigger_cxp_actualizar_nomcfdi
AFTER INSERT ON public.cxp
FOR EACH ROW
EXECUTE FUNCTION public.cxp_actualizar_nomcfdi_vacio();