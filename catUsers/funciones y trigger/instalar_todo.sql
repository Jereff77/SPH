--[Fecha y Hora]: 18/10/2025 16:53:00
-- [Descripción]: Script de instalación completa para las funciones y triggers
--                de la tabla catUsers en el proyecto supaSPH-QR.
--
-- [Uso]: Ejecutar este script para instalar todos los componentes en orden
--
-- [Orden de ejecución]:
--   1. Funciones (antes que los triggers que las usan)
--   2. Triggers (que dependen de las funciones)
--
-- [Cambios]: Se agregó función catusers_registrar_nuevo_usuario para registro
--            de nuevos usuarios con validaciones de seguridad

-- =================================================================
-- 1. Crear función para actualizar nivel desde perfil
-- =================================================================
\i catusers_actualizar_nivel_desde_perfil.sql

-- =================================================================
-- 2. Crear función para llenar nombre completo
-- =================================================================
\i catusers_llenar_nomcompleto.sql

-- =================================================================
-- 3. Crear función para marcar invitación usada
-- =================================================================
\i catusers_marcar_invitacion_usada.sql

-- =================================================================
-- 4. Crear función para registrar nuevo usuario
-- =================================================================
\i catusers_registrar_nuevo_usuario.sql

-- =================================================================
-- 5. Crear función de validación de inserción
-- =================================================================
\i catusers_validar_insercion.sql

-- =================================================================
-- 6. Crear trigger para actualizar nivel desde perfil
-- =================================================================
\i trigger_catusers_actualizar_nivel_desde_perfil.sql

-- =================================================================
-- 7. Crear trigger para llenar nombre completo
-- =================================================================
\i trigger_catusers_llenar_nomcompleto.sql

-- =================================================================
-- 8. Crear trigger para marcar invitación usada
-- =================================================================
\i trigger_catusers_marcar_invitacion_usada.sql

-- =================================================================
-- 9. Verificación final
-- =================================================================
SELECT 
    'catUsers' as tabla,
    COUNT(*) as total_registros
FROM public."catUsers"
UNION ALL
SELECT 
    'funciones_catusers' as componente,
    COUNT(*) as total
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE 'catusers_%'
UNION ALL
SELECT 
    'triggers_catusers' as componente,
    COUNT(*) as total
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
AND event_object_table = 'catUsers'
AND trigger_name LIKE 'trigger_catusers_%';

RAISE NOTICE 'Instalación de catUsers completada. Verificar los resultados arriba.';
RAISE NOTICE 'Se instalaron 5 funciones y 3 triggers para la tabla catUsers.';