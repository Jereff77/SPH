-- =============================================================================
-- Migración v2: Cancelación Anticipada de contratos de arrendamiento
-- Fecha: 2026-06-10
-- Módulo: Arrendatarios → Planes de Renta
--
-- ⚠️ REQUIERE AUTORIZACIÓN EXPLÍCITA DEL USUARIO (regla 1 del HANDOFF).
--    Todo es ADITIVO: columnas nuevas + permisos nuevos + una función v2_ nueva.
--    NO se elimina ni se altera ninguna lógica del sistema viejo (v1/Flutter).
--
-- Aplicar en orden A → B → C. Después regenerar tipos:
--   supabase gen types ... > packages/types/src/database.types.ts
--   pnpm --filter @erp/types build
-- =============================================================================


-- -----------------------------------------------------------------------------
-- A) Columnas nuevas en arrePdp (tabla compartida con v1).
--    NULL / DEFAULT false ⇒ Flutter las ignora; no rompe nada existente.
--    arrePdp ya tiene trg_auditoria ⇒ los cambios se auditan solos.
-- -----------------------------------------------------------------------------
ALTER TABLE public."arrePdp"
  ADD COLUMN IF NOT EXISTS "canceladoAnticipado" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "fecCancelacion"      date,
  ADD COLUMN IF NOT EXISTS "canceladoPor"        uuid,
  ADD COLUMN IF NOT EXISTS "motivoCancelacion"   text;

COMMENT ON COLUMN public."arrePdp"."canceladoAnticipado" IS 'v2: contrato terminado por cancelación anticipada.';
COMMENT ON COLUMN public."arrePdp"."fecCancelacion"      IS 'v2: fin efectivo del contrato cancelado (fecha de la partida de corte).';
COMMENT ON COLUMN public."arrePdp"."canceladoPor"        IS 'v2: uid del usuario que canceló.';
COMMENT ON COLUMN public."arrePdp"."motivoCancelacion"   IS 'v2: motivo de la cancelación (texto libre).';


-- -----------------------------------------------------------------------------
-- B) Claves de permiso nuevas en segModulos.
--    22 (Cancelacion) y 23 (Renovar) YA existen; aquí se agregan 24 y 25.
--    idsegModulos/fc tienen default (gen_random_uuid()/now()).
--    La sección Reportes NO usa permiso nuevo: se gatea con la clave 20.
-- -----------------------------------------------------------------------------
INSERT INTO public."segModulos" (modulo, seccion, area, clave) VALUES
  ('Arrendatarios', 'Planes de Renta', 'Liberar',       24),
  ('Arrendatarios', 'Planes de Renta', 'Configuracion', 25);


-- -----------------------------------------------------------------------------
-- C) RPC transaccional nueva: v2_arrepdp_cancelar_anticipado
--    Atómica (toca 4 tablas). Patrón idéntico a v2_arrepdp_renovar.
--    Se invoca con comoActor(uid) ⇒ trg_auditoria captura al actor.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.v2_arrepdp_cancelar_anticipado(
  p_id_arre_pdp       text,
  p_uid               uuid,
  p_num_partida_corte integer,
  p_motivo            text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_plan        public."arrePdp"%ROWTYPE;
  v_pdp_activo  boolean;
  v_id_nave     text;
  v_max_pagada  integer;
  v_fec_corte   date;
  v_afectadas   integer;
BEGIN
  -- Plan existe y no está vencido.
  SELECT * INTO v_plan FROM public."arrePdp" WHERE "idArrePdp" = p_id_arre_pdp AND status = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('exito', false, 'mensaje', 'Plan no encontrado.');
  END IF;
  IF v_plan."arrePdpVigente" = 'No' THEN
    RETURN jsonb_build_object('exito', false, 'mensaje', 'El plan no está vigente.');
  END IF;

  -- El plan debe estar activo (pdpActivo) en su vínculo de propiedad.
  SELECT arp."pdpActivo", arp."idNave" INTO v_pdp_activo, v_id_nave
  FROM public."arrenPropiedades" arp
  WHERE arp."idNavArrend" = v_plan."idNavArrend" AND arp.status = true;
  IF v_pdp_activo IS NOT TRUE THEN
    RETURN jsonb_build_object('exito', false, 'mensaje', 'El plan no está activo.');
  END IF;

  -- No cancelar meses ya pagados: el corte debe ser posterior al último mes con pago.
  SELECT COALESCE(max("numPartida"), 0) INTO v_max_pagada
  FROM public."arrePdpDetalle"
  WHERE "idArrePdp" = p_id_arre_pdp AND status = true AND "fecPago" IS NOT NULL;
  IF p_num_partida_corte <= v_max_pagada THEN
    RETURN jsonb_build_object('exito', false, 'mensaje',
      format('No se puede cortar en/antes de un mes ya pagado (último pagado: partida %s).', v_max_pagada));
  END IF;

  -- Fin efectivo = fecha de la partida de corte (desde la que ya no se cobra).
  SELECT min(fecha::date) INTO v_fec_corte
  FROM public."arrePdpDetalle"
  WHERE "idArrePdp" = p_id_arre_pdp AND "numPartida" = p_num_partida_corte AND status = true;

  -- 1) Baja lógica de las partidas X en adelante.
  UPDATE public."arrePdpDetalle"
  SET status = false
  WHERE "idArrePdp" = p_id_arre_pdp AND status = true AND "numPartida" >= p_num_partida_corte;
  GET DIAGNOSTICS v_afectadas = ROW_COUNT;
  IF v_afectadas = 0 THEN
    RETURN jsonb_build_object('exito', false, 'mensaje', 'No hay meses para cancelar desde la partida indicada.');
  END IF;

  -- 2) Marca de cancelación en la cabecera + vigente=false (estable ante el cron de vigencia).
  UPDATE public."arrePdp"
  SET "canceladoAnticipado" = true,
      "fecCancelacion"      = v_fec_corte,
      "canceladoPor"        = p_uid,
      "motivoCancelacion"   = p_motivo,
      vigente               = false
  WHERE "idArrePdp" = p_id_arre_pdp;

  -- 3) Liberar la nave (igual que liberarNave; aquí el plan estaba activo).
  UPDATE public."arrenPropiedades"
  SET status = false, "tienePdp" = false, "pdpActivo" = false, "pdpVigente" = false, "idArrePdp" = NULL
  WHERE "idNavArrend" = v_plan."idNavArrend";
  IF v_id_nave IS NOT NULL THEN
    UPDATE public.naves SET "Arrendada" = false WHERE "idNave" = v_id_nave;
  END IF;

  RETURN jsonb_build_object(
    'exito', true,
    'mensaje', 'Contrato cancelado y nave liberada.',
    'detalles', jsonb_build_object(
      'id_plan', p_id_arre_pdp,
      'fec_cancelacion', v_fec_corte,
      'partidas_canceladas', v_afectadas
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.v2_arrepdp_cancelar_anticipado(text, uuid, integer, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_arrepdp_cancelar_anticipado(text, uuid, integer, text) TO service_role;
