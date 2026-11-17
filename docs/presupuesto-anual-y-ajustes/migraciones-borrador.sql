-- =====================================================================================
-- BORRADOR (v2, 2026-11-03) — NO APLICADO — Paquete «Presupuesto por año, cuentas solo anual y Ajuste Presupuestal»
-- Regla ULTRA-1: cada bloque se aplica SOLO con autorización explícita de Jereff, caso por caso, con ESTE SQL
-- exacto, después de la validación adversarial (07). Antes de aplicar: respaldos en temp/respaldos/ (ver 06-PLAN).
--
-- RECONCILIACIÓN: la función de M2 es la MISMA que ya describe y Jereff acordó en
-- base-conocimiento/PLAN-reporte-presupuesto-cxp.md §A.1/A.2/A.5 (2026-07-02, pendiente de construir):
-- nombre `cxp_resumen_presupuesto_por_anio`, estados 6+7 = gastado, 4+99 = comprometido, fecha COALESCE(fecAutorizacion,
-- fecPago, fc), SECURITY DEFINER + REVOKE/GRANT, vista envolvente con security_invoker. Este paquete le AÑADE:
--   (a) cuentas «solo anual», (b) solo filas de cxp con status = true, (c) año/mes en hora de México,
--   (d) también envuelve la vista gemela en minúsculas (la que lee la RPC cxp_autorizar_solicitud_pago).
-- Así hay UNA sola fuente del cálculo y el plan de julio sigue vigente solo en su parte de reporte (pestaña).
--
-- TRES DESPLIEGUES SEPARADOS (validación adversarial M-08: Soporte pasa cualquier permiso; F2 no debe salir antes de sus candados):
--   F0 (urgentes y líneas de captura con subtotal, pendiente #80; VA PRIMERO; excepción: aquí la BD va DESPUÉS del código):
--      código F0 → push 0 → M10 (relleno) → verificar → M10 otra vez (idempotente) → M11 (candado).
--   F1 (presupuesto por año + «solo anual» + selector): M1 → M2 → (ejecutar la función real + prueba de equivalencia) → M2b → M7 → código F1.
--   F2 (Ajuste Presupuestal): M3 → M4 → M5 → M6 → M8 → M9 → prueba de forma con ROLLBACK → código F2 (la BD SIEMPRE antes que el código).
-- Los bloques están en el archivo en orden de lectura, no de aplicación. Cada bloque trae su reversa.
-- =====================================================================================

-- ------------------------------------------------------------------------------------
-- M1 · Casilla «Solo anual» por cuenta (default false = nada cambia hasta que alguien la marque)
-- ------------------------------------------------------------------------------------
ALTER TABLE public."PresCategorias"
  ADD COLUMN IF NOT EXISTS "soloAnual" boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public."PresCategorias"."soloAnual" IS
  'true = la cuenta se mide contra su presupuesto ANUAL completo (sin tope mensual). Lo gestiona Configuraciones>Cuentas (permiso 213).';
-- REVERSA (primero revertir M2b y M2, que la usan): ALTER TABLE public."PresCategorias" DROP COLUMN "soloAnual";

-- ------------------------------------------------------------------------------------
-- M2 · Función de resumen de presupuesto POR AÑO (aditiva: no cambia nada existente todavía)
-- Cambios respecto al plan de julio: soloAnual, status=true, hora de México, columna solo_anual al final.
-- ⚠ La BD tiene plpgsql.variable_conflict=error: toda referencia a columnas que se llaman igual que un parámetro OUT
--   (idCategoria, status, cuenta, descripcion, seccion, uidResponsable, solo_anual) va CALIFICADA con su alias.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cxp_resumen_presupuesto_por_anio(p_anio integer)
RETURNS TABLE (
  "idCategoria"                text,
  presupuestable               boolean,
  status                       boolean,
  presupuesto_acumulado        double precision,
  presupuesto_total_anual      double precision,
  subtotal_gastado             double precision,
  subtotal_comprometido        double precision,
  total_gastado_comprometido   double precision,
  dentro_presupuesto           boolean,
  avance_total                 double precision,
  avance_acumulado             double precision,
  avance_comprometido          double precision,
  avance_vs_anual              double precision,
  disponible_acumulado         double precision,
  disponible_real              double precision,
  disponible_anual             double precision,
  transacciones_autorizadas    bigint,
  transacciones_comprometidas  bigint,
  promedio_mensual_gastado     double precision,
  proyeccion_gasto_anual       double precision,
  estado_acumulado             text,
  estado_vs_anual              text,
  estado_comprometido          text,
  meses_restantes              numeric,
  presupuesto_mensual_restante double precision,
  tipo_categoria               text,
  cuenta                       text,
  descripcion                  text,
  seccion                      text,
  "uidResponsable"             text,
  solo_anual                   boolean
)
LANGUAGE plpgsql
SECURITY INVOKER   -- el plan de julio decía DEFINER; la validación adversarial (S-3) lo cambia: los dos únicos llamadores
                   -- (service_role y v2_agente_ro) ya tienen BYPASSRLS y SELECT sobre las tablas; con INVOKER un error de ACL
                   -- (p. ej. un DROP+CREATE futuro que reabra EXECUTE a anon/authenticated) NO filtra datos: RLS sigue aplicando.
SET search_path = public, pg_temp
AS $$
DECLARE
  v_anio_mx   integer := EXTRACT(year  FROM (now() AT TIME ZONE 'America/Mexico_City'))::int;
  v_mes_mx    integer := EXTRACT(month FROM (now() AT TIME ZONE 'America/Mexico_City'))::int;
  v_mes_corte integer;
BEGIN
  -- año en curso (México) = hasta el mes actual; cualquier otro año = 12 meses (año cerrado o futuro)
  v_mes_corte := CASE WHEN p_anio = v_anio_mx THEN v_mes_mx ELSE 12 END;

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
           pc.cuenta, pc.descripcion, pc.seccion, pc."uidResponsable", pc."soloAnual"
    FROM "PresCategorias" pc
  ), gastos_pagados AS (           -- estados 6 (Pagado) + 7 (Pago T. Bancaria) = GASTADO REAL
    SELECT x."idCategoria",
      SUM(x.subtotal) AS total_gastado,
      COUNT(*)        AS num_pagadas
    FROM (
      SELECT c."idCategoria", c.subtotal,
             ((COALESCE(c."fecAutorizacion", c."fecPago", c.fc) AT TIME ZONE 'UTC') AT TIME ZONE 'America/Mexico_City') AS f_mx
      FROM cxp c
      WHERE c."idEstado" IN (6, 7) AND c.status = true
    ) x
    WHERE EXTRACT(year  FROM x.f_mx) = p_anio
      AND EXTRACT(month FROM x.f_mx) <= v_mes_corte
    GROUP BY x."idCategoria"
  ), gastos_comprometidos AS (     -- estados 4 (Aprobado) + 99 (Aprobado sin pago) = COMPROMETIDO NO PAGADO
    SELECT x."idCategoria",
      SUM(x.subtotal) AS total_comprometido,
      COUNT(*)        AS num_comprometidas
    FROM (
      SELECT c."idCategoria", c.subtotal,
             ((c.fc AT TIME ZONE 'UTC') AT TIME ZONE 'America/Mexico_City') AS f_mx
      FROM cxp c
      WHERE c."idEstado" IN (4, 99) AND c.status = true
    ) x
    WHERE EXTRACT(year  FROM x.f_mx) = p_anio
      AND EXTRACT(month FROM x.f_mx) <= v_mes_corte
    GROUP BY x."idCategoria"
  ), todas_categorias AS (
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
      COALESCE(cat."soloAnual", false)    AS solo_anual,
      -- cuenta «solo anual»: el acumulado ES el anual completo, sin tope mensual
      CASE WHEN COALESCE(cat."soloAnual", false)
           THEN COALESCE(p.presupuesto_total_anual, 0::double precision)
           ELSE COALESCE(p.presupuesto_acumulado, 0::double precision) END AS presup_acum,
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
    b."uidResponsable"::text,
    b.solo_anual
  FROM base b
  ORDER BY
    CASE WHEN b.presup_anual = 0 AND (b.gastado + b.comprometido) > 0 THEN 0 ELSE 1 END,
    (b.gastado + b.comprometido) DESC;
END;
$$;
COMMENT ON FUNCTION public.cxp_resumen_presupuesto_por_anio(integer) IS
  'Resumen presupuestal por cuenta para un año (hora de México). Fuente única del cálculo: las vistas v_resumenPresupuesto/v_resumenpresupuesto la envuelven con el año en curso. Gastado = estados 6+7, comprometido = 4+99, solo filas con status=true; cuentas soloAnual miden contra el anual completo.';

-- Seguridad (patrón del proyecto; PLAN-reporte-presupuesto-cxp §A.5)
REVOKE ALL     ON FUNCTION public.cxp_resumen_presupuesto_por_anio(integer) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cxp_resumen_presupuesto_por_anio(integer) TO service_role;
GRANT  EXECUTE ON FUNCTION public.cxp_resumen_presupuesto_por_anio(integer) TO v2_agente_ro;  -- Montse lee la vista como v2_agente_ro
-- REVERSA: DROP FUNCTION public.cxp_resumen_presupuesto_por_anio(integer);

-- ------------------------------------------------------------------------------------
-- PRUEBAS DESPUÉS DE M2 Y ANTES DE M2b (todas de solo lectura)
-- 1) La función ejecuta (este SELECT debe regresar fila, no «ambiguous»):
--      SELECT * FROM public.cxp_resumen_presupuesto_por_anio(2026) LIMIT 1;
-- 2) Equivalencia con la vista VIEJA para el año en curso (resultado esperado, ya medido en solo lectura el 2026-11-03):
--      82 cuentas en ambos lados; 0 diferencias en montos, presupuestos, disponibles, avances y estados;
--      la ÚNICA diferencia admitida: transacciones_comprometidas en 3 cuentas (6 aprobaciones en estado 99 con monto 0 que
--      ahora cuentan como transacción comprometida) y ruido de doble precisión ≤ 1e-9. Comparar también estado_comprometido.
--      (consulta de comparación guardada en temp/diseno-ajuste-presupuestal/prueba-equivalencia.sql)
-- 3) Año 2025: la función incluye estados 7 y 99 (decisión de Jereff del 2026-07-02): comparar contra
--    SUM(subtotal) de cxp por estado y año como cuadre manual.
-- ------------------------------------------------------------------------------------

-- ------------------------------------------------------------------------------------
-- M2b · Las DOS vistas pasan a envolver la función con el año en curso (México)
-- Ambas: la mixta la lee la app/agente; la minúscula la lee la RPC cxp_autorizar_solicitud_pago (que escribe el nombre
-- sin comillas). Si solo se envolviera una, el modal y el autorizador usarían reglas distintas.
-- Mismas 26 columnas, mismo orden y tipos; se agrega solo_anual al final. security_invoker = true se conserva.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public."v_resumenPresupuesto" WITH (security_invoker = true) AS
SELECT
  "idCategoria", presupuestable, status,
  presupuesto_acumulado, presupuesto_total_anual,
  subtotal_gastado, subtotal_comprometido, total_gastado_comprometido,
  dentro_presupuesto, avance_total, avance_acumulado, avance_comprometido, avance_vs_anual,
  disponible_acumulado, disponible_real, disponible_anual,
  transacciones_autorizadas, transacciones_comprometidas,
  promedio_mensual_gastado, proyeccion_gasto_anual,
  estado_acumulado, estado_vs_anual, estado_comprometido,
  meses_restantes, presupuesto_mensual_restante, tipo_categoria,
  solo_anual
FROM public.cxp_resumen_presupuesto_por_anio(EXTRACT(year FROM (now() AT TIME ZONE 'America/Mexico_City'))::int);

CREATE OR REPLACE VIEW public.v_resumenpresupuesto WITH (security_invoker = true) AS
SELECT
  "idCategoria", presupuestable, status,
  presupuesto_acumulado, presupuesto_total_anual,
  subtotal_gastado, subtotal_comprometido, total_gastado_comprometido,
  dentro_presupuesto, avance_total, avance_acumulado, avance_comprometido, avance_vs_anual,
  disponible_acumulado, disponible_real, disponible_anual,
  transacciones_autorizadas, transacciones_comprometidas,
  promedio_mensual_gastado, proyeccion_gasto_anual,
  estado_acumulado, estado_vs_anual, estado_comprometido,
  meses_restantes, presupuesto_mensual_restante, tipo_categoria,
  solo_anual
FROM public.cxp_resumen_presupuesto_por_anio(EXTRACT(year FROM (now() AT TIME ZONE 'America/Mexico_City'))::int);
-- Verificación posterior: SELECT relname, reloptions FROM pg_class WHERE relname IN ('v_resumenPresupuesto','v_resumenpresupuesto');
--   → security_invoker=on en ambas; y los GRANT de SELECT siguen (anon/authenticated/service_role/v2_agente_ro en la mixta).
-- REVERSA (⚠ NO funciona con CREATE OR REPLACE: la vista nueva tiene 27 columnas y volver a 26 da «cannot drop columns»).
--   Orden exacto: (1) desplegar el CÓDIGO anterior (si no, Cuentas da 500); (2) por CADA vista, en una transacción:
--     DROP VIEW public."v_resumenPresupuesto";  CREATE VIEW public."v_resumenPresupuesto" WITH (security_invoker = true) AS <definición vieja>;
--     GRANT SELECT ... (la mixta: anon, authenticated, service_role, v2_agente_ro; la minúscula: anon, authenticated, service_role);
--   (3) solo entonces DROP FUNCTION public.cxp_resumen_presupuesto_por_anio(integer) (falla mientras alguna vista la use).
--   El SQL exacto (definición vieja + GRANTs) se guarda ANTES de aplicar en temp/respaldos/reversa-v_resumenPresupuesto-<fecha>.sql y se prueba en seco.

-- ------------------------------------------------------------------------------------
-- M3 · Trigger de fecha: el Ajuste Presupuestal (tipoOperacion = 98) se puede capturar cualquier día
-- Único cambio: la condición del INSERT gana «AND COALESCE(NEW."tipoOperacion", 1) <> 98».
-- El resto es idéntico a la función vigente (copiada de la BD el 2026-11-03).
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cxp_trigger_validar_fecha()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    fecha_actual DATE := (now() AT TIME ZONE 'America/Mexico_City')::date;
    cfdi_habilitado BOOLEAN := false;
    autorizar_habilitado BOOLEAN := false;
    es_usuario_autorizador BOOLEAN := false;
    estado_anterior SMALLINT;
BEGIN
    SELECT cfdi, autorizar
    INTO cfdi_habilitado, autorizar_habilitado
    FROM public.cxp_fechas_habilitadas
    WHERE fecha = fecha_actual;

    IF NOT FOUND THEN
        cfdi_habilitado := false;
        autorizar_habilitado := false;
    END IF;

    SELECT EXISTS(
        SELECT 1
        FROM public."segModulosUsuarios"
        WHERE uid = COALESCE(NEW.autorizo, NEW.uidr)
          AND clave = 430
          AND acceso = true
    ) INTO es_usuario_autorizador;

    IF TG_OP = 'INSERT' THEN
        -- Urgentes y Ajustes Presupuestales (98) no dependen del periodo de captura de CFDI.
        IF NOT cfdi_habilitado
           AND COALESCE(NEW."esUrgente", false) = false
           AND COALESCE(NEW."tipoOperacion", 1) <> 98 THEN
            RAISE EXCEPTION 'CXP_CFDI_NO_HABILITADO: No se pueden insertar registros en CxP. La fecha actual (%) no permite generar CFDI. Solo se permite en fechas con cfdi=true (generalmente lunes y martes).',
                fecha_actual
            USING HINT = 'Verifique la tabla cxp_fechas_habilitadas o espere a una fecha habilitada para CFDI.';
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD."idEstado" = NEW."idEstado" OR NEW."idEstado" IS NULL THEN
            RETURN NEW;
        END IF;

        estado_anterior := COALESCE(OLD."idEstado", 1);

        IF NOT es_usuario_autorizador THEN
            IF NEW."idEstado" NOT IN (1, 2) THEN
                RAISE EXCEPTION 'CXP_ESTADO_NO_AUTORIZADO: Usuario sin permisos para cambiar al estado %. Solo se permiten estados: 1=Guardado, 2=Enviado',
                    NEW."idEstado"
                USING HINT = 'Contacte a un usuario con permisos de autorización (clave 430) para cambios de estado de aprobación.';
            END IF;
        END IF;

        IF es_usuario_autorizador THEN
            IF NEW."idEstado" IN (3, 4) AND NOT autorizar_habilitado THEN
                RAISE EXCEPTION 'CXP_AUTORIZACION_NO_HABILITADA: No se pueden realizar autorizaciones hoy (%). La fecha actual no permite autorizar. Solo se permite en fechas con autorizar=true.',
                    fecha_actual
                USING HINT = 'Las autorizaciones están permitidas generalmente en lunes, martes y miércoles habilitados.';
            END IF;
        END IF;

        RETURN NEW;
    END IF;

    RETURN NEW;

EXCEPTION
    WHEN OTHERS THEN
        RAISE;
END;
$function$;
-- REVERSA: recrear la función sin la línea «AND COALESCE(NEW."tipoOperacion", 1) <> 98».
--          Guardar antes: temp/respaldos/def-cxp_trigger_validar_fecha-<fecha>.sql

-- ------------------------------------------------------------------------------------
-- M4 · Permiso «Ajuste presupuestal» (clave 432, hermana de la 431). Molde: migraciones/2026-06-10-parametros-claves-visualizacion.sql
-- segModulos.modulo es un ENUM "Modulos" → cast obligatorio. No se asigna a nadie: Jereff lo asigna en Configuraciones>Permisos
-- (la RPC segmodulosusuarios_smu crea la fila acceso=false al abrir al usuario; Soporte pasa siempre).
-- ------------------------------------------------------------------------------------
INSERT INTO public."segModulos" (modulo, seccion, area, clave)
SELECT 'Cuentas por Pagar'::"Modulos", 'Ajuste Presupuestal', 'Opcion', 432
WHERE NOT EXISTS (SELECT 1 FROM public."segModulos" WHERE clave = 432);
-- REVERSA: DELETE FROM public."segModulosUsuarios" WHERE clave = 432; DELETE FROM public."segModulos" WHERE clave = 432;

-- ------------------------------------------------------------------------------------
-- M5 · Proveedor genérico para ajustes sin proveedor (cxp.idProveedor es NOT NULL y el trigger
--      cxp_validar_y_actualizar_proveedor exige un proveedor ACTIVO y pisa nombreProveedor con su razón social)
-- RFC genérico nacional (unique_rfc verificado sin XAXX%). Queda status=true (obligatorio) → se EXCLUYE por id de
-- catalogos()/filtros()/listar() y se protege contra edición/desactivación (ver 05-BACKEND §6).
-- ------------------------------------------------------------------------------------
INSERT INTO public."catProveedores" ("idProveedor", status, rfc, "razonSocial", "nombreBanco", "tipoCuenta")
SELECT 'AJUSTE-PRESUPUESTAL', true, 'XAXX010101000', 'AJUSTE PRESUPUESTAL (SIN PROVEEDOR)', 'N/A', 'N/A'
WHERE NOT EXISTS (SELECT 1 FROM public."catProveedores" WHERE "idProveedor" = 'AJUSTE-PRESUPUESTAL');
-- REVERSA: DELETE FROM public."catProveedores" WHERE "idProveedor" = 'AJUSTE-PRESUPUESTAL';  (solo si ninguna fila de cxp lo usa)

-- ------------------------------------------------------------------------------------
-- M6 · Candado de forma del Ajuste (defensa en profundidad, además del servicio)
-- Un 98 solo puede ser: Pagado, monto positivo con subtotal = total, en pesos, sin movimiento bancario, no diferido,
-- no urgente y sin documentos. (No se exige fecCFDI NULL: el trigger AFTER INSERT cxp_actualizar_nomcfdi_vacio lo rellena
-- si nomCFDI viene vacío; el servicio manda nomCFDI no vacío para evitarlo.) Hoy no existe ninguna fila 98 → valida sin riesgo.
-- ------------------------------------------------------------------------------------
-- ⚠ En Postgres un CHECK que evalúa a NULL PASA: por eso IS DISTINCT FROM / IS NOT NULL / COALESCE en todo (validación adversarial D2).
ALTER TABLE public.cxp
  ADD CONSTRAINT cxp_ajuste_presupuestal_chk CHECK (
    "tipoOperacion" IS DISTINCT FROM 98
    OR (
      COALESCE("idEstado", 0) = 6
      AND subtotal IS NOT NULL AND total IS NOT NULL AND subtotal = total AND total > 0
      AND COALESCE(moneda, '') = 'MXN'
      AND "idMovBancarios" IS NULL
      AND COALESCE(diferido, false) = false
      AND COALESCE("esUrgente", false) = false
      AND COALESCE(tdc, false) = false
      AND "urlCFDI" IS NULL AND "urlXLM" IS NULL
    )
  );
-- Efecto colateral deseado: «Desaplicar» (→ idEstado 4) o tdc (→ 7) sobre un 98 revientan con 23514; el servicio igual lo bloquea antes (400 legible).
-- REVERSA: ALTER TABLE public.cxp DROP CONSTRAINT cxp_ajuste_presupuestal_chk;

-- ------------------------------------------------------------------------------------
-- M8 · Guardia: una fila 98 SOLO la gestiona el servicio (service_role), nunca un cliente con token authenticated/anon
-- Contexto: las políticas RLS de cxp/segModulosUsuarios/auditoria son USING(true) para authenticated (P0 conocido del tablero: #2 y #3).
-- Esta guardia NO arregla ese P0; solo evita que el 98 se cree/edite/borre saltándose el servicio. `comoActor()` firma un JWT con
-- role = service_role → current_user = service_role (pasa). Un cliente con el token del navegador → current_user = authenticated (rebota).
-- Quién tenga conexión directa de BD (postgres) tampoco se ve afectado (mantenimiento).
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cxp_guardia_ajuste_presupuestal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') AND (
       (TG_OP IN ('INSERT', 'UPDATE') AND NEW."tipoOperacion" = 98)
    OR (TG_OP IN ('UPDATE', 'DELETE') AND OLD."tipoOperacion" = 98)
  ) THEN
    RAISE EXCEPTION 'CXP_AJUSTE_SOLO_SERVICIO: Los ajustes presupuestales solo se gestionan desde la aplicación.'
      USING HINT = 'Use la pantalla Ajustes presupuestales (permiso 432).';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
DROP TRIGGER IF EXISTS trg_cxp_guardia_ajuste ON public.cxp;
CREATE TRIGGER trg_cxp_guardia_ajuste
  BEFORE INSERT OR UPDATE OR DELETE ON public.cxp
  FOR EACH ROW EXECUTE FUNCTION public.cxp_guardia_ajuste_presupuestal();
-- REVERSA: DROP TRIGGER trg_cxp_guardia_ajuste ON public.cxp; DROP FUNCTION public.cxp_guardia_ajuste_presupuestal();

-- ------------------------------------------------------------------------------------
-- M9 · Vistas externas (Looker / n8n): que un ajuste ANULADO (status = false) no siga saliendo como «Pagado»
-- Hoy hay 0 filas de cxp con status=false, así que el filtro es neutro con los datos actuales. Mismas columnas (CREATE OR REPLACE válido).
--   · lkr_cxp: se agrega WHERE c.status = true (los ajustes SÍ aparecen en Looker, con tipoOperacion = 98).
--   · n8n_cxp_resumen: resumen por usuario y estado → se excluyen anulados y también los ajustes (no son solicitudes de ese usuario).
-- ⚠ Antes de aplicar: volver a leer pg_get_viewdef (definiciones del 2026-11-03 abajo) y avisar a Jereff que Looker/n8n son consumidores externos no verificados.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.lkr_cxp AS
SELECT c.estado, c."nombreProveedor", c."tipoProveedor", c."fecCFDI", c."fecSolicitud", c.folio, c."nomCFDI", c.parque, c.nave,
       c.concepto, c.subtotal, c.total, c."montoAplicado", c.moneda, c."fecAutorizacion", c."fecPago", c."numSem", c."numAnio",
       c."numMes", c."rangoSemana", c."ultimoComentario", c."esUrgente", c.completada, c.tdc, c."pagoInmediato", c.diferido,
       c."autorizadoFP", c."tipoOperacion", c."nomGerente", c."lineaCaptura", c.referencia, c."fechaLimite", pc.cuenta, pc.seccion
FROM cxp c
LEFT JOIN "PresCategorias" pc ON c."idCategoria" = pc."idCategoria"
WHERE c.status = true;

CREATE OR REPLACE VIEW public.n8n_cxp_resumen WITH (security_invoker = true) AS
SELECT DISTINCT c.uidr, c.estado, c."idEstado", u.nombre, u.apellidos, u.email, count(*) AS count
FROM cxp c
JOIN "catUsers" u ON u.uid = c.uidr
WHERE c.status = true AND c."tipoOperacion" <> 98
GROUP BY c.uidr, c.estado, c."idEstado", u.nombre, u.apellidos, u.email
ORDER BY c.uidr;
-- REVERSA: recrear ambas vistas sin la línea WHERE (definición idéntica a la guardada en temp/respaldos/def-vistas-externas-<fecha>.sql).
--   (n8n_cxp_x_autorizar solo mira idEstado = 2: no cambia.) Verificar GRANTs de cada vista antes y después.

-- ------------------------------------------------------------------------------------
-- M7 · RPC de Cuentas con año y con la bandera solo anual
-- La firma cambia (columnas nuevas + p_anio): DROP + CREATE (un REPLACE crearía una sobrecarga y las llamadas de 3 argumentos
-- quedarían ambiguas). p_anio es opcional: NULL = presupuesto activo (comportamiento de hoy).
-- Un año SIN fila en Presupuestos (p. ej. 2024) igual lista las cuentas con presupuesto 0 e idPresupuesto NULL
-- (por eso LEFT JOIN y no CROSS JOIN). ACL actual a reponer: =X/postgres, anon, authenticated, service_role (se repone igual).
-- ------------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.prescategorias_obtener_con_presupuesto(text, text, text);
CREATE OR REPLACE FUNCTION public.prescategorias_obtener_con_presupuesto(
  p_id_categoria text DEFAULT NULL::text,
  p_cuenta       text DEFAULT NULL::text,
  p_seccion      text DEFAULT NULL::text,
  p_anio         integer DEFAULT NULL::integer
)
RETURNS TABLE (
  "idCategoria" text, status boolean, presupuestable boolean, cuenta text, seccion text, descripcion text,
  presupuesto_anual double precision, "uidResponsable" uuid, "nomCompleto" text, "idPresupuesto" uuid,
  "statusPres" boolean, "soloAnual" boolean, anio integer
)
LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH presupuesto_elegido AS (
        SELECT pr."idPresupuesto" AS presupuesto_id, pr.anio::integer AS anio_pres
        FROM "Presupuestos" pr
        WHERE (p_anio IS NULL AND pr.status = true) OR (p_anio IS NOT NULL AND pr.anio = p_anio)
        ORDER BY pr.status DESC, pr.fc DESC
        LIMIT 1
    )
    SELECT
        c."idCategoria", c.status, c.presupuestable, c.cuenta, c.seccion,
        COALESCE(c.descripcion, '') AS descripcion,
        COALESCE(SUM(pd.monto), 0) AS presupuesto_anual,
        c."uidResponsable", u."nomCompleto", pe.presupuesto_id AS "idPresupuesto",
        (pe.presupuesto_id IS NOT NULL) AS "statusPres", c."soloAnual",
        COALESCE(pe.anio_pres, p_anio) AS anio
    FROM "PresCategorias" c
    LEFT JOIN presupuesto_elegido pe ON true
    LEFT JOIN "PresDetalle" pd ON pd."idCategoria" = c."idCategoria" AND pd."idPresupuesto" = pe.presupuesto_id
    LEFT JOIN "catUsers" u ON u.uid = c."uidResponsable"
    WHERE (p_id_categoria IS NULL OR c."idCategoria" ILIKE '%' || p_id_categoria || '%')
      AND (p_cuenta  IS NULL OR c.cuenta  ILIKE '%' || p_cuenta  || '%')
      AND (p_seccion IS NULL OR c.seccion ILIKE '%' || p_seccion || '%')
    GROUP BY c."idCategoria", c.status, c.presupuestable, c.cuenta, c.seccion, c.descripcion,
             c."uidResponsable", u."nomCompleto", pe.presupuesto_id, c."soloAnual", pe.anio_pres
    ORDER BY c.cuenta ASC, c.seccion ASC;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.prescategorias_obtener_con_presupuesto(text, text, text, integer)
  TO anon, authenticated, service_role;  -- misma ACL que tenía; el endurecimiento de esta RPC es trabajo aparte (P0 del repo)
-- REVERSA: DROP la nueva y recrear la versión de 3 parámetros guardada en
--          temp/respaldos/def-prescategorias_obtener_con_presupuesto-<fecha>.sql

-- ------------------------------------------------------------------------------------
-- M10 · F0 / #80 — Relleno del subtotal de las urgentes (2) y líneas de captura (4) ya cargadas
-- Hasta hoy el formulario solo pedía el TOTAL y el subtotal quedaba en 0 (DEFAULT de la columna): el presupuesto, que mide el subtotal,
-- no las veía. Regla conservadora: subtotal = total (trámites, licencias, IMSS e ISN no llevan IVA; donde sí lo hubo, sobreestima hasta 16 %).
-- Se aplica DESPUÉS del push 0 (el código nuevo ya escribe el subtotal) y se RE-EJECUTA una vez más (idempotente: solo toca filas vacías o en 0).
-- ANTES: CSV de respaldo en temp/respaldos/ de las filas a tocar (idCxp, tipoOperacion, idEstado, idCategoria, subtotal, total, uidGerente).
-- Efectos verificados (05-BACKEND V31): ningún trigger cambia otra columna; `trg_auditoria` registra el cambio con uid NULL y origen = 3 (corrida por MCP,
-- igual que la corrección PPD). Esperado hoy: 86 filas (35 urgentes + 51 líneas). Si Jereff incluye «Facturas sin XML», agregar el tipo 6 (+5 filas).
-- ------------------------------------------------------------------------------------
-- EXCLUSIONES (validación F0-01/F0-02; decide Jereff/CxP antes de aplicar): agregar abajo `AND "idCxp" NOT IN ('…')` con las urgentes/líneas que NO deben contar
-- (cargas manuales de años anteriores; duplicados de facturas ya pagadas). La 2.ª corrida lleva su propio CSV de respaldo (plan 0.8).
UPDATE public.cxp
   SET subtotal = total
 WHERE status = true
   AND "tipoOperacion" IN (2, 4)
   AND COALESCE(subtotal, 0) = 0
   AND COALESCE(total, 0) > 0;
-- VERIFICAR: SELECT "tipoOperacion", count(*) FROM public.cxp WHERE status AND "tipoOperacion" IN (2,4) AND COALESCE(subtotal,0) = 0 GROUP BY 1;  -- 0 filas
-- REVERSA (desde el CSV de respaldo, solo filas cuyo subtotal siga igual al total relleno):
--   UPDATE public.cxp c SET subtotal = r.subtotal FROM temp_respaldo_m10 r WHERE c."idCxp" = r."idCxp" AND c.subtotal = c.total;  -- (tabla temporal cargada del CSV)

-- ------------------------------------------------------------------------------------
-- M11 · F0 / #80 — Candado: una urgente o línea de captura VIGENTE no puede tener subtotal vacío o 0
-- Va DESPUÉS de M10 (si no, el ALTER falla por las filas vigentes en 0) y DESPUÉS del código F0 (el código viejo insertaría subtotal 0 y fallaría).
-- Las filas con status = false (anuladas/eliminadas) quedan exentas. Un CHECK que evalúa a NULL pasa: por eso COALESCE e IS DISTINCT FROM.
-- ------------------------------------------------------------------------------------
ALTER TABLE public.cxp
  ADD CONSTRAINT cxp_subtotal_captura_especial_chk CHECK (
    COALESCE("tipoOperacion", 0) NOT IN (2, 4)
    OR status IS DISTINCT FROM true
    OR COALESCE(subtotal, 0) > 0
  );
COMMENT ON CONSTRAINT cxp_subtotal_captura_especial_chk ON public.cxp IS
  'Urgentes (2) y líneas de captura (4) vigentes deben llevar subtotal > 0: el presupuesto mide el subtotal (pendiente #80).';
-- REVERSA: ALTER TABLE public.cxp DROP CONSTRAINT cxp_subtotal_captura_especial_chk;
