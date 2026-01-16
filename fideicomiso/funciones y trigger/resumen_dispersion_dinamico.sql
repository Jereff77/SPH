-- =================================================================
-- Función: resumen_dispersion_dinamico
-- Descripción: Obtiene el resumen sumarizado de dispersiones para un
--              número de dispersión específico
-- Parámetros:
--   - p_id_fideicomiso: ID del fideicomiso
--   - p_no_adhesion: Número de adhesión del inversionista
--   - p_no_dispersion: Número de dispersión a sumarizar (ej: "8va")
-- =================================================================

DROP FUNCTION IF EXISTS public.resumen_dispersion_dinamico(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.resumen_dispersion_dinamico(
    p_id_fideicomiso TEXT,
    p_no_adhesion TEXT,
    p_no_dispersion TEXT
)
RETURNS TABLE (
    -- Información del inversionista y fideicomiso
    id_fideicomiso TEXT,
    no_adhesion TEXT,
    nombre_inversionista TEXT,
    rfc_inversionista TEXT,
    tipo_persona TEXT,

    -- Información del período
    no_dispersion TEXT,
    fecha_inicio_periodo DATE,
    fecha_fin_periodo DATE,
    total_dias_periodo INTEGER,

    -- Información de pagos
    total_pagos_distintos BIGINT,
    monto_total_pagos DOUBLE PRECISION,

    -- Cálculos sumarizados
    tasa_promedio_rendimiento DOUBLE PRECISION,
    rendimiento_bruto_total DOUBLE PRECISION,
    retencion_isr_total DOUBLE PRECISION,
    rendimiento_neto_total DOUBLE PRECISION,
    rendimiento_sph_total DOUBLE PRECISION,
    dispersion_neta_total DOUBLE PRECISION,

    -- Desglose por tipo de período
    dias_promocion INTEGER,
    dias_normal INTEGER,
    rendimiento_promocion DOUBLE PRECISION,
    rendimiento_normal DOUBLE PRECISION,

    -- Auditoría
    fecha_calculo TIMESTAMP
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_existe_fideicomiso BOOLEAN;
    v_existe_inversionista BOOLEAN;
    v_fecha_inicio DATE;
    v_fecha_fin DATE;
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
    -- 2. Validar existencia del inversionista
    -- =================================================================
    SELECT EXISTS(SELECT 1 FROM "fideCondiciones" WHERE "idFide" = p_id_fideicomiso AND "noAdhesion" = p_no_adhesion)
    INTO v_existe_inversionista;

    IF NOT v_existe_inversionista THEN
        RAISE EXCEPTION 'El inversionista con número de adhesión % no existe en el fideicomiso %', p_no_adhesion, p_id_fideicomiso;
    END IF;

    -- =================================================================
    -- 3. Obtener fechas del período de dispersión
    -- =================================================================
    SELECT
        MIN(fecha_inicio) AS fecha_inicio,
        MAX(fecha_fin) AS fecha_fin
    INTO v_fecha_inicio, v_fecha_fin
    FROM public.plan_dispersiones_dinamico(p_id_fideicomiso, p_no_adhesion)
    WHERE noDispersion = p_no_dispersion;

    IF v_fecha_inicio IS NULL THEN
        -- Retornar vacío si no hay registros para esta dispersión
        RETURN;
    END IF;

    -- =================================================================
    -- 4. Retornar el resumen sumarizado
    -- =================================================================
    RETURN QUERY
    WITH dispersiones AS (
        SELECT * FROM public.plan_dispersiones_dinamico(p_id_fideicomiso, p_no_adhesion)
        WHERE noDispersion = p_no_dispersion
    )
    SELECT
        -- Información del inversionista y fideicomiso
        d.id_fideicomiso,
        d.no_adhesion,
        COALESCE(d.razon_social, d.nombre_inversionista) AS nombre_inversionista,
        d.rfc_inversionista,
        d.tipo_persona,

        -- Información del período
        d.noDispersion AS no_dispersion,
        v_fecha_inicio AS fecha_inicio_periodo,
        v_fecha_fin AS fecha_fin_periodo,
        SUM(d.dias_periodo)::INTEGER AS total_dias_periodo,

        -- Información de pagos
        COUNT(DISTINCT d.id_pago) AS total_pagos_distintos,
        SUM(DISTINCT d.monto_pago) AS monto_total_pagos,

        -- Cálculos sumarizados
        AVG(d.tasa_rendimiento) AS tasa_promedio_rendimiento,
        SUM(d.rendimiento_bruto) AS rendimiento_bruto_total,
        SUM(d.retencion_isr) AS retencion_isr_total,
        SUM(d.rendimiento_neto) AS rendimiento_neto_total,
        SUM(d.rendimiento_sph) AS rendimiento_sph_total,
        SUM(d.dispersion_neta) AS dispersion_neta_total,

        -- Desglose por tipo de período
        SUM(CASE WHEN d.sub_periodo = 'PROMOCION' OR d.tipo_periodo = 'TOTAL_PROMOCION' THEN d.dias_periodo ELSE 0 END)::INTEGER AS dias_promocion,
        SUM(CASE WHEN d.sub_periodo = 'NORMAL' OR d.tipo_periodo = 'TOTAL_NORMAL' OR d.tipo_periodo = 'SIN_PROMOCION' THEN d.dias_periodo ELSE 0 END)::INTEGER AS dias_normal,
        SUM(CASE WHEN d.sub_periodo = 'PROMOCION' OR d.tipo_periodo = 'TOTAL_PROMOCION' THEN d.rendimiento_neto ELSE 0 END) AS rendimiento_promocion,
        SUM(CASE WHEN d.sub_periodo = 'NORMAL' OR d.tipo_periodo = 'TOTAL_NORMAL' OR d.tipo_periodo = 'SIN_PROMOCION' THEN d.rendimiento_neto ELSE 0 END) AS rendimiento_normal,

        -- Auditoría
        MAX(d.fecha_calculo) AS fecha_calculo
    FROM dispersiones d
    GROUP BY
        d.id_fideicomiso,
        d.no_adhesion,
        d.nombre_inversionista,
        d.rfc_inversionista,
        d.tipo_persona,
        d.noDispersion;

    RETURN;
END;
$$;

-- =================================================================
-- Comentarios de uso:
-- =================================================================
-- Ejemplo de uso:
-- SELECT * FROM public.resumen_dispersion_dinamico('jsRw4C6FswY20O', '23', '8va');
--
-- Esta función:
-- 1. Llama a plan_dispersiones_dinamico para obtener todos los registros
-- 2. Filtra por el número de dispersión especificado
-- 3. Sumariza las columnas numéricas:
--    - monto_pago: SUM DISTINCT (solo pagos distintos)
--    - rendimiento_bruto: SUM (todos los registros)
--    - retencion_isr: SUM (todos los registros)
--    - rendimiento_neto: SUM (todos los registros)
--    - rendimiento_sph: SUM (todos los registros)
--    - dispersion_neta: SUM (todos los registros)
-- 4. Proporciona desglose por tipo de período (promoción vs normal)
-- 5. Incluye información de auditoría
-- =================================================================
