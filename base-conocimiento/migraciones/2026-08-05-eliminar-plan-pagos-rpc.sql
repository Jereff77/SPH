-- Migración: eliminar_plan_pagos_rpc (2026-08-05)
-- RPC transaccional para eliminar el Plan de Pagos COMPLETO de una propiedad.
-- Contexto: usuarios borraban todas las partidas creyendo que así eliminaban el
-- plan, dejando planes "cascarón" ($0.00, 0 partidas) que bloquean desvincular
-- la nave o crear un PDP nuevo. Ahora la última partida no se puede borrar
-- (candado en el API) y el plan completo se elimina con esta acción explícita.
--
-- Guardas (revalidadas con la fila de `propiedades` bloqueada FOR UPDATE):
--   1. La propiedad existe y tiene plan (idPdp).
--   2. El plan está DESACTIVADO (propiedades."pdpActivo" = false).
--   3. NINGÚN pago (vivo o cancelado) referencia el plan ni sus partidas: un
--      pago cancelado es histórico a conservar y además la FK de `pagos`
--      (NO ACTION) bloquearía el DELETE — la FK es la red final ante carreras.
-- Efecto: UPDATE propiedades (idPdp=null, tienenPdp=false, pdpActivo=false) +
-- DELETE pdp (el CASCADE de pdpDetalle.idPdp borra las partidas), todo en una
-- transacción. trg_auditoria (DELETE incluido en pdp/pdpDetalle/propiedades)
-- registra al actor del JWT porque el API la invoca con `comoActor`.

CREATE OR REPLACE FUNCTION public.eliminar_plan_pagos(p_id_propiedad text)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_prop  public.propiedades%ROWTYPE;
  v_pagos integer;
BEGIN
  SELECT * INTO v_prop
    FROM public.propiedades
   WHERE "idPropiedad" = p_id_propiedad
   FOR UPDATE;

  IF v_prop."idPropiedad" IS NULL THEN RAISE EXCEPTION 'PROPIEDAD_NO_ENCONTRADA'; END IF;
  IF v_prop."idPdp" IS NULL THEN RAISE EXCEPTION 'SIN_PLAN'; END IF;
  IF v_prop."pdpActivo" IS TRUE THEN RAISE EXCEPTION 'PLAN_ACTIVO'; END IF;

  -- Cualquier pago (sin filtrar status) que referencie el plan o sus partidas
  -- impide eliminar: el historial financiero se conserva.
  SELECT COUNT(*) INTO v_pagos
    FROM public.pagos pg
   WHERE pg."idPdp" = v_prop."idPdp"
      OR pg."idPdpDet" IN (
           SELECT d."idPdpDet" FROM public."pdpDetalle" d WHERE d."idPdp" = v_prop."idPdp"
         );
  IF v_pagos > 0 THEN RAISE EXCEPTION 'CON_PAGOS'; END IF;

  -- Liberar la propiedad y borrar el plan (CASCADE elimina las partidas).
  UPDATE public.propiedades
     SET "idPdp" = NULL,
         "tienenPdp" = false,
         "pdpActivo" = false
   WHERE "idPropiedad" = p_id_propiedad;

  DELETE FROM public.pdp WHERE "idPdp" = v_prop."idPdp";
END;
$$;

COMMENT ON FUNCTION public.eliminar_plan_pagos(text) IS
  'Elimina el Plan de Pagos completo de una propiedad (solo plan desactivado y sin ningún pago, vivo o cancelado). Libera la propiedad (idPdp=null, banderas en false) para desvincular la nave o crear un PDP nuevo. Transaccional con FOR UPDATE; errores por código: PROPIEDAD_NO_ENCONTRADA / SIN_PLAN / PLAN_ACTIVO / CON_PAGOS.';

-- Endurecimiento (migración aparte `eliminar_plan_pagos_revoke`, hallazgo MEDIA
-- del validador adversarial): la función nace con EXECUTE abierto (default de
-- Postgres para PUBLIC). Se alinea con su hermana trasladar_saldo_pdp: solo el
-- backend (service_role vía comoActor) puede ejecutarla.
REVOKE ALL ON FUNCTION public.eliminar_plan_pagos(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eliminar_plan_pagos(text) TO service_role;
