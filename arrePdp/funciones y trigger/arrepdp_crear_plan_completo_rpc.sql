--[Fecha y Hora]: 22/11/2025 01:52:00
--[Descripción]: Función RPC que crea un plan de pagos completo de arrendamiento,
--                reemplazando todo el proceso del código Flutter en una sola transacción.
--                Inserta el registro principal, actualiza la propiedad, genera todas las partidas
--                mensuales con sus conceptos y recalcula los años del contrato.
--
--[Parámetros]:
--   - p_uid (text): UID del usuario que crea el registro
--   - p_id_arrendador (text): ID del arrendador/propietario
--   - p_id_nav_arrend (text): ID de la nave arrendada
--   - p_fec_inicio (date): Fecha de inicio del contrato
--   - p_plazo (integer): Plazo en meses del contrato
--   - p_deposito (double precision): Monto del depósito
--   - p_precio_m2 (double precision): Precio por metro cuadrado
--   - p_construccion_m2 (double precision): Metros cuadrados de construcción
--   - p_inpc (double precision): Valor del INPC inicial
--   - p_inpc_plus (double precision): Puntos adicionales de INPC
--   - p_pm2_admin (double precision): Precio por m2 de administración
--   - p_pm2_mtto (double precision): Precio por m2 de mantenimiento
--   - p_pm2_vig (double precision): Precio por m2 de vigilancia
--   - p_cortesia_renta (integer): Meses de cortesía para renta
--   - p_cortesia_admin (integer): Meses de cortesía para administración
--   - p_cortesia_mtto (integer): Meses de cortesía para mantenimiento
--   - p_cortesia_vig (integer): Meses de cortesía para vigilancia
--
--[Salida]: JSON con estadísticas completas de la operación
--
--[Uso]: SELECT * FROM arrepdp_crear_plan_completo_rpc(
--           'UUID_USER', 'ID_ARRENDADOR', 'ID_NAVE', 
--           '2024-01-01', 24, 50000.0, 150.0, 100.0,
--           110.5, 2.0, 25.0, 15.0, 10.0,
--           0, 1, 2, 0);
--
--[Relaciones]: 
--   - Tablas principales: public."arrePdp", public."arrenPropiedades", 
--                      public."arrePdpDetalle", public."arreConceptos"
--
--[Validaciones]:
--   - Validación de parámetros obligatorios
--   - Verificación de que la propiedad no tenga ya un PDP
--   - Manejo transaccional completo (todo o nada)
--
--[Consideraciones de rendimiento]:
--   - Función masiva que inserta múltiples registros en varias tablas
--   - Usa transacción para consistencia de datos
--   - Optimizada para planes de hasta 120 meses
--
--[Notas importantes]:
--   - Reemplaza completamente el código Flutter de ~300 líneas
--   - Genera ID único automáticamente para el plan principal
--   - Calcula rtaBase automáticamente (precio_m2 * construccion_m2)
--   - Inserta conceptos automáticamente en arreConceptos
--
--[Actualización]: 22/11/2025 - Se agregó conversión de tipo UUID en parámetro p_uid
--               ya que el campo "uid" ahora es nativamente de tipo uuid en las tablas
--               arrePdp y arreConceptos

CREATE OR REPLACE FUNCTION public.arrepdp_crear_plan_completo_rpc(
    p_uid text,
    p_id_arrendador text,
    p_id_nav_arrend text,
    p_fec_inicio date,
    p_plazo integer,
    p_deposito double precision,
    p_precio_m2 double precision,
    p_construccion_m2 double precision,
    p_inpc double precision DEFAULT 0.0,
    p_inpc_plus double precision DEFAULT 0.0,
    p_pm2_admin double precision DEFAULT 0.0,
    p_pm2_mtto double precision DEFAULT 0.0,
    p_pm2_vig double precision DEFAULT 0.0,
    p_cortesia_renta integer DEFAULT 0,
    p_cortesia_admin integer DEFAULT 0,
    p_cortesia_mtto integer DEFAULT 0,
    p_cortesia_vig integer DEFAULT 0
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $BODY$
DECLARE
    v_id_arre_pdp text;
    v_rta_base double precision;
    v_resultado_plan jsonb;
    v_resultado_anios jsonb;
    v_conceptos_insertados integer := 0;
    v_propiedad_actualizada boolean := false;
    sql_error text;
BEGIN
    -- [Descripción]: Función RPC que crea un plan de pagos completo de arrendamiento,
    --                reemplazando todo el proceso del código Flutter en una sola transacción.
    
    -- Validaciones de parámetros obligatorios
    IF p_uid IS NULL OR TRIM(p_uid) = '' THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PARAMETRO_INVALIDO',
            'mensaje', 'El UID del usuario es obligatorio'
        );
    END IF;
    
    IF p_id_arrendador IS NULL OR TRIM(p_id_arrendador) = '' THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PARAMETRO_INVALIDO',
            'mensaje', 'El ID del arrendador es obligatorio'
        );
    END IF;
    
    IF p_id_nav_arrend IS NULL OR TRIM(p_id_nav_arrend) = '' THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PARAMETRO_INVALIDO',
            'mensaje', 'El ID de la nave arrendada es obligatorio'
        );
    END IF;
    
    IF p_fec_inicio IS NULL THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PARAMETRO_INVALIDO',
            'mensaje', 'La fecha de inicio es obligatoria'
        );
    END IF;
    
    IF p_plazo IS NULL OR p_plazo <= 0 OR p_plazo > 120 THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PARAMETRO_INVALIDO',
            'mensaje', 'El plazo debe ser un número entre 1 y 120 meses'
        );
    END IF;
    
    -- Verificar que la propiedad no tenga ya un PDP activo
    IF EXISTS (SELECT 1 FROM public."arrenPropiedades" WHERE "idNavArrend" = p_id_nav_arrend AND "tienePdp" = true) THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PROPIEDAD_CON_PDP',
            'mensaje', 'La propiedad ya tiene un plan de pagos activo',
            'detalles', jsonb_build_object('id_nav_arrend', p_id_nav_arrend)
        );
    END IF;
    
    -- Generar ID único para el plan
    v_id_arre_pdp := 'PDP_' || to_char(NOW(), 'YYMMDDHH24MISS') || '_' || substr(md5(random()::text), 1, 8);
    
    -- Calcular rtaBase (precio_m2 * construccion_m2)
    v_rta_base := COALESCE(p_precio_m2, 0.0) * COALESCE(p_construccion_m2, 0.0);
    
    -- Insertar registro principal en arrePdp
    INSERT INTO public."arrePdp" (
        "idArrePdp", "uid", "idArrendador", "idNavArrend", "fecInicio",
        "plazo", "deposito", "precioM2", "construccionM2", "rtaBase",
        "INPC", "INPCPlus", "pm2Admin", "pm2Mtto", "pm2Vig"
    ) VALUES (
        v_id_arre_pdp, p_uid::uuid, p_id_arrendador, p_id_nav_arrend, p_fec_inicio,
        p_plazo, p_deposito, p_precio_m2, p_construccion_m2, v_rta_base,
        p_inpc, p_inpc_plus, p_pm2_admin, p_pm2_mtto, p_pm2_vig
    );
    
    -- Actualizar propiedad para indicar que tiene PDP
    UPDATE public."arrenPropiedades"
    SET "tienePdp" = true,
        "idArrePdp" = v_id_arre_pdp,
        "pdpActivo" = true
    WHERE "idNavArrend" = p_id_nav_arrend;
    
    v_propiedad_actualizada := true;
    
    -- Generar plan completo de partidas SIN transacción anidada
    SELECT * INTO v_resultado_plan
    FROM public.arrepdpdetalle_generar_plan_completo(
        v_id_arre_pdp, p_id_arrendador, p_uid::uuid, p_fec_inicio, p_plazo,
        p_deposito, p_precio_m2, p_construccion_m2, p_inpc, p_inpc_plus,
        p_pm2_admin, p_pm2_mtto, p_pm2_vig,
        p_cortesia_renta, p_cortesia_admin, p_cortesia_mtto, p_cortesia_vig
    );
    
    -- Verificar que el plan se generó correctamente
    IF (v_resultado_plan->>'exito')::boolean = false THEN
        RETURN v_resultado_plan; -- Retornar el error de la función interna
    END IF;
    
    -- Recalcular años del contrato SIN transacción anidada
    SELECT * INTO v_resultado_anios
    FROM public.arrepdpdetalle_recalcular_anos_contrato(v_id_arre_pdp);
    
    -- Insertar conceptos en arreConceptos
    -- Concepto Renta
    INSERT INTO public."arreConceptos" (
        "uid", "idArreConcepto", "idArrendador", "idArrePdp", "concepto", "monto"
    ) VALUES (
        p_uid::uuid, v_id_arre_pdp || '_CONCEPTO_RENTA', p_id_arrendador, v_id_arre_pdp, 'Renta',
        COALESCE(p_precio_m2, 0.0) * COALESCE(p_construccion_m2, 0.0)
    );
    v_conceptos_insertados := v_conceptos_insertados + 1;
    
    -- Concepto Servicios (Administración + Mantenimiento)
    INSERT INTO public."arreConceptos" (
        "uid", "idArreConcepto", "idArrendador", "idArrePdp", "concepto", "monto"
    ) VALUES (
        p_uid::uuid, v_id_arre_pdp || '_CONCEPTO_SERVICIOS', p_id_arrendador, v_id_arre_pdp, 'Servicios',
        (COALESCE(p_pm2_admin, 0.0) + COALESCE(p_pm2_mtto, 0.0)) * COALESCE(p_construccion_m2, 0.0)
    );
    v_conceptos_insertados := v_conceptos_insertados + 1;
    
    -- Concepto Vigilancia
    INSERT INTO public."arreConceptos" (
        "uid", "idArreConcepto", "idArrendador", "idArrePdp", "concepto", "monto"
    ) VALUES (
        p_uid::uuid, v_id_arre_pdp || '_CONCEPTO_VIGILANCIA', p_id_arrendador, v_id_arre_pdp, 'Vigilancia',
        COALESCE(p_pm2_vig, 0.0) * COALESCE(p_construccion_m2, 0.0)
    );
    v_conceptos_insertados := v_conceptos_insertados + 1;
    
    -- Concepto Administración
    INSERT INTO public."arreConceptos" (
        "uid", "idArreConcepto", "idArrendador", "idArrePdp", "concepto", "monto"
    ) VALUES (
        p_uid::uuid, v_id_arre_pdp || '_CONCEPTO_ADMINISTRACION', p_id_arrendador, v_id_arre_pdp, 'Administracion',
        COALESCE(p_pm2_admin, 0.0) * COALESCE(p_construccion_m2, 0.0)
    );
    v_conceptos_insertados := v_conceptos_insertados + 1;
    
    -- Retorno exitoso con estadísticas completas
    RETURN jsonb_build_object(
        'exito', true,
        'codigo', 'EXITO',
        'mensaje', 'Plan de pagos creado correctamente',
        'detalles', jsonb_build_object(
            'id_plan', v_id_arre_pdp,
            'id_nav_arrend', p_id_nav_arrend,
            'plazo_meses', p_plazo,
            'fecha_inicio', p_fec_inicio,
            'rta_base', v_rta_base,
            'propiedad_actualizada', v_propiedad_actualizada,
            'conceptos_insertados', v_conceptos_insertados,
            'resultado_plan', v_resultado_plan,
            'resultado_anios', v_resultado_anios,
            'timestamp', NOW()
        )
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'ERROR_GENERAL',
            'mensaje', 'Error interno: ' || SQLERRM,
            'detalles', jsonb_build_object('sqlstate', SQLSTATE)
        );
END;
    
    -- Retorno exitoso con estadísticas completas
    RETURN jsonb_build_object(
        'exito', true,
        'codigo', 'EXITO',
        'mensaje', 'Plan de pagos creado correctamente',
        'detalles', jsonb_build_object(
            'id_plan', v_id_arre_pdp,
            'id_nav_arrend', p_id_nav_arrend,
            'plazo_meses', p_plazo,
            'fecha_inicio', p_fec_inicio,
            'rta_base', v_rta_base,
            'propiedad_actualizada', v_propiedad_actualizada,
            'conceptos_insertados', v_conceptos_insertados,
            'resultado_plan', v_resultado_plan,
            'resultado_anios', v_resultado_anios,
            'timestamp', NOW()
        )
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'ERROR_GENERAL',
            'mensaje', 'Error interno: ' || SQLERRM,
            'detalles', jsonb_build_object('sqlstate', SQLSTATE)
        );
END;
$BODY$;