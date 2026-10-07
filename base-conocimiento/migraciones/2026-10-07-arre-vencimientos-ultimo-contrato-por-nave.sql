-- ============================================================================
-- 2026-10-07 · Arrendatarios · Gestión de Pagos — paneles de vencimientos sin naves repetidas
-- ----------------------------------------------------------------------------
-- Bug (Jereff, 2026-10-07): el sidebar del dashboard listaba la MISMA nave dos veces cuando
-- tenía un contrato viejo y otro renovado, ambos ya vencidos (naves 43/44/45 de Acupark II,
-- C de Sitapark: contratos 2025 y 2026 de la misma empresa).
--
-- Causa raíz: `contratos_vencidos_sin_renovacion` solo comprobaba que la nave no tuviera
-- contrato vigente y devolvía TODA fila de arrePdp con fecFin < hoy; no se quedaba con el
-- último contrato por nave. `contratos_por_vencer` tenía el mismo hueco latente (dos
-- contratos con vigente=true en una nave).
--
-- Regla nueva: por nave física (idNave) solo cuenta el contrato de MAYOR fecFin.
--   · Sin renovación: ese último contrato debe estar vencido y vinculado (status=true).
--   · Por vencer: se toma el último contrato vigente de la nave y luego se aplica el rango.
-- Efecto en prod: sin renovación 8 → 4; por vencer (365 días) 54 → 52; 0 naves repetidas.
--
-- APLICADA en prod vía apply_migration el 2026-10-07
-- (nombre supabase: arre_vencimientos_ultimo_contrato_por_nave).
-- Misma regla replicada en el reporte de Vencimientos (API): reportes-arre.service.ts.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.contratos_vencidos_sin_renovacion()
 RETURNS TABLE(nave text, parque text, razon_social text, fec_fin date, dias_vencido integer, moneda text)
 LANGUAGE plpgsql
AS $function$
BEGIN
  --[Fecha y Hora]: 07/10/2026
  --[Descripción]: Contratos de arrePdp vencidos sin renovación. Muestra SOLO el ÚLTIMO contrato
  --               (mayor fecFin) de cada nave física: los contratos viejos de una nave renovada
  --               ya no se listan. El último debe seguir VINCULADO (arrenPropiedades.status=true),
  --               estar vencido y la nave no tener ningún contrato vigente. Excluye arrendatarios
  --               de prueba. Fix 07/10/2026 (naves repetidas en panel sidebar).
  RETURN QUERY
  WITH ultimo AS (
    SELECT DISTINCT ON (COALESCE(ap."idNave"::text, a."idArrePdp"::text))
      a."idArrePdp", a."fecFin", a."Moneda", ap."idNave", ap."idArrendador", ap."status"
    FROM public."arrePdp" a
    JOIN public."arrenPropiedades" ap ON ap."idNavArrend" = a."idNavArrend"
    ORDER BY COALESCE(ap."idNave"::text, a."idArrePdp"::text), a."fecFin" DESC NULLS FIRST, a."idArrePdp" DESC
  )
  SELECT
    COALESCE(n."numNaveNAME", n."numNave"::text, 'N/A')::text        AS nave,
    COALESCE(p."nomParque", 'N/A')::text                             AS parque,
    COALESCE(NULLIF(i."razonsocial",''), i.nombre, 'N/A')::text      AS razon_social,
    u."fecFin"                                                       AS fec_fin,
    (CURRENT_DATE - u."fecFin")::integer                             AS dias_vencido,
    COALESCE(u."Moneda", 'MXN')::text                                AS moneda
  FROM ultimo u
  LEFT JOIN public.naves         n ON n."idNave"          = u."idNave"
  LEFT JOIN public.parques       p ON p."idParque"        = n."idParque"
  LEFT JOIN public.inversionista i ON i."idInversionista" = u."idArrendador"
  WHERE u."fecFin" < CURRENT_DATE
    AND u."status" = true
    AND COALESCE(i."pruebas", false) = false
  ORDER BY u."fecFin" DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.contratos_por_vencer(p_fecha_desde date DEFAULT NULL::date, p_fecha_hasta date DEFAULT NULL::date)
 RETURNS TABLE(nave text, parque text, razon_social text, fec_fin date, moneda text)
 LANGUAGE plpgsql
AS $function$
BEGIN
  --[Fecha y Hora]: 07/10/2026
  --[Descripción]: Contratos vigentes de arrePdp cuya fecFin cae en [p_fecha_desde, p_fecha_hasta].
  --               Por nave física se toma SOLO el contrato vigente de mayor fecFin (si hay un
  --               contrato viejo y otro renovado, el viejo no aparece). Panel "próximos
  --               vencimientos" del sidebar. Fix 07/10/2026.
  RETURN QUERY
  WITH ultimo AS (
    SELECT DISTINCT ON (COALESCE(ap."idNave"::text, a."idArrePdp"::text))
      a."idArrePdp", a."fecFin", a."Moneda", ap."idNave", ap."idArrendador"
    FROM public."arrePdp" a
    LEFT JOIN public."arrenPropiedades" ap ON ap."idNavArrend" = a."idNavArrend"
    WHERE a."vigente" = true
    ORDER BY COALESCE(ap."idNave"::text, a."idArrePdp"::text), a."fecFin" DESC NULLS FIRST, a."idArrePdp" DESC
  )
  SELECT
    COALESCE(n."numNaveNAME", n."numNave"::text, 'N/A')::text        AS nave,
    COALESCE(p."nomParque", 'N/A')::text                             AS parque,
    COALESCE(NULLIF(i."razonsocial",''), i.nombre, 'N/A')::text      AS razon_social,
    u."fecFin"                                                       AS fec_fin,
    COALESCE(u."Moneda", 'MXN')::text                                AS moneda
  FROM ultimo u
  LEFT JOIN public.naves         n ON n."idNave"          = u."idNave"
  LEFT JOIN public.parques       p ON p."idParque"        = n."idParque"
  LEFT JOIN public.inversionista i ON i."idInversionista" = u."idArrendador"
  WHERE (p_fecha_desde IS NULL OR u."fecFin" >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR u."fecFin" <= p_fecha_hasta)
  ORDER BY u."fecFin" ASC;
END;
$function$;
