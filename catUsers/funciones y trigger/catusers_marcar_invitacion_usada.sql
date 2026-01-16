--[Descripción]: Marca una invitación como usada (status=false) cuando se crea un usuario en catUsers
-- [Módulo]: Sistema de Invitaciones - Control de Registro
-- [Entrada]: NEW record de catUsers con campo idInvitacion
-- [Salida]: Actualiza registro en tabla invitaciones
-- [Uso típico]: Se ejecuta automáticamente después de INSERT en catUsers para marcar invitación como consumida
-- [Trigger]: trigger_catUsers_marcar_invitacion_usada
-- [Ejemplo]: INSERT catUsers con idInvitacion='uuid-inv' → UPDATE invitaciones SET status=false WHERE idInvitaciones='uuid-inv'

CREATE OR REPLACE FUNCTION public.catusers_marcar_invitacion_usada()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $BODY$
BEGIN
    -- [Descripción]: Marca una invitación como usada (status=false) cuando se crea un usuario en catUsers
    -- [Módulo]: Sistema de Invitaciones - Control de Registro
    -- [Entrada]: NEW record de catUsers con campo idInvitacion
    -- [Salida]: Actualiza registro en tabla invitaciones
    -- [Uso típico]: Se ejecuta automáticamente después de INSERT en catUsers para marcar invitación como consumida
    -- [Trigger]: trigger_catUsers_marcar_invitacion_usada
    -- [Ejemplo]: INSERT catUsers con idInvitacion='uuid-inv' → UPDATE invitaciones SET status=false WHERE idInvitaciones='uuid-inv'
    
    -- Solo procesar si hay un idInvitacion válido
    IF NEW."idInvitacion" IS NOT NULL THEN
        UPDATE invitaciones 
        SET 
            status = false,
            "fechaUso" = CURRENT_TIMESTAMP,
            "uidUsuarioCreado" = NEW.uid,
            "emailUsuarioCreado" = NEW.email,
            comentarios = COALESCE(comentarios, '') || 
                         CASE 
                             WHEN comentarios IS NULL OR comentarios = '' THEN 'Usuario registrado exitosamente'
                             ELSE '; Usuario registrado exitosamente'
                         END
        WHERE "idInvitaciones" = NEW."idInvitacion"
        AND status = true; -- Solo actualizar si está activa
        
        -- Log para debugging (opcional)
        IF NOT FOUND THEN
            RAISE NOTICE 'No se encontró invitación activa con ID: %', NEW."idInvitacion";
        END IF;
    END IF;
    
    RETURN NEW;
END;
$BODY$;