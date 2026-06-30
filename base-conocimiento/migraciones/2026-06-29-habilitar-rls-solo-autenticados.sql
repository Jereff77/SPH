-- =============================================================================
-- 2026-06-29 · Habilitar RLS (acceso solo autenticados) en tablas que NO la tenían
-- -----------------------------------------------------------------------------
-- CONTEXTO: paso de seguridad (defensa en profundidad), 2 días antes de una revisión.
-- Cierra el acceso ANÓNIMO (rol `anon`) a estas tablas (p. ej. `inversionista` con
-- RFC/CURP era legible sin login).
--
-- ⚠️ MODELO DE AUTORIZACIÓN DEL PROYECTO: NO hay aislamiento por usuario/fila. El
-- control es RBAC por CLAVE de permiso a nivel de módulo, validado SERVER-SIDE en el
-- backend (quien tiene la clave del módulo ve TODOS sus registros). Por eso estas
-- políticas son permisivas para `authenticated` (no filtran por fila): el aislamiento
-- real lo hace el backend por clave. RLS aquí es solo defensa en profundidad: que las
-- tablas no queden accesibles sin sesión (anon).
--
-- IMPACTO EN v2: NINGUNO. El backend usa service_role (`admin` y `comoActor` firman
-- con role=service_role, que tiene BYPASSRLS) y aplica el RBAC por clave. Solo cambia
-- el acceso de clientes anon/authenticated DIRECTOS (v1, ya sin usuarios).
--
-- REVERSIBLE:
--   ALTER TABLE <t> DISABLE ROW LEVEL SECURITY;  -- en las 10 tablas
--   DROP POLICY "AuthenticatedAccess_arre_ordenante" ON "arre_ordenante";  -- + las otras 3 nuevas
-- =============================================================================

-- 1) Ya tenían políticas correctas (Authenticated permisiva + bloqueo anon, o por
--    comando con auth.role()='authenticated'): solo habilitar RLS.
ALTER TABLE "arrePdp" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "arrePdpDetalle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "arrenPropiedades" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "naves" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "parques" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inversionista" ENABLE ROW LEVEL SECURITY;  -- select/insert/update_autenticado (auth.role()='authenticated')

-- 2) Sin políticas: habilitar RLS + política permisiva SOLO para authenticated.
ALTER TABLE "arre_ordenante" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "AuthenticatedAccess_arre_ordenante" ON "arre_ordenante"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE "arre_pagos" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "AuthenticatedAccess_arre_pagos" ON "arre_pagos"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE "auditoria" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "AuthenticatedAccess_auditoria" ON "auditoria"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE "reporte_html_parts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "AuthenticatedAccess_reporte_html_parts" ON "reporte_html_parts"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
