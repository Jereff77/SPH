-- [Fecha y Hora]: 11/10/2025 21:06:00
-- [Descripción]: Script para generar un reporte de permisos faltantes en la tabla segModulosUsuarios
--                y corregir las inconsistencias encontradas entre las tablas segModulos y segModulosUsuarios.
--
-- [Uso]: Ejecutar este script para identificar y corregir los permisos faltantes para todos los usuarios.
--        El script primero generará un reporte de los permisos faltantes y luego insertará los registros
--        necesarios en la tabla segModulosUsuarios.
--
-- [Nota]: Se recomienda revisar el reporte generado antes de ejecutar las inserciones.

-- =====================================================================
-- PARTE 1: REPORTE DE PERMISOS FALTANTES
-- =====================================================================

-- Reporte 1: Módulos que faltan por usuario
SELECT 
    'REPORTE 1: PERMISOS FALTANTES POR USUARIO' AS reporte,
    u.uid,
    u.nombre || ' ' || u.apellidos AS nombre_completo,
    u.email,
    m."idsegModulos",
    m.modulo,
    m.seccion,
    m.area,
    m.clave
FROM 
    "catUsers" u
CROSS JOIN 
    "segModulos" m
WHERE 
    NOT EXISTS (
        SELECT 1 FROM "segModulosUsuarios" mu 
        WHERE mu.uid = u.uid 
        AND mu.modulo = m.modulo 
        AND mu.seccion = m.seccion 
        AND mu.area = m.area
    ) 
    AND u.status = true
ORDER BY 
    u.nombre, u.apellidos, m.modulo, m.seccion, m.area;

-- Reporte 2: Resumen de permisos faltantes por usuario
SELECT 
    'REPORTE 2: RESUMEN DE PERMISOS FALTANTES POR USUARIO' AS reporte,
    u.uid,
    u.nombre || ' ' || u.apellidos AS nombre_completo,
    u.email,
    COUNT(m."idsegModulos") AS permisos_faltantes
FROM 
    "catUsers" u
CROSS JOIN 
    "segModulos" m
WHERE 
    NOT EXISTS (
        SELECT 1 FROM "segModulosUsuarios" mu 
        WHERE mu.uid = u.uid 
        AND mu.modulo = m.modulo 
        AND mu.seccion = m.seccion 
        AND mu.area = m.area
    ) 
    AND u.status = true
GROUP BY 
    u.uid, u.nombre, u.apellidos, u.email
ORDER BY 
    permisos_faltantes DESC, u.nombre, u.apellidos;

-- Reporte 3: Módulos más faltantes (cuántos usuarios no tienen cada módulo)
SELECT 
    'REPORTE 3: MÓDULOS MÁS FALTANTES' AS reporte,
    m."idsegModulos",
    m.modulo,
    m.seccion,
    m.area,
    m.clave,
    COUNT(u.uid) AS usuarios_sin_permiso
FROM 
    "catUsers" u
CROSS JOIN 
    "segModulos" m
WHERE 
    NOT EXISTS (
        SELECT 1 FROM "segModulosUsuarios" mu 
        WHERE mu.uid = u.uid 
        AND mu.modulo = m.modulo 
        AND mu.seccion = m.seccion 
        AND mu.area = m.area
    ) 
    AND u.status = true
GROUP BY 
    m."idsegModulos", m.modulo, m.seccion, m.area, m.clave
ORDER BY 
    usuarios_sin_permiso DESC, m.modulo, m.seccion, m.area;

-- Reporte 4: Inconsistencias en los nombres de las columnas
SELECT 
    'REPORTE 4: INCONSISTENCIAS EN LOS NOMBRES DE COLUMNAS' AS reporte,
    m.modulo,
    m.seccion,
    m.area,
    mu.modulo AS mu_modulo,
    mu.seccion AS mu_seccion,
    mu.area AS mu_area,
    CASE 
        WHEN mu.modulo IS NULL THEN 'Falta registro en segModulosUsuarios'
        WHEN m.modulo != mu.modulo THEN 'Nombre de módulo diferente'
        WHEN m.seccion != mu.seccion THEN 'Nombre de sección diferente'
        WHEN m.area != mu.area THEN 'Nombre de área diferente'
        ELSE 'Otra inconsistencia'
    END AS tipo_inconsistencia
FROM 
    "segModulos" m
LEFT JOIN 
    "segModulosUsuarios" mu ON m.modulo = mu.modulo AND m.seccion = mu.seccion AND m.area = mu.area
WHERE 
    (mu.modulo IS NULL OR mu.seccion IS NULL OR mu.area IS NULL) 
    OR (m.modulo != mu.modulo OR m.seccion != mu.seccion OR m.area != mu.area)
ORDER BY 
    m.modulo, m.seccion, m.area;

-- =====================================================================
-- PARTE 2: CORRECCIÓN DE PERMISOS FALTANTES
-- =====================================================================

-- Función para insertar los permisos faltantes
CREATE OR REPLACE FUNCTION public.segmodulos_insertar_permisos_faltantes()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $BODY$
BEGIN
    --[Fecha y Hora]: 11/10/2025 21:06:00
    -- [Descripción]: Inserta todos los permisos faltantes en la tabla segModulosUsuarios
    --                para todos los usuarios activos del sistema.
    --
    -- [Salida]: void - No devuelve valor, solo realiza inserciones en la tabla.
    --
    -- [Uso típico]: Se ejecuta después de revisar el reporte de permisos faltantes.
    --
    -- [Ejemplo]: SELECT segmodulos_insertar_permisos_faltantes();

    INSERT INTO "segModulosUsuarios" (
        "idsegModulos",
        fc,
        modulo,
        seccion,
        area,
        uid,
        acceso,
        clave
    )
    SELECT 
        gen_random_uuid() AS "idsegModulos",
        NOW() AS fc,
        m.modulo,
        m.seccion,
        m.area,
        u.uid,
        false AS acceso, -- Por defecto se inserta con acceso false
        m.clave
    FROM 
        "catUsers" u
    CROSS JOIN 
        "segModulos" m
    WHERE 
        NOT EXISTS (
            SELECT 1 FROM "segModulosUsuarios" mu 
            WHERE mu.uid = u.uid 
            AND mu.modulo = m.modulo 
            AND mu.seccion = m.seccion 
            AND mu.area = m.area
        ) 
        AND u.status = true;
    
    RAISE NOTICE 'Se han insertado los permisos faltantes para todos los usuarios activos.';

END;
$BODY$;

-- =====================================================================
-- PARTE 3: VERIFICACIÓN DESPUÉS DE LA CORRECCIÓN
-- =====================================================================

-- Verificación 1: Confirmar que no quedan permisos faltantes
SELECT 
    'VERIFICACIÓN 1: PERMISOS FALTANTES DESPUÉS DE LA CORRECCIÓN' AS verificacion,
    u.uid,
    u.nombre || ' ' || u.apellidos AS nombre_completo,
    u.email,
    COUNT(m."idsegModulos") AS permisos_faltantes
FROM 
    "catUsers" u
CROSS JOIN 
    "segModulos" m
WHERE 
    NOT EXISTS (
        SELECT 1 FROM "segModulosUsuarios" mu 
        WHERE mu.uid = u.uid 
        AND mu.modulo = m.modulo 
        AND mu.seccion = m.seccion 
        AND mu.area = m.area
    ) 
    AND u.status = true
GROUP BY 
    u.uid, u.nombre, u.apellidos, u.email
ORDER BY 
    permisos_faltantes DESC, u.nombre, u.apellidos;

-- Verificación 2: Total de permisos por usuario después de la corrección
SELECT 
    'VERIFICACIÓN 2: TOTAL DE PERMISOS POR USUARIO' AS verificacion,
    u.uid,
    u.nombre || ' ' || u.apellidos AS nombre_completo,
    u.email,
    COUNT(mu."idsegModulos") AS total_permisos,
    COUNT(CASE WHEN mu.acceso = true THEN 1 END) AS permisos_con_acceso,
    COUNT(CASE WHEN mu.acceso = false THEN 1 END) AS permisos_sin_acceso
FROM 
    "catUsers" u
LEFT JOIN 
    "segModulosUsuarios" mu ON u.uid = mu.uid
WHERE 
    u.status = true
GROUP BY 
    u.uid, u.nombre, u.apellidos, u.email
ORDER BY 
    total_permisos DESC, u.nombre, u.apellidos;

-- =====================================================================
-- INSTRUCCIONES DE USO
-- =====================================================================

/*
PASOS PARA USAR ESTE SCRIPT:

1. Ejecutar las consultas de la PARTE 1 para generar el reporte de permisos faltantes.
   - Revisar cuidadosamente los resultados de los 4 reportes.

2. Si está de acuerdo con los resultados, ejecutar la función de la PARTE 2:
   - SELECT segmodulos_insertar_permisos_faltantes();

3. Finalmente, ejecutar las consultas de la PARTE 3 para verificar que
   todos los permisos han sido insertados correctamente.

NOTA: Este script no modifica permisos existentes, solo agrega los que faltan.
Los nuevos permisos se insertan con acceso = false por defecto.
*/