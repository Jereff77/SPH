--[Fecha y Hora]: 01/10/2025 00:00:00
-- [Descripción]: Agrega automáticamente el nuevo módulo a todos los usuarios existentes
--                incluyendo la clave del módulo para mantener consistencia en los permisos.
-- [Módulo]: Seguridad - Gestión de módulos y permisos
-- [Entrada]: NEW record de segModulos (automático por trigger)
--            - NEW."idSM": ID del módulo recién creado
--            - NEW.clave: Clave numérica del módulo
-- [Salida]: Registros en segModulosUsuarios para cada usuario activo con:
--           - idSM: ID del módulo
--           - idUser: ID de cada usuario activo
--           - clave: Clave del módulo (copiada desde segModulos)
--           - acceso: false (sin acceso por defecto)
-- [Uso típico]: Al crear nuevo módulo se asigna automáticamente a todos los usuarios
-- [Trigger]: trigger_segModulos_auto_asignar
-- [Ejemplo]: INSERT INTO "segModulos" (clave, modulo, seccion, accion) 
--            VALUES (100, 'Reportes', 'Ventas', 'Ver')
--            -> AUTO INSERT en segModulosUsuarios para todos los usuarios activos

CREATE OR REPLACE FUNCTION public.segmodulos_agregar_todos_usuarios()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $BODY$
BEGIN
    -- [Fecha y Hora]: 01/10/2025 00:00:00
    -- [Descripción]: Agrega automáticamente el nuevo módulo a todos los usuarios existentes
    --                incluyendo la clave del módulo para mantener consistencia en los permisos.
    -- [Módulo]: Seguridad - Gestión de módulos y permisos
    -- [Entrada]: NEW record de segModulos (automático por trigger)
    --            - NEW."idSM": ID del módulo recién creado
    --            - NEW.clave: Clave numérica del módulo
    -- [Salida]: Registros en segModulosUsuarios para cada usuario activo con:
    --           - idSM: ID del módulo
    --           - idUser: ID de cada usuario activo
    --           - clave: Clave del módulo (copiada desde segModulos)
    --           - acceso: false (sin acceso por defecto)
    -- [Uso típico]: Al crear nuevo módulo se asigna automáticamente a todos los usuarios
    -- [Trigger]: trigger_segModulos_auto_asignar
    -- [Ejemplo]: INSERT INTO "segModulos" (clave, modulo, seccion, accion) 
    --            VALUES (100, 'Reportes', 'Ventas', 'Ver')
    --            -> AUTO INSERT en segModulosUsuarios para todos los usuarios activos
    
    -- Verificar que se ejecuta desde trigger (TG_OP existe solo en triggers)
    IF TG_OP IS NULL THEN
        RAISE EXCEPTION 'Esta función solo puede ejecutarse desde un trigger';
    END IF;
    
    -- Insertar el nuevo módulo para todos los usuarios activos
    INSERT INTO "segModulosUsuarios" ("idSM", "idUser", "clave", "acceso")
    SELECT 
        NEW."idSM",
        u.uid,
        NEW.clave,  -- Copiar la clave del módulo recién creado
        false       -- Sin acceso por defecto
    FROM "catUsers" u
    WHERE u.status = true;
    
    RETURN NEW;
END;
$BODY$;