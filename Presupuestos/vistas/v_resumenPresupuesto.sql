--[Fecha y Hora]: 30/10/2025 01:31:00
--[Descripción]: Vista que proporciona un resumen completo del estado de presupuestos por categoría,
--                incluyendo comparativas entre lo presupuestado, lo gastado y lo comprometido.
--                Calcula indicadores clave de desempeño y estados de alerta para el control presupuestario.
--
--[Salida]:
--   - idCategoria (text): Identificador único de la categoría
--   - presupuestable (boolean): Indica si la categoría es presupuestable o no
--   - presupuesto_acumulado (double precision): Presupuesto acumulado hasta el mes actual
--   - presupuesto_total_anual (double precision): Presupuesto total anual
--   - subtotal_gastado (double precision): Total de gastos autorizados (estado 6)
--   - subtotal_comprometido (double precision): Total de gastos aprobados (estado 4)
--   - total_gastado_comprometido (double precision): Suma de gastos autorizados y aprobados
--   - dentro_presupuesto (boolean): Indica si los gastos están dentro del presupuesto acumulado
--   - avance_total (double precision): Porcentaje de avance total vs presupuesto acumulado
--   - avance_acumulado (double precision): Porcentaje de avance de gastos autorizados vs presupuesto acumulado
--   - avance_comprometido (double precision): Porcentaje de avance de compromisos vs presupuesto acumulado
--   - avance_vs_anual (double precision): Porcentaje de avance de gastos vs presupuesto anual
--   - disponible_acumulado (double precision): Presupuesto acumulado menos gastos autorizados
--   - disponible_real (double precision): Presupuesto acumulado menos total comprometido
--   - disponible_anual (double precision): Presupuesto anual menos gastos autorizados
--   - transacciones_autorizadas (bigint): Número de transacciones con estado autorizado (6)
--   - transacciones_comprometidas (bigint): Número total de transacciones comprometidas
--   - promedio_mensual_gastado (double precision): Promedio mensual de gastos autorizados
--   - proyeccion_gasto_anual (double precision): Proyección de gasto anual basada en el promedio mensual
--   - estado_acumulado (text): Estado del gasto acumulado (SIN_GASTOS, BAJO, MODERADO, ALTO, EXCEDIDO)
--   - estado_vs_anual (text): Estado vs presupuesto anual (CONSERVADOR, NORMAL, ACELERADO, CRITICO)
--   - estado_comprometido (text): Estado de compromisos (SIN_COMPROMISOS, BAJO_COMPROMISO, MODERADO_COMPROMISO, ALTO_COMPROMISO, SOBRE_COMPROMETIDO)
--   - meses_restantes (numeric): Número de meses restantes en el año
--   - presupuesto_mensual_restante (double precision): Presupuesto mensual disponible para los meses restantes
--   - tipo_categoria (text): Tipo de categoría (NORMAL, PRESUPUESTO_SIN_USO, ESPECIAL_SOLO_GASTOS, INACTIVA)
--
--[Uso típico]: Consulta principal para dashboard de control presupuestario y reportes gerenciales.
--               Permite monitorear el estado de todas las categorías presupuestarias en tiempo real.
--
--[Ejemplo]:
--   SELECT * FROM public.v_resumenPresupuesto
--   WHERE estado_acumulado = 'EXCEDIDO' AND presupuestable = true
--   ORDER BY avance_acumulado DESC;
--
--[Relaciones]:
--   - Tablas base: "PresDetalle", cxp, "PresCategorias"
--   - Campos clave: "idCategoria", mes, anio, "idEstado", "fecAutorizacion", fc, presupuestable
--
--[Validaciones]:
--   - Filtra categorías sin presupuesto ni gastos
--   - Considera solo gastos del año actual
--   - Calcula acumulados hasta el mes actual
--   - Maneja divisiones por cero en cálculos de porcentajes
--   - Incluye solo categorías presupuestables en análisis principales

CREATE OR REPLACE VIEW public.v_resumenPresupuesto AS
WITH presupuestos AS (
         SELECT "PresDetalle"."idCategoria",
            sum(
                CASE
                    WHEN (("PresDetalle".mes)::numeric <= EXTRACT(month FROM now())) THEN "PresDetalle".monto
                    ELSE (0)::double precision
                END) AS presupuesto_acumulado,
            sum("PresDetalle".monto) AS presupuesto_total_anual
           FROM "PresDetalle"
          WHERE (("PresDetalle".anio)::numeric = EXTRACT(year FROM now()))
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
          WHERE ((cxp."idEstado" = 6) AND (EXTRACT(month FROM cxp."fecAutorizacion") <= EXTRACT(month FROM now())) AND (EXTRACT(year FROM cxp."fecAutorizacion") = EXTRACT(year FROM now())))
          GROUP BY cxp."idCategoria"
        ), gastos_aprobados AS (
         SELECT cxp."idCategoria",
            sum(cxp.subtotal) AS total_aprobado,
            count(*) AS num_transacciones_aprobadas
           FROM cxp
          WHERE ((cxp."idEstado" = 4) AND (EXTRACT(month FROM cxp.fc) <= EXTRACT(month FROM now())) AND (EXTRACT(year FROM cxp.fc) = EXTRACT(year FROM now())))
          GROUP BY cxp."idCategoria"
        ), gastos_comprometidos_total AS (
         SELECT cxp."idCategoria",
            sum(cxp.subtotal) AS total_comprometido_completo,
            count(*) AS num_transacciones_comprometidas
           FROM cxp
          WHERE ((cxp."idEstado" = ANY (ARRAY[4, 6])) AND (((cxp."idEstado" = 6) AND (EXTRACT(month FROM cxp."fecAutorizacion") <= EXTRACT(month FROM now())) AND (EXTRACT(year FROM cxp."fecAutorizacion") = EXTRACT(year FROM now()))) OR ((cxp."idEstado" = 4) AND (EXTRACT(month FROM cxp.fc) <= EXTRACT(month FROM now())) AND (EXTRACT(year FROM cxp.fc) = EXTRACT(year FROM now())))))
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
    COALESCE(p.presupuesto_acumulado, (0)::double precision) AS presupuesto_acumulado,
    COALESCE(p.presupuesto_total_anual, (0)::double precision) AS presupuesto_total_anual,
    COALESCE(ga.total_gastado, (0)::double precision) AS subtotal_gastado,
    COALESCE(gap.total_aprobado, (0)::double precision) AS subtotal_comprometido,
    (COALESCE(ga.total_gastado, (0)::double precision) + COALESCE(gap.total_aprobado, (0)::double precision)) AS total_gastado_comprometido,
        CASE
            WHEN (COALESCE(gct.total_comprometido_completo, (0)::double precision) <= COALESCE(p.presupuesto_acumulado, (0)::double precision)) THEN true
            ELSE false
        END AS dentro_presupuesto,
        CASE
            WHEN (COALESCE(p.presupuesto_acumulado, (0)::double precision) > (0)::double precision) THEN (COALESCE(gct.total_comprometido_completo, (0)::double precision) / p.presupuesto_acumulado)
            WHEN ((COALESCE(p.presupuesto_acumulado, (0)::double precision) = (0)::double precision) AND (COALESCE(gct.total_comprometido_completo, (0)::double precision) > (0)::double precision)) THEN (999.99)::double precision
            ELSE (0)::double precision
        END AS avance_total,
        CASE
            WHEN (COALESCE(p.presupuesto_acumulado, (0)::double precision) > (0)::double precision) THEN (COALESCE(ga.total_gastado, (0)::double precision) / p.presupuesto_acumulado)
            WHEN ((COALESCE(p.presupuesto_acumulado, (0)::double precision) = (0)::double precision) AND (COALESCE(ga.total_gastado, (0)::double precision) > (0)::double precision)) THEN (999.99)::double precision
            ELSE (0)::double precision
        END AS avance_acumulado,
        CASE
            WHEN (COALESCE(p.presupuesto_acumulado, (0)::double precision) > (0)::double precision) THEN (COALESCE(gct.total_comprometido_completo, (0)::double precision) / p.presupuesto_acumulado)
            WHEN ((COALESCE(p.presupuesto_acumulado, (0)::double precision) = (0)::double precision) AND (COALESCE(gct.total_comprometido_completo, (0)::double precision) > (0)::double precision)) THEN (999.99)::double precision
            ELSE (0)::double precision
        END AS avance_comprometido,
        CASE
            WHEN (COALESCE(p.presupuesto_total_anual, (0)::double precision) > (0)::double precision) THEN (COALESCE(ga.total_gastado, (0)::double precision) / p.presupuesto_total_anual)
            WHEN ((COALESCE(p.presupuesto_total_anual, (0)::double precision) = (0)::double precision) AND (COALESCE(ga.total_gastado, (0)::double precision) > (0)::double precision)) THEN (999.99)::double precision
            ELSE (0)::double precision
        END AS avance_vs_anual,
    (COALESCE(p.presupuesto_acumulado, (0)::double precision) - COALESCE(ga.total_gastado, (0)::double precision)) AS disponible_acumulado,
    (COALESCE(p.presupuesto_acumulado, (0)::double precision) - COALESCE(gct.total_comprometido_completo, (0)::double precision)) AS disponible_real,
    (COALESCE(p.presupuesto_total_anual, (0)::double precision) - COALESCE(ga.total_gastado, (0)::double precision)) AS disponible_anual,
    COALESCE(ga.num_transacciones_autorizadas, (0)::bigint) AS transacciones_autorizadas,
    COALESCE(gct.num_transacciones_comprometidas, (0)::bigint) AS transacciones_comprometidas,
        CASE
            WHEN (EXTRACT(month FROM now()) > (0)::numeric) THEN (COALESCE(ga.total_gastado, (0)::double precision) / (EXTRACT(month FROM now()))::double precision)
            ELSE (0)::double precision
        END AS promedio_mensual_gastado,
        CASE
            WHEN (EXTRACT(month FROM now()) > (0)::numeric) THEN ((COALESCE(ga.total_gastado, (0)::double precision) / (EXTRACT(month FROM now()))::double precision) * (12)::double precision)
            ELSE (0)::double precision
        END AS proyeccion_gasto_anual,
        CASE
            WHEN (COALESCE(ga.total_gastado, (0)::double precision) = (0)::double precision) THEN 'SIN_GASTOS'::text
            WHEN (COALESCE(p.presupuesto_acumulado, (0)::double precision) = (0)::double precision) THEN 'SIN_PRESUPUESTO'::text
            WHEN ((COALESCE(ga.total_gastado, (0)::double precision) / p.presupuesto_acumulado) <= (0.5)::double precision) THEN 'BAJO'::text
            WHEN ((COALESCE(ga.total_gastado, (0)::double precision) / p.presupuesto_acumulado) <= (0.8)::double precision) THEN 'MODERADO'::text
            WHEN ((COALESCE(ga.total_gastado, (0)::double precision) / p.presupuesto_acumulado) <= (1.0)::double precision) THEN 'ALTO'::text
            ELSE 'EXCEDIDO'::text
        END AS estado_acumulado,
        CASE
            WHEN (COALESCE(ga.total_gastado, (0)::double precision) = (0)::double precision) THEN 'SIN_GASTOS'::text
            WHEN (COALESCE(p.presupuesto_total_anual, (0)::double precision) = (0)::double precision) THEN 'SIN_PRESUPUESTO'::text
            WHEN ((COALESCE(ga.total_gastado, (0)::double precision) / p.presupuesto_total_anual) <= (0.3)::double precision) THEN 'CONSERVADOR'::text
            WHEN ((COALESCE(ga.total_gastado, (0)::double precision) / p.presupuesto_total_anual) <= (0.6)::double precision) THEN 'NORMAL'::text
            WHEN ((COALESCE(ga.total_gastado, (0)::double precision) / p.presupuesto_total_anual) <= (0.9)::double precision) THEN 'ACELERADO'::text
            ELSE 'CRITICO'::text
        END AS estado_vs_anual,
        CASE
            WHEN (COALESCE(gct.total_comprometido_completo, (0)::double precision) = (0)::double precision) THEN 'SIN_COMPROMISOS'::text
            WHEN (COALESCE(p.presupuesto_acumulado, (0)::double precision) = (0)::double precision) THEN 'SIN_PRESUPUESTO'::text
            WHEN ((COALESCE(gct.total_comprometido_completo, (0)::double precision) / p.presupuesto_acumulado) <= (0.5)::double precision) THEN 'BAJO_COMPROMISO'::text
            WHEN ((COALESCE(gct.total_comprometido_completo, (0)::double precision) / p.presupuesto_acumulado) <= (0.8)::double precision) THEN 'MODERADO_COMPROMISO'::text
            WHEN ((COALESCE(gct.total_comprometido_completo, (0)::double precision) / p.presupuesto_acumulado) <= (1.0)::double precision) THEN 'ALTO_COMPROMISO'::text
            ELSE 'SOBRE_COMPROMETIDO'::text
        END AS estado_comprometido,
    ((12)::numeric - EXTRACT(month FROM now())) AS meses_restantes,
        CASE
            WHEN ((((12)::numeric - EXTRACT(month FROM now())) > (0)::numeric) AND (COALESCE(p.presupuesto_total_anual, (0)::double precision) > (0)::double precision)) THEN ((COALESCE(p.presupuesto_total_anual, (0)::double precision) - COALESCE(ga.total_gastado, (0)::double precision)) / (((12)::numeric - EXTRACT(month FROM now())))::double precision)
            ELSE (0)::double precision
        END AS presupuesto_mensual_restante,
        CASE
            WHEN ((COALESCE(p.presupuesto_total_anual, (0)::double precision) > (0)::double precision) AND (COALESCE(ga.total_gastado, (0)::double precision) > (0)::double precision)) THEN 'NORMAL'::text
            WHEN ((COALESCE(p.presupuesto_total_anual, (0)::double precision) > (0)::double precision) AND (COALESCE(ga.total_gastado, (0)::double precision) = (0)::double precision)) THEN 'PRESUPUESTO_SIN_USO'::text
            WHEN ((COALESCE(p.presupuesto_total_anual, (0)::double precision) = (0)::double precision) AND (COALESCE(ga.total_gastado, (0)::double precision) > (0)::double precision)) THEN 'ESPECIAL_SOLO_GASTOS'::text
            ELSE 'INACTIVA'::text
        END AS tipo_categoria
   FROM (((((todas_categorias tc
     LEFT JOIN categorias cat ON ((tc."idCategoria" = cat."idCategoria")))
     LEFT JOIN presupuestos p ON ((tc."idCategoria" = p."idCategoria")))
     LEFT JOIN gastos_autorizados ga ON ((tc."idCategoria" = ga."idCategoria")))
     LEFT JOIN gastos_aprobados gap ON ((tc."idCategoria" = gap."idCategoria")))
     LEFT JOIN gastos_comprometidos_total gct ON ((tc."idCategoria" = gct."idCategoria")))
  -- Se eliminó el filtro para incluir TODAS las categorías, incluso las sin presupuesto ni gastos
  ORDER BY
        CASE
            WHEN ((COALESCE(p.presupuesto_total_anual, (0)::double precision) = (0)::double precision) AND (COALESCE(gct.total_comprometido_completo, (0)::double precision) > (0)::double precision)) THEN 0
            ELSE 1
        END, COALESCE(gct.total_comprometido_completo, (0)::double precision) DESC,
        CASE
            WHEN (COALESCE(p.presupuesto_acumulado, (0)::double precision) > (0)::double precision) THEN (COALESCE(gct.total_comprometido_completo, (0)::double precision) / p.presupuesto_acumulado)
            WHEN ((COALESCE(p.presupuesto_acumulado, (0)::double precision) = (0)::double precision) AND (COALESCE(gct.total_comprometido_completo, (0)::double precision) > (0)::double precision)) THEN (999.99)::double precision
            ELSE (0)::double precision
        END DESC;