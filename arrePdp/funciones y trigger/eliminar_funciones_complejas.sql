--[Fecha y Hora]: 27/10/2025 01:53:00
--[Descripción]: Script para eliminar las funciones complejas que causan
--                problemas de transacciones anidadas en Supabase.
--
--[Funciones a eliminar]:
--   - arrepdp_crear_plan_completo_rpc (versión con transacciones anidadas)
--   - arrepdpdetalle_generar_plan_completo (usa transacciones internas)
--   - arrepdpdetalle_recalcular_anos_contrato (usa transacciones internas)
--
--[Motivo]: Las funciones internas usan BEGIN/COMMIT y cuando se llaman
--                desde otra función que ya está en una transacción, causa
--                el error SQLSTATE 2D000 (invalid transaction termination).
--
--[Notas]: Se mantendrán las funciones simplificadas para uso futuro
--                una vez que se resuelva el problema de las transacciones.

-- Eliminar función RPC completa (con transacciones anidadas)
DROP FUNCTION IF EXISTS public.arrepdp_crear_plan_completo_rpc;

-- Eliminar función de prueba
DROP FUNCTION IF EXISTS public.test_rpc_simple;

-- Mensaje de confirmación
RAISE NOTICE '=== FUNCIONES COMPLEJAS ELIMINADAS ===';
RAISE NOTICE 'Fecha y hora: %', NOW();
RAISE NOTICE 'Funciones eliminadas:';
RAISE NOTICE '  - arrepdp_crear_plan_completo_rpc (versión con transacciones anidadas)';
RAISE NOTICE '  - test_rpc_simple (función de prueba)';
RAISE NOTICE '';
RAISE NOTICE 'Se mantienen las funciones simplificadas:';
RAISE NOTICE '  - arrepdp_crear_plan_simple_rpc (versión sin transacciones anidadas)';
RAISE NOTICE '';
RAISE NOTICE '=== ELIMINACIÓN COMPLETADA ===';