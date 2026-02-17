--[Fecha y Hora]: 05/02/2026 03:45:00
--[Descripción]: Obtiene un listado de categorías de presupuesto con su presupuesto anual calculado,
--                junto con información del responsable y el presupuesto asociado. Permite filtrar
--                opcionalmente por idCategoria, cuenta o sección.
--
--[Parámetros]:
--   - p_id_categoria (text, opcional): ID de la categoría para filtrar (búsqueda parcial, default: NULL)
--   - p_cuenta (text, opcional): Número de cuenta para filtrar (búsqueda parcial, default: NULL)
--   - p_seccion (text, opcional): Sección para filtrar (búsqueda parcial, default: NULL)
--
--[Salida]:
--   - TABLE con los siguientes campos:
--     * idCategoria (text): ID de la categoría
--     * status (boolean): Estado de la categoría
--     * presupuestable (boolean): Indica si es presupuestable
--     * cuenta (text): Número de cuenta
--     * seccion (text): Sección
--     * descripcion (text): Descripción de la categoría
--     * presupuesto_anual (double precision): Suma de montos de presupuesto anual
--     * uidResponsable (uuid): UID del usuario responsable
--     * nomCompleto (text): Nombre completo del responsable
--     * idPresupuesto (text): ID del presupuesto
--     * statusPres (boolean): Estado del presupuesto
--
--[Uso típico]: Se utiliza para obtener el resumen de categorías de presupuesto con sus montos
--               anuales calculados. Útil para reportes y análisis de presupuesto.
--
--[Ejemplo]:
--   SELECT * FROM prescategorias_obtener_con_presupuesto();
--   SELECT * FROM prescategorias_obtener_con_presupuesto('CAT001', NULL, NULL);
--   SELECT * FROM prescategorias_obtener_con_presupuesto(NULL, '100', NULL);
--   SELECT * FROM prescategorias_obtener_con_presupuesto(NULL, NULL, 'INGRESOS');
--
--[Relaciones]:
--   - Tablas: PresCategorias, PresDetalle, Presupuestos, catUsers
--   - Campos relacionados: idCategoria, idPresupuesto, uidResponsable

CREATE OR REPLACE FUNCTION public.prescategorias_obtener_con_presupuesto(
    p_id_categoria text DEFAULT NULL,
    p_cuenta text DEFAULT NULL,
    p_seccion text DEFAULT NULL
)
RETURNS TABLE(
    "idCategoria" text,
    status boolean,
    presupuestable boolean,
    cuenta text,
    seccion text,
    descripcion text,
    presupuesto_anual double precision,
    "uidResponsable" uuid,
    "nomCompleto" text,
    "idPresupuesto" uuid,
    "statusPres" boolean
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        c."idCategoria",
        c.status,
        c.presupuestable,
        c.cuenta,
        c.seccion,
        COALESCE(c.descripcion, '') AS descripcion,
        COALESCE(SUM(pd.monto), 0) AS presupuesto_anual,
        c."uidResponsable",
        u."nomCompleto",
        p."idPresupuesto",
        p.status AS "statusPres"
    FROM
        "PresCategorias" c
        LEFT JOIN "PresDetalle" pd ON pd."idCategoria" = c."idCategoria"
        LEFT JOIN "Presupuestos" p ON p."idPresupuesto" = pd."idPresupuesto"
        LEFT JOIN "catUsers" u ON u.uid = c."uidResponsable"
    WHERE
        p.status = true
        AND (p_id_categoria IS NULL OR c."idCategoria" ILIKE '%' || p_id_categoria || '%')
        AND (p_cuenta IS NULL OR c.cuenta ILIKE '%' || p_cuenta || '%')
        AND (p_seccion IS NULL OR c.seccion ILIKE '%' || p_seccion || '%')
    GROUP BY
        c."idCategoria",
        c.status,
        c.presupuestable,
        c.cuenta,
        c.seccion,
        u."nomCompleto",
        p."idPresupuesto"
    ORDER BY
        c.cuenta ASC,
        c.seccion ASC;
END;
$function$;
