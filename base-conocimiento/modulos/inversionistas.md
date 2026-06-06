---
modulo: Inversionistas / Propietarios (Ventas)
estado: parcial              # Etapa 1 (Dashboard + Planes) en v2; Reportes/Escrituras pendientes
version_doc: 1.0
ultima_actualizacion: 2026-06-06
submodulos: [Dashboard, Planes, Configuración]
rutas: [/ventas, /ventas/planes]
claves_permiso: [600, 610]
tablas: [inversionista, inversionista_docs, propiedades, naves, pdp, pdpDetalle, pagos, rgPdp, rgPdpDetalle, raPdp, raPdpDetalle, v_pagos, v_rentasCombinadas, v_montoTotalAnual, v_pagosTotalAnual, v_Totales_Anual_Mes]
palabras_clave: [inversionista, propietario, dueño, propiedad, nave, venta, plan de pagos, PDP, parcialidad, cobranza, pago, terreno, construcción, ticket, descuento, renta garantizada, renta administrada, configuración, documentos, escrituración, dashboard]
relacionado_con: [parques, arrendatarios, cxp, fideicomiso]
---

# Módulo: Inversionistas / Propietarios (Ventas)

## 1. Identificación
- **Propósito:** gestionar la **cobranza** de los inversionistas/propietarios (planes de pago de compra
  de naves) y administrar sus datos, documentos, propiedades y planes.
- **Rutas / permisos:** **Dashboard** `/ventas` (**600**) · **Planes** `/ventas/planes` (**610**).
- **Etapa actual (v2):** Dashboard + Planes. **Reportes** (620) y **Escrituras** (630) siguen en v1.

## 2. Dashboard (`/ventas`, clave 600)
Vista de cobranza por **Año/Mes** + chips **Activo/Inactivo**. Reemplaza `InicioWidget` de v1.
- **3 tarjetas de resumen:** "Planes de pago {año}" (objetivo `v_montoTotalAnual` / cobranza
  `v_pagosTotalAnual` / balance), "{mes} {año}" (objetivo, terreno, construcción, ticket de
  `v_Totales_Anual_Mes`) y "Cobranza real del mes" (cobranza, descuentos, balance).
- **Pestaña "Planes de pago":** tabla de la vista **`v_pagos`** (parcialidades del periodo). Fila **roja**
  (`#FFC2C2`) si está vencida y sin cobrar; **amarilla** (`#FFFEC4`) si es Ticket. Columnas T (terreno) y
  C (construcción) muestran lo pagado por concepto; Balance = monto − pagos.
- **Pestaña "Renta Garantizada & Administrada":** tabla de **`v_rentasCombinadas`** con filtro
  Todos/Garantizada/Administrada (`tipo_renta`).
- **Botón $ por fila →** modal **Detalle de pagos**: lista los pagos (`pagos` por `idPdpDet`) y permite
  **agregar un pago**: tipo de movimiento (1=Terreno, 2=Construcción, 3=Ticket), operación (1=Pago,
  2=Descuento), monto, IVA (Ticket), fecha y **comprobante PDF**. El recálculo de `pdp.montoPagado` lo hace
  el trigger `pagos_actualizar_montopagado_pdp`.
- **Tiempo real (SSE):** el Dashboard se suscribe a `/ventas/dashboard/stream` (cambios en `pagos`, incluso
  los hechos desde v1) y refresca en vivo.

## 3. Planes (`/ventas/planes`, clave 610)
Selector **inversionista** + **propiedad/nave** + botón **⚙ Configuración**. 3 pestañas de **lectura**:
- **Plan de Pagos:** parcialidades de la propiedad (`v_pagos` filtrado).
- **Renta Garantizada:** `rgPdpDetalle` del `rgPdp` de la propiedad (solo lectura).
- **Renta Administrada:** `raPdpDetalle` del `raPdp` de la propiedad (solo lectura).

### Configuración (⚙) — 4 sub-pestañas
1. **Datos Generales** → edita `inversionista` (nombre, apellidos, RFC, CURP, razón social, contacto…).
2. **Documentos** → `inversionista_docs` + bucket **`Documentos`** (subir/ver/eliminar).
3. **Propiedades** → lista las propiedades del inversionista y **vincula naves** disponibles creando
   `propiedades` (combo de `naves`).
4. **Plan de Pagos** → **crear** un PDP: `montoTotal = terreno + obra·1.16`; N parcialidades **mensuales
   iguales** (`round(montoTotal/N, 2)`, misma cuota en todas — como v1 `redondearMonto`/`siguienteMes`).
   Inserta `pdp` + N `pdpDetalle` y marca la propiedad `tienenPdp=true`.

> En esta etapa **solo se crea el Plan de Pagos**. La creación de Renta Garantizada (RPCs
> `rgpdp_insertar_registro`/`rgpdp_generar_plan_pagos`) y Administrada (`rapdp_actualizar`) se hará después.

## 4. Modelo de datos (todo EXISTENTE; sin DDL nuevo)
- **Catálogo/propietario:** `inversionista` (PK `idInversionista`), `inversionista_docs`, `propiedades`
  (vínculo nave↔inversionista), `naves`.
- **Plan de pagos:** `pdp` (PK `idPdp`), `pdpDetalle` (PK `idPdpDet`, parcialidades), `pagos` (PK `idPago`,
  cobros con `tipomovimiento`/`tipoOperacion`/`comprobante`).
- **Rentas (lectura):** `rgPdp`/`rgPdpDetalle`, `raPdp`/`raPdpDetalle`.
- **Vistas:** `v_pagos`, `v_rentasCombinadas`, `v_montoTotalAnual`, `v_pagosTotalAnual`,
  `v_Totales_Anual_Mes`. (⚠️ Existen copias en minúsculas — `v_rentascombinadas`, etc. — de v1; v2 usa las
  camelCase.)

## 5. Endpoints (backend, `@Controller('ventas')`)
- **Dashboard (600):** `GET dashboard/filtros|tabla|tarjetas|rentas`, `GET dashboard/pagos/:idPdpDet`
  (detalle), `POST dashboard/pagos/:idPdpDet` (multipart, comprobante), SSE `dashboard/stream`.
- **Planes (610):** `GET planes/inversionistas|propiedades|plan/:idPropiedad|renta-garantizada/:idPropiedad|
  renta-administrada/:idPropiedad`. Config: `GET/PATCH planes/inversionista/:id`, `GET/POST/DELETE
  planes/docs`, `GET planes/naves-disponibles`, `POST planes/propiedades`, `POST planes/plan-pagos`.

## 6. Seguridad
- `JwtAuthGuard + PermisoGuard`; Dashboard con **600**, Planes/Config con **610**. SSE con `SseAuthGuard`
  (token en query) + permiso 600.
- Todas las escrituras (pago, crear plan, editar inversionista/propiedad, docs) vía `comoActor(uid)` para
  auditoría server-side; bloqueadas en modo "Ver como" (no-soporte). El frontend nunca habla con Supabase.

## 7. Relación con otros módulos
- **Parques:** el "dueño" de una nave proviene de aquí (`propiedades`↔`naves`); vincular nave a un
  propietario se hace en **Ventas → Planes → Configuración → Propiedades**.
- **Arrendatarios:** el mismo registro `inversionista` funge como arrendador (`idArrendador = idInversionista`).

## 8. Pendiente / fuera del MVP
- **Reportes** (620) y **Escrituras** (630). Creación de **Renta Garantizada** y **Renta Administrada**.
  Edición/cancelación de planes existentes. Activar/desactivar PDP (`pdpactivo`).
