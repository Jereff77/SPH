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

## 10. Capacidades de datos del agente (function-calling) — v2.46.0 → v2.47.0
Además de explicar el sistema, el agente **diagnostica problemas reales** y **responde preguntas de
datos** consultando la BD en vivo, vía **function-calling** (OpenRouter).

### Arquitectura común
- La edge `soporte-chat` reenvía `tools` y devuelve `message` (con `tool_calls`); el **tool-loop vive
  en el backend** (`SoporteService.enviar`, **tope 6 iteraciones**), que tiene acceso a datos, RBAC y
  auditoría. Modelo en `SOPORTE_IA_MODELO` (debe soportar tools; hoy **`openai/gpt-4o`**).
- **Instrumentación / auditoría:** cada mensaje guarda en `v2_soporte_mensajes` el **`debug_sql`** (SQL
  generado) y **`debug_meta.traza`** (razonamiento del modelo `tipo:'pensamiento'` + herramientas
  `tipo:'herramienta'` con error/total_filas). Se ve en **Configuraciones → Soporte → Conversaciones**
  (bloque "🔎 Razonamiento del agente", solo soporte). El system prompt pide al modelo **explicar en
  1-2 frases** por qué usa cada herramienta (queda en la traza).

### A) Herramientas de diagnóstico ENLATADAS (`DiagnosticoService`, `diagnostico.service.ts`)
- `buscar_cliente(texto)` → identifica cliente por nombre/razón social/RFC (id + nombre + tipos, sin
  PII; filtro allowlist).
- `por_que_no_aparece_en_planes(idInversionista)` → condiciones del selector de Planes + propiedades/plan.
- `diagnosticar_nave(parque, numNave, contexto)` → disponibilidad de la nave. **Arrendatarios** =
  `status=true AND Arrendada=false`; **Ventas** = `situacion='Disponible'` (reglas reales de v1). Trae
  todas las coincidencias por parque (resuelve "Acupark 2"≈"Acupark II").
- Cada una valida **RBAC por clave** (300/610/20/25 o `isSupport`) ANTES de consultar; solo lectura;
  **switch cerrado**; salida saneada con **`tipoFalla`** (`datos` corregible vs `sistema` → escalar).

### B) CONSULTA DE DATOS libre acotada por claves (`ConsultasService`, `consultas.service.ts`) — text-to-SQL
Responde preguntas analíticas ("cuántos clientes nuevos…") sobre **los módulos cuya clave tiene el
usuario**. Herramientas `describir_tablas(tablas)` (columnas bajo demanda) + `consultar_datos(sql)`.
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

### Operativo / pendientes
- La edge `soporte-chat` se despliega aparte (`supabase functions deploy soporte-chat`), NO con el push.
- ⚠️ **Deuda:** con `anthropic/claude-3.5-haiku` la edge `soporte-chat` devolvió **502** (Montse/`ia-chat`
  sí funciona con haiku) → falta **alinear `soporte-chat` con `ia-chat`** (p. ej. quitar `temperature`);
  mientras, se usa `openai/gpt-4o`. Otras deudas: mover lecturas de `DiagnosticoService` de `admin` a un
  rol RO; detectores de anomalía que escalan ticket; afinar el parser `tablasFueraDeUniverso`.

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
- **El agente SÍ consulta la BD en vivo** (desde v2.46.0, §10): herramientas **enlatadas** de
  diagnóstico **y** (desde v2.47.0) **text-to-SQL acotado por claves** (`consultar_datos`). La edge
  `soporte-chat` soporta **function-calling** y el **tool-loop vive en el backend**. Para el diagnóstico,
  el modelo elige la herramienta y sus parámetros; el
  backend ejecuta una consulta fija de solo lectura y devuelve un resultado saneado.
- El marcador `[[ESCALAR]]` que el modelo añade al final de una respuesta es **interno**: el
  backend lo detecta para mostrar el botón de ticket y lo **retira** del texto visible.
- La carpeta `base-conocimiento/` se incluye en la imagen de producción del backend (Dockerfile);
  si se mueve, define la env `KB_PATH`.
