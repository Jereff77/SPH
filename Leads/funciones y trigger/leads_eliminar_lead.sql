--[Fecha y Hora]: 18/11/2025 17:05:00
--[Descripción]: Función para eliminar un registro de la tabla leads con validación de permisos
--
--[Parámetros]:
--   - p_id_lead (uuid): ID del lead a eliminar
--
--[Salida]:
--   - text: Mensaje indicando el resultado de la operación
--
--[Uso típico]: Se utiliza para eliminar leads del sistema cuando el usuario tiene el permiso adecuado
--
--[Ejemplo]: SELECT leads_eliminar_lead('uuid-del-lead-a-eliminar');
--
--[Relaciones]: 
--   - Tabla principal: leads
--   - Tabla de permisos: segModulosUsuarios
--
--[Validaciones]:
--   - Verifica que el usuario tenga el permiso 327 (CRM > Leads > Eliminar Leads) activo
--   - Verifica que el lead exista antes de eliminarlo
--   - Función de tipo SECURITY DEFINER para ejecutar con privilegios elevados

CREATE OR REPLACE FUNCTION public.leads_eliminar_lead(p_id_lead uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $BODY$
DECLARE
    v_tiene_permiso boolean;
    v_lead_existe boolean;
    v_nombre_lead text;
    v_response jsonb;
BEGIN
    --[Fecha y Hora]: 18/11/2025 17:05:00
    -- [Descripción]: Función para eliminar un registro de la tabla leads con validación de permisos
    --
    -- [Entrada]: p_id_lead (uuid) - El ID del lead que se desea eliminar
    --
    -- [Salida]: text - Mensaje indicando el resultado de la operación
    --
    -- [Uso típico]: Se utiliza para eliminar leads del sistema cuando el usuario tiene el permiso adecuado
    --               Requiere el permiso 327 (CRM > Leads > Eliminar Leads) en segModulosUsuarios
    --
    -- [Ejemplo]: SELECT leads_eliminar_lead('123e4567-e89b-12d3-a456-426614174000');
    --
    -- [Relaciones]: 
    --   - Tabla principal: leads
    --   - Tabla de validación: segModulosUsuarios
    --
    -- [Validaciones]:
    --   - Verifica que el usuario esté autenticado (CRÍTICO para SECURITY DEFINER)
    --   - Verifica que el usuario tenga el permiso 327 activo
    --   - Verifica que el lead exista antes de eliminarlo
    --   - Función de tipo SECURITY DEFINER para ejecutar con privilegios elevados
    
    -- 🔐 VALIDACIÓN DE SEGURIDAD CRÍTICA: Verificar que el usuario esté autenticado
    -- Esto previene que usuarios anónimos puedan ejecutar la función con SECURITY DEFINER
    IF auth.uid() IS NULL THEN
        v_response := jsonb_build_object(
            'success', false,
            'error', 'AUTHENTICATION_REQUIRED',
            'message', 'Se requiere autenticación para eliminar leads',
            'error_code', 401,
            'data', jsonb_build_object(
                'required_action', 'authenticate',
                'reason', 'Usuario no autenticado detectado',
                'security_note', 'Esta función requiere autenticación explícita por seguridad'
            )
        );
        RETURN v_response;
    END IF;
    
    -- Verificar si el usuario tiene el permiso 327 activo
    SELECT EXISTS (
        SELECT 1
        FROM "segModulosUsuarios" smu
        WHERE smu.uid = auth.uid() 
          AND smu.clave = 327 
          AND smu.acceso = true
    ) INTO v_tiene_permiso;
    
    -- Si no tiene permiso, retornar JSON de error
    IF NOT v_tiene_permiso THEN
        v_response := jsonb_build_object(
            'success', false,
            'error', 'PERMISSION_DENIED',
            'message', 'El usuario no tiene permiso para eliminar leads (permiso 327 no activo)',
            'error_code', 403,
            'data', jsonb_build_object(
                'required_permission', 327,
                'permission_name', 'CRM > Leads > Eliminar Leads',
                'user_uid', auth.uid()
            )
        );
        RETURN v_response;
    END IF;
    
    -- Verificar si el lead existe
    SELECT EXISTS (
        SELECT 1 
        FROM leads 
        WHERE id = p_id_lead
    ) INTO v_lead_existe;
    
    -- Si el lead no existe, retornar JSON de error
    IF NOT v_lead_existe THEN
        v_response := jsonb_build_object(
            'success', false,
            'error', 'LEAD_NOT_FOUND',
            'message', 'El lead especificado no existe',
            'error_code', 404,
            'data', jsonb_build_object(
                'lead_id', p_id_lead
            )
        );
        RETURN v_response;
    END IF;
    
    -- Obtener el nombre del lead para el mensaje de confirmación
    SELECT "nombreLead" INTO v_nombre_lead
    FROM leads 
    WHERE id = p_id_lead;
    
    -- Eliminar el lead
    DELETE FROM leads
    WHERE id = p_id_lead;
    
    -- Retornar JSON de éxito
    v_response := jsonb_build_object(
        'success', true,
        'message', 'Lead eliminado correctamente',
        'data', jsonb_build_object(
            'lead_id', p_id_lead,
            'lead_name', COALESCE(v_nombre_lead, 'Sin nombre'),
            'deleted_at', NOW(),
            'deleted_by', auth.uid()
        )
    );
    RETURN v_response;
    
EXCEPTION
    WHEN OTHERS THEN
        v_response := jsonb_build_object(
            'success', false,
            'error', 'DATABASE_ERROR',
            'message', 'No se pudo eliminar el lead',
            'error_code', 500,
            'data', jsonb_build_object(
                'lead_id', p_id_lead,
                'database_error', SQLERRM,
                'error_detail', SQLSTATE
            )
        );
        RETURN v_response;
END;
$BODY$;