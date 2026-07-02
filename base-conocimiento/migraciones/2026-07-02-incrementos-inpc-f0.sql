-- ============================================================================
-- Incrementos automáticos de renta por INPC — Fase F0 (M1–M4)
-- Aplicada en producción el 2026-07-02 (autorizada por el usuario; vía MCP
-- apply_migration: arrepdpdetalle_aplicainpc, arre_incrementos,
-- parque_responsables, configs_incremento_inpc).
-- Diseño: base-conocimiento/PLAN-incrementos-inpc-automaticos.md
-- Verificación post-aplicación: 2 filas exentas (_EX_), 30,530 incrementables,
-- RLS ON + trg_auditoria en ambas tablas nuevas, 3 índices, 2 configs.
-- ============================================================================

-- M1 — Columna aplicaInpc en arrePdpDetalle (¿el concepto se incrementa?)
ALTER TABLE public."arrePdpDetalle"
  ADD COLUMN "aplicaInpc" boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN public."arrePdpDetalle"."aplicaInpc" IS
  'true = el concepto se incrementa con INPC+pts en el aniversario (conceptos del plan). false = cargo extraordinario agregado desde Gestión de Pagos (agua, moratorios, penalización puntual), exento del incremento automático.';
UPDATE public."arrePdpDetalle"
   SET "aplicaInpc" = false
 WHERE "idArrePdpDet" LIKE '%\_EX\_%' ESCAPE '\';

-- M2 — Bitácora de incrementos (fuente de verdad de "¿ya se aplicó?")
CREATE TABLE public.arre_incrementos (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "idArrePdp"        text NOT NULL,
  "anioAplicado"     smallint NOT NULL CHECK ("anioAplicado" >= 2),
  "idInpc"           text NOT NULL,
  "inpcAplicado"     numeric NOT NULL,
  "ptsAplicados"     numeric NOT NULL DEFAULT 0,
  "desfaseMeses"     smallint,
  detalle            jsonb NOT NULL,
  origen             text NOT NULL CHECK (origen IN ('automatico','manual','reaplicacion')),
  estado             text NOT NULL DEFAULT 'aplicado' CHECK (estado IN ('aplicado','revertido')),
  "correoNotificado" text[],
  "fecNotificacion"  timestamptz,
  "revertidoPor"     text,
  "fecReversion"     timestamptz,
  "motivoReversion"  text,
  uidr               text NOT NULL,
  fc                 timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.arre_incrementos IS
  'Bitácora de incrementos de renta por INPC (Arrendatarios). Una fila por plan+año incrementado; detalle = snapshot por concepto para reversión exacta. Fuente de verdad de "¿ya se aplicó?" (el INPC de la corrida puede traer arrastres).';
CREATE UNIQUE INDEX arre_incrementos_unico_aplicado
  ON public.arre_incrementos ("idArrePdp", "anioAplicado") WHERE estado = 'aplicado';
CREATE INDEX arre_incrementos_idinpc ON public.arre_incrementos ("idInpc") WHERE estado = 'aplicado';
ALTER TABLE public.arre_incrementos ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_auditoria AFTER INSERT OR DELETE OR UPDATE ON public.arre_incrementos
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria('id');

-- M3 — Responsables de parque (N por parque; destinatarios del correo)
CREATE TABLE public.parque_responsables (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "idParque" text NOT NULL,
  uid        text NOT NULL,
  uidr       text,
  fc         timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("idParque", uid)
);
COMMENT ON TABLE public.parque_responsables IS
  'Responsables de parque (N por parque) para notificaciones de incrementos INPC de Arrendatarios. uid = catUsers.uid (activo y con correo; valida el backend). Sin FK dura (patrón del proyecto). Baja = DELETE (queda rastro en auditoria).';
ALTER TABLE public.parque_responsables ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_auditoria AFTER INSERT OR DELETE OR UPDATE ON public.parque_responsables
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria('id');

-- M4 — Configuración del flujo
INSERT INTO public."SPHConfiguraciones" (parametro, valor, tipo, status, detalle) VALUES
('ARRE_INPC_DESFASE_MESES', '3', 1, true,
 'Meses de desfase entre el mes del INPC capturado y el mes de aniversario de los contratos a incrementar. Ej.: 3 → el INPC de junio aplica a los contratos que cumplen aniversario en septiembre.'),
('ARRE_INPC_GERENTE_UID', '', 1, true,
 'uid (catUsers) de la gerencia de Arrendatarios: recibe el correo con TODOS los incrementos aplicados y cubre los parques sin responsable asignado. Se administra desde Arrendatarios → Responsables.');
