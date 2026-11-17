# Plan v2 (REVISADO): Reporte "Presupuesto" en CxP → Reportes (gastos vs presupuesto)

> **Estado:** PENDIENTE de implementar. Diseño acordado con Jereff + **revisión adversarial multi-agente**
> (verificado contra código real y BD de producción en modo SELECT). Listo para que un ejecutor
> (Sonnet 5) lo implemente **sin tomar decisiones de arquitectura**.
>
> ⚠️ **Actualización 2026-11-04:** la función de presupuesto por año (A.1) y el wrapper de la vista (A.2) de este plan
> quedan **absorbidos** por el paquete `docs/presupuesto-anual-y-ajustes/` (función única
> `cxp_resumen_presupuesto_por_anio`, «solo anual», ajuste 98 y F0: urgentes/líneas que consumen presupuesto).
> **No implementar este plan por separado**: se construye con las fases F1/F2 de ese paquete, que además cuentan
> los estados 7 y 99 y corrigen las 86 filas con `subtotal = 0`. La pestaña «Presupuesto» de Reportes (§C) sigue
> sin construir y no está en el tablero.
>
> Origen: solicitud "crear un reporte en CxP que compare gastos vs presupuestos" (2026-07-02).
> Diseño v1: Claude (Toribio, Sonnet 5). Revisión + rediseño v2: Claude (Toribio, Opus 4.8).

---

## 0. Historial de revisión — qué cambió en v2 respecto a v1 y por qué

La revisión adversarial (verificando el plan contra la BD real y el código) encontró que v1, aunque
sólido, tenía **1 vicio de seguridad reintroducido**, **1 bug de ejecución** y decisiones de negocio
sin cerrar. Jereff resolvió las decisiones de negocio y esta v2 incorpora todo:

| # | Cambio en v2 | Motivo |
|---|---|---|
| 1 | **Se agregan `REVOKE`/`GRANT` a ambas funciones** (§A.5) | v1 decía "igual patrón que las RPCs de v1" — ese es el patrón **inseguro** (P1-4 de la auditoría: funciones ejecutables por `anon`/`authenticated`). El proyecto ya migró al patrón `REVOKE ... FROM public, anon, authenticated` + `GRANT ... TO service_role`. **Obligatorio.** |
| 2 | **`uidResponsable` se devuelve con `::text`** (§A.1) | La columna real es `uuid` (NOT NULL). v1 la declaraba `text` sin cast → la función truena en la 1ª ejecución (`structure of query does not match function result type`). |
| 3 | **El cálculo incluye estados 7 y 99** (§A.1, §A.3) | **Decisión de Jereff: "Incluir 99 y también 7".** El reporte de gerencia no debe esconder $6.57M (estado 99, Aprobado sin pago) ni $99K (estado 7, Pago T. Bancaria). |
| 4 | **`v_resumenPresupuesto` se refactoriza a wrapper** de la función nueva (§A.2) | **Decisión de Jereff: "Refactor a wrapper ahora".** Una sola fuente de verdad → el modal de Aprobar Solicitudes y el reporte **siempre cuadran**. ⚠️ Cambia el comportamiento de producción (§D). |
| 5 | **La función devuelve las 26 columnas de la vista original** (+4 de identidad) | Para que el wrapper sea 100% compatible con `aprobacion.service.ts` (que hace `.select()` de 8 columnas nombradas). Sin esto, el wrapper rompe la aprobación. |
| 6 | **Filtro "Año" = `SearchSelect` de opción única**, no `InputFecha` (§C) | v1 lo encasillaba mal junto a `InputFecha` (input de calendario). El año es una lista de opciones. |
| 7 | **Colores del gráfico cubren los 6 estados** (§C) | v1 solo definía BAJO/MODERADO/ALTO/EXCEDIDO; faltaban `SIN_GASTOS`/`SIN_PRESUPUESTO` (gris). |
| 8 | **Índices marcados OPCIONALES** (§A.4) | `cxp` tiene ~1,839 filas: el seq scan es trivial hoy. No es el vicio de rendimiento P2-1 (falsa alarma). Se agregan solo si la tabla crece. |
| 9 | **Fix `variable_conflict`**: se califican las referencias a `idCategoria` en el CTE `todas_categorias` (§A.1) | Esta BD tiene `plpgsql.variable_conflict=error`; `"idCategoria"` pelado choca con el parámetro OUT → la función **truena en la 1ª ejecución** (el `CREATE` pasa sin error; el 1er `SELECT` revienta con *"ambiguous"*). Habría roto el wrapper y 3 superficies de producción. |
| 10 | **`GRANT EXECUTE ... TO v2_agente_ro`** (§A.5) + **`WITH (security_invoker = true)`** en el wrapper (§A.2) | La vista es `security_invoker=on` y la consume el agente Montse con el rol `v2_agente_ro` (no es `service_role`): sin el GRANT, Montse truena; sin preservar `security_invoker`, se invierte la postura de seguridad de la vista. |
| 11 | **Inventario de consumidores corregido** (§1, §D): NO era solo aprobación | La vista la consumen además **Configuraciones→Cuentas** (`parametros.service.ts`) y el **agente Montse**. §D ahora prueba los 3. |

---

## 1. Contexto

El módulo **CxP → Reportes** (permiso **460**, ruta `/cxp/reportes`) hoy solo tiene la pestaña
**"Estado de Cuenta"** (✅). Se agrega una segunda pestaña **"Presupuesto"**.

Objetos de presupuesto ya existentes en BD:
- **`PresCategorias`** — catálogo de categorías presupuestales. Columnas y **tipos reales**:
  `idCategoria text (PK)`, `cuenta text`, `descripcion text`, `seccion text`,
  **`uidResponsable uuid` (NOT NULL)**, `presupuestable boolean (NOT NULL)`, `status boolean`.
- **`PresDetalle`** — presupuesto mensual por categoría: `idCategoria text`, **`mes smallint`**,
  **`anio smallint`**, `monto double precision`. Índice único `(idCategoria, anio, mes)`.
- **`cxp`** — gastos. Columnas relevantes: `idCategoria text`, **`idEstado smallint` (nullable)**,
  `subtotal double precision (nullable)`, **`fecAutorizacion timestamp (nullable)`**,
  `fecPago timestamp (nullable)`, **`fc timestamp (NOT NULL)`**. Volumen actual: **1,839 filas**.
- **`v_resumenPresupuesto`** — vista que compara gastado/comprometido vs presupuesto por categoría,
  **hard-codeada al año en curso** (`EXTRACT(year FROM now())`). Es `security_invoker=on`. La consumen **3
  superficies** (ver §D): `aprobacion.service.ts` (modal Aprobar Solicitudes), `parametros.service.ts`
  (Configuraciones→Cuentas) y el **agente Montse** (`consultas.service.ts`, rol `v2_agente_ro`).

**Catálogo de estados de `cxp`** (fuente de verdad = `idEstado`; el texto `estado` es legacy, no usar):

| idEstado | Nombre | # filas | Σ subtotal | Clasificación en el reporte |
|---|---|---:|---:|---|
| 1 | Guardado | 105 | $11.78M | — (no cuenta) |
| 2 | Enviado | 19 | $0.43M | — |
| 3 | Rechazado | 37 | $3.71M | — |
| 4 | Aprobado | 128 | $9.57M | **Comprometido no pagado** |
| 6 | Pagado | 1,406 | $60.04M | **Gastado real** |
| 7 | Pago T. Bancaria | 33 | $0.10M | **Gastado real** (fecAut/fecPago NULL → se fecha por `fc`) |
| 99 | Aprobado sin pago aplicado | 111 | $6.58M | **Comprometido no pagado** (fecAut poblada al 100%) |

---

## 2. Decisiones acordadas (v1 + Jereff v2)

1. **Ubicación:** nueva pestaña **"Presupuesto"** dentro de `/cxp/reportes` (no pantalla nueva, no Dashboard 440/441).
2. **Granularidad:** resumen anual por categoría (año seleccionable, con histórico) **+** detalle mensual (drill-down, 12 meses).
3. **Cálculo:** **funciones SQL nuevas** parametrizadas por año.
4. **Alcance de estados (Jereff):** contar **4, 6, 7 y 99**. Gastado real = 6+7; Comprometido = 4+99.
5. **Fuente de verdad (Jereff):** la función nueva es la única lógica; **`v_resumenPresupuesto` pasa a ser wrapper** de ella.
6. **Visualización:** tabla ordenable + gráfico de barras (Presupuesto vs Gastado+Comprometido por categoría, coloreado por estado).
7. **Exportación:** solo Excel.
8. **Permisos:** mismo permiso **460**.
9. **Drill-down:** clic en fila → modal con tabla de 12 meses + gráfico de línea.
10. **Filtros:** Año, Cuenta, Sección, Responsable, checkbox "solo presupuestables" (ON por defecto).

---

## A) Base de datos

⚠️ **Regla del proyecto:** BD de producción compartida (v1+v2). El SQL se entrega aquí como **archivo de
migración** (`version2/base-conocimiento/migraciones/YYYY-MM-DD-reporte-presupuesto-cxp.sql`) y se aplica
**vía `mcp__supaSPH__apply_migration`**, **solo con autorización explícita de Jereff**. Orden de aplicación
dentro del archivo: (1) función anual → (2) función mensual → (3) `REVOKE/GRANT` → (4) wrapper de la vista →
(5) índices opcionales.

### A.1 Función `cxp_resumen_presupuesto_por_anio(p_anio integer)` — fuente de verdad

Devuelve **una fila por categoría** con las **26 columnas de la vista original** (mismos nombres/tipos/orden)
**+ 4 columnas de identidad** (`cuenta`, `descripcion`, `seccion`, `uidResponsable`) para los filtros del reporte.
Incluye estados **6+7** (gastado) y **4+99** (comprometido). `v_mes_corte` = mes actual si `p_anio` es el año
en curso, o 12 si es año cerrado.

```sql
CREATE OR REPLACE FUNCTION public.cxp_resumen_presupuesto_por_anio(p_anio integer)
RETURNS TABLE (
  "idCategoria" text,
  presupuestable boolean,
  status boolean,
  presupuesto_acumulado double precision,
  presupuesto_total_anual double precision,
  subtotal_gastado double precision,
  subtotal_comprometido double precision,
  total_gastado_comprometido double precision,
  dentro_presupuesto boolean,
  avance_total double precision,
  avance_acumulado double precision,
  avance_comprometido double precision,
  avance_vs_anual double precision,
  disponible_acumulado double precision,
  disponible_real double precision,
  disponible_anual double precision,
  transacciones_autorizadas bigint,
  transacciones_comprometidas bigint,
  promedio_mensual_gastado double precision,
  proyeccion_gasto_anual double precision,
  estado_acumulado text,
  estado_vs_anual text,
  estado_comprometido text,
  meses_restantes numeric,
  presupuesto_mensual_restante double precision,
  tipo_categoria text,
  cuenta text,
  descripcion text,
  seccion text,
  "uidResponsable" text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mes_corte integer;
BEGIN
  v_mes_corte := CASE
    WHEN p_anio = EXTRACT(year FROM now())::int THEN EXTRACT(month FROM now())::int
    ELSE 12
  END;

  RETURN QUERY
  WITH presupuestos AS (
    SELECT pd."idCategoria",
      SUM(CASE WHEN pd.mes <= v_mes_corte THEN pd.monto ELSE 0::double precision END) AS presupuesto_acumulado,
      SUM(pd.monto) AS presupuesto_total_anual
    FROM "PresDetalle" pd
    WHERE pd.anio = p_anio
    GROUP BY pd."idCategoria"
  ), categorias AS (
    SELECT pc."idCategoria", pc.presupuestable, pc.status,
           pc.cuenta, pc.descripcion, pc.seccion, pc."uidResponsable"
    FROM "PresCategorias" pc
  ), gastos_pagados AS (           -- estados 6 (Pagado) + 7 (Pago T. Bancaria) = GASTADO REAL
    SELECT c."idCategoria",
      SUM(c.subtotal) AS total_gastado,
      COUNT(*)        AS num_pagadas
    FROM cxp c
    WHERE c."idEstado" IN (6, 7)
      AND EXTRACT(year  FROM COALESCE(c."fecAutorizacion", c."fecPago", c.fc)) = p_anio
      AND EXTRACT(month FROM COALESCE(c."fecAutorizacion", c."fecPago", c.fc)) <= v_mes_corte
    GROUP BY c."idCategoria"
  ), gastos_comprometidos AS (     -- estados 4 (Aprobado) + 99 (Aprobado sin pago) = COMPROMETIDO NO PAGADO
    SELECT c."idCategoria",
      SUM(c.subtotal) AS total_comprometido,
      COUNT(*)        AS num_comprometidas
    FROM cxp c
    WHERE c."idEstado" IN (4, 99)
      AND EXTRACT(year  FROM c.fc) = p_anio
      AND EXTRACT(month FROM c.fc) <= v_mes_corte
    GROUP BY c."idCategoria"
  ), todas_categorias AS (
    -- ⚠️ Calificar "idCategoria" con el CTE de origen: esta BD tiene plpgsql.variable_conflict=error
    -- y "idCategoria" es un parámetro OUT (RETURNS TABLE). Sin calificar, la función truena en la 1ª
    -- ejecución con 'column reference "idCategoria" is ambiguous' (el CREATE sí pasa; el 1er SELECT revienta).
    SELECT presupuestos."idCategoria" FROM presupuestos
    UNION SELECT gastos_pagados."idCategoria" FROM gastos_pagados
    UNION SELECT gastos_comprometidos."idCategoria" FROM gastos_comprometidos
    UNION SELECT categorias."idCategoria" FROM categorias
  ), base AS (
    SELECT
      tc."idCategoria",
      COALESCE(cat.presupuestable, false) AS presupuestable,
      COALESCE(cat.status, false)         AS status,
      cat.cuenta, cat.descripcion, cat.seccion, cat."uidResponsable",
      COALESCE(p.presupuesto_acumulado, 0::double precision)   AS presup_acum,
      COALESCE(p.presupuesto_total_anual, 0::double precision) AS presup_anual,
      COALESCE(gp.total_gastado, 0::double precision)          AS gastado,        -- 6+7
      COALESCE(gc.total_comprometido, 0::double precision)     AS comprometido,   -- 4+99
      COALESCE(gp.num_pagadas, 0)                              AS n_pagadas,
      COALESCE(gc.num_comprometidas, 0)                        AS n_comprometidas
    FROM todas_categorias tc
    LEFT JOIN categorias   cat ON tc."idCategoria" = cat."idCategoria"
    LEFT JOIN presupuestos p   ON tc."idCategoria" = p."idCategoria"
    LEFT JOIN gastos_pagados      gp ON tc."idCategoria" = gp."idCategoria"
    LEFT JOIN gastos_comprometidos gc ON tc."idCategoria" = gc."idCategoria"
  )
  SELECT
    b."idCategoria",
    b.presupuestable,
    b.status,
    b.presup_acum,
    b.presup_anual,
    b.gastado                                        AS subtotal_gastado,
    b.comprometido                                   AS subtotal_comprometido,
    b.gastado + b.comprometido                       AS total_gastado_comprometido,
    (b.gastado + b.comprometido) <= b.presup_acum    AS dentro_presupuesto,
    CASE WHEN b.presup_acum > 0 THEN (b.gastado + b.comprometido) / b.presup_acum
         WHEN (b.gastado + b.comprometido) > 0 THEN 999.99 ELSE 0 END AS avance_total,
    CASE WHEN b.presup_acum > 0 THEN b.gastado / b.presup_acum
         WHEN b.gastado > 0 THEN 999.99 ELSE 0 END                    AS avance_acumulado,
    CASE WHEN b.presup_acum > 0 THEN (b.gastado + b.comprometido) / b.presup_acum
         WHEN (b.gastado + b.comprometido) > 0 THEN 999.99 ELSE 0 END AS avance_comprometido,
    CASE WHEN b.presup_anual > 0 THEN b.gastado / b.presup_anual
         WHEN b.gastado > 0 THEN 999.99 ELSE 0 END                    AS avance_vs_anual,
    b.presup_acum - b.gastado                        AS disponible_acumulado,
    b.presup_acum - (b.gastado + b.comprometido)     AS disponible_real,
    b.presup_anual - b.gastado                       AS disponible_anual,
    b.n_pagadas::bigint                              AS transacciones_autorizadas,
    (b.n_pagadas + b.n_comprometidas)::bigint        AS transacciones_comprometidas,
    CASE WHEN v_mes_corte > 0 THEN b.gastado / v_mes_corte ELSE 0 END        AS promedio_mensual_gastado,
    CASE WHEN v_mes_corte > 0 THEN b.gastado / v_mes_corte * 12 ELSE 0 END   AS proyeccion_gasto_anual,
    CASE
      WHEN b.gastado = 0 THEN 'SIN_GASTOS'
      WHEN b.presup_acum = 0 THEN 'SIN_PRESUPUESTO'
      WHEN b.gastado / b.presup_acum <= 0.5 THEN 'BAJO'
      WHEN b.gastado / b.presup_acum <= 0.8 THEN 'MODERADO'
      WHEN b.gastado / b.presup_acum <= 1.0 THEN 'ALTO'
      ELSE 'EXCEDIDO'
    END AS estado_acumulado,
    CASE
      WHEN b.gastado = 0 THEN 'SIN_GASTOS'
      WHEN b.presup_anual = 0 THEN 'SIN_PRESUPUESTO'
      WHEN b.gastado / b.presup_anual <= 0.3 THEN 'CONSERVADOR'
      WHEN b.gastado / b.presup_anual <= 0.6 THEN 'NORMAL'
      WHEN b.gastado / b.presup_anual <= 0.9 THEN 'ACELERADO'
      ELSE 'CRITICO'
    END AS estado_vs_anual,
    CASE
      WHEN (b.gastado + b.comprometido) = 0 THEN 'SIN_COMPROMISOS'
      WHEN b.presup_acum = 0 THEN 'SIN_PRESUPUESTO'
      WHEN (b.gastado + b.comprometido) / b.presup_acum <= 0.5 THEN 'BAJO_COMPROMISO'
      WHEN (b.gastado + b.comprometido) / b.presup_acum <= 0.8 THEN 'MODERADO_COMPROMISO'
      WHEN (b.gastado + b.comprometido) / b.presup_acum <= 1.0 THEN 'ALTO_COMPROMISO'
      ELSE 'SOBRE_COMPROMETIDO'
    END AS estado_comprometido,
    (12 - v_mes_corte)::numeric AS meses_restantes,
    CASE WHEN (12 - v_mes_corte) > 0 AND b.presup_anual > 0
         THEN (b.presup_anual - b.gastado) / (12 - v_mes_corte)
         ELSE 0 END AS presupuesto_mensual_restante,
    CASE
      WHEN b.presup_anual > 0 AND b.gastado > 0 THEN 'NORMAL'
      WHEN b.presup_anual > 0 AND b.gastado = 0 THEN 'PRESUPUESTO_SIN_USO'
      WHEN b.presup_anual = 0 AND b.gastado > 0 THEN 'ESPECIAL_SOLO_GASTOS'
      ELSE 'INACTIVA'
    END AS tipo_categoria,
    b.cuenta,
    b.descripcion,
    b.seccion,
    b."uidResponsable"::text
  FROM base b
  ORDER BY
    CASE WHEN b.presup_anual = 0 AND (b.gastado + b.comprometido) > 0 THEN 0 ELSE 1 END,
    (b.gastado + b.comprometido) DESC;
END;
$$;

COMMENT ON FUNCTION public.cxp_resumen_presupuesto_por_anio(integer) IS
  'Resumen presupuestal por categoría para el año dado. Fuente de verdad: la vista v_resumenPresupuesto es un wrapper de esta función con el año en curso. Gastado=estados 6+7, Comprometido=estados 4+99.';
```

> **Nota de fidelidad:** las 26 primeras columnas replican exactamente la definición real de
> `v_resumenPresupuesto` (verificada con `pg_get_viewdef`), sustituyendo `now()` por `p_anio`/`v_mes_corte`
> y ampliando los estados (6→6+7, 4→4+99). El patrón `999.99` para división por presupuesto=0 y los umbrales
> de los `estado_*` se conservan idénticos.

### A.2 Redefinir `v_resumenPresupuesto` como wrapper (⚠️ toca producción)

La vista pasa a **llamar a la función** con el año en curso, exponiendo **exactamente las mismas 26
columnas, en el mismo orden y con los mismos tipos** que hoy (NO expone las 4 de identidad, para no alterar
su contrato):

```sql
CREATE OR REPLACE VIEW public."v_resumenPresupuesto"
WITH (security_invoker = true) AS
SELECT
  "idCategoria", presupuestable, status,
  presupuesto_acumulado, presupuesto_total_anual,
  subtotal_gastado, subtotal_comprometido, total_gastado_comprometido,
  dentro_presupuesto, avance_total, avance_acumulado, avance_comprometido, avance_vs_anual,
  disponible_acumulado, disponible_real, disponible_anual,
  transacciones_autorizadas, transacciones_comprometidas,
  promedio_mensual_gastado, proyeccion_gasto_anual,
  estado_acumulado, estado_vs_anual, estado_comprometido,
  meses_restantes, presupuesto_mensual_restante, tipo_categoria
FROM public.cxp_resumen_presupuesto_por_anio(EXTRACT(year FROM now())::int);
```

> ⚠️ **`WITH (security_invoker = true)` es obligatorio:** la vista actual tiene `security_invoker=on`. Sin esa
> cláusula, un `CREATE VIEW` nuevo nace con `security_invoker=off` (ejecuta como owner, salta RLS) → invertiría la
> postura de seguridad. Si `CREATE OR REPLACE VIEW` fallara por firma, el fallback es
> `DROP VIEW public."v_resumenPresupuesto"; CREATE VIEW public."v_resumenPresupuesto" WITH (security_invoker = true) AS ...`
> (**también con la cláusula**). Post-aplicación, verificar:
> `SELECT reloptions FROM pg_class WHERE relname='v_resumenPresupuesto';` debe seguir mostrando `security_invoker=on`.
> Consumidores a re-probar (los 3, §D): `aprobacion.service.ts`, `parametros.service.ts` (Configuraciones→Cuentas)
> y el agente Montse.

### A.3 Función `cxp_resumen_presupuesto_mensual(p_idCategoria text, p_anio integer)` — drill-down

12 filas (una por mes) con presupuesto vs gastado (6+7) vs comprometido (4+99). `disponible_mes` resta
**ambos** (gastado y comprometido), no solo gastado.

```sql
CREATE OR REPLACE FUNCTION public.cxp_resumen_presupuesto_mensual(p_idCategoria text, p_anio integer)
RETURNS TABLE (
  mes integer,
  presupuesto_mes double precision,
  gastado_mes double precision,
  comprometido_mes double precision,
  disponible_mes double precision
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH meses AS (
    SELECT generate_series(1, 12) AS mes
  ), presupuesto AS (
    SELECT pd.mes::integer AS mes, SUM(pd.monto) AS monto
    FROM "PresDetalle" pd
    WHERE pd."idCategoria" = p_idCategoria AND pd.anio = p_anio
    GROUP BY pd.mes
  ), gastado AS (      -- 6 + 7
    SELECT EXTRACT(month FROM COALESCE(c."fecAutorizacion", c."fecPago", c.fc))::integer AS mes,
           SUM(c.subtotal) AS monto
    FROM cxp c
    WHERE c."idCategoria" = p_idCategoria AND c."idEstado" IN (6, 7)
      AND EXTRACT(year FROM COALESCE(c."fecAutorizacion", c."fecPago", c.fc)) = p_anio
    GROUP BY 1
  ), comprometido AS ( -- 4 + 99
    SELECT EXTRACT(month FROM c.fc)::integer AS mes, SUM(c.subtotal) AS monto
    FROM cxp c
    WHERE c."idCategoria" = p_idCategoria AND c."idEstado" IN (4, 99)
      AND EXTRACT(year FROM c.fc) = p_anio
    GROUP BY 1
  )
  SELECT
    m.mes,
    COALESCE(p.monto, 0::double precision)  AS presupuesto_mes,
    COALESCE(g.monto, 0::double precision)  AS gastado_mes,
    COALESCE(cm.monto, 0::double precision) AS comprometido_mes,
    COALESCE(p.monto, 0::double precision)
      - COALESCE(g.monto, 0::double precision)
      - COALESCE(cm.monto, 0::double precision) AS disponible_mes
  FROM meses m
  LEFT JOIN presupuesto  p  ON p.mes  = m.mes
  LEFT JOIN gastado      g  ON g.mes  = m.mes
  LEFT JOIN comprometido cm ON cm.mes = m.mes
  ORDER BY m.mes;
$$;

COMMENT ON FUNCTION public.cxp_resumen_presupuesto_mensual(text, integer) IS
  'Detalle mensual (12 meses) de presupuesto vs gastado(6+7) vs comprometido(4+99) de una categoría/año.';
```

### A.4 Índices — OPCIONALES (no aplicar salvo que `cxp` crezca)

Con ~1,839 filas en `cxp` el seq scan es trivial; estos índices son para el futuro. **No forman parte del
alcance de esta entrega** salvo que Jereff lo pida:

```sql
-- CREATE INDEX IF NOT EXISTS idx_cxp_presup_categoria
--   ON public.cxp ("idCategoria", "idEstado") INCLUDE (subtotal, "fecAutorizacion", "fecPago", fc);
-- CREATE INDEX IF NOT EXISTS idx_presdetalle_anio_categoria
--   ON public."PresDetalle" ("anio", "idCategoria") INCLUDE (mes, monto);
```

### A.5 Seguridad — `REVOKE`/`GRANT` (OBLIGATORIO, patrón del proyecto)

Va **inmediatamente después** de cada `CREATE FUNCTION ... $$;` y su `COMMENT`:

```sql
REVOKE ALL     ON FUNCTION public.cxp_resumen_presupuesto_por_anio(integer) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cxp_resumen_presupuesto_por_anio(integer) TO service_role;
-- ⚠️ OBLIGATORIO: el agente Montse consulta v_resumenPresupuesto con el rol v2_agente_ro (NO es service_role);
-- como la vista es security_invoker=on, el EXECUTE se evalúa con ese rol → sin este GRANT, Montse truena.
GRANT  EXECUTE ON FUNCTION public.cxp_resumen_presupuesto_por_anio(integer) TO v2_agente_ro;

REVOKE ALL     ON FUNCTION public.cxp_resumen_presupuesto_mensual(text, integer) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cxp_resumen_presupuesto_mensual(text, integer) TO service_role;
-- (la función mensual NO está en la allow-list de Montse → no requiere grant a v2_agente_ro)
```

> **Roles:** `service_role` (cliente `this.supabase.admin`) conserva `EXECUTE` → aprobación y Configuraciones→Cuentas
> siguen funcionando. `v2_agente_ro` (agente Montse) recibe `EXECUTE` explícito porque la vista es `security_invoker=on`
> y el EXECUTE se evalúa con **su** rol, no con el del owner. `anon`/`authenticated` quedan sin acceso directo a las funciones.

---

## B) Backend NestJS — endpoints nuevos en `ReportesCxpController`

Mismo módulo `cxp`, mismos guards de clase (`@UseGuards(JwtAuthGuard, PermisoGuard)` + `@RequierePermiso(460)`).
Todo **solo lectura** (sin auditoría de mutación). Patrones exactos a clonar (con ruta:línea) — ver §E.

### B.1 `reportes.schemas.ts` — nuevo schema Zod

```ts
export const reportePresupuestoSchema = z.object({
  anio: z.coerce.number().int().min(2000).max(2100),
  cuenta: arrStr,           // reusa el helper arrStr existente (línea 9-13)
  seccion: arrStr,
  uidResponsable: arrStr,
  soloPresupuestables: z.enum(['true', 'false']).default('true'),
});
export type ReportePresupuestoDto = z.infer<typeof reportePresupuestoSchema>;

export const presupuestoMensualSchema = z.object({
  anio: z.coerce.number().int().min(2000).max(2100),
});
```

### B.2 `reportes.service.ts` — métodos nuevos en `ReportesCxpService`

- **`presupuesto(dto: ReportePresupuestoDto)`**:
  1. `const { data, error } = await this.supabase.admin.rpc('cxp_resumen_presupuesto_por_anio', { p_anio: dto.anio });`
     (mismo patrón que `.rpc('cxp_get_estado_cuenta_detalle_v2', {...})`).
  2. Filtrado **en memoria** (mismo patrón `Set` de multi-selección, líneas 185-234): `cuenta`, `seccion`,
     `uidResponsable`. Para `soloPresupuestables === 'true'`, `filas = filas.filter(f => f.presupuestable)`.
  3. Calcular `totales` (reduce): `presupuestoTotal` (Σ `presupuesto_acumulado`), `gastado` (Σ `subtotal_gastado`),
     `comprometido` (Σ `subtotal_comprometido`), y `avanceGlobal` replicando el convenio de la función SQL:
     `avanceGlobal = presupuestoTotal > 0 ? (gastado+comprometido)/presupuestoTotal : ((gastado+comprometido) > 0 ? 999.99 : 0)`.
  4. `return { filas, totales, aniosDisponibles }`. `aniosDisponibles` = de `PresDetalle`:
     `await this.supabase.admin.from('PresDetalle').select('anio').order('anio')` → `[...new Set(...)]` desc.
- **`presupuestoMensual(idCategoria: string, anio: number)`**: valida que `idCategoria` exista en `PresCategorias`
  (si no, `throw new NotFoundException(...)`), luego `.rpc('cxp_resumen_presupuesto_mensual', { p_idCategoria: idCategoria, p_anio: anio })`.
- **`presupuestoFiltros()`**: catálogos para los selects → `cuenta`/`seccion` distintos de `PresCategorias`
  y responsables reusando el patrón de `parametros.service.ts::listarResponsables()` (join a `catUsers`, label `apellidos, nombre`).

### B.3 `reportes.controller.ts` — endpoints nuevos

```ts
@Get('presupuesto')
presupuesto(
  @Query('anio') anio?: string,
  @Query('cuenta') cuenta?: string | string[],
  @Query('seccion') seccion?: string | string[],
  @Query('uidResponsable') uidResponsable?: string | string[],
  @Query('soloPresupuestables') soloPresupuestables?: string,
) {
  const dto = reportePresupuestoSchema.parse({ anio, cuenta, seccion, uidResponsable, soloPresupuestables });
  return this.svc.presupuesto(dto);
}

@Get('presupuesto/filtros')
presupuestoFiltros() { return this.svc.presupuestoFiltros(); }

@Get('presupuesto/:idCategoria/mensual')
presupuestoMensual(@Param('idCategoria') idCategoria: string, @Query('anio') anio?: string) {
  const { anio: a } = presupuestoMensualSchema.parse({ anio });
  return this.svc.presupuestoMensual(idCategoria, a);
}
```
> Registrar el orden de rutas de modo que `presupuesto/filtros` no colisione con `presupuesto/:idCategoria/...`
> (NestJS resuelve rutas estáticas antes que paramétricas, pero mantener `filtros` como segmento fijo lo evita).

---

## C) Frontend — pestaña "Presupuesto" dentro de Reportes CxP

`ReportesCxpPage.tsx` hoy es **vista única sin tabs**. Refactor (patrón ya usado en `ventas/ReportesPage.tsx`):

1. Extraer TODO el cuerpo actual (header, filtros, tarjetas, tabla, modal) a una función `EstadoCuentaCxpTab()`
   **sin cambiar su lógica**. Mover sus botones Excel/PDF dentro del tab.
2. `ReportesCxpPage()` queda con: `const [tab, setTab] = useState('edo')`, `<h1>`,
   `<Tabs tabs={TABS} activo={tab} onChange={setTab} />` (importar `Tabs, type TabDef` de `@/components/Tabs`),
   y `{tab === 'edo' && <EstadoCuentaCxpTab />} {tab === 'presupuesto' && <PresupuestoCxpTab />}`.
   `const TABS: TabDef[] = [{ id: 'edo', label: 'Estado de Cuenta' }, { id: 'presupuesto', label: 'Presupuesto' }]`.

**`PresupuestoCxpTab.tsx` (nuevo):**
- **Filtros:** `Año` con **`SearchSelect` de opción única** (value string, `options` = `aniosDisponibles.map(a => ({ value: String(a), label: String(a) }))`; convertir con `Number(anio)` al llamar la API — **NO `InputFecha`**);
  `Cuenta`/`Sección`/`Responsable` con `MultiSearchSelect`; checkbox "Solo presupuestables" (ON por defecto).
- **4 tarjetas:** Presupuesto Total · Gastado · Comprometido · % Avance Global (de `totales`).
- **Gráfico de barras** (`react-chartjs-2 <Bar>`, clonar config de `DashboardGraficoPage.tsx`): eje X = `descripcion`;
  serie 1 "Presupuesto" (`presupuesto_acumulado`, color fijo `#1f2a4d`); serie 2 "Gastado + Comprometido"
  (`total_gastado_comprometido`, `backgroundColor` = **array** `filas.map(f => COLOR_ESTADO[f.estado_acumulado] ?? '#94a3b8')`).
- **Mapa de color (los 6 estados):**
  ```ts
  const COLOR_ESTADO: Record<string, string> = {
    BAJO: '#16a34a', MODERADO: '#16a34a', ALTO: '#f59e0b', EXCEDIDO: '#dc2626',
    SIN_GASTOS: '#94a3b8', SIN_PRESUPUESTO: '#94a3b8',
  };
  ```
- **Tabla** (`useSort` + `SortableTh` + `THEAD_STICKY`): Categoría, Cuenta, Sección, Responsable, Presupuesto Acum.,
  Gastado, Comprometido, Disponible (`disponible_real`), Avance % (`avance_total`), Estado (badge con `COLOR_ESTADO`).
  Clic en fila → abre el modal.
- **Modal `PresupuestoMensualDetalleModal.tsx` (nuevo):** llama `presupuesto/:idCategoria/mensual?anio=`; tabla de 12
  filas (mes, presupuesto, gastado, comprometido, disponible) + gráfico de línea (presupuesto vs gastado vs comprometido).
  **Nota de negocio a mostrar** (tooltip/pie): "Para 'Pago T. Bancaria' el mes es el de captura".
- **Excel:** en `reportes-export.ts`, agregar `COLS_EXCEL_PRESUPUESTO` + `exportarPresupuestoExcel(filas)` (mismo `import('exceljs')` lazy).

**`reportes.api.ts`:** agregar tipos (`PresupuestoRow`, `FiltrosPresupuesto`, `TotalesPresupuesto`, `PresupuestoMensualRow`)
y métodos `reportesCxpApi.presupuesto(f)`, `.presupuestoFiltros()`, `.presupuestoMensual(idCategoria, anio)` (patrón `api.get`, `credentials:'include'`).

**Archivos:** CREAR `PresupuestoCxpTab.tsx`, `PresupuestoMensualDetalleModal.tsx`. TOCAR `ReportesCxpPage.tsx`,
`reportes.api.ts`, `reportes-export.ts`. Sin ruta/menú/permiso nuevos.

---

## D) ⚠️ Impacto en producción, consumidores del wrapper y verificación OBLIGATORIA

**Dato de materialidad:** en el **año en curso (2026) el efecto en pesos de incluir 7/99 es ~$0** — todo el $6.57M
del estado 99 y los $99K del estado 7 son de **2025**. El cambio semántico pega sobre todo en **años cerrados y a
futuro**. Aun así, la **definición** de las columnas cambia hoy y eso toca 3 superficies de producción.

**Consumidores de `v_resumenPresupuesto` (los 3 — la premisa v1 de "solo aprobación" era falsa):**
1. **`aprobacion.service.ts`** (Aprobar Solicitudes). Del resumen usa 5 campos cuya **definición cambia**:
   `subtotal_gastado` (6→6+7), `subtotal_comprometido` (4→4+99), `total_gastado_comprometido` (4+6→4+6+7+99),
   `avance_total` y `dentro_presupuesto` (pueden voltear `true→false`). El recálculo de `fuera`/`autorizadoFP`
   (`aprobacion.service.ts:245-248`) se vuelve **más estricto y más correcto**.
2. **`parametros.service.ts::listarCuentas()`** (Configuraciones→Cuentas): mapea `consumido=subtotal_gastado`,
   `comprometido=total_gastado_comprometido`. No se rompe (usa `service_role`, columnas intactas), pero sus números
   cambian de definición.
3. **Agente Montse** (`consultas.service.ts`, allow-list, rol `v2_agente_ro`): **se rompería** sin el
   `GRANT EXECUTE ... TO v2_agente_ro` (§A.5), porque la vista es `security_invoker=on`.

**Nota de seguridad preexistente (vicio P0-2 de `DEUDA.md`, NO se cierra aquí):** `anon`/`authenticated` ya tienen
GRANT directo sobre `v_resumenPresupuesto` y las tablas base tienen RLS `USING(true)`. El `REVOKE` de las 2 funciones
nuevas **NO cierra** ese acceso directo por PostgREST. Se anota; su remediación es trabajo aparte.

**Checklist de aceptación (antes de cerrar):**
1. `apps/api` y `apps/web` compilan (typecheck/lint/build).
2. **Test de ejecución del SQL (obligatorio, por el fix `variable_conflict`):**
   `SELECT * FROM public.cxp_resumen_presupuesto_por_anio(2026) LIMIT 1;` y
   `SELECT * FROM public."v_resumenPresupuesto" LIMIT 1;` — si truenan con *"ambiguous"*, el fix de §A.1 no se aplicó.
3. **`SELECT reloptions FROM pg_class WHERE relname='v_resumenPresupuesto';`** debe seguir mostrando `security_invoker=on`.
4. **Modal Aprobar Solicitudes** con una categoría con estados 99/7 → responde y el cálculo de "fuera de presupuesto"
   es el esperado.
5. **Configuraciones→Cuentas** → carga sin error, con consumido/comprometido en la nueva definición.
6. **Agente Montse** → preguntarle algo de presupuesto → no truena (confirma el GRANT a `v2_agente_ro`).
7. Reporte nuevo con **año en curso y ≥1 año anterior**; totales cuadran con la función; y para el año en curso
   el reporte y `v_resumenPresupuesto` dan los mismos números por categoría.
8. **Cierre con validador adversarial (Opus 4.8):** seguridad (REVOKE/GRANT + `security_invoker`), no-rotura de los 3
   consumidores, y correctitud del cálculo con estados 7/99.

---

## Orden de implementación sugerido

1. **SQL** (archivo `migraciones/2026-07-02-reporte-presupuesto-cxp.sql`): función anual → función mensual →
   REVOKE/GRANT → wrapper de la vista. **Aplicar vía `apply_migration` solo con autorización de Jereff.**
2. **Backend:** schemas Zod → métodos de servicio → endpoints en el controller (no hay que registrar módulo).
3. **Frontend:** tabs en `ReportesCxpPage.tsx` → `PresupuestoCxpTab.tsx` → modal → export Excel.
4. **Verificación (§D)** + cierre con validador adversarial.
5. **Documentar:** `base-conocimiento/modulos/cxp.md` (sección Reportes + cambio de la vista a wrapper) y `.sessions`/`bitacora`.

---

## Decisiones registradas / puntos para el validador

- 📌 **Fechado del estado 6 (mejora aceptada):** la función fecha 6+7 por `COALESCE(fecAutorizacion, fecPago, fc)`.
  La vista vieja fechaba 6 solo por `fecAutorizacion`, excluyendo **2 filas** con `fecAutorizacion` NULL; ahora entran
  (criterio más correcto: no oculta 2 gastos reales). Bajo impacto, documentado.
- 📌 **Fechado del estado 99:** se usa `fc` (consistente con el estado 4). El 99 tiene `fecAutorizacion` al 100%; si
  negocio prefiere fecharlo por `fecAutorizacion`, es un cambio de una línea en las 2 funciones.
- 📌 **Estado 7** ($99K, 33 filas): sin `fecAut` ni `fecPago` → se fecha por `fc` (mes de captura). Mostrar nota en el modal.
- 📌 **Función mensual sin "mes de corte":** muestra los 12 meses; para el año en curso Σ(mensual) puede no cuadrar con
  el `subtotal_gastado` anual (que corta al mes actual). Esperado en un drill-down; documentarlo en el modal.
- 📌 **`presupuestoFiltros()`:** los combos Cuenta/Sección salen de `PresCategorias` **sin** filtrar `status` (para no
  ocultar cuentas hoy inactivas que tuvieron presupuesto en años previos). Responsables sí reusa `status=true`.
- 📌 **Duplicado de vista por mayúsculas** (`v_resumenPresupuesto` vs `v_resumenpresupuesto`, ya en `OBSOLESCENCIA-BD.md`):
  entrecomillar SIEMPRE `"v_resumenPresupuesto"` (mixed-case) en el SQL; no tocar la hermana en minúsculas.
- 📌 **Deuda saldada:** al elegir wrapper, ya NO hay doble fuente de verdad (se cierra el riesgo DRY de v1).
- **Excel (`COLS_EXCEL_PRESUPUESTO`):** columnas y orden = Categoría, Cuenta, Sección, Responsable, Presupuesto Acumulado,
  Gastado, Comprometido, Disponible, Avance %, Estado (mismo estilo que `COLS_EXCEL` en `reportes-export.ts`).
- **Gráfico de línea del modal:** clonar el `<Line>` de `apps/web/src/features/ventas/montse/ChartBlockIA.tsx`
  (ya registra `LineElement`/`PointElement`).
