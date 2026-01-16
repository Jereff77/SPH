--[Fecha y Hora]: 23/11/2025 14:16:17
--[Descripción]: Función que genera la corrida completa (partidas mensuales) para un plan
--                creado por arrepdp_crear_plan_simple_rpc. Complementa la función
--                simple añadiendo todas las partidas mensuales con sus conceptos.
--
--[Parámetros]:
--   - p_id_arre_pdp (text): ID del plan creado por arrepdp_crear_plan_simple_rpc
--   - p_inpc_adicional (double precision): INPC adicional opcional (default 0.0)
--   - p_pts_inpc_adicional (double precision): Puntos INPC adicionales (default 0.0)
--                                   NOTA: Este parámetro se mantiene por compatibilidad
--                                          pero ya no se suma al valor base para evitar duplicación
--
--[Salida]: JSON con estadísticas completas de la operación
--
--[Lógica de cálculo]:
--   - Lee los datos del plan desde arrePdp usando el ID proporcionado (incluyendo Moneda)
--   - Genera depósito (partida 0) con el monto especificado en el plan, ciclo igual al año 1
--     y valores pm2=deposito, constM2=1 para que cantidad calcule correctamente el depósito
--   - Genera partidas mensuales (1 a plazo) con 4 conceptos cada una:
--     * Renta: usa precioM2 y construccionM2
--     * Administración: usa pm2Admin y construccionM2 (valor directo de la tabla)
--     * Mantenimiento: usa pm2Mtto y construccionM2 (valor directo de la tabla)
--     * Vigilancia: usa pm2Vig y construccionM2 (valor directo de la tabla)
--   - Calcula años automáticamente: ((numPartida-1)/12)+1
--   - Aplica valores de INPC base del plan más los adicionales (solo para INPC, no para ptsINPC)
--   - Cada registro de detalle incluye la moneda especificada en el plan principal
--
--[Uso]: SELECT * FROM arrepdp_generar_corrida_desde_plan_simple(
--           'PDP_241201010530_abc12345', 2.5, 0.0);
--
--[Relaciones]:
--   - Tabla principal: public."arrePdp" (lectura de datos)
--   - Tabla destino: public."arrePdpDetalle" (inserción de registros)
--
--[Validaciones]:
--   - Verifica que el ID del plan no sea nulo o vacío
--   - Verifica que el plan exista en arrePdp
--   - Verifica que el plan no tenga detalles previamente generados
--   - Valida que los campos necesarios no sean nulos
--   - Valida que los valores de INPC no sean negativos
--
--[Consideraciones de rendimiento]:
--   - Función masiva que inserta múltiples registros
--   - Usa transacción para consistencia de datos
--   - Optimizada para planes de hasta 120 meses
--
--[Notas importantes]:
--   - Complementa perfectamente a arrepdp_crear_plan_simple_rpc()
--   - Usa valores directos de la tabla para conceptos adicionales:
--     * Administración: pm2Admin (valor directo de la tabla arrePdp)
--     * Mantenimiento: pm2Mtto (valor directo de la tabla arrePdp)
--     * Vigilancia: pm2Vig (valor directo de la tabla arrePdp)
--   - Genera IDs únicos para cada partida usando el ID del plan como prefijo
--   - Aplica INPC base del plan más los valores adicionales
--   - El depósito tiene ciclo igual al año 1 para mantener consistencia
--   - Cada registro de detalle hereda la moneda del plan principal
--
--[Corrección]: 23/11/2025 - Se corrigió duplicación en ptsINPC eliminando la suma
--               del parámetro p_pts_inpc_adicional al valor base de INPCPlus
--
--[Actualización]: 22/11/2025 - Se eliminó conversión explícita de tipo UUID en campo "uid"
--               ya que ahora el campo es nativamente de tipo uuid en la tabla arrePdp
--
--[Modificación]: 23/11/2025 - Agregado soporte para moneda en cada registro de detalle
--               La función ahora lee el campo Moneda del plan y lo guarda en cada partida

CREATE OR REPLACE FUNCTION public.arrepdp_generar_corrida_desde_plan_simple(
    p_id_arre_pdp text,
    p_inpc_adicional double precision DEFAULT 0.0,
    p_pts_inpc_adicional double precision DEFAULT 0.0
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
    v_deposito double precision;
    v_precio_m2 double precision;
    v_construccion_m2 double precision;
    v_inpc_base double precision;
    v_inpc_plus_base double precision;
    v_moneda text;
    
    -- Variables para cálculos de conceptos
    v_pm2_admin double precision;
    v_pm2_mtto double precision;
    v_pm2_vig double precision;
    v_inpc_total double precision;
    v_pts_inpc_total double precision;
    
    -- Variables de control
    mes_actual integer := 1;
    fecha_actual date;
    anio_actual smallint;
    partidas_insertadas integer := 0;
    deposito_insertado boolean := false;
    sql_error text;
    
    -- Variables para verificar si el plan ya tiene detalles
    v_detalle_existente boolean;
    
    -- Variables para resumen de montos
    v_total_renta double precision := 0.0;
    v_total_admin double precision := 0.0;
    v_total_mtto double precision := 0.0;
    v_total_vig double precision := 0.0;
BEGIN
    -- [Descripción]: Función que genera la corrida completa para un plan simple
    
    -- Validaciones de parámetros obligatorios
    IF p_id_arre_pdp IS NULL OR TRIM(p_id_arre_pdp) = '' THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PARAMETRO_INVALIDO',
            'mensaje', 'El ID del plan es obligatorio'
        );
    END IF;
    
    -- Validar que los valores de INPC no sean negativos
    IF p_inpc_adicional < 0 OR p_pts_inpc_adicional < 0 THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PARAMETRO_INVALIDO',
            'mensaje', 'Los valores de INPC no pueden ser negativos'
        );
    END IF;
    
    -- Verificar que el plan exista en arrePdp
    IF NOT EXISTS (SELECT 1 FROM public."arrePdp" WHERE "idArrePdp" = p_id_arre_pdp) THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PLAN_NO_EXISTE',
            'mensaje', 'El plan especificado no existe en la base de datos',
            'detalles', jsonb_build_object('id_plan', p_id_arre_pdp)
        );
    END IF;
    
    -- Verificar que el plan no tenga detalles previamente generados
    SELECT EXISTS(SELECT 1 FROM public."arrePdpDetalle" WHERE "idArrePdp" = p_id_arre_pdp) 
    INTO v_detalle_existente;
    
    IF v_detalle_existente THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PARTIDAS_YA_EXISTEN',
            'mensaje', 'El plan ya tiene partidas generadas previamente',
            'detalles', jsonb_build_object('id_plan', p_id_arre_pdp)
        );
    END IF;
    
    -- Obtener datos del plan principal
    SELECT
        "uid",
        "idArrendador",
        "fecInicio",
        "plazo",
        "deposito",
        "precioM2",
        "construccionM2",
        "INPC",
        "INPCPlus",
        "pm2Admin",
        "pm2Mtto",
        "pm2Vig",
        "Moneda"
    INTO
        v_uid,
        v_id_arrendador,
        v_fec_inicio,
        v_plazo,
        v_deposito,
        v_precio_m2,
        v_construccion_m2,
        v_inpc_base,
        v_inpc_plus_base,
        v_pm2_admin,
        v_pm2_mtto,
        v_pm2_vig,
        v_moneda
    FROM public."arrePdp"
    WHERE "idArrePdp" = p_id_arre_pdp;
    
    -- Validar que los campos necesarios no sean nulos
    IF v_uid IS NULL OR v_id_arrendador IS NULL OR v_fec_inicio IS NULL
       OR v_plazo IS NULL OR v_precio_m2 IS NULL OR v_construccion_m2 IS NULL THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PLAN_INCOMPLETO',
            'mensaje', 'El plan tiene datos incompletos o corruptos',
            'detalles', jsonb_build_object(
                'id_plan', p_id_arre_pdp,
                'uid', v_uid IS NOT NULL,
                'id_arrendador', v_id_arrendador IS NOT NULL,
                'fec_inicio', v_fec_inicio IS NOT NULL,
                'plazo', v_plazo IS NOT NULL,
                'precio_m2', v_precio_m2 IS NOT NULL,
                'construccion_m2', v_construccion_m2 IS NOT NULL
            )
        );
    END IF;
    
    -- Los valores para conceptos adicionales ahora se toman directamente de la tabla arrePdp
    -- v_pm2_admin, v_pm2_mtto, v_pm2_vig ya fueron obtenidos de la consulta SELECT
    
    -- Calcular totales de INPC
    v_inpc_total := COALESCE(v_inpc_base, 0.0) + p_inpc_adicional;
    v_pts_inpc_total := COALESCE(v_inpc_plus_base, 0.0);
    
    -- Realizar inserciones sin transacción explícita (la función ya está en una transacción)
    -- 1. Insertar depósito (siempre partida 0, año 0, ciclo igual al año 1)
    INSERT INTO public."arrePdpDetalle" (
        "idArrePdpDet", "fc", "status", "uidc", "idArrePdp", "tipoOperacion",
        "numPartida", "concepto", "fecha", "pm2", "constM2",
        "INPC", "ptsINPC", "anio", "inc_x_inpc", "ciclo", "moneda"
    ) VALUES (
        p_id_arre_pdp || '_DEP', NOW(), true, v_uid, p_id_arre_pdp, 1,
        0, 'Deposito Garantia', v_fec_inicio, COALESCE(v_deposito, 0.0), 1.0,
        v_inpc_total, v_pts_inpc_total, 0, 0.0, EXTRACT(YEAR FROM v_fec_inicio)::integer, v_moneda
    );
    
    deposito_insertado := true;
    partidas_insertadas := 1;
    
    -- 2. Insertar partidas mensuales
    fecha_actual := v_fec_inicio;
    
    WHILE mes_actual <= v_plazo LOOP
        -- Calcular año actual: ((mes-1)/12)+1
        anio_actual := ((mes_actual - 1) / 12 + 1)::smallint;
        
        -- Insertar RENTA
        INSERT INTO public."arrePdpDetalle" (
            "idArrePdpDet", "fc", "status", "uidc", "idArrePdp", "tipoOperacion",
            "numPartida", "concepto", "fecha", "pm2", "constM2",
            "INPC", "ptsINPC", "anio", "inc_x_inpc", "ciclo", "moneda"
        ) VALUES (
            p_id_arre_pdp || '_R_' || LPAD(mes_actual::text, 3, '0'), NOW(), true, v_uid, p_id_arre_pdp, 1,
            mes_actual, 'Renta', fecha_actual, v_precio_m2, v_construccion_m2,
            v_inpc_total, v_pts_inpc_total, anio_actual, 0.0, EXTRACT(YEAR FROM v_fec_inicio)::integer, v_moneda
        );
        
        v_total_renta := v_total_renta + (v_precio_m2 * v_construccion_m2);
        
        -- Insertar ADMINISTRACIÓN
        INSERT INTO public."arrePdpDetalle" (
            "idArrePdpDet", "fc", "status", "uidc", "idArrePdp", "tipoOperacion",
            "numPartida", "concepto", "fecha", "pm2", "constM2",
            "INPC", "ptsINPC", "anio", "inc_x_inpc", "ciclo", "moneda"
        ) VALUES (
            p_id_arre_pdp || '_A_' || LPAD(mes_actual::text, 3, '0'), NOW(), true, v_uid, p_id_arre_pdp, 1,
            mes_actual, 'Administración', (fecha_actual + INTERVAL '1 day'), v_pm2_admin, v_construccion_m2,
            v_inpc_total, v_pts_inpc_total, anio_actual, 0.0, EXTRACT(YEAR FROM v_fec_inicio)::integer, v_moneda
        );
        
        v_total_admin := v_total_admin + (v_pm2_admin * v_construccion_m2);
        
        -- Insertar MANTENIMIENTO
        INSERT INTO public."arrePdpDetalle" (
            "idArrePdpDet", "fc", "status", "uidc", "idArrePdp", "tipoOperacion",
            "numPartida", "concepto", "fecha", "pm2", "constM2",
            "INPC", "ptsINPC", "anio", "inc_x_inpc", "ciclo", "moneda"
        ) VALUES (
            p_id_arre_pdp || '_M_' || LPAD(mes_actual::text, 3, '0'), NOW(), true, v_uid, p_id_arre_pdp, 1,
            mes_actual, 'Mantenimiento', (fecha_actual + INTERVAL '1 day'), v_pm2_mtto, v_construccion_m2,
            v_inpc_total, v_pts_inpc_total, anio_actual, 0.0, EXTRACT(YEAR FROM v_fec_inicio)::integer, v_moneda
        );
        
        v_total_mtto := v_total_mtto + (v_pm2_mtto * v_construccion_m2);
        
        -- Insertar VIGILANCIA
        INSERT INTO public."arrePdpDetalle" (
            "idArrePdpDet", "fc", "status", "uidc", "idArrePdp", "tipoOperacion",
            "numPartida", "concepto", "fecha", "pm2", "constM2",
            "INPC", "ptsINPC", "anio", "inc_x_inpc", "ciclo", "moneda"
        ) VALUES (
            p_id_arre_pdp || '_V_' || LPAD(mes_actual::text, 3, '0'), NOW(), true, v_uid, p_id_arre_pdp, 1,
            mes_actual, 'Vigilancia', (fecha_actual + INTERVAL '1 day'), v_pm2_vig, v_construccion_m2,
            v_inpc_total, v_pts_inpc_total, anio_actual, 0.0, EXTRACT(YEAR FROM v_fec_inicio)::integer, v_moneda
        );
        
        v_total_vig := v_total_vig + (v_pm2_vig * v_construccion_m2);
        
        -- Incrementar contadores
        partidas_insertadas := partidas_insertadas + 4; -- 4 conceptos por mes
        mes_actual := mes_actual + 1;
        
        -- Avanzar al siguiente mes
        fecha_actual := fecha_actual + INTERVAL '1 month';
    END LOOP;
    
    -- Retorno exitoso con estadísticas completas
    RETURN jsonb_build_object(
        'exito', true,
        'codigo', 'EXITO',
        'mensaje', 'Corrida del plan generada correctamente',
        'detalles', jsonb_build_object(
            'id_plan', p_id_arre_pdp,
            'plazo_meses', v_plazo,
            'deposito_insertado', deposito_insertado,
            'partidas_totales', partidas_insertadas,
            'conceptos_por_mes', 4,
            'fecha_inicio', v_fec_inicio,
            'inpc_base', COALESCE(v_inpc_base, 0.0),
            'inpc_adicional_aplicado', p_inpc_adicional,
            'pts_inpc_base', COALESCE(v_inpc_plus_base, 0.0),
            'pts_inpc_adicional_aplicado', p_pts_inpc_adicional,
            'resumen_montos_conceptos', jsonb_build_object(
                'deposito', COALESCE(v_deposito, 0.0),
                'renta_total', v_total_renta,
                'administracion_total', v_total_admin,
                'mantenimiento_total', v_total_mtto,
                'vigilancia_total', v_total_vig,
                'total_general', COALESCE(v_deposito, 0.0) + v_total_renta + v_total_admin + v_total_mtto + v_total_vig
            ),
            'datos_plan', jsonb_build_object(
                'id_arrendador', v_id_arrendador,
                'precio_m2', v_precio_m2,
                'construccion_m2', v_construccion_m2,
                'pm2_admin_tabla', v_pm2_admin,
                'pm2_mtto_tabla', v_pm2_mtto,
                'pm2_vig_tabla', v_pm2_vig,
                'moneda_plan', v_moneda
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
            'detalles', jsonb_build_object('sqlstate', SQLSTATE)
        );
END;
$BODY$;