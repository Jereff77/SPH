---
modulo: Fideicomiso
estado: parcial
version_doc: 1.1
ultima_actualizacion: 2026-06-11
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
| **Dispersion** `/fideicomiso/dispersiones` | 530 | Por fideicomiso + periodo (1ra..20ma): resumen por adherente (Nombre, Personalidad, Adhesión, Monto Inversión, Renta del Trimestre, Retención ISR, Dispersión Trimestral) ordenable + totales. **Filtros**: por nombre, personalidad (Física/Moral), adhesión, Limpiar, y "Solo con fin de promoción en este periodo" (`dias_promocion>0 && dias_normal>0`). **Clic en el nombre → Desglose Detallado** (tabla por pago: Monto Inversión, Fecha Pago, Días Efectivos, Rendimiento Anual %/$ [=monto×tasa], Renta del Trimestre, Retención ISR, Dispersión Trimestral; Resumen Total) con **export PNG** (html-to-image) y **CSV**. ⚠️ Gotcha: el RPC trae los campos invertidos — **`rfc_inversionista` = NOMBRE**, `nombre_inversionista` = RFC. |
| **Reportes** `/fideicomiso/reportes` | 540 | **Kardex** de dispersiones por inversionista **+ filtro por Propiedad** (recalcula KPIs/totales/dona server-side) **+ toggle "Mostrar"**: «Solo los que ya pasaron» (fecfin≤hoy) o «Todos los meses (con cálculos)» — muestra también los cálculos de los meses futuros (las filas futuras ya traen `calculo`/`dispersion`); los totales del pie se ajustan a lo mostrado. Tarjeta resumen: dona Pagados/Pendientes + KPIs (izq) e info Personalidad/Rendimiento (der). **Export a PDF (jsPDF) y Excel (.xlsx, ExcelJS)**, ambos con **logo + diseño** (encabezado azul, tabla, totales); `kardex-export.ts`, ambas libs cargadas de forma diferida. |

## Reglas de negocio clave (replicadas de v1)
- **Estado "Pagado" (Kardex):** `status === true Y fecfin <= hoy` (comparando solo la fecha, en horario de
  México). En otro caso, "Pendiente".
- **Totales del Kardex:** `cálculo`, `comisión SPH` (`calculo_comsph`), `retención ISR` y `dispersión` se
  suman **solo de las filas pagadas**.
- **Rendimiento promedio:** promedio de `rend` sobre **todas** las filas del inversionista.
- **Fórmula de cálculo mostrada:** `((monto × rend%) / 365) × días` (interés simple proporcional).
- **Dispersiones:** las calculan las RPC **`_corregido`** (versión vigente; las versiones sin sufijo son
  obsoletas — ver `OBSOLESCENCIA-BD.md`): `plan_dispersiones_dinamico_corregido`,
  `resumen_dispersion_dinamico_corregido`, `resumen_fideicomiso_completo_corregido`.
- **Contabilidad (pivote):** lo generan las funciones Postgres `pivot_contabilidad(p_anio smallint)` y
  `pivot_contabilidad_totales(p_anio smallint)`. El año es **obligatorio** (sin el default 2026 de v1). El
  pivote devuelve además `notas` (JSONB `{mes: texto}`) por fila. El **gran total** es la fila de totales cuyo
  `tipo` contiene "GRAN".
- **Contabilidad (escrituras):** toda operación que en v1 hacía el WebView con la anon key ahora pasa por el
  backend con `comoActor(uid)`: editar celda (`PATCH celda`), toggle IVA (`PATCH celda-iva`), alta de
  movimiento con reemplazo de duplicado (`POST movimientos`, responde 409 con los datos del existente para
  confirmar), alta de concepto (`POST conceptos`), y saldo del banco (`PUT`/`DELETE saldos`). Cada cambio en
  `fideContabilidad` registra una fila en `fideContaHistorial` (antes/después + snapshot), igual que v1.
- **Nota:** el `signo-hint` (Ingreso/Egreso) de v1 referenciaba `fideContaConceptos.es_ingreso`, columna que
  **no existe** en la BD; se omite (no se inventa ese dato).

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
