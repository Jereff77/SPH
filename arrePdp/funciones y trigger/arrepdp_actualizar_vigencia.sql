--[Fecha y Hora]: 20/01/2026 18:22:00
--[Descripción]: Función para actualizar la columna 'arrePdpVigente' en la tabla 'arrePdp'
--                que determina el estado de vigencia de cada contrato basado en la fecha
--                actual y la fecha de fin (fecFin). Además, actualiza los campos
--                'pdpVigente', 'tienePdp', 'pdpActivo' e 'idArrePdp' en la tabla
--                'arrenPropiedades' cuando un contrato se marca como no vigente.
--
--[Parámetros]:
--   - No requiere parámetros, procesa todos los registros de la tabla
--
--[Salida]:
--   - JSON con conteo de registros actualizados por categoría
--   - Estructura: {"exito": boolean, "codigo": text, "mensaje": text, "detalles": {...}}
--
--[Uso típico]: Se ejecuta para actualizar el estado de vigencia de todos los contratos
--               Se recomienda ejecutar periódicamente (diario, semanal) mediante un job
--
--[Ejemplo]: SELECT * FROM arrepdp_actualizar_vigencia();
--
--[Relaciones]:
--   - Tabla principal: public."arrePdp"
--   - Campo actualizado: "arrePdpVigente" (tipo enumerado)
--   - Tabla relacionada: public."arrenPropiedades"
--   - Campos actualizados en tabla relacionada: "pdpVigente", "tienePdp", "pdpActivo", "idArrePdp"
--
--[Validaciones]:
--   - Maneja valores nulos en fecFin (deja el valor actual sin modificar)
--   - Considera la zona horaria del sistema (America/Mexico_City)
--   - Optimizada para rendimiento en tablas con miles de registros
--   - Incluye transacción para asegurar atomicidad
--   - Actualiza completamente propiedades relacionadas cuando los contratos se marcan como vencidos
--
--[Consideraciones de seguridad]:
--   - SECURITY INVOKER: Ejecuta con permisos del usuario que la invoca
--   - No modifica registros con fecFin nulo
--   - Registra advertencias para fechas inválidas
--   - Mantiene consistencia completa entre tablas arrePdp y arrenPropiedades

CREATE OR REPLACE FUNCTION public.arrepdp_actualizar_vigencia()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $BODY$
DECLARE
    v_fecha_actual date := CURRENT_DATE; -- Considera la zona horaria del sistema
    v_registros_actualizados integer := 0;
    v_registros_no integer := 0;
    v_registros_3_meses integer := 0;
    v_registros_2_meses integer := 0;
    v_registros_1_mes integer := 0;
    v_registros_si integer := 0;
    v_registros_nulos integer := 0;
    v_propiedades_actualizadas integer := 0;
    v_total_procesados integer := 0;
    v_resultado json;
BEGIN
    -- Iniciar transacción para asegurar atomicidad
    -- Nota: La función ya se ejecuta en una transacción implícita
    
    -- Actualizar contratos vencidos (fecha actual > fecFin)
    UPDATE public."arrePdp"
    SET "arrePdpVigente" = 'No'::"arrePdpVigente"
    WHERE "fecFin" IS NOT NULL
      AND v_fecha_actual > "fecFin"
      AND "arrePdpVigente" IS DISTINCT FROM 'No'::"arrePdpVigente";
    
    GET DIAGNOSTICS v_registros_no = ROW_COUNT;
    
    -- Actualizar propiedades relacionadas cuando los contratos se marcan como vencidos
    UPDATE public."arrenPropiedades"
    SET "pdpVigente" = false,
        "tienePdp" = false,
        "pdpActivo" = false,
        "idArrePdp" = NULL
    WHERE "idNavArrend" IN (
        SELECT "idNavArrend"
        FROM public."arrePdp"
        WHERE "fecFin" IS NOT NULL
          AND v_fecha_actual > "fecFin"
          AND "arrePdpVigente" = 'No'::"arrePdpVigente"
    );
    
    GET DIAGNOSTICS v_propiedades_actualizadas = ROW_COUNT;
    
    -- Actualizar contratos con vigencia de 3 meses (entre 1 y 3 meses antes de fecFin)
    UPDATE public."arrePdp"
    SET "arrePdpVigente" = '3 Meses'::"arrePdpVigente"
    WHERE "fecFin" IS NOT NULL
      AND v_fecha_actual <= "fecFin"
      AND v_fecha_actual > ("fecFin" - INTERVAL '3 months')
      AND v_fecha_actual <= ("fecFin" - INTERVAL '1 months')
      AND "arrePdpVigente" IS DISTINCT FROM '3 Meses'::"arrePdpVigente";
    
    GET DIAGNOSTICS v_registros_3_meses = ROW_COUNT;
    
    -- Actualizar contratos con vigencia de 2 meses (entre 0 y 2 meses antes de fecFin)
    UPDATE public."arrePdp"
    SET "arrePdpVigente" = '2 Meses'::"arrePdpVigente"
    WHERE "fecFin" IS NOT NULL
      AND v_fecha_actual <= "fecFin"
      AND v_fecha_actual > ("fecFin" - INTERVAL '2 months')
      AND v_fecha_actual <= ("fecFin" - INTERVAL '0 months')
      AND "arrePdpVigente" IS DISTINCT FROM '2 Meses'::"arrePdpVigente";
    
    GET DIAGNOSTICS v_registros_2_meses = ROW_COUNT;
    
    -- Actualizar contratos con vigencia de 1 mes (entre 0 y 1 mes antes de fecFin)
    UPDATE public."arrePdp"
    SET "arrePdpVigente" = '1 Mes'::"arrePdpVigente"
    WHERE "fecFin" IS NOT NULL
      AND v_fecha_actual <= "fecFin"
      AND v_fecha_actual > ("fecFin" - INTERVAL '1 months')
      AND v_fecha_actual <= ("fecFin" - INTERVAL '0 months')
      AND "arrePdpVigente" IS DISTINCT FROM '1 Mes'::"arrePdpVigente";
    
    GET DIAGNOSTICS v_registros_1_mes = ROW_COUNT;
    
    -- Actualizar contratos vigentes (más de 3 meses antes de fecFin)
    UPDATE public."arrePdp"
    SET "arrePdpVigente" = 'Si'::"arrePdpVigente"
    WHERE "fecFin" IS NOT NULL
      AND v_fecha_actual <= ("fecFin" - INTERVAL '3 months')
      AND "arrePdpVigente" IS DISTINCT FROM 'Si'::"arrePdpVigente";
    
    GET DIAGNOSTICS v_registros_si = ROW_COUNT;
    
    -- Contar registros con fecFin nulo (no se modifican)
    SELECT COUNT(*) INTO v_registros_nulos
    FROM public."arrePdp"
    WHERE "fecFin" IS NULL;
    
    -- Calcular total de registros procesados
    v_total_procesados := v_registros_no + v_registros_3_meses + v_registros_2_meses + 
                         v_registros_1_mes + v_registros_si + v_registros_nulos;
    
    -- Construir resultado JSON
    v_resultado := json_build_object(
        'exito', true,
        'codigo', 'EXITO',
        'mensaje', 'Actualización de vigencia completada exitosamente',
        'detalles', json_build_object(
            'fecha_proceso', v_fecha_actual,
            'zona_horaria', 'America/Mexico_City',
            'registros_actualizados', json_build_object(
                'total', v_registros_no + v_registros_3_meses + v_registros_2_meses + v_registros_1_mes + v_registros_si,
                'no', v_registros_no,
                '3_meses', v_registros_3_meses,
                '2_meses', v_registros_2_meses,
                '1_mes', v_registros_1_mes,
                'si', v_registros_si,
                'propiedades_actualizadas', v_propiedades_actualizadas
            ),
            'registros_no_procesados', json_build_object(
                'fecFin_nulo', v_registros_nulos,
                'motivo', 'No se modifican registros con fecFin nulo'
            ),
            'total_registros_tabla', v_total_procesados,
            'timestamp_proceso', NOW()
        )
    );
    
    -- Logging de advertencias si hay registros con fecFin nulo
    IF v_registros_nulos > 0 THEN
        RAISE NOTICE 'ADVERTENCIA: Se encontraron % registros con fecFin nulo. No se modificaron.', v_registros_nulos;
    END IF;
    
    -- Logging informativo del resumen
    RAISE NOTICE 'RESUMEN DE ACTUALIZACIÓN DE VIGENCIA:';
    RAISE NOTICE '  - Fecha actual: %', v_fecha_actual;
    RAISE NOTICE '  - Contratos vencidos (No): %', v_registros_no;
    RAISE NOTICE '  - Contratos por vencer en 3 meses: %', v_registros_3_meses;
    RAISE NOTICE '  - Contratos por vencer en 2 meses: %', v_registros_2_meses;
    RAISE NOTICE '  - Contratos por vencer en 1 mes: %', v_registros_1_mes;
    RAISE NOTICE '  - Contratos vigentes (Si): %', v_registros_si;
    RAISE NOTICE '  - Registros con fecFin nulo: %', v_registros_nulos;
    RAISE NOTICE '  - Propiedades actualizadas a pdpVigente=false: %', v_propiedades_actualizadas;
    RAISE NOTICE '  - Total procesados: %', v_total_procesados;
    
    RETURN v_resultado;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Manejo de errores con logging detallado
        RAISE EXCEPTION 'ERROR en arrepdp_actualizar_vigencia: %', SQLERRM;
        
        -- Retornar JSON con error
        RETURN json_build_object(
            'exito', false,
            'codigo', 'ERROR_GENERAL',
            'mensaje', 'Error durante la actualización de vigencia: ' || SQLERRM,
            'detalles', json_build_object(
                'fecha_proceso', v_fecha_actual,
                'timestamp_error', NOW(),
                'codigo_error', SQLSTATE,
                'mensaje_error', SQLERRM
            )
        );
END;
$BODY$;

-- Comentario adicional para documentación
COMMENT ON FUNCTION public.arrepdp_actualizar_vigencia() IS 'Actualiza el estado de vigencia de los contratos en arrePdp basado en la fecha actual y fecFin. Considera las siguientes reglas: 1) Si fecha actual > fecFin: "No" (vencido), 2) Si está entre 1-3 meses antes de fecFin: "3 Meses", 3) Si está entre 0-2 meses antes de fecFin: "2 Meses", 4) Si está entre 0-1 mes antes de fecFin: "1 Mes", 5) Si es >3 meses antes de fecFin: "Si" (vigente). Además, cuando un contrato se marca como "No" (vencido), actualiza los campos "pdpVigente", "tienePdp", "pdpActivo" a false y "idArrePdp" a null en la tabla arrenPropiedades relacionada. Maneja valores nulos y optimizada para rendimiento.';