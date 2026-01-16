--[Fecha y Hora]: 29/10/2025 23:14:55
--[Descripción]: Función trigger que valida operaciones en tabla cxp según reglas de negocio
--
--[Parámetros]: No requiere parámetros directos (función trigger)
--
--[Salida]:
--   - trigger: Retorna NEW o NULL según validación
--
--[Trigger asociado]: trigger_cxp_validar_fecha_insert
--
--[Eventos]: 
--   - BEFORE INSERT: Validar antes de insertar nuevos registros
--   - BEFORE UPDATE: Validar antes de actualizar registros existentes
--
--[Uso típico]: Se ejecuta automáticamente al intentar insertar o actualizar
--               registros en la tabla cxp para validar reglas de negocio
--
--[Relaciones]: 
--   - Tabla principal: cxp
--   - Tabla: cxp_fechas_habilitadas
--   - Tabla: segModulosUsuarios (para validación de permisos)
--
--[Validaciones por operación]:
--
-- **Para INSERT:**
--   - Verifica que la fecha actual tenga cfdi=true en cxp_fechas_habilitadas
--   - Si no está habilitado, lanza excepción CXP_CFDI_NO_HABILITADO
--
-- **Para UPDATE:**
--   - Permite actualizaciones generales si no cambia el estado
--   - Si cambia el estado, aplica validaciones según tipo de usuario
--
--[Validaciones de estado por tipo de usuario]:
--
-- **Usuarios normales (sin clave 430):**
--   - Solo pueden cambiar entre estados 1 (Guardado) y 2 (Enviado)
--   - Si intenta cambiar a otros estados, lanza CXP_ESTADO_NO_AUTORIZADO
--
-- **Usuarios autorizadores (con clave 430):**
--   - Pueden cambiar a cualquier estado
--   - Para cambios a estados 3 (Rechazado) o 4 (Aprobado):
--     * Verifica que la fecha actual tenga autorizar=true
--     * Si no está habilitado, lanza CXP_AUTORIZACION_NO_HABILITADA
--
--[Estados del sistema]:
--   - 1 = Guardado
--   - 2 = Enviado
--   - 3 = Rechazado
--   - 4 = Aprobado
--   - 5 = Reprogramado
--   - 6 = Pagado
--   - 7 = Pago T. Bancaria
--
--[Mensajes de error]:
--   - CXP_CFDI_NO_HABILITADO: Fecha no permite CFDI
--   - CXP_ESTADO_NO_AUTORIZADO: Usuario sin permisos de autorización
--   - CXP_AUTORIZACION_NO_HABILITADA: Fecha no permite autorización
--
--[Consideraciones]:
--   - Función de tipo SECURITY INVOKER
--   - Usa CURRENT_DATE para obtener fecha actual
--   - Manejo detallado de excepciones con hints descriptivos
--   - Validación de permisos en tiempo real

CREATE OR REPLACE FUNCTION public.cxp_trigger_validar_fecha()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $function$
DECLARE
    fecha_actual DATE := CURRENT_DATE;
    cfdi_habilitado BOOLEAN := false;
    autorizar_habilitado BOOLEAN := false;
    es_usuario_autorizador BOOLEAN := false;
    estado_anterior SMALLINT;
BEGIN
    -- [Fecha y Hora]: 29/10/2025 23:14:55
    -- [Descripción]: Función trigger que valida operaciones en tabla cxp según reglas de negocio
    -- [Trigger]: trigger_cxp_validar_fecha_insert
    -- [Eventos]: BEFORE INSERT OR UPDATE en tabla public.cxp
    -- [Validaciones]:
    --   - INSERT: Requiere fecha con cfdi=true en cxp_fechas_habilitadas
    --   - UPDATE: Permite actualizaciones excepto cambios de estado sin permisos
    --   - Estado: Solo usuarios con clave 430 pueden cambiar a estados de autorización
    -- [Estados]:
    --   - Usuario normal: 1=Guardado, 2=Enviado
    --   - Usuario autorizador (clave 430): 3=Rechazado, 4=Aprobado, 1=Guardado
    -- [Uso]: Se ejecuta automáticamente en operaciones sobre tabla cxp
    
    -- Obtener información de fechas habilitadas para hoy
    SELECT cfdi, autorizar 
    INTO cfdi_habilitado, autorizar_habilitado
    FROM public.cxp_fechas_habilitadas 
    WHERE fecha = fecha_actual;
    
    -- Si no existe la fecha en la tabla, considerar ambos como false
    IF NOT FOUND THEN
        cfdi_habilitado := false;
        autorizar_habilitado := false;
    END IF;
    
    -- Verificar si el usuario tiene permisos de autorización (clave 430)
    SELECT EXISTS(
        SELECT 1 
        FROM public."segModulosUsuarios" 
        WHERE uid = NEW.uidr 
          AND clave = 430 
          AND acceso = true
    ) INTO es_usuario_autorizador;
    
    -- === VALIDACIONES PARA INSERT ===
    IF TG_OP = 'INSERT' THEN
        -- Para insertar nuevos registros, la fecha debe tener cfdi=true
        IF NOT cfdi_habilitado THEN
            RAISE EXCEPTION 'CXP_CFDI_NO_HABILITADO: No se pueden insertar registros en CxP. La fecha actual (%) no permite generar CFDI. Solo se permite en fechas con cfdi=true (generalmente lunes y martes).', 
                fecha_actual
            USING HINT = 'Verifique la tabla cxp_fechas_habilitadas o espere a una fecha habilitada para CFDI.';
        END IF;
        
        -- Si llega aquí, permitir la inserción
        RETURN NEW;
    END IF;
    
    -- === VALIDACIONES PARA UPDATE ===
    IF TG_OP = 'UPDATE' THEN
        -- Permitir actualizaciones en general, pero validar cambios de estado
        -- Si no cambió el estado, permitir la actualización
        IF OLD."idEstado" = NEW."idEstado" OR NEW."idEstado" IS NULL THEN
            RETURN NEW;
        END IF;
        
        -- Si cambió el estado, aplicar validaciones según el usuario
        estado_anterior := COALESCE(OLD."idEstado", 1);
        
        -- === VALIDACIONES PARA USUARIOS NORMALES ===
        IF NOT es_usuario_autorizador THEN
            -- Usuarios normales solo pueden cambiar entre estados 1 (Guardado) y 2 (Enviado)
            IF NEW."idEstado" NOT IN (1, 2) THEN
                RAISE EXCEPTION 'CXP_ESTADO_NO_AUTORIZADO: Usuario sin permisos para cambiar al estado %. Solo se permiten estados: 1=Guardado, 2=Enviado', 
                    NEW."idEstado"
                USING HINT = 'Contacte a un usuario con permisos de autorización (clave 430) para cambios de estado de aprobación.';
            END IF;
        END IF;
        
        -- === VALIDACIONES PARA USUARIOS AUTORIZADORES ===
        IF es_usuario_autorizador THEN
            -- Usuarios autorizadores pueden cambiar a cualquier estado, pero validar fecha para ciertas operaciones
            -- Estados permitidos: 1=Guardado, 3=Rechazado, 4=Aprobado, (y otros según necesidad)
            
            -- Para cambios que requieren autorización (3, 4), validar que autorizar=true
            IF NEW."idEstado" IN (3, 4) AND NOT autorizar_habilitado THEN
                RAISE EXCEPTION 'CXP_AUTORIZACION_NO_HABILITADA: No se pueden realizar autorizaciones hoy (%). La fecha actual no permite autorizar. Solo se permite en fechas con autorizar=true.', 
                    fecha_actual
                USING HINT = 'Las autorizaciones están permitidas generalmente en lunes, martes y miércoles habilitados.';
            END IF;
        END IF;
        
        -- Si llegó aquí, permitir la actualización
        RETURN NEW;
    END IF;
    
    -- Por defecto, permitir la operación
    RETURN NEW;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Re-lanzar la excepción para mantener el comportamiento de bloqueo
        RAISE;
END;
$function$;