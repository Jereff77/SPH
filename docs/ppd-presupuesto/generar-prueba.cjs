// Genera, a partir de los bloques de migracion.sql y migracion-m4-funcion-aprobacion.sql:
//   - prueba-en-seco.sql        (un DO que termina en RAISE EXCEPTION: no queda nada en la base)
//   - aplicar.sql               (los 4 pasos en UNA transacción, con verificaciones que abortan antes del COMMIT)
//   - reversa-vistas.sql / reversa-funcion-aprobacion.sql (la prueba en seco verifica que revierten a lo anterior)
const fs = require('fs');
const dir = __dirname + '/';
const mig = fs.readFileSync(dir + 'migracion.sql', 'utf8');
const m4 = fs.readFileSync(dir + 'migracion-m4-funcion-aprobacion.sql', 'utf8');

function entre(texto, ini, fin, incluirFin = true) {
  const i = texto.indexOf(ini);
  if (i < 0) throw new Error('inicio no encontrado: ' + ini.slice(0, 60));
  const j = texto.indexOf(fin, i + ini.length);
  if (j < 0) throw new Error('fin no encontrado: ' + fin.slice(0, 60));
  return texto.slice(i, j + (incluirFin ? fin.length : 0));
}
const seccion = (marca) => entre(mig, `-- >>> ${marca}\n`, `-- <<< ${marca}\n`, false).replace(`-- >>> ${marca}\n`, '');

const M1 = seccion('M1').trim();
const M2sec = seccion('M2');
const M2a = entre(M2sec, '-- (a) Pagadas en pesos', 'COALESCE(subtotal, 0) = 0;').replace(/^--.*\n/gm, '');
const M2b = entre(M2sec, '-- (b) No pagadas', 'OR status IS NOT TRUE);').replace(/^--.*\n/gm, '');
const M3sec = seccion('M3');
const M3a = entre(M3sec, 'CREATE OR REPLACE VIEW public."v_resumenPresupuesto" WITH (security_invoker = on) AS', 'END) DESC;').replace(/;$/, '');
const M3b = entre(M3sec, 'CREATE OR REPLACE VIEW public.v_resumenpresupuesto WITH (security_invoker = on) AS', 'SELECT * FROM public."v_resumenPresupuesto";').replace(/;$/, '');
const M4 = entre(m4, 'CREATE OR REPLACE FUNCTION public.cxp_autorizar_solicitud_pago', '$function$;').replace(/;$/, '');
// Copia de prueba de la función: mismo cuerpo, sin ROLLBACK/COMMIT (no se pueden ejecutar dentro de un DO) y con otro nombre.
const M4T = M4.replace('public.cxp_autorizar_solicitud_pago(', 'public.cxp_autorizar_solicitud_pago_t(').replace(/^\s*(ROLLBACK|COMMIT);\s*$/gm, '');

// ---- Reversas derivadas de las mismas piezas ----
function revertirVista(vista) {
  let t = vista;
  const i1 = t.indexOf('), ppd_primera AS (');
  const j1 = t.indexOf('), gastos_comprometidos_total_base AS (');
  if (i1 < 0 || j1 < 0) throw new Error('reversa vista 1');
  t = t.slice(0, i1) + t.slice(j1);
  t = t.replace('gastos_aprobados_base AS (', 'gastos_aprobados AS (');
  const i2 = t.indexOf('), gastos_comprometidos_total AS (');
  const j2 = t.indexOf('), todas_categorias AS (');
  if (i2 < 0 || j2 < 0) throw new Error('reversa vista 2');
  t = t.slice(0, i2) + t.slice(j2);
  t = t.replace('gastos_comprometidos_total_base AS (', 'gastos_comprometidos_total AS (');
  return t;
}
const REV_V_MAIN = revertirVista(M3a);
const cuerpo = REV_V_MAIN.slice(REV_V_MAIN.indexOf(' AS\n') + 4);
const REV_V_TWIN = 'CREATE OR REPLACE VIEW public.v_resumenpresupuesto WITH (security_invoker = on) AS\n' + cuerpo;

function revertirFuncion(f) {
  let t = f;
  for (const l of ['    v_idcxpppd TEXT;                -- PPD\n', '    v_moneda TEXT;                  -- PPD\n', '    v_ya_apartada BOOLEAN := FALSE; -- PPD\n']) {
    if (!t.includes(l)) throw new Error('reversa fn decl');
    t = t.replace(l, '');
  }
  const a1 = 'SELECT "idCategoria", subtotal, "idEstado", "idCxpPPD", moneda';
  const a2 = 'INTO v_idcategoria, v_subtotal, v_estado_actual, v_idcxpppd, v_moneda;';
  if (!t.includes(a1) || !t.includes(a2)) throw new Error('reversa fn cursor');
  t = t.replace(a1, 'SELECT "idCategoria", subtotal, "idEstado"').replace(a2, 'INTO v_idcategoria, v_subtotal, v_estado_actual;');
  const a = t.indexOf('        -- 6 bis. PPD');
  const b = t.indexOf('        -- 7. Aplicar validación');
  if (a < 0 || b < 0) throw new Error('reversa fn bloque');
  t = t.slice(0, a) + t.slice(b);
  t = t.replace(' (PPD: 2026-11-17)', '').replace(' + cxp.subtotal (PPD: base de la factura)', ' + cxp.subtotal');
  return t;
}
const REV_F = revertirFuncion(M4);

// ---- Verificaciones que abortan la transacción (aplicar.sql) ----
const VERIF = `DO $v$
BEGIN
  IF (SELECT count(*) FROM public.cxp c WHERE c."idCxpPPD" IS NOT NULL AND c.status IS TRUE AND c."idEstado" = 6 AND COALESCE(c.moneda,'MXN') = 'MXN' AND COALESCE(c.subtotal,0) = 0
        AND EXISTS (SELECT 1 FROM public.cxp_ppd m WHERE m."idCxpPPD" = c."idCxpPPD" AND m.subtotal > 0)) <> 0 THEN
    RAISE EXCEPTION 'VERIFICACION: quedaron parcialidades PPD pagadas sin subtotal';
  END IF;
  IF (SELECT count(*) FROM public.cxp c WHERE c."idCxpPPD" IS NOT NULL AND COALESCE(c.moneda,'MXN') = 'MXN' AND c.subtotal IS NOT NULL AND (c."idEstado" <> 6 OR c.status IS NOT TRUE)
        AND EXISTS (SELECT 1 FROM public.cxp_ppd m WHERE m."idCxpPPD" = c."idCxpPPD" AND m.subtotal > 0)) <> 0 THEN
    RAISE EXCEPTION 'VERIFICACION: quedaron parcialidades PPD no pagadas con subtotal';
  END IF;
  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'v_resumenPresupuesto') <> 26 THEN
    RAISE EXCEPTION 'VERIFICACION: la vista cambió de número de columnas';
  END IF;
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname IN ('v_resumenPresupuesto','v_resumenpresupuesto') AND COALESCE(c.reloptions::text,'') LIKE '%security_invoker=on%') <> 2 THEN
    RAISE EXCEPTION 'VERIFICACION: una vista perdió security_invoker';
  END IF;
  IF (SELECT count(*) FROM (SELECT * FROM public.v_resumenpresupuesto EXCEPT SELECT * FROM public."v_resumenPresupuesto") x) <> 0 THEN
    RAISE EXCEPTION 'VERIFICACION: las dos vistas difieren';
  END IF;
END
$v$;`;

fs.writeFileSync(
  dir + 'aplicar.sql',
  `-- APLICAR (los 4 pasos en UNA transacción; si una verificación falla, no queda nada). NO aplicado. Generado por generar-prueba.cjs.
-- Aplicar FUERA del horario de captura y desplegar el código (API y web) enseguida.
SET LOCAL lock_timeout = '5s';

${M1}

${M2a}

${M2b}

${M3a};

${M3b};

${M4};

${VERIF}
`,
);
fs.writeFileSync(
  dir + 'reversa-vistas.sql',
  `-- REVERSA de M-PPD-3: restaura las dos vistas de presupuesto (con security_invoker=on) a su definición anterior.
-- Generada por generar-prueba.cjs; la prueba en seco verifica que, tras revertir, el md5 de pg_get_viewdef coincide con el de antes.
-- Orden: primero la principal, luego la copia en minúsculas.
SET LOCAL lock_timeout = '5s';

${REV_V_MAIN};

${REV_V_TWIN};
`,
);
fs.writeFileSync(
  dir + 'reversa-funcion-aprobacion.sql',
  `-- REVERSA de M-PPD-4: restaura cxp_autorizar_solicitud_pago a su definición anterior (sin el bloque PPD).
-- Generada por generar-prueba.cjs; la prueba en seco verifica que coincide con la definición anterior (salvo espacios).
SET LOCAL lock_timeout = '5s';

${REV_F};
`,
);

const sql = `-- PRUEBA EN SECO (todo dentro de un DO que termina en RAISE EXCEPTION: no queda nada en la base).
DO $do$
DECLARE
  res jsonb := '{}'::jsonb;
  cols text; colsm text;
  n int; n2 int;
  r public.cxp%ROWTYPE; mr public.cxp_ppd%ROWTYPE;
  ids text[] := '{}'; idp text; idp2 text; v_cat text;
  g0 double precision; c0 double precision; g1 double precision; c1 double precision;
  s1 double precision; s2 double precision; s3 double precision; s4 double precision;
  ok boolean; msg text; i int; v_aut uuid; f_antes text; f_reversa text;
BEGIN
  -- ===== 0. Antes =====
  CREATE TEMP TABLE v_antes ON COMMIT DROP AS SELECT * FROM public."v_resumenPresupuesto";
  CREATE TEMP TABLE v_meta_antes ON COMMIT DROP AS SELECT c.relname, c.reloptions::text AS opciones, c.relacl::text AS acl, md5(pg_get_viewdef(c.oid, true)) AS md5def FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname IN ('v_resumenPresupuesto', 'v_resumenpresupuesto');
  SELECT regexp_replace(pg_get_functiondef('public.cxp_autorizar_solicitud_pago(text,text,uuid,uuid)'::regprocedure), '\\s+', '', 'g') INTO f_antes;
  res := res || jsonb_build_object(
    'columnas_vista_antes', (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='v_resumenPresupuesto'),
    'ppd_pagadas_sin_subtotal_antes', (SELECT count(*) FROM public.cxp WHERE "idCxpPPD" IS NOT NULL AND status IS TRUE AND "idEstado"=6 AND COALESCE(moneda,'MXN')='MXN' AND COALESCE(subtotal,0)=0),
    'ppd_no_pagadas_con_subtotal_antes', (SELECT count(*) FROM public.cxp WHERE "idCxpPPD" IS NOT NULL AND COALESCE(moneda,'MXN')='MXN' AND subtotal IS NOT NULL AND ("idEstado"<>6 OR status IS NOT TRUE)));

  -- ===== M-PPD-1: función, trigger, índice y guarda =====
  EXECUTE $m1$${M1}$m1$;

  -- ===== M-PPD-2: corrección de datos =====
  EXECUTE $m2a$${M2a}$m2a$;
  GET DIAGNOSTICS n = ROW_COUNT;
  EXECUTE $m2b$${M2b}$m2b$;
  GET DIAGNOSTICS n2 = ROW_COUNT;
  res := res || jsonb_build_object(
    'm2a_filas_tocadas', n, 'm2b_filas_tocadas', n2,
    'ppd_pagadas_sin_subtotal_despues', (SELECT count(*) FROM public.cxp c WHERE c."idCxpPPD" IS NOT NULL AND c.status IS TRUE AND c."idEstado"=6 AND COALESCE(c.moneda,'MXN')='MXN' AND COALESCE(c.subtotal,0)=0 AND EXISTS (SELECT 1 FROM public.cxp_ppd m WHERE m."idCxpPPD"=c."idCxpPPD" AND m.subtotal>0)),
    'ppd_no_pagadas_con_subtotal_despues', (SELECT count(*) FROM public.cxp c WHERE c."idCxpPPD" IS NOT NULL AND COALESCE(c.moneda,'MXN')='MXN' AND c.subtotal IS NOT NULL AND (c."idEstado"<>6 OR c.status IS NOT TRUE) AND EXISTS (SELECT 1 FROM public.cxp_ppd m WHERE m."idCxpPPD"=c."idCxpPPD" AND m.subtotal>0)),
    'ppd_pagadas_suman_mas_que_la_base', (SELECT count(*) FROM (SELECT c."idCxpPPD", sum(c.subtotal) s, max(m.subtotal) b FROM public.cxp c JOIN public.cxp_ppd m ON m."idCxpPPD"=c."idCxpPPD" WHERE c.status IS TRUE AND c."idEstado"=6 AND c.subtotal IS NOT NULL GROUP BY 1) x WHERE x.s > x.b + 0.01));

  -- ===== M-PPD-3: vistas =====
  EXECUTE $m3a$${M3a}$m3a$;
  EXECUTE $m3b$${M3b}$m3b$;
  CREATE TEMP TABLE v_despues ON COMMIT DROP AS SELECT * FROM public."v_resumenPresupuesto";
  res := res || jsonb_build_object(
    'columnas_vista_despues', (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='v_resumenPresupuesto'),
    'opciones_y_grants_cambian', (SELECT count(*) FROM v_meta_antes a JOIN (SELECT c.relname, c.reloptions::text AS opciones, c.relacl::text AS acl FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname IN ('v_resumenPresupuesto', 'v_resumenpresupuesto')) d USING (relname) WHERE a.opciones IS DISTINCT FROM d.opciones OR a.acl IS DISTINCT FROM d.acl),
    'gemela_distinta', (SELECT count(*) FROM (SELECT * FROM public.v_resumenpresupuesto EXCEPT SELECT * FROM public."v_resumenPresupuesto") x),
    'cuentas_con_cambio', (SELECT coalesce(jsonb_agg(jsonb_build_object('cuenta', d."idCategoria", 'dGastado', round((d.subtotal_gastado - a.subtotal_gastado)::numeric,2), 'dApartado', round((d.subtotal_comprometido - a.subtotal_comprometido)::numeric,2)) ORDER BY d."idCategoria"), '[]'::jsonb) FROM v_despues d JOIN v_antes a USING ("idCategoria") WHERE abs(d.subtotal_gastado-a.subtotal_gastado)>0.005 OR abs(d.subtotal_comprometido-a.subtotal_comprometido)>0.005),
    'pasan_de_dentro_a_fuera', (SELECT coalesce(jsonb_agg(d."idCategoria"), '[]'::jsonb) FROM v_despues d JOIN v_antes a USING ("idCategoria") WHERE a.dentro_presupuesto AND NOT d.dentro_presupuesto AND d.presupuestable),
    'cuentas_nuevas_en_la_vista', (SELECT count(*) FROM v_despues d WHERE NOT EXISTS (SELECT 1 FROM v_antes a WHERE a."idCategoria"=d."idCategoria")));

  -- ===== M-PPD-4: función de aprobación (real y copia de prueba sin ROLLBACK/COMMIT) =====
  EXECUTE $m4$${M4}$m4$;
  EXECUTE $m4t$${M4T}$m4t$;

  -- ===== Escenarios con una factura sintética (total 1160, base 1000; pagos 400 / 400 / 360) =====
  SELECT string_agg(quote_ident(attname), ',') INTO cols FROM pg_attribute WHERE attrelid='public.cxp'::regclass AND attnum>0 AND NOT attisdropped AND attgenerated='';
  SELECT string_agg(quote_ident(attname), ',') INTO colsm FROM pg_attribute WHERE attrelid='public.cxp_ppd'::regclass AND attnum>0 AND NOT attisdropped AND attgenerated='';
  SELECT "idCategoria" INTO v_cat FROM v_despues WHERE presupuestable AND status AND disponible_real > 50000000 ORDER BY disponible_real DESC LIMIT 1;
  SELECT s.uid INTO v_aut FROM public."segModulosUsuarios" s WHERE s.clave = 430 AND s.acceso = true AND s.uid::text <> COALESCE((SELECT valor FROM public."SPHConfiguraciones" WHERE parametro = 'Aprobar fuera de presupuesto' AND status = true LIMIT 1), '') LIMIT 1;
  res := res || jsonb_build_object('cuenta_de_prueba', v_cat, 'autorizador_de_prueba_encontrado', v_aut IS NOT NULL);

  SELECT c.* INTO r FROM public.cxp c WHERE c."idCxpPPD" IS NOT NULL AND c.status IS TRUE AND c."idEstado"=6 AND COALESCE(c.moneda,'MXN')='MXN' ORDER BY c.fc DESC LIMIT 1;
  SELECT m.* INTO mr FROM public.cxp_ppd m WHERE m."idCxpPPD"=r."idCxpPPD";
  idp := 'TESTPPD' || substr(md5(random()::text),1,8);
  mr."idCxpPPD" := idp; mr.folio := 'TESTRB-' || idp; mr.total := 1160; mr.subtotal := 1000; mr."montoAplicado" := 0; mr."idCategoria" := v_cat;
  EXECUTE format('INSERT INTO public.cxp_ppd (%s) SELECT %s FROM jsonb_populate_record(NULL::public.cxp_ppd, $1)', colsm, colsm) USING to_jsonb(mr);
  FOR i IN 1..3 LOOP
    r."idCxp" := 'TESTRB' || i || substr(md5(random()::text),1,8); r.folio := 'TESTRB-' || r."idCxp"; r."idCxpPPD" := idp;
    r."idEstado" := 2; r.total := CASE i WHEN 3 THEN 360 ELSE 400 END; r.subtotal := 999; r."idCategoria" := v_cat; r.status := true; r.moneda := 'MXN';
    ids := array_append(ids, r."idCxp");
    EXECUTE format('INSERT INTO public.cxp (%s) SELECT %s FROM jsonb_populate_record(NULL::public.cxp, $1)', cols, cols) USING (to_jsonb(r) - 'idMovBancarios');
  END LOOP;
  SELECT subtotal INTO s1 FROM public.cxp WHERE "idCxp"=ids[1];
  res := res || jsonb_build_object('t1_subtotal_al_crear_enviada_debe_ser_null', s1);

  SELECT subtotal_gastado, subtotal_comprometido INTO g0, c0 FROM public."v_resumenPresupuesto" WHERE "idCategoria"=v_cat;
  UPDATE public.cxp SET "idEstado"=4, "fecAutorizacion"=now() WHERE "idCxp"=ids[1];
  SELECT subtotal_gastado, subtotal_comprometido INTO g1, c1 FROM public."v_resumenPresupuesto" WHERE "idCategoria"=v_cat;
  res := res || jsonb_build_object('t2_aprobar_1o_dGastado', round((g1-g0)::numeric,2), 't2_aprobar_1o_dApartado', round((c1-c0)::numeric,2));
  UPDATE public.cxp SET "idEstado"=4, "fecAutorizacion"=now() WHERE "idCxp"=ids[2];
  SELECT subtotal_gastado, subtotal_comprometido INTO g1, c1 FROM public."v_resumenPresupuesto" WHERE "idCategoria"=v_cat;
  res := res || jsonb_build_object('t3_aprobar_2o_dGastado', round((g1-g0)::numeric,2), 't3_aprobar_2o_dApartado', round((c1-c0)::numeric,2));
  UPDATE public.cxp SET "idEstado"=6, "fecAutorizacion"=now() WHERE "idCxp"=ids[1];
  SELECT subtotal INTO s1 FROM public.cxp WHERE "idCxp"=ids[1];
  SELECT subtotal_gastado, subtotal_comprometido INTO g1, c1 FROM public."v_resumenPresupuesto" WHERE "idCategoria"=v_cat;
  res := res || jsonb_build_object('t4_pagar_1o_subtotal', s1, 't4_dGastado', round((g1-g0)::numeric,2), 't4_dApartado', round((c1-c0)::numeric,2));
  UPDATE public.cxp SET "idEstado"=6, "fecAutorizacion"=now() WHERE "idCxp"=ids[2];
  UPDATE public.cxp SET "idEstado"=4, "fecAutorizacion"=now() WHERE "idCxp"=ids[3];
  UPDATE public.cxp SET "idEstado"=6, "fecAutorizacion"=now() WHERE "idCxp"=ids[3];
  SELECT subtotal INTO s2 FROM public.cxp WHERE "idCxp"=ids[2];
  SELECT subtotal INTO s3 FROM public.cxp WHERE "idCxp"=ids[3];
  SELECT subtotal_gastado, subtotal_comprometido INTO g1, c1 FROM public."v_resumenPresupuesto" WHERE "idCategoria"=v_cat;
  res := res || jsonb_build_object('t5_subtotales_pagados', jsonb_build_array(s1, s2, s3), 't5_suma_subtotales', round((s1+s2+s3)::numeric,2), 't5_dGastado', round((g1-g0)::numeric,2), 't5_dApartado', round((c1-c0)::numeric,2));
  UPDATE public.cxp SET "idEstado"=4 WHERE "idCxp"=ids[2];
  SELECT subtotal INTO s4 FROM public.cxp WHERE "idCxp"=ids[2];
  SELECT subtotal_gastado, subtotal_comprometido INTO g1, c1 FROM public."v_resumenPresupuesto" WHERE "idCategoria"=v_cat;
  res := res || jsonb_build_object('t6_desaplicar_2o_subtotal_debe_ser_null', s4, 't6_dGastado', round((g1-g0)::numeric,2), 't6_dApartado', round((c1-c0)::numeric,2));
  UPDATE public.cxp SET status=false WHERE "idCxp"=ids[3];
  SELECT subtotal INTO s4 FROM public.cxp WHERE "idCxp"=ids[3];
  res := res || jsonb_build_object('t7_baja_del_3o_subtotal_debe_ser_null', s4);

  -- ===== Función de aprobación (copia de prueba) =====
  idp2 := 'TESTPPD' || substr(md5(random()::text),1,8);
  mr."idCxpPPD" := idp2; mr.folio := 'TESTRB-' || idp2; mr.total := 99999999999; mr.subtotal := 99999999999; mr."idCategoria" := v_cat;
  EXECUTE format('INSERT INTO public.cxp_ppd (%s) SELECT %s FROM jsonb_populate_record(NULL::public.cxp_ppd, $1)', colsm, colsm) USING to_jsonb(mr);
  r."idCxp" := 'TESTRB9' || substr(md5(random()::text),1,8); r.folio := 'TESTRB-' || r."idCxp"; r."idCxpPPD" := idp2; r."idEstado" := 2; r.total := 1000; r.subtotal := 999; r.status := true;
  EXECUTE format('INSERT INTO public.cxp (%s) SELECT %s FROM jsonb_populate_record(NULL::public.cxp, $1)', cols, cols) USING (to_jsonb(r) - 'idMovBancarios');
  SELECT t.autorizado, t.mensaje INTO ok, msg FROM public.cxp_autorizar_solicitud_pago_t(r."idCxp", 'prueba', v_aut, NULL) t;
  res := res || jsonb_build_object('a1_base_enorme_autoriza', ok, 'a1_mensaje', left(msg, 60));
  UPDATE public.cxp_ppd SET total = 1160, subtotal = 1000 WHERE "idCxpPPD" = idp2;
  SELECT t.autorizado, t.mensaje INTO ok, msg FROM public.cxp_autorizar_solicitud_pago_t(r."idCxp", 'prueba', v_aut, NULL) t;
  res := res || jsonb_build_object('a2_base_normal_autoriza', ok, 'a2_mensaje', left(msg, 60));
  r."idCxp" := 'TESTRB8' || substr(md5(random()::text),1,8); r.folio := 'TESTRB-' || r."idCxp"; r."idEstado" := 2; r.total := 100;
  EXECUTE format('INSERT INTO public.cxp (%s) SELECT %s FROM jsonb_populate_record(NULL::public.cxp, $1)', cols, cols) USING (to_jsonb(r) - 'idMovBancarios');
  SELECT t.autorizado, t.mensaje INTO ok, msg FROM public.cxp_autorizar_solicitud_pago_t(r."idCxp", 'prueba', v_aut, NULL) t;
  res := res || jsonb_build_object('a3_segunda_parcial_autoriza', ok, 'a3_mensaje', left(msg, 100));

  -- ===== Las reversas devuelven lo de antes =====
  EXECUTE $rv1$${REV_V_MAIN}$rv1$;
  EXECUTE $rv2$${REV_V_TWIN}$rv2$;
  EXECUTE $rf$${REV_F}$rf$;
  SELECT regexp_replace(pg_get_functiondef('public.cxp_autorizar_solicitud_pago(text,text,uuid,uuid)'::regprocedure), '\\s+', '', 'g') INTO f_reversa;
  res := res || jsonb_build_object(
    'reversa_vistas_md5_igual', (SELECT bool_and(a.md5def = md5(pg_get_viewdef(c.oid, true))) FROM v_meta_antes a JOIN pg_class c ON c.relname = a.relname JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'),
    'reversa_vistas_opciones_y_grants_iguales', (SELECT bool_and(a.opciones IS NOT DISTINCT FROM c.reloptions::text AND a.acl IS NOT DISTINCT FROM c.relacl::text) FROM v_meta_antes a JOIN pg_class c ON c.relname = a.relname JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'),
    'reversa_funcion_igual', (f_antes = f_reversa));

  RAISE EXCEPTION 'REPORTE_PRUEBA: %', res::text;
END
$do$;
`;
fs.writeFileSync(dir + 'prueba-en-seco.sql', sql);
console.log('generados: prueba-en-seco.sql (' + sql.length + '), aplicar.sql, reversa-vistas.sql, reversa-funcion-aprobacion.sql');
