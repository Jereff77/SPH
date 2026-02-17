--[Fecha y Hora]: 24/10/2025 10:30:21
--[Descripción]: Script de instalación general para todos los componentes del proyecto supaSPH-QR
--
--[Parámetros]: No aplica
--
--[Salida]: No aplica
--
--[Uso típico]: Ejecutar este script para instalar o actualizar todos los componentes
--               del sistema supaSPH-QR
--
--[Ejemplo]: \i instalar_todo_general.sql
--
--[Relaciones]:
--   - Todos los módulos del proyecto
--
--[Validaciones]:
--   - Verifica que todos los componentes se instalen correctamente
--   - Muestra mensajes de confirmación para cada módulo

-- Iniciar transacción
BEGIN;

-- Mensaje de inicio
RAISE NOTICE '=================================================================';
RAISE NOTICE 'Instalación General - Sistema supaSPH-QR';
RAISE NOTICE 'Fecha y Hora: 28/01/2026 04:06:00';
RAISE NOTICE '=================================================================';

-- Instalar funciones generales (NUEVO)
RAISE NOTICE '';
RAISE NOTICE 'Instalando funciones generales...';
\i 'funciones generales/instalar_todo.sql'

-- Instalar componentes de arrePdpDetalle
RAISE NOTICE '';
RAISE NOTICE 'Instalando componentes de arrePdpDetalle...';
\i arrePdpDetalle/funciones y trigger/instalar_todo.sql

-- Instalar componentes de arrePdp (NUEVO)
RAISE NOTICE '';
RAISE NOTICE 'Instalando componentes de arrePdp...';
\i arrePdp/funciones y trigger/instalar_todo.sql

-- Instalar componentes de catAsesoresInm (NUEVO)
RAISE NOTICE '';
RAISE NOTICE 'Instalando componentes de catAsesoresInm...';
\i catAsesoresInm/funciones y trigger/instalar_todo.sql

-- Instalar componentes de Leads
RAISE NOTICE '';
RAISE NOTICE 'Instalando componentes de Leads...';
\i Leads/funciones y trigger/instalar_todo.sql

-- Instalar componentes de rentaGarantizada (NUEVO)
RAISE NOTICE '';
RAISE NOTICE 'Instalando componentes de rentaGarantizada...';
\i rentaGarantizada/funciones y trigger/instalar_todo.sql

-- Instalar componentes de propiedades (NUEVO)
RAISE NOTICE '';
RAISE NOTICE 'Instalando componentes de propiedades...';
\i propiedades/funciones y trigger/instalar_todo.sql

-- Verificación general de instalación
RAISE NOTICE '';
RAISE NOTICE '=================================================================';
RAISE NOTICE 'Verificación General de Instalación';
RAISE NOTICE '=================================================================';

DO $$
DECLARE
    v_count integer;
    v_total_functions integer := 0;
    v_total_triggers integer := 0;
BEGIN
    -- Verificar funciones generales
    SELECT COUNT(*) INTO v_count
    FROM pg_proc
    WHERE proname IN ('cdg');
    
    v_total_functions := v_total_functions + v_count;
    RAISE NOTICE 'Funciones generales instaladas: %', v_count;
    
    -- Verificar funciones de arrePdpDetalle
    SELECT COUNT(*) INTO v_count
    FROM pg_proc
    WHERE proname LIKE 'arrepdpdetalle_%';
    
    v_total_functions := v_total_functions + v_count;
    RAISE NOTICE 'Funciones de arrePdpDetalle instaladas: %', v_count;
    
    -- Verificar funciones de arrePdp
    SELECT COUNT(*) INTO v_count
    FROM pg_proc
    WHERE proname LIKE 'arrepdp_%';
    
    v_total_functions := v_total_functions + v_count;
    RAISE NOTICE 'Funciones de arrePdp instaladas: %', v_count;
    
    -- Verificar funciones de catAsesoresInm
    SELECT COUNT(*) INTO v_count
    FROM pg_proc
    WHERE proname LIKE 'catasesoresinm_%';
    
    v_total_functions := v_total_functions + v_count;
    RAISE NOTICE 'Funciones de catAsesoresInm instaladas: %', v_count;
    
    -- Verificar funciones de Leads
    SELECT COUNT(*) INTO v_count
    FROM pg_proc
    WHERE proname LIKE 'leads_%';
    
    v_total_functions := v_total_functions + v_count;
    RAISE NOTICE 'Funciones de Leads instaladas: %', v_count;
    
    -- Verificar funciones de rentaGarantizada
    SELECT COUNT(*) INTO v_count
    FROM pg_proc
    WHERE proname LIKE 'rgpdp_%' OR proname LIKE 'rgconceptos_%' OR proname LIKE 'rgpdpdetalle_%';
    
    v_total_functions := v_total_functions + v_count;
    RAISE NOTICE 'Funciones de rentaGarantizada instaladas: %', v_count;
    
    -- Verificar funciones de propiedades
    SELECT COUNT(*) INTO v_count
    FROM pg_proc
    WHERE proname LIKE 'propiedades_%';
    
    v_total_functions := v_total_functions + v_count;
    RAISE NOTICE 'Funciones de propiedades instaladas: %', v_count;
    
    -- Verificar triggers
    SELECT COUNT(*) INTO v_count
    FROM pg_trigger
    WHERE tgname LIKE 'trigger_%';
    
    v_total_triggers := v_count;
    RAISE NOTICE 'Triggers instalados: %', v_count;
    
    -- Resumen final
    RAISE NOTICE '';
    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'RESUMEN FINAL DE INSTALACIÓN';
    RAISE NOTICE 'Total de funciones instaladas: %', v_total_functions;
    RAISE NOTICE 'Total de triggers instalados: %', v_total_triggers;
    RAISE NOTICE '=================================================================';
END $$;

-- Confirmar transacción
COMMIT;

-- Mensaje de éxito final
RAISE NOTICE '';
RAISE NOTICE '=================================================================';
RAISE NOTICE '¡INSTALACIÓN COMPLETADA CON ÉXITO!';
RAISE NOTICE 'Todos los componentes del sistema supaSPH-QR han sido instalados';
RAISE NOTICE 'Fecha y Hora: 28/01/2026 04:06:00';
RAISE NOTICE '=================================================================';