--[Descripción]: Valida si un usuario puede ser insertado en catUsers basado en invitación válida
-- [Módulo]: Sistema de Invitaciones - Validación de Registro
-- [Entrada]: p_email (email del usuario), p_id_invitacion (UUID de la invitación)
-- [Salida]: boolean - true si puede insertar, false si no
-- [Uso típico]: Se ejecuta en política RLS para validar antes de INSERT
-- [Trigger]: Se usa en política catUsers_insert_invitation_required
-- [Ejemplo]: SELECT catUsers_validar_insercion('juan@empresa.com', 'uuid-invitacion') → true/false

CREATE OR REPLACE FUNCTION public.catusers_validar_insercion(p_email text, p_id_invitacion uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $BODY$
DECLARE
    invitacion_valida boolean := false;
BEGIN
    -- [Descripción]: Valida si un usuario puede ser insertado en catUsers basado en invitación válida
    -- [Módulo]: Sistema de Invitaciones - Validación de Registro
    -- [Entrada]: p_email (email del usuario), p_id_invitacion (UUID de la invitación)
    -- [Salida]: boolean - true si puede insertar, false si no
    -- [Uso típico]: Se ejecuta en política RLS para validar antes de INSERT
    -- [Trigger]: Se usa en política catUsers_insert_invitation_required
    -- [Ejemplo]: SELECT catUsers_validar_insercion('juan@empresa.com', 'uuid-invitacion') → true/false
    
    -- Verificar si existe invitación válida
    SELECT EXISTS (
        SELECT 1 
        FROM invitaciones i
        WHERE i."idInvitaciones" = p_id_invitacion
        AND i.correo = p_email
        AND i.status = true
        AND COALESCE(i."fechaExpiracion", CURRENT_TIMESTAMP + INTERVAL '1 day') > CURRENT_TIMESTAMP
        AND i."fechaUso" IS NULL
    ) INTO invitacion_valida;
    
    -- Log para debugging (opcional - solo en desarrollo)
    IF NOT invitacion_valida THEN
        RAISE NOTICE 'Validación fallida para email: %, invitación: %', p_email, p_id_invitacion;
    END IF;
    
    RETURN invitacion_valida;
END;
$BODY$;