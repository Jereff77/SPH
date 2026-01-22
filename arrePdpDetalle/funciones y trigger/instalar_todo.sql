--[Fecha y Hora]: 20/01/2026 21:48:36
--[Descripción]: Script de instalación completa para todas las funciones y triggers
--                de la tabla arrePdpDetalle. Ejecuta los componentes en el orden
--                correcto para evitar dependencias circulares.
--
--[Orden de instalación]:
--   1. Funciones independientes y de cálculo
--   2. Funciones de actualización y recálculo
--   3. Funciones masivas
--   4. Triggers (siempre al final)
--
--[Uso]: \i instalar_todo.sql
--
--[Requisitos]:
--   - Conexión a base de datos con permisos de CREATE FUNCTION
--   - Tabla arrePdpDetalle debe existir
--   - Tabla inpc debe existir para funciones de INPC
--
--[Verificación posterior]:
--   SELECT COUNT(*) as funciones_instaladas
--   FROM information_schema.routines
--   WHERE routine_name LIKE '%arrepdpdetalle%' AND routine_schema = 'public';
--
--   SELECT COUNT(*) as triggers_instalados
--   FROM information_schema.triggers
--   WHERE trigger_name LIKE '%arrepdpdetalle%' AND trigger_schema = 'public';
--
--[Actualización]: 20/01/2026 21:48:36 - Mejora en arrepdpdetalle_obtener_resumen_por_plan:
--               * Agregada columna pdpActivo (boolean) en la cláusula RETURNS TABLE
--               * Modificado el SELECT para hacer JOIN con arrePdp y arrenPropiedades
--               * Agregada selección de arp."pdpActivo" en la consulta principal
--               * La función ahora retorna el estado activo del plan junto con el resumen por partida
--
--[Actualización]: 20/01/2026 15:35:00 - Corrección CRÍTICA en arrepdpdetalle_obtener_resumen_por_plan:
--               * Corregida referencia a columna pdpActivo: ahora selecciona de arrenPropiedades (arp) en lugar de arrePdp (ap)
--               * Resuelve error: "column ap.pdpActivo does not exist"
--               * Función ahora valida correctamente que pdpActivo = true en arrenPropiedades
--
--[Actualización]: 20/01/2026 15:15:00 - Mejora en arrepdpdetalle_obtener_resumen_por_plan:
--               * Agregado parámetro p_validar con valor por defecto true
--               * Si p_validar = true, valida que pdpActivo = true en arrenPropiedades
--               * Si la validación falla, devuelve conjunto vacío
--               * Si p_validar = false, muestra la consulta sin validación
--               * Proporciona seguridad adicional para planes activos
--
--[Actualización]: 12/12/2025 10:19 - Corrección CRÍTICA de arrepdpdetalle_aplicar_meses_gracia:
--               * Se implementó mapeo explícito de conceptos JSON a conceptos de BD
--               * "administracion" (JSON) → "Administración" (BD) para manejar acentos
--               * Resuelve problema donde no se aplicaban meses de gracia para administración
--               * Mapeo implementado para: renta, mantenimiento, vigilancia, administracion
--               * Se eliminó el control explícito de transacciones (BEGIN/COMMIT/ROLLBACK)
--               * Se corrigió el casteo del tipo ENUM "mesGratis" para el campo "tieneMesGratis"
--               * Función para aplicar descuentos de cortesía basados en configuración JSON
--               * Procesa valores enteros y decimales para diferentes tipos de descuento
--               * Actualiza campo tieneMesGratis con valores 'Si', 'Medio' o NULL
--               * Se integra con el campo mesGracia de la tabla arrePdp

-- =========================================================================
-- INICIO DE INSTALACIÓN - FUNCIONES Y TRIGGERS arrePdpDetalle
-- =========================================================================

-- Mensaje de inicio
\echo 'Iniciando instalación de funciones y triggers para arrePdpDetalle...'
\echo 'Fecha y hora: 20/01/2026 21:48:36'

-- =========================================================================
-- 1. FUNCIONES DE CÁLCULO (Independientes)
-- =========================================================================

\echo 'Instalando funciones de cálculo básico...'

-- Función para cálculo automático de cantidades (usada por trigger)
\i arrepdpdetalle_calcular_cantidad.sql

-- Función para cálculo masivo de años por plan
\i arrepdpdetalle_calcular_anio_por_plan.sql

\echo '✓ Funciones de cálculo básico instaladas'

-- =========================================================================
-- 2. FUNCIONES DE ACTUALIZACIÓN Y RECÁLCULO
-- =========================================================================

\echo 'Instalando funciones de actualización y recálculo...'

-- Función para recálculo completo de años de contrato
\i arrepdpdetalle_recalcular_anos_contrato.sql

-- Función para actualización manual de campos
\i arrepdpdetalle_actualizar_campo_manual.sql

-- Función para actualización de INPC (completa)
\i arrepdpdetalle_actualizar_inpc.sql

-- Función para actualización de INPC desde año específico
\i arrepdpdetalle_actualizar_inpc_desde_anio.sql

-- Función para aplicar meses de gracia basados en configuración JSON
\i arrepdpdetalle_aplicar_meses_gracia.sql

\echo '✓ Funciones de actualización y recálculo instaladas'

-- =========================================================================
-- 3. FUNCIONES MASIVAS
-- =========================================================================

\echo 'Instalando funciones masivas...'

-- Función para recálculo masivo de todas las cantidades
\i arrepdpdetalle_recalcular_todas_cantidades.sql

-- Función para cálculo y actualización de ciclos
\i actualizar_ciclo_plan_pago.sql

-- Función para generación completa de planes de pago
\i arrepdpdetalle_generar_plan_completo.sql

-- Función para obtener resumen agrupado por partida de un plan
\i arrepdpdetalle_obtener_resumen_por_plan.sql

\echo '✓ Funciones masivas instaladas'

-- =========================================================================
-- 4. TRIGGERS (Siempre al final)
-- =========================================================================

\echo 'Instalando triggers...'

-- Trigger para cálculo automático de cantidades
\i trigger_arrepdpdetalle_calcular_cantidad.sql

\echo '✓ Triggers instalados'

-- =========================================================================
-- VERIFICACIÓN DE INSTALACIÓN
-- =========================================================================

\echo 'Verificando instalación...'

-- Contar funciones instaladas
DO $$
DECLARE
    funciones_count integer;
    triggers_count integer;
BEGIN
    SELECT COUNT(*) INTO funciones_count
    FROM information_schema.routines 
    WHERE routine_name LIKE '%arrepdpdetalle%' 
      AND routine_schema = 'public';
    
    SELECT COUNT(*) INTO triggers_count
    FROM information_schema.triggers 
    WHERE trigger_name LIKE '%arrepdpdetalle%' 
      AND trigger_schema = 'public';
    
    RAISE NOTICE '✅ Instalación completada exitosamente';
    RAISE NOTICE '📊 Funciones instaladas: %', funciones_count;
    RAISE NOTICE '📊 Triggers instalados: %', triggers_count;
    RAISE NOTICE '📁 Ubicación: arrePdpDetalle/funciones y trigger/';
    RAISE NOTICE '📋 Documentación: README.md';
    
    IF funciones_count = 11 AND triggers_count = 1 THEN
        RAISE NOTICE '🎉 Todos los componentes instalados correctamente';
    ELSE
        RAISE NOTICE '⚠️  Verificar: se esperaban 11 funciones y 1 trigger';
    END IF;
END $$;

-- =========================================================================
-- RESUMEN DE COMPONENTES INSTALADOS
-- =========================================================================

\echo ''
\echo '=== RESUMEN DE INSTALACIÓN ==='
\echo 'Funciones instaladas:'
\echo '  • arrepdpdetalle_calcular_cantidad()'
\echo '  • arrepdpdetalle_calcular_anio_por_plan()'
\echo '  • arrepdpdetalle_recalcular_anos_contrato()'
\echo '  • arrepdpdetalle_actualizar_campo_manual()'
\echo '  • arrepdpdetalle_actualizar_inpc()'
\echo '  • arrepdpdetalle_actualizar_inpc_desde_anio()'
\echo '  • arrepdpdetalle_aplicar_meses_gracia()'
\echo '  • arrepdpdetalle_generar_plan_completo()'
\echo '  • arrepdpdetalle_obtener_resumen_por_plan() (ACTUALIZADA - incluye pdpActivo)'
\echo '  • arrepdpdetalle_recalcular_todas_cantidades()'
\echo '  • actualizar_ciclo_plan_pago()'
\echo ''
\echo 'Triggers instalados:'
\echo '  • trigger_arrepdpdetalle_calcular_cantidad'
\echo ''
\echo '=== INSTRUCCIONES DE USO ==='
\echo 'Consultar el archivo README.md para ejemplos y casos de uso'
\echo ''
\echo '=== VERIFICACIÓN RÁPIDA ==='
\echo 'SELECT * FROM arrepdpdetalle_recalcular_todas_cantidades();'
\echo ''
\echo '¡Instalación completada! 🚀'

-- =========================================================================
-- FIN DE INSTALACIÓN
-- =========================================================================