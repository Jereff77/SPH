--[Fecha y Hora]: 01/10/2025 00:00:00
-- [Descripción]: Trigger que agrega automáticamente el nuevo módulo a todos los usuarios existentes
-- [Módulo]: Seguridad - Gestión de módulos y permisos
--
-- [Función asociada]: public.segmodulos_agregar_todos_usuarios()
--
-- [Eventos]: INSERT en la tabla "segModulos"
--
-- [Timing]: AFTER (se ejecuta después de que se guardan los cambios)
--
-- [Comportamiento]:
--   - INSERT: Crea registros en segModulosUsuarios para todos los usuarios activos
--   - Asigna acceso: false por defecto
--   - Copia la clave del módulo para mantener consistencia
--
-- [Ejemplo]: El trigger se ejecuta automáticamente, no requiere llamada manual

-- Eliminar trigger si existe para evitar errores
DROP TRIGGER IF EXISTS trigger_segmodulos_auto_asignar ON public."segModulos";

-- Crear el trigger para INSERT
CREATE TRIGGER trigger_segmodulos_auto_asignar
    AFTER INSERT
    ON public."segModulos"
    FOR EACH ROW
    EXECUTE FUNCTION public.segmodulos_agregar_todos_usuarios();