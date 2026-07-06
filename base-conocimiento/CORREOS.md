---
documento: Cuentas de correo — mapa transversal
estado: vivo
ultima_actualizacion: 2026-07-06
palabras_clave: [correo, cuenta de correo, SMTP, IMAP, Hostinger, no llega el correo, no llega la invitación, quién manda este correo, remitente, from, correo de invitaciones, correo de facturas, correo de soporte a inquilinos, agente@portal.gruposph.mx, soporte@portal.gruposph.mx, soporteaclientes@portal.gruposph.mx, SMTP_INVITACIONES, correo_cuentas, EMAIL_ENCRYPTION_KEY, primera cuenta activa]
relacionado_con: [configuraciones, correo, cxp, arrendatarios, soporte-inquilinos, soporte-ia]
---

# Cuentas de correo — mapa transversal

> **Para el agente de soporte:** si el usuario pregunta "¿de qué correo sale esto?", "¿por qué no
> llegó tal correo?" o "¿cuál cuenta usa tal módulo?", este documento es la fuente única. No hay una
> pantalla en el ERP que liste esto de forma centralizada — vive repartido en variables de entorno y
> en la tabla `correo_cuentas`; este documento lo consolida.

## 1. Hay DOS mecanismos distintos de envío (no lo confundas)

1. **Cuenta SMTP dedicada por variables de entorno** (`SMTP_INVITACIONES_*`), fija, un solo remitente,
   implementada en `InvitacionesMailer` (`apps/api/src/modules/invitaciones/invitaciones.mailer.ts`).
   Pese al nombre ("invitaciones"), **se reutiliza como el SMTP dedicado del sistema** para varios
   módulos más (ver tabla). Solo **envía** (no tiene IMAP: no recibe ni sincroniza nada).
2. **Cuentas configurables en BD** (`correo_cuentas`), con **IMAP + SMTP** cada una, administradas desde
   la pantalla `/correo` (permiso 800 ver, 801 configurar). Password cifrada con `EMAIL_ENCRYPTION_KEY`
   (AES-256-GCM). Implementadas en `apps/api/src/modules/correo/` (`cuentas.service.ts` credenciales,
   `smtp.service.ts` envío, `imap.service.ts` recepción/sincronización).

## 2. Cuentas reales en producción (verificado en BD, 2026-07-06)

| # | Correo | Mecanismo | Proveedor | Módulos que la usan |
|---|---|---|---|---|
| 1 | `soporte@portal.gruposph.mx` | Env vars `SMTP_INVITACIONES_*` (`InvitacionesMailer`) | Hostinger (`smtp.hostinger.com:587`) | Invitaciones (§3.1) · CxP → Recordatorio de aprobación (§3.2) · Arrendatarios → Incrementos INPC (§3.3) |
| 2 | `agente@portal.gruposph.mx` ("Agente Grupo SPH") | `correo_cuentas` (BD), id `174f233b-…` | Hostinger (imap+smtp) | Correo / buzón de facturas (§3.4) · CxP → Complementos REP (§3.5, como "primera cuenta activa" ⚠️) · Agente de IA de Soporte (§3.6, ídem ⚠️) |
| 3 | `soporteaclientes@portal.gruposph.mx` ("Soporte a Inquilinos") | `correo_cuentas` (BD), id `bbc3e65a-…`, designada en `SPHConfiguraciones.SOPORTE_INQUILINOS_CUENTA_ID` | Hostinger (imap+smtp) | Soporte a Inquilinos (§3.7) |

⚠️ Las contraseñas **NUNCA** se documentan aquí. Viven cifradas en `correo_cuentas.passwordCifrada`
(BD) o en texto plano solo dentro del `.env`/`.env.local` del servidor (`SMTP_INVITACIONES_PASS`,
fuera de git). Si necesitas rotar una, hazlo desde `/correo` (cuentas de BD) o editando el `.env` en
EasyPanel + redeploy (cuenta dedicada).

## 3. Detalle por módulo consumidor

### 3.1. Invitaciones (Configuraciones → Usuarios → Invitar)
- Envía el correo con el enlace `{APP_WEB_URL}/registro?token=XXX` al crear o **reenviar** una
  invitación. Ver `modulos/configuraciones.md` §3.1.
- **Botón «Copiar link»** (nuevo, v2.57.0): genera un enlace nuevo **sin** pasar por este mailer — no
  manda correo, solo lo copia al portapapeles. Pensado para cuando el correo no llega.
- ⚠️ **Gotcha de diagnóstico:** el booleano `enviado` que ve el usuario (`{ enviado: true/false }`) solo
  confirma que el servidor SMTP **aceptó** el mensaje sin lanzar excepción (nodemailer `sendMail` no
  lanzó). **No confirma entrega real** a la bandeja del destinatario: no hay webhook de
  entrega/rebote ni bitácora de intentos para este flujo. Si `enviado=true` pero el usuario dice que
  no le llegó, hay que descartar spam del lado del destinatario o revisar los logs del backend
  (`SMTP invitación a <correo>: ...` solo aparece si hubo EXCEPCIÓN, no si el destino rebotó
  silenciosamente después de aceptarlo).

### 3.2. CxP → Recordatorio de aprobación (cron diario ~07:00 MX)
- Un correo por aprobador con sus solicitudes pendientes. **Sí** tiene bitácora:
  `mail_recordatorios_aprobacion` (estado `enviado`/`fallido`), consultable en
  Configuraciones → Soporte. Ver `modulos/recordatorio-aprobacion-cxp.md`.

### 3.3. Arrendatarios → Incrementos INPC
- Notifica incrementos de renta aplicados: un correo por responsable de parque + uno a la gerencia
  (`ARRE_INPC_GERENTE_UID`). Best-effort (si falla el SMTP, el incremento no se revierte; queda
  trazado en `arre_incrementos.correoNotificado`/`fecNotificacion` y se puede reenviar). Ver
  `modulos/incrementos-inpc.md`.

### 3.4. Correo (buzón de facturas) — `/correo`
- Cuenta `agente@portal.gruposph.mx`. Sincroniza IMAP cada 5 min + botón manual; responde por SMTP con
  firma corporativa. Ver `modulos/correo.md`.

### 3.5. CxP → Complementos de pago (REP) pendientes
- Aviso diario al solicitante y al gerente que autorizó, en la ventana previa al bloqueo del usuario.
- ⚠️ **Gotcha real (no atacado, solo documentado):** toma la cuenta con
  `cuentas.activas()[0]` — **"la primera cuenta activa"**, sin `ORDER BY` explícito en la consulta.
  Hoy coincide con `agente@portal.gruposph.mx` porque es la única/primera activa, pero si se activa o
  crea una tercera cuenta, cuál sea "la primera" **no está garantizado** (depende del orden físico que
  devuelva Postgres). Si el remitente de estos avisos cambia sin que nadie lo haya tocado a propósito,
  esta es la causa más probable a revisar primero.

### 3.6. Agente de IA de Soporte (widget transversal)
- Notifica por correo cuando un ticket se escala. Mismo patrón que §3.5: toma `cuentas[0]` (primera
  cuenta activa) vía `CuentasService`/`SmtpService`. Mismo ⚠️ gotcha de ambigüedad si hay más de una
  cuenta activa.

### 3.7. Soporte a Inquilinos — `/arrendatarios/soporte`
- Cuenta `soporteaclientes@portal.gruposph.mx`, **designada explícitamente** (a diferencia de §3.5/3.6)
  vía `SPHConfiguraciones.SOPORTE_INQUILINOS_CUENTA_ID` — se cambia desde la propia pantalla de
  Soporte a Inquilinos (`designarCuenta`), no por "la primera activa". Sincroniza incidentes por IMAP
  + responde por SMTP con firma. Ver `modulos/soporte-inquilinos.md`.

## 4. Si un correo "no llega" — checklist rápido

1. ¿Cuál de las 3 cuentas debía mandarlo? (tabla §2, según el módulo).
2. Si es la cuenta dedicada (`soporte@…`, mecanismo 1): revisar logs del backend por
   `SMTP invitación a <correo>` / `SMTP dedicado a <destino>` — solo aparece si nodemailer lanzó
   excepción (fallo de conexión/auth), no si el destino lo rebotó después de aceptarlo.
3. Si es una cuenta de BD (mecanismo 2, §3.4/3.5/3.6/3.7): probar la conexión desde `/correo` (botón
   "Probar" en la cuenta) para descartar credenciales vencidas.
4. Ninguno de los flujos actuales tiene confirmación real de entrega (sin webhook de un proveedor
   transaccional tipo SES/SendGrid/Postmark). Pendiente de decisión de negocio si vale la pena migrar
   (ver conversación de la sesión 2026-07-06 en `.sessions/bitacora.md`).
