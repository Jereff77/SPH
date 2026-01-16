--[Fecha y Hora]: 01/10/2025 12:45:00
-- [Descripción]: Trigger que actualiza automáticamente el campo "nivel" en la tabla "catUsers"
--                cuando se actualiza el campo "idPerfil", tomando el nivel del perfil seleccionado.
--
-- [Función asociada]: public.catusers_actualizar_nivel_desde_perfil()
--
-- [Eventos]: INSERT, UPDATE en la tabla "catUsers"
--
-- [Timing]: BEFORE (se ejecuta antes de que se guarden los cambios)
--
-- [Comportamiento]:
--   - INSERT: Establece el nivel inicial basado en el perfil asignado
--   - UPDATE: Actualiza el nivel si cambia el perfil
--
-- [Ejemplo]: El trigger se ejecuta automáticamente, no requiere llamada manual

-- Eliminar trigger si existe para evitar errores
DROP TRIGGER IF EXISTS trigger_catusers_actualizar_nivel_desde_perfil ON public."catUsers";

-- Crear el trigger para INSERT y UPDATE
CREATE TRIGGER trigger_catusers_actualizar_nivel_desde_perfil
    BEFORE INSERT OR UPDATE
    ON public."catUsers"
    FOR EACH ROW
    EXECUTE FUNCTION public.catusers_actualizar_nivel_desde_perfil();