--[Descripción]: Valida si usuario tiene permiso activo para una clave específica
-- [Módulo]: Seguridad - Validación de permisos
--
-- [Entrada]: 
--   - p_uid (uuid): ID del usuario a validar
--   - p_clave (smallint): Clave numérica del módulo/permiso
--
-- [Salida]: boolean - true si tiene permiso, false si no
--
-- [Uso típico]: Validar acceso antes de mostrar funcionalidades
-- [Ejemplo]: SELECT validar_permiso_usuario('uuid-user', 101) → true/false
--
-- [Validaciones realizadas]:
--   - Usuario debe existir y estar activo (status = true)
--   - Usuario debe tener accesos habilitados (accesos = true)
--   - Módulo debe existir y estar activo (status = true)
--   - Usuario debe tener acceso explícito al módulo (acceso = true)
--
-- [Relaciones]: catUsers → segModulosUsuarios → segModulos

CREATE OR REPLACE FUNCTION public.validar_permiso_usuario(p_uid uuid, p_clave smallint)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
AS $BODY$
BEGIN
    -- [Descripción]: Valida si usuario tiene permiso activo para una clave específica
    -- [Módulo]: Seguridad - Validación de permisos
    -- [Entrada]: p_uid (usuario), p_clave (clave del módulo)
    -- [Salida]: true si tiene permiso, false si no
    -- [Uso típico]: Validar acceso antes de mostrar funcionalidades
    -- [Ejemplo]: validar_permiso_usuario('uuid-user', 101) -> true/false
    
    RETURN EXISTS (
        SELECT 1 
        FROM "catUsers" cu
        JOIN "segModulosUsuarios" smu ON smu."idUser" = cu.uid
        JOIN "segModulos" sm ON sm."idSM" = smu."idSM"
        WHERE cu.uid = p_uid
        AND cu.status = true
        AND cu.accesos = true
        AND sm.clave = p_clave
        AND sm.status = true
        AND smu.acceso = true
    );
END;
$BODY$;