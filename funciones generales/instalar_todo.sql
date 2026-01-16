--[Fecha y Hora]: 24/10/2025 10:30:04
--[Descripción]: Script de instalación para todas las funciones generales
--                del proyecto supaSPH-QR
--
--[Uso]: Ejecutar este script para instalar todas las funciones generales
--       en el orden correcto
--
--[Notas]: 
--   - Este script instala todas las funciones generales del sistema
--   - Cada función incluye su propia documentación interna
--   - Se verifica la instalación exitosa de cada componente

-- ========================================================================
-- INSTALACIÓN DE FUNCIONES GENERALES
-- ========================================================================

-- Mensaje de inicio
\echo 'Iniciando instalación de funciones generales...'

-- ========================================================================
-- 1. CDG (Consulta Dinámica General)
-- ========================================================================
\echo 'Instalando CDG (Consulta Dinámica General)...'

-- Verificar si la función ya existe
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cdg' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
        RAISE NOTICE 'La función cdg ya existe, será reemplazada';
    END IF;
END $$;

-- Instalar la función
\i 'funciones generales/cdg.sql'

-- Verificar instalación
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cdg' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
        RAISE NOTICE '✓ Función cdg instalada correctamente';
    ELSE
        RAISE EXCEPTION '✗ Error al instalar la función cdg';
    END IF;
END $$;

-- ========================================================================
-- VERIFICACIÓN FINAL
-- ========================================================================

\echo 'Verificando instalación de todas las funciones generales...'

-- Contar funciones instaladas
DO $$
DECLARE
    v_count integer;
BEGIN
    SELECT COUNT(*) INTO v_count 
    FROM pg_proc 
    WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    AND proname IN ('cdg');
    
    RAISE NOTICE 'Total de funciones generales instaladas: %', v_count;
    
    IF v_count = 1 THEN
        RAISE NOTICE '✓ Todas las funciones generales se instalaron correctamente';
    ELSE
        RAISE EXCEPTION '✗ Faltaron funciones por instalar';
    END IF;
END $$;

-- ========================================================================
-- RESUMEN DE INSTALACIÓN
-- ========================================================================

\echo ''
\echo '========================================'
\echo 'RESUMEN DE INSTALACIÓN'
\echo '========================================'
\echo 'Funciones generales instaladas:'
\echo '  • cdg - Consulta Dinámica General'
\echo ''
\echo 'Para verificar las funciones instaladas:'
\echo 'SELECT routine_name, routine_type FROM information_schema.routines WHERE routine_schema = '\''public'\'' AND routine_name IN ('\''cdg'\'');'
\echo ''
\echo 'Para probar la función cdg:'
\echo 'SELECT cdg('\''U29tZUVuY3J5cHRlZFF1ZXJ5'\'' , '\''partial_key'\'');'
\echo '========================================'

-- Mensaje de finalización
\echo 'Instalación de funciones generales completada.'