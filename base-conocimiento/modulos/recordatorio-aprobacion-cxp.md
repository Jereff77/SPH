---
modulo: Recordatorio de aprobación CxP (correo automático)
claves_permiso: [430 (aprobador destinatario), isSupport (ver bitácora)]
entidades: [cxp, catUsers, cxp_fechas_habilitadas, mail_recordatorios_aprobacion]
palabras_clave: [recordatorio, recordatorio de aprobación, correo a aprobadores, aviso por correo, solicitudes por aprobar, pendientes de aprobar, cron 7am, recordatorio diario, n8n, miércoles, mail_recordatorios_aprobacion, recordatorios enviados]
relacionados: [cxp, cron, soporte-ia, correo]
estado: ✅
---

# Recordatorio de aprobación CxP (correo automático)

## Qué hace / para qué sirve (lenguaje de negocio)
Cada día, **a las 7:00 a.m. (hora de México)**, el sistema revisa si la **aprobación de
Cuentas por Pagar está habilitada ese día** y, de estarlo, envía un **correo a cada
aprobador que tenga solicitudes de pago pendientes** (en estado *Enviado*). El correo
lista sus solicitudes (proveedor, monto y folio) e incluye un botón que lleva directo a la
pantalla *Aprobar Solicitudes*. **Reemplaza** el recordatorio que antes mandaba **n8n solo
los miércoles**: ahora corre **todos los días** y solo cuando realmente se puede aprobar.

Los aprobadores **no** reciben correo cuando: la aprobación no está habilitada ese día, o
no tienen ninguna solicitud pendiente. Las solicitudes **sin aprobador asignado**
(`uidGerente = '-'`/vacío) no se notifican (no hay a quién).

## Cómo se usa (flujo)
1. Es **automático** (cron diario 07:00 MX). No requiere intervención.
2. Soporte puede **dispararlo manualmente** desde *Configuraciones → Cron* → tarea
   **"Recordatorio de aprobación CxP"** → botón **Ejecutar ahora** (para pruebas).
3. Cada correo enviado queda registrado y se consulta en *Configuraciones → Soporte* →
   pestaña **"Recordatorios enviados"** (destinatario, nº de pendientes, estado y la vista
   del correo tal cual se envió, además de las solicitudes incluidas).

## Arquitectura (endpoints, servicios, archivos clave)
- **Cron / lógica:** `apps/api/src/modules/cxp/recordatorio-aprobacion.scheduler.ts`
  - `@Cron('0 13 * * *')` (13:00 UTC = 07:00 MX), nombre de tarea
    `TAREA_CXP_RECORDATORIO_APROBACION` (`common/cron/cron.tareas.ts`).
  - **Habilitación del día:** RPC `cxp_puede_autorizar()` (boolean; lee
    `cxp_fechas_habilitadas.autorizar` de hoy). Misma RPC que usa *Aprobar Solicitudes*.
  - **Pendientes:** `cxp` con `status=true` e `idEstado=2`, agrupadas por `uidGerente`
    (se omiten `null`/vacío/`'-'`). Correo y nombre del aprobador desde `catUsers`.
  - Registra cada corrida en la bitácora de cron (`v2_cron_ejecuciones`) con
    `{habilitado, aprobadores, enviados}`; disparo manual y monitoreo vía `CronService`.
- **Envío:** cuenta **SMTP dedicada de invitaciones** (`InvitacionesMailer.enviarHtml`,
  vars `SMTP_INVITACIONES_*`) — **no** el buzón de facturas ni `SmtpService`. Enlace del
  botón = `${APP_WEB_URL}/cxp/aprobar`.
- **Bitácora de correos:** tabla `mail_recordatorios_aprobacion` (un renglón por correo,
  incluye fallidos; guarda el HTML). RLS ON sin políticas → solo backend (`service_role`).
- **Lectura (solo soporte):** `SoporteAdminController` (`@UseGuards(JwtAuthGuard,
  SoporteGuard)`): `GET /soporte/admin/recordatorios-aprobacion` y `…/:id` (detalle con
  HTML). Front: pestaña en `apps/web/src/features/soporte-admin/SoporteAdminPage.tsx`
  (HTML del correo renderizado en `<iframe sandbox="">`).
- **Migración:** `base-conocimiento/migraciones/2026-06-30-recordatorio-aprobacion-cxp.sql`.

## Reglas de negocio y validaciones
- Solo envía si `cxp_puede_autorizar()` es `true` ese día.
- Un correo por aprobador **activo** (`catUsers.status = true`) **con ≥1 pendiente**; los
  pendientes sin aprobador, o asignados a un aprobador **inactivo/inexistente**, no se notifican.
- El identity/correo del aprobador sale de la BD (`uidGerente` → `catUsers`), nunca del cliente.

## Gotchas / trampas conocidas
- 📌 **`uidGerente = '-'`** es el centinela de "sin aprobador" (patrón `NULLIF(TRIM(x),'-')`).
  Hay que excluirlo: si se cuela en la consulta a `catUsers` (columna `uid` es `uuid`), la
  consulta **falla** y deja a TODOS sin correo. Ya está filtrado en el scheduler.
- 📌 **Aprobadores inactivos** (`catUsers.status = false`) conservan su correo en BD. Hay que
  **omitirlos** (se resuelve `status` y se saltan): de lo contrario un dado-de-baja seguiría
  recibiendo recordatorios (caso real: Ivvy Barragán, con solicitudes aún asignadas). Sus
  solicitudes quedan **sin aprobador activo** → conviene **reasignarlas** (dato operativo).
- Si `SMTP_INVITACIONES_*` no está configurado, la tarea registra y sale **sin enviar**
  (no rompe). Verificar esas envs + `APP_WEB_URL` en el entorno.
- La tabla `mail_recordatorios_aprobacion` se accede sin tipar (`as any`/cliente genérico)
  hasta regenerar `@erp/types`, igual que `v2_cron_ejecuciones`/`v2_soporte_*`.

## Decisiones y pendientes
- **Pendiente operativo:** tras validar en prod, **apagar el flujo de n8n** de los miércoles
  para no duplicar el correo.
