--[Fecha y Hora]: 21/10/2025 23:48:00
--[Descripción]: Recalcula todas las cantidades en la tabla arrePdpDetalle
--                Aplica la nueva lógica: pm2 > 0 = automático, pm2 = 0 = manual
--
--[Parámetros]: Ninguno (opera sobre toda la tabla)
--
--[Salida]: JSON con estadísticas de la operación
--
--[Uso]: SELECT arrepdpdetalle_recalcular_todas_cantidades();
--
--[Relaciones]: 
--   - Tabla principal: public."arrePdpDetalle"
--
--[Validaciones]:
--   - Solo procesa registros con status = true
--   - Distingue entre registros automáticos y manuales
--
--[Lógica aplicada]:
--   - pm2 > 0: cálculo automático usando fórmula estándar
--   - pm2 = 0 o NULL: mantiene valor manual existente
--
--[Fórmula de cálculo]: ((pm2 * "constM2") * ((1) + (("INPC" + "ptsINPC") / (100))))
--
--[Trigger asociado]: Ninguno (función de ejecución manual masiva)
--
--[Consideraciones de rendimiento]:
--   - Función masiva que procesa toda la tabla
--   - Proporciona estadísticas detalladas del proceso
--   - Manejo robusto de errores
--
--[Notas importantes]:
--   - Útil para recálculos masivos después de cambios en la lógica
--   - Respeta valores manuales cuando pm2 = 0
--   - Solo afecta registros activos (status = true)
--   - No debe ejecutarse con frecuencia por impacto en rendimiento

CREATE OR REPLACE FUNCTION public.arrepdpdetalle_recalcular_todas_cantidades()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $BODY$
DECLARE
    registros_actualizados INTEGER := 0;
    registros_manuales INTEGER := 0;
BEGIN
    -- [Descripción]: Recalcula todas las cantidades en la tabla arrePdpDetalle
    --                Aplica la nueva lógica: pm2 > 0 = automático, pm2 = 0 = manual
    -- [Retorna]: JSON con estadísticas de la operación
    -- [Uso]: SELECT arrepdpdetalle_recalcular_todas_cantidades();
    
    -- Actualizar registros donde pm2 > 0 (cálculo automático)
    UPDATE public."arrePdpDetalle"
    SET cantidad = ((pm2 * "constM2") * 
                   ((1)::double precision + 
                   (("INPC" + "ptsINPC") / (100)::double precision)))
    WHERE pm2 > 0 AND status = true;
    
    GET DIAGNOSTICS registros_actualizados = ROW_COUNT;
    
    -- Contar registros con pm2 = 0 (mantienen valor manual)
    SELECT COUNT(*) INTO registros_manuales
    FROM public."arrePdpDetalle"
    WHERE (pm2 = 0 OR pm2 IS NULL) AND status = true;
    
    RETURN jsonb_build_object(
        'exito', true,
        'codigo', 'EXITO',
        'mensaje', 'Recálculo completado exitosamente',
        'detalles', jsonb_build_object(
            'registros_recalculados', registros_actualizados,
            'registros_manuales', registros_manuales,
            'timestamp', NOW()
        )
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'ERROR_GENERAL',
            'mensaje', 'Error al recalcular cantidades: ' || SQLERRM,
            'detalles', jsonb_build_object('sqlstate', SQLSTATE)
        );
END;
$BODY$;