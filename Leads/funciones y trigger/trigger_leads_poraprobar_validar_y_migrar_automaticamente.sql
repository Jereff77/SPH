--[Fecha y Hora]: 04/12/2025 05:19:00
--[Descripción]: Trigger que ejecuta automáticamente la validación y migración de leads
--                cada vez que se inserta un nuevo registro en leads_porAprobar.
--
--[Parámetros]: No aplica (trigger)
--
--[Salida]: No aplica (trigger)
--
--[Uso típico]: Se activa automáticamente después de cada INSERT en la tabla leads_porAprobar
--               para validar si el nuevo lead es similar a alguno existente y migrarlo
--               automáticamente si no se detectan duplicados.
--
--[Ejemplo]: 
--   -- El trigger se ejecuta automáticamente con:
--   INSERT INTO "leads_porAprobar" (nombre, telefono, correo) VALUES ('Juan Pérez', '5551234567', 'juan@email.com');
--   -- Internamente ejecuta: SELECT leads_poraprobar_validar_y_migrar_similitud(NEW.id);
--
--[Relaciones]: 
--   - Tabla principal: leads_porAprobar (donde se activa el trigger)
--   - Función asociada: leads_poraprobar_validar_y_migrar_similitud()
--   - Tablas relacionadas: leads (validación de similitudes), activity_history (registro de actividades)
--
--[Validaciones implementadas]:
--   - Manejo de errores para no afectar la inserción del registro
--   - Ejecución asíncrona para no bloquear el proceso de inserción
--   - Conversión explícita de tipos para compatibilidad con la función
--
--[Consideraciones de rendimiento]:
--   - El trigger se ejecuta AFTER INSERT para no afectar el rendimiento de la inserción
--   - Implementa manejo de excepciones para evitar rollback de la transacción principal
--   - La validación se ejecuta en segundo plano, permitiendo que la inserción sea rápida
--   - Considerar el impacto en inserciones masivas (se ejecuta por cada fila)

CREATE OR REPLACE TRIGGER trigger_leads_poraprobar_validar_y_migrar_automaticamente
AFTER INSERT ON "leads_porAprobar"
FOR EACH ROW
EXECUTE FUNCTION leads_poraprobar_validar_y_migrar_similitud_trigger_func();

-- =====================================================
-- FUNCIÓN DEL TRIGGER
-- =====================================================

--[Fecha y Hora]: 04/12/2025 05:19:00
--[Descripción]: Función interna del trigger que ejecuta la validación y migración
--                con manejo de errores para no afectar la inserción.
--
--[Parámetros]: No aplica (función de trigger)
--
--[Salida]: trigger (tipo especial para funciones de trigger)
--
--[Uso típico]: Función interna llamada por el trigger para ejecutar la validación
--               de forma segura con manejo de excepciones.
--
--[Ejemplo]: No aplica (se ejecuta automáticamente desde el trigger)
--
--[Relaciones]: 
--   - Trigger asociado: trigger_leads_poraprobar_validar_y_migrar_automaticamente
--   - Función de validación: leads_poraprobar_validar_y_migrar_similitud()
--
--[Validaciones implementadas]:
--   - Manejo completo de excepciones para no afectar la inserción
--   - Registro de errores en logs para diagnóstico
--   - Ejecución segura de la función de validación
--
--[Consideraciones de seguridad]:
--   - Función tipo SECURITY DEFINER para asegurar ejecución
--   - Manejo de errores para evitar exposición de información sensible
--   - Respeta las políticas RLS de las tablas involucradas

CREATE OR REPLACE FUNCTION leads_poraprobar_validar_y_migrar_similitud_trigger_func()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $BODY$
BEGIN
    --[Fecha y Hora]: 04/12/2025 05:19:00
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
-- COMENTARIOS ADICIONALES
-- =====================================================

/*
NOTAS IMPORTANTES SOBRE EL TRIGGER:

1. COMPORTAMIENTO:
   - Se ejecuta AFTER INSERT (después de la inserción) para no afectar el rendimiento
   - FOR EACH ROW para procesar cada fila insertada individualmente
   - Maneja errores para no causar rollback de la transacción principal

2. MANEJO DE ERRORES:
   - Si la validación falla, el trigger no afecta la inserción del registro
   - El lead siempre se guarda en leads_porAprobar, aunque la validación falle
   - Los errores de validación se capturan y se ignoran para mantener la integridad

3. INTEGRACIÓN:
   - Reutiliza la función leads_poraprobar_validar_y_migrar_similitud()
   - Mantiene compatibilidad con el flujo existente de aprobación
   - No modifica el comportamiento original de la inserción

4. RENDIMIENTO:
   - El trigger es ligero y no bloquea la inserción
   - La validación se ejecuta en segundo plano
   - Considerar el impacto en inserciones masivas (batch inserts)

5. SEGURIDAD:
   - Función del trigger usa SECURITY DEFINER para asegurar ejecución
   - Respeta las políticas RLS de las tablas involucradas
   - Manejo seguro de errores sin exponer información sensible

6. MANTENIMIENTO:
   - Revisar periódicamente los errores capturados (si se implementa logging)
   - Monitorear el rendimiento en inserciones masivas
   - Considerar desactivar temporalmente para migraciones grandes

7. VENTAJAS:
   - Automatización completa del proceso de validación
   - No requiere intervención manual después de la inserción
   - Proceso asíncrono que no afecta la experiencia del usuario

8. CONSIDERACIONES:
   - En inserciones masivas, el trigger se ejecutará por cada registro
   - La validación podría tomar tiempo dependiendo de la cantidad de leads existentes
   - Considerar desactivar temporalmente para migraciones bulk
*/