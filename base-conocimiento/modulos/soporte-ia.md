---
modulo: Asistente / Agente de IA de Soporte
estado: desarrollado
version_doc: 1.0
ultima_actualizacion: 2026-06-12
submodulos: [Widget de chat, Diagnóstico de permisos, Escalación a ticket]
rutas: [(transversal — widget flotante en toda la app)]
claves_permiso: []
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
- **Jamás modifica la base de datos.** TODA lectura de datos del usuario pasa por el rol
  `v2_soporte_ro`, que solo tiene `SELECT` sobre un conjunto mínimo de tablas (permisos y
  catálogo de módulos; en `catUsers`, solo columnas no sensibles). Aunque hubiera un fallo o
  un *prompt* malicioso, el motor (Postgres) **rechaza** cualquier escritura.
- El modelo **no tiene ninguna herramienta de escritura**. Persistir el chat y **crear tickets**
  son acciones **deterministas del backend** (auditadas); el ticket se crea **solo si el usuario
  lo confirma**.

## 4. Diagnóstico de permisos
El agente conoce las **claves de permiso** de cada pantalla (del frontmatter de la KB) y los
**permisos del usuario** (perfil). Así puede explicar, por ejemplo, "no ves *Claves SAT* porque
te falta la clave **215**; pídesela a un administrador en Configuraciones → Permisos". Los
usuarios de **soporte** (`isSupport`) tienen acceso total.

## 5. Escalación a ticket
- Cuando el agente no puede resolver, **ofrece** crear un ticket (botón 🎫 en el widget).
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

## 7. Objetos en BD (nuevos de v2)
- Rol **`v2_soporte_ro`** (solo lectura).
- Tablas **`v2_soporte_sesiones`**, **`v2_soporte_mensajes`**, **`v2_soporte_tickets`**
  (RLS ON, solo backend; con `trg_auditoria`).
- Parámetros `SOPORTE_IA_*` en `SPHConfiguraciones`.
- SQL: `base-conocimiento/migraciones/2026-06-12-soporte-ia.sql`.

## 8. Fase 2 (futura)
Migrar el router de la KB a **búsqueda semántica con `pgvector`** (tabla `v2_kb_embeddings`)
para preguntas vagas; el contrato de `KbService.seleccionar()` ya está aislado para cambiar la
implementación sin tocar el resto. La KB en markdown sigue siendo la fuente de verdad.

## 9. Gotchas
- El agente **solo sabe lo que está en esta KB**: si un módulo está incompleto aquí, el agente
  lo reflejará. Mantener los `modulos/*.md` al día (regla 8) mejora directamente sus respuestas.
- El marcador `[[ESCALAR]]` que el modelo añade al final de una respuesta es **interno**: el
  backend lo detecta para mostrar el botón de ticket y lo **retira** del texto visible.
- La carpeta `base-conocimiento/` se incluye en la imagen de producción del backend (Dockerfile);
  si se mueve, define la env `KB_PATH`.
