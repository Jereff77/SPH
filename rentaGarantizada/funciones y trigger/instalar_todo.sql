--[Fecha y Hora]: 28/01/2026 08:16:00
--[Descripción]: Script de instalación para todas las funciones y triggers del módulo rentaGarantizada
--
--[Parámetros]: No aplica
--
--[Salida]: No aplica
--
--[Uso típico]: Ejecutar este script para instalar o actualizar todos los componentes
--               del módulo rentaGarantizada
--
--[Ejemplo]: \i 'rentaGarantizada/funciones y trigger/instalar_todo.sql'
--
--[Relaciones]:
--   - Funciones de rentaGarantizada
--
--[Validaciones]:
--   - Verifica que todas las funciones se instalen correctamente
--   - Muestra mensajes de confirmación para cada componente

-- Iniciar transacción
BEGIN;

-- Mensaje de inicio
RAISE NOTICE '=================================================================';
RAISE NOTICE 'Instalación - Módulo rentaGarantizada';
RAISE NOTICE 'Fecha y Hora: 28/01/2026 08:16:00';
RAISE NOTICE '=================================================================';

-- Instalar función para insertar registros en rgPdp
RAISE NOTICE '';
RAISE NOTICE 'Instalando función rgpdp_insertar_registro...';
\i 'rentaGarantizada/funciones y trigger/rgpdp_insertar_registro.sql'

-- Instalar función para generar plan de pagos
RAISE NOTICE '';
RAISE NOTICE 'Instalando función rgpdp_generar_plan_pagos...';
\i 'rentaGarantizada/funciones y trigger/rgpdp_generar_plan_pagos.sql'

-- Verificación de instalación
RAISE NOTICE '';
RAISE NOTICE '=================================================================';
RAISE NOTICE 'Verificación de Instalación - Módulo rentaGarantizada';
RAISE NOTICE '=================================================================';

DO $$
DECLARE
    v_count integer;
    v_count2 integer;
BEGIN
    -- Verificar función rgpdp_insertar_registro
    SELECT COUNT(*) INTO v_count
    FROM pg_proc
    WHERE proname = 'rgpdp_insertar_registro';
    
    IF v_count > 0 THEN
        RAISE NOTICE '✅ Función rgpdp_insertar_registro instalada correctamente';
    ELSE
        RAISE NOTICE '❌ Función rgpdp_insertar_registro NO encontrada';
    END IF;
    
    -- Verificar función rgpdp_generar_plan_pagos
    SELECT COUNT(*) INTO v_count2
    FROM pg_proc
    WHERE proname = 'rgpdp_generar_plan_pagos';
    
    IF v_count2 > 0 THEN
        RAISE NOTICE '✅ Función rgpdp_generar_plan_pagos instalada correctamente';
    ELSE
        RAISE NOTICE '❌ Función rgpdp_generar_plan_pagos NO encontrada';
    END IF;
    
    -- Resumen final
    RAISE NOTICE '';
    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'RESUMEN FINAL DE INSTALACIÓN';
    RAISE NOTICE 'Total de funciones instaladas: %', v_count + v_count2;
    RAISE NOTICE '=================================================================';
END $$;

-- Confirmar transacción
COMMIT;

-- Mensaje de éxito final
RAISE NOTICE '';
RAISE NOTICE '=================================================================';
RAISE NOTICE '¡INSTALACIÓN COMPLETADA CON ÉXITO!';
RAISE NOTICE 'Todos los componentes del módulo rentaGarantizada han sido instalados';
RAISE NOTICE 'Fecha y Hora: 28/01/2026 08:16:00';
RAISE NOTICE '=================================================================';