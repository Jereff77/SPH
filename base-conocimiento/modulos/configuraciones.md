---
modulo: Configuraciones
estado: desarrollado
version_doc: 1.5
ultima_actualizacion: 2026-07-29
submodulos: [Usuarios, Parámetros, Permisos, Sistema, Cambiar contraseña]
rutas: [/configuraciones/usuarios, /configuraciones/parametros, /configuraciones/permisos, /configuraciones/sistema, /configuraciones/cambiar-contrasena, /registro]
claves_permiso: [200, 203, 210, 212, 213, 214, 215, 216, 220, 221]
tablas: [catUsers, crm_responsableComercial, v2_invitaciones, segModulos, segModulosUsuarios, segPlantillasPermisos, segDetallesPlantilla, inpc, PresCategorias, PresDetalle, Presupuestos, v_resumenPresupuesto, cxp_fechas_habilitadas, catClavesProdServ, SPHConfiguraciones]
palabras_clave: [usuarios, invitación, invitar usuario, registro, alta de usuario, correo autorizado, permisos, plantillas, parámetros, INPC, cuentas, presupuesto, fechas CxP, claves SAT, retención, IVA, ISR, CFDI, logos, favicon, dominios, correos autorizados, contraseña, soporte, responsable comercial, matriz de permisos, reporte de permisos, descargar permisos, Excel de permisos, clave de permiso, descripción del permiso, columna descripción, "quién tiene acceso a qué", "qué permisos tiene un usuario", "para qué sirve el permiso", "qué hace este permiso", "qué le estoy dando si lo prendo", "no sé qué permiso darle", "lista de permisos de todos", "no veo el submenú", "no aparece el toggle de soporte", "no puedo eliminar una cuenta", "no me deja crear un INPC", "el logo no respeta el tamaño", "cambié un permiso y no toma efecto", "error 403"]
relacionado_con: [autenticacion, auditoria, parques, cxp, correo]
---

# Módulo: Configuraciones

Agrupa cinco submenús de administración del sistema. Cada submenú tiene su propia clave de permiso.

## 1. Identificación

- **Propósito:** administrar usuarios y sus accesos (RBAC), parámetros del negocio (INPC, cuentas de
  presupuesto, fechas de CxP), la apariencia del sistema (logos, favicon, dominios) y el cambio de
  contraseña.
- **A quién sirve:** administradores y soporte.
- **Sinónimos del usuario:** "ajustes", "configuración", "administración", "accesos", "catálogos".

## 2. Pantallas, rutas y permisos

| Submenú | Ruta | Permiso | Qué hace |
|---|---|---|---|
| Usuarios | `/configuraciones/usuarios` | 200 (ver), 203 (modificar) | Lista de usuarios + toggles + historial. |
| Parámetros | `/configuraciones/parametros` | 210 | INPC, Cuentas (presupuesto), Fechas CxP, **Claves SAT**. |
| Permisos | `/configuraciones/permisos` | 220 | Asignar accesos por usuario + plantillas. |
| Sistema | `/configuraciones/sistema` | 221 | Logos, favicon, dominios y correos autorizados. |
| Cambiar contraseña | `/configuraciones/cambiar-contrasena` | — (cualquiera) | Cambia la propia contraseña. |

Equivalente v1: `lib/pages/web_app/i09_configuraciones/`.

---

## 3. Submenú: Usuarios

- **Datos:** tabla `catUsers` (uid, email, nombre, apellidos, nomCompleto, telefono, idPerfil, rol,
  `isSupport`, `status`, img). El flag de Responsable Comercial vive en `crm_responsableComercial`.
- **Acciones (toggles, optimistas):**
  - `status` (Activo/Inactivo).
  - `esRC` (Responsable comercial) → escribe en `crm_responsableComercial`.
  - `isSupport` (Usuario de soporte) → **solo visible y operable por usuarios de soporte**.
- **Historial:** cada fila tiene un botón de **Historial** (icono reloj) que abre, a la derecha, la
  bitácora de auditoría de ese usuario (lo que ha hecho), en orden descendente. Ver
  `modulos/auditoria-y-ver-como.md`.
- **Permiso:** 200 para ver; 203 para los toggles de status/esRC. El toggle de soporte además exige que
  el actor sea soporte (validado en el backend).
- **Tabla:** encabezado fijo azul + búsqueda + orden por columnas (convención de diseño).

### 3.1. Invitar usuarios (registro por invitación)

Desde la pantalla de Usuarios (clave **200**) se puede **dar de alta usuarios por invitación**, sin que
un administrador cree la contraseña por ellos:

- **Botón «+ Invitar usuario»** → modal donde se captura **correo + nombre + apellidos**. Al enviar:
  - Si ya existe un usuario o una **invitación activa** con ese correo, se rechaza (solo **una invitación
    activa por correo**).
  - Si el **dominio del correo no está autorizado** y el correo no está en `CORREOS_AUTORIZADOS`, el
    sistema lo **agrega automáticamente** a los correos autorizados (para que luego pueda iniciar sesión).
  - Se crea la invitación (token aleatorio; en BD solo se guarda su **hash SHA-256**) y se envía un correo
    con el enlace `…/registro?token=XXX` desde una **cuenta SMTP dedicada** (`SMTP_INVITACIONES_*`,
    independiente del buzón de facturas). Vigencia configurable (`INVITACION_VIGENCIA_DIAS`, por defecto 7).
- **Botón «Invitaciones»** → panel lateral con todas las invitaciones (Pendiente / Aceptada / Cancelada /
  Expirada). En las pendientes: **Reenviar** (genera un enlace nuevo) y **Cancelar**.
  - Al **cancelar**, si ese flujo había agregado el correo a `CORREOS_AUTORIZADOS`, se **revierte** (se
    quita el correo). Igual al reemplazar una invitación pendiente expirada por una nueva.
- **Registro (página pública `/registro`):** el invitado abre el enlace; el backend valida el token y
  precarga correo (fijo) + nombre/apellidos. El invitado confirma sus datos, captura teléfono (opcional)
  y **define su contraseña** (mín. 8 caracteres). El backend crea el usuario en **Supabase Auth**
  (`email_confirm`) + `catUsers` (perfil base `idPerfil=5` «Ventas»; **sin permisos** aún — se asignan en
  Permisos) y marca la invitación **aceptada**. Tras esto el usuario entra por el login normal.
- **Seguridad:** token de un solo uso con expiración; el correo del registro se toma SIEMPRE de la
  invitación (no del cliente); endpoints públicos con rate limiting; el front nunca toca Supabase.
- **Backend:** `apps/api/src/modules/invitaciones/` (`service`, `controller`, `schemas`, `mailer`).
  Endpoints: `POST/GET /api/invitaciones`, `POST /api/invitaciones/:id/reenviar`,
  `DELETE /api/invitaciones/:id` (todos clave 200) y los **públicos** `GET /api/invitaciones/validar/:token`
  + `POST /api/invitaciones/aceptar`.
- **Front:** `features/usuarios/InvitarUsuarioModal.tsx`, `InvitacionesPanel.tsx`, `invitaciones.api.ts`;
  página pública `features/registro/RegistroPage.tsx` (ruta `/registro` fuera de `ProtectedRoute`).
- **BD (objeto nuevo, autorizado):** tabla `public.v2_invitaciones` (RLS ON sin políticas + `trg_auditoria`).
  SQL en `base-conocimiento/migraciones/2026-06-12-invitaciones.sql`.
- **Botón «Copiar link» (v2.57.0):** en el panel de Invitaciones, junto a Reenviar/Cancelar. Genera un
  token nuevo (igual que Reenviar) pero **sin enviar correo** — solo copia el enlace al portapapeles,
  para compartirlo manualmente (WhatsApp, etc.) cuando el correo no llega. Invalida cualquier enlace
  previo (mismo token único por invitación). Endpoint `POST /invitaciones/:id/link` (clave 200).
- **Ver también:** `../CORREOS.md` — mapa de **todas** las cuentas de correo del sistema (esta pantalla
  usa la cuenta dedicada de invitaciones, que también reutilizan CxP y Arrendatarios/Incrementos INPC).

---

## 4. Submenú: Parámetros (5 pestañas)

> **Permiso de visualización por pestaña.** Para entrar al módulo se necesita la clave **210**, y
> **cada pestaña tiene su propia clave**: INPC **212**, Cuentas **213**, Fechas CxP **214**, Claves SAT
> **215**, Pizarra de Avisos **216**. El usuario **solo ve las pestañas cuyas claves tiene asignadas**; el
> backend valida la clave de cada pestaña por endpoint (`@RequierePermiso`). Los usuarios de soporte
> (`isSupport`) ven todas. (Claves 215/216 se crearon en `segModulos` para v2 — migración
> `migraciones/2026-06-10-parametros-claves-visualizacion.sql`.)

### 4.1 INPC
- **Tabla `inpc`:** `id` ("AAAA/MM", lo arma un trigger), `consecutivo` (trigger), `anio`, `mes`,
  `inpc` (valor), `nota`, `fum`.
- **Acciones:** crear (año/mes/valor/nota), editar (valor/nota; el periodo no cambia), eliminar.
- **Validación:** no se permiten dos INPC para el mismo año/mes (error de unicidad).

### 4.2 Cuentas (presupuesto)
- **Modelo:** `PresCategorias` (cuenta; PK `idCategoria` manual; `responsable` = uid de `catUsers`;
  flags `presupuestable`, `status`) → `PresDetalle` (12 montos mensuales por año; `claveUnica` es
  **GENERADA**, no se inserta) → `Presupuestos` (presupuesto anual; 2026 activo). La vista
  `v_resumenPresupuesto` da el **consumido** (subtotal gastado).
- **Lectura:** usa la RPC de negocio `prescategorias_obtener_con_presupuesto` (cuentas + presupuesto
  anual + responsable) + `v_resumenPresupuesto` para el consumido.
- **Acciones:** crear cuenta, cambiar responsable, toggles (`presupuestable`, `status`), **ajustar el
  presupuesto mensual** (modal de 12 meses; siempre muestra los 12, default 0; un PUT hace upsert),
  eliminar cuenta.
- **Regla de eliminación:** una cuenta solo se elimina si **no se usó en ningún pago** (conteo en `cxp`
  por `idCategoria` = 0); si pasa, se borra primero `PresDetalle` y luego `PresCategorias` (la FK es
  RESTRICT).

### 4.3 Fechas CxP
- **Tabla `cxp_fechas_habilitadas`:** PK `fecha`; flags `cfdi` y `autorizar`; `dia_semana`/`mes_anio`
  los pone un trigger.
- **Acciones:** filtrar por periodo (mes-año), toggles CFDI/Autorizar, alta y baja de fechas.
- **Orden del selector de periodo (gotcha):** el backend (`listarPeriodos`) devuelve los periodos
  `MM-YYYY` **sin orden de fecha**. El front (`FechasCxpTab.tsx`) los **reordena como fechas reales**
  (peso `año*100 + mes`), de más reciente a más antiguo, antes de pintar el `<select>`; por eso el
  primer periodo (más reciente) es el que queda seleccionado por defecto.

### 4.4 Claves SAT  (catálogo de retenciones para CxP)
- **Tabla `catClavesProdServ`** (PK `idClave` uuid): `claveProdServ` (clave Producto/Servicio del SAT,
  única), `descripcion`, `retieneIVA` (bool), `retieneISR` (bool), `status`, `fc`, `uidr`. RLS habilitado
  (solo service_role) + trigger de auditoría.
- **Para qué sirve:** al dar de alta una **Solicitud de Pago (CFDI)** en CxP, el sistema valida las
  retenciones por cada partida del XML según su clave Producto/Servicio. Aplica a los regímenes **612,
  626 y 606**. Si una clave del CFDI **no está registrada aquí**, la factura se rechaza pidiendo
  registrarla. Ver `cxp.md` para el detalle fiscal (tasas Ret. IVA 10.6667% / Ret. ISR por régimen).
- **Acciones:** listar (tabla con encabezado fijo + filtros + orden), crear, editar, activar/desactivar
  (toggles inline de Retiene IVA / Retiene ISR / Activa). Escrituras auditadas.

### 4.5 Pizarra de Avisos
- Placeholder, **no desarrollada** (sin backend). Su clave de visualización es **216**.

---

## 5. Submenú: Permisos (RBAC)

- **Modelo:** `segModulos` (catálogo de **80 permisos** al 2026-07-29; cada uno tiene una **clave** única:
  módulo → sección → área → clave), `segModulosUsuarios` (acceso por usuario×permiso),
  `segPlantillasPermisos` + `segDetallesPlantilla` (plantillas reutilizables).
- **Funciones de negocio reutilizadas (RPCs):** `segmodulosusuarios_smu` (obtener permisos de un
  usuario), `seg_aplicar_plantilla_a_usuario`, `seg_crear_plantilla_desde_usuario`.
- **Acciones:** elegir usuario → ver/editar sus permisos con toggles (optimistas), filtrar por módulo,
  buscar; **aplicar una plantilla** a un usuario (con opción de reemplazar todo) y **crear una plantilla**
  a partir de los permisos de un usuario.
- **Columnas de la tabla:** Módulo · Sección · Área/Acción · Clave · **Descripción** (§5.2) · Acceso.
  Todas ordenables (clic en el encabezado) y con anchos fijos (150/150/150/100/250/90 px).
- **Cómo se aplican los permisos en el sistema:** la autorización es **server-side**. El backend valida
  la clave requerida (`@RequierePermiso`) contra `segModulosUsuarios` con el uid del JWT. Los usuarios
  de soporte (`isSupport`) tienen acceso total. El menú lateral oculta lo que el usuario no tiene.

### 5.1. Reporte descargable: matriz de usuarios × permisos (v2.58.0)

Botón **«📊 Descargar matriz (Excel)»** arriba a la derecha de la pantalla. Baja **de una sola vez
quién tiene acceso a qué**, en vez de revisar usuario por usuario con el selector.

- **Endpoint:** `GET /permisos/matriz` (`PermisosService.matriz()`). **Solo lectura**; hereda la clave
  **220** del controlador, así que solo quien ya administra permisos puede descargarlo. No amplía la
  superficie de datos: con la 220 ya se podían ver los permisos de cualquier usuario uno por uno.
  ⚠️ La ruta se declara **antes** de `@Get(':uid')` — si no, Nest la captura como si `matriz` fuera un uid.
- **Generación:** en el navegador con **ExcelJS por carga diferida**
  (`features/permisos/permisos-export.ts`), mismo patrón que Contabilidad y Kardex — no engorda el
  bundle inicial.
- **Contenido (4 hojas):** **Matriz** (usuarios en filas × permisos en columnas, encabezadas por su
  clave y agrupadas por módulo; `✔` = concedido), **Catálogo de permisos** (con la columna
  «¿Para qué sirve?» y cuántos usuarios activos tiene cada clave), **Detalle** (lista plana para
  tablas dinámicas) y **Resumen** (cifras de control).
- **Incluye usuarios inactivos** (en gris) a propósito: sirve para auditar a quién se le retiró el acceso.
- **⭐ Usuarios de soporte:** salen con `★` y acceso total, NO con sus marcas individuales — `isSupport`
  hace **bypass** del RBAC, así que pintar solo sus toggles haría mentir al reporte sobre su alcance real.
- **Descripciones de cada permiso:** viven en el código, en `features/permisos/permisos-descripciones.ts`
  (`segModulos` no tiene columna para ellas). Redactadas contra los endpoints que exigen cada clave.
  Son las mismas que pinta la columna «Descripción» de la pantalla (§5.2).
  📌 **Al dar de alta una clave nueva en `segModulos`, agrégala ahí** o el reporte la muestra sin
  descripción (no truena). Si se quiere que el área las edite sin desplegar, habría que agregar la
  columna `descripcion` a `segModulos` (cambio de esquema — requiere autorización).

### 5.2. Columna «Descripción»: para qué sirve cada permiso (v2.59.0)

La tabla de la pantalla muestra, junto a cada permiso, **qué puede hacer el usuario si se lo activas**,
en lenguaje de negocio. Antes ese dato solo existía dentro del Excel de la matriz (§5.1): quien asignaba
accesos tenía que deducirlo del nombre del catálogo (`Planes de Renta / Configuracion`), que dice **dónde**
está el permiso pero no **qué habilita**.

- **Fuente del texto:** la misma constante del front, `features/permisos/permisos-descripciones.ts`
  (`descripcionPermiso(clave)`) — **no** se le pide nada nuevo al backend ni a la BD. Al 2026-07-29 cubre
  las **80 claves** de `segModulos` (verificado 1:1 contra la tabla).
- **Búsqueda por descripción:** el buscador de la pantalla también mira ese texto, así que escribir
  «renta» o «aprobar» encuentra los permisos relacionados aunque el catálogo los nombre de otro modo.
- **Claves sin descripción:** la celda muestra «—». No rompe nada; solo indica que la clave es nueva y
  falta agregarla al archivo.
- **Sin impacto en el acceso:** es texto informativo. Quien decide es el toggle, no la descripción.

### Mapa de claves conocidas
| Clave | Módulo / acción |
|---|---|
| 200 | Configuraciones → Usuarios (módulo). 203 = modificar. |
| 210 | Configuraciones → Parámetros (módulo). Pestañas: 212 INPC · 213 Cuentas · 214 Fechas CxP · 215 Claves SAT · 216 Pizarra de Avisos — **aplicadas** (visualización por pestaña, front+back). |
| 220 | Configuraciones → Permisos. |
| 221 | Configuraciones → Sistema (Branding y Dominios). |
| 700 / 701 / 702 / 710 | Parques (ver `modulos/parques.md`). |

---

## 6. Submenú: Sistema (apariencia + accesos de login)

- **Datos:** tabla `SPHConfiguraciones` (parámetros del sistema) + bucket de Storage `branding`.
- **Configura:**
  - **Logotipos** claro (login/contenido) y oscuro (sidebar), cada uno con archivo + ancho/alto
    (parámetros `LOGO_FONDO_CLARO`/`LOGO_FONDO_OSCURO`).
  - **Favicon** (`FAVICON_URL`).
  - **Dominios autorizados** y **correos específicos autorizados**: definen qué correos pueden iniciar
    sesión (ver `modulos/autenticacion.md`).
- **Público vs. protegido:** `GET /configuracion/logos` es **público** (lo usan login/landing sin
  sesión); el resto requiere permiso **221**.
- **Objeto nuevo de v2:** bucket `branding` (público) y la función `v2_obtener_logo_url` (no se tocó la
  configuración vieja).

---

## 7. Submenú: Cambiar contraseña

- Disponible para **cualquier usuario** autenticado (sin clave de permiso).
- Pide la contraseña **actual** (se verifica) y la nueva (≥ 8 caracteres). Mejora de seguridad sobre v1
  (que solo pedía la nueva).

---

## 8. ⚠️ Detalles no obvios (gotchas)

1. El toggle **esSoporte** solo lo ve y opera un usuario de soporte (doble validación: UI + backend).
2. En Cuentas, `PresDetalle.claveUnica` es **generada** (`idCategoria-anio-MM`): nunca se inserta a mano.
3. Eliminar una cuenta es **condicional** (sin pagos asociados) y borra primero el detalle mensual.
4. Las **claves finas** de Parámetros (212 INPC / 213 Cuentas / 214 Fechas CxP / 215 Claves SAT / 216
   Pizarra) están **aplicadas**: cada pestaña valida su clave en front (oculta la pestaña) y en backend
   (`@RequierePermiso` por endpoint). Requiere que los usuarios tengan asignadas esas claves en Permisos
   (los `isSupport` las ven por bypass).
5. La autorización real es **del servidor**, no del menú; ocultar un ítem no es la barrera de seguridad.

## 9. Relaciones con otros módulos

- **Autenticación:** dominios/correos de Sistema definen el login; el cambio de contraseña vive aquí.
- **Auditoría:** el historial por usuario (Usuarios) lee la bitácora `auditoria`.
- **Permisos ↔ todos los módulos:** las claves de `segModulos` gobiernan el acceso a cada pantalla/acción.
- **Parámetros ↔ CxP / Arrendamientos:** INPC y cuentas/presupuesto alimentan pagos y rentas.

## 10. Para el agente de soporte (diagnóstico / problemas comunes)

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| "No veo el submenú X." | El usuario no tiene la clave de permiso de ese submenú. | Revisar Permisos del usuario. |
| "No aparece el toggle de soporte." | Solo lo ven los usuarios de soporte. | Es por diseño. |
| "No puedo eliminar una cuenta." | La cuenta ya se usó en pagos (`cxp`). | Es por diseño; no se elimina si tiene movimientos. |
| "No me deja crear un INPC." | Ya existe uno para ese año/mes. | Editar el existente en vez de crear. |
| "El logo no respeta el tamaño." | Dimensiones mal configuradas (Sistema). | Ajustar ancho/alto en Sistema. |
| "Cambié un permiso y no toma efecto." | El usuario tiene sesión con permisos cacheados. | Que vuelva a entrar / refresque; verificar en backend. |
| Error 403 en una acción de configuración. | Falta la clave (200/203/210/220/221). | Escalar a soporte si debería tenerla. |
| "¿Quién tiene acceso a qué?" / "necesito la lista de permisos de todos." | No hay que revisar usuario por usuario. | Configuraciones → Permisos → botón **«📊 Descargar matriz (Excel)»** (requiere clave 220). Trae los usuarios contra los permisos, con la descripción de cada clave. |
| "En el reporte un usuario aparece con TODOS los permisos (★)." | Es un usuario de **soporte** (`catUsers.isSupport = true`): hace bypass del RBAC. | Es por diseño; sus toggles individuales no limitan nada. |
| "¿Qué le estoy dando si prendo este permiso?" / "no sé cuál permiso darle." | No hay que adivinar por el nombre del catálogo. | Configuraciones → Permisos: la columna **«Descripción»** dice para qué sirve cada permiso (§5.2). El buscador también busca dentro de ese texto. |
| "Un permiso sale sin descripción (o con «—»)." | La clave es nueva en `segModulos` y no está en `permisos-descripciones.ts`. | Agregarla ahí (cambio de front). No afecta el acceso, solo el texto informativo — ni en la pantalla ni en el reporte. |
| "El reporte no trae a un usuario que sí existe." | Verificar que no se haya topado el tope de filas de la lectura (`.range()` en `PermisosService.matriz()`). | Hoy holgado (54 usuarios contra un tope de 10 000); si el padrón creciera muchísimo, subir el rango. |

**Cuándo escalar a ticket:** inconsistencias de permisos (un usuario que debería poder y no puede),
errores al guardar parámetros que persisten, o datos de presupuesto que no cuadran con CxP.

## 11. Estado y pendientes

> 📋 **Los pendientes de este módulo viven en el TABLERO** (Configuraciones ▸ Pendientes, tabla
> `dev_pendientes`) desde el 2026-09-02 — regla 11 de `contexto.md` §1. Lo de abajo es **histórico**:
> su estado puede estar vencido y **no se abren pendientes nuevos aquí**. Lo que sí sigue vivo en esta
> sección es el **✅ hecho** (qué hace el módulo hoy), que es conocimiento, no trabajo pendiente.

- ✅ Los 5 submenús funcionando, con tablas (encabezado fijo azul + filtros + orden) e historial por usuario.
- ✅ **Reporte descargable de la matriz de permisos** (v2.58.0, §5.1): `GET /permisos/matriz` + Excel de
  4 hojas generado en el navegador, con la descripción de para qué sirve cada clave.
- ✅ **Columna «Descripción» en la tabla de Permisos** (v2.59.0, §5.2): el texto que ya alimentaba el
  Excel ahora se ve en pantalla, y el buscador lo incluye. Solo presentación (sin backend ni BD).
  Pendiente opcional (mismo de v2.58.0): mover esas descripciones a `segModulos.descripcion` (cambio de
  esquema, **por acordar con Jereff**) para que el área las edite sin desplegar y valide su redacción.
- ✅ Claves finas de Parámetros (212/213/214/215/216) **aplicadas** (visualización por pestaña, front+back).
  Pendiente operativo: asignar esas claves a los usuarios que correspondan en Permisos.
