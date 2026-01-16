--[Fecha y Hora]: 17/12/2025 17:44:00
--[Descripción]: Función que actualiza los campos comSPH y idRtaA en la tabla arrePdpDetalle
--                para una propiedad específica. Realiza el proceso completo:
--                1. Obtiene idNavArrend desde raPdp usando idPropiedad
--                2. Busca idArrePdp en arrePdp usando idNavArrend
--                3. Actualiza arrePdpDetalle con los valores de comSPH y idRtaA
--                   SOLO para registros donde concepto = 'Renta'
--
--[Parámetros]:
--   - p_idpropiedad (text): ID de la propiedad a procesar
--   - p_actualizar_valores (boolean, opcional): Si es true (default), usa los valores de raPdp.
--                                               Si es false, establece idRtaA = null y comSPH = 0
--
--[Salida]:
--   - JSON: Retorna objeto JSON con resultado de la operación
--
--[Uso típico]: Se utiliza para actualizar masivamente los campos comSPH y idRtaA
--               en las partidas de concepto 'Renta' de un plan de pago basado en el idPropiedad.
--               También puede usarse para limpiar estos valores pasando p_actualizar_valores = false.
--
--[Ejemplo]: SELECT * FROM rapdp_Actualizar('ABcqzhvE8a3x');
--           SELECT * FROM rapdp_Actualizar('ABcqzhvE8a3x', false);
--
--[Relaciones]:
--   - Tabla raPdp: Obtiene idNavArrend, comSPH y idRtaA
--   - Tabla arrePdp: Obtiene idArrePdp usando idNavArrend
--   - Tabla arrePdpDetalle: Actualiza campos comSPH y idRtaA
--
--[Validaciones]:
--   - Verifica que el parámetro p_idpropiedad no sea nulo
--   - Si p_actualizar_valores es true, verifica que existan datos completos en raPdp (comSPH y idRtaA no nulos)
--   - Verifica que exista idNavArrend en arrenPropiedades
--   - Verifica que exista plan activo en arrePdp
--   - Maneja casos donde no hay registros para actualizar
--   - Filtra actualizaciones solo para registros con concepto = 'Renta'

CREATE OR REPLACE FUNCTION public.rapdp_Actualizar(p_idpropiedad text, p_actualizar_valores boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $BODY$
DECLARE
    v_idnavarrend text;
    v_comsph text;
    v_idrtaa text;
    v_idarrepdp text;
    v_registros_actualizados integer := 0;
    v_existe_ra_pdp boolean := false;
    v_existe_arre_pdp boolean := false;
BEGIN
    --[Fecha y Hora]: 17/12/2025 17:44:00
    -- [Descripción]: Función que actualiza los campos comSPH y idRtaA en la tabla arrePdpDetalle
    --                para una propiedad específica. Realiza el proceso completo:
    --                1. Obtiene idNavArrend desde raPdp usando idPropiedad
    --                2. Busca idArrePdp en arrePdp usando idNavArrend
    --                3. Actualiza arrePdpDetalle con los valores de comSPH y idRtaA
    --                   SOLO para registros donde concepto = 'Renta'
    --
    -- [Entrada]: p_idpropiedad (text) - ID de la propiedad a procesar
    --           p_actualizar_valores (boolean) - Si es true, usa valores de raPdp. Si es false, establece null y 0
    --
    -- [Salida]: JSON - Retorna objeto JSON con resultado de la operación
    --
    -- [Uso típico]: Se utiliza para actualizar masivamente los campos comSPH y idRtaA
    --               en las partidas de concepto 'Renta' de un plan de pago basado en el idPropiedad.
    --               También puede usarse para limpiar estos valores pasando p_actualizar_valores = false.
    --
    -- [Ejemplo]: SELECT * FROM rapdp_Actualizar('ABcqzhvE8a3x');
    --           SELECT * FROM rapdp_Actualizar('ABcqzhvE8a3x', false);
    
    -- Validar que el parámetro no sea nulo
    IF p_idpropiedad IS NULL OR TRIM(p_idpropiedad) = '' THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PARAMETRO_INVALIDO',
            'mensaje', 'El idPropiedad no puede ser nulo o vacío'
        );
    END IF;
    
    -- Paso 1: Obtener idNavArrend desde raPdp
    SELECT
        ap."idNavArrend"
    INTO
        v_idnavarrend
    FROM
        "raPdp" ra
        LEFT JOIN propiedades p ON p."idPropiedad" = ra."idPropiedad"
        LEFT JOIN "arrenPropiedades" ap ON ap."idNave" = p."idNave"
    WHERE
        p."idPropiedad" = p_idpropiedad
    LIMIT 1;
    
    -- Si p_actualizar_valores es true, obtener comSPH y idRtaA desde raPdp
    IF p_actualizar_valores THEN
        SELECT
            ra."comSPH",
            ra."idRtaA"
        INTO
            v_comsph,
            v_idrtaa
        FROM
            "raPdp" ra
            LEFT JOIN propiedades p ON p."idPropiedad" = ra."idPropiedad"
        WHERE
            p."idPropiedad" = p_idpropiedad
        LIMIT 1;
        
        -- Verificar si encontramos datos en raPdp
        IF v_comsph IS NULL OR v_idrtaa IS NULL THEN
            RETURN jsonb_build_object(
                'exito', false,
                'codigo', 'DATOS_INCOMPLETOS_RA_PDP',
                'mensaje', 'No se encontraron datos completos en raPdp (comSPH o idRtaA son nulos)',
                'detalles', jsonb_build_object(
                    'idPropiedad', p_idpropiedad,
                    'comSPH', v_comsph,
                    'idRtaA', v_idrtaa
                )
            );
        END IF;
    END IF;
    
    -- Verificar si encontramos idNavArrend (para arrenPropiedades)
    IF v_idnavarrend IS NULL THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'SIN_DATOS_ARRENPROPIEDADES',
            'mensaje', 'No se encontró idNavArrend en arrenPropiedades para la propiedad especificada',
            'detalles', jsonb_build_object('idPropiedad', p_idpropiedad)
        );
    END IF;
    
    v_existe_ra_pdp := true;
    
    -- Paso 2: Buscar idArrePdp en arrePdp usando idNavArrend
    SELECT "idArrePdp"
    INTO v_idarrepdp
    FROM public."arrePdp"
    WHERE "idNavArrend" = v_idnavarrend
    ORDER BY "fecInicio" DESC
    LIMIT 1;
    
    -- Verificar si encontramos un plan activo
    IF v_idarrepdp IS NULL THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'SIN_PLAN_ACTIVO',
            'mensaje', 'No se encontró un plan activo en arrePdp para la nave especificada',
            'detalles', jsonb_build_object(
                'idPropiedad', p_idpropiedad,
                'idNavArrend', v_idnavarrend
            )
        );
    END IF;
    
    v_existe_arre_pdp := true;
    
    -- Paso 3: Actualizar arrePdpDetalle con los valores de comSPH y idRtaA
    -- Solo para registros donde concepto = 'Renta'
    IF p_actualizar_valores THEN
        UPDATE public."arrePdpDetalle"
        SET
            "comSPH" = v_comsph::real,
            "idRtaA" = v_idrtaa
        WHERE "idArrePdp" = v_idarrepdp
          AND concepto = 'Renta';
    ELSE
        UPDATE public."arrePdpDetalle"
        SET
            "comSPH" = 0,
            "idRtaA" = null
        WHERE "idArrePdp" = v_idarrepdp
          AND concepto = 'Renta';
    END IF;
    
    GET DIAGNOSTICS v_registros_actualizados = ROW_COUNT;
    
    -- Retornar resultado exitoso
    RETURN jsonb_build_object(
        'exito', true,
        'codigo', 'EXITO',
        'mensaje', 'Actualización completada correctamente',
        'detalles', jsonb_build_object(
            'idPropiedad', p_idpropiedad,
            'idNavArrend', v_idnavarrend,
            'idArrePdp', v_idarrepdp,
            'comSPH', CASE WHEN p_actualizar_valores THEN v_comsph ELSE '0' END,
            'idRtaA', CASE WHEN p_actualizar_valores THEN v_idrtaa ELSE null END,
            'actualizar_valores', p_actualizar_valores,
            'registros_actualizados', v_registros_actualizados,
            'existe_datos_ra_pdp', v_existe_ra_pdp,
            'existe_plan_activo', v_existe_arre_pdp,
            'timestamp', NOW()
        )
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'ERROR_GENERAL',
            'mensaje', 'Error interno: ' || SQLERRM,
            'detalles', jsonb_build_object(
                'sqlstate', SQLSTATE,
                'idPropiedad', p_idpropiedad
            )
        );
END;
$BODY$;