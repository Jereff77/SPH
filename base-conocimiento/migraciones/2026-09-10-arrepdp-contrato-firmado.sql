-- ============================================================================
-- 2026-09-10 · arrePdp: "contrato firmado" por versión de plan (Arrendatarios ·
-- Planes de Renta)
-- ----------------------------------------------------------------------------
-- POR QUÉ:
--   El contrato en papel se sube como documento en Configuración → Documentos
--   del arrendatario (`inversionista_docs`), pero nada en el sistema indicaba
--   si YA se cuenta con ese contrato firmado. Cada fila de `arrePdp` es una
--   VERSIÓN del contrato (alta nueva o renovación): el estado "firmado" y el
--   documento que lo respalda son por versión, no por arrendatario.
--
-- QUÉ CAMBIA (aditivo, tabla compartida con v1 — autorizado por Jereff):
--   + `arrePdp."contratoFirmado"` boolean NOT NULL DEFAULT false.
--   + `arrePdp."idContratoDoc"` text NULL, FK → `inversionista_docs."idDocumento"`.
--
-- QUÉ **NO** CAMBIA:
--   · No toca ninguna fila existente (ALTER ADD COLUMN con DEFAULT; 203 filas
--     verificadas, 0 marcadas como firmadas al aplicar).
--   · Sin RLS/trigger nuevos: el aislamiento "el documento debe ser del mismo
--     arrendatario que el plan" y la limpieza al apagar el switch viven en el
--     backend v2 (`PlanesArreService.marcarContratoFirmado`, endpoint
--     `PATCH /arrendatarios/planes/:idArrePdp/contrato`, permiso 25).
--
-- ⚠️ HALLAZGO DEL GATE ADVERSARIAL (resuelto en el mismo cierre, decisión de
--    Jereff 2026-09-10): la política RLS de `arrePdp` para `authenticated` es
--    `ALL / USING true / WITH CHECK true`, y el FK solo valida que el
--    documento EXISTA, no que sea del mismo arrendatario. La regla "firmado ⇒
--    documento del mismo arrendatario" sigue viviendo SOLO en el backend v2
--    (`PlanesArreService.marcarContratoFirmado`); ese vector ya no aplica en
--    la práctica porque **v1 fue eliminado por completo** (confirmado por
--    Jereff) y ningún cliente llega a Supabase con una key propia (frontera de
--    confianza v2: el front solo habla con `/api/*`). Como candado extra de
--    todos modos se agregó el CHECK (ver
--    `2026-09-10-arrepdp-contrato-firmado-check.sql`):
--      firmado ⇒ documento no nulo (y viceversa).
--    El aislamiento por arrendatario en el propio motor (trigger que compare
--    `idInversionista` del documento vs `idArrendador` del plan) se descartó:
--    con v1 fuera y sin acceso directo a Supabase desde el cliente, el
--    backend v2 ya es la única puerta.
--
-- Aplicado vía MCP `supaSPH` (`apply_migration`, nombre
-- `2026-09-10-arrepdp-contrato-firmado`). BD de PRODUCCIÓN.
-- ============================================================================

ALTER TABLE public."arrePdp"
  ADD COLUMN "contratoFirmado" boolean NOT NULL DEFAULT false,
  ADD COLUMN "idContratoDoc" text NULL REFERENCES public.inversionista_docs("idDocumento");

COMMENT ON COLUMN public."arrePdp"."contratoFirmado" IS 'Si ya se cuenta con el contrato firmado de ESTA versión del plan (nuevo o renovación). Se marca desde Arrendatarios > Planes de Renta.';
COMMENT ON COLUMN public."arrePdp"."idContratoDoc" IS 'Documento (inversionista_docs) que respalda el contrato firmado de esta versión del plan. NULL si contratoFirmado=false.';

-- ============================================================================
-- ROLLBACK:
--   ALTER TABLE public."arrePdp" DROP COLUMN "contratoFirmado", DROP COLUMN "idContratoDoc";
-- ============================================================================
