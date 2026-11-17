-- =====================================================================================
-- Subtotal = total en Línea de captura (4), Devolución (5) y Sin XML (6)
-- Decisión de Jereff 2026-11-17. NO APLICADO. Validado por Opus: APLICABLE CON CORRECCIONES
-- (informe: temp/diseno-subtotal-igual-total/validacion.md; correcciones B5, B6 y B7 ya incorporadas aquí).
-- Efecto: estos tipos nacen con subtotal = 0 y la vista v_resumenPresupuesto suma subtotal,
--         por eso no afectaban el presupuesto. El trigger los iguala siempre al total.
-- Estado verificado (2026-11-17): 123 filas (51 líneas, 67 devoluciones, 5 sin XML), todas activas,
--   todas con subtotal = 0 (ninguna NULL ni distinta) y total > 0. Nada manual que pisar.
-- Fuera de alcance: urgentes (tipo 2), PPD y facturas normales.
-- Aplicar FUERA del horario de captura (el UPDATE emite 123 eventos de Realtime).
-- =====================================================================================

SET LOCAL lock_timeout = '5s';

-- ---- 1. Función del trigger ----
CREATE OR REPLACE FUNCTION public.cxp_subtotal_igual_total()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW."tipoOperacion" IN (4, 5, 6) AND NEW.total IS NOT NULL THEN
    NEW.subtotal := NEW.total;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.cxp_subtotal_igual_total() IS
  'Línea de captura (4), Devolución (5) y Sin XML (6): subtotal = total siempre, para que cuenten en v_resumenPresupuesto (decisión de Jereff 2026-11-17).';

-- Higiene (B6): función de trigger, no se invoca por la API.
REVOKE ALL ON FUNCTION public.cxp_subtotal_igual_total() FROM PUBLIC, anon, authenticated;

-- ---- 2. Trigger (antes de guardar; solo cuando se escribe tipo, total o subtotal) ----
DROP TRIGGER IF EXISTS trg_cxp_subtotal_igual_total ON public.cxp;
CREATE TRIGGER trg_cxp_subtotal_igual_total
  BEFORE INSERT OR UPDATE OF "tipoOperacion", total, subtotal ON public.cxp
  FOR EACH ROW EXECUTE FUNCTION public.cxp_subtotal_igual_total();

-- ---- 3. Corrección única de lo ya capturado (idempotente) ----
UPDATE public.cxp
   SET subtotal = total
 WHERE "tipoOperacion" IN (4, 5, 6)
   AND total IS NOT NULL
   AND subtotal IS DISTINCT FROM total;

-- ---- 4. Verificación posterior (debe devolver 0) ----
-- SELECT count(*) FROM public.cxp WHERE "tipoOperacion" IN (4,5,6) AND total IS NOT NULL AND subtotal IS DISTINCT FROM total;

-- =====================================================================================
-- REVERSA (en este orden). Las 123 filas tenían subtotal = 0 antes de la corrección.
--   SET LOCAL lock_timeout = '5s';
--   DROP TRIGGER IF EXISTS trg_cxp_subtotal_igual_total ON public.cxp;
--   DROP FUNCTION IF EXISTS public.cxp_subtotal_igual_total();
--   UPDATE public.cxp SET subtotal = 0 WHERE "tipoOperacion" IN (4, 5, 6) AND subtotal IS DISTINCT FROM 0;
-- No se revierte lo hecho mientras estuvo vivo (aprobaciones, rechazos, marca autorizadoFP);
-- los valores anteriores quedan en `auditoria`.
-- =====================================================================================

-- =====================================================================================
-- AJUSTE 2 — APLICADO el 2026-11-17 (misma tarde), por instrucción de Jereff:
-- «las facturas en otras monedas aún no deben afectar el presupuesto; se revisan después de las urgentes».
-- (migración `cxp_subtotal_igual_total_solo_mxn`)
--   SET LOCAL lock_timeout = '5s';
--   -- La función solo iguala cuando COALESCE(NEW.moneda,'MXN') = 'MXN'.
--   -- Las 5 filas de Sin XML en EUR vuelven a subtotal = 0:
--   UPDATE public.cxp SET subtotal = 0 WHERE "tipoOperacion" IN (4,5,6) AND COALESCE(moneda,'MXN') <> 'MXN' AND subtotal IS DISTINCT FROM 0;
-- Estado aplicado: trigger + función con condición de moneda; 118 filas en MXN iguales al total; 5 en EUR en 0.
-- =====================================================================================

-- =====================================================================================
-- AJUSTE 3 — URGENTES (tipo 2). APLICADO el 2026-11-17 ~14:25 (migración `cxp_subtotal_igual_total_urgentes`; validado por Opus: APLICABLE CON CORRECCIONES). Decisiones de Jereff 2026-11-17:
--   · La urgente afecta el presupuesto por su TOTAL (subtotal = total): se aparta al aprobar, se consume al pagar.
--   · Aprobación en cuenta sobrepasada: opción A (pasa por el aprobador de fuera de presupuesto; la función de aprobación no cambia).
--   · Las cargas del 29/sep (FNTUPiGcP6fIk0x, VOlZZBqFAqsBAPv) tienen fecha 2026: cuentan como gasto de 2026.
--   · Otras monedas: no afectan el presupuesto todavía (solo MXN).
--   · Más adelante la «comprobación del gasto» ajustará el subtotal (ej. 1000 -> 800) y devolverá el sobrante: por eso, una vez
--     pagada la urgente, el trigger solo rellena si el subtotal está vacío; antes del pago el subtotal sigue al total.
-- Prueba en seco (ROLLBACK, 2026-11-17): 35 urgentes corregidas, solo cambia `subtotal`; alta -> subtotal = total; estado 2 con total
--   cambiado sigue al total; pagada con subtotal 800 se respeta; pagada con subtotal 0 se rellena (caso conocido: devolución total).
-- =====================================================================================
-- SET LOCAL lock_timeout = '5s';
-- CREATE OR REPLACE FUNCTION public.cxp_subtotal_igual_total() RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
-- BEGIN
--   IF NEW.total IS NOT NULL AND COALESCE(NEW.moneda, 'MXN') = 'MXN' THEN
--     IF NEW."tipoOperacion" IN (4, 5, 6) THEN
--       NEW.subtotal := NEW.total;
--     ELSIF NEW."tipoOperacion" = 2 AND (COALESCE(NEW.subtotal, 0) = 0 OR NEW."idEstado" IN (1, 2, 3, 4)) THEN
--       NEW.subtotal := NEW.total;
--     END IF;
--   END IF;
--   RETURN NEW;
-- END; $$;
-- UPDATE public.cxp SET subtotal = total
--  WHERE "tipoOperacion" = 2 AND total IS NOT NULL AND COALESCE(moneda,'MXN') = 'MXN' AND subtotal IS DISTINCT FROM total;
-- COMMENT ON FUNCTION public.cxp_subtotal_igual_total() IS
--   'Línea de captura (4), Devolución (5) y Sin XML (6): subtotal = total siempre. Urgente (2): subtotal = total antes del pago y si está vacío; pagada, respeta un ajuste. Solo MXN (decisión de Jereff 2026-11-17).';
--
-- DECISIÓN PENDIENTE DE JEREFF ANTES DE APLICAR (validador, M1): 5 urgentes aprobadas sin pagar de 2026 (679,022.12) empezarían a apartar presupuesto;
--   2 son duplicados de facturas ya pagadas (j0z0Vt7IWrW1i8l = 3,248.00 y 8yDZ3C0soB2ejVH = 45,283.32). Si se cierran como 99, ANTES del UPDATE:
--   UPDATE public.cxp SET "idEstado" = 99 WHERE "idCxp" IN ('j0z0Vt7IWrW1i8l','8yDZ3C0soB2ejVH') AND "idEstado" = 4 AND "montoAplicado" = 0;
--
-- REVERSA LITERAL del AJUSTE 3 (en este orden; la función primero, después el UPDATE):
--   SET LOCAL lock_timeout = '5s';
--   CREATE OR REPLACE FUNCTION public.cxp_subtotal_igual_total() RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
--   BEGIN
--     IF NEW."tipoOperacion" IN (4, 5, 6) AND NEW.total IS NOT NULL AND COALESCE(NEW.moneda, 'MXN') = 'MXN' THEN
--       NEW.subtotal := NEW.total;
--     END IF;
--     RETURN NEW;
--   END; $$;
--   UPDATE public.cxp SET subtotal = 0 WHERE "tipoOperacion" = 2 AND subtotal IS DISTINCT FROM 0;
-- No revierte: aprobaciones o rechazos hechos o bloqueados mientras estuvo activo, reasignaciones a Evelyn, marcas autorizadoFP, cierres a 99.
-- Los valores anteriores quedan en `auditoria`.
-- Verificación tras aplicar (debe dar 0): SELECT count(*) FROM cxp WHERE "tipoOperacion"=2 AND COALESCE(moneda,'MXN')='MXN' AND subtotal IS DISTINCT FROM total;
-- ESTADO APLICADO (2026-11-17): las 2 urgentes duplicadas (j0z0Vt7IWrW1i8l y 8yDZ3C0soB2ejVH) se cerraron antes como 99 por decisión de Jereff;
--   las otras 3 aprobadas sin pagar (KrWFq8rxf2nHaJy, PniUtM5QRN2zePI, AAvnUBE9SyRMmr6; 630,490.80) quedan CONTADAS como apartado hasta que CxP confirme;
--   las 35 urgentes en MXN quedaron con subtotal = total (incluye las cargas del 29/sep). Verificado: 0 urgentes y 0 filas de tipos 4/5/6 con subtotal distinto del total.
