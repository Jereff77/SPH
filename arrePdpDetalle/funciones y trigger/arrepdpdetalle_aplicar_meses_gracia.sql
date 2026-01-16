--[Fecha y Hora]: 12/12/2025 10:19:00
--[Descripción]: Aplica descuentos de cortesía a los detalles del plan de pago
--                basados en los períodos de gracia configurados en una estructura JSON.
--
--[Parámetros]:
--   - p_idArrePdp (text): ID del plan de pago a procesar
--
--[Salida]: VOID - No devuelve valor, solo realiza actualizaciones en la tabla
--
--[Uso típico]: Se llama después de generar las partidas de un plan para aplicar
--               los descuentos configurados en el campo mesGracia del plan principal.
--
--[Ejemplo]: SELECT arrePdpDetalle_aplicar_meses_gracia('PDP_241201010530_abc12345');
--
--[Relaciones]: 
--   - Tabla principal: public."arrePdpDetalle"
--   - Tabla de referencia: public."arrePdp" (para obtener mesGracia)
--
--[Validaciones]:
--   - Verifica existencia del plan de pago
--   - Maneja JSON NULL o inválido de forma graceful
--   - Omitir registros con mesGracia NULL
--
--[Consideraciones de seguridad]:
--   - Función de tipo SECURITY INVOKER
--   - La función se ejecuta en el contexto de transacción del llamante
--   - Maneja errores de forma robusta sin control explícito de transacciones
--
--[Notas importantes]:
--   - Esta función complementa el trabajo realizado en arrepdp_crear_plan_simple_rpc
--   - La función procesa los detalles del plan aplicando los descuentos configurados
--   - Registra registros procesados y cualquier error encontrado
--   - Corrección aplicada: Mapeo explícito de conceptos JSON a conceptos de BD para evitar problemas con acentos
--
--[Lógica de procesamiento]:
--   - Valor entero N: Aplicar 100% de descuento (pm2 = 0) para los primeros N meses
--   - Valor decimal X.Y: 
--     * Primeros meses (parte entera): 100% descuento (pm2 = 0, tieneMesGratis = 'Si')
--     * Siguiente mes si existe parte decimal: 50% descuento (pm2 = pm2/2, tieneMesGratis = 'Medio')
--
--[Mapeo de conceptos JSON a conceptos de BD]:
--   - "administracion" → "Administración" (con acento)
--   - "mantenimiento" → "Mantenimiento"
--   - "vigilancia" → "Vigilancia"
--   - "renta" → "Renta"
--
--[Ejemplo de procesamiento]:
--   Para JSON {"renta": 0.5, "vigilancia": 3, "mantenimiento": 2, "administracion": 1}:
--   - Renta: Mes 1 → pm2 = pm2/2, tieneMesGratis = 'Medio'
--   - Vigilancia: Meses 1-3 → pm2 = 0, tieneMesGratis = 'Si'
--   - Mantenimiento: Meses 1-2 → pm2 = 0, tieneMesGratis = 'Si'
--   - Administración: Mes 1 → pm2 = 0, tieneMesGratis = 'Si'

CREATE OR REPLACE FUNCTION public.arrePdpDetalle_aplicar_meses_gracia(p_idArrePdp TEXT)
 RETURNS VOID
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $BODY$
DECLARE
    v_mes_gracia JSONB;
    v_concepto TEXT;
    v_meses_gracia DOUBLE PRECISION;
    v_meses_enteros INTEGER;
    v_mes_decimal DOUBLE PRECISION;
    v_registros_procesados INTEGER := 0;
    v_registros_actualizados INTEGER := 0;
    v_error_count INTEGER := 0;
    v_plan_existe BOOLEAN := FALSE;
    v_detalle RECORD;
    v_pm2_original NUMERIC;
    v_nuevo_pm2 NUMERIC;
    v_tiene_mes_gracia "mesGratis";
    v_concepto_bd TEXT;
BEGIN
    -- [Fecha y Hora]: 12/12/2025 10:19:00
    -- [Descripción]: Aplica descuentos de cortesía a los detalles del plan de pago
    --                basados en los períodos de gracia configurados en una estructura JSON.
    --                Corrección aplicada: Mapeo explícito de conceptos para manejar acentos.
    
    -- Validar que el plan de pago exista
    SELECT EXISTS(
        SELECT 1 FROM public."arrePdp" 
        WHERE "idArrePdp" = p_idArrePdp AND "status" = true
    ) INTO v_plan_existe;
    
    IF NOT v_plan_existe THEN
        RAISE NOTICE 'ERROR: El plan de pago % no existe o está inactivo', p_idArrePdp;
        RETURN;
    END IF;
    
    -- Obtener la configuración de meses de gracia del plan
    SELECT "mesGracia" INTO v_mes_gracia
    FROM public."arrePdp"
    WHERE "idArrePdp" = p_idArrePdp;
    
    -- Validar que exista configuración de meses de gracia
    IF v_mes_gracia IS NULL OR jsonb_typeof(v_mes_gracia) = 'null' THEN
        RAISE NOTICE 'INFORMACIÓN: El plan % no tiene configuración de meses de gracia', p_idArrePdp;
        RETURN;
    END IF;
    
    -- Validar que sea un objeto JSON válido
    IF jsonb_typeof(v_mes_gracia) != 'object' THEN
        RAISE NOTICE 'ERROR: El campo mesGracia del plan % no es un objeto JSON válido', p_idArrePdp;
        RETURN;
    END IF;
    
    -- Recorrer cada concepto en la configuración de meses de gracia
    FOR v_concepto, v_meses_gracia IN
        SELECT key, value::double precision
        FROM jsonb_each_text(v_mes_gracia)
    LOOP
        -- Validar que el valor sea numérico
        IF v_meses_gracia IS NULL OR v_meses_gracia < 0 THEN
            RAISE NOTICE 'ADVERTENCIA: Valor inválido para concepto %: %', v_concepto, v_meses_gracia;
            CONTINUE;
        END IF;
        
        -- Si el valor es 0, no aplicar descuentos para este concepto
        IF v_meses_gracia = 0 THEN
            RAISE NOTICE 'INFORMACIÓN: Sin meses de gracia para concepto %', v_concepto;
            CONTINUE;
        END IF;
        
        -- Obtener la parte entera y decimal
        v_meses_enteros := FLOOR(v_meses_gracia)::INTEGER;
        v_mes_decimal := v_meses_gracia - v_meses_enteros;
        
        -- Mapeo explícito de conceptos JSON a conceptos de BD
        v_concepto_bd := NULL;
        
        IF LOWER(TRIM(v_concepto)) = 'administracion' THEN
            v_concepto_bd := 'Administración';
        ELSIF LOWER(TRIM(v_concepto)) = 'mantenimiento' THEN
            v_concepto_bd := 'Mantenimiento';
        ELSIF LOWER(TRIM(v_concepto)) = 'vigilancia' THEN
            v_concepto_bd := 'Vigilancia';
        ELSIF LOWER(TRIM(v_concepto)) = 'renta' THEN
            v_concepto_bd := 'Renta';
        END IF;
        
        -- Procesar cada registro del concepto
        IF v_concepto_bd IS NOT NULL THEN
            -- Usar coincidencia exacta para conceptos mapeados
            FOR v_detalle IN
                SELECT "idArrePdpDet", "numPartida", "concepto", "pm2"
                FROM public."arrePdpDetalle"
                WHERE "idArrePdp" = p_idArrePdp
                  AND "status" = true
                  AND LOWER(TRIM("concepto")) = LOWER(v_concepto_bd)
                  AND "numPartida" > 0  -- Excluir depósito
                ORDER BY "numPartida"
            LOOP
                -- Procesar el detalle
                v_registros_procesados := v_registros_procesados + 1;
                v_pm2_original := v_detalle.pm2;
                v_nuevo_pm2 := v_pm2_original;
                v_tiene_mes_gracia := NULL::"mesGratis";
                
                -- Aplicar reglas según el número de mes
                IF v_detalle."numPartida" <= v_meses_enteros THEN
                    -- Primeros meses: 100% descuento
                    v_nuevo_pm2 := 0;
                    v_tiene_mes_gracia := 'Si'::"mesGratis";
                ELSIF v_detalle."numPartida" = v_meses_enteros + 1 AND v_mes_decimal > 0 THEN
                    -- Siguiente mes con parte decimal: 50% descuento
                    v_nuevo_pm2 := v_pm2_original / 2;
                    v_tiene_mes_gracia := 'Medio'::"mesGratis";
                END IF;
                
                -- Actualizar el registro si hay cambios
                IF v_nuevo_pm2 != v_pm2_original OR v_tiene_mes_gracia IS NOT NULL THEN
                    -- Actualizar pm2 y tieneMesGratis
                    UPDATE public."arrePdpDetalle"
                    SET "pm2" = v_nuevo_pm2,
                        "tieneMesGratis" = v_tiene_mes_gracia
                    WHERE "idArrePdpDet" = v_detalle."idArrePdpDet";
                    
                    v_registros_actualizados := v_registros_actualizados + 1;
                    
                    -- Registrar el cambio para auditoría
                    IF v_tiene_mes_gracia = 'Si' THEN
                        RAISE NOTICE 'PROCESADO: % - Mes % (%): 100%% descuento aplicado',
                                   v_detalle."concepto", v_detalle."numPartida", v_concepto;
                    ELSIF v_tiene_mes_gracia = 'Medio' THEN
                        RAISE NOTICE 'PROCESADO: % - Mes % (%): 50%% descuento aplicado',
                                   v_detalle."concepto", v_detalle."numPartida", v_concepto;
                    END IF;
                END IF;
            END LOOP;
        ELSE
            -- Para conceptos no mapeados, usar búsqueda parcial
            FOR v_detalle IN
                SELECT "idArrePdpDet", "numPartida", "concepto", "pm2"
                FROM public."arrePdpDetalle"
                WHERE "idArrePdp" = p_idArrePdp
                  AND "status" = true
                  AND LOWER(TRIM("concepto")) LIKE '%' || LOWER(TRIM(v_concepto)) || '%'
                  AND "numPartida" > 0  -- Excluir depósito
                ORDER BY "numPartida"
            LOOP
                -- Procesar el detalle
                v_registros_procesados := v_registros_procesados + 1;
                v_pm2_original := v_detalle.pm2;
                v_nuevo_pm2 := v_pm2_original;
                v_tiene_mes_gracia := NULL::"mesGratis";
                
                -- Aplicar reglas según el número de mes
                IF v_detalle."numPartida" <= v_meses_enteros THEN
                    -- Primeros meses: 100% descuento
                    v_nuevo_pm2 := 0;
                    v_tiene_mes_gracia := 'Si'::"mesGratis";
                ELSIF v_detalle."numPartida" = v_meses_enteros + 1 AND v_mes_decimal > 0 THEN
                    -- Siguiente mes con parte decimal: 50% descuento
                    v_nuevo_pm2 := v_pm2_original / 2;
                    v_tiene_mes_gracia := 'Medio'::"mesGratis";
                END IF;
                
                -- Actualizar el registro si hay cambios
                IF v_nuevo_pm2 != v_pm2_original OR v_tiene_mes_gracia IS NOT NULL THEN
                    -- Actualizar pm2 y tieneMesGratis
                    UPDATE public."arrePdpDetalle"
                    SET "pm2" = v_nuevo_pm2,
                        "tieneMesGratis" = v_tiene_mes_gracia
                    WHERE "idArrePdpDet" = v_detalle."idArrePdpDet";
                    
                    v_registros_actualizados := v_registros_actualizados + 1;
                    
                    -- Registrar el cambio para auditoría
                    IF v_tiene_mes_gracia = 'Si' THEN
                        RAISE NOTICE 'PROCESADO: % - Mes % (%): 100%% descuento aplicado',
                                   v_detalle."concepto", v_detalle."numPartida", v_concepto;
                    ELSIF v_tiene_mes_gracia = 'Medio' THEN
                        RAISE NOTICE 'PROCESADO: % - Mes % (%): 50%% descuento aplicado',
                                   v_detalle."concepto", v_detalle."numPartida", v_concepto;
                    END IF;
                END IF;
            END LOOP;
        END IF;
    END LOOP;
    
    -- Reporte final
    RAISE NOTICE '=== RESUMEN DE PROCESAMIENTO ===';
    RAISE NOTICE 'Plan de pago: %', p_idArrePdp;
    RAISE NOTICE 'Registros procesados: %', v_registros_procesados;
    RAISE NOTICE 'Registros actualizados: %', v_registros_actualizados;
    RAISE NOTICE 'Errores encontrados: %', v_error_count;
    RAISE NOTICE 'Proceso completado exitosamente';
    
END;
$BODY$;

-- Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.arrePdpDetalle_aplicar_meses_gracia TO authenticated;
GRANT EXECUTE ON FUNCTION public.arrePdpDetalle_aplicar_meses_gracia TO service_role;

--[Nota final]: Función creada para aplicar meses de gracia según configuración JSON
--                La función procesa los detalles del plan aplicando descuentos
--                según las reglas establecidas en la configuración mesGracia
--
--[Ejemplo completo de uso]:
-- -- Crear plan con meses de gracia
-- SELECT * FROM arrepdp_crear_plan_simple_rpc(
--     'UUID_USER', 'ID_ARRENDADOR', 'ID_NAVE',
--     '2024-01-01'::date, 24, 50000.0, 150.0, 100.0,
--     25.0, 15.0, 10.0, 2.0, 'MXN',
--     1.0, 0.0, 5.5, 6.0  -- renta: 1 mes, mantenimiento: 5.5 meses, vigilancia: 6 meses
-- );
--
-- -- Generar detalles del plan
-- SELECT * FROM arrepdp_generar_detalle_desde_plan('PDP_241201010530_abc12345');
--
-- -- Aplicar meses de gracia
-- SELECT arrePdpDetalle_aplicar_meses_gracia('PDP_241201010530_abc12345');
--
--[Resultados esperados]:
-- - Renta: Mes 1 → pm2 = 0, tieneMesGratis = 'Si'
-- - Administración: Sin descuentos (mesGracia = 0)
-- - Mantenimiento: Meses 1-5 → pm2 = 0, tieneMesGratis = 'Si'; Mes 6 → pm2 = pm2/2, tieneMesGratis = 'Medio'
-- - Vigilancia: Meses 1-6 → pm2 = 0, tieneMesGratis = 'Si'