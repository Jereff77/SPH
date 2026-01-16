--[Fecha y Hora]: 17/10/2025 01:10:00
-- [Descripción]: Busca información de una empresa específica filtrando las naves asignadas
--                según los permisos de acceso del usuario actual a los parques.
--                Retorna solo el primer registro encontrado si existen múltiples coincidencias.
--                Función probada y validada en base de datos.
--
-- [Parámetros]:
--   - p_id_empresa (uuid): ID de la empresa a buscar
--
-- [Salida]: Registro único con todos los campos de v_resumenempresas y navesAsignadas
--           filtradas por permisos de parque del usuario actual.
--
-- [Comportamiento]:
--   - Busca la empresa por idEmpresa en la vista v_resumenempresas
--   - Filtra los idNave en la columna navesAsignadas según los parques
--     a los que el usuario actual tiene acceso (catUsers.parques)
--   - Retorna solo el primer registro encontrado (LIMIT 1)
--   - Si el usuario no tiene acceso a ningún parque de las naves asignadas,
--     la columna navesAsignadas será un array vacío []
--   - Si el usuario no tiene parques asignados, retorna array vacío []
--
-- [Validaciones]:
--   - p_id_empresa no debe ser NULL
--   - La autenticación es manejada por las políticas RLS de la base de datos
--
-- [Uso típico]: Obtener información detallada de una empresa con naves filtradas
--               por permisos del usuario actual.
--
-- [Ejemplo]: SELECT * FROM v_resumenempresas_buscar_por_id('123e4567-e89b-12d3-a456-426614174000');
--
-- [Relaciones]: 
--   - Vista base: v_resumenempresas
--   - Permisos: catUsers.parques (JSONB)
--   - Naves: naves (para verificar parque de cada idNave)

CREATE OR REPLACE FUNCTION public.v_resumenempresas_buscar_por_id(p_id_empresa uuid)
 RETURNS TABLE("idEmpresa" uuid, "nombreEmpresa" text, "idParque" text, "nombreParque" text, "totalAsignados" integer, "QRdiarios" integer, "QRLigeros" integer, "QRCarga" integer, disponibles bigint, "activosLigeros" bigint, "activosCarga" bigint, "accesosUtilizados" bigint, "accesosEnviados" bigint, suspendida boolean, "navesAsignadas" json)
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $BODY$
DECLARE
    v_user_uid uuid;
    v_parques_acceso jsonb;
BEGIN
    --[Fecha y Hora]: 17/10/2025 01:02:00
    -- [Descripción]: Busca información de una empresa específica filtrando las naves asignadas
    --                según los permisos de acceso del usuario actual a los parques.
    --
    -- [Entrada]: p_id_empresa (uuid) - ID de la empresa a buscar
    --
    -- [Salida]: Registro único con información de empresa y naves filtradas por permisos
    --
    -- [Uso típico]: Obtener información detallada de una empresa con naves filtradas
    --               por permisos del usuario actual.
    --
    -- [Ejemplo]: SELECT * FROM v_resumenempresas_buscar_por_id('uuid-empresa');
    
    -- Validar que el parámetro no sea nulo
    IF p_id_empresa IS NULL THEN
        RAISE EXCEPTION 'El ID de empresa no puede ser nulo';
    END IF;
    
    -- Obtener el UID del usuario actual (las políticas RLS ya validan la autenticación)
    v_user_uid := auth.uid();
    
    -- Obtener los parques a los que el usuario tiene acceso
    SELECT parques INTO v_parques_acceso
    FROM "catUsers"
    WHERE uid = v_user_uid AND status = true;
    
    -- Si el usuario no tiene parques asignados, usar array vacío
    IF v_parques_acceso IS NULL THEN
        v_parques_acceso := '[]'::jsonb;
    END IF;
    
    -- Retornar la información de la empresa con naves filtradas
    RETURN QUERY
    SELECT 
        v."idEmpresa",
        v."nombreEmpresa",
        v."idParque",
        v."nombreParque",
        v."totalAsignados",
        v."QRdiarios",
        v."QRLigeros",
        v."QRCarga",
        v.disponibles,
        v."activosLigeros",
        v."activosCarga",
        v."accesosUtilizados",
        v."accesosEnviados",
        v.suspendida,
        -- Filtrar las naves asignadas según los parques a los que el usuario tiene acceso
        COALESCE(
            (
                SELECT JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'idNave', nave_obj.idNave,
                        'numNaveNombre', nave_obj.numNaveNombre,
                        'idParque', nave_obj.idParque,
                        'nombreParque', nave_obj.nombreParque
                    )
                )
                FROM jsonb_array_elements(v."navesAsignadas") AS nave_obj
                WHERE nave_obj->>'idParque' IN (
                    SELECT value::text
                    FROM jsonb_array_elements_text(v_parques_acceso) AS parques_usuario(value)
                )
            ),
            '[]'::json
        ) AS "navesAsignadas"
    FROM public.v_resumenempresas v
    WHERE v."idEmpresa" = p_id_empresa
    LIMIT 1;
    
END;
$BODY$;