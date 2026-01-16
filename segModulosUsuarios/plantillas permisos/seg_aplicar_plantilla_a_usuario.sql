--[Fecha y Hora]: 17/11/2025 10:49:00
--[Descripción]: Aplica una plantilla de permisos a un usuario específico.
--                Función optimizada para producción que maneja duplicados sin
--                requerir restricciones únicas en la tabla segModulosUsuarios.
--
--[Parámetros]:
--   - p_uid_usuario_destino (uuid): UID del usuario al que se aplicarán los permisos
--   - p_id_plantilla (uuid): ID de la plantilla de permisos a aplicar
--   - p_reemplazar_todos (boolean): Si es true, elimina todos los permisos existentes
--                                 del usuario antes de aplicar la plantilla
--
--[Salida]:
--   - json: Objeto con el resultado de la operación incluyendo:
--     * success: boolean - Indica si la operación fue exitosa
--     * id_plantilla: uuid - ID de la plantilla aplicada
--     * nombre_plantilla: text - Nombre de la plantilla
--     * uid_usuario: uuid - UID del usuario
--     * nombre_usuario: text - Nombre completo del usuario
--     * permisos_aplicados: integer - Cantidad de permisos aplicados
--     * permisos_eliminados: integer - Cantidad de permisos eliminados (si aplica)
--     * reemplazo_total: boolean - Indica si se hizo reemplazo total
--     * fecha_aplicacion: timestamp - Fecha y hora de la aplicación
--     * mensaje: text - Mensaje descriptivo del resultado
--     * error: text - Descripción del error (si aplica)
--     * codigo_error: text - Código del error (si aplica)
--
--[Uso típico]:
--   - Asignar permisos iniciales a nuevos usuarios
--   - Actualizar permisos de usuarios existentes
--   - Aplicar plantillas predefinidas de acceso
--
--[Ejemplo]:
--   SELECT seg_aplicar_plantilla_a_usuario(
--       '896f01e5-283f-4bdb-b3f3-11381adedb30',
--       '177412a8-5e30-40c5-aa57-d043ea856082',
--       true
--   );
--
--[Relaciones]:
--   - Tablas: segModulosUsuarios, segPlantillasPermisos, segDetallesPlantilla, catUsers
--   - Funciones relacionadas: seg_eliminar_permisos_usuario (si existe)
--
--[Validaciones]:
--   - Verifica existencia de plantilla activa
--   - Verifica existencia de usuario activo
--   - Maneja duplicados existentes sin eliminar datos
--   - Actualiza permisos existentes en lugar de duplicar
--
--[Consideraciones de seguridad]:
--   - SECURITY INVOKER: Ejecuta con permisos del usuario que la invoca
--   - No elimina datos existentes a menos que se especifique reemplazo_total=true
--   - Mantiene integridad referencial con tablas relacionadas

CREATE OR REPLACE FUNCTION public.seg_aplicar_plantilla_a_usuario(
    p_uid_usuario_destino uuid,
    p_id_plantilla uuid,
    p_reemplazar_todos boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
AS $function$
DECLARE
    v_permisos_aplicados integer;
    v_permisos_eliminados integer;
    v_resultado json;
    v_nombre_plantilla text;
    v_nombre_usuario text;
    v_existe integer;
    v_permiso RECORD;
BEGIN
    -- Validar que la plantilla exista y esté activa
    SELECT "nombrePlantilla" INTO v_nombre_plantilla
    FROM public."segPlantillasPermisos" 
    WHERE "idPlantilla" = p_id_plantilla AND "status" = true;
    
    IF v_nombre_plantilla IS NULL THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'Plantilla no encontrada o inactiva',
            'codigo_error', 'PLANTILLA_NOT_FOUND'
        );
    END IF;
    
    -- Validar que el usuario destino exista y esté activo
    SELECT "nomCompleto" INTO v_nombre_usuario
    FROM public."catUsers" 
    WHERE "uid" = p_uid_usuario_destino AND "status" = true;
    
    IF v_nombre_usuario IS NULL THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'Usuario destino no encontrado o inactivo',
            'codigo_error', 'USR_NOT_FOUND'
        );
    END IF;
    
    -- Si se solicita reemplazar, eliminar permisos existentes
    IF p_reemplazar_todos THEN
        DELETE FROM public."segModulosUsuarios" WHERE "uid" = p_uid_usuario_destino;
        GET DIAGNOSTICS v_permisos_eliminados = ROW_COUNT;
    ELSE
        v_permisos_eliminados := 0;
    END IF;
    
    -- Aplicar los permisos de la plantilla usando UPDATE/INSERT condicional
    v_permisos_aplicados := 0;
    
    FOR v_permiso IN 
        SELECT "modulo", "seccion", "area", "acceso", "clave"
        FROM public."segDetallesPlantilla"
        WHERE "idPlantilla" = p_id_plantilla AND "status" = true
    LOOP
        -- Verificar si ya existe un registro similar
        SELECT COUNT(*) INTO v_existe
        FROM public."segModulosUsuarios"
        WHERE "uid" = p_uid_usuario_destino 
          AND "modulo" = v_permiso."modulo"
          AND "seccion" = v_permiso."seccion"
          AND "area" = v_permiso."area";
        
        IF v_existe > 0 THEN
            -- Actualizar el registro existente
            UPDATE public."segModulosUsuarios"
            SET "acceso" = v_permiso."acceso",
                "clave" = v_permiso."clave"
            WHERE "uid" = p_uid_usuario_destino 
              AND "modulo" = v_permiso."modulo"
              AND "seccion" = v_permiso."seccion"
              AND "area" = v_permiso."area";
        ELSE
            -- Insertar nuevo registro
            INSERT INTO public."segModulosUsuarios" (
                "uid", "modulo", "seccion", "area", "acceso", "clave"
            ) VALUES (
                p_uid_usuario_destino,
                v_permiso."modulo",
                v_permiso."seccion", 
                v_permiso."area",
                v_permiso."acceso",
                v_permiso."clave"
            );
        END IF;
        
        v_permisos_aplicados := v_permisos_aplicados + 1;
    END LOOP;
    
    -- Construir resultado exitoso
    v_resultado := json_build_object(
        'success', true,
        'id_plantilla', p_id_plantilla,
        'nombre_plantilla', v_nombre_plantilla,
        'uid_usuario', p_uid_usuario_destino,
        'nombre_usuario', v_nombre_usuario,
        'permisos_aplicados', v_permisos_aplicados,
        'permisos_eliminados', v_permisos_eliminados,
        'reemplazo_total', p_reemplazar_todos,
        'fecha_aplicacion', now(),
        'mensaje', 'Plantilla aplicada exitosamente'
    );
    
    RETURN v_resultado;
END;
$function$;