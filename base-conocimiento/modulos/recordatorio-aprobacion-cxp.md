---
modulo: Recordatorio de aprobación CxP (correo automático)
estado: desarrollado
rutas: [/configuraciones/soporte, /configuraciones/cron]
claves_permiso: [430]
tablas: [cxp, catUsers, cxp_fechas_habilitadas, mail_recordatorios_aprobacion]
palabras_clave: [recordatorio, recordatorio de aprobación, correo a aprobadores, aviso por correo, solicitudes por aprobar, pendientes de aprobar, cron 7am, recordatorio diario, n8n, miércoles, mail_recordatorios_aprobacion, recordatorios enviados, "no me llegó el recordatorio", "no recibí el correo de aprobadores", "aprobador inactivo sigue recibiendo correo", "sin aprobador asignado", "apagar recordatorio de n8n"]
relacionado_con: [cxp, cron, soporte-ia, correo]
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
  (HTML del correo renderizado en `<iframe sandbox="">`), montada en la ruta
  `/configuraciones/soporte`. El acceso a esta bitácora **no** usa una clave de permiso
  numérica: lo protege el guard `SoporteGuard` (flag especial `isSupport` del usuario), a
  diferencia de la clave `430` que aplica al aprobador destinatario del correo.
- **Migración:** `base-conocimiento/migraciones/2026-06-30-recordatorio-aprobacion-cxp.sql`.

## Reglas de negocio y validaciones
- Solo envía si `cxp_puede_autorizar()` es `true` ese día.
- Un correo por aprobador **activo** (`catUsers.status = true`) **con ≥1 pendiente**; los
  pendientes sin aprobador, o asignados a un aprobador **inactivo/inexistente**, no se notifican.
- El identity/correo del aprobador sale de la BD (`uidGerente` → `catUsers`), nunca del cliente.

## Para el agente de soporte (reglas de datos / diagnóstico)
- **"No me llegó el recordatorio" / "no recibí el correo de aprobadores"** → revisar primero si
  la solicitud tiene **`uidGerente = '-'`** (o vacío): ese es el centinela de "sin aprobador"
  (patrón `NULLIF(TRIM(x),'-')`) → no hay a quién notificar, es esperado. Regla verificada: el
  scheduler (`apps/api/src/modules/cxp/recordatorio-aprobacion.scheduler.ts`) excluye estas filas
  antes de consultar `catUsers`; si no se excluyeran, la consulta a `catUsers` (columna `uid`
  tipo `uuid`) **fallaría** y dejaría a TODOS los aprobadores sin correo ese día.
- **"Aprobador inactivo sigue recibiendo correo" / "aprobador dado de baja aparece con
  pendientes"** → causa: `catUsers.status = false` pero el aprobador **conserva su correo en
  BD**. Regla verificada: el scheduler resuelve `status` desde `catUsers` y **omite** a los
  inactivos (caso real confirmado: **Ivvy Barragán**, dada de baja con solicitudes aún
  asignadas). Diagnóstico correcto: esas solicitudes quedan **sin aprobador activo** y deben
  **reasignarse** manualmente (dato operativo, no un bug del recordatorio).
- **"Sin aprobador asignado" / "esta solicitud nunca notifica a nadie"** → mismo centinela
  `uidGerente = '-'`/vacío de arriba: la solicitud no tiene aprobador, hay que asignarle uno.
- **"No me llegó el correo aunque hoy sí puedo aprobar"** → verificar en orden: (1)
  `cxp_puede_autorizar()` / `cxp_fechas_habilitadas.autorizar` de HOY (si es `false`, no se
  envía nada ese día, es esperado); (2) variables `SMTP_INVITACIONES_*` y `APP_WEB_URL` en el
  entorno — si `SMTP_INVITACIONES_*` no está configurado, la tarea registra la corrida y sale
  **sin enviar** (no rompe, pero tampoco notifica).
- **"Quiero apagar el recordatorio de n8n de los miércoles"** → es un pendiente operativo
  conocido (ver "Decisiones y pendientes"): el flujo de n8n de los miércoles **todavía no se ha
  apagado** en producción; hasta entonces puede llegar un correo duplicado los miércoles.

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

> 📋 **Los pendientes de este módulo viven en el TABLERO** (Configuraciones ▸ Pendientes, tabla
> `dev_pendientes`) desde el 2026-09-02 — regla 11 de `contexto.md` §1. Lo de abajo es **histórico**:
> su estado puede estar vencido y **no se abren pendientes nuevos aquí**. Lo que sí sigue vivo en esta
> sección es el **✅ hecho** (qué hace el módulo hoy), que es conocimiento, no trabajo pendiente.
- **Pendiente operativo:** tras validar en prod, **apagar el flujo de n8n** de los miércoles
  para no duplicar el correo.
