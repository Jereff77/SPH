---
modulo: Arrendatarios
estado: desarrollado
version_doc: 1.2
ultima_actualizacion: 2026-06-10
rutas_v2: [/arrendatarios, /arrendatarios/planes, /arrendatarios/reportes]
rutas_v1: [i02_arrendatarios]
claves_permiso: [10, 20, 21, 22, 23, 24, 25]
tablas: [inversionista, arrenPropiedades, arrePdp, arrePdpDetalle, arreConceptos, inversionista_docs, naves, parques, inpc, movbancarios, v_arrendadasNaves, catUsers, segModulos]
rpcs: [arrepdp_crear_plan_simple_rpc, arrepdp_generar_corrida_desde_plan_simple, arrepdpdetalle_aplicar_meses_gracia, arrepdpdetalle_obtener_resumen_por_plan, arrepdpdetalle_actualizar_campo_manual, arrepdp_agregar_concepto_financiado, arrepdp_eliminar_plan_con_restricciones, aplicar_pago_arrendatario, pagos_arrendatarios, contratos_por_vencer, contratos_vencidos_sin_renovacion, movbancarios_sin_aplicar, v2_arrepdp_renovar, v2_arrepdp_activar_renovaciones, v2_arrepdp_cancelar_anticipado]
palabras_clave: [arrendatario, inquilino, renta, arrendamiento, contrato, arrePdp, plan de renta, corrida, vigencia, meses de gracia, cortesía, concepto financiado, KVA, INPC, cobranza, aplicar pago, depósito, contrato por vencer, contrato vencido, liberar nave, renovación, renovar plan, fecha fin, fecFin, cancelación anticipada, cancelar contrato, motivo cancelación, reportes, exportar, permisos por botón]
relacionado_con: [parques, clientes, inversionistas, cxp]
---

# Módulo: Arrendatarios

Administra el **arrendamiento de naves**: planes de pago de renta (contratos), su
corrida mensual con ajuste por **INPC**, meses de gracia, conceptos financiados
(KVAs) y la **cobranza** (aplicación de depósitos bancarios a las rentas).

> ⚠️ **Gotcha clave — `idArrendador = idInversionista`.** El arrendatario es un
> registro de la tabla `inversionista` (con `arrendatario = true` o
> `usuarioFinal = true`); su nombre se obtiene de `inversionista.razonsocial`. En
> la UI vieja la columna se llamaba "Arrendador", pero el término correcto es
> **arrendatario** (inquilino que paga renta).

## Pantallas (v2)

| Ruta | Clave | Qué hace |
|---|---|---|
| `/arrendatarios/planes` | 20 | Selector arrendatario → propiedad → historial de planes (`arrePdp`) → **corrida** (tabla con expandible por partida y edición de campos por doble clic). Botones de acción **gateados por permiso**: **Configuración** (⚙, clave **25**), **Renovar** (clave **23**), **Cancelación anticipada** (clave **22**), **Liberar nave** (clave **24**). **Consulta INPC** (sin gating). |
| `/arrendatarios/reportes` | 20 | **Reportes** del módulo (visible para quien tenga acceso al módulo). Primer reporte: **Cancelaciones Anticipadas** (tabla ordenable con filtros año/parque/búsqueda + export **CSV/PDF**). Estructurado con pestañas para sumar más reportes. |
| `/arrendatarios` | 10 | **Dashboard de cobranza** (réplica del de v1): barra de stats (Naves / Naves pendientes / Monto pendiente MXN / Cobrado MXN), toggle **Todos/Pendientes/Pagados**, filtro de **divisa** (Ambos/MXN/USD) y periodo (Mes con "Todos" / Año). **Tabla agrupada por nave+parque+razón social** con columnas Pendiente MXN, USD (pend/cob), Cobrado MXN; **filtros por columna** (nave/parque/razón social/concepto), **orden** por clic, **tooltip de desglose por concepto** al pasar el cursor sobre los montos, filas en rojo (todo pendiente)/verde (todo pagado) y **fila de totales** al pie. Botón **💲** por arrendatario con pendientes → modal. **Sidebar de vencimientos colapsable**: Vencidos (con días) + Próximos a 1/2/3 meses (calculados por `fec_fin`). **Aplicar pago** (modal por razón social: depósitos `movbancarios_sin_aplicar` + naves pendientes con checkbox, validación Exacto/Sobrante/Insuficiente). En vivo por SSE. **Export CSV** (botón ⬇ en el encabezado): exporta lo que se ve (respeta filtros), 1 fila por nave+divisa con columnas Nave/Parque/Razón Social/Divisa/Pago(pendiente)/Cobrado + desglose Renta/Vig/Admin/Mtto/Otros Conceptos + Nota (detalle textual de "otros"). |

> **🔐 Permisos por botón (Planes de Renta).** Claves existentes en `segModulos`: 20 (acceso al módulo/sección),
> 21 (reCalcular), 22 (Cancelacion), 23 (Renovar), 24 (Liberar — **nueva**), 25 (Configuracion — **nueva**). El
> backend exige la clave por endpoint (`@RequierePermiso`) y el frontend oculta el botón con `tienePermiso(clave)`.
> Los usuarios `isSupport` ven/pueden todo. La sección **Reportes** usa la clave **20**.

**Configuración (⚙)** — 4 sub-pestañas: **Datos Generales** (solo lectura; el
alta/edición del padrón vive en **Clientes**), **Documentos** (bucket `Documentos`),
**Propiedades** (vincular naves), **Plan de Pagos** (réplica del PDP de v1).

La tab **Plan de Pagos** tiene **layout de 2 columnas** (modal ampliado):
- **Izquierda** — si la propiedad **no** tiene plan: formulario **Generales** (fecha inicio,
  plazo, m² construcción, INPC+, depósito, moneda + 4 conceptos Renta/Administración/
  Mantenimiento/Vigilancia con **$ x m² · SubTotal en vivo (=$xm²·m²) · meses de gracia** y
  **Total Mes** en vivo) y botón **Crear** (orquesta las 3 RPCs). Si **sí** tiene plan:
  acciones (Activar/Desactivar/Eliminar), **Cargos** (concepto Adecuaciones/Otros servicios/
  Otro libre, Monto, Dividir, Mes inicio, Periodo → `arrepdp_agregar_concepto_financiado`) y
  lista de **Conceptos** (eliminar solo los cargos KVA; los base Renta/Admin/Mtto/Vig/Depósito
  y sus "(Cortesia)" no se eliminan).
- **Derecha** — **Previsualización** de la corrida (lee el **detalle**, sirve para el plan recién
  creado aún **inactivo**): #, Año, Concepto, Fecha, **Param** ($m²/m² apilados), Monto; resalta
  meses de gracia. Se refresca al crear, agregar/eliminar cargo o activar.

## Cómo funciona el cálculo (importante)

El **motor de cálculo de la corrida** (INPC, ciclos, cortesías, conceptos
financiados) **vive en RPCs de la base de datos** (`arrepdp_*`). v2 **no las
re-implementa**: el backend las invoca con `service_role` (con la identidad del
actor para auditoría). Crear un plan orquesta **3 RPCs en secuencia**:
1. `arrepdp_crear_plan_simple_rpc` → cabecera (`arrePdp`).
2. `arrepdp_generar_corrida_desde_plan_simple` → detalle/corrida (`arrePdpDetalle`).
3. `arrepdpdetalle_aplicar_meses_gracia` → marca los meses de gracia.

## Reglas de negocio

- **Vigencia (`arrePdpVigente`):** `Si` (vigente, editable) → `3 Meses` → `2 Meses`
  → `1 Mes` → `No` (vencido, **no editable**). El orden del enum ya refleja esta
  prioridad. Las partidas solo se editan si el plan **no** está en `No`.
- **Activar un plan (`pdpActivo`)**: congela renta base y periodo. La corrida solo
  se muestra si el plan está activo.
- **Liberar la nave**: en Planes de Renta, cuando **todos** los planes de la nave están
  vencidos (`arrePdpVigente='No'`) y ninguno está activo (`pdpActivo=false`), aparece el botón
  **🔓 Liberar nave**. Hace baja lógica del vínculo (`arrenPropiedades.status=false`) y marca
  `naves.Arrendada=false`, dejando la nave **disponible para rentar de nuevo**; los planes y
  pagos **se conservan** como histórico. El backend revalida la condición (no se confía en la UI).
  No existía en v1.
- **Renovación de plan** (no existía en v1): cuando al plan le faltan **≤3 meses** o ya venció,
  aparece el botón **🔄 Renovar** en Planes de Renta. Abre un modal **precargado con los datos del
  último mes** del plan anterior (la renta ya incrementada por INPC); la **fecha de inicio es fija =
  fin del vigente + 1 día** (no se superpone). Al registrar, se crea el plan de renovación **sin tocar
  el vigente** (RPC `v2_arrepdp_renovar`). Reglas: solo renovable a ≤3 meses/vencido, sin segunda
  renovación, sin solape.
  - **Activación automática**: un job pg_cron diario (`v2-arrepdp-activar-renovaciones`, 02:00) ejecuta
    `v2_arrepdp_activar_renovaciones()`: cuando el plan vigente vence, la renovación pasa a ser el plan
    activo (apunta `arrenPropiedades` a ella, `pdpActivo=true`) **sin intervención del usuario**. Corre
    antes del job de desvinculación (07:30), así esa nave no se libera.

- **Cancelación anticipada** (no existía en v1; botón 🛑, clave **22**): termina un contrato **antes**
  de su `fecFin`. Solo aparece en el **plan activo y vigente** (`pdpActivo=true`, `arrePdpVigente≠'No'`).
  El usuario elige **a partir de qué partida (mes)** dejar de cobrar y captura un **motivo** (texto libre
  obligatorio). Efectos (RPC transaccional `v2_arrepdp_cancelar_anticipado`):
  - **Baja lógica** de las partidas desde el corte (`arrePdpDetalle.status=false`, `numPartida ≥ corte`);
    los meses anteriores se conservan. La RPC de corrida ya filtra `status=true`, así que esos meses
    desaparecen de la corrida/cobranza.
  - **No se cancelan meses ya pagados**: el corte debe ser posterior al último mes con `fecPago` (se valida
    server-side; la precarga indica la primera partida cancelable).
  - **No se toca `plazo`/`fecFin`** (la decisión de negocio fue conservar el fin contractual original). El
    fin efectivo se guarda en la **columna nueva `arrePdp.fecCancelacion`** (= fecha de la partida de corte).
    Se marca también `canceladoAnticipado=true`, `canceladoPor` (uid) y `motivoCancelacion`.
  - **`arrePdp.vigente=false`** (saca el contrato del sidebar "por vencer", que usa `vigente`). ⚠️ El cron
    `arrepdp-actualizar-vigencia` (01:00) recalcula `arrePdpVigente` **solo desde `fecFin`**, así que el
    enum puede volver a "vigente"; es **irrelevante** porque la nave queda liberada (no se muestra) y la
    verdad del estado la da `canceladoAnticipado`.
  - **Libera la nave** (igual que "Liberar nave": `arrenPropiedades.status=false/pdpActivo=false`,
    `naves.Arrendada=false`); el plan/pagos se conservan como histórico (no navegable una vez liberada).

- **Fecha fin del plan (`fecFin`)**: es una **columna generada** en `arrePdp` =
  `fecInicio + plazo meses − 1 día` (el contrato termina el día anterior al "mismo día" N meses
  después; ej. inicio 1-jun-2023, plazo 36 → fin 31-may-2026). **No se captura ni se edita**, se
  calcula sola. (Hasta jun-2026 la fórmula no restaba el día; se corrigió.)

## Reportes (clave 20)
- **`/arrendatarios/reportes`** (`ReportesArrePage.tsx`, lazy). Calca el patrón de **Ventas → Reportes**
  (`Tabs` + filtros + tabla `useSort`/`SortableTh` + export). El CSV vive en `csv-export.ts` (ligero, sin
  jsPDF, para que el Dashboard no arrastre jsPDF al bundle principal); el PDF en `reportes-arre-export.ts`
  (`exportarPDF` simple y `exportarPDFConEncabezado` con logo).
- **Estado de Cuenta** (tab, `reportes-arre.service.ts` → `estadoCuenta`): **mismo formato que el export del
  Dashboard de cobranza** pero como reporte. Estado de cuenta **acumulado** (planes activos, RPC
  `pagos_arrendatarios`), agrupado por **nave + cliente + divisa**, con desglose por concepto
  (Renta/Vig/Admin/Mtto/Otros + Nota) y totales Pago(pendiente)/Cobrado. Excluye Tickets. Filtros (en
  cliente): parque, nave, cliente, divisa. Export **CSV** y **PDF con encabezado (logo SPH + título +
  fecha)**. Endpoint `GET /arrendatarios/reportes/estado-cuenta`.
- **Cancelaciones Anticipadas** (tab): lista los `arrePdp` con `canceladoAnticipado=true`,
  enriquecidos **en memoria sin vistas** (backend `reportes-arre.service.ts` → `cancelaciones()`): arrendatario
  (`inversionista`), parque/nave (`arrenPropiedades`+`naves`+`parques`, **excluye Tickets**), quién canceló
  (`catUsers.nomCompleto`). Columnas: Arrendatario · Parque · Nave · Inicio · Fin contractual · Fecha
  cancelación · Motivo · Canceló · Moneda. Filtros año/parque/búsqueda + export CSV/PDF.
- Endpoint `GET /arrendatarios/reportes/cancelaciones` (`@RequierePermiso(20)`).

## Objetos nuevos en BD (v2_, autorizados)
- RPC `v2_arrepdp_renovar(...)` — registra la renovación (inserta `arrePdp` + corrida vía RPCs
  existentes), sin tocar el plan vigente.
- RPC `v2_arrepdp_activar_renovaciones()` — transición automática al vencer.
- Job pg_cron `v2-arrepdp-activar-renovaciones` (diario 02:00).
- RPC `v2_arrepdp_cancelar_anticipado(p_id_arre_pdp, p_uid, p_num_partida_corte, p_motivo)` — cancelación
  anticipada transaccional (baja lógica de partidas + marca de cancelación + `vigente=false` + libera nave).
  `SECURITY DEFINER`, `EXECUTE` solo a `service_role`; se invoca con `comoActor` (auditoría).
- **Columnas nuevas en `arrePdp`** (tabla compartida, autorizadas): `canceladoAnticipado` (bool),
  `fecCancelacion` (date), `canceladoPor` (uuid), `motivoCancelacion` (text). Auditadas por `trg_auditoria`.
- **Permisos nuevos en `segModulos`**: clave **24** ('Liberar') y **25** ('Configuracion') — Planes de Renta.
- SQL en `base-conocimiento/migraciones/2026-06-10-cancelacion-anticipada.sql`. **Tras aplicar el ALTER,
  regenerar `database.types.ts`** (el código usa casts localizados hasta entonces).
- **Modificado del sistema viejo (autorizado)**: la columna generada `arrePdp."fecFin"` se redefinió
  para restar 1 día (`fecInicio + plazo − 1 día`).
- **Meses de gracia (`tieneMesGratis` = `Si`/`Medio`/`No`)**: las partidas con
  cortesía se **resaltan en amarillo** y no se cobran (o medio mes).
- **Divisas (MXN/USD)**: la cobranza agrupa y totaliza **por divisa por separado**;
  nunca se suman MXN + USD (tarjetas y fila de totales al pie de la tabla, una por divisa).
- **Parques de Tickets excluidos**: en **todo** el módulo (selectores de parque/nave,
  propiedades arrendadas, tabla de cobranza y vencimientos) se ocultan los parques con
  `esTicket = true` (p. ej. "A3 (Tickets)") — los tickets se gestionan en Ventas, no aquí.
- **Aplicar pago**: se valida server-side **importe del depósito ≥ suma de las
  partidas** → `Insuficiente` (se rechaza), `Exacto` o `Sobrante` (permitido). Solo
  se aplican partidas de la **misma divisa** que el depósito; un depósito ya
  `aplicado` no se reaplica. La operación es transaccional (`aplicar_pago_arrendatario`).

## Datos / tablas

- `inversionista` — el arrendatario (gotcha arriba).
- `arrenPropiedades` — vínculo nave↔arrendatario (PK `idNavArrend`, `idArrendador`,
  `idParque`, `idNave`, `tienePdp`, `pdpActivo`).
- `arrePdp` — cabecera del plan (`idArrePdp`, fechas, plazo, depósito, precios m²,
  INPC/INPCPlus, `Moneda`, `arrePdpVigente`).
- `arrePdpDetalle` — corrida/partidas (`numPartida`, `anio`, `concepto`, `pm2`,
  `constM2`, `INPC`, `ptsINPC`, `cantidad`, `tieneMesGratis`, `fecPago`,
  `comprobantePago`).
- `arreConceptos` — conceptos financiados (KVAs/adecuaciones).
- `inversionista_docs` — documentos (bucket público `Documentos`).
- `naves` (`Arrendada`), `parques`, `inpc`, `movbancarios` (depósitos `idtipo=2`).
- `v_arrendadasNaves` — naves arrendadas de un arrendatario.

## Seguridad (vs. v1)

- v1 tenía un **dashboard WebView con `@supabase/supabase-js` por CDN y la anon key
  hardcodeada**, y armaba SQL en el cliente (RPC `cdg`). **v2 lo elimina**: el
  frontend solo habla con `/api/arrendatarios/*` (JWT); ninguna key de Supabase
  llega al navegador.
- Toda escritura se audita server-side (`comoActor` + triggers de BD) y, en crear/
  eliminar plan y aplicar pago, se registra además en `actividad`.

## Para el agente de soporte

- "No puedo editar la renta" → el plan probablemente está en **vigencia `No`**
  (vencido) o **no está activo**; solo los planes vigentes y activos permiten editar
  partidas.
- "El depósito no me deja aplicar" → es **Insuficiente** (importe menor a la suma de
  partidas) o las partidas son de **otra divisa** que el depósito.
- "El arrendatario no aparece" → debe estar marcado como `arrendatario`/`usuarioFinal`
  y activo en **Clientes**.
- "No veo el botón de Configuración / Renovar / Cancelación / Liberar" → es por **permiso**: cada botón
  exige su clave (Config=25, Renovar=23, Cancelación=22, Liberar=24). Pídele al administrador que te asigne
  la clave en **Configuraciones → Permisos** (los usuarios de soporte ven todo).
- "No puedo cancelar a partir de ese mes" → no se pueden cancelar **meses ya pagados**: el corte debe ser
  posterior al último mes con pago aplicado. El botón de cancelación solo aparece en el **plan activo y vigente**.
- "Cancelé un contrato y la nave desapareció" → es lo esperado: la cancelación anticipada **libera la nave**
  (queda disponible para rentar de nuevo). El contrato cancelado queda en el reporte **Cancelaciones Anticipadas**.
- "¿Dónde veo los contratos cancelados?" → en **Arrendatarios → Reportes → Cancelaciones Anticipadas**
  (con arrendatario, nave, fechas, motivo y quién canceló; exportable a CSV/PDF).
