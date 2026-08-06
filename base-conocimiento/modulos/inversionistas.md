---
modulo: Inversionistas / Propietarios (Ventas)
estado: parcial              # Gestión de Cobranza + Dashboard gráfico + Planes + Escrituras en v2
version_doc: 2.5
ultima_actualizacion: 2026-08-05
submodulos: [Gestión de Cobranza, Dashboard gráfico, Reportes, Planes, Configuración, Escrituras]
rutas: [/ventas, /ventas/dashboard, /ventas/reportes, /ventas/planes, /ventas/escrituras]
claves_permiso: [600, 610, 611, 620, 630]
tablas: [inversionista, inversionista_docs, propiedades, naves, kvasAsignados, pdp, pdpDetalle, pagos, rgPdp, rgPdpDetalle, raPdp, raPdpDetalle, comentarios, actividad, parques, v_rentasCombinadas, iaSesiones, iaConversaciones]
palabras_clave: [inversionista, propietario, dueño, propiedad, nave, parque, vincular nave, nave disponible, nave vendida, situación, KVAs, KVAs Alta, KVAs Media, tipoTension, venta, plan de pagos, PDP, parcialidad, cobranza, cobranza real, pago, eliminar pago, terreno, construcción, ticket, descuento, saldo a favor, avance, renta garantizada, renta administrada, configuración, documentos, escrituración, dashboard, gráfico, atrasos, vencido, días de atraso, KPI, gestión de cobranza, reportes, estado de cuenta, vencidos, saldo vencido, exportar, CSV, PDF, JSON, Montse AI, asistente, IA, chat, OpenRouter, comentarios, razón social, inversionista no aparece, no aparece en planes, no aparece en el selector, sin clasificar, "trasladar saldo", "devolución", "escrituración pendiente", "nave no aparece disponible", "plan huérfano", "pdp huérfano", "pdp fantasma", "el plan no tiene parcialidades", "con plan pero vacío", "no me aparece el plan", "plan sin corrida", "total del plan en cero", "no puedo desvincular la nave", "no aparece el cliente en el selector", "no me sale el inversionista en aportaciones", "el cliente existe pero no lo encuentro para asignarlo", "cliente en papelera", "eliminar plan", "eliminar el plan de pagos", "borrar el plan", "eliminar plan completo", "no puedo eliminar la última parcialidad", "no me deja eliminar la partida", "quitar el plan para desvincular"]
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
    - **🐛 Endurecimiento del signo (v2.43.2):** el **signo lo decide la operación, NUNCA el usuario**. El
      front (`PagoDetalleModal`) y el backend (`PagosVentaService.registrarPago`) toman la **magnitud**
      (`Math.abs`) del monto/IVA y aplican `−1` solo si es Devolución. **Por qué:** antes el cálculo era
      `signo × dto.monto`; si por error se capturaba el importe en **negativo**, una Devolución lo
      invertía (`−1 × −X = +X`) y **sumaba** en vez de restar. Ahora da igual el signo capturado: una
      Devolución siempre queda en negativo y resta. El schema cambió de `.positive()` a `!== 0` (la
      magnitud manda). 📌 **No fue un bug de datos**: la única devolución real (plan `EHvtNqaHxyYV`,
      −$61,185) restó bien (saldó un sobrepago: pagado $2,316,579 → $2,255,394, saldo $0). Este cambio es
      **blindaje preventivo** ante la captura en negativo.
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
- **Filtros:** **Año** + **Mes** (selector multi-selección, vacío = todo el año; v2.44.0). El filtro de mes
  acota la **gráfica** y los KPIs `Programado`/`Cobrado` (no el `Vencido a hoy`, ver abajo).
- **3 KPIs** (formato compacto, p. ej. 226M) — **recalibrados a "a hoy" en v2.44.0** para evitar la confusión
  de la antigua proyección anual:
  - **Programado:** Σ de las parcialidades del periodo (año + meses) — lo planeado a cobrar.
  - **Cobrado:** Σ de pagos de esas parcialidades.
  - **Vencido a hoy:** el **adeudo realmente exigible al día de hoy** (cuenta corriente FIFO por plan, todo el
    historial). Es una **foto a hoy**: **no** depende del filtro de año/mes y **coincide con el Total de la
    tabla "Naves con atrasos"**. Sustituye al antiguo KPI "Balance" (= pagos − monto del año, que incluía
    parcialidades futuras y daba un número negativo que parecía deuda sin serlo).
- **Gráfico de barras** por mes (Monto azul, Pagos verde, Balance mensual rojo) con **toggle Mensual /
  Acumulado** (acumulado = suma corrida mes a mes). Barras redondeadas, tooltips en moneda. Si se filtran
  meses, solo esos aportan datos.
- **Naves con atrasos:** tabla de la **cartera vencida**, agrupada por **nave** (con razón social), columnas
  **Vencido** y **Días** (mayor atraso de la nave), ordenable, con **Total**. **Doble clic en una fila →
  abre la pantalla de Planes con ese inversionista/propiedad preseleccionados** (`/ventas/planes?inversionista=…&propiedad=…`;
  `reporteGrafico` devuelve `idPropiedad`/`idInversionista` por fila). Solo navega si el usuario tiene la
  clave **610** (Planes); `PlanesPage` lee los query params como valor inicial de su selección. ⚠️ Los atrasos son de TODO el
  historial (cartera vencida real), no solo del periodo del selector. **Incluye Tickets** (decisión 2026-06,
  ver §2e); el resto del Dashboard (gráfico/tabla/tarjetas) sigue **sin** Tickets.
- **Backend:** `GET ventas/reporte?anio=&meses=1,3,6` → `dashboard.service.reporteGrafico(anio, meses)`. Los
  **atrasos** y el KPI `Vencido a hoy` delegan en **`SaldosVencidosService`** (cuenta corriente FIFO por plan,
  ver §2e). **Sin objetos nuevos en BD.**

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
botón **⚙ Configuración**. El selector (`planes.service.ts → inversionistas()`) lista **TODOS** los
inversionistas reales (`inversionista=true`, `pruebas=false`, `status=true`), **tengan o no** propiedad/plan
activo. ⚠️ **Gotcha (v2.44.1):** antes exigía un JOIN `!inner` a `propiedades` con `pdpActivo=true`, lo que
dejaba fuera a los inversionistas nuevos (sin nave vinculada o sin plan aún) y hacía **imposible crearles el
primer plan** desde aquí (callejón sin salida: el botón ⚙ Configuración —donde se vincula la nave y se crea el
plan— solo aparece tras seleccionar al inversionista en ese mismo selector). El filtro por `pdpActivo`/`esTicket`
aplica a Dashboard/Reportes/saldos-vencidos, **NO** a este selector operativo de gestión de planes. 3 pestañas:
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
   - **⛔ Candado de última partida (v2.63.0):** NO se puede eliminar la **última parcialidad viva** de un
     plan — el 🗑 se deshabilita en el front y el backend rechaza (`eliminarPartida` cuenta las vivas del
     `idPdp`). **Origen (caso real):** usuarios borraban todas las partidas creyendo que así eliminaban el
     plan, dejando un plan "cascarón" ($0.00, 0 partidas) que bloqueaba desvincular la nave. Para quitar el
     plan completo existe la acción explícita de abajo.
   - **🗑 Eliminar plan COMPLETO (v2.63.0):** botón **«Eliminar plan»** junto a «Activar», visible **solo con
     el plan desactivado** (clave 610, con confirmación). `DELETE planes/plan/:idPropiedad` →
     `PlanesService.eliminarPlanPagos` → **RPC transaccional `eliminar_plan_pagos`** (`SECURITY INVOKER`,
     `EXECUTE` solo `service_role`, `FOR UPDATE` sobre la propiedad): valida plan **inactivo** y que **ningún
     pago** (vivo o cancelado) referencie el plan o sus partidas; luego libera la propiedad
     (`idPdp=null, tienenPdp=false, pdpActivo=false`) y borra `pdp` (el CASCADE elimina `pdpDetalle`), todo en
     una transacción — la FK `NO ACTION` de `pagos` revienta el DELETE ante cualquier carrera. La propiedad
     queda libre para **desvincular la nave o crear un PDP nuevo**. Auditoría completa: `trg_auditoria` guarda
     cada fila borrada ENTERA con el uid del actor + entrada en `actividad`. Errores por código:
     `SIN_PLAN`/`PLAN_ACTIVO`/`CON_PAGOS`. Migración `migraciones/2026-08-05-eliminar-plan-pagos-rpc.sql`.

> En esta etapa el módulo cubre **crear + configurar el Plan de Pagos** (incluida la edición de parcialidades y
> el activar/desactivar). La creación de Renta Garantizada (RPCs `rgpdp_insertar_registro`/
> `rgpdp_generar_plan_pagos`) y Administrada (`rapdp_actualizar`) se hará después.

## 3c. Trasladar saldo entre parcialidades (clave 611) — candado independiente

> Acción para **limpiar adeudos menores** que figuran vencidos sin eliminar registros: mueve el saldo
> pendiente (o parte) de una parcialidad a **otra parcialidad futura del MISMO plan** (típicamente la
> última mensualidad). **Decisión de negocio (reunión 2026-06-29):** no se borran adeudos, se trasladan
> a la última mensualidad para que no confundan en cobranza, respetando la estructura del contrato.

- **Candado por permiso propio: clave 611** (`Inversionistas / Planes / Trasladar Saldo`), **independiente
  de la 610**: un usuario puede ver/editar Planes (610) sin poder trasladar saldos. Solo quien tiene 611
  (o soporte) ve el botón **⇄** y puede aplicar la operación. La seguridad real es server-side
  (`@RequierePermiso(611)`); el botón del front es cosmético.
- **No requiere desactivar el plan** (a diferencia de la edición de parcialidades): el traslado **conserva
  el total** (`Σ parcialidades = pdp.monto`), por lo que es seguro sobre planes activos.
- **Efecto:** el origen baja su saldo (deja de aparecer vencido) y el destino futuro sube pero **no cuenta
  como vencido** (su fecha no ha llegado) → el adeudo "a hoy" se limpia. `SaldosVencidosService` lo
  recalcula solo (sin tocar nada más).
- **UI** (pestaña *Plan de Pagos*): el botón **⇄** aparece en la fila de cada parcialidad **con saldo
  pendiente** (monto > pagos). Abre `TrasladarSaldoModal`: muestra el saldo pendiente, **selector de la
  parcialidad de destino futura** (default = la de fecha más lejana / última mensualidad), el monto a mover
  y una vista previa del resultado.
- **Validaciones (server-side, autoritativas):** origen ≠ destino; ambas vivas y del **mismo plan**;
  destino con **fecha futura**; **destino SIN pagos registrados** (no se traslada saldo a una parcialidad
  que ya recibió un pago/adelanto — regla de negocio 2026-06-29); `monto > 0`; `monto ≤ min(saldo
  pendiente, monto de la parcialidad)` (no deja el origen por debajo de lo pagado **ni** en negativo —
  cubre el caso de una **devolución** que inflaría el saldo pendiente por encima del monto). En el front,
  el selector de destino **solo lista** parcialidades futuras sin pagos.
- **⚙ Atomicidad — RPC transaccional `trasladar_saldo_pdp(p_origen, p_destino, p_monto)`** (objeto NUEVO
  en BD, `SECURITY INVOKER`, `search_path=public`, `EXECUTE` solo a `service_role`): bloquea ambas filas
  (`SELECT … FOR UPDATE`), revalida saldo/tope/plan/fecha y aplica los **dos UPDATE en una sola
  transacción**. Resuelve los riesgos de no-atomicidad y *lost-update* (imposibles de evitar con dos
  updates sueltos vía supabase-js). Se invoca con `comoActor(uid)` → la auditoría de `pdpDetalle` captura
  al actor. El servicio mapea los códigos de error de la RPC (`PLANES_DISTINTOS`, `DESTINO_NO_FUTURO`,
  `EXCEDE_TOPE`, `ORIGEN_NEGATIVO`, …) a `BadRequestException` legibles.
- **Trazabilidad (tu requisito):** además de la auditoría server-side del UPDATE, se registra el movimiento
  en **AMBAS** parcialidades — un **comentario en el origen** ("Se trasladó saldo de $X a la parcialidad
  #N…") y otro en el **destino** ("Se recibió saldo de $X desde la parcialidad #M…"), con `idPago = NULL`
  (la columna `comentarios.idPago` acepta NULL) — más una entrada en `actividad`. Mismo patrón que el alta/
  eliminación de pagos.
- **Endpoint:** `PATCH ventas/planes/trasladar-saldo` (clave 611) → `PlanesService.trasladarSaldo`.
- **📌 Gotcha (saldo aislado vs FIFO):** el tope se calcula sobre el **saldo pendiente directo** de la
  parcialidad (`monto − Σ pagos de esa parcialidad`), no sobre el saldo FIFO del plan. Coincide con lo que
  el usuario ve en pantalla (la columna *Balance*) y con el criterio de negocio ("trasladar lo que hoy
  aparece"). Si un sobrepago de otra parcialidad ya cubría esta vía FIFO, el traslado igualmente reduce su
  monto; el total del plan se conserva y el adeudo se recalcula. Es el comportamiento esperado para la
  limpieza manual caso por caso.
- **Estado:** función **lista y candada** (permiso 611). Validada por agente de seguridad Opus 4.8
  (hallazgo ALTO de monto negativo corregido; atomicidad/concurrencia resueltas con la RPC transaccional).
  La decisión de **cuándo** aplicarla sobre contratos es operativa del negocio (modifica el plan de pagos).

## 3b. Escrituras (`/ventas/escrituras`, clave 630)
Pantalla **operativa de escrituración** (evolución de "Fechas de escrituración" de v1,
`i01_inversionistas/escrituracion`). Lista las **parcialidades cuyo `pdpDetalle.tipoPago = 'Escrituracion'`**
(status=true). **Cálculos sin vistas** (v1 usaba `v_pagos`): el backend lee `pdpDetalle` y enriquece con
parque (`parques.nomParque`) y nave (`naves.numNaveNAME`) **por separado**, inversionista (`razonsocial`) y
**excluye el parque de Tickets** (`propiedades.esTicket=false`, regla del módulo).
- **Tarjetas de resumen (v2.44.0):** **Total** · **Escrituradas** · **Pendientes**. El conteo **se adapta a
  los filtros** (cuenta lo que se ve en la tabla, igual que el contador del header). El backend también devuelve
  `{escrituradas, pendientes}` del universo en `listar()`, por si se requiere.
- **Columnas:** Tipo Pago · **Parque** · **Nave** (`numNaveNAME`) · No. de pago (`numPago`) · Inversionista ·
  **Estatus** (interruptor) · **Fecha de escrituración** (editable) · **Monto** (editable). Encabezado sticky
  azul + ordenable (`useSort`) + búsqueda + **fila de total** al pie. Orden por defecto: parque asc.
- **Filtros de columna (multi-selección, regla 7c, v2.44.0):** **Parque**, **Nave**, **Inversionista** y
  **Estatus** (Escriturada/Pendiente).
- **Estatus manual (v2.44.0):** interruptor **Escriturada / Pendiente** por fila → `pdpDetalle.escriturada`
  (boolean). `PATCH .../estatus` (`{escriturada}`).
- **Fecha de escrituración (v2.44.0):** fecha **real** en que se escrituró → `pdpDetalle.fechaEscrituracion`
  (date, nullable). **Sustituye en pantalla** a la fecha *programada* de la parcialidad (`pdpDetalle.fecha`,
  que se sigue editando desde Planes/Config). `PATCH .../fecha-escrituracion` (`{fecha}`; `null` la limpia).
- **Edición (anti-error):** **doble clic** en la celda de fecha/monto habilita el input; el cambio se aplica
  solo al **confirmar** con ✓ (o Enter), y se cancela con ✕ o Esc. El estatus se cambia con un clic en el
  interruptor. Backend: `UPDATE pdpDetalle` por `idPdpDet`, con `comoActor(uid)` y registro en **`actividad`**.
- **Validación:** fecha `yyyy-MM-dd`; monto > 0.
- **📌 BD (v2.44.0):** se agregaron a `pdpDetalle` las columnas **`escriturada`** (boolean NOT NULL DEFAULT
  false) y **`fechaEscrituracion`** (date). Aditivas, no rompen v1. Ver `migraciones/2026-06-25-pdpdetalle-escrituras-estatus-fecha.sql`.

## 4. Modelo de datos (todo EXISTENTE; sin DDL nuevo)
- **Catálogo/propietario:** `inversionista` (PK `idInversionista`), `inversionista_docs`, `propiedades`
  (vínculo nave↔inversionista), `naves` (incl. `situacion`: 'Disponible'/'Vendida', `numNave`, `numNaveNAME`,
  `mza`, `lote`, `terreno`, `construccion`, `precio`, `fecEntrega`), `parques` (`nomParque`, `esTicket`).
- **KVAs:** `kvasAsignados` (`idNave`, `idParque`, `cantKvas`, `tipoTension` [1=Alta/2=Media], `tipoContrato`,
  `status`) — KVAs por nave para las tarjetas de Propiedades.
- **Plan de pagos:** `pdp` (PK `idPdp`), `pdpDetalle` (PK `idPdpDet`, parcialidades; incl. `escriturada`
  boolean + `fechaEscrituracion` date, agregadas en v2.44.0 para Escrituras), `pagos` (PK `idPago`, cobros con
  `tipomovimiento`/`tipoOperacion`/`comprobante`).
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
    **`DELETE planes/partida/:idPdpDet`** (rechaza si tiene pagos **o si es la última partida viva del plan**,
    v2.63.0), **`DELETE planes/plan/:idPropiedad`** (elimina el plan COMPLETO: solo desactivado y con CERO
    pagos; libera la propiedad — RPC transaccional `eliminar_plan_pagos`, v2.63.0).
  - **Trasladar saldo (clave 611, candado propio):** **`PATCH planes/trasladar-saldo`**
    (`{idPdpDetOrigen, idPdpDetDestino, monto}`) → `PlanesService.trasladarSaldo` → RPC transaccional
    `trasladar_saldo_pdp`. NO requiere plan inactivo (conserva el total). Ver §3c.
- **Reportes (620):** `GET ventas/reportes/filtros?tipo=&sinA3=`, `ventas/reportes/edo-cuenta`,
  `ventas/reportes/vencidos`, `ventas/reportes/vencidos-resumen`, `ventas/reportes/vencidos-evolucion`
  (todos con filtros anio/mes/razonsocial/parque/propiedad). Backend `reportes.service.ts` → RPCs
  `v_pdpdetalle_get_*`.
- **Escrituras (630):** `GET ventas/escrituras` (lista `{filas,total,escrituradas,pendientes}` de `pdpDetalle`
  con `tipoPago='Escrituracion'`, sin Tickets), `PATCH ventas/escrituras/:idPdpDet/fecha` (fecha programada),
  **`PATCH ventas/escrituras/:idPdpDet/estatus`** (`{escriturada}`),
  **`PATCH ventas/escrituras/:idPdpDet/fecha-escrituracion`** (`{fecha}`, nullable),
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
  ver §3.) Creación de **Renta Garantizada** y **Renta Administrada**. **Cancelación** de planes existentes
  — la **eliminación de planes SIN pagos ya existe** (v2.63.0, ver §3); lo pendiente es la cancelación/baja de
  planes **con historial de pagos**. Pasar las pestañas de rentas a cálculo propio (hoy usan `v_rentasCombinadas`).
- **Higiene de datos (pendiente, requiere autorización):** ~18 propiedades con `idPdp` pero `tienenPdp=false`
  (herencia de v1). El código ya no depende de la bandera, pero conviene sanear:
  `update propiedades set "tienenPdp"=true where status=true and "idPdp" is not null and "tienenPdp"=false;`
- **Config→Propiedades:** íconos de **editar** nave (sin endpoint en v2). El **desvincular** ya está hecho.
- **KVAs / `tipoTension`:** confirmar con negocio el mapeo **1=Alta / 2=Media** (supuesto provisional, sin
  catálogo en BD; posible 3=Baja). `TODO` marcado en `planes.service.ts`.
- **Dashboard, limpieza pendiente:** tras excluir el parque de Tickets, la **columna "T"** de la tabla y la
  columna **"F"** (ticket) de la fila de totales quedan **siempre en 0**; se pueden retirar de la UI (decisión
  pendiente del usuario). La lógica de fila amarilla "si es Ticket" quedó inactiva.

## 9. Para el agente de soporte

- **"El inversionista/propietario no aparece en el selector de Planes"** (`/ventas/planes`) → el
  selector real (`PlanesService.inversionistas()`, `apps/api/src/modules/ventas/planes.service.ts`,
  desde **v2.44.1**) lista registros de `inversionista` con **`inversionista=true AND pruebas=false AND
  status=true`** — **no** exige tener propiedad o plan activo (así se puede dar de alta el primer plan
  desde este mismo selector). Si al registro le falta la bandera `inversionista`, es de prueba
  (`pruebas=true`, = estado **"Papelera"** de Clientes) o está inactivo (`status=false`), no aparece. Si
  además no tiene **ninguna** bandera de tipo, el cliente está en el estado **"Sin clasificar"** de
  Clientes (DISTINTO de Papelera); ver `modulos/clientes.md` §10 para el diagnóstico completo. La
  corrección de datos (marcar la bandera `inversionista`) se hace en **Clientes (clave 300)**.
  - **⛔ Regla transversal (v2.56.0):** este selector de Ventas→Planes **ya excluía correctamente** la
    papelera desde antes de v2.56.0 (por eso no tuvo cambio de código en ese cierre). La regla general —
    "un cliente en Papelera (`pruebas=true`) desaparece de TODOS los selectores operativos, no solo de
    este" — quedó **confirmada como invariante del sistema** en v2.56.0, tras corregir el mismo hueco en
    **Arrendatarios → Planes de Renta** y **Fideicomiso → Aportaciones** (que sí se colaban clientes
    archivados). Ver `modulos/clientes.md` §10 para el detalle completo y el listado de qué selector se
    corrigió y cuál ya cumplía. **Síntoma equivalente:** "el cliente existe pero no lo encuentro para
    asignarlo en Ventas" → está en **Papelera**; se restaura editándolo en **Clientes** y marcándole la
    casilla del tipo correspondiente.
- **"La nave no aparece disponible para vincular/vender"** → el selector de naves disponibles
  (`PlanesService.navesDisponibles()`, Config → Propiedades) exige **`naves.situacion='Disponible'`**
  (NO depende de la columna `Arrendada`, que es del módulo Arrendatarios). Al vincularla a un
  inversionista pasa a `situacion='Vendida'` y deja de listarse; vuelve a `'Disponible'` solo si se
  **desvincula** (botón 🗑 de la tarjeta), y eso **solo se permite si la propiedad NO tiene plan de
  pagos** (`tienenPdp`/`idPdp`).

### 9a. Detectar un **plan de pagos huérfano** ("con plan" pero no muestra nada)

**Síntoma:** *"la nave/propiedad me sale «(con plan)» pero al abrirla dice «El plan no tiene parcialidades»"*,
*"el plan no me aparece"*, *"total del plan en $0"*, *"no encuentro dónde está la falla del plan"*. También
impide **desvincular** la nave (el botón 🗑 no se permite si hay `idPdp`).

**Regla de datos (gotcha central):** el sistema marca **"(con plan)"** con solo ver que
**`propiedades.idPdp IS NOT NULL`** — **NO valida** que ese plan **exista de verdad** (ni el maestro en `pdp`,
ni la corrida en `pdpDetalle`). La bandera `propiedades.tienenPdp` es aún **menos fiable** (puede estar en
`false` con el `idPdp` puesto). Por eso un `idPdp` puede quedar **apuntando al vacío** (plan borrado o alta a
medias) y la nave se sigue viendo "con plan".

**Cadena de un plan SANO** (venta): `propiedades.idPdp → pdp` (maestro: montos) `→ pdpDetalle` (corrida:
parcialidades) `→ pagos`. *(Renta, análogo: `arrenPropiedades.idArrePdp → arrePdp → arrePdpDetalle`; ver
`modulos/arrendatarios.md`.)*

**Cómo deducir que un `idPdp` está huérfano (con `consultar_datos`):**
1. Toma el `idPdp` de la propiedad: `SELECT "idPdp" FROM propiedades WHERE "idPropiedad"=…` (o el que reporta
   "(con plan)").
2. **¿Existe el maestro?** `SELECT count(*) FROM pdp WHERE "idPdp"=<idPdp>` → **0 = huérfano** (no hay
   cabecera del plan).
3. **¿Existe la corrida?** `SELECT count(*) FROM "pdpDetalle" WHERE "idPropiedad"=<idPropiedad>` → **0 = sin
   parcialidades** (por eso "El plan no tiene parcialidades" / total $0).
4. **¿Hay algo colgando?** `pagos WHERE "idPdp"=<idPdp>` (y `fidePdpDispersion` si aplica). Si todo es 0, el
   `idPdp` **solo** vive en `propiedades` = puntero a la nada.

**Contraste CLAVE antes de proponer arreglo:**
- **Puntero vacío** (maestro 0 **y** corrida 0): no hay datos que perder → limpiar es seguro.
- **Datos colgados** (corrida > 0 con maestro 0, p. ej. parcialidades sin cabecera): **NO borrar** — hay datos
  reales que perderían su plan; **escalar** para reconstruir el maestro.

**Solución (desde v2.63.0, SIN intervención técnica):** el propio usuario con clave **610** lo resuelve en
la UI: **Ventas → Planes → ⚙ Configuración → Plan de Pagos → seleccionar la propiedad → «Desactivar» (si
está activo) → «Eliminar plan»**. El sistema valida solo que ninguna parcialidad tenga pagos (si los hay,
rechaza y el historial se conserva) y libera la propiedad para desvincular la nave o crear un plan nuevo.
Todo queda auditado (quién, cuándo y qué se borró). ⚠️ Si el plan **sí tiene pagos**, la eliminación se
rechaza por diseño — ahí el diagnóstico sigue siendo del agente: **escalar** al responsable (no hay vía de
UI para borrar planes con historial financiero, a propósito). Si el cliente es **real**, confirmar primero
si esa nave **debía** tener plan (se borró por error → reconstruir) o nunca lo tuvo (→ eliminarlo por la UI).
**Prevención (v2.63.0):** este estado ya no puede crearse vaciando partidas — la última parcialidad no se
puede eliminar (candado front + backend).
