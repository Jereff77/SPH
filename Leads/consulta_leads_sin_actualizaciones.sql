-- [Fecha y Hora]: 13/10/2025 14:55:00
-- [Descripción]: Consulta para mostrar la última interacción de cada lead activo,
--                indicando si hace más de 7 días o no desde la última actualización.
--
-- [Entrada]: No requiere parámetros de entrada
--
-- [Salida]: Lista de leads con su última interacción y responsable comercial
--
-- [Uso típico]: Identificar leads que requieren seguimiento por tener más de 7 días
--               sin interacción, asignados a cada responsable comercial.
--
-- [Ejemplo]: SELECT * FROM public.leads_ultima_interaccion();

SELECT
    l.id AS "id_lead",
    l."nombreLead" AS "nombre_lead",
    l."correo",
    l."telefono",
    l."uidRC" AS "id_responsable_comercial",
    l."nomRC" AS "responsable_comercial",
    l."Etapa" AS "etapa_actual",
    MAX(ah."created_at") AS "ultima_interaccion",
    CASE
        WHEN MAX(ah."created_at") IS NULL THEN 'Nunca'
        WHEN CURRENT_DATE - MAX(ah."created_at"::date) >= 7 THEN 'Sí (' || (CURRENT_DATE - MAX(ah."created_at"::date)) || ' días)'
        ELSE 'No'
    END AS "mas_de_7_dias_sin_interaccion",
    CASE
        WHEN MAX(ah."created_at") IS NULL THEN NULL
        ELSE CURRENT_DATE - MAX(ah."created_at"::date)
    END AS "dias_sin_interaccion"
FROM
    public.leads l
LEFT JOIN
    public.activity_history ah ON l.id = ah."lead_id"
WHERE
    l.status = true
GROUP BY
    l.id, l."nombreLead", l."correo", l."telefono", l."uidRC", l."nomRC", l."Etapa"
ORDER BY
    "dias_sin_interaccion" DESC NULLS LAST;

-- Consulta para obtener un resumen por responsable comercial
WITH leads_ultima_interaccion AS (
    SELECT
        l.id,
        l."nomRC" AS "responsable_comercial",
        MAX(ah."created_at") AS "ultima_interaccion"
    FROM
        public.leads l
    LEFT JOIN
        public.activity_history ah ON l.id = ah."lead_id"
    WHERE
        l.status = true
    GROUP BY
        l.id, l."nomRC"
)
SELECT
    "responsable_comercial",
    COUNT(*) AS "total_leads",
    COUNT(CASE WHEN "ultima_interaccion" IS NULL THEN 1 END) AS "sin_interaccion",
    COUNT(CASE WHEN "ultima_interaccion" IS NOT NULL AND CURRENT_DATE - "ultima_interaccion"::date >= 7 THEN 1 END) AS "mas_7_dias_sin_interaccion",
    COUNT(CASE WHEN "ultima_interaccion" IS NOT NULL AND CURRENT_DATE - "ultima_interaccion"::date < 7 THEN 1 END) AS "con_interaccion_reciente"
FROM
    leads_ultima_interaccion
GROUP BY
    "responsable_comercial"
ORDER BY
    "mas_7_dias_sin_interaccion" DESC,
    "total_leads" DESC;

-- Consulta adicional para mostrar solo los leads con más de 7 días sin interacción
SELECT
    l.id AS "id_lead",
    l."nombreLead" AS "nombre_lead",
    l."correo",
    l."telefono",
    l."uidRC" AS "id_responsable_comercial",
    l."nomRC" AS "responsable_comercial",
    l."Etapa" AS "etapa_actual",
    MAX(ah."created_at") AS "ultima_interaccion",
    CURRENT_DATE - MAX(ah."created_at"::date) AS "dias_sin_interaccion"
FROM
    public.leads l
LEFT JOIN
    public.activity_history ah ON l.id = ah."lead_id"
WHERE
    l.status = true
GROUP BY
    l.id, l."nombreLead", l."correo", l."telefono", l."uidRC", l."nomRC", l."Etapa"
HAVING
    MAX(ah."created_at") < CURRENT_DATE - INTERVAL '7 days'
ORDER BY
    "dias_sin_interaccion" DESC;

-- Función para obtener la última interacción de todos los leads activos
CREATE OR REPLACE FUNCTION public.leads_ultima_interaccion()
RETURNS TABLE (
    id_lead uuid,
    nombre_lead text,
    correo text,
    telefono text,
    id_responsable_comercial uuid,
    responsable_comercial text,
    etapa_actual text,
    ultima_interaccion timestamp with time zone,
    mas_de_7_dias_sin_interaccion text,
    dias_sin_interaccion integer
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $BODY$
BEGIN
    --[Fecha y Hora]: 13/10/2025 14:58:00
    -- [Descripción]: Función que devuelve la última interacción de cada lead activo,
    --                indicando si hace más de 7 días o no desde la última actualización.
    --
    -- [Salida]: Tabla con información detallada de la última interacción de cada lead
    --
    -- [Uso típico]: SELECT * FROM public.leads_ultima_interaccion();
    --               Para obtener un reporte completo de todos los leads y su estado.
    
    RETURN QUERY
    SELECT
        l.id,
        l."nombreLead",
        l."correo",
        l."telefono",
        l."uidRC",
        l."nomRC",
        l."Etapa",
        MAX(ah."created_at"),
        CASE
            WHEN MAX(ah."created_at") IS NULL THEN 'Nunca'
            WHEN CURRENT_DATE - MAX(ah."created_at"::date) >= 7 THEN 'Sí (' || (CURRENT_DATE - MAX(ah."created_at"::date)) || ' días)'
            ELSE 'No'
        END,
        CASE
            WHEN MAX(ah."created_at") IS NULL THEN NULL
            ELSE CURRENT_DATE - MAX(ah."created_at"::date)
        END
    FROM
        public.leads l
    LEFT JOIN
        public.activity_history ah ON l.id = ah."lead_id"
    WHERE
        l.status = true
    GROUP BY
        l.id, l."nombreLead", l."correo", l."telefono", l."uidRC", l."nomRC", l."Etapa"
    ORDER BY
        "dias_sin_interaccion" DESC NULLS LAST;
END;
$BODY$;
