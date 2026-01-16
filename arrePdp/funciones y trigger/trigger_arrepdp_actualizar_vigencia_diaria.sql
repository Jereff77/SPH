--[Fecha y Hora]: 03/01/2026 01:50:00
--[Descripción]: Función trigger que ejecuta automáticamente la función arrepdp_actualizar_vigencia()
--                todos los días a la 1 AM hora de México (America/Mexico_City).
--                Esta función está diseñada para ser llamada por pg_cron y maneja
--                el logging de ejecución y errores apropiadamente.
--
--[Parámetros]:
--   - No requiere parámetros, se ejecuta automáticamente mediante pg_cron
--
--[Salida]:
--   - void - No devuelve valor, solo ejecuta la actualización y registra logs
--
--[Uso típico]: Se ejecuta automáticamente mediante un job programado con pg_cron
--               Configurado para ejecutarse diariamente a las 1:00 AM hora de México
--
--[Ejemplo]: No requiere llamada manual, se ejecuta mediante:
--            SELECT cron.schedule('arrepdp-actualizar-vigencia', '0 1 * * *', 
--                               'SELECT public.trigger_arrepdp_actualizar_vigencia_diaria()');
--
--[Relaciones]: 
--   - Función principal ejecutada: public.arrepdp_actualizar_vigencia()
--   - Tabla principal afectada: public."arrePdp"
--   - Sistema de programación: pg_cron
--
--[Validaciones]:
--   - Verifica que la función arrepdp_actualizar_vigencia() exista antes de ejecutar
--   - Maneja errores apropiadamente con logging detallado
--   - Registra timestamp de inicio y fin de la ejecución
--   - Considera la zona horaria de America/Mexico_City para el logging
--
--[Consideraciones de seguridad]:
--   - SECURITY INVOKER: Ejecuta con permisos del usuario que la invoca (pg_cron)
--   - No expone datos sensibles en los logs
--   - Manejo robusto de errores para evitar interrupciones del job

CREATE OR REPLACE FUNCTION public.trigger_arrepdp_actualizar_vigencia_diaria()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $BODY$
DECLARE
    v_fecha_ejecucion timestamp with time zone := NOW();
    v_resultado_actualizacion json;
    v_funcion_existe boolean;
    v_error_message text;
BEGIN
    --[Fecha y Hora]: 03/01/2026 01:50:00
    -- [Descripción]: Función trigger que ejecuta automáticamente la actualización de vigencia
    --                todos los días a la 1 AM hora de México mediante pg_cron.
    
    -- Logging de inicio de ejecución
    RAISE NOTICE '=== INICIO DE ACTUALIZACIÓN AUTOMÁTICA DE VIGENCIA ===';
    RAISE NOTICE 'Fecha y hora de ejecución: % (America/Mexico_City)', v_fecha_ejecucion AT TIME ZONE 'America/Mexico_City';
    RAISE NOTICE 'Job programado: arrepdp-actualizar-vigencia (diario a las 1:00 AM)';
    
    -- Verificar que la función arrepdp_actualizar_vigencia() exista
    SELECT EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_schema = 'public' 
        AND routine_name = 'arrepdp_actualizar_vigencia'
    ) INTO v_funcion_existe;
    
    IF NOT v_funcion_existe THEN
        v_error_message := 'La función arrepdp_actualizar_vigencia() no existe. No se puede ejecutar la actualización automática.';
        RAISE EXCEPTION 'ERROR CRÍTICO: %', v_error_message;
    END IF;
    
    -- Ejecutar la función de actualización de vigencia
    BEGIN
        -- Logging antes de la ejecución
        RAISE NOTICE 'Ejecutando función arrepdp_actualizar_vigencia()...';
        
        -- Ejecutar la función principal
        SELECT * INTO v_resultado_actualizacion 
        FROM public.arrepdp_actualizar_vigencia();
        
        -- Logging del resultado exitoso
        RAISE NOTICE '=== ACTUALIZACIÓN COMPLETADA EXITOSAMENTE ===';
        RAISE NOTICE 'Resultado: %', v_resultado_actualizacion::text;
        
        -- Extraer información específica del resultado para logging detallado
        IF v_resultado_actualizacion->>'exito' = 'true' THEN
            RAISE NOTICE 'Registros actualizados: %', 
                (v_resultado_actualizacion->'detalles'->'registros_actualizados'->>'total');
            RAISE NOTICE 'Fecha del proceso: %', 
                v_resultado_actualizacion->'detalles'->>'fecha_proceso';
        END IF;
        
    EXCEPTION
        WHEN OTHERS THEN
            v_error_message := SQLERRM;
            RAISE EXCEPTION 'ERROR durante la ejecución de arrepdp_actualizar_vigencia(): %', v_error_message;
    END;
    
    -- Logging de finalización
    RAISE NOTICE '=== FIN DE ACTUALIZACIÓN AUTOMÁTICA DE VIGENCIA ===';
    RAISE NOTICE 'Fecha y hora de finalización: % (America/Mexico_City)', 
        NOW() AT TIME ZONE 'America/Mexico_City';
    RAISE NOTICE 'Duración de la ejecución: %', 
        EXTRACT(EPOCH FROM (NOW() - v_fecha_ejecucion)) || ' segundos';
    
EXCEPTION
    WHEN OTHERS THEN
        -- Logging de error crítico
        RAISE NOTICE '=== ERROR CRÍTICO EN ACTUALIZACIÓN AUTOMÁTICA ===';
        RAISE NOTICE 'Fecha y hora del error: % (America/Mexico_City)', 
            NOW() AT TIME ZONE 'America/Mexico_City';
        RAISE NOTICE 'Mensaje de error: %', SQLERRM;
        RAISE NOTICE 'Código de error: %', SQLSTATE;
        
        -- Relanzar la excepción para que pg_cron registre el error
        RAISE EXCEPTION 'ERROR CRÍTICO en trigger_arrepdp_actualizar_vigencia_diaria: %', SQLERRM;
END;
$BODY$;

-- Comentario adicional para documentación
COMMENT ON FUNCTION public.trigger_arrepdp_actualizar_vigencia_diaria() IS 'Función trigger que ejecuta automáticamente arrepdp_actualizar_vigencia() todos los días a la 1 AM hora de México. Diseñada para ser llamada por pg_cron con manejo completo de logging y errores. Incluye verificación de existencia de la función principal y registro detallado de timestamps de ejecución.';

-- Crear el job programado con pg_cron (solo si no existe)
DO $$
DECLARE
    v_job_exists boolean;
BEGIN
    -- Verificar si el job ya existe
    SELECT EXISTS (
        SELECT 1 FROM cron.job 
        WHERE jobname = 'arrepdp-actualizar-vigencia'
    ) INTO v_job_exists;
    
    IF NOT v_job_exists THEN
        -- Crear el job programado para ejecutarse diariamente a las 1:00 AM
        -- Formato cron: minuto hora día-mes mes día-semana
        -- 0 1 * * * = a las 1:00 AM todos los días
        PERFORM cron.schedule(
            'arrepdp-actualizar-vigencia',  -- nombre del job
            '0 1 * * *',                  -- schedule: diariamente a las 1:00 AM
            'SELECT public.trigger_arrepdp_actualizar_vigencia_diaria()'  -- comando a ejecutar
        );
        
        RAISE NOTICE '✅ Job programado creado exitosamente: arrepdp-actualizar-vigencia';
        RAISE NOTICE '   - Horario: Diariamente a las 1:00 AM (hora del servidor)';
        RAISE NOTICE '   - Zona horaria considerada: America/Mexico_City';
        RAISE NOTICE '   - Función ejecutada: trigger_arrepdp_actualizar_vigencia_diaria()';
    ELSE
        RAISE NOTICE 'ℹ️  El job arrepdp-actualizar-vigencia ya existe. No se creó uno nuevo.';
        RAISE NOTICE '   Para verificar el job existente: SELECT * FROM cron.job WHERE jobname = ''arrepdp-actualizar-vigencia''';
    END IF;
END $$;