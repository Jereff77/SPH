--[Fecha y Hora]: 17/11/2025 06:56:00
--[Descripción]: Función que recorre todos los registros de segModulos y corrige
--                los campos módulo, sección y área en segModulosUsuarios
--                basándose en la relación por clave.
--
--[Salida]:
--   - integer: Número total de registros actualizados
--
--[Uso típico]: Se utiliza para sincronizar todos los datos de segModulosUsuarios
--               con los valores correctos de segModulos.
--
--[Ejemplo]: 
--   -- Corregir todos los registros
--   SELECT segmodulos_corregir_todos_los_campos();
--
--[Relaciones]:
--   - Tabla segModulos: Tabla maestra con los datos correctos (origen)
--   - Tabla segModulosUsuarios: Tabla que se va a corregir (destino)
--
--[Validaciones]:
--   - Actualiza solo los registros que tienen diferencias
--   - Maneja valores NULL correctamente
--
--[Consideraciones de seguridad]:
--   - Función de tipo SECURITY INVOKER para respetar permisos del usuario
--   - Incluye manejo de excepciones para registrar errores si ocurren

CREATE OR REPLACE FUNCTION public.segmodulos_corregir_todos_los_campos()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $BODY$
DECLARE
    v_registros_actualizados integer := 0;
    v_mensaje_error text;
BEGIN
    --[Fecha y Hora]: 17/11/2025 06:56:00
    -- [Descripción]: Recorre todos los registros de segModulos y actualiza
    --                los campos correspondientes en segModulosUsuarios.
    
    -- Actualizar todos los registros de segModulosUsuarios con los valores correctos de segModulos
    UPDATE public."segModulosUsuarios" smu
    SET
        "modulo" = m."modulo"::text,
        "seccion" = m."seccion",
        "area" = m."area"
    FROM public."segModulos" m
    WHERE smu."clave" = m."clave"
    AND (
        smu."modulo" IS DISTINCT FROM m."modulo"::text OR
        smu."seccion" IS DISTINCT FROM m."seccion" OR
        COALESCE(smu."area", '') IS DISTINCT FROM COALESCE(m."area", '')
    );
    
    GET DIAGNOSTICS v_registros_actualizados = ROW_COUNT;
    
    RAISE NOTICE 'Se han actualizado % registros en segModulosUsuarios', v_registros_actualizados;
    
    RETURN v_registros_actualizados;
    
EXCEPTION
    WHEN OTHERS THEN
        v_mensaje_error := SQLERRM;
        RAISE EXCEPTION 'Error en segmodulos_corregir_todos_los_campos: %', v_mensaje_error;
        RETURN -1;
END;
$BODY$;