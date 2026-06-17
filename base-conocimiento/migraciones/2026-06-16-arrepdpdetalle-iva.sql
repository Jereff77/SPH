-- ============================================================================
-- 2026-06-16 · IVA en la corrida de arrendatarios (arrePdpDetalle)
-- ----------------------------------------------------------------------------
-- Contexto: en "Arrendatarios · Gestión de Pagos" los montos se mostraban SIN IVA,
-- pero las transferencias bancarias (MXN y USD) llegan CON IVA (16%), por lo que la
-- aplicación de pagos nunca cuadraba ("Exacto"). Se persiste el monto de IVA por
-- partida y se muestra el total con IVA en la pantalla.
--
-- Tabla COMPARTIDA con v1 (Flutter). Cambios ADITIVOS (columna física + objetos v2_),
-- autorizados por el usuario (caso por caso, regla #1). Aplicado vía MCP supaSPH como
-- migración `v2_arrepdpdetalle_iva` + backfill sin auditar.
--
-- Regla de negocio: IVA del 16% a TODOS los conceptos EXCEPTO "Deposito Garantia".
-- Tasa tomada de catParametros (idCorto='iva', valor=0.16). Aplica igual a MXN y USD.
-- ============================================================================

-- 1) Columna física: monto de IVA por partida. Default constante 0 → ALTER rápido.
ALTER TABLE public."arrePdpDetalle"
  ADD COLUMN IF NOT EXISTS iva numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public."arrePdpDetalle".iva IS
  'Monto de IVA de la partida (v2) = round(cantidad*tasa,2); tasa de catParametros(idCorto=''iva''); 0 para Deposito Garantia. La mantiene el trigger v2_arrepdpdetalle_calc_iva.';

-- 2) Función. OJO: `cantidad` es columna GENERADA (pm2*constM2) y NO está disponible
--    en triggers BEFORE → se replica su fórmula con los componentes pm2 * constM2.
CREATE OR REPLACE FUNCTION public.v2_arrepdpdetalle_calc_iva()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_tasa numeric;
BEGIN
  SELECT cp.valor::numeric INTO v_tasa
  FROM public."catParametros" cp
  WHERE cp."idCorto" = 'iva' AND cp.status = true
  ORDER BY cp."fechaIni" DESC NULLS LAST
  LIMIT 1;
  v_tasa := COALESCE(v_tasa, 0.16);

  IF translate(lower(btrim(COALESCE(NEW.concepto, ''))), 'áéíóú', 'aeiou') LIKE 'deposito%garantia%' THEN
    NEW.iva := 0;
  ELSE
    NEW.iva := round(COALESCE(NEW.pm2, 0) * COALESCE(NEW."constM2", 0) * v_tasa, 2);
  END IF;

  RETURN NEW;
END;
$$;

-- 3) Triggers BEFORE: INSERT siempre; UPDATE solo si cambian pm2/constM2/concepto
--    (los crons de v1 que tocan anio/ciclo/fecPago NO lo disparan; el de INPC sí,
--    porque cambia pm2 → recalcula el IVA, que es lo correcto).
DROP TRIGGER IF EXISTS trg_v2_iva_ins ON public."arrePdpDetalle";
CREATE TRIGGER trg_v2_iva_ins
  BEFORE INSERT ON public."arrePdpDetalle"
  FOR EACH ROW EXECUTE FUNCTION public.v2_arrepdpdetalle_calc_iva();

DROP TRIGGER IF EXISTS trg_v2_iva_upd ON public."arrePdpDetalle";
CREATE TRIGGER trg_v2_iva_upd
  BEFORE UPDATE OF pm2, "constM2", concepto ON public."arrePdpDetalle"
  FOR EACH ROW EXECUTE FUNCTION public.v2_arrepdpdetalle_calc_iva();

-- 4) Backfill de las filas existentes (30,409). Se envuelve en una transacción con
--    DISABLE/ENABLE de trg_auditoria para NO generar ~30k registros de auditoría por
--    un poblado técnico. El DISABLE toma ACCESS EXCLUSIVE LOCK, así que v1 no puede
--    escribir sin auditar durante la ventana (queda en espera hasta el COMMIT).
BEGIN;
ALTER TABLE public."arrePdpDetalle" DISABLE TRIGGER trg_auditoria;

UPDATE public."arrePdpDetalle" ad SET iva = CASE
  WHEN translate(lower(btrim(COALESCE(ad.concepto,''))),'áéíóú','aeiou') LIKE 'deposito%garantia%' THEN 0
  ELSE round(COALESCE(ad.pm2,0) * COALESCE(ad."constM2",0)
       * COALESCE((SELECT cp.valor::numeric FROM public."catParametros" cp
            WHERE cp."idCorto"='iva' AND cp.status=true
            ORDER BY cp."fechaIni" DESC NULLS LAST LIMIT 1), 0.16), 2)
END
WHERE ad.iva = 0;  -- solo filas aún sin poblar (todas arrancan en 0)

ALTER TABLE public."arrePdpDetalle" ENABLE TRIGGER trg_auditoria;
COMMIT;

-- Verificación: 30,409 filas, 0 inconsistentes; depósitos con iva=0.
-- Tras el ALTER se regeneró packages/types/src/database.types.ts (columna iva).
