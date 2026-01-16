--[Fecha y Hora]: 16/11/2025 04:58:38
--[Descripción]: Función que desactiva todos los permisos de un usuario en segModulosUsuarios
--                cuando el usuario cambia su status a false en catUsers.
--
--[Parámetros]:
--   - p_uid (uuid): UUID del usuario que se está modificando
--   - p_old_status (boolean): Valor anterior del campo status
--   - p_new_status (boolean): Nuevo valor del campo status
--
--[Salida]:
--   - void: No devuelve valor, solo realiza actualizaciones en la tabla segModulosUsuarios
--
--[Uso típico]: Se ejecuta automáticamente mediante un trigger cuando el campo status
--               de la tabla catUsers es actualizado a false.
--
--[Ejemplo]: Esta función es llamada por el trigger trigger_catusers_desactivar_permisos
--
--[Relaciones]:
--   - Tabla catUsers: Tabla principal de usuarios
--   - Tabla segModulosUsuarios: Tabla de permisos de usuarios por módulo
--
--[Validaciones]:
--   - Solo ejecuta la desactivación si el nuevo status es false y el anterior era true
--   - Verifica que el usuario exista antes de intentar desactivar permisos
--
--[Consideraciones de seguridad]:
--   - Función de tipo SECURITY DEFINER para poder modificar la tabla segModulosUsuarios
--   - Incluye manejo de excepciones para registrar errores si ocurren

CREATE OR REPLACE FUNCTION public.catusers_desactivar_permisos_al_cambiar_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $BODY$
BEGIN
    --[Fecha y Hora]: 16/11/2025 04:58:38
    -- [Descripción]: Trigger que se dispara al actualizar el campo status en catUsers
    --                Llama a la función que desactiva permisos cuando el status cambia a false
    
    -- Verificar si el campo status cambió de true a false
    IF OLD."status" = true AND NEW."status" = false THEN
        -- Desactivar todos los permisos del usuario en segModulosUsuarios
        UPDATE public."segModulosUsuarios"
        SET "acceso" = false
        WHERE "uid" = NEW."uid";
        
        -- Opcional: Registrar el cambio en un log (si existe tabla de logs)
        -- INSERT INTO public."catUsersLogs" ("uid", "accion", "fecha", "detalles")
        -- VALUES (NEW."uid", 'DESACTIVAR_PERMISOS', NOW(), 
        --         'Se desactivaron todos los permisos al cambiar status a false');
    END IF;
    
    -- Retornar los nuevos datos para que la actualización continúe
    RETURN NEW;
    
EXCEPTION
    WHEN OTHERS THEN
        -- En caso de error, registrar y permitir que la transacción continúe
        -- Opcional: Registrar en tabla de errores de logs
        RAISE NOTICE 'Error al desactivar permisos para usuario %: %', NEW."uid", SQLERRM;
        RETURN NEW;
END;
$BODY$;