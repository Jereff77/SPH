--[Fecha y Hora]: 16/11/2025 04:58:54
--[Descripción]: Trigger que se dispara al actualizar el campo status en la tabla catUsers.
--                Ejecuta automáticamente la función que desactiva los permisos del usuario
--                en segModulosUsuarios cuando el status cambia de true a false.
--
--[Evento]: UPDATE
--[Timing]: BEFORE
--[Tabla]: catUsers
--
--[Función asociada]: catusers_desactivar_permisos_al_cambiar_status()
--
--[Uso típico]: Se activa automáticamente cada vez que se actualiza un registro en catUsers
--               y el campo status cambia de true a false.
--
--[Ejemplo]: UPDATE public."catUsers" SET "status" = false WHERE "uid" = 'uuid_del_usuario';
--
--[Relaciones]:
--   - Tabla catUsers: Tabla principal donde se instala el trigger
--   - Tabla segModulosUsuarios: Tabla afectada por la desactivación de permisos
--
--[Consideraciones]:
--   - El trigger se ejecuta antes de que se complete la actualización (BEFORE)
--   - Solo afecta los permisos cuando el cambio es de true a false
--   - No interfiere con otras actualizaciones de la tabla catUsers

DROP TRIGGER IF EXISTS trigger_catusers_desactivar_permisos ON public."catUsers";

CREATE TRIGGER trigger_catusers_desactivar_permisos
BEFORE UPDATE OF "status" ON public."catUsers"
FOR EACH ROW
EXECUTE FUNCTION public.catusers_desactivar_permisos_al_cambiar_status();