-- ============================================================================
-- Fideicomiso · Promoción del 9% con duración configurable (1 ó 2 años)
-- Aplicadas en PRODUCCIÓN el 2026-08-11, autorizadas por Jereff.
-- Plan de diseño: base-conocimiento/PLAN-fideicomiso-promocion-2-anios.md
--
-- EVIDENCIA DE NO-REGRESIÓN (huella de los cálculos de las 97 adhesiones):
--   antes  : filas=4078  huella=ca1ee0226340150dbc3b082ce7922578
--   después: filas=4078  huella=ca1ee0226340150dbc3b082ce7922578   ✅ idéntica
--   (query al final de este archivo)
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- M1. Columna de duración (aditiva; DEFAULT 1 = comportamiento actual)
-- ─────────────────────────────────────────────────────────────────────────────
SET lock_timeout = '5s';

ALTER TABLE public."fideCondiciones"
  ADD COLUMN "promoAnios" smallint NOT NULL DEFAULT 1;

ALTER TABLE public."fideCondiciones"
  ADD CONSTRAINT "fideCondiciones_promoAnios_check"
  CHECK ("promoAnios" BETWEEN 1 AND 2);

-- Sin promoción la duración debe ser 1: evita un "2 años" dormido que se
-- activaría solo si mañana se enciende el flag.
ALTER TABLE public."fideCondiciones"
  ADD CONSTRAINT "fideCondiciones_promo_coherente_check"
  CHECK (COALESCE("Prom9%", false) = true OR "promoAnios" = 1);

COMMENT ON COLUMN public."fideCondiciones"."promoAnios" IS
  'Duración en años de la promoción del 9% (solo aplica si "Prom9%"=true; sin promoción el CHECK exige 1). 1=primer año (default), 2=dos años. Inmutable una vez asignada la promoción: los 2 años solo se otorgan por ajuste manual autorizado, no desde la UI.';


-- ─────────────────────────────────────────────────────────────────────────────
-- M2. La RPC deja de hardcodear "1 year" y lee la duración de la condición.
--
-- ⚠️ El reemplazo se hace SOBRE LA DEFINICIÓN REAL del catálogo, sustituyendo
--    ÚNICAMENTE la línea objetivo. Reescribir a mano una función de ~18k
--    caracteres es la vía más probable de romper los cálculos por accidente.
--    Si la línea no aparece exactamente una vez, ABORTA sin tocar nada.
-- ─────────────────────────────────────────────────────────────────────────────
DO $mig$
DECLARE
  v_def    text;
  v_target text := 'v_fin_promocion := v_primer_pago + INTERVAL ''1 year'';';
  v_repl   text := 'v_fin_promocion := v_primer_pago + make_interval(years => COALESCE(v_condiciones."promoAnios", 1)::int);';
  v_ocur   int;
BEGIN
  SELECT pg_get_functiondef('public.plan_dispersiones_dinamico(text,text,text)'::regprocedure)
    INTO v_def;

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'No se encontró public.plan_dispersiones_dinamico(text,text,text)';
  END IF;

  v_ocur := (length(v_def) - length(replace(v_def, v_target, ''))) / length(v_target);
  IF v_ocur <> 1 THEN
    RAISE EXCEPTION 'Se esperaba 1 ocurrencia de la línea de fin de promoción; se encontraron %', v_ocur;
  END IF;

  EXECUTE replace(v_def, v_target, v_repl);
END
$mig$;

-- Endurecimiento aprovechando el REPLACE (era SECURITY DEFINER sin search_path).
ALTER FUNCTION public.plan_dispersiones_dinamico(text, text, text)
  SET search_path = public, pg_temp;

-- Devolvía el padrón con RFC y montos a `anon`, y la anon key viaja en el
-- bundle de v1. v2 la invoca con service_role, así que no se rompe nada.
--
-- ⚠️ OJO — ESTO NO CIERRA LA FUGA (verificado por la validación adversarial):
--    otras 8 RPC hermanas siguen con EXECUTE para anon/PUBLIC y devuelven los
--    MISMOS datos; entre ellas `plan_dispersiones_dinamico_corregido`, clon casi
--    idéntico de esta función → basta llamar al gemelo para esquivar el REVOKE.
--    Probado con `SET LOCAL ROLE anon`: `resumen_fideicomiso_completo` devolvió
--    97 filas con nombre, RFC y montos. Cerrarlo requiere el REVOKE sobre las 8
--    y es una DECISIÓN PENDIENTE DE JEREFF (ver DEUDA.md).
REVOKE EXECUTE ON FUNCTION public.plan_dispersiones_dinamico(text, text, text) FROM PUBLIC, anon;


-- ─────────────────────────────────────────────────────────────────────────────
-- M3. Inmutabilidad de la promoción, EN EL MOTOR.
--
-- Por qué no basta el backend: `authenticated` tenía DML completo sobre la
-- tabla con políticas RLS permisivas y la anon key es pública → la regla
-- aplicada solo en NestJS era esquivable vía PostgREST. El trigger la hace
-- real incluso para service_role (que salta la RLS, pero NO los triggers).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fidecondiciones_promo_inmutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
BEGIN
  -- Ajuste manual autorizado (queda auditado por trg_auditoria).
  IF COALESCE(current_setting('app.promo_override', true), '') = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF COALESCE(OLD."Prom9%", false) THEN
      RAISE EXCEPTION
        'No se puede eliminar una condición con promoción asignada (adhesión %).', OLD."noAdhesion"
        USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF COALESCE(OLD."Prom9%", false)
     AND ( COALESCE(NEW."Prom9%", false) IS DISTINCT FROM COALESCE(OLD."Prom9%", false)
        OR NEW."promoAnios" IS DISTINCT FROM OLD."promoAnios" ) THEN
    RAISE EXCEPTION
      'La promoción ya está asignada a esta adhesión y no puede modificarse.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_fidecondiciones_promo_inmutable ON public."fideCondiciones";

CREATE TRIGGER trg_fidecondiciones_promo_inmutable
  BEFORE UPDATE OR DELETE ON public."fideCondiciones"
  FOR EACH ROW EXECUTE FUNCTION public.fidecondiciones_promo_inmutable();

-- v2 escribe SIEMPRE con service_role (SupabaseService.admin / comoActor).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."fideCondiciones" FROM authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- M4. El candado también en INSERT (hallazgo de la validación adversarial).
--
-- M3 cubría UPDATE y DELETE, pero una condición podía NACER con "promoAnios"=2.
-- La API no lo permite (Zod descarta el campo), pero la garantía descansaba solo
-- en el código y el objetivo del trigger es que viva en el motor.
-- Se re-emite la función completa (versión VIGENTE) y se recrea el trigger.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fidecondiciones_promo_inmutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF COALESCE(current_setting('app.promo_override', true), '') = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW."promoAnios", 1) <> 1 THEN
      RAISE EXCEPTION
        'Una condición nueva no puede nacer con promoción de % años; los 2 años requieren autorización.',
        NEW."promoAnios"
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF COALESCE(OLD."Prom9%", false) THEN
      RAISE EXCEPTION
        'No se puede eliminar una condición con promoción asignada (adhesión %).', OLD."noAdhesion"
        USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF COALESCE(OLD."Prom9%", false)
     AND ( COALESCE(NEW."Prom9%", false) IS DISTINCT FROM COALESCE(OLD."Prom9%", false)
        OR NEW."promoAnios" IS DISTINCT FROM OLD."promoAnios" ) THEN
    RAISE EXCEPTION
      'La promoción ya está asignada a esta adhesión y no puede modificarse.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_fidecondiciones_promo_inmutable ON public."fideCondiciones";

CREATE TRIGGER trg_fidecondiciones_promo_inmutable
  BEFORE INSERT OR UPDATE OR DELETE ON public."fideCondiciones"
  FOR EACH ROW EXECUTE FUNCTION public.fidecondiciones_promo_inmutable();

-- Pruebas del candado (todas dentro de BEGIN … ROLLBACK, 2026-08-11):
--   quitar promo BLOQ · subir a 2 años BLOQ · borrar condición con promo BLOQ ·
--   borrado en cascada desde propiedades BLOQ · UPDATE masivo sin WHERE que toca
--   la promo BLOQ · upsert ON CONFLICT DO UPDATE BLOQ · INSERT naciendo con 2
--   años BLOQ ·· editar otros campos PERMITE · alta normal PERMITE · asignar
--   promo por primera vez PERMITE · override autorizado PERMITE.


-- ============================================================================
-- OPERACIÓN: otorgar 2 años a un fideicomitente (ajuste manual AUTORIZADO)
-- ============================================================================
-- 1) Listar TODAS sus condiciones (nunca una suelta: un fideicomitente puede
--    tener varias propiedades/tickets bajo la misma o distintas adhesiones):
--
--   SELECT fc."idfideCond", fc."noAdhesion", fc."Prom9%", fc."promoAnios",
--          pr."nomDescriptivo", i.razonsocial
--   FROM "fideCondiciones" fc
--   JOIN propiedades pr USING("idPropiedad")
--   JOIN inversionista i ON i."idInversionista" = pr."idInversionista"
--   WHERE i.razonsocial ILIKE '%<nombre>%' ORDER BY fc."noAdhesion";
--
-- 2) Medir el impacto ANTES de aplicar (delta por periodo de dispersión):
--    correr `plan_dispersiones_dinamico` de esa adhesión dentro de
--    BEGIN … UPDATE … SELECT … ROLLBACK y comparar contra el estado actual.
--    ⚠️ Si el fideicomitente ya cursó parte de su 2º año, esos periodos se
--    re-precian al 9%: revisar que no correspondan a dispersiones ya pagadas.
--
-- 3) Aplicar, con actor atribuible en la auditoría:
--
--   BEGIN;
--   SET LOCAL "request.jwt.claims" = '{"sub":"<uid de quien autoriza>","role":"service_role"}';
--   SET LOCAL app.promo_override = 'on';
--   UPDATE public."fideCondiciones" SET "promoAnios" = 2
--    WHERE "idfideCond" IN ( <todas las del fideicomitente con "Prom9%"=true> );
--   COMMIT;
--
-- 4) Verificar coherencia (debe devolver 0 filas):
--   SELECT "noAdhesion" FROM "fideCondiciones" WHERE "Prom9%"
--   GROUP BY 1 HAVING count(DISTINCT "promoAnios") > 1;


-- ============================================================================
-- ROLLBACK (⛔ EN ESTE ORDEN — invertirlo tira TODO el módulo Dispersiones)
-- ============================================================================
-- 1º) Revertir la RPC: mismo bloque DO de M2 intercambiando v_target y v_repl.
-- 2º) DROP TRIGGER trg_fidecondiciones_promo_inmutable ON public."fideCondiciones";
--     DROP FUNCTION public.fidecondiciones_promo_inmutable();
-- 3º) ALTER TABLE public."fideCondiciones" DROP COLUMN "promoAnios";
-- (Los GRANT revocados se restauran con GRANT … TO authenticated / anon si se
--  quisiera volver atrás, pero NO es necesario para el rollback funcional.)


-- ============================================================================
-- HUELLA DE NO-REGRESIÓN (correr antes y después de cualquier cambio a la RPC)
-- ============================================================================
-- WITH adh AS (
--   SELECT DISTINCT "noAdhesion" FROM public."fideCondiciones" WHERE "idFide"='jsRw4C6FswY20O'
-- ), r AS (
--   SELECT a."noAdhesion", d.*
--   FROM adh a CROSS JOIN LATERAL public.plan_dispersiones_dinamico('jsRw4C6FswY20O', a."noAdhesion", NULL) d
-- )
-- SELECT count(*) AS filas,
--        md5(string_agg(concat_ws('|',
--          no_adhesion,id_pago,tipo_periodo,sub_periodo,fecha_inicio,fecha_fin,dias_periodo,nodispersion,
--          round(tasa_rendimiento::numeric,6),round(rendimiento_bruto::numeric,6),round(retencion_isr::numeric,6),
--          round(rendimiento_neto::numeric,6),round(rendimiento_sph::numeric,6),round(dispersion_neta::numeric,6)),
--          E'\n' ORDER BY no_adhesion,id_pago,fecha_inicio,sub_periodo)) AS huella
-- FROM r;
