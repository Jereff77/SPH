---
modulo: Correo (buzón de facturas)
estado: desarrollado
version_doc: 1.0
ultima_actualizacion: 2026-06-06
submodulos: [Bandeja, Cuenta]
rutas: [/correo]
claves_permiso: [800]
tablas: [correo_cuentas, correo_mensajes, correo_adjuntos]
palabras_clave: [correo, email, buzón, bandeja, factura, comprobante, IMAP, SMTP, Hostinger, responder, adjunto, conversación, hilo, sincronizar, contraseña cifrada]
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
  `messageId` (UNIQUE por cuenta). Trae INBOX (recibidos) e INBOX.Sent (enviados). En la primera sync de
  una carpeta trae los últimos ~40; luego solo UID nuevos (`ultimoUidSync` por carpeta en `correo_cuentas`).
- **Hilos**: se agrupan por `conversationId` (raíz de `References`/`In-Reply-To`, o el propio Message-ID).

## 3. Pantalla (`/correo`, 2 pestañas)
- **Bandeja**: lista de conversaciones (remitente, asunto, fecha, no leídos, 📎) + botón Sincronizar; al
  abrir una → **hilo** de mensajes (recibidos/enviados) con **adjuntos** (descargar) y **responder**
  (texto + adjuntar archivos). Al abrir un hilo, los recibidos se marcan leídos.
- **Cuenta**: configurar la cuenta (nombre, correo, usuario, contraseña, IMAP/SMTP host+puerto), **Probar
  conexión** (IMAP login + SMTP verify), activar/desactivar. La contraseña se guarda **cifrada** y nunca
  se muestra/devuelve.

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
`POST /correo/cuentas/:id/probar`, `POST /correo/sincronizar?idCuenta=`, `GET /correo/bandeja?idCuenta=`,
`GET /correo/hilo/:conversationId?idCuenta=`, `POST /correo/responder/:idMensaje` (multipart adjuntos).

## 6. Seguridad
- Contraseña **cifrada** AES-256-GCM con `EMAIL_ENCRYPTION_KEY` (env, 32 bytes derivados por sha256). El
  frontend nunca recibe la contraseña; todo IMAP/SMTP ocurre en el backend. Escrituras auditadas.
- ⚠️ Sin `EMAIL_ENCRYPTION_KEY` configurada, no se pueden guardar/usar cuentas (mensaje claro).

## 7. 🩺 Diagnóstico
| Síntoma | Causa | Qué hacer |
|---|---|---|
| "No puedo guardar la cuenta." | Falta `EMAIL_ENCRYPTION_KEY` en el servidor. | Configurarla en EasyPanel (api). |
| "Probar conexión falla (IMAP/SMTP)." | Host/puerto/usuario/contraseña incorrectos. | Verificar datos de Hostinger (993 SSL / 465 SSL). |
| "No llegan correos." | No se ha sincronizado o la cuenta está inactiva. | Pulsar Sincronizar / activar la cuenta. |
| "No veo Correo en el menú." | Falta permiso 800. | Asignar el permiso en Configuraciones → Permisos. |

## 8. Pendiente / fuera del MVP
- Redactar correos nuevos (no solo responder), búsqueda, etiquetas/carpetas, IMAP IDLE (tiempo real),
  paginación de grandes volúmenes. El correo de **soporte** podría migrarse aquí (es multi-cuenta).
