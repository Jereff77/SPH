--[Fecha y Hora]: 17/12/2025 16:41:00
--[Descripción]: Función que obtiene los campos idNavArrend, comSPH y idRtaA 
--                para una propiedad específica mediante joins entre raPdp, propiedades y arrenPropiedades.
--
--[Parámetros]:
--   - p_idpropiedad (text): ID de la propiedad a consultar
--
--[Salida]:
--   - TABLE: Retorna una tabla con los campos idNavArrend, comSPH y idRtaA
--
--[Uso típico]: Se utiliza para obtener información básica de una propiedad
--               y su relación con arrendamientos y respuestas asociadas.
--
--[Ejemplo]: SELECT * FROM rapdp_obtener_datos_propiedad('ABcqzhvE8a3x');
--
--[Relaciones]: 
--   - Tabla raPdp: Tabla principal que contiene los datos básicos
--   - Tabla propiedades: Relacionada mediante idPropiedad
--   - Tabla arrenPropiedades: Relacionada mediante idNave
--
--[Validaciones]:
--   - Verifica que el parámetro p_idpropiedad no sea nulo
--   - Retorna registros vacíos si no encuentra coincidencias

CREATE OR REPLACE FUNCTION public.rapdp_obtener_datos_propiedad(p_idpropiedad text)
 RETURNS TABLE(
    "idNavArrend" text,
    "comSPH" text,
    "idRtaA" text
 )
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $BODY$
BEGIN
    --[Fecha y Hora]: 17/12/2025 16:41:00
    -- [Descripción]: Función que obtiene los campos idNavArrend, comSPH y idRtaA 
    --                para una propiedad específica mediante joins entre raPdp, propiedades y arrenPropiedades.
    --
    -- [Entrada]: p_idpropiedad (text) - ID de la propiedad a consultar
    --
    -- [Salida]: TABLE - Retorna una tabla con los campos idNavArrend, comSPH y idRtaA
    --
    -- [Uso típico]: Se utiliza para obtener información básica de una propiedad
    --               y su relación con arrendamientos y respuestas asociadas.
    --
    -- [Ejemplo]: SELECT * FROM rapdp_obtener_datos_propiedad('ABcqzhvE8a3x');
    
    -- Validar que el parámetro no sea nulo
    IF p_idpropiedad IS NULL THEN
        RAISE EXCEPTION 'El idPropiedad no puede ser nulo';
    END IF;
    
    -- Retornar la consulta con los joins necesarios
    RETURN QUERY
    SELECT 
        ap."idNavArrend",
        ra."comSPH",
        ra."idRtaA"
    FROM 
        "raPdp" ra
        LEFT JOIN propiedades p ON p."idPropiedad" = ra."idPropiedad"
        LEFT JOIN "arrenPropiedades" ap ON ap."idNave" = p."idNave"
    WHERE 
        p."idPropiedad" = p_idpropiedad;
        
    RETURN;
END;
$BODY$;