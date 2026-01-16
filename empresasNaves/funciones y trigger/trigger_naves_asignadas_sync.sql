--[Fecha y Hora]: 16/10/2025 23:50:55
-- [Descripción]: Trigger que mantiene sincronizada la tabla "naves" cuando
--                se realizan cambios en la tabla "empresasNaves".
--
-- [Función asociada]: public.naves_asignadas_sync_trigger()
--
-- [Eventos]: INSERT, UPDATE, DELETE en la tabla "empresasNaves"
--
-- [Comportamiento]:
--   - INSERT: Marca la nave como asignada (asignado = true) y establece idEmpresa
--   - UPDATE: Actualiza idEmpresa si cambia
--   - DELETE: Desasigna la nave (asignado = false, idEmpresa = NULL)
--
-- [Ejemplo]: El trigger se ejecuta automáticamente, no requiere llamada manual

-- Eliminar trigger si existe para evitar errores
DROP TRIGGER IF EXISTS trigger_naves_asignadas_sync ON public."empresasNaves";

-- Crear el trigger
CREATE TRIGGER trigger_naves_asignadas_sync
    AFTER INSERT OR UPDATE OR DELETE
    ON public."empresasNaves"
    FOR EACH ROW
    EXECUTE FUNCTION public.naves_asignadas_sync_trigger();