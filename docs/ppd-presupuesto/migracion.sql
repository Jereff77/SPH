-- =====================================================================================
-- PPD y presupuesto (tablero #77, Paquete 2). Reglas de Jereff 2026-11-17 (ver 00-brief-conceptual.md).
-- NO APLICADO. Validado por Opus: APLICABLE CON CORRECCIONES (ya incorporadas: ppd_saldo sin NOT EXISTS, bloqueo en todas las ramas, guarda en cxp_subtotal_igual_total,
-- índice, reversas y aplicación en UNA sola transacción: `aplicar.sql`, generado por `generar-prueba.cjs` con estos mismos bloques). Pasos:
--   M-PPD-1 trigger que asigna el subtotal al pagar (vacío si no está pagada)
--   M-PPD-2 corrección de datos (idempotente)
--   M-PPD-3 las dos vistas de presupuesto suman el saldo apartado de las facturas PPD
--   M-PPD-4 función cxp_autorizar_solicitud_pago: la primera aprobación de una factura valida la base completa
-- Aplicar FUERA del horario de captura. Reversa literal al final de cada paso.
-- =====================================================================================


-- =====================================================================================
-- M-PPD-1 · Trigger del subtotal de las parcialidades PPD
-- =====================================================================================
SET LOCAL lock_timeout = '5s';

-- >>> M1
CREATE OR REPLACE FUNCTION public.cxp_ppd_subtotal_al_pagar()
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
$$;
-- <<< M1

-- REVERSA M-PPD-1 (en este orden): restaurar cxp_subtotal_igual_total sin la condición «AND NEW."idCxpPPD" IS NULL», DROP INDEX IF EXISTS cxp_idcxpppd_idx y:
--   SET LOCAL lock_timeout = '5s';
--   DROP TRIGGER IF EXISTS trg_cxp_ppd_subtotal ON public.cxp;
--   DROP FUNCTION IF EXISTS public.cxp_ppd_subtotal_al_pagar();


-- =====================================================================================
-- M-PPD-2 · Corrección de datos (idempotente). Se dispara el trigger con un UPDATE sin cambio de valor.
-- =====================================================================================
SET LOCAL lock_timeout = '5s';

-- >>> M2
-- (a) Pagadas en pesos sin subtotal: el trigger lo calcula (20 filas al 2026-11-17).
UPDATE public.cxp
   SET "idEstado" = "idEstado"
 WHERE "idCxpPPD" IS NOT NULL AND status IS TRUE AND "idEstado" = 6
   AND COALESCE(moneda, 'MXN') = 'MXN' AND COALESCE(subtotal, 0) = 0;

-- (b) No pagadas (o dadas de baja) con subtotal: el trigger lo deja vacío (≈23 filas al 2026-11-17).
UPDATE public.cxp
   SET "idEstado" = "idEstado"
 WHERE "idCxpPPD" IS NOT NULL AND COALESCE(moneda, 'MXN') = 'MXN'
   AND subtotal IS NOT NULL AND ("idEstado" <> 6 OR status IS NOT TRUE);

-- <<< M2
-- Verificación (debe dar 0 y 0):
--   SELECT count(*) FROM cxp WHERE "idCxpPPD" IS NOT NULL AND status IS TRUE AND "idEstado"=6 AND COALESCE(moneda,'MXN')='MXN' AND COALESCE(subtotal,0)=0
--      AND EXISTS (SELECT 1 FROM cxp_ppd m WHERE m."idCxpPPD"=cxp."idCxpPPD" AND m.subtotal>0);
--   SELECT count(*) FROM cxp WHERE "idCxpPPD" IS NOT NULL AND COALESCE(moneda,'MXN')='MXN' AND subtotal IS NOT NULL AND ("idEstado"<>6 OR status IS NOT TRUE)
--      AND EXISTS (SELECT 1 FROM cxp_ppd m WHERE m."idCxpPPD"=cxp."idCxpPPD" AND m.subtotal>0);
-- REVERSA M-PPD-2: restaurar los valores anteriores con el script `reversa-datos.sql` (generado antes de aplicar).


-- =====================================================================================
-- M-PPD-3 · Vistas de presupuesto: suman el saldo apartado de las facturas PPD
-- (misma lista de columnas y tipos; WITH (security_invoker = on) se repite a propósito: sin él, CREATE OR REPLACE VIEW lo reinicia — hallado en la prueba en seco; los GRANT se conservan)
-- =====================================================================================
SET LOCAL lock_timeout = '5s';

-- >>> M3
CREATE OR REPLACE VIEW public."v_resumenPresupuesto" WITH (security_invoker = on) AS
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
        END) DESC;

-- La copia en minúsculas que lee la función de aprobación pasa a ser un espejo de la principal (nunca divergen).
CREATE OR REPLACE VIEW public.v_resumenpresupuesto WITH (security_invoker = on) AS
 SELECT * FROM public."v_resumenPresupuesto";

-- <<< M3
-- REVERSA M-PPD-3: restaurar las dos vistas con su definición anterior (idénticas entre sí, md5 ee8d6bd33bd84eb0f3f1ca38da01eb0e):
--   el texto está en `reversa-vistas.sql` (generado por generar-prueba.cjs y verificado en la prueba en seco: tras revertir, el md5 de pg_get_viewdef es el de antes). Orden: primero la principal, luego la copia.
