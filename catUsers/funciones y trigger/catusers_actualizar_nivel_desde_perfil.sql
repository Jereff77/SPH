--[Fecha y Hora]: 01/10/2025 12:45:00
-- [Descripción]: Actualiza automáticamente el campo "nivel" en la tabla "catUsers"
--                cuando se actualiza el campo "idPerfil", tomando el nivel del perfil seleccionado.
--                Esta es una sincronización UNIDIRECCIONAL (idPerfil → nivel).
--
-- [Comportamiento]:
--   - Se ejecuta ANTES de actualizar un registro en "catUsers"
--   - Solo actúa cuando el campo "idPerfil" es modificado
--   - Busca el nivel correspondiente en "catPerfiles"
--   - Actualiza automáticamente el campo "nivel" del usuario
--
-- [Ventajas]:
--   - Evita bucles infinitos
--   - Mantiene "idPerfil" como única fuente de verdad
--   - Comportamiento predecible y mantenible
--   - Garantiza consistencia entre idPerfil y nivel
--
-- [Trigger]: trigger_catusers_actualizar_nivel_desde_perfil (BEFORE UPDATE)
--
-- [Validaciones]:
--   - Si no se encuentra el perfil, lanza un WARNING pero permite la operación
--   - Solo procesa si hubo cambio real en idPerfil (usando IS DISTINCT FROM)
--
-- [Ejemplo de uso automático]:
--   UPDATE "catUsers" 
--   SET "idPerfil" = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' 
--   WHERE uid = 'user-uuid-123';
--   -- El nivel se actualizará automáticamente con el nivel del perfil seleccionado
--
-- [Ejemplo de resultado en logs]:
--   NOTICE: Nivel actualizado automáticamente a 5 para el usuario user-uuid-123

CREATE OR REPLACE FUNCTION public.catusers_actualizar_nivel_desde_perfil()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $BODY$
DECLARE
    v_nivel_perfil REAL;
BEGIN
    -- [Fecha y Hora]: 01/10/2025 12:45:00
    -- [Descripción]: Actualiza automáticamente el campo "nivel" en la tabla "catUsers"
    --                cuando se actualiza el campo "idPerfil", tomando el nivel del perfil seleccionado.
    --                Esta es una sincronización UNIDIRECCIONAL (idPerfil → nivel).
    --
    -- [Comportamiento]:
    --   - Se ejecuta ANTES de actualizar un registro en "catUsers"
    --   - Solo actúa cuando el campo "idPerfil" es modificado
    --   - Busca el nivel correspondiente en "catPerfiles"
    --   - Actualiza automáticamente el campo "nivel" del usuario
    --
    -- [Ventajas]:
    --   - Evita bucles infinitos
    --   - Mantiene "idPerfil" como única fuente de verdad
    --   - Comportamiento predecible y mantenible
    --   - Garantiza consistencia entre idPerfil y nivel
    --
    -- [Trigger]: trigger_catusers_actualizar_nivel_desde_perfil (BEFORE UPDATE)
    --
    -- [Validaciones]:
    --   - Si no se encuentra el perfil, lanza un WARNING pero permite la operación
    --   - Solo procesa si hubo cambio real en idPerfil (usando IS DISTINCT FROM)
    --
    -- [Ejemplo de uso automático]:
    --   UPDATE "catUsers" 
    --   SET "idPerfil" = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' 
    --   WHERE uid = 'user-uuid-123';
    --   -- El nivel se actualizará automáticamente con el nivel del perfil seleccionado
    --
    -- [Ejemplo de resultado en logs]:
    --   NOTICE: Nivel actualizado automáticamente a 5 para el usuario user-uuid-123

    -- Solo procesar si cambió el idPerfil
    IF OLD."idPerfil" IS DISTINCT FROM NEW."idPerfil" THEN
        
        -- Buscar el nivel del nuevo perfil
        SELECT nivel INTO v_nivel_perfil
        FROM public."catPerfiles"
        WHERE "idPerfil" = NEW."idPerfil";
        
        -- Si se encontró el perfil, actualizar el nivel
        IF FOUND THEN
            NEW.nivel := v_nivel_perfil;
            RAISE NOTICE 'Nivel actualizado automáticamente a % para el usuario %', v_nivel_perfil, NEW.uid;
        ELSE
            -- Si no se encuentra el perfil, lanzar advertencia
            RAISE WARNING 'No se encontró el perfil con ID: %. El nivel no se actualizó.', NEW."idPerfil";
        END IF;
        
    END IF;

    RETURN NEW;
END;
$BODY$;