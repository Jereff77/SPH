---
documento: Deuda técnica y seguridad — registro priorizado (versión versionable)
estado: vivo
tipo: diagnóstico (la remediación es una fase aparte que aprueba el usuario)
fecha_auditoria: 2026-07-01
autor: Toribio (Claude Opus 4.8) — skill /auditoria-deuda
palabras_clave: [deuda, seguridad, RLS, anon key, PostgREST, RPC, buckets, RBAC, auditoria, rendimiento, CI, tests, v1-apagado]
---

# Deuda técnica y seguridad — SPH Bienes Raíces v2 (registro priorizado)

> **Versión saneada y versionable** de la auditoría integral (`/auditoria-deuda`, 2026-07-01). Contiene el
> QUÉ / POR QUÉ / evidencia a alto nivel / estado / arreglo propuesto, **sin pasos de explotación**. El
> **detalle operativo sensible** (consultas de verificación, mecanismos exactos de abuso) y el **plan de
> remediación con SQL** viven **fuera del repo**, en:
> `.sessions/base-conocimiento/DEUDA.md` y `.sessions/base-conocimiento/PLAN-remediacion-P0.md`.
>
> **Solo diagnóstico:** no se modificó código ni BD. Cada hallazgo se marca **✅ confirmado** (verificado
> contra la BD/código reales) o **📌 supuesto (a confirmar)**.

## Marco (leer primero)
La deuda de seguridad de BD estaba **reconocida y diferida con buen criterio** *"hasta apagar v1 (Flutter)"*
(`HANDOFF.md §9`, `OBSOLESCENCIA-BD.md §1`): aplicarla mientras v1 vivía lo habría roto. **v1 se apagó el
2026-06-21.** La condición de cierre que el propio equipo fijó ya se cumplió, pero las remediaciones no se
han ejecutado ⇒ deuda diferida **convertida en brecha activa exigible**. Verificado contra la realidad (no
solo contra el repo): el contrato decía "7 tablas sin RLS", pero **todas tienen RLS ON**; el riesgo migró a
**políticas permisivas + grants abiertos + anon key legacy activa**.

**Contraparte justa:** el **código de v2 está bien** — frontera de confianza 100% respetada (el front nunca
habla con Supabase, sin secretos en el bundle), RBAC server-side consistente, Zod, auditoría `comoActor` en
casi todo, y el text-to-SQL del agente ya pasó por hardening adversarial. **El problema es la BD compartida
heredada**, no el código nuevo.

## Perfil del proyecto (PASO 0)
Monorepo pnpm+Turborepo · Backend **NestJS** (única vía a Supabase, `service_role`) · Frontend **React+Vite+
TanStack Query** · Supabase (Postgres) · deploy EasyPanel. **Single-tenant** (ERP interno de una empresa; el
aislamiento relevante es por usuario/rol, no multi-tenant). El backend usa `service_role` que **salta RLS**;
el control real vive en los guards. La RLS de la BD es herencia de v1.

---

## Resumen priorizado

| ID | Prio | Hallazgo | Estado |
|----|------|----------|--------|
| P0-1 | 🔴 | Una RPC `SECURITY DEFINER` ejecutable por `anon` permite leer tablas con PII saltando RLS (denylist incompleta) | ✅ |
| P0-2 | 🔴 | Políticas RLS `USING(true)` + grants totales para `authenticated` ⇒ el modelo "solo backend" es eludible | ✅ |
| P0-3 | 🔴 | Auto-escalado de permisos vía escritura directa en `segModulosUsuarios` | ✅ |
| P0-4 | 🔴 | RPCs inseguras de v1 (SQL dinámico) vivas y ejecutables por `anon` | ✅ |
| P0-5 | 🔴 | Buckets de Storage públicos y listables con documentos sensibles | ✅ |
| P0-6 | 🔴 | anon key legacy aún activa (habilitador de los vectores anónimos) | ✅ |
| P1-1 | 🟠 | Red de seguridad casi nula: 1 test, 0 CI en un ERP que mueve dinero | ✅ |
| P1-2 | 🟠 | Acceso anónimo a `actividad` (correos/uids) y `crm_responsableComercial` | ✅ |
| P1-3 | 🟠 | CORS `*` en las edge functions; `comprobante-extraer` sin auth de usuario | ✅ |
| P1-4 | 🟠 | 51/53 funciones `SECURITY DEFINER` ejecutables por `anon`; 3 vistas SECURITY DEFINER; 163 con `search_path` mutable | ✅ |
| P1-5 | 🟠 | ~~`DiagnosticoService` usa `service_role`~~ → **✅ RESUELTO (2026-07-03): el servicio se ELIMINÓ** (rediseño razonador; los enlatados se retiraron) | ✅ resuelto |
| P1-6 | 🟠 | `editarCuenta` sin `@RequierePermiso(213)` (escalación horizontal en Parámetros) | ✅ |
| P1-7 | 🟠 | Módulo Permisos/Usuarios escribe sin `comoActor()` (gap de auditoría en el módulo más sensible) | ✅ |
| P1-8 | 🟠 | Rotar `service_role`/`JWT secret` (expuestos en logs) | 📌 |
| P2-1 | 🟡 | Rendimiento backend: agregaciones en cliente + `await` secuenciales en CxP | ✅ |
| P2-2 | 🟡 | Rendimiento front: code-splitting incompleto + `PermisoGuard` sin caché | ✅ |
| P2-3 | 🟡 | Rendimiento BD: 107 FK sin índice, 36 índices sin uso, 2 tablas sin PK, 1 duplicado | ✅ |
| P2-4 | 🟡 | Reproducibilidad: sin snapshot base del esquema; `.env.example` raíz desfasado; 2 migraciones pendientes | ✅ |
| P2-5 | 🟡 | `app.listen(port)` sin `'0.0.0.0'` | ✅ |
| P2-6 | 🟡 | Hotfix activo: trigger `cxp_validar_fecha_cfdi` desactivado (ya conocido) | ✅ |
| P2-7 | 🟡 | `error.message` crudo (convención 4b) — mitigado por el filtro global de 5xx | ✅ |
| P2-8 | 🟡 | `auth_leaked_password_protection` OFF; RBAC por-módulo no por-fila; limpieza de obsoletos | ✅/📌 |
| P2-9 | 🟡 | KVA's: el recálculo de saldo es `FOR EACH ROW` (carga masiva = O(n²)) | 📌 |
| P2-10 | 🟢 | KVA's: `porParque` ordena por `fc DESC` sin índice que lo cubra | 📌 |

### P2-9 — Recálculo de KVA por fila (revisión de escalabilidad, 2026-08-03) 📌
`trg_kvasasignados_recalcular` es **FOR EACH ROW**: cada insert recalcula el parque completo. En uso
normal (una asignación a la vez) es correcto y barato, pero en la **carga inicial desde el Excel**
(Fase 5 del `PLAN-administracion-kvas.md`, ~250 filas por parque) se vuelve cuadrático.
**Fix cuando toque esa fase:** insertar el lote con el trigger deshabilitado (o `ALTER TABLE ...
DISABLE TRIGGER`) y llamar UNA vez a `kva_recalcular_disponibles(idParque)` al final. Severidad
MEDIA, diferida: no bloquea la operación diaria.

### P2-10 — Índice de `kvasAsignados` no cubre el orden del listado 📌
`KvasService.porParque` filtra por `idParque` y ordena por `fc DESC`; el índice existente es
`(idParque, nivel)`. Con el volumen esperado (cientos de filas por parque) el sort en memoria es
irrelevante. **Fix si crece:** `CREATE INDEX ix_kvasasignados_parque_fc ON "kvasAsignados"
("idParque", fc DESC)`. Severidad BAJA.

---

# P0 — Brechas activas (la premisa que las difería ya no aplica; cerrar YA)

> Plan de cierre con SQL exacto, por fases, con verificación y rollback:
> `.sessions/base-conocimiento/PLAN-remediacion-P0.md`. Toda mutación requiere autorización explícita
> (regla 1) y verificar que no rompe consumidores vigentes (Montse AI, edges, reportes).

### P0-1 — RPC `SECURITY DEFINER` ejecutable por `anon` que expone PII saltando RLS  ✅
- **Qué.** `ia_consulta_sql` es `SECURITY DEFINER` (corre como `postgres`, salta RLS), está concedida a
  `anon`/`authenticated`, y su lista de tablas bloqueadas (denylist) **no cubre las tablas con PII** de
  clientes. El equipo **ya construyó la versión segura** (`agente_consulta_sql` + rol `v2_agente_ro` con
  allowlist); el problema es que la vieja insegura sigue con `EXECUTE` para `anon`.
- **Por qué importa.** Permite a un actor no autenticado leer datos personales de clientes evitando el
  control de acceso. Es el vector anónimo más grave.
- **Evidencia.** Metadata en vivo (`prosecdef`, `has_function_privilege('anon',…)`, cuerpo). Verificado y
  confirmado por una segunda revisión adversarial independiente.
- **Arreglo (NO ejecutado).** `REVOKE EXECUTE … FROM anon, authenticated` (la edge `ia-chat`/Montse la llama
  con `service_role` ⇒ **no se rompe**, verificado). A futuro: migrar Montse a `agente_consulta_sql` y
  retirar la vieja. Ver FASE 1.1 / FASE 5 del plan.

### P0-2 — El modelo "solo el backend habla con la BD" es eludible por `authenticated`  ✅
- **Qué.** El rol `authenticated` tiene grants de lectura/escritura sobre ~170 tablas y ~80 políticas RLS son
  permisivas (`USING(true)`) para ese rol, incluyendo tablas de dinero y PII. Los empleados tienen
  credenciales en Supabase Auth.
- **Por qué importa.** Un empleado (o cuenta comprometida), usando su propio login, podría conectarse directo
  a la BD (PostgREST/GraphQL) y leer/mutar datos de negocio **saltándose el backend y el RBAC server-side**.
  Anula el control de acceso de v2.
- **Matiz honesto (verificación adversarial).** La escritura directa **sí queda auditada** (los triggers de
  auditoría se disparan igual, atribuidos al propio usuario, no falsificables hacia otro) — el riesgo es el
  bypass de RBAC y la mutación masiva, **no** la invisibilidad. La lectura anónima directa a la PII está
  bloqueada por RLS (el vector anónimo puro es P0-1, la RPC).
- **Evidencia.** `role_table_grants` (authenticated en 170 tablas), agregado de `pg_policies` (políticas
  `ALL USING(true)`), advisor (`rls_policy_always_true`=107; tablas expuestas vía GraphQL a authenticated=172).
- **📌 A confirmar.** Si el **signup** de Supabase Auth está abierto, el vector se extiende a externos (hay 9
  usuarios con email no corporativo en `auth.users`). El P0 se sostiene aunque el signup esté cerrado.
- **Arreglo (NO ejecutado).** Revocar los grants amplios de `anon`/`authenticated` sobre las tablas que solo
  el backend debe tocar (más simple que reescribir 80 políticas). El backend usa `service_role` (no
  afectado). Ver FASE 2 del plan.

### P0-3 — Auto-escalado de permisos vía `segModulosUsuarios`  ✅
- **Qué.** Las políticas de escritura de `segModulosUsuarios` para `authenticated` no acotan la fila al propio
  usuario ⇒ un usuario conectado directo podría concederse claves de permiso. Combinado con las rutas de
  escritura de `catUsers`, el escalado alcanza `isSupport`.
- **Por qué importa.** Escalada de privilegios: rompe todo el control de acceso de la app.
- **Evidencia.** `pg_policies` (políticas INSERT/UPDATE always-true para authenticated, sin `uid=auth.uid()`);
  advisor `rls_policy_always_true`. Mecanismo confirmado por verificación adversarial.
- **Arreglo (NO ejecutado).** Restringir la escritura de `segModulosUsuarios` (y las rutas sensibles de
  `catUsers`) a `service_role`; la gestión de permisos ya la hace el backend. Ver FASE 2 del plan.

### P0-4 — RPCs inseguras de v1 vivas y ejecutables por `anon`  ✅
- **Qué.** Siguen presentes y con `EXECUTE` para `anon`/`authenticated` varias RPCs de v1 que construyen/
  ejecutan SQL dinámico (una con una clave de servidor embebida en el cuerpo; otras susceptibles de inyección
  por construcción de SQL con fragmentos). v2 **no las usa** (`OBSOLESCENCIA-BD.md §1`, "retiro prioritario").
- **Por qué importa.** Amplían la superficie de ataque a la BD y no tienen razón de existir tras apagar v1.
- **Evidencia.** `has_function_privilege('anon',…)=true`; cuerpos verificados; 0 consumidores en BD (una con 1
  referencia a revisar).
- **Arreglo (NO ejecutado).** `REVOKE` de `anon`/`authenticated` (FASE 1.1) y luego `DROP` (FASE 5) tras
  confirmar 0 consumidores.

### P0-5 — Buckets de Storage públicos y listables con documentos sensibles  ✅
- **Qué.** Tres buckets son públicos: dos de ellos **listables** por cualquiera (documentos operativos), y uno
  además con **escritura pública** (se puede subir/borrar). Un tercero es descargable por URL. Los buckets de
  CxP ya se hicieron privados (v2.28.0); estos tres no.
- **Por qué importa.** Exposición/alteración de documentos (posible PII/fiscal) sin autenticación.
- **Evidencia.** `storage.buckets` (`public=true` + conteo de objetos); advisor `public_bucket_allows_listing`;
  políticas de `storage.objects`. Confirmado por verificación adversarial.
- **📌 A confirmar.** Si algún flujo vigente depende de URL pública (Ventas ya migró a firmada; quedan
  históricos por migrar).
- **Arreglo (NO ejecutado).** Privatizar + servir por URL firmada (patrón ya usado en CxP). Ver FASE 3 del plan.

### P0-6 — anon key legacy aún activa  ✅
- **Qué.** La anon key legacy (la que iba en el bundle público de Flutter) sigue habilitada; es la credencial
  común que habilita los vectores anónimos.
- **Arreglo (NO ejecutado).** Rotar/deshabilitar tras migrar backend y edges a la publishable key moderna
  (esas edges y el backend hoy la usan). Ver FASE 4 del plan.

---

# P1 — Riesgo serio / sin red de seguridad
- **P1-1 · 1 test, 0 CI.** Único gate: que TypeScript compile al hacer push (que redespliega). Sin tests de la
  lógica de dinero ni pipeline. **Arreglo:** CI con `typecheck+lint+build` + tests de cálculos/RBAC.
- **P1-2 · Acceso anónimo a `actividad` (correos/uids) y `crm_responsableComercial` (lectura/escritura/borrado).**
  **Arreglo:** cerrar las políticas `anon` (FASE 1.2), revisando antes el webhook público de contacto.
- **P1-3 · CORS `*` en las edges** (`ia-chat`, `soporte-chat`, `comprobante-extraer`) + `comprobante-extraer`
  sin auth de usuario (abuso de cuota de LLM). **Arreglo:** restringir CORS al origen real; autenticar la edge.
- **P1-4 · Superficie `SECURITY DEFINER`/RPC:** 51/53 funciones definer ejecutables por `anon`; 3 vistas
  definer (advisor ERROR); 163 funciones con `search_path` mutable. **Arreglo:** inventariar y `REVOKE` de
  `anon`; `SET search_path`; recrear las vistas sin definer. Ver FASE 5.
- **P1-5 · `DiagnosticoService` usa `service_role`** → **✅ RESUELTO (2026-07-03, rediseño razonador).** El
  `DiagnosticoService` (herramientas enlatadas de diagnóstico) se **eliminó por completo**; el agente ahora
  consulta la BD vía text-to-SQL `consultar_datos`, que usa el rol de solo lectura acotado `v2_agente_ro`
  (allowlist de tablas). Ya no existe uso de `service_role` para diagnóstico del agente.
- **P1-6 · `editarCuenta` sin `@RequierePermiso(213)`** (`parametros.controller.ts`) → escalación horizontal
  dentro del módulo. **Arreglo:** añadir el decorador.
- **P1-7 · Permisos/Usuarios escriben sin `comoActor()`** (`permisos.service.ts`, `usuarios.service.ts`) → gap
  de trazabilidad (regla §6) en el módulo más sensible; no es bypass de RBAC. **Arreglo:** propagar
  `@CurrentUser()` + `comoActor()`.
- **P1-8 · Rotar `service_role`/`JWT secret`** (expuestos en logs). 📌 Ver FASE 4.

---

# P2 — Estratégico / proceso / rendimiento
- **P2-1 · Rendimiento backend:** agregaciones hechas en Node sobre historiales completos (Dashboard/años,
  saldos FIFO en memoria, conteo de correo sobre miles de filas) y `await` secuenciales paralelizables en los
  endpoints de más tráfico de CxP. **Matiz:** el equipo ya aplica bien `Promise.all`/`.in()` en la mayoría;
  son inconsistencias puntuales de alto retorno. **Arreglo:** mover agregaciones a SQL; `Promise.all`; paginar
  `clientes.listar()`. Medir contra build de producción.
- **P2-2 · Rendimiento front:** code-splitting incompleto (la mayoría de rutas no son `lazy` → bundle inicial
  grande) y `PermisoGuard` hace 1-2 queries por request sin caché. **Arreglo:** completar `lazy()`; cachear
  permisos por `uid` con TTL corto.
- **P2-3 · Rendimiento BD:** 107 FK sin índice, 36 índices sin uso, 2 tablas sin PK (`conciliacion`,
  `agenda`), 1 índice duplicado. **Matiz:** el grueso de hallazgos RLS del advisor casi no afecta a v2 (usa
  service_role que salta RLS); lo que pega son las FK sin índice. **Arreglo:** indexar FK núcleo; DROP índices
  sin uso/duplicados; PK en las dos tablas.
- **P2-4 · Reproducibilidad/bus factor:** sin snapshot base versionado del esquema (23 SQL manuales + ~190
  funciones heredadas); `.env.example` raíz desfasado; 2 migraciones pendientes de aplicar. **Arreglo:**
  versionar `pg_dump --schema-only`; corregir `.env.example`; aplicar migraciones pendientes.
- **P2-5 · `app.listen(port)` sin `'0.0.0.0'`** (`main.ts`) — riesgo latente de 502. **Arreglo:** añadir el host.

---

# Deuda diferida por sesión (post-auditoría)

## 2026-08-05 · Eliminar Plan de Pagos (validador adversarial, MEDIA/BAJA diferidas conscientemente)

> Contexto: feature «candado de última partida + Eliminar plan» (Ventas·Planes). El validador dio
> **APTO CON OBSERVACIONES, sin hallazgos ALTA**. Se corrigieron en la misma sesión: REVOKE de la RPC
> `eliminar_plan_pagos` (quedó como `trasladar_saldo_pdp`: solo `service_role`) y la carrera de
> `setActivoPlan` (UPDATE condicionado a `idPdp NOT NULL` + verificación de filas afectadas). Lo diferido:

- **[MEDIA] Comentarios huérfanos al borrar partidas/planes.** `comentarios.idPdpDet` no tiene FK; al
  eliminar un plan el CASCADE borra las partidas y sus comentarios quedan colgando (ya había **1244
  huérfanos** por `eliminarPartida`, deuda preexistente). **Por qué se difiere:** la trazabilidad dura
  vive en `auditoria` (el trigger guarda la fila COMPLETA de cada partida borrada); los comentarios
  huérfanos son inertes (nadie los consulta sin su `idPdpDet`). **Arreglo propuesto:** en la RPC,
  marcar `status=false` los comentarios del plan antes del DELETE, o crear FK con ON DELETE.
- **[BAJA] Carrera del candado de última partida** (`eliminarPartida`): dos DELETE concurrentes con 2
  partidas vivas pueden dejar 0. Mitigado: «Eliminar plan» ya da salida al estado; requiere 2 operadores
  simultáneos en el mismo plan. **Arreglo:** RPC con `FOR UPDATE` sobre el `pdp` antes de contar.
- **[BAJA] `partidaEditable` valida el plan vía `det.idPropiedad`** en vez de `det.idPdp`; hay **17
  partidas** en prod cuya propiedad apunta a otro plan (datos heredados) — la guarda "plan inactivo" se
  evalúa sobre el plan equivocado. Preexistente; la RPC nueva NO lo padece (valida por `propiedades.idPdp`).
  **Arreglo:** resolver la propiedad por `propiedades.idPdp = det.idPdp`.
- **[BAJA] `fidePdpDispersion.idPdp` sin FK y no validada por la RPC** (tabla legado, sin escrituras desde
  2025-07-17; 0 planes elegibles a borrado tienen dispersión — la guarda de pagos los cubre todos hoy).
  **Arreglo:** añadir chequeo a la RPC o crear la FK.
- **[DATO] 18 propiedades en prod con `pdpActivo=true` e `idPdp=null`** (estado atascado heredado: no se
  pueden desactivar ni desvincular desde la UI). Saneo de datos pendiente de decisión de Jereff.
- **P2-6 · Hotfix activo:** trigger `cxp_validar_fecha_cfdi` desactivado (ya conocido; bloqueado hasta definir
  la regla PPD). **Arreglo:** plan `PLAN-correccion-trigger-cxp-fecha-cfdi.md`.
- **P2-7 · `error.message` crudo** en muchos servicios (convención 4b) — mitigado por el filtro global de 5xx.
  **Arreglo:** migrar a `fallaBd()` progresivamente.
- **P2-8 · Higiene:** activar `auth_leaked_password_protection`; confirmar con negocio si el RBAC por-módulo
  (no por-fila) es la política deseada; limpieza de obsoletos ya catalogada en `OBSOLESCENCIA-BD.md`.
- **P2-9 · Parser textual del text-to-SQL del agente** (`tablasFueraDeUniverso`, `consultas.service.ts`):
  valida las tablas del `SELECT` por análisis de **TEXTO** (no AST) → aislamiento inter-módulo *best-effort*.
  Se mitigó un bypass (`FROM"tabla"` sin espacio) con normalización (2026-07-03, rediseño razonador); la
  **barrera dura** que protege lo sensible es la **allowlist del rol `v2_agente_ro`**, no el parser.
  **Arreglo futuro:** validar con un parser SQL real (AST) si se requiere aislamiento estricto por módulo.

---

## Secuencia recomendada de remediación (la aprueba el usuario)
1. **Contención inmediata (riesgo casi nulo):** revocar `anon`/`authenticated` de las RPCs de SQL (P0-1/P0-4)
   y cerrar el acceso anónimo de `actividad`/`crm_responsableComercial` (P1-2).
2. **Cerrar el bypass del modelo (P0-2/P0-3):** revocar grants amplios de `authenticated`/`anon`; endurecer
   `segModulosUsuarios`.
3. **Storage (P0-5):** privatizar + URL firmada.
4. **Llaves (P0-6/P1-8):** rotar y deshabilitar la anon legacy (migrar keys primero).
5. **Red de seguridad (P1-1):** CI + tests de la lógica de dinero.
6. **P1/P2 restantes** por impacto.

> Detalle operativo, verificaciones y SQL exacto: `.sessions/base-conocimiento/PLAN-remediacion-P0.md`.
> Diagnóstico completo (con evidencia sin sanear): `.sessions/base-conocimiento/DEUDA.md`.
