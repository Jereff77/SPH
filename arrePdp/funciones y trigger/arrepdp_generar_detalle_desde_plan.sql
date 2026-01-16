--[Fecha y Hora]: 22/11/2025 01:38:00
--[Descripción]: Función que genera el plan de arrendatarios arrePdpDet basado en los datos
--                de un plan existente en arrePdp. La función lee todos los datos del plan
--                principal y genera automáticamente todas las partidas mensuales con sus
--                respectivos conceptos (renta, administración, mantenimiento y vigilancia).
--
--[Parámetros]:
--   - p_id_arre_pdp (text): ID del plan de pago principal existente en arrePdp
--
--[Salida]: JSON con estadísticas de la operación
--
--[Lógica de cálculo]:
--   - Lee los datos del plan desde arrePdp usando el ID proporcionado
--   - Genera depósito (partida 0) con el monto especificado en el plan
--   - Genera partidas mensuales (1 a plazo) con 4 conceptos cada una:
--     * Renta: usa precioM2 y construccionM2
--     * Administración: usa pm2Admin y construccionM2
--     * Mantenimiento: usa pm2Mtto y construccionM2
--     * Vigilancia: usa pm2Vig y construccionM2
--   - Calcula años automáticamente: ((numPartida-1)/12)+1
--   - Aplica valores de INPC e INPCPlus del plan principal
--
--[Uso]: SELECT * FROM arrepdp_generar_detalle_desde_plan('PDP_241201010530_abc12345');
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
--
--[Consideraciones de rendimiento]:
--   - Función masiva que inserta múltiples registros
--   - Usa transacción para consistencia de datos
--   - Optimizada para planes de hasta 120 meses
--
--[Notas importantes]:
--   - Reutiliza la lógica de arrepdpdetalle_generar_plan_completo pero leyendo datos desde arrePdp
--   - No requiere parámetros adicionales ya que todo se obtiene del plan principal
--   - Genera IDs únicos para cada partida usando el ID del plan como prefijo
--
--[Actualización]: 22/11/2025 - Se eliminó conversión explícita de tipo UUID en campo "uid"
--               ya que ahora el campo es nativamente de tipo uuid en la tabla arrePdp

CREATE OR REPLACE FUNCTION public.arrepdp_generar_detalle_desde_plan(
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
    v_deposito double precision;
    v_precio_m2 double precision;
    v_construccion_m2 double precision;
    v_inpc double precision;
    v_inpc_plus double precision;
    v_pm2_admin double precision;
    v_pm2_mtto double precision;
    v_pm2_vig double precision;
    
    -- Variables de control
    mes_actual integer := 1;
    fecha_actual date;
    anio_actual smallint;
    partidas_insertadas integer := 0;
    deposito_insertado boolean := false;
    sql_error text;
    
    -- Variable para verificar si el plan ya tiene detalles
    v_detalle_existente boolean;
BEGIN
    -- [Descripción]: Función que genera el plan de arrendatarios arrePdpDet basado en los datos
    --                de un plan existente en arrePdp.
    
    -- Validaciones de parámetros obligatorios
    IF p_id_arre_pdp IS NULL OR TRIM(p_id_arre_pdp) = '' THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PARAMETRO_INVALIDO',
            'mensaje', 'El ID del plan es obligatorio'
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
            'codigo', 'DETALLE_YA_EXISTE',
            'mensaje', 'El plan ya tiene detalles generados previamente',
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
        "pm2Vig"
    INTO
        v_uid,
        v_id_arrendador,
        v_fec_inicio,
        v_plazo,
        v_deposito,
        v_precio_m2,
        v_construccion_m2,
        v_inpc,
        v_inpc_plus,
        v_pm2_admin,
        v_pm2_mtto,
        v_pm2_vig
    FROM public."arrePdp"
    WHERE "idArrePdp" = p_id_arre_pdp;
    
    -- Validar que los campos necesarios no sean nulos
    IF v_uid IS NULL OR v_id_arrendador IS NULL OR v_fec_inicio IS NULL OR v_plazo IS NULL THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PLAN_INCOMPLETO',
            'mensaje', 'El plan tiene datos incompletos o corruptos',
            'detalles', jsonb_build_object(
                'id_plan', p_id_arre_pdp,
                'uid', v_uid IS NOT NULL,
                'id_arrendador', v_id_arrendador IS NOT NULL,
                'fec_inicio', v_fec_inicio IS NOT NULL,
                'plazo', v_plazo IS NOT NULL
            )
        );
    END IF;
    
    -- Iniciar transacción para consistencia
    BEGIN
        -- 1. Insertar depósito (siempre partida 0, año 0)
        INSERT INTO public."arrePdpDetalle" (
            "idArrePdpDet", "fc", "status", "uidc", "idArrePdp", "tipoOperacion",
            "numPartida", "concepto", "fecha", "cantidad", "pm2", "constM2",
            "INPC", "ptsINPC", "anio", "inc_x_inpc"
        ) VALUES (
            p_id_arre_pdp || '_DEP', NOW(), true, v_uid, p_id_arre_pdp, 1,
            0, 'Deposito Garantia', v_fec_inicio, COALESCE(v_deposito, 0.0), 0.0, COALESCE(v_construccion_m2, 0.0),
            COALESCE(v_inpc, 0.0), COALESCE(v_inpc_plus, 0.0), 0, 0.0
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
                "numPartida", "concepto", "fecha", "pm2", "constM2", "cantidad",
                "INPC", "ptsINPC", "anio", "inc_x_inpc"
            ) VALUES (
                p_id_arre_pdp || '_R_' || LPAD(mes_actual::text, 3, '0'), NOW(), true, v_uid, p_id_arre_pdp, 1,
                mes_actual, 'Renta', fecha_actual, COALESCE(v_precio_m2, 0.0), COALESCE(v_construccion_m2, 0.0),
                (COALESCE(v_precio_m2, 0.0) * COALESCE(v_construccion_m2, 0.0)), COALESCE(v_inpc, 0.0), COALESCE(v_inpc_plus, 0.0), anio_actual, 0.0
            );
            
            -- Insertar ADMINISTRACIÓN
            INSERT INTO public."arrePdpDetalle" (
                "idArrePdpDet", "fc", "status", "uidc", "idArrePdp", "tipoOperacion",
                "numPartida", "concepto", "fecha", "pm2", "constM2", "cantidad",
                "INPC", "ptsINPC", "anio", "inc_x_inpc"
            ) VALUES (
                p_id_arre_pdp || '_A_' || LPAD(mes_actual::text, 3, '0'), NOW(), true, v_uid, p_id_arre_pdp, 1,
                mes_actual, 'Administración', (fecha_actual + INTERVAL '1 day'), COALESCE(v_pm2_admin, 0.0), COALESCE(v_construccion_m2, 0.0),
                (COALESCE(v_pm2_admin, 0.0) * COALESCE(v_construccion_m2, 0.0)), COALESCE(v_inpc, 0.0), COALESCE(v_inpc_plus, 0.0), anio_actual, 0.0
            );
            
            -- Insertar MANTENIMIENTO
            INSERT INTO public."arrePdpDetalle" (
                "idArrePdpDet", "fc", "status", "uidc", "idArrePdp", "tipoOperacion",
                "numPartida", "concepto", "fecha", "pm2", "constM2", "cantidad",
                "INPC", "ptsINPC", "anio", "inc_x_inpc"
            ) VALUES (
                p_id_arre_pdp || '_M_' || LPAD(mes_actual::text, 3, '0'), NOW(), true, v_uid, p_id_arre_pdp, 1,
                mes_actual, 'Mantenimiento', (fecha_actual + INTERVAL '1 day'), COALESCE(v_pm2_mtto, 0.0), COALESCE(v_construccion_m2, 0.0),
                (COALESCE(v_pm2_mtto, 0.0) * COALESCE(v_construccion_m2, 0.0)), COALESCE(v_inpc, 0.0), COALESCE(v_inpc_plus, 0.0), anio_actual, 0.0
            );
            
            -- Insertar VIGILANCIA
            INSERT INTO public."arrePdpDetalle" (
                "idArrePdpDet", "fc", "status", "uidc", "idArrePdp", "tipoOperacion",
                "numPartida", "concepto", "fecha", "pm2", "constM2", "cantidad",
                "INPC", "ptsINPC", "anio", "inc_x_inpc"
            ) VALUES (
                p_id_arre_pdp || '_V_' || LPAD(mes_actual::text, 3, '0'), NOW(), true, v_uid, p_id_arre_pdp, 1,
                mes_actual, 'Vigilancia', (fecha_actual + INTERVAL '1 day'), COALESCE(v_pm2_vig, 0.0), COALESCE(v_construccion_m2, 0.0),
                (COALESCE(v_pm2_vig, 0.0) * COALESCE(v_construccion_m2, 0.0)), COALESCE(v_inpc, 0.0), COALESCE(v_inpc_plus, 0.0), anio_actual, 0.0
            );
            
            -- Incrementar contadores
            partidas_insertadas := partidas_insertadas + 4; -- 4 conceptos por mes
            mes_actual := mes_actual + 1;
            
            -- Avanzar al siguiente mes
            fecha_actual := fecha_actual + INTERVAL '1 month';
        END LOOP;
        
        -- Confirmar transacción
        COMMIT;
        
    EXCEPTION
        WHEN OTHERS THEN
            -- Revertir cambios en caso de error
            ROLLBACK;
            sql_error := SQLERRM;
            
            RETURN jsonb_build_object(
                'exito', false,
                'codigo', 'ERROR_BASE_DATOS',
                'mensaje', 'Error al generar el detalle del plan: ' || sql_error,
                'detalles', jsonb_build_object(
                    'sqlstate', SQLSTATE,
                    'id_plan', p_id_arre_pdp,
                    'partidas_procesadas', partidas_insertadas
                )
            );
    END;
    
    -- Retorno exitoso
    RETURN jsonb_build_object(
        'exito', true,
        'codigo', 'EXITO',
        'mensaje', 'Detalle del plan generado correctamente',
        'detalles', jsonb_build_object(
            'id_plan', p_id_arre_pdp,
            'plazo_meses', v_plazo,
            'deposito_insertado', deposito_insertado,
            'partidas_totales', partidas_insertadas,
            'conceptos_por_mes', 4,
            'fecha_inicio', v_fec_inicio,
            'datos_plan', jsonb_build_object(
                'id_arrendador', v_id_arrendador,
                'precio_m2', v_precio_m2,
                'construccion_m2', v_construccion_m2,
                'pm2_admin', v_pm2_admin,
                'pm2_mtto', v_pm2_mtto,
                'pm2_vig', v_pm2_vig,
                'inpc', v_inpc,
                'inpc_plus', v_inpc_plus
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