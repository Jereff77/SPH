---
modulo: Inversionistas / Propietarios (Ventas)
estado: parcial              # Gestión de Cobranza + Dashboard gráfico + Planes + Escrituras en v2
version_doc: 2.1
ultima_actualizacion: 2026-06-22
submodulos: [Gestión de Cobranza, Dashboard gráfico, Reportes, Planes, Configuración, Escrituras]
rutas: [/ventas, /ventas/dashboard, /ventas/reportes, /ventas/planes, /ventas/escrituras]
claves_permiso: [600, 610, 620, 630]
tablas: [inversionista, inversionista_docs, propiedades, naves, kvasAsignados, pdp, pdpDetalle, pagos, rgPdp, rgPdpDetalle, raPdp, raPdpDetalle, comentarios, actividad, parques, v_rentasCombinadas, iaSesiones, iaConversaciones]
palabras_clave: [inversionista, propietario, dueño, propiedad, nave, parque, vincular nave, nave disponible, nave vendida, situación, KVAs, KVAs Alta, KVAs Media, tipoTension, venta, plan de pagos, PDP, parcialidad, cobranza, cobranza real, pago, eliminar pago, terreno, construcción, ticket, descuento, saldo a favor, avance, renta garantizada, renta administrada, configuración, documentos, escrituración, dashboard, gráfico, atrasos, vencido, días de atraso, KPI, gestión de cobranza, reportes, estado de cuenta, vencidos, saldo vencido, exportar, CSV, PDF, JSON, Montse AI, asistente, IA, chat, OpenRouter, comentarios, razón social]
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

## 2. Gestión de Cobranza (`/ventas`, clave 600)
> En la UI esta sección se llama **"Gestión de Cobranza"** (antes "Dashboard"); el código/servicio interno
> sigue siendo `dashboard.service.ts` y la ruta `/ventas`.

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
  **agregar un pago** (tipo de movimiento 1=Terreno/2=Construcción/3=Ticket, operación
  **1=Pago/2=Descuento/3=Devolución**, monto, IVA en Ticket, fecha y **comprobante PDF**) y **eliminar un
  pago** (🗑). El recálculo de `pdp.montoPagado` lo hacen los triggers de `pagos` (en INSERT y DELETE).
  - **Devolución (operación 3, v2.41.0):** registra el dinero que se **regresa** al cliente (renegociación
    de precio / cancelación de una operación que obliga a devolver parte de lo ya pagado). Se persiste con
    **`monto`/`iva`/`montosiniva` en NEGATIVO** (`PagosVentaService.registrarPago`, `OPERACION_DEVOLUCION=3`):
    como **todos** los consumidores del saldo hacen `SUM(monto)` (trigger `pdp.montoPagado`, la `bolsa` del
    FIFO en `saldos-vencidos.service.ts`, y los agregados de `dashboard.service.ts`), el signo negativo
    **se descuenta solo** del pagado sin tocar BD. El usuario captura el importe en **positivo**; en el
    listado la devolución se ve en **rojo** con monto negativo. Reversible: eliminar la devolución restituye
    el saldo. Distinción: `Descuento` (2) = rebaja que cubre deuda (suma positivo); `Devolución` (3) = dinero
    que sale (resta). ⚠️ Sin cambios de BD (`pagos.tipoOperacion` aceptaba el valor 3, antes solo 1/2; no hay
    CHECK sobre `monto`).
  - **Adjuntar comprobante a un pago existente (v2.40.0):** en la columna **Comp.** de cada pago, botón
    **"subir"** (si no tiene) o **"ver" + "cambiar"** (si ya tiene), para anexar/reemplazar el PDF **sin
    borrar y recrear el pago** (caso: la factura no estaba lista al registrar). Endpoint
    **`POST dashboard/pagos/:idPago/comprobante`** (multipart, clave 600) → `PagosVentaService.subirComprobante`.
  - **🔒 Comprobantes en bucket PRIVADO + URL firmada (v2.40.0):** los comprobantes de pago se guardan en
    el bucket **`cxp` (privado)** y en `pagos.comprobante` se persiste el **path** (no una URL pública).
    `detallePagos` genera una **URL firmada temporal** (helper `firmarDocumentos` de CxP, expira 2 h) en cada
    lectura. Maneja también el histórico de v1 (URLs públicas del bucket `comprobantes`) firmándolo por su
    path, **sin migrar datos**. **Fix:** antes se subía a `cxp` con `getPublicUrl` → "Bucket not found" (cxp es
    privado). ⚠️ **Deuda (con autorización):** los ~607 comprobantes históricos siguen físicamente en el bucket
    público `comprobantes`; migrarlos al privado es un saneo aparte (la app ya no expone su URL pública).
- **Bitácora:** alta y eliminación de pagos registran en **`actividad`** y **`comentarios`** (como v1).
- **Fechas en horario de México (GMT-6):** la fecha por defecto al capturar usa `America/Mexico_City`
  (helper `hoyMexico()`), evitando el desfase de UTC.
- **Tiempo real (SSE):** el Dashboard se suscribe a `/ventas/dashboard/stream` (cambios en `pagos`, incluso
  los hechos desde v1) y refresca en vivo.

## 2c. Dashboard gráfico (`/ventas/dashboard`, clave 620)
Vista **gráfica/reporte** (separada de "Gestión de Cobranza"). Usa **Chart.js** (`react-chartjs-2`, cargado
en chunk aparte por code-splitting). En el sidebar aparece **primero** como "Dashboard". Universo: planes
**activos** (`pdpActivo=true`), sin Tickets. Componentes:
- **3 KPIs del año** (formato compacto, p. ej. 226M): **Monto** (objetivo), **Pagos** (cobrado),
  **Balance** (= pagos − objetivo; rojo si negativo).
- **Gráfico de barras** por mes (Monto azul, Pagos verde, Balance rojo) con **toggle Mensual / Acumulado**
  (acumulado = suma corrida mes a mes). Barras redondeadas, tooltips en moneda.
- **Naves con atrasos:** tabla de la **cartera vencida**, agrupada por **nave** (con razón social), columnas
  **Vencido** y **Días** (mayor atraso de la nave), ordenable, con **Total**. ⚠️ Los atrasos son de TODO el
  historial (cartera vencida real), no solo del año del selector (que sí filtra los KPIs y el gráfico).
  **Incluye Tickets** (decisión 2026-06, ver §2e); el resto del Dashboard (KPIs/gráfico/tabla/tarjetas) sigue
  **sin** Tickets.
- **Backend:** `GET ventas/reporte?anio=` → `dashboard.service.reporteGrafico()`. Los **atrasos** ya **no** se
  calculan parcialidad por parcialidad: delegan en **`SaldosVencidosService`** (cuenta corriente FIFO por
  plan, ver §2e). **Sin objetos nuevos en BD.**

## 2d. Reportes (`/ventas/reportes`, clave 620)
Réplica **segura** de los 2 reportes HTML de v1 (que iban embebidos en un WebView y consultaban Supabase
con **anon key en el navegador** 🚨). En v2 el **backend** invoca las RPCs existentes `v_pdpdetalle_get_*`
(SECURITY DEFINER, parametrizadas) con `service_role` y el front las pinta en React (mismos estilos/colores).
Dos pestañas:
- **Estado de Cuenta** (header azul): filtros (Año/Mes + Razón social/Parque/Propiedad con búsqueda) → botón
  **Aplicar**; 4 tarjetas (Monto/Pagos/Balance/Vencidos), tabla de 12 columnas (fila roja si `pago_vencido`),
  export **CSV/JSON/PDF**. RPC `v_pdpdetalle_get_estado_cuenta_detalle`.
- **Vencidos** (header rojo): 4 tarjetas (Total vencido/Registros/Parques/Promedio días), **gráfico de barras
  apiladas** (evolución por año/parque, Chart.js), **tabla resumen por parque** (con barra de %), tabla
  principal de 8 columnas (rojo si `dias>30`), export. **Desde 2026-06-21 se calcula con
  `SaldosVencidosService`** (cuenta corriente FIFO por plan, ver §2e) — los 3 endpoints
  (`vencidos`/`vencidos-resumen`/`vencidos-evolucion`) ya **no** llaman las RPCs
  `v_pdpdetalle_get_saldos_vencidos_*` (obsoletas; ver `OBSOLESCENCIA-BD.md`). Filtros sin A3
  (`_unique_values_sin_a3`).
- **Filtros multi-selección en cascada bidireccional (regla 7c, ambas pestañas):** los 5 filtros
  (Año/Mes/Razón social/Parque/Propiedad) permiten **elegir uno o varios** valores (componente
  `MultiSearchSelect`, con "Seleccionar todas / Limpiar"). Al elegir, los demás se reducen a lo compatible
  (cascada bidireccional, derivada de las **combinaciones únicas** `GET ventas/reportes/combos` →
  `SELECT DISTINCT` sobre `v_pdpdetalle`; las incompatibles se autolimpian). **Backend:** los endpoints
  reciben los filtros como **query repetido** (`?razonsocial=A&razonsocial=B`); **Vencidos** filtra en
  memoria sobre el resultado del helper; **Estado de Cuenta** pasa a la RPC el valor único cuando hay uno y,
  si hay varios, trae sin ese filtro y **filtra en memoria** (la RPC solo filtra por igualdad → equivalente).
- **Montse AI** (3er tab): **asistente conversacional** sobre los datos del ERP (chat con sesiones,
  respuestas en markdown con tablas y **gráficos** bar/pie/line que la IA adjunta). El frontend NO habla
  con Supabase: el backend (`montse.service.ts`/`montse.controller.ts`, rutas `ventas/montse/*`) hace de
  **proxy** de la **edge function `ia-chat`** (OpenRouter con su secret `OPENROUTER_API_KEY`), reenviando
  el **JWT del usuario** para que la función lo identifique y registre la conversación. Sesiones en
  `iaSesiones`, mensajes en `iaConversaciones`; control de cuota con RPC `ia_tokens_disponibles`. Front:
  `features/ventas/montse/` (`MontseChat`, `ChartBlockIA` con Chart.js, `useMontse`). Adaptado de la rama
  `gpt` (que usaba la anon key en el navegador — en v2 se elimina ese vector). Copiar respuesta como CSV y
  gráfico como imagen.
- **Réplica fiel (parcial):** el frontend `ReportesPage.tsx` (lazy/code-split; Chart.js + jsPDF +
  react-markdown) y el backend `reportes.service.ts` conservan el aspecto de v1. ⚖️ **Estado de Cuenta** y
  los **filtros** siguen **reutilizando** las RPCs `v_pdpdetalle_get_*` del esquema (no son las peligrosas
  `cdg`/`consulta_segura`; el vector inseguro de v1 —anon key en cliente— se elimina: las llama el backend).
  En cambio **Vencidos** ya **NO** replica v1: se corrigió el cálculo (ver §2e).

## 2e. Cálculo de **saldos vencidos** (cuenta corriente FIFO por plan)

> Fuente única: **`SaldosVencidosService`** (`apps/api/src/modules/ventas/saldos-vencidos.service.ts`,
> método `calcular({ incluirTickets })`). Lo consumen **ambos**: el Dashboard gráfico (Naves con atrasos,
> §2c) y el reporte de **Vencidos** (§2d) → por construcción **cuadran** (mismo número).

**Problema que resuelve (bug histórico).** El cálculo anterior evaluaba **cada parcialidad por separado**
(`saldo = monto − pagos de ESA parcialidad`). Cuando un cliente concentra un pago grande en una sola
parcialidad —p. ej. **adelanta 3-4 mensualidades**—, ese **saldo a favor no se propagaba** y las demás
parcialidades figuraban como vencidas aunque ya estaban cubiertas. En producción inflaba la cartera vencida
**de $23.2M reales a $67.4M** (≈$44M falsos, 52 de 202 planes). El reporte v1 (RPCs sobre `v_pdpdetalle`)
tenía además otra variante del error: `pago_vencido` solo marcaba parcialidades **sin ningún pago**, ignorando
los pagos parciales. Dashboard ($67.4M) y reporte ($21.7M) **ni siquiera cuadraban entre sí**.

**Cómo se calcula ahora (FIFO por plan).** Por cada **plan** (`idPdp`):
1. `bolsa` = Σ de **todos** los pagos del plan (`status=true`; los **descuentos** `tipoOperacion=2` cuentan
   como pago; las **devoluciones** `tipoOperacion=3` van en **negativo** y por tanto **restan** de la bolsa;
   los **cancelados** `status=false` **no**).
2. Se ordenan las parcialidades por antigüedad (`fecha`, luego `numPago`) y se acumula el monto (`acum`).
3. Saldo remanente de cada parcialidad = **`max(0, min(monto, acum − bolsa))`** (la bolsa cubre primero lo
   más antiguo; el excedente fluye al futuro).
4. Solo cuenta como **vencido** si `fecha < hoy` (horario de México) y el saldo remanente > 0.

**Reglas de negocio (acordadas con el usuario, 2026-06-21):**
- El saldo a favor se aplica **solo dentro del mismo plan** (`idPdp`); **nunca** cruza a otro plan.
- Aplicación **FIFO** (lo más viejo primero; el excedente hacia el futuro).
- **Universo:** inversionista real (`inversionista=true`, `pruebas=false`) + plan activo (`pdpActivo=true`),
  **incluyendo Tickets** (`esTicket=true`). Nota: hoy los Tickets no tienen saldo vencido, así que incluirlos
  no cambia el total — pero el universo queda unificado entre Dashboard y reporte.
- **Cancelados no cuentan; descuentos sí.**

**Filtros del reporte** (año/mes/parque/propiedad/razón social) se aplican **después** del FIFO (el FIFO
necesita el plan completo). El reporte de Vencidos lista por parcialidad; el resumen agrupa por parque (con %
del total); la evolución agrupa por año y parque.

⚠️ **Pendiente menor:** las otras agregaciones del Dashboard (KPIs/serie/tabla/tarjetas, vía
`pagosAggPorParcialidad`) aún **no** filtran `status` — hoy sin impacto (no hay pagos cancelados), pero si
llegara a haberlos, conviene unificar el filtro `status=true`.

## 3. Planes (`/ventas/planes`, clave 610)
Selector **inversionista** (combobox **con búsqueda**, ordenado por razón social) + **propiedad/nave** +
botón **⚙ Configuración**. El selector solo lista inversionistas con `inversionista=true`, `pruebas=false`
y con al menos una propiedad `pdpActivo=true`. 3 pestañas:
- **Plan de Pagos:** tabla detallada (calculada a mano, sin vista) con columnas **# · Tipo pago · Fecha ·
  Monto · Fecha Pago · Movimiento (C/T) · Pagos · Balance · % Avance · Opciones**. Indicadores: **⚠️**
  cuando la parcialidad tiene descuento y **＋** (verde) cuando hay saldo a favor (balance > 0). **Fila de
  totales** + leyenda. Botones por fila: **$** (registrar/eliminar pago, mismo modal del Dashboard) y
  **💬** (comentarios de la parcialidad: ver + agregar).
  - **Cambiar Tipo de pago** (réplica de `editar_tipo_pago` de v1): **doble clic** en la celda *Tipo pago*
    habilita un selector (**Anticipo / Parcialidad / Escrituracion**); se aplica al confirmar con ✓ (o Enter),
    se cancela con ✕/Esc. Backend `PATCH ventas/planes/tipo-pago/:idPdpDet` → `UPDATE pdpDetalle.tipoPago`
    (`comoActor` + `actividad`).
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
4. **Plan de Pagos** (v2.39.0 — réplica del layout de 2 columnas de **Arrendatarios**, `PlanPagosTab` en
   `ConfigPropietarioModal.tsx`): **izquierda** el formulario/acciones, **derecha** la **Previsualización**
   de las parcialidades (lee la corrida real, sirve incluso para el plan recién creado e **inactivo**).
   - **Crear** (sin plan): `montoTotal = terreno + obra·1.16`; N parcialidades **mensuales iguales**
     (`round(montoTotal/N, 2)` — como v1 `redondearMonto`/`siguienteMes`). Inserta `pdp` + N `pdpDetalle`.
   - **⚠️ Criterio "tiene plan" = `propiedades.idPdp` (o corrida real), NO `propiedades.tienenPdp`.** La
     bandera `tienenPdp` está **desincronizada** en ~18 propiedades heredadas de v1 (idPdp poblado pero
     `tienenPdp=false`); por eso TODO el módulo decide por `idPdp`: detección del plan, guarda de crear
     (no duplica PDP), activar, **desvincular nave** (rechaza si hay `idPdp`) y el chip "PDP"/botón 🗑 de la
     tarjeta de Propiedades. La tarjeta muestra el número de nave por **`numNaveNAME`** (no `numNave`).
   - **Activar / Desactivar** (`PATCH planes/plan/:idPropiedad/activo`): togglea **`propiedades.pdpActivo`**
     (la bandera vigente del módulo). **NO toca `pdp.pdpactivo`**, que es **remanente** (el control se migró a
     `propiedades`; en prod los 204 planes lo tienen en `false`). Al **activar**, valida que **Σ parcialidades
     = `pdp.monto` ± `TOLERANCIA_PDP` (0.05)**; si no cuadra, rechaza (como v1).
   - **Edición SOLO con el plan inactivo** (activo = congelado, como v1; el backend revalida con
     `asegurarPlanInactivo`): editar **Terreno/Obra** (recalcula el total, `PATCH .../montos`), y por parcialidad
     (doble clic) el **Monto** (`PATCH .../partida/:id/monto`), la **Fecha** (`.../fecha`) y el **Tipo de pago**
     (reutiliza `PATCH planes/tipo-pago/:id`). **Agregar** parcialidad (`POST .../partida`, nace en monto 0,
     fecha = mes siguiente) y **Eliminar** (`DELETE .../partida/:id`, solo si **no tiene pagos**). Todo audita
     en `actividad` vía `comoActor`.

> En esta etapa el módulo cubre **crear + configurar el Plan de Pagos** (incluida la edición de parcialidades y
> el activar/desactivar). La creación de Renta Garantizada (RPCs `rgpdp_insertar_registro`/
> `rgpdp_generar_plan_pagos`) y Administrada (`rapdp_actualizar`) se hará después.

## 3b. Escrituras (`/ventas/escrituras`, clave 630)
Réplica de la pantalla **"Fechas de escrituración"** de v1 (`i01_inversionistas/escrituracion`). Lista las
**parcialidades cuyo `pdpDetalle.tipoPago = 'Escrituracion'`** (status=true) y permite **editar la fecha y el
monto** de cada una. **Cálculos sin vistas** (v1 usaba `v_pagos`): el backend lee `pdpDetalle` y enriquece
con nave (`naves.numNaveNAME` + `parques.nomParque` → "Parque - Nave"), inversionista (`razonsocial`) y
**excluye el parque de Tickets** (`propiedades.esTicket=false`, regla del módulo).
- **Columnas:** Tipo Pago · Nave · No. de pago (`numPago`) · Inversionista · **Fecha** (editable) ·
  **Monto** (editable). Encabezado sticky azul + ordenable (`useSort`) + búsqueda (nave/inversionista/nº) +
  **fila de total** al pie. Orden por defecto: nave → inversionista → fecha (como v1).
- **Edición (anti-error):** **doble clic** en la celda de fecha/monto habilita el input; el cambio se aplica
  solo al **confirmar** con ✓ (o Enter), y se cancela con ✕ o Esc (como v1, evita cambios accidentales).
  Backend: `PATCH .../fecha` y `PATCH .../monto` → `UPDATE pdpDetalle` por `idPdpDet`, con `comoActor(uid)`
  y registro en **`actividad`** ("Se actualiza fecha/monto de X a Y | idPdpDet…", como v1).
- **Validación:** fecha `yyyy-MM-dd`; monto > 0. El recálculo de `pdp.montoPagado` (si aplica) lo hacen los
  triggers existentes. **Sin objetos nuevos en BD.**

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
  planes/inversionista/:id`, **`PATCH planes/tipo-pago/:idPdpDet`** (cambiar tipoPago de la parcialidad:
  Anticipo/Parcialidad/Escrituracion), `GET/POST/DELETE planes/docs`, **`GET planes/parques`** (parques sin Tickets),
  `GET planes/naves-disponibles?idParque=` (solo `situacion='Disponible'`), `POST planes/propiedades`
  (vincula nave → marca `naves.situacion='Vendida'`), **`DELETE planes/propiedades/:idPropiedad`**
  (desvincula: borra la propiedad y regresa `naves.situacion='Disponible'`; **rechaza si la propiedad tiene
  `idPdp`**), `POST planes/plan-pagos`.
  - `GET planes/propiedades` devuelve cada propiedad enriquecida con datos de la nave, `nomParque` y
    `kvas:{alta,media}` (desde `kvasAsignados`).
  - **Config del PDP (v2.39.0, solo plan inactivo salvo el activo/cabecera):**
    **`PATCH planes/plan/:idPropiedad/activo`** (`{activo}`; al activar valida Σ partidas = total ±0.05),
    **`GET planes/pdp/:idPropiedad`** (cabecera: `montoterreno/montoobra/monto/cantpagos/pdpActivo`),
    **`PATCH planes/plan/:idPropiedad/montos`** (`{terreno,obra}` → recalcula `pdp.monto`),
    **`POST planes/plan/:idPropiedad/partida`** (agrega parcialidad monto 0),
    **`PATCH planes/partida/:idPdpDet/monto`**, **`PATCH planes/partida/:idPdpDet/fecha`**,
    **`DELETE planes/partida/:idPdpDet`** (rechaza si tiene pagos).
- **Reportes (620):** `GET ventas/reportes/filtros?tipo=&sinA3=`, `ventas/reportes/edo-cuenta`,
  `ventas/reportes/vencidos`, `ventas/reportes/vencidos-resumen`, `ventas/reportes/vencidos-evolucion`
  (todos con filtros anio/mes/razonsocial/parque/propiedad). Backend `reportes.service.ts` → RPCs
  `v_pdpdetalle_get_*`.
- **Escrituras (630):** `GET ventas/escrituras` (lista `{filas,total}` de `pdpDetalle` con
  `tipoPago='Escrituracion'`, sin Tickets), `PATCH ventas/escrituras/:idPdpDet/fecha`,
  `PATCH ventas/escrituras/:idPdpDet/monto`. Backend: `escrituras.service.ts`.

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
- (**Dashboard gráfico 620** y **Escrituras 630** ya implementados — ver §2c y §3b. **Configuración del PDP**
  —crear, activar/desactivar, editar parcialidades/montos, agregar/eliminar— **ya implementada** en v2.39.0,
  ver §3.) Creación de **Renta Garantizada** y **Renta Administrada**. **Cancelación** de planes existentes.
  Pasar las pestañas de rentas a cálculo propio (hoy usan `v_rentasCombinadas`).
- **Higiene de datos (pendiente, requiere autorización):** ~18 propiedades con `idPdp` pero `tienenPdp=false`
  (herencia de v1). El código ya no depende de la bandera, pero conviene sanear:
  `update propiedades set "tienenPdp"=true where status=true and "idPdp" is not null and "tienenPdp"=false;`
- **Config→Propiedades:** íconos de **editar** nave (sin endpoint en v2). El **desvincular** ya está hecho.
- **KVAs / `tipoTension`:** confirmar con negocio el mapeo **1=Alta / 2=Media** (supuesto provisional, sin
  catálogo en BD; posible 3=Baja). `TODO` marcado en `planes.service.ts`.
- **Dashboard, limpieza pendiente:** tras excluir el parque de Tickets, la **columna "T"** de la tabla y la
  columna **"F"** (ticket) de la fila de totales quedan **siempre en 0**; se pueden retirar de la UI (decisión
  pendiente del usuario). La lógica de fila amarilla "si es Ticket" quedó inactiva.
