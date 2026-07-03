-- ============================================================================
-- 2026-07-02 · Arrendatarios · Gestión de Pagos — "Contratos vencidos sin renovación"
-- ----------------------------------------------------------------------------
-- Bug: el panel del sidebar (y el reporte de Vencimientos) mostraban arrendatarios
-- que ya NO tienen la nave: se habían desvinculado (arrenPropiedades.status=false)
-- porque se fueron o la nave se re-rentó a otro cliente. Caso real: COMERCIALIZADORA
-- DON CACAHUATO (naves 37 y 38 de Spartek), la 37 ya re-rentada a ANDREA OCHOA.
--
-- Causa raíz: la RPC deduplicaba por idNavArrend (vínculo nave+arrendatario) en vez
-- de por la nave física (idNave), y NO exigía vínculo activo ni excluía datos de prueba.
--
-- Regla acordada con el usuario (2026-07-02): "desde el momento en que se desvincula
-- la nave, el contrato queda fuera; el cliente se fue y la nave queda disponible".
-- Verificado en prod: 22 → 14 filas (DON CACAHUATO fuera; se quedan los pendientes
-- reales con vínculo activo, p.ej. SEMINUEVOS 113/110).
-- ============================================================================

-- ============================== PARTE 1 · APLICADA ==========================
-- Aplicada en prod vía apply_migration el 2026-07-02
-- (nombre supabase: fix_contratos_vencidos_sin_renovacion_vinculo_activo).
CREATE OR REPLACE FUNCTION public.contratos_vencidos_sin_renovacion()
 RETURNS TABLE(nave text, parque text, razon_social text, fec_fin date, dias_vencido integer, moneda text)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(n."numNaveNAME", n."numNave"::text, 'N/A')::text        AS nave,
    COALESCE(p."nomParque", 'N/A')::text                             AS parque,
    COALESCE(NULLIF(i."razonsocial",''), i.nombre, 'N/A')::text      AS razon_social,
    a."fecFin"                                                        AS fec_fin,
    (CURRENT_DATE - a."fecFin")::integer                             AS dias_vencido,
    COALESCE(a."Moneda", 'MXN')::text                                AS moneda
  FROM public."arrePdp" a
  JOIN public."arrenPropiedades" ap ON ap."idNavArrend" = a."idNavArrend"
  LEFT JOIN public.naves               n  ON n."idNave"          = ap."idNave"
  LEFT JOIN public.parques             p  ON p."idParque"        = n."idParque"
  LEFT JOIN public.inversionista       i  ON i."idInversionista" = ap."idArrendador"
  WHERE a."fecFin" < CURRENT_DATE
    AND ap."status" = true                          -- (1) vínculo activo: sin desvincular
    AND COALESCE(i."pruebas", false) = false        -- (3) fuera datos de prueba
    AND NOT EXISTS (                                 -- (2) la NAVE FÍSICA no tiene contrato vigente
      SELECT 1
      FROM public."arrenPropiedades" ap2
      JOIN public."arrePdp" a2 ON a2."idNavArrend" = ap2."idNavArrend"
      WHERE ap2."idNave" = ap."idNave"
        AND (a2."fecFin" IS NULL OR a2."fecFin" >= CURRENT_DATE)
    )
  ORDER BY a."fecFin" DESC;
END;
$function$;

-- ===================== PARTE 2 · PENDIENTE (NO aplicada) =====================
-- ⛔ NO aplicar sin OK explícito de Jereff. El clasificador de auto-mode bloqueó
-- esta migración porque el usuario solo pidió VERIFICAR "próximos por vencer".
-- Verificado: contratos_por_vencer NO tiene el bug de desvinculación (0 vínculos
-- cerrados, 0 re-rentas) — solo se cuelan 2 filas de datos de prueba. Único cambio:
-- excluir arrendatarios de prueba, mismo criterio que la Parte 1.
--
-- CREATE OR REPLACE FUNCTION public.contratos_por_vencer(p_fecha_desde date DEFAULT NULL::date, p_fecha_hasta date DEFAULT NULL::date)
--  RETURNS TABLE(nave text, parque text, razon_social text, fec_fin date, moneda text)
--  LANGUAGE plpgsql AS $function$
-- BEGIN
--   RETURN QUERY
--   SELECT
--     COALESCE(n."numNaveNAME", n."numNave"::text, 'N/A')::text,
--     COALESCE(p."nomParque", 'N/A')::text,
--     COALESCE(NULLIF(i."razonsocial",''), i.nombre, 'N/A')::text,
--     a."fecFin",
--     COALESCE(a."Moneda", 'MXN')::text
--   FROM public."arrePdp" a
--   LEFT JOIN public."arrenPropiedades" ap ON ap."idNavArrend" = a."idNavArrend"
--   LEFT JOIN public.naves               n  ON n."idNave"      = ap."idNave"
--   LEFT JOIN public.parques             p  ON p."idParque"    = n."idParque"
--   LEFT JOIN public.inversionista       i  ON i."idInversionista" = ap."idArrendador"
--   WHERE a."vigente" = true
--     AND COALESCE(i."pruebas", false) = false
--     AND (p_fecha_desde IS NULL OR a."fecFin" >= p_fecha_desde)
--     AND (p_fecha_hasta IS NULL OR a."fecFin" <= p_fecha_hasta)
--   ORDER BY a."fecFin" ASC;
-- END; $function$;
