--[Fecha y Hora]: 16/11/2025 04:59:14
--[Descripción]: Script de prueba para verificar el funcionamiento de la desactivación
--                automática de permisos cuando un usuario cambia su status a false.
--
--[Pruebas realizadas]:
--   1. Verificar permisos activos antes del cambio
--   2. Cambiar status a false
--   3. Verificar que los permisos se desactivaron
--   4. Restaurar el estado original
--
--[Uso]: Ejecutar este script para probar el funcionamiento del sistema
--
--[Nota]: Este script es para pruebas y no debe ejecutarse en producción
--        sin antes verificar los usuarios que se modificarán

-- Iniciar transacción para poder revertir cambios
BEGIN;

RAISE NOTICE '=== INICIANDO PRUEBA DE DESACTIVACIÓN AUTOMÁTICA DE PERMISOS ===';

-- 1. Seleccionar un usuario de prueba (con permisos activos y status true)
RAISE NOTICE '1. Buscando usuario de prueba...';

WITH usuario_prueba AS (
    SELECT 
        u."uid", 
        u."nomCompleto", 
        u."status",
        COUNT(s."idsegModulos") as permisos_activos
    FROM public."catUsers" u
    INNER JOIN public."segModulosUsuarios" s ON u."uid" = s."uid"
    WHERE u."status" = true AND s."acceso" = true
    GROUP BY u."uid", u."nomCompleto", u."status"
    LIMIT 1
)
SELECT 
    "uid",
    "nomCompleto",
    "status",
    permisos_activos
FROM usuario_prueba;

-- 2. Mostrar permisos antes del cambio
RAISE NOTICE '2. Verificando permisos activos antes del cambio...';

WITH usuario_prueba AS (
    SELECT u."uid" 
    FROM public."catUsers" u
    WHERE u."status" = true
    LIMIT 1
)
SELECT 
    'ANTES' as estado,
    s."uid",
    s."modulo",
    s."seccion",
    s."area",
    s."acceso"
FROM public."segModulosUsuarios" s
INNER JOIN usuario_prueba up ON s."uid" = up."uid"
WHERE s."acceso" = true
ORDER BY s."modulo", s."seccion";

-- 3. Cambiar status a false (esto debería activar el trigger)
RAISE NOTICE '3. Cambiando status a false (debería activar el trigger)...';

WITH usuario_prueba AS (
    SELECT u."uid" 
    FROM public."catUsers" u
    WHERE u."status" = true
    LIMIT 1
)
UPDATE public."catUsers"
SET "status" = false
FROM usuario_prueba
WHERE "catUsers"."uid" = usuario_prueba."uid";

-- 4. Verificar que los permisos se desactivaron
RAISE NOTICE '4. Verificando que los permisos se desactivaron...';

WITH usuario_prueba AS (
    SELECT u."uid", u."nomCompleto" 
    FROM public."catUsers" u
    WHERE u."status" = false
    LIMIT 1
)
SELECT 
    'DESPUÉS' as estado,
    s."uid",
    s."modulo",
    s."seccion",
    s."area",
    s."acceso"
FROM public."segModulosUsuarios" s
INNER JOIN usuario_prueba up ON s."uid" = up."uid"
ORDER BY s."modulo", s."seccion";

-- 5. Contar permisos activos vs inactivos después del cambio
RAISE NOTICE '5. Conteo de permisos después del cambio...';

WITH usuario_prueba AS (
    SELECT u."uid" 
    FROM public."catUsers" u
    WHERE u."status" = false
    LIMIT 1
)
SELECT 
    s."acceso",
    COUNT(*) as cantidad_permisos
FROM public."segModulosUsuarios" s
INNER JOIN usuario_prueba up ON s."uid" = up."uid"
GROUP BY s."acceso"
ORDER BY s."acceso";

-- 6. Restaurar el estado original
RAISE NOTICE '6. Restaurando estado original...';

WITH usuario_prueba AS (
    SELECT u."uid" 
    FROM public."catUsers" u
    WHERE u."status" = false
    LIMIT 1
)
UPDATE public."catUsers"
SET "status" = true
FROM usuario_prueba
WHERE "catUsers"."uid" = usuario_prueba."uid";

-- 7. Restaurar permisos activos
RAISE NOTICE '7. Restaurando permisos activos...';

WITH usuario_prueba AS (
    SELECT u."uid" 
    FROM public."catUsers" u
    WHERE u."status" = true
    LIMIT 1
)
UPDATE public."segModulosUsuarios"
SET "acceso" = true
FROM usuario_prueba
WHERE "segModulosUsuarios"."uid" = usuario_prueba."uid";

-- Confirmar que todo volvió a la normalidad
RAISE NOTICE '8. Verificación final - estado restaurado...';

WITH usuario_prueba AS (
    SELECT u."uid" 
    FROM public."catUsers" u
    WHERE u."status" = true
    LIMIT 1
)
SELECT 
    'RESTAURADO' as estado,
    u."status",
    COUNT(s."idsegModulos") as permisos_activos
FROM public."catUsers" u
INNER JOIN public."segModulosUsuarios" s ON u."uid" = s."uid"
INNER JOIN usuario_prueba up ON u."uid" = up."uid"
WHERE s."acceso" = true
GROUP BY u."status";

RAISE NOTICE '=== PRUEBA COMPLETADA ===';
RAISE NOTICE 'Revise los resultados para verificar que el trigger funcionó correctamente.';

-- Revertir todos los cambios de prueba
ROLLBACK;

RAISE NOTICE 'Cambios de prueba revertidos. Base de datos restaurada a su estado original.';