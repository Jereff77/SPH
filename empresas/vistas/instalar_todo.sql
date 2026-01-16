--[Fecha y Hora]: 17/10/2025 00:52:00
-- [Descripción]: Script de instalación completa para las vistas de la tabla empresas
--                en el proyecto supaSPH-QR.
--
-- [Uso]: Ejecutar este script para instalar todas las vistas en orden
--
-- [Orden de ejecución]:
--   1. Vistas (independientes)
--
-- [Actualización 17/10/2025]: Se actualizó la vista v_resumenempresas para incluir
--                             la columna navesAsignadas con array JSON de IDs de naves

-- =================================================================
-- 1. Crear vista de resumen de empresas
-- =================================================================
\i v_resumenempresas.sql

-- =================================================================
-- 2. Verificación final
-- =================================================================
SELECT 
    'vistas_empresas' as componente,
    COUNT(*) as total
FROM information_schema.views 
WHERE table_schema = 'public' 
AND table_name = 'v_resumenempresas';

RAISE NOTICE 'Instalación de vistas de empresas completada. Verificar los resultados arriba.';
RAISE NOTICE 'Se instaló 1 vista para la tabla empresas.';