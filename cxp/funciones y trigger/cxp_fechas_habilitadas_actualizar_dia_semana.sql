--[Fecha y Hora]: 29/10/2025 23:10:20
--[Descripción]: Función trigger que actualiza automáticamente la columna dia_semana
--                basándose en la fecha del registro
--
--[Parámetros]: No requiere parámetros directos (función trigger)
--
--[Salida]:
--   - trigger: Retorna el registro modificado con el día de la semana actualizado
--
--[Uso típico]: Se ejecuta automáticamente al insertar o actualizar registros
--               en la tabla cxp_fechas_habilitadas
--
--[Trigger asociado]: trigger_cxp_fechas_habilitadas_dia_semana
--
--[Eventos]: 
--   - INSERT: Al insertar nuevos registros
--   - UPDATE: Cuando se modifica la fecha de un registro existente
--
--[Relaciones]: 
--   - Tabla: cxp_fechas_habilitadas
--
--[Validaciones]:
--   - Utiliza EXTRACT(DOW) para obtener el número del día de la semana
--   - Mapea el número al nombre del día en español
--
--[Mapeo de días]:
--   - 0 = Domingo
--   - 1 = Lunes
--   - 2 = Martes
--   - 3 = Miércoles
--   - 4 = Jueves
--   - 5 = Viernes
--   - 6 = Sábado
--
--[Consideraciones]:
--   - Función de tipo trigger que se ejecuta automáticamente
--   - Mantiene la consistencia de datos en la columna dia_semana
--   - Evita errores humanos al actualizar manualmente el día de la semana

CREATE OR REPLACE FUNCTION public.cxp_fechas_habilitadas_actualizar_dia_semana()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $function$
BEGIN
    -- [Fecha y Hora]: 29/10/2025 23:10:20
    -- [Descripción]: Función trigger que actualiza automáticamente la columna dia_semana
    --                basándose en la fecha del registro
    -- [Trigger]: trigger_cxp_fechas_habilitadas_dia_semana
    -- [Eventos]: INSERT, UPDATE (cuando cambie la fecha)
    -- [Lógica]: Usa EXTRACT(DOW) para obtener el número del día y lo convierte a texto
    -- [Mapeo]: 0=Domingo, 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes, 6=Sábado
    
    -- Actualizar dia_semana basándose en la fecha
    NEW.dia_semana := CASE EXTRACT(DOW FROM NEW.fecha)
        WHEN 0 THEN 'Domingo'
        WHEN 1 THEN 'Lunes'
        WHEN 2 THEN 'Martes'  
        WHEN 3 THEN 'Miércoles'
        WHEN 4 THEN 'Jueves'
        WHEN 5 THEN 'Viernes'
        WHEN 6 THEN 'Sábado'
        ELSE 'Desconocido'
    END;
    
    RETURN NEW;
END;
$function$;