--[Fecha y Hora]: 17/10/2025 00:07:40
-- [Descripción]: Script de instalación completa para las funciones y triggers
--                de la tabla segModulos en el proyecto supaSPH-QR.
--
-- [Uso]: Ejecutar este script para instalar todos los componentes en orden
--
-- [Orden de ejecución]:
--   1. Función (antes que el trigger que la usa)
--   2. Trigger (que depende de la función)

-- =================================================================
-- 1. Crear función para agregar módulo a todos los usuarios
-- =================================================================
\i segmodulos_agregar_todos_usuarios.sql

-- =================================================================
-- 2. Crear trigger para auto-asignar módulo a usuarios
-- =================================================================
\i trigger_segmodulos_auto_asignar.sql

-- =================================================================
-- 3. Verificación final
-- =================================================================
SELECT 
    'segModulos' as tabla,
    COUNT(*) as total_registros
FROM public."segModulos"
UNION ALL
SELECT 
    'segModulosUsuarios' as tabla,
    COUNT(*) as total_registros
FROM public."segModulosUsuarios"
UNION ALL
SELECT 
    'funciones_segmodulos' as componente,
    COUNT(*) as total
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE 'segmodulos_%'
UNION ALL
SELECT 
    'triggers_segmodulos' as componente,
    COUNT(*) as total
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
AND event_object_table = 'segModulos'
AND trigger_name LIKE 'trigger_segmodulos_%';

RAISE NOTICE 'Instalación de segModulos completada. Verificar los resultados arriba.';
RAISE NOTICE 'Se instalaron 1 función y 1 trigger para la tabla segModulos.';
RAISE NOTICE 'Los nuevos módulos se asignarán automáticamente a todos los usuarios activos.';