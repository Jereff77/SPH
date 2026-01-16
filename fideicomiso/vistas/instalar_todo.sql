--[Fecha y Hora]: 31/12/2025 11:05:00
--[Descripción]: Script de instalación de todas las vistas asociadas a la tabla fideicomiso
--
--[Orden de instalación]:
--   1. v_fideicomiso (vista principal)
--
--[Notas]:
--   - Este script instala todas las vistas en el orden correcto
--   - Cada vista se crea con CREATE OR REPLACE para permitir actualizaciones
--   - Verifica la instalación al finalizar

-- ============================================
-- Vista 1: v_fideicomiso
-- ============================================
\i v_fideicomiso.sql

-- Verificar instalación
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'v_fideicomiso') THEN
        RAISE NOTICE '✓ Vista v_fideicomiso instalada correctamente';
    ELSE
        RAISE EXCEPTION '✗ Error al instalar v_fideicomiso';
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
    FROM pg_views 
    WHERE viewname IN ('v_fideicomiso');
    
    IF v_count = 1 THEN
        RAISE NOTICE '';
        RAISE NOTICE '===========================================';
        RAISE NOTICE '✓ INSTALACIÓN COMPLETADA EXITOSAMENTE';
        RAISE NOTICE '===========================================';
        RAISE NOTICE 'Vistas instaladas: % de 1', v_count;
        RAISE NOTICE '===========================================';
    ELSE
        RAISE EXCEPTION 'Error en la instalación: Solo se instalaron % de 1 vista', v_count;
    END IF;
END $$;
