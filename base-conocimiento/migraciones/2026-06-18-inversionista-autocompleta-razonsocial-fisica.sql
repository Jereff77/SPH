-- ============================================================================
-- 2026-06-18 · inversionista: normaliza `personalidad` y autocompleta `razonsocial`
-- ----------------------------------------------------------------------------
-- Un solo trigger (objeto NUEVO v2_, aditivo) sobre `inversionista` que, en cada
-- INSERT/UPDATE:
--   1) NORMALIZA la personalidad a un canónico estable -> 'Fisica' / 'Moral'
--      (SIN acento). Motivo: v1 (Flutter, aún activo) usa el literal 'Fisica' en
--      sus dropdowns (options: ['Fisica','Moral']) y en comparaciones de lógica
--      (cboPersonalidadInvValue == 'Fisica'); cualquier variante con acento
--      ("Física") rompería su selección y sus condicionales. v2 mostraba "Física"
--      con acento (ClienteModal), de ahí la mezcla. Se canoniza en la BD para que
--      escriba quien escriba (v1 o v2), el valor quede uniforme. La UI puede seguir
--      mostrando "Física" como etiqueta (el VALUE guardado es 'Fisica').
--   2) Para PERSONAS FÍSICAS, formula la razón social con el nombre completo
--      (UPPER(nombre + apellido1 + apellido2)). Las MORALES conservan la razón
--      social que captura el usuario.
--
-- Autorizado por el usuario (2026-06-18). BD compartida con v1.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.v2_inversionista_set_razonsocial()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_nombre text;
BEGIN
  -- 1) Canoniza la personalidad (compat v1: sin acento).
  IF NEW.personalidad ILIKE 'f%' THEN
    NEW.personalidad := 'Fisica';
  ELSIF NEW.personalidad ILIKE 'm%' THEN
    NEW.personalidad := 'Moral';
  END IF;

  -- 2) Personas físicas: la razón social se formula con el nombre completo.
  IF NEW.personalidad = 'Fisica' THEN
    v_nombre := UPPER(TRIM(REGEXP_REPLACE(
      concat_ws(' ', NEW.nombre, NEW.apellido1, NEW.apellido2), '\s+', ' ', 'g')));
    IF v_nombre <> '' THEN
      NEW.razonsocial := v_nombre;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS v2_trg_inversionista_razonsocial ON public.inversionista;
CREATE TRIGGER v2_trg_inversionista_razonsocial
BEFORE INSERT OR UPDATE ON public.inversionista
FOR EACH ROW
EXECUTE FUNCTION public.v2_inversionista_set_razonsocial();

-- ----------------------------------------------------------------------------
-- Saneo de datos existentes (idempotente):
-- (a) personalidades con acento / variantes -> canónico 'Fisica' / 'Moral'
UPDATE public.inversionista SET personalidad = 'Fisica'
WHERE personalidad ILIKE 'f%' AND personalidad <> 'Fisica';
UPDATE public.inversionista SET personalidad = 'Moral'
WHERE personalidad ILIKE 'm%' AND personalidad <> 'Moral';

-- (b) físicas activas sin razón social -> su nombre completo
--     (Mauricio Valdez Salgado fue corregido manualmente por el usuario antes de esto.)
UPDATE public.inversionista
SET razonsocial = UPPER(TRIM(REGEXP_REPLACE(concat_ws(' ', nombre, apellido1, apellido2), '\s+', ' ', 'g')))
WHERE personalidad ILIKE 'f%'
  AND (razonsocial IS NULL OR btrim(razonsocial) = '')
  AND btrim(regexp_replace(concat_ws(' ', nombre, apellido1, apellido2), '\s+', ' ', 'g')) <> '';

-- ----------------------------------------------------------------------------
-- Reversión (si se necesitara):
--   DROP TRIGGER IF EXISTS v2_trg_inversionista_razonsocial ON public.inversionista;
--   DROP FUNCTION IF EXISTS public.v2_inversionista_set_razonsocial();
--   (el saneo de datos no es reversible automáticamente)
-- ============================================================================
