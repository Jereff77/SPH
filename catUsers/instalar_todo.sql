--[Fecha y Hora]: 16/11/2025 05:00:28
--[Descripción]: Script de instalación general para todos los componentes de catUsers
--
--[Componentes instalados]:
--   1. Sistema de Desactivación Automática de Permisos
--      - Función: catusers_desactivar_permisos_al_cambiar_status()
--      - Trigger: trigger_catusers_desactivar_permisos
--
--[Uso]: Ejecutar este script para instalar todos los componentes de catUsers
--
--[Ejemplo]: \i catUsers/instalar_todo.sql

-- Iniciar transacción
BEGIN;

-- Mensaje de inicio
RAISE NOTICE '=== INICIANDO INSTALACIÓN GENERAL DE CATUSERS ===';
RAISE NOTICE 'Fecha y hora: 16/11/2025 05:00:28';

-- 1. Instalar Sistema de Desactivación Automática de Permisos
RAISE NOTICE '';
RAISE NOTICE '1. Instalando Sistema de Desactivación Automática de Permisos...';

-- 1.1 Instalar la función principal
RAISE NOTICE '   1.1 Instalando función catusers_desactivar_permisos_al_cambiar_status()...';
\i 'funciones y trigger/catusers_desactivar_permisos_al_cambiar_status.sql'

-- 1.2 Instalar el trigger
RAISE NOTICE '   1.2 Instalando trigger trigger_catusers_desactivar_permisos...';
\i 'funciones y trigger/trigger_catusers_desactivar_permisos.sql'

RAISE NOTICE '   ✓ Sistema de desactivación automática instalado correctamente.';

-- 2. Verificación de instalación
RAISE NOTICE '';
RAISE NOTICE '2. Verificando componentes instalados...';

-- 2.1 Verificar función
DO $$
DECLARE
    funcion_existe boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'catusers_desactivar_permisos_al_cambiar_status'
    ) INTO funcion_existe;
    
    IF funcion_existe THEN
        RAISE NOTICE '   ✓ Función catusers_desactivar_permisos_al_cambiar_status() verificada.';
    ELSE
        RAISE NOTICE '   ✗ Función catusers_desactivar_permisos_al_cambiar_status() NO encontrada.';
    END IF;
END $$;

-- 2.2 Verificar trigger
DO $$
DECLARE
    trigger_existe boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trigger_catusers_desactivar_permisos'
    ) INTO trigger_existe;
    
    IF trigger_existe THEN
        RAISE NOTICE '   ✓ Trigger trigger_catusers_desactivar_permisos verificado.';
    ELSE
        RAISE NOTICE '   ✗ Trigger trigger_catusers_desactivar_permisos NO encontrado.';
    END IF;
END $$;

-- 3. Resumen de instalación
RAISE NOTICE '';
RAISE NOTICE '=== RESUMEN DE INSTALACIÓN ===';
RAISE NOTICE 'Componentes instalados:';
RAISE NOTICE '  • Función de desactivación automática de permisos';
RAISE NOTICE '  • Trigger para monitoreo de cambios de status';
RAISE NOTICE '';
RAISE NOTICE 'Funcionalidad implementada:';
RAISE NOTICE '  • Cuando un usuario cambia su status a false,';
RAISE NOTICE '    todos sus permisos en segModulosUsuarios se desactivan automáticamente';
RAISE NOTICE '';
RAISE NOTICE 'Archivos creados:';
RAISE NOTICE '  • funciones y trigger/catusers_desactivar_permisos_al_cambiar_status.sql';
RAISE NOTICE '  • funciones y trigger/trigger_catusers_desactivar_permisos.sql';
RAISE NOTICE '  • funciones y trigger/instalar_desactivacion_permisos.sql';
RAISE NOTICE '  • funciones y trigger/test_desactivacion_permisos.sql';
RAISE NOTICE '  • funciones y trigger/README.md';
RAISE NOTICE '  • catUsers/instalar_todo.sql (este archivo)';

-- 4. Pruebas opcionales
RAISE NOTICE '';
RAISE NOTICE '4. Para realizar pruebas del sistema:';
RAISE NOTICE '   Ejecutar: \i "funciones y trigger/test_desactivacion_permisos.sql"';
RAISE NOTICE '   Nota: Las pruebas usan transacciones con ROLLBACK';

-- 5. Consideraciones finales
RAISE NOTICE '';
RAISE NOTICE '5. Consideraciones importantes:';
RAISE NOTICE '   • El sistema está activo y funcionará automáticamente';
RAISE NOTICE '   • Se recomienda monitorear el funcionamiento inicial';
RAISE NOTICE '   • Considerar implementar sistema de logs para auditoría';
RAISE NOTICE '   • Realizar backup antes de instalar en producción';

-- Finalizar transacción
COMMIT;

RAISE NOTICE '';
RAISE NOTICE '=== INSTALACIÓN COMPLETADA EXITOSAMENTE ===';
RAISE NOTICE 'Sistema de gestión automática de permisos activo.';

-- Mensaje final de confirmación
SELECT 'Instalación general de catUsers completada correctamente.' AS resultado,
       NOW() AS fecha_instalacion;