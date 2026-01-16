--[Fecha y Hora]: 21/10/2025 23:47:00
--[Descripción]: Calcula y actualiza el campo "anio" en todos los registros de "arrePdpDetalle"
--                que pertenecen a un plan específico identificado por "idArrePdp".
--
--[Parámetros]:
--   - id_arrepdp (text): El ID del plan ("idArrePdp") cuyas partidas se deben actualizar.
--
--[Salida]: void - No devuelve valor, solo realiza actualizaciones en la tabla.
--
--[Uso típico]: Se llama después de insertar nuevas partidas de un plan para recalcular los años.
--               Es útil cuando se insertan varias partidas a la vez y se requiere calcular años completos.
--
--[Ejemplo]: SELECT arrepdpdetalle_calcular_anio_por_plan('YRaQ0OG65ndDrnN');
--
--[Relaciones]: 
--   - Tabla principal: public."arrePdpDetalle"
--
--[Validaciones]:
--   - Se ejecuta solo en registros donde "numPartida" no es nulo
--   - No valida existencia del plan (asume que ya existe)
--
--[Fórmula aplicada]: ((numPartida - 1) / 12 + 1)::smallint
--   - Partida 1-12: Año 1
--   - Partida 13-24: Año 2
--   - Partida 25-36: Año 3, etc.
--
--[Trigger asociado]: Ninguno (función de ejecución manual)
--
--[Consideraciones]:
--   - Función simple y rápida para cálculo masivo
--   - No maneja depósitos (partida 0) - esos quedan con año calculado
--   - Para manejo específico de depósitos, usar arrepdpdetalle_recalcular_anos_contrato
--
--[Notas importantes]:
--   - Esta función es útil para recálculos rápidos después de inserciones masivas
--   - No distingue entre depósitos y partidas normales
--   - Si se requiere manejo especial de depósitos, usar la función de recálculo de contrato

CREATE OR REPLACE FUNCTION public.arrepdpdetalle_calcular_anio_por_plan(id_arrepdp text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $BODY$
BEGIN
    -- [Descripción]: Calcula y actualiza el campo "anio" en todos los registros de "arrePdpDetalle"
    --                que pertenecen a un plan específico identificado por "idArrePdp".
    --
    -- [Entrada]: id_arrepdp (text) - El ID del plan ("idArrePdp") cuyas partidas se deben actualizar.
    --
    -- [Salida]: void - No devuelve valor, solo realiza actualizaciones en la tabla.
    --
    -- [Uso típico]: Se llama después de insertar nuevas partidas de un plan para recalcular los años.
    --               Es útil cuando se insertan varias partidas a la vez y se requiere calcular años completos.
    --
    -- [Ejemplo]: SELECT arrepdpdetalle_calcular_anio_por_plan('YRaQ0OG65ndDrnN');

    UPDATE public."arrePdpDetalle"
    SET anio = ((COALESCE("numPartida", 0) - 1) / 12 + 1)::smallint
    WHERE "idArrePdp" = id_arrepdp AND "numPartida" IS NOT NULL;

END;
$BODY$;