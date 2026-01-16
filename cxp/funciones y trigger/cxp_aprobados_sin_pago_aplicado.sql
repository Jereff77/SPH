--[Fecha y Hora]: 20/11/2025 21:50:19
--[Descripción]: Función que actualiza el idEstatus de todos los registros de la tabla cxp
--                que están aprobados (estatus 4) pero no tienen pago aplicado,
--                cambiando el estatus de 4 a 99 para un mes y año específicos.
--                Registra la actividad en la tabla actividad usando la función RAU.
--
--[Parámetros]:
--   - p_num_mes (integer): Número del mes a filtrar (1-12)
--   - p_num_anio (integer): Año a filtrar (ej: 2025)
--
--[Salida]:
--   - resultado_funcion: Tipo compuesto con estatus, mensaje y registros_afectados
--
--[Uso típico]: Se utiliza para cambiar masivamente el estatus de registros de "Aprobado" (4) 
--              que no tienen pago aplicado a un estatus personalizado (99) para un período específico.
--              No puede ejecutarse en el mes en curso por seguridad.
--              Registra automáticamente la actividad en la tabla actividad.
--
--[Ejemplo]: SELECT * FROM cxp_aprobados_sin_pago_aplicado(11, 2024) AS (estatus boolean, mensaje text, registros_afectados integer);
--
--[Relaciones]: 
--   - Tabla principal: cxp
--   - Campos afectados: idEstado, numMes, numAnio, montoAplicado
--   - Tabla de actividad: actividad (mediante función RAU)
--
--[Validaciones]:
--   - Valida que el mes esté entre 1 y 12
--   - Valida que el año sea un valor razonable (mayor a 2000)
--   - NO permite ejecutar en el mes en curso
--   - Solo actualiza registros con idEstado = 4 y montoAplicado = 0
--
CREATE OR REPLACE FUNCTION public.cxp_aprobados_sin_pago_aplicado(
    p_num_mes integer,
    p_num_anio integer
)
RETURNS resultado_funcion
LANGUAGE plpgsql
SECURITY INVOKER
AS $BODY$
DECLARE
    v_registros_actualizados integer := 0;
    v_mensaje_error text;
    v_mensaje_exito text;
    v_resultado resultado_funcion;
BEGIN
    --[Fecha y Hora]: 20/11/2025 21:50:19
    -- [Descripción]: Función que actualiza el idEstatus de todos los registros de la tabla cxp
    --                que están aprobados (estatus 4) pero No tienen pago aplicado,
    --                cambiando el estatus de 4 a 99 para un mes y año específicos.
    --                Registra la actividad en la tabla actividad usando la función RAU.
    --
    -- [Entrada]: p_num_mes (integer) - Número del mes a filtrar (1-12)
    --           p_num_anio (integer) - Año a filtrar (ej: 2025)
    --
    -- [Salida]: resultado_funcion - Tipo compuesto con estatus, mensaje y registros_afectados
    --
    -- [Uso típico]: Se utiliza para cambiar masivamente el estatus de registros de "Aprobado" (4) 
    --               que no tienen pago aplicado a un estatus personalizado (99) para un período específico.
    --               No puede ejecutarse en el mes en curso por seguridad.
    --               Registra automáticamente la actividad en la tabla actividad.
    --
    -- [Ejemplo]: SELECT * FROM cxp_aprobados_sin_pago_aplicado(11, 2024) AS (estatus boolean, mensaje text, registros_afectados integer);
    
    -- Validar que el mes sea válido
    IF p_num_mes < 1 OR p_num_mes > 12 THEN
        v_mensaje_error := 'El mes debe estar entre 1 y 12. Valor proporcionado: ' || p_num_mes;
        
        -- Registrar actividad de error
        PERFORM public.rau(
            'cxp_actualizacion_masiva',
            'funcion',
            'cxp_aprobados_sin_pago_aplicado',
            v_mensaje_error
        );
        
        -- Retornar resultado de error
        v_resultado := (false, v_mensaje_error, 0);
        RETURN v_resultado;
    END IF;
    
    -- Validar que el año sea razonable
    IF p_num_anio < 2000 OR p_num_anio > 2100 THEN
        v_mensaje_error := 'El año debe estar entre 2000 y 2100. Valor proporcionado: ' || p_num_anio;
        
        -- Registrar actividad de error
        PERFORM public.rau(
            'cxp_actualizacion_masiva',
            'funcion',
            'cxp_aprobados_sin_pago_aplicado',
            v_mensaje_error
        );
        
        -- Retornar resultado de error
        v_resultado := (false, v_mensaje_error, 0);
        RETURN v_resultado;
    END IF;
    
    -- Validar que no sea el mes en curso
    IF p_num_mes = EXTRACT(MONTH FROM CURRENT_DATE) AND p_num_anio = EXTRACT(YEAR FROM CURRENT_DATE) THEN
        v_mensaje_error := 'No se puede ejecutar la función en el mes en curso. Mes actual: ' || 
                          EXTRACT(MONTH FROM CURRENT_DATE) || ', Año actual: ' || 
                          EXTRACT(YEAR FROM CURRENT_DATE);
        
        -- Registrar actividad de error
        PERFORM public.rau(
            'cxp_actualizacion_masiva',
            'funcion',
            'cxp_aprobados_sin_pago_aplicado',
            v_mensaje_error
        );
        
        -- Retornar resultado de error
        v_resultado := (false, v_mensaje_error, 0);
        RETURN v_resultado;
    END IF;
    
    -- Actualizar los registros que cumplan con las condiciones
    UPDATE public.cxp
    SET "idEstado" = 99
    WHERE "numMes" = p_num_mes
      AND "numAnio" = p_num_anio
      AND "idEstado" = 4  -- Aprobados
      AND "montoAplicado" = 0;  -- Sin pago aplicado
    
    -- Obtener el número de registros actualizados
    GET DIAGNOSTICS v_registros_actualizados = ROW_COUNT;
    
    -- Construir mensaje de éxito
    v_mensaje_exito := 'Se actualizaron ' || v_registros_actualizados || ' registros de aprobados sin pago aplicado para el mes ' || 
                     p_num_mes || ' y año ' || p_num_anio;
    
    -- Registrar actividad de éxito
    PERFORM public.rau(
        'cxp_actualizacion_masiva',
        'funcion',
        'cxp_aprobados_sin_pago_aplicado',
        v_mensaje_exito
    );
    
    -- Retornar resultado de éxito
    v_resultado := (true, v_mensaje_exito, v_registros_actualizados);
    RETURN v_resultado;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Manejo de errores
        v_mensaje_error := 'Error en cxp_aprobados_sin_pago_aplicado: ' || SQLERRM;
        
        -- Registrar actividad de error
        PERFORM public.rau(
            'cxp_actualizacion_masiva',
            'funcion',
            'cxp_aprobados_sin_pago_aplicado',
            v_mensaje_error
        );
        
        -- Retornar resultado de error
        v_resultado := (false, v_mensaje_error, 0);
        RETURN v_resultado;
END;
$BODY$;