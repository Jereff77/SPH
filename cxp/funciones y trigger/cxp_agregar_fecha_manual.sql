--[Fecha y Hora]: 29/10/2025 23:09:15
--[Descripción]: Agrega una fecha específica a las fechas habilitadas con auditoría del usuario
--
--[Parámetros]:
--   - p_fecha (date): Fecha a agregar al calendario de fechas habilitadas
--   - p_uid_usuario (uuid): UID del usuario que realiza la acción
--
--[Salida]:
--   - jsonb: Objeto JSON con estructura estándar {exito, codigo, mensaje, detalles}
--
--[Uso típico]: Se utiliza para agregar manualmente fechas específicas que estarán habilitadas
--               para el procesamiento de CXP, como días festivos o fechas especiales
--
--[Ejemplo]: SELECT cxp_agregar_fecha_manual('2024-12-25', '123e4567-e89b-12d3-a456-426614174000');
--
--[Relaciones]: 
--   - Tabla: cxp_fechas_habilitadas
--   - Tabla: catUsers (para validación de usuario)
--
--[Validaciones]:
--   - Verifica que la fecha no sea nula
--   - Verifica que el UID del usuario no sea nulo
--   - Valida que el usuario exista en catUsers
--   - Comprueba que la fecha no esté previamente habilitada
--
--[Códigos de respuesta]:
--   - EXITO: Fecha agregada correctamente
--   - PARAMETRO_INVALIDO: Parámetros nulos o inválidos
--   - FECHA_YA_EXISTE: La fecha ya está habilitada
--   - USUARIO_NO_EXISTE: El usuario especificado no existe
--   - ERROR_BASE_DATOS: Error en la base de datos
--
--[Auditoría]: Registra quién y cuándo agregó la fecha en la tabla cxp_fechas_habilitadas

CREATE OR REPLACE FUNCTION public.cxp_agregar_fecha_manual(p_fecha date, p_uid_usuario uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $function$
BEGIN
    -- [Fecha y Hora]: 29/10/2025 23:09:15
    -- [Descripción]: Agrega una fecha específica a las fechas habilitadas con auditoría del usuario
    -- [Parámetros]: p_fecha (DATE) - Fecha a agregar, p_uid_usuario (UUID) - Usuario que agrega
    -- [Salida]: JSONB con estructura estándar {exito, codigo, mensaje, detalles}
    -- [Uso]: SELECT cxp_agregar_fecha_manual('2024-12-25', 'uuid-del-usuario');
    -- [Códigos]: EXITO, PARAMETRO_INVALIDO, FECHA_YA_EXISTE, USUARIO_NO_EXISTE
    -- [Auditoría]: Registra quién y cuándo agregó la fecha
    
    -- Validar parámetros
    IF p_fecha IS NULL THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PARAMETRO_INVALIDO',
            'mensaje', 'La fecha es requerida'
        );
    END IF;
    
    IF p_uid_usuario IS NULL THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PARAMETRO_INVALIDO',
            'mensaje', 'El UID del usuario es requerido'
        );
    END IF;
    
    -- Validar que el usuario exista
    IF NOT EXISTS (SELECT 1 FROM public."catUsers" WHERE uid = p_uid_usuario) THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'USUARIO_NO_EXISTE',
            'mensaje', 'El usuario especificado no existe'
        );
    END IF;
    
    -- Verificar si la fecha ya existe
    IF EXISTS (SELECT 1 FROM public.cxp_fechas_habilitadas WHERE fecha = p_fecha) THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'FECHA_YA_EXISTE',
            'mensaje', 'La fecha ' || p_fecha || ' ya está habilitada'
        );
    END IF;
    
    -- Insertar la fecha
    INSERT INTO public.cxp_fechas_habilitadas (fecha, created_by, created_at) 
    VALUES (p_fecha, p_uid_usuario, NOW());
    
    RETURN jsonb_build_object(
        'exito', true,
        'codigo', 'EXITO',
        'mensaje', 'Fecha ' || p_fecha || ' agregada exitosamente',
        'detalles', jsonb_build_object(
            'fecha', p_fecha,
            'dia_semana', TO_CHAR(p_fecha, 'Day'),
            'mes', EXTRACT(MONTH FROM p_fecha),
            'anio', EXTRACT(YEAR FROM p_fecha),
            'created_by', p_uid_usuario,
            'created_at', NOW()
        )
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'ERROR_BASE_DATOS',
            'mensaje', 'Error al agregar fecha: ' || SQLERRM,
            'detalles', jsonb_build_object('sqlstate', SQLSTATE)
        );
END;
$function$;