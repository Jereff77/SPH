--[Fecha y Hora]: 27/11/2025 18:04:00
--[Descripción]: Función que agrega un concepto financiado a un plan de pagos existente
--                Permite agregar un concepto con monto a financiar que puede ser dividido
--                entre un período de meses o aplicado completamente cada mes.
--
--[Parámetros]:
--   - p_id_arre_pdp (text): ID del plan de pagos existente
--   - p_concepto (text): Nombre/descripción del concepto a agregar
--   - p_monto_financiar (double precision): Monto total a financiar
--   - p_mes_inicio (integer): Mes de inicio (1-12)
--   - p_periodo (integer): Número de meses que durará el financiamiento
--   - p_dividir (boolean): true = divide el monto entre el período, false = aplica el monto completo cada mes
--
--[Salida]:
--   - jsonb: JSON con estadísticas completas de la operación
--
--[Uso típico]: Se utiliza para agregar conceptos adicionales a planes de pago existentes,
--               como cuotas extras, seguros, servicios adicionales o ajustes contractuales.
--               Puede aplicarse en cualquier momento del plan de pago.
--
--[Ejemplo]:
--   -- Agregar concepto financiado dividiendo el monto
--   SELECT * FROM arrepdp_agregar_concepto_financiado(
--       'PDP_241201010530_abc12345', 'Cuota Extra', 12000.0, 3, 6, true);
--
--   -- Agregar concepto con monto completo cada mes
--   SELECT * FROM arrepdp_agregar_concepto_financiado(
--       'PDP_241201010530_abc12345', 'Seguro Anual', 5000.0, 5, 3, false);
--
--[Relaciones]:
--   - Tabla principal: public."arrePdp" (lectura de datos del plan)
--   - Tabla destino: public."arrePdpDetalle" (inserción de registros)
--   - Funciones relacionadas: arrepdp_crear_plan_completo_rpc, arrepdp_crear_plan_simple_rpc
--
--[Validaciones]:
--   - Verifica que el ID del plan no sea nulo o vacío
--   - Verifica que el concepto no sea nulo o vacío
--   - Verifica que el plan exista en arrePdp
--   - Verifica que no exista un concepto duplicado en el mismo mes para este plan
--   - Valida que los parámetros numéricos sean positivos
--   - Valida que el mes de inicio esté entre 1 y 12
--   - Valida que el período sea mayor a 0
--   - Verifica que los datos del plan estén completos (uid, idArrendador, fecInicio, plazo)
--
--[Lógica de cálculo]:
--   - Calcula el monto mensual según el parámetro p_dividir:
--     * Si p_dividir = true: monto_mensual = p_monto_financiar / p_periodo
--     * Si p_dividir = false: monto_mensual = p_monto_financiar
--   - Genera partidas desde p_mes_inicio durante p_periodo meses
--   - Usa pm2 = monto_mensual y constM2 = 1 para que cantidad = monto_mensual
--   - Aplica valores de INPC base del plan sin adicionales
--   - Calcula automáticamente el año según el mes de inicio
--
--[Consideraciones de seguridad]:
--   - Función con SECURITY INVOKER para respetar permisos del usuario
--   - Manejo robusto de errores con códigos estandarizados
--   - Transacción implícita para consistencia de datos
--
--[Consideraciones de rendimiento]:
--   - Función que inserta múltiples registros en un ciclo
--   - Optimizada para períodos razonables (hasta 120 meses recomendado)
--   - Usa generación de IDs únicos para evitar conflictos
--
--[Notas importantes]:
--   - Complementa a las funciones de generación de corridas existentes
--   - Permite flexibilidad en la forma de aplicar los montos (dividido o completo)
--   - Genera IDs únicos para cada partida usando timestamp y hash aleatorio para evitar duplicados
--   - Aplica INPC base del plan sin valores adicionales
--   - Las fechas se calculan a partir de la fecha de inicio del plan
--   - No modifica el plan original, solo agrega partidas adicionales
--
--[Actualización]: 27/11/2025 - Documentación completa según estándares del proyecto

CREATE OR REPLACE FUNCTION public.arrepdp_agregar_concepto_financiado(
    p_id_arre_pdp text,
    p_concepto text,
    p_monto_financiar double precision,
    p_mes_inicio integer,
    p_periodo integer,
    p_dividir boolean DEFAULT true
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
    v_inpc_base double precision;
    v_inpc_plus_base double precision;
    
    -- Variables para cálculos
    v_monto_mensual double precision;
    v_inpc_total double precision;
    v_pts_inpc_total double precision;
    
    -- Variables de control
    mes_actual integer := 1;
    fecha_actual date;
    anio_actual smallint;
    partidas_insertadas integer := 0;
    sql_error text;
    
    -- Variables para verificar si el plan existe
    v_plan_existente boolean;
    
    -- Variables para resumen de montos
    v_total_concepto double precision := 0.0;
BEGIN
    -- [Descripción]: Función que agrega un concepto financiado a un plan existente
    
    -- Validaciones de parámetros obligatorios
    IF p_id_arre_pdp IS NULL OR TRIM(p_id_arre_pdp) = '' THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PARAMETRO_INVALIDO',
            'mensaje', 'El ID del plan es obligatorio'
        );
    END IF;
    
    IF p_concepto IS NULL OR TRIM(p_concepto) = '' THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PARAMETRO_INVALIDO',
            'mensaje', 'El concepto es obligatorio'
        );
    END IF;
    
    -- Validar que los parámetros numéricos sean válidos
    IF p_monto_financiar IS NULL OR p_monto_financiar <= 0 THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PARAMETRO_INVALIDO',
            'mensaje', 'El monto a financiar debe ser mayor a 0'
        );
    END IF;
    
    IF p_mes_inicio IS NULL OR p_mes_inicio < 1 OR p_mes_inicio > 12 THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PARAMETRO_INVALIDO',
            'mensaje', 'El mes de inicio debe estar entre 1 y 12'
        );
    END IF;
    
    IF p_periodo IS NULL OR p_periodo <= 0 THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PARAMETRO_INVALIDO',
            'mensaje', 'El período debe ser mayor a 0'
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
    
    -- Verificar que no exista el mismo concepto en el mismo mes para este plan
    DECLARE
        v_concepto_duplicado boolean;
        v_conteo_existente integer;
    BEGIN
        -- Contar cuántas veces ya existe este mismo concepto para este plan en el mismo mes
        SELECT COUNT(*) INTO v_conteo_existente
        FROM public."arrePdpDetalle"
        WHERE "idArrePdp" = p_id_arre_pdp
        AND "numPartida" = p_mes_inicio
        AND "concepto" = p_concepto
        AND "status" = true;
        
        -- Si ya existe este mismo concepto en este mes, no permitir duplicarlo
        IF v_conteo_existente > 0 THEN
            RETURN jsonb_build_object(
                'exito', false,
                'codigo', 'CONCEPTO_DUPLICADO',
                'mensaje', 'El concepto especificado ya existe en este mes para este plan. No se permiten conceptos duplicados.',
                'detalles', jsonb_build_object(
                    'id_plan', p_id_arre_pdp,
                    'mes', p_mes_inicio,
                    'concepto', p_concepto,
                    'veces_existente', v_conteo_existente
                )
            );
        END IF;
    END;
    
    -- Obtener datos del plan principal
    SELECT
        "uid",
        "idArrendador",
        "fecInicio",
        "plazo",
        "INPC",
        "INPCPlus"
    INTO
        v_uid,
        v_id_arrendador,
        v_fec_inicio,
        v_plazo,
        v_inpc_base,
        v_inpc_plus_base
    FROM public."arrePdp"
    WHERE "idArrePdp" = p_id_arre_pdp;
    
    -- Validar que los campos necesarios no sean nulos
    IF v_uid IS NULL OR v_id_arrendador IS NULL OR v_fec_inicio IS NULL 
       OR v_plazo IS NULL THEN
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
    
    -- Calcular monto mensual según el parámetro p_dividir
    IF p_dividir THEN
        v_monto_mensual := p_monto_financiar / p_periodo;
    ELSE
        v_monto_mensual := p_monto_financiar;
    END IF;
    
    -- Calcular totales de INPC (sin adicionales para esta función)
    v_inpc_total := COALESCE(v_inpc_base, 0.0);
    v_pts_inpc_total := COALESCE(v_inpc_plus_base, 0.0);
    
    -- Calcular fecha de inicio para el concepto
    fecha_actual := v_fec_inicio + (p_mes_inicio - 1 || ' months')::INTERVAL;
    
    -- Insertar partidas del concepto financiado
    FOR mes_actual IN 1..p_periodo LOOP
        -- Calcular año actual: ((mes_inicio + mes_actual - 2)/12)+1
        anio_actual := ((p_mes_inicio + mes_actual - 2) / 12 + 1)::smallint;
        
        -- Insertar concepto financiado
        INSERT INTO public."arrePdpDetalle" (
            "idArrePdpDet", "fc", "status", "uidc", "idArrePdp", "tipoOperacion",
            "numPartida", "concepto", "fecha", "pm2", "constM2",
            "INPC", "ptsINPC", "anio", "inc_x_inpc", "ciclo"
        ) VALUES (
            'CF_' || to_char(CURRENT_TIMESTAMP, 'YYYYMMDDHH24MISS') || '_' ||
            substr(md5(random()::text), 1, 8) || '_' ||
            p_id_arre_pdp || '_' || LPAD((p_mes_inicio + mes_actual - 1)::text, 3, '0'),
            NOW(), true, v_uid, p_id_arre_pdp, 1,
            p_mes_inicio + mes_actual - 1, p_concepto, fecha_actual, v_monto_mensual, 1.0,
            v_inpc_total, v_pts_inpc_total, anio_actual, 0.0, EXTRACT(YEAR FROM v_fec_inicio)::integer
        );
        
        v_total_concepto := v_total_concepto + v_monto_mensual;
        partidas_insertadas := partidas_insertadas + 1;
        
        -- Avanzar al siguiente mes
        fecha_actual := fecha_actual + INTERVAL '1 month';
    END LOOP;
    
    -- Retorno exitoso con estadísticas completas
    RETURN jsonb_build_object(
        'exito', true,
        'codigo', 'EXITO',
        'mensaje', 'Concepto financiado agregado correctamente',
        'detalles', jsonb_build_object(
            'id_plan', p_id_arre_pdp,
            'concepto', p_concepto,
            'monto_financiar', p_monto_financiar,
            'mes_inicio', p_mes_inicio,
            'periodo', p_periodo,
            'dividir', p_dividir,
            'monto_mensual_calculado', v_monto_mensual,
            'partidas_insertadas', partidas_insertadas,
            'fecha_inicio', v_fec_inicio,
            'inpc_base', COALESCE(v_inpc_base, 0.0),
            'pts_inpc_base', COALESCE(v_inpc_plus_base, 0.0),
            'resumen_montos', jsonb_build_object(
                'monto_total_financiado', p_monto_financiar,
                'monto_total_aplicado', v_total_concepto,
                'diferencia', v_total_concepto - p_monto_financiar,
                'monto_por_partida', v_monto_mensual
            ),
            'datos_plan', jsonb_build_object(
                'id_arrendador', v_id_arrendador,
                'plazo_original', v_plazo
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