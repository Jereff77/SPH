--[Fecha y Hora]: 21/10/2025 23:53:00
--[Descripción]: Calcula y actualiza el campo ciclo para todos los registros de arrePdpDetalle.
--                El ciclo se marca con el año de inicio del periodo y se calcula
--                based on la fecha de inicio del plan y la fecha de cada registro.
--
--[Parámetros]: Ninguno (opera sobre toda la tabla)
--
--[Salida]: void - No devuelve valor, solo realiza actualizaciones en la tabla.
--
--[Lógica de cálculo]: 
--   - Obtiene la fecha de inicio de cada plan (fecha mínima)
--   - Calcula el ciclo como: año_inicio + años_completos_transcurridos
--   - Usa cálculo preciso basado en timestamps
--
--[Uso típico]: Se ejecuta después de insertar o modificar fechas en los planes de pago.
--               Es útil para mantener actualizado el campo ciclo que se usa
--               para agrupaciones y reportes por ciclos de pago.
--
--[Ejemplo]: SELECT actualizar_ciclo_plan_pago();
--
--[Relaciones]: 
--   - Tabla principal: public."arrePdpDetalle"
--
--[Validaciones]:
--   - Maneja fechas nulas asignando NULL al ciclo
--   - Solo actualiza registros con fechas válidas
--   - Procesa todos los planes de pago en la tabla
--
--[Consideraciones de rendimiento]:
--   - Función masiva que procesa toda la tabla
--   - Usa cursor para procesar cada plan individualmente
--   - Cálculo preciso pero potencialmente costoso en tablas grandes
--
--[Notas importantes]:
--   - El ciclo representa el año de inicio más los años transcurridos
--   - Es diferente del campo anio que representa el año del contrato
--   - Se usa principalmente para agrupaciones y análisis temporales
--
--[Fórmula aplicada]: 
--   EXTRACT(YEAR FROM fecha_inicio_plan)::smallint + 
--   FLOOR((EXTRACT(EPOCH FROM date_trunc('month', fecha)) - 
--          EXTRACT(EPOCH FROM date_trunc('month', fecha_inicio_plan))) / 
--          (365.25 * 24 * 60 * 60))::smallint

CREATE OR REPLACE FUNCTION public.actualizar_ciclo_plan_pago()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $BODY$
DECLARE
    plan_record RECORD;
    fecha_inicio_plan timestamp;
BEGIN
    -- [Descripción]: Calcula y actualiza el campo ciclo para todos los registros de arrePdpDetalle.
    --                El ciclo se marca con el año de inicio del periodo y se calcula
    --                based on la fecha de inicio del plan y la fecha de cada registro.
    --
    -- [Salida]: void - No devuelve valor, solo realiza actualizaciones en la tabla.
    --
    -- [Lógica de cálculo]: 
    --   - Obtiene la fecha de inicio de cada plan (fecha mínima)
    --   - Calcula el ciclo como: año_inicio + años_completos_transcurridos
    --   - Usa cálculo preciso basado en timestamps
    --
    -- [Uso típico]: Se ejecuta después de insertar o modificar fechas en los planes de pago.
    --               Es útil para mantener actualizado el campo ciclo que se usa
    --               para agrupaciones y reportes por ciclos de pago.
    --
    -- [Ejemplo]: SELECT actualizar_ciclo_plan_pago();

    -- Iteramos sobre cada plan de pago único
    FOR plan_record IN 
        SELECT DISTINCT "idArrePdp"
        FROM public."arrePdpDetalle"
    LOOP
        -- Obtenemos la fecha de inicio para este plan
        SELECT MIN(fecha) INTO fecha_inicio_plan
        FROM public."arrePdpDetalle"
        WHERE "idArrePdp" = plan_record."idArrePdp";

        -- Actualizamos el ciclo para cada registro del plan
        UPDATE public."arrePdpDetalle"
        SET ciclo = 
            CASE 
                WHEN fecha IS NULL OR fecha_inicio_plan IS NULL THEN NULL
                ELSE
                    CASE 
                        WHEN fecha >= fecha_inicio_plan THEN
                            -- Extraemos el año de la fecha de inicio
                            EXTRACT(YEAR FROM fecha_inicio_plan)::smallint +
                            -- Sumamos los años completos transcurridos
                            FLOOR(
                                (EXTRACT(EPOCH FROM date_trunc('month', fecha)) - 
                                 EXTRACT(EPOCH FROM date_trunc('month', fecha_inicio_plan))) / 
                                (365.25 * 24 * 60 * 60)
                            )::smallint
                        ELSE NULL
                    END
            END
        WHERE "idArrePdp" = plan_record."idArrePdp";
    END LOOP;
END;
$BODY$;