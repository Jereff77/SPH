---
modulo: Correo (buzón de facturas)
estado: desarrollado
version_doc: 1.1
ultima_actualizacion: 2026-06-09
submodulos: [Bandeja, Cuenta]
rutas: [/correo]
claves_permiso: [800, 801]
tablas: [correo_cuentas, correo_mensajes, correo_adjuntos]
palabras_clave: [correo, email, buzón, bandeja, factura, comprobante, IMAP, SMTP, Hostinger, responder, adjunto, conversación, hilo, sincronizar, contraseña cifrada, "no llegan los correos", "no puedo guardar la cuenta", "falla la conexión imap/smtp", "no veo correo en el menú", "no sincroniza el buzón", "buzón vacío", "no puedo responder", "el correo no se sincroniza solo"]
relacionado_con: [cxp, configuraciones]
---

# Módulo: Correo (buzón de facturas)

## 1. Identificación
- **Propósito:** ver y responder los correos de la cuenta de **facturas/comprobantes** (Hostinger)
  directamente en el ERP. Es una **sección propia** del sidebar (no está en Configuraciones).
- **Ruta:** `/correo` · **Permiso:** **800** (módulo "Correo" en `segModulos`).
- **A quién sirve:** Cuentas por Pagar / administración que reciben facturas por correo.

## 2. Arquitectura (sin N8N)
- El **backend NestJS** hace todo: **IMAP** (recepción, `imapflow`) + **SMTP** (envío, `nodemailer`),
  parseo con `mailparser`. Reemplaza al flujo N8N (que sigue usándose para el correo de **soporte** en CRM,
  tablas `emails`/`email_attachments` — eso es OTRO sistema).
- **Multi-cuenta**: tablas propias `correo_*` (no se mezclan con las de soporte).
- **Sincronización**: cron cada 5 min (`@nestjs/schedule`) + botón **Sincronizar** manual. Deduplica por
  `messageId` (UNIQUE por cuenta). **Descubre TODAS las carpetas** de la cuenta vía `client.list()` (IMAP) y
  las sincroniza, **excepto** Papelera/Spam/Borradores/"Todos" (por `specialUse` `\Trash`/`\Junk`/`\Drafts`/
  `\All`, flag `\Noselect`, o por nombre). Así, si un proceso externo (reglas del servidor, N8N viejo, manual)
  **mueve un correo a otra carpeta** tras procesarlo, sigue apareciendo. El `tipo` (received/sent) se deduce
  de `specialUse=\Sent` o del nombre. En la primera sync de cada carpeta trae los últimos ~40; luego solo UID
  nuevos (`ultimoUidSync` es un mapa `carpeta→uid` en `correo_cuentas`, soporta N carpetas sin cambio de
  esquema). El **path real** de la carpeta se guarda en `correo_mensajes.folder`.
- **Sigue los MOVIMIENTOS entre carpetas**: si un correo ya sincronizado reaparece en otra carpeta (p. ej. un
  **proceso externo en otro servidor** que **cada 60 s** revisa la cuenta, procesa las transferencias, las
  registra en `movbancarios` y mueve el correo a `BanBajio`/`Procesado`/…), el sync detecta el duplicado por
  `messageId` y **actualiza su `folder`/`tipo`** (`actualizarUbicacion`, solo si cambió) en vez de ignorarlo.
  Así la vista refleja la carpeta actual del buzón. Funciona porque al mover un correo el servidor le asigna un
  UID nuevo (> último), y el sync incremental lo vuelve a ver (latencia: hasta el siguiente ciclo del cron de
  5 min, o al pulsar Sincronizar).
- **Hilos**: se agrupan por `conversationId` (raíz de `References`/`In-Reply-To`, o el propio Message-ID).
- **Ver también:** `../CORREOS.md` — mapa de **todas** las cuentas de correo del sistema. Esta cuenta
  (`agente@portal.gruposph.mx`, "primera cuenta activa") también la reutilizan CxP → Complementos REP
  y el Agente de IA de Soporte; ⚠️ ver el gotcha de ambigüedad si se activa una tercera cuenta.

## 3. Pantalla (`/correo`, 2 pestañas)
- **Bandeja**: lista de conversaciones (remitente, asunto, fecha, no leídos, 📎, **etiqueta de carpeta**) +
  **selector de carpeta** ("Todas las carpetas" + cada carpeta con su nº de no leídos) + botón Sincronizar; al
  abrir una → **hilo** de mensajes (recibidos/enviados) con **adjuntos** (descargar) y **responder**
  (texto + adjuntar archivos). Al abrir un hilo, los recibidos se marcan leídos. El **cuerpo HTML** se
  renderiza en un **`<iframe sandbox>` sin `allow-scripts`** (XSS bloqueado; el JS del correo no se ejecuta) y
  cae a texto plano si no hay HTML.
- **Cuenta** (solo permiso **801**): configurar la cuenta (nombre, correo, usuario, contraseña, IMAP/SMTP
  host+puerto), **Probar conexión** (IMAP login + SMTP verify), activar/desactivar. La contraseña se guarda
  **cifrada** y nunca se muestra/devuelve. Quien no tenga 801 solo ve la Bandeja.

> **Permisos:** **800** = usar el correo (ver bandeja, abrir hilos, responder). **801** = configurar la
> cuenta (crear/editar/probar/activar). El `GET /correo/cuentas` (lectura, para saber la cuenta activa de la
> bandeja) va bajo 800; las mutaciones de cuenta van bajo 801.

## 4. Modelo de datos (tablas nuevas)
- **`correo_cuentas`**: `id`, `nombre`, `email`, `imapHost`, `imapPort` (993), `smtpHost`, `smtpPort` (465),
  `usuario`, `passwordCifrada` (AES-256-GCM), `activo`, `ultimoUidSync` (jsonb por carpeta), `fc`, `uidr`.
- **`correo_mensajes`**: `id`, `idCuenta`, `messageId` (único por cuenta), `conversationId`, `fromEmail`,
  `toEmail`, `cc`, `subject`, `bodyText`, `bodyHtml`, `fecha`, `tipo` (received/sent), `folder`, `leido`,
  `tieneAdjuntos`, `fc`.
- **`correo_adjuntos`**: `id`, `idMensaje`, `filename`, `url` (bucket `email_attachments`), `contentType`,
  `tamano`, `fc`.
- RLS habilitado (solo service_role) + trigger de auditoría en cuentas y mensajes. Bucket reutilizado:
  `email_attachments` (carpeta `<idCuenta>/<idMensaje>/`).

## 5. Endpoints (backend, `@RequierePermiso(800)`)
`GET/POST/PATCH /correo/cuentas`, `PATCH /correo/cuentas/:id/activo`, `POST /correo/cuentas/probar`,
`POST /correo/cuentas/:id/probar`, `POST /correo/sincronizar?idCuenta=`,
`GET /correo/bandeja?idCuenta=&folder=` (folder opcional para filtrar por carpeta),
`GET /correo/carpetas?idCuenta=` (lista la estructura REAL del buzón **en vivo por IMAP** —incluye carpetas
personalizadas y recién creadas, aun vacías— + conteos no leídos desde BD; alimenta el selector. Frontend
cachea 5 min y refresca tras Sincronizar),
`GET /correo/hilo/:conversationId?idCuenta=`, `POST /correo/responder/:idMensaje` (multipart adjuntos).

## 6. Seguridad
- Contraseña **cifrada** AES-256-GCM con `EMAIL_ENCRYPTION_KEY` (env, 32 bytes derivados por sha256). El
  frontend nunca recibe la contraseña; todo IMAP/SMTP ocurre en el backend. Escrituras auditadas.
- ⚠️ Sin `EMAIL_ENCRYPTION_KEY` configurada, no se pueden guardar/usar cuentas (mensaje claro).

## 7. 🩺 Para el agente de soporte (diagnóstico)
| Síntoma | Causa | Qué hacer |
|---|---|---|
| "No puedo guardar la cuenta." | Falta `EMAIL_ENCRYPTION_KEY` en el servidor. | Configurarla en EasyPanel (api). |
| "Probar conexión falla (IMAP/SMTP)." | Host/puerto/usuario/contraseña incorrectos. | Verificar datos de Hostinger (993 SSL / 465 SSL). |
| "No llegan correos." | No se ha sincronizado o la cuenta está inactiva. | Pulsar Sincronizar / activar la cuenta. |
| "No veo Correo en el menú." | Falta permiso 800. | Asignar el permiso en Configuraciones → Permisos. |

## 8. Pendiente / fuera del MVP

> 📋 **Los pendientes de este módulo viven en el TABLERO** (Configuraciones ▸ Pendientes, tabla
> `dev_pendientes`) desde el 2026-09-02 — regla 11 de `contexto.md` §1. Lo de abajo es **histórico**:
> su estado puede estar vencido y **no se abren pendientes nuevos aquí**. Lo que sí sigue vivo en esta
> sección es el **✅ hecho** (qué hace el módulo hoy), que es conocimiento, no trabajo pendiente.
- Redactar correos nuevos (no solo responder), búsqueda, IMAP IDLE (tiempo real), paginación de grandes
  volúmenes, traer **más de ~40** correos históricos por carpeta en el primer sync (hoy el tope `MAX_PRIMERA`
  aplica por carpeta), bloqueo opcional de imágenes remotas (tracking pixels). El correo de **soporte** podría
  migrarse aquí (es multi-cuenta).
