--[Fecha y Hora]: 24/10/2025 08:05:00
--[Descripción]: Función para eliminar una propiedad validando que no tenga pagos aplicados
--
--[Parámetros]:
--   - p_id_propiedad (text): ID de la propiedad a eliminar
--
--[Salida]:
--   - text: Mensaje indicando el resultado de la operación
--
--[Uso típico]: Se utiliza para eliminar propiedades del sistema cuando ya no son necesarias
--               asegurando que no existan pagos asociados antes de la eliminación
--
--[Ejemplo]: SELECT propiedades_eliminar_propiedad('PROP-123');
--
--[Relaciones]: 
--   - Tabla principal: propiedades
--   - Tablas de validación: pagos, pdp, pdpDetalle
--
--[Validaciones]:
--   - Verifica que no existan pagos直接 asociados a la propiedad
--   - Verifica que no existan planes de pago (pdp) asociados
--   - Verifica que no existan detalles de planes de pago (pdpDetalle) asociados
--   - Valida que la propiedad exista antes de intentar eliminarla

CREATE OR REPLACE FUNCTION public.propiedades_eliminar_propiedad(p_id_propiedad text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $BODY$
DECLARE
    v_existe_propiedad boolean;
    v_count_pagos integer;
    v_count_pdp integer;
    v_count_pdp_detalle integer;
    v_mensaje_resultado text;
BEGIN
    --[Fecha y Hora]: 24/10/2025 08:05:00
    -- [Descripción]: Función para eliminar una propiedad validando que no tenga pagos aplicados
    --
    -- [Entrada]: p_id_propiedad (text) - El ID de la propiedad a eliminar
    --
    -- [Salida]: text - Mensaje indicando el resultado de la operación
    --
    -- [Uso típico]: Se utiliza para eliminar propiedades del sistema cuando ya no son necesarias
    --               asegurando que no existan pagos asociados antes de la eliminación
    --
    -- [Ejemplo]: SELECT propiedades_eliminar_propiedad('PROP-123');
    
    -- Validar que la propiedad exista
    SELECT EXISTS(SELECT 1 FROM public.propiedades WHERE "idPropiedad" = p_id_propiedad AND status = true)
    INTO v_existe_propiedad;
    
    IF NOT v_existe_propiedad THEN
        RETURN 'ERROR: La propiedad con ID ' || p_id_propiedad || ' no existe o está inactiva';
    END IF;
    
    -- Verificar si existen pagos直接 asociados a la propiedad
    SELECT COUNT(*)
    INTO v_count_pagos
    FROM public.pagos
    WHERE "idPropiedad" = p_id_propiedad AND status = true;
    
    IF v_count_pagos > 0 THEN
        RETURN 'ERROR: No se puede eliminar la propiedad ' || p_id_propiedad || ' porque tiene ' || v_count_pagos || ' pago(s) aplicado(s)';
    END IF;
    
    -- Nota: Los planes de pago (pdp) y sus detalles (pdpDetalle) se eliminarán en cascada
    -- por lo que no es necesario validar su existencia para permitir la eliminación
    
    -- Si pasa todas las validaciones, proceder a eliminar la propiedad
    UPDATE public.propiedades
    SET status = false
    WHERE "idPropiedad" = p_id_propiedad;
    
    -- Verificar que la actualización fue exitosa
    IF FOUND THEN
        v_mensaje_resultado := 'ÉXITO: La propiedad ' || p_id_propiedad || ' ha sido eliminada correctamente';
    ELSE
        v_mensaje_resultado := 'ERROR: No se pudo eliminar la propiedad ' || p_id_propiedad;
    END IF;
    
    RETURN v_mensaje_resultado;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN 'ERROR: Ocurrió un error al eliminar la propiedad ' || p_id_propiedad || ': ' || SQLERRM;
END;
$BODY$;