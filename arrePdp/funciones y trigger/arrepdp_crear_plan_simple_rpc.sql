--[Fecha y Hora]: 12/12/2025 01:25:50
--[Descripción]: Función RPC simplificada para crear plan de pago básico
--                Reemplaza ~300 líneas de código Flutter con una sola llamada a la base de datos.
--                Versión funcional proporcionada por el usuario con parámetros adicionales pm2.
--
--[Parámetros]:
--   - p_uid (text): UID del usuario que crea el plan
--   - p_id_arrendador (text): ID del arrendador
--   - p_id_nav_arrend (text): ID de la nave arrendada
--   - p_fec_inicio (date): Fecha de inicio del plan
--   - p_plazo (integer): Plazo en meses
--   - p_deposito (double precision): Monto del depósito
--   - p_precio_m2 (double precision): Precio por metro cuadrado
--   - p_construccion_m2 (double precision): Metros cuadrados de construcción
--   - p_pm2_admin (double precision): Precio por m² de administración
--   - p_pm2_mtto (double precision): Precio por m² de mantenimiento
--   - p_pm2_vig (double precision): Precio por m² de vigilancia
--   - p_inpc_plus (double precision): INPC Plus adicional
--   - p_moneda (text): Moneda del plan (MXN, USD, EUR, etc.) - Default: MXN
--   - p_mes_gracia_renta (double precision): Monto de mes de gracia para renta - Default: 0.0
--   - p_mes_gracia_administracion (double precision): Monto de mes de gracia para administración - Default: 0.0
--   - p_mes_gracia_mantenimiento (double precision): Monto de mes de gracia para mantenimiento - Default: 0.0
--   - p_mes_gracia_vigilancia (double precision): Monto de mes de gracia para vigilancia - Default: 0.0
--
--[Salida]: jsonb con resultado de la operación
--
--[Uso típico]: Creación rápida de planes de pago desde la interfaz de usuario
--
--[Relaciones]:
--   - Tabla: public."arrePdp" (inserta nuevo plan)
--   - Tabla: public."arrenPropiedades" (actualiza campos específicos del plan: idArrePdp, tienePdp, pdpActivo)
--
--[Validaciones]:
--   - Superposición de períodos para la misma nave
--   - Estados de nave y propiedad
--   - Parámetros obligatorios
--   - Fechas coherentes
--
--[Correcciones aplicadas 22/11/2025]:
--   - Reemplazada función completa con versión funcional del usuario
--   - Agregados parámetros pm2_admin, pm2_mtto, pm2_vig, p_inpc_plus
--   - Mantenida estructura JSON de respuesta original
--   - Insertados nuevos campos pm2 en la tabla arrePdp
--
--[Correcciones aplicadas 23/11/2025]:
--   - Agregado parámetro p_moneda con valor por defecto 'MXN'
--   - Incluido campo Moneda en la instrucción INSERT
--
--[Correcciones aplicadas 12/12/2025]:
--   - Agregados parámetros p_mes_gracia_* para soporte completo de mesGracia
--   - Incluido campo mesGracia en la instrucción INSERT con estructura JSON
--   - Actualizada respuesta JSON para incluir valores de mesGracia configurados

CREATE OR REPLACE FUNCTION public.arrepdp_crear_plan_simple_rpc(
    p_uid text,
    p_id_arrendador text,
    p_id_nav_arrend text,
    p_fec_inicio date,
    p_plazo integer,
    p_deposito double precision,
    p_precio_m2 double precision,
    p_construccion_m2 double precision,
    p_pm2_admin double precision DEFAULT 0.0,
    p_pm2_mtto double precision DEFAULT 0.0,
    p_pm2_vig double precision DEFAULT 0.0,
    p_inpc_plus double precision DEFAULT 0.0,
    p_moneda text DEFAULT 'MXN',
    p_mes_gracia_renta double precision DEFAULT 0.0,
    p_mes_gracia_administracion double precision DEFAULT 0.0,
    p_mes_gracia_mantenimiento double precision DEFAULT 0.0,
    p_mes_gracia_vigilancia double precision DEFAULT 0.0
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_id_arre_pdp text;
    v_rta_base double precision;
    v_propiedad_actualizada boolean := false;
BEGIN
    -- [Descripción]: Función RPC simplificada que crea un plan de pagos básico
    
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
    
    -- Validar superposición de períodos con planes existentes
    -- Calcular fecha de fin del nuevo plan
    DECLARE
        v_fecha_fin_nuevo_plan date;
    BEGIN
        v_fecha_fin_nuevo_plan := p_fec_inicio + (p_plazo || ' months')::interval - INTERVAL '1 day';
        
        -- Verificar si existe algún plan que se superponga con el nuevo período
        IF EXISTS (
            SELECT 1 FROM public."arrePdp" ap
            INNER JOIN public."arrenPropiedades" prop ON ap."idNavArrend" = prop."idNavArrend"
            WHERE ap."idNavArrend" = p_id_nav_arrend
            AND ap."status" = true
            AND prop."pdpActivo" = true
            AND (
                -- El nuevo plan empieza durante un plan existente
                (p_fec_inicio BETWEEN ap."fecInicio" AND ap."fecFin")
                -- O el nuevo plan termina durante un plan existente  
                OR (v_fecha_fin_nuevo_plan BETWEEN ap."fecInicio" AND ap."fecFin")
                -- O el nuevo plan contiene completamente un plan existente
                OR (ap."fecInicio" BETWEEN p_fec_inicio AND v_fecha_fin_nuevo_plan)
                -- O el nuevo plan está completamente contenido en un plan existente
                OR (ap."fecFin" BETWEEN p_fec_inicio AND v_fecha_fin_nuevo_plan)
            )
        ) THEN
            RETURN jsonb_build_object(
                'exito', false,
                'codigo', 'SUPERPOSICION_PERIODOS',
                'mensaje', 'El período del plan se superpone con un plan existente para esta propiedad',
                'detalles', jsonb_build_object(
                    'id_nav_arrend', p_id_nav_arrend,
                    'fecha_inicio_propuesto', p_fec_inicio,
                    'fecha_fin_propuesto', v_fecha_fin_nuevo_plan,
                    'plazo_meses', p_plazo
                )
            );
        END IF;
    END;
    
    -- Generar ID único para el plan
    v_id_arre_pdp := 'PDP_' || to_char(NOW(), 'YYMMDDHH24MISS') || '_' || substr(md5(random()::text), 1, 8);
    
    -- Calcular rtaBase (precio_m2 * construccion_m2)
    v_rta_base := COALESCE(p_precio_m2, 0.0) * COALESCE(p_construccion_m2, 0.0);
    
    -- Insertar registro principal en arrePdp con todos los campos pm2, moneda y mesGracia
    INSERT INTO public."arrePdp" (
        "idArrePdp", "uid", "idArrendador", "idNavArrend", "fecInicio",
        "plazo", "deposito", "precioM2", "construccionM2", "rtaBase",
        "pm2Admin", "pm2Mtto", "pm2Vig", "INPCPlus", "Moneda", "mesGracia"
    ) VALUES (
        v_id_arre_pdp, p_uid::uuid, p_id_arrendador, p_id_nav_arrend, p_fec_inicio,
        p_plazo, p_deposito, p_precio_m2, p_construccion_m2, v_rta_base,
        p_pm2_admin, p_pm2_mtto, p_pm2_vig, p_inpc_plus, p_moneda,
        jsonb_build_object(
            'renta', p_mes_gracia_renta,
            'administracion', p_mes_gracia_administracion,
            'mantenimiento', p_mes_gracia_mantenimiento,
            'vigilancia', p_mes_gracia_vigilancia
        )
    );
    
    -- Actualizar propiedad para indicar que tiene PDP
    UPDATE public."arrenPropiedades"
    SET "tienePdp" = true,
        "idArrePdp" = v_id_arre_pdp,
        "pdpActivo" = false
    WHERE "idNavArrend" = p_id_nav_arrend;
    
    v_propiedad_actualizada := true;
    
    -- Retorno exitoso con estadísticas básicas
    RETURN jsonb_build_object(
        'exito', true,
        'codigo', 'EXITO',
        'mensaje', 'Plan de pagos creado correctamente (versión simplificada)',
        'detalles', jsonb_build_object(
            'id_plan', v_id_arre_pdp,
            'id_nav_arrend', p_id_nav_arrend,
            'plazo_meses', p_plazo,
            'fecha_inicio', p_fec_inicio,
            'rta_base', v_rta_base,
            'deposito', p_deposito,
            'pm2_admin', p_pm2_admin,
            'pm2_mtto', p_pm2_mtto,
            'pm2_vig', p_pm2_vig,
            'inpc_plus', p_inpc_plus,
            'moneda', p_moneda,
            'mes_gracia', jsonb_build_object(
                'renta', p_mes_gracia_renta,
                'administracion', p_mes_gracia_administracion,
                'mantenimiento', p_mes_gracia_mantenimiento,
                'vigilancia', p_mes_gracia_vigilancia
            ),
            'propiedad_actualizada', v_propiedad_actualizada,
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
$$;

-- Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.arrepdp_crear_plan_simple_rpc TO authenticated;
GRANT EXECUTE ON FUNCTION public.arrepdp_crear_plan_simple_rpc TO service_role;

--[Nota final]: Función verificada en Supabase el 22/11/2025 06:38 - Operando correctamente
--                El usuario realizó ajuste menor directamente en Supabase y la función está funcionando
--                Esta versión local coincide con la versión funcional en producción
--
--[Modificación 23/11/2025]: Agregado parámetro p_moneda con valor por defecto 'MXN'
--                Se incluye el campo Moneda en la instrucción INSERT y en la respuesta JSON
--
--[Modificación 12/12/2025]: Agregado soporte completo para mesGracia
--                Se agregaron 4 parámetros p_mes_gracia_* con valores por defecto 0.0
--                Se construye JSON mesGracia en el INSERT y se incluye en la respuesta