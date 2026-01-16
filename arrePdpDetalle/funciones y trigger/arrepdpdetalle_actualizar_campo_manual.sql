--[Fecha y Hora]: 23/10/2025 14:32:00
--[Descripción]: Actualiza un campo específico en todos los registros de arrePdpDetalle
--                que pertenecen a un plan específico (idArrePdp), para un concepto 
--                determinado, desde un año determinado en adelante. Cuando se modifica
--                INPC o ptsINPC en años >= 2, recalcula automáticamente el pm2 de los
--                años posteriores basándose en el pm2 del año anterior más el INPCTotal.
--                El INPC se aplica igual en todos los años a partir del año 2.
--
--[Parámetros]: 
--   - p_id_arre_pdp (text): ID del plan de arreglo de pagos
--   - p_anio_desde (smallint): Año a partir del cual se actualizarán los registros (inclusive)
--   - p_concepto (text): Concepto específico a actualizar (ej: "Renta", "Mantenimiento", etc.)
--   - p_nombre_campo (text): Nombre del campo a actualizar ('INPC', 'ptsINPC', 'constM2', 'pm2')
--   - p_valor (real): Nuevo valor a aplicar al campo especificado
--
--[Salida]: JSONB con estructura estándar de respuesta
--
--[Campos permitidos]: INPC, ptsINPC, constM2, pm2 (validación para seguridad)
--
--[Comportamiento especial]: 
--   - Si se modifica INPC o ptsINPC y p_anio_desde >= 2:
--     * Obtiene el pm2 del año anterior (p_anio_desde - 1)
--     * Calcula INPCTotal = INPC + ptsINPC
--     * Calcula nuevo_pm2 = pm2_anterior + (pm2_anterior * INPCTotal / 100)
--     * Actualiza pm2 para todos los años >= p_anio_desde (mismo valor)
--     * El INPC se aplica igual en todos los años >= 2
--
--[Uso típico]: Actualización manual de valores específicos en contratos de arrendamiento
--               cuando se requiere ajustar montos o índices de manera controlada.
--
--[Ejemplos de uso]: 
--   SELECT arrepdpdetalle_actualizar_campo_manual('Plan123', 2, 'Renta', 'pm2', 5.2);
--   SELECT arrepdpdetalle_actualizar_campo_manual('Plan123', 2, 'Renta', 'INPC', 3.0);
--   SELECT arrepdpdetalle_actualizar_campo_manual('Plan123', 2, 'Renta', 'ptsINPC', 2.0);
--
--[Relaciones]: 
--   - Tabla principal: public."arrePdpDetalle"
--   - Tabla relacionada: public.inpc (para validación de INPC)
--
--[Validaciones]:
--   - Validación de parámetros no nulos
--   - Validación de campos permitidos (seguridad anti-inyección SQL)
--   - Verificación de existencia de registros
--   - Para recálculo de pm2: verifica existencia de pm2 válido en año anterior
--   - Manejo de errores con códigos estandarizados
--
--[Códigos de respuesta]: EXITO, PARAMETRO_INVALIDO, REGISTRO_NO_EXISTE, ERROR_BASE_DATOS, ERROR_VALIDACION, EXITO_CON_RECALCULO
--
--[Consideraciones de seguridad]: 
--   - Usa SQL dinámico con validación estricta de campos permitidos
--   - Previene inyección SQL mediante whitelist de campos
--   - SECURITY INVOKER (ejecuta con permisos del usuario que llama)
--
--[Notas importantes del recálculo]:
--   - El recálculo automático de pm2 solo aplica para INPC o ptsINPC
--   - Solo se activa cuando p_anio_desde >= 2
--   - Preserva valores manuales (no actualiza pm2 = 0)
--   - El trigger de cálculo de cantidad se activa automáticamente
--   - El pm2 calculado se aplica igual para todos los años >= p_anio_desde
--   - El INPC/ptsINPC se aplican igual para todos los años >= p_anio_desde

CREATE OR REPLACE FUNCTION public.arrepdpdetalle_actualizar_campo_manual(
    p_id_arre_pdp text,
    p_anio_desde smallint,
    p_concepto text,
    p_nombre_campo text,
    p_valor real
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $BODY$
DECLARE
    -- Variables existentes
    registros_actualizados integer := 0;
    registros_encontrados integer := 0;
    sql_dinamico text;
    campos_permitidos text[] := ARRAY['INPC', 'ptsINPC', 'constM2', 'pm2'];
    
    -- Nuevas variables para el cálculo de pm2
    pm2_anterior real := 0;
    inpc_actual real := 0;
    ptsinpc_actual real := 0;
    inpc_total real := 0;
    nuevo_pm2 real := 0;
    registros_pm2_actualizados integer := 0;
    debe_recalcular_pm2 boolean := false;
    anio_para_recalculo smallint;
BEGIN
    -- Validación de parámetros requeridos
    IF p_id_arre_pdp IS NULL OR TRIM(p_id_arre_pdp) = '' THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PARAMETRO_INVALIDO',
            'mensaje', 'El parámetro idArrePdp es requerido y no puede estar vacío'
        );
    END IF;
    
    IF p_anio_desde IS NULL OR p_anio_desde <= 0 THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PARAMETRO_INVALIDO',
            'mensaje', 'El parámetro anio_desde debe ser un número positivo'
        );
    END IF;
    
    IF p_concepto IS NULL OR TRIM(p_concepto) = '' THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PARAMETRO_INVALIDO',
            'mensaje', 'El parámetro concepto es requerido y no puede estar vacío'
        );
    END IF;
    
    IF p_nombre_campo IS NULL OR TRIM(p_nombre_campo) = '' THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PARAMETRO_INVALIDO',
            'mensaje', 'El parámetro nombre_campo es requerido y no puede estar vacío'
        );
    END IF;
    
    -- Validar que el campo está en la lista de campos permitidos (seguridad anti-inyección SQL)
    IF NOT (p_nombre_campo = ANY(campos_permitidos)) THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PARAMETRO_INVALIDO',
            'mensaje', 'Campo no permitido. Campos válidos: ' || array_to_string(campos_permitidos, ', ')
        );
    END IF;
    
    IF p_valor IS NULL THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PARAMETRO_INVALIDO',
            'mensaje', 'El parámetro valor es requerido'
        );
    END IF;
    
    -- Verificar que existe al menos un registro con el idArrePdp especificado
    IF NOT EXISTS (
        SELECT 1 FROM public."arrePdpDetalle" 
        WHERE "idArrePdp" = p_id_arre_pdp AND status = true
    ) THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'REGISTRO_NO_EXISTE',
            'mensaje', 'No se encontraron registros para el plan especificado'
        );
    END IF;
    
    -- Verificar que existe al menos un registro con el concepto especificado
    IF NOT EXISTS (
        SELECT 1 FROM public."arrePdpDetalle" 
        WHERE "idArrePdp" = p_id_arre_pdp 
          AND concepto = p_concepto
          AND status = true
    ) THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'REGISTRO_NO_EXISTE',
            'mensaje', 'No se encontraron registros con el concepto "' || p_concepto || '" para este plan'
        );
    END IF;
    
    -- Contar registros que coinciden con todos los criterios antes de actualizar
    SELECT COUNT(*) INTO registros_encontrados
    FROM public."arrePdpDetalle" 
    WHERE "idArrePdp" = p_id_arre_pdp 
      AND concepto = p_concepto
      AND anio >= p_anio_desde 
      AND status = true;
    
    -- Verificar que existen registros con el año especificado o superior para el concepto
    IF registros_encontrados = 0 THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'REGISTRO_NO_EXISTE',
            'mensaje', 'No se encontraron registros del concepto "' || p_concepto || '" para el año ' || p_anio_desde || ' o superiores en este plan'
        );
    END IF;
    
    -- Nueva lógica: Determinar si se debe recalcular pm2
    -- El recálculo solo aplica para INPC o ptsINPC y cuando el año_desde >= 2
    IF p_nombre_campo IN ('INPC', 'ptsINPC') AND p_anio_desde >= 2 THEN
        debe_recalcular_pm2 := true;
        anio_para_recalculo := p_anio_desde;
    END IF;
    
    -- Construir y ejecutar la consulta SQL dinámica de forma segura
    CASE p_nombre_campo
        WHEN 'pm2' THEN
            sql_dinamico := 'UPDATE public."arrePdpDetalle" SET pm2 = $1 WHERE "idArrePdp" = $2 AND concepto = $3 AND anio >= $4 AND status = true';
        WHEN 'INPC' THEN
            sql_dinamico := 'UPDATE public."arrePdpDetalle" SET "INPC" = $1 WHERE "idArrePdp" = $2 AND concepto = $3 AND anio >= $4 AND status = true';
        WHEN 'ptsINPC' THEN
            sql_dinamico := 'UPDATE public."arrePdpDetalle" SET "ptsINPC" = $1 WHERE "idArrePdp" = $2 AND concepto = $3 AND anio >= $4 AND status = true';
        WHEN 'constM2' THEN
            sql_dinamico := 'UPDATE public."arrePdpDetalle" SET "constM2" = $1 WHERE "idArrePdp" = $2 AND concepto = $3 AND anio >= $4 AND status = true';
        ELSE
            -- Este caso nunca debería ocurrir por la validación anterior, pero por seguridad
            RETURN jsonb_build_object(
                'exito', false,
                'codigo', 'ERROR_GENERAL',
                'mensaje', 'Campo no reconocido en la construcción SQL: ' || p_nombre_campo
            );
    END CASE;
    
    -- Ejecutar la actualización con parámetros seguros
    EXECUTE sql_dinamico USING p_valor, p_id_arre_pdp, p_concepto, p_anio_desde;
    
    -- Obtener cantidad de registros actualizados
    GET DIAGNOSTICS registros_actualizados = ROW_COUNT;
    
    -- Verificar que se actualizó al menos un registro
    IF registros_actualizados = 0 THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'ERROR_BASE_DATOS',
            'mensaje', 'No se pudo actualizar ningún registro. Verifica los criterios de búsqueda'
        );
    END IF;
    
    -- Nueva lógica: Recálculo de pm2 si es necesario
    IF debe_recalcular_pm2 THEN
        -- 1. Obtener el pm2 del año anterior
        SELECT pm2 INTO pm2_anterior
        FROM public."arrePdpDetalle"
        WHERE "idArrePdp" = p_id_arre_pdp
          AND concepto = p_concepto
          AND anio = (anio_para_recalculo - 1)
          AND status = true
          AND pm2 > 0  -- Solo si tiene un pm2 válido
        LIMIT 1;
        
        -- Verificar que encontramos un pm2 válido
        IF pm2_anterior IS NULL OR pm2_anterior = 0 THEN
            RETURN jsonb_build_object(
                'exito', false,
                'codigo', 'ERROR_VALIDACION',
                'mensaje', 'No se encontró un pm2 válido en el año anterior (' || (anio_para_recalculo - 1) || ') para el concepto "' || p_concepto || '". No se puede realizar el recálculo automático.'
            );
        END IF;
        
        -- 2. Obtener los valores actuales de INPC y ptsINPC (después de la actualización)
        SELECT COALESCE("INPC", 0), COALESCE("ptsINPC", 0) 
        INTO inpc_actual, ptsinpc_actual
        FROM public."arrePdpDetalle"
        WHERE "idArrePdp" = p_id_arre_pdp
          AND concepto = p_concepto
          AND anio = anio_para_recalculo
          AND status = true
        LIMIT 1;
        
        -- 3. Calcular el INPCTotal
        inpc_total := inpc_actual + ptsinpc_actual;
        
        -- 4. Calcular el nuevo pm2
        nuevo_pm2 := pm2_anterior + (pm2_anterior * inpc_total / 100);
        
        -- 5. Actualizar pm2 para todos los años >= anio_para_recalculo
        UPDATE public."arrePdpDetalle"
        SET pm2 = nuevo_pm2
        WHERE "idArrePdp" = p_id_arre_pdp
          AND concepto = p_concepto
          AND anio >= anio_para_recalculo
          AND status = true
          AND pm2 > 0;  -- Solo actualizar registros que ya tenían pm2 > 0
          
        GET DIAGNOSTICS registros_pm2_actualizados = ROW_COUNT;
    END IF;
    
    -- Retorno exitoso con detalles (incluyendo información del recálculo si aplica)
    IF debe_recalcular_pm2 THEN
        RETURN jsonb_build_object(
            'exito', true,
            'codigo', 'EXITO_CON_RECALCULO',
            'mensaje', 'Campo "' || p_nombre_campo || '" actualizado y pm2 recalculado para el concepto "' || p_concepto || '"',
            'detalles', jsonb_build_object(
                'registros_encontrados', registros_encontrados,
                'registros_actualizados', registros_actualizados,
                'id_plan', p_id_arre_pdp,
                'concepto', p_concepto,
                'campo_actualizado', p_nombre_campo,
                'anio_desde', p_anio_desde,
                'nuevo_valor', p_valor,
                'pm2_anterior', pm2_anterior,
                'inpc_total', inpc_total,
                'nuevo_pm2', nuevo_pm2,
                'registros_pm2_actualizados', registros_pm2_actualizados,
                'timestamp', NOW()
            )
        );
    ELSE
        RETURN jsonb_build_object(
            'exito', true,
            'codigo', 'EXITO',
            'mensaje', 'Campo "' || p_nombre_campo || '" actualizado correctamente para el concepto "' || p_concepto || '"',
            'detalles', jsonb_build_object(
                'registros_encontrados', registros_encontrados,
                'registros_actualizados', registros_actualizados,
                'id_plan', p_id_arre_pdp,
                'concepto', p_concepto,
                'campo_actualizado', p_nombre_campo,
                'anio_desde', p_anio_desde,
                'nuevo_valor', p_valor,
                'timestamp', NOW()
            )
        );
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'ERROR_GENERAL',
            'mensaje', 'Error: ' || SQLERRM,
            'detalles', jsonb_build_object('sqlstate', SQLSTATE)
        );
END;
$BODY$;