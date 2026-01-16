--[Fecha y Hora]: 17/11/2025 06:57:00
--[Descripción]: Script de instalación para todas las funciones y triggers
--                asociados a la tabla segModulosUsuarios.
--
--[Orden de instalación]:
--   1. Funciones principales
--   2. Triggers (si existen)
--
--[Verificación final]: Se verifica que todos los componentes se hayan instalado correctamente

-- Inicio del script de instalación
RAISE NOTICE 'Iniciando instalación de funciones para segModulosUsuarios...';

-- =================================================================
-- 1. INSTALACIÓN DE FUNCIONES
-- =================================================================

-- 1.1 Función sensitiva y prioritaria para obtener permisos esenciales en formato JSON
RAISE NOTICE 'Instalando función sopj (Seguridad de Operaciones de Permisos JSON)...';

-- Crear o reemplazar la función que obtiene solo clave y acceso en formato JSON
CREATE OR REPLACE FUNCTION public.sopj(p_uid uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $BODY$
BEGIN
    --[Fecha y Hora]: 17/11/2025 06:57:00
    -- [Descripción]: Función sensitiva y prioritaria que obtiene solo los campos
    --                clave y acceso de un usuario específico y los retorna en JSON.
    --
    -- [Entrada]: p_uid (uuid) - UID del usuario a consultar
    --
    -- [Salida]: json - Array de objetos JSON con clave y acceso del usuario
    --
    -- [Uso típico]: Obtener permisos esenciales para validaciones críticas
    --
    -- [Ejemplo]: SELECT sopj('uuid-del-usuario');
    
    -- Retornar solo clave y acceso del usuario en formato JSON
    RETURN (
        SELECT json_agg(
            json_build_object(
                'clave', "clave",
                'acceso', "acceso"
            )
        )
        FROM public."segModulosUsuarios"
        WHERE "uid" = p_uid
    );
    
END;
$BODY$;

RAISE NOTICE 'Función sopj instalada correctamente.';

-- 1.2 Función para corregir todos los campos de segModulosUsuarios basados en segModulos
RAISE NOTICE 'Instalando función segmodulos_corregir_todos_los_campos...';

-- Incluir el contenido de la función de corrección
\i segmodulos_corregir_todos_los_campos.sql

RAISE NOTICE 'Función segmodulos_corregir_todos_los_campos instalada correctamente.';

-- =================================================================
-- 2. VERIFICACIÓN DE INSTALACIÓN
-- =================================================================

RAISE NOTICE 'Verificando instalación de componentes...';

-- Verificar que las funciones se hayan creado correctamente
DO $$
DECLARE
    v_function_count integer;
BEGIN
    -- Contar funciones instaladas
    SELECT COUNT(*) INTO v_function_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
    AND (p.proname LIKE 'segmodulosusuarios_%' OR p.proname LIKE 'segmodulos_%' OR p.proname = 'sopj');
    
    RAISE NOTICE 'Total de funciones instaladas: %', v_function_count;
    
    -- Verificar función específica sopj
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'sopj'
    ) THEN
        RAISE NOTICE '✓ Función sopj verificada';
    ELSE
        RAISE EXCEPTION '✗ Error: La función sopj no se instaló correctamente';
    END IF;
    
    -- Verificar función de corrección
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'segmodulos_corregir_todos_los_campos'
    ) THEN
        RAISE NOTICE '✓ Función segmodulos_corregir_todos_los_campos verificada';
    ELSE
        RAISE EXCEPTION '✗ Error: La función segmodulos_corregir_todos_los_campos no se instaló correctamente';
    END IF;
    
END $$;

-- =================================================================
-- 3. INSTRUCCIONES DE USO
-- =================================================================

RAISE NOTICE '';
RAISE NOTICE '=========================================';
RAISE NOTICE 'INSTALACIÓN COMPLETADA EXITOSAMENTE';
RAISE NOTICE '=========================================';
RAISE NOTICE '';
RAISE NOTICE 'Para usar las funciones instaladas:';
RAISE NOTICE '';
RAISE NOTICE '1. Verificar permisos esenciales de un usuario:';
RAISE NOTICE '   SELECT sopj(''uuid-del-usuario'');';
RAISE NOTICE '   SELECT sopj(auth.uid());';
RAISE NOTICE '';
RAISE NOTICE '2. Corregir todos los campos de segModulosUsuarios basados en segModulos:';
RAISE NOTICE '   SELECT segmodulos_corregir_todos_los_campos();';
RAISE NOTICE '';

-- Fin del script de instalación
RAISE NOTICE 'Instalación de funciones para segModulosUsuarios completada.';