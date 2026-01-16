--[Fecha y Hora]: 31/12/2025 11:03:00
--[Descripción]: Versión simplificada de resumen por inversionista basada en consulta directa.
--                Agrupa por inversionista sumando rendimientos y mostrando información consolidada.
--
--[Parámetros]:
--   - mes_periodo (integer): Mes del período de dispersión (1-12)
--   - anio_periodo (integer): Año del período de dispersión
--   - mes_anterior (integer): Mes del período anterior (1-12)  
--   - anio_anterior (integer): Año del período anterior
--   - id_propiedad_filtro (text, opcional): ID de propiedad específica a consultar
--
--[Salida]:
--   - Tabla con un registro por inversionista con totales consolidados
--
--[Uso típico]: Alternativa a la función principal de resumen, basada en consulta CTE
--
--[Ejemplo]: 
--   -- Resumen de todos los inversionistas
--   SELECT * FROM fideicomiso_rendimientos_resumen_consulta(6, 2025, 3, 2025);
--   
--   -- Solo una propiedad específica
--   SELECT * FROM fideicomiso_rendimientos_resumen_consulta(6, 2025, 3, 2025, 'ID_PROPIEDAD');
--
--[Relaciones]: 
--   - Funciones relacionadas: fideicomiso_rendimientos_promocion (utiliza esta función como base)
--   - Tablas relacionadas: fideicomiso, fideCondiciones, propiedades, inversionista, pagos
--
--[Validaciones]:
--   - Utiliza ranking por días para obtener el registro más representativo por inversionista
--   - Ordena correctamente números y texto en "noAdhesion"
--   - Suma todos los rendimientos y retenciones por inversionista
--   - Cuenta pagos con promoción y pagos mixtos para análisis

CREATE OR REPLACE FUNCTION public.fideicomiso_rendimientos_resumen_consulta(mes_periodo integer, anio_periodo integer, mes_anterior integer, anio_anterior integer, id_propiedad_filtro text DEFAULT NULL::text)
 RETURNS TABLE("idFide" text, "idInversionista" text, "idPropiedad" text, razonsocial text, personalidad text, "noAdhesion" text, "rendFideicomiso" smallint, "rendContratado" real, "rendSPH" double precision, "tieneProm" boolean, "esTicket" boolean, "idPdp" text, "fecLabel" text, "totalPagos" double precision, "primerFecPago" date, "ultimaFecPago" date, fecini date, "fecDispersion" date, "Dias" integer, primer_pago_fecha date, fin_promocion_fecha date, "totalDiasEnPromocion" bigint, "tipoPeriodo" text, "totalRendInv" double precision, "totalRetencionISR" double precision, "totalRendSPH" double precision, "cantidadPagos" bigint, "pagosConPromocion" bigint, "pagosMixtos" bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH datos_detalle AS (
        SELECT * FROM fideicomiso_rendimientos_promocion(
            mes_periodo, 
            anio_periodo, 
            mes_anterior, 
            anio_anterior, 
            id_propiedad_filtro
        )
    ),
    datos_con_ranking AS (
        SELECT 
            *,
            -- Ranking por días para obtener el registro con más días por inversionista
            ROW_NUMBER() OVER (PARTITION BY dd."idInversionista" ORDER BY dd."Dias" DESC) as rn_dias
        FROM datos_detalle dd
    )
    SELECT
        -- Información del inversionista (tomamos del primer registro)
        MAX(CASE WHEN dcr.rn_dias = 1 THEN dcr."idFide" END) as "idFide",
        dcr."idInversionista",
        MAX(CASE WHEN dcr.rn_dias = 1 THEN dcr."idPropiedad" END) as "idPropiedad",
        MAX(dcr.razonsocial) as razonsocial,
        MAX(dcr.personalidad) as personalidad,
        MAX(CASE WHEN dcr.rn_dias = 1 THEN dcr."noAdhesion" END) as "noAdhesion",
        MAX(dcr."rendFideicomiso") as "rendFideicomiso",
        MAX(dcr."rendContratado") as "rendContratado",
        MAX(dcr."rendSPH") as "rendSPH",
        BOOL_OR(dcr."tieneProm") as "tieneProm",
        BOOL_OR(dcr."esTicket") as "esTicket",
        MAX(CASE WHEN dcr.rn_dias = 1 THEN dcr."idPdp" END) as "idPdp",
        
        -- Información del período (tomamos del registro con más días)
        MAX(CASE WHEN dcr.rn_dias = 1 THEN dcr."fecLabel" END) as "fecLabel",
        
        -- Totales sumados
        SUM(dcr."Pago") as "totalPagos",
        MIN(dcr."fecPago") as "primerFecPago",
        MAX(dcr."fecPago") as "ultimaFecPago",
        
        -- Fechas del registro con más días
        MAX(CASE WHEN dcr.rn_dias = 1 THEN dcr.fecini END) as fecini,
        MAX(CASE WHEN dcr.rn_dias = 1 THEN dcr."fecDispersion" END) as "fecDispersion",
        
        -- Días del registro con mayor número de días
        MAX(dcr."Dias") as "Dias",
        
        -- Fechas promocionales (deberían ser iguales para todos los registros del mismo inversionista)
        MAX(dcr.primer_pago_fecha) as primer_pago_fecha,
        MAX(dcr.fin_promocion_fecha) as fin_promocion_fecha,
        
        -- Días en promoción sumados
        SUM(dcr."diasEnPromocion") as "totalDiasEnPromocion",
        
        -- Tipo de período (tomamos el más común o el del registro con más días)
        MAX(CASE WHEN dcr.rn_dias = 1 THEN dcr."tipoPeriodo" END) as "tipoPeriodo",
        
        -- Rendimientos sumados (esto es lo más importante)
        SUM(dcr."RendInv") as "totalRendInv",
        SUM(dcr."retencionISR") as "totalRetencionISR",
        SUM(dcr."RendSPH") as "totalRendSPH",
        
        -- Información adicional para análisis
        COUNT(*) as "cantidadPagos",
        COUNT(CASE WHEN dcr."tieneProm" = true THEN 1 END) as "pagosConPromocion",
        COUNT(CASE WHEN dcr."tipoPeriodo" = 'PERIODO_MIXTO' THEN 1 END) as "pagosMixtos"

    FROM datos_con_ranking dcr
    GROUP BY dcr."idInversionista"
    ORDER BY 
    -- Si es numérico, ordena como número; si no, ordena como texto
    CASE 
        WHEN MAX(CASE WHEN dcr.rn_dias = 1 THEN dcr."noAdhesion" END) ~ '^[0-9]+$' 
        THEN LPAD(MAX(CASE WHEN dcr.rn_dias = 1 THEN dcr."noAdhesion" END), 10, '0')
        ELSE MAX(CASE WHEN dcr.rn_dias = 1 THEN dcr."noAdhesion" END)
    END;

END;
$function$;
