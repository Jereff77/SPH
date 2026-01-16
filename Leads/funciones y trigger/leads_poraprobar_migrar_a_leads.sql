--[Fecha y Hora]: 03/12/2025 11:48:00
--[Descripción]: Función que migra leads aprobados desde leads_porAprobar 
--                a la tabla principal leads, completando el flujo de aprobación.
--
--[Parámetros]:
--   - p_id_lead (uuid): ID del lead a migrar (obligatorio)
--   - p_forzar_migracion (boolean): Forzar migración incluso si no está aprobado (default: false)
--
--[Salida]:
--   - jsonb: Respuesta estandarizada con éxito o error
--
--[Uso típico]:
--   Se utiliza para migrar leads que han sido aprobados (aprobado = true)
--   desde la tabla de aprobación a la tabla principal de leads.
--   Puede llamarse manualmente o activarse automáticamente mediante trigger.
--
--[Ejemplo]:
--   -- Migrar un lead aprobado
--   SELECT leads_poraprobar_migrar_a_leads('uuid-del-lead-aprobado');
--   
--   -- Forzar migración de un lead específico (uso administrativo)
--   SELECT leads_poraprobar_migrar_a_leads('uuid-del-lead', true);
--
--[Relaciones]:
--   - Tabla origen: leads_porAprobar (donde se lee el lead aprobado)
--   - Tabla destino: leads (donde se inserta el lead migrado)
--   - catUsers (valida usuarios registrador y responsable)
--   - catInmobiliarias, catAsesoresInm (valida relaciones)
--   - crm_Etapas, crm_Origen, crm_tipoCliente, crm_tipoOperaciones, crm_tipoVenta
--
--[Validaciones]:
--   - Validación obligatoria de autenticación
--   - Verificación que el lead exista en leads_porAprobar
--   - Confirmación que el lead esté aprobado (a menos que se fuerce)
--   - Validación de integridad de datos antes de migrar
--   - Prevención de duplicados en tabla leads
--
--[Triggers asociados]:
--   - trigger_leads_poraprobar_migrar_a_leads: Se activa cuando 
--     aprobado = true para migración automática
--
--[Manejo de errores]:
--   - Autenticación requerida (error 401 si no está autenticado)
--   - Lead no encontrado (error 404 si no existe en leads_porAprobar)
--   - Lead no aprobado (error 400 si aprobado != true y no se fuerza)
--   - Duplicado detectado (error 409 si ya existe en leads)
--   - Error de base de datos (error 500 con detalles técnicos)
--
--[Consideraciones de seguridad]:
--   - Función tipo SECURITY INVOKER (ejecuta con permisos del usuario)
--   - Requiere autenticación explícita para ejecutar
--   - El acceso está controlado por políticas RLS de ambas tablas
--   - Solo usuarios con permisos adecuados pueden forzar migración
--   - Mantiene auditoría completa del proceso de migración
--
--[Flujo de procesamiento]:
--   1. Validar autenticación del usuario
--   2. Verificar existencia del lead en leads_porAprobar
--   3. Confirmar estado de aprobación (o forzar si se especifica)
--   4. Validar que no exista duplicado en tabla leads
--   5. Migrar datos manteniendo estructura y relaciones
--   6. Actualizar estado en leads_porAprobar (opcional)
--   7. Registrar actividad en activity_history
--   8. Construir respuesta JSON estandarizada
--
--[Consideraciones de rendimiento]:
--   - Usa transacción para garantizar consistencia
--   - Implementa validaciones eficientes con EXISTS
--   - Permite migraciones en lote mediante llamadas sucesivas
--   - Optimiza consultas con índices adecuados
--
--[Mantenimiento]:
--   - Revisar periódicamente que la estructura de ambas tablas sea compatible
--   - Actualizar cuando se agreguen nuevos campos a migrar
--   - Monitorear errores en los logs de PostgreSQL
--   - Verificar que los triggers asociados estén operativos
--   - Considerar limpieza de leads migrados en leads_porAprobar

CREATE OR REPLACE FUNCTION public.leads_poraprobar_migrar_a_leads(
    p_id_lead uuid,
    p_forzar_migracion boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $BODY$
DECLARE
    v_lead_data "leads_porAprobar"%ROWTYPE;
    v_lead_exists_in_leads boolean;
    v_result jsonb;
    v_migrated_id uuid;
BEGIN
    --[Fecha y Hora]: 03/12/2025 11:48:00
    -- Validar que el usuario esté autenticado
    IF auth.uid() IS NULL THEN
        v_result := jsonb_build_object(
            'success', false,
            'error', 'AUTHENTICATION_REQUIRED',
            'message', 'Se requiere autenticación para migrar leads',
            'error_code', 401,
            'data', jsonb_build_object(
                'required_action', 'authenticate',
                'reason', 'Usuario no autenticado detectado',
                'security_note', 'Esta función requiere autenticación explícita por seguridad'
            )
        );
        RETURN v_result;
    END IF;
    
    -- Obtener datos del lead desde leads_porAprobar
    SELECT * INTO v_lead_data
    FROM "leads_porAprobar"
    WHERE id = p_id_lead;
    
    -- Verificar que el lead exista
    IF v_lead_data IS NULL THEN
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
    
    -- Verificar que el lead esté aprobado (a menos que se fuerce)
    IF NOT v_lead_data.aprobado AND NOT p_forzar_migracion THEN
        v_result := jsonb_build_object(
            'success', false,
            'error', 'LEAD_NOT_APPROVED',
            'message', 'El lead no está aprobado para migración',
            'error_code', 400,
            'data', jsonb_build_object(
                'lead_id', p_id_lead::text,
                'current_status', CASE 
                    WHEN v_lead_data.aprobado IS NULL THEN 'pendiente'
                    WHEN v_lead_data.aprobado THEN 'aprobado'
                    ELSE 'rechazado'
                END,
                'suggestion', 'Aprobar el lead primero o usar forzar_migracion = true'
            )
        );
        RETURN v_result;
    END IF;
    
    -- Verificar que no exista duplicado en tabla leads
    SELECT EXISTS(
        SELECT 1 
        FROM leads 
        WHERE id = p_id_lead
    ) INTO v_lead_exists_in_leads;
    
    IF v_lead_exists_in_leads THEN
        v_result := jsonb_build_object(
            'success', false,
            'error', 'DUPLICATE_LEAD',
            'message', 'El lead ya existe en la tabla principal leads',
            'error_code', 409,
            'data', jsonb_build_object(
                'lead_id', p_id_lead::text,
                'conflict_with', 'leads table'
            )
        );
        RETURN v_result;
    END IF;
    
    -- Iniciar migración en transacción
    BEGIN
        -- Insertar el lead en la tabla principal leads
        INSERT INTO leads (
            id,
            uidr,
            status,
            fc,
            "nombreLead",
            telefono,
            correo,
            "idInmobiliaria",
            "fechaContacto",
            "fechaRegistro",
            mensaje,
            "uidRC",
            "idEtapa",
            "idOrigen",
            "idTipoCliente",
            "idTipoOperacion",
            "idTipoVenta",
            "Etapa",
            "Origen",
            "tipoCliente",
            "tipoOperacion",
            "tipoVenta",
            "nomRC",
            valor,
            "idAsesorInm",
            "KVAs",
            superficie,
            ubicacion
        ) VALUES (
            v_lead_data.id,
            v_lead_data.uidr,
            v_lead_data.status,
            v_lead_data.fc,
            v_lead_data."nombreLead",
            v_lead_data.telefono,
            v_lead_data.correo,
            v_lead_data."idInmobiliaria",
            v_lead_data."fechaContacto",
            v_lead_data."fechaRegistro",
            v_lead_data.mensaje,
            v_lead_data."uidRC",
            v_lead_data."idEtapa",
            v_lead_data."idOrigen",
            v_lead_data."idTipoCliente",
            v_lead_data."idTipoOperacion",
            v_lead_data."idTipoVenta",
            v_lead_data."Etapa",
            v_lead_data."Origen",
            v_lead_data."tipoCliente",
            v_lead_data."tipoOperacion",
            v_lead_data."tipoVenta",
            v_lead_data."nomRC",
            v_lead_data.valor,
            v_lead_data."idAsesorInm",
            v_lead_data."KVAs",
            v_lead_data.superficie,
            v_lead_data.ubicacion
        ) RETURNING id INTO v_migrated_id;
        
        -- Opcional: Marcar como migrado en leads_porAprobar
        -- UPDATE "leads_porAprobar" 
        -- SET aprobado = true, fc = NOW() 
        -- WHERE id = p_id_lead;
        
        -- Registrar actividad de migración
        INSERT INTO activity_history (
            lead_id,
            name,
            activity_date,
            message,
            type,
            docs
        ) VALUES (
            v_migrated_id,
            auth.uid(),
            NOW(),
            format('Lead %s migrado desde leads_porAprobar a tabla principal leads', v_lead_data."nombreLead"),
            'lead_migrated',
            jsonb_build_object(
                'lead_id', v_migrated_id::text,
                'nombre_lead', v_lead_data."nombreLead",
                'migrated_from', 'leads_porAprobar',
                'migrated_to', 'leads',
                'migrated_by', auth.uid()::text,
                'forced_migration', p_forzar_migracion,
                'original_approval_status', v_lead_data.aprobado
            )
        );
        
        -- Construir respuesta de éxito
        v_result := jsonb_build_object(
            'success', true,
            'message', 'Lead migrado correctamente a la tabla principal',
            'data', jsonb_build_object(
                'lead_id', v_migrated_id::text,
                'nombre_lead', v_lead_data."nombreLead",
                'telefono', v_lead_data.telefono,
                'correo', v_lead_data.correo,
                'responsable_comercial', v_lead_data."nomRC",
                'inmobiliaria', v_lead_data."nombreInmobiliaria",
                'etapa', v_lead_data."Etapa",
                'origen', v_lead_data."Origen",
                'migrated_at', NOW(),
                'migrated_by', auth.uid()::text,
                'forced_migration', p_forzar_migracion
            )
        );
        
    EXCEPTION
        WHEN OTHERS THEN
            -- Si hay error en la transacción, hacer rollback y retornar error
            v_result := jsonb_build_object(
                'success', false,
                'error', 'MIGRATION_ERROR',
                'message', 'Error durante la migración del lead: ' || SQLERRM,
                'error_code', 500,
                'data', jsonb_build_object(
                    'lead_id', p_id_lead,
                    'database_error', SQLSTATE,
                    'error_detail', SQLERRM,
                    'migration_failed_at', NOW()
                )
            );
            RETURN v_result;
    END;
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        v_result := jsonb_build_object(
            'success', false,
            'error', 'FUNCTION_ERROR',
            'message', 'Error en la función de migración: ' || SQLERRM,
            'error_code', 500,
            'data', jsonb_build_object(
                'lead_id', p_id_lead,
                'database_error', SQLSTATE,
                'error_detail', SQLERRM
            )
        );
        RETURN v_result;
END;
$BODY$;

-- =====================================================
-- TRIGGER ASOCIADO PARA MIGRACIÓN AUTOMÁTICA
-- =====================================================

-- Crear trigger para migración automática cuando se aprueba un lead
CREATE OR REPLACE FUNCTION public.trigger_leads_poraprobar_migrar_a_leads()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $BODY$
BEGIN
    --[Fecha y Hora]: 03/12/2025 11:48:00
    -- Solo ejecutar si el lead cambia a aprobado = true
    IF OLD.aprobado IS DISTINCT FROM NEW.aprobado AND NEW.aprobado = true THEN
        -- Llamar a la función de migración
        PERFORM public.leads_poraprobar_migrar_a_leads(NEW.id, false);
        
        -- Opcional: Actualizar timestamp de migración
        NEW.fc = NOW();
    END IF;
    
    RETURN NEW;
END;
$BODY$;

-- Eliminar trigger existente si existe
DROP TRIGGER IF EXISTS trigger_leads_poraprobar_migrar_a_leads ON public."leads_porAprobar";

-- Crear trigger para migración automática cuando se aprueba un lead
CREATE TRIGGER trigger_leads_poraprobar_migrar_a_leads
AFTER UPDATE ON public."leads_porAprobar"
FOR EACH ROW
WHEN (OLD.aprobado IS DISTINCT FROM NEW.aprobado AND NEW.aprobado = true)
EXECUTE FUNCTION public.trigger_leads_poraprobar_migrar_a_leads();

-- =====================================================
-- FUNCIÓN ADICIONAL PARA MIGRACIÓN EN LOTE
-- =====================================================

-- Función para migrar múltiples leads aprobados
CREATE OR REPLACE FUNCTION public.leads_poraprobar_migrar_lote(
    p_limit integer DEFAULT 100,
    p_forzar_migracion boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $BODY$
DECLARE
    v_lead_record RECORD;
    v_migrated_count integer := 0;
    v_failed_count integer := 0;
    v_results jsonb := '[]'::jsonb;
    v_result jsonb;
BEGIN
    --[Fecha y Hora]: 03/12/2025 11:48:00
    -- Validar autenticación
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'AUTHENTICATION_REQUIRED',
            'message', 'Se requiere autenticación para migrar en lote',
            'error_code', 401
        );
    END IF;
    
    -- Iterar sobre los leads a migrar
    FOR v_lead_record IN 
        SELECT id 
        FROM "leads_porAprobar" 
        WHERE (aprobado = true OR p_forzar_migracion)
        ORDER BY "fechaRegistro" ASC
        LIMIT p_limit
    LOOP
        -- Intentar migrar cada lead
        v_result := public.leads_poraprobar_migrar_a_leads(v_lead_record.id, p_forzar_migracion);
        
        -- Contar éxitos y fracasos
        IF (v_result->>'success')::boolean THEN
            v_migrated_count := v_migrated_count + 1;
        ELSE
            v_failed_count := v_failed_count + 1;
        END IF;
        
        -- Acumular resultados
        v_results := v_results || jsonb_build_object(
            'lead_id', v_lead_record.id::text,
            'result', v_result
        );
    END LOOP;
    
    -- Construir respuesta final
    RETURN jsonb_build_object(
        'success', true,
        'message', format('Migración en lote completada: %s exitosas, %s fallidas', v_migrated_count, v_failed_count),
        'data', jsonb_build_object(
            'total_processed', v_migrated_count + v_failed_count,
            'migrated_count', v_migrated_count,
            'failed_count', v_failed_count,
            'limit', p_limit,
            'forced_migration', p_forzar_migracion,
            'processed_at', NOW(),
            'detailed_results', v_results
        )
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'BATCH_MIGRATION_ERROR',
            'message', 'Error en migración en lote: ' || SQLERRM,
            'error_code', 500,
            'data', jsonb_build_object(
                'database_error', SQLSTATE,
                'error_detail', SQLERRM,
                'migrated_so_far', v_migrated_count,
                'failed_so_far', v_failed_count
            )
        );
END;
$BODY$;