--[Fecha y Hora]: 20/01/2026 21:48:36
--[Descripción]: Función que devuelve un resumen agrupado por número de partida de los detalles
--                de un plan de pago específico. Calcula valores máximos, mínimos y sumas
--                para diferentes conceptos del plan. Incluye validación opcional de que el
--                plan esté activo en arrenPropiedades.
--
--[Parámetros]:
--   - p_idarrepdp (text): El ID del plan ("idArrePdp") del cual se obtendrá el resumen.
--   - p_validar (boolean): Si es true, valida que pdpActivo = true en arrenPropiedades.
--                          Por defecto es true.
--
--[Salida]: TABLE con la siguiente estructura:
--   - numPartida (integer): Número de partida agrupado
--   - anio (smallint): Año máximo de la partida
--   - fecha (date): Fecha mínima de la partida
--   - pm2 (double precision): Valor pm2 máximo para concepto 'Renta'
--   - constM2 (double precision): Valor constM2 máximo para concepto 'Renta'
--   - INPC (real): Valor INPC máximo para concepto 'Renta'
--   - ptsINPC (real): Valor ptsINPC máximo para concepto 'Renta'
--   - totalINPC (real): Valor inpcTotal máximo para concepto 'Renta'
--   - ciclo (integer): Ciclo máximo de la partida
--   - total_cantidad (numeric): Suma de cantidades de todos los conceptos
--   - idArrePdp (text): ID del plan (igual al parámetro de entrada)
--   - pdpActivo (boolean): Estado activo del plan en arrenPropiedades
--
--[Uso típico]: Se utiliza para obtener un resumen consolidado de un plan de pago,
--               agrupando por número de partida y extrayendo valores relevantes
--               especialmente del concepto 'Renta'.
--
--[Ejemplo]: 
--   SELECT * FROM arrepdpdetalle_obtener_resumen_por_plan('YRaQ0OG65ndDrnN');
--   SELECT * FROM arrepdpdetalle_obtener_resumen_por_plan('YRaQ0OG65ndDrnN', false);
--
--[Relaciones]: 
--   - Tabla principal: public."arrePdpDetalle"
--   - Tabla relacionada: public."arrePdp" (para obtener idNavArrend)
--   - Tabla relacionada: public."arrenPropiedades" (para validar pdpActivo)
--
--[Validaciones]:
--   - Filtra solo registros con status = true
--   - Filtra por el idArrePdp proporcionado
--   - Agrupa por idArrePdp y numPartida
--   - Si p_validar = true, valida que pdpActivo = true en arrenPropiedades
--
--[Consideraciones]:
--   - Los valores pm2, constM2, INPC, ptsINPC y totalINPC se obtienen solo del concepto 'Renta'
--   - La suma de cantidades incluye todos los conceptos
--   - Ordena los resultados por idArrePdp y numPartida para mantener secuencia lógica
--   - Si la validación falla (p_validar = true y pdpActivo != true), devuelve conjunto vacío
--
--[Notas importantes]:
--   - Función de solo lectura, no realiza modificaciones en la base de datos
--   - Útil para reportes y visualizaciones resumidas de planes de pago
--   - La validación de pdpActivo proporciona seguridad adicional para planes activos

CREATE OR REPLACE FUNCTION public.arrepdpdetalle_obtener_resumen_por_plan(p_idarrepdp text, p_validar boolean DEFAULT true)
 RETURNS TABLE(
     "numPartida" integer,
     anio smallint,
     fecha date,
     pm2 double precision,
     "constM2" double precision,
     "INPC" real,
     "ptsINPC" real,
     "totalINPC" real,
     ciclo integer,
     total_cantidad numeric,
     "idArrePdp" text,
     pdpActivo boolean
 )
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $BODY$
DECLARE
    v_pdp_activo boolean;
BEGIN
    -- [Descripción]: Función que devuelve un resumen agrupado por número de partida de los detalles
    --                de un plan de pago específico. Calcula valores máximos, mínimos y sumas
    --                para diferentes conceptos del plan. Incluye validación opcional de pdpActivo.
    --
    -- [Entrada]: 
    --   - p_idarrepdp (text) - El ID del plan ("idArrePdp") del cual se obtendrá el resumen.
    --   - p_validar (boolean) - Si es true, valida que pdpActivo = true en arrenPropiedades.
    --
    -- [Salida]: TABLE con resumen agrupado por partida con valores calculados.
    --
    -- [Uso típico]: Se utiliza para obtener un resumen consolidado de un plan de pago,
    --               agrupando por número de partida y extrayendo valores relevantes
    --               especialmente del concepto 'Renta'.
    --
    -- [Ejemplo]: 
    --   SELECT * FROM arrepdpdetalle_obtener_resumen_por_plan('YRaQ0OG65ndDrnN');
    --   SELECT * FROM arrepdpdetalle_obtener_resumen_por_plan('YRaQ0OG65ndDrnN', false);

    -- Validación opcional de pdpActivo en arrenPropiedades
    IF p_validar THEN
        SELECT arp."pdpActivo" INTO v_pdp_activo
        FROM public."arrePdp" ap
        INNER JOIN public."arrenPropiedades" arp ON ap."idNavArrend" = arp."idNavArrend"
        WHERE ap."idArrePdp" = p_idarrepdp;
        
        -- Si pdpActivo no es true, devolver conjunto vacío
        IF v_pdp_activo IS NULL OR v_pdp_activo = false THEN
            RETURN;
        END IF;
    END IF;

    RETURN QUERY
    SELECT
      "arrePdpDetalle"."numPartida",
      max("arrePdpDetalle".anio) as anio,
      min("arrePdpDetalle".fecha::date) as fecha,
      max(
        case
          when "arrePdpDetalle".concepto = 'Renta'::text then "arrePdpDetalle".pm2::double precision
          else null::double precision
        end
      ) as pm2,
      max(
        case
          when "arrePdpDetalle".concepto = 'Renta'::text then "arrePdpDetalle"."constM2"::double precision
          else null::double precision
        end
      ) as "constM2",
      max(
        case
          when "arrePdpDetalle".concepto = 'Renta'::text then "arrePdpDetalle"."INPC"::real
          else null::real
        end
      ) as "INPC",
      max(
        case
          when "arrePdpDetalle".concepto = 'Renta'::text then "arrePdpDetalle"."ptsINPC"::real
          else null::real
        end
      ) as "ptsINPC",
      max(
        case
          when "arrePdpDetalle".concepto = 'Renta'::text then "arrePdpDetalle"."inpcTotal"::real
          else null::real
        end
      ) as "totalINPC",
      max("arrePdpDetalle".ciclo) as ciclo,
      sum("arrePdpDetalle".cantidad) as total_cantidad,
      "arrePdpDetalle"."idArrePdp",
      arp."pdpActivo"
    FROM
      "arrePdpDetalle"
      INNER JOIN public."arrePdp" ap ON "arrePdpDetalle"."idArrePdp" = ap."idArrePdp"
      INNER JOIN public."arrenPropiedades" arp ON ap."idNavArrend" = arp."idNavArrend"
    WHERE
      "arrePdpDetalle".status = true
      and "arrePdpDetalle"."idArrePdp" = p_idarrepdp
    GROUP BY
      "arrePdpDetalle"."idArrePdp",
      "arrePdpDetalle"."numPartida",
      arp."pdpActivo"
    ORDER BY
      "arrePdpDetalle"."idArrePdp",
      "arrePdpDetalle"."numPartida";
      
    RETURN;
END;
$BODY$;
