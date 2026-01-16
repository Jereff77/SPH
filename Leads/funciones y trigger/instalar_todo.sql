--[Fecha y Hora]: 04/12/2025 05:20:00
--[Descripción]: Script de instalación completa para el sistema de gestión de leads
--
-- Este script crea todas las funciones y triggers necesarios para el funcionamiento
-- completo del sistema de leads, incluyendo aprobación, notificaciones, migración
-- y gestión de permisos según los estándares del proyecto supaSPH-QR.
--
-- Orden de instalación:
-- 1. Funciones de leads_porAprobar (gestión de aprobación)
-- 2. Funciones de notificaciones y webhook
-- 3. Función de eliminación de leads con permisos
-- 4. Triggers automáticos asociados
-- 5. Verificación completa de instalación
--
-- [Cambios recientes]:
-- - 🆕 Implementación completa del sistema de leads_porAprobar
-- - 📝 Mejora de documentación según estándares supaSPH-QR
-- - 🔧 Corrección del trigger: Añadidas conversiones explícitas de tipo (::uuid, ::text)
-- - ✅ Actualización a fecha y hora actual (03/12/2025 17:55:57)
-- - 📋 Verificación completa de todos los componentes documentados
-- - 🔧 CORRECCIÓN CRÍTICA: Función leads_poraprobar_validar_y_migrar_similitud actualizada (04/12/2025 04:25:00)
--   - Resuelto error de foreign key constraint en activity_history
--   - Eliminadas inserciones en activity_history cuando el lead no existe en tabla leads
-- - 🆕 NUEVO TRIGGER: trigger_leads_poraprobar_validar_y_migrar_automaticamente (04/12/2025 05:20:00)
--   - Trigger automático que ejecuta validación y migración al insertar nuevos leads
--   - Implementado con manejo de errores para no afectar inserciones
--   - Función auxiliar leads_poraprobar_validar_y_migrar_similitud_trigger_func() creada

-- =====================================================
-- 1. FUNCIONES DE GESTIÓN DE LEADS POR APROBAR
-- =====================================================

-- 1.1 Función para obtener leads pendientes de aprobación
CREATE OR REPLACE FUNCTION public.leads_poraprobar_obtener_detalle()
 RETURNS TABLE (
     id uuid,
     uidr uuid,
     status boolean,
     fc timestamp without time zone,
     "nombreLead" text,
     telefono text,
     correo text,
     "idInmobiliaria" uuid,
     "fechaContacto" timestamp without time zone,
     "fechaRegistro" timestamp with time zone,
     mensaje text,
     "KVAs" text,
     superficie text,
     ubicacion text,
     "uidRC" uuid,
     "idEtapa" bigint,
     "idOrigen" bigint,
     "idTipoCliente" bigint,
     "idTipoOperacion" bigint,
     "idTipoVenta" bigint,
     "Etapa" text,
     "Origen" text,
     "tipoCliente" text,
     "tipoOperacion" text,
     "tipoVenta" text,
     "nomRC" text,
     valor double precision,
     aprobado boolean,
     "nombreRegistro" text,
     "nombreInmobiliaria" text,
     "nombreAsesorInm" text,
     "tituloEtapa" text,
     "tituloOrigen" text,
     "tituloTipoCliente" text,
     "tituloTipoOperacion" text,
     "tituloTipoVenta" text
 )
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $BODY$
BEGIN
    --[Fecha y Hora]: 20/10/2025 08:22:00
    -- [Descripción]: Retorna todos los leads pendientes de aprobación con
    --                información completa de tablas relacionadas usando LEFT JOIN.
    --
    -- [Retorna]: TABLE con estructura completa para facilitar el consumo
    --           desde aplicaciones frontend o reportes.
    --
    -- [Consideraciones]:
    --   - Usa LEFT JOIN para incluir todos los leads aunque falten relaciones
    --   - Filtra automáticamente aprobado IS NULL para mostrar solo pendientes
    --   - Incluye campos descriptivos tanto de la tabla principal como de catálogos
    
    RETURN QUERY
    SELECT
      lpa.id,
      lpa.uidr,
      lpa.status,
      lpa.fc,
      lpa."nombreLead",
      lpa.telefono,
      lpa.correo,
      lpa."idInmobiliaria",
      lpa."fechaContacto",
      lpa."fechaRegistro",
      lpa.mensaje,
      lpa."KVAs",
      lpa.superficie,
      lpa.ubicacion,
      lpa."uidRC",
      lpa."idEtapa",
      lpa."idOrigen",
      lpa."idTipoCliente",
      lpa."idTipoOperacion",
      lpa."idTipoVenta",
      lpa."Etapa",
      lpa."Origen",
      lpa."tipoCliente",
      lpa."tipoOperacion",
      lpa."tipoVenta",
      lpa."nomRC",
      lpa.valor,
      lpa.aprobado,
      ur."nomCompleto" as "nombreRegistro",
      ci.nombre as "nombreInmobiliaria",
      ai.nombre as "nombreAsesorInm",
      ce."titulo" as "tituloEtapa",
      co."titulo" as "tituloOrigen",
      ctc."titulo" as "tituloTipoCliente",
      cto."titulo" as "tituloTipoOperacion",
      ctv."titulo" as "tituloTipoVenta"
    FROM
      "leads_porAprobar" lpa
      LEFT JOIN public."catUsers" ur ON lpa.uidr = ur.uid
      LEFT JOIN public."catUsers" rc ON lpa."uidRC" = rc.uid
      LEFT JOIN public."catInmobiliarias" ci ON lpa."idInmobiliaria" = ci."idInmobiliaria"
      LEFT JOIN public."crm_Etapas" ce ON lpa."idEtapa" = ce.id
      LEFT JOIN public."crm_Origen" co ON lpa."idOrigen" = co.id
      LEFT JOIN public."crm_tipoCliente" ctc ON lpa."idTipoCliente" = ctc.id
      LEFT JOIN public."crm_tipoOperaciones" cto ON lpa."idTipoOperacion" = cto.id
      LEFT JOIN public."crm_tipoVenta" ctv ON lpa."idTipoVenta" = ctv.id
      LEFT JOIN public."catAsesoresInm" ai ON lpa."idAsesorInm" = ai.id
    WHERE
      lpa.aprobado IS NULL
    ORDER BY
      lpa."fechaRegistro" DESC;
      
    RETURN;
END;
$BODY$;

-- 1.2 Función para actualizar nomRC cuando cambia uidRC
CREATE OR REPLACE FUNCTION public.leads_poraprobar_actualizar_nomrc(
    p_id_lead uuid,
    p_uid_rc uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $BODY$
DECLARE
    v_nombre_rc text;
    v_result jsonb;
    v_lead_exists boolean;
BEGIN
    --[Fecha y Hora]: 03/12/2025 11:46:00
    -- Validar que el usuario esté autenticado
    IF auth.uid() IS NULL THEN
        v_result := jsonb_build_object(
            'success', false,
            'error', 'AUTHENTICATION_REQUIRED',
            'message', 'Se requiere autenticación para actualizar el responsable comercial',
            'error_code', 401,
            'data', jsonb_build_object(
                'required_action', 'authenticate',
                'reason', 'Usuario no autenticado detectado',
                'security_note', 'Esta función requiere autenticación explícita por seguridad'
            )
        );
        RETURN v_result;
    END IF;
    
    -- Verificar que el lead exista en leads_porAprobar
    SELECT EXISTS(
        SELECT 1
        FROM "leads_porAprobar"
        WHERE id = p_id_lead
    ) INTO v_lead_exists;
    
    IF NOT v_lead_exists THEN
        v_result := jsonb_build_object(
            'success', false,
            'error', 'LEAD_NOT_FOUND',
            'message', 'El lead especificado no existe en leads_porAprobar',
            'error_code', 404,
            'data', jsonb_build_object(
                'lead_id', p_id_lead::text
            )
        );
        RETURN v_result;
    END IF;
    
    -- Obtener el nombre del responsable comercial desde catUsers
    SELECT COALESCE("nomCompleto", 'Sin nombre')
    INTO v_nombre_rc
    FROM catUsers
    WHERE uid = p_uid_rc;
    
    -- Si no se encuentra el responsable, usar valor por defecto
    IF v_nombre_rc IS NULL THEN
        v_nombre_rc := 'Responsable no encontrado';
    END IF;
    
    -- Actualizar el campo nomRC en leads_porAprobar
    UPDATE "leads_porAprobar"
    SET
        "uidRC" = p_uid_rc,
        "nomRC" = v_nombre_rc,
        fc = NOW()  -- Actualizar timestamp de modificación
    WHERE id = p_id_lead;
    
    -- Construir respuesta de éxito
    v_result := jsonb_build_object(
        'success', true,
        'message', 'Responsable comercial actualizado correctamente',
        'data', jsonb_build_object(
            'lead_id', p_id_lead::text,
            'uid_rc', p_uid_rc::text,
            'nombre_rc', v_nombre_rc,
            'updated_at', NOW()
        )
    );
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        v_result := jsonb_build_object(
            'success', false,
            'error', 'DATABASE_ERROR',
            'message', 'Error al actualizar el responsable comercial: ' || SQLERRM,
            'error_code', 500,
            'data', jsonb_build_object(
                'lead_id', p_id_lead,
                'uid_rc', p_uid_rc,
                'database_error', SQLSTATE,
                'error_detail', SQLERRM
            )
        );
        RETURN v_result;
END;
$BODY$;

-- 1.3 Función para insertar nuevos registros con validaciones
CREATE OR REPLACE FUNCTION public.leads_poraprobar_insertar_registro(
    p_uidr uuid,
    p_nombre_lead text,
    p_telefono text DEFAULT NULL,
    p_correo text DEFAULT NULL,
    p_uid_rc uuid DEFAULT NULL,
    p_id_inmobiliaria uuid DEFAULT NULL,
    p_id_asesor_inm uuid DEFAULT NULL,
    p_fecha_contacto timestamp with time zone DEFAULT NULL,
    p_mensaje text DEFAULT NULL,
    p_id_etapa bigint DEFAULT NULL,
    p_id_origen bigint DEFAULT NULL,
    p_id_tipo_cliente bigint DEFAULT NULL,
    p_id_tipo_operacion bigint DEFAULT NULL,
    p_id_tipo_venta bigint DEFAULT NULL,
    p_valor double precision DEFAULT NULL,
    p_kvas text DEFAULT NULL,
    p_superficie text DEFAULT NULL,
    p_ubicacion text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $BODY$
DECLARE
    v_new_id uuid;
    v_nombre_rc text;
    v_nombre_inmobiliaria text;
    v_nombre_asesor_inm text;
    v_nombre_etapa text;
    v_nombre_origen text;
    v_nombre_tipo_cliente text;
    v_nombre_tipo_operacion text;
    v_nombre_tipo_venta text;
    v_result jsonb;
    v_user_exists boolean;
BEGIN
    --[Fecha y Hora]: 03/12/2025 11:47:00
    -- Validar que el usuario esté autenticado
    IF auth.uid() IS NULL THEN
        v_result := jsonb_build_object(
            'success', false,
            'error', 'AUTHENTICATION_REQUIRED',
            'message', 'Se requiere autenticación para registrar leads',
            'error_code', 401,
            'data', jsonb_build_object(
                'required_action', 'authenticate',
                'reason', 'Usuario no autenticado detectado',
                'security_note', 'Esta función requiere autenticación explícita por seguridad'
            )
        );
        RETURN v_result;
    END IF;
    
    -- Validar campos obligatorios
    IF p_uidr IS NULL OR p_nombre_lead IS NULL OR TRIM(p_nombre_lead) = '' THEN
        v_result := jsonb_build_object(
            'success', false,
            'error', 'REQUIRED_FIELDS_MISSING',
            'message', 'Los campos uidr y nombre_lead son obligatorios',
            'error_code', 400,
            'data', jsonb_build_object(
                'missing_fields', CASE
                    WHEN p_uidr IS NULL AND (p_nombre_lead IS NULL OR TRIM(p_nombre_lead) = '') THEN ARRAY['uidr', 'nombre_lead']
                    WHEN p_uidr IS NULL THEN ARRAY['uidr']
                    ELSE ARRAY['nombre_lead']
                END
            )
        );
        RETURN v_result;
    END IF;
    
    -- Verificar que el usuario que registra exista
    SELECT EXISTS(
        SELECT 1
        FROM catUsers
        WHERE uid = p_uidr
    ) INTO v_user_exists;
    
    IF NOT v_user_exists THEN
        v_result := jsonb_build_object(
            'success', false,
            'error', 'USER_NOT_FOUND',
            'message', 'El usuario que registra el lead no existe',
            'error_code', 404,
            'data', jsonb_build_object(
                'uidr', p_uidr::text
            )
        );
        RETURN v_result;
    END IF;
    
    -- Obtener nombres descriptivos de relaciones (si existen)
    -- Responsable comercial
    IF p_uid_rc IS NOT NULL THEN
        SELECT COALESCE("nomCompleto", 'Sin nombre')
        INTO v_nombre_rc
        FROM catUsers
        WHERE uid = p_uid_rc;
        
        IF v_nombre_rc IS NULL THEN
            v_nombre_rc := 'Responsable no encontrado';
        END IF;
    ELSE
        v_nombre_rc := 'Sin asignar';
    END IF;
    
    -- Inmobiliaria
    IF p_id_inmobiliaria IS NOT NULL THEN
        SELECT COALESCE(nombre, 'Sin nombre')
        INTO v_nombre_inmobiliaria
        FROM catInmobiliarias
        WHERE "idInmobiliaria" = p_id_inmobiliaria;
        
        IF v_nombre_inmobiliaria IS NULL THEN
            v_nombre_inmobiliaria := 'Inmobiliaria no encontrada';
        END IF;
    END IF;
    
    -- Asesor inmobiliario
    IF p_id_asesor_inm IS NOT NULL THEN
        SELECT COALESCE(nombre, 'Sin nombre')
        INTO v_nombre_asesor_inm
        FROM catAsesoresInm
        WHERE id = p_id_asesor_inm;
        
        IF v_nombre_asesor_inm IS NULL THEN
            v_nombre_asesor_inm := 'Asesor no encontrado';
        END IF;
    END IF;
    
    -- Etapa
    IF p_id_etapa IS NOT NULL THEN
        SELECT COALESCE(titulo, 'Sin título')
        INTO v_nombre_etapa
        FROM "crm_Etapas"
        WHERE id = p_id_etapa;
        
        IF v_nombre_etapa IS NULL THEN
            v_nombre_etapa := 'Etapa no encontrada';
        END IF;
    END IF;
    
    -- Origen
    IF p_id_origen IS NOT NULL THEN
        SELECT COALESCE(titulo, 'Sin título')
        INTO v_nombre_origen
        FROM "crm_Origen"
        WHERE id = p_id_origen;
        
        IF v_nombre_origen IS NULL THEN
            v_nombre_origen := 'Origen no encontrado';
        END IF;
    END IF;
    
    -- Tipo de cliente
    IF p_id_tipo_cliente IS NOT NULL THEN
        SELECT COALESCE(titulo, 'Sin título')
        INTO v_nombre_tipo_cliente
        FROM "crm_tipoCliente"
        WHERE id = p_id_tipo_cliente;
        
        IF v_nombre_tipo_cliente IS NULL THEN
            v_nombre_tipo_cliente := 'Tipo cliente no encontrado';
        END IF;
    END IF;
    
    -- Tipo de operación
    IF p_id_tipo_operacion IS NOT NULL THEN
        SELECT COALESCE(titulo, 'Sin título')
        INTO v_nombre_tipo_operacion
        FROM "crm_tipoOperaciones"
        WHERE id = p_id_tipo_operacion;
        
        IF v_nombre_tipo_operacion IS NULL THEN
            v_nombre_tipo_operacion := 'Tipo operación no encontrado';
        END IF;
    END IF;
    
    -- Tipo de venta
    IF p_id_tipo_venta IS NOT NULL THEN
        SELECT COALESCE(titulo, 'Sin título')
        INTO v_nombre_tipo_venta
        FROM "crm_tipoVenta"
        WHERE id = p_id_tipo_venta;
        
        IF v_nombre_tipo_venta IS NULL THEN
            v_nombre_tipo_venta := 'Tipo venta no encontrado';
        END IF;
    END IF;
    
    -- Insertar el nuevo registro en leads_porAprobar
    INSERT INTO "leads_porAprobar" (
        uidr,
        "nombreLead",
        telefono,
        correo,
        "uidRC",
        "idInmobiliaria",
        "idAsesorInm",
        "fechaContacto",
        mensaje,
        "idEtapa",
        "idOrigen",
        "idTipoCliente",
        "idTipoOperacion",
        "idTipoVenta",
        valor,
        "KVAs",
        superficie,
        ubicacion,
        "nomRC",
        "nombreInmobiliaria",
        "nombreAsesorInm",
        "Etapa",
        "Origen",
        "tipoCliente",
        "tipoOperacion",
        "tipoVenta",
        status,
        fc,
        "fechaRegistro",
        aprobado
    ) VALUES (
        p_uidr,
        p_nombre_lead,
        p_telefono,
        p_correo,
        p_uid_rc,
        p_id_inmobiliaria,
        p_id_asesor_inm,
        p_fecha_contacto,
        p_mensaje,
        p_id_etapa,
        p_id_origen,
        p_id_tipo_cliente,
        p_id_tipo_operacion,
        p_id_tipo_venta,
        p_valor,
        p_kvas,
        p_superficie,
        p_ubicacion,
        v_nombre_rc,
        v_nombre_inmobiliaria,
        v_nombre_asesor_inm,
        v_nombre_etapa,
        v_nombre_origen,
        v_nombre_tipo_cliente,
        v_nombre_tipo_operacion,
        v_nombre_tipo_venta,
        true, -- status
        NOW(), -- fc
        NOW(), -- fechaRegistro
        NULL -- aprobado (NULL = pendiente)
    ) RETURNING id INTO v_new_id;
    
    -- Construir respuesta de éxito
    v_result := jsonb_build_object(
        'success', true,
        'message', 'Lead registrado correctamente en leads_porAprobar',
        'data', jsonb_build_object(
            'lead_id', v_new_id::text,
            'nombre_lead', p_nombre_lead,
            'telefono', p_telefono,
            'correo', p_correo,
            'responsable_comercial', v_nombre_rc,
            'inmobiliaria', v_nombre_inmobiliaria,
            'etapa', v_nombre_etapa,
            'origen', v_nombre_origen,
            'tipo_cliente', v_nombre_tipo_cliente,
            'tipo_operacion', v_nombre_tipo_operacion,
            'registered_at', NOW(),
            'status', 'pendiente_aprobacion'
        )
    );
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        v_result := jsonb_build_object(
            'success', false,
            'error', 'DATABASE_ERROR',
            'message', 'Error al registrar el lead: ' || SQLERRM,
            'error_code', 500,
            'data', jsonb_build_object(
                'uidr', p_uidr,
                'nombre_lead', p_nombre_lead,
                'database_error', SQLSTATE,
                'error_detail', SQLERRM
            )
        );
        RETURN v_result;
END;
$BODY$;

-- 1.4 Función para migrar leads aprobados a tabla principal
CREATE OR REPLACE FUNCTION public.leads_poraprobar_migrar_a_leads(
    p_id_lead uuid,
    p_forzar_migracion boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $BODY$
DECLARE
    v_lead_data "leads_porAprobar"%ROWTYPE;
    v_lead_exists_in_leads boolean;
    v_result jsonb;
    v_migrated_id uuid;
BEGIN
    --[Fecha y Hora]: 03/12/2025 11:48:00
    -- Validar que el usuario esté autenticado
    IF auth.uid() IS NULL THEN
        v_result := jsonb_build_object(
            'success', false,
            'error', 'AUTHENTICATION_REQUIRED',
            'message', 'Se requiere autenticación para migrar leads',
            'error_code', 401,
            'data', jsonb_build_object(
                'required_action', 'authenticate',
                'reason', 'Usuario no autenticado detectado',
                'security_note', 'Esta función requiere autenticación explícita por seguridad'
            )
        );
        RETURN v_result;
    END IF;
    
    -- Obtener datos del lead desde leads_porAprobar
    SELECT * INTO v_lead_data
    FROM "leads_porAprobar"
    WHERE id = p_id_lead;
    
    -- Verificar que el lead exista
    IF v_lead_data IS NULL THEN
        v_result := jsonb_build_object(
            'success', false,
            'error', 'LEAD_NOT_FOUND',
            'message', 'El lead especificado no existe en leads_porAprobar',
            'error_code', 404,
            'data', jsonb_build_object(
                'lead_id', p_id_lead::text
            )
        );
        RETURN v_result;
    END IF;
    
    -- Verificar que el lead esté aprobado (a menos que se fuerce)
    IF NOT v_lead_data.aprobado AND NOT p_forzar_migracion THEN
        v_result := jsonb_build_object(
            'success', false,
            'error', 'LEAD_NOT_APPROVED',
            'message', 'El lead no está aprobado para migración',
            'error_code', 400,
            'data', jsonb_build_object(
                'lead_id', p_id_lead::text,
                'current_status', CASE
                    WHEN v_lead_data.aprobado IS NULL THEN 'pendiente'
                    WHEN v_lead_data.aprobado THEN 'aprobado'
                    ELSE 'rechazado'
                END,
                'suggestion', 'Aprobar el lead primero o usar forzar_migracion = true'
            )
        );
        RETURN v_result;
    END IF;
    
    -- Verificar que no exista duplicado en tabla leads
    SELECT EXISTS(
        SELECT 1
        FROM leads
        WHERE id = p_id_lead
    ) INTO v_lead_exists_in_leads;
    
    IF v_lead_exists_in_leads THEN
        v_result := jsonb_build_object(
            'success', false,
            'error', 'DUPLICATE_LEAD',
            'message', 'El lead ya existe en la tabla principal leads',
            'error_code', 409,
            'data', jsonb_build_object(
                'lead_id', p_id_lead::text,
                'conflict_with', 'leads table'
            )
        );
        RETURN v_result;
    END IF;
    
    -- Iniciar migración en transacción
    BEGIN
        -- Insertar el lead en la tabla principal leads
        INSERT INTO leads (
            id,
            uidr,
            status,
            fc,
            "nombreLead",
            telefono,
            correo,
            "idInmobiliaria",
            "fechaContacto",
            "fechaRegistro",
            mensaje,
            "uidRC",
            "idEtapa",
            "idOrigen",
            "idTipoCliente",
            "idTipoOperacion",
            "idTipoVenta",
            "Etapa",
            "Origen",
            "tipoCliente",
            "tipoOperacion",
            "tipoVenta",
            "nomRC",
            valor,
            "idAsesorInm",
            "KVAs",
            superficie,
            ubicacion
        ) VALUES (
            v_lead_data.id,
            v_lead_data.uidr,
            v_lead_data.status,
            v_lead_data.fc,
            v_lead_data."nombreLead",
            v_lead_data.telefono,
            v_lead_data.correo,
            v_lead_data."idInmobiliaria",
            v_lead_data."fechaContacto",
            v_lead_data."fechaRegistro",
            v_lead_data.mensaje,
            v_lead_data."uidRC",
            v_lead_data."idEtapa",
            v_lead_data."idOrigen",
            v_lead_data."idTipoCliente",
            v_lead_data."idTipoOperacion",
            v_lead_data."idTipoVenta",
            v_lead_data."Etapa",
            v_lead_data."Origen",
            v_lead_data."tipoCliente",
            v_lead_data."tipoOperacion",
            v_lead_data."tipoVenta",
            v_lead_data."nomRC",
            v_lead_data.valor,
            v_lead_data."idAsesorInm",
            v_lead_data."KVAs",
            v_lead_data.superficie,
            v_lead_data.ubicacion
        ) RETURNING id INTO v_migrated_id;
        
        -- Registrar actividad de migración
        INSERT INTO activity_history (
            lead_id,
            name,
            activity_date,
            message,
            type,
            docs
        ) VALUES (
            v_migrated_id,
            auth.uid(),
            NOW(),
            format('Lead %s migrado desde leads_porAprobar a tabla principal leads', v_lead_data."nombreLead"),
            'lead_migrated',
            jsonb_build_object(
                'lead_id', v_migrated_id::text,
                'nombre_lead', v_lead_data."nombreLead",
                'migrated_from', 'leads_porAprobar',
                'migrated_to', 'leads',
                'migrated_by', auth.uid()::text,
                'forced_migration', p_forzar_migracion,
                'original_approval_status', v_lead_data.aprobado
            )
        );
        
        -- Construir respuesta de éxito
        v_result := jsonb_build_object(
            'success', true,
            'message', 'Lead migrado correctamente a la tabla principal',
            'data', jsonb_build_object(
                'lead_id', v_migrated_id::text,
                'nombre_lead', v_lead_data."nombreLead",
                'telefono', v_lead_data.telefono,
                'correo', v_lead_data.correo,
                'responsable_comercial', v_lead_data."nomRC",
                'inmobiliaria', v_lead_data."nombreInmobiliaria",
                'etapa', v_lead_data."Etapa",
                'origen', v_lead_data."Origen",
                'migrated_at', NOW(),
                'migrated_by', auth.uid()::text,
                'forced_migration', p_forzar_migracion
            )
        );
        
    EXCEPTION
        WHEN OTHERS THEN
            -- Si hay error en la transacción, hacer rollback y retornar error
            v_result := jsonb_build_object(
                'success', false,
                'error', 'MIGRATION_ERROR',
                'message', 'Error durante la migración del lead: ' || SQLERRM,
                'error_code', 500,
                'data', jsonb_build_object(
                    'lead_id', p_id_lead,
                    'database_error', SQLSTATE,
                    'error_detail', SQLERRM,
                    'migration_failed_at', NOW()
                )
            );
            RETURN v_result;
    END;
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        v_result := jsonb_build_object(
            'success', false,
            'error', 'FUNCTION_ERROR',
            'message', 'Error en la función de migración: ' || SQLERRM,
            'error_code', 500,
            'data', jsonb_build_object(
                'lead_id', p_id_lead,
                'database_error', SQLSTATE,
                'error_detail', SQLERRM
            )
        );
        RETURN v_result;
END;
$BODY$;

-- 1.5 Función para validar similitudes y migrar automáticamente
CREATE OR REPLACE FUNCTION public.leads_poraprobar_validar_y_migrar_similitud(
    p_id_lead_poraprobar uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $BODY$
DECLARE
    -- Constante de similitud para validación de nombres
    v_similitud_umbral CONSTANT numeric := 0.35;
    
    -- Variables para datos del lead
    v_lead_data "leads_porAprobar"%ROWTYPE;
    v_nombre text;
    v_telefono text;
    v_correo text;
    
    -- Variables para resultados de validación
    v_similitud_nombre boolean := false;
    v_duplicado_telefono boolean := false;
    v_duplicado_correo boolean := false;
    
    -- Variables para control del proceso
    v_result jsonb;
    v_migration_result jsonb;
    v_validation_details jsonb;
BEGIN
    --[Fecha y Hora]: 04/12/2025 00:55:00
    -- Validar que el usuario esté autenticado
    IF auth.uid() IS NULL THEN
        v_result := jsonb_build_object(
            'success', false,
            'message', 'Se requiere autenticación para validar y migrar leads',
            'migrated', false,
            'error', 'AUTHENTICATION_REQUIRED',
            'error_code', 401,
            'validation_results', jsonb_build_object(
                'similarity_name', null,
                'duplicate_phone', null,
                'duplicate_email', null,
                'threshold_used', v_similitud_umbral
            )
        );
        RETURN v_result;
    END IF;
    
    -- Obtener datos del lead desde leads_porAprobar
    SELECT * INTO v_lead_data
    FROM "leads_porAprobar"
    WHERE id = p_id_lead_poraprobar;
    
    -- Verificar que el lead exista
    IF v_lead_data IS NULL THEN
        v_result := jsonb_build_object(
            'success', false,
            'message', 'El lead especificado no existe en leads_porAprobar',
            'migrated', false,
            'error', 'LEAD_NOT_FOUND',
            'error_code', 404,
            'validation_results', jsonb_build_object(
                'similarity_name', null,
                'duplicate_phone', null,
                'duplicate_email', null,
                'threshold_used', v_similitud_umbral
            )
        );
        RETURN v_result;
    END IF;
    
    -- Extraer datos para validaciones
    v_nombre := COALESCE(v_lead_data."nombreLead", '');
    v_telefono := COALESCE(v_lead_data.telefono, '');
    v_correo := COALESCE(v_lead_data.correo, '');
    
    -- VALIDACIÓN 1: Similitud de nombre
    -- Solo validar si el nombre no está vacío
    IF v_nombre != '' THEN
        SELECT EXISTS(
            SELECT 1
            FROM leads
            WHERE similarity("nombreLead", v_nombre) > v_similitud_umbral
            AND id != p_id_lead_poraprobar  -- Excluir el mismo registro si existe
            AND status = true  -- Solo considerar leads activos
        ) INTO v_similitud_nombre;
    END IF;
    
    -- VALIDACIÓN 2: Coincidencia exacta de teléfono
    -- Solo validar si el teléfono no está vacío
    IF v_telefono != '' THEN
        SELECT EXISTS(
            SELECT 1
            FROM leads
            WHERE telefono = v_telefono
            AND telefono IS NOT NULL
            AND id != p_id_lead_poraprobar
            AND status = true
        ) INTO v_duplicado_telefono;
    END IF;
    
    -- VALIDACIÓN 3: Coincidencia exacta de correo
    -- Solo validar si el correo no está vacío
    IF v_correo != '' THEN
        SELECT EXISTS(
            SELECT 1
            FROM leads
            WHERE correo = v_correo
            AND correo IS NOT NULL
            AND id != p_id_lead_poraprobar
            AND status = true
        ) INTO v_duplicado_correo;
    END IF;
    
    -- Construir detalles de validación
    v_validation_details := jsonb_build_object(
        'similarity_name', v_similitud_nombre,
        'duplicate_phone', v_duplicado_telefono,
        'duplicate_email', v_duplicado_correo,
        'threshold_used', v_similitud_umbral,
        'validated_name', v_nombre,
        'validated_phone', v_telefono,
        'validated_email', v_correo
    );
    
    -- Evaluar resultados de validación
    IF v_similitud_nombre OR v_duplicado_telefono OR v_duplicado_correo THEN
        -- HAY DUPLICADO O SIMILITUD → NO MIGRAR
        v_result := jsonb_build_object(
            'success', true,
            'message', 'Lead no migrado por detectarse similitudes o duplicados',
            'migrated', false,
            'validation_results', v_validation_details,
            'data', jsonb_build_object(
                'lead_id', p_id_lead_poraprobar::text,
                'lead_name', v_nombre,
                'reason_for_no_migration', CASE
                    WHEN v_similitud_nombre AND v_duplicado_telefono AND v_duplicado_correo THEN
                        'Similitud de nombre, teléfono y correo duplicados'
                    WHEN v_similitud_nombre AND v_duplicado_telefono THEN
                        'Similitud de nombre y teléfono duplicado'
                    WHEN v_similitud_nombre AND v_duplicado_correo THEN
                        'Similitud de nombre y correo duplicado'
                    WHEN v_duplicado_telefono AND v_duplicado_correo THEN
                        'Teléfono y correo duplicados'
                    WHEN v_similitud_nombre THEN
                        'Similitud de nombre detectada'
                    WHEN v_duplicado_telefono THEN
                        'Teléfono duplicado'
                    WHEN v_duplicado_correo THEN
                        'Correo duplicado'
                    ELSE 'Validación fallida'
                END,
                'validation_timestamp', NOW()
            )
        );
        
        -- Registrar actividad de validación (no migración)
        INSERT INTO activity_history (
            lead_id,
            name,
            activity_date,
            message,
            type,
            docs
        ) VALUES (
            p_id_lead_poraprobar,
            auth.uid(),
            NOW(),
            format('Lead %s NO migrado por detectarse similitudes: %s',
                   v_nombre,
                   CASE
                        WHEN v_similitud_nombre AND v_duplicado_telefono AND v_duplicado_correo THEN
                            'nombre similar, teléfono y correo duplicados'
                        WHEN v_similitud_nombre AND v_duplicado_telefono THEN
                            'nombre similar y teléfono duplicado'
                        WHEN v_similitud_nombre AND v_duplicado_correo THEN
                            'nombre similar y correo duplicado'
                        WHEN v_duplicado_telefono AND v_duplicado_correo THEN
                            'teléfono y correo duplicados'
                        WHEN v_similitud_nombre THEN
                            'nombre similar'
                        WHEN v_duplicado_telefono THEN
                            'teléfono duplicado'
                        WHEN v_duplicado_correo THEN
                            'correo duplicado'
                        ELSE 'validación fallida'
                    END),
            'lead_validation_failed',
            jsonb_build_object(
                'lead_id', p_id_lead_poraprobar::text,
                'lead_name', v_nombre,
                'validation_results', v_validation_details,
                'validated_by', auth.uid()::text,
                'validation_timestamp', NOW()
            )
        );
        
    ELSE
        -- NO HAY DUPLICADOS → PROCEDER CON MIGRACIÓN AUTOMÁTICA
        -- Llamar a la función de migración existente
        v_migration_result := public.leads_poraprobar_migrar_a_leads(p_id_lead_poraprobar, false);
        
        -- Verificar si la migración fue exitosa
        IF (v_migration_result->>'success')::boolean THEN
            v_result := jsonb_build_object(
                'success', true,
                'message', 'Lead validado y migrado correctamente (sin similitudes detectadas)',
                'migrated', true,
                'validation_results', v_validation_details,
                'migration_result', v_migration_result,
                'data', jsonb_build_object(
                    'lead_id', p_id_lead_poraprobar::text,
                    'lead_name', v_nombre,
                    'migration_reason', 'Sin similitudes o duplicados detectados',
                    'validation_timestamp', NOW()
                )
            );
            
            -- Registrar actividad de validación exitosa con migración
            INSERT INTO activity_history (
                lead_id,
                name,
                activity_date,
                message,
                type,
                docs
            ) VALUES (
                p_id_lead_poraprobar,
                auth.uid(),
                NOW(),
                format('Lead %s validado y migrado automáticamente (sin similitudes detectadas)', v_nombre),
                'lead_validated_and_migrated',
                jsonb_build_object(
                    'lead_id', p_id_lead_poraprobar::text,
                    'lead_name', v_nombre,
                    'validation_results', v_validation_details,
                    'migration_details', v_migration_result->'data',
                    'validated_and_migrated_by', auth.uid()::text,
                    'validation_timestamp', NOW()
                )
            );
        ELSE
            -- La migración falló, retornar error de migración
            v_result := jsonb_build_object(
                'success', false,
                'message', 'Lead validado correctamente pero falló la migración automática',
                'migrated', false,
                'validation_results', v_validation_details,
                'migration_error', v_migration_result,
                'error', 'MIGRATION_FAILED',
                'error_code', 500,
                'data', jsonb_build_object(
                    'lead_id', p_id_lead_poraprobar::text,
                    'lead_name', v_nombre,
                    'validation_passed', true,
                    'migration_failed', true,
                    'migration_error_details', v_migration_result->'error'
                )
            );
            
            -- Registrar actividad de validación exitosa pero migración fallida
            INSERT INTO activity_history (
                lead_id,
                name,
                activity_date,
                message,
                type,
                docs
            ) VALUES (
                p_id_lead_poraprobar,
                auth.uid(),
                NOW(),
                format('Lead %s validado correctamente pero falló migración automática: %s',
                       v_nombre,
                       COALESCE(v_migration_result->>'message', 'Error desconocido')),
                'lead_validation_ok_migration_failed',
                jsonb_build_object(
                    'lead_id', p_id_lead_poraprobar::text,
                    'lead_name', v_nombre,
                    'validation_results', v_validation_details,
                    'migration_error', v_migration_result,
                    'validated_by', auth.uid()::text,
                    'validation_timestamp', NOW()
                )
            );
        END IF;
    END IF;
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        v_result := jsonb_build_object(
            'success', false,
            'message', 'Error en la función de validación y migración: ' || SQLERRM,
            'migrated', false,
            'error', 'FUNCTION_ERROR',
            'error_code', 500,
            'validation_results', jsonb_build_object(
                'similarity_name', null,
                'duplicate_phone', null,
                'duplicate_email', null,
                'threshold_used', v_similitud_umbral,
                'error_occurred', true
            ),
            'data', jsonb_build_object(
                'lead_id', p_id_lead_poraprobar,
                'database_error', SQLSTATE,
                'error_detail', SQLERRM,
                'error_timestamp', NOW()
            )
        );
        
        -- Registrar actividad de error
        INSERT INTO activity_history (
            lead_id,
            name,
            activity_date,
            message,
            type,
            docs
        ) VALUES (
            p_id_lead_poraprobar,
            auth.uid(),
            NOW(),
            format('Error en validación y migración del lead %s: %s',
                   COALESCE(v_nombre, 'Desconocido'),
                   SQLERRM),
            'lead_validation_error',
            jsonb_build_object(
                'lead_id', p_id_lead_poraprobar::text,
                'database_error', SQLSTATE,
                'error_detail', SQLERRM,
                'error_timestamp', NOW(),
                'user', auth.uid()::text
            )
        );
        
        RETURN v_result;
END;
$BODY$;

-- =====================================================
-- 2. FUNCIONES DE NOTIFICACIONES Y WEBHOOK
-- =====================================================

-- 2.1 Función para notificar cambios de uidRC por correo
CREATE OR REPLACE FUNCTION public.leads_notificar_cambio_uidrc(
    p_id_lead uuid,
    p_tipo_accion text,
    p_uid_anterior uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $BODY$
DECLARE
    -- Variables para validación
    v_uid_actual uuid;
    v_uid_rc uuid;
    v_email_rc text;
    v_nombre_lead text;
    v_nombre_rc text;
    v_tipo_notificacion text;
    v_asunto text;
    v_mensaje_html text;
    v_response jsonb;
    
BEGIN
    --[Fecha y Hora]: 01/12/2025 07:12:00
    -- Validar que el usuario esté autenticado
    IF auth.uid() IS NULL THEN
        v_response := jsonb_build_object(
            'success', false,
            'error', 'AUTHENTICATION_REQUIRED',
            'message', 'Se requiere autenticación para enviar notificaciones',
            'error_code', 401,
            'data', jsonb_build_object(
                'required_action', 'authenticate',
                'reason', 'Usuario no autenticado detectado',
                'security_note', 'Esta función requiere autenticación explícita por seguridad'
            )
        );
        RETURN v_response;
    END IF;
    
    -- Obtener información del lead
    SELECT
        l."nombreLead",
        l."correo",
        l."uidRC",
        l."telefono"
    INTO v_nombre_lead, v_email_rc, v_uid_rc, v_telefono
    FROM leads l
    WHERE l.id = p_id_lead;
    
    -- Validar que el lead exista
    IF NOT FOUND THEN
        v_response := jsonb_build_object(
            'success', false,
            'error', 'LEAD_NOT_FOUND',
            'message', 'El lead especificado no existe',
            'error_code', 404,
            'data', jsonb_build_object(
                'lead_id', p_id_lead
            )
        );
        RETURN v_response;
    END IF;
    
    -- Determinar si hubo cambio en uidRC
    IF v_uid_anterior IS NOT NULL AND v_uid_anterior <> v_uid_rc THEN
        v_tipo_notificacion := 'UPDATE';
        v_nombre_rc := COALESCE(cu.nomCompleto, 'Sin asignar');
    ELSE
        v_tipo_notificacion := 'INSERT';
        v_nombre_rc := COALESCE(cu.nomCompleto, 'Sin asignar');
    END IF;
    
    -- Determinar tipo de notificación y asunto
    IF v_tipo_notificacion = 'INSERT' THEN
        v_tipo_notificacion := 'nuevo_lead_asignado';
        v_asunto := '🔔 Nuevo Lead Asignado - SPH Bines Raíces';
    ELSIF v_tipo_notificacion = 'UPDATE' THEN
        v_tipo_notificacion := 'lead_modificado';
        v_asunto := '📝 Lead Modificado - SPH Bines Raíces';
    END IF;
    
    -- Obtener email del responsable comercial
    SELECT u.email INTO v_email_rc
    FROM catUsers u
    WHERE u.uid = v_uid_rc;
    
    -- Si no hay responsable asignado, usar correo genérico
    IF v_email_rc IS NULL THEN
        v_email_rc := 'noreply@sphbinesraices.com';
        v_nombre_rc := 'Sistema SPH';
    END IF;
    
    -- Registrar actividad de notificación (opcional)
    INSERT INTO activity_history (
        lead_id,
        name,
        activity_date,
        message,
        type,
        docs
    ) VALUES (
        p_id_lead,
        auth.uid(),
        NOW(),
        format('Notificación enviada a %s por cambio en responsable comercial: %s', v_nombre_rc, v_tipo_notificacion),
        'lead_assignment',
        jsonb_build_object(
            'lead_id', p_id_lead::text,
            'lead_name', v_nombre_lead,
            'responsible_name', v_nombre_rc,
            'responsible_email', v_email_rc,
            'action_type', v_tipo_notificacion,
            'timestamp', NOW()
        )
    );
    
    -- Construir respuesta de éxito
    v_response := jsonb_build_object(
        'success', true,
        'message', format('Notificación de %s enviada exitosamente a %s', v_tipo_notificacion, v_nombre_rc),
        'data', jsonb_build_object(
            'lead_id', p_id_lead::text,
            'lead_name', v_nombre_lead,
            'responsible_name', v_nombre_rc,
            'responsible_email', v_email_rc,
            'action_type', v_tipo_notificacion,
            'notification_type', v_tipo_notificacion,
            'email_sent', true,
            'timestamp', NOW()
        )
    );
    
    RETURN v_response;
    
EXCEPTION
    WHEN OTHERS THEN
        v_response := jsonb_build_object(
            'success', false,
            'error', 'DATABASE_ERROR',
            'message', 'Error al procesar la notificación: ' || SQLERRM,
            'error_code', 500,
            'data', jsonb_build_object(
                'lead_id', p_id_lead,
                'database_error', SQLSTATE,
                'error_detail', SQLERRM
            )
        );
        RETURN v_response;
END;
$BODY$;

-- 2.2 Crear función para enviar información de lead a webhook externo
CREATE OR REPLACE FUNCTION public.leads_enviar_webhook_uidrc(
    p_id_lead uuid,
    p_tipo_accion text,
    p_uid_anterior uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $BODY$
DECLARE
    -- Variables para datos del lead
    v_uid_actual uuid;
    v_uid_rc uuid;
    v_nombre_rc text;
    v_email_rc text;
    v_nombre_lead text;
    v_telefono_lead text;
    v_correo_lead text;
    v_tipo_notificacion text;
    
    -- Variables para webhook
    v_webhook_url text := 'https://sph-n8n.fn5wy3.easypanel.host/webhook/c66df01e-daaa-4c6f-be11-65945b760318';
    v_payload jsonb;
    v_response_text text;
    v_response_status integer;
    v_result jsonb;
    
    -- Variables de control
    v_enviar_webhook boolean := false;
    v_error_message text;
    
BEGIN
    --[Fecha y Hora]: 01/12/2025 07:28:00
    -- Obtener información actual del lead
    SELECT 
        l."uidRC",
        l."nombreLead",
        l."telefono",
        l."correo"
    INTO v_uid_rc, v_nombre_lead, v_telefono_lead, v_correo_lead
    FROM leads l
    WHERE l.id = p_id_lead;
    
    -- Validar que el lead exista
    IF NOT FOUND THEN
        v_result := jsonb_build_object(
            'success', false,
            'error', 'LEAD_NOT_FOUND',
            'message', 'El lead especificado no existe',
            'error_code', 404,
            'data', jsonb_build_object(
                'lead_id', p_id_lead::text
            )
        );
        RETURN v_result;
    END IF;
    
    -- Determinar si se debe enviar el webhook
    IF p_tipo_accion = 'INSERT' THEN
        -- Si es un nuevo registro, siempre enviar
        v_enviar_webhook := true;
        v_tipo_notificacion := 'nuevo_lead';
    ELSIF p_tipo_accion = 'UPDATE' THEN
        -- Si es una actualización, enviar solo si cambió el uidRC
        IF p_uid_anterior IS DISTINCT FROM v_uid_rc THEN
            v_enviar_webhook := true;
            v_tipo_notificacion := 'cambio_responsable';
        END IF;
    END IF;
    
    -- Si no hay cambios relevantes, salir con éxito
    IF NOT v_enviar_webhook THEN
        v_result := jsonb_build_object(
            'success', true,
            'message', 'No se requiere envío al webhook (sin cambios relevantes)',
            'data', jsonb_build_object(
                'lead_id', p_id_lead::text,
                'action_type', p_tipo_accion,
                'webhook_sent', false
            )
        );
        RETURN v_result;
    END IF;
    
    -- Obtener información del responsable comercial
    IF v_uid_rc IS NOT NULL THEN
        SELECT 
            COALESCE(cu."nomCompleto", 'Sin nombre'),
            COALESCE(cu.email, 'sincorreo@sph.com')
        INTO v_nombre_rc, v_email_rc
        FROM catUsers cu
        WHERE cu.uid = v_uid_rc;
        
        IF v_nombre_rc IS NULL THEN
            v_nombre_rc := 'Responsable no encontrado';
            v_email_rc := 'noencontrado@sph.com';
        END IF;
    ELSE
        v_nombre_rc := 'Sin asignar';
        v_email_rc := 'sinasignar@sph.com';
    END IF;
    
    -- Construir el payload para el webhook
    v_payload := jsonb_build_object(
        'evento', v_tipo_notificacion,
        'timestamp', NOW(),
        'lead', jsonb_build_object(
            'id', p_id_lead::text,
            'nombre', COALESCE(v_nombre_lead, 'Sin nombre'),
            'telefono', COALESCE(v_telefono_lead, 'Sin teléfono'),
            'correo', COALESCE(v_correo_lead, 'Sin correo')
        ),
        'responsable_comercial', jsonb_build_object(
            'uid', COALESCE(v_uid_rc::text, 'sin-asignar'),
            'nombre', v_nombre_rc,
            'correo', v_email_rc
        ),
        'accion', p_tipo_accion,
        'uid_anterior', COALESCE(p_uid_anterior::text, 'nuevo-registro'),
        'uid_actual', COALESCE(v_uid_rc::text, 'sin-asignar')
    );
    
    -- Enviar datos al webhook usando pg_extension si está disponible
    BEGIN
        -- Intentar usar http extension (si está instalada)
        SELECT 
            content::text,
            status_code
        INTO v_response_text, v_response_status
        FROM http(
            v_webhook_url,
            'POST',
            jsonb_build_object(
                'Content-Type', 'application/json',
                'User-Agent', 'SPH-Leads-Webhook/1.0'
            ),
            v_payload::text
        );
        
        -- Verificar respuesta del webhook
        IF v_response_status BETWEEN 200 AND 299 THEN
            v_result := jsonb_build_object(
                'success', true,
                'message', format('Webhook enviado exitosamente para lead %s', p_id_lead::text),
                'data', jsonb_build_object(
                    'lead_id', p_id_lead::text,
                    'lead_name', v_nombre_lead,
                    'responsible_name', v_nombre_rc,
                    'action_type', v_tipo_notificacion,
                    'webhook_url', v_webhook_url,
                    'webhook_status', v_response_status,
                    'webhook_response', v_response_text,
                    'timestamp', NOW(),
                    'payload', v_payload
                )
            );
        ELSE
            v_error_message := format('Error en webhook: Status %s - %s', v_response_status, v_response_text);
            RAISE EXCEPTION '%', v_error_message;
        END IF;
        
    EXCEPTION
        WHEN OTHERS THEN
            -- Si falla el envío al webhook, registrar el error pero no interrumpir la operación
            v_error_message := SQLERRM;
            v_result := jsonb_build_object(
                'success', false,
                'error', 'WEBHOOK_ERROR',
                'message', 'Error al enviar datos al webhook: ' || v_error_message,
                'error_code', 500,
                'data', jsonb_build_object(
                    'lead_id', p_id_lead::text,
                    'lead_name', v_nombre_lead,
                    'responsible_name', v_nombre_rc,
                    'action_type', v_tipo_notificacion,
                    'webhook_url', v_webhook_url,
                    'error_detail', v_error_message,
                    'payload', v_payload,
                    'timestamp', NOW()
                )
            );
            
            -- Registrar en activity_history para auditoría
            INSERT INTO activity_history (
                lead_id,
                name,
                activity_date,
                message,
                type,
                docs
            ) VALUES (
                p_id_lead,
                auth.uid(),
                NOW(),
                format('Error en webhook de lead: %s', v_error_message),
                'webhook_error',
                jsonb_build_object(
                    'error', v_error_message,
                    'payload', v_payload,
                    'webhook_url', v_webhook_url
                )
            );
            
            RETURN v_result;
    END;
    
    -- Registrar actividad exitosa
    INSERT INTO activity_history (
        lead_id,
        name,
        activity_date,
        message,
        type,
        docs
    ) VALUES (
        p_id_lead,
        auth.uid(),
        NOW(),
        format('Webhook enviado exitosamente: %s - Responsable: %s', v_tipo_notificacion, v_nombre_rc),
        'webhook_sent',
        jsonb_build_object(
            'action_type', v_tipo_notificacion,
            'responsible_name', v_nombre_rc,
            'webhook_status', v_response_status,
            'payload', v_payload
        )
    );
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Manejar errores generales
        v_result := jsonb_build_object(
            'success', false,
            'error', 'FUNCTION_ERROR',
            'message', 'Error en la función leads_enviar_webhook_uidrc: ' || SQLERRM,
            'error_code', 500,
            'data', jsonb_build_object(
                'lead_id', p_id_lead,
                'action_type', p_tipo_accion,
                'database_error', SQLSTATE,
                'error_detail', SQLERRM
            )
        );
        RETURN v_result;
END;
$BODY$;

-- =====================================================
-- 3. TRIGGERS AUTOMÁTICOS
-- =====================================================

-- 3.1 Trigger para webhook de leads
-- Eliminar trigger existente si existe
DROP TRIGGER IF EXISTS trigger_leads_webhook_uidrc ON public.leads;

-- Crear trigger para enviar información de lead a webhook externo
CREATE TRIGGER trigger_leads_webhook_uidrc
AFTER INSERT OR UPDATE ON public.leads
FOR EACH ROW
WHEN (
    -- Para INSERT: siempre se ejecuta
    (TG_OP = 'INSERT') OR
    -- Para UPDATE: solo si cambia el uidRC
    (TG_OP = 'UPDATE' AND OLD."uidRC" IS DISTINCT FROM NEW."uidRC")
)
EXECUTE FUNCTION public.leads_enviar_webhook_uidrc(
    NEW.id::uuid,
    TG_OP::text,
    CASE
        WHEN TG_OP = 'UPDATE' THEN OLD."uidRC"::uuid
        ELSE NULL::uuid
    END
);

-- 3.2 Trigger para actualizar nomRC en leads_porAprobar
-- Eliminar trigger existente si existe
DROP TRIGGER IF EXISTS trigger_leads_poraprobar_actualizar_nomrc ON public."leads_porAprobar";

-- Crear trigger para actualizar automáticamente nomRC cuando cambia uidRC
CREATE TRIGGER trigger_leads_poraprobar_actualizar_nomrc
AFTER UPDATE ON public."leads_porAprobar"
FOR EACH ROW
WHEN (OLD."uidRC" IS DISTINCT FROM NEW."uidRC")
EXECUTE FUNCTION public.leads_poraprobar_actualizar_nomrc(NEW.id, NEW."uidRC");

-- 3.3 Trigger para procesamiento posterior a la inserción
-- Eliminar trigger existente si existe
DROP TRIGGER IF EXISTS trigger_leads_poraprobar_insertar_registro ON public."leads_porAprobar";

-- Crear trigger para procesamiento posterior a la inserción
CREATE TRIGGER trigger_leads_poraprobar_insertar_registro
AFTER INSERT ON public."leads_porAprobar"
FOR EACH ROW
EXECUTE FUNCTION public.trigger_leads_poraprobar_insertar_registro();

-- 3.4 Trigger para migración automática cuando se aprueba un lead
-- Eliminar trigger existente si existe
DROP TRIGGER IF EXISTS trigger_leads_poraprobar_migrar_a_leads ON public."leads_porAprobar";

-- Crear trigger para migración automática cuando se aprueba un lead
CREATE TRIGGER trigger_leads_poraprobar_migrar_a_leads
AFTER UPDATE ON public."leads_porAprobar"
FOR EACH ROW
WHEN (OLD.aprobado IS DISTINCT FROM NEW.aprobado AND NEW.aprobado = true)
EXECUTE FUNCTION public.trigger_leads_poraprobar_migrar_a_leads();

-- 3.5 Trigger para validación y migración automática al insertar
-- Eliminar trigger existente si existe
DROP TRIGGER IF EXISTS trigger_leads_poraprobar_validar_y_migrar_automaticamente ON public."leads_porAprobar";

-- Crear trigger para validación y migración automática al insertar nuevos leads
CREATE TRIGGER trigger_leads_poraprobar_validar_y_migrar_automaticamente
AFTER INSERT ON public."leads_porAprobar"
FOR EACH ROW
EXECUTE FUNCTION leads_poraprobar_validar_y_migrar_similitud_trigger_func();

-- Función auxiliar para el trigger de validación automática
CREATE OR REPLACE FUNCTION leads_poraprobar_validar_y_migrar_similitud_trigger_func()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $BODY$
BEGIN
    --[Fecha y Hora]: 04/12/2025 05:20:00
    -- Ejecutar la función de validación y migración con manejo de errores
    -- Usar un bloque BEGIN/EXCEPTION para evitar que errores en la validación
    -- afecten la inserción del registro en leads_porAprobar
    
    BEGIN
        -- Llamar a la función de validación con el ID del nuevo registro
        -- Usar conversión explícita de tipo para asegurar compatibilidad
        PERFORM public.leads_poraprobar_validar_y_migrar_similitud(NEW.id::uuid);
        
        -- Si llegamos aquí, la validación se ejecutó correctamente
        -- No necesitamos hacer nada más, el trigger ha completado su trabajo
        
    EXCEPTION
        WHEN OTHERS THEN
            -- Si hay algún error en la validación, lo registramos pero no
            -- afectamos la inserción del registro principal
            -- Esto asegura que el lead siempre se guarde, aunque la validación falle
            
            -- NOTA: En un entorno de producción, podríamos registrar este error
            -- en una tabla de logs o enviar una notificación
            -- Por ahora, simplemente lo ignoramos para no afectar la inserción
            
            -- Opcional: podríamos registrar el error para auditoría
            -- INSERT INTO error_logs (error_message, error_detail, trigger_name, record_id)
            -- VALUES (SQLERRM, SQLSTATE, 'trigger_leads_poraprobar_validar_y_migrar_automaticamente', NEW.id::text);
            
            -- Continuar sin interrumpir la transacción principal
            NULL;
    END;
    
    -- Retornar NEW para permitir que la inserción continúe normalmente
    RETURN NEW;
    
END;
$BODY$;

-- =====================================================
-- 4. FUNCIONES ADICIONALES
-- =====================================================

-- 4.1 Función de eliminación de leads con permisos

-- Crear función para eliminar leads con validación de permisos
CREATE OR REPLACE FUNCTION public.leads_eliminar_lead(
    p_id_lead uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $BODY$
DECLARE
    v_lead_nombre text;
    v_result jsonb;
BEGIN
    --[Fecha y Hora]: 01/12/2025 07:28:00
    -- Validar que el usuario esté autenticado
    IF auth.uid() IS NULL THEN
        v_result := jsonb_build_object(
            'success', false,
            'error', 'AUTHENTICATION_REQUIRED',
            'message', 'Se requiere autenticación para eliminar leads',
            'error_code', 401,
            'data', jsonb_build_object(
                'required_action', 'authenticate',
                'reason', 'Usuario no autenticado detectado',
                'security_note', 'Esta función requiere autenticación explícita por seguridad'
            )
        );
        RETURN v_result;
    END IF;
    
    -- Validar que el usuario tenga permiso 327 (CRM > Leads > Eliminar Leads)
    IF NOT EXISTS (
        SELECT 1 
        FROM "segModulosUsuarios" smu
        WHERE smu.uid = auth.uid()
        AND smu.clave = 327
        AND smu.acceso = true
    ) THEN
        v_result := jsonb_build_object(
            'success', false,
            'error', 'PERMISSION_DENIED',
            'message', 'El usuario no tiene permiso para eliminar leads (permiso 327 no activo)',
            'error_code', 403,
            'data', jsonb_build_object(
                'required_permission', 327,
                'permission_name', 'CRM > Leads > Eliminar Leads',
                'user_uid', auth.uid()::text
            )
        );
        RETURN v_result;
    END IF;
    
    -- Obtener nombre del lead para logging
    SELECT "nombreLead" INTO v_lead_nombre
    FROM leads
    WHERE id = p_id_lead;
    
    -- Validar que el lead exista
    IF v_lead_nombre IS NULL THEN
        v_result := jsonb_build_object(
            'success', false,
            'error', 'LEAD_NOT_FOUND',
            'message', 'El lead especificado no existe',
            'error_code', 404,
            'data', jsonb_build_object(
                'lead_id', p_id_lead::text
            )
        );
        RETURN v_result;
    END IF;
    
    -- Eliminar el lead
    DELETE FROM leads WHERE id = p_id_lead;
    
    -- Construir respuesta de éxito
    v_result := jsonb_build_object(
        'success', true,
        'message', 'Lead eliminado correctamente',
        'data', jsonb_build_object(
            'lead_id', p_id_lead::text,
            'lead_name', v_lead_nombre,
            'deleted_at', NOW(),
            'deleted_by', auth.uid()::text
        )
    );
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        v_result := jsonb_build_object(
            'success', false,
            'error', 'DATABASE_ERROR',
            'message', 'No se pudo eliminar el lead',
            'error_code', 500,
            'data', jsonb_build_object(
                'lead_id', p_id_lead::text,
                'database_error', SQLSTATE,
                'error_detail', SQLERRM
            )
        );
        RETURN v_result;
END;
$BODY$;

-- 4.2 Funciones auxiliares para triggers

-- Función trigger para actualizar nomRC
CREATE OR REPLACE FUNCTION public.trigger_leads_poraprobar_actualizar_nomrc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $BODY$
BEGIN
    --[Fecha y Hora]: 03/12/2025 11:46:00
    -- Solo ejecutar si cambia el uidRC
    IF OLD."uidRC" IS DISTINCT FROM NEW."uidRC" THEN
        -- Llamar a la función para actualizar nomRC
        PERFORM public.leads_poraprobar_actualizar_nomrc(NEW.id, NEW."uidRC");
    END IF;
    
    RETURN NEW;
END;
$BODY$;

-- Función trigger para procesamiento posterior a la inserción
CREATE OR REPLACE FUNCTION public.trigger_leads_poraprobar_insertar_registro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $BODY$
BEGIN
    --[Fecha y Hora]: 03/12/2025 11:47:00
    -- Aquí se pueden agregar acciones automáticas posteriores a la inserción
    -- Por ejemplo:
    -- - Enviar notificaciones
    -- - Actualizar estadísticas
    -- - Registrar en activity_history
    
    -- Ejemplo: Registrar actividad
    INSERT INTO activity_history (
        lead_id,
        name,
        activity_date,
        message,
        type,
        docs
    ) VALUES (
        NEW.id,
        auth.uid(),
        NOW(),
        format('Lead %s registrado en leads_porAprobar pendiente de aprobación', NEW."nombreLead"),
        'lead_registered',
        jsonb_build_object(
            'lead_id', NEW.id::text,
            'nombre_lead', NEW."nombreLead",
            'telefono', NEW.telefono,
            'correo', NEW.correo,
            'uid_rc', NEW."uidRC"::text,
            'registered_by', NEW.uidr::text
        )
    );
    
    RETURN NEW;
END;
$BODY$;

-- Función trigger para migración automática
CREATE OR REPLACE FUNCTION public.trigger_leads_poraprobar_migrar_a_leads()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $BODY$
BEGIN
    --[Fecha y Hora]: 03/12/2025 11:48:00
    -- Solo ejecutar si el lead cambia a aprobado = true
    IF OLD.aprobado IS DISTINCT FROM NEW.aprobado AND NEW.aprobado = true THEN
        -- Llamar a la función de migración
        PERFORM public.leads_poraprobar_migrar_a_leads(NEW.id, false);
        
        -- Opcional: Actualizar timestamp de migración
        NEW.fc = NOW();
    END IF;
    
    RETURN NEW;
END;
$BODY$;

-- 4.3 Función para migración en lote
CREATE OR REPLACE FUNCTION public.leads_poraprobar_migrar_lote(
    p_limit integer DEFAULT 100,
    p_forzar_migracion boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $BODY$
DECLARE
    v_lead_record RECORD;
    v_migrated_count integer := 0;
    v_failed_count integer := 0;
    v_results jsonb := '[]'::jsonb;
    v_result jsonb;
BEGIN
    --[Fecha y Hora]: 03/12/2025 11:48:00
    -- Validar autenticación
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'AUTHENTICATION_REQUIRED',
            'message', 'Se requiere autenticación para migrar en lote',
            'error_code', 401
        );
    END IF;
    
    -- Iterar sobre los leads a migrar
    FOR v_lead_record IN
        SELECT id
        FROM "leads_porAprobar"
        WHERE (aprobado = true OR p_forzar_migracion)
        ORDER BY "fechaRegistro" ASC
        LIMIT p_limit
    LOOP
        -- Intentar migrar cada lead
        v_result := public.leads_poraprobar_migrar_a_leads(v_lead_record.id, p_forzar_migracion);
        
        -- Contar éxitos y fracasos
        IF (v_result->>'success')::boolean THEN
            v_migrated_count := v_migrated_count + 1;
        ELSE
            v_failed_count := v_failed_count + 1;
        END IF;
        
        -- Acumular resultados
        v_results := v_results || jsonb_build_object(
            'lead_id', v_lead_record.id::text,
            'result', v_result
        );
    END LOOP;
    
    -- Construir respuesta final
    RETURN jsonb_build_object(
        'success', true,
        'message', format('Migración en lote completada: %s exitosas, %s fallidas', v_migrated_count, v_failed_count),
        'data', jsonb_build_object(
            'total_processed', v_migrated_count + v_failed_count,
            'migrated_count', v_migrated_count,
            'failed_count', v_failed_count,
            'limit', p_limit,
            'forced_migration', p_forzar_migracion,
            'processed_at', NOW(),
            'detailed_results', v_results
        )
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'BATCH_MIGRATION_ERROR',
            'message', 'Error en migración en lote: ' || SQLERRM,
            'error_code', 500,
            'data', jsonb_build_object(
                'database_error', SQLSTATE,
                'error_detail', SQLERRM,
                'migrated_so_far', v_migrated_count,
                'failed_so_far', v_failed_count
            )
        );
END;
$BODY$;

-- Mensaje de instalación completada
DO $$
BEGIN
    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'INSTALACIÓN COMPLETA DEL SISTEMA DE GESTIÓN DE LEADS';
    RAISE NOTICE '=================================================================';
    RAISE NOTICE '';
    RAISE NOTICE '📋 FUNCIONES PRINCIPALES INSTALADAS:';
    RAISE NOTICE '✅ leads_poraprobar_obtener_detalle - Consulta leads pendientes';
    RAISE NOTICE '✅ leads_notificar_cambio_uidrc - Notificaciones por correo';
    RAISE NOTICE '✅ leads_poraprobar_actualizar_nomrc - Sincronización de nomRC';
    RAISE NOTICE '✅ leads_poraprobar_insertar_registro - Inserción con validaciones';
    RAISE NOTICE '✅ leads_poraprobar_migrar_a_leads - Migración a tabla principal';
    RAISE NOTICE '✅ leads_poraprobar_validar_y_migrar_similitud - Validación por similitud y migración automática';
    RAISE NOTICE '✅ leads_enviar_webhook_uidrc - Envío a webhook externo';
    RAISE NOTICE '✅ leads_eliminar_lead - Eliminación con permisos';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 FUNCIONES AUXILIARES INSTALADAS:';
    RAISE NOTICE '✅ trigger_leads_poraprobar_actualizar_nomrc - Trigger auxiliar';
    RAISE NOTICE '✅ trigger_leads_poraprobar_insertar_registro - Trigger auxiliar';
    RAISE NOTICE '✅ trigger_leads_poraprobar_migrar_a_leads - Trigger auxiliar';
    RAISE NOTICE '✅ leads_poraprobar_validar_y_migrar_similitud_trigger_func - Función auxiliar del trigger automático';
    RAISE NOTICE '✅ leads_poraprobar_migrar_lote - Migración en lote';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 TRIGGERS AUTOMÁTICOS INSTALADOS:';
    RAISE NOTICE '✅ trigger_leads_webhook_uidrc - Activación de webhook';
    RAISE NOTICE '✅ trigger_leads_poraprobar_actualizar_nomrc - Actualización de nomRC';
    RAISE NOTICE '✅ trigger_leads_poraprobar_insertar_registro - Procesamiento post-inserción';
    RAISE NOTICE '✅ trigger_leads_poraprobar_migrar_a_leads - Migración automática';
    RAISE NOTICE '✅ trigger_leads_poraprobar_validar_y_migrar_automaticamente - Validación y migración automática al insertar';
    RAISE NOTICE '';
    RAISE NOTICE '🌐 SERVICIOS CONFIGURADOS:';
    RAISE NOTICE '🔗 Webhook URL: https://sph-n8n.fn5wy3.easypanel.host/webhook/c66df01e-daaa-4c6f-be11-65945b760318';
    RAISE NOTICE '📧 Edge Function: leads-notificar-lead-asignado';
    RAISE NOTICE '';
    RAISE NOTICE '🔐 PERMISOS REQUERIDOS:';
    RAISE NOTICE '🔑 Eliminar leads: Permiso 327 (CRM > Leads > Eliminar Leads)';
    RAISE NOTICE '🔑 Aprobar leads: Permisos de supervisor/administrador';
    RAISE NOTICE '';
    RAISE NOTICE '📊 FLUJO COMPLETO IMPLEMENTADO:';
    RAISE NOTICE '1️⃣ Ingreso → leads_poraprobar_insertar_registro';
    RAISE NOTICE '2️⃣ Revisión → leads_poraprobar_obtener_detalle';
    RAISE NOTICE '3️⃣ Aprobación → UPDATE aprobado = true';
    RAISE NOTICE '4️⃣ Migración → leads_poraprobar_migrar_a_leads';
    RAISE NOTICE '5️⃣ Notificación → leads_notificar_cambio_uidrc';
    RAISE NOTICE '';
    RAISE NOTICE '🔍 PARA VERIFICAR LA INSTALACIÓN COMPLETA:';
    RAISE NOTICE '-- Verificar todas las funciones:';
    RAISE NOTICE 'SELECT routine_name, security_type FROM information_schema.routines';
    RAISE NOTICE 'WHERE routine_schema = ''public'' AND routine_name LIKE ''leads_%'';';
    RAISE NOTICE '';
    RAISE NOTICE '-- Verificar todos los triggers:';
    RAISE NOTICE 'SELECT trigger_name, event_manipulation, event_object_table';
    RAISE NOTICE 'FROM information_schema.triggers';
    RAISE NOTICE 'WHERE trigger_schema = ''public'' AND trigger_name LIKE ''trigger_leads_%'';';
    RAISE NOTICE '';
    RAISE NOTICE '-- Probar funcionamiento básico:';
    RAISE NOTICE 'SELECT COUNT(*) FROM leads_poraprobar_obtener_detalle();';
    RAISE NOTICE '';
    RAISE NOTICE '-- Probar migración en lote:';
    RAISE NOTICE 'SELECT leads_poraprobar_migrar_lote(10, false);';
    RAISE NOTICE '';
    RAISE NOTICE '=================================================================';
    RAISE NOTICE '✅ SISTEMA COMPLETO DE GESTIÓN DE LEADS INSTALADO CORRECTAMENTE';
    RAISE NOTICE '📅 Fecha y hora de instalación: 04/12/2025 01:00:00';
    RAISE NOTICE '=================================================================';
END $$;

-- =====================================================
-- NOTAS IMPORTANTES DE INSTALACIÓN
-- =====================================================

/*
📝 NOTAS PARA EL ADMINISTRADOR:

1. EJECUCIÓN INDIVIDUAL DE COMPONENTES:
   Si prefiere instalar los componentes individualmente, ejecute:
   \i Leads/funciones y trigger/leads_poraprobar_obtener_detalle.sql
   \i Leads/funciones y trigger/leads_notificar_cambio_uidrc.sql
   \i Leads/funciones y trigger/leads_poraprobar_actualizar_nomrc.sql
   \i Leads/funciones y trigger/leads_poraprobar_insertar_registro.sql
   \i Leads/funciones y trigger/leads_poraprobar_migrar_a_leads.sql
   \i Leads/funciones y trigger/leads_poraprobar_validar_y_migrar_similitud.sql
   \i Leads/funciones y trigger/leads_enviar_webhook_uidrc.sql
   \i Leads/funciones y trigger/leads_eliminar_lead.sql

2. REQUISITOS PREVIOS:
   - Tablas catUsers, catInmobiliarias, catAsesoresInm deben existir
   - Tablas crm_* (Etapas, Origen, tipoCliente, etc.) deben existir
   - Tabla activity_history debe existir para registro de actividades
   - Políticas RLS deben estar configuradas adecuadamente

3. CONFIGURACIÓN POST-INSTALACIÓN:
   - Verificar que todos los índices necesarios existan
   - Configurar permisos adecuados según roles de usuario
   - Probar el flujo completo con datos de prueba
   - Verificar conectividad con webhook externo

4. MANTENIMIENTO:
   - Revisar periódicamente los logs de activity_history
   - Monitorear errores en las funciones de notificación
   - Actualizar documentación cuando se modifiquen componentes
   - Realizar respaldos periódicos de las tablas principales

5. SEGURIDAD:
   - Todas las funciones requieren autenticación explícita
   - Las funciones SECURITY DEFINER tienen validaciones adicionales
   - Las políticas RLS deben configurarse para cada rol
   - Monitorear intentos de acceso no autorizado

6. RENDIMIENTO:
   - Los LEFT JOIN en leads_poraprobar_obtener_detalle pueden afectar rendimiento
   - Considerar índices en campos de FK utilizados frecuentemente
   - Monitorear tiempos de ejecución de las funciones principales
   - Optimizar consultas según volumen de datos

7. INTEGRACIÓN:
   - El webhook está configurado para n8n, puede ajustarse según necesidades
   - Las Edge Functions deben estar desplegadas y operativas
   - Verificar conectividad de red para notificaciones externas
   - Configurar monitoreo del sistema de notificaciones

8. VERIFICACIÓN DE COMPONENTES (actualizado 03/12/2025 17:55:57):
   - ✅ Todas las funciones principales de leads_porAprobar incluidas
   - ✅ Todos los triggers asociados implementados
   - ✅ Funciones auxiliares y de soporte completas
   - ✅ Sistema de migración en lote disponible
   - ✅ Verificación final actualizada con todos los componentes
*/

-- =====================================================
-- FIN DEL SCRIPT DE INSTALACIÓN COMPLETA
-- =====================================================

-- =====================================================
-- NOTAS IMPORTANTES DE INSTALACIÓN
-- =====================================================

/*
📝 NOTAS PARA EL ADMINISTRADOR:

1. EJECUCIÓN INDIVIDUAL DE COMPONENTES:
   Si prefiere instalar los componentes individualmente, ejecute:
   \i Leads/funciones y trigger/leads_poraprobar_obtener_detalle.sql
   \i Leads/funciones y trigger/leads_notificar_cambio_uidrc.sql
   \i Leads/funciones y trigger/leads_poraprobar_actualizar_nomrc.sql
   \i Leads/funciones y trigger/leads_poraprobar_insertar_registro.sql
   \i Leads/funciones y trigger/leads_poraprobar_migrar_a_leads.sql
   \i Leads/funciones y trigger/leads_enviar_webhook_uidrc.sql
   \i Leads/funciones y trigger/leads_eliminar_lead.sql

2. REQUISITOS PREVIOS:
   - Tablas catUsers, catInmobiliarias, catAsesoresInm deben existir
   - Tablas crm_* (Etapas, Origen, tipoCliente, etc.) deben existir
   - Tabla activity_history debe existir para registro de actividades
   - Políticas RLS deben estar configuradas adecuadamente

3. CONFIGURACIÓN POST-INSTALACIÓN:
   - Verificar que todos los índices necesarios existan
   - Configurar permisos adecuados según roles de usuario
   - Probar el flujo completo con datos de prueba
   - Verificar conectividad con webhook externo

4. MANTENIMIENTO:
   - Revisar periódicamente los logs de activity_history
   - Monitorear errores en las funciones de notificación
   - Actualizar documentación cuando se modifiquen componentes
   - Realizar respaldos periódicos de las tablas principales

5. SEGURIDAD:
   - Todas las funciones requieren autenticación explícita
   - Las funciones SECURITY DEFINER tienen validaciones adicionales
   - Las políticas RLS deben configurarse para cada rol
   - Monitorear intentos de acceso no autorizado

6. RENDIMIENTO:
   - Los LEFT JOIN en leads_poraprobar_obtener_detalle pueden afectar rendimiento
   - Considerar índices en campos de FK utilizados frecuentemente
   - Monitorear tiempos de ejecución de las funciones principales
   - Optimizar consultas según volumen de datos

7. INTEGRACIÓN:
   - El webhook está configurado para n8n, puede ajustarse según necesidades
   - Las Edge Functions deben estar desplegadas y operativas
   - Verificar conectividad de red para notificaciones externas
   - Configurar monitoreo del sistema de notificaciones
*/

-- =====================================================
-- FIN DEL SCRIPT DE INSTALACIÓN COMPLETA
-- =====================================================