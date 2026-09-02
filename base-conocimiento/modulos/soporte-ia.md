---
modulo: Asistente / Agente de IA de Soporte
estado: desarrollado
version_doc: 1.2
ultima_actualizacion: 2026-08-05
submodulos: [Panel lateral de chat, Visión de pantalla (capturas), Diagnóstico de permisos, Escalación a ticket, Auditoría de conversaciones (solo soporte), Bandeja de tickets (solo soporte), Pestaña Agente de Soporte (config del modelo, solo soporte)]
rutas: [(transversal — burbuja + panel lateral en toda la app), /configuraciones/soporte]
claves_permiso: []
acceso_auditoria: solo soporte (catUsers.isSupport = true)
tablas: [v2_soporte_sesiones, v2_soporte_mensajes, v2_soporte_tickets, SPHConfiguraciones, segModulosUsuarios, segModulos, catUsers]
palabras_clave: [asistente, ayuda, soporte, agente, IA, inteligencia artificial, chat, chatbot, cómo hago, cómo se hace, no me deja, no puedo, no aparece, no veo, error, ticket, escalar, OpenRouter, widget, burbuja, panel lateral, dudas, tutorial, guía, "widget de chat", "burbuja de ayuda", "crear ticket", "escalar a soporte", "quién revisó mi ticket", "auditoría de conversaciones", "text-to-SQL", "consultar_datos", "razonamiento del agente", "captura de pantalla", "ver mi pantalla", "request_screenshot", "adjuntar pantalla", "cambiar el modelo del agente", "prompt del agente"]
relacionado_con: [configuraciones, correo, auditoria-y-ver-como, parques]
---

# Módulo: Asistente / Agente de IA de Soporte

## 1. Identificación
- **Propósito:** ayudar a los usuarios a **usar la aplicación** — responder "¿cómo hago X?",
  diagnosticar "¿por qué no me deja / no me aparece?" y, cuando no se resuelve, **escalar a un
  ticket** de soporte. **No** consulta datos del negocio (eso lo hace **Montse AI** en
  `/ventas/reportes`); este agente explica **el sistema**.
- **Acceso:** **todos los usuarios autenticados** (sin clave de permiso, como Novedades). Se
  presenta como una **burbuja 💬** (esquina inferior derecha) que abre un **PANEL LATERAL FIJO a la
  derecha** (desde 2026-08-05, v2.62.0; patrón portado de Montse/Kaizen2): el panel **empuja** el
  contenido (`md:mr-96` en el AppShell) en vez de taparlo, **colapsa el sidebar** de navegación al
  abrirse (recordando su estado) y lo restaura al cerrar. El panel vive en `z-[70]`, **por encima de
  los modales** (`z-50`/`z-[60]`) — se le puede escribir con una ventana de configuración abierta.
  El panel está **fuera de `<main>`**, por lo que la captura de pantalla (ver §3b) nunca se
  fotografía a sí misma. Se oculta en modo "Ver como".
- **Proveedor de IA:** **OpenRouter**, vía la edge function `soporte-chat` (el secreto
  `OPENROUTER_API_KEY` vive solo en la edge).

## 2. Cómo funciona (arquitectura)
- El **frontend** nunca habla con Supabase ni con OpenRouter: el widget llama al backend
  (`/api/soporte/*`), que es **proxy** y **orquestador del contexto**.
- Ante una pregunta, el backend:
  1. **Selecciona la documentación relevante** de esta misma base de conocimiento con un
     **router por palabras clave** (`KbService`): parsea el frontmatter de los `modulos/*.md`
     (palabras_clave, tablas, rutas, claves_permiso) y elige los 1-3 documentos que mejor
     puntúan para la pregunta + la **pantalla actual** del usuario.
  2. Arma el **perfil del usuario** que pregunta (sus permisos, rol, si es soporte) leyéndolo
     con un **cliente de SOLO LECTURA** (rol Postgres `v2_soporte_ro`).
  3. Construye el *prompt* (rol + reglas + perfil + glosario + documentos) y llama a la edge
     `soporte-chat` (OpenRouter).
  4. **Guarda** la conversación (`v2_soporte_sesiones` / `v2_soporte_mensajes`) con escrituras
     controladas y **auditadas**.

## 3. Seguridad (regla clave): el agente SOLO informa
- **Jamás modifica la base de datos.** El **perfil del usuario** (nombre, correo, si es soporte,
  permisos) se lee **completo** con el rol de **solo lectura** `v2_soporte_ro`
  (`SoporteService.perfilUsuario`): `segModulosUsuarios` (permisos) y `catUsers`
  (nombre/correo/`isSupport`). ⚠️ **Fix 2026-07-03 (bug de root):** `v2_soporte_ro` tenía la
  **política RLS** de `catUsers` pero le faltaba el **`GRANT SELECT`** sobre la tabla (Postgres
  exige ambos); sin el grant la lectura fallaba **en silencio** y el agente **no detectaba a los
  usuarios de soporte** (creía que no lo eran y no conocía su nombre real, aunque sí veía sus
  permisos por `segModulosUsuarios`, que sí tenía grant). Corregido con
  `GRANT SELECT ON "catUsers" TO v2_soporte_ro;` (migración
  `migraciones/2026-07-03-soporte-ro-grant-catusers.sql`). Si `catUsers` volviera a fallar,
  `perfilUsuario` lo **registra en log** (ya no se silencia) y el prompt marca `perfilIncierto` en
  vez de asumir "no es soporte".
- **Ya NO existen herramientas "enlatadas" de diagnóstico.** Se retiraron por completo
  (2026-07-03): `buscar_cliente`, `por_que_no_aparece_en_planes`, `diagnosticar_nave` y el archivo
  `diagnostico.service.ts` que las contenía. El agente diagnostica **razonando**: consulta el
  estado real de un registro con `consultar_datos`/`describir_tablas` (§10 — text-to-SQL acotado
  por las claves del usuario, rol **`v2_agente_ro`**, **solo SELECT**) y lo **cruza con las reglas
  de negocio documentadas en esta KB** (p. ej. `modulos/clientes.md`, `modulos/arrendatarios.md`,
  `modulos/inversionistas.md`). Por eso esas reglas de negocio **deben vivir escritas en la KB**:
  el agente ya no las trae "de fábrica" en código; **solo sabe lo que está aquí**.
- El modelo **no tiene ninguna herramienta de escritura**. Persistir el chat y **crear tickets**
  son acciones **deterministas del backend** (auditadas); el ticket se crea **solo si el usuario
  lo confirma**. La única herramienta de datos que el modelo puede invocar (§10) es de **solo
  lectura** y se ejecuta por un **switch cerrado** (un nombre inventado por el modelo no ejecuta
  nada).

## 3b. Visión de pantalla (v2.62.0 — el agente VE lo que el usuario tiene enfrente)
- **Dos vías:** el usuario adjunta su pantalla con el botón **📷** del composer, o **el modelo la
  pide solo** con la herramienta `request_screenshot` (el backend responde `pideCaptura: true`, el
  widget captura con `html-to-image` sobre `<main>` —excluye passwords y nodos
  `data-soporte-exclude-capture="true"`—, reduce a ≤1024px JPEG y **se reenvía solo** con
  `permitirCaptura: false`, anti-bucle). El aviso «Déjame ver tu pantalla… 👀» y el mensaje «📸 Esta
  es mi pantalla ahora mismo» hacen el flujo siempre visible — nunca hay captura silenciosa.
- **Lectura de pantalla (paso previo):** con captura, la PRIMERA llamada al modelo es sin
  herramientas y lo obliga a **transcribir** lo relevante (módulo, pestaña/modal, registros con
  números exactos, filtros, errores). La transcripción queda escrita en la conversación (sobrevive
  el tool-loop — sin ella lo visto se perdía entre rondas) y en la traza (`lectura_pantalla`). La
  imagen viaja **una sola vez** (ahorro). ⚠️ Tras la lectura, la conversación se cierra con un
  mensaje `user` interno: los modelos Claude rechazan terminar en `assistant` (prefill).
- **Persistencia:** la captura se sube al bucket **privado `soporteCapturas`**
  (`v2_soporte_mensajes."capturaPath"`) y se sirve con **URL firmada** (2 h) en el chat (al
  recargar) y en la auditoría. El base64 nunca toca la tabla; en el texto queda el marcador
  `📸 [captura adjunta]`. Migración `migraciones/2026-08-05-soporte-capturas-bucket-y-columna.sql`.
- **Separación respuesta/razonamiento (determinista):** el turno final del modelo se divide con el
  marcador **`[[RESPUESTA]]`** — lo anterior (pasos del método, datos crudos) va a la traza
  (`razonamiento_final`, visible solo en Configuraciones → Soporte); el usuario solo ve lo
  posterior, en lenguaje llano. Sin marcador, se muestra todo (fallback seguro). Complementa el
  saneo `limpiarCanalesRazonamiento` (quita `<|channel|>thought`, `<think>`, etc. de modelos chicos).
- **Contexto extra del turno:** los últimos 3 **errores de API** vistos en el navegador
  (`lib/api.ts` → `ultimosErroresApi()`) viajan con cada mensaje y se inyectan al prompt.
- **Requisitos:** modelo con **tools + visión** (Sonnet 5 ✅, gpt-4o ✅, Gemma 4 31B ✅, Haiku 4.5 ✅);
  body-parser del API a **2 MB** (`main.ts` — el default de 100 KB rechazaba la captura); edge
  `soporte-chat` **v5** con `max_tokens: 4096` (sin él OpenRouter reserva el máximo del modelo
  contra el saldo → 402 con crédito bajo).

## 4. Diagnóstico de permisos
El agente conoce las **claves de permiso** de cada pantalla (del frontmatter de la KB) y los
**permisos del usuario** (perfil). Así puede explicar, por ejemplo, "no ves *Claves SAT* porque
te falta la clave **215**". Los usuarios de **soporte** (`isSupport`) tienen acceso total.

### 4.1. Directorio de contactos (canalizar con la persona correcta)
El documento **`modulos/directorio-contactos.md`** se inyecta **SIEMPRE** en el contexto del agente
(no se enruta, como el glosario). Lista **quién asigna permisos**, los **responsables por área** y a
quién acudir para **soporte técnico**, con su correo/teléfono. Por eso, cuando el agente dice "te
falta el permiso 420", no se queda ahí: **te dice a quién pedírselo** (nombre + contacto). Los datos
salen de `catUsers`. Implementado en `KbService.directorio()` + reglas en `construirSystemPrompt`.

## 5. Escalación a ticket
- Cuando el agente no puede resolver, **ofrece** crear un ticket (botón 🎫 en el widget).
- Al pulsar el botón, el backend (`POST /soporte/escalar/proponer`, `SoporteService.proponerTicket`)
  pide a la IA que **analice la conversación completa** y **redacte** un `asunto` sintético y un
  `resumen` accionable (en tercera persona, profesional) — **no** copia el último mensaje. El modelo
  devuelve JSON `{asunto, resumen}` (parser tolerante a ```fences```); si falla, se usa como respaldo
  el último mensaje del usuario. El widget muestra «✍️ Redactando ticket…» mientras tanto.
- El usuario revisa/edita el **asunto** y el **resumen** propuestos y confirma.
- Se guarda en `v2_soporte_tickets` (auditado) y, si hay destino configurado
  (`SOPORTE_IA_DESTINO` en `SPHConfiguraciones`) y una cuenta de correo activa, se **notifica
  por correo** reutilizando el buzón de facturas (SmtpService).

## 6. Configuración (Configuraciones → Sistema / parámetros)
Filas en `SPHConfiguraciones` (editables sin redeploy):
- **`SOPORTE_IA_MODELO`** — modelo de OpenRouter (por defecto `openai/gpt-4o-mini`).
- **`SOPORTE_IA_PROMPT`** — *prompt* base del sistema (personalidad y reglas del agente).
- **`SOPORTE_IA_DESTINO`** *(opcional)* — correos (separados por coma) que reciben aviso de
  cada ticket. Si está vacío, el ticket queda solo en la BD.

## 6b. Auditoría y atención (Configuraciones → Soporte, SOLO soporte)
Pantalla en **Configuraciones → Soporte** (`/configuraciones/soporte`) reservada a **personal de
soporte** (`catUsers.isSupport = true`). Igual que **Cron**, **no tiene clave de permiso**: no se
asigna desde la app, solo se gobierna por el flag `isSupport` (validado server-side por `SoporteGuard`).
Tiene **dos pestañas**:

- **Conversaciones (auditoría):** lista TODAS las sesiones de chat de todos los usuarios (las más
  recientes), con nombre/correo del usuario, número de mensajes, última actividad, si alguna respuesta
  sugirió escalar (🎫) y si la sesión fue eliminada por el usuario (toggle «Incluir eliminadas»).
  Al hacer clic se abre la **conversación completa** (pregunta/respuesta en burbujas) con metadatos por
  mensaje: módulos de la KB usados, pantalla de origen, y si sugirió ticket. Sirve para **auditar las
  respuestas del agente**.
- **Tickets (atención):** bandeja de los tickets levantados, filtrable por estado
  (Abiertos / En proceso / Cerrados). Cada ticket muestra usuario, asunto, módulo, estado y fecha;
  al abrirlo se ve el **resumen del problema**, la pantalla de origen, quién lo atendió por última vez
  y un enlace para **ver la conversación de origen**. Soporte **cambia el estado**
  (`abierto → en_proceso → cerrado`); el cambio se hace con `comoActor` y queda **auditado** (la tabla
  guarda `fum`/`fumUser` = quién y cuándo).

### Arquitectura
- **Backend** `apps/api/src/modules/soporte/soporte-admin.{controller,service}.ts`
  (`@Controller('soporte/admin')`, `@UseGuards(JwtAuthGuard, SoporteGuard)`):
  `GET /soporte/admin/sesiones[?eliminadas=true]`, `GET /soporte/admin/sesiones/:id`,
  `GET /soporte/admin/tickets[?estado=]`, `PATCH /soporte/admin/tickets/:id` (`{estado}`).
  Las lecturas usan `admin` (service_role); el cambio de estado usa `comoActor(uid)`. Reutiliza las
  tablas EXISTENTES `v2_soporte_sesiones/mensajes/tickets` — **sin objetos nuevos en BD**.
- **Frontend** `apps/web/src/features/soporte-admin/` (`SoporteAdminPage.tsx`, `soporte-admin.api.ts`,
  `types.ts`). Ruta lazy `/configuraciones/soporte`. Ítem de menú con `soloSoporte: true`.

> **Nota / mejora futura (requiere autorización de BD):** la atención hoy se limita a cambiar el
> **estado**. Para registrar una **nota de resolución** por ticket haría falta agregar columnas a
> `v2_soporte_tickets` (p. ej. `nota_atencion text`, `atendido_por uuid`, `fec_atencion timestamptz`);
> eso es un cambio de esquema y, por la regla 1, debe **autorizarse y aplicarse explícitamente** antes
> de implementarlo. Mientras tanto, `fum`/`fumUser` + la bitácora de auditoría cubren el «quién/cuándo».

## 6c. Pestaña «Agente de Soporte» (Configuraciones → Soporte, SOLO soporte — v2.62.0)
Cuarta pestaña de la pantalla de Soporte, para gobernar al agente **sin desplegar**:
- **Modelo de IA**: slug de OpenRouter editable (fila `SOPORTE_IA_MODELO`); aplica al siguiente
  turno. ⚠️ Debe soportar **tools + visión**. **Prompt base** editable (`SOPORTE_IA_PROMPT`).
- **Herramientas del modelo**: derivadas del CÓDIGO real (`ConsultasService.toolSpecs` +
  `request_screenshot`) — la pantalla nunca miente. **Habilidades**: lo que el sistema hace
  alrededor del modelo (perfil en tiempo real, KB, directorio, errores del navegador, visión,
  escalación, solo-lectura garantizada).
- Backend: `GET/PATCH /soporte/admin/agente` (`SoporteGuard`; el PATCH valida con Zod y escribe con
  `comoActor` — auditado). Además, la **auditoría de conversaciones** muestra la **captura** del
  turno (URL firmada) y la traza enriquecida: 📸 lectura de pantalla, 🧭 pasos «Paso N —» y
  razonamiento final, ⚙️ herramientas/SQL, ⛔ tope; y cada mensaje registra
  `ver_pantalla_disponible`/`pidio_captura`/`trae_captura` para depurar la visión.

## 7. Objetos en BD (nuevos de v2)
- Rol **`v2_soporte_ro`** (solo lectura).
- Tablas **`v2_soporte_sesiones`**, **`v2_soporte_mensajes`**, **`v2_soporte_tickets`**
  (RLS ON, solo backend; con `trg_auditoria`).
- Parámetros `SOPORTE_IA_*` en `SPHConfiguraciones`.
- SQL: `base-conocimiento/migraciones/2026-06-12-soporte-ia.sql`.

## 10. Capacidades de datos del agente (function-calling) — v2.46.0 → razonador (2026-07-03)
Además de explicar el sistema, el agente **diagnostica problemas reales** consultando la BD en vivo y
**razonando** con las reglas de negocio de esta KB, vía **function-calling** (OpenRouter). Desde
**2026-07-03** el diseño pasó de "clasificador que escala" a **"solucionador de primer nivel que
razona"**: ya **no** hay herramientas que traigan la regla de negocio "enlatada" en código — el modelo
consulta el **dato crudo** y la **KB le da el criterio** para interpretarlo y guiar la solución. Ver
`PLAN-agente-soporte-razonador.md` (diseño) y `PLAN-agente-soporte-guiar-cliente-sin-tipo.md` (caso
real que originó el rediseño).

### Arquitectura común
- La edge `soporte-chat` reenvía `tools` y devuelve `message` (con `tool_calls`); el **tool-loop vive en
  el backend** (`SoporteService.enviar`, **tope 6 iteraciones**), que tiene acceso a datos, RBAC y
  auditoría. Modelo en `SOPORTE_IA_MODELO` (debe soportar tools). **Objetivo del rediseño: Sonnet 5**
  vía OpenRouter (fallback Sonnet 4.6 si el 5 no estuviera en catálogo); requiere fijar el parámetro en
  BD y desplegar la edge sin `temperature` (Fase 4 del plan) — mientras tanto el código sigue con el
  modelo por defecto anterior.
- **Instrumentación / auditoría:** cada mensaje guarda en `v2_soporte_mensajes` el **`debug_sql`** (SQL
  generado) y **`debug_meta.traza`** (razonamiento del modelo `tipo:'pensamiento'` + herramientas
  `tipo:'herramienta'` con error/total_filas). Se ve en **Configuraciones → Soporte → Conversaciones**
  (bloque "🔎 Razonamiento del agente", solo soporte). El system prompt pide al modelo **explicar en
  1-2 frases** por qué usa cada herramienta (queda en la traza).

### La única herramienta de datos: CONSULTA DE DATOS libre acotada por claves (`ConsultasService`, `consultas.service.ts`) — text-to-SQL
Responde tanto preguntas **analíticas** ("cuántos clientes nuevos…") como de **diagnóstico** ("¿este
cliente tiene el flag arrendatario? ¿está activo? ¿es de prueba? ¿esta nave está Arrendada o
Disponible?"), sobre **los módulos cuya clave tiene el usuario**. Herramientas `describir_tablas(tablas)`
(columnas bajo demanda) + `consultar_datos(sql)`. Es la **única** vía de datos del agente: no hay
herramientas alternas ni atajos deterministas.
- **Doble barrera de seguridad:** (1) **backend** valida que sea SELECT y que el SQL **solo toque
  tablas del universo permitido por las claves** del usuario (mapa `MODULOS_DATOS` + `COMUNES`;
  `tablasFueraDeUniverso`); (2) **BD**: ejecuta vía `agente_consulta_sql` con el rol **`v2_agente_ro`**
  (SELECT solo de negocio, nunca sistema/auth/secretos; BYPASSRLS, límite = sus grants). Coherente con
  el RBAC por clave del proyecto (no hay aislamiento por fila).
- **Prompt compacto:** lista de tablas por módulo + **RELACIONES CLAVE** (JOINs) — las columnas se
  piden con `describir_tablas` (evita un prompt gigante para usuarios con muchas claves).
- El **error real de Postgres se devuelve al MODELO** (no al usuario) para que **auto-corrija** el SQL;
  el usuario solo ve la respuesta redactada.
- Objetos BD: rol `v2_agente_ro`, funciones `agente_consulta_sql` (SECURITY INVOKER, valida solo-SELECT,
  cap 5000 filas) y `agente_esquema` (metadatos). Migración
  `migraciones/2026-06-29-agente-consulta-sql-rol-ro.sql`.

### Método de razonamiento (system prompt, `construirSystemPrompt`)
El prompt no solo da acceso a la herramienta: le indica al modelo **CÓMO diagnosticar y CUÁNDO
escalar** — esto reemplaza la lógica que antes vivía "enlatada" en cada herramienta retirada:
1. Entender el problema real (no solo el síntoma literal).
2. **Verificar, no asumir**: si la causa depende de un dato (¿existe el registro?, ¿tiene marcada la
   casilla/tipo?, ¿está activo?, ¿es de prueba?, ¿la nave está libre?), **consultarlo** con
   `consultar_datos` antes de responder. Nunca inventar la causa.
3. Contrastar el dato con las **reglas del módulo** (esta KB — p. ej. la regla del selector de
   Arrendatarios en `modulos/arrendatarios.md`, la del selector de Planes en `modulos/inversionistas.md`,
   o los estados "Papelera" (`pruebas=true`) / "Sin clasificar" (sin ninguna bandera de tipo, DISTINTO
   de Papelera) en `modulos/clientes.md` §10).
4. **Clasificar** la causa: *datos/configuración* (el usuario lo corrige en la app) vs *sistema/
   plataforma* (bug, datos contradictorios, o algo que nadie corrige desde la interfaz).
5. **Resolver, no solo diagnosticar**: dar los pasos exactos y accionables en la app (módulo, pantalla,
   botón, casilla) e indicar **dónde** encontrar el registro.
6. **Guiar → canalizar → escalar** (en ese orden; escalar es el ÚLTIMO recurso):
   - **Guiar:** si el usuario **tiene** el permiso del módulo donde se corrige el dato (p. ej. 300
     Clientes), darle los pasos para que lo haga él mismo.
   - **Canalizar:** si al usuario **le falta un permiso** que necesita, decirle qué clave y con quién
     tramitarla (`modulos/directorio-contactos.md`) — **sin** ticket.
   - **Escalar (ticket), SOLO como último recurso:** cuando el caso requiere (a) un **cambio de
     plataforma** (desarrollo) o (b) una corrección de **datos que nadie puede hacer desde la
     interfaz** (falla de sistema real). El agente **nunca** afirma "hay que tocar la base de datos":
     solo señala que "requiere revisión de Jereff/el equipo técnico"; la decisión y ejecución quedan
     del lado humano.
7. Ser honesto: si no puede verificar algo, decirlo; nunca inventar.
- ⛔ **Regla dura del prompt:** marcar/quitar el **tipo** de un cliente (Inversionista/Arrendatario/
  Ticket/Usuario final) es una corrección de **DATOS** en **Clientes (clave 300)**, **NUNCA** un cambio
  de permisos — no se deriva al administrador de permisos por esto.

### Perfil del usuario en el prompt (primer insumo, antes de razonar)
El bloque "CONTEXTO DEL USUARIO" se inyecta **al inicio y de forma prominente** en el system prompt:
**nombre, correo, si es SOPORTE (acceso total) y la lista de permisos**, leídos con `v2_soporte_ro`
(§3, con el fix del grant a `catUsers`). Regla dura del prompt: *"ANTES de decidir nada, mira quién
pregunta y a qué tiene acceso"* — evita que el agente le pida permisos a un usuario de soporte que ya
los tiene, o que canalice a alguien que ya puede corregirlo él mismo.

### Operativo / pendientes

> 📋 **Los pendientes de este módulo viven en el TABLERO** (Configuraciones ▸ Pendientes, tabla
> `dev_pendientes`) desde el 2026-09-02 — regla 11 de `contexto.md` §1. Lo de abajo es **histórico**:
> su estado puede estar vencido y **no se abren pendientes nuevos aquí**. Lo que sí sigue vivo en esta
> sección es el **✅ hecho** (qué hace el módulo hoy), que es conocimiento, no trabajo pendiente.
- La edge `soporte-chat` se despliega aparte (`supabase functions deploy soporte-chat`), NO con el push.
  **Desplegada v5 (2026-08-05):** sin `temperature` (fix del 502 histórico con haiku — CERRADO) y con
  `max_tokens: 4096` (sin él, OpenRouter reserva el máximo del modelo contra el saldo → 402 con
  crédito bajo). La Fase 4 del `PLAN-agente-soporte-razonador.md` quedó cubierta: el modelo se cambia
  desde la pestaña «Agente de Soporte» (§6c) sin desplegar.
- 📌 **Elección de modelo (evidencia 2026-08-05, misma pregunta, mismos datos):** Sonnet 5 ejecutó el
  método completo a la primera; Gemma 4 31B y Haiku 4.5 lo lograron tras endurecer prompt/andamiaje
  (con fugas cosméticas ya saneadas en backend). Con la KB completa (gotcha `numNaveNAME`) la brecha
  se achica: la decisión es principalmente de costo. Recomendación vigente: **Sonnet 5** en
  producción; Gemma como opción económica.
- Otras deudas: afinar el parser `tablasFueraDeUniverso` (el aislamiento inter-módulo del text-to-SQL
  es "mejor esfuerzo"; la barrera dura es la lista blanca de grants del rol `v2_agente_ro`).
- **Deuda BAJA diferida (revisión de escalabilidad 2026-08-05):** (1) `invocarEdge` (backend→edge) y
  edge→OpenRouter sin timeout explícito (`AbortController`) — acotado hoy por el tope de 6 rondas +
  wall-clock de la edge; (2) el bucket `soporteCapturas` no tiene política de retención (~100–300 KB
  por captura) — definir limpieza de capturas de sesiones eliminadas o mayores a N meses.

## 8. Fase 2 (futura)
Migrar el router de la KB a **búsqueda semántica con `pgvector`** (tabla `v2_kb_embeddings`)
para preguntas vagas; el contrato de `KbService.seleccionar()` ya está aislado para cambiar la
implementación sin tocar el resto. La KB en markdown sigue siendo la fuente de verdad.

## 9. Para el agente de soporte (gotchas / notas del propio asistente)
- El agente **solo sabe lo que está en esta KB**: si un módulo está incompleto aquí, el agente
  lo reflejará. Mantener los `modulos/*.md` al día (regla 8) mejora directamente sus respuestas.
- **Permisos del propio usuario (SÍ los conoce).** El backend (`perfilUsuario`) lee los permisos del
  usuario que pregunta con el rol de solo lectura `v2_soporte_ro` y los inyecta en el system prompt
  como "PERMISOS DEL USUARIO". El agente DEBE responder directamente "¿tengo el permiso X?" /
  "¿qué permisos tengo?" desde esa lista (no deferir con un administrador). Si alguna vez responde
  "no hay forma de verificar tus permisos", revisar: (1) que `perfilUsuario` no esté registrando
  errores de lectura con `v2_soporte_ro` (ahora se loguean, no se silencian) y (2) las REGLAS de
  `construirSystemPrompt`. **No** consulta permisos de OTROS usuarios ni datos de negocio (eso es
  Montse AI o un ticket).
- **El agente SÍ consulta la BD en vivo** (§10): vía **text-to-SQL acotado por claves**
  (`consultar_datos`). Desde el **rediseño razonador (2026-07-03)** se **retiraron las herramientas
  enlatadas** de diagnóstico: el agente **razona** (consulta → analiza → responde) en vez de ejecutar
  diagnósticos fijos. La edge `soporte-chat` soporta **function-calling** y el **tool-loop vive en el
  backend**; el modelo escribe un `SELECT` que el backend **valida** (solo lectura + allowlist de módulos
  según los permisos del usuario) y ejecuta con un **rol de solo lectura**, devolviendo un resultado saneado.
- El marcador `[[ESCALAR]]` que el modelo añade al final de una respuesta es **interno**: el
  backend lo detecta para mostrar el botón de ticket y lo **retira** del texto visible.
- La carpeta `base-conocimiento/` se incluye en la imagen de producción del backend (Dockerfile);
  si se mueve, define la env `KB_PATH`.
