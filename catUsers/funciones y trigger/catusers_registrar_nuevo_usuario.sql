--[Fecha y Hora]: 18/10/2025 16:52:00
--[Descripción]: Función para registrar nuevos usuarios en la tabla catUsers
--                con validaciones de seguridad y prevención de inyección SQL
--
--[Parámetros]:
--   - p_nombre (text): Nombre del usuario
--   - p_apellidos (text): Apellidos del usuario
--   - p_email (text): Correo electrónico del usuario
--   - p_telefono (text): Teléfono del usuario (opcional)
--   - p_idEmpresa (uuid): ID de la empresa a la que pertenece
--   - p_idPerfil (uuid): ID del perfil asignado al usuario
--   - p_idInvitacion (uuid): ID de la invitación utilizada (opcional)
--   - p_parques (jsonb): Parques asignados al usuario (opcional)
--
--[Salida]:
--   - uuid: ID del usuario registrado o NULL si falló
--
--[Uso típico]: Se utiliza para crear nuevos usuarios validando que el email exista
--               en auth.users y obteniendo el UID correspondiente
--
--[Ejemplo]: SELECT catusers_registrar_nuevo_usuario(
--              'Juan', 'Pérez López', 'juan@empresa.com', '5512345678',
--              'uuid-empresa', 'uuid-perfil', 'uuid-invitacion',
--              '{"Parques": [{"idParque": "zSUaGepAnurv"}, {"idParque": "58aNnTfmX4Sz"}]}'::jsonb
--           );
--
--[Relaciones]: 
--   - Tablas relacionadas: auth.users, catUsers, empresas, catPerfiles, invitaciones
--
--[Validaciones]:
--   - Validación de email en auth.users
--   - Validación de formato de email
--   - Validación de existencia de empresa y perfil
--   - Validación de invitación (si se proporciona)
--   - Prevención de inyección SQL con parámetros tipados

CREATE OR REPLACE FUNCTION public.catusers_registrar_nuevo_usuario(
    p_nombre text,
    p_apellidos text,
    p_email text,
    p_idEmpresa uuid,
    p_idPerfil uuid,
    p_telefono text DEFAULT NULL,
    p_idInvitacion uuid DEFAULT NULL,
    p_parques jsonb DEFAULT NULL
)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $BODY$
DECLARE
    v_uid uuid;
    v_idInvitacion_uuid uuid;
    v_email_lower text;
    v_nombre_empresa text;
    v_nombre_perfil text;
    v_resultado uuid;
BEGIN
    --[Fecha y Hora]: 18/10/2025 16:52:00
    -- [Descripción]: Función para registrar nuevos usuarios en la tabla catUsers
    --                con validaciones de seguridad y prevención de inyección SQL
    --
    -- [Parámetros]:
    --   - p_nombre (text): Nombre del usuario
    --   - p_apellidos (text): Apellidos del usuario
    --   - p_email (text): Correo electrónico del usuario
    --   - p_telefono (text): Teléfono del usuario (opcional)
    --   - p_idEmpresa (uuid): ID de la empresa a la que pertenece
    --   - p_idPerfil (uuid): ID del perfil asignado al usuario
    --   - p_idInvitacion (uuid): ID de la invitación utilizada (opcional)
    --   - p_parques (jsonb): Parques asignados al usuario (opcional)
    --
    -- [Salida]:
    --   - uuid: ID del usuario registrado o NULL si falló
    --
    -- [Uso típico]: Se utiliza para crear nuevos usuarios validando que el email exista
    --               en auth.users y obteniendo el UID correspondiente
    --
    -- [Ejemplo]: SELECT catusers_registrar_nuevo_usuario(
    --              'Juan', 'Pérez López', 'juan@empresa.com', '5512345678',
    --              'uuid-empresa', 'uuid-perfil', 'uuid-invitacion',
    --              '{"Parques": [{"idParque": "zSUaGepAnurv"}, {"idParque": "58aNnTfmX4Sz"}]}'::jsonb
    --           );
    --
    -- [Relaciones]: 
    --   - Tablas relacionadas: auth.users, catUsers, empresas, catPerfiles, invitaciones
    --
    -- [Validaciones]:
    --   - Validación de email en auth.users
    --   - Validación de formato de email
    --   - Validación de existencia de empresa y perfil
    --   - Validación de invitación (si se proporciona)
    --   - Prevención de inyección SQL con parámetros tipados
    
    -- Validar que los parámetros obligatorios no sean nulos
    IF p_nombre IS NULL OR TRIM(p_nombre) = '' THEN
        RAISE EXCEPTION 'El nombre es obligatorio';
    END IF;
    
    IF p_apellidos IS NULL OR TRIM(p_apellidos) = '' THEN
        RAISE EXCEPTION 'Los apellidos son obligatorios';
    END IF;
    
    IF p_email IS NULL OR TRIM(p_email) = '' THEN
        RAISE EXCEPTION 'El email es obligatorio';
    END IF;
    
    -- Convertir 'null' (texto) a NULL real y validar
    IF p_idEmpresa IS NULL OR LOWER(TRIM(p_idEmpresa)) = 'null' THEN
        RAISE EXCEPTION 'El ID de empresa es obligatorio';
    END IF;
    
    -- Convertir a UUID si no es NULL
    IF p_idEmpresa IS NOT NULL THEN
        v_idEmpresa_uuid := p_idEmpresa::uuid;
    END IF;
    
    IF p_idPerfil IS NULL THEN
        RAISE EXCEPTION 'El ID de perfil es obligatorio';
    END IF;
    
    -- Normalizar email a minúsculas para comparación
    v_email_lower := LOWER(TRIM(p_email));
    
    -- Validar formato básico de email usando regex
    IF v_email_lower !~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$' THEN
        RAISE EXCEPTION 'El formato del email no es válido: %', p_email;
    END IF;
    
    -- Verificar que el email exista en auth.users y obtener el UID
    SELECT id INTO v_uid
    FROM auth.users
    WHERE LOWER(email) = v_email_lower
    AND deleted_at IS NULL  -- Usuario no eliminado
    LIMIT 1;
    
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'El email % no existe en auth.users o el usuario ha sido eliminado', p_email;
    END IF;
    
    -- Verificar que el usuario no exista ya en catUsers
    IF EXISTS (
        SELECT 1 FROM public."catUsers" 
        WHERE "uid" = v_uid
    ) THEN
        RAISE EXCEPTION 'El usuario con email % ya está registrado en catUsers', p_email;
    END IF;
    
    -- Validar que la empresa exista y esté activa
    IF NOT EXISTS (
        SELECT 1 FROM public."empresas"
        WHERE "idEmpresa" = v_idEmpresa_uuid
        AND status = true
    ) THEN
        RAISE EXCEPTION 'La empresa especificada no existe o no está activa';
    END IF;
    
    -- Validar que el perfil exista
    IF NOT EXISTS (
        SELECT 1 FROM public."catPerfiles" 
        WHERE "idPerfil" = p_idPerfil
    ) THEN
        RAISE EXCEPTION 'El perfil especificado no existe';
    END IF;
    
    -- Validar invitación si se proporciona
    IF p_idInvitacion IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public."invitaciones" 
            WHERE "idInvitaciones" = p_idInvitacion
            AND correo = v_email_lower
            AND status = true
            AND COALESCE("fechaExpiracion", CURRENT_TIMESTAMP + INTERVAL '1 day') > CURRENT_TIMESTAMP
            AND "fechaUso" IS NULL
        ) THEN
            RAISE EXCEPTION 'La invitación especificada no es válida o ha expirado';
        END IF;
    END IF;
    
    -- Obtener nombres para log (opcional)
    SELECT "nombreEmpresa" INTO v_nombre_empresa
    FROM public."empresas"
    WHERE "idEmpresa" = v_idEmpresa_uuid;
    
    SELECT nombre INTO v_nombre_perfil
    FROM public."catPerfiles"
    WHERE "idPerfil" = p_idPerfil;
    
    -- Insertar el nuevo usuario en catUsers
    INSERT INTO public."catUsers" (
        "uid",
        "nombre",
        "apellidos",
        "email",
        "telefono",
        "idEmpresa",
        "idPerfil",
        "idInvitacion",
        "parques",
        "status",
        "accesos"
    ) VALUES (
        v_uid,
        TRIM(p_nombre),
        TRIM(p_apellidos),
        v_email_lower,
        p_telefono,
        v_idEmpresa_uuid,
        p_idPerfil,
        p_idInvitacion,
        p_parques,
        true,  -- status activo por defecto
        true   -- accesos activos por defecto
    )
    RETURNING "uid" INTO v_resultado;
    
    -- Si se usó una invitación, marcarla como usada (status = false)
    IF p_idInvitacion IS NOT NULL THEN
        UPDATE public."invitaciones"
        SET
            status = false,
            "fechaUso" = CURRENT_TIMESTAMP,
            "uidUsuarioCreado" = v_resultado,
            "emailUsuarioCreado" = v_email_lower,
            "comentarios" = COALESCE("comentarios", '') || ' | Invitación utilizada el ' || CURRENT_TIMESTAMP || ' para registrar usuario con UID: ' || v_resultado,
            "motivoCierre" = 'USADO'
        WHERE "idInvitaciones" = p_idInvitacion;
        
        RAISE NOTICE 'Invitación % marcada como usada para usuario %', p_idInvitacion, p_email;
    END IF;
    
    -- Log de éxito (opcional)
    RAISE NOTICE 'Usuario % registrado exitosamente con UID: %', p_email, v_resultado;
    RAISE NOTICE 'Empresa: %, Perfil: %', COALESCE(v_nombre_empresa, 'N/A'), COALESCE(v_nombre_perfil, 'N/A');
    
    RETURN 'SUCCESS: Usuario registrado con UID: ' || v_resultado;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN 'ERROR: ' || SQLERRM;
END;
$BODY$;