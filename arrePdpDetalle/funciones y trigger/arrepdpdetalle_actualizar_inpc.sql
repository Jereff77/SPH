--[Fecha y Hora]: 21/10/2025 23:46:00
--[Descripción]: Actualiza la columna "INPC" en "arrePdpDetalle" para cada año del plan,
--                comenzando desde el año 2. El nuevo valor se obtiene tomando EXACTAMENTE
--                el valor del INPC correspondiente a 3 MESES ANTES DEL PRIMER MES del año actual.
--                IMPORTANTE: Implementa lógica ACUMULATIVA - cada año actualiza todos los años >= al actual.
--
--[Parámetros]:
--   - id_arrepdp (text): ID del plan ("idArrePdp") cuyas partidas se deben actualizar.
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
--   - Año 3: Aplica INPC a años 3, 4, 5, 6, etc.
--   - Año 4: Aplica INPC a años 4, 5, 6, 7, etc. (reemplaza INPC anterior en años 4+)
--   - Año 5: Aplica INPC a años 5, 6, 7, 8, etc. (reemplaza INPC anterior en años 5+)
--
--[Uso típico]: Llamar después de insertar o calcular los años del plan.
--               Esta función recalcula el INPC dinámicamente según reglas definidas.
--
--[Ejemplo]: SELECT * FROM arrepdpdetalle_actualizar_inpc('YRaQ0OG65ndDrnN');
--
--[Relaciones]: 
--   - Tabla principal: public."arrePdpDetalle"
--   - Tabla de referencia: public.inpc (para obtener valores del índice)
--
--[Validaciones]:
--   - Verifica existencia del contrato
--   - Valida disponibilidad de datos INPC requeridos
--   - Maneja errores de manera estructurada
--
--[Consideraciones]:
--   - Implementa lógica acumulativa para actualizaciones progresivas
--   - Requiere exactamente 3 meses de antelación del INPC
--   - Es sensible a la disponibilidad de datos en tabla inpc
--
--[Trigger asociado]: Ninguno (función independiente)
--
--[Notas importantes]:
--   - El INPC se aplica solo a partir del año 2 en adelante
--   - Si no encuentra dato exacto para el mes requerido, reporta error
--   - La lógica acumulativa asegura que años posteriores siempre usen el INPC más reciente

CREATE OR REPLACE FUNCTION public.arrepdpdetalle_actualizar_inpc(id_arrepdp text)
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
    -- Validar que el contrato existe
    IF NOT EXISTS (SELECT 1 FROM public."arrePdpDetalle" WHERE "idArrePdp" = id_arrepdp) THEN
        RETURN QUERY SELECT NULL::smallint, NULL::real, NULL::text, 0::integer, 'El contrato especificado no existe'::text;
        RETURN;
    END IF;

    FOR anio_actual IN
        SELECT DISTINCT anio
        FROM public."arrePdpDetalle"
        WHERE "idArrePdp" = id_arrepdp AND anio >= 2
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
                    format('Falta registro de INPC para mes: %s/%s', EXTRACT(YEAR FROM fecha_busqueda), EXTRACT(MONTH FROM fecha_busqueda))::text;
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
                format('No se encontraron registros con fecha para el año %s', anio_actual)::text;
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