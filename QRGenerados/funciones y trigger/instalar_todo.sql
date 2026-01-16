--[Fecha y Hora]: 01/12/2025 17:01:00
--[Descripción]: Script de instalación para todos los componentes de la tabla QRGenerados
--                Este script instala en el orden correcto todas las funciones y triggers
--
--[Uso típico]: Ejecutar este script para instalar o actualizar todos los componentes
--               de QRGenerados en la base de datos
--
--[Ejemplo]: \i QRGenerados/funciones y trigger/instalar_todo.sql
--
--[Cambios recientes]:
--   - Se agregó validación de tiempo mínimo en qrgenerados_validar_acceso
--     para requerir 5 minutos entre entrada y salida
--   - Nuevo status code 3 para tiempo mínimo no cumplido
--   - Se muestra tiempo restante en minutos cuando no se cumple la validación
--   - Se corrigió el manejo de zona horaria en qrgenerados_validar_acceso
--     para usar siempre la zona horaria de México (America/Mexico_City)
--   - Se agregó ID, nombre de empresa y ID del parque en qrgenerados_obtener_registros_dia
--     obtenido desde las tablas qrEmpresas y empresas
--   - Se mejoró el ordenamiento en qrgenerados_obtener_registros_dia
--     para mostrar los eventos más recientes primero
--   - Se modificó la estructura de qrgenerados_obtener_registros_dia
--     para mostrar una columna de fecha y una de tipo de evento
--   - Se eliminó el filtro de status en qrgenerados_obtener_registros_dia
--     para mostrar todos los registros del día sin importar su estado

-- Mostrar mensaje de inicio
\echo '=========================================='
\echo 'Instalando componentes de QRGenerados...'
\echo '=========================================='
\echo ''

-- Instalar función de validación de accesos
\echo 'Instalando función qrgenerados_validar_acceso...'
\i QRGenerados/funciones y trigger/qrgenerados_validar_acceso.sql

-- Instalar función de obtención de registros del día
\echo 'Instalando función qrgenerados_obtener_registros_dia...'
\i QRGenerados/funciones y trigger/qrgenerados_obtener_registros_dia.sql

-- Verificar instalación de componentes
\echo ''
\echo '=========================================='
\echo 'Verificando instalación...'
\echo '=========================================='

-- Verificar funciones instaladas
\echo ''
\echo 'Funciones instaladas:'
SELECT
    proname as nombre_funcion,
    pg_get_function_result(oid) as tipo_retorno,
    pg_get_function_arguments(oid) as parametros
FROM pg_proc
WHERE proname LIKE 'qrgenerados_%'
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY proname;

\echo ''
\echo '=========================================='
\echo 'Instalación de QRGenerados completada'
\echo '=========================================='
\echo ''
\echo 'Resumen:'
\echo '- Funciones instaladas: 2'
\echo '- Triggers instalados: 0'
\echo '- Última actualización: 01/12/2025 17:01:00'
\echo ''
\echo 'Cambios importantes:'
\echo '- Validación de tiempo mínimo de 5 minutos entre entrada y salida'
\echo '- Nuevo status code 3 para tiempo mínimo no cumplido'
\echo '- Corrección de zona horaria en qrgenerados_validar_acceso'
\echo '- Ahora todas las operaciones usan zona horaria de México'
\echo ''
\echo 'Para verificar el funcionamiento, ejecute:'
\echo 'SELECT qrgenerados_validar_acceso(''CLAVE_PRUEBA'');'
\echo 'SELECT * FROM qrgenerados_obtener_registros_dia();'
\echo ''