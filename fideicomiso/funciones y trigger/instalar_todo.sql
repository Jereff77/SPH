--[Fecha y Hora]: 07/01/2026 20:52:00
--[Descripción]: Script de instalación de todas las funciones asociadas a la tabla fideicomiso
--
--[Orden de instalación]:
--   1. fideicomiso_rendimientos_promocion (función base)
--   2. fideicomiso_rendimientos_resumen_consulta (depende de la anterior)
--   3. plan_dispersiones_dinamico (utilizada por resumen_fideicomiso_completo y resumen_dispersion_dinamico)
--   4. resumen_dispersion_dinamico (depende de plan_dispersiones_dinamico)
--   5. resumen_fideicomiso_completo (función independiente)
--
--[Notas]:
--   - Este script instala todas las funciones en el orden correcto
--   - Cada función se crea con CREATE OR REPLACE para permitir actualizaciones
--   - Verifica la instalación al finalizar
--   - resumen_dispersion_dinamico proporciona sumarización por número de dispersión

-- ============================================
-- Función 1: fideicomiso_rendimientos_promocion
-- ============================================
\i fideicomiso_rendimientos_promocion.sql

-- Verificar instalación
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fideicomiso_rendimientos_promocion') THEN
        RAISE NOTICE '✓ Función fideicomiso_rendimientos_promocion instalada correctamente';
    ELSE
        RAISE EXCEPTION '✗ Error al instalar fideicomiso_rendimientos_promocion';
    END IF;
END $$;

-- ============================================
-- Función 2: fideicomiso_rendimientos_resumen_consulta
-- ============================================
\i fideicomiso_rendimientos_resumen_consulta.sql

-- Verificar instalación
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fideicomiso_rendimientos_resumen_consulta') THEN
        RAISE NOTICE '✓ Función fideicomiso_rendimientos_resumen_consulta instalada correctamente';
    ELSE
        RAISE EXCEPTION '✗ Error al instalar fideicomiso_rendimientos_resumen_consulta';
    END IF;
END $$;

-- ============================================
-- Función 3: plan_dispersiones_dinamico
-- ============================================
\i plan_dispersiones_dinamico.sql

-- Verificar instalación
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'plan_dispersiones_dinamico') THEN
        RAISE NOTICE '✓ Función plan_dispersiones_dinamico instalada correctamente';
    ELSE
        RAISE EXCEPTION '✗ Error al instalar plan_dispersiones_dinamico';
    END IF;
END $$;

-- ============================================
-- Función 4: resumen_dispersion_dinamico
-- ============================================
\i resumen_dispersion_dinamico.sql

-- Verificar instalación
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'resumen_dispersion_dinamico') THEN
        RAISE NOTICE '✓ Función resumen_dispersion_dinamico instalada correctamente';
    ELSE
        RAISE EXCEPTION '✗ Error al instalar resumen_dispersion_dinamico';
    END IF;
END $$;

-- ============================================
-- Función 5: resumen_fideicomiso_completo
-- ============================================
\i resumen_fideicomiso_completo.sql

-- Verificar instalación
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'resumen_fideicomiso_completo') THEN
        RAISE NOTICE '✓ Función resumen_fideicomiso_completo instalada correctamente';
    ELSE
        RAISE EXCEPTION '✗ Error al instalar resumen_fideicomiso_completo';
    END IF;
END $$;

-- ============================================
-- Verificación Final
-- ============================================
DO $$
DECLARE
    v_count integer;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM pg_proc
    WHERE proname IN (
        'fideicomiso_rendimientos_promocion',
        'fideicomiso_rendimientos_resumen_consulta',
        'plan_dispersiones_dinamico',
        'resumen_dispersion_dinamico',
        'resumen_fideicomiso_completo'
    );
    
    IF v_count = 5 THEN
        RAISE NOTICE '';
        RAISE NOTICE '===========================================';
        RAISE NOTICE '✓ INSTALACIÓN COMPLETADA EXITOSAMENTE';
        RAISE NOTICE '===========================================';
        RAISE NOTICE 'Funciones instaladas: % de 5', v_count;
        RAISE NOTICE '===========================================';
    ELSE
        RAISE EXCEPTION 'Error en la instalación: Solo se instalaron % de 5 funciones', v_count;
    END IF;
END $$;
