--[Fecha y Hora]: 15/05/2026 12:07:00
--[Descripción]: Función trigger que actualiza automáticamente uidGerente y nomGerente
--                en la tabla cxp a partir del idCategoria ingresado.
--
--[Parámetros]: No requiere parámetros directos (función trigger)
--
--[Salida]:
--   - trigger: Retorna NEW con uidGerente y nomGerente actualizados
--
--[Trigger asociado]: trigger_cxp_actualizar_gerente
--
--[Eventos]:
--   - BEFORE INSERT: Al insertar nuevos registros en cxp
--   - BEFORE UPDATE: Al actualizar registros en cxp (solo si cambia idCategoria)
--
--[Uso típico]: Se ejecuta automáticamente al insertar o actualizar un registro en cxp
--               para mantener sincronizados uidGerente y nomGerente con la categoría asignada.
--
--[Lógica]:
--   1. Si idCategoria es NULL o vacío → pone NULL en uidGerente y nomGerente
--   2. En UPDATE, si idCategoria no cambió → no hace consultas (optimización)
--   3. Busca uidResponsable en PresCategorias usando idCategoria
--   4. Con ese uuid, busca nomCompleto en catUsers
--   5. Asigna uidGerente (cast uuid→text) y nomGerente
--
--[Relaciones]:
--   - Tabla principal: cxp
--   - Tabla: PresCategorias (uidResponsable)
--   - Tabla: catUsers (nomCompleto)
--
--[Consideraciones]:
--   - uidGerente en cxp es de tipo text; uidResponsable en PresCategorias es uuid → se hace cast
--   - Si la categoría no tiene uidResponsable asignado, ambos campos quedan en NULL
--   - Si el uuid no existe en catUsers, uidGerente se asigna pero nomGerente queda NULL
--   - Función de tipo SECURITY INVOKER
--
--[Ejemplo de comportamiento]:
--   INSERT con idCategoria='CAT01' → busca PresCategorias → obtiene uidResponsable
--   → busca catUsers → asigna uidGerente y nomGerente automáticamente

CREATE OR REPLACE FUNCTION public.cxp_actualizar_gerente()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $function$
DECLARE
    v_uid_responsable uuid;
    v_nom_completo    text;
BEGIN
    --[Fecha y Hora]: 15/05/2026 12:07:00
    --[Descripción]: Actualiza uidGerente y nomGerente en cxp según idCategoria
    --[Trigger]: trigger_cxp_actualizar_gerente
    --[Eventos]: BEFORE INSERT OR UPDATE en tabla public.cxp
    --[Flujo]:
    --  1. Si idCategoria es NULL/vacío → limpia ambos campos y retorna
    --  2. En UPDATE: si idCategoria no cambió → no recalcula (optimización de rendimiento)
    --  3. Busca uidResponsable en PresCategorias por idCategoria
    --  4. Busca nomCompleto en catUsers por uid = uidResponsable
    --  5. Asigna uidGerente (::text) y nomGerente al registro
    --[Uso]: Se ejecuta automáticamente en INSERT o UPDATE sobre tabla cxp

    -- Si idCategoria es nulo o vacío, limpiar campos y salir
    IF NEW."idCategoria" IS NULL OR NEW."idCategoria" = '' THEN
        NEW."uidGerente" := NULL;
        NEW."nomGerente" := NULL;
        RETURN NEW;
    END IF;

    -- En UPDATE, solo recalcular si idCategoria cambió
    IF TG_OP = 'UPDATE' AND OLD."idCategoria" IS NOT DISTINCT FROM NEW."idCategoria" THEN
        RETURN NEW;
    END IF;

    -- 1. Buscar el responsable de la categoría en PresCategorias
    SELECT "uidResponsable"
    INTO v_uid_responsable
    FROM public."PresCategorias"
    WHERE "idCategoria" = NEW."idCategoria";

    -- Si no se encontró la categoría o no tiene responsable asignado
    IF NOT FOUND OR v_uid_responsable IS NULL THEN
        NEW."uidGerente" := NULL;
        NEW."nomGerente" := NULL;
        RETURN NEW;
    END IF;

    -- 2. Buscar el nombre completo del responsable en catUsers
    SELECT "nomCompleto"
    INTO v_nom_completo
    FROM public."catUsers"
    WHERE uid = v_uid_responsable;

    -- 3. Asignar los valores (cast uuid → text para uidGerente)
    NEW."uidGerente" := v_uid_responsable::text;
    NEW."nomGerente" := v_nom_completo;

    RETURN NEW;

EXCEPTION
    WHEN OTHERS THEN
        RAISE;
END;
$function$;
