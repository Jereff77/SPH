-- ============================================================================
-- 2026-09-10 · arrePdp: candado CHECK del contrato firmado
-- ----------------------------------------------------------------------------
-- Complemento de `2026-09-10-arrepdp-contrato-firmado.sql` (ver ese archivo
-- para el porqué completo). Defensa en profundidad decidida por Jereff en el
-- gate adversarial de la feature: la regla "firmado ⇒ documento" ya la
-- garantiza el backend v2, pero se agrega también como candado en la BD.
--
-- QUÉ NO CAMBIA: aditivo puro (CHECK constraint). Verificado que las 203 filas
-- existentes cumplen la condición (todas con contratoFirmado=false por default
-- y ninguna con idContratoDoc asignado al momento de aplicar).
--
-- Aplicado vía MCP `supaSPH`. BD de PRODUCCIÓN.
-- ============================================================================

ALTER TABLE public."arrePdp"
  ADD CONSTRAINT "arrePdp_contrato_check"
  CHECK ((NOT "contratoFirmado" AND "idContratoDoc" IS NULL)
      OR ("contratoFirmado" AND "idContratoDoc" IS NOT NULL));

-- ============================================================================
-- ROLLBACK:
--   ALTER TABLE public."arrePdp" DROP CONSTRAINT "arrePdp_contrato_check";
-- ============================================================================
