--[Fecha y Hora]: 01/12/2025 17:01:00
--[Descripción]: Función para validar accesos mediante códigos QR.
--                Verifica la vigencia del código, fecha de validez y región (horario de México).
--                Registra entrada/salida según corresponda y actualiza el estado del código.
--                Implementa validación de tiempo mínimo de 5 minutos entre entrada y salida.
--
--[Parámetros]:
--   - p_clave_acceso (text): Clave de acceso de 15 caracteres a validar
--
--[Salida]:
--   - json: Objeto JSON con estado de la validación y datos del visitante
--     {
--       "status": 0|1|2|3|4,
--       "nombre": "string",
--       "placas": "string",
--       "tipo_vehiculo": "string",
--       "urlIdentificacion": "string"
--     }
--   Status codes:
--   - 0: Código inválido
--   - 1: Entrada registrada
--   - 2: Salida registrada
--   - 3: Tiempo mínimo no cumplido (menos de 5 minutos desde entrada)
--   - 4: Código ya utilizado
--
--[Uso típico]: Se utiliza para validar códigos QR en puntos de acceso,
--               registrando automáticamente la entrada y salida de visitantes.
--               Evita registros dobles seguidos al requerir un tiempo mínimo.
--
--[Ejemplo]: SELECT qrgenerados_validar_acceso('ABC123DEF456GHI');
--
--[Relaciones]:
--   - Tabla qrGenerados: Contiene los códigos de acceso y su estado
--   - Tabla datosVisitantes: Contiene información del visitante
--
--[Validaciones]:
--   - Verifica que la clave de acceso exista y esté activa
--   - Valida que la fecha actual sea igual a fechaValidez
--   - Considera el horario de México (UTC-6) para validaciones
--   - Verifica que el código no haya sido utilizado completamente
--   - Valida que hayan pasado al menos 5 minutos entre entrada y salida
--   - Actualiza fecEntrada/fecSalida según corresponda
--   - Cambia status a false cuando ambos campos están llenos

CREATE OR REPLACE FUNCTION public.qrgenerados_validar_acceso(p_clave_acceso text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $BODY$
DECLARE
    v_id_qr UUID;
    v_id_visitante UUID;
    v_fecha_actual DATE := (NOW() AT TIME ZONE 'America/Mexico_City')::DATE; -- Fecha actual en zona horaria de México
    v_hora_actual TIMESTAMPTZ := NOW() AT TIME ZONE 'America/Mexico_City'; -- Timestamp actual en zona horaria de México
    v_fec_entrada TIMESTAMPTZ;
    v_fec_salida TIMESTAMPTZ;
    v_nombre_visitante TEXT;
    v_placas_vehiculo TEXT;
    v_tipo_vehiculo TEXT;
    v_url_identificacion TEXT;
    v_resultado JSONB;
    v_status INTEGER := 0; -- Por defecto: Código inválido
    v_vigencia BOOLEAN;
    v_mensaje TEXT;
    v_minutos_restantes NUMERIC;
BEGIN
    --[Fecha y Hora]: 01/12/2025 17:01:00
    -- [Descripción]: Función para validar accesos mediante códigos QR con validación de tiempo
    -- [Entrada]: p_clave_acceso (text) - Clave de acceso de 15 caracteres
    -- [Salida]: jsonb - Objeto JSON con estado y datos del visitante
    -- [Uso]: SELECT qrgenerados_validar_acceso('ABC123DEF456GHI');
    -- [Modificación]: Se agregó validación de 5 minutos mínimos entre entrada y salida
    
    -- Verificar que la clave de acceso exista y esté activa
    SELECT "idQR", "idVisitante", "fecEntrada", "fecSalida", "vigencia"
    INTO v_id_qr, v_id_visitante, v_fec_entrada, v_fec_salida, v_vigencia
    FROM public."qrGenerados"
    WHERE "claveAcceso" = p_clave_acceso AND "status" = true;
    
    -- Si no encuentra el código o está inactivo
    IF v_id_qr IS NULL THEN
        v_mensaje := 'Código de acceso no encontrado o inactivo';
        RETURN jsonb_build_object(
            'status', 0,
            'nombre', '',
            'placas', '',
            'tipo_vehiculo', '',
            'urlIdentificacion', '',
            'mensaje', v_mensaje,
            'exito', false
        );
    END IF;
    
    -- Verificar vigencia del código
    IF NOT v_vigencia THEN
        v_mensaje := 'Código de acceso no vigente';
        RETURN jsonb_build_object(
            'status', 0,
            'nombre', '',
            'placas', '',
            'tipo_vehiculo', '',
            'urlIdentificacion', '',
            'mensaje', v_mensaje,
            'exito', false
        );
    END IF;
    
    -- Verificar que la fecha actual sea la fecha de validez
    IF NOT EXISTS (
        SELECT 1 FROM public."qrGenerados"
        WHERE "idQR" = v_id_qr
        AND "fechaValidez" = v_fecha_actual
    ) THEN
        v_mensaje := 'Código no válido para la fecha actual (' || to_char(v_fecha_actual, 'DD/MM/YYYY') || ')';
        RETURN jsonb_build_object(
            'status', 0,
            'nombre', '',
            'placas', '',
            'tipo_vehiculo', '',
            'urlIdentificacion', '',
            'mensaje', v_mensaje,
            'exito', false
        );
    END IF;
    
    -- Obtener datos del visitante
    SELECT "nomVisitante", "placasVehiculo", "tipoVehiculo", "urlIdentificacion"
    INTO v_nombre_visitante, v_placas_vehiculo, v_tipo_vehiculo, v_url_identificacion
    FROM public."datosVisitantes"
    WHERE "idVisitante" = v_id_visitante;
    
    -- Caso 1: Primera vez que se usa (ambas fechas nulas) - Registrar entrada
    IF v_fec_entrada IS NULL AND v_fec_salida IS NULL THEN
        UPDATE public."qrGenerados"
        SET "fecEntrada" = v_hora_actual,
            "usos" = COALESCE("usos", 0) + 1
        WHERE "idQR" = v_id_qr;
        
        v_status := 1; -- Entrada registrada
        v_mensaje := 'Entrada registrada exitosamente a las ' || to_char(v_hora_actual AT TIME ZONE 'America/Mexico_City', 'HH24:MI:SS');
        
    -- Caso 2: Ya tiene entrada pero no salida - Validar tiempo mínimo antes de registrar salida
    ELSIF v_fec_entrada IS NOT NULL AND v_fec_salida IS NULL THEN
        -- Validar que hayan pasado al menos 5 minutos desde la entrada
        IF (v_hora_actual - v_fec_entrada) < INTERVAL '5 minutes' THEN
            v_status := 3; -- Tiempo mínimo no cumplido
            v_minutos_restantes := 5 - EXTRACT(MINUTE FROM (v_hora_actual - v_fec_entrada));
            v_mensaje := 'Debe esperar al menos 5 minutos para registrar la salida. Tiempo restante: ' ||
                        CEIL(v_minutos_restantes) || ' minutos';
        ELSE
            UPDATE public."qrGenerados"
            SET "fecSalida" = v_hora_actual,
                "usos" = COALESCE("usos", 0) + 1,
                "status" = false, -- Código ya no es válido
                "vigencia" = false
            WHERE "idQR" = v_id_qr;
            
            v_status := 2; -- Salida registrada
            v_mensaje := 'Salida registrada exitosamente a las ' || to_char(v_hora_actual AT TIME ZONE 'America/Mexico_City', 'HH24:MI:SS');
        END IF;
        
    -- Caso 3: Ambas fechas tienen valor - Código ya utilizado completamente
    ELSIF v_fec_entrada IS NOT NULL AND v_fec_salida IS NOT NULL THEN
        v_status := 4; -- Código ya utilizado
        v_mensaje := 'Código ya fue utilizado completamente (entrada: ' || to_char(v_fec_entrada AT TIME ZONE 'America/Mexico_City', 'DD/MM/YYYY HH24:MI') || ', salida: ' || to_char(v_fec_salida AT TIME ZONE 'America/Mexico_City', 'DD/MM/YYYY HH24:MI') || ')';
        
    END IF;
    
    -- Construir resultado JSON
    v_resultado := jsonb_build_object(
        'status', v_status,
        'nombre', COALESCE(v_nombre_visitante, ''),
        'placas', COALESCE(v_placas_vehiculo, ''),
        'tipo_vehiculo', COALESCE(v_tipo_vehiculo, ''),
        'urlIdentificacion', COALESCE(v_url_identificacion, ''),
        'mensaje', v_mensaje,
        'hora_registro', to_char(v_hora_actual AT TIME ZONE 'America/Mexico_City', 'DD/MM/YYYY HH24:MI:SS')
    );
    
    RETURN v_resultado;
    
EXCEPTION
    WHEN OTHERS THEN
        -- En caso de error, retornar estado 0
        RETURN jsonb_build_object(
            'status', 0,
            'nombre', '',
            'placas', '',
            'tipo_vehiculo', '',
            'urlIdentificacion', '',
            'mensaje', 'Error al procesar la solicitud',
            'exito', false
        );
END;
$BODY$;