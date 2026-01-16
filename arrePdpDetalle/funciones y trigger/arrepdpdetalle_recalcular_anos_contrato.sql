--[Fecha y Hora]: 21/10/2025 23:47:00
--[Descripción]: Recalcula el campo "anio" para todas las partidas de un contrato específico
--                aplicando la regla: Depósito (partida 0) = año 0, resto = fórmula matemática
--
--[Parámetro]: 
--   - id_contrato (TEXT): ID del contrato a recalcular ("idArrePdp")
--
--[Fórmula aplicada]:
--   - Partida 0 (Depósito): año = 0
--   - Partidas >= 1: año = ((numPartida - 1) / 12 + 1)
--
--[Uso típico]: Ejecutar después de insertar registros nuevos en un contrato
--               SELECT arrepdpdetalle_recalcular_anos_contrato('8EILvoocnIGzbBj');
--
--[Salida]: JSON con estadísticas de la operación
--
--[Códigos]: EXITO, PARAMETRO_INVALIDO, REGISTRO_NO_EXISTE, ERROR_BASE_DATOS
--
--[Relaciones]: 
--   - Tabla principal: public."arrePdpDetalle"
--
--[Validaciones]:
--   - Validación de parámetro no nulo/vacío
--   - Verificación de existencia del contrato
--   - Actualización selectiva solo de registros incorrectos
--
--[Trigger asociado]: Ninguno (función de ejecución manual)
--
--[Consideraciones de rendimiento]:
--   - Solo actualiza registros que realmente necesitan cambio
--   - Proporciona estadísticas detalladas de la operación
--   - Manejo robusto de errores con códigos estandarizados
--
--[Notas importantes]:
--   - Distingue correctamente entre depósitos (partida 0) y partidas normales
--   - Proporciona información detallada sobre los cambios realizados
--   - Si no hay cambios necesarios, indica que ya estaba correcto

CREATE OR REPLACE FUNCTION public.arrepdpdetalle_recalcular_anos_contrato(id_contrato TEXT)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $BODY$
DECLARE
    registros_actualizados INTEGER := 0;
    deposito_correcto INTEGER := 0;
    partidas_corregidas INTEGER := 0;
BEGIN
    -- [Descripción]: Recalcula el campo "anio" para todas las partidas de un contrato específico
    --                aplicando la regla: Depósito (partida 0) = año 0, resto = fórmula matemática
    --
    -- [Parámetro]: id_contrato (TEXT) - ID del contrato a recalcular ("idArrePdp")
    --
    -- [Fórmula aplicada]:
    --   - Partida 0 (Depósito): año = 0
    --   - Partidas >= 1: año = ((numPartida - 1) / 12 + 1)
    --
    -- [Uso típico]: Ejecutar después de insertar registros nuevos en un contrato
    --               SELECT arrepdpdetalle_recalcular_anos_contrato('8EILvoocnIGzbBj');
    --
    -- [Retorna]: JSON con estadísticas de la operación
    --
    -- [Códigos]: EXITO, PARAMETRO_INVALIDO, REGISTRO_NO_EXISTE, ERROR_BASE_DATOS

    -- Validar que el parámetro no esté vacío
    IF id_contrato IS NULL OR TRIM(id_contrato) = '' THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PARAMETRO_INVALIDO',
            'mensaje', 'El ID del contrato es obligatorio',
            'detalles', jsonb_build_object(
                'parametro_recibido', COALESCE(id_contrato, 'NULL')
            )
        );
    END IF;

    -- Verificar que el contrato existe
    IF NOT EXISTS (SELECT 1 FROM public."arrePdpDetalle" WHERE "idArrePdp" = id_contrato) THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'REGISTRO_NO_EXISTE',
            'mensaje', 'El contrato especificado no existe',
            'detalles', jsonb_build_object(
                'contrato_buscado', id_contrato
            )
        );
    END IF;

    -- Actualizar años para todas las partidas del contrato
    UPDATE public."arrePdpDetalle"
    SET anio = CASE 
        WHEN "numPartida" = 0 THEN 0::smallint  -- Depósito siempre año 0
        ELSE ((COALESCE("numPartida", 0) - 1) / 12 + 1)::smallint  -- Resto fórmula matemática
    END
    WHERE "idArrePdp" = id_contrato
    AND (
        -- Solo actualizar registros que realmente necesiten cambio
        ("numPartida" = 0 AND anio != 0) OR  -- Depósitos incorrectos
        ("numPartida" > 0 AND anio != ((COALESCE("numPartida", 0) - 1) / 12 + 1)::smallint)  -- Partidas incorrectas
    );

    -- Obtener número de registros afectados
    GET DIAGNOSTICS registros_actualizados = ROW_COUNT;

    -- Contar cuántos depósitos y partidas se corrigieron (antes de la corrección)
    SELECT 
        COALESCE(SUM(CASE WHEN "numPartida" = 0 AND anio != 0 THEN 1 ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN "numPartida" > 0 AND anio != ((COALESCE("numPartida", 0) - 1) / 12 + 1)::smallint THEN 1 ELSE 0 END), 0)
    INTO deposito_correcto, partidas_corregidas
    FROM public."arrePdpDetalle"
    WHERE "idArrePdp" = id_contrato;

    -- Si no hubo actualizaciones, verificar si ya estaba correcto
    IF registros_actualizados = 0 THEN
        RETURN jsonb_build_object(
            'exito', true,
            'codigo', 'EXITO',
            'mensaje', 'Contrato ya tiene los años calculados correctamente',
            'detalles', jsonb_build_object(
                'contrato_procesado', id_contrato,
                'registros_actualizados', registros_actualizados,
                'ya_estaba_correcto', true,
                'timestamp', NOW()
            )
        );
    END IF;

    -- Retornar resultado exitoso
    RETURN jsonb_build_object(
        'exito', true,
        'codigo', 'EXITO',
        'mensaje', 'Años recalculados correctamente para el contrato',
        'detalles', jsonb_build_object(
            'contrato_procesado', id_contrato,
            'registros_actualizados', registros_actualizados,
            'depositos_corregidos', deposito_correcto,
            'partidas_corregidas', partidas_corregidas,
            'timestamp', NOW()
        )
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'ERROR_BASE_DATOS',
            'mensaje', 'Error al recalcular años: ' || SQLERRM,
            'detalles', jsonb_build_object(
                'sqlstate', SQLSTATE,
                'contrato', id_contrato,
                'timestamp', NOW()
            )
        );
END;
$BODY$;