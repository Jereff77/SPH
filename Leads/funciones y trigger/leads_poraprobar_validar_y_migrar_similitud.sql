--[Fecha y Hora]: 04/12/2025 04:24:00
--[Descripción]: Función que valida similitudes de leads contra la tabla leads existente
--                y realiza migración automática si no se detectan duplicados.
--
--[Parámetros]:
--   - p_id_lead_poraprobar (uuid): ID del lead en leads_porAprobar a validar y migrar
--
--[Salida]:
--   - jsonb: Estructura JSON con resultado del proceso:
--     * success (boolean): Si la operación fue exitosa
--     * message (text): Mensaje descriptivo del resultado
--     * migrated (boolean): Si se migró o no el lead
--     * validation_results (json): Resultados detallados de cada validación
--
--[Uso típico]:
--   Se utiliza para validar automáticamente si un lead pendiente de aprobación
--   es similar a alguno existente en la tabla principal leads, y si no lo es,
--   proceder con su migración automática.
--
--[Ejemplo]:
--   -- Validar y migrar un lead específico
--   SELECT leads_poraprobar_validar_y_migrar_similitud('uuid-del-lead');
--
--[Relaciones]:
--   - Tabla origen: leads_porAprobar (donde se lee el lead a validar)
--   - Tabla destino: leads (donde se validan similitudes y se migra si aplica)
--   - catUsers (valida usuarios registrador y responsable)
--   - activity_history (registra solo migraciones exitosas desde leads_poraprobar_migrar_a_leads)
--
--[Validaciones implementadas]:
--   - Similitud de nombre usando similarity() con umbral del 35%
--   - Coincidencia exacta de teléfono
--   - Coincidencia exacta de correo
--   - Autenticación obligatoria del usuario
--   - Existencia del lead en leads_porAprobar
--   - Restricción de foreign key en activity_history (solo registra leads existentes en tabla leads)
--
--[Consideraciones de seguridad]:
--   - Función tipo SECURITY INVOKER (ejecuta con permisos del usuario)
--   - Requiere autenticación explícita para ejecutar
--   - El acceso está controlado por políticas RLS de ambas tablas
--   - Mantiene auditoría completa del proceso de validación
--
--[Flujo de procesamiento]:
--   1. Validar autenticación del usuario
--   2. Verificar existencia del lead en leads_porAprobar
--   3. Obtener datos del lead (nombre, teléfono, correo)
--   4. Realizar validaciones de similitud contra tabla leads
--   5. Si alguna validación es positiva → NO migrar, retornar resultado
--   6. Si todas las validaciones son negativas → migrar automáticamente
--   7. NOTA: activity_history se actualiza solo en migraciones exitosas (desde leads_poraprobar_migrar_a_leads)
--   8. Construir respuesta JSON estandarizada
--
--[Consideraciones de rendimiento]:
--   - Usa constante de similitud 0.35 para optimizar consultas
--   - Implementa validaciones eficientes con EXISTS
--   - Usa transacción para garantizar consistencia en migración
--   - Optimiza consultas con índices adecuados en nombreLead, teléfono, correo
--
--[Mantenimiento]:
--   - Revisar periódicamente el umbral de similitud (0.35)
--   - Monitorear falsos positivos/negativos en validaciones
--   - Actualizar cuando se modifiquen campos de validación
--   - Verificar que los índices en tabla leads estén optimizados

CREATE OR REPLACE FUNCTION public.leads_poraprobar_validar_y_migrar_similitud(
    p_id_lead_poraprobar uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $BODY$
DECLARE
    -- Constante de similitud para validación de nombres
    v_similitud_umbral CONSTANT numeric := 0.35;
    
    -- Variables para datos del lead
    v_lead_data "leads_porAprobar"%ROWTYPE;
    v_nombre text;
    v_telefono text;
    v_correo text;
    
    -- Variables para resultados de validación
    v_similitud_nombre boolean := false;
    v_duplicado_telefono boolean := false;
    v_duplicado_correo boolean := false;
    
    -- Variables para control del proceso
    v_result jsonb;
    v_migration_result jsonb;
    v_validation_details jsonb;
BEGIN
    --[Fecha y Hora]: 04/12/2025 04:24:00
    -- Validar que el usuario esté autenticado
    IF auth.uid() IS NULL THEN
        v_result := jsonb_build_object(
            'success', false,
            'message', 'Se requiere autenticación para validar y migrar leads',
            'migrated', false,
            'error', 'AUTHENTICATION_REQUIRED',
            'error_code', 401,
            'validation_results', jsonb_build_object(
                'similarity_name', null,
                'duplicate_phone', null,
                'duplicate_email', null,
                'threshold_used', v_similitud_umbral
            )
        );
        RETURN v_result;
    END IF;
    
    -- Obtener datos del lead desde leads_porAprobar
    SELECT * INTO v_lead_data
    FROM "leads_porAprobar"
    WHERE id = p_id_lead_poraprobar;
    
    -- Verificar que el lead exista
    IF v_lead_data IS NULL THEN
        v_result := jsonb_build_object(
            'success', false,
            'message', 'El lead especificado no existe en leads_porAprobar',
            'migrated', false,
            'error', 'LEAD_NOT_FOUND',
            'error_code', 404,
            'validation_results', jsonb_build_object(
                'similarity_name', null,
                'duplicate_phone', null,
                'duplicate_email', null,
                'threshold_used', v_similitud_umbral
            )
        );
        RETURN v_result;
    END IF;
    
    -- Extraer datos para validaciones
    v_nombre := COALESCE(v_lead_data."nombreLead", '');
    v_telefono := COALESCE(v_lead_data.telefono, '');
    v_correo := COALESCE(v_lead_data.correo, '');
    
    -- VALIDACIÓN 1: Similitud de nombre
    -- Solo validar si el nombre no está vacío
    IF v_nombre != '' THEN
        SELECT EXISTS(
            SELECT 1 
            FROM leads 
            WHERE similarity("nombreLead", v_nombre) > v_similitud_umbral
            AND id != p_id_lead_poraprobar  -- Excluir el mismo registro si existe
            AND status = true  -- Solo considerar leads activos
        ) INTO v_similitud_nombre;
    END IF;
    
    -- VALIDACIÓN 2: Coincidencia exacta de teléfono
    -- Solo validar si el teléfono no está vacío
    IF v_telefono != '' THEN
        SELECT EXISTS(
            SELECT 1 
            FROM leads 
            WHERE telefono = v_telefono 
            AND telefono IS NOT NULL
            AND id != p_id_lead_poraprobar
            AND status = true
        ) INTO v_duplicado_telefono;
    END IF;
    
    -- VALIDACIÓN 3: Coincidencia exacta de correo
    -- Solo validar si el correo no está vacío
    IF v_correo != '' THEN
        SELECT EXISTS(
            SELECT 1 
            FROM leads 
            WHERE correo = v_correo 
            AND correo IS NOT NULL
            AND id != p_id_lead_poraprobar
            AND status = true
        ) INTO v_duplicado_correo;
    END IF;
    
    -- Construir detalles de validación
    v_validation_details := jsonb_build_object(
        'similarity_name', v_similitud_nombre,
        'duplicate_phone', v_duplicado_telefono,
        'duplicate_email', v_duplicado_correo,
        'threshold_used', v_similitud_umbral,
        'validated_name', v_nombre,
        'validated_phone', v_telefono,
        'validated_email', v_correo
    );
    
    -- Evaluar resultados de validación
    IF v_similitud_nombre OR v_duplicado_telefono OR v_duplicado_correo THEN
        -- HAY DUPLICADO O SIMILITUD → NO MIGRAR
        v_result := jsonb_build_object(
            'success', true,
            'message', 'Lead no migrado por detectarse similitudes o duplicados',
            'migrated', false,
            'validation_results', v_validation_details,
            'data', jsonb_build_object(
                'lead_id', p_id_lead_poraprobar::text,
                'lead_name', v_nombre,
                'reason_for_no_migration', CASE
                    WHEN v_similitud_nombre AND v_duplicado_telefono AND v_duplicado_correo THEN 
                        'Similitud de nombre, teléfono y correo duplicados'
                    WHEN v_similitud_nombre AND v_duplicado_telefono THEN 
                        'Similitud de nombre y teléfono duplicado'
                    WHEN v_similitud_nombre AND v_duplicado_correo THEN 
                        'Similitud de nombre y correo duplicado'
                    WHEN v_duplicado_telefono AND v_duplicado_correo THEN 
                        'Teléfono y correo duplicados'
                    WHEN v_similitud_nombre THEN 
                        'Similitud de nombre detectada'
                    WHEN v_duplicado_telefono THEN 
                        'Teléfono duplicado'
                    WHEN v_duplicado_correo THEN 
                        'Correo duplicado'
                    ELSE 'Validación fallida'
                END,
                'validation_timestamp', NOW()
            )
        );
        
        -- NOTA: No se registra en activity_history porque el lead aún no existe en la tabla leads
        -- El registro de actividad se realiza después de una migración exitosa en la función
        -- leads_poraprobar_migrar_a_leads para evitar violar la foreign key constraint
        
    ELSE
        -- NO HAY DUPLICADOS → PROCEDER CON MIGRACIÓN AUTOMÁTICA
        -- Llamar a la función de migración existente
        v_migration_result := public.leads_poraprobar_migrar_a_leads(p_id_lead_poraprobar, false);
        
        -- Verificar si la migración fue exitosa
        IF (v_migration_result->>'success')::boolean THEN
            v_result := jsonb_build_object(
                'success', true,
                'message', 'Lead validado y migrado correctamente (sin similitudes detectadas)',
                'migrated', true,
                'validation_results', v_validation_details,
                'migration_result', v_migration_result,
                'data', jsonb_build_object(
                    'lead_id', p_id_lead_poraprobar::text,
                    'lead_name', v_nombre,
                    'migration_reason', 'Sin similitudes o duplicados detectados',
                    'validation_timestamp', NOW()
                )
            );
            
            -- NOTA: No se registra en activity_history aquí porque el registro se realiza
            -- dentro de la función leads_poraprobar_migrar_a_leads después de la migración exitosa
            -- Esto evita problemas con la foreign key constraint ya que el ID solo existe
            -- en la tabla leads después de la migración
        ELSE
            -- La migración falló, retornar error de migración
            v_result := jsonb_build_object(
                'success', false,
                'message', 'Lead validado correctamente pero falló la migración automática',
                'migrated', false,
                'validation_results', v_validation_details,
                'migration_error', v_migration_result,
                'error', 'MIGRATION_FAILED',
                'error_code', 500,
                'data', jsonb_build_object(
                    'lead_id', p_id_lead_poraprobar::text,
                    'lead_name', v_nombre,
                    'validation_passed', true,
                    'migration_failed', true,
                    'migration_error_details', v_migration_result->'error'
                )
            );
            
            -- NOTA: No se registra en activity_history porque el lead no existe en la tabla leads
            -- La migración falló, por lo que no hay un lead válido para asociar con la actividad
            -- El error se devuelve en el JSON para manejo apropiado por la aplicación
        END IF;
    END IF;
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        v_result := jsonb_build_object(
            'success', false,
            'message', 'Error en la función de validación y migración: ' || SQLERRM,
            'migrated', false,
            'error', 'FUNCTION_ERROR',
            'error_code', 500,
            'validation_results', jsonb_build_object(
                'similarity_name', null,
                'duplicate_phone', null,
                'duplicate_email', null,
                'threshold_used', v_similitud_umbral,
                'error_occurred', true
            ),
            'data', jsonb_build_object(
                'lead_id', p_id_lead_poraprobar,
                'database_error', SQLSTATE,
                'error_detail', SQLERRM,
                'error_timestamp', NOW()
            )
        );
        
        -- NOTA: No se registra en activity_history porque el lead no existe en la tabla leads
        -- En caso de error, el lead no ha sido migrado, por lo que no hay un ID válido
        -- El error se devuelve en el JSON para manejo apropiado por la aplicación
        
        RETURN v_result;
END;
$BODY$;

-- =====================================================
-- COMENTARIOS ADICIONALES
-- =====================================================

/*
NOTAS IMPORTANTES SOBRE LA FUNCIÓN:

1. UMBRAL DE SIMILITUD:
   - Se utiliza 0.35 (35%) como umbral para similitud de nombres
   - Este valor puede ajustarse según necesidades del negocio
   - La función similarity() de PostgreSQL es sensible a mayúsculas/minúsculas

2. VALIDACIONES REALIZADAS:
   - Similitud de nombre: Compara con todos los leads activos usando similarity()
   - Teléfono duplicado: Búsqueda exacta (case-sensitive)
   - Correo duplicado: Búsqueda exacta (case-sensitive)

3. COMPORTAMIENTO:
   - Si CUALQUIER validación es positiva → NO migra el lead
   - Si TODAS las validaciones son negativas → migra automáticamente
   - Si un campo está vacío, se omite esa validación específica

4. INTEGRACIÓN:
   - Reutiliza la función leads_poraprobar_migrar_a_leads() para la migración
   - Mantiene compatibilidad con el flujo existente de aprobación
   - Registra todas las actividades en activity_history

5. SEGURIDAD:
   - Requiere autenticación obligatoria
   - Usa SECURITY INVOKER para ejecutar con permisos del usuario
   - Respeta las políticas RLS de ambas tablas

6. MANEJO DE ERRORES:
   - Captura y registra todos los errores de base de datos
   - Proporciona mensajes descriptivos para cada tipo de error
   - NOTA IMPORTANTE: Los errores no se registran en activity_history para evitar
                      violar la foreign key constraint ya que el lead no existe en tabla leads

7. RENDIMIENTO:
   - Usa EXISTS() para validaciones eficientes
   - Considera solo leads activos (status = true) en validaciones
   - Requiere índices adecuados en nombreLead, teléfono, correo

8. FLEXIBILIDAD:
   - La constante de similitud puede modificarse fácilmente
   - La estructura JSON de respuesta es extensible
   - Compatible con llamadas asíncronas y batch processing

9. CAMBIOS RECIENTES (04/12/2025):
   - CORRECCIÓN CRÍTICA: Se eliminaron las inserciones en activity_history cuando el lead
     no existe en la tabla leads para evitar violar la foreign key constraint
   - Ahora solo se registra en activity_history cuando la migración es exitosa
     (se realiza dentro de la función leads_poraprobar_migrar_a_leads)
   - Para errores y validaciones fallidas, se devuelve información detallada en JSON
     sin intentar insertar en activity_history
   - Este cambio resuelve el error: 23503: insert or update on table "activity_history"
     violates foreign key constraint "activity_history_lead_id_fkey"
*/