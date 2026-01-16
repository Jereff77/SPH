--[Fecha y Hora]: 16/11/2025 10:51:00
--[Descripción]: Funciones RPC para el sistema de plantillas de permisos
--
--Este archivo contiene las funciones necesarias para:
--  - Crear plantillas a partir de permisos de un usuario existente
--  - Aplicar plantillas a usuarios específicos
--  - Listar y gestionar plantillas disponibles
--
--Todas las funciones son de tipo SECURITY INVOKER para respetar las políticas RLS
--y no modifican datos existentes sin autorización explícita.

-- ===============================================================================
-- FUNCIÓN 1: Crear plantilla desde usuario existente
-- ===============================================================================

CREATE OR REPLACE FUNCTION public."seg_crear_plantilla_desde_usuario"(
    p_nombre_plantilla text,
    p_descripcion text,
    p_uid_usuario_origen uuid,
    p_categoria text,
    p_es_publica text,
    p_uid_creador uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_id_plantilla uuid;
    v_registros_insertados integer;
    v_resultado json;
    v_nombre_usuario text;
BEGIN
    --[Fecha y Hora]: 16/11/2025 10:51:00
    -- [Descripción]: Crea una plantilla de permisos basada en los permisos de un usuario existente
    --
    -- [Parámetros]:
    --   - p_nombre_plantilla (text): Nombre descriptivo de la plantilla
    --   - p_descripcion (text): Descripción detallada de la plantilla
    --   - p_uid_usuario_origen (uuid): UID del usuario del cual se copiarán los permisos
    --   - p_categoria (text): Categoría para organizar las plantillas
    --   - p_es_publica (boolean): Si la plantilla puede ser usada por otros administradores
    --   - p_uid_creador (uuid): UID del usuario que crea la plantilla (opcional, usa auth.uid() por defecto)
    --
    -- [Salida]:
    --   - json: Resultado de la operación con ID de plantilla y estadísticas
    --
    -- [Uso típico]: Crear plantillas reutilizables para roles específicos
    -- [Ejemplo]: SELECT seg_crear_plantilla_desde_usuario('Gerente Ventas', 'Permisos completos para gerentes de ventas', '896f01e5-283f-4bdb-b3f3-11381adedb30');
    
    -- Validar que el usuario origen tenga permisos
    IF NOT EXISTS (SELECT 1 FROM public."catUsers" WHERE "uid" = p_uid_usuario_origen AND "status" = true) THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'Usuario origen no encontrado o inactivo',
            'codigo_error', 'USR_NOT_FOUND'
        );
    END IF;
    
    -- Obtener nombre del usuario para referencia
    SELECT "nomCompleto" INTO v_nombre_usuario
    FROM public."catUsers" 
    WHERE "uid" = p_uid_usuario_origen;
    
    IF v_nombre_usuario IS NULL THEN
        v_nombre_usuario := 'Usuario ' || p_uid_usuario_origen;
    END IF;
    
    -- Validar que el nombre de plantilla no exista
    IF EXISTS (SELECT 1 FROM public."segPlantillasPermisos" WHERE "nombrePlantilla" = p_nombre_plantilla AND "status" = true) THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'Ya existe una plantilla con ese nombre',
            'codigo_error', 'PLANTILLA_DUPLICADA'
        );
    END IF;
    
    -- Validar categoría permitida
    IF p_categoria NOT IN ('General', 'Ventas', 'Administración', 'Soporte', 'Gerencia', 'Operaciones', 'Finanzas') THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'Categoría no válida',
            'codigo_error', 'CATEGORIA_INVALIDA'
        );
    END IF;
    
    -- Convertir p_es_publica a boolean
    v_es_publica_bool := (p_es_publica = 'true');
    
    -- Crear la plantilla
    INSERT INTO public."segPlantillasPermisos" (
        "nombrePlantilla",
        "descripcion",
        "uidCreador",
        "categoria",
        "esPublica",
        "fechaCreacion"
    ) VALUES (
        p_nombre_plantilla,
        p_descripcion,
        p_uid_creador,
        p_categoria,
        v_es_publica_bool,
        now()
    ) RETURNING "idPlantilla" INTO v_id_plantilla;
    
    -- Copiar los permisos del usuario origen a la plantilla, eliminando duplicados con ROW_NUMBER
    INSERT INTO public."segDetallesPlantilla" (
        "idPlantilla", "modulo", "seccion", "area", "acceso", "clave"
    )
    SELECT
        v_id_plantilla,
        "modulo",
        "seccion",
        "area",
        "acceso",
        "clave"
    FROM (
        SELECT
            "modulo",
            "seccion",
            "area",
            "acceso",
            "clave",
            ROW_NUMBER() OVER (PARTITION BY "modulo", "seccion", "area" ORDER BY "acceso" DESC, "clave" DESC) as rn
        FROM public."segModulosUsuarios"
        WHERE "uid" = p_uid_usuario_origen
    ) AS permisos_unicos
    WHERE rn = 1;
    
    GET DIAGNOSTICS v_registros_insertados = ROW_COUNT;
    
    -- Construir resultado exitoso
    v_resultado := json_build_object(
        'success', true,
        'id_plantilla', v_id_plantilla,
        'nombre_plantilla', p_nombre_plantilla,
        'descripcion', p_descripcion,
        'categoria', p_categoria,
        'es_publica', v_es_publica_bool,
        'usuario_origen', v_nombre_usuario,
        'uid_usuario_origen', p_uid_usuario_origen,
        'permisos_copiados', v_registros_insertados,
        'fecha_creacion', now(),
        'mensaje', 'Plantilla creada exitosamente'
    );
    
    RETURN v_resultado;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Error al crear la plantilla: ' || SQLERRM,
            'codigo_error', 'ERROR_CREACION'
        );
END;
$$;

-- ===============================================================================
-- FUNCIÓN 2: Aplicar plantilla a usuario
-- ===============================================================================

CREATE OR REPLACE FUNCTION public."seg_aplicar_plantilla_a_usuario"(
    p_id_plantilla uuid,
    p_uid_usuario_destino uuid,
    p_reemplazar_todos boolean DEFAULT true,
    p_uid_autorizador uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_permisos_aplicados integer;
    v_permisos_eliminados integer;
    v_permisos_actualizados integer;
    v_resultado json;
    v_nombre_plantilla text;
    v_nombre_usuario text;
    v_uid_ejecutor uuid;
BEGIN
    --[Fecha y Hora]: 16/11/2025 10:51:00
    -- [Descripción]: Aplica una plantilla de permisos a un usuario específico
    --
    -- [Parámetros]:
    --   - p_id_plantilla (uuid): ID de la plantilla a aplicar
    --   - p_uid_usuario_destino (uuid): UID del usuario que recibirá los permisos
    --   - p_reemplazar_todos (boolean): Si true, elimina todos los permisos existentes primero
    --   - p_uid_autorizador (uuid): UID del usuario que autoriza la operación (opcional)
    --
    -- [Salida]:
    --   - json: Resultado de la operación con estadísticas
    --
    -- [Uso típico]: Asignar permisos predefinidos a nuevos usuarios o cambiar de rol
    -- [Ejemplo]: SELECT seg_aplicar_plantilla_a_usuario('uuid-plantilla', 'uuid-usuario', true);
    
    -- Determinar UID del ejecutor
    v_uid_ejecutor := COALESCE(p_uid_autorizador, auth.uid());
    
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
    
    -- Iniciar transacción
    BEGIN
        -- Si se solicita reemplazar, eliminar permisos existentes
        IF p_reemplazar_todos THEN
            DELETE FROM public."segModulosUsuarios" WHERE "uid" = p_uid_usuario_destino;
            GET DIAGNOSTICS v_permisos_eliminados = ROW_COUNT;
        ELSE
            v_permisos_eliminados := 0;
        END IF;
        
        -- Aplicar los permisos de la plantilla
        INSERT INTO public."segModulosUsuarios" (
            "uid", "modulo", "seccion", "area", "acceso", "clave"
        )
        SELECT 
            p_uid_usuario_destino,
            "modulo",
            "seccion", 
            "area",
            "acceso",
            "clave"
        FROM public."segDetallesPlantilla"
        WHERE "idPlantilla" = p_id_plantilla AND "status" = true
        ON CONFLICT ("uid", "modulo", "seccion", "area") 
        DO UPDATE SET 
            "acceso" = EXCLUDED."acceso",
            "clave" = EXCLUDED."clave";
        
        GET DIAGNOSTICS v_permisos_aplicados = ROW_COUNT;
        
        -- Calcular permisos actualizados (si no fue reemplazo total)
        IF NOT p_reemplazar_todos THEN
            v_permisos_actualizados := (
                SELECT COUNT(*) 
                FROM public."segModulosUsuarios" 
                WHERE "uid" = p_uid_usuario_destino
            ) - v_permisos_aplicados;
        ELSE
            v_permisos_actualizados := 0;
        END IF;
        
        -- Confirmar transacción
        COMMIT;
        
    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK;
            RETURN json_build_object(
                'success', false, 
                'error', 'Error al aplicar la plantilla: ' || SQLERRM,
                'codigo_error', 'ERROR_APLICACION'
            );
    END;
    
    -- Construir resultado exitoso
    v_resultado := json_build_object(
        'success', true,
        'id_plantilla', p_id_plantilla,
        'nombre_plantilla', v_nombre_plantilla,
        'uid_usuario', p_uid_usuario_destino,
        'nombre_usuario', v_nombre_usuario,
        'permisos_aplicados', v_permisos_aplicados,
        'permisos_actualizados', v_permisos_actualizados,
        'permisos_eliminados', v_permisos_eliminados,
        'reemplazo_total', p_reemplazar_todos,
        'uid_ejecutor', v_uid_ejecutor,
        'fecha_aplicacion', now(),
        'mensaje', 'Plantilla aplicada exitosamente'
    );
    
    RETURN v_resultado;
END;
$$;

-- ===============================================================================
-- FUNCIÓN 3: Listar plantillas disponibles
-- ===============================================================================

CREATE OR REPLACE FUNCTION public."seg_listar_plantillas"(
    p_categoria text DEFAULT NULL,
    p_solo_publicas boolean DEFAULT false,
    p_incluir_inactivas boolean DEFAULT false
)
RETURNS TABLE (
    "idPlantilla" uuid,
    "nombrePlantilla" text,
    "descripcion" text,
    "categoria" text,
    "esPublica" boolean,
    "status" boolean,
    "fechaCreacion" timestamp with time zone,
    "cantidadPermisos" bigint,
    "nombreCreador" text,
    "permisosActivos" bigint
)
LANGUAGE sql
SECURITY INVOKER
AS $$
    --[Fecha y Hora]: 16/11/2025 10:51:00
    -- [Descripción]: Lista las plantillas disponibles según filtros
    --
    -- [Parámetros]:
    --   - p_categoria (text): Filtrar por categoría específica
    --   - p_solo_publicas (boolean): Mostrar solo plantillas públicas
    --   - p_incluir_inactivas (boolean): Incluir plantillas inactivas
    --
    -- [Uso típico]: Mostrar catálogo de plantillas para selección
    
    SELECT 
        sp."idPlantilla",
        sp."nombrePlantilla",
        sp."descripcion",
        sp."categoria",
        sp."esPublica",
        sp."status",
        sp."fechaCreacion",
        COUNT(sdp."idDetalle") FILTER (WHERE sdp."status" = true) as "cantidadPermisos",
        cu."nomCompleto" as "nombreCreador",
        COUNT(sdp."idDetalle") FILTER (WHERE sdp."acceso" = true AND sdp."status" = true) as "permisosActivos"
    FROM public."segPlantillasPermisos" sp
    LEFT JOIN public."catUsers" cu ON sp."uidCreador" = cu."uid"
    LEFT JOIN public."segDetallesPlantilla" sdp ON sp."idPlantilla" = sdp."idPlantilla"
    WHERE (p_incluir_inactivas = true OR sp."status" = true)
        AND (p_categoria IS NULL OR sp."categoria" = p_categoria)
        AND (NOT p_solo_publicas OR sp."esPublica" = true)
    GROUP BY sp."idPlantilla", sp."nombrePlantilla", sp."descripcion", sp."categoria", 
             sp."esPublica", sp."status", sp."fechaCreacion", cu."nomCompleto"
    ORDER BY sp."categoria", sp."nombrePlantilla";
$$;

-- ===============================================================================
-- FUNCIÓN 4: Ver detalles de una plantilla
-- ===============================================================================

CREATE OR REPLACE FUNCTION public."seg_ver_detalles_plantilla"(
    p_id_plantilla uuid
)
RETURNS TABLE (
    "modulo" text,
    "seccion" text,
    "area" text,
    "acceso" boolean,
    "clave" smallint,
    "status" boolean
)
LANGUAGE sql
SECURITY INVOKER
AS $$
    --[Fecha y Hora]: 16/11/2025 10:51:00
    -- [Descripción]: Muestra los detalles de permisos de una plantilla específica
    --
    -- [Parámetros]:
    --   - p_id_plantilla (uuid): ID de la plantilla a consultar
    --
    -- [Uso típico]: Revisar qué permisos incluye una plantilla antes de aplicarla
    
    SELECT 
        sdp."modulo",
        sdp."seccion",
        sdp."area",
        sdp."acceso",
        sdp."clave",
        sdp."status"
    FROM public."segDetallesPlantilla" sdp
    WHERE sdp."idPlantilla" = p_id_plantilla
    ORDER BY sdp."modulo", sdp."seccion", sdp."area";
$$;

-- ===============================================================================
-- FUNCIÓN 5: Eliminar plantilla
-- ===============================================================================

CREATE OR REPLACE FUNCTION public."seg_eliminar_plantilla"(
    p_id_plantilla uuid,
    p_uid_autorizador uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_nombre_plantilla text;
    v_permisos_eliminados integer;
    v_resultado json;
    v_uid_ejecutor uuid;
BEGIN
    --[Fecha y Hora]: 16/11/2025 10:51:00
    -- [Descripción]: Elimina una plantilla del sistema
    --
    -- [Parámetros]:
    --   - p_id_plantilla (uuid): ID de la plantilla a eliminar
    --   - p_uid_autorizador (uuid): UID del usuario que autoriza la operación (opcional)
    --
    -- [Uso típico]: Eliminar plantillas obsoletas o incorrectas
    
    -- Determinar UID del ejecutor
    v_uid_ejecutor := COALESCE(p_uid_autorizador, auth.uid());
    
    -- Validar que la plantilla exista
    SELECT "nombrePlantilla" INTO v_nombre_plantilla
    FROM public."segPlantillasPermisos" 
    WHERE "idPlantilla" = p_id_plantilla;
    
    IF v_nombre_plantilla IS NULL THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'Plantilla no encontrada',
            'codigo_error', 'PLANTILLA_NOT_FOUND'
        );
    END IF;
    
    -- Iniciar transacción
    BEGIN
        -- Contar permisos antes de eliminar
        SELECT COUNT(*) INTO v_permisos_eliminados
        FROM public."segDetallesPlantilla"
        WHERE "idPlantilla" = p_id_plantilla;
        
        -- Eliminar la plantilla (cascade eliminará los detalles)
        DELETE FROM public."segPlantillasPermisos" 
        WHERE "idPlantilla" = p_id_plantilla;
        
        -- Confirmar transacción
        COMMIT;
        
    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK;
            RETURN json_build_object(
                'success', false, 
                'error', 'Error al eliminar la plantilla: ' || SQLERRM,
                'codigo_error', 'ERROR_ELIMINACION'
            );
    END;
    
    -- Construir resultado exitoso
    v_resultado := json_build_object(
        'success', true,
        'id_plantilla', p_id_plantilla,
        'nombre_plantilla', v_nombre_plantilla,
        'permisos_eliminados', v_permisos_eliminados,
        'uid_ejecutor', v_uid_ejecutor,
        'fecha_eliminacion', now(),
        'mensaje', 'Plantilla eliminada exitosamente'
    );
    
    RETURN v_resultado;
END;
$$;

-- Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE 'Funciones RPC de plantillas de permisos creadas exitosamente';
    RAISE NOTICE '- seg_crear_plantilla_desde_usuario: Crea plantillas desde permisos de usuario';
    RAISE NOTICE '- seg_aplicar_plantilla_a_usuario: Aplica plantillas a usuarios';
    RAISE NOTICE '- seg_listar_plantillas: Lista plantillas disponibles';
    RAISE NOTICE '- seg_ver_detalles_plantilla: Muestra detalles de plantilla específica';
    RAISE NOTICE '- seg_eliminar_plantilla: Elimina plantillas del sistema';
END $$;