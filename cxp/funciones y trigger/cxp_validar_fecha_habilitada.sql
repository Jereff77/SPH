--[Fecha y Hora]: 29/10/2025 23:15:15
--[Descripción]: Valida si la fecha actual está habilitada para insertar registros en la tabla cxp
--
--[Parámetros]: No requiere parámetros directos
--
--[Salida]:
--   - jsonb: Objeto JSON con estructura estándar:
--     * exito: boolean
--     * codigo: código de resultado
--     * mensaje: mensaje descriptivo
--     * detalles: objeto con información de la fecha
--
--[Uso típico]: Se utiliza para validar antes de intentar insertar
--               nuevos registros CXP en la fecha actual
--
--[Ejemplo]: SELECT cxp_validar_fecha_habilitada();
--
--[Relaciones]: 
--   - Tabla: cxp_fechas_habilitadas
--
--[Validaciones]:
--   - Verifica si CURRENT_DATE existe en cxp_fechas_habilitadas
--   - No requiere validación de tipo de operación (solo verifica existencia)
--
--[Códigos de respuesta]:
--   - EXITO: Fecha actual habilitada para insertar
--   - FECHA_NO_HABILITADA: Fecha actual no habilitada
--
--[Lógica de funcionamiento]:
--   1. Usa CURRENT_DATE para obtener fecha actual del servidor
--   2. Busca la fecha en cxp_fechas_habilitadas
--   3. Retorna resultado según existencia
--
--[Información retornada en detalles]:
--   - fecha_actual: Fecha evaluada (CURRENT_DATE)
--   - dia_semana: Nombre del día de la semana
--   - habilitada: Booleano indicando si está habilitada
--
--[Casos de uso]:
--   - Validación previa a inserción de registros
--   - Mensajes informativos en UI sobre estado de fechas
--   - Programación condicional de procesos
--
--[Consideraciones]:
--   - Función simple y rápida
--   - No depende de tipo de usuario
--   - Solo verifica existencia, no otros campos
--   - Formato JSON estándar para integración con frontend

CREATE OR REPLACE FUNCTION public.cxp_validar_fecha_habilitada()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $function$
BEGIN
    -- [Fecha y Hora]: 29/10/2025 23:15:15
    -- [Descripción]: Valida si la fecha actual está habilitada para insertar registros en la tabla cxp
    -- [Lógica]: Busca si CURRENT_DATE existe en la tabla cxp_fechas_habilitadas
    -- [Salida]: JSONB con estructura estándar {exito, codigo, mensaje, detalles}
    -- [Uso]: SELECT cxp_validar_fecha_habilitada();
    -- [Códigos]: EXITO, FECHA_NO_HABILITADA
    
    -- Verificar si la fecha actual existe en la tabla de fechas habilitadas
    IF EXISTS (SELECT 1 FROM public.cxp_fechas_habilitadas WHERE fecha = CURRENT_DATE) THEN
        RETURN jsonb_build_object(
            'exito', true,
            'codigo', 'EXITO',
            'mensaje', 'Fecha actual habilitada para insertar en CxP',
            'detalles', jsonb_build_object(
                'fecha_actual', CURRENT_DATE,
                'dia_semana', TO_CHAR(CURRENT_DATE, 'Day'),
                'habilitada', true
            )
        );
    ELSE
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'FECHA_NO_HABILITADA',
            'mensaje', 'La fecha actual no está habilitada para insertar registros en CxP',
            'detalles', jsonb_build_object(
                'fecha_actual', CURRENT_DATE,
                'dia_semana', TO_CHAR(CURRENT_DATE, 'Day'),
                'habilitada', false
            )
        );
    END IF;
END;
$function$;