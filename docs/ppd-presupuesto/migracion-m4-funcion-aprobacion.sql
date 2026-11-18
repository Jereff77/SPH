-- =====================================================================================
-- M-PPD-4 · Función de aprobación: la primera aprobación de una factura PPD valida la base completa;
-- las siguientes ya no validan (la base ya está apartada). Solo cambia lo marcado con «PPD».
-- NO APLICADO (borrador en validación). Va DESPUÉS de M-PPD-1, 2 y 3 (ver migracion.sql).
-- =====================================================================================
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.cxp_autorizar_solicitud_pago(p_idcxp text, p_ultimocomentario text DEFAULT NULL::text, p_autorizo uuid DEFAULT NULL::uuid, p_uidsolicita uuid DEFAULT NULL::uuid)
 RETURNS TABLE(autorizado boolean, mensaje text)
 LANGUAGE plpgsql
AS $function$

DECLARE
    -- Variables para datos del CxP
    v_idcategoria TEXT;
    v_subtotal NUMERIC;
    v_estado_actual INTEGER;
    v_cxp_existe BOOLEAN := FALSE;
    v_idcxpppd TEXT;                -- PPD
    v_moneda TEXT;                  -- PPD
    v_ya_apartada BOOLEAN := FALSE; -- PPD

    -- Variables para datos de presupuesto
    v_categoria_activa BOOLEAN;
    v_presupuestable BOOLEAN;
    v_presupuesto_acumulado NUMERIC;
    v_total_gastado_comprometido NUMERIC;
    v_calculo_nuevo_total NUMERIC;

    -- Variables de control
    v_mensaje_error TEXT;
    v_autorizado BOOLEAN := FALSE;

    -- Variables para configuración
    v_uuid_aprobar_fp uuid;
    v_omitir_validacion_presupuesto BOOLEAN := FALSE;

    -- Cursor para obtener datos del CxP
    cursor_cxp CURSOR FOR
        SELECT "idCategoria", subtotal, "idEstado", "idCxpPPD", moneda
        FROM public.cxp
        WHERE "idCxp" = p_idcxp;

    -- Cursor para obtener datos de presupuesto
    cursor_presupuesto CURSOR FOR
        SELECT status, presupuestable, presupuesto_acumulado, total_gastado_comprometido
        FROM public.v_resumenPresupuesto
        WHERE "idCategoria" = v_idcategoria;

    -- Cursor para obtener configuración de aprobar fuera de presupuesto
    cursor_config_fp CURSOR FOR
        SELECT valor::uuid
        FROM public."SPHConfiguraciones"
        WHERE parametro = 'Aprobar fuera de presupuesto' AND status = true;
BEGIN
    -- [Fecha y Hora]: 20/11/2025 08:01:00 (PPD: 2026-11-17)
    -- [Descripción]: Función principal para autorizar solicitudes de pago con validación de presupuesto
    -- [Entrada]: p_idcxp (text) - ID de la cuenta por pagar a autorizar
    -- [Salida]: TABLE(autorizado boolean, mensaje text) - Resultado de la autorización con mensaje descriptivo
    -- [Uso]: SELECT * FROM cxp_autorizar_solicitud_pago('ID_CXP') AS (autorizado boolean, mensaje text);

    -- Iniciar transacción para asegurar atomicidad
    BEGIN

        -- 1. Validación de parámetros de entrada
        IF p_idcxp IS NULL OR TRIM(p_idcxp) = '' THEN
            RETURN QUERY SELECT FALSE, 'ERROR: El ID de CxP no puede ser nulo o vacío';
            RETURN;
        END IF;

        -- 2. Verificar existencia del CxP y obtener sus datos
        OPEN cursor_cxp;
        FETCH cursor_cxp INTO v_idcategoria, v_subtotal, v_estado_actual, v_idcxpppd, v_moneda;

        IF NOT FOUND THEN
            CLOSE cursor_cxp;
            RETURN QUERY SELECT FALSE, 'ERROR: No existe una cuenta por pagar con el ID: ' || p_idcxp;
            RETURN;
        END IF;
        CLOSE cursor_cxp;

        -- Validar que el subtotal no sea nulo
        IF v_subtotal IS NULL THEN
            v_subtotal := 0;
        END IF;

        -- 3. Obtener configuración para aprobar fuera de presupuesto
        OPEN cursor_config_fp;
        FETCH cursor_config_fp INTO v_uuid_aprobar_fp;
        CLOSE cursor_config_fp;

        -- Verificar si se debe omitir la validación de presupuesto
        IF v_uuid_aprobar_fp IS NOT NULL AND p_autorizo IS NOT NULL THEN
            v_omitir_validacion_presupuesto := (p_autorizo = v_uuid_aprobar_fp);
        END IF;

        -- 4. Obtener información de presupuesto desde la vista
        OPEN cursor_presupuesto;
        FETCH cursor_presupuesto INTO v_categoria_activa, v_presupuestable, v_presupuesto_acumulado, v_total_gastado_comprometido;

        IF NOT FOUND THEN
            CLOSE cursor_presupuesto;
            RETURN QUERY SELECT FALSE, 'ERROR: No se encontró información de presupuesto para la categoría: ' || COALESCE(v_idcategoria, 'SIN CATEGORÍA');
            RETURN;
        END IF;
        CLOSE cursor_presupuesto;

        -- 5. Validar que la categoría esté activa
        IF NOT v_categoria_activa THEN
            -- Mensaje especial para categoría no clasificada ("-")
            IF v_idcategoria = '-' THEN
                RETURN QUERY SELECT FALSE, 'ERROR: El gasto no está clasificado correctamente (categoría "-"). Por favor, clasifique el gasto asignando una categoría válida antes de autorizar el pago.';
            ELSE
                RETURN QUERY SELECT FALSE, 'ERROR: La categoría "' || v_idcategoria || '" no está activa. No se puede autorizar el pago.';
            END IF;
            RETURN;
        END IF;

        -- 6. Determinar si aplica validación de presupuesto
        IF NOT v_presupuestable OR v_omitir_validacion_presupuesto THEN
            -- Si no es presupuestable o el usuario está autorizado para omitir validación, autorizar directamente
            UPDATE public.cxp
            SET "idEstado" = 4,  -- Estado 4 = Aprobado
                "ultimoComentario" = COALESCE(p_ultimocomentario, ''),
                "autorizo" = p_autorizo,
                "fecAutorizacion" = NOW()
            WHERE "idCxp" = p_idcxp;

            IF v_omitir_validacion_presupuesto THEN
                RETURN QUERY SELECT TRUE, 'PAGO AUTORIZADO: Usuario autorizado para omitir validación de presupuesto. Categoría "' || v_idcategoria || '".';
            ELSE
                RETURN QUERY SELECT TRUE, 'PAGO AUTORIZADO: La categoría "' || v_idcategoria || '" no es presupuestable. Se autoriza directamente.';
            END IF;
            RETURN;
        END IF;

        -- 6 bis. PPD: el presupuesto lo aparta la FACTURA desde su primera aprobación (base completa).
        IF v_idcxpppd IS NOT NULL THEN
            SELECT EXISTS (
                SELECT 1 FROM public.cxp k
                WHERE k."idCxpPPD" = v_idcxpppd AND k.status IS TRUE AND k."idCxp" <> p_idcxp
                  AND k."idEstado" IN (4, 6, 7, 99)
            ) INTO v_ya_apartada;

            IF v_ya_apartada OR COALESCE(v_moneda, 'MXN') <> 'MXN' THEN
                -- Ya apartada por una parcialidad anterior (o factura en otra moneda, que aún no afecta el presupuesto):
                -- se autoriza sin volver a validar.
                UPDATE public.cxp
                SET "idEstado" = 4,
                    "ultimoComentario" = COALESCE(p_ultimocomentario, ''),
                    "autorizo" = p_autorizo,
                    "fecAutorizacion" = NOW()
                WHERE "idCxp" = p_idcxp;

                RETURN QUERY SELECT TRUE,
                    CASE WHEN v_ya_apartada
                         THEN 'PAGO AUTORIZADO: La factura PPD ya tiene su presupuesto apartado desde su primera aprobación.'
                         ELSE 'PAGO AUTORIZADO: Factura en otra moneda; no afecta el presupuesto.'
                    END;
                RETURN;
            END IF;

            -- Primera aprobación: se valida y se aparta la base completa de la factura.
            SELECT COALESCE(m.subtotal, 0) INTO v_subtotal FROM public.cxp_ppd m WHERE m."idCxpPPD" = v_idcxpppd;
            v_subtotal := COALESCE(v_subtotal, 0);
        END IF;

        -- 7. Aplicar validación de presupuesto (solo si presupuestable = true y no se omite validación)

        -- Validar que los valores de presupuesto no sean nulos
        IF v_presupuesto_acumulado IS NULL THEN
            v_presupuesto_acumulado := 0;
        END IF;

        IF v_total_gastado_comprometido IS NULL THEN
            v_total_gastado_comprometido := 0;
        END IF;

        -- Calcular nuevo total: presupuesto_gastado_comprometido + cxp.subtotal (PPD: base de la factura)
        v_calculo_nuevo_total := v_total_gastado_comprometido + v_subtotal;

        -- Comparar contra presupuesto acumulado
        IF v_calculo_nuevo_total <= v_presupuesto_acumulado THEN
            -- Hay presupuesto disponible, autorizar
            UPDATE public.cxp
            SET "idEstado" = 4,  -- Estado 4 = Aprobado
                "ultimoComentario" = COALESCE(p_ultimocomentario, ''),
                "autorizo" = p_autorizo,
                "fecAutorizacion" = NOW()
            WHERE "idCxp" = p_idcxp;

            RETURN QUERY SELECT TRUE,
                'PAGO AUTORIZADO: Presupuesto disponible. ' ||
                'Gasto actual: $' || TO_CHAR(v_total_gastado_comprometido, '999,999,999.99') ||
                ' + Nuevo pago: $' || TO_CHAR(v_subtotal, '999,999,999.99') ||
                ' = $' || TO_CHAR(v_calculo_nuevo_total, '999,999,999.99') ||
                ' (Disponible: $' || TO_CHAR(v_presupuesto_acumulado, '999,999,999.99') || ')';
            RETURN;
        ELSE
            -- Presupuesto insuficiente, rechazar con mensaje específico
            RETURN QUERY SELECT FALSE,
                'PAGO RECHAZADO: Presupuesto insuficiente. ' ||
                'Gasto actual: $' || TO_CHAR(v_total_gastado_comprometido, '999,999,999.99') ||
                ' + Nuevo pago: $' || TO_CHAR(v_subtotal, '999,999,999.99') ||
                ' = $' || TO_CHAR(v_calculo_nuevo_total, '999,999,999.99') ||
                ' (Excede el presupuesto disponible: $' || TO_CHAR(v_presupuesto_acumulado, '999,999,999.99') ||
                '. Sobrepaso: $' || TO_CHAR(v_calculo_nuevo_total - v_presupuesto_acumulado, '999,999,999.99') || ')';
            RETURN;
        END IF;

        -- Confirmar transacción
        COMMIT;

    EXCEPTION
        WHEN OTHERS THEN
            -- Deshacer cambios en caso de error
            ROLLBACK;

            -- Retornar error genérico con información del error específico
            RETURN QUERY SELECT FALSE, 'ERROR INTERNO: ' || SQLERRM;
            RETURN;
    END;

END;

$function$;

-- REVERSA M-PPD-4: `reversa-funcion-aprobacion.sql` (generado por generar-prueba.cjs; la prueba en seco verifica que, tras revertir, la definición coincide con la anterior salvo espacios).
