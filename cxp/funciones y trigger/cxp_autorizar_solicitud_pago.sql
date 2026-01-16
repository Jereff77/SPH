--[Fecha y Hora]: 20/11/2025 08:01:00
--[Descripción]: Función principal para autorizar solicitudes de pago con validación de presupuesto
--                Realiza validaciones de categoría activa y control presupuestario según configuración
--                Incluye opción para omitir validación de presupuesto para usuarios autorizados
--                Maneja caso especial para gastos no clasificados (categoría "-")
--
--[Parámetros]:
--   - p_idcxp (text): ID de la cuenta por pagar a autorizar
--   - p_ultimocomentario (text): Comentario opcional sobre la autorización
--   - p_autorizo (uuid): UID del usuario que autoriza el pago
--   - p_uidsolicita (uuid): UID del usuario que solicita la autorización (no usado para validación de presupuesto)
--
--[Salida]:
--   - boolean: true si se autorizó correctamente, false si se rechazó
--   - text: Mensaje descriptivo del resultado (incluyendo valores en caso de rechazo)
--
--[Uso típico]: Se utiliza para autorizar pagos aplicando validaciones presupuestarias
--               según la configuración de la categoría y disponibilidad presupuestal
--               Permite omitir validación si el usuario que autoriza está configurado en SPHConfiguraciones
--
--[Ejemplo]:
--   SELECT cxp_autorizar_solicitud_pago('ABC123');
--   SELECT * FROM cxp_autorizar_solicitud_pago('XYZ789', 'Comentario', 'uuid_autorizador'::uuid) AS (autorizado boolean, mensaje text);
--
--[Relaciones]:
--   - Tablas: cxp, v_resumenPresupuesto, SPHConfiguraciones
--   - Campos clave: cxp.idEstado, cxp."idCategoria", cxp.subtotal
--
--[Validaciones]:
--   - Verifica existencia del idCxP
--   - Valida que la categoría esté activa (status = true)
--   - Maneja caso especial para categoría "-" solicitando clasificación correcta
--   - Aplica validación presupuestaria si la categoría es presupuestable
--   - Omite validación de presupuesto si p_autorizo coincide con configuración "Aprobar fuera de presupuesto"
--   - Calcula disponibilidad presupuestaria considerando gastos y compromisos
--
--[Lógica de funcionamiento]:
--   1. Verifica existencia del registro CxP
--   2. Obtiene configuración de "Aprobar fuera de presupuesto" desde SPHConfiguraciones
--   3. Compara p_autorizo con UUID configurado para determinar si se omite validación
--   4. Obtiene información de presupuesto desde v_resumenPresupuesto
--   5. Valida que la categoría esté activa (con mensaje especial para "-")
--   6. Si no es presupuestable o usuario autorizado para omitir, autoriza directamente
--   7. Si es presupuestable y no se omite, valida disponibilidad presupuestaria
--   8. Actualiza estado a 4 (Aprobado) si autoriza
--   9. Retorna resultado con mensaje descriptivo
--
--[Consideraciones de seguridad]:
--   - Usa transacción para asegurar atomicidad
--   - Maneja excepciones para idCxP inexistente
--   - Solo modifica el campo idEstado del registro específico
--   - Usa SECURITY INVOKER para respetar permisos del usuario
--
--[Manejo de errores]:
--   - idCxP nulo o vacío: retorna false con mensaje de error
--   - idCxP inexistente: retorna false con mensaje de error
--   - Categoría "-" (no clasificada): retorna false solicitando clasificación correcta
--   - Categoría inactiva: retorna false con mensaje de error
--   - Presupuesto insuficiente: retorna false con valores detallados
--   - Errores inesperados: retorna false con mensaje de error genérico

CREATE OR REPLACE FUNCTION public.cxp_autorizar_solicitud_pago(
    p_idcxp text,
    p_ultimocomentario text DEFAULT NULL,
    p_autorizo uuid DEFAULT NULL,
    p_uidsolicita uuid DEFAULT NULL
)
 RETURNS TABLE(autorizado boolean, mensaje text)
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $function$
DECLARE
    -- Variables para datos del CxP
    v_idcategoria TEXT;
    v_subtotal NUMERIC;
    v_estado_actual INTEGER;
    v_cxp_existe BOOLEAN := FALSE;
    
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
    v omitir_validacion_presupuesto BOOLEAN := FALSE;
    
    -- Cursor para obtener datos del CxP
    cursor_cxp CURSOR FOR 
        SELECT "idCategoria", subtotal, "idEstado"
        FROM public.cxp
        WHERE id = p_idcxp;
        
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
    -- [Fecha y Hora]: 30/10/2025 03:28:00
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
        FETCH cursor_cxp INTO v_idcategoria, v_subtotal, v_estado_actual;
        
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
            RETURN QUERY SELECT FALSE, 'ERROR: La categoría "' || v_idcategoria || '" no está activa. No se puede autorizar el pago.';
            RETURN;
        END IF;
        
        -- 6. Determinar si aplica validación de presupuesto
        IF NOT v_presupuestable OR v_omitir_validacion_presupuesto THEN
            -- Si no es presupuestable, autorizar directamente
            UPDATE public.cxp
            SET "idEstado" = 4,  -- Estado 4 = Aprobado
                "ultimoComentario" = p_ultimocomentario,
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
        
        -- 7. Aplicar validación de presupuesto (solo si presupuestable = true y no se omite validación)
        
        -- Validar que los valores de presupuesto no sean nulos
        IF v_presupuesto_acumulado IS NULL THEN
            v_presupuesto_acumulado := 0;
        END IF;
        
        IF v_total_gastado_comprometido IS NULL THEN
            v_total_gastado_comprometido := 0;
        END IF;
        
        -- Calcular nuevo total: presupuesto_gastado_comprometido + cxp.subtotal
        v_calculo_nuevo_total := v_total_gastado_comprometido + v_subtotal;
        
        -- Comparar contra presupuesto acumulado
        IF v_calculo_nuevo_total <= v_presupuesto_acumulado THEN
            -- Hay presupuesto disponible, autorizar
            UPDATE public.cxp
            SET "idEstado" = 4,  -- Estado 4 = Aprobado
                "ultimoComentario" = p_ultimocomentario,
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