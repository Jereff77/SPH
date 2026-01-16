--[Fecha y Hora]: 16/11/2025 10:54:00
--[Descripción]: Ejemplos prácticos de uso del sistema de plantillas de permisos
--
--Este archivo contiene ejemplos reales y casos de uso típicos para demostrar
--cómo utilizar el sistema de plantillas de permisos en diferentes escenarios.
--
--IMPORTANTE: Estos son ejemplos educativos. En producción, verificar los UUIDs
--y permisos antes de ejecutar cualquier operación.

-- ===============================================================================
-- ESCENARIO 1: Crear plantillas base para diferentes roles
-- ===============================================================================

-- Ejemplo 1.1: Crear plantilla para "Vendedor Junior"
-- Basado en el usuario ejemplo: 896f01e5-283f-4bdb-b3f3-11381adedb30
SELECT seg_crear_plantilla_desde_usuario(
    'Vendedor Junior',
    'Permisos básicos para vendedores nuevos. Incluye acceso a CRM, leads básicos y dashboard.',
    '896f01e5-283f-4bdb-b3f3-11381adedb30',
    'Ventas',
    true
) AS resultado;

-- Ejemplo 1.2: Crear plantilla para "Gerente de Ventas"
-- (Asumiendo que tenemos un usuario gerente con más permisos)
-- SELECT seg_crear_plantilla_desde_usuario(
--     'Gerente de Ventas',
--     'Permisos completos para gerentes de ventas. Incluye administración de usuarios, reportes avanzados y configuración.',
--     'uuid-gerente-ventas-ejemplo',
--     'Gerencia',
--     true
-- ) AS resultado;

-- Ejemplo 1.3: Crear plantilla para "Soporte Técnico"
SELECT seg_crear_plantilla_desde_usuario(
    'Soporte Técnico Nivel 1',
    'Permisos para equipo de soporte técnico básico. Acceso a tickets y módulos de soporte.',
    '896f01e5-283f-4bdb-b3f3-11381adedb30', -- Reemplazar con UID real de soporte
    'Soporte',
    true
) AS resultado;

-- ===============================================================================
-- ESCENARIO 2: Aplicar plantillas a nuevos usuarios
-- ===============================================================================

-- Ejemplo 2.1: Nuevo vendedor contratado
-- Primero listar plantillas disponibles para elegir la apropiada
SELECT * FROM seg_listar_plantillas(
    p_categoria => 'Ventas',
    p_solo_publicas => true
);

-- Luego aplicar la plantilla seleccionada
-- SELECT seg_aplicar_plantilla_a_usuario(
--     'uuid-plantilla-vendedor-junior', -- Reemplazar con UUID real
--     'uuid-nuevo-vendedor',           -- Reemplazar con UID del nuevo usuario
--     true                              -- Reemplazar todos los permisos existentes
-- ) AS resultado;

-- Ejemplo 2.2: Promoción de empleado
-- Un vendedor es promovido a gerente
-- SELECT seg_aplicar_plantilla_a_usuario(
--     'uuid-plantilla-gerente-ventas',
--     'uuid-vendedor-promovido',
--     true,  -- Reemplazar completamente los permisos
--     'uuid-director-que-autoriza'  -- UID del director que autoriza el cambio
-- ) AS resultado;

-- ===============================================================================
-- ESCENARIO 3: Actualización masiva de permisos
-- ===============================================================================

-- Ejemplo 3.1: Agregar nuevo permiso a todos los vendedores
-- Supongamos que se agregó un nuevo módulo y queremos dar acceso a todos los vendedores

-- Primero, verificar qué usuarios son vendedores (basado en sus permisos actuales)
SELECT DISTINCT smu."uid", cu."nomCompleto", cu."email"
FROM public."segModulosUsuarios" smu
JOIN public."catUsers" cu ON smu."uid" = cu."uid"
WHERE smu."modulo" = 'CRM'
AND smu."seccion" = 'Leads'
AND smu."acceso" = true
AND cu."status" = true;

-- Luego, para cada vendedor, agregar el nuevo permiso
-- (Esto normalmente se haría con un script automatizado)
-- INSERT INTO public."segModulosUsuarios" ("uid", "modulo", "seccion", "area", "acceso", "clave")
-- SELECT 
--     smu."uid",
--     'NuevoModulo'::text,
--     'NuevaSeccion'::text,
--     'NuevaArea'::text,
--     true::boolean,
--     999::smallint
-- FROM public."segModulosUsuarios" smu
-- WHERE smu."modulo" = 'CRM'
-- AND smu."seccion" = 'Leads'
-- AND smu."acceso" = true
-- AND NOT EXISTS (
--     SELECT 1 FROM public."segModulosUsuarios" smu2
--     WHERE smu2."uid" = smu."uid"
--     AND smu2."modulo" = 'NuevoModulo'
--     AND smu2."seccion" = 'NuevaSeccion'
-- );

-- ===============================================================================
-- ESCENARIO 4: Auditoría y revisión de permisos
-- ===============================================================================

-- Ejemplo 4.1: Verificar permisos de un usuario específico
SELECT "modulo", "seccion", "area", "acceso", "clave"
FROM public."segModulosUsuarios"
WHERE "uid" = '896f01e5-283f-4bdb-b3f3-11381adedb30'
ORDER BY "modulo", "seccion", "area";

-- Ejemplo 4.2: Comparar permisos de usuario con plantilla esperada
-- Permisos actuales del usuario
WITH "permisos_usuario" AS (
    SELECT "modulo", "seccion", "area", "acceso", "clave"
    FROM public."segModulosUsuarios"
    WHERE "uid" = '896f01e5-283f-4bdb-b3f3-11381adedb30'
),
-- Permisos de la plantilla
"permisos_plantilla" AS (
    SELECT "modulo", "seccion", "area", "acceso", "clave"
    FROM seg_ver_detalles_plantilla('uuid-plantilla-esperada')
)
-- Comparación
SELECT 
    COALESCE(pu."modulo", pp."modulo") as "modulo",
    COALESCE(pu."seccion", pp."seccion") as "seccion",
    COALESCE(pu."area", pp."area") as "area",
    pu."acceso" as "acceso_usuario",
    pp."acceso" as "acceso_plantilla",
    CASE 
        WHEN pu."acceso" IS NULL THEN 'Falta en usuario'
        WHEN pp."acceso" IS NULL THEN 'Extra en usuario'
        WHEN pu."acceso" <> pp."acceso" THEN 'Diferente'
        ELSE 'Igual'
    END as "estado"
FROM "permisos_usuario" pu
FULL OUTER JOIN "permisos_plantilla" pp 
    ON pu."modulo" = pp."modulo" 
    AND pu."seccion" = pp."seccion" 
    AND pu."area" = pp."area"
ORDER BY "modulo", "seccion", "area";

-- ===============================================================================
-- ESCENARIO 5: Mantenimiento de plantillas
-- ===============================================================================

-- Ejemplo 5.1: Listar todas las plantillas con estadísticas
SELECT 
    sp."nombrePlantilla",
    sp."categoria",
    sp."esPublica",
    sp."fechaCreacion",
    COUNT(sdp."idDetalle") as "total_permisos",
    COUNT(sdp."idDetalle") FILTER (WHERE sdp."acceso" = true) as "permisos_activos",
    cu."nomCompleto" as "creador"
FROM public."segPlantillasPermisos" sp
LEFT JOIN public."segDetallesPlantilla" sdp ON sp."idPlantilla" = sdp."idPlantilla" AND sdp."status" = true
LEFT JOIN public."catUsers" cu ON sp."uidCreador" = cu."uid"
WHERE sp."status" = true
GROUP BY sp."idPlantilla", sp."nombrePlantilla", sp."categoria", 
         sp."esPublica", sp."fechaCreacion", cu."nomCompleto"
ORDER BY sp."categoria", sp."nombrePlantilla";

-- Ejemplo 5.2: Encontrar plantillas duplicadas o similares
SELECT 
    sp1."nombrePlantilla" as "plantilla1",
    sp2."nombrePlantilla" as "plantilla2",
    sp1."categoria",
    COUNT(sdp1."idDetalle") as "permisos1",
    COUNT(sdp2."idDetalle") as "permisos2",
    -- Similitud basada en permisos comunes
    (
        SELECT COUNT(*) 
        FROM public."segDetallesPlantilla" sdp1
        JOIN public."segDetallesPlantilla" sdp2 
            ON sdp1."modulo" = sdp2."modulo" 
            AND sdp1."seccion" = sdp2."seccion" 
            AND sdp1."area" = sdp2."area"
            AND sdp1."acceso" = sdp2."acceso"
        WHERE sdp1."idPlantilla" = sp1."idPlantilla"
        AND sdp2."idPlantilla" = sp2."idPlantilla"
    ) as "permisos_comunes"
FROM public."segPlantillasPermisos" sp1
JOIN public."segPlantillasPermisos" sp2 
    ON sp1."categoria" = sp2."categoria"
    AND sp1."idPlantilla" < sp2."idPlantilla"
LEFT JOIN public."segDetallesPlantilla" sdp1 ON sp1."idPlantilla" = sdp1."idPlantilla" AND sdp1."status" = true
LEFT JOIN public."segDetallesPlantilla" sdp2 ON sp2."idPlantilla" = sdp2."idPlantilla" AND sdp2."status" = true
WHERE sp1."status" = true AND sp2."status" = true
ORDER BY sp1."categoria", "permisos_comunes" DESC;

-- ===============================================================================
-- ESCENARIO 6: Exportación e importación de plantillas
-- ===============================================================================

-- Ejemplo 6.1: Exportar plantilla para backup
-- Generar JSON con todos los detalles de una plantilla
SELECT json_build_object(
    'nombrePlantilla', sp."nombrePlantilla",
    'descripcion', sp."descripcion",
    'categoria', sp."categoria",
    'esPublica', sp."esPublica",
    'fechaCreacion', sp."fechaCreacion",
    'permisos', (
        SELECT json_agg(
            json_build_object(
                'modulo', "modulo",
                'seccion', "seccion",
                'area', "area",
                'acceso', "acceso",
                'clave', "clave"
            )
        )
        FROM public."segDetallesPlantilla" sdp
        WHERE sdp."idPlantilla" = sp."idPlantilla"
        AND sdp."status" = true
        ORDER BY "modulo", "seccion", "area"
    )
) as "plantilla_json"
FROM public."segPlantillasPermisos" sp
WHERE sp."idPlantilla" = 'uuid-plantilla-a-exportar';

-- Ejemplo 6.2: Crear plantilla desde JSON (importación)
-- Esto requeriría una función adicional para procesar el JSON
-- SELECT seg_importar_plantilla_desde_json(
--     '{
--         "nombrePlantilla": "Plantilla Importada",
--         "descripcion": "Plantilla creada desde JSON",
--         "categoria": "General",
--         "esPublica": false,
--         "permisos": [
--             {"modulo": "CRM", "seccion": "Dashboard", "area": "Modulo", "acceso": true, "clave": 301},
--             {"modulo": "CRM", "seccion": "Leads", "area": "Crear lead", "acceso": true, "clave": 322}
--         ]
--     }'::json
-- );

-- ===============================================================================
-- ESCENARIO 7: Reportes y análisis
-- ===============================================================================

-- Ejemplo 7.1: Análisis de uso de plantillas por mes
SELECT 
    DATE_TRUNC('month', sp."fechaCreacion") as "mes",
    sp."categoria",
    COUNT(*) as "plantillas_creadas",
    COUNT(*) FILTER (WHERE sp."esPublica" = true) as "plantillas_publicas"
FROM public."segPlantillasPermisos" sp
WHERE sp."status" = true
    AND sp."fechaCreacion" >= now() - interval '12 months'
GROUP BY DATE_TRUNC('month', sp."fechaCreacion"), sp."categoria"
ORDER BY "mes" DESC, sp."categoria";

-- Ejemplo 7.2: Usuarios con permisos inconsistentes
-- Usuarios que tienen permisos que no corresponden a ninguna plantilla activa
WITH "usuarios_con_permisos" AS (
    SELECT DISTINCT "uid"
    FROM public."segModulosUsuarios"
    WHERE "uid" IN (
        SELECT "uid" FROM public."catUsers" WHERE "status" = true
    )
),
"usuarios_con_plantillas" AS (
    SELECT DISTINCT smu."uid"
    FROM public."segModulosUsuarios" smu
    WHERE EXISTS (
        SELECT 1 FROM public."segDetallesPlantilla" sdp
        JOIN public."segPlantillasPermisos" sp ON sdp."idPlantilla" = sp."idPlantilla"
        WHERE sdp."modulo" = smu."modulo"
        AND sdp."seccion" = smu."seccion"
        AND sdp."area" = smu."area"
        AND sdp."acceso" = smu."acceso"
        AND sp."status" = true
    )
)
SELECT 
    ucp."uid",
    cu."nomCompleto",
    cu."email",
    COUNT(smu.*) as "total_permisos"
FROM "usuarios_con_permisos" ucp
JOIN public."catUsers" cu ON ucp."uid" = cu."uid"
LEFT JOIN "usuarios_con_plantillas" ucp2 ON ucp."uid" = ucp2."uid"
LEFT JOIN public."segModulosUsuarios" smu ON ucp."uid" = smu."uid"
WHERE ucp2."uid" IS NULL
GROUP BY ucp."uid", cu."nomCompleto", cu."email"
ORDER BY "total_permisos" DESC;

-- ===============================================================================
-- MENSAJES INFORMATIVOS
-- ===============================================================================

DO $$
BEGIN
    RAISE NOTICE '========================================================================';
    RAISE NOTICE 'EJEMPLOS DEL SISTEMA DE PLANTILLAS DE PERMISOS';
    RAISE NOTICE '========================================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Este archivo contiene ejemplos prácticos para diferentes escenarios:';
    RAISE NOTICE '1. Creación de plantillas base para roles comunes';
    RAISE NOTICE '2. Aplicación de plantillas a nuevos usuarios';
    RAISE NOTICE '3. Actualización masiva de permisos';
    RAISE NOTICE '4. Auditoría y revisión de permisos';
    RAISE NOTICE '5. Mantenimiento de plantillas';
    RAISE NOTICE '6. Exportación e importación de plantillas';
    RAISE NOTICE '7. Reportes y análisis de uso';
    RAISE NOTICE '';
    RAISE NOTICE 'IMPORTANTE:';
    RAISE NOTICE '- Reemplazar los UUIDs de ejemplo con valores reales';
    RAISE NOTICE '- Verificar permisos antes de ejecutar en producción';
    RAISE NOTICE '- Algunos ejemplos están comentados para evitar ejecución accidental';
    RAISE NOTICE '';
    RAISE NOTICE 'Para ejecutar un ejemplo específico, copiar y pegar la consulta';
    RAISE NOTICE 'deseada en un cliente SQL con los UUIDs correctos.';
    RAISE NOTICE '========================================================================';
END $$;