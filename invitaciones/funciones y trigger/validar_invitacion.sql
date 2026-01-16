--[Descripción]: Función para validar invitaciones y retornar información completa
-- [Módulo]: Sistema de Invitaciones - Validación
--
-- [Entrada]: p_id_ext (text): ID externo único de la invitación (15 caracteres)
--
-- [Salida]: json - Objeto con datos completos de la invitación y validaciones:
--   - Datos de la invitación (idInvitaciones, uidr, idExt, fc, status, etc.)
--   - Datos del perfil asociado (nombre, nivel, descripción)
--   - Validaciones (esValida, mensajeValidacion)
--
-- [Uso típico]: Validar invitación antes de permitir registro de usuario
-- [Ejemplo]: SELECT validar_invitacion('ABC1234567890')
--
-- [Validaciones realizadas]:
--   - status = false → Invitación inactiva
--   - fechaUso IS NOT NULL → Invitación ya utilizada
--   - fechaExpiracion < NOW() → Invitación expirada
--   - Si todas pasan → Invitación válida
--
-- [Seguridad]: SECURITY DEFINER con search_path = 'public'

CREATE OR REPLACE FUNCTION public.validar_invitacion(p_id_ext text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $BODY$
DECLARE
    resultado JSON;
BEGIN
    SELECT json_build_object(
        -- Campos de invitaciones
        'idInvitaciones', i."idInvitaciones",
        'uidr', i.uidr,
        'idExt', i."idExt",
        'fc', i.fc,
        'status', i.status,
        'nombre', i.nombre,
        'idPerfil', i."idPerfil",
        'correo', i.correo,
        'fechaExpiracion', i."fechaExpiracion",
        'fechaUso', i."fechaUso",
        'uidUsuarioCreado', i."uidUsuarioCreado",
        'emailUsuarioCreado', i."emailUsuarioCreado",
        'comentarios', i.comentarios,
        'motivoCierre', i."motivoCierre",
        'idEmpresa', i."idEmpresa",
        'parques', i.parques,
        
        -- Datos del perfil
        'perfil', json_build_object(
            'nombre', cp.nombre,
            'nivel', cp.nivel,
            'descripcion', cp.descripcion
        ),
        
        -- Validaciones
        'esValida', CASE 
            WHEN i.status = FALSE THEN FALSE
            WHEN i."fechaUso" IS NOT NULL THEN FALSE
            WHEN i."fechaExpiracion" < NOW() THEN FALSE
            ELSE TRUE
        END,
        
        'mensajeValidacion', CASE 
            WHEN i.status = FALSE THEN 'Invitación inactiva'
            WHEN i."fechaUso" IS NOT NULL THEN 'Invitación ya utilizada'
            WHEN i."fechaExpiracion" < NOW() THEN 'Invitación expirada'
            ELSE 'Invitación válida'
        END
    )
    INTO resultado
    FROM public.invitaciones i
    JOIN public."catPerfiles" cp ON i."idPerfil" = cp."idPerfil"
    WHERE i."idExt" = p_id_ext;
    
    RETURN resultado;
END;
$BODY$;