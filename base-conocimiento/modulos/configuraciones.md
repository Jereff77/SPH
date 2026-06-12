---
modulo: Configuraciones
estado: desarrollado
version_doc: 1.1
ultima_actualizacion: 2026-06-05
submodulos: [Usuarios, Parámetros, Permisos, Sistema, Cambiar contraseña]
rutas: [/configuraciones/usuarios, /configuraciones/parametros, /configuraciones/permisos, /configuraciones/sistema, /configuraciones/cambiar-contrasena]
claves_permiso: [200, 203, 210, 212, 213, 214, 215, 216, 220, 221]
tablas: [catUsers, crm_responsableComercial, segModulos, segModulosUsuarios, segPlantillasPermisos, segDetallesPlantilla, inpc, PresCategorias, PresDetalle, Presupuestos, v_resumenPresupuesto, cxp_fechas_habilitadas, catClavesProdServ, SPHConfiguraciones]
palabras_clave: [usuarios, permisos, plantillas, parámetros, INPC, cuentas, presupuesto, fechas CxP, claves SAT, retención, IVA, ISR, CFDI, logos, favicon, dominios, correos autorizados, contraseña, soporte, responsable comercial]
relacionado_con: [autenticacion, auditoria, parques, cxp]
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

- **Modelo:** `segModulos` (catálogo de ~62 permisos; cada uno tiene una **clave** única:
  módulo → sección → área → clave), `segModulosUsuarios` (acceso por usuario×permiso),
  `segPlantillasPermisos` + `segDetallesPlantilla` (plantillas reutilizables).
- **Funciones de negocio reutilizadas (RPCs):** `segmodulosusuarios_smu` (obtener permisos de un
  usuario), `seg_aplicar_plantilla_a_usuario`, `seg_crear_plantilla_desde_usuario`.
- **Acciones:** elegir usuario → ver/editar sus permisos con toggles (optimistas), filtrar por módulo,
  buscar; **aplicar una plantilla** a un usuario (con opción de reemplazar todo) y **crear una plantilla**
  a partir de los permisos de un usuario.
- **Cómo se aplican los permisos en el sistema:** la autorización es **server-side**. El backend valida
  la clave requerida (`@RequierePermiso`) contra `segModulosUsuarios` con el uid del JWT. Los usuarios
  de soporte (`isSupport`) tienen acceso total. El menú lateral oculta lo que el usuario no tiene.

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

## 10. 🩺 Diagnóstico / problemas comunes

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| "No veo el submenú X." | El usuario no tiene la clave de permiso de ese submenú. | Revisar Permisos del usuario. |
| "No aparece el toggle de soporte." | Solo lo ven los usuarios de soporte. | Es por diseño. |
| "No puedo eliminar una cuenta." | La cuenta ya se usó en pagos (`cxp`). | Es por diseño; no se elimina si tiene movimientos. |
| "No me deja crear un INPC." | Ya existe uno para ese año/mes. | Editar el existente en vez de crear. |
| "El logo no respeta el tamaño." | Dimensiones mal configuradas (Sistema). | Ajustar ancho/alto en Sistema. |
| "Cambié un permiso y no toma efecto." | El usuario tiene sesión con permisos cacheados. | Que vuelva a entrar / refresque; verificar en backend. |
| Error 403 en una acción de configuración. | Falta la clave (200/203/210/220/221). | Escalar a soporte si debería tenerla. |

**Cuándo escalar a ticket:** inconsistencias de permisos (un usuario que debería poder y no puede),
errores al guardar parámetros que persisten, o datos de presupuesto que no cuadran con CxP.

## 11. Estado y pendientes

- ✅ Los 5 submenús funcionando, con tablas (encabezado fijo azul + filtros + orden) e historial por usuario.
- ✅ Claves finas de Parámetros (212/213/214/215/216) **aplicadas** (visualización por pestaña, front+back).
  Pendiente operativo: asignar esas claves a los usuarios que correspondan en Permisos.
