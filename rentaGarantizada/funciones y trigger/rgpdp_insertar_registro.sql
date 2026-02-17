--[Fecha y Hora]: 28/01/2026 04:00:00
--[Descripción]: Función para insertar un registro en la tabla rgPdp con cálculos automáticos
--
--[Parámetros]:
--   - p_idPropiedad (text): Identificador de la propiedad
--   - p_rentaActiva (numeric): Monto de renta activa
--   - p_precioM2 (numeric): Precio por metro cuadrado
--   - p_tasaIVA (numeric): Tasa de IVA
--   - p_fecInicio (date): Fecha de inicio del contrato
--   - p_estadoRenta (text): Estado de la renta
--   - p_fechaFin (date): Fecha de finalización del contrato
--   - p_m2Construccion (numeric): Metros cuadrados de construcción
--   - p_tieneRG (boolean): Indica si tiene garantía
--   - p_cumpMin (boolean): Cumplimiento mínimo
--   - p_proporcional (boolean): Proporcional
--   - p_incrementoAnual (numeric): Incremento anual
--   - p_uid (uuid): Identificador único del usuario
--
--[Salida]:
--   - jsonb: Objeto JSON con el resultado de la operación
--
--[Uso típico]: Se utiliza para crear nuevos registros de planes de pago garantizados
--               con cálculos automáticos de campos derivados
--
--[Ejemplo]: SELECT rgpdp_insertar_registro('PROP_001', 15000.0, 150.0, 16.0, '2026-01-01', 'Activo', '2028-01-01', 100.0, 1920.0, true, true, false, 0.0, 'uuid-usuario');
--
--[Relaciones]: 
--   - Tabla: rentaGarantizada.rgPdp
--   - Dependencias: arrenPropiedades (para validar la propiedad)
--
--[Validaciones]:
--   - Valida que la propiedad exista y esté activa
--   - Calcula automáticamente idRtaG, duracionRenta, subtotal y total
--   - Asegura que las fechas sean consistentes

CREATE OR REPLACE FUNCTION public.rgpdp_insertar_registro(
    p_idPropiedad text,
    p_rentaActiva boolean,
    p_precioM2 double precision,
    p_tasaIVA double precision,
    p_fecInicio date,
    p_estadoRenta integer,
    p_fechaFin date,
    p_m2Construccion double precision,
    p_tieneRG boolean,
    p_cumpMin double precision,
    p_proporcional boolean,
    p_incrementoAnual double precision,
    p_uid text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $function$
DECLARE
    v_idRtaG text;
    v_duracionRenta integer;
    v_subtotal double precision;
    v_iva double precision;
    v_total double precision;
    v_uidc text;
    v_propiedad_existe boolean;
    v_resultado jsonb;
BEGIN
    -- Validar que las fechas sean consistentes
    IF p_fecInicio >= p_fechaFin THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'FECHAS_INVALIDAS',
            'mensaje', 'La fecha de inicio debe ser anterior a la fecha de fin'
        );
    END IF;
    
    -- Validar que la propiedad exista y esté activa
    SELECT EXISTS(
        SELECT 1 FROM public."propiedades" 
        WHERE "idPropiedad" = p_idPropiedad AND status = true
    ) INTO v_propiedad_existe;
    
    IF NOT v_propiedad_existe THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PROPIEDAD_NO_EXISTE',
            'mensaje', 'La propiedad especificada no existe o no está activa'
        );
    END IF;
    
    -- Generar idRtaG aleatorio de 30 dígitos (letras y números)
    v_idRtaG := 'RG_' || substring(md5(random()::text), 1, 28);
    
    -- Calcular duración en meses
    v_duracionRenta := (
        (EXTRACT(YEAR FROM p_fechaFin) - EXTRACT(YEAR FROM p_fecInicio)) * 12 +
        (EXTRACT(MONTH FROM p_fechaFin) - EXTRACT(MONTH FROM p_fecInicio))
    )::integer;
    
    -- Calcular subtotal y total
    v_subtotal := p_m2Construccion * p_precioM2;
    v_iva := v_subtotal * p_tasaIVA;
    v_total := v_subtotal + v_iva;
    
    -- Obtener uid del usuario actual si no se proporciona
    v_uidc := COALESCE(p_uid, current_setting('app.current_user_id', true)::text);
    
    -- Insertar el registro
    INSERT INTO public."rgPdp" (
        "idRtaG",
        uid,
        fc,
        status,
        "idPropiedad",
        "rentaActiva",
        "precioM2",
        "tasaIVA",
        "fechaInicio",
        "duracionRenta",
        "estadoRenta",
        "fechaFin",
        "subtotal",
        "m2Construccion",
        "iva",
        "total",
        "tieneRg",
        "cumpMin",
        "proporcional",
        "incrementoAnual"
    ) VALUES (
        v_idRtaG,
        v_uidc,
        now(),
        true,
        p_idPropiedad,
        p_rentaActiva,
        p_precioM2,
        p_tasaIVA,
        p_fecInicio,
        v_duracionRenta,
        p_estadoRenta,
        p_fechaFin,
        v_subtotal,
        p_m2Construccion,
        v_iva,
        v_total,
        p_tieneRG,
        p_cumpMin,
        p_proporcional,
        p_incrementoAnual
    ) RETURNING "idRtaG" INTO v_idRtaG;
    
    -- Construir resultado exitoso
    v_resultado := jsonb_build_object(
        'exito', true,
        'codigo', 'REGISTRO_CREADO',
        'mensaje', 'Registro creado exitosamente',
        'datos', jsonb_build_object(
            'idRtaG', v_idRtaG,
            'duracionRenta', v_duracionRenta,
            'subtotal', v_subtotal,
            'total', v_total
        )
    );
    
    RETURN v_resultado;
    
EXCEPTION
    WHEN unique_violation THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'DUPLICADO',
            'mensaje', 'El registro ya existe o hay una violación de unicidad'
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
            'mensaje', 'Error interno: ' || SQLERRM
        );
END;
$function$;