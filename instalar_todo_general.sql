--[Fecha y Hora]: 10/11/2025 03:07:45
-- [Descripción]: Script de instalación completa para todas las funciones y triggers
--                del proyecto supaSPH-QR.
--
-- [Uso]: Ejecutar este script para instalar todos los componentes en orden
--
-- [Orden de ejecución]:
--   1. Funciones generales (independientes)
--   2. Funciones de catUsers (antes que sus triggers)
--   3. Triggers de catUsers
--   4. Funciones de segModulos (antes que sus triggers)
--   5. Triggers de segModulos
--   6. Funciones de empresasNaves
--   7. Funciones de naves
--   8. Políticas RLS de naves
--   9. Funciones de invitaciones
--   10. Funciones de QRGenerados
--   11. Funciones de empresas
--
-- [Actualización 18/10/2025]: Se agregó política RLS para naves que filtra por parques asignados
--                             al usuario autenticado
-- [Actualización 10/11/2025]: Se agregó módulo QRGenerados para control de accesos

-- =================================================================
-- 1. Funciones generales
-- =================================================================
\i "funciones generales/cdg.sql"

-- =================================================================
-- 2. Funciones de catUsers (antes que sus triggers)
-- =================================================================
\i "catUsers/funciones y trigger/catusers_actualizar_nivel_desde_perfil.sql"
\i "catUsers/funciones y trigger/catusers_llenar_nomcompleto.sql"
\i "catUsers/funciones y trigger/catusers_marcar_invitacion_usada.sql"
\i "catUsers/funciones y trigger/catusers_validar_insercion.sql"
\i "catUsers/funciones y trigger/validar_permiso_usuario.sql"

-- =================================================================
-- 3. Triggers de catUsers
-- =================================================================
\i "catUsers/funciones y trigger/trigger_catusers_actualizar_nivel_desde_perfil.sql"
\i "catUsers/funciones y trigger/trigger_catusers_llenar_nomcompleto.sql"
\i "catUsers/funciones y trigger/trigger_catusers_marcar_invitacion_usada.sql"

-- =================================================================
-- 4. Funciones de segModulos (antes que sus triggers)
-- =================================================================
\i "segModulos/funciones y trigger/segmodulos_agregar_todos_usuarios.sql"

-- =================================================================
-- 5. Triggers de segModulos
-- =================================================================
\i "segModulos/funciones y trigger/trigger_segmodulos_auto_asignar.sql"

-- =================================================================
-- 6. Funciones de empresasNaves
-- =================================================================
\i "empresasNaves/funciones y trigger/empresasnaves_insertar_desde_naves.sql"

-- =================================================================
-- 7. Funciones de naves
-- =================================================================
\i "naves/funciones y trigger/naves_asignadas_sync_trigger.sql"
\i "naves/funciones y trigger/naves_buscar_disponibles.sql"

-- =================================================================
-- 8. Políticas RLS de naves
-- =================================================================
\i "naves/politicas_rls.sql"

-- =================================================================
-- 9. Triggers de empresasNaves
-- =================================================================
\i "empresasNaves/funciones y trigger/trigger_naves_asignadas_sync.sql"

-- =================================================================
-- 10. Funciones de invitaciones
-- =================================================================
\i "invitaciones/funciones y trigger/validar_invitacion.sql"

-- =================================================================
-- 10. Funciones de QRGenerados
-- =================================================================
\i "QRGenerados/funciones y trigger/qrgenerados_validar_acceso.sql"

-- =================================================================
-- 11. Funciones de QRGenerados
-- =================================================================
\i "QRGenerados/funciones y trigger/qrgenerados_validar_acceso.sql"
\i "QRGenerados/funciones y trigger/qrgenerados_obtener_registros_dia.sql"

-- =================================================================
-- 12. Funciones de empresas
-- =================================================================
\i "empresas/funciones y trigger/v_resumenempresas_buscar.sql"
\i "empresas/funciones y trigger/v_resumenempresas_buscar_por_id.sql"

-- =================================================================
-- 13. Vistas de empresas
-- =================================================================
\i "empresas/vistas/instalar_todo.sql"

-- =================================================================
-- 14. Verificación final
-- =================================================================
DO $$
DECLARE
    v_funciones_catusers integer;
    v_triggers_catusers integer;
    v_funciones_segmodulos integer;
    v_triggers_segmodulos integer;
    v_funciones_empresasnaves integer;
    v_triggers_empresasnaves integer;
    v_funciones_naves integer;
    v_funciones_generales integer;
    v_funciones_invitaciones integer;
    v_funciones_qrgenerados integer;
    v_funciones_empresas integer;
    v_vistas_empresas integer;
BEGIN
    -- Contar funciones por tabla
    SELECT COUNT(*) INTO v_funciones_generales
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
    AND routine_name = 'cdg';
    
    SELECT COUNT(*) INTO v_funciones_catusers
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
    AND routine_name LIKE 'catusers_%' OR routine_name = 'validar_permiso_usuario';
    
    SELECT COUNT(*) INTO v_triggers_catusers
    FROM information_schema.triggers 
    WHERE trigger_schema = 'public' 
    AND event_object_table = 'catUsers'
    AND trigger_name LIKE 'trigger_catusers_%';
    
    SELECT COUNT(*) INTO v_funciones_segmodulos
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
    AND routine_name LIKE 'segmodulos_%';
    
    SELECT COUNT(*) INTO v_triggers_segmodulos
    FROM information_schema.triggers 
    WHERE trigger_schema = 'public' 
    AND event_object_table = 'segModulos'
    AND trigger_name LIKE 'trigger_segmodulos_%';
    
    SELECT COUNT(*) INTO v_funciones_empresasnaves
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
    AND routine_name LIKE 'empresasnaves_%';
    
    SELECT COUNT(*) INTO v_triggers_empresasnaves
    FROM information_schema.triggers 
    WHERE trigger_schema = 'public' 
    AND event_object_table = 'empresasNaves'
    AND trigger_name LIKE 'trigger_naves_%';
    
    SELECT COUNT(*) INTO v_funciones_naves
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
    AND routine_name LIKE 'naves_%';
    
    SELECT COUNT(*) INTO v_funciones_invitaciones
    FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_name = 'validar_invitacion';
    
    SELECT COUNT(*) INTO v_funciones_qrgenerados
    FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_name LIKE 'qrgenerados_%';
    
    SELECT COUNT(*) INTO v_funciones_empresas
    FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_name LIKE 'v_resumenempresas_%';
    
    SELECT COUNT(*) INTO v_vistas_empresas
    FROM information_schema.views
    WHERE table_schema = 'public'
    AND table_name LIKE 'v_resumenempresas%';
    
    -- Mostrar resultados
    RAISE NOTICE '=== INSTALACIÓN COMPLETADA ===';
    RAISE NOTICE 'Funciones generales: %', v_funciones_generales;
    RAISE NOTICE 'Funciones catUsers: %', v_funciones_catusers;
    RAISE NOTICE 'Triggers catUsers: %', v_triggers_catusers;
    RAISE NOTICE 'Funciones segModulos: %', v_funciones_segmodulos;
    RAISE NOTICE 'Triggers segModulos: %', v_triggers_segmodulos;
    RAISE NOTICE 'Funciones empresasNaves: %', v_funciones_empresasnaves;
    RAISE NOTICE 'Triggers empresasNaves: %', v_triggers_empresasnaves;
    RAISE NOTICE 'Funciones naves: %', v_funciones_naves;
    RAISE NOTICE 'Funciones invitaciones: %', v_funciones_invitaciones;
    RAISE NOTICE 'Funciones QRGenerados: %', v_funciones_qrgenerados;
    RAISE NOTICE 'Funciones empresas: %', v_funciones_empresas;
    RAISE NOTICE 'Vistas empresas: %', v_vistas_empresas;
    RAISE NOTICE '================================';
    RAISE NOTICE 'Total funciones: %', v_funciones_generales + v_funciones_catusers + v_funciones_segmodulos + v_funciones_empresasnaves + v_funciones_naves + v_funciones_invitaciones + v_funciones_qrgenerados + v_funciones_empresas;
    RAISE NOTICE 'Total vistas: %', v_vistas_empresas;
    RAISE NOTICE 'Total triggers: %', v_triggers_catusers + v_triggers_segmodulos + v_triggers_empresasnaves;
END $$;

RAISE NOTICE 'Instalación general completada. Todos los componentes están listos para usar.';