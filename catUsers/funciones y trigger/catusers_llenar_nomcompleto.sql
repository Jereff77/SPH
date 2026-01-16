--[Descripción]: Genera automáticamente el campo nomCompleto y UID si es necesario
-- [Módulo]: Gestión de Usuarios - catUsers
-- [Entrada]: NEW record con campos nombre, apellidos y opcionalmente uid
-- [Salida]: NEW record con nomCompleto actualizado y uid generado si era NULL
-- [Uso típico]: Se ejecuta automáticamente en INSERT/UPDATE de catUsers
-- [Trigger]: trigger_catUsers_llenar_nomCompleto
-- [Ejemplo]: INSERT sin uid → se genera automáticamente; nombre='Juan', apellidos='Pérez' → nomCompleto='Juan Pérez'

CREATE OR REPLACE FUNCTION public.catusers_llenar_nomcompleto()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $BODY$
BEGIN
    -- [Descripción]: Genera automáticamente el campo nomCompleto y UID si es necesario
    -- [Módulo]: Gestión de Usuarios - catUsers
    -- [Entrada]: NEW record con campos nombre, apellidos y opcionalmente uid
    -- [Salida]: NEW record con nomCompleto actualizado y uid generado si era NULL
    -- [Uso típico]: Se ejecuta automáticamente en INSERT/UPDATE de catUsers
    -- [Trigger]: trigger_catUsers_llenar_nomCompleto
    -- [Ejemplo]: INSERT sin uid → se genera automáticamente; nombre='Juan', apellidos='Pérez' → nomCompleto='Juan Pérez'
    
    -- Generar UID si viene NULL
    IF NEW.uid IS NULL THEN
        NEW.uid = gen_random_uuid();
    END IF;
    
    -- Llenar nombre completo
    IF NEW.nombre IS NOT NULL AND NEW.apellidos IS NOT NULL THEN
        NEW."nomCompleto" = TRIM(NEW.nombre || ' ' || NEW.apellidos);
    ELSIF NEW.nombre IS NOT NULL THEN
        NEW."nomCompleto" = TRIM(NEW.nombre);
    ELSIF NEW.apellidos IS NOT NULL THEN
        NEW."nomCompleto" = TRIM(NEW.apellidos);
    END IF;
    
    RETURN NEW;
END;
$BODY$;