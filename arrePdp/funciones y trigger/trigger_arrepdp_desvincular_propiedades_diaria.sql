--[Fecha y Hora]: 21/01/2026 18:35:11
--[Descripción]: Función trigger que ejecuta automáticamente la función arrepdp_desvincular_propiedades()
--                todos los días a las 1:30 AM hora de México (America/Mexico_City).
--                Esta función está diseñada para ser llamada por pg_cron y maneja
--                el logging de ejecución y errores apropiadamente.
--
--[Parámetros]:
--   - No requiere parámetros, se ejecuta automáticamente mediante pg_cron
--
--[Salida]:
--   - void - No devuelve valor, solo ejecuta la desvinculación y registra logs
--
--[Uso típico]: Se ejecuta automáticamente mediante un job programado con pg_cron
--               Configurado para ejecutarse diariamente a las 1:30 AM hora de México
--
--[Ejemplo]: No requiere llamada manual, se ejecuta mediante:
--            SELECT cron.schedule('arrepdp-desvincular-propiedades', '30 7 * * *', 
--                               'SELECT public.trigger_arrepdp_desvincular_propiedades_diaria()');
--
--[Relaciones]: 
--   - Función principal ejecutada: public.arrepdp_desvincular_propiedades()
--   - Tabla principal afectada: public."arrePdp"
--   - Sistema de programación: pg_cron
--
--[Validaciones]:
--   - Verifica que la función arrepdp_desvincular_propiedades() exista antes de ejecutar
--   - Maneja errores apropiadamente con logging detallado
--   - Registra timestamp de inicio y fin de la ejecución
--   - Considera la zona horaria de America/Mexico_City para el logging
--
--[Consideraciones de seguridad]:
--   - SECURITY INVOKER: Ejecuta con permisos del usuario que la invoca (pg_cron)
--   - No expone datos sensibles en los logs
--   - Manejo robusto de errores para evitar interrupciones del job

CREATE OR REPLACE FUNCTION public.trigger_arrepdp_desvincular_propiedades_diaria()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $BODY$
DECLARE
    v_fecha_ejecucion timestamp with time zone := NOW();
    v_funcion_existe boolean;
    v_filas_afectadas integer;
    v_error_message text;
BEGIN
    --[Fecha y Hora]: 21/01/2026 18:35:11
    -- [Descripción]: Función trigger que ejecuta automáticamente la desvinculación de propiedades
    --                todos los días a las 1:30 AM hora de México mediante pg_cron.
    
    -- Logging de inicio de ejecución
    RAISE NOTICE '=== INICIO DE DESVINCULACIÓN AUTOMÁTICA DE PROPIEDADES ===';
    RAISE NOTICE 'Fecha y hora de ejecución: % (America/Mexico_City)', v_fecha_ejecucion AT TIME ZONE 'America/Mexico_City';
    RAISE NOTICE 'Job programado: arrepdp-desvincular-propiedades (diario a las 1:30 AM)';
    
    -- Verificar que la función arrepdp_desvincular_propiedades() exista
    SELECT EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_schema = 'public' 
        AND routine_name = 'arrepdp_desvincular_propiedades'
    ) INTO v_funcion_existe;
    
    IF NOT v_funcion_existe THEN
        v_error_message := 'La función arrepdp_desvincular_propiedades() no existe. No se puede ejecutar la desvinculación automática.';
        RAISE EXCEPTION 'ERROR CRÍTICO: %', v_error_message;
    END IF;
    
    -- Ejecutar la función de desvinculación de propiedades
    BEGIN
        -- Logging antes de la ejecución
        RAISE NOTICE 'Ejecutando función arrepdp_desvincular_propiedades()...';
        
        -- Ejecutar la función principal
        PERFORM public.arrepdp_desvincular_propiedades();
        
        -- Obtener el número de filas afectadas
        GET DIAGNOSTICS v_filas_afectadas = ROW_COUNT;
        
        -- Logging del resultado exitoso
        RAISE NOTICE '=== DESVINCULACIÓN COMPLETADA EXITOSAMENTE ===';
        RAISE NOTICE 'Filas afectadas: %', v_filas_afectadas;
        
    EXCEPTION
        WHEN OTHERS THEN
            v_error_message := SQLERRM;
            RAISE EXCEPTION 'ERROR durante la ejecución de arrepdp_desvincular_propiedades(): %', v_error_message;
    END;
    
    -- Logging de finalización
    RAISE NOTICE '=== FIN DE DESVINCULACIÓN AUTOMÁTICA DE PROPIEDADES ===';
    RAISE NOTICE 'Fecha y hora de finalización: % (America/Mexico_City)', 
        NOW() AT TIME ZONE 'America/Mexico_City';
    RAISE NOTICE 'Duración de la ejecución: %', 
        EXTRACT(EPOCH FROM (NOW() - v_fecha_ejecucion)) || ' segundos';
    
EXCEPTION
    WHEN OTHERS THEN
        -- Logging de error crítico
        RAISE NOTICE '=== ERROR CRÍTICO EN DESVINCULACIÓN AUTOMÁTICA ===';
        RAISE NOTICE 'Fecha y hora del error: % (America/Mexico_City)', 
            NOW() AT TIME ZONE 'America/Mexico_City';
        RAISE NOTICE 'Mensaje de error: %', SQLERRM;
        RAISE NOTICE 'Código de error: %', SQLSTATE;
        
        -- Relanzar la excepción para que pg_cron registre el error
        RAISE EXCEPTION 'ERROR CRÍTICO en trigger_arrepdp_desvincular_propiedades_diaria: %', SQLERRM;
END;
$BODY$;

-- Comentario adicional para documentación
COMMENT ON FUNCTION public.trigger_arrepdp_desvincular_propiedades_diaria() IS 'Función trigger que ejecuta automáticamente arrepdp_desvincular_propiedades() todos los días a las 1:30 AM hora de México. Diseñada para ser llamada por pg_cron con manejo completo de logging y errores. Incluye verificación de existencia de la función principal y registro detallado de timestamps de ejecución.';

-- Crear el job programado con pg_cron (solo si no existe)
DO $$
DECLARE
    v_job_exists boolean;
BEGIN
    -- Verificar si el job ya existe
    SELECT EXISTS (
        SELECT 1 FROM cron.job 
        WHERE jobname = 'arrepdp-desvincular-propiedades'
    ) INTO v_job_exists;
    
    IF NOT v_job_exists THEN
        -- Crear el job programado para ejecutarse diariamente a las 7:30 AM UTC
        -- Equivale a las 1:30 AM hora de México (UTC-6)
        -- Formato cron: minuto hora día-mes mes día-semana
        -- 30 7 * * * = a las 7:30 AM UTC todos los días
        PERFORM cron.schedule(
            'arrepdp-desvincular-propiedades',  -- nombre del job
            '30 7 * * *',                      -- schedule: diariamente a las 7:30 AM UTC (1:30 AM hora de México)
            'SELECT public.trigger_arrepdp_desvincular_propiedades_diaria()'  -- comando a ejecutar
        );
        
        RAISE NOTICE '✅ Job programado creado exitosamente: arrepdp-desvincular-propiedades';
        RAISE NOTICE '   - Horario: Diariamente a las 7:30 AM UTC (1:30 AM hora de México)';
        RAISE NOTICE '   - Zona horaria considerada: America/Mexico_City';
        RAISE NOTICE '   - Función ejecutada: trigger_arrepdp_desvincular_propiedades_diaria()';
    ELSE
        RAISE NOTICE 'ℹ️  El job arrepdp-desvincular-propiedades ya existe. No se creó uno nuevo.';
        RAISE NOTICE '   Para verificar el job existente: SELECT * FROM cron.job WHERE jobname = ''arrepdp-desvincular-propiedades''';
    END IF;
END $$;
