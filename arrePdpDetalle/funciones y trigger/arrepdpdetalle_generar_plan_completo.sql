--[Fecha y Hora]: 22/10/2025 05:20:00
--[Descripción]: Genera un plan de pagos completo para un contrato de arrendamiento,
--                incluyendo depósito y todas las partidas mensuales (renta, administración,
--                mantenimiento y vigilancia) con sus respectivas cortesías.
--
--[Parámetros]:
--   - p_id_arre_pdp (text): ID del plan de pago principal
--   - p_id_arrendador (text): ID del arrendador/propietario
--   - p_uid (uuid): ID del usuario que crea el registro
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
--[Salida]: JSON con estadísticas de la operación
--
--[Lógica de cálculo]:
--   - Depósito: numPartida = 0, anio = 0, monto = p_deposito
--   - Partidas mensuales: numPartida = 1 a p_plazo, anio = ((numPartida-1)/12)+1
--   - Cortesías: monto = 0.0, pm2 = 0.0
--   - Fechas: cada mes se incrementa automáticamente
--
--[Uso]: SELECT * FROM arrepdpdetalle_generar_plan_completo(
--           'ID_PLAN', 'ID_ARRENDADOR', 'UUID_USER', 
--           '2024-01-01', 24, 50000.0, 150.0, 100.0,
--           110.5, 2.0, 25.0, 15.0, 10.0,
--           0, 1, 2, 0);
--
--[Relaciones]: 
--   - Tabla principal: public."arrePdpDetalle"
--
--[Validaciones]:
--   - Validación de parámetros obligatorios
--   - Verificación de que el plan no exista previamente
--   - Manejo estructurado de errores
--
--[Consideraciones de rendimiento]:
--   - Función masiva que inserta múltiples registros
--   - Usa transacción para consistencia de datos
--   - Optimizada para planes de hasta 60 meses
--
--[Notas importantes]:
--   - Reemplaza el código Flutter de ~300 líneas
--   - Calcula años correctamente desde el inicio
--   - Maneja cortesías por concepto de forma independiente
--   - Genera IDs únicos para cada partida

CREATE OR REPLACE FUNCTION public.arrepdpdetalle_generar_plan_completo(
    p_id_arre_pdp text,
    p_id_arrendador text,
    p_uid uuid,
    p_fec_inicio date,
    p_plazo integer,
    p_deposito double precision,
    p_precio_m2 double precision,
    p_construccion_m2 double precision,
    p_inpc double precision,
    p_inpc_plus double precision,
    p_pm2_admin double precision,
    p_pm2_mtto double precision,
    p_pm2_vig double precision,
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
    mes_actual integer := 1;
    fecha_actual date;
    anio_actual smallint;
    partidas_insertadas integer := 0;
    deposito_insertado boolean := false;
    sql_error text;
BEGIN
    -- [Descripción]: Genera un plan de pagos completo para un contrato de arrendamiento,
    --                incluyendo depósito y todas las partidas mensuales (renta, administración,
    --                mantenimiento y vigilancia) con sus respectivas cortesías.
    --
    -- [Salida]: JSON con estadísticas de la operación
    
    -- Validaciones de parámetros obligatorios
    IF p_id_arre_pdp IS NULL OR TRIM(p_id_arre_pdp) = '' THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PARAMETRO_INVALIDO',
            'mensaje', 'El ID del plan es obligatorio'
        );
    END IF;
    
    IF p_id_arrendador IS NULL OR TRIM(p_id_arrendador) = '' THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PARAMETRO_INVALIDO',
            'mensaje', 'El ID del arrendador es obligatorio'
        );
    END IF;
    
    IF p_uid IS NULL THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PARAMETRO_INVALIDO',
            'mensaje', 'El ID del usuario es obligatorio'
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
    
    -- Verificar que el plan no exista previamente
    IF EXISTS (SELECT 1 FROM public."arrePdpDetalle" WHERE "idArrePdp" = p_id_arre_pdp) THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'REGISTRO_DUPLICADO',
            'mensaje', 'El plan ya existe en la base de datos',
            'detalles', jsonb_build_object('id_plan', p_id_arre_pdp)
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
            p_id_arre_pdp || '_DEP', NOW(), true, p_uid, p_id_arre_pdp, 1,
            0, 'Deposito Garantia', p_fec_inicio, p_deposito, 0.0, 0.0,
            0.0, 0.0, 0, 0.0
        );
        
        deposito_insertado := true;
        partidas_insertadas := 1;
        
        -- 2. Insertar partidas mensuales
        fecha_actual := p_fec_inicio;
        
        WHILE mes_actual <= p_plazo LOOP
            -- Calcular año actual: ((mes-1)/12)+1
            anio_actual := ((mes_actual - 1) / 12 + 1)::smallint;
            
            -- Insertar RENTA
            IF mes_actual > p_cortesia_renta THEN
                -- Renta normal
                INSERT INTO public."arrePdpDetalle" (
                    "idArrePdpDet", "fc", "status", "uidc", "idArrePdp", "tipoOperacion",
                    "numPartida", "concepto", "fecha", "pm2", "constM2", "cantidad",
                    "INPC", "ptsINPC", "anio", "inc_x_inpc"
                ) VALUES (
                    p_id_arre_pdp || '_R_' || LPAD(mes_actual::text, 3, '0'), NOW(), true, p_uid, p_id_arre_pdp, 1,
                    mes_actual, 'Renta', fecha_actual, p_precio_m2, p_construccion_m2,
                    (p_precio_m2 * p_construccion_m2), p_inpc, p_inpc_plus, anio_actual, 0.0
                );
            ELSE
                -- Renta de cortesía
                INSERT INTO public."arrePdpDetalle" (
                    "idArrePdpDet", "fc", "status", "uidc", "idArrePdp", "tipoOperacion",
                    "numPartida", "concepto", "fecha", "pm2", "constM2", "cantidad",
                    "INPC", "ptsINPC", "anio", "inc_x_inpc"
                ) VALUES (
                    p_id_arre_pdp || '_R_' || LPAD(mes_actual::text, 3, '0'), NOW(), true, p_uid, p_id_arre_pdp, 1,
                    mes_actual, 'Renta (Cortesia)', fecha_actual, 0.0, p_construccion_m2, 0.0,
                    p_inpc, p_inpc_plus, anio_actual, 0.0
                );
            END IF;
            
            -- Insertar ADMINISTRACIÓN
            IF mes_actual > p_cortesia_admin THEN
                -- Administración normal
                INSERT INTO public."arrePdpDetalle" (
                    "idArrePdpDet", "fc", "status", "uidc", "idArrePdp", "tipoOperacion",
                    "numPartida", "concepto", "fecha", "pm2", "constM2", "cantidad",
                    "INPC", "ptsINPC", "anio", "inc_x_inpc"
                ) VALUES (
                    p_id_arre_pdp || '_A_' || LPAD(mes_actual::text, 3, '0'), NOW(), true, p_uid, p_id_arre_pdp, 1,
                    mes_actual, 'Administración', (fecha_actual + INTERVAL '1 day'), p_pm2_admin, p_construccion_m2,
                    (p_pm2_admin * p_construccion_m2), p_inpc, p_inpc_plus, anio_actual, 0.0
                );
            ELSE
                -- Administración de cortesía
                INSERT INTO public."arrePdpDetalle" (
                    "idArrePdpDet", "fc", "status", "uidc", "idArrePdp", "tipoOperacion",
                    "numPartida", "concepto", "fecha", "pm2", "constM2", "cantidad",
                    "INPC", "ptsINPC", "anio", "inc_x_inpc"
                ) VALUES (
                    p_id_arre_pdp || '_A_' || LPAD(mes_actual::text, 3, '0'), NOW(), true, p_uid, p_id_arre_pdp, 1,
                    mes_actual, 'Administración (Cortesia)', (fecha_actual + INTERVAL '1 day'), 0.0, p_construccion_m2, 0.0,
                    p_inpc, p_inpc_plus, anio_actual, 0.0
                );
            END IF;
            
            -- Insertar MANTENIMIENTO
            IF mes_actual > p_cortesia_mtto THEN
                -- Mantenimiento normal
                INSERT INTO public."arrePdpDetalle" (
                    "idArrePdpDet", "fc", "status", "uidc", "idArrePdp", "tipoOperacion",
                    "numPartida", "concepto", "fecha", "pm2", "constM2", "cantidad",
                    "INPC", "ptsINPC", "anio", "inc_x_inpc"
                ) VALUES (
                    p_id_arre_pdp || '_M_' || LPAD(mes_actual::text, 3, '0'), NOW(), true, p_uid, p_id_arre_pdp, 1,
                    mes_actual, 'Mantenimiento', (fecha_actual + INTERVAL '1 day'), p_pm2_mtto, p_construccion_m2,
                    (p_pm2_mtto * p_construccion_m2), p_inpc, p_inpc_plus, anio_actual, 0.0
                );
            ELSE
                -- Mantenimiento de cortesía
                INSERT INTO public."arrePdpDetalle" (
                    "idArrePdpDet", "fc", "status", "uidc", "idArrePdp", "tipoOperacion",
                    "numPartida", "concepto", "fecha", "pm2", "constM2", "cantidad",
                    "INPC", "ptsINPC", "anio", "inc_x_inpc"
                ) VALUES (
                    p_id_arre_pdp || '_M_' || LPAD(mes_actual::text, 3, '0'), NOW(), true, p_uid, p_id_arre_pdp, 1,
                    mes_actual, 'Mantenimiento (Cortesia)', (fecha_actual + INTERVAL '1 day'), 0.0, p_construccion_m2, 0.0,
                    p_inpc, p_inpc_plus, anio_actual, 0.0
                );
            END IF;
            
            -- Insertar VIGILANCIA
            IF mes_actual > p_cortesia_vig THEN
                -- Vigilancia normal
                INSERT INTO public."arrePdpDetalle" (
                    "idArrePdpDet", "fc", "status", "uidc", "idArrePdp", "tipoOperacion",
                    "numPartida", "concepto", "fecha", "pm2", "constM2", "cantidad",
                    "INPC", "ptsINPC", "anio", "inc_x_inpc"
                ) VALUES (
                    p_id_arre_pdp || '_V_' || LPAD(mes_actual::text, 3, '0'), NOW(), true, p_uid, p_id_arre_pdp, 1,
                    mes_actual, 'Vigilancia', (fecha_actual + INTERVAL '1 day'), p_pm2_vig, p_construccion_m2,
                    (p_pm2_vig * p_construccion_m2), p_inpc, p_inpc_plus, anio_actual, 0.0
                );
            ELSE
                -- Vigilancia de cortesía
                INSERT INTO public."arrePdpDetalle" (
                    "idArrePdpDet", "fc", "status", "uidc", "idArrePdp", "tipoOperacion",
                    "numPartida", "concepto", "fecha", "pm2", "constM2", "cantidad",
                    "INPC", "ptsINPC", "anio", "inc_x_inpc"
                ) VALUES (
                    p_id_arre_pdp || '_V_' || LPAD(mes_actual::text, 3, '0'), NOW(), true, p_uid, p_id_arre_pdp, 1,
                    mes_actual, 'Vigilancia (Cortesia)', (fecha_actual + INTERVAL '1 day'), 0.0, p_construccion_m2, 0.0,
                    p_inpc, p_inpc_plus, anio_actual, 0.0
                );
            END IF;
            
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
                'mensaje', 'Error al generar el plan: ' || sql_error,
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
        'mensaje', 'Plan de pagos generado correctamente',
        'detalles', jsonb_build_object(
            'id_plan', p_id_arre_pdp,
            'plazo_meses', p_plazo,
            'deposito_insertado', deposito_insertado,
            'partidas_totales', partidas_insertadas,
            'conceptos_por_mes', 4,
            'fecha_inicio', p_fec_inicio,
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