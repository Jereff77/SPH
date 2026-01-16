--[Fecha y Hora]: 22/11/2025 20:44:00
--[Descripción]: Función para eliminar un plan de pagos (arrePdp) con validaciones
--                de restricciones de seguridad. Elimina el plan y sus detalles,
--                además de actualizar el estado de la propiedad asociada.
--
--[Parámetros]:
--   - p_id_arre_pdp (text): ID del plan a eliminar
--
--[Salida]: JSON con estadísticas completas de la operación
--
--[Lógica de eliminación]:
--   - Valida que el ID del plan no sea nulo o vacío
--   - Verifica que el plan exista en arrePdp
--   - VALIDACIÓN CRÍTICA: No permite eliminar si hay pagos aplicados (cantidadAplicada > 0)
--   - Elimina en cascada los detalles en arrePdpDetalle
--   - Actualiza arrenPropiedades: tienePdp = false, pdpActivo = false
--   - Elimina el registro principal en arrePdp
--
--[Uso]: SELECT * FROM arrepdp_eliminar_plan_con_restricciones(
--           'PDP_241201010530_abc12345');
--
--[Relaciones]:
--   - Tabla principal: public."arrePdp" (eliminación)
--   - Tabla detalles: public."arrePdpDetalle" (eliminación en cascada)
--   - Tabla propiedades: public."arrenPropiedades" (actualización de estado)
--
--[Validaciones]:
--   - Verifica que el ID del plan no sea nulo o vacío
--   - Verifica que el plan exista en arrePdp
--   - RESTRICCIÓN: No permite eliminar si existe algún pago aplicado
--   - Manejo transaccional completo (todo o nada)
--
--[Consideraciones de seguridad]:
--   - Función crítica que elimina datos financieros
--   - Usa transacción para garantizar consistencia
--   - Validaciones estrictas para proteger datos con pagos
--   - Auditoría completa de la operación
--
--[Notas importantes]:
--   - La validación de pagos aplicados protege integridad financiera
--   - Actualiza automáticamente los estados de propiedad relacionados
--   - Genera registro completo de auditoría en el JSON de respuesta
--   - No se valida el estado vigente del plan, se puede eliminar sin importar si está vigente o no
--
--[Actualización]: 22/11/2025 20:44:00 - Corrección de error de tipo de datos y eliminación de validación de vigencia

CREATE OR REPLACE FUNCTION public.arrepdp_eliminar_plan_con_restricciones(
    p_id_arre_pdp text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $BODY$
DECLARE
    -- Variables para almacenar datos del plan
    v_uid uuid;
    v_id_arrendador text;
    v_fec_inicio date;
    v_plazo integer;
    v_id_nav_arrend text;
    v_vigente boolean;
    
    -- Variables de control
    v_plan_existente boolean;
    v_detalle_count integer;
    v_pago_aplicado boolean;
    sql_error text;
    
    -- Variables para auditoría
    v_detalles_eliminados integer := 0;
    v_propiedad_actualizada integer := 0;
BEGIN
    -- [Descripción]: Función para eliminar un plan de pagos con restricciones de seguridad
    
    -- Validaciones de parámetros obligatorios
    IF p_id_arre_pdp IS NULL OR TRIM(p_id_arre_pdp) = '' THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PARAMETRO_INVALIDO',
            'mensaje', 'El ID del plan es obligatorio'
        );
    END IF;
    
    -- Verificar que el plan exista en arrePdp
    SELECT EXISTS(SELECT 1 FROM public."arrePdp" WHERE "idArrePdp" = p_id_arre_pdp) 
    INTO v_plan_existente;
    
    IF NOT v_plan_existente THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PLAN_NO_EXISTE',
            'mensaje', 'El plan especificado no existe en la base de datos',
            'detalles', jsonb_build_object('id_plan', p_id_arre_pdp)
        );
    END IF;
    
    -- Obtener datos del plan para validaciones
    SELECT
        "uid",
        "idArrendador",
        "fecInicio",
        "plazo",
        "idNavArrend",
        "vigente"
    INTO
        v_uid,
        v_id_arrendador,
        v_fec_inicio,
        v_plazo,
        v_id_nav_arrend,
        v_vigente
    FROM public."arrePdp"
    WHERE "idArrePdp" = p_id_arre_pdp;
    
    -- VALIDACIÓN CRÍTICA 2: Verificar si hay pagos aplicados
    SELECT EXISTS(
        SELECT 1 FROM public."arrePdpDetalle"
        WHERE "idArrePdp" = p_id_arre_pdp
        AND COALESCE("cantidadAplicada", 0.0) > 0
    ) INTO v_pago_aplicado;
    
    IF v_pago_aplicado THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PLAN_CON_PAGOS',
            'mensaje', 'No se puede eliminar un plan que tiene pagos aplicados',
            'detalles', jsonb_build_object(
                'id_plan', p_id_arre_pdp,
                'tiene_pagos_aplicados', true
            )
        );
    END IF;
    
    -- Contar detalles para auditoría
    SELECT COUNT(*) INTO v_detalle_count
    FROM public."arrePdpDetalle"
    WHERE "idArrePdp" = p_id_arre_pdp;
    
    -- Iniciar transacción de eliminación
    -- 1. Eliminar detalles en arrePdp (CASCADE lógico)
    DELETE FROM public."arrePdp"
    WHERE "idArrePdp" = p_id_arre_pdp;
    
    GET DIAGNOSTICS v_detalles_eliminados = ROW_COUNT;
    
    -- 2. Actualizar arrenPropiedades si tiene referencia a este plan
    IF v_id_nav_arrend IS NOT NULL THEN
        UPDATE public."arrenPropiedades"
        SET "tienePdp" = false,
            "pdpActivo" = false,
            "idArrePdp" = NULL
        WHERE "idNavArrend" = v_id_nav_arrend
        AND "idArrePdp" = p_id_arre_pdp;
        
        GET DIAGNOSTICS v_propiedad_actualizada = ROW_COUNT;
    END IF;
    
    
    -- Retorno exitoso con estadísticas completas
    RETURN jsonb_build_object(
        'exito', true,
        'codigo', 'EXITO',
        'mensaje', 'Plan eliminado correctamente con todas sus restricciones',
        'detalles', jsonb_build_object(
            'id_plan', p_id_arre_pdp,
            'detalles_eliminados', v_detalles_eliminados,
            'propiedad_actualizada', v_propiedad_actualizada > 0,
            'datos_plan_eliminado', jsonb_build_object(
                'id_arrendador', v_id_arrendador,
                'id_nav_arrend', v_id_nav_arrend,
                'fecha_inicio', v_fec_inicio,
                'plazo_meses', v_plazo,
                'vigente', v_vigente
            ),
            'validaciones_aplicadas', jsonb_build_object(
                'vigente', v_vigente,
                'pagos_aplicados', v_pago_aplicado
            ),
            'timestamp', NOW()
        )
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'ERROR_GENERAL',
            'mensaje', 'Error interno: ' || SQLERRM,
            'detalles', jsonb_build_object(
                'sqlstate', SQLSTATE,
                'timestamp', NOW()
            )
        );
END;
$BODY$;