--[Descripción]: Trigger que genera automáticamente el campo nomCompleto y UID si es necesario
-- [Módulo]: Gestión de Usuarios - catUsers
--
-- [Función asociada]: public.catusers_llenar_nomcompleto()
--
-- [Eventos]: INSERT, UPDATE en la tabla "catUsers"
--
-- [Timing]: BEFORE (se ejecuta antes de que se guarden los cambios)
--
-- [Comportamiento]:
--   - INSERT: Genera UID si es NULL y crea nomCompleto desde nombre y apellidos
--   - UPDATE: Actualiza nomCompleto si cambian nombre o apellidos
--
-- [Ejemplo]: El trigger se ejecuta automáticamente, no requiere llamada manual

-- Eliminar trigger si existe para evitar errores
DROP TRIGGER IF EXISTS trigger_catusers_llenar_nomcompleto ON public."catUsers";

-- Crear el trigger para INSERT y UPDATE
CREATE TRIGGER trigger_catusers_llenar_nomcompleto
    BEFORE INSERT OR UPDATE
    ON public."catUsers"
    FOR EACH ROW
    EXECUTE FUNCTION public.catusers_llenar_nomcompleto();