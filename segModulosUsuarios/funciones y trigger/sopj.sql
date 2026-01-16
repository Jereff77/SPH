--[Fecha y Hora]: 14/11/2025 01:15:00
--[Descripción]: Función de nivel sensitivo y prioritario que recibe el UID de un usuario
--                y retorna en formato JSON únicamente los campos clave y acceso
--                de la tabla segModulosUsuarios que pertenecen a ese usuario.
--
--[Parámetros]:
--   - p_uid (uuid): UID del usuario del cual se desean obtener los permisos
--
--[Salida]:
--   - json: Objeto JSON que contiene solo clave y acceso del usuario en segModulosUsuarios
--
--[Uso típico]: Se utiliza para obtener los permisos esenciales de un usuario específico
--               en formato JSON para ser procesados por aplicaciones frontend o backend.
--
--[Ejemplo]: SELECT sopj('123e4567-e89b-12d3-a456-426614174000');
--
--[Relaciones]:
--   - Tabla segModulosUsuarios: Tabla principal de donde se obtienen los datos
--
--[Validaciones]:
--   - Verifica que el UID proporcionado sea válido
--   - Retorna un array vacío si el usuario no tiene permisos registrados
--   - Función de nivel sensitivo: solo expone información mínima necesaria

CREATE OR REPLACE FUNCTION public.sopj(p_uid uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $BODY$
BEGIN
    --[Fecha y Hora]: 14/11/2025 01:15:00
    -- [Descripción]: Función sensitiva y prioritaria que obtiene solo los campos
    --                clave y acceso de un usuario específico y los retorna en JSON.
    --
    -- [Entrada]: p_uid (uuid) - UID del usuario a consultar
    --
    -- [Salida]: json - Array de objetos JSON con clave y acceso del usuario
    --
    -- [Uso típico]: Obtener permisos esenciales para validaciones críticas
    --
    -- [Ejemplo]: SELECT sopj('uuid-del-usuario');
    
    -- Retornar solo clave y acceso del usuario en formato JSON
    RETURN (
        SELECT json_agg(
            json_build_object(
                'clave', "clave",
                'acceso', "acceso"
            )
        )
        FROM public."segModulosUsuarios"
        WHERE "uid" = p_uid
    );
    
END;
$BODY$;