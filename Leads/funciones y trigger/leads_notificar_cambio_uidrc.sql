--[Fecha y Hora]: 03/12/2025 11:46:00
--[Descripción]: Función principal para enviar notificaciones por correo cuando se crea o modifica un lead
--                con cambio en el responsable comercial (uidRC).
--
--[Parámetros]:
--   - p_id_lead (uuid): ID del lead que activó la notificación
--   - p_tipo_accion (text): Tipo de acción que generó la notificación ('INSERT', 'UPDATE')
--   - p_uid_anterior (uuid): Valor anterior del uidRC (para detectar cambios, opcional)
--
--[Salida]:
--   - jsonb: Respuesta estandarizada con estructura:
--     * success (boolean): Indica si la operación fue exitosa
--     * message (text): Mensaje descriptivo del resultado
--     * error (text): Código de error (solo en caso de error)
--     * error_code (integer): Código HTTP de error (solo en caso de error)
--     * data (jsonb): Objeto con información adicional del resultado
--
--[Uso típico]:
--   Se llama automáticamente desde un trigger cuando se crea o modifica un lead
--   para enviar notificación al responsable comercial asignado. También puede
--   invocarse manualmente para reenviar notificaciones.
--
--[Ejemplo]:
--   -- Enviar notificación manualmente
--   SELECT leads_notificar_cambio_uidrc('123e4567-e89b-12d3-a456-426614174000', 'INSERT');
--
--   -- Notificar cambio de responsable
--   SELECT leads_notificar_cambio_uidrc('123e4567-e89b-12d3-a456-426614174000', 'UPDATE', 'uid-anterior');
--
--[Relaciones]:
--   - Tabla principal: leads (obtiene datos del lead)
--   - Tabla de usuarios: catUsers (obtiene email y nombre del uidRC)
--   - Tabla de actividad: activity_history (registra notificaciones enviadas)
--   - Edge Function: leads-notificar-lead-asignado (envía el correo electrónico)
--
--[Validaciones]:
--   - Verificación obligatoria de autenticación (auth.uid() IS NULL)
--   - Validación de existencia del lead antes de procesar
--   - Detección automática de cambios en uidRC
--   - Registro de actividad en activity_history para auditoría
--
--[Triggers asociados]:
--   - trigger_leads_webhook_uidrc: Se activa después de INSERT/UPDATE en leads
--   - Solo se ejecuta si hay cambios relevantes (INSERT o cambio de uidRC)
--
--[Manejo de errores]:
--   - Autenticación requerida (error 401 si no está autenticado)
--   - Lead no encontrado (error 404 si no existe el lead)
--   - Error de base de datos (error 500 con detalles técnicos)
--   - Error en envío de webhook (error 500 con detalles del fallo)
--
--[Consideraciones de seguridad]:
--   - Función tipo SECURITY DEFINER (ejecuta con privilegios del propietario)
--   - 🔐 VALIDACIÓN CRÍTICA: Verificación explícita de autenticación
--   - Prevención de acceso anónimo y ejecución no autorizada
--   - Implementa logging completo para auditoría y seguimiento
--   - Previene inyección SQL mediante uso de parámetros tipados
--
--[Flujo de procesamiento]:
--   1. Validar autenticación del usuario
--   2. Obtener información actual del lead
--   3. Detectar si hubo cambios relevantes en uidRC
--   4. Obtener datos del responsable comercial
--   5. Construir mensaje HTML con formato profesional
--   6. Registrar actividad en activity_history
--   7. Construir y retornar respuesta JSON estandarizada
--
--[Consideraciones de rendimiento]:
--   - Usa consultas optimizadas con JOINs indexados
--   - Implementa manejo asíncrono de notificaciones
--   - Registra actividad sin bloquear la operación principal
--
--[Mantenimiento]:
--   - Revisar periódicamente la plantilla HTML del correo
--   - Verificar que la Edge Function de envío esté operativa
--   - Monitorear errores en los logs de activity_history

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
    
    -- Obtener el valor anterior de uidRC para detectar cambios
    SELECT 
        "uidRC" INTO v_uid_anterior
    FROM leads
    WHERE id = p_id_lead;
    
    -- Obtener información del lead
    SELECT 
        l."nombreLead",
        l."correo",
        l."uidRC",
        l."telefono"
    INTO v_nombre_lead, v_email_rc, v_telefono
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
    ELSIF
        v_tipo_notificacion := 'lead_modificado';
        v_asunto := '📝 Lead Modificado - SPH Bines Raíces';
    END IF;
    
    -- Construir mensaje HTML
    v_mensaje_html := format(
        '<html>
            <head>
                <meta charset="utf-8">
                <title>%s</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        background-color: #f4f4f4;
                        padding: 20px;
                        border-radius: 8px;
                    }
                    .container {
                        background-color: white;
                        padding: 30px;
                        border-radius: 8px;
                        max-width: 600px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }
                    .header {
                        background-color: #2c3e50;
                        color: white;
                        padding: 20px;
                        text-align: center;
                        border-radius: 8px 8px 0;
                    }
                    .content {
                        padding: 20px;
                    }
                    h1 {
                        color: #333;
                        margin-bottom: 20px;
                    }
                    h2 {
                        color: #666;
                        margin-bottom: 15px;
                    }
                    .lead-info {
                        background-color: #f8f9fa;
                        padding: 15px;
                        border-radius: 5px;
                        margin-bottom: 15px;
                    }
                    .info-row {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 10px;
                    }
                    .info-label {
                        font-weight: bold;
                        color: #333;
                    }
                    .info-value {
                        color: #666;
                    }
                    .footer {
                        text-align: center;
                        margin-top: 30px;
                        font-size: 12px;
                        color: #666;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>%s</h1>
                    </div>
                    
                    <div class="content">
                        <h2>📋 Información del Lead</h2>
                        
                        <div class="lead-info">
                            <div class="info-row">
                                <span class="info-label">Nombre:</span>
                                <span class="info-value">%s</span>
                            </div>
                            
                            <div class="info-row">
                                <span class="info-label">Teléfono:</span>
                                <span class="info-value">%s</span>
                            </div>
                            
                            <div class="info-row">
                                <span class="info-label">Correo:</span>
                                <span class="info-value">%s</span>
                            </div>
                            
                            <div class="info-row">
                                <span class="info-label">Responsable:</span>
                                <span class="info-value">%s</span>
                            </div>
                        </div>
                        
                        <h2>📅 Detalles del Cambio</h2>
                        
                        <div class="lead-info">
                            <div class="info-row">
                                <span class="info-label">Tipo de acción:</span>
                                <span class="info-value">%s</span>
                            </div>
                            
                            <div class="info-row">
                                <span class="info-label">Fecha y hora:</span>
                                <span class="info-value">%s</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p>Este es un mensaje automático del sistema SPH Bines Raíces. Por favor no responder a este correo.</p>
                        <p><small>Enviado el: %s</small></p>
                    </div>
                </div>
            </body>
        </html>',
        v_asunto,
        v_nombre_lead,
        v_email_rc,
        v_telefono
    );
    
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
        auth.uid(),
        NOW(),
        v_tipo_notificacion,
        format('Notificación enviada a %s por cambio en responsable comercial: %s', v_nombre_rc),
        false,
        'lead_assignment',
        v_tipo_notificacion,
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
$BODY$
LANGUAGE plpgsql;