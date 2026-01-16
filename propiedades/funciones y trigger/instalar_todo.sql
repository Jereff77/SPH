--[Fecha y Hora]: 24/10/2025 08:05:00
--[Descripción]: Script de instalación para todas las funciones y triggers de propiedades
--
--[Componentes instalados]:
--   - propiedades_eliminar_propiedad.sql: Función para eliminar propiedades con validación de pagos
--
--[Orden de instalación]:
--   1. Funciones de validación y eliminación
--
--[Notas]:
--   - Este script debe ejecutarse como usuario con permisos de CREATE FUNCTION
--   - Todas las funciones utilizan SECURITY INVOKER por defecto

-- Mensaje de inicio
\echo 'Instalando funciones y triggers de propiedades...'
\echo 'Fecha y hora: 24/10/2025 08:05:00'

-- 1. Función para eliminar propiedades con validación de pagos
\echo 'Instalando función propiedades_eliminar_propiedad...'
\i propiedades/funciones y trigger/propiedades_eliminar_propiedad.sql

-- Verificación de instalación
\echo 'Verificando instalación de componentes...'

SELECT 
    'propiedades_eliminar_propiedad' as nombre_componente,
    routine_name as nombre_rutina,
    routine_type as tipo,
    security_type as seguridad
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'propiedades_eliminar_propiedad';

\echo 'Instalación de propiedades completada exitosamente'
\echo 'Total de funciones instaladas: 1'
\echo 'Total de triggers instalados: 0'
\echo ''
\echo 'Para verificar el funcionamiento, puede ejecutar:'
\echo 'SELECT propiedades_eliminar_propiedad(''ID_PROPIEDAD_PRUEBA'');'