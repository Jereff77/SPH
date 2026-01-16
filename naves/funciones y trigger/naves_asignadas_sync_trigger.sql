--[Fecha y Hora]: 16/10/2025 23:49:20
-- [Descripción]: Función trigger para mantener sincronizada la tabla "naves" cuando se realizan
--                cambios en la tabla "empresasNaves" (INSERT, UPDATE, DELETE).
--                Actualiza el campo "asignado" y "idEmpresa" en la tabla "naves".
--
-- [Entrada]: Trigger que se dispara con cambios en la tabla "empresasNaves".
--
-- [Salida]: trigger - Retorna NEW o NULL según la operación.
--
-- [Uso típico]: Se ejecuta automáticamente mediante trigger en la tabla "empresasNaves".
--
-- [Trigger asociado]: trigger_naves_asignadas_sync (en la tabla empresasNaves)
--
-- [Comportamiento]:
--   - INSERT: Marca la nave como asignada (asignado = true) y establece idEmpresa
--   - UPDATE: Actualiza idEmpresa si cambia
--   - DELETE: Desasigna la nave (asignado = false, idEmpresa = NULL, uidAsignador = NULL)

CREATE OR REPLACE FUNCTION public.naves_asignadas_sync_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $BODY$
BEGIN
    --[Fecha y Hora]: 16/10/2025 23:49:20
    -- [Descripción]: Mantiene sincronizada la tabla "naves" cuando se realizan
    --                cambios en la tabla "empresasNaves" (INSERT, UPDATE, DELETE).
    --                Actualiza el campo "asignado" y "idEmpresa" en la tabla "naves".
    --
    -- [Entrada]: Trigger que se dispara con cambios en la tabla "empresasNaves".
    --
    -- [Salida]: trigger - Retorna NEW o NULL según la operación.
    --
    -- [Uso típico]: Se ejecuta automáticamente mediante trigger en la tabla "empresasNaves".
    --
    -- [Trigger asociado]: trigger_naves_asignadas_sync

    -- INSERT: Cuando se agrega un registro en empresasNaves, actualizar la nave como asignada
    IF TG_OP = 'INSERT' THEN
        UPDATE public.naves 
        SET 
            "asignado" = true,
            "idEmpresa" = NEW."idEmpresa",
            "uidAsignador" = auth.uid()
        WHERE "idNave" = NEW."idNave";
        
        RETURN NEW;
    
    -- UPDATE: Si cambia el idEmpresa en empresasNaves, actualizar la nave
    ELSIF TG_OP = 'UPDATE' THEN
        -- Si cambió el idEmpresa, actualizar la nave
        IF NEW."idEmpresa" != OLD."idEmpresa" THEN
            UPDATE public.naves 
            SET 
                "idEmpresa" = NEW."idEmpresa",
                "uidAsignador" = auth.uid()
            WHERE "idNave" = NEW."idNave";
        END IF;
        
        RETURN NEW;
    
    -- DELETE: Cuando se elimina un registro de empresasNaves, desasignar la nave
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.naves 
        SET 
            "asignado" = false,
            "idEmpresa" = NULL,
            "uidAsignador" = NULL
        WHERE "idNave" = OLD."idNave";
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$BODY$;