--[Fecha y Hora]: 18/10/2025 20:23:00
-- [Descripción]: Función de diagnóstico para identificar problemas con la política RLS
--                de la tabla naves y los datos de parques en catUsers.
--
-- [Uso]: Ejecutar para diagnosticar problemas de acceso a la tabla naves
-- [Ejemplo]: SELECT * FROM diagnosticar_politica_rls();

CREATE OR REPLACE FUNCTION public.diagnosticar_politica_rls()
RETURNS TABLE(
    uid_usuario uuid,
    esta_autenticado boolean,
    usuario_existe boolean,
    usuario_activo boolean,
    parques_asignados jsonb,
    tipo_dato_parques text,
    parques_es_array boolean,
    total_parques integer,
    ejemplo_parque text,
    naves_visibles integer
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_uid uuid;
    v_parques jsonb;
    v_usuario_existe boolean;
    v_usuario_activo boolean;
    v_naves_visibles integer;
BEGIN
    -- Obtener UID del usuario actual
    v_uid := auth.uid();
    
    -- Verificar si el usuario existe en catUsers
    SELECT EXISTS(SELECT 1 FROM "catUsers" WHERE uid = v_uid) INTO v_usuario_existe;
    
    -- Verificar si el usuario está activo
    SELECT EXISTS(SELECT 1 FROM "catUsers" WHERE uid = v_uid AND status = true) INTO v_usuario_activo;
    
    -- Obtener parques asignados
    SELECT parques INTO v_parques FROM "catUsers" WHERE uid = v_uid AND status = true;
    
    -- Contar naves visibles con política actual
    PERFORM 1 FROM naves LIMIT 1;
    GET DIAGNOSTICS v_naves_visibles = ROW_COUNT;
    
    -- Obtener ejemplo de parque si es un array
    DECLARE
        v_ejemplo_parque text;
        v_total_parques integer;
    BEGIN
        IF jsonb_typeof(v_parques) = 'array' THEN
            v_total_parques := jsonb_array_length(v_parques);
            SELECT value::text INTO v_ejemplo_parque
            FROM jsonb_array_elements_text(v_parques) LIMIT 1;
        ELSE
            v_total_parques := 0;
            v_ejemplo_parque := NULL;
        END IF;
        
        -- Retornar información de diagnóstico
        RETURN QUERY
        SELECT
            v_uid as uid_usuario,
            (v_uid IS NOT NULL) as esta_autenticado,
            v_usuario_existe as usuario_existe,
            v_usuario_activo as usuario_activo,
            v_parques as parques_asignados,
            jsonb_typeof(v_parques) as tipo_dato_parques,
            jsonb_typeof(v_parques) = 'array' as parques_es_array,
            v_total_parques as total_parques,
            v_ejemplo_parque as ejemplo_parque,
            v_naves_visibles as naves_visibles;
    END;
    
END;
$$;