-- PRUEBA EN SECO (todo dentro de un DO que termina en RAISE EXCEPTION: no queda nada en la base).
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
  SELECT regexp_replace(pg_get_functiondef('public.cxp_autorizar_solicitud_pago(text,text,uuid,uuid)'::regprocedure), '\s+', '', 'g') INTO f_antes;
  res := res || jsonb_build_object(
    'columnas_vista_antes', (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='v_resumenPresupuesto'),
    'ppd_pagadas_sin_subtotal_antes', (SELECT count(*) FROM public.cxp WHERE "idCxpPPD" IS NOT NULL AND status IS TRUE AND "idEstado"=6 AND COALESCE(moneda,'MXN')='MXN' AND COALESCE(subtotal,0)=0),
    'ppd_no_pagadas_con_subtotal_antes', (SELECT count(*) FROM public.cxp WHERE "idCxpPPD" IS NOT NULL AND COALESCE(moneda,'MXN')='MXN' AND subtotal IS NOT NULL AND ("idEstado"<>6 OR status IS NOT TRUE)));

  -- ===== M-PPD-1: función, trigger, índice y guarda =====
  EXECUTE $m1$CREATE OR REPLACE FUNCTION public.cxp_ppd_subtotal_al_pagar()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_base double precision;
  v_total_factura double precision;
  v_pagado_total double precision;
  v_pagado_subtotal double precision;
BEGIN
  -- Solo pesos: las facturas en otra moneda aún no afectan el presupuesto (Jereff, 2026-11-17; #79).
  IF COALESCE(NEW.moneda, 'MXN') <> 'MXN' THEN
    RETURN NEW;
  END IF;

  SELECT m.subtotal, m.total INTO v_base, v_total_factura
    FROM public.cxp_ppd m WHERE m."idCxpPPD" = NEW."idCxpPPD";

  -- Factura sin base calculable (p. ej. migradas de la v1 con base 0): se deja como está.
  IF COALESCE(v_base, 0) <= 0 OR COALESCE(v_total_factura, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  -- Un solo bloqueo por factura en TODAS las ramas (pagar, desaplicar, dar de baja): dos cambios simultáneos de la misma factura no calculan el cierre con datos viejos.
  PERFORM pg_advisory_xact_lock(hashtext(NEW."idCxpPPD"));

  IF NEW.status IS TRUE AND NEW."idEstado" = 6 AND NEW.total IS NOT NULL THEN
    -- Pagada: lleva su parte proporcional de la base; el pago que liquida la factura cierra con el remanente.
    SELECT COALESCE(SUM(c.total), 0), COALESCE(SUM(c.subtotal), 0)
      INTO v_pagado_total, v_pagado_subtotal
      FROM public.cxp c
     WHERE c."idCxpPPD" = NEW."idCxpPPD" AND c.status IS TRUE AND c."idEstado" = 6 AND c."idCxp" <> NEW."idCxp";

    IF v_pagado_total + NEW.total >= v_total_factura - 0.01 THEN
      NEW.subtotal := GREATEST(0, ROUND((v_base - v_pagado_subtotal)::numeric, 2))::double precision;
    ELSE
      NEW.subtotal := ROUND((v_base * NEW.total / v_total_factura)::numeric, 2)::double precision;
    END IF;
  ELSE
    -- No pagada (guardada, enviada, rechazada, aprobada) o dada de baja: sin subtotal. El apartado lo hace la factura.
    NEW.subtotal := NULL;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.cxp_ppd_subtotal_al_pagar() IS
  'Parcialidades PPD: sin subtotal mientras no estén pagadas; al pagarse (estado 6) llevan su parte proporcional de la base de la factura (cxp_ppd.subtotal), y el pago que liquida cierra con el remanente. Solo MXN. Jereff 2026-11-17.';

REVOKE ALL ON FUNCTION public.cxp_ppd_subtotal_al_pagar() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_cxp_ppd_subtotal ON public.cxp;
CREATE TRIGGER trg_cxp_ppd_subtotal
  BEFORE INSERT OR UPDATE OF "idEstado", total, subtotal, "idCxpPPD", status, moneda ON public.cxp
  FOR EACH ROW
  WHEN (NEW."idCxpPPD" IS NOT NULL)
  EXECUTE FUNCTION public.cxp_ppd_subtotal_al_pagar();

-- Índice para el trigger, la vista y la función de aprobación (la tabla crece; hoy ~2,000 filas).
CREATE INDEX IF NOT EXISTS cxp_idcxpppd_idx ON public.cxp ("idCxpPPD") WHERE "idCxpPPD" IS NOT NULL;

-- Guarda (validador): una fila PPD que no fuera tipo 1 no debe recibir subtotal = total por el trigger de los tipos 4/5/6/2.
CREATE OR REPLACE FUNCTION public.cxp_subtotal_igual_total()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Solo pesos: las facturas en otra moneda aún no deben afectar el presupuesto (Jereff, 2026-11-17; se revisan después, #79).
  -- Las parcialidades PPD (idCxpPPD) las maneja cxp_ppd_subtotal_al_pagar.
  IF NEW.total IS NOT NULL AND COALESCE(NEW.moneda, 'MXN') = 'MXN' AND NEW."idCxpPPD" IS NULL THEN
    IF NEW."tipoOperacion" IN (4, 5, 6) THEN
      NEW.subtotal := NEW.total;
    ELSIF NEW."tipoOperacion" = 2 AND (COALESCE(NEW.subtotal, 0) = 0 OR NEW."idEstado" IN (1, 2, 3, 4)) THEN
      NEW.subtotal := NEW.total;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;$m1$;

  -- ===== M-PPD-2: corrección de datos =====
  EXECUTE $m2a$UPDATE public.cxp
   SET "idEstado" = "idEstado"
 WHERE "idCxpPPD" IS NOT NULL AND status IS TRUE AND "idEstado" = 6
   AND COALESCE(moneda, 'MXN') = 'MXN' AND COALESCE(subtotal, 0) = 0;$m2a$;
  GET DIAGNOSTICS n = ROW_COUNT;
  EXECUTE $m2b$UPDATE public.cxp
   SET "idEstado" = "idEstado"
 WHERE "idCxpPPD" IS NOT NULL AND COALESCE(moneda, 'MXN') = 'MXN'
   AND subtotal IS NOT NULL AND ("idEstado" <> 6 OR status IS NOT TRUE);$m2b$;
  GET DIAGNOSTICS n2 = ROW_COUNT;
  res := res || jsonb_build_object(
    'm2a_filas_tocadas', n, 'm2b_filas_tocadas', n2,
    'ppd_pagadas_sin_subtotal_despues', (SELECT count(*) FROM public.cxp c WHERE c."idCxpPPD" IS NOT NULL AND c.status IS TRUE AND c."idEstado"=6 AND COALESCE(c.moneda,'MXN')='MXN' AND COALESCE(c.subtotal,0)=0 AND EXISTS (SELECT 1 FROM public.cxp_ppd m WHERE m."idCxpPPD"=c."idCxpPPD" AND m.subtotal>0)),
    'ppd_no_pagadas_con_subtotal_despues', (SELECT count(*) FROM public.cxp c WHERE c."idCxpPPD" IS NOT NULL AND COALESCE(c.moneda,'MXN')='MXN' AND c.subtotal IS NOT NULL AND (c."idEstado"<>6 OR c.status IS NOT TRUE) AND EXISTS (SELECT 1 FROM public.cxp_ppd m WHERE m."idCxpPPD"=c."idCxpPPD" AND m.subtotal>0)),
    'ppd_pagadas_suman_mas_que_la_base', (SELECT count(*) FROM (SELECT c."idCxpPPD", sum(c.subtotal) s, max(m.subtotal) b FROM public.cxp c JOIN public.cxp_ppd m ON m."idCxpPPD"=c."idCxpPPD" WHERE c.status IS TRUE AND c."idEstado"=6 AND c.subtotal IS NOT NULL GROUP BY 1) x WHERE x.s > x.b + 0.01));

  -- ===== M-PPD-3: vistas =====
  EXECUTE $m3a$CREATE OR REPLACE VIEW public."v_resumenPresupuesto" WITH (security_invoker = on) AS
 WITH presupuestos AS (
         SELECT "PresDetalle"."idCategoria",
            sum(
                CASE
                    WHEN "PresDetalle".mes::numeric <= EXTRACT(month FROM now()) THEN "PresDetalle".monto
                    ELSE 0::double precision
                END) AS presupuesto_acumulado,
            sum("PresDetalle".monto) AS presupuesto_total_anual
           FROM "PresDetalle"
          WHERE "PresDetalle".anio::numeric = EXTRACT(year FROM now())
          GROUP BY "PresDetalle"."idCategoria"
        ), categorias AS (
         SELECT "PresCategorias"."idCategoria",
            "PresCategorias".presupuestable,
            "PresCategorias".status
           FROM "PresCategorias"
        ), gastos_autorizados AS (
         SELECT cxp."idCategoria",
            sum(cxp.subtotal) AS total_gastado,
            count(*) AS num_transacciones_autorizadas
           FROM cxp
          WHERE cxp."idEstado" = 6 AND EXTRACT(month FROM cxp."fecAutorizacion") <= EXTRACT(month FROM now()) AND EXTRACT(year FROM cxp."fecAutorizacion") = EXTRACT(year FROM now())
          GROUP BY cxp."idCategoria"
        ), gastos_aprobados_base AS (
         SELECT cxp."idCategoria",
            sum(cxp.subtotal) AS total_aprobado,
            count(*) AS num_transacciones_aprobadas
           FROM cxp
          WHERE cxp."idEstado" = 4 AND EXTRACT(month FROM cxp.fc) <= EXTRACT(month FROM now()) AND EXTRACT(year FROM cxp.fc) = EXTRACT(year FROM now())
          GROUP BY cxp."idCategoria"
        ), ppd_primera AS (
         -- Primera parcialidad aprobada o pagada de cada factura PPD: fija la cuenta, el año y el mes del apartado.
         SELECT DISTINCT ON (c."idCxpPPD") c."idCxpPPD",
            c."idCategoria",
            COALESCE(c."fecAutorizacion", c.fc) AS fecha_primera
           FROM cxp c
          WHERE c."idCxpPPD" IS NOT NULL AND c.status IS TRUE AND (c."idEstado" = ANY (ARRAY[4, 6, 7, 99]))
          ORDER BY c."idCxpPPD", COALESCE(c."fecAutorizacion", c.fc), c.fc
        ), ppd_agg AS (
         -- Una sola pasada por cxp: lo ya consumido de cada factura (subtotal de sus parcialidades pagadas) y si alguna parcialidad es de otra moneda.
         SELECT cxp."idCxpPPD",
            sum(cxp.subtotal) FILTER (WHERE cxp.status IS TRUE AND cxp."idEstado" = 6) AS pagado,
            bool_or(COALESCE(cxp.moneda, 'MXN'::text) <> 'MXN'::text) AS otra_moneda
           FROM cxp
          WHERE cxp."idCxpPPD" IS NOT NULL
          GROUP BY cxp."idCxpPPD"
        ), ppd_saldo AS (
         -- Saldo apartado = base de la factura menos lo ya consumido. Solo pesos.
         SELECT p."idCategoria",
            sum(GREATEST(0::double precision, m.subtotal - COALESCE(a.pagado, 0::double precision))) AS saldo
           FROM ppd_primera p
             JOIN cxp_ppd m ON m."idCxpPPD" = p."idCxpPPD" AND m.status IS TRUE AND m.subtotal > 0::double precision
             JOIN ppd_agg a ON a."idCxpPPD" = p."idCxpPPD"
          WHERE EXTRACT(year FROM p.fecha_primera) = EXTRACT(year FROM now()) AND EXTRACT(month FROM p.fecha_primera) <= EXTRACT(month FROM now())
            AND NOT a.otra_moneda
          GROUP BY p."idCategoria"
        ), gastos_aprobados AS (
         SELECT x."idCategoria",
            sum(x.monto) AS total_aprobado,
            sum(x.n)::bigint AS num_transacciones_aprobadas
           FROM ( SELECT gastos_aprobados_base."idCategoria",
                    gastos_aprobados_base.total_aprobado AS monto,
                    gastos_aprobados_base.num_transacciones_aprobadas AS n
                   FROM gastos_aprobados_base
                UNION ALL
                 SELECT ppd_saldo."idCategoria",
                    ppd_saldo.saldo,
                    0::bigint
                   FROM ppd_saldo) x
          GROUP BY x."idCategoria"
        ), gastos_comprometidos_total_base AS (
         SELECT cxp."idCategoria",
            sum(cxp.subtotal) AS total_comprometido_completo,
            count(*) AS num_transacciones_comprometidas
           FROM cxp
          WHERE (cxp."idEstado" = ANY (ARRAY[4, 6])) AND (cxp."idEstado" = 6 AND EXTRACT(month FROM cxp."fecAutorizacion") <= EXTRACT(month FROM now()) AND EXTRACT(year FROM cxp."fecAutorizacion") = EXTRACT(year FROM now()) OR cxp."idEstado" = 4 AND EXTRACT(month FROM cxp.fc) <= EXTRACT(month FROM now()) AND EXTRACT(year FROM cxp.fc) = EXTRACT(year FROM now()))
          GROUP BY cxp."idCategoria"
        ), gastos_comprometidos_total AS (
         SELECT x."idCategoria",
            sum(x.monto) AS total_comprometido_completo,
            sum(x.n)::bigint AS num_transacciones_comprometidas
           FROM ( SELECT gastos_comprometidos_total_base."idCategoria",
                    gastos_comprometidos_total_base.total_comprometido_completo AS monto,
                    gastos_comprometidos_total_base.num_transacciones_comprometidas AS n
                   FROM gastos_comprometidos_total_base
                UNION ALL
                 SELECT ppd_saldo."idCategoria",
                    ppd_saldo.saldo,
                    0::bigint
                   FROM ppd_saldo) x
          GROUP BY x."idCategoria"
        ), todas_categorias AS (
         SELECT presupuestos."idCategoria"
           FROM presupuestos
        UNION
         SELECT gastos_comprometidos_total."idCategoria"
           FROM gastos_comprometidos_total
        UNION
         SELECT categorias."idCategoria"
           FROM categorias
        )
 SELECT tc."idCategoria",
    COALESCE(cat.presupuestable, false) AS presupuestable,
    COALESCE(cat.status, false) AS status,
    COALESCE(p.presupuesto_acumulado, 0::double precision) AS presupuesto_acumulado,
    COALESCE(p.presupuesto_total_anual, 0::double precision) AS presupuesto_total_anual,
    COALESCE(ga.total_gastado, 0::double precision) AS subtotal_gastado,
    COALESCE(gap.total_aprobado, 0::double precision) AS subtotal_comprometido,
    COALESCE(ga.total_gastado, 0::double precision) + COALESCE(gap.total_aprobado, 0::double precision) AS total_gastado_comprometido,
        CASE
            WHEN COALESCE(gct.total_comprometido_completo, 0::double precision) <= COALESCE(p.presupuesto_acumulado, 0::double precision) THEN true
            ELSE false
        END AS dentro_presupuesto,
        CASE
            WHEN COALESCE(p.presupuesto_acumulado, 0::double precision) > 0::double precision THEN COALESCE(gct.total_comprometido_completo, 0::double precision) / p.presupuesto_acumulado
            WHEN COALESCE(p.presupuesto_acumulado, 0::double precision) = 0::double precision AND COALESCE(gct.total_comprometido_completo, 0::double precision) > 0::double precision THEN 999.99::double precision
            ELSE 0::double precision
        END AS avance_total,
        CASE
            WHEN COALESCE(p.presupuesto_acumulado, 0::double precision) > 0::double precision THEN COALESCE(ga.total_gastado, 0::double precision) / p.presupuesto_acumulado
            WHEN COALESCE(p.presupuesto_acumulado, 0::double precision) = 0::double precision AND COALESCE(ga.total_gastado, 0::double precision) > 0::double precision THEN 999.99::double precision
            ELSE 0::double precision
        END AS avance_acumulado,
        CASE
            WHEN COALESCE(p.presupuesto_acumulado, 0::double precision) > 0::double precision THEN COALESCE(gct.total_comprometido_completo, 0::double precision) / p.presupuesto_acumulado
            WHEN COALESCE(p.presupuesto_acumulado, 0::double precision) = 0::double precision AND COALESCE(gct.total_comprometido_completo, 0::double precision) > 0::double precision THEN 999.99::double precision
            ELSE 0::double precision
        END AS avance_comprometido,
        CASE
            WHEN COALESCE(p.presupuesto_total_anual, 0::double precision) > 0::double precision THEN COALESCE(ga.total_gastado, 0::double precision) / p.presupuesto_total_anual
            WHEN COALESCE(p.presupuesto_total_anual, 0::double precision) = 0::double precision AND COALESCE(ga.total_gastado, 0::double precision) > 0::double precision THEN 999.99::double precision
            ELSE 0::double precision
        END AS avance_vs_anual,
    COALESCE(p.presupuesto_acumulado, 0::double precision) - COALESCE(ga.total_gastado, 0::double precision) AS disponible_acumulado,
    COALESCE(p.presupuesto_acumulado, 0::double precision) - COALESCE(gct.total_comprometido_completo, 0::double precision) AS disponible_real,
    COALESCE(p.presupuesto_total_anual, 0::double precision) - COALESCE(ga.total_gastado, 0::double precision) AS disponible_anual,
    COALESCE(ga.num_transacciones_autorizadas, 0::bigint) AS transacciones_autorizadas,
    COALESCE(gct.num_transacciones_comprometidas, 0::bigint) AS transacciones_comprometidas,
        CASE
            WHEN EXTRACT(month FROM now()) > 0::numeric THEN COALESCE(ga.total_gastado, 0::double precision) / EXTRACT(month FROM now())::double precision
            ELSE 0::double precision
        END AS promedio_mensual_gastado,
        CASE
            WHEN EXTRACT(month FROM now()) > 0::numeric THEN COALESCE(ga.total_gastado, 0::double precision) / EXTRACT(month FROM now())::double precision * 12::double precision
            ELSE 0::double precision
        END AS proyeccion_gasto_anual,
        CASE
            WHEN COALESCE(ga.total_gastado, 0::double precision) = 0::double precision THEN 'SIN_GASTOS'::text
            WHEN COALESCE(p.presupuesto_acumulado, 0::double precision) = 0::double precision THEN 'SIN_PRESUPUESTO'::text
            WHEN (COALESCE(ga.total_gastado, 0::double precision) / p.presupuesto_acumulado) <= 0.5::double precision THEN 'BAJO'::text
            WHEN (COALESCE(ga.total_gastado, 0::double precision) / p.presupuesto_acumulado) <= 0.8::double precision THEN 'MODERADO'::text
            WHEN (COALESCE(ga.total_gastado, 0::double precision) / p.presupuesto_acumulado) <= 1.0::double precision THEN 'ALTO'::text
            ELSE 'EXCEDIDO'::text
        END AS estado_acumulado,
        CASE
            WHEN COALESCE(ga.total_gastado, 0::double precision) = 0::double precision THEN 'SIN_GASTOS'::text
            WHEN COALESCE(p.presupuesto_total_anual, 0::double precision) = 0::double precision THEN 'SIN_PRESUPUESTO'::text
            WHEN (COALESCE(ga.total_gastado, 0::double precision) / p.presupuesto_total_anual) <= 0.3::double precision THEN 'CONSERVADOR'::text
            WHEN (COALESCE(ga.total_gastado, 0::double precision) / p.presupuesto_total_anual) <= 0.6::double precision THEN 'NORMAL'::text
            WHEN (COALESCE(ga.total_gastado, 0::double precision) / p.presupuesto_total_anual) <= 0.9::double precision THEN 'ACELERADO'::text
            ELSE 'CRITICO'::text
        END AS estado_vs_anual,
        CASE
            WHEN COALESCE(gct.total_comprometido_completo, 0::double precision) = 0::double precision THEN 'SIN_COMPROMISOS'::text
            WHEN COALESCE(p.presupuesto_acumulado, 0::double precision) = 0::double precision THEN 'SIN_PRESUPUESTO'::text
            WHEN (COALESCE(gct.total_comprometido_completo, 0::double precision) / p.presupuesto_acumulado) <= 0.5::double precision THEN 'BAJO_COMPROMISO'::text
            WHEN (COALESCE(gct.total_comprometido_completo, 0::double precision) / p.presupuesto_acumulado) <= 0.8::double precision THEN 'MODERADO_COMPROMISO'::text
            WHEN (COALESCE(gct.total_comprometido_completo, 0::double precision) / p.presupuesto_acumulado) <= 1.0::double precision THEN 'ALTO_COMPROMISO'::text
            ELSE 'SOBRE_COMPROMETIDO'::text
        END AS estado_comprometido,
    12::numeric - EXTRACT(month FROM now()) AS meses_restantes,
        CASE
            WHEN (12::numeric - EXTRACT(month FROM now())) > 0::numeric AND COALESCE(p.presupuesto_total_anual, 0::double precision) > 0::double precision THEN (COALESCE(p.presupuesto_total_anual, 0::double precision) - COALESCE(ga.total_gastado, 0::double precision)) / (12::numeric - EXTRACT(month FROM now()))::double precision
            ELSE 0::double precision
        END AS presupuesto_mensual_restante,
        CASE
            WHEN COALESCE(p.presupuesto_total_anual, 0::double precision) > 0::double precision AND COALESCE(ga.total_gastado, 0::double precision) > 0::double precision THEN 'NORMAL'::text
            WHEN COALESCE(p.presupuesto_total_anual, 0::double precision) > 0::double precision AND COALESCE(ga.total_gastado, 0::double precision) = 0::double precision THEN 'PRESUPUESTO_SIN_USO'::text
            WHEN COALESCE(p.presupuesto_total_anual, 0::double precision) = 0::double precision AND COALESCE(ga.total_gastado, 0::double precision) > 0::double precision THEN 'ESPECIAL_SOLO_GASTOS'::text
            ELSE 'INACTIVA'::text
        END AS tipo_categoria
   FROM todas_categorias tc
     LEFT JOIN categorias cat ON tc."idCategoria" = cat."idCategoria"
     LEFT JOIN presupuestos p ON tc."idCategoria" = p."idCategoria"
     LEFT JOIN gastos_autorizados ga ON tc."idCategoria" = ga."idCategoria"
     LEFT JOIN gastos_aprobados gap ON tc."idCategoria" = gap."idCategoria"
     LEFT JOIN gastos_comprometidos_total gct ON tc."idCategoria" = gct."idCategoria"
  ORDER BY (
        CASE
            WHEN COALESCE(p.presupuesto_total_anual, 0::double precision) = 0::double precision AND COALESCE(gct.total_comprometido_completo, 0::double precision) > 0::double precision THEN 0
            ELSE 1
        END), (COALESCE(gct.total_comprometido_completo, 0::double precision)) DESC, (
        CASE
            WHEN COALESCE(p.presupuesto_acumulado, 0::double precision) > 0::double precision THEN COALESCE(gct.total_comprometido_completo, 0::double precision) / p.presupuesto_acumulado
            WHEN COALESCE(p.presupuesto_acumulado, 0::double precision) = 0::double precision AND COALESCE(gct.total_comprometido_completo, 0::double precision) > 0::double precision THEN 999.99::double precision
            ELSE 0::double precision
        END) DESC$m3a$;
  EXECUTE $m3b$CREATE OR REPLACE VIEW public.v_resumenpresupuesto WITH (security_invoker = on) AS
 SELECT * FROM public."v_resumenPresupuesto"$m3b$;
  CREATE TEMP TABLE v_despues ON COMMIT DROP AS SELECT * FROM public."v_resumenPresupuesto";
  res := res || jsonb_build_object(
    'columnas_vista_despues', (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='v_resumenPresupuesto'),
    'opciones_y_grants_cambian', (SELECT count(*) FROM v_meta_antes a JOIN (SELECT c.relname, c.reloptions::text AS opciones, c.relacl::text AS acl FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname IN ('v_resumenPresupuesto', 'v_resumenpresupuesto')) d USING (relname) WHERE a.opciones IS DISTINCT FROM d.opciones OR a.acl IS DISTINCT FROM d.acl),
    'gemela_distinta', (SELECT count(*) FROM (SELECT * FROM public.v_resumenpresupuesto EXCEPT SELECT * FROM public."v_resumenPresupuesto") x),
    'cuentas_con_cambio', (SELECT coalesce(jsonb_agg(jsonb_build_object('cuenta', d."idCategoria", 'dGastado', round((d.subtotal_gastado - a.subtotal_gastado)::numeric,2), 'dApartado', round((d.subtotal_comprometido - a.subtotal_comprometido)::numeric,2)) ORDER BY d."idCategoria"), '[]'::jsonb) FROM v_despues d JOIN v_antes a USING ("idCategoria") WHERE abs(d.subtotal_gastado-a.subtotal_gastado)>0.005 OR abs(d.subtotal_comprometido-a.subtotal_comprometido)>0.005),
    'pasan_de_dentro_a_fuera', (SELECT coalesce(jsonb_agg(d."idCategoria"), '[]'::jsonb) FROM v_despues d JOIN v_antes a USING ("idCategoria") WHERE a.dentro_presupuesto AND NOT d.dentro_presupuesto AND d.presupuestable),
    'cuentas_nuevas_en_la_vista', (SELECT count(*) FROM v_despues d WHERE NOT EXISTS (SELECT 1 FROM v_antes a WHERE a."idCategoria"=d."idCategoria")));

  -- ===== M-PPD-4: función de aprobación (real y copia de prueba sin ROLLBACK/COMMIT) =====
  EXECUTE $m4$CREATE OR REPLACE FUNCTION public.cxp_autorizar_solicitud_pago(p_idcxp text, p_ultimocomentario text DEFAULT NULL::text, p_autorizo uuid DEFAULT NULL::uuid, p_uidsolicita uuid DEFAULT NULL::uuid)
 RETURNS TABLE(autorizado boolean, mensaje text)
 LANGUAGE plpgsql
AS $function$

DECLARE
    -- Variables para datos del CxP
    v_idcategoria TEXT;
    v_subtotal NUMERIC;
    v_estado_actual INTEGER;
    v_cxp_existe BOOLEAN := FALSE;
    v_idcxpppd TEXT;                -- PPD
    v_moneda TEXT;                  -- PPD
    v_ya_apartada BOOLEAN := FALSE; -- PPD

    -- Variables para datos de presupuesto
    v_categoria_activa BOOLEAN;
    v_presupuestable BOOLEAN;
    v_presupuesto_acumulado NUMERIC;
    v_total_gastado_comprometido NUMERIC;
    v_calculo_nuevo_total NUMERIC;

    -- Variables de control
    v_mensaje_error TEXT;
    v_autorizado BOOLEAN := FALSE;

    -- Variables para configuración
    v_uuid_aprobar_fp uuid;
    v_omitir_validacion_presupuesto BOOLEAN := FALSE;

    -- Cursor para obtener datos del CxP
    cursor_cxp CURSOR FOR
        SELECT "idCategoria", subtotal, "idEstado", "idCxpPPD", moneda
        FROM public.cxp
        WHERE "idCxp" = p_idcxp;

    -- Cursor para obtener datos de presupuesto
    cursor_presupuesto CURSOR FOR
        SELECT status, presupuestable, presupuesto_acumulado, total_gastado_comprometido
        FROM public.v_resumenPresupuesto
        WHERE "idCategoria" = v_idcategoria;

    -- Cursor para obtener configuración de aprobar fuera de presupuesto
    cursor_config_fp CURSOR FOR
        SELECT valor::uuid
        FROM public."SPHConfiguraciones"
        WHERE parametro = 'Aprobar fuera de presupuesto' AND status = true;
BEGIN
    -- [Fecha y Hora]: 20/11/2025 08:01:00 (PPD: 2026-11-17)
    -- [Descripción]: Función principal para autorizar solicitudes de pago con validación de presupuesto
    -- [Entrada]: p_idcxp (text) - ID de la cuenta por pagar a autorizar
    -- [Salida]: TABLE(autorizado boolean, mensaje text) - Resultado de la autorización con mensaje descriptivo
    -- [Uso]: SELECT * FROM cxp_autorizar_solicitud_pago('ID_CXP') AS (autorizado boolean, mensaje text);

    -- Iniciar transacción para asegurar atomicidad
    BEGIN

        -- 1. Validación de parámetros de entrada
        IF p_idcxp IS NULL OR TRIM(p_idcxp) = '' THEN
            RETURN QUERY SELECT FALSE, 'ERROR: El ID de CxP no puede ser nulo o vacío';
            RETURN;
        END IF;

        -- 2. Verificar existencia del CxP y obtener sus datos
        OPEN cursor_cxp;
        FETCH cursor_cxp INTO v_idcategoria, v_subtotal, v_estado_actual, v_idcxpppd, v_moneda;

        IF NOT FOUND THEN
            CLOSE cursor_cxp;
            RETURN QUERY SELECT FALSE, 'ERROR: No existe una cuenta por pagar con el ID: ' || p_idcxp;
            RETURN;
        END IF;
        CLOSE cursor_cxp;

        -- Validar que el subtotal no sea nulo
        IF v_subtotal IS NULL THEN
            v_subtotal := 0;
        END IF;

        -- 3. Obtener configuración para aprobar fuera de presupuesto
        OPEN cursor_config_fp;
        FETCH cursor_config_fp INTO v_uuid_aprobar_fp;
        CLOSE cursor_config_fp;

        -- Verificar si se debe omitir la validación de presupuesto
        IF v_uuid_aprobar_fp IS NOT NULL AND p_autorizo IS NOT NULL THEN
            v_omitir_validacion_presupuesto := (p_autorizo = v_uuid_aprobar_fp);
        END IF;

        -- 4. Obtener información de presupuesto desde la vista
        OPEN cursor_presupuesto;
        FETCH cursor_presupuesto INTO v_categoria_activa, v_presupuestable, v_presupuesto_acumulado, v_total_gastado_comprometido;

        IF NOT FOUND THEN
            CLOSE cursor_presupuesto;
            RETURN QUERY SELECT FALSE, 'ERROR: No se encontró información de presupuesto para la categoría: ' || COALESCE(v_idcategoria, 'SIN CATEGORÍA');
            RETURN;
        END IF;
        CLOSE cursor_presupuesto;

        -- 5. Validar que la categoría esté activa
        IF NOT v_categoria_activa THEN
            -- Mensaje especial para categoría no clasificada ("-")
            IF v_idcategoria = '-' THEN
                RETURN QUERY SELECT FALSE, 'ERROR: El gasto no está clasificado correctamente (categoría "-"). Por favor, clasifique el gasto asignando una categoría válida antes de autorizar el pago.';
            ELSE
                RETURN QUERY SELECT FALSE, 'ERROR: La categoría "' || v_idcategoria || '" no está activa. No se puede autorizar el pago.';
            END IF;
            RETURN;
        END IF;

        -- 6. Determinar si aplica validación de presupuesto
        IF NOT v_presupuestable OR v_omitir_validacion_presupuesto THEN
            -- Si no es presupuestable o el usuario está autorizado para omitir validación, autorizar directamente
            UPDATE public.cxp
            SET "idEstado" = 4,  -- Estado 4 = Aprobado
                "ultimoComentario" = COALESCE(p_ultimocomentario, ''),
                "autorizo" = p_autorizo,
                "fecAutorizacion" = NOW()
            WHERE "idCxp" = p_idcxp;

            IF v_omitir_validacion_presupuesto THEN
                RETURN QUERY SELECT TRUE, 'PAGO AUTORIZADO: Usuario autorizado para omitir validación de presupuesto. Categoría "' || v_idcategoria || '".';
            ELSE
                RETURN QUERY SELECT TRUE, 'PAGO AUTORIZADO: La categoría "' || v_idcategoria || '" no es presupuestable. Se autoriza directamente.';
            END IF;
            RETURN;
        END IF;

        -- 6 bis. PPD: el presupuesto lo aparta la FACTURA desde su primera aprobación (base completa).
        IF v_idcxpppd IS NOT NULL THEN
            SELECT EXISTS (
                SELECT 1 FROM public.cxp k
                WHERE k."idCxpPPD" = v_idcxpppd AND k.status IS TRUE AND k."idCxp" <> p_idcxp
                  AND k."idEstado" IN (4, 6, 7, 99)
            ) INTO v_ya_apartada;

            IF v_ya_apartada OR COALESCE(v_moneda, 'MXN') <> 'MXN' THEN
                -- Ya apartada por una parcialidad anterior (o factura en otra moneda, que aún no afecta el presupuesto):
                -- se autoriza sin volver a validar.
                UPDATE public.cxp
                SET "idEstado" = 4,
                    "ultimoComentario" = COALESCE(p_ultimocomentario, ''),
                    "autorizo" = p_autorizo,
                    "fecAutorizacion" = NOW()
                WHERE "idCxp" = p_idcxp;

                RETURN QUERY SELECT TRUE,
                    CASE WHEN v_ya_apartada
                         THEN 'PAGO AUTORIZADO: La factura PPD ya tiene su presupuesto apartado desde su primera aprobación.'
                         ELSE 'PAGO AUTORIZADO: Factura en otra moneda; no afecta el presupuesto.'
                    END;
                RETURN;
            END IF;

            -- Primera aprobación: se valida y se aparta la base completa de la factura.
            SELECT COALESCE(m.subtotal, 0) INTO v_subtotal FROM public.cxp_ppd m WHERE m."idCxpPPD" = v_idcxpppd;
            v_subtotal := COALESCE(v_subtotal, 0);
        END IF;

        -- 7. Aplicar validación de presupuesto (solo si presupuestable = true y no se omite validación)

        -- Validar que los valores de presupuesto no sean nulos
        IF v_presupuesto_acumulado IS NULL THEN
            v_presupuesto_acumulado := 0;
        END IF;

        IF v_total_gastado_comprometido IS NULL THEN
            v_total_gastado_comprometido := 0;
        END IF;

        -- Calcular nuevo total: presupuesto_gastado_comprometido + cxp.subtotal (PPD: base de la factura)
        v_calculo_nuevo_total := v_total_gastado_comprometido + v_subtotal;

        -- Comparar contra presupuesto acumulado
        IF v_calculo_nuevo_total <= v_presupuesto_acumulado THEN
            -- Hay presupuesto disponible, autorizar
            UPDATE public.cxp
            SET "idEstado" = 4,  -- Estado 4 = Aprobado
                "ultimoComentario" = COALESCE(p_ultimocomentario, ''),
                "autorizo" = p_autorizo,
                "fecAutorizacion" = NOW()
            WHERE "idCxp" = p_idcxp;

            RETURN QUERY SELECT TRUE,
                'PAGO AUTORIZADO: Presupuesto disponible. ' ||
                'Gasto actual: $' || TO_CHAR(v_total_gastado_comprometido, '999,999,999.99') ||
                ' + Nuevo pago: $' || TO_CHAR(v_subtotal, '999,999,999.99') ||
                ' = $' || TO_CHAR(v_calculo_nuevo_total, '999,999,999.99') ||
                ' (Disponible: $' || TO_CHAR(v_presupuesto_acumulado, '999,999,999.99') || ')';
            RETURN;
        ELSE
            -- Presupuesto insuficiente, rechazar con mensaje específico
            RETURN QUERY SELECT FALSE,
                'PAGO RECHAZADO: Presupuesto insuficiente. ' ||
                'Gasto actual: $' || TO_CHAR(v_total_gastado_comprometido, '999,999,999.99') ||
                ' + Nuevo pago: $' || TO_CHAR(v_subtotal, '999,999,999.99') ||
                ' = $' || TO_CHAR(v_calculo_nuevo_total, '999,999,999.99') ||
                ' (Excede el presupuesto disponible: $' || TO_CHAR(v_presupuesto_acumulado, '999,999,999.99') ||
                '. Sobrepaso: $' || TO_CHAR(v_calculo_nuevo_total - v_presupuesto_acumulado, '999,999,999.99') || ')';
            RETURN;
        END IF;

        -- Confirmar transacción
        COMMIT;

    EXCEPTION
        WHEN OTHERS THEN
            -- Deshacer cambios en caso de error
            ROLLBACK;

            -- Retornar error genérico con información del error específico
            RETURN QUERY SELECT FALSE, 'ERROR INTERNO: ' || SQLERRM;
            RETURN;
    END;

END;

$function$$m4$;
  EXECUTE $m4t$CREATE OR REPLACE FUNCTION public.cxp_autorizar_solicitud_pago_t(p_idcxp text, p_ultimocomentario text DEFAULT NULL::text, p_autorizo uuid DEFAULT NULL::uuid, p_uidsolicita uuid DEFAULT NULL::uuid)
 RETURNS TABLE(autorizado boolean, mensaje text)
 LANGUAGE plpgsql
AS $function$

DECLARE
    -- Variables para datos del CxP
    v_idcategoria TEXT;
    v_subtotal NUMERIC;
    v_estado_actual INTEGER;
    v_cxp_existe BOOLEAN := FALSE;
    v_idcxpppd TEXT;                -- PPD
    v_moneda TEXT;                  -- PPD
    v_ya_apartada BOOLEAN := FALSE; -- PPD

    -- Variables para datos de presupuesto
    v_categoria_activa BOOLEAN;
    v_presupuestable BOOLEAN;
    v_presupuesto_acumulado NUMERIC;
    v_total_gastado_comprometido NUMERIC;
    v_calculo_nuevo_total NUMERIC;

    -- Variables de control
    v_mensaje_error TEXT;
    v_autorizado BOOLEAN := FALSE;

    -- Variables para configuración
    v_uuid_aprobar_fp uuid;
    v_omitir_validacion_presupuesto BOOLEAN := FALSE;

    -- Cursor para obtener datos del CxP
    cursor_cxp CURSOR FOR
        SELECT "idCategoria", subtotal, "idEstado", "idCxpPPD", moneda
        FROM public.cxp
        WHERE "idCxp" = p_idcxp;

    -- Cursor para obtener datos de presupuesto
    cursor_presupuesto CURSOR FOR
        SELECT status, presupuestable, presupuesto_acumulado, total_gastado_comprometido
        FROM public.v_resumenPresupuesto
        WHERE "idCategoria" = v_idcategoria;

    -- Cursor para obtener configuración de aprobar fuera de presupuesto
    cursor_config_fp CURSOR FOR
        SELECT valor::uuid
        FROM public."SPHConfiguraciones"
        WHERE parametro = 'Aprobar fuera de presupuesto' AND status = true;
BEGIN
    -- [Fecha y Hora]: 20/11/2025 08:01:00 (PPD: 2026-11-17)
    -- [Descripción]: Función principal para autorizar solicitudes de pago con validación de presupuesto
    -- [Entrada]: p_idcxp (text) - ID de la cuenta por pagar a autorizar
    -- [Salida]: TABLE(autorizado boolean, mensaje text) - Resultado de la autorización con mensaje descriptivo
    -- [Uso]: SELECT * FROM cxp_autorizar_solicitud_pago('ID_CXP') AS (autorizado boolean, mensaje text);

    -- Iniciar transacción para asegurar atomicidad
    BEGIN

        -- 1. Validación de parámetros de entrada
        IF p_idcxp IS NULL OR TRIM(p_idcxp) = '' THEN
            RETURN QUERY SELECT FALSE, 'ERROR: El ID de CxP no puede ser nulo o vacío';
            RETURN;
        END IF;

        -- 2. Verificar existencia del CxP y obtener sus datos
        OPEN cursor_cxp;
        FETCH cursor_cxp INTO v_idcategoria, v_subtotal, v_estado_actual, v_idcxpppd, v_moneda;

        IF NOT FOUND THEN
            CLOSE cursor_cxp;
            RETURN QUERY SELECT FALSE, 'ERROR: No existe una cuenta por pagar con el ID: ' || p_idcxp;
            RETURN;
        END IF;
        CLOSE cursor_cxp;

        -- Validar que el subtotal no sea nulo
        IF v_subtotal IS NULL THEN
            v_subtotal := 0;
        END IF;

        -- 3. Obtener configuración para aprobar fuera de presupuesto
        OPEN cursor_config_fp;
        FETCH cursor_config_fp INTO v_uuid_aprobar_fp;
        CLOSE cursor_config_fp;

        -- Verificar si se debe omitir la validación de presupuesto
        IF v_uuid_aprobar_fp IS NOT NULL AND p_autorizo IS NOT NULL THEN
            v_omitir_validacion_presupuesto := (p_autorizo = v_uuid_aprobar_fp);
        END IF;

        -- 4. Obtener información de presupuesto desde la vista
        OPEN cursor_presupuesto;
        FETCH cursor_presupuesto INTO v_categoria_activa, v_presupuestable, v_presupuesto_acumulado, v_total_gastado_comprometido;

        IF NOT FOUND THEN
            CLOSE cursor_presupuesto;
            RETURN QUERY SELECT FALSE, 'ERROR: No se encontró información de presupuesto para la categoría: ' || COALESCE(v_idcategoria, 'SIN CATEGORÍA');
            RETURN;
        END IF;
        CLOSE cursor_presupuesto;

        -- 5. Validar que la categoría esté activa
        IF NOT v_categoria_activa THEN
            -- Mensaje especial para categoría no clasificada ("-")
            IF v_idcategoria = '-' THEN
                RETURN QUERY SELECT FALSE, 'ERROR: El gasto no está clasificado correctamente (categoría "-"). Por favor, clasifique el gasto asignando una categoría válida antes de autorizar el pago.';
            ELSE
                RETURN QUERY SELECT FALSE, 'ERROR: La categoría "' || v_idcategoria || '" no está activa. No se puede autorizar el pago.';
            END IF;
            RETURN;
        END IF;

        -- 6. Determinar si aplica validación de presupuesto
        IF NOT v_presupuestable OR v_omitir_validacion_presupuesto THEN
            -- Si no es presupuestable o el usuario está autorizado para omitir validación, autorizar directamente
            UPDATE public.cxp
            SET "idEstado" = 4,  -- Estado 4 = Aprobado
                "ultimoComentario" = COALESCE(p_ultimocomentario, ''),
                "autorizo" = p_autorizo,
                "fecAutorizacion" = NOW()
            WHERE "idCxp" = p_idcxp;

            IF v_omitir_validacion_presupuesto THEN
                RETURN QUERY SELECT TRUE, 'PAGO AUTORIZADO: Usuario autorizado para omitir validación de presupuesto. Categoría "' || v_idcategoria || '".';
            ELSE
                RETURN QUERY SELECT TRUE, 'PAGO AUTORIZADO: La categoría "' || v_idcategoria || '" no es presupuestable. Se autoriza directamente.';
            END IF;
            RETURN;
        END IF;

        -- 6 bis. PPD: el presupuesto lo aparta la FACTURA desde su primera aprobación (base completa).
        IF v_idcxpppd IS NOT NULL THEN
            SELECT EXISTS (
                SELECT 1 FROM public.cxp k
                WHERE k."idCxpPPD" = v_idcxpppd AND k.status IS TRUE AND k."idCxp" <> p_idcxp
                  AND k."idEstado" IN (4, 6, 7, 99)
            ) INTO v_ya_apartada;

            IF v_ya_apartada OR COALESCE(v_moneda, 'MXN') <> 'MXN' THEN
                -- Ya apartada por una parcialidad anterior (o factura en otra moneda, que aún no afecta el presupuesto):
                -- se autoriza sin volver a validar.
                UPDATE public.cxp
                SET "idEstado" = 4,
                    "ultimoComentario" = COALESCE(p_ultimocomentario, ''),
                    "autorizo" = p_autorizo,
                    "fecAutorizacion" = NOW()
                WHERE "idCxp" = p_idcxp;

                RETURN QUERY SELECT TRUE,
                    CASE WHEN v_ya_apartada
                         THEN 'PAGO AUTORIZADO: La factura PPD ya tiene su presupuesto apartado desde su primera aprobación.'
                         ELSE 'PAGO AUTORIZADO: Factura en otra moneda; no afecta el presupuesto.'
                    END;
                RETURN;
            END IF;

            -- Primera aprobación: se valida y se aparta la base completa de la factura.
            SELECT COALESCE(m.subtotal, 0) INTO v_subtotal FROM public.cxp_ppd m WHERE m."idCxpPPD" = v_idcxpppd;
            v_subtotal := COALESCE(v_subtotal, 0);
        END IF;

        -- 7. Aplicar validación de presupuesto (solo si presupuestable = true y no se omite validación)

        -- Validar que los valores de presupuesto no sean nulos
        IF v_presupuesto_acumulado IS NULL THEN
            v_presupuesto_acumulado := 0;
        END IF;

        IF v_total_gastado_comprometido IS NULL THEN
            v_total_gastado_comprometido := 0;
        END IF;

        -- Calcular nuevo total: presupuesto_gastado_comprometido + cxp.subtotal (PPD: base de la factura)
        v_calculo_nuevo_total := v_total_gastado_comprometido + v_subtotal;

        -- Comparar contra presupuesto acumulado
        IF v_calculo_nuevo_total <= v_presupuesto_acumulado THEN
            -- Hay presupuesto disponible, autorizar
            UPDATE public.cxp
            SET "idEstado" = 4,  -- Estado 4 = Aprobado
                "ultimoComentario" = COALESCE(p_ultimocomentario, ''),
                "autorizo" = p_autorizo,
                "fecAutorizacion" = NOW()
            WHERE "idCxp" = p_idcxp;

            RETURN QUERY SELECT TRUE,
                'PAGO AUTORIZADO: Presupuesto disponible. ' ||
                'Gasto actual: $' || TO_CHAR(v_total_gastado_comprometido, '999,999,999.99') ||
                ' + Nuevo pago: $' || TO_CHAR(v_subtotal, '999,999,999.99') ||
                ' = $' || TO_CHAR(v_calculo_nuevo_total, '999,999,999.99') ||
                ' (Disponible: $' || TO_CHAR(v_presupuesto_acumulado, '999,999,999.99') || ')';
            RETURN;
        ELSE
            -- Presupuesto insuficiente, rechazar con mensaje específico
            RETURN QUERY SELECT FALSE,
                'PAGO RECHAZADO: Presupuesto insuficiente. ' ||
                'Gasto actual: $' || TO_CHAR(v_total_gastado_comprometido, '999,999,999.99') ||
                ' + Nuevo pago: $' || TO_CHAR(v_subtotal, '999,999,999.99') ||
                ' = $' || TO_CHAR(v_calculo_nuevo_total, '999,999,999.99') ||
                ' (Excede el presupuesto disponible: $' || TO_CHAR(v_presupuesto_acumulado, '999,999,999.99') ||
                '. Sobrepaso: $' || TO_CHAR(v_calculo_nuevo_total - v_presupuesto_acumulado, '999,999,999.99') || ')';
            RETURN;
        END IF;

        -- Confirmar transacción

    EXCEPTION
        WHEN OTHERS THEN
            -- Deshacer cambios en caso de error

            -- Retornar error genérico con información del error específico
            RETURN QUERY SELECT FALSE, 'ERROR INTERNO: ' || SQLERRM;
            RETURN;
    END;

END;

$function$$m4t$;

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
  EXECUTE $rv1$CREATE OR REPLACE VIEW public."v_resumenPresupuesto" WITH (security_invoker = on) AS
 WITH presupuestos AS (
         SELECT "PresDetalle"."idCategoria",
            sum(
                CASE
                    WHEN "PresDetalle".mes::numeric <= EXTRACT(month FROM now()) THEN "PresDetalle".monto
                    ELSE 0::double precision
                END) AS presupuesto_acumulado,
            sum("PresDetalle".monto) AS presupuesto_total_anual
           FROM "PresDetalle"
          WHERE "PresDetalle".anio::numeric = EXTRACT(year FROM now())
          GROUP BY "PresDetalle"."idCategoria"
        ), categorias AS (
         SELECT "PresCategorias"."idCategoria",
            "PresCategorias".presupuestable,
            "PresCategorias".status
           FROM "PresCategorias"
        ), gastos_autorizados AS (
         SELECT cxp."idCategoria",
            sum(cxp.subtotal) AS total_gastado,
            count(*) AS num_transacciones_autorizadas
           FROM cxp
          WHERE cxp."idEstado" = 6 AND EXTRACT(month FROM cxp."fecAutorizacion") <= EXTRACT(month FROM now()) AND EXTRACT(year FROM cxp."fecAutorizacion") = EXTRACT(year FROM now())
          GROUP BY cxp."idCategoria"
        ), gastos_aprobados AS (
         SELECT cxp."idCategoria",
            sum(cxp.subtotal) AS total_aprobado,
            count(*) AS num_transacciones_aprobadas
           FROM cxp
          WHERE cxp."idEstado" = 4 AND EXTRACT(month FROM cxp.fc) <= EXTRACT(month FROM now()) AND EXTRACT(year FROM cxp.fc) = EXTRACT(year FROM now())
          GROUP BY cxp."idCategoria"
        ), gastos_comprometidos_total AS (
         SELECT cxp."idCategoria",
            sum(cxp.subtotal) AS total_comprometido_completo,
            count(*) AS num_transacciones_comprometidas
           FROM cxp
          WHERE (cxp."idEstado" = ANY (ARRAY[4, 6])) AND (cxp."idEstado" = 6 AND EXTRACT(month FROM cxp."fecAutorizacion") <= EXTRACT(month FROM now()) AND EXTRACT(year FROM cxp."fecAutorizacion") = EXTRACT(year FROM now()) OR cxp."idEstado" = 4 AND EXTRACT(month FROM cxp.fc) <= EXTRACT(month FROM now()) AND EXTRACT(year FROM cxp.fc) = EXTRACT(year FROM now()))
          GROUP BY cxp."idCategoria"
        ), todas_categorias AS (
         SELECT presupuestos."idCategoria"
           FROM presupuestos
        UNION
         SELECT gastos_comprometidos_total."idCategoria"
           FROM gastos_comprometidos_total
        UNION
         SELECT categorias."idCategoria"
           FROM categorias
        )
 SELECT tc."idCategoria",
    COALESCE(cat.presupuestable, false) AS presupuestable,
    COALESCE(cat.status, false) AS status,
    COALESCE(p.presupuesto_acumulado, 0::double precision) AS presupuesto_acumulado,
    COALESCE(p.presupuesto_total_anual, 0::double precision) AS presupuesto_total_anual,
    COALESCE(ga.total_gastado, 0::double precision) AS subtotal_gastado,
    COALESCE(gap.total_aprobado, 0::double precision) AS subtotal_comprometido,
    COALESCE(ga.total_gastado, 0::double precision) + COALESCE(gap.total_aprobado, 0::double precision) AS total_gastado_comprometido,
        CASE
            WHEN COALESCE(gct.total_comprometido_completo, 0::double precision) <= COALESCE(p.presupuesto_acumulado, 0::double precision) THEN true
            ELSE false
        END AS dentro_presupuesto,
        CASE
            WHEN COALESCE(p.presupuesto_acumulado, 0::double precision) > 0::double precision THEN COALESCE(gct.total_comprometido_completo, 0::double precision) / p.presupuesto_acumulado
            WHEN COALESCE(p.presupuesto_acumulado, 0::double precision) = 0::double precision AND COALESCE(gct.total_comprometido_completo, 0::double precision) > 0::double precision THEN 999.99::double precision
            ELSE 0::double precision
        END AS avance_total,
        CASE
            WHEN COALESCE(p.presupuesto_acumulado, 0::double precision) > 0::double precision THEN COALESCE(ga.total_gastado, 0::double precision) / p.presupuesto_acumulado
            WHEN COALESCE(p.presupuesto_acumulado, 0::double precision) = 0::double precision AND COALESCE(ga.total_gastado, 0::double precision) > 0::double precision THEN 999.99::double precision
            ELSE 0::double precision
        END AS avance_acumulado,
        CASE
            WHEN COALESCE(p.presupuesto_acumulado, 0::double precision) > 0::double precision THEN COALESCE(gct.total_comprometido_completo, 0::double precision) / p.presupuesto_acumulado
            WHEN COALESCE(p.presupuesto_acumulado, 0::double precision) = 0::double precision AND COALESCE(gct.total_comprometido_completo, 0::double precision) > 0::double precision THEN 999.99::double precision
            ELSE 0::double precision
        END AS avance_comprometido,
        CASE
            WHEN COALESCE(p.presupuesto_total_anual, 0::double precision) > 0::double precision THEN COALESCE(ga.total_gastado, 0::double precision) / p.presupuesto_total_anual
            WHEN COALESCE(p.presupuesto_total_anual, 0::double precision) = 0::double precision AND COALESCE(ga.total_gastado, 0::double precision) > 0::double precision THEN 999.99::double precision
            ELSE 0::double precision
        END AS avance_vs_anual,
    COALESCE(p.presupuesto_acumulado, 0::double precision) - COALESCE(ga.total_gastado, 0::double precision) AS disponible_acumulado,
    COALESCE(p.presupuesto_acumulado, 0::double precision) - COALESCE(gct.total_comprometido_completo, 0::double precision) AS disponible_real,
    COALESCE(p.presupuesto_total_anual, 0::double precision) - COALESCE(ga.total_gastado, 0::double precision) AS disponible_anual,
    COALESCE(ga.num_transacciones_autorizadas, 0::bigint) AS transacciones_autorizadas,
    COALESCE(gct.num_transacciones_comprometidas, 0::bigint) AS transacciones_comprometidas,
        CASE
            WHEN EXTRACT(month FROM now()) > 0::numeric THEN COALESCE(ga.total_gastado, 0::double precision) / EXTRACT(month FROM now())::double precision
            ELSE 0::double precision
        END AS promedio_mensual_gastado,
        CASE
            WHEN EXTRACT(month FROM now()) > 0::numeric THEN COALESCE(ga.total_gastado, 0::double precision) / EXTRACT(month FROM now())::double precision * 12::double precision
            ELSE 0::double precision
        END AS proyeccion_gasto_anual,
        CASE
            WHEN COALESCE(ga.total_gastado, 0::double precision) = 0::double precision THEN 'SIN_GASTOS'::text
            WHEN COALESCE(p.presupuesto_acumulado, 0::double precision) = 0::double precision THEN 'SIN_PRESUPUESTO'::text
            WHEN (COALESCE(ga.total_gastado, 0::double precision) / p.presupuesto_acumulado) <= 0.5::double precision THEN 'BAJO'::text
            WHEN (COALESCE(ga.total_gastado, 0::double precision) / p.presupuesto_acumulado) <= 0.8::double precision THEN 'MODERADO'::text
            WHEN (COALESCE(ga.total_gastado, 0::double precision) / p.presupuesto_acumulado) <= 1.0::double precision THEN 'ALTO'::text
            ELSE 'EXCEDIDO'::text
        END AS estado_acumulado,
        CASE
            WHEN COALESCE(ga.total_gastado, 0::double precision) = 0::double precision THEN 'SIN_GASTOS'::text
            WHEN COALESCE(p.presupuesto_total_anual, 0::double precision) = 0::double precision THEN 'SIN_PRESUPUESTO'::text
            WHEN (COALESCE(ga.total_gastado, 0::double precision) / p.presupuesto_total_anual) <= 0.3::double precision THEN 'CONSERVADOR'::text
            WHEN (COALESCE(ga.total_gastado, 0::double precision) / p.presupuesto_total_anual) <= 0.6::double precision THEN 'NORMAL'::text
            WHEN (COALESCE(ga.total_gastado, 0::double precision) / p.presupuesto_total_anual) <= 0.9::double precision THEN 'ACELERADO'::text
            ELSE 'CRITICO'::text
        END AS estado_vs_anual,
        CASE
            WHEN COALESCE(gct.total_comprometido_completo, 0::double precision) = 0::double precision THEN 'SIN_COMPROMISOS'::text
            WHEN COALESCE(p.presupuesto_acumulado, 0::double precision) = 0::double precision THEN 'SIN_PRESUPUESTO'::text
            WHEN (COALESCE(gct.total_comprometido_completo, 0::double precision) / p.presupuesto_acumulado) <= 0.5::double precision THEN 'BAJO_COMPROMISO'::text
            WHEN (COALESCE(gct.total_comprometido_completo, 0::double precision) / p.presupuesto_acumulado) <= 0.8::double precision THEN 'MODERADO_COMPROMISO'::text
            WHEN (COALESCE(gct.total_comprometido_completo, 0::double precision) / p.presupuesto_acumulado) <= 1.0::double precision THEN 'ALTO_COMPROMISO'::text
            ELSE 'SOBRE_COMPROMETIDO'::text
        END AS estado_comprometido,
    12::numeric - EXTRACT(month FROM now()) AS meses_restantes,
        CASE
            WHEN (12::numeric - EXTRACT(month FROM now())) > 0::numeric AND COALESCE(p.presupuesto_total_anual, 0::double precision) > 0::double precision THEN (COALESCE(p.presupuesto_total_anual, 0::double precision) - COALESCE(ga.total_gastado, 0::double precision)) / (12::numeric - EXTRACT(month FROM now()))::double precision
            ELSE 0::double precision
        END AS presupuesto_mensual_restante,
        CASE
            WHEN COALESCE(p.presupuesto_total_anual, 0::double precision) > 0::double precision AND COALESCE(ga.total_gastado, 0::double precision) > 0::double precision THEN 'NORMAL'::text
            WHEN COALESCE(p.presupuesto_total_anual, 0::double precision) > 0::double precision AND COALESCE(ga.total_gastado, 0::double precision) = 0::double precision THEN 'PRESUPUESTO_SIN_USO'::text
            WHEN COALESCE(p.presupuesto_total_anual, 0::double precision) = 0::double precision AND COALESCE(ga.total_gastado, 0::double precision) > 0::double precision THEN 'ESPECIAL_SOLO_GASTOS'::text
            ELSE 'INACTIVA'::text
        END AS tipo_categoria
   FROM todas_categorias tc
     LEFT JOIN categorias cat ON tc."idCategoria" = cat."idCategoria"
     LEFT JOIN presupuestos p ON tc."idCategoria" = p."idCategoria"
     LEFT JOIN gastos_autorizados ga ON tc."idCategoria" = ga."idCategoria"
     LEFT JOIN gastos_aprobados gap ON tc."idCategoria" = gap."idCategoria"
     LEFT JOIN gastos_comprometidos_total gct ON tc."idCategoria" = gct."idCategoria"
  ORDER BY (
        CASE
            WHEN COALESCE(p.presupuesto_total_anual, 0::double precision) = 0::double precision AND COALESCE(gct.total_comprometido_completo, 0::double precision) > 0::double precision THEN 0
            ELSE 1
        END), (COALESCE(gct.total_comprometido_completo, 0::double precision)) DESC, (
        CASE
            WHEN COALESCE(p.presupuesto_acumulado, 0::double precision) > 0::double precision THEN COALESCE(gct.total_comprometido_completo, 0::double precision) / p.presupuesto_acumulado
            WHEN COALESCE(p.presupuesto_acumulado, 0::double precision) = 0::double precision AND COALESCE(gct.total_comprometido_completo, 0::double precision) > 0::double precision THEN 999.99::double precision
            ELSE 0::double precision
        END) DESC$rv1$;
  EXECUTE $rv2$CREATE OR REPLACE VIEW public.v_resumenpresupuesto WITH (security_invoker = on) AS
 WITH presupuestos AS (
         SELECT "PresDetalle"."idCategoria",
            sum(
                CASE
                    WHEN "PresDetalle".mes::numeric <= EXTRACT(month FROM now()) THEN "PresDetalle".monto
                    ELSE 0::double precision
                END) AS presupuesto_acumulado,
            sum("PresDetalle".monto) AS presupuesto_total_anual
           FROM "PresDetalle"
          WHERE "PresDetalle".anio::numeric = EXTRACT(year FROM now())
          GROUP BY "PresDetalle"."idCategoria"
        ), categorias AS (
         SELECT "PresCategorias"."idCategoria",
            "PresCategorias".presupuestable,
            "PresCategorias".status
           FROM "PresCategorias"
        ), gastos_autorizados AS (
         SELECT cxp."idCategoria",
            sum(cxp.subtotal) AS total_gastado,
            count(*) AS num_transacciones_autorizadas
           FROM cxp
          WHERE cxp."idEstado" = 6 AND EXTRACT(month FROM cxp."fecAutorizacion") <= EXTRACT(month FROM now()) AND EXTRACT(year FROM cxp."fecAutorizacion") = EXTRACT(year FROM now())
          GROUP BY cxp."idCategoria"
        ), gastos_aprobados AS (
         SELECT cxp."idCategoria",
            sum(cxp.subtotal) AS total_aprobado,
            count(*) AS num_transacciones_aprobadas
           FROM cxp
          WHERE cxp."idEstado" = 4 AND EXTRACT(month FROM cxp.fc) <= EXTRACT(month FROM now()) AND EXTRACT(year FROM cxp.fc) = EXTRACT(year FROM now())
          GROUP BY cxp."idCategoria"
        ), gastos_comprometidos_total AS (
         SELECT cxp."idCategoria",
            sum(cxp.subtotal) AS total_comprometido_completo,
            count(*) AS num_transacciones_comprometidas
           FROM cxp
          WHERE (cxp."idEstado" = ANY (ARRAY[4, 6])) AND (cxp."idEstado" = 6 AND EXTRACT(month FROM cxp."fecAutorizacion") <= EXTRACT(month FROM now()) AND EXTRACT(year FROM cxp."fecAutorizacion") = EXTRACT(year FROM now()) OR cxp."idEstado" = 4 AND EXTRACT(month FROM cxp.fc) <= EXTRACT(month FROM now()) AND EXTRACT(year FROM cxp.fc) = EXTRACT(year FROM now()))
          GROUP BY cxp."idCategoria"
        ), todas_categorias AS (
         SELECT presupuestos."idCategoria"
           FROM presupuestos
        UNION
         SELECT gastos_comprometidos_total."idCategoria"
           FROM gastos_comprometidos_total
        UNION
         SELECT categorias."idCategoria"
           FROM categorias
        )
 SELECT tc."idCategoria",
    COALESCE(cat.presupuestable, false) AS presupuestable,
    COALESCE(cat.status, false) AS status,
    COALESCE(p.presupuesto_acumulado, 0::double precision) AS presupuesto_acumulado,
    COALESCE(p.presupuesto_total_anual, 0::double precision) AS presupuesto_total_anual,
    COALESCE(ga.total_gastado, 0::double precision) AS subtotal_gastado,
    COALESCE(gap.total_aprobado, 0::double precision) AS subtotal_comprometido,
    COALESCE(ga.total_gastado, 0::double precision) + COALESCE(gap.total_aprobado, 0::double precision) AS total_gastado_comprometido,
        CASE
            WHEN COALESCE(gct.total_comprometido_completo, 0::double precision) <= COALESCE(p.presupuesto_acumulado, 0::double precision) THEN true
            ELSE false
        END AS dentro_presupuesto,
        CASE
            WHEN COALESCE(p.presupuesto_acumulado, 0::double precision) > 0::double precision THEN COALESCE(gct.total_comprometido_completo, 0::double precision) / p.presupuesto_acumulado
            WHEN COALESCE(p.presupuesto_acumulado, 0::double precision) = 0::double precision AND COALESCE(gct.total_comprometido_completo, 0::double precision) > 0::double precision THEN 999.99::double precision
            ELSE 0::double precision
        END AS avance_total,
        CASE
            WHEN COALESCE(p.presupuesto_acumulado, 0::double precision) > 0::double precision THEN COALESCE(ga.total_gastado, 0::double precision) / p.presupuesto_acumulado
            WHEN COALESCE(p.presupuesto_acumulado, 0::double precision) = 0::double precision AND COALESCE(ga.total_gastado, 0::double precision) > 0::double precision THEN 999.99::double precision
            ELSE 0::double precision
        END AS avance_acumulado,
        CASE
            WHEN COALESCE(p.presupuesto_acumulado, 0::double precision) > 0::double precision THEN COALESCE(gct.total_comprometido_completo, 0::double precision) / p.presupuesto_acumulado
            WHEN COALESCE(p.presupuesto_acumulado, 0::double precision) = 0::double precision AND COALESCE(gct.total_comprometido_completo, 0::double precision) > 0::double precision THEN 999.99::double precision
            ELSE 0::double precision
        END AS avance_comprometido,
        CASE
            WHEN COALESCE(p.presupuesto_total_anual, 0::double precision) > 0::double precision THEN COALESCE(ga.total_gastado, 0::double precision) / p.presupuesto_total_anual
            WHEN COALESCE(p.presupuesto_total_anual, 0::double precision) = 0::double precision AND COALESCE(ga.total_gastado, 0::double precision) > 0::double precision THEN 999.99::double precision
            ELSE 0::double precision
        END AS avance_vs_anual,
    COALESCE(p.presupuesto_acumulado, 0::double precision) - COALESCE(ga.total_gastado, 0::double precision) AS disponible_acumulado,
    COALESCE(p.presupuesto_acumulado, 0::double precision) - COALESCE(gct.total_comprometido_completo, 0::double precision) AS disponible_real,
    COALESCE(p.presupuesto_total_anual, 0::double precision) - COALESCE(ga.total_gastado, 0::double precision) AS disponible_anual,
    COALESCE(ga.num_transacciones_autorizadas, 0::bigint) AS transacciones_autorizadas,
    COALESCE(gct.num_transacciones_comprometidas, 0::bigint) AS transacciones_comprometidas,
        CASE
            WHEN EXTRACT(month FROM now()) > 0::numeric THEN COALESCE(ga.total_gastado, 0::double precision) / EXTRACT(month FROM now())::double precision
            ELSE 0::double precision
        END AS promedio_mensual_gastado,
        CASE
            WHEN EXTRACT(month FROM now()) > 0::numeric THEN COALESCE(ga.total_gastado, 0::double precision) / EXTRACT(month FROM now())::double precision * 12::double precision
            ELSE 0::double precision
        END AS proyeccion_gasto_anual,
        CASE
            WHEN COALESCE(ga.total_gastado, 0::double precision) = 0::double precision THEN 'SIN_GASTOS'::text
            WHEN COALESCE(p.presupuesto_acumulado, 0::double precision) = 0::double precision THEN 'SIN_PRESUPUESTO'::text
            WHEN (COALESCE(ga.total_gastado, 0::double precision) / p.presupuesto_acumulado) <= 0.5::double precision THEN 'BAJO'::text
            WHEN (COALESCE(ga.total_gastado, 0::double precision) / p.presupuesto_acumulado) <= 0.8::double precision THEN 'MODERADO'::text
            WHEN (COALESCE(ga.total_gastado, 0::double precision) / p.presupuesto_acumulado) <= 1.0::double precision THEN 'ALTO'::text
            ELSE 'EXCEDIDO'::text
        END AS estado_acumulado,
        CASE
            WHEN COALESCE(ga.total_gastado, 0::double precision) = 0::double precision THEN 'SIN_GASTOS'::text
            WHEN COALESCE(p.presupuesto_total_anual, 0::double precision) = 0::double precision THEN 'SIN_PRESUPUESTO'::text
            WHEN (COALESCE(ga.total_gastado, 0::double precision) / p.presupuesto_total_anual) <= 0.3::double precision THEN 'CONSERVADOR'::text
            WHEN (COALESCE(ga.total_gastado, 0::double precision) / p.presupuesto_total_anual) <= 0.6::double precision THEN 'NORMAL'::text
            WHEN (COALESCE(ga.total_gastado, 0::double precision) / p.presupuesto_total_anual) <= 0.9::double precision THEN 'ACELERADO'::text
            ELSE 'CRITICO'::text
        END AS estado_vs_anual,
        CASE
            WHEN COALESCE(gct.total_comprometido_completo, 0::double precision) = 0::double precision THEN 'SIN_COMPROMISOS'::text
            WHEN COALESCE(p.presupuesto_acumulado, 0::double precision) = 0::double precision THEN 'SIN_PRESUPUESTO'::text
            WHEN (COALESCE(gct.total_comprometido_completo, 0::double precision) / p.presupuesto_acumulado) <= 0.5::double precision THEN 'BAJO_COMPROMISO'::text
            WHEN (COALESCE(gct.total_comprometido_completo, 0::double precision) / p.presupuesto_acumulado) <= 0.8::double precision THEN 'MODERADO_COMPROMISO'::text
            WHEN (COALESCE(gct.total_comprometido_completo, 0::double precision) / p.presupuesto_acumulado) <= 1.0::double precision THEN 'ALTO_COMPROMISO'::text
            ELSE 'SOBRE_COMPROMETIDO'::text
        END AS estado_comprometido,
    12::numeric - EXTRACT(month FROM now()) AS meses_restantes,
        CASE
            WHEN (12::numeric - EXTRACT(month FROM now())) > 0::numeric AND COALESCE(p.presupuesto_total_anual, 0::double precision) > 0::double precision THEN (COALESCE(p.presupuesto_total_anual, 0::double precision) - COALESCE(ga.total_gastado, 0::double precision)) / (12::numeric - EXTRACT(month FROM now()))::double precision
            ELSE 0::double precision
        END AS presupuesto_mensual_restante,
        CASE
            WHEN COALESCE(p.presupuesto_total_anual, 0::double precision) > 0::double precision AND COALESCE(ga.total_gastado, 0::double precision) > 0::double precision THEN 'NORMAL'::text
            WHEN COALESCE(p.presupuesto_total_anual, 0::double precision) > 0::double precision AND COALESCE(ga.total_gastado, 0::double precision) = 0::double precision THEN 'PRESUPUESTO_SIN_USO'::text
            WHEN COALESCE(p.presupuesto_total_anual, 0::double precision) = 0::double precision AND COALESCE(ga.total_gastado, 0::double precision) > 0::double precision THEN 'ESPECIAL_SOLO_GASTOS'::text
            ELSE 'INACTIVA'::text
        END AS tipo_categoria
   FROM todas_categorias tc
     LEFT JOIN categorias cat ON tc."idCategoria" = cat."idCategoria"
     LEFT JOIN presupuestos p ON tc."idCategoria" = p."idCategoria"
     LEFT JOIN gastos_autorizados ga ON tc."idCategoria" = ga."idCategoria"
     LEFT JOIN gastos_aprobados gap ON tc."idCategoria" = gap."idCategoria"
     LEFT JOIN gastos_comprometidos_total gct ON tc."idCategoria" = gct."idCategoria"
  ORDER BY (
        CASE
            WHEN COALESCE(p.presupuesto_total_anual, 0::double precision) = 0::double precision AND COALESCE(gct.total_comprometido_completo, 0::double precision) > 0::double precision THEN 0
            ELSE 1
        END), (COALESCE(gct.total_comprometido_completo, 0::double precision)) DESC, (
        CASE
            WHEN COALESCE(p.presupuesto_acumulado, 0::double precision) > 0::double precision THEN COALESCE(gct.total_comprometido_completo, 0::double precision) / p.presupuesto_acumulado
            WHEN COALESCE(p.presupuesto_acumulado, 0::double precision) = 0::double precision AND COALESCE(gct.total_comprometido_completo, 0::double precision) > 0::double precision THEN 999.99::double precision
            ELSE 0::double precision
        END) DESC$rv2$;
  EXECUTE $rf$CREATE OR REPLACE FUNCTION public.cxp_autorizar_solicitud_pago(p_idcxp text, p_ultimocomentario text DEFAULT NULL::text, p_autorizo uuid DEFAULT NULL::uuid, p_uidsolicita uuid DEFAULT NULL::uuid)
 RETURNS TABLE(autorizado boolean, mensaje text)
 LANGUAGE plpgsql
AS $function$

DECLARE
    -- Variables para datos del CxP
    v_idcategoria TEXT;
    v_subtotal NUMERIC;
    v_estado_actual INTEGER;
    v_cxp_existe BOOLEAN := FALSE;

    -- Variables para datos de presupuesto
    v_categoria_activa BOOLEAN;
    v_presupuestable BOOLEAN;
    v_presupuesto_acumulado NUMERIC;
    v_total_gastado_comprometido NUMERIC;
    v_calculo_nuevo_total NUMERIC;

    -- Variables de control
    v_mensaje_error TEXT;
    v_autorizado BOOLEAN := FALSE;

    -- Variables para configuración
    v_uuid_aprobar_fp uuid;
    v_omitir_validacion_presupuesto BOOLEAN := FALSE;

    -- Cursor para obtener datos del CxP
    cursor_cxp CURSOR FOR
        SELECT "idCategoria", subtotal, "idEstado"
        FROM public.cxp
        WHERE "idCxp" = p_idcxp;

    -- Cursor para obtener datos de presupuesto
    cursor_presupuesto CURSOR FOR
        SELECT status, presupuestable, presupuesto_acumulado, total_gastado_comprometido
        FROM public.v_resumenPresupuesto
        WHERE "idCategoria" = v_idcategoria;

    -- Cursor para obtener configuración de aprobar fuera de presupuesto
    cursor_config_fp CURSOR FOR
        SELECT valor::uuid
        FROM public."SPHConfiguraciones"
        WHERE parametro = 'Aprobar fuera de presupuesto' AND status = true;
BEGIN
    -- [Fecha y Hora]: 20/11/2025 08:01:00
    -- [Descripción]: Función principal para autorizar solicitudes de pago con validación de presupuesto
    -- [Entrada]: p_idcxp (text) - ID de la cuenta por pagar a autorizar
    -- [Salida]: TABLE(autorizado boolean, mensaje text) - Resultado de la autorización con mensaje descriptivo
    -- [Uso]: SELECT * FROM cxp_autorizar_solicitud_pago('ID_CXP') AS (autorizado boolean, mensaje text);

    -- Iniciar transacción para asegurar atomicidad
    BEGIN

        -- 1. Validación de parámetros de entrada
        IF p_idcxp IS NULL OR TRIM(p_idcxp) = '' THEN
            RETURN QUERY SELECT FALSE, 'ERROR: El ID de CxP no puede ser nulo o vacío';
            RETURN;
        END IF;

        -- 2. Verificar existencia del CxP y obtener sus datos
        OPEN cursor_cxp;
        FETCH cursor_cxp INTO v_idcategoria, v_subtotal, v_estado_actual;

        IF NOT FOUND THEN
            CLOSE cursor_cxp;
            RETURN QUERY SELECT FALSE, 'ERROR: No existe una cuenta por pagar con el ID: ' || p_idcxp;
            RETURN;
        END IF;
        CLOSE cursor_cxp;

        -- Validar que el subtotal no sea nulo
        IF v_subtotal IS NULL THEN
            v_subtotal := 0;
        END IF;

        -- 3. Obtener configuración para aprobar fuera de presupuesto
        OPEN cursor_config_fp;
        FETCH cursor_config_fp INTO v_uuid_aprobar_fp;
        CLOSE cursor_config_fp;

        -- Verificar si se debe omitir la validación de presupuesto
        IF v_uuid_aprobar_fp IS NOT NULL AND p_autorizo IS NOT NULL THEN
            v_omitir_validacion_presupuesto := (p_autorizo = v_uuid_aprobar_fp);
        END IF;

        -- 4. Obtener información de presupuesto desde la vista
        OPEN cursor_presupuesto;
        FETCH cursor_presupuesto INTO v_categoria_activa, v_presupuestable, v_presupuesto_acumulado, v_total_gastado_comprometido;

        IF NOT FOUND THEN
            CLOSE cursor_presupuesto;
            RETURN QUERY SELECT FALSE, 'ERROR: No se encontró información de presupuesto para la categoría: ' || COALESCE(v_idcategoria, 'SIN CATEGORÍA');
            RETURN;
        END IF;
        CLOSE cursor_presupuesto;

        -- 5. Validar que la categoría esté activa
        IF NOT v_categoria_activa THEN
            -- Mensaje especial para categoría no clasificada ("-")
            IF v_idcategoria = '-' THEN
                RETURN QUERY SELECT FALSE, 'ERROR: El gasto no está clasificado correctamente (categoría "-"). Por favor, clasifique el gasto asignando una categoría válida antes de autorizar el pago.';
            ELSE
                RETURN QUERY SELECT FALSE, 'ERROR: La categoría "' || v_idcategoria || '" no está activa. No se puede autorizar el pago.';
            END IF;
            RETURN;
        END IF;

        -- 6. Determinar si aplica validación de presupuesto
        IF NOT v_presupuestable OR v_omitir_validacion_presupuesto THEN
            -- Si no es presupuestable o el usuario está autorizado para omitir validación, autorizar directamente
            UPDATE public.cxp
            SET "idEstado" = 4,  -- Estado 4 = Aprobado
                "ultimoComentario" = COALESCE(p_ultimocomentario, ''),
                "autorizo" = p_autorizo,
                "fecAutorizacion" = NOW()
            WHERE "idCxp" = p_idcxp;

            IF v_omitir_validacion_presupuesto THEN
                RETURN QUERY SELECT TRUE, 'PAGO AUTORIZADO: Usuario autorizado para omitir validación de presupuesto. Categoría "' || v_idcategoria || '".';
            ELSE
                RETURN QUERY SELECT TRUE, 'PAGO AUTORIZADO: La categoría "' || v_idcategoria || '" no es presupuestable. Se autoriza directamente.';
            END IF;
            RETURN;
        END IF;

        -- 7. Aplicar validación de presupuesto (solo si presupuestable = true y no se omite validación)

        -- Validar que los valores de presupuesto no sean nulos
        IF v_presupuesto_acumulado IS NULL THEN
            v_presupuesto_acumulado := 0;
        END IF;

        IF v_total_gastado_comprometido IS NULL THEN
            v_total_gastado_comprometido := 0;
        END IF;

        -- Calcular nuevo total: presupuesto_gastado_comprometido + cxp.subtotal
        v_calculo_nuevo_total := v_total_gastado_comprometido + v_subtotal;

        -- Comparar contra presupuesto acumulado
        IF v_calculo_nuevo_total <= v_presupuesto_acumulado THEN
            -- Hay presupuesto disponible, autorizar
            UPDATE public.cxp
            SET "idEstado" = 4,  -- Estado 4 = Aprobado
                "ultimoComentario" = COALESCE(p_ultimocomentario, ''),
                "autorizo" = p_autorizo,
                "fecAutorizacion" = NOW()
            WHERE "idCxp" = p_idcxp;

            RETURN QUERY SELECT TRUE,
                'PAGO AUTORIZADO: Presupuesto disponible. ' ||
                'Gasto actual: $' || TO_CHAR(v_total_gastado_comprometido, '999,999,999.99') ||
                ' + Nuevo pago: $' || TO_CHAR(v_subtotal, '999,999,999.99') ||
                ' = $' || TO_CHAR(v_calculo_nuevo_total, '999,999,999.99') ||
                ' (Disponible: $' || TO_CHAR(v_presupuesto_acumulado, '999,999,999.99') || ')';
            RETURN;
        ELSE
            -- Presupuesto insuficiente, rechazar con mensaje específico
            RETURN QUERY SELECT FALSE,
                'PAGO RECHAZADO: Presupuesto insuficiente. ' ||
                'Gasto actual: $' || TO_CHAR(v_total_gastado_comprometido, '999,999,999.99') ||
                ' + Nuevo pago: $' || TO_CHAR(v_subtotal, '999,999,999.99') ||
                ' = $' || TO_CHAR(v_calculo_nuevo_total, '999,999,999.99') ||
                ' (Excede el presupuesto disponible: $' || TO_CHAR(v_presupuesto_acumulado, '999,999,999.99') ||
                '. Sobrepaso: $' || TO_CHAR(v_calculo_nuevo_total - v_presupuesto_acumulado, '999,999,999.99') || ')';
            RETURN;
        END IF;

        -- Confirmar transacción
        COMMIT;

    EXCEPTION
        WHEN OTHERS THEN
            -- Deshacer cambios en caso de error
            ROLLBACK;

            -- Retornar error genérico con información del error específico
            RETURN QUERY SELECT FALSE, 'ERROR INTERNO: ' || SQLERRM;
            RETURN;
    END;

END;

$function$$rf$;
  SELECT regexp_replace(pg_get_functiondef('public.cxp_autorizar_solicitud_pago(text,text,uuid,uuid)'::regprocedure), '\s+', '', 'g') INTO f_reversa;
  res := res || jsonb_build_object(
    'reversa_vistas_md5_igual', (SELECT bool_and(a.md5def = md5(pg_get_viewdef(c.oid, true))) FROM v_meta_antes a JOIN pg_class c ON c.relname = a.relname JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'),
    'reversa_vistas_opciones_y_grants_iguales', (SELECT bool_and(a.opciones IS NOT DISTINCT FROM c.reloptions::text AND a.acl IS NOT DISTINCT FROM c.relacl::text) FROM v_meta_antes a JOIN pg_class c ON c.relname = a.relname JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'),
    'reversa_funcion_igual', (f_antes = f_reversa));

  RAISE EXCEPTION 'REPORTE_PRUEBA: %', res::text;
END
$do$;
