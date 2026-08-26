# PLAN — Avisos de Complemento de Pago (REP) consolidados + panel en el landing

> **Estado:** ✅ **EJECUTADO en v2.69.0** (2026-08-26). Aprobado por Jereff y construido el mismo día.
> Autor: Toribio/Opus 5 · Módulo: CxP (PPD/REP) + Landing
> Reemplaza el comportamiento anterior de `ComplementosScheduler`.
> **Documentación viva del resultado:** `modulos/cxp.md` (sección del Complemento de Pago). Este
> documento se conserva como registro del diseño y de por qué se decidió cada cosa.

## ⚠️ Cambios de la regla DURANTE el diseño (lo que se construyó ≠ la v1 de este plan)

Este plan se escribió con el aviso en **un solo disparo el día 5**. Jereff ajustó la regla después de
leerlo, y **lo construido es la versión de abajo** — que es la que vale:

| | Plan v1 (§2 original) | **Construido (v2.69.0)** |
|---|---|---|
| Proveedor | días 1-5 | días 1-5 ✔️ igual |
| Solicitante | días 1-5 | días 1-5 **+ día 20** (víspera de su bloqueo) |
| Gerente | día 5 | día 5 ✔️ igual |

El resto del diseño (consolidación, índice único como candado, bitácora de envíos, remitente fijo,
validación de correo del proveedor, panel del landing) se construyó tal como está descrito aquí.

### Decisiones que quedaron abiertas y su desenlace
1. **Migración de `mail_avisos_rep`** → ✅ autorizada por Jereff y aplicada en producción el 2026-08-26.
2. **La regla que se cortó** en el cuarto guion de su mensaje → nunca se completó; se preguntó tres
   veces. Si aparece, revisar si obliga a tocar el calendario.
3. **DKIM de `portal.gruposph.mx`** → ⏳ sigue pendiente (acción de infraestructura, ver §5 riesgo 1).
4. **Parcialidades ya vencidas** → se resolvió como se recomendaba: **no** entran al correo (que solo
   mira el mes anterior), pero **sí** se muestran en el panel del landing.

---

## 1. Por qué (el problema real, medido)

Paul-Henri Gauvin se quejó de que lo estamos atosigando. **Tiene razón, y está medido contra
producción:**

| Día (ago-2026) | Correos a Paul |
|---|---|
| 16/08 | 19 |
| 17/08 | 19 |
| 18/08 | 19 |
| 19/08 | 12 |
| 20/08 | 12 |

**81 correos en 5 días**, todos con el mismo asunto. Y los 19 del primer día no eran de 19
proveedores: eran de **6**, tres de los cuales concentraban 16 (NP67 Querétaro 6, Obras Civiles 6,
Eje de Abastos 4). Un correo por *parcialidad*, no por *asunto*.

Causa: [`complementos.scheduler.ts`](../apps/api/src/modules/cxp/complementos.scheduler.ts) itera
`for (const p of lista)` y envía **un correo por cada parcialidad**, con el solicitante y el gerente
juntos en el mismo `to:`.

### Problemas adicionales detectados en el diagnóstico (todos verificados)

1. **Rechazo parcial invisible.** `smtp.enviarNotificacion` hace **un solo** `sendMail` con ambos
   destinatarios y descarta `rejected[]` → devuelve `true` aunque el servidor haya rechazado al
   gerente. El sistema lo cuenta como enviado.
2. **Cero bitácora de destinatarios.** `v2_cron_ejecuciones` solo guarda `{enviados, pendientes}`.
   Es imposible responder "¿le llegó a Paul?".
3. **Remitente indeterminado.** `cuentasActivas[0]` sin `ORDER BY`, y hay **2 cuentas activas**
   (`agente@` y `soporteaclientes@portal.gruposph.mx`): el `from` puede cambiar solo entre días.
4. **Sin DKIM.** `portal.gruposph.mx` tiene SPF (`~all`) y DMARC `p=none`, pero **no hay registro
   DKIM** en los selectores de Hostinger. Alto riesgo de spam, crítico al escribir a externos.
5. **Doble ejecución del cron.** Hasta el 15-ago hubo 2 corridas diarias (07:00 y 13:00 MX) → dos
   instancias con TZ distinta. Si reaparece dentro de la ventana, duplica todos los correos.
6. **Agujero de los vencidos.** El filtro solo mira pagos del **mes anterior**: las 14 parcialidades
   de julio que hoy siguen sin REP **no volverán a generar aviso nunca**, solo bloqueo.

---

## 2. Reglas de negocio (dictadas por Jereff, 2026-08-26)

1. Un usuario recibe **máximo un correo al día** por este tema.
2. El correo lleva **la lista de todos** los proveedores con REP por vencer.
3. El eje de las fechas es el **plazo del proveedor** (`diaBloqueoProveedor`, hoy día 6): el SAT le
   da hasta el día 5 del mes siguiente para emitir el REP.
4. **Proveedor:** un correo diario los **últimos 5 días** del plazo. Si tiene varios REP faltantes,
   **un solo correo** con todos.
5. **Usuario solicitante:** un correo diario los **últimos 5 días**. Si tiene varios proveedores
   pendientes, **un solo correo** que los consolide. **Además**, un aviso **un día antes de que se
   le bloquee el sistema** (día 20, víspera de `diaBloqueoUsuario`).
6. **Gerente autorizador:** **un solo correo**, el día antes de que venza el plazo del proveedor
   (día 5). Consolidado: todos sus proveedores y solicitantes en un único mensaje.
7. La misma lista se muestra **en el landing, por usuario**, para que la vea al entrar.

### Calendario resultante

| Destinatario | Días de envío | Máx. correos/mes | Alcance del contenido |
|---|---|---|---|
| **Proveedor** | 1, 2, 3, 4, 5 | 5 | Sus propios folios sin REP |
| **Solicitante** | 1, 2, 3, 4, 5 **+ 20** | 6 | Todos los proveedores que él pagó |
| **Gerente** | 5 | 1 | Todo lo que él autorizó, por proveedor y solicitante |

Los días salen **calculados** de `RepConfig`, nunca hardcodeados:
`diaBloqueoProveedor − 5 … diaBloqueoProveedor − 1` (1→5 con el valor por defecto 6) y
`diaBloqueoUsuario − 1` (20). Si Jereff cambia los parámetros en `SPHConfiguraciones`, el calendario
se mueve solo.

> **Efecto en el caso de Paul:** de **81 correos** a **1**.

---

## 3. Diseño técnico

### 3.1 Servicio de consulta compartido (nuevo) — `rep-pendientes.service.ts`

Una sola fuente de verdad para el cron **y** el panel del landing (evita que se desincronicen):

```ts
listarPendientes(filtro: { uid?: string; idProveedor?: string; soloMesAnterior?: boolean })
  => RepPendiente[]   // { idCxp, idProveedor, nombreProveedor, folio, monto, fecPago,
                      //   uidr, autorizo, nivel: RepNivel, diasParaBloqueoProveedor,
                      //   diasParaBloqueoUsuario }
```

- Reutiliza `nivelRepPendiente` / `boundVencidoISO` de
  [`rep-fechas.ts`](../apps/api/src/modules/cxp/rep-fechas.ts) — **no** se duplica la matemática.
- Mismo predicado que `BloqueoService` (`status`, `diferido`, `idEstado in (6,7)`,
  `uuidComplemento is null`, `complementoExento = false`, `fecPago not null`) para que **lo que se
  avisa y lo que bloquea sean exactamente lo mismo**. Divergir aquí es el peor bug posible: avisar
  de algo que no bloquea, o bloquear sin haber avisado.
- Consulta paginada con `.range()` (regla de escalabilidad del proyecto).

### 3.2 Scheduler reescrito — `complementos.scheduler.ts`

Se **clona el patrón ya probado** de
[`recordatorio-aprobacion.scheduler.ts`](../apps/api/src/modules/cxp/recordatorio-aprobacion.scheduler.ts):
agrupar por destinatario → plantilla HTML → enviar → registrar en bitácora.

```
1. cfg = leerRepConfig()             // días configurables
2. decidir qué toca hoy:
     diaHoy ∈ [diaBloqueoProveedor-5, diaBloqueoProveedor-1] → proveedores + solicitantes
     diaHoy == diaBloqueoProveedor-1                          → + gerentes
     diaHoy == diaBloqueoUsuario-1                            → + solicitantes (aviso de bloqueo)
     en cualquier otro día → salir sin enviar nada
3. pendientes = listarPendientes({ soloMesAnterior: true })
4. agrupar en 3 mapas: por idProveedor, por uidr, por autorizo
5. por cada destinatario: 1 correo con SU tabla completa
6. registrar cada envío (incluidos los fallidos) en mail_avisos_rep
```

**Cambios de envío obligatorios:**

- **Un `sendMail` por destinatario.** Nunca dos personas en el mismo `to:` (hoy el solicitante y el
  gerente se ven entre sí, y un rechazo parcial se contabiliza como éxito).
- **Leer el resultado**: `accepted` / `rejected` de nodemailer, y registrar el real. Requiere que
  `SmtpService.enviarNotificacion` devuelva el detalle en vez de un `boolean` — o un método nuevo
  para no alterar a los consumidores actuales (CxP/PPD ya lo usan).
- **Remitente fijo**: parámetro nuevo en `SPHConfiguraciones` (`PPD_REP_CUENTA_REMITENTE`) con el
  correo de la cuenta a usar; si no está, se toma la primera **ordenada por `id`** (determinista).
  Sin esto, escribirle a un proveedor desde `agente@portal…` un día y `soporteaclientes@…` al
  siguiente es garantía de spam.

### 3.3 BD — tabla nueva `mail_avisos_rep` (🔶 requiere autorización de Jereff)

```sql
create table public.mail_avisos_rep (
  id              bigserial primary key,
  fc              timestamptz not null default now(),
  fecha_mx        date        not null,              -- día de México, para el candado 1/día
  tipo            text        not null check (tipo in ('proveedor','solicitante','gerente','solicitante_bloqueo')),
  destinatario    text        not null,              -- correo
  uid             uuid        null,                  -- catUsers, si es interno
  id_proveedor    text        null,                  -- catProveedores, si es externo
  num_pendientes  int         not null,
  asunto          text        not null,
  html            text        not null,
  detalle         jsonb       not null,              -- folios/montos incluidos
  estado          text        not null check (estado in ('enviado','fallido','omitido_sin_correo')),
  error           text        null
);
-- ⛔ El candado duro de la regla "máximo 1 al día":
create unique index ux_mail_avisos_rep_dia
  on public.mail_avisos_rep (fecha_mx, tipo, destinatario);
create index ix_mail_avisos_rep_fc on public.mail_avisos_rep (fc desc);
```

- El **índice único** es lo que hace cumplir la regla 1 aunque el cron corra dos veces (problema 5
  del diagnóstico): el segundo INSERT choca y el envío se omite. Es más fiable que confiar en el
  flag `corriendo` en memoria, que no cruza instancias.
- Nace con su `trg_auditoria` (regla 6 del proyecto).
- RLS: `ENABLE ROW LEVEL SECURITY` sin políticas para `authenticated` (solo `service_role` la toca).
- Estado `omitido_sin_correo` para dejar rastro de a quién **no** se le pudo avisar.

### 3.4 Endpoint del landing (nuevo)

`GET /cxp/mis-rep-pendientes` — `@UseGuards(JwtAuthGuard)`, **sin `@RequierePermiso`**.

- **El filtro sale del `uid` del JWT**, nunca de un parámetro: devuelve solo las parcialidades donde
  el usuario es `uidr` **o** `autorizo`. No amplía superficie de datos — es información propia, y
  quien la ve ya la veía en CxP.
- No se declara en `ppd.controller.ts` (esa clase exige la clave 420 y el landing lo ve todo usuario
  autenticado). Va en un controlador propio del módulo CxP.
- Respuesta: lista + resumen (`{ porVencer, venceManana, vencidas, diasParaMiBloqueo }`).

### 3.5 Panel en el landing — `Home.tsx`

Hoy [`Home.tsx`](../apps/web/src/routes/Home.tsx) son 2 tarjetas y el logo centrado: hay espacio de
sobra bajo las tarjetas.

- Componente `RepPendientesPanel`, **solo se renderiza si hay pendientes** (si no, el landing queda
  idéntico a hoy).
- Tabla con las convenciones del proyecto (regla 7): encabezado sticky `#1f2a4d`, `useSort` +
  `SortableTh` + `THEAD_STICKY`, fechas con `fechaCorta()`.
- Columnas: Proveedor · Folio · Monto · Fecha de pago · Días para el bloqueo · Estado.
- Semáforo: 🟡 por vencer · 🟠 vence mañana · 🔴 vencido.
- **Incluye las vencidas** → tapa el agujero 6 del diagnóstico (las 14 de julio que ya no generan
  ningún correo).
- Botón "Subir complemento" que navega a CxP → PPD.
- Si el usuario es gerente, un pie con "N de estos son de solicitudes que tú autorizaste".

### 3.6 El correo al proveedor (externo — el punto más delicado)

- **Solo con correo válido.** Validación estricta antes de intentar: formato `@` + TLD **y**
  descartar basura (`"null"`, `"n/a"`, `"-"`, espacios). ⚠️ Verificado en producción: **Obras
  Civiles e Hidráulicas tiene el texto literal `"null"` en `catProveedores.email`** — pasa cualquier
  chequeo de "no vacío" y es justo el proveedor con **$1.8 M** pendientes.
- **Nunca falla en silencio.** El proveedor sin correo se registra como `omitido_sin_correo` y
  aparece en el correo del gerente y en el panel del landing como *"sin correo registrado — no se le
  pudo avisar"*, para que CxP lo capture.
- **Contenido acotado a lo suyo:** razón social, sus folios, montos, fechas de pago y la fecha límite.
  ⛔ **Sin datos internos**: nada de nombres de solicitante/gerente, ni de otros proveedores.
- `Reply-To` a la cuenta de CxP para que el proveedor pueda responder con el REP.
- Texto en tono de proveedor (no de empleado): explica que se requiere el CFDI de complemento de
  pago y a dónde enviarlo.

**Tamaño del problema, medido hoy:**

| Universo | Cantidad |
|---|---|
| Proveedores activos | 351 |
| **Sin correo usable** | **265 (75 %)** |
| Con correo válido | 86 |
| De los 6 que hoy deben REP, sin correo | 3 |

> 📌 El aviso al proveedor funcionará hoy para **1 de cada 4**. Se construye igual, pero el
> resultado real depende de capturar correos — por eso el reporte de omitidos es parte del entregable
> y no un extra.

---

## 4. Checklist del gate de diseño (reglas del proyecto)

| Regla | Cómo se cumple |
|---|---|
| 🛡️ Frontera de confianza | El panel consume `apps/api`; `apps/web` no toca Supabase. |
| 🔑 Auth / identidad | El `uid` del filtro sale del **JWT verificado**, jamás del body/query. |
| 🔒 RBAC | Endpoint con `JwtAuthGuard`; los datos son propios del usuario. El cron corre server-side. |
| 🔒 RLS | Tabla nueva con RLS activa y sin políticas para `authenticated`. |
| ✅ Validación | Zod en el endpoint (no recibe parámetros de identidad). |
| 🧾 Trazabilidad | `trg_auditoria` en la tabla nueva + bitácora propia de cada envío. |
| 🛑 Errores seguros | `fallaBd(...)` en las rutas nuevas; nunca `error.message` crudo al cliente. |
| ♻️ Reutilización | Se clona `recordatorio-aprobacion.scheduler.ts` y se reusa `rep-fechas.ts`; el predicado se comparte con `BloqueoService`. |
| 🎨 Tabla | Sticky `#1f2a4d`, `useSort`/`SortableTh`, `fechaCorta()`, filtros multi-selección. |
| 📋 Versionado | `v2_changelog` + `APP_VERSION_RAW` en el cierre. |

---

## 5. Riesgos y mitigaciones

| # | Riesgo | Mitigación |
|---|---|---|
| 1 | El correo a externos cae en spam (sin DKIM) | Remitente fijo + **publicar DKIM** de `portal.gruposph.mx` (acción de infraestructura, fuera del código) |
| 2 | Doble envío por 2 instancias del cron | Índice único `(fecha_mx, tipo, destinatario)` |
| 3 | Avisar de algo que no bloquea (o al revés) | Predicado único compartido con `BloqueoService` |
| 4 | 75 % de proveedores sin correo | Estado `omitido_sin_correo` + reporte visible al gerente y en el landing |
| 5 | El panel del landing pesa en cada entrada | Consulta acotada al uid + `staleTime` de TanStack Query; el panel no se renderiza si no hay pendientes |

---

## 6. Decisiones pendientes de Jereff

1. **🔶 Autorización de la migración** de `mail_avisos_rep` (tabla nueva, aditiva, sin tocar nada
   existente).
2. **La regla que quedó cortada** en su mensaje del 2026-08-26 (cuarto guion, sin texto).
3. **DKIM de `portal.gruposph.mx`** — sin él, el aviso a proveedores externos tiene alta
   probabilidad de no llegar. Requiere tocar DNS en Hostinger.
4. **¿Se avisa de las parcialidades ya vencidas** (las 14 de julio) en el primer envío, o solo se
   muestran en el landing? Recomendación: solo landing, para no estrenar la función con un correo
   masivo de casos viejos.

---

## 7. Verificación antes de cerrar

- `pnpm -C apps/api typecheck && lint && build` + lo mismo en `apps/web`.
- **Arranque real** del API (`pnpm dev`) — regla nacida del bug de v2.60.0: los fallos de inyección
  no los ve `tsc`.
- Disparo **manual** del cron desde la pantalla Cron con la BD real, verificando en
  `mail_avisos_rep` que salió **exactamente un correo por destinatario**.
- Prueba del candado: ejecutar dos veces el mismo día → el segundo no envía nada.
- Simulación de cada día del calendario (1-5, 20, y un día fuera de ventana → 0 envíos).
- Skill `revision-escalabilidad` (hay tabla, consultas y trabajo asíncrono nuevos → **aplica**).
- Validador adversarial Opus (toca correo a externos, datos de dinero y BD → **obligatorio**).
