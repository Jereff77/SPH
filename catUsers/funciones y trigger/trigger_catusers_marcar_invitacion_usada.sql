--[Descripción]: Trigger que marca una invitación como usada (status=false) cuando se crea un usuario en catUsers
-- [Módulo]: Sistema de Invitaciones - Control de Registro
--
-- [Función asociada]: public.catusers_marcar_invitacion_usada()
--
-- [Eventos]: INSERT en la tabla "catUsers"
--
-- [Timing]: AFTER (se ejecuta después de que se guardan los cambios)
--
-- [Comportamiento]:
--   - INSERT: Marca la invitación como usada y registra información del usuario creado
--
-- [Ejemplo]: El trigger se ejecuta automáticamente, no requiere llamada manual

-- Eliminar trigger si existe para evitar errores
DROP TRIGGER IF EXISTS trigger_catusers_marcar_invitacion_usada ON public."catUsers";

-- Crear el trigger para INSERT
CREATE TRIGGER trigger_catusers_marcar_invitacion_usada
    AFTER INSERT
    ON public."catUsers"
    FOR EACH ROW
    EXECUTE FUNCTION public.catusers_marcar_invitacion_usada();