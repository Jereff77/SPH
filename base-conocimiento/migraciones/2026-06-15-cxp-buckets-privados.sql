-- =============================================================================
-- CxP: volver PRIVADOS los buckets de documentos (comprobantes + facturas)
-- =============================================================================
-- Contexto: el backend v2 ya genera URLs FIRMADAS al vuelo
--   (apps/api/src/modules/cxp/documentos.util.ts + integración en los listados
--    de pagos/solicitudes/aprobacion/pendientes/ppd y en verTransferencia).
-- Por eso estos buckets ya NO necesitan ser públicos.
--
-- ⚠️ SECUENCIA OBLIGATORIA (el orden importa para NO romper producción):
--   1. Desplegar el backend v2 con la firma al vuelo
--      (commit + push a erp_v2 + redeploy del servicio `api` en EasyPanel).
--   2. Verificar que los enlaces "PDF / XML / comprobante" de CxP abren
--      correctamente (ahora con signed URLs, con el bucket TODAVÍA público).
--   3. SOLO ENTONCES ejecutar este UPDATE.
--
-- ⚠️ Premisa: Flutter v1 ya NO lee estos buckets para CxP (confirmado por el
--    usuario). Mientras v1 los leyera, esto rompería v1 (regla de coexistencia).
--
-- Reversible:  update ... set public = true  para volver atrás de inmediato.
-- =============================================================================

update storage.buckets
set public = false
where id in ('cxp', 'CFDIproveedores');

-- Verificación (debe devolver public = false en ambos):
-- select id, public from storage.buckets where id in ('cxp', 'CFDIproveedores');
