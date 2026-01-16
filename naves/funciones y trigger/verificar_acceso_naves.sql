--[Fecha y Hora]: 18/10/2025 20:49:00
-- [Descripción]: Función para verificar si un usuario puede acceder a la tabla naves
--                con la política RLS actual.
--
-- [Uso]: SELECT * FROM verificar_acceso_naves();
-- [Ejemplo]: SELECT * FROM verificar_acceso_naves() WHERE uid_usuario = 'uuid-del-usuario';

CREATE OR REPLACE FUNCTION public.verificar_acceso_naves()
RETURNS TABLE(
    uid_usuario uuid,
    esta_autenticado boolean,
    usuario_activo boolean,
    total_naves_visibles integer,
    politica_rls_activa boolean
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_uid uuid;
    v_usuario_activo boolean;
    v_total_naves integer;
    v_politica_activa boolean;
BEGIN
    -- Obtener UID del usuario actual
    v_uid := auth.uid();
    
    -- Verificar si el usuario está activo
    SELECT EXISTS(SELECT 1 FROM "catUsers" WHERE uid = v_uid AND status = true) INTO v_usuario_activo;
    
    -- Intentar contar naves visibles
    BEGIN
        SELECT COUNT(*) INTO v_total_naves FROM naves;
        v_politica_activa := true;
    EXCEPTION WHEN OTHERS THEN
        v_total_naves := 0;
        v_politica_activa := false;
    END;
    
    -- Verificar si hay políticas RLS activas
    SELECT EXISTS(SELECT 1 FROM pg_policies WHERE tablename = 'naves') INTO v_politica_activa;
    
    -- Retornar resultados
    RETURN QUERY
    SELECT 
        v_uid as uid_usuario,
        (v_uid IS NOT NULL) as esta_autenticado,
        v_usuario_activo as usuario_activo,
        v_total_naves as total_naves_visibles,
        v_politica_activa as politica_rls_activa;
    
END;
$$;