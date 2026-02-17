--[Fecha y Hora]: 28/01/2026 08:49:00
--[Descripción]: Función para generar un plan de pagos de Renta Garantizada
--                basado en los datos de un registro existente en rgPdp
--
--[Parámetros]:
--   - p_idRtaG (text): Identificador del plan de pago garantizado
--
--[Salida]:
--   - jsonb: Objeto JSON con el resultado de la operación
--
--[Uso típico]: Se utiliza para crear las partidas mensuales de pago
--               para un plan de renta garantizada existente
--
--[Ejemplo]: SELECT * FROM rgpdp_generar_plan_pagos('RG_1234567890abcdef');
--
--[Relaciones]: 
--   - Tabla origen: public.rgPdp
--   - Tabla destino: public.rgPdpDetalle
--
--[Validaciones]:
--   - Valida que el plan de pago exista y esté activo
--   - Verifica que el plan no tenga detalles previamente generados
--   - Calcula automáticamente fechas y montos mensuales
--
--[Consideraciones]:
--   - Genera una partida por cada mes del contrato
--   - Usa el concepto "Renta Garantizada" para todas las partidas
--   - Calcula el monto mensual dividiendo el total entre la duración
--   - Utiliza el campo "numPago" en lugar de "numPartida" (según estructura real de la tabla)
--   - Utiliza el campo "numPago" en lugar de "numPartida"

CREATE OR REPLACE FUNCTION public.rgpdp_generar_plan_pagos(
    p_idRtaG text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $function$
DECLARE
    v_registro_existente boolean;
    v_detalles_existentes boolean;
    v_idPropiedad text;
    v_fechaInicio date;
    v_fechaFin date;
    v_duracionRenta integer;
    v_subtotal numeric;
    v_monto_mensual numeric;
    v_m2Construccion numeric;
    v_precioM2 numeric;
    v_uid text;
    v_mes_actual integer := 1;
    v_fecha_actual date;
    v_partidas_insertadas integer := 0;
    v_idRGdet text;
BEGIN
    -- Validar que el ID del plan no sea nulo o vacío
    IF p_idRtaG IS NULL OR TRIM(p_idRtaG) = '' THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PARAMETRO_INVALIDO',
            'mensaje', 'El ID del plan de pago es obligatorio'
        );
    END IF;
    
    -- Verificar que el plan de pago exista y esté activo
    SELECT EXISTS(
        SELECT 1 FROM public."rgPdp" 
        WHERE "idRtaG" = p_idRtaG AND status = true
    ) INTO v_registro_existente;
    
    IF NOT v_registro_existente THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PLAN_NO_EXISTE',
            'mensaje', 'El plan de pago especificado no existe o no está activo'
        );
    END IF;
    
    -- Verificar que el plan no tenga detalles previamente generados
    SELECT EXISTS(
        SELECT 1 FROM public."rgPdpDetalle" 
        WHERE "idRtaG" = p_idRtaG AND status = true
    ) INTO v_detalles_existentes;
    
    IF v_detalles_existentes THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'DETALLES_EXISTENTES',
            'mensaje', 'El plan de pago ya tiene detalles generados previamente'
        );
    END IF;
    
    -- Obtener los datos del plan de pago
    SELECT 
        "idPropiedad",
        "fechaInicio",
        "fechaFin",
        "duracionRenta",
        "subtotal",
        "m2Construccion",
        "precioM2",
        uid
    INTO 
        v_idPropiedad,
        v_fechaInicio,
        v_fechaFin,
        v_duracionRenta,
        v_subtotal,
        v_m2Construccion,
        v_precioM2,
        v_uid
    FROM public."rgPdp"
    WHERE "idRtaG" = p_idRtaG;
    
    -- Validar que se hayan obtenido los datos correctamente
    IF v_idPropiedad IS NULL THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'ERROR_DATOS',
            'mensaje', 'No se pudieron obtener los datos del plan de pago'
        );
    END IF;
    
    -- Calcular el monto mensual
    v_monto_mensual := v_subtotal;
    
    -- Iniciar generación de partidas mensuales
    v_fecha_actual := v_fechaInicio;
    
    WHILE v_mes_actual <= v_duracionRenta LOOP
        -- Generar ID único para el detalle
        v_idRGdet := p_idRtaG || '_' || LPAD(v_mes_actual::text, 3, '0');
        
        -- Insertar partida mensual con concepto "Renta Garantizada"
        INSERT INTO public."rgPdpDetalle" (
            "idRGdet",
            "fc",
            "status",
            "uid",
            "idRtaG",
            "numPago",
            "concepto",
            "fecha",
            "subtotal",
            "statusPago"
        ) VALUES (
            v_idRGdet,
            NOW(),
            true,
            v_uid,
            p_idRtaG,
            v_mes_actual,
            'Renta Garantizada',
            v_fecha_actual,
            v_monto_mensual,
            false
        );
        
        -- Incrementar contadores
        v_partidas_insertadas := v_partidas_insertadas + 1;
        v_mes_actual := v_mes_actual + 1;
        
        -- Avanzar al siguiente mes
        v_fecha_actual := v_fecha_actual + INTERVAL '1 month';
    END LOOP;
    
    -- Retorno exitoso
    RETURN jsonb_build_object(
        'exito', true,
        'codigo', 'PLAN_GENERADO',
        'mensaje', 'Plan de pagos generado exitosamente',
        'datos', jsonb_build_object(
            'idRtaG', p_idRtaG,
            'idPropiedad', v_idPropiedad,
            'duracionRenta', v_duracionRenta,
            'montoTotal', v_total,
            'montoMensual', v_monto_mensual,
            'partidasGeneradas', v_partidas_insertadas,
            'fechaInicio', v_fechaInicio,
            'fechaFin', v_fechaFin,
            'concepto', 'Renta Garantizada'
        )
    );
    
EXCEPTION
    WHEN unique_violation THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'DUPLICADO',
            'mensaje', 'Violación de unicidad al generar el plan de pagos'
        );
    WHEN foreign_key_violation THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'RELACION_INVALIDA',
            'mensaje', 'Violación de llave foránea, verifique las relaciones'
        );
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'ERROR_INTERNO',
            'mensaje', 'Error interno: ' || SQLERRM,
            'detalles', jsonb_build_object(
                'sqlstate', SQLSTATE,
                'idRtaG', p_idRtaG
            )
        );
END;
$function$;