--[Fecha y Hora]: 21/10/2025 23:46:00
--[Descripción]: Actualiza la columna "INPC" en "arrePdpDetalle" para cada año del plan,
--                comenzando desde el año especificado. El nuevo valor se obtiene tomando EXACTAMENTE
--                el valor del INPC correspondiente a 3 MESES ANTES DEL PRIMER MES del año actual.
--                IMPORTANTE: Implementa lógica ACUMULATIVA - cada año actualiza todos los años >= al actual.
--
--[Parámetros]: 
--   - id_arrepdp (text): ID del plan ("idArrePdp") cuyas partidas se deben actualizar.
--   - anio_inicio (smallint): Año a partir del cual se quiere recalcular el INPC
--
--[Salida]: TABLE(
--              anio_aplicado smallint,
--              inpc_aplicado real,
--              id_inpc_usado text,
--              registros_actualizados integer,
--              error text
--          ) - Lista de años procesados con su resultado. Si hay error, se devuelve en 'error'.
--
--[Lógica Acumulativa]: 
--   - Año especificado: Aplica INPC a ese año y todos los posteriores
--   - Año siguiente: Aplica INPC a ese año y todos los posteriores (reemplaza INPC anterior)
--   - Y así sucesivamente...
--
--[Uso típico]: Recalcular INPC cuando se tenga nuevo dato disponible para un año específico.
--
--[Ejemplos]: 
--   - SELECT * FROM arrepdpdetalle_actualizar_inpc_desde_anio('8EILvoocnIGzbBj', 3);
--   - SELECT * FROM arrepdpdetalle_actualizar_inpc_desde_anio('8EILvoocnIGzbBj', 2);
--
--[Relaciones]: 
--   - Tabla principal: public."arrePdpDetalle"
--   - Tabla de referencia: public.inpc (para obtener valores del índice)
--
--[Validaciones]:
--   - Validación de parámetros de entrada
--   - Verifica existencia del contrato
--   - Valida disponibilidad de registros para el año especificado
--   - Manejo estructurado de errores
--
--[Consideraciones]:
--   - Implementa lógica acumulativa para actualizaciones progresivas
--   - Requiere exactamente 3 meses de antelación del INPC
--   - Es sensible a la disponibilidad de datos en tabla inpc
--   - El año de inicio debe ser >= 2
--
--[Trigger asociado]: Ninguno (función independiente)
--
--[Notas importantes]:
--   - Permite recalcular desde un año específico sin afectar años anteriores
--   - Si no encuentra dato exacto para el mes requerido, reporta error detallado
--   - La lógica acumulativa asegura consistencia en años posteriores

CREATE OR REPLACE FUNCTION public.arrepdpdetalle_actualizar_inpc_desde_anio(
    id_arrepdp text,
    anio_inicio smallint
)
 RETURNS TABLE(anio_aplicado smallint, inpc_aplicado real, id_inpc_usado text, registros_actualizados integer, error text)
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $BODY$
DECLARE
    anio_actual smallint;
    primera_fecha date;
    fecha_busqueda date;
    inpc_valor real;
    inpc_id text;
    registros_afectados integer;
BEGIN
    -- Validaciones de entrada
    IF id_arrepdp IS NULL OR TRIM(id_arrepdp) = '' THEN
        RETURN QUERY SELECT NULL::smallint, NULL::real, NULL::text, 0::integer, 'El ID del contrato es obligatorio'::text;
        RETURN;
    END IF;

    IF anio_inicio IS NULL OR anio_inicio < 2 THEN
        RETURN QUERY SELECT NULL::smallint, NULL::real, NULL::text, 0::integer, 'El año de inicio debe ser >= 2'::text;
        RETURN;
    END IF;

    -- Validar que el contrato existe
    IF NOT EXISTS (SELECT 1 FROM public."arrePdpDetalle" WHERE "idArrePdp" = id_arrepdp) THEN
        RETURN QUERY SELECT NULL::smallint, NULL::real, NULL::text, 0::integer, 'El contrato especificado no existe'::text;
        RETURN;
    END IF;

    -- Validar que existen registros para el año de inicio especificado
    IF NOT EXISTS (SELECT 1 FROM public."arrePdpDetalle" WHERE "idArrePdp" = id_arrepdp AND anio >= anio_inicio) THEN
        RETURN QUERY SELECT NULL::smallint, NULL::real, NULL::text, 0::integer, 
            format('No existen registros para el año %s o posteriores en este contrato', anio_inicio)::text;
        RETURN;
    END IF;

    FOR anio_actual IN
        SELECT DISTINCT anio
        FROM public."arrePdpDetalle"
        WHERE "idArrePdp" = id_arrepdp AND anio >= anio_inicio
        ORDER BY anio
    LOOP
        -- Obtener la fecha del primer mes de este año
        SELECT MIN(fecha)
        INTO primera_fecha
        FROM public."arrePdpDetalle"
        WHERE "idArrePdp" = id_arrepdp AND anio = anio_actual;

        IF primera_fecha IS NOT NULL THEN
            -- Restamos exactamente 3 meses al primer mes del año
            fecha_busqueda := primera_fecha - INTERVAL '3 months';

            -- Buscamos el registro EXACTO de INPC para esos valores
            SELECT i.inpc, i.id
            INTO inpc_valor, inpc_id
            FROM public.inpc i
            WHERE i.anio = EXTRACT(YEAR FROM fecha_busqueda)::smallint
              AND i.mes = EXTRACT(MONTH FROM fecha_busqueda)::smallint;

            -- Si NO encontramos valor EXACTO, marcamos error
            IF inpc_valor IS NULL THEN
                RETURN QUERY SELECT 
                    anio_actual, 
                    NULL::real, 
                    NULL::text, 
                    0::integer,
                    format('Falta registro de INPC para mes: %s/%s (requerido para año %s)', 
                           EXTRACT(YEAR FROM fecha_busqueda), 
                           EXTRACT(MONTH FROM fecha_busqueda), 
                           anio_actual)::text;
            ELSE
                -- LÓGICA ACUMULATIVA: Actualizamos todas las partidas de este año Y AÑOS POSTERIORES
                UPDATE public."arrePdpDetalle"
                SET "INPC" = inpc_valor
                WHERE "idArrePdp" = id_arrepdp AND anio >= anio_actual;
                
                GET DIAGNOSTICS registros_afectados = ROW_COUNT;

                -- Retornar fila con información del año, INPC aplicado, registros afectados y el ID del INPC usado
                RETURN QUERY SELECT 
                    anio_actual, 
                    inpc_valor, 
                    inpc_id, 
                    registros_afectados,
                    NULL::text;
            END IF;
        ELSE
            -- Si no hay fecha para este año, marcar como error
            RETURN QUERY SELECT 
                anio_actual, 
                NULL::real, 
                NULL::text, 
                0::integer,
                format('No se encontraron registros con fecha válida para el año %s', anio_actual)::text;
        END IF;
    END LOOP;

EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT 
            NULL::smallint, 
            NULL::real, 
            NULL::text, 
            0::integer,
            format('Error interno: %s', SQLERRM)::text;
END;
$BODY$;