--[Fecha y Hora]: 16/11/2025 04:59:04
--[Descripción]: Script de instalación para la desactivación automática de permisos
--                cuando un usuario cambia su status a false.
--
--[Componentes instalados]:
--   1. Función: catusers_desactivar_permisos_al_cambiar_status()
--   2. Trigger: trigger_catusers_desactivar_permisos
--
--[Uso]: Ejecutar este script completo para instalar ambos componentes
--
--[Ejemplo]: SELECT * FROM instalar_desactivacion_permisos();

-- Iniciar transacción
BEGIN;

-- Mensaje de inicio
RAISE NOTICE 'Iniciando instalación de sistema de desactivación automática de permisos...';

-- 1. Instalar la función principal
\i catusers_desactivar_permisos_al_cambiar_status.sql
RAISE NOTICE 'Función catusers_desactivar_permisos_al_cambiar_status() instalada correctamente.';

-- 2. Instalar el trigger
\i trigger_catusers_desactivar_permisos.sql
RAISE NOTICE 'Trigger trigger_catusers_desactivar_permisos instalado correctamente.';

-- Confirmar instalación
RAISE NOTICE 'Sistema de desactivación automática de permisos instalado exitosamente.';
RAISE NOTICE 'A partir de ahora, cuando un usuario cambie su status a false,';
RAISE NOTICE 'todos sus permisos en segModulosUsuarios serán desactivados automáticamente.';

-- Finalizar transacción
COMMIT;

-- Mensaje de confirmación final
SELECT 'Instalación completada correctamente. Sistema activo.' AS resultado;