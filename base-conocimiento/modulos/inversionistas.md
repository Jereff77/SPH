---
modulo: Inversionistas / Propietarios (Ventas)
estado: parcial              # Etapa 1 (Dashboard + Planes) en v2; Reportes/Escrituras pendientes
version_doc: 2.0
ultima_actualizacion: 2026-06-07
submodulos: [Dashboard, Planes, Configuración]
rutas: [/ventas, /ventas/planes]
claves_permiso: [600, 610]
tablas: [inversionista, inversionista_docs, propiedades, naves, kvasAsignados, pdp, pdpDetalle, pagos, rgPdp, rgPdpDetalle, raPdp, raPdpDetalle, comentarios, actividad, parques, v_rentasCombinadas]
palabras_clave: [inversionista, propietario, dueño, propiedad, nave, parque, vincular nave, nave disponible, nave vendida, situación, KVAs, KVAs Alta, KVAs Media, tipoTension, venta, plan de pagos, PDP, parcialidad, cobranza, cobranza real, pago, eliminar pago, terreno, construcción, ticket, descuento, saldo a favor, avance, renta garantizada, renta administrada, configuración, documentos, escrituración, dashboard, comentarios, razón social]
relacionado_con: [parques, arrendatarios, cxp, clientes, fideicomiso]
---

# Módulo: Inversionistas / Propietarios (Ventas)

## 1. Identificación
- **Propósito:** gestionar la **cobranza** de los inversionistas/propietarios (planes de pago de compra
  de naves) y administrar sus datos, documentos, propiedades y planes.
- **Rutas / permisos:** **Dashboard** `/ventas` (**600**) · **Planes** `/ventas/planes` (**610**).
- **Etapa actual (v2):** Dashboard + Planes. **Reportes** (620) y **Escrituras** (630) siguen en v1.

> ⚠️ **Universo de cálculo (Dashboard y Planes, consistente):** parcialidades de propiedades con
> `propiedades.pdpActivo = <filtro>`, **`propiedades.esTicket = false`** (el **parque de Tickets** —p. ej.
> "A3 (Tickets)"— NO es venta y se excluye de TODO el módulo) y cuyo inversionista está marcado como
> **`inversionista = true`** y **`pruebas = false`**. **NO** se usa `tipoCliente`. La bandera vigente de
> "activo" es la de **`propiedades.pdpActivo`** (la de `pdp.pdpactivo` no se mantiene).
>
> Nota: `parques.esTicket` y `propiedades.esTicket` están **correlacionados 1:1** en los datos; se filtra por
> `propiedades.esTicket` (directo, sin join). Excluir tickets aplica a: Dashboard (tabla + 3 tarjetas/totales),
> selector de inversionistas y propiedades de Planes, y tarjetas de Config→Propiedades.

## 2. Dashboard (`/ventas`, clave 600)
Vista de cobranza por **Año/Mes** + chips **Activo/Inactivo**. Reemplaza `InicioWidget` de v1.
**Sin vistas SQL**: todos los cálculos (tabla y tarjetas) se hacen en el backend desde las tablas base
(`pdpDetalle`, `pagos`, `pdp`, `propiedades`, `inversionista`, `parques`), con el mismo universo → **el
total de la tabla y las tarjetas siempre cuadran**.

- **3 tarjetas de resumen** (todas con **Objetivo / Cobranza / Balance**, `balance = cobranza − objetivo`):
  - **"Planes de pago {año}"** — todo el año: objetivo = Σ parcialidades del año; cobranza = Σ pagos de esas.
  - **"Planes de pago {mes} {año}"** — solo el mes, por **mes de vencimiento** de la parcialidad. Un pago
    hecho para otro mes NO cuenta aquí.
  - **"Cobranza real {mes} {año}"** — mismo objetivo del mes, pero la cobranza son los pagos **realizados
    durante el mes** (por `pagos.fecha`), incluyendo **atrasados y adelantados**.
  - Las tarjetas **siguen el filtro Activo/Inactivo** (por eso siempre cuadran con la tabla).
- **Pestaña "Planes de pago":** tabla de parcialidades del periodo. Fila **roja** (`#FFC2C2`) si está
  vencida y sin cobrar (comparada contra "hoy" en **horario de México**). (La fila **amarilla** `#FFFEC4`
  "si es Ticket" quedó **sin efecto** al excluir el parque de Tickets del módulo; la regla de pago tipo
  Ticket `tipomovimiento=3` sigue existiendo para otros movimientos, pero ya no hay propiedades-ticket en
  el universo.) Columna **C/T apilada** (C: construcción / T: terreno). **Fila de totales** al pie (sticky):
  Monto · C/T/F (construcción/terreno/ticket) · Pagado · A/D (aplicado/descuentos) · Balance. **Un solo
  scroll** (encabezado sticky bajo la barra; sin scroll interno).
- **Pestañas "Renta Garantizada" y "Renta Administrada":** son **2 pestañas separadas** (no un combo);
  cada una filtra `v_rentasCombinadas` por su `tipo_renta`. (Estas dos **sí** usan todavía la vista
  `v_rentasCombinadas`.)
- **Botón $ por fila →** modal **Detalle de pagos**: lista los pagos (`pagos` por `idPdpDet`) y permite
  **agregar un pago** (tipo de movimiento 1=Terreno/2=Construcción/3=Ticket, operación 1=Pago/2=Descuento,
  monto, IVA en Ticket, fecha y **comprobante PDF**) y **eliminar un pago** (🗑). El recálculo de
  `pdp.montoPagado` lo hacen los triggers de `pagos` (en INSERT y DELETE).
- **Bitácora:** alta y eliminación de pagos registran en **`actividad`** y **`comentarios`** (como v1).
- **Fechas en horario de México (GMT-6):** la fecha por defecto al capturar usa `America/Mexico_City`
  (helper `hoyMexico()`), evitando el desfase de UTC.
- **Tiempo real (SSE):** el Dashboard se suscribe a `/ventas/dashboard/stream` (cambios en `pagos`, incluso
  los hechos desde v1) y refresca en vivo.

## 3. Planes (`/ventas/planes`, clave 610)
Selector **inversionista** (combobox **con búsqueda**, ordenado por razón social) + **propiedad/nave** +
botón **⚙ Configuración**. El selector solo lista inversionistas con `inversionista=true`, `pruebas=false`
y con al menos una propiedad `pdpActivo=true`. 3 pestañas:
- **Plan de Pagos:** tabla detallada (calculada a mano, sin vista) con columnas **# · Tipo pago · Fecha ·
  Monto · Fecha Pago · Movimiento (C/T) · Pagos · Balance · % Avance · Opciones**. Indicadores: **⚠️**
  cuando la parcialidad tiene descuento y **＋** (verde) cuando hay saldo a favor (balance > 0). **Fila de
  totales** + leyenda. Botones por fila: **$** (registrar/eliminar pago, mismo modal del Dashboard) y
  **💬** (comentarios de la parcialidad: ver + agregar).
- **Renta Garantizada:** `rgPdpDetalle` del `rgPdp` de la propiedad (solo lectura).
- **Renta Administrada:** `raPdpDetalle` del `raPdp` de la propiedad (solo lectura).

### Configuración (⚙) — 4 sub-pestañas
1. **Datos Generales** → edita `inversionista` (nombre, apellidos, RFC, CURP, razón social, contacto…).
2. **Documentos** → `inversionista_docs` + bucket **`Documentos`** (subir/ver/eliminar).
3. **Propiedades** → lista las propiedades del inversionista en **tarjetas** (estilo v1) y **vincula naves**
   disponibles. Detalle:
   - **Alta:** **dos combos** — primero **Parque** (excluye los de tipo Tickets, `parques.esTicket=false`),
     luego **Nave** (filtrada por ese parque). El campo "nombre descriptivo" **ya no se captura**: lo arma
     el backend como `"{nomParque} - {numNaveNAME}"` (como v1).
   - **Disponibilidad por `naves.situacion`** (NO por la columna `Arrendada`): el combo solo muestra naves
     con **`situacion='Disponible'`** (ordenadas por `numNave`). Una **nave se vincula una sola vez**: al
     asignarla, el backend marca `naves.situacion='Vendida'` (+ `fum`/`fumUser`) y deja de aparecer en el
     combo. Si la nave ya no está `Disponible`, el alta se rechaza (anti-carrera).
   - **Tarjeta de propiedad** (réplica de v1): franja izquierda **rosa = Vendida / verde = Disponible**;
     muestra **Inversionista** (razón social), número grande de nave (`numNave`), `Nave {numNaveNAME}`, la
     **situación** y el parque; grilla **Mza · Lote · Terreno · Const. · Precio · Fecha estimada · KVAs Alta
     · KVAs Media**; chips **PDP / Rta. G. / Rta. A.** según corresponda.
   - **KVAs:** se calculan desde **`kvasAsignados`** (registros `status=true`) sumando `cantKvas` por nave y
     separando por **`tipoTension`**: **1 → Alta, 2 → Media** (⚠️ **supuesto provisional** — no hay catálogo
     de tensión en BD; pendiente confirmar con negocio y contemplar un posible 3=Baja). En los datos actuales
     solo existe `tipoTension=2`.
   - **No se mostró "Arrendador"** (presente en v1) porque este módulo no maneja arrendamiento y ese dato
     venía de la vista `v_propiedades` (que v2 evita).
   - **Desvincular nave** (🗑 en la tarjeta): elimina la propiedad y **regresa `naves.situacion='Disponible'`**
     (+ `fum`/`fumUser`). **Solo se permite —y el botón solo aparece— si la propiedad NO tiene plan de pagos**
     (`tienenPdp=false`); el backend revalida y rechaza si lo tiene (réplica de v1 `dat_naves`). Confirmación
     en el front antes de borrar.
   - **Pendiente:** íconos de **editar** nave (sin endpoint en v2).
4. **Plan de Pagos** → **crear** un PDP: `montoTotal = terreno + obra·1.16`; N parcialidades **mensuales
   iguales** (`round(montoTotal/N, 2)`, misma cuota en todas — como v1 `redondearMonto`/`siguienteMes`).
   Inserta `pdp` + N `pdpDetalle` y marca la propiedad `tienenPdp=true`.

> En esta etapa **solo se crea el Plan de Pagos**. La creación de Renta Garantizada (RPCs
> `rgpdp_insertar_registro`/`rgpdp_generar_plan_pagos`) y Administrada (`rapdp_actualizar`) se hará después.

## 4. Modelo de datos (todo EXISTENTE; sin DDL nuevo)
- **Catálogo/propietario:** `inversionista` (PK `idInversionista`), `inversionista_docs`, `propiedades`
  (vínculo nave↔inversionista), `naves` (incl. `situacion`: 'Disponible'/'Vendida', `numNave`, `numNaveNAME`,
  `mza`, `lote`, `terreno`, `construccion`, `precio`, `fecEntrega`), `parques` (`nomParque`, `esTicket`).
- **KVAs:** `kvasAsignados` (`idNave`, `idParque`, `cantKvas`, `tipoTension` [1=Alta/2=Media], `tipoContrato`,
  `status`) — KVAs por nave para las tarjetas de Propiedades.
- **Plan de pagos:** `pdp` (PK `idPdp`), `pdpDetalle` (PK `idPdpDet`, parcialidades), `pagos` (PK `idPago`,
  cobros con `tipomovimiento`/`tipoOperacion`/`comprobante`).
- **Bitácora:** `comentarios` (origen 'Ventas' por defecto), `actividad`.
- **Rentas (lectura):** `rgPdp`/`rgPdpDetalle`, `raPdp`/`raPdpDetalle`.
- **Vista usada:** solo `v_rentasCombinadas` (pestañas de rentas del Dashboard). El resto de las vistas de
  v1 (`v_pagos`, `v_montoTotalAnual`, `v_pagosTotalAnual`, `v_Totales_Anual_Mes`) **ya NO se usan**: los
  cálculos se hacen a mano.

## 5. Endpoints (backend, `@Controller('ventas')`)
- **Dashboard (600):** `GET dashboard/filtros|tabla|tarjetas|rentas`, `GET dashboard/pagos/:idPdpDet`
  (detalle), `POST dashboard/pagos/:idPdpDet` (multipart, comprobante), `DELETE dashboard/pagos/:idPago`
  (eliminar pago), SSE `dashboard/stream`. (`tabla` y `tarjetas` reciben `anio`, `mes`, `activo`.)
- **Planes (610):** `GET planes/inversionistas|propiedades|plan/:idPropiedad|renta-garantizada/:idPropiedad|
  renta-administrada/:idPropiedad`, `GET/POST planes/comentarios/:idPdpDet`. Config: `GET/PATCH
  planes/inversionista/:id`, `GET/POST/DELETE planes/docs`, **`GET planes/parques`** (parques sin Tickets),
  `GET planes/naves-disponibles?idParque=` (solo `situacion='Disponible'`), `POST planes/propiedades`
  (vincula nave → marca `naves.situacion='Vendida'`), **`DELETE planes/propiedades/:idPropiedad`**
  (desvincula: borra la propiedad y regresa `naves.situacion='Disponible'`; rechaza si `tienenPdp=true`),
  `POST planes/plan-pagos`.
  - `GET planes/propiedades` devuelve cada propiedad enriquecida con datos de la nave, `nomParque` y
    `kvas:{alta,media}` (desde `kvasAsignados`).

## 6. Seguridad
- `JwtAuthGuard + PermisoGuard`; Dashboard con **600**, Planes/Config/Comentarios con **610**. SSE con
  `SseAuthGuard` (token en query) + permiso 600.
- Todas las escrituras (pago, eliminar pago, crear plan, editar inversionista/propiedad, docs, comentarios,
  **vincular nave + marcar `naves.situacion='Vendida'`**) vía `comoActor(uid)` para auditoría server-side;
  bloqueadas en modo "Ver como" (no-soporte). El frontend nunca habla con Supabase.
- **UI:** en todo el módulo el nombre del inversionista/propietario se muestra por **razón social** (helper
  `nombreInversionista()` en `ventas.api.ts`; respaldo a nombre+apellidos si está vacía).

## 7. Relación con otros módulos
- **Clientes (clave 300):** comparte la tabla `inversionista` y el mismo criterio de cliente
  (`inversionista=true`, `pruebas=false`). Los clientes se dan de alta/editan en **Clientes**.
- **Parques:** el "dueño" de una nave proviene de aquí (`propiedades`↔`naves`); vincular nave a un
  propietario se hace en **Ventas → Planes → Configuración → Propiedades**.
- **Arrendatarios:** el mismo registro `inversionista` funge como arrendador (`idArrendador = idInversionista`).

## 8. Pendiente / fuera del MVP
- **Reportes** (620) y **Escrituras** (630). Creación de **Renta Garantizada** y **Renta Administrada**.
  Edición/cancelación de planes existentes. Activar/desactivar PDP (`pdpactivo`). Pasar las pestañas de
  rentas a cálculo propio (hoy usan `v_rentasCombinadas`).
- **Config→Propiedades:** íconos de **editar** nave (sin endpoint en v2). El **desvincular** ya está hecho.
- **KVAs / `tipoTension`:** confirmar con negocio el mapeo **1=Alta / 2=Media** (supuesto provisional, sin
  catálogo en BD; posible 3=Baja). `TODO` marcado en `planes.service.ts`.
- **Dashboard, limpieza pendiente:** tras excluir el parque de Tickets, la **columna "T"** de la tabla y la
  columna **"F"** (ticket) de la fila de totales quedan **siempre en 0**; se pueden retirar de la UI (decisión
  pendiente del usuario). La lógica de fila amarilla "si es Ticket" quedó inactiva.
