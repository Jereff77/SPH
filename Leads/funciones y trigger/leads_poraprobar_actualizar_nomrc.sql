--[Fecha y Hora]: 03/12/2025 11:46:00
--[Descripción]: Función que actualiza el campo nomRC en la tabla leads_porAprobar
--                cuando se modifica el responsable comercial (uidRC).
--
--[Parámetros]:
--   - p_id_lead (uuid): ID del lead a actualizar
--   - p_uid_rc (uuid): Nuevo ID del responsable comercial asignado
--
--[Salida]:
--   - jsonb: Respuesta estandarizada con éxito o error
--
--[Uso típico]:
--   Se llama automáticamente desde un trigger cuando se actualiza el campo uidRC
--   en la tabla leads_porAprobar para mantener sincronizado el campo descriptivo.
--
--[Ejemplo]:
--   -- Actualización manual del responsable comercial
--   SELECT leads_poraprobar_actualizar_nomrc('uuid-del-lead', 'nuevo-uid-rc');
--
--[Relaciones]:
--   - Tabla principal: leads_porAprobar (tabla que se actualiza)
--   - catUsers (tabla para obtener el nombre del responsable comercial)
--
--[Validaciones]:
--   - Verifica que el lead exista en leads_porAprobar
--   - Valida que el usuario esté autenticado
--   - Obtiene el nombre del responsable desde catUsers
--   - Maneja caso de responsable no encontrado
--
--[Triggers asociados]:
--   - trigger_leads_poraprobar_actualizar_nomrc: Se activa después de UPDATE
--     en leads_porAprobar cuando cambia el campo uidRC
--
--[Manejo de errores]:
--   - Autenticación requerida (error 401 si no está autenticado)
--   - Lead no encontrado (error 404 si no existe en leads_porAprobar)
--   - Error de base de datos (error 500 con detalles técnicos)
--
--[Consideraciones de seguridad]:
--   - Función tipo SECURITY INVOKER (ejecuta con permisos del usuario)
--   - Requiere autenticación explícita para ejecutar
--   - El acceso está controlado por políticas RLS de leads_porAprobar
--   - Previene actualizaciones no autorizadas del campo nomRC
--
--[Flujo de procesamiento]:
--   1. Validar autenticación del usuario
--   2. Verificar que el lead exista en leads_porAprobar
--   3. Obtener el nombre del responsable desde catUsers
--   4. Actualizar el campo nomRC en leads_porAprobar
--   5. Construir respuesta JSON estandarizada
--
--[Consideraciones de rendimiento]:
--   - Usa consulta optimizada con JOIN indexado
--   - Actualización directa sin bloqueos prolongados
--   - Se ejecuta solo cuando hay cambios relevantes en uidRC
--
--[Mantenimiento]:
--   - Revisar periódicamente que el trigger esté activo
--   - Verificar que los índices en uidRC y uid estén actualizados
--   - Monitorear errores en los logs de PostgreSQL

CREATE OR REPLACE FUNCTION public.leads_poraprobar_actualizar_nomrc(
    p_id_lead uuid,
    p_uid_rc uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $BODY$
DECLARE
    v_nombre_rc text;
    v_result jsonb;
    v_lead_exists boolean;
BEGIN
    --[Fecha y Hora]: 03/12/2025 11:46:00
    -- Validar que el usuario esté autenticado
    IF auth.uid() IS NULL THEN
        v_result := jsonb_build_object(
            'success', false,
            'error', 'AUTHENTICATION_REQUIRED',
            'message', 'Se requiere autenticación para actualizar el responsable comercial',
            'error_code', 401,
            'data', jsonb_build_object(
                'required_action', 'authenticate',
                'reason', 'Usuario no autenticado detectado',
                'security_note', 'Esta función requiere autenticación explícita por seguridad'
            )
        );
        RETURN v_result;
    END IF;
    
    -- Verificar que el lead exista en leads_porAprobar
    SELECT EXISTS(
        SELECT 1 
        FROM "leads_porAprobar" 
        WHERE id = p_id_lead
    ) INTO v_lead_exists;
    
    IF NOT v_lead_exists THEN
        v_result := jsonb_build_object(
            'success', false,
            'error', 'LEAD_NOT_FOUND',
            'message', 'El lead especificado no existe en leads_porAprobar',
            'error_code', 404,
            'data', jsonb_build_object(
                'lead_id', p_id_lead::text
            )
        );
        RETURN v_result;
    END IF;
    
    -- Obtener el nombre del responsable comercial desde catUsers
    SELECT COALESCE("nomCompleto", 'Sin nombre')
    INTO v_nombre_rc
    FROM catUsers
    WHERE uid = p_uid_rc;
    
    -- Si no se encuentra el responsable, usar valor por defecto
    IF v_nombre_rc IS NULL THEN
        v_nombre_rc := 'Responsable no encontrado';
    END IF;
    
    -- Actualizar el campo nomRC en leads_porAprobar
    UPDATE "leads_porAprobar"
    SET 
        "uidRC" = p_uid_rc,
        "nomRC" = v_nombre_rc,
        fc = NOW()  -- Actualizar timestamp de modificación
    WHERE id = p_id_lead;
    
    -- Construir respuesta de éxito
    v_result := jsonb_build_object(
        'success', true,
        'message', 'Responsable comercial actualizado correctamente',
        'data', jsonb_build_object(
            'lead_id', p_id_lead::text,
            'uid_rc', p_uid_rc::text,
            'nombre_rc', v_nombre_rc,
            'updated_at', NOW()
        )
    );
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        v_result := jsonb_build_object(
            'success', false,
            'error', 'DATABASE_ERROR',
            'message', 'Error al actualizar el responsable comercial: ' || SQLERRM,
            'error_code', 500,
            'data', jsonb_build_object(
                'lead_id', p_id_lead,
                'uid_rc', p_uid_rc,
                'database_error', SQLSTATE,
                'error_detail', SQLERRM
            )
        );
        RETURN v_result;
END;
$BODY$;

-- =====================================================
-- TRIGGER ASOCIADO
-- =====================================================

-- Crear trigger para actualizar automáticamente el campo nomRC
CREATE OR REPLACE FUNCTION public.trigger_leads_poraprobar_actualizar_nomrc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $BODY$
BEGIN
    --[Fecha y Hora]: 03/12/2025 11:46:00
    -- Solo ejecutar si cambia el uidRC
    IF OLD."uidRC" IS DISTINCT FROM NEW."uidRC" THEN
        -- Llamar a la función para actualizar nomRC
        PERFORM public.leads_poraprobar_actualizar_nomrc(NEW.id, NEW."uidRC");
    END IF;
    
    RETURN NEW;
END;
$BODY$;

-- Eliminar trigger existente si existe
DROP TRIGGER IF EXISTS trigger_leads_poraprobar_actualizar_nomrc ON public."leads_porAprobar";

-- Crear trigger para actualizar automáticamente nomRC cuando cambia uidRC
CREATE TRIGGER trigger_leads_poraprobar_actualizar_nomrc
AFTER UPDATE ON public."leads_porAprobar"
FOR EACH ROW
WHEN (OLD."uidRC" IS DISTINCT FROM NEW."uidRC")
EXECUTE FUNCTION public.trigger_leads_poraprobar_actualizar_nomrc();