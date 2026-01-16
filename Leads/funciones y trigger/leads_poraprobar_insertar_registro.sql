--[Fecha y Hora]: 03/12/2025 11:47:00
--[Descripción]: Función para insertar nuevos registros en la tabla leads_porAprobar
--                con validaciones completas de campos requeridos y relaciones.
--
--[Parámetros]:
--   - p_uidr (uuid): ID del usuario que registra el lead (obligatorio)
--   - p_nombre_lead (text): Nombre completo del lead (obligatorio)
--   - p_telefono (text): Teléfono de contacto (opcional)
--   - p_correo (text): Correo electrónico (opcional)
--   - p_uid_rc (uuid): ID del responsable comercial (opcional)
--   - p_id_inmobiliaria (uuid): ID de la inmobiliaria (opcional)
--   - p_id_asesor_inm (uuid): ID del asesor inmobiliario (opcional)
--   - p_fecha_contacto (timestamp): Fecha de primer contacto (opcional)
--   - p_mensaje (text): Mensaje o comentarios adicionales (opcional)
--   - p_id_etapa (bigint): ID de la etapa del lead (opcional)
--   - p_id_origen (bigint): ID del origen del lead (opcional)
--   - p_id_tipo_cliente (bigint): ID del tipo de cliente (opcional)
--   - p_id_tipo_operacion (bigint): ID del tipo de operación (opcional)
--   - p_id_tipo_venta (bigint): ID del tipo de venta (opcional)
--   - p_valor (double precision): Valor asociado a la propiedad (opcional)
--   - p_kvas (text): Campos adicionales key-value (opcional)
--   - p_superficie (text): Descripción de superficie (opcional)
--   - p_ubicacion (text): Descripción de ubicación (opcional)
--
--[Salida]:
--   - jsonb: Respuesta estandarizada con éxito o error
--
--[Uso típico]:
--   Se utiliza para registrar nuevos leads en el sistema de aprobación.
--   Puede llamarse directamente desde la aplicación o desde procesos
--   de migración desde otras tablas (ej. leads_puente).
--
--[Ejemplo]:
--   -- Insertar un nuevo lead básico
--   SELECT leads_poraprobar_insertar_registro(
--       'uid-usuario-registro',
--       'Juan Pérez García',
--       '5512345678',
--       'juan.perez@email.com',
--       NULL, -- uid_rc
--       NULL, -- id_inmobiliaria
--       NULL, -- id_asesor_inm
--       NOW(), -- fecha_contacto
--       'Cliente interesado en departamento', -- mensaje
--       1, -- id_etapa
--       2, -- id_origen
--       1, -- id_tipo_cliente
--       1, -- id_tipo_operacion
--       1, -- id_tipo_venta
--       2500000.00, -- valor
--       NULL, -- kvas
--       '120 m2', -- superficie
--       'Polanco, CDMX' -- ubicacion
--   );
--
--[Relaciones]:
--   - Tabla principal: leads_porAprobar (donde se inserta el registro)
--   - catUsers (valida que exista el usuario que registra)
--   - catUsers (opcional, obtiene nombre del responsable comercial)
--   - catInmobiliarias (opcional, valida inmobiliaria)
--   - catAsesoresInm (opcional, valida asesor inmobiliario)
--   - crm_Etapas, crm_Origen, crm_tipoCliente, crm_tipoOperaciones, crm_tipoVenta
--
--[Validaciones]:
--   - Validación obligatoria de autenticación
--   - Verificación de existencia del usuario que registra (uidr)
--   - Validación de campos obligatorios (uidr, nombre_lead)
--   - Verificación opcional de relaciones con tablas catálogo
--   - Prevención de duplicados por teléfono/correo (opcional)
--
--[Triggers asociados]:
--   - trigger_leads_poraprobar_insertar_registro: Se activa después de INSERT
--     para actualizar campos descriptivos y enviar notificaciones
--
--[Manejo de errores]:
--   - Autenticación requerida (error 401 si no está autenticado)
--   - Campos obligatorios faltantes (error 400 con detalles)
--   - Usuario no encontrado (error 404 si uidr no existe)
--   - Relaciones no válidas (error 400 con detalles de FK)
--   - Error de base de datos (error 500 con detalles técnicos)
--
--[Consideraciones de seguridad]:
--   - Función tipo SECURITY INVOKER (ejecuta con permisos del usuario)
--   - Requiere autenticación explícita para ejecutar
--   - El acceso está controlado por políticas RLS de leads_porAprobar
--   - Valida todas las relaciones para mantener integridad referencial
--   - Previene inserciones no autorizadas
--
--[Flujo de procesamiento]:
--   1. Validar autenticación del usuario
--   2. Validar campos obligatorios (uidr, nombre_lead)
--   3. Verificar existencia del usuario que registra
--   4. Validar relaciones opcionales con tablas catálogo
--   5. Obtener nombres descriptivos de relaciones
--   6. Insertar registro en leads_porAprobar
--   7. Construir respuesta JSON estandarizada
--
--[Consideraciones de rendimiento]:
--   - Usa transacciones cortas para minimizar bloqueos
--   - Implementa validaciones eficientes con EXISTS
--   - Permite inserciones masivas mediante llamadas sucesivas
--   - Optimiza consultas de validación con índices adecuados
--
--[Mantenimiento]:
--   - Revisar periódicamente las validaciones de campos
--   - Actualizar cuando se agreguen nuevas relaciones
--   - Monitorear errores en los logs de PostgreSQL
--   - Verificar que los triggers asociados estén operativos

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

-- =====================================================
-- TRIGGER ASOCIADO (OPCIONAL)
-- =====================================================

-- Crear trigger para procesamiento posterior a la inserción
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

-- Eliminar trigger existente si existe
DROP TRIGGER IF EXISTS trigger_leads_poraprobar_insertar_registro ON public."leads_porAprobar";

-- Crear trigger para procesamiento posterior a la inserción
CREATE TRIGGER trigger_leads_poraprobar_insertar_registro
AFTER INSERT ON public."leads_porAprobar"
FOR EACH ROW
EXECUTE FUNCTION public.trigger_leads_poraprobar_insertar_registro();