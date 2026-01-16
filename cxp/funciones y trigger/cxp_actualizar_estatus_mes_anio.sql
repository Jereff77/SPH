--[Fecha y Hora]: 20/11/2025 13:23:58
--[Descripción]: Función que actualiza el idEstatus de todos los registros de la tabla cxp
--                que correspondan a un mes y año específicos, cambiando el estatus de 2 a 99.
--
--[Parámetros]:
--   - p_num_mes (integer): Número del mes a filtrar (1-12)
--   - p_num_anio (integer): Año a filtrar (ej: 2025)
--
--[Salida]:
--   - integer: Número de registros actualizados
--
--[Uso típico]: Se utiliza para cambiar masivamente el estatus de registros de "Enviado" (2)
--              a un estatus personalizado (99) para un período específico.
--              No puede ejecutarse en el mes en curso por seguridad.
--
--[Ejemplo]: SELECT cxp_actualizar_estatus_mes_anio(11, 2025);
--
--[Relaciones]: 
--   - Tabla principal: cxp
--   - Campos afectados: idEstado, numMes, numAnio
--
--[Validaciones]:
--   - Valida que el mes esté entre 1 y 12
--   - Valida que el año sea un valor razonable (mayor a 2000)
--   - NO permite ejecutar en el mes en curso
--   - Solo actualiza registros con idEstado = 2
--
CREATE OR REPLACE FUNCTION public.cxp_actualizar_estatus_mes_anio(
    p_num_mes integer,
    p_num_anio integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
AS $BODY$
DECLARE
    v_registros_actualizados integer := 0;
    v_mensaje_error text;
BEGIN
    --[Fecha y Hora]: 20/11/2025 13:23:58
    -- [Descripción]: Función que actualiza el idEstatus de todos los registros de la tabla cxp
    --                que correspondan a un mes y año específicos, cambiando el estatus de 2 a 99.
    --
    -- [Entrada]: p_num_mes (integer) - Número del mes a filtrar (1-12)
    --           p_num_anio (integer) - Año a filtrar (ej: 2025)
    --
    -- [Salida]: integer - Número de registros actualizados
    --
    -- [Uso típico]: Se utiliza para cambiar masivamente el estatus de registros de "Enviado" (2) 
    --               a un estatus personalizado (99) para un período específico.
    --
    -- [Ejemplo]: SELECT cxp_actualizar_estatus_mes_anio(11, 2025);
    
    -- Validar que el mes sea válido
    IF p_num_mes < 1 OR p_num_mes > 12 THEN
        v_mensaje_error := 'El mes debe estar entre 1 y 12. Valor proporcionado: ' || p_num_mes;
        RAISE EXCEPTION '%', v_mensaje_error;
    END IF;
    
    -- Validar que el año sea razonable
    IF p_num_anio < 2000 OR p_num_anio > 2100 THEN
        v_mensaje_error := 'El año debe estar entre 2000 y 2100. Valor proporcionado: ' || p_num_anio;
        RAISE EXCEPTION '%', v_mensaje_error;
    END IF;
    
    -- Validar que no sea el mes en curso
    IF p_num_mes = EXTRACT(MONTH FROM CURRENT_DATE) AND p_num_anio = EXTRACT(YEAR FROM CURRENT_DATE) THEN
        v_mensaje_error := 'No se puede ejecutar la función en el mes en curso. Mes actual: ' ||
                          EXTRACT(MONTH FROM CURRENT_DATE) || ', Año actual: ' ||
                          EXTRACT(YEAR FROM CURRENT_DATE);
        RAISE EXCEPTION '%', v_mensaje_error;
    END IF;
    
    -- Actualizar los registros que cumplan con las condiciones
    UPDATE public.cxp
    SET "idEstado" = 99
    WHERE "numMes" = p_num_mes
      AND "numAnio" = p_num_anio
      AND "idEstado" = 2;
    
    -- Obtener el número de registros actualizados
    GET DIAGNOSTICS v_registros_actualizados = ROW_COUNT;
    
    -- Registrar en log (opcional, si se tiene tabla de logs)
    -- INSERT INTO log_cambios_cxp (tabla, campo, valor_anterior, valor_nuevo, usuario, fecha, descripcion)
    -- VALUES ('cxp', 'idEstado', 2, 99, current_user, NOW(), 
    --         'Actualización masiva para mes ' || p_num_mes || ' y año ' || p_num_anio);
    
    RETURN v_registros_actualizados;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Manejo de errores
        RAISE EXCEPTION 'Error en cxp_actualizar_estatus_mes_anio: %', SQLERRM;
END;
$BODY$;