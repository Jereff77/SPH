---
documento: Plan de implementación — Incrementos automáticos de renta por INPC (Arrendatarios)
estado: ✅ IMPLEMENTADO (2026-07-02) — F0–F6 completos; validado por seguridad adversarial (Opus, A1/M1/M2 corregidos) y probado e2e con datos sintéticos (limpieza total). Pendiente el cierre formal (changelog/versión/commit — push retenido por orden del usuario). Documentación viva: base-conocimiento/modulos/incrementos-inpc.md
autor_analisis: Toribio (Claude Fable 5) con Jereff, sesiones 2026-07-01/02
palabras_clave: [inpc, incremento, renta, aniversario, arrePdp, arrePdpDetalle, arre_incrementos,
  parque_responsables, aplicaInpc, desfase, notificacion, correo, responsable de parque, reversion]
relacionados: [modulos/arrendatarios.md, OBSOLESCENCIA-BD.md, modulos/parametros → InpcTab]
---

# Plan — Incrementos automáticos de renta por INPC

> **Qué es.** Diseño acordado y plan por fases para que, al capturar el INPC del mes en
> Parámetros → INPC, el sistema calcule y aplique (con vista previa + confirmación) el incremento
> anual de renta a los contratos de arrendamiento que cumplen aniversario, notifique por correo a los
> responsables de parque y deje bitácora reversible. Sustituye el kit de funciones viejas de INPC
> (ya marcadas en `OBSOLESCENCIA-BD.md` §7) por **una sola función correcta**.

## 1. Regla de negocio (decisiones cerradas con el usuario)

1. **Desfase configurable.** El incremento de un contrato usa el INPC de **N meses antes** de su mes de
   aniversario (`ARRE_INPC_DESFASE_MESES`, default **3**; configurable 2/3/5…). Ej.: INPC de junio
   (publicado por INEGI ~10 de julio) → contratos con aniversario en **septiembre**.
2. **Fórmula.** `pm2[año N] = pm2[año N−1] × (1 + (INPC + ptsINPC)/100)`. Los **puntos pactados**
   (`ptsINPC`, sembrados desde `arrePdp.INPCPlus`) se suman al INPC. El año 1 es base: **nunca** se toca.
3. **Sin proyecciones.** Los años futuros sin INPC conocido quedan **planos** (mismo `pm2` del último año
   incrementado, `INPC=0`). Cada incremento es **compuesto** al llegar su INPC real. La corrida ya nace
   plana (verificado en BD 2026-07-01).
4. **Universo.** Solo planes **vigentes** (`arrePdp.vigente`, `status=true`) y **activos**
   (`arrenPropiedades.pdpActivo=true`), con año N≥2 iniciando en el mes objetivo.
5. **Conceptos.** Se incrementan **solo** las filas con **`aplicaInpc=true`** (todos los conceptos creados
   desde la configuración del plan: Renta/Admin/Mtto/Vig + financiados/KVA). Los **cargos extraordinarios**
   de Gestión de Pagos (agua, moratorios, penalizaciones puntuales; id con `_EX_`) llevan
   `aplicaInpc=false` y **no** se incrementan.
6. **Vista previa SIEMPRE** (decisión 2026-07-02): al capturar el INPC se muestra la lista de planes con
   renta actual → renta nueva y el usuario confirma "Aplicar incrementos". Nada se aplica sin ese clic.
   Mientras haya un INPC capturado con incrementos sin aplicar, **aviso persistente** en Parámetros → INPC.
7. **Captura tardía / dinero cobrado → manual, con corte a MES COMPLETO** (refinado 2026-07-02): un
   aniversario del **mes en curso** SÍ aplica aunque el día ya haya pasado (muchos contratos inician los
   días 1–9 y el INPC se captura ~día 10 — con corte al día siempre quedarían fuera). Solo va a manual si
   el **mes** del aniversario ya quedó atrás, o si el año objetivo tiene partidas pagadas (el dinero
   cobrado se protege siempre, antes que cualquier otra regla). La **aplicación manual** (doble clic)
   **se conserva** como válvula de escape.
8. **Corrección de un INPC ya aplicado.** El catálogo se corrige sin recalcular nada por sí solo; el
   sistema detecta los planes aplicados con ese `idInpc` (vía `arre_incrementos`) y muestra
   "está / se aplicó / quedaría" → con confirmación **revierte + re-aplica** (`origen='reaplicacion'`).
   Si un plan ya tiene pagos con el valor anterior → pasa a manual. Si el usuario no confirma, la
   bitácora marca el desfase ("aplicado con valor distinto al vigente", computado al vuelo).
9. **Reversión por contingencia.** Cualquier aplicación se puede revertir desde la bitácora usando el
   snapshot por concepto; la fila queda `estado='revertido'` (no se borra nada).
10. **Idempotencia.** Índice único parcial `(idArrePdp, anioAplicado) WHERE estado='aplicado'`: imposible
    aplicar dos veces el mismo año, venga del automático o del manual (la edición manual del INPC también
    registra en la bitácora con `origen='manual'`).
11. **Notificación por correo.** Al aplicar: **un solo correo por responsable de parque** con los planes
    de sus parques (Arrendatario · Nave · Renta anterior · % aplicado · Renta nueva) y **un correo a la
    gerente con TODOS** (decisión: la gerente recibe todo y cubre parques sin responsable). Un parque
    puede tener **varios responsables** (tabla `parque_responsables`; decisión 2026-07-02). El correo es
    **best-effort**: si falla el SMTP no se revierte nada; queda trazado y reenviable. Las
    re-aplicaciones también notifican ("Corrección de incremento").

## 2. Hallazgos previos que condicionan el diseño (verificados en BD)

- **Kit viejo roto/incompleto** → 6 funciones marcadas obsoletas en `OBSOLESCENCIA-BD.md` §7
  (2026-07-01). La única correcta y vigente es `arrepdpdetalle_actualizar_campo_manual` (la usa el doble
  clic de v2); su semántica (aplicar al año N y propagar plano) es la base de la RPC nueva.
- **No existe ningún cron de INPC** — hoy todo incremento es manual (la nota del KB de arrendatarios
  sobre "el cron de INPC" era imprecisa; corregirla al implementar).
- **Gotcha del `anio` desfasado** (KB arrendatarios): en el mes de aniversario un concepto puede quedar
  con `anio` una unidad abajo (crons v1 calculan por días/365.25). ⛔ La RPC nueva **no aplica por
  `anio`**: resuelve el rango de **partidas** del año N (`numPartida` de `(N−1)·12+1` a `N·12`;
  depósito = partida 0 fuera) o detecta/reporta el plan desalineado en la vista previa como "requiere
  saneo" en lugar de aplicar mal.
- **`inpc_verificar_vigencia_ultimo_registro()`** (huérfana de v1) es reutilizable para el aviso de
  "falta capturar el INPC del mes" (publica ~día 10).
- Cadena de datos completa: `arrePdp.idNavArrend` → `arrenPropiedades` → nave → `naves.idParque` →
  `parques`. Solo 2 filas `_EX_` existen al 2026-07-01 (backfill trivial).
- **Estado real de los aniversarios jun–oct 2026** (ver `REPORTE-incrementos-inpc-2026-jun-oct.md`,
  corte 2026-07-02): 18 planes con INPC oficial ya capturado y **sin incremento aplicado** (14 de
  julio + 4 de agosto), **3 pendientes de saneo manual** en junio (TAKAOKAYA B sin nada, LLLANTAS con
  aplicación **parcial por concepto** —2 de 4 conceptos con solo los pts—, GPRINT sin incremento en
  conceptos base) y **2 posibles planes duplicados** (SERRANA naves 79/80: plan v1 + plan v2 activos
  a la vez) que hay que sanear antes de que el automático aplique doble. Además el **INPC "arrastrado"**
  en la corrida quedó exhibido con datos reales → la bandera de aplicado JAMÁS se lee del INPC de la
  corrida, solo de `arre_incrementos`; y la **vista previa valida por concepto** (no por agregado)
  para atrapar aplicaciones parciales tipo LLLANTAS.

## 3. Cambios en BD (⚠️ TODOS requieren autorización explícita con este SQL al aplicar)

### M1 — Columna `aplicaInpc` en `arrePdpDetalle`

```sql
ALTER TABLE public."arrePdpDetalle"
  ADD COLUMN "aplicaInpc" boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN public."arrePdpDetalle"."aplicaInpc" IS
  'true = el concepto se incrementa con INPC+pts en el aniversario (conceptos del plan). false = cargo extraordinario agregado desde Gestión de Pagos (agua, moratorios, penalización puntual), exento del incremento automático.';
-- Backfill: los extraordinarios existentes se identifican por el marcador _EX_ del id (2 filas al 2026-07-01)
UPDATE public."arrePdpDetalle"
   SET "aplicaInpc" = false
 WHERE "idArrePdpDet" LIKE '%\_EX\_%' ESCAPE '\';
```
*(Postgres ≥11: el ADD COLUMN con default estático no reescribe la tabla — seguro con 30k filas.)*

### M2 — Tabla `arre_incrementos` (bitácora de aplicaciones)

```sql
CREATE TABLE public.arre_incrementos (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "idArrePdp"        text NOT NULL,
  "anioAplicado"     smallint NOT NULL CHECK ("anioAplicado" >= 2),
  "idInpc"           text NOT NULL,        -- registro de public.inpc usado
  "inpcAplicado"     numeric NOT NULL,
  "ptsAplicados"     numeric NOT NULL DEFAULT 0,
  "desfaseMeses"     smallint,             -- config vigente al aplicar (NULL en manuales)
  detalle            jsonb NOT NULL,       -- snapshot: [{concepto, pm2Anterior, inpcAnterior, pm2Nuevo}]
  origen             text NOT NULL CHECK (origen IN ('automatico','manual','reaplicacion')),
  estado             text NOT NULL DEFAULT 'aplicado' CHECK (estado IN ('aplicado','revertido')),
  "correoNotificado" text[],               -- destinatarios efectivos del aviso
  "fecNotificacion"  timestamptz,
  "revertidoPor"     text,
  "fecReversion"     timestamptz,
  "motivoReversion"  text,
  uidr               text NOT NULL,        -- actor (del JWT vía comoActor)
  fc                 timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX arre_incrementos_unico_aplicado
  ON public.arre_incrementos ("idArrePdp", "anioAplicado") WHERE estado = 'aplicado';
CREATE INDEX arre_incrementos_idinpc ON public.arre_incrementos ("idInpc") WHERE estado = 'aplicado';
ALTER TABLE public.arre_incrementos ENABLE ROW LEVEL SECURITY;  -- sin políticas: solo service_role
CREATE TRIGGER trg_auditoria AFTER INSERT OR DELETE OR UPDATE ON public.arre_incrementos
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria('id');
```

### M3 — Tabla `parque_responsables` (N responsables por parque)

```sql
CREATE TABLE public.parque_responsables (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "idParque" text NOT NULL,   -- parques.idParque (sin FK dura, patrón del proyecto; valida el backend)
  uid        text NOT NULL,   -- catUsers.uid (usuario activo con correo; valida el backend)
  uidr       text,
  fc         timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("idParque", uid)
);
ALTER TABLE public.parque_responsables ENABLE ROW LEVEL SECURITY;  -- sin políticas: solo service_role
CREATE TRIGGER trg_auditoria AFTER INSERT OR DELETE OR UPDATE ON public.parque_responsables
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria('id');
```
*(Baja = DELETE físico; queda rastro en `auditoria` vía trigger.)*

### M4 — Configuración (`SPHConfiguraciones`, patrón `ARRE_TOLERANCIA_PAGO`)

```sql
INSERT INTO public."SPHConfiguraciones" (parametro, valor, tipo, status, detalle) VALUES
('ARRE_INPC_DESFASE_MESES', '3', 1, true,
 'Meses de desfase entre el mes del INPC capturado y el mes de aniversario de los contratos a incrementar. Ej.: 3 → el INPC de junio aplica a los contratos que cumplen aniversario en septiembre.'),
('ARRE_INPC_GERENTE_UID', '', 1, true,
 'uid (catUsers) de la gerencia de Arrendatarios: recibe el correo con TODOS los incrementos aplicados y cubre los parques sin responsable. Se administra desde Arrendatarios → Responsables.');
```
*(Confirmar el catálogo de `tipo` al implementar; `ARRE_TOLERANCIA_PAGO` usa `tipo=1`.)*

### M5 — RPC aplicadora `arrepdp_aplicar_incremento_inpc` (especificación; SQL completo en la fase 1)

- **Firma:** `(p_id_arre_pdp text, p_anio smallint, p_inpc numeric, p_id_inpc text) RETURNS jsonb`.
- Una llamada = **un plan, un año, transaccional**. El backend orquesta el lote y registra la bitácora.
- **Valida:** plan existe/vigente/activo; `p_anio ≥ 2`; el año existe en la corrida; **cero partidas
  pagadas** en el rango del año (si hay → error `TIENE_PAGOS`, el backend lo manda a manual).
- **Aplica por rango de `numPartida`** (`(p_anio−1)·12+1 … p_anio·12`), NO por `anio` (gotcha):
  a filas `status=true AND "aplicaInpc"=true`: setea `INPC=p_inpc` (los `ptsINPC` ya viven en la fila),
  recalcula `pm2_nuevo = pm2_año_anterior_por_concepto × (1 + (p_inpc + ptsINPC)/100)` **por concepto**,
  y propaga `pm2_nuevo` **plano** a las partidas `> p_anio·12` del mismo concepto (sin tocar su `INPC`).
- **Devuelve** el snapshot jsonb por concepto (pm2Anterior/inpcAnterior/pm2Nuevo) para `arre_incrementos`.
- **Sin GRANT** a `anon`/`authenticated` (solo service_role — las viejas eran públicas, esta no).
- El IVA se recalcula solo (trigger `trg_v2_iva_upd` sobre `pm2`).

### M6 — (Post-deploy, lote aparte) DROP de las 6 funciones obsoletas de `OBSOLESCENCIA-BD.md` §7.

## 4. Backend (NestJS — módulo `arrendatarios`)

**`IncrementosService`** (nuevo):
- `preview(idInpc)` — resuelve desfase de config, localiza candidatos (criterio §1.4 corregido de
  `arrepdp_listar_contratos_ciclo_inpc`: aniversario en mes INPC+N, `fecFin` > fecha real del aniversario),
  clasifica: **aplicables** (con montos actual→nuevo por plan), **omitidos** (ya en `arre_incrementos`),
  **manuales** (tardíos/pagados/`anio` desalineado). No muta nada.
- `aplicar(idInpc, actorUid)` — por candidato: RPC M5 vía `comoActor` → INSERT `arre_incrementos` →
  al final dispara notificación. Reporta resultado por plan.
- `revertir(idIncremento, motivo, actorUid)` — restaura desde snapshot (RPC inversa o UPDATE
  parametrizado vía `comoActor`), marca `revertido`.
- `previewCorreccion(idInpc)` / `reaplicar(...)` — flujo §1.8 (revierte + re-aplica, `origen='reaplicacion'`).
- `bitacora(filtros)` — por plan (`idArrePdp`) o por captura (`idInpc`), calculando al vuelo el badge
  "aplicado con valor distinto al vigente".

**`ResponsablesService`** (nuevo): CRUD de `parque_responsables` + gerente (config). Valida usuario
**activo con correo** server-side; expone qué parques quedan sin responsable.

**`IncrementosMailer`**: reutiliza el transporte SMTP del sistema (`SMTP_INVITACIONES_*`, patrón
`recordatorio-aprobacion.scheduler.ts` de CxP). Agrupa por responsable (sus parques) + gerente (todo);
tabla HTML; marca `correoNotificado`/`fecNotificacion`; endpoint de **reenvío**.

**Modificaciones puntuales:**
- `cobranza.service.ts#agregarConcepto` → insertar con `aplicaInpc: false`.
- `planes-arre.service.ts#editarCampo` → cuando el campo es `INPC`/`ptsINPC` con recálculo (año ≥2),
  registrar también en `arre_incrementos` (`origen='manual'`, snapshot del retorno de la RPC vieja o
  leído antes/después). Respetar el único parcial (si ya hay 'aplicado' para ese año → 409 claro).
- Módulo `parametros` (captura INPC): al guardar, devolver el aviso "hay incrementos por aplicar"
  (y detectar corrección de un INPC ya usado → aviso de re-aplicación).

**Endpoints** (todos `JwtAuthGuard`+`PermisoGuard`; clave: **20** —la de Planes de Renta— o nueva, a
confirmar al implementar; Zod en todos; mensajes de error regla 4b):
`GET /arrendatarios/incrementos/preview?idInpc=` · `POST /arrendatarios/incrementos/aplicar` ·
`POST /arrendatarios/incrementos/:id/revertir` · `POST /arrendatarios/incrementos/reaplicar` ·
`GET /arrendatarios/incrementos` · `POST /arrendatarios/incrementos/:id/reenviar-correo` ·
`GET|POST|DELETE /arrendatarios/responsables` · `PATCH /arrendatarios/responsables/gerente`.

## 5. Frontend (React — feature `arrendatarios` + `parametros`)

- **`IncrementosPreviewModal`** (compartido aplicar/corregir): tabla de planes (regla 7 del proyecto:
  sticky/sort/filtros multi 7c), columnas Arrendatario · Parque · Nave · Renta actual · % (INPC+pts) ·
  Renta nueva · Estatus (aplicable/omitido/manual+motivo); botón "Aplicar incrementos"; informe final.
- **Parámetros → INPC (`InpcTab`)**: al guardar → abre la vista previa; **banner persistente** si hay
  pendientes de aplicar; historial de **corridas** por captura (qué se aplicó, cuándo, notificaciones);
  aviso "falta capturar el INPC del mes" (lógica de `inpc_verificar_vigencia_ultimo_registro`).
- **Planes de Renta**: indicador ✅ "incremento aplicado" en el plan/año + historial (fila de
  `arre_incrementos` con quién/cuándo/valores + botón Revertir con motivo, permiso).
- **Arrendatarios → Responsables** (nueva opción): asignar gerente + responsables por parque
  (multi por parque; selector de usuarios activos con correo; resalta parques sin responsable).
- Fechas con `fechaCorta`/`InputFecha`; acciones ocultas por `tienePermiso` (cosmético).

## 6. Fases (orden y dependencias)

| Fase | Contenido | Depende de | Riesgo |
|---|---|---|---|
| **F0** | Migraciones M1–M4 (autorización BD, una por una) | — | Bajo (aditivas) |
| **F1** | RPC M5 + `IncrementosService` (preview/aplicar/revertir/reaplicar/bitácora) + `aplicaInpc:false` en Gestión de Pagos + registro `origen='manual'` en `editarCampo` | F0 | **Alto** (motor, dinero) |
| **F2** | Flujo UI: preview modal + disparo en captura + banner pendientes + informe | F1 | Medio |
| **F3** | Responsables: `ResponsablesService` + endpoints + pantalla | F0 | Bajo |
| **F4** | Notificaciones: `IncrementosMailer` + trazado + reenvío + correo de corrección | F1+F3 | Bajo |
| **F5** | Bitácora UI (Planes de Renta + Parámetros→INPC) + reversión desde UI | F1 | Medio |
| **F6** | Cierre: **validación de seguridad adversarial (obligatoria: dinero+BD+multiarchivo)**, pruebas E2E, KB (`arrendatarios.md` — incluye corregir la nota del "cron de INPC"—, `INDICE.md`, `GLOSARIO.md`), changelog + «documenta todo». Post-deploy: M6 (DROPs autorizados) | F1–F5 | — |

## 7. Estrategia de pruebas

- **Cálculo**: pruebas del preview contra el ejemplo canónico acordado (plan 20/sep/2025, base 45,000,
  INPC 4.5+2 → año 2 = 47,925.00 exacto; año 3 plano; compuesto 47,925×(1+(x+2)/100)).
- **Integración en BD**: plan sintético con arrendatario de **pruebas** (o branch de Supabase si se
  habilita): aplicar → verificar montos/IVA/plano → revertir → verificar restauración **exacta** →
  re-aplicar. Nunca sobre planes reales.
- **Casos borde**: doble aplicación (rechazo por único parcial), INPC faltante (error, no inventa),
  tardío/pagados (exclusión a manual), extraordinarios `_EX_` intactos, plan con `anio` desalineado
  (detección), corrección con y sin pagos, SMTP caído (aplica igual, traza el fallo), parque sin
  responsable (lo cubre la gerente), usuario responsable dado de baja (validación).
- typecheck/lint/build api+web en cada fase.

## 8. Decisiones tomadas (bitácora de acuerdos)

| Fecha | Decisión | Quién |
|---|---|---|
| 2026-07-01 | Desfase configurable en `SPHConfiguraciones` (default 3) | Jereff |
| 2026-07-01 | Sin proyección de INPC futuros; años futuros planos; compuesto al llegar | Jereff |
| 2026-07-01 | Base = semántica de `arrepdpdetalle_actualizar_campo_manual`; el resto del kit → obsoleto | Jereff |
| 2026-07-01 | Opción A: columna `aplicaInpc` (extraordinarios de Gestión de Pagos exentos) | Jereff |
| 2026-07-01 | Tabla de bitácora con reversión; corrección = confirmación con "está/aplicó/quedaría" | Jereff |
| 2026-07-01 | Captura tardía / pagos de por medio → manual, decide el usuario | Jereff |
| 2026-07-02 | Notificación por correo a responsables de parque (no al registrador del plan: 37/133 sin correo activo) | Jereff |
| 2026-07-02 | **Varios** responsables por parque (tabla puente); gerente recibe **todos** | Jereff |
| 2026-07-02 | **Vista previa + confirmación** también en la aplicación normal (opción B) | Jereff |
| 2026-07-02 | Bitácora consultable en **ambas**: Planes de Renta y Parámetros → INPC | Jereff |
| 2026-07-02 | La aplicación **manual se conserva** (registra `origen='manual'` en la bitácora) | Jereff |
| 2026-07-02 | Columna **Moneda** del contrato en vista previa/correo/bitácora (montos en su divisa) | Jereff |
| 2026-07-02 | Tardío con **corte a MES COMPLETO**: aniversarios del mes en curso aplican aunque el día haya pasado; solo meses anteriores van a manual | Jereff |
