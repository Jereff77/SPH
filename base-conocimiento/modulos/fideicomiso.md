---
modulo: Fideicomiso
estado: parcial
version_doc: 1.2
ultima_actualizacion: 2026-06-15
rutas_v2: [/fideicomiso/dashboard, /fideicomiso/aportaciones, /fideicomiso/adhesiones, /fideicomiso/contabilidad, /fideicomiso/dispersiones, /fideicomiso/reportes]
rutas_v1: [i06_fideicomiso]
claves_permiso: [500, 510, 511, 520, 530, 540]
tablas: [fidePdpDispersion, fideicomiso, fideCondiciones, fide_periodos_dispersion, fideContabilidad, fideContaConceptos, fideContaHistorial, fideSaldosBanco, v_fideicomiso, v_propiedadesfide, v_pagos]
palabras_clave: [fideicomiso, dispersión, dispersiones, aportación, aportaciones, adhesión, adhesiones, rendimiento, kardex, ticket, contabilidad, pivote, concepto contable, inversión, rendimiento promedio, retención ISR, comisión SPH]
relacionado_con: [inversionistas, clientes, parques]
---

# Módulo: Fideicomiso

> **Estado: DESARROLLADO en v2.** Todas las secciones del menú de v1 están migradas: Dashboard,
> Aportaciones (con su **Configuración del propietario** completa: datos, documentos, naves, condiciones y
> Plan de Pagos), Adhesiones, Contabilidad, Dispersión y Reportes (Kardex).

## Qué hace
Gestiona el ciclo de inversión bajo esquema de **fideicomiso** ("Tickets"): inversionistas aportan capital
asociado a propiedades/naves y reciben **dispersiones** (rendimientos periódicos calculados por interés
simple proporcional sobre el monto aportado). Incluye además la **contabilidad** del fideicomiso.

Hay **un solo fideicomiso** activo: *Fideicomiso Innovación SPH* (`idFide = jsRw4C6FswY20O`).

## Pantallas (menú idéntico a v1: Dashboard · Aportaciones · Adhesiones · Contabilidad · Dispersion · Reportes)

| Menú / Ruta | Clave | Qué hace |
|---|---|---|
| **Dashboard** `/fideicomiso/dashboard` | 500 | Tabla de la vista `v_fideicomiso`: Inversionista, No. Adhesión, PM, Medio, Bloque, $ Apartado, Fecha 1er Pago, Cantidad Partidas, Valor Ticket, Rendimiento. **Es la MISMA pantalla que "Adhesiones"** (en v1 ambos ítems del menú abren `AdhesionesWidget`). |
| **Aportaciones** `/fideicomiso/aportaciones` | 510 | Réplica de `aportaciones_widget` de v1: selector inversionista (+ **engrane ⚙️ → Configuración completa**, ver abajo) → propiedad-ticket → tabla de `v_pagos` con # / Tipo Pago / **Fecha Plan (editable inline → `pdpDetalle.fecha`)** / Plan de Pagos (`monto`) / Fecha Pago / Pagos / Balance (`pagos−monto`) / % Avance / **opciones**: **$ Pagos** (lista de `pagos`, ver comprobante, eliminar, y **agregar pago de ticket** [`tipomovimiento=3`] con IVA opcional + comprobante a bucket `cxp`) y **💬 Comentarios** (`v_comentarios` + alta en `comentarios`). Reutiliza `PagosVentaService`/`EscriturasService` de Ventas. |
| **Configuración del propietario** (engrane ⚙️ de Aportaciones) | 510 | Réplica COMPLETA de `config_propietario_fide` de v1 (`ConfigFideModal`): selector de propiedad + 5 pestañas. **Datos Generales** (edición de `inversionista`), **Documentos** (subir PDF a bucket `Documentos` + lista + eliminar, sobre `inversionista_docs`), **Propiedades/Naves** (alta de nave-ticket: parque-ticket + nave A–E + ID 1–4 → INSERT `naves`+`propiedades`; lista tipo DatTickets con valor/pagos/avance y **eliminar** vía RPC `propiedades_eliminar_propiedad`), **Adhesiones/Condiciones** (`fideCondiciones`: adhesión, PM, medio, apartado, rendimiento 1–12, Prom9%, comentarios; INSERT/UPDATE), **Plan de Pagos** (genera PDP Único/Enganche/Parcialidad [monto=valor/N, fechas mensuales]; tabla editable de partidas [fecha/monto/tipo] con **recálculo por enganche** vía RPC `pdpdetalle_reevaluar_monto_por_enganche`; totales vs `v_totales`; **Activar** [si cuadran], **Desactivar**, **Eliminar** PDP). Reutiliza `PlanesService` (datos/docs) + `ConfigFideService`. |
| **Adhesiones** `/fideicomiso/adhesiones` | 520 | Misma vista que Dashboard (`v_fideicomiso`), accesible también con la clave 520. |
| **Contabilidad** `/fideicomiso/contabilidad` | 520 | Réplica fiel del grid Excel de v1: tabla pivote por año (Ene..Dic + subtotales + GRAN TOTAL), **edición inline** de cada celda/mes, **toggle de IVA** por celda (punto), **notas** por celda (tooltip), fila **Saldo estado de cuenta** (banco) con conciliación vs gran total (tolerancia 0.80, ✓ cuadrado / diferencia), **filtros por columna** (texto y signo +/0/−), **alta de movimientos** (cascada + notas + IVA + monto, con reemplazo si ya existe) y **+ Catálogo** (alta de conceptos). Cada cambio se audita y registra en `fideContaHistorial`. |
| **Dispersion** `/fideicomiso/dispersiones` | 530 | Por fideicomiso + periodo (1ra..20ma): resumen por adherente (Nombre, Personalidad, Adhesión, Monto Inversión, Renta del Trimestre, Retención ISR, Dispersión Trimestral) ordenable + totales. **Filtros**: por nombre, personalidad (Física/Moral), adhesión, Limpiar, y "Solo con fin de promoción en este periodo" (`dias_promocion>0 && dias_normal>0`). **Clic en el nombre → Desglose Detallado**: tabla con **una fila por cada ticket/pago de inversión del periodo seleccionado** (Monto Inversión, Fecha Pago, Días Efectivos [prorrateados según cuándo entró el capital al trimestre — p. ej. 81 días si el pago cayó dentro del trimestre], Rendimiento Anual %/$ [=monto×tasa], Renta del Trimestre, Retención ISR, Dispersión Trimestral) + Resumen Total que **suma** esas filas, con **export PNG** (html-to-image) y **CSV**. ⚠️ Gotcha: el RPC trae los campos invertidos — **`rfc_inversionista` = NOMBRE**, `nombre_inversionista` = RFC. |
| **Reportes** `/fideicomiso/reportes` | 540 | **Kardex** de dispersiones por inversionista **+ filtro por Propiedad** (recalcula KPIs/totales/dona server-side) **+ toggle "Mostrar"**: «Solo los que ya pasaron» (fecfin≤hoy) o «Todos los meses (con cálculos)» — muestra también los cálculos de los meses futuros (las filas futuras ya traen `calculo`/`dispersion`); los totales del pie se ajustan a lo mostrado. Tarjeta resumen: dona Pagados/Pendientes + KPIs (izq) e info Personalidad/Rendimiento (der). **Export a PDF (jsPDF) y Excel (.xlsx, ExcelJS)**, ambos con **logo + diseño** (encabezado azul, tabla, totales); `kardex-export.ts`, ambas libs cargadas de forma diferida. |

## Reglas de negocio clave (replicadas de v1)
- **Estado "Pagado" (Kardex):** `status === true Y fecfin <= hoy` (comparando solo la fecha, en horario de
  México). En otro caso, "Pendiente".
- **Totales del Kardex:** `cálculo`, `comisión SPH` (`calculo_comsph`), `retención ISR` y `dispersión` se
  suman **solo de las filas pagadas**.
- **Rendimiento promedio:** promedio de `rend` sobre **todas** las filas del inversionista.
- **Fórmula de cálculo mostrada:** `((monto × rend%) / 365) × días` (interés simple proporcional).
- **Dispersiones:** las calculan las **mismas RPC que v1** (SIN sufijo, vigentes):
  `plan_dispersiones_dinamico`, `resumen_dispersion_dinamico`, `resumen_fideicomiso_completo`.
  ⚠️ **Corrección v2.27.1:** se dejaron de usar las variantes `_corregido`.
  `plan_dispersiones_dinamico_corregido` está **DEFECTUOSA**: itera `fidePdpDispersion` (periodos de
  dispersión planeados) en vez de `pagos` (pagos reales), por lo que el Desglose Detallado salía inflado
  —repetía cada ticket una vez por periodo histórico (verificado en producción: 11 filas en vez de 1, ó
  25 en vez de 9; montos multiplicados). Las `_corregido` de los **resúmenes** daban resultado idéntico
  al original. `plan_dispersiones_dinamico_corregido` queda como candidata a `DROP` (ver
  `OBSOLESCENCIA-BD.md` y `migraciones/2026-06-15-fideicomiso-dispersion-drop-rpc.sql`).
- **Contabilidad (pivote):** lo generan las funciones Postgres `pivot_contabilidad(p_anio smallint)` y
  `pivot_contabilidad_totales(p_anio smallint)`. El año es **obligatorio** (sin el default 2026 de v1). El
  pivote devuelve además `notas` (JSONB `{mes: texto}`) por fila. El **gran total** es la fila de totales cuyo
  `tipo` contiene "GRAN".
- **Contabilidad (escrituras):** toda operación que en v1 hacía el WebView con la anon key ahora pasa por el
  backend con `comoActor(uid)`: editar celda (`PATCH celda`), toggle IVA (`PATCH celda-iva`), alta de
  movimiento con reemplazo de duplicado (`POST movimientos`, responde 409 con los datos del existente para
  confirmar), alta de concepto (`POST conceptos`), y saldo del banco (`PUT`/`DELETE saldos`). Cada cambio en
  `fideContabilidad` registra una fila en `fideContaHistorial` (antes/después + snapshot), igual que v1.
- **⚠️ Gotcha — el pivote agrupa por `aplicaIVA` (síntoma: "renglón duplicado"):** `pivot_contabilidad`
  agrupa por `tipo, concepto, subconcepto, descripcion, aplicaIVA`. Por eso un mismo concepto cuyo mes tenga
  un `aplicaIVA` **distinto** al de los demás meses aparece **partido en dos renglones** (uno por valor de
  IVA), aunque en la BD haya un solo registro por mes (no es un duplicado real). El IVA **no es cosmético**:
  alimenta `BASE IVA`/`IVA (16%)` en `pivot_contabilidad_totales`. **Fix v2.30.2:** al **crear** una celda
  nueva (edición inline **o** modal «Nuevo») el `aplicaIVA` se **hereda** del concepto en vez de nacer en
  `false` — backend `ivaDelConcepto()` (mes hermano del mismo concepto/año → catálogo `fideContaConceptos` →
  `false`), `celdaSchema.aplicaIVA` opcional, el front manda `f.aplicaIVA` y el modal prerellena el IVA desde
  el catálogo. Antes, el insert inline (`guardarCelda`) **hardcodeaba `aplicaIVA:false`**, lo que partía la
  fila y dejaba el monto fuera de la base de IVA. Para **fusionar** un renglón ya partido (dato existente):
  encender el punto de IVA de esa celda (toggle `PATCH celda-iva`) hasta igualar el resto del concepto.
- **Nota:** el `signo-hint` (Ingreso/Egreso) de v1 referenciaba `fideContaConceptos.es_ingreso`, columna que
  **no existe** en la BD; se omite (no se inventa ese dato).
- **Contabilidad (exportar a Excel, v2.31.0):** botón «📊 Excel» → modal `ModalExportar` con selección de
  **uno o varios años** (el año visible viene marcado). La exportación es **client-side** con `ExcelJS`
  (carga diferida, chunk lazy) en `contabilidad-export.ts` (`exportarContabilidadExcel`), reutilizando el
  patrón de `kardex-export.ts` (logo vía `configuracionApi.getLogos()`, descarga por Blob). Genera **una hoja
  por año**, fiel a la pantalla: encabezado azul congelado (`#1f2a4d`) + 4 columnas fijas, columnas
  `# / Tipo / Concepto / Descripción / Ene..Dic / SubTotal`, negativos en rojo (`numFmt` con sección
  `[Red]`), marca de IVA (● naranja en la Descripción de los conceptos con `aplicaIVA`), filas de totales
  (`BASE IVA`/`IVA 16%`/`SIN IVA`/`GRAN TOTAL` en azul) y la fila `Saldo estado de cuenta`. Cada año se pide
  por separado al backend (`contabilidadPivote`/`contabilidadTotales`/`contabilidadSaldos` en paralelo); se
  exporta el **reporte completo** del año (no aplica los filtros de columna de la pantalla).

## Arquitectura v2 (seguridad)
- **El frontend NUNCA toca Supabase.** Se eliminaron los 3 patrones inseguros de v1: el WebView con HTML
  embebido + anon key (Dispersiones y Contabilidad de v1), `cdgEncryptConsult`/RPC `cdg` (SQL crudo) y el
  query builder desde el cliente. Todo pasa por el backend NestJS (`apps/api/src/modules/fideicomiso/`).
- **Autorización server-side** con `@RequierePermiso` por endpoint. En v1, `adhesiones` **no validaba
  permisos** (hueco de seguridad); en v2 exige permiso (500 ó 520).
- **Auditoría:** el alta de movimientos contables se escribe con `comoActor(uid)`; todas las tablas `fide*`
  tienen `trg_auditoria` → la traza queda en `auditoria` (no falsificable por el cliente).
- Backend: `kardex.service.ts`, `dispersiones.service.ts`, `contabilidad.service.ts`, `consultas.service.ts`
  (Dashboard/Adhesiones + Aportaciones), `fideicomiso.controller.ts`. Frontend: `features/fideicomiso/`
  (`DashboardPage`, `AportacionesPage`, `ContabilidadPage`, `DispersionesPage`, `KardexPage` [Reportes]).

## Permisos (catálogo `segModulos` — idénticos a v1, NO se creó ninguna clave nueva)
- **500** Dashboard · **510** Aportaciones · **511** Aportaciones·Modificar Rendimiento · **520** Adhesiones ·
  **530** Dispersión · **540** Reportes.
- **Contabilidad** comparte la clave **520** (igual que v1; no tiene sección propia en `segModulos`).
- **Dashboard (500)** y **Adhesiones (520)** son la misma vista: el endpoint `GET /fideicomiso/adhesiones`
  exige **cualquiera** de las dos (`@RequierePermiso(500, 520)`; el guard ahora soporta "any-of").
- El **Kardex** es la sección **"Reportes" (540)**.

## Configuración del propietario (engrane ⚙️) — backend
`config-fide.service.ts` + endpoints `GET/POST/PATCH/DELETE /fideicomiso/config/*` (clave 510). Reutiliza
`PlanesService` (getInversionista/actualizarInversionista, listarDocs/subirDoc/eliminarDoc) y
`EscriturasService` (editar fecha de partida). Front: `ConfigFideModal.tsx`. Constante: el `idFide` de las
condiciones se lee del fideicomiso activo (no se hardcodea). **Mejora vs v1:** los documentos sí guardan la
URL real del PDF (en v1 se insertaba `urldoc=''`, un bug).

## Pendiente
`nvo_ticket` de v1 (alta rápida de ticket en un paso: cadena naves→propiedades→pdp→pdpDetalle con
`tipoPago='Ticket'`) — la misma alta se logra hoy con Configuración (pestaña Propiedades + Plan de Pagos).
Evaluar si se agrega como atajo.

## Para el agente
- Si el usuario pregunta por **rendimientos/dispersiones** de un inversionista → Reportes/Kardex
  (`/fideicomiso/reportes`) o Dispersion (`/fideicomiso/dispersiones`).
- Si pregunta por **dar de alta una inversión / ticket / condiciones / plan de pagos del fideicomiso** → es
  el **engrane ⚙️ de Aportaciones** (Configuración del propietario): pestañas Propiedades (alta de nave),
  Adhesiones (condiciones) y Plan de Pagos.
- Gotcha: en `v_fideicomiso`, el campo `idfide` es en realidad el `idfideCond` (id de la condición), no el
  id del fideicomiso maestro.
