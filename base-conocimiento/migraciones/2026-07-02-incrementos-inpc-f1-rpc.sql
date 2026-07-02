-- ============================================================================
-- Incrementos automáticos de renta por INPC — Fase F1 (M5)
-- RPC aplicadora ÚNICA: arrepdp_aplicar_incremento_inpc
-- Diseño: base-conocimiento/PLAN-incrementos-inpc-automaticos.md §3 M5
--
-- Puntos de diseño clave:
--  · Un plan + un año por llamada; atómica (bloque plpgsql con EXCEPTION ⇒
--    cualquier fallo revierte TODO y devuelve jsonb de error).
--  · Aplica por RANGO DE numPartida ((N−1)·12+1 … N·12), NO por `anio`
--    ⇒ inmune al gotcha del `anio` desalineado. Depósito (partida 0) fuera.
--  · Solo filas status=true y aplicaInpc=true (extraordinarios exentos).
--  · pm2 nuevo = pm2 última partida del año anterior × (1+(INPC+pts)/100),
--    POR CONCEPTO. Concepto sin base en el año anterior (financiado nuevo o
--    terminado) ⇒ se omite y se reporta.
--  · Respeta meses de gracia: el pm2 solo se escribe donde pm2 > 0 (igual que
--    la RPC manual). El INPC como dato sí se escribe en todo el año N.
--  · Años futuros: pm2 PLANO (mismo valor) e INPC=0 ⇒ LIMPIA los arrastres
--    heredados de las funciones viejas (el dato deja de mentir).
--  · Rechaza si el año N tiene partidas pagadas (TIENE_PAGOS) ⇒ el backend
--    manda ese plan a decisión manual (regla de negocio).
--  · Devuelve el snapshot `previo` (pm2/INPC por concepto×año, todo lo que
--    tocó) ⇒ arre_incrementos.detalle ⇒ reversión exacta.
--  · REVOKE de PUBLIC/anon/authenticated ⇒ SOLO service_role (el backend) la
--    puede ejecutar, a diferencia de las RPCs viejas que eran públicas.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.arrepdp_aplicar_incremento_inpc(
  p_id_arre_pdp text,
  p_anio        smallint,
  p_inpc        numeric,
  p_id_inpc     text
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_plan       record;
  v_activo     boolean;
  v_ini        int;
  v_fin        int;
  v_prev_ini   int;
  v_prev_fin   int;
  v_pagadas    int;
  v_previo     jsonb;
  v_conceptos  jsonb := '[]'::jsonb;
  v_filas      int;
  v_filas_fut  int;
  v_total      int := 0;
  r            record;
  v_pm2_base   numeric;
  v_pts        numeric;
  v_pm2_nuevo  numeric;
BEGIN
  -- ── Validaciones de entrada ────────────────────────────────────────────
  IF p_id_arre_pdp IS NULL OR trim(p_id_arre_pdp) = '' THEN
    RETURN jsonb_build_object('exito', false, 'codigo', 'PARAMETRO_INVALIDO',
      'mensaje', 'Falta el id del plan');
  END IF;
  IF p_anio IS NULL OR p_anio < 2 THEN
    RETURN jsonb_build_object('exito', false, 'codigo', 'PARAMETRO_INVALIDO',
      'mensaje', 'El año a incrementar debe ser 2 o mayor (el año 1 es la base)');
  END IF;
  IF p_inpc IS NULL OR p_inpc <= 0 OR p_inpc > 50 THEN
    RETURN jsonb_build_object('exito', false, 'codigo', 'PARAMETRO_INVALIDO',
      'mensaje', 'INPC fuera de rango razonable (0–50)');
  END IF;
  IF p_id_inpc IS NULL OR trim(p_id_inpc) = '' THEN
    RETURN jsonb_build_object('exito', false, 'codigo', 'PARAMETRO_INVALIDO',
      'mensaje', 'Falta el id del registro oficial de INPC');
  END IF;

  -- ── Plan vigente y activo ──────────────────────────────────────────────
  SELECT "idArrePdp", "idNavArrend", vigente, status INTO v_plan
  FROM public."arrePdp" WHERE "idArrePdp" = p_id_arre_pdp;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('exito', false, 'codigo', 'PLAN_NO_EXISTE',
      'mensaje', 'El plan no existe');
  END IF;
  IF v_plan.status IS NOT TRUE OR v_plan.vigente IS NOT TRUE THEN
    RETURN jsonb_build_object('exito', false, 'codigo', 'PLAN_NO_VIGENTE',
      'mensaje', 'El plan no está vigente');
  END IF;

  SELECT ap."pdpActivo" INTO v_activo
  FROM public."arrenPropiedades" ap
  WHERE ap."idNavArrend" = v_plan."idNavArrend" AND ap.status = true
  LIMIT 1;
  IF v_activo IS NOT TRUE THEN
    RETURN jsonb_build_object('exito', false, 'codigo', 'PLAN_NO_ACTIVO',
      'mensaje', 'El plan no está activo (pdpActivo=false)');
  END IF;

  -- ── Rango de partidas del año N (inmune al gotcha del anio) ───────────
  v_ini      := (p_anio::int - 1) * 12 + 1;
  v_fin      := p_anio::int * 12;
  v_prev_ini := (p_anio::int - 2) * 12 + 1;
  v_prev_fin := (p_anio::int - 1) * 12;

  IF NOT EXISTS (
    SELECT 1 FROM public."arrePdpDetalle"
    WHERE "idArrePdp" = p_id_arre_pdp AND status = true
      AND "numPartida" BETWEEN v_ini AND v_fin
  ) THEN
    RETURN jsonb_build_object('exito', false, 'codigo', 'ANIO_SIN_PARTIDAS',
      'mensaje', format('El plan no tiene partidas para el año %s', p_anio));
  END IF;

  -- ── Regla de negocio: cero dinero cobrado en el año N ─────────────────
  SELECT count(*) INTO v_pagadas
  FROM public."arrePdpDetalle"
  WHERE "idArrePdp" = p_id_arre_pdp AND status = true
    AND "numPartida" BETWEEN v_ini AND v_fin
    AND ("fecPago" IS NOT NULL OR coalesce("cantidadAplicada", 0) > 0);
  IF v_pagadas > 0 THEN
    RETURN jsonb_build_object('exito', false, 'codigo', 'TIENE_PAGOS',
      'mensaje', format('El año %s tiene %s partida(s) con pago aplicado; requiere decisión manual', p_anio, v_pagadas),
      'partidasPagadas', v_pagadas);
  END IF;

  -- ── Snapshot previo (todo lo que se tocará: partidas >= v_ini) ────────
  SELECT jsonb_agg(to_jsonb(x)) INTO v_previo FROM (
    SELECT concepto,
           ((("numPartida" - 1) / 12) + 1)::int AS anio,
           max(pm2)    AS pm2,
           max("INPC") AS inpc
    FROM public."arrePdpDetalle"
    WHERE "idArrePdp" = p_id_arre_pdp AND status = true AND "aplicaInpc" = true
      AND "numPartida" >= v_ini
    GROUP BY concepto, ((("numPartida" - 1) / 12) + 1)::int
    ORDER BY concepto, 2
  ) x;

  -- ── Aplicación por concepto ────────────────────────────────────────────
  FOR r IN
    SELECT DISTINCT concepto
    FROM public."arrePdpDetalle"
    WHERE "idArrePdp" = p_id_arre_pdp AND status = true AND "aplicaInpc" = true
      AND "numPartida" BETWEEN v_ini AND v_fin
    ORDER BY concepto
  LOOP
    -- Base: pm2 de la última partida del año anterior con ese concepto
    SELECT pm2 INTO v_pm2_base
    FROM public."arrePdpDetalle"
    WHERE "idArrePdp" = p_id_arre_pdp AND status = true
      AND concepto = r.concepto
      AND "numPartida" BETWEEN v_prev_ini AND v_prev_fin
      AND pm2 > 0
    ORDER BY "numPartida" DESC
    LIMIT 1;

    IF v_pm2_base IS NULL THEN
      v_conceptos := v_conceptos || jsonb_build_object(
        'concepto', r.concepto, 'omitido', true,
        'motivo', 'Sin pm2 base en el año anterior');
      CONTINUE;
    END IF;

    SELECT coalesce(max("ptsINPC"), 0) INTO v_pts
    FROM public."arrePdpDetalle"
    WHERE "idArrePdp" = p_id_arre_pdp AND status = true
      AND concepto = r.concepto
      AND "numPartida" BETWEEN v_ini AND v_fin;

    v_pm2_nuevo := v_pm2_base * (1 + (p_inpc + v_pts) / 100);

    -- Año N: INPC en todas las filas del concepto; pm2 solo donde pm2>0
    -- (respeta meses de gracia, igual que la RPC manual)
    UPDATE public."arrePdpDetalle"
    SET "INPC" = p_inpc,
        pm2    = CASE WHEN pm2 > 0 THEN v_pm2_nuevo ELSE pm2 END
    WHERE "idArrePdp" = p_id_arre_pdp AND status = true AND "aplicaInpc" = true
      AND concepto = r.concepto
      AND "numPartida" BETWEEN v_ini AND v_fin;
    GET DIAGNOSTICS v_filas = ROW_COUNT;

    -- Años futuros: pm2 PLANO donde pm2>0, e INPC=0 (limpia arrastres)
    UPDATE public."arrePdpDetalle"
    SET pm2    = CASE WHEN pm2 > 0 THEN v_pm2_nuevo ELSE pm2 END,
        "INPC" = 0
    WHERE "idArrePdp" = p_id_arre_pdp AND status = true AND "aplicaInpc" = true
      AND concepto = r.concepto
      AND "numPartida" > v_fin;
    GET DIAGNOSTICS v_filas_fut = ROW_COUNT;

    v_total := v_total + v_filas + v_filas_fut;
    v_conceptos := v_conceptos || jsonb_build_object(
      'concepto',     r.concepto,
      'pm2Base',      v_pm2_base,
      'pts',          v_pts,
      'pm2Nuevo',     v_pm2_nuevo,
      'filasAnio',    v_filas,
      'filasFuturas', v_filas_fut);
  END LOOP;

  IF v_total = 0 THEN
    RETURN jsonb_build_object('exito', false, 'codigo', 'SIN_CONCEPTOS',
      'mensaje', 'Ningún concepto incrementable en el año indicado',
      'conceptos', v_conceptos);
  END IF;

  RETURN jsonb_build_object(
    'exito',             true,
    'codigo',            'APLICADO',
    'anio',              p_anio,
    'inpc',              p_inpc,
    'idInpc',            p_id_inpc,
    'rango',             jsonb_build_array(v_ini, v_fin),
    'conceptos',         v_conceptos,
    'previo',            coalesce(v_previo, '[]'::jsonb),
    'filasActualizadas', v_total);

EXCEPTION
  WHEN OTHERS THEN
    -- El bloque con EXCEPTION revierte TODOS los cambios de esta llamada
    RETURN jsonb_build_object('exito', false, 'codigo', 'ERROR_INTERNO',
      'mensaje', 'Error interno: ' || SQLERRM, 'sqlstate', SQLSTATE);
END;
$$;

COMMENT ON FUNCTION public.arrepdp_aplicar_incremento_inpc(text, smallint, numeric, text) IS
  'Aplica el incremento anual INPC+pts a UN plan de renta para UN año (por rango de numPartida, solo filas aplicaInpc=true, plano hacia años futuros limpiando arrastres). Devuelve snapshot para arre_incrementos. Solo ejecutable por service_role (backend v2). Diseño: PLAN-incrementos-inpc-automaticos.md';

-- Solo el backend (service_role) puede ejecutarla
REVOKE EXECUTE ON FUNCTION public.arrepdp_aplicar_incremento_inpc(text, smallint, numeric, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.arrepdp_aplicar_incremento_inpc(text, smallint, numeric, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.arrepdp_aplicar_incremento_inpc(text, smallint, numeric, text) FROM authenticated;

-- ============================================================================
-- RPC de REVERSIÓN: arrepdp_revertir_incremento_inpc
-- Restaura pm2/INPC por concepto×año desde el snapshot `previo` guardado en
-- arre_incrementos.detalle. Atómica; rechaza si hay pagos desde el año a
-- revertir; jamás toca años < p_anio ni filas de meses de gracia (pm2=0).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.arrepdp_revertir_incremento_inpc(
  p_id_arre_pdp text,
  p_anio        smallint,
  p_previo      jsonb
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_ini     int;
  v_pagadas int;
  v_filas   int := 0;
  v_total   int := 0;
  r         record;
BEGIN
  IF p_id_arre_pdp IS NULL OR trim(p_id_arre_pdp) = '' THEN
    RETURN jsonb_build_object('exito', false, 'codigo', 'PARAMETRO_INVALIDO',
      'mensaje', 'Falta el id del plan');
  END IF;
  IF p_anio IS NULL OR p_anio < 2 THEN
    RETURN jsonb_build_object('exito', false, 'codigo', 'PARAMETRO_INVALIDO',
      'mensaje', 'El año a revertir debe ser 2 o mayor');
  END IF;
  IF p_previo IS NULL OR jsonb_typeof(p_previo) <> 'array' OR jsonb_array_length(p_previo) = 0 THEN
    RETURN jsonb_build_object('exito', false, 'codigo', 'PARAMETRO_INVALIDO',
      'mensaje', 'El snapshot previo está vacío; no se puede revertir automáticamente');
  END IF;

  v_ini := (p_anio::int - 1) * 12 + 1;

  -- Nada de dinero cobrado desde el año a revertir en adelante
  SELECT count(*) INTO v_pagadas
  FROM public."arrePdpDetalle"
  WHERE "idArrePdp" = p_id_arre_pdp AND status = true
    AND "numPartida" >= v_ini
    AND ("fecPago" IS NOT NULL OR coalesce("cantidadAplicada", 0) > 0);
  IF v_pagadas > 0 THEN
    RETURN jsonb_build_object('exito', false, 'codigo', 'TIENE_PAGOS',
      'mensaje', format('Hay %s partida(s) con pago aplicado desde el año %s; la reversión requiere revisión manual', v_pagadas, p_anio));
  END IF;

  FOR r IN
    SELECT (e->>'concepto')::text  AS concepto,
           (e->>'anio')::int       AS anio,
           (e->>'pm2')::numeric    AS pm2,
           (e->>'inpc')::numeric   AS inpc
    FROM jsonb_array_elements(p_previo) e
  LOOP
    -- El snapshot solo debe traer años >= p_anio; jamás tocar hacia atrás
    IF r.concepto IS NULL OR r.anio IS NULL OR r.anio < p_anio THEN
      CONTINUE;
    END IF;
    UPDATE public."arrePdpDetalle"
    SET pm2    = CASE WHEN pm2 > 0 THEN coalesce(r.pm2, pm2) ELSE pm2 END,
        "INPC" = coalesce(r.inpc, "INPC")
    WHERE "idArrePdp" = p_id_arre_pdp AND status = true AND "aplicaInpc" = true
      AND concepto = r.concepto
      AND "numPartida" BETWEEN (r.anio - 1) * 12 + 1 AND r.anio * 12;
    GET DIAGNOSTICS v_filas = ROW_COUNT;
    v_total := v_total + v_filas;
  END LOOP;

  IF v_total = 0 THEN
    RETURN jsonb_build_object('exito', false, 'codigo', 'SIN_FILAS',
      'mensaje', 'El snapshot no coincidió con ninguna fila del plan');
  END IF;

  RETURN jsonb_build_object('exito', true, 'codigo', 'REVERTIDO',
    'filasActualizadas', v_total);

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('exito', false, 'codigo', 'ERROR_INTERNO',
      'mensaje', 'Error interno: ' || SQLERRM, 'sqlstate', SQLSTATE);
END;
$$;

COMMENT ON FUNCTION public.arrepdp_revertir_incremento_inpc(text, smallint, jsonb) IS
  'Revierte un incremento INPC restaurando pm2/INPC desde el snapshot previo de arre_incrementos.detalle (por concepto×año, rango de numPartida, solo aplicaInpc=true, respeta meses de gracia). Rechaza si hay pagos desde el año revertido. Solo service_role.';

REVOKE EXECUTE ON FUNCTION public.arrepdp_revertir_incremento_inpc(text, smallint, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.arrepdp_revertir_incremento_inpc(text, smallint, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.arrepdp_revertir_incremento_inpc(text, smallint, jsonb) FROM authenticated;
