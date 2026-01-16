--[Fecha y Hora]: 03/01/2026 01:52:00
--[Descripción]: Script de instalación para todas las funciones y triggers del módulo arrePdp
--                Este script instala los componentes en el orden correcto para evitar
--                errores de dependencia.
--
--[Orden de instalación]:
--   1. Funciones dependientes (ya deben estar instaladas en arrePdpDetalle)
--   2. Función RPC simple (con validación de superposición y soporte mesGracia)
--   3. Función RPC completa
--   4. Función de generación de corrida desde plan simple
--   5. Función de generación de detalles desde plan existente
--   6. Función de agregación de conceptos financiados
--   7. Función de actualización de vigencia
--   8. Trigger programado para ejecución automática diaria (NUEVO)
--   9. Función de eliminación de plan y actualización de estados
--
--[Verificación]: Al finalizar, muestra un resumen de componentes instalados
--
--[Notas importantes]:
--   - Este script asume que las funciones de arrePdpDetalle ya están instaladas
--   - En caso de error, revisar el mensaje específico para identificar el problema
--   - Se recomienda ejecutar en una transacción separada para poder revertir
--   - La función simple ahora incluye validación automática de superposición de períodos
--   - NUEVO: La función simple ahora incluye soporte completo para mesGracia con 4 parámetros adicionales
--   - Nueva función para generar corrida completa desde planes simples (INPC adicional opcional)
--   - Función para generar detalles desde planes existentes sin requerir parámetros adicionales
--   - Función para eliminar planes y actualizar automáticamente estados de propiedad y nave
--   - NUEVO: Trigger programado para ejecución automática diaria de actualización de vigencia
--
--[Actualización]: 03/01/2026 01:52:00 - Agregado trigger programado para actualización automática:
--               * Creada función trigger_arrepdp_actualizar_vigencia_diaria() con logging completo
--               * Configurado job pg_cron para ejecución diaria a las 1:00 AM hora de México
--               * Incluye manejo robusto de errores y verificación de dependencias
--               * Considera zona horaria America/Mexico_City para logging
--               * Impacto: Automatización completa de la actualización de vigencia de contratos
--[Actualización]: 12/12/2025 01:25 - Agregado soporte completo para mesGracia en arrepdp_crear_plan_simple_rpc:
--               * Agregados 4 parámetros p_mes_gracia_* con valores por defecto 0.0
--               * Construcción de JSON mesGracia en el INSERT con todos los componentes
--               * Incluido campo mesGracia en la respuesta JSON para confirmar configuración
--               * Actualizada documentación completa con nuevos parámetros y ejemplos
--               * Impacto: La función ahora soporta configuración completa de meses de gracia por concepto
--[Actualización]: 22/11/2025 05:29 - Corrección conceptual completa en arrepdp_crear_plan_simple_rpc:
--               * Cambio de parámetro: p_importe → p_deposito (se inserta tal cual)
--               * Eliminados cálculos automáticos: depósito, monto_mensual, num_depositos
--               * Eliminado campo "importe" del INSERT (solo se usa deposito)
--               * Simplificada función: solo inserta parámetros sin calcular
--               * Eliminada función ROUND() al no requerirse cálculos
--               * Impacto: Función simplificada que inserta datos directamente sin cálculos
--[Actualización]: 22/11/2025 04:48 - Corrección crítica de error ROUND() en arrepdp_crear_plan_simple_rpc:
--               * Corregido error ROUND(): conversión explícita a ::numeric antes de aplicar ROUND()
--               * Cambio: ROUND((p_importe - v_deposito) / p_plazomeses::double precision, 2)
--               * Por: ROUND(((p_importe - v_deposito) / p_plazomeses::double precision)::numeric, 2)
--               * Impacto: Resuelve error "function round(double precision, integer) does not exist"
--[Actualización]: 22/11/2025 04:43 - Corrección completa de tipos de datos y campos en arrepdp_crear_plan_simple_rpc:
--               * Corregida conversión de tipos en cálculo de intervalos: p_plazomeses::text
--               * Eliminados campos no existentes del INSERT: numDepositos, montoMensual
--               * Mantenida estructura correcta solo con campos existentes en la tabla
--               * Impacto: Evita errores de tipo y estructura al crear planes de pago
--[Actualización]: 22/11/2025 04:33 - Corrección crítica en validación de superposición y campos booleanos de arrepdp_crear_plan_simple_rpc:
--               * Corregida validación de superposición para usar campos booleanos: status=true, vigente=true
--               * Corregido INSERT para usar valores booleanos en lugar de texto: status=true, vigente=true
--               * Agregado campo "vigente" en el INSERT (faltaba)
--               * Mantenida compatibilidad con respuesta JSON ('estatus': 'Vigente')
--[Actualización]: 22/11/2025 04:15 - Corrección adicional en validación de disponibilidad de arrepdp_crear_plan_simple_rpc:
--               * Corregida lógica de validación para usar campos correctos: status, tienePdp, pdpActivo
--               * Una nave está disponible si está activa Y no tiene un PDP activo
--               * Actualizadas variables para usar tipos booleanos correctos
--[Actualización]: 22/11/2025 03:15 - Corrección crítica en arrepdp_crear_plan_simple_rpc:
--               * Eliminada modificación del campo "status" que debe permanecer siempre en true
--               * Ahora solo se actualizan campos específicos del plan: idArrePdp, tienePdp, pdpActivo
--               * Motivo: El campo "status" indica que el registro está activo y no debe modificarse
--[Actualización]: 22/11/2025 02:27 - Corrección completa con parámetros pm2 e inpcPlus:
--               * arrepdp_crear_plan_simple_rpc: Agregados parámetros p_pm2_admin, p_pm2_mtto, p_pm2_vig, p_inpc_plus
--               * arrepdp_crear_plan_simple_rpc: Agregados campos pm2Admin, pm2Mtto, pm2Vig, INPCPlus en INSERT
--               * arrepdp_crear_plan_simple_rpc: Corregida conversión p_uid::uuid en INSERT a arrePdp
--               * arrepdp_crear_plan_completo_rpc: Corregida conversión p_uid::uuid en INSERT a arrePdp y arreConceptos
--               * arrepdp_generar_corrida_desde_plan_simple: Eliminada conversión "::uuid" del campo uid
--               * arrepdp_generar_detalle_desde_plan: Eliminada conversión "::uuid" del campo uid
--               Los cambios fueron necesarios porque los campos uid ahora son nativamente de tipo uuid
--               y el usuario necesita poder pasar directamente los precios por m² de cada concepto
--[Actualización]: 27/11/2025 18:06:00 - Documentación completa de arrepdp_agregar_concepto_financiado:
--               * Actualizado encabezado completo con fecha y hora actual
--               * Documentación detallada según estándares del proyecto
--               * Agregadas secciones de uso típico, validaciones y consideraciones de seguridad
--               * Actualizado script de instalación para indicar que la función está documentada
--               * Actualizado README.md del módulo con información detallada de la función
--               * Impacto: Función completamente documentada según guías del proyecto
-- Iniciar transacción para instalación
BEGIN;
-- Mostrar mensaje de inicio
RAISE NOTICE '=== Iniciando instalación de funciones arrePdp ===';
RAISE NOTICE 'Fecha y hora: %', NOW();
-- 1. Instalar función RPC simple (con validación de superposición y soporte mesGracia)
RAISE NOTICE 'Instalando función simple: arrepdp_crear_plan_simple_rpc (con soporte mesGracia)';
\i arrepdp_crear_plan_simple_rpc.sql
-- Verificar instalación de la función simple
DO $$
DECLARE
    v_func_count integer;
BEGIN
    SELECT COUNT(*) INTO v_func_count
    FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_name = 'arrepdp_crear_plan_simple_rpc';
    
    IF v_func_count > 0 THEN
        RAISE NOTICE '✅ Función arrepdp_crear_plan_simple_rpc instalada correctamente';
    ELSE
        RAISE EXCEPTION '❌ Error: Función arrepdp_crear_plan_simple_rpc no se instaló';
    END IF;
END $$;
-- 2. Instalar función RPC completa
RAISE NOTICE 'Instalando función completa: arrepdp_crear_plan_completo_rpc';
\i arrepdp_crear_plan_completo_rpc.sql
-- Verificar instalación de la función completa
DO $$
DECLARE
    v_func_count integer;
BEGIN
    SELECT COUNT(*) INTO v_func_count
    FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_name = 'arrepdp_crear_plan_completo_rpc';
    
    IF v_func_count > 0 THEN
        RAISE NOTICE '✅ Función arrepdp_crear_plan_completo_rpc instalada correctamente';
    ELSE
        RAISE EXCEPTION '❌ Error: Función arrepdp_crear_plan_completo_rpc no se instaló';
    END IF;
END $$;
-- 2.1. Instalar función de generación de corrida desde plan simple
RAISE NOTICE 'Instalando función de generación de corrida: arrepdp_generar_corrida_desde_plan_simple';
\i arrepdp_generar_corrida_desde_plan_simple.sql
-- Verificar instalación de la función de generación de corrida
DO $$
DECLARE
    v_func_count integer;
BEGIN
    SELECT COUNT(*) INTO v_func_count
    FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_name = 'arrepdp_generar_corrida_desde_plan_simple';
    
    IF v_func_count > 0 THEN
        RAISE NOTICE '✅ Función arrepdp_generar_corrida_desde_plan_simple instalada correctamente';
    ELSE
        RAISE EXCEPTION '❌ Error: Función arrepdp_generar_corrida_desde_plan_simple no se instaló';
    END IF;
END $$;
-- 3. Instalar función de generación de detalles desde plan existente
RAISE NOTICE 'Instalando función: arrepdp_generar_detalle_desde_plan';
\i arrepdp_generar_detalle_desde_plan.sql
-- Verificar instalación de la función de generación de detalles
DO $$
DECLARE
    v_func_count integer;
BEGIN
    SELECT COUNT(*) INTO v_func_count
    FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_name = 'arrepdp_generar_detalle_desde_plan';
    
    IF v_func_count > 0 THEN
        RAISE NOTICE '✅ Función arrepdp_generar_detalle_desde_plan instalada correctamente';
    ELSE
        RAISE EXCEPTION '❌ Error: Función arrepdp_generar_detalle_desde_plan no se instaló';
    END IF;
END $$;
-- 4. Instalar función de agregación de conceptos financiados
RAISE NOTICE 'Instalando función: arrepdp_agregar_concepto_financiado (documentada)';
\i arrepdp_agregar_concepto_financiado.sql
-- Verificar instalación de la función de conceptos financiados
DO $$
DECLARE
    v_func_count integer;
BEGIN
    SELECT COUNT(*) INTO v_func_count
    FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_name = 'arrepdp_agregar_concepto_financiado';
    
    IF v_func_count > 0 THEN
        RAISE NOTICE '✅ Función arrepdp_agregar_concepto_financiado instalada y documentada correctamente';
    ELSE
        RAISE EXCEPTION '❌ Error: Función arrepdp_agregar_concepto_financiado no se instaló';
    END IF;
END $$;
-- 5. Instalar función de actualización de vigencia
RAISE NOTICE 'Instalando función: arrepdp_actualizar_vigencia (actualización de estado de vigencia)';

\i arrepdp_actualizar_vigencia.sql

-- Verificar instalación de la función de actualización de vigencia
DO $$
DECLARE
    v_func_count integer;
BEGIN
    SELECT COUNT(*) INTO v_func_count
    FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_name = 'arrepdp_actualizar_vigencia';
    
    IF v_func_count > 0 THEN
        RAISE NOTICE '✅ Función arrepdp_actualizar_vigencia instalada correctamente';
    ELSE
        RAISE EXCEPTION '❌ Error: Función arrepdp_actualizar_vigencia no se instaló';
    END IF;
END $$;

-- 6. Instalar trigger programado para actualización automática diaria
RAISE NOTICE 'Instalando trigger programado: trigger_arrepdp_actualizar_vigencia_diaria';

\i trigger_arrepdp_actualizar_vigencia_diaria.sql

-- Verificar instalación del trigger programado
DO $$
DECLARE
    v_func_count integer;
BEGIN
    SELECT COUNT(*) INTO v_func_count
    FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_name = 'trigger_arrepdp_actualizar_vigencia_diaria';
    
    IF v_func_count > 0 THEN
        RAISE NOTICE '✅ Función trigger_arrepdp_actualizar_vigencia_diaria instalada correctamente';
    ELSE
        RAISE EXCEPTION '❌ Error: Función trigger_arrepdp_actualizar_vigencia_diaria no se instaló';
    END IF;
END $$;

-- 7. Instalar función de eliminación de plan y actualización de estados
RAISE NOTICE 'Verificando dependencias requeridas...';

DO $$
DECLARE
    v_dep_count integer;
    v_missing_deps text := '';
BEGIN
    -- Verificar arrepdpdetalle_generar_plan_completo
    SELECT COUNT(*) INTO v_dep_count
    FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_name = 'arrepdpdetalle_generar_plan_completo';
    
    IF v_dep_count = 0 THEN
        v_missing_deps := v_missing_deps || '- arrepdpdetalle_generar_plan_completo' || E'\n';
    END IF;
    
    -- Verificar arrepdpdetalle_recalcular_anos_contrato
    SELECT COUNT(*) INTO v_dep_count
    FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_name = 'arrepdpdetalle_recalcular_anos_contrato';
    
    IF v_dep_count = 0 THEN
        v_missing_deps := v_missing_deps || '- arrepdpdetalle_recalcular_anos_contrato' || E'\n';
    END IF;
    
    IF v_missing_deps != '' THEN
        RAISE EXCEPTION '❌ Faltan dependencias requeridas: %', v_missing_deps;
    ELSE
        RAISE NOTICE '✅ Todas las dependencias requeridas están instaladas';
    END IF;
END $$;

-- Confirmar instalación
COMMIT;

-- 3. Resumen final de instalación
RAISE NOTICE '';
RAISE NOTICE '=== Resumen de instalación arrePdp ===';
RAISE NOTICE 'Fecha y hora: %', NOW();

-- Contar funciones instaladas
DO $$
DECLARE
    v_func_count integer;
BEGIN
    SELECT COUNT(*) INTO v_func_count
    FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_name LIKE 'arrepdp%';
    
    RAISE NOTICE 'Funciones instaladas: %', v_func_count;
    
    -- Listar funciones específicas
    RAISE NOTICE '';
    RAISE NOTICE 'Funciones arrePdp instaladas:';
    
    FOR i IN 1..9 LOOP
        CASE i
            WHEN 1 THEN
                IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'arrepdp_crear_plan_simple_rpc') THEN
                    RAISE NOTICE '  ✅ arrepdp_crear_plan_simple_rpc (con validación de superposición y soporte mesGracia)';
                END IF;
            WHEN 2 THEN
                IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'arrepdp_crear_plan_completo_rpc') THEN
                    RAISE NOTICE '  ✅ arrepdp_crear_plan_completo_rpc';
                END IF;
            WHEN 3 THEN
                IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'arrepdp_generar_corrida_desde_plan_simple') THEN
                    RAISE NOTICE '  ✅ arrepdp_generar_corrida_desde_plan_simple (genera corrida desde plan simple)';
                END IF;
            WHEN 4 THEN
                IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'arrepdp_generar_detalle_desde_plan') THEN
                    RAISE NOTICE '  ✅ arrepdp_generar_detalle_desde_plan (genera detalles desde plan existente)';
                END IF;
            WHEN 5 THEN
                IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'arrepdp_agregar_concepto_financiado') THEN
                    RAISE NOTICE '  ✅ arrepdp_agregar_concepto_financiado (agrega conceptos financiados - documentada)';
                END IF;
            WHEN 6 THEN
                IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'arrepdp_actualizar_vigencia') THEN
                    RAISE NOTICE '  ✅ arrepdp_actualizar_vigencia (actualiza estado de vigencia de contratos)';
                END IF;
            WHEN 7 THEN
                IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'trigger_arrepdp_actualizar_vigencia_diaria') THEN
                    RAISE NOTICE '  ✅ trigger_arrepdp_actualizar_vigencia_diaria (trigger programado diario a las 1 AM)';
                END IF;
            WHEN 8 THEN
                IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'arrepdpdetalle_generar_plan_completo') THEN
                    RAISE NOTICE '  ✅ arrepdpdetalle_generar_plan_completo (dependencia)';
                END IF;
            WHEN 9 THEN
                IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'arrepdpdetalle_recalcular_anos_contrato') THEN
                    RAISE NOTICE '  ✅ arrepdpdetalle_recalcular_anos_contrato (dependencia)';
                END IF;
        END CASE;
    END LOOP;
END $$;

RAISE NOTICE '';
RAISE NOTICE '=== Instalación completada exitosamente ===';
RAISE NOTICE 'La función RPC está lista para usarse desde el frontend';
RAISE NOTICE '';

-- 4. Ejemplos de uso
RAISE NOTICE '';
RAISE NOTICE 'Ejemplos de uso:';
RAISE NOTICE '';
RAISE NOTICE '1. Función simple (con validación de superposición):';
RAISE NOTICE 'SELECT * FROM arrepdp_crear_plan_simple_rpc(';
RAISE NOTICE '    ''UUID_USER'', ''ID_ARRENDADOR'', ''ID_NAVE'',';
RAISE NOTICE '    ''2024-01-01''::date, 24, 50000.0, 150.0, 100.0';
RAISE NOTICE ');';
RAISE NOTICE '';
RAISE NOTICE '2. Función completa:';
RAISE NOTICE 'SELECT * FROM arrepdp_crear_plan_completo_rpc(';
RAISE NOTICE '    ''UUID_USER'', ''ID_ARRENDADOR'', ''ID_NAVE'',';
RAISE NOTICE '    ''2024-01-01''::date, 24, 50000.0, 150.0, 100.0,';
RAISE NOTICE '    110.5, 2.0, 25.0, 15.0, 10.0,';
RAISE NOTICE '    0, 1, 2, 0';
RAISE NOTICE ');';
RAISE NOTICE '';
RAISE NOTICE '3. Generar corrida desde plan simple:';
RAISE NOTICE 'SELECT * FROM arrepdp_generar_corrida_desde_plan_simple(';
RAISE NOTICE '    ''PDP_241201010530_abc12345'', 2.5, 1.2';
RAISE NOTICE ');';
RAISE NOTICE '';
RAISE NOTICE '4. Generar detalles desde plan existente:';
RAISE NOTICE 'SELECT * FROM arrepdp_generar_detalle_desde_plan(';
RAISE NOTICE '    ''PDP_241201010530_abc12345''';
RAISE NOTICE ');';
RAISE NOTICE '';
RAISE NOTICE '5. Agregar concepto financiado (dividido):';
RAISE NOTICE 'SELECT * FROM arrepdp_agregar_concepto_financiado(';
RAISE NOTICE '    ''PDP_241201010530_abc12345'', ''Cuota Extra'', 12000.0, 3, 6, true';
RAISE NOTICE ');';
RAISE NOTICE '';
RAISE NOTICE '6. Agregar concepto financiado (monto completo):';
RAISE NOTICE 'SELECT * FROM arrepdp_agregar_concepto_financiado(';
RAISE NOTICE '    ''PDP_241201010530_abc12345'', ''Seguro Anual'', 5000.0, 5, 3, false';
RAISE NOTICE ');';
RAISE NOTICE '';
RAISE NOTICE '7. Actualizar vigencia de contratos:';
RAISE NOTICE 'SELECT * FROM arrepdp_actualizar_vigencia();';
RAISE NOTICE '';
RAISE NOTICE '8. Trigger programado (se ejecuta automáticamente):';
RAISE NOTICE 'SELECT * FROM trigger_arrepdp_actualizar_vigencia_diaria();';
RAISE NOTICE '';
RAISE NOTICE '   Job programado: arrepdp-actualizar-vigencia (diario a las 1:00 AM)';
RAISE NOTICE '   Verificar jobs: SELECT * FROM cron.job WHERE jobname = ''arrepdp-actualizar-vigencia''';
RAISE NOTICE '';
RAISE NOTICE '9. Eliminar plan y actualizar estados:';
RAISE NOTICE '';
RAISE NOTICE '   Ejemplo:';
RAISE NOTICE '   SELECT * FROM arrepdp_eliminar_plan_y_actualizar_estados(';
RAISE NOTICE '       ''PDP_241201010530_abc12345'', ''UUID_USUARIO''';
RAISE NOTICE ');';
RAISE NOTICE '';
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE EXCEPTION '❌ Error durante la instalación: %', SQLERRM;
END;