--[Fecha y Hora]: 29/10/2025 23:11:20
--[Descripción]: Agrega todos los lunes, martes y miércoles de un año específico 
--                a la tabla cxp_fechas_habilitadas con configuraciones diferenciadas
--
--[Parámetros]:
--   - p_anio (integer): El año del cual agregar las fechas (rango 1900-2100)
--
--[Salida]:
--   - jsonb: Objeto JSON con estructura estándar {exito, codigo, mensaje, detalles}
--
--[Uso típico]: Se utiliza para generar el calendario anual de fechas habilitadas
--               para el procesamiento de CXP de un año completo
--
--[Ejemplo]: SELECT cxp_fechas_habilitadas_anual(2025);
--
--[Relaciones]: 
--   - Tabla: cxp_fechas_habilitadas
--
--[Validaciones]:
--   - Verifica que el año no sea nulo
--   - Valida que el año esté en el rango 1900-2100
--   - Evita duplicados usando ON CONFLICT (fecha) DO NOTHING
--
--[Configuración de fechas]:
--   - Lunes y Martes: cfdi = true (permiten facturación)
--   - Miércoles: cfdi = false (día de procesamiento sin facturación)
--   - Todos los días: autorizar = true (valor por defecto de la tabla)
--
--[Códigos de respuesta]:
--   - EXITO: Fechas agregadas correctamente
--   - PARAMETRO_INVALIDO: Año nulo o fuera de rango
--   - ERROR_BASE_DATOS: Error en la base de datos
--
--[Lógica de procesamiento]:
--   - Recorre día por día todo el año especificado
--   - Inserta únicamente lunes (DOW=1), martes (DOW=2) y miércoles (DOW=3)
--   - DOW: Sunday=0, Monday=1, Tuesday=2, Wednesday=3, Thursday=4, Friday=5, Saturday=6
--
--[Auditoría]: 
--   - Registra created_by con UUID del sistema: '00000000-0000-0000-0000-000000000000'
--   - created_at se establece automáticamente con NOW()
--
--[Estadísticas retornadas]:
--   - Total de fechas nuevas insertadas
--   - Conteo de lunes y martes insertados
--   - Conteo de miércoles insertados
--   - Rango de fechas procesadas

CREATE OR REPLACE FUNCTION public.cxp_fechas_habilitadas_anual(p_anio integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $function$
DECLARE
    fecha_actual DATE;
    fecha_inicio DATE;
    fecha_fin DATE;
    contador_lunes_martes INTEGER := 0;
    contador_miercoles INTEGER := 0;
    contador_total INTEGER := 0;
    uid_sistema UUID := '00000000-0000-0000-0000-000000000000';
    dia_semana INTEGER;
BEGIN
    -- [Fecha y Hora]: 29/10/2025 23:11:20
    -- [Descripción]: Agrega todos los lunes, martes y miércoles de un año específico 
    --                a la tabla cxp_fechas_habilitadas con configuraciones diferenciadas
    -- [Parámetros]: p_anio (INTEGER) - El año del cual agregar las fechas
    -- [Salida]: JSONB con estructura estándar {exito, codigo, mensaje, detalles}
    -- [Uso]: SELECT cxp_fechas_habilitadas_anual(2025);
    -- [Códigos]: EXITO, PARAMETRO_INVALIDO, ERROR_BASE_DATOS
    -- [Configuración CFDI]: Lunes y Martes = true, Miércoles = false
    -- [Configuración Autorizar]: Todos = true (valor por defecto de la tabla)
    -- [Lógica]: Recorre todo el año insertando lunes (1), martes (2) y miércoles (3)
    -- [Auditoría]: Registra created_by con UUID del sistema y created_at automático
    
    -- Validar parámetro
    IF p_anio IS NULL THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PARAMETRO_INVALIDO',
            'mensaje', 'El año es requerido'
        );
    END IF;
    
    IF p_anio < 1900 OR p_anio > 2100 THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PARAMETRO_INVALIDO',
            'mensaje', 'El año debe estar entre 1900 y 2100'
        );
    END IF;
    
    -- Definir rango del año
    fecha_inicio := make_date(p_anio, 1, 1);
    fecha_fin := make_date(p_anio, 12, 31);
    fecha_actual := fecha_inicio;
    
    -- Recorrer todo el año
    WHILE fecha_actual <= fecha_fin LOOP
        -- Obtener día de la semana
        dia_semana := EXTRACT(DOW FROM fecha_actual);
        
        -- Insertar lunes (1), martes (2) y miércoles (3)
        -- DOW: Sunday=0, Monday=1, Tuesday=2, Wednesday=3, Thursday=4, Friday=5, Saturday=6
        IF dia_semana IN (1, 2, 3) THEN
            -- Configurar cfdi según el día
            -- Lunes y martes: cfdi = true
            -- Miércoles: cfdi = false
            INSERT INTO public.cxp_fechas_habilitadas (
                fecha, 
                cfdi, 
                created_by, 
                created_at
            ) 
            VALUES (
                fecha_actual, 
                CASE WHEN dia_semana IN (1, 2) THEN true ELSE false END,
                uid_sistema, 
                NOW()
            ) 
            ON CONFLICT (fecha) DO NOTHING;
            
            -- Contar inserciones por tipo de día
            IF FOUND THEN
                contador_total := contador_total + 1;
                IF dia_semana IN (1, 2) THEN
                    contador_lunes_martes := contador_lunes_martes + 1;
                ELSE
                    contador_miercoles := contador_miercoles + 1;
                END IF;
            END IF;
        END IF;
        
        fecha_actual := fecha_actual + INTERVAL '1 day';
    END LOOP;
    
    RETURN jsonb_build_object(
        'exito', true,
        'codigo', 'EXITO',
        'mensaje', 'Lunes, martes y miércoles del año ' || p_anio || ' agregados exitosamente',
        'detalles', jsonb_build_object(
            'anio', p_anio,
            'fechas_nuevas_insertadas', contador_total,
            'lunes_martes_insertados', contador_lunes_martes,
            'miercoles_insertados', contador_miercoles,
            'configuracion_cfdi', 'Lunes/Martes=true, Miércoles=false',
            'configuracion_autorizar', 'Todos=true (por defecto)',
            'rango', fecha_inicio || ' a ' || fecha_fin,
            'created_by_sistema', uid_sistema
        )
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'ERROR_BASE_DATOS',
            'mensaje', 'Error al agregar fechas: ' || SQLERRM,
            'detalles', jsonb_build_object('sqlstate', SQLSTATE)
        );
END;
$function$;