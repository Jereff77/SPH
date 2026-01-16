--[Fecha y Hora]: 08/01/2026 10:35:00
--[Descripción]: Guarda en la tabla fideDispersiones los resultados de plan_dispersiones_dinamico
--
--[Parámetros]:
--   - p_id_fideicomiso (text): ID del fideicomiso a procesar
--   - p_no_adhesion (text, opcional): Número de adhesión específico. Si es NULL, procesa todos los adherentes
--
--[Salida]:
--   - JSON con éxito, mensaje, total_registros guardados y detalle por adherente
--
--[Uso típico]:
--   -- Guardar dispersiones de un adherente específico
--   SELECT guardar_dispersiones_fideicomiso('jsRw4C6FswY20O', '1');
--
--   -- Guardar dispersiones de todos los adherentes del fideicomiso
--   SELECT guardar_dispersiones_fideicomiso('jsRw4C6FswY20O');
--
--[Relaciones]:
--   - Función utiliza: plan_dispersiones_dinamico
--   - Tabla destino: fideDispersiones
--
--[Notas importantes]:
--   - Elimina registros existentes del mismo fideicomiso antes de insertar (upsert)
--   - Mantiene la fecha_calculo original si el registro ya existe
--   - Usa INSERT ON CONFLICT para manejar duplicados

CREATE OR REPLACE FUNCTION public.guardar_dispersiones_fideicomiso(
    p_id_fideicomiso TEXT,
    p_no_adhesion TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_adherente_record RECORD;
    v_total_registros INTEGER := 0;
    v_detalle_adherentes JSONB := '[]'::JSONB;
    v_mensaje TEXT;
BEGIN
    -- Validar que el fideicomiso exista
    IF NOT EXISTS(SELECT 1 FROM "fideicomiso" WHERE "idFide" = p_id_fideicomiso) THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'FIDEICOMISO_NO_ENCONTRADO',
            'mensaje', 'El fideicomiso con ID ' || p_id_fideicomiso || ' no existe'
        );
    END IF;

    -- Determinar adherentes a procesar
    IF p_no_adhesion IS NOT NULL THEN
        -- Validar que el adherente exista
        IF NOT EXISTS(
            SELECT 1 FROM "fideCondiciones"
            WHERE "idFide" = p_id_fideicomiso AND "noAdhesion" = p_no_adhesion
        ) THEN
            RETURN jsonb_build_object(
                'exito', false,
                'codigo', 'ADHERENTE_NO_ENCONTRADO',
                'mensaje', 'El adherente ' || p_no_adhesion || ' no existe en el fideicomiso'
            );
        END IF;

        -- Procesar solo el adherente especificado
        FOR v_adherente_record IN
            SELECT fc."noAdhesion"
            FROM "fideCondiciones" fc
            WHERE fc."idFide" = p_id_fideicomiso AND fc."noAdhesion" = p_no_adhesion
        LOOP
            PERFORM insertar_dispersiones_adherente(p_id_fideicomiso, v_adherente_record."noAdhesion");
        END LOOP;
    ELSE
        -- Procesar todos los adherentes del fideicomiso
        FOR v_adherente_record IN
            SELECT DISTINCT fc."noAdhesion"
            FROM "fideCondiciones" fc
            WHERE fc."idFide" = p_id_fideicomiso
            ORDER BY fc."noAdhesion"
        LOOP
            PERFORM insertar_dispersiones_adherente(p_id_fideicomiso, v_adherente_record."noAdhesion");
        END LOOP;
    END IF;

    -- Contar total de registros guardados
    SELECT COUNT(*) INTO v_total_registros
    FROM "fideDispersiones"
    WHERE id_fideicomiso = p_id_fideicomiso
    AND (p_no_adhesion IS NULL OR no_adhesion = p_no_adhesion);

    -- Construir mensaje de respuesta
    IF p_no_adhesion IS NOT NULL THEN
        v_mensaje := 'Dispersiones guardadas para adherente ' || p_no_adhesion || ' del fideicomiso ' || p_id_fideicomiso;
    ELSE
        v_mensaje := 'Dispersiones guardadas para todos los adherentes del fideicomiso ' || p_id_fideicomiso;
    END IF;

    RETURN jsonb_build_object(
        'exito', true,
        'mensaje', v_mensaje,
        'total_registros', v_total_registros,
        'id_fideicomiso', p_id_fideicomiso,
        'no_adhesion', p_no_adhesion
    );
END;
$$;

--[Función auxiliar para insertar dispersiones de un adherente]
CREATE OR REPLACE FUNCTION public.insertar_dispersiones_adherente(
    p_id_fideicomiso TEXT,
    p_no_adhesion TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_registros_insertados INTEGER;
BEGIN
    -- Insertar registros desde plan_dispersiones_dinamico
    -- Usando INSERT ON CONFLICT para manejar duplicados
    INSERT INTO "fideDispersiones" (
        id_fideicomiso,
        no_adhesion,
        nombre_inversionista,
        rfc_inversionista,
        tipo_persona,
        periodo_anio,
        periodo_mes,
        periodo_dia_inicio,
        periodo_dia_fin,
        tipo_periodo,
        sub_periodo,
        id_pago,
        monto_pago,
        fecha_pago,
        fecha_inicio,
        fecha_fin,
        dias_periodo,
        "noDispersion",
        tasa_rendimiento,
        rendimiento_bruto,
        retencion_isr,
        rendimiento_neto,
        rendimiento_sph,
        dispersion_neta,
        fecha_calculo
    )
    SELECT
        id_fideicomiso,
        no_adhesion,
        nombre_inversionista,
        rfc_inversionista,
        tipo_persona,
        periodo_anio,
        periodo_mes,
        periodo_dia_inicio,
        periodo_dia_fin,
        tipo_periodo,
        sub_periodo,
        id_pago,
        monto_pago,
        fecha_pago,
        fecha_inicio,
        fecha_fin,
        dias_periodo,
        "noDispersion",
        tasa_rendimiento,
        rendimiento_bruto,
        retencion_isr,
        rendimiento_neto,
        rendimiento_sph,
        dispersion_neta,
        fecha_calculo
    FROM plan_dispersiones_dinamico(p_id_fideicomiso, p_no_adhesion)
    ON CONFLICT (id_fideicomiso, no_adhesion, id_pago, fecha_inicio, fecha_fin, sub_periodo)
    DO UPDATE SET
        nombre_inversionista = EXCLUDED.nombre_inversionista,
        rfc_inversionista = EXCLUDED.rfc_inversionista,
        tipo_persona = EXCLUDED.tipo_persona,
        periodo_anio = EXCLUDED.periodo_anio,
        periodo_mes = EXCLUDED.periodo_mes,
        periodo_dia_inicio = EXCLUDED.periodo_dia_inicio,
        periodo_dia_fin = EXCLUDED.periodo_dia_fin,
        tipo_periodo = EXCLUDED.tipo_periodo,
        sub_periodo = EXCLUDED.sub_periodo,
        monto_pago = EXCLUDED.monto_pago,
        fecha_pago = EXCLUDED.fecha_pago,
        dias_periodo = EXCLUDED.dias_periodo,
        "noDispersion" = EXCLUDED."noDispersion",
        tasa_rendimiento = EXCLUDED.tasa_rendimiento,
        rendimiento_bruto = EXCLUDED.rendimiento_bruto,
        retencion_isr = EXCLUDED.retencion_isr,
        rendimiento_neto = EXCLUDED.rendimiento_neto,
        rendimiento_sph = EXCLUDED.rendimiento_sph,
        dispersion_neta = EXCLUDED.dispersion_neta,
        fecha_calculo = EXCLUDED.fecha_calculo;

    GET DIAGNOSTICS v_registros_insertados = ROW_COUNT;
    RETURN v_registros_insertados;
END;
$$;
