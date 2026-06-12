---
documento: Propuesta — Agente de IA de Soporte
estado: propuesta (aprobada, pendiente de implementación)
version_doc: 1.0
ultima_actualizacion: 2026-06-12
autor: Claude (Opus 4.8) — Orquestador IA
palabras_clave: [agente, soporte, IA, asistente, OpenRouter, chat, ayuda, how-to, ticket,
  escalar, widget, RAG, base de conocimiento, read-only, solo lectura, v2_soporte_ro]
relacionado_con: [configuraciones, correo, auditoria-y-ver-como]
---

# Propuesta — Agente de IA de Soporte (ERP SPH v2) con OpenRouter

## Contexto

El ERP SPH v2 (NestJS + React + Supabase) busca incorporar un **agente de IA de soporte**
cuyo propósito es **ayudar a los usuarios a usar la aplicación**: responder "¿cómo hago X?",
diagnosticar problemas ("¿por qué no me deja…?"), explicar campos/estados y, cuando no pueda
resolver, **escalar a un ticket**. No es un asistente de datos (eso ya lo cubre **Montse AI**,
que consulta el ERP vía SQL en `/ventas/reportes`); este agente explica **el sistema**, no los datos.

El proyecto ya invirtió en dos cimientos que esta propuesta reutiliza:

1. **Infraestructura de chat con OpenRouter ya probada** (Montse AI): patrón *backend-proxy*
   a una edge function, tablas de sesiones/conversaciones, frontend de chat con markdown.
   Referencias: `apps/api/src/modules/ventas/montse.service.ts` (proxy a la edge `ia-chat`,
   reenvío de JWT), `apps/web/src/features/ventas/montse/` (chat, hook, API client).
2. **Una base de conocimiento creada explícitamente para este agente**:
   `version2/base-conocimiento/` — `INDICE.md` (router con mapas palabra-clave→módulo,
   tabla→módulo, ruta→módulo), 14 `modulos/*.md` con frontmatter rico
   (`claves_permiso`, `tablas`, `rutas`, `palabras_clave`, `relacionado_con`),
   `GLOSARIO.md` y `OBSOLESCENCIA-BD.md`.

**Decisiones acordadas con el usuario:**
- **Alcance MVP:** guía de uso (how-to) + diagnóstico de problemas + conocer el contexto del
  usuario (permisos/rol/pantalla) + escalar a ticket.
- **🔒 Restricción inviolable:** el agente **SOLO informa; jamás modifica la base de datos**.
  Para garantizarlo a nivel de motor, se crea un **rol Supabase de solo lectura** dedicado.
- **Infraestructura:** **agente dedicado nuevo** (separado de Montse), con prompt, tablas y
  permiso propios.
- **RAG:** **enrutamiento por palabras clave** (fase 1), aprovechando el frontmatter de la KB.
  Diseño preparado para migrar a `pgvector` como fase 2.
- **UI:** **widget flotante global** disponible en toda la app.

Resultado esperado: un asistente "siempre a la mano" que reduce tickets de soporte triviales,
orienta a usuarios nuevos y, cuando hace falta, canaliza el problema a una persona — sin ningún
riesgo de que toque datos de producción.

---

## Reglas del proyecto que esta propuesta respeta

- **Frontera de confianza:** el frontend NUNCA habla con Supabase ni con OpenRouter. Todo pasa
  por el backend (`apps/api`), único con credenciales. (HANDOFF reglas 1–4).
- **Read-only real:** el acceso a datos del agente se hace con un **rol Postgres nuevo
  `v2_soporte_ro`** (solo `SELECT` sobre un conjunto acotado de tablas/vistas), no con
  `service_role`. Es la garantía dura contra prompt-injection.
- **Sin tocar el sistema viejo:** todos los objetos nuevos llevan prefijo `v2_…`; nada de v1 se
  modifica. La creación de cualquier objeto en BD se entrega como SQL para que el usuario lo
  aplique (regla 1: autorización explícita, caso por caso).
- **Trazabilidad (regla 6):** las tablas de negocio nuevas (sesiones/conversaciones de soporte,
  tickets) llevan trigger de auditoría `trg_auditoria` (`fn_auditoria`).
- **Español, fechas `dd/mm/aaaa`, tablas con header sticky azul** donde aplique (reglas 5, 7, 7b).
- **Documentación y versionado (reglas 8–10):** nuevo doc `base-conocimiento/modulos/soporte-ia.md`,
  registro en changelog vía `v2_changelog_registrar`, y refresco de graphify al cerrar.

---

## Arquitectura propuesta

```
┌──────────────┐   POST /api/soporte/mensaje      ┌────────────────────────┐
│  Frontend    │  (JWT en memoria, vía api.ts)    │  Backend NestJS        │
│  Widget chat │ ───────────────────────────────▶ │  SoporteController      │
│ (flotante)   │   { sessionId, texto, contexto } │  SoporteService (proxy) │
└──────────────┘                                  └───────────┬────────────┘
       ▲                                                       │  reenvía JWT del usuario
       │  { respuesta, sugerencias, escalable }                ▼
       │                                          ┌────────────────────────┐
       └──────────────────────────────────────── │ Edge Function           │
                                                  │ soporte-chat (OpenRouter)│
                                                  │  - arma system prompt    │
                                                  │  - inyecta KB relevante  │
                                                  │  - tool read-only DB     │
                                                  └───────┬─────────┬────────┘
                                                          │         │
                                  rol v2_soporte_ro (SELECT)        │ persiste conversación
                                                          ▼         ▼ (service_role + audit)
                                              ┌────────────┐  ┌──────────────────────┐
                                              │ Datos ERP  │  │ v2_soporte_sesiones   │
                                              │ (solo SELECT)│ │ v2_soporte_mensajes  │
                                              └────────────┘  └──────────────────────┘
```

**Por qué edge function (igual que Montse):** mantiene la `OPENROUTER_API_KEY` fuera del backend
y del bundle (vive como secreto de Supabase), y reaprovecha el patrón ya validado. El backend de
NestJS actúa de **proxy** (reenvía el JWT del usuario, aplica `JwtAuthGuard` + permiso) y de
**orquestador del contexto** (decide qué docs de la KB cargar y arma el perfil del usuario).

### Reparto de responsabilidades (clave para el read-only)

| Operación | Quién la hace | Con qué credencial | ¿Escribe? |
|---|---|---|---|
| Consultar datos del usuario (permisos, estado de un registro) | la **tool** del LLM en la edge | **`v2_soporte_ro`** (solo `SELECT`) | ❌ Nunca |
| Cargar docs de la KB (`.md`) | backend NestJS (lee del filesystem del deploy) | — | ❌ |
| Persistir la conversación | backend / edge | `service_role` | ✅ controlado + auditado |
| Crear ticket de escalación | backend NestJS, **solo tras confirmación explícita del usuario** | `service_role` | ✅ controlado + auditado |

> El LLM **nunca** tiene una herramienta de escritura. La persistencia del chat y la creación de
> tickets son acciones **deterministas del backend**, disparadas por el flujo (no por el modelo),
> con auditoría. Así "el agente solo informa" se cumple literalmente, y el rol `v2_soporte_ro`
> impide cualquier escritura incluso si el prompt es manipulado.

---

## Consumo de la base de conocimiento (RAG fase 1 — enrutamiento por palabras clave)

El backend implementa un **router de KB** que replica en código lo que `INDICE.md` describe en prosa:

1. Al arrancar, el `KbService` **parsea el frontmatter** de los 14 `modulos/*.md` (campos
   `palabras_clave`, `tablas`, `rutas`, `claves_permiso`, `relacionado_con`) y construye índices
   invertidos en memoria (palabra→módulos, tabla→módulos, ruta→módulos). Reusa los mismos mapas
   que ya existen en `INDICE.md`.
2. Ante un mensaje del usuario, se calcula un **score por módulo** (coincidencias de palabras
   clave + la ruta/pantalla actual que envía el widget + tablas mencionadas). Se seleccionan los
   **1–3 módulos top** y sus `relacionado_con`.
3. Se inyectan en el system prompt: `GLOSARIO.md` (siempre, es corto y transversal) + el contenido
   de los `.md` seleccionados. La KB completa cabe holgada en el contexto de Opus/modelos largos,
   así que esto es un recorte de eficiencia/foco, no una limitación de tamaño.
4. El system prompt fija el rol ("asistente de soporte de SPH, explicas cómo usar el sistema, no
   inventas, si no sabes ofreces escalar a ticket"), el idioma (español), y reglas de seguridad
   (no revelar SQL/secretos, no prometer cambios en datos).

**Por qué keyword y no pgvector ahora:** cero DDL nuevo para la KB, aprovecha el frontmatter tal
cual, es determinista y depurable, y se implementa en días. La **fase 2** (documentada abajo)
migra a `pgvector` cuando la KB crezca y las preguntas vagas lo justifiquen.

---

## Contexto del usuario (diagnóstico personalizado)

Para responder "a ti no te aparece esa pestaña porque te falta la clave 420", el backend arma un
**perfil del solicitante** (no el LLM): con el `uid` del JWT lee (solo lectura) sus permisos de
`segModulosUsuarios`, su rol y flags (`isSupport`) de `catUsers`, y recibe del widget la **ruta
actual**. Ese perfil se pasa a la edge como contexto estructurado. Cruzando el perfil con los
`claves_permiso` del frontmatter de la KB, el agente puede explicar faltas de permiso, accesos
restringidos a soporte, etc. — todo informativo.

---

## Escalación a ticket (acción controlada, no del LLM)

Cuando el agente no resuelve, ofrece escalar. La creación del ticket es un **endpoint del backend**
que se ejecuta **solo si el usuario confirma** (botón "Crear ticket de soporte" en el widget). El
backend arma el ticket con: usuario, ruta/pantalla, resumen de la conversación, y módulo detectado.
Se guarda en una tabla nueva `v2_soporte_tickets` (con `trg_auditoria`) y, opcionalmente, se notifica
por correo reutilizando el `SmtpService`/`CorreoModule` existente. El LLM jamás escribe el ticket;
solo redacta el resumen propuesto que el usuario revisa antes de confirmar.

---

## Objetos NUEVOS en BD (a entregar como SQL para que el usuario los aplique — regla 1)

Ninguno se aplica sin autorización; se entregan en `base-conocimiento/migraciones/`.

1. **Rol de solo lectura `v2_soporte_ro`** — `CREATE ROLE … NOLOGIN`; `GRANT USAGE ON SCHEMA public`;
   `GRANT SELECT` **únicamente** sobre las tablas/vistas que el agente necesita para diagnóstico
   (p. ej. `segModulosUsuarios`, `segModulos`, `catUsers`, y las vistas de estado que se definan).
   **Sin** `INSERT/UPDATE/DELETE` en ninguna. La edge usa este rol (vía un cliente Supabase
   inicializado con una key/JWT que asuma `v2_soporte_ro`) para su tool de datos.
2. **`v2_soporte_sesiones`** (uuid, uid_usuario, titulo, status, fc) + **`v2_soporte_mensajes`**
   (uuid, session_id→sesiones, uid_usuario, pregunta, respuesta, modulos_detectados,
   ruta_origen, tokens_entrada/salida, escalado bool, fc). Ambas con **RLS ON** y `trg_auditoria`.
3. **`v2_soporte_tickets`** (uuid, uid_usuario, modulo, ruta, resumen, estado, fc) con `trg_auditoria`.
4. **Parámetros en `SPHConfiguraciones`** para el modelo y el prompt base (p. ej.
   `SOPORTE_IA_MODELO`, `SOPORTE_IA_PROMPT`), editables sin redeploy — siguiendo el patrón de
   configuración existente.
5. **Permiso `segModulos`** propio del módulo (clave a confirmar; el widget se muestra a todos los
   autenticados, pero las funciones admin —ver tickets— quedan tras permiso). *Alternativa:* sin
   clave, disponible para todos (como Changelog). **A confirmar en implementación.**

> El secreto `OPENROUTER_API_KEY` se guarda como **secreto de Supabase** (no en el `.env` del
> backend), accesible solo desde la edge function — idéntico a como ya opera `ia-chat`.

---

## Backend NestJS — módulo nuevo `apps/api/src/modules/soporte/`

Sigue la receta del HANDOFF §7 y el patrón de `montse.service.ts`:

- `soporte.controller.ts` — `@UseGuards(JwtAuthGuard)` (+ permiso si se define):
  - `POST /api/soporte/mensaje` `{ sessionId, texto, rutaActual }` → reenvía JWT a la edge,
    devuelve `{ respuesta, modulos, escalable }`.
  - `GET/POST/PATCH/DELETE /api/soporte/sesiones…` (historial del chat).
  - `POST /api/soporte/escalar` `{ sessionId }` → crea ticket (tras confirmación) + notifica.
- `soporte.service.ts` — proxy a la edge (`fetch` con `Authorization: Bearer <jwt usuario>` +
  `apikey: anon`, igual que Montse), arma perfil del usuario y selección de KB.
- `kb.service.ts` — parser de frontmatter + router por palabras clave (lee
  `base-conocimiento/`; se incluye en la imagen del deploy del api).
- `soporte.schemas.ts` (Zod) · `soporte.module.ts` · registrar en `app.module.ts`.

## Frontend React — `apps/web/src/features/soporte/` + widget global

- **`SoporteWidget.tsx`** — burbuja flotante (esquina inferior derecha) montada en el `AppShell`
  (`components/layout/`), presente en todas las rutas protegidas. Abre un panel de chat.
- Reutiliza el patrón de Montse: `react-markdown` + `remark-gfm` para la respuesta, hook
  `useSoporte.ts` (TanStack Query) análogo a `useMontse.ts`, `soporte.api.ts` que pega a
  `lib/api.ts`. Envía automáticamente la **ruta actual** (`useLocation`) como contexto.
- Botón "Crear ticket de soporte" visible cuando la respuesta marca `escalable`.
- Nada de Supabase/OpenRouter en el front (frontera de confianza).

## Edge function `soporte-chat` (Supabase, OpenRouter)

- Recibe `{ texto, session_id, perfil, kbDocs }` + JWT del usuario. Identifica al usuario con
  `auth.getUser()`.
- Llama a **OpenRouter** (`https://openrouter.ai/api/v1/chat/completions`) con la
  `OPENROUTER_API_KEY` (secreto), el modelo de `SOPORTE_IA_MODELO`, el system prompt armado y el
  historial de la sesión.
- **Tool opcional de datos** ejecutada con el cliente `v2_soporte_ro` (solo `SELECT`) para
  diagnóstico puntual; persiste la conversación. Devuelve `{ respuesta, escalable }`.

---

## Fase 2 (futura, documentada — no en el MVP): RAG semántico con pgvector

Cuando la KB crezca o las preguntas vagas lo pidan: tabla nueva `v2_kb_embeddings` (chunk, módulo,
embedding `vector`), pipeline de indexado derivado de los `.md` (fuente de verdad sigue siendo el
markdown), y búsqueda por similitud que **reemplaza/complementa** el router por palabras clave del
`kb.service.ts`. El contrato del `KbService` se diseña desde ya para poder cambiar la
implementación de selección sin tocar el resto. Esto ya estaba previsto en `INDICE.md` y en varios
docs de la KB como "fase del agente de soporte".

---

## Plan de implementación por etapas

1. **Cimientos (sin parte de IA aún):** módulo `soporte` backend + `KbService` (parser frontmatter
   + router keyword) + tablas `v2_soporte_*` y rol `v2_soporte_ro` (SQL entregado y aplicado por el
   usuario). Endpoint `/soporte/mensaje` devolviendo de momento la KB seleccionada (sin LLM) para
   validar el enrutamiento.
2. **Edge `soporte-chat` + OpenRouter:** system prompt, inyección de KB, persistencia. Backend pasa
   a proxy real. Chat funcional end-to-end (how-to).
3. **Contexto + diagnóstico:** perfil del usuario (permisos/rol/ruta) inyectado; respuestas
   personalizadas sobre permisos/estados.
4. **Widget global** en el `AppShell` + UX del chat (markdown, historial, indicador de escritura).
5. **Escalación a ticket:** endpoint `/soporte/escalar`, tabla `v2_soporte_tickets`, notificación
   por correo (CorreoModule). Botón en el widget.
6. **Cierre (regla 9/10):** doc `base-conocimiento/modulos/soporte-ia.md`, `INDICE.md`, changelog,
   graphify `--update`, commit `vN.N.N: …` en `erp_v2`.

---

## Archivos/objetos a crear o tocar (resumen)

- **Backend (nuevo):** `apps/api/src/modules/soporte/{soporte.controller,soporte.service,kb.service,soporte.schemas,soporte.module}.ts`; registrar en `apps/api/src/app.module.ts`.
- **Frontend (nuevo):** `apps/web/src/features/soporte/{SoporteWidget,useSoporte,soporte.api}.tsx`; montar el widget en `apps/web/src/components/layout/` (AppShell).
- **Edge (nuevo, Supabase cloud):** función `soporte-chat`.
- **BD (SQL nuevo, autorización del usuario):** rol `v2_soporte_ro`; tablas `v2_soporte_sesiones`,
  `v2_soporte_mensajes`, `v2_soporte_tickets`; parámetros `SOPORTE_IA_*` en `SPHConfiguraciones`;
  (opcional) permiso `segModulos`. Entregar en `version2/base-conocimiento/migraciones/`.
- **Reutilizado tal cual:** `lib/api.ts`, `JwtAuthGuard`, patrón proxy de `montse.service.ts`,
  `SmtpService`/`CorreoModule`, toda la KB de `base-conocimiento/`.

---

## Verificación (cómo probar de extremo a extremo)

- **Read-only garantizado:** con el rol `v2_soporte_ro`, intentar un `INSERT/UPDATE` debe fallar
  por permisos (`permission denied`). Revisar `get_advisors` tras aplicar el SQL.
- **Enrutamiento de KB:** preguntas como "¿cómo apruebo una solicitud de pago?" deben seleccionar
  `cxp.md`; "¿por qué no veo Claves SAT?" → `configuraciones.md` (clave 215). Test unitario del
  `KbService` con casos de `palabras_clave` reales del frontmatter.
- **Contexto:** un usuario sin la clave de una pestaña debe recibir la explicación correcta de por
  qué no la ve.
- **Chat E2E:** desde el navegador (`localhost:5173`), abrir el widget en distintas pantallas,
  conversar, ver markdown, y validar que el endpoint protegido exige JWT (401 sin token).
- **Escalación:** confirmar ticket → fila en `v2_soporte_tickets` + correo enviado + entrada en
  `auditoria` (trazabilidad).
- **Sin fugas:** verificar que el front no importa `@supabase/supabase-js` ni expone la
  `OPENROUTER_API_KEY` (vive como secreto de la edge).
