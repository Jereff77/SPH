--[Fecha y Hora]: 16/10/2025 23:57:25
-- [Descripción]: Script de instalación completa para las funciones y triggers
--                de sincronización entre las tablas empresasNaves y naves.
--
-- [Uso]: Ejecutar este script para instalar todos los componentes en orden
--
-- [Orden de ejecución]:
--   1. Función de inicialización
--   2. Función del trigger
--   3. Trigger
--   4. Poblado inicial de datos

-- =================================================================
-- 1. Crear función para insertar datos iniciales
-- =================================================================
\i empresasnaves_insertar_desde_naves.sql

-- =================================================================
-- 2. Crear función del trigger (ubicada en la tabla naves)
-- =================================================================
\i ..\..\naves\funciones y trigger\naves_asignadas_sync_trigger.sql

-- =================================================================
-- 3. Crear el trigger
-- =================================================================
\i trigger_naves_asignadas_sync.sql

-- =================================================================
-- 4. Poblar inicialmente la tabla empresasNaves (si está vacía)
-- =================================================================
DO $$
BEGIN
    -- Verificar si la tabla está vacía antes de insertar
    IF (SELECT COUNT(*) FROM public."empresasNaves") = 0 THEN
        RAISE NOTICE 'Poblando tabla empresasNaves con naves que tienen empresa asignada...';
        PERFORM public.empresasnaves_insertar_desde_naves();
        RAISE NOTICE 'Se insertaron % registros en empresasNaves', 
                     (SELECT COUNT(*) FROM public."empresasNaves");
    ELSE
        RAISE NOTICE 'La tabla empresasNaves ya contiene % registros. No se realizó inserción inicial.',
                     (SELECT COUNT(*) FROM public."empresasNaves");
    END IF;
END $$;

-- =================================================================
-- 5. Verificación final
-- =================================================================
SELECT 
    'empresasNaves' as tabla,
    COUNT(*) as total_registros
FROM public."empresasNaves"
UNION ALL
SELECT 
    'naves_asignadas' as tabla,
    COUNT(*) as total_registros
FROM public.naves 
WHERE "asignado" = true
UNION ALL
SELECT 
    'naves_con_empresa' as tabla,
    COUNT(*) as total_registros
FROM public.naves 
WHERE "idEmpresa" IS NOT NULL;

RAISE NOTICE 'Instalación completada. Verificar los resultados arriba.';