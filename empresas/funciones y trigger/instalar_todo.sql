--[Fecha y Hora]: 17/10/2025 01:03:00
-- [Descripción]: Script de instalación completa para las funciones y triggers
--                de la tabla empresas en el proyecto supaSPH-QR.
--
-- [Uso]: Ejecutar este script para instalar todos los componentes en orden
--
-- [Orden de ejecución]:
--   1. Funciones (independientes)
--   2. Triggers (dependen de funciones)
--
-- [Actualización 17/10/2025]: Se agregó la función v_resumenempresas_buscar_por_id()
--                             para búsqueda filtrada por ID de empresa con permisos de parque

-- =================================================================
-- 1. Crear función de búsqueda de empresas
-- =================================================================
\i v_resumenempresas_buscar.sql

-- =================================================================
-- 2. Crear función de búsqueda por ID con filtrado de naves
-- =================================================================
\i v_resumenempresas_buscar_por_id.sql

-- =================================================================
-- 3. Verificación final
-- =================================================================
SELECT 
    'funciones_empresas' as componente,
    COUNT(*) as total
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('v_resumenempresas_buscar', 'v_resumenempresas_buscar_por_id');

RAISE NOTICE 'Instalación de funciones de empresas completada. Verificar los resultados arriba.';
RAISE NOTICE 'Se instalaron 2 funciones para la tabla empresas.';