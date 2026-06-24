---
modulo: Soporte a Inquilinos (Arrendatarios)
estado: desarrollado
version_doc: 2.0
ultima_actualizacion: 2026-06-23
rutas: [/arrendatarios/soporte]
claves_permiso: [31, 32, 33, 34, 35, 36]
tablas: [incidentes, incidentes_remitentes, incidentes_seguimientos, correo_cuentas, correo_mensajes, correo_adjuntos, inversionista, arrenPropiedades, v_arrendadasNaves, naves, parques, catUsers, segModulosUsuarios, SPHConfiguraciones]
palabras_clave: [soporte a inquilinos, incidente, incidentes, ticket, reporte de falla, queja, mantenimiento, nave, parque, contacto@portal.gruposph.mx, correo de soporte, bandeja de incidentes, responder incidente, firma, firma corporativa, logo en el correo, vincular inquilino, remitente, estado del incidente, nuevo, en proceso, resuelto, detenido, cerrado, sin avance 7 días, asignar, asignación, agente, gerente, ver todos, pipeline, tablero, kanban, seguimientos, árbol de seguimientos, bitácora, nota interna, clasificar, IA, categoría, prioridad, folio en el asunto, mismo incidente, hilo, cadena de correos, INC-]
relacionado_con: [correo, arrendatarios, clientes, soporte-ia]
---

# Módulo: Soporte a Inquilinos (Arrendatarios)

## Qué hace / para qué sirve
Gestión de **incidentes 100% por correo electrónico**. Los inquilinos escriben a
**contacto@portal.gruposph.mx** reportando problemas en su nave arrendada o en el parque; el
personal de **Operaciones de SPH** los lee y **responde desde el ERP** (los inquilinos **no**
entran a la plataforma — todo es por correo). Cada **hilo** de correo se convierte en un
**incidente** con folio, estado y vínculo al inquilino/nave.

> 📌 Sistema tipo ticket **completo** (F1-F4): bandeja + firma, **asignación gerente→agente con
> visibilidad por rol**, **tablero (kanban)**, **árbol de seguimientos** (eventos + notas) y
> **clasificación por IA** (categoría/prioridad).

## 🧵 Agrupado de la cadena por FOLIO en el asunto (importante)
Un incidente = **un hilo**. Para que **toda la cadena** quede en el **mismo incidente** aunque el
cliente de correo del inquilino no "hile" bien la conversación:
- Cada **respuesta saliente** ancla el folio en el asunto: `Re: [INC-00001] <asunto>`.
- Al generar/actualizar incidentes, se busca el incidente destino **(1)** por `conversationId`
  (cabeceras `References`/`In-Reply-To`) y **(2)** por el **folio del asunto** (`[INC-00001]`). Si la
  respuesta del inquilino llega con otro `conversationId` pero conserva el token, **NO** se crea un
  incidente nuevo: se anexa al existente.
- El **hilo del detalle** muestra los correos cuyo `conversationId` coincide **o** cuyo asunto lleva
  el folio. *(Antes de esta corrección, una respuesta mal hilada generaba un folio nuevo.)*
- ⚠️ Incidentes **duplicados creados antes** de esta corrección no se fusionan solos (es saneo de
  datos, requiere autorización).

## Cómo se usa (flujo del operador)
1. **Configurar la cuenta** (pestaña *Cuenta*, clave **34**): se da de alta
   `contacto@portal.gruposph.mx` (IMAP/SMTP Hostinger). Al crearla queda **designada** como la
   cuenta de soporte (`SPHConfiguraciones.SOPORTE_INQUILINOS_CUENTA_ID`).
2. **Bandeja de incidentes** (`/arrendatarios/soporte`, clave **31**): lista de incidentes con
   folio, asunto, inquilino/remitente, nave, estado y última actividad. Filtro por estado +
   búsqueda. Botón **↻ Sincronizar** (trae correos nuevos y genera/actualiza incidentes).
3. **Detalle**: hilo completo del correo (recibidos/enviados), con **imágenes** en miniatura y
   adjuntos descargables. Panel lateral de **vínculo** (inquilino/nave) y selector de **estado**.
4. **Responder** (clave **32**): texto + adjuntos; el backend **anexa la firma corporativa**
   (logo + nombre/cargo/teléfono del usuario + correo de contacto). El enviado queda en el hilo.
   - **Varios adjuntos** (v2.43.0): se acumulan en varias tandas, se listan y se quitan uno a uno
     (hasta **20** archivos, 15 MB c/u; `FilesInterceptor('adjuntos', 20)`).
   - **Destinatarios editables** (v2.43.0): el campo **Para** se precarga con el remitente del último
     correo recibido; se pueden **agregar/eliminar** correos y añadir **CC**. Viajan en el `FormData`
     como JSON (`destinatarios`/`cc`, validados con Zod). `SmtpService.responder` recibe `{ para[], cc[] }`
     (retrocompatible; si `para` va vacío usa el remitente original). El `to`/`cc` reales se guardan en
     `correo_mensajes`.
5. **Clasificar** (clave **33**): **vincular** el incidente a un inquilino y su nave, y **cambiar
   el estado**.

## Creación automática de incidentes
- Tras la sincronización (cron de Correo cada 5 min, que sincroniza **todas** las cuentas activas
  —incluida la de soporte— + botón Sincronizar), un proceso crea **un incidente por cada HILO
  entrante nuevo** (`conversationId`) en estado **Nuevo**. Idempotente (UNIQUE `idCuenta`+`conversationId`).
- Si el **email del remitente** ya está en `incidentes_remitentes` (aprendido), el incidente nace
  **pre-vinculado** al inquilino/nave. Si llega un correo nuevo a un incidente existente, se
  actualiza `ultimaActividad` y, si estaba **Detenido (auto)**, se **reactiva a En Proceso**.

## Vínculo que APRENDE (patrón `arre_ordenante`)
- El vínculo inquilino↔nave es **manual la primera vez**. Al guardarlo, se hace `upsert` en
  **`incidentes_remitentes`** (`email` normalizado → `idArrendador`/`idNavArrend`/`idNave`/`idParque`).
- A partir de ahí, **todo correo futuro de ese mismo remitente** se vincula **solo**. Así no se
  re-clasifica al mismo inquilino una y otra vez.

## Estados (pipeline) y "Detenido" híbrido
`Nuevo → En Proceso → Resuelto → Detenido → Cerrado` (CHECK en BD).
- **Detenido AUTOMÁTICO:** un cron diario (07:15) marca **Detenido** (`detenidoOrigen='auto'`) los
  incidentes activos (Nuevo/En Proceso) **sin actividad > 7 días**. Se **reactiva solo** (a En
  Proceso) cuando llega un correo nuevo o el operador responde.
- **Detenido MANUAL:** el operador puede ponerlo en Detenido (`detenidoOrigen='manual'`). **No** se
  auto-reactiva: permanece hasta que alguien lo cambie.
- Responder un incidente lo avanza: `Nuevo`/`Detenido` → `En Proceso`.

## Firma corporativa (desafío 2)
- Se construye server-side en `firma.builder.ts` (`construirFirmaHtml`): **logo** (de
  `ConfiguracionService.obtenerLogos()`, fondo claro, bucket público `branding`) + **nombre
  completo** + **cargo/rol** + **teléfono** del usuario (de `catUsers`) + **correo de contacto** de
  la cuenta + "Grupo SPH Bienes Raíces".
- `SmtpService.responder(...)` recibió un parámetro **opcional** `firmaHtml`: cuando se pasa, el
  correo sale en **HTML** (cuerpo + firma) y se guarda `bodyHtml` (así el enviado muestra la firma
  en el hilo). **Los demás consumidores (CxP/PPD) NO se afectan** (sin `firmaHtml` = solo texto).

## Arquitectura (reutiliza el módulo Correo)
- **Backend** `apps/api/src/modules/soporte-inquilinos/`:
  - `soporte-inquilinos.service.ts` — incidentes (generar/listar/detalle), responder con firma,
    vincular que aprende, cambiar estado, marcar detenidos, selectores, cuenta designada.
  - `soporte-inquilinos.controller.ts` — `@Controller('arrendatarios/soporte')`, guards JWT+Permiso.
  - `soporte-inquilinos.scheduler.ts` — genera incidentes (cada 5 min) + marca detenidos (diario).
  - `firma.builder.ts` — la firma HTML.
  - Reutiliza de `CorreoModule`: `ImapService`/`CorreoService` (sync, hilo) y `SmtpService`
    (envío) + `CuentasService` (alta/edición/probar/credenciales cifradas).
- **Frontend** `apps/web/src/features/soporte-inquilinos/`: `SoporteInquilinosPage` (tabs),
  `IncidentesTab` (bandeja + detalle + responder + vincular + estado), `CuentaSoporteTab`,
  `soporte-inquilinos.api.ts`. Ruta lazy `/arrendatarios/soporte`; menú bajo Arrendatarios (clave 31).
  El hilo se renderiza con el mismo **`<iframe sandbox>` sin scripts** que el módulo Correo (XSS bloqueado).

## Endpoints (`@Controller('arrendatarios/soporte')`)
- `GET incidentes?estado=&q=` (31, filtrado por visibilidad) · `GET incidentes/:id` (31) ·
  `GET incidentes/:id/seguimientos` (31) · `GET puede-ver-todos` (31) · `POST sincronizar` (31)
- `POST incidentes/:id/responder` (32, multipart adjuntos)
- `POST incidentes/:id/vincular` (33) · `POST incidentes/:id/estado` (33) ·
  `POST incidentes/:id/clasificar` (33, IA) · `POST incidentes/:id/nota` (31)
- `POST incidentes/:id/asignar` (35) · `GET agentes` (35)
- `GET inquilinos` (33) · `GET inquilinos/:idArrendador/naves` (33)
- `GET cuenta` (31) · `GET cuentas-disponibles` (34) · `PUT cuenta/designar` (34) ·
  `POST cuenta` (34) · `PATCH cuenta/:id` (34) · `POST cuenta/probar` (34) · `POST cuenta/:id/probar` (34)

## Asignación + visibilidad por rol (F2)
- **Gerente** (clave **35** o `isSupport`): asigna cada incidente a un **agente** (selector en el
  detalle) y, con clave **36**, **ve todos** los incidentes.
- **Agente** (clave **31** sin **36**): **solo ve los incidentes asignados a él** (filtro server-side
  en `listarIncidentes`/`detalle`, patrón `puedeVerTodos` = `isSupport` o clave 36). Misma idea que
  `PpdService.puedeVerTodas`.
- `agentes()` = candidatos a asignar (usuarios con clave 31 o `isSupport`, activos).

## Tablero / pipeline (F3)
- Pestaña **Tablero** (kanban): columnas por estado (Nuevo/En Proceso/Resuelto/Detenido/Cerrado),
  tarjetas con folio/asunto/inquilino/asignado/categoría/prioridad; al hacer clic se abre el
  **detalle en un modal** (reutiliza `DetalleIncidente`). Respeta la visibilidad por rol.

## Árbol de seguimientos (F3)
- Tabla **`incidentes_seguimientos`**: `tipo='evento'` (lo escribe el sistema: creado, asignado a X,
  estado→Y, respondido, vinculado, reactivado, clasificado por IA, detenido auto) + `tipo='nota'`
  (**nota interna** que escribe el agente; **no** se envía al inquilino). Línea de tiempo en el panel
  del detalle + caja para agregar notas.

## Clasificación por IA (F4)
- Botón **🤖 Clasificar con IA** (clave 33) en el detalle: la IA asigna **categoría** (de una lista
  configurable) y **prioridad** (Alta/Media/Baja) a partir del primer correo del inquilino.
- **Reutiliza la edge `soporte-chat`** (OpenRouter) reenviando el JWT del usuario (mismo patrón que
  el Agente de IA de Soporte / Montse). Parsea JSON `{categoria, prioridad, motivo}` (tolerante a
  ```fences```), valida la categoría contra la lista y guarda en `incidentes.categoria/prioridad`.
- **Config (SPHConfiguraciones, con defaults — no requieren existir):**
  `SOPORTE_INQUILINOS_IA_MODELO` (default `openai/gpt-4o-mini`),
  `SOPORTE_INQUILINOS_IA_CATEGORIAS` (CSV; default: Plomería, Eléctrico, Mantenimiento general,
  Limpieza, Seguridad, Climatización, Estructura/Obra, Administrativo, Otro).
- ⚠️ Requiere **OpenRouter con clave/créditos** en la edge (si no, responde error claro). Hoy es
  **manual** (botón); la clasificación automática al crear el incidente es una mejora futura.

## Permisos (segModulos — sección "Soporte a Inquilinos")
| Clave | Área | Qué habilita |
|---|---|---|
| 31 | Modulo | Ver/usar la bandeja (agente: solo sus asignados) |
| 32 | Responder | Responder correos del incidente |
| 33 | Clasificar | Vincular inquilino/nave + cambiar estado + clasificar con IA |
| 34 | Configuracion | Configurar/designar la cuenta de correo |
| 35 | Asignar | Asignar incidentes a un agente (gerente) |
| 36 | VerTodos | Ver TODOS los incidentes / pipeline completo (gerencia) |
> La clave **30** ya existía (Arrendatarios → Cobro de Agua); por eso se usan 31-36. Notas internas:
> cualquiera con clave 31 sobre un incidente visible.

## Datos / tablas (objetos nuevos de v2, sin prefijo `v2_`)
- **`incidentes`**: `id`, `folio` (auto `INC-00001` vía secuencia), `idCuenta` (FK `correo_cuentas`),
  `conversationId` (hilo, UNIQUE con idCuenta), `asunto`, `idArrendador`/`idNavArrend`/`idNave`/`idParque`
  (vínculo, **sin FK estricta** a v1), `estado` (CHECK), `detenidoOrigen` (`auto`/`manual`/null),
  `asignadoA`/`categoria`/`prioridad` (futuro), `ultimaActividad`, `creadoEn`, `status`, `fc`/`fum`/`fumUser`.
- **`incidentes_remitentes`**: `email` (UNIQUE), `idArrendador`/`idNavArrend`/`idNave`/`idParque`,
  `veces`, `primeraVez`, `ultimaVez`. Mapeo aprendido remitente→inquilino/nave.
- **`incidentes_seguimientos`**: `idIncidente` (FK), `tipo` (`evento`/`nota`), `texto`, `detalle`
  (jsonb opc.), `uid` (autor; null=sistema), `fc`. Árbol de seguimientos.
- Todas: **RLS ON sin políticas** (solo backend service_role) + `trg_auditoria('id')`.
- **`SPHConfiguraciones`**: `SOPORTE_INQUILINOS_CUENTA_ID` (cuenta designada),
  `SOPORTE_INQUILINOS_IA_MODELO` y `SOPORTE_INQUILINOS_IA_CATEGORIAS` (IA, con defaults).
- Columnas de `incidentes` usadas por fases: `asignadoA` (F2), `categoria`/`prioridad` (F4).
- SQL: `migraciones/2026-06-23-soporte-inquilinos.sql` (F1) +
  `migraciones/2026-06-23-soporte-inquilinos-f2-f3.sql` (permisos 35/36 + `incidentes_seguimientos`).

## Gotchas / trampas conocidas
- 📌 **La cuenta debe estar configurada** (pestaña Cuenta) o la bandeja/sincronización no operan
  (mensaje claro "No hay una cuenta de correo de soporte configurada").
- 📌 **El remitente casi nunca coincide con el inquilino** (lo escribe una persona del inquilino);
  por eso el vínculo es manual la 1ª vez y luego se recuerda por email.
- 📌 La generación de incidentes **depende del cron de Correo** (que sincroniza todas las cuentas
  activas): si la cuenta de soporte no está **activa**, no entran correos.
- 📌 La firma usa el **logo de fondo claro**; si no hay logo configurado, la firma sale sin imagen
  (no falla).
- 📌 `EMAIL_ENCRYPTION_KEY` debe estar en el backend para guardar/usar la cuenta (igual que Correo).

## Para el agente de soporte
- "No veo Soporte a Inquilinos" → falta la clave **31** (pídela en Configuraciones → Permisos).
- "No entran los correos / no aparecen incidentes" → revisa que la **cuenta esté configurada y
  activa** (pestaña Cuenta) y pulsa **Sincronizar**.
- "No puedo responder" → falta la clave **32**. "No puedo vincular ni cambiar estado" → falta la **33**.
- "El incidente se puso en Detenido solo" → lleva **>7 días sin avance**; al responder vuelve a En Proceso.
- "Cada vez tengo que decir de qué nave es" → vincúlalo una vez; el sistema **recuerda** el
  remitente y los siguientes correos de ese correo se vinculan solos.
