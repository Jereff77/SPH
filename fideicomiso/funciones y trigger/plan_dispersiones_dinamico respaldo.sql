DROP FUNCTION IF EXISTS public.plan_dispersiones_dinamico(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.plan_dispersiones_dinamico(
    p_id_fideicomiso TEXT,
    p_no_adhesion TEXT
)
RETURNS TABLE (
    -- Información del inversionista y fideicomiso
    id_fideicomiso TEXT,
    no_adhesion TEXT,
    nombre_inversionista TEXT,
    razon_social TEXT,
    rfc_inversionista TEXT,
    tipo_persona TEXT,

    -- Información del período
    periodo_anio INTEGER,
    periodo_mes INTEGER,
    periodo_dia_inicio INTEGER,
    periodo_dia_fin INTEGER,
    tipo_periodo TEXT,
    sub_periodo TEXT,

    -- Información de dispersiones
    id_pago TEXT,
    monto_pago DOUBLE PRECISION,
    fecha_pago DATE,
    fecha_inicio DATE,
    fecha_fin DATE,
    dias_periodo INTEGER,
    noDispersion TEXT,

    -- Cálculos
    tasa_rendimiento DOUBLE PRECISION,
    rendimiento_bruto DOUBLE PRECISION,
    retencion_isr DOUBLE PRECISION,
    rendimiento_neto DOUBLE PRECISION,
    rendimiento_sph DOUBLE PRECISION,
    dispersion_neta DOUBLE PRECISION,

    -- Auditoría
    fecha_calculo TIMESTAMP
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    -- Información del fideicomiso e inversión
    v_fideicomiso RECORD;
    v_condiciones RECORD;
    v_primer_pago DATE;
    v_fin_promocion DATE;
    v_tiene_promocion BOOLEAN;

    -- Iteración
    v_pago RECORD;
    v_periodo RECORD;

    -- Cálculos intermedios
    v_dias_promocion INTEGER;
    v_dias_normales INTEGER;
    v_tipo_periodo TEXT;
    v_rendimiento_bruto DOUBLE PRECISION;
    v_retencion_isr DOUBLE PRECISION;
    v_rendimiento_neto DOUBLE PRECISION;
    v_rendimiento_sph DOUBLE PRECISION;
    v_dispersion_neta DOUBLE PRECISION;
    v_tasa_rendimiento DOUBLE PRECISION;

    -- Subperíodos
    v_fecha_inicio_promo DATE;
    v_fecha_fin_promo DATE;
    v_fecha_inicio_normal DATE;
    v_fecha_fin_normal DATE;

    -- Control
    v_existe_fideicomiso BOOLEAN;
    v_existe_inversionista BOOLEAN;
    v_numDispersion TEXT;

    -- Cursores
    cursor_pagos CURSOR FOR
        SELECT
            p."idPago",
            p.fecha,
            p.monto
        FROM "pagos" p
        JOIN "propiedades" prop ON p."idPropiedad" = prop."idPropiedad"
        JOIN "fideCondiciones" fc ON prop."idPropiedad" = fc."idPropiedad"
        WHERE fc."idFide" = p_id_fideicomiso
          AND fc."noAdhesion" = p_no_adhesion
        ORDER BY p.fecha, p."idPago";

    cursor_periodos CURSOR (p_fecha_pago DATE) FOR
        WITH RECURSIVE periodos_fideicomiso AS (
            SELECT
                v_fideicomiso.fecinicio AS periodo_inicio,
                (
                    CASE
                        WHEN EXTRACT(MONTH FROM v_fideicomiso.fecinicio) >= 10 THEN MAKE_DATE(EXTRACT(YEAR FROM v_fideicomiso.fecinicio)::INTEGER + 1, 3, 31)
                        WHEN EXTRACT(MONTH FROM v_fideicomiso.fecinicio) BETWEEN 1 AND 3 THEN MAKE_DATE(EXTRACT(YEAR FROM v_fideicomiso.fecinicio)::INTEGER, 6, 30)
                        WHEN EXTRACT(MONTH FROM v_fideicomiso.fecinicio) BETWEEN 4 AND 6 THEN MAKE_DATE(EXTRACT(YEAR FROM v_fideicomiso.fecinicio)::INTEGER, 9, 30)
                        WHEN EXTRACT(MONTH FROM v_fideicomiso.fecinicio) BETWEEN 7 AND 9 THEN MAKE_DATE(EXTRACT(YEAR FROM v_fideicomiso.fecinicio)::INTEGER, 12, 31)
                    END
                ) AS periodo_fin,
                1 AS num_dispersion_temporal

            UNION ALL

            SELECT
                (pf.periodo_fin + INTERVAL '1 day')::DATE,
                (
                    SELECT
                        CASE
                            WHEN MAKE_DATE(EXTRACT(YEAR FROM pf.periodo_fin)::INTEGER, fmd.mes, fmd.dia) > pf.periodo_fin
                            THEN MAKE_DATE(EXTRACT(YEAR FROM pf.periodo_fin)::INTEGER, fmd.mes, fmd.dia)
                            ELSE MAKE_DATE(EXTRACT(YEAR FROM pf.periodo_fin)::INTEGER + 1, fmd.mes, fmd.dia)
                        END
                    FROM "fideMesDispersion" fmd
                    WHERE fmd."idFide" = p_id_fideicomiso
                      AND (
                          (fmd.mes > EXTRACT(MONTH FROM pf.periodo_fin))
                          OR (fmd.mes = EXTRACT(MONTH FROM pf.periodo_fin) AND fmd.dia > EXTRACT(DAY FROM pf.periodo_fin))
                          OR (fmd.mes < EXTRACT(MONTH FROM pf.periodo_fin))
                      )
                    ORDER BY
                        CASE
                            WHEN fmd.mes > EXTRACT(MONTH FROM pf.periodo_fin) THEN 0
                            WHEN fmd.mes = EXTRACT(MONTH FROM pf.periodo_fin) AND fmd.dia > EXTRACT(DAY FROM pf.periodo_fin) THEN 0
                            ELSE 1
                        END,
                        fmd.mes, fmd.dia
                    LIMIT 1
                ),
                pf.num_dispersion_temporal + 1
            FROM periodos_fideicomiso pf
            WHERE pf.periodo_fin < v_fideicomiso.fecfin
              AND pf.num_dispersion_temporal < 100
        ),
        cortes_ordenados AS (
            SELECT
                ROW_NUMBER() OVER (ORDER BY fmd.mes, fmd.dia) AS orden_corte,
                fmd.mes,
                fmd.dia
            FROM "fideMesDispersion" fmd
            WHERE fmd."idFide" = p_id_fideicomiso
        )
        SELECT
            pf.periodo_inicio,
            pf.periodo_fin,
            (
                SELECT fpd.no_dispersion
                FROM public.fide_periodos_dispersion fpd
                WHERE pf.periodo_inicio >= fpd.fec_inicio AND pf.periodo_fin <= fpd.fec_fin
                LIMIT 1
            ) AS num_dispersion,
            (pf.periodo_fin - pf.periodo_inicio + 1)::INTEGER AS dias
        FROM periodos_fideicomiso pf
        WHERE pf.periodo_inicio >= p_fecha_pago
        ORDER BY pf.num_dispersion_temporal;

BEGIN
    -- Fecha/hora de creación: 2026-01-09 12:05:00 UTC
    -- =================================================================
    -- 1. Validar existencia del fideicomiso
    -- =================================================================
    SELECT EXISTS(SELECT 1 FROM "fideicomiso" WHERE "idFide" = p_id_fideicomiso)
    INTO v_existe_fideicomiso;

    IF NOT v_existe_fideicomiso THEN
        RAISE EXCEPTION 'El fideicomiso con ID % no existe', p_id_fideicomiso;
    END IF;

    -- =================================================================
    -- 2. Obtener datos del fideicomiso
    -- =================================================================
    SELECT * INTO v_fideicomiso
    FROM "fideicomiso"
    WHERE "idFide" = p_id_fideicomiso;

    -- =================================================================
    -- 3. Validar existencia del inversionista y obtener condiciones
    -- =================================================================
    SELECT EXISTS(SELECT 1 FROM "fideCondiciones" WHERE "idFide" = p_id_fideicomiso AND "noAdhesion" = p_no_adhesion)
    INTO v_existe_inversionista;

    IF NOT v_existe_inversionista THEN
        RAISE EXCEPTION 'El inversionista con número de adhesión % no existe en el fideicomiso %', p_no_adhesion, p_id_fideicomiso;
    END IF;

    SELECT
        fc.*,
        i.razonsocial,
        COALESCE(i.razonsocial, i.nombre || ' ' || i.apellido1 || ' ' || COALESCE(i.apellido2, '')) AS nombre_completo,
        i."RFC",
        i.personalidad
    INTO v_condiciones
    FROM "fideCondiciones" fc
    JOIN "propiedades" p ON fc."idPropiedad" = p."idPropiedad"
    JOIN "inversionista" i ON p."idInversionista" = i."idInversionista"
    WHERE fc."idFide" = p_id_fideicomiso
      AND fc."noAdhesion" = p_no_adhesion;

    -- =================================================================
    -- 4. Determinar si aplica promoción del 9%
    -- =================================================================
    v_tiene_promocion := COALESCE(v_condiciones."Prom9%", FALSE);

    IF v_tiene_promocion THEN
        SELECT MIN(fecha) INTO v_primer_pago
        FROM "pagos"
        WHERE "idPropiedad" = v_condiciones."idPropiedad";

        IF v_primer_pago IS NULL THEN
            RAISE EXCEPTION 'No se encontraron pagos para el inversionista con número de adhesión %', p_no_adhesion;
        END IF;

        v_fin_promocion := v_primer_pago + INTERVAL '1 year';
    ELSE
        v_fin_promocion := '1900-01-01'::DATE;
    END IF;

    -- =================================================================
    -- 5. Procesar cada pago y sus períodos asociados
    -- =================================================================
    OPEN cursor_pagos;
    LOOP
        FETCH cursor_pagos INTO v_pago;
        EXIT WHEN NOT FOUND;

        OPEN cursor_periodos(v_pago.fecha);
        LOOP
            FETCH cursor_periodos INTO v_periodo;
            EXIT WHEN NOT FOUND;

            v_numDispersion := v_periodo.num_dispersion;

            -- Caso 1: Período totalmente normal (después de promoción o sin promoción)
            IF (v_tiene_promocion AND v_periodo.periodo_inicio > v_fin_promocion) OR NOT v_tiene_promocion THEN
                v_tipo_periodo := CASE WHEN v_tiene_promocion THEN 'TOTAL_NORMAL' ELSE 'SIN_PROMOCION' END;
                v_dias_promocion := 0;
                v_dias_normales := v_periodo.dias;
                v_tasa_rendimiento := v_condiciones.rendimiento;
                v_rendimiento_bruto := ((v_pago.monto * (v_condiciones.rendimiento / 100.0)) / 365.0) * v_dias_normales;
                v_retencion_isr := CASE WHEN LOWER(v_condiciones.personalidad) = 'fisica' THEN v_rendimiento_bruto * 0.10 ELSE 0 END;
                v_rendimiento_neto := v_rendimiento_bruto - v_retencion_isr;
                v_rendimiento_sph := ((v_pago.monto * ((v_fideicomiso.rendimiento - v_condiciones.rendimiento) / 100.0)) / 365.0) * v_dias_normales;
                v_dispersion_neta := v_rendimiento_neto;

                RETURN QUERY SELECT
                    p_id_fideicomiso, p_no_adhesion, v_condiciones.nombre_completo, COALESCE(v_condiciones."RFC", ''), v_condiciones.razonsocial, v_condiciones.personalidad,
                    EXTRACT(YEAR FROM v_periodo.periodo_inicio)::INTEGER,
                    EXTRACT(MONTH FROM v_periodo.periodo_inicio)::INTEGER,
                    EXTRACT(DAY FROM v_periodo.periodo_inicio)::INTEGER,
                    EXTRACT(DAY FROM v_periodo.periodo_fin)::INTEGER,
                    v_tipo_periodo, NULL::TEXT,
                    v_pago."idPago", v_pago.monto, v_pago.fecha,
                    v_periodo.periodo_inicio, v_periodo.periodo_fin, v_periodo.dias,
                    v_numDispersion,
                    v_tasa_rendimiento, v_rendimiento_bruto, v_retencion_isr, v_rendimiento_neto, v_rendimiento_sph, v_dispersion_neta,
                    CURRENT_TIMESTAMP::TIMESTAMP;

            -- Caso 2: Período totalmente en promoción
            ELSIF v_periodo.periodo_fin <= v_fin_promocion THEN
                v_tipo_periodo := 'TOTAL_PROMOCION';
                v_dias_promocion := v_periodo.dias;
                v_dias_normales := 0;
                v_tasa_rendimiento := 9.0;
                v_rendimiento_bruto := ((v_pago.monto * 9.0 / 100.0) / 365.0) * v_dias_promocion;
                v_retencion_isr := CASE WHEN LOWER(v_condiciones.personalidad) = 'fisica' THEN v_rendimiento_bruto * 0.10 ELSE 0 END;
                v_rendimiento_neto := v_rendimiento_bruto - v_retencion_isr;
                v_rendimiento_sph := 0;
                v_dispersion_neta := v_rendimiento_neto;

                RETURN QUERY SELECT
                    p_id_fideicomiso, p_no_adhesion, v_condiciones.nombre_completo, COALESCE(v_condiciones."RFC", ''), v_condiciones.razonsocial, v_condiciones.personalidad,
                    EXTRACT(YEAR FROM v_periodo.periodo_inicio)::INTEGER,
                    EXTRACT(MONTH FROM v_periodo.periodo_inicio)::INTEGER,
                    EXTRACT(DAY FROM v_periodo.periodo_inicio)::INTEGER,
                    EXTRACT(DAY FROM v_periodo.periodo_fin)::INTEGER,
                    v_tipo_periodo, NULL::TEXT,
                    v_pago."idPago", v_pago.monto, v_pago.fecha,
                    v_periodo.periodo_inicio, v_periodo.periodo_fin, v_periodo.dias,
                    v_numDispersion,
                    v_tasa_rendimiento, v_rendimiento_bruto, v_retencion_isr, v_rendimiento_neto, v_rendimiento_sph, v_dispersion_neta,
                    CURRENT_TIMESTAMP::TIMESTAMP;

            -- Caso 3: Período mixto
            ELSE
                v_tipo_periodo := 'PERIODO_MIXTO';
                v_dias_promocion := v_fin_promocion - v_periodo.periodo_inicio + 1;
                v_dias_normales := v_periodo.periodo_fin - v_fin_promocion;
                v_fecha_inicio_promo := v_periodo.periodo_inicio;
                v_fecha_fin_promo := v_fin_promocion;
                v_fecha_inicio_normal := v_fin_promocion + 1;
                v_fecha_fin_normal := v_periodo.periodo_fin;

                -- Sub-período: promoción
                v_tasa_rendimiento := 9.0;
                v_rendimiento_bruto := ((v_pago.monto * 9.0 / 100.0) / 365.0) * v_dias_promocion;
                v_retencion_isr := CASE WHEN LOWER(v_condiciones.personalidad) = 'fisica' THEN v_rendimiento_bruto * 0.10 ELSE 0 END;
                v_rendimiento_neto := v_rendimiento_bruto - v_retencion_isr;
                v_rendimiento_sph := 0;
                v_dispersion_neta := v_rendimiento_neto;

                RETURN QUERY SELECT
                    p_id_fideicomiso, p_no_adhesion, v_condiciones.nombre_completo, COALESCE(v_condiciones."RFC", ''), v_condiciones.razonsocial, v_condiciones.personalidad,
                    EXTRACT(YEAR FROM v_fecha_inicio_promo)::INTEGER,
                    EXTRACT(MONTH FROM v_fecha_inicio_promo)::INTEGER,
                    EXTRACT(DAY FROM v_fecha_inicio_promo)::INTEGER,
                    EXTRACT(DAY FROM v_fecha_fin_promo)::INTEGER,
                    v_tipo_periodo, 'PROMOCION'::TEXT,
                    v_pago."idPago", v_pago.monto, v_pago.fecha,
                    v_fecha_inicio_promo, v_fecha_fin_promo, v_dias_promocion,
                    v_numDispersion,
                    v_tasa_rendimiento, v_rendimiento_bruto, v_retencion_isr, v_rendimiento_neto, v_rendimiento_sph, v_dispersion_neta,
                    CURRENT_TIMESTAMP::TIMESTAMP;

                -- Sub-período: normal
                v_tasa_rendimiento := v_condiciones.rendimiento;
                v_rendimiento_bruto := ((v_pago.monto * (v_condiciones.rendimiento / 100.0)) / 365.0) * v_dias_normales;
                v_retencion_isr := CASE WHEN LOWER(v_condiciones.personalidad) = 'fisica' THEN v_rendimiento_bruto * 0.10 ELSE 0 END;
                v_rendimiento_neto := v_rendimiento_bruto - v_retencion_isr;
                v_rendimiento_sph := ((v_pago.monto * ((v_fideicomiso.rendimiento - v_condiciones.rendimiento) / 100.0)) / 365.0) * v_dias_normales;
                v_dispersion_neta := v_rendimiento_neto;

                RETURN QUERY SELECT
                    p_id_fideicomiso, p_no_adhesion, v_condiciones.nombre_completo, COALESCE(v_condiciones."RFC", ''), v_condiciones.razonsocial, v_condiciones.personalidad,
                    EXTRACT(YEAR FROM v_fecha_inicio_normal)::INTEGER,
                    EXTRACT(MONTH FROM v_fecha_inicio_normal)::INTEGER,
                    EXTRACT(DAY FROM v_fecha_inicio_normal)::INTEGER,
                    EXTRACT(DAY FROM v_fecha_fin_normal)::INTEGER,
                    v_tipo_periodo, 'NORMAL'::TEXT,
                    v_pago."idPago", v_pago.monto, v_pago.fecha,
                    v_fecha_inicio_normal, v_fecha_fin_normal, v_dias_normales,
                    v_numDispersion,
                    v_tasa_rendimiento, v_rendimiento_bruto, v_retencion_isr, v_rendimiento_neto, v_rendimiento_sph, v_dispersion_neta,
                    CURRENT_TIMESTAMP::TIMESTAMP;
            END IF;
        END LOOP;
        CLOSE cursor_periodos;
    END LOOP;
    CLOSE cursor_pagos;

    RETURN;
END;
$$;
