--[Fecha y Hora]: 24/10/2025 01:42:07
--[Descripción]: Función que valida si un teléfono ya existe en la tabla catAsesoresInm
--                y retorna el nombre completo del usuario que lo registró
--
--[Parámetros]:
--   - p_telefono (text): Número de teléfono a validar
--
--[Salida]:
--   - text: Nombre completo del usuario que registró el teléfono o 'false' si no existe
--
--[Uso típico]: Se utiliza para validar duplicidad de teléfonos antes de
--               registrar un nuevo asesor inmobiliario
--
--[Ejemplo]: SELECT catasesoresinm_validar_telefono('5512345678');
--
--[Relaciones]: 
--   - Tabla catAsesoresInm (donde se busca el teléfono)
--   - Tabla catUsers (donde se obtiene el nombre del usuario)
--
--[Validaciones]:
--   - Verifica si el teléfono existe en catAsesoresInm
--   - Retorna 'false' si no encuentra coincidencias
--   - Retorna nombre completo del usuario si encuentra el teléfono
--   - Verifica que ambos registros estén activos (status = true)

CREATE OR REPLACE FUNCTION public.catasoresinm_validar_telefono(p_telefono text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $BODY$
    --[Fecha y Hora]: 24/10/2025 01:42:07
    -- [Descripción]: Valida si un teléfono ya existe en la tabla catAsesoresInm
    --                y retorna el nombre completo del usuario que lo registró
    --
    -- [Entrada]: p_telefono (text) - El número de teléfono a validar
    --
    -- [Salida]: text - Nombre completo del usuario que registró el teléfono
    --               o 'false' si el teléfono no existe
    --
    -- [Uso típico]: Se utiliza para validar duplicidad de teléfonos antes de
    --               registrar un nuevo asesor inmobiliario
    --
    -- [Ejemplo]: SELECT catasesoresinm_validar_telefono('5512345678');
    --
    -- [Relaciones]: 
    --   - Tabla catAsesoresInm (donde se busca el teléfono)
    --   - Tabla catUsers (donde se obtiene el nombre del usuario)
    --
    -- [Validaciones]:
    --   - Verifica si el teléfono existe en catAsesoresInm
    --   - Retorna 'false' si no encuentra coincidencias
    --   - Retorna nombre completo del usuario si encuentra el teléfono
    --   - Solo considera registros activos (status = true)
    --   - Usa SECURITY INVOKER según normas del proyecto

    DECLARE
        v_result text;
    BEGIN
        SELECT CONCAT(u.nombre, ' ', COALESCE(u.apellidos, ''))
        INTO v_result
        FROM public."catAsesoresInm" a
        INNER JOIN public."catUsers" u ON a."uidr" = u.uid
        WHERE a."telefono" = p_telefono
        AND a.status = true
        AND u.status = true
        LIMIT 1;
        
        IF v_result IS NULL OR v_result = '' THEN
            RETURN 'false';
        ELSE
            RETURN v_result;
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            RETURN 'false';
    END;
$BODY$;