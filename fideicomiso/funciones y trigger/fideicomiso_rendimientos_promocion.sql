--[Fecha y Hora]: 31/12/2025 11:02:00
--[Descripción]: Calcula los rendimientos de fideicomiso considerando la promoción del 9% 
--                durante el primer año desde el primer pago de cada inversionista.
--                Maneja períodos mixtos donde parte del cálculo cae en promoción y parte no.
--
--[Parámetros]:
--   - mes_periodo (integer): Mes del período de dispersión (1-12)
--   - anio_periodo (integer): Año del período de dispersión
--   - mes_anterior (integer): Mes del período anterior (1-12)  
--   - anio_anterior (integer): Año del período anterior
--   - id_propiedad_filtro (text, opcional): ID de propiedad específica a consultar
--
--[Salida]:
--   - Tabla con todos los inversionistas y sus cálculos de rendimiento detallados
--     incluyendo retención de ISR, rendimiento anual contratado y monto neto a dispersar
--
--[Uso típico]: Para generar reportes de dispersión mensual considerando promociones
--
--[Ejemplo]: 
--   -- Dispersión de junio 2025, período anterior marzo 2025 (todos)
--   SELECT * FROM fideicomiso_rendimientos_promocion(6, 2025, 3, 2025);
--   
--   -- Solo una propiedad específica
--   SELECT * FROM fideicomiso_rendimientos_promocion(6, 2025, 3, 2025, 'ID_PROPIEDAD');
--
--   -- Filtrar un inversionista específico
--   SELECT * FROM fideicomiso_rendimientos_promocion(6, 2025, 3, 2025)
--   WHERE "idInversionista" = 'rezYWbQRIWzcZfr';
--
--[Relaciones]: 
--   - Tablas relacionadas: fideicomiso, fideCondiciones, propiedades, inversionista, pagos, fideMesDispersion
--   - Funciones relacionadas: fideicomiso_rendimientos_resumen_consulta (usa esta función)
--
--[Validaciones]:
--   - Calcula automáticamente el período promocional basándose en el primer pago de cada inversionista
--   - Maneja 4 tipos de períodos: SIN_PROMOCION, TOTAL_PROMOCION, TOTAL_NORMAL, PERIODO_MIXTO
--   - Aplica retención de ISR del 10% solo para personas físicas
--   - Calcula días en promoción para análisis y auditoría

CREATE OR REPLACE FUNCTION public.fideicomiso_rendimientos_promocion(mes_periodo integer, anio_periodo integer, mes_anterior integer, anio_anterior integer, id_propiedad_filtro text DEFAULT NULL::text)
 RETURNS TABLE("idFide" text, "idInversionista" text, "idPropiedad" text, razonsocial text, personalidad text, "noAdhesion" text, "rendFideicomiso" smallint, "rendContratado" real, "rendSPH" double precision, "tieneProm" boolean, "esTicket" boolean, "idPdp" text, "fecLabel" text, "Pago" double precision, "fecPago" date, fecini date, "fecDispersion" date, "Dias" integer, primer_pago_fecha date, fin_promocion_fecha date, "diasEnPromocion" integer, "tipoPeriodo" text, "RendInv" double precision, "retencionISR" double precision, "RendSPH" double precision, "rendAnual" double precision, "Dispersion" double precision)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH primer_pago_info AS (
        -- Obtener el primer pago de cada inversionista para establecer el período promocional
        SELECT 
            prop."idInversionista",
            MIN(p.fecha) AS primer_pago_fecha,
            (MIN(p.fecha) + INTERVAL '1 year' - INTERVAL '1 day')::DATE AS fin_promocion_fecha
        FROM propiedades prop
        INNER JOIN pagos p ON p."idPropiedad" = prop."idPropiedad"
        GROUP BY prop."idInversionista"
    ),
    calculo_base AS (
        SELECT
            fc."idFide",
            i."idInversionista",
            i.razonsocial,
            i.personalidad,
            fc."noAdhesion",
            f.rendimiento AS "rendFideicomiso",
            fc.rendimiento AS "rendContratado", 
            (f.rendimiento - fc.rendimiento) AS "rendSPH",
            fc."Prom9%" as "tieneProm",
            prop."esTicket",
            prop."idPdp",
            
            -- Información del pago
            prop."idPropiedad",
            p.monto as Pago,
            p.fecha AS fecPago,
            
            -- Fechas de cálculo del período
            CASE 
                WHEN p.fecha > TO_DATE(anio_anterior || '-' || mes_anterior || '-' || fmd.dia, 'YYYY-MM-DD')::DATE
                THEN p.fecha
                ELSE TO_DATE(anio_anterior || '-' || mes_anterior || '-' || fmd.dia, 'YYYY-MM-DD')::DATE + 1
            END AS fecini,
            
            TO_DATE(anio_periodo || '-' || fmd.mes || '-' || fmd.dia, 'YYYY-MM-DD')::DATE AS fecDispersion,
            
            -- Información promocional
            ppi.primer_pago_fecha,
            ppi.fin_promocion_fecha,
            
            -- Días totales del período
            CASE 
                WHEN p.fecha > TO_DATE(anio_anterior || '-' || mes_anterior || '-' || fmd.dia, 'YYYY-MM-DD')::DATE
                THEN TO_DATE(anio_periodo || '-' || fmd.mes || '-' || fmd.dia, 'YYYY-MM-DD')::DATE - p.fecha 
                ELSE TO_DATE(anio_periodo || '-' || fmd.mes || '-' || fmd.dia, 'YYYY-MM-DD')::DATE - 
                     (TO_DATE(anio_anterior || '-' || mes_anterior || '-' || fmd.dia, 'YYYY-MM-DD')::DATE + 1)
            END AS dias_totales,
            
            mes_anterior,
            anio_anterior,
            fmd.dia
            
        FROM "fideCondiciones" fc
        LEFT JOIN propiedades prop ON prop."idPropiedad" = fc."idPropiedad"
        LEFT JOIN inversionista i ON i."idInversionista" = prop."idInversionista"
        LEFT JOIN pagos p ON p."idPropiedad" = prop."idPropiedad"
        LEFT JOIN fideicomiso f ON f."idFide" = fc."idFide"
        LEFT JOIN "fideMesDispersion" fmd ON fmd."idFide" = fc."idFide"
        LEFT JOIN primer_pago_info ppi ON ppi."idInversionista" = prop."idInversionista"
        WHERE
            fmd.mes = mes_periodo
            AND p.fecha <= TO_DATE(anio_periodo || '-' || mes_periodo || '-' || 
                                   EXTRACT(DAY FROM (DATE_TRUNC('month', TO_DATE(anio_periodo || '-' || mes_periodo || '-01', 'YYYY-MM-DD')) 
                                                   + INTERVAL '1 month' - INTERVAL '1 day')), 'YYYY-MM-DD')::DATE
            AND (id_propiedad_filtro IS NULL OR prop."idPropiedad" = id_propiedad_filtro)
    ),
    calculos_rendimientos AS (
        SELECT
            cb.*,
            
            -- Rendimiento total del inversionista (promoción + normal)
            CASE 
                WHEN NOT cb."tieneProm" THEN 
                    ((cb.Pago * (cb."rendContratado" / 100.0)) / 365) * cb.dias_totales
                WHEN cb.fecDispersion <= cb.fin_promocion_fecha THEN 
                    ((cb.Pago * (cb."rendFideicomiso" / 100.0)) / 365) * cb.dias_totales
                WHEN cb.fecini > cb.fin_promocion_fecha THEN 
                    ((cb.Pago * (cb."rendContratado" / 100.0)) / 365) * cb.dias_totales
                ELSE 
                    -- Período mixto: promoción + normal
                    ((cb.Pago * (cb."rendFideicomiso" / 100.0)) / 365) * 
                    GREATEST(0, (cb.fin_promocion_fecha - cb.fecini + 1)) +
                    ((cb.Pago * (cb."rendContratado" / 100.0)) / 365) * 
                    GREATEST(0, cb.dias_totales - (cb.fin_promocion_fecha - cb.fecini + 1))
            END AS calc_rend_inv,
            
            -- Retención ISR para personas físicas (10%)
            CASE 
                WHEN LOWER(cb.personalidad) = 'fisica' THEN
                    CASE 
                        WHEN NOT cb."tieneProm" THEN 
                            ((cb.Pago * (cb."rendContratado" / 100.0)) / 365) * cb.dias_totales * 0.10
                        WHEN cb.fecDispersion <= cb.fin_promocion_fecha THEN 
                            ((cb.Pago * (cb."rendFideicomiso" / 100.0)) / 365) * cb.dias_totales * 0.10
                        WHEN cb.fecini > cb.fin_promocion_fecha THEN 
                            ((cb.Pago * (cb."rendContratado" / 100.0)) / 365) * cb.dias_totales * 0.10
                        ELSE 
                            -- Período mixto: promoción + normal
                            (((cb.Pago * (cb."rendFideicomiso" / 100.0)) / 365) * 
                            GREATEST(0, (cb.fin_promocion_fecha - cb.fecini + 1)) +
                            ((cb.Pago * (cb."rendContratado" / 100.0)) / 365) * 
                            GREATEST(0, cb.dias_totales - (cb.fin_promocion_fecha - cb.fecini + 1))) * 0.10
                    END
                ELSE 0::double precision
            END AS calc_retencion_isr
            
        FROM calculo_base cb
    )
    SELECT
        cr."idFide",
        cr."idInversionista",
        cr."idPropiedad",
        cr.razonsocial,
        cr.personalidad,
        cr."noAdhesion",
        cr."rendFideicomiso",
        cr."rendContratado", 
        cr."rendSPH",
        cr."tieneProm",
        cr."esTicket",
        cr."idPdp",
        
        -- Etiqueta del período
        CASE 
            WHEN cr.fecPago > TO_DATE(cr.anio_anterior || '-' || cr.mes_anterior || '-' || cr.dia, 'YYYY-MM-DD')::DATE
            THEN 'fecPago'
            ELSE 'fecPeriodoAnterior'
        END AS "fecLabel",
        
        cr.Pago,
        cr.fecPago,
        cr.fecini,
        cr.fecDispersion,
        cr.dias_totales::integer AS "Dias",
        cr.primer_pago_fecha,
        cr.fin_promocion_fecha,
        
        -- Días en promoción (para análisis)
        CASE 
            WHEN NOT cr."tieneProm" THEN 0
            WHEN cr.fecDispersion <= cr.fin_promocion_fecha THEN cr.dias_totales -- Todo el período en promoción
            WHEN cr.fecini > cr.fin_promocion_fecha THEN 0 -- Todo el período fuera de promoción
            ELSE GREATEST(0, (cr.fin_promocion_fecha - cr.fecini + 1)) -- Parte en promoción
        END::integer AS "diasEnPromocion",
        
        -- Tipo de período para análisis
        CASE 
            WHEN NOT cr."tieneProm" THEN 'SIN_PROMOCION'
            WHEN cr.fecDispersion <= cr.fin_promocion_fecha THEN 'TOTAL_PROMOCION'
            WHEN cr.fecini > cr.fin_promocion_fecha THEN 'TOTAL_NORMAL'
            ELSE 'PERIODO_MIXTO'
        END AS "tipoPeriodo",
        
        cr.calc_rend_inv AS "RendInv",
        cr.calc_retencion_isr AS "retencionISR",
        
        -- Rendimiento de SPH (solo cuando NO está en período promocional)
        CASE 
            WHEN NOT cr."tieneProm" THEN 
                ((cr.Pago * (cr."rendSPH" / 100.0)) / 365) * cr.dias_totales
            WHEN cr.fecDispersion <= cr.fin_promocion_fecha THEN 0::double precision -- En promoción total = 0 SPH
            WHEN cr.fecini > cr.fin_promocion_fecha THEN 
                ((cr.Pago * (cr."rendSPH" / 100.0)) / 365) * cr.dias_totales
            ELSE 
                -- Período mixto: SPH solo en los días después de la promoción
                ((cr.Pago * (cr."rendSPH" / 100.0)) / 365) * 
                GREATEST(0, cr.dias_totales - (cr.fin_promocion_fecha - cr.fecini + 1))
        END AS "RendSPH",
        
        -- Rendimiento anual contratado (Pago * rendContratado / 100)
        (cr.Pago * (cr."rendContratado" / 100.0)) AS "rendAnual",
        
        -- Nueva columna: Dispersión neta (RendInv - retencionISR)
        (cr.calc_rend_inv - cr.calc_retencion_isr) AS "Dispersion"

    FROM calculos_rendimientos cr
    ORDER BY cr."idInversionista", cr.fecPago;

END;
$function$;
