---
modulo: Asistente / Agente de IA de Soporte
estado: desarrollado
version_doc: 1.0
ultima_actualizacion: 2026-06-12
submodulos: [Widget de chat, Diagnóstico de permisos, Escalación a ticket, Auditoría de conversaciones (solo soporte), Bandeja de tickets (solo soporte)]
rutas: [(transversal — widget flotante en toda la app), /configuraciones/soporte]
claves_permiso: []
acceso_auditoria: solo soporte (catUsers.isSupport = true)
tablas: [v2_soporte_sesiones, v2_soporte_mensajes, v2_soporte_tickets, SPHConfiguraciones, segModulosUsuarios, segModulos, catUsers]
palabras_clave: [asistente, ayuda, soporte, agente, IA, inteligencia artificial, chat, chatbot, cómo hago, cómo se hace, no me deja, no puedo, no aparece, no veo, error, ticket, escalar, OpenRouter, widget, burbuja, dudas, tutorial, guía]
relacionado_con: [configuraciones, correo, auditoria-y-ver-como]
---

# Módulo: Asistente / Agente de IA de Soporte

## 1. Identificación
- **Propósito:** ayudar a los usuarios a **usar la aplicación** — responder "¿cómo hago X?",
  diagnosticar "¿por qué no me deja / no me aparece?" y, cuando no se resuelve, **escalar a un
  ticket** de soporte. **No** consulta datos del negocio (eso lo hace **Montse AI** en
  `/ventas/reportes`); este agente explica **el sistema**.
- **Acceso:** **todos los usuarios autenticados** (sin clave de permiso, como Novedades). Se
  presenta como un **widget flotante** (burbuja 💬, esquina inferior derecha) disponible en
  **todas** las pantallas. Se oculta en modo "Ver como".
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
- **Jamás modifica la base de datos.** El **perfil del usuario** (permisos, nombre) se lee con el
  rol `v2_soporte_ro` (`SELECT` sobre un conjunto mínimo: permisos, catálogo, `catUsers` no
  sensible). Las **herramientas de diagnóstico** (§10, Fase 1) leen tablas de negocio
  (`inversionista`, `propiedades`) con el cliente **`admin`** mediante **consultas fijas y
  parametrizadas** (no text-to-SQL), validando RBAC en código y devolviendo resultado saneado.
  ⚠️ **Deuda (validador 2026-06-29):** esas lecturas deberían usar `v2_soporte_ro` (defensa en
  profundidad); requiere **ampliar los grants** del rol a `inversionista`/`propiedades` (SELECT) —
  cambio de BD pendiente de autorización (ver `contexto.md` §9). Hoy el motor NO bloquearía una
  mutación accidental en esa ruta (service_role salta RLS); la garantía es solo de código (todas
  las herramientas son `SELECT`).
- El modelo **no tiene ninguna herramienta de escritura**. Persistir el chat y **crear tickets**
  son acciones **deterministas del backend** (auditadas); el ticket se crea **solo si el usuario
  lo confirma**. Las herramientas que el modelo SÍ puede invocar (§10) son **solo de lectura** y se
  ejecutan por un **switch cerrado** (un nombre inventado por el modelo no ejecuta nada).

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

## 7. Objetos en BD (nuevos de v2)
- Rol **`v2_soporte_ro`** (solo lectura).
- Tablas **`v2_soporte_sesiones`**, **`v2_soporte_mensajes`**, **`v2_soporte_tickets`**
  (RLS ON, solo backend; con `trg_auditoria`).
- Parámetros `SOPORTE_IA_*` en `SPHConfiguraciones`.
- SQL: `base-conocimiento/migraciones/2026-06-12-soporte-ia.sql`.

## 10. Herramientas de diagnóstico (function-calling) — Fase 1 (v2.46.0)
El agente puede **diagnosticar problemas reales** consultando la BD en vivo (no solo explicar el
sistema), replicando lo que hace un desarrollador: ante "no me aparece X / no me deja Y" sobre un
cliente, mira los datos y devuelve **causa + acción**.

- **Arquitectura:** **function-calling** vía OpenRouter. La edge `soporte-chat` reenvía las `tools`
  y devuelve el `message` del modelo (con `tool_calls`); el **tool-loop vive en el backend**
  (`SoporteService.enviar`), que es quien tiene acceso a datos, RBAC y auditoría. Tope de
  **4 iteraciones** de herramientas por pregunta.
- **Catálogo** (`DiagnosticoService`, `diagnostico.service.ts`):
  - `buscar_cliente(texto)` → identifica al cliente por nombre/razón social/RFC. Devuelve id + nombre
    + tipos (sin CURP/correo/teléfono/RFC). Filtro con **allowlist** (sin metacaracteres PostgREST).
  - `por_que_no_aparece_en_planes(idInversionista)` → evalúa las condiciones reales del selector de
    Planes (`inversionista=true`, `pruebas=false`, `status=true`) + si tiene propiedades/plan activo;
    devuelve causa(s) + acción.
- **Seguridad:** cada herramienta valida **RBAC** del que pregunta (claves **300/610** o `isSupport`)
  ANTES de consultar; **solo lectura**; **switch cerrado** (nombre inválido → no ejecuta); errores de
  BD no se filtran al modelo (solo al log). Lo que viaja a OpenRouter es la pregunta + el **resultado
  saneado** (causa+acción), nunca filas crudas. 📌 **Decisión consciente:** el nombre/razón social y
  el `idInversionista` sí viajan al LLM (aceptable: el usuario ya tiene permiso 300/610 para verlos).
- **⚠️ Operativo:** la edge **NO** se despliega con el push de api/web; requiere
  `supabase functions deploy soporte-chat`. Y el modelo de `SOPORTE_IA_MODELO` debe soportar tools
  (p. ej. `openai/gpt-4o-mini` o `anthropic/claude-3.5-sonnet`).
- **Backward-compatible:** si la edge vieja aún no está desplegada, ignora `tools` y no devuelve
  `message` → el backend cae a la respuesta de texto (el agente funciona como antes, sin diagnóstico).
- **Pendiente (Fases 2-3):** resto del Patrón A (`radiografia_cliente`, otros selectores, permisos) y
  **detectores de anomalía** que escalan ticket diagnosticado (idEstado=3+Pagado, folio duplicado…).

## 8. Fase 2 (futura)
Migrar el router de la KB a **búsqueda semántica con `pgvector`** (tabla `v2_kb_embeddings`)
para preguntas vagas; el contrato de `KbService.seleccionar()` ya está aislado para cambiar la
implementación sin tocar el resto. La KB en markdown sigue siendo la fuente de verdad.

## 9. Gotchas
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
- **El agente SÍ consulta la BD en vivo mediante herramientas de diagnóstico** (desde v2.46.0, §10).
  La edge `soporte-chat` ahora soporta **function-calling** y el **tool-loop vive en el backend**.
  Las herramientas son **enlatadas** (no SQL libre): el modelo elige cuál y con qué parámetros, el
  backend ejecuta una consulta fija de solo lectura y devuelve un resultado saneado.
- El marcador `[[ESCALAR]]` que el modelo añade al final de una respuesta es **interno**: el
  backend lo detecta para mostrar el botón de ticket y lo **retira** del texto visible.
- La carpeta `base-conocimiento/` se incluye en la imagen de producción del backend (Dockerfile);
  si se mueve, define la env `KB_PATH`.
