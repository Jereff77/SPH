--[Fecha y Hora]: 08/01/2026 21:30:00
--[Descripción]: Resumen consolidado de todos los fideicomitentes para un número de dispersión específico
--
--[Parámetros]:
--   - p_id_fideicomiso (text): ID del fideicomiso a consultar
--   - p_no_dispersion (text): Número de dispersión a consultar (ej: "8va")
--
--[Salida]:
--   - Tabla con resumen por adherente incluyendo:
--     - Información del adherente (id_fideicomiso, no_adhesion, nombre_inversionista, rfc_inversionista, tipo_persona)
--     - Información del período (no_dispersion, fecha_inicio_periodo, fecha_fin_periodo, total_dias_periodo)
--     - Información de pagos (total_pagos_distintos, monto_total_pagos)
--     - Cálculos sumarizados (tasa_promedio_rendimiento, rendimiento_bruto_total, retencion_isr_total, rendimiento_neto_total, rendimiento_sph_total, dispersion_neta_total)
--     - Desglose por tipo de período (dias_promocion, dias_normal, rendimiento_promocion, rendimiento_normal)
--     - Auditoría (fecha_calculo)
--
--[Uso típico]: Generar reportes consolidados de fideicomisos por número de dispersión
--
--[Ejemplo]:
--   -- Resumen de todos los adherentes para la dispersión 8va
--   SELECT * FROM resumen_fideicomiso_completo('ID_FIDEICOMISO', '8va');
--
--[Relaciones]:
--   - Tablas relacionadas: fideicomiso, fideCondiciones, propiedades, inversionista, pagos
--   - Funciones relacionadas: resumen_dispersion_dinamico (utilizada internamente)
--
--[Validaciones]:
--   - Si no hay adherentes, retorna vacío
--   - Utiliza resumen_dispersion_dinamico para obtener datos sumarizados
--   - Ordena resultados por "noAdhesion" (numéricos primero, luego texto)
--
--[Notas importantes]:
--   - Función cambiada a SECURITY DEFINER
--   - Utiliza resumen_dispersion_dinamico que ya hace la sumarización correcta
--   - Cada adherente obtiene un registro con el resumen de la dispersión especificada
--   - Si un adherente no tiene registros para la dispersión, no aparece en el resultado

CREATE OR REPLACE FUNCTION public.resumen_fideicomiso_completo(p_id_fideicomiso text, p_no_dispersion text)
 RETURNS TABLE(
    id_fideicomiso text,
    no_adhesion text,
    nombre_inversionista text,
    rfc_inversionista text,
    tipo_persona text,
    no_dispersion text,
    fecha_inicio_periodo date,
    fecha_fin_periodo date,
    total_dias_periodo integer,
    total_pagos_distintos bigint,
    monto_total_pagos double precision,
    tasa_promedio_rendimiento double precision,
    rendimiento_bruto_total double precision,
    retencion_isr_total double precision,
    rendimiento_neto_total double precision,
    rendimiento_sph_total double precision,
    dispersion_neta_total double precision,
    dias_promocion integer,
    dias_normal integer,
    rendimiento_promocion double precision,
    rendimiento_normal double precision,
    fecha_calculo timestamp
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_existe_fideicomiso BOOLEAN;
BEGIN
    -- =================================================================
    -- 1. Validar existencia del fideicomiso
    -- =================================================================
    SELECT EXISTS(SELECT 1 FROM "fideicomiso" WHERE "idFide" = p_id_fideicomiso)
    INTO v_existe_fideicomiso;

    IF NOT v_existe_fideicomiso THEN
        RAISE EXCEPTION 'El fideicomiso con ID % no existe', p_id_fideicomiso;
    END IF;

    -- =================================================================
    -- 2. Retornar el resumen de todos los adherentes para la dispersión especificada
    -- =================================================================
    RETURN QUERY
    WITH adherentes AS (
        SELECT DISTINCT
            fc."noAdhesion"
        FROM "fideCondiciones" fc
        WHERE fc."idFide" = p_id_fideicomiso
    ),
    resumenes AS (
        SELECT
            rd.*
        FROM adherentes a
        CROSS JOIN LATERAL public.resumen_dispersion_dinamico(p_id_fideicomiso, a."noAdhesion", p_no_dispersion) rd
    )
    SELECT
        r.id_fideicomiso,
        r.no_adhesion,
        r.nombre_inversionista,
        r.rfc_inversionista,
        r.tipo_persona,
        r.no_dispersion,
        r.fecha_inicio_periodo,
        r.fecha_fin_periodo,
        r.total_dias_periodo,
        r.total_pagos_distintos,
        r.monto_total_pagos,
        r.tasa_promedio_rendimiento,
        r.rendimiento_bruto_total,
        r.retencion_isr_total,
        r.rendimiento_neto_total,
        r.rendimiento_sph_total,
        r.dispersion_neta_total,
        r.dias_promocion,
        r.dias_normal,
        r.rendimiento_promocion,
        r.rendimiento_normal,
        r.fecha_calculo
    FROM resumenes r
    ORDER BY
        CASE
            WHEN r.no_adhesion ~ '^[0-9]+$' THEN 1
            ELSE 2
        END,
        CASE
            WHEN r.no_adhesion ~ '^[0-9]+$' THEN
                LPAD(r.no_adhesion, 10, '0')
            ELSE
                r.no_adhesion
        END;

    RETURN;
END;
$function$;
