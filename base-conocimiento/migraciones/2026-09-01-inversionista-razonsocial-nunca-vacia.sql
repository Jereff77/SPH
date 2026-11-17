-- ============================================================================
-- 2026-09-01 · inversionista: la `razonsocial` NUNCA queda vacía (red de seguridad)
-- ----------------------------------------------------------------------------
-- Extiende el trigger `v2_trg_inversionista_razonsocial` (creado el 2026-06-18,
-- ver `2026-06-18-inversionista-autocompleta-razonsocial-fisica.sql`), que solo
-- autocompletaba la razón social de las PERSONAS FÍSICAS.
--
-- POR QUÉ (caso real, 2026-09-01 — cliente *Gabriela Ruiz Ruiz*):
--   Se dio de alta con `personalidad` VACÍA (el select del formulario permitía
--   "—"). Al no ser 'Fisica', el trigger no entraba, `razonsocial` quedó NULL y
--   el cliente DESAPARECIÓ del selector de Devoluciones de CxP, que filtra
--   `razonsocial IS NOT NULL` (`solicitudes.service.ts` → `inversionistas()`).
--   Mismo síntoma que el caso *Mauricio Valdez Salgado* (2026-06-18), que se creyó
--   cerrado: el trigger tapaba la vía "física sin razón social", pero dejaba
--   abiertas "personalidad vacía" y "moral sin razón social".
--
-- REGLA DE NEGOCIO (Jereff, 2026-09-01):
--   La razón social NUNCA puede ir vacía. O lleva la razón social de la persona
--   moral, o lleva el nombre del cliente. Nunca vacía.
--
-- QUÉ CAMBIA:
--   + Bloque 3 (NUEVO): si tras los pasos previos la razón social sigue vacía
--     (NULL o solo espacios), cae al nombre completo del cliente — sin importar
--     la personalidad. Cierra las dos vías que quedaban abiertas.
--   + `SET search_path = public, pg_temp` (endurecimiento; la función no lo tenía).
--   = Bloques 1 y 2 SIN CAMBIOS (canoniza personalidad; físicas = nombre completo).
--
-- QUÉ **NO** CAMBIA:
--   · NO toca ningún dato existente: es CREATE OR REPLACE de la función. El
--     trigger sigue siendo el mismo objeto y aplica desde el próximo INSERT/UPDATE.
--   · NO altera a las morales que YA tienen razón social (el bloque 3 solo entra
--     si está vacía).
--   · Al aplicarlo había 0 clientes con razón social vacía: el efecto inmediato es
--     nulo. Es prevención.
--
-- Defensa en profundidad — este trigger es el PISO, no la única capa:
--   API  (`clientes.schemas.ts`): `personalidad` obligatoria; `razonsocial`
--        obligatoria cuando es Moral.
--   Front (`ClienteSheet.tsx`): sin opción "—"; para Física el campo Razón social
--        va deshabilitado (vista previa del nombre) y NO se envía — el formato lo
--        pone SOLO la BD, para no tener dos capas formateando el mismo dato.
--
-- Autorizado por Jereff (2026-09-01) y aplicado vía MCP `supaSPH`.
-- BD de PRODUCCIÓN.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.v2_inversionista_set_razonsocial()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_nombre text;
BEGIN
  -- 1) Canoniza la personalidad (compat v1: sin acento).
  IF NEW.personalidad ILIKE 'f%' THEN
    NEW.personalidad := 'Fisica';
  ELSIF NEW.personalidad ILIKE 'm%' THEN
    NEW.personalidad := 'Moral';
  END IF;

  v_nombre := UPPER(TRIM(REGEXP_REPLACE(
    concat_ws(' ', NEW.nombre, NEW.apellido1, NEW.apellido2), '\s+', ' ', 'g')));

  -- 2) Personas fisicas: la razon social SIEMPRE se formula con el nombre completo.
  IF NEW.personalidad = 'Fisica' AND v_nombre <> '' THEN
    NEW.razonsocial := v_nombre;
  END IF;

  -- 3) Red de seguridad (regla de Jereff, 2026-09-01): la razon social NUNCA queda
  --    vacia. Si no se capturo (moral sin razon social, o personalidad ausente),
  --    cae al nombre completo del cliente.
  IF NULLIF(TRIM(COALESCE(NEW.razonsocial, '')), '') IS NULL AND v_nombre <> '' THEN
    NEW.razonsocial := v_nombre;
  END IF;

  RETURN NEW;
END;
$function$;

-- ============================================================================
-- VERIFICACIÓN (ejecutada el 2026-09-01, sobre una TEMP TABLE con el mismo
-- trigger — cero escrituras en `inversionista`):
--
--   caso                  | personalidad | razonsocial resultante
--   ----------------------+--------------+-----------------------------
--   Física sin razón soc. | Fisica       | MARIA DE LA LUZ PEREZ GOMEZ  (espacios colapsados)
--   Física CON razón soc. | Fisica       | JUAN LOPEZ RUIZ              (se sobreescribe: manda el nombre)
--   Moral  CON razón soc. | Moral        | ACEROS DEL NORTE SA DE CV    (se respeta)
--   Moral  sin razón soc. | Moral        | ACEROS DEL SUR               (← bloque 3)
--   SIN personalidad      | NULL         | ANA TORRES                   (← bloque 3, el caso Gabriela)
--
-- ROLLBACK: restaurar el cuerpo previo desde
--   `2026-06-18-inversionista-autocompleta-razonsocial-fisica.sql`.
-- ============================================================================
