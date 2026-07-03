---
modulo: Arrendatarios
estado: desarrollado
version_doc: 1.3
ultima_actualizacion: 2026-06-15
rutas_v2: [/arrendatarios, /arrendatarios/planes, /arrendatarios/reportes]
rutas_v1: [i02_arrendatarios]
claves_permiso: [10, 20, 21, 22, 23, 24, 25]
tablas: [inversionista, arrenPropiedades, arrePdp, arrePdpDetalle, arreConceptos, inversionista_docs, naves, parques, inpc, movbancarios, v_arrendadasNaves, catUsers, segModulos]
rpcs: [arrepdp_crear_plan_simple_rpc, arrepdp_generar_corrida_desde_plan_simple, arrepdpdetalle_aplicar_meses_gracia, arrepdpdetalle_obtener_resumen_por_plan, arrepdpdetalle_actualizar_campo_manual, arrepdpdetalle_calcular_anio_por_plan, arrepdpdetalle_recalcular_anos_contrato, actualizar_anios_planes_nuevos, actualizar_ciclo_plan_pago, actualizar_inpc_por_ciclo, arrepdp_agregar_concepto_financiado, arrepdp_eliminar_plan_con_restricciones, aplicar_pago_arrendatario, pagos_arrendatarios, contratos_por_vencer, contratos_vencidos_sin_renovacion, movbancarios_sin_aplicar, v2_arrepdp_renovar, v2_arrepdp_activar_renovaciones, v2_arrepdp_cancelar_anticipado]
palabras_clave: [arrendatario, inquilino, renta, arrendamiento, contrato, arrePdp, plan de renta, corrida, vigencia, meses de gracia, cortesía, concepto financiado, KVA, INPC, actualizar INPC manual, INPC manual no funciona, no cambia el monto, lo modifica desde el año 1, desfase del año, anio desalineado, año por concepto, cobranza, aplicar pago, depósito, contrato por vencer, contrato vencido, liberar nave, renovación, renovar plan, fecha fin, fecFin, cancelación anticipada, cancelar contrato, motivo cancelación, reportes, exportar, permisos por botón, importar estado de cuenta, SPEI recibido, movbancarios, BanBajío, conciliación, depósito no aparece, estado de cuenta excel, rastreo]
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
| `/arrendatarios/planes` | 20 | Selector arrendatario → propiedad → historial de planes (`arrePdp`) → **corrida** (tabla con expandible por partida y edición de campos por doble clic). Botones de acción **gateados por permiso**: **Configuración** (⚙, clave **25**), **Renovar** (clave **23**), **Cancelación anticipada** (clave **22**), **Liberar nave** (clave **24**). **Consulta INPC** (sin gating). Recuadro **Estado del Contrato** (🟢 Vigente / 🟡 Por Vencer / ⚪ No Vigente) según el **plan seleccionado**, no el contrato global (v2.27.3). |
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

> 📌 **El monto NO se almacena, se calcula.** En `arrePdpDetalle`, **`cantidad = pm2 × constM2`** e
> **`inpcTotal = INPC + ptsINPC`** son **columnas generadas**. Por eso editar el `INPC` de una partida
> **no cambia el monto por sí solo**: el monto solo se mueve si cambia el `pm2`. El INPC incrementa el
> `pm2` del año **N** respecto al año **N−1** con la fórmula
> `pm2[N] = pm2[N−1] × (1 + (INPC[N] + ptsINPC[N]) / 100)`. Ese recálculo del `pm2` lo hace la RPC
> `arrepdpdetalle_actualizar_campo_manual` **solo cuando el año editado es ≥ 2** (el año 1 es la base, no
> se incrementa).

## IVA en la corrida (v2 — 2026-06-16)

> 📌 **Los conceptos de la corrida son SIN IVA**, pero las **transferencias bancarias** que paga el
> arrendatario llegan **con IVA del 16% incluido** (MXN y USD por igual). Por eso la cobranza muestra y
> valida **monto + IVA**.

- **Tasa:** sale de **`catParametros`** (`idCorto='iva'`, `valor=0.16`). *(No está en `SPHConfiguraciones`.)*
- **Regla de negocio:** el 16% aplica a **todos los conceptos EXCEPTO "Deposito Garantia"** (garantía, no
  contraprestación → IVA 0).
- **Columna persistida:** **`arrePdpDetalle.iva` `numeric NOT NULL DEFAULT 0`** = monto del IVA de la
  partida. Como `cantidad` es **generada**, el IVA lo mantiene un **trigger** (no es columna generada
  porque la tasa vive en `catParametros`, no en el DDL):
  - Función **`v2_arrepdpdetalle_calc_iva()`**: `iva = round(pm2 × constM2 × tasa, 2)`; `0` para Depósito
    Garantía. Usa `pm2 × constM2` (no `cantidad`) porque las **columnas generadas no existen en triggers
    BEFORE**.
  - Triggers **`trg_v2_iva_ins`** (BEFORE INSERT, siempre) y **`trg_v2_iva_upd`** (BEFORE UPDATE **OF**
    `pm2`,`constM2`,`concepto`). Así los crons diarios de v1 que tocan `anio`/`ciclo`/`fecPago` **no** lo
    disparan; quien cambia `pm2` (el flujo de **Incrementos INPC** —`modulos/incrementos-inpc.md`— o la
    edición manual) sí → recalcula el IVA, que es lo correcto. ⚠️ Corrección 2026-07-02: **NO existe
    ningún cron de INPC** (verificado en `cron.job`); antes del módulo de incrementos todo era manual.
  - SQL en `base-conocimiento/migraciones/2026-06-16-arrepdpdetalle-iva.sql` (incluye el backfill de las
    30,409 filas, hecho sin auditar con DISABLE/ENABLE de `trg_auditoria`).
- **Backend (`cobranza.service.ts`):** `pagos()` devuelve `monto = cantidad + iva` (+ `base` e `iva`
  sueltos); `aplicarPago()` valida el depósito contra `cantidad + iva` → así la transferencia con IVA da
  **"Exacto"**. El helper **`ivaDePartida(cantidad, concepto, tasa)`** replica EXACTAMENTE la regla del
  trigger (mantener ambos en sincronía); la tasa se lee de `catParametros` y se cachea 5 min.
- **Frontend:** el backend devuelve por fila `monto` (con IVA), `base` (sin IVA) e `iva`. El tablero tiene
  un **toggle "Con IVA / Sin IVA"** (junto al filtro de divisa) que cambia la fuente del monto en tabla,
  totales, tooltip y export CSV (`base` vs `base+iva`); la nota del encabezado refleja el modo. ⚠️ El
  **modal de aplicar pago siempre usa CON IVA** (es lo que cobra la transferencia y lo que valida el
  backend), independientemente del toggle — lleva la aclaración "(con IVA)".
- ⚠️ **Pendiente (no incluido aquí):** los **Reportes** de arrendatarios (Estado de Cuenta) y otros
  módulos que lean `cantidad` siguen mostrando importes **sin IVA**; si se requiere IVA ahí, usar la
  columna `arrePdpDetalle.iva` ya persistida.

## Importar estado de cuenta (BanBajío → `movbancarios`) — v2

> 📌 Botón **📥 "Importar estado de cuenta"** en **Gestión de Pagos** (`/arrendatarios`, clave **10**),
> junto al export. Sube el **.xlsx de BanBajío** ("ConsultaMovimientos") y registra automáticamente los
> **SPEI Recibido** que falten en `movbancarios`, para luego **aplicarlos** con el flujo existente (💲).

- **Por qué existe:** los depósitos entrantes se registran en `movbancarios` a partir de las
  **notificaciones por correo** del banco (asunto `'Instrucción de depósito a tu cuenta'`,
  `tipo='Depósito'`, `idtipo=2`). Si un correo no llegó/parseó, ese SPEI **no quedó registrado** y no se
  puede aplicar. El estado de cuenta (Excel) es el respaldo: esta función reconcilia lo faltante.
- **Qué carga:** solo los renglones cuya **Descripción empieza con "SPEI Recibido"** (los **abonos**).
  Ignora SPEI enviados, comisiones, compras POS, retiros, traspasos, etc.
- **Anti-duplicado (garantizado por la BD):** `movbancarios` tiene **`UNIQUE(rastreo)`**. La inserción usa
  `upsert(..., { onConflict: 'rastreo', ignoreDuplicates: true })` → `INSERT ... ON CONFLICT DO NOTHING`;
  el `.select()` devuelve **solo las filas nuevas**. El parser además deduplica por rastreo dentro del
  propio archivo. **Imposible duplicar** un movimiento ya registrado.
- **Mapeo (Descripción parseada → columnas):** `bancoEmisor`←"Institucion contraparte", `ordenante`←"Ordenante"
  (normalizado: sin comas/puntos, MAYÚSCULAS), `cancepto`←"Concepto del Pago" (MAYÚSCULAS),
  `referencia`←"Referencia", `rastreo`←"Clave de Rastreo", `horaOperacion`←"Hora", `fecOperacion`/`importe`
  de las columnas Fecha/Abonos. Constantes: `asunto='SPEI Recibido'` (marca el origen Excel — distinto del
  flujo por correo), `tipo='Depósito'`, `manual=true`, `aplicado=false`, `moneda='MXN'`,
  `ctaDestino='********8480-CUENTA CONECTA BANBAJÍO-1'`, `Operacion='Transferencia Interbancaria SPEI'`,
  `idmov`=UUID. La Cuenta Ordenante, el RFC Ordenante y el Recibo# del SPEI **no se persisten** (no hay
  columna; decisión de negocio).
- ⚠️ **Columnas GENERADAS de `movbancarios` (NO se insertan):** `numAnio`/`numMes` (`EXTRACT` de
  `fecOperacion`), **`idtipo`** (`CASE` sobre `tipo` → 'Depósito'=2), **`idUnico`**
  (`referencia-autorizacion-rastreo`). Insertarlas da error "cannot insert into generated column".
- **Arquitectura:** el **.xlsx se parsea en el BACKEND** (frontera de confianza); el front solo sube el
  archivo. Backend: `apps/api/.../arrendatarios/estado-cuenta.parser.ts` (**exceljs**) + método
  `CobranzaService.importarEstadoCuenta(buffer, actorUid)` (escribe vía `comoActor` → auditado por
  `trg_auditoria`). Endpoint `POST /arrendatarios/cobranza/importar-estado-cuenta` (`@RequierePermiso(10)`,
  `FileInterceptor('archivo')`, valida mimetype/ext xlsx, límite 15 MB). Front:
  `arrendatariosApi.importarEstadoCuenta(File)` (postForm) + `DashboardCobranzaPage` (botón icono+tooltip)
  + `ImportarEstadoCuentaModal` (resumen: leídos/nuevos/ya existían/monto + tabla de nuevos). Tras importar
  invalida `['arre-depositos']` para que los nuevos aparezcan en **Aplicar pago**.
- **Validación de formato:** si el archivo no tiene las columnas Fecha/Descripción/Abonos del estado de
  cuenta BanBajío, responde 400 con mensaje claro. Devuelve `{leidos, totalSpei, nuevos, yaExistian,
  montoNuevos, filas[]}`.
- **Gotcha del parseo:** la columna **Descripción** trae todo el SPEI como un solo texto con separadores
  `|`. Las claves de rastreo de **KAPITAL** (`136-28/05/2026/28-…`) y **BANREGIO** (`058-…`) contienen
  guiones/barras: el rastreo se captura **completo** hasta "Concepto del Pago:" (no cortar en el primer `-`).
- **Verificado:** el parser extrae 178 SPEI ($24,571,262.93) del estado de cuenta de mayo 2026; de esos,
  165 ya estaban y **13 faltaban** ($954,749.21) al momento del desarrollo.

## Aplicar pago — selección del depósito + sugerencias que aprenden (v2)

> 📌 El modal **Aplicar pago** (botón 💲) muestra **TODOS los depósitos recibidos sin aplicar**, no solo
> los que coinciden con el nombre del arrendatario: el **ordenante casi nunca coincide** con la razón
> social. Se eligen con **buscador** (ordenante **o** concepto) + **filtro de mes/año** (ajustable en el modal).

- **Problema que resolvía:** antes el modal precargaba la búsqueda con la **razón social** y filtraba por el
  **mes/año del dashboard**; como el ordenante del SPEI no coincide con el arrendatario (y el depósito puede
  ser de otro mes), mostraba "Sin depósitos sin aplicar". Ahora el backend `CobranzaService.depositosSinAplicar()`
  lee **directo** de `movbancarios` (ya **no** usa la RPC de v1 `movbancarios_sin_aplicar`, que quedó intacta),
  acota a **`idtipo=2`** ("Instrucción de depósito a tu cuenta" + "SPEI Recibido"), `aplicado=false`, búsqueda
  opcional, mes/año opcionales, orden por fecha, tope 1000. El modal añade selector de mes/año (con "Todos") y
  muestra el **concepto** de cada depósito.
- **Sugerencias que aprenden (`arre_ordenante`):** el modal separa en **⭐ Sugeridos** y **Todos los demás**.
  Un depósito es "sugerido" si su **ordenante** (nombre normalizado: mayúsculas, sin puntuación) ya pagó antes
  a ese arrendatario. El mapeo vive en **`arre_ordenante`** (`idArrendador, ordenante, veces, ultimoImporte,
  primeraVez, ultimaVez`; `UNIQUE(idArrendador, ordenante)`; auditada por `trg_auditoria('id')`) y se aprende
  **al aplicar pagos** (`CobranzaService.aprenderOrdenante`): cada aplicación incrementa el contador del par
  (arrendatario ↔ ordenante del depósito). **Aprende solo a futuro** — el histórico no guardaba el vínculo
  `idmov↔partida`, así que arranca vacío. Clave = **nombre del ordenante** (única clave común a los depósitos
  por correo y por Excel; el RFC/cuenta no se guardan).
  - Endpoint `GET cobranza/depositos-sin-aplicar?…&idArrePdp=` → si va `idArrePdp`, el backend resuelve el
    `idArrendador` del plan y marca `sugerido` por fila. El front pasa el `id_arrepdp` de las partidas
    pendientes del arrendatario.

## Modelo de pagos: `arre_pagos`, **saldo a favor por depósito**, conceptos, desaplicar y registro (v2)

> 📌 Tabla **`arre_pagos`** = fuente de verdad de las **aplicaciones** (una fila por **partida pagada**) +
> historial (aplicado/desaplicado). Botón **📋 Registro de movimientos**. Desde **v2.38.0** la aplicación dejó
> de ser "exacta": ahora maneja **saldo a favor por depósito**, **multi-mes**, **tolerancia de centavos**, deja
> **agregar conceptos** (penalización/interés) y el registro filtra por mes/año y exporta a Excel.

### Aplicación con SALDO A FAVOR por depósito (v2.38.0 — casos 1 y 2)
- Antes era **solo exacta** (sin sobrante ni faltante). Ahora un depósito se aplica a las **facturas (partidas
  completas) que elijas, de cualquier mes** del arrendatario; lo que sobra queda como **saldo a favor del mismo
  depósito**, disponible para aplicarlo después a otras facturas.
- **Saldo disponible** del depósito = `importe − Σ arre_pagos(idmov, estado='aplicado')`. Mientras > 0 sigue
  apareciendo con su remanente; `movbancarios.aplicado` solo pasa a `true` al agotarse.
- **SIN tocar BD:** reutiliza la RPC **`aplicar_pago_arrendatario`** (marca `arrePdpDetalle` + `aplicado=true`)
  y, si queda remanente, el backend **vuelve a poner `aplicado=false`** para dejar el depósito disponible.
- **Tolerancia configurable** (`SPHConfiguraciones.ARRE_TOLERANCIA_PAGO`, default **0.05**): el total puede
  exceder el saldo hasta ese margen (absorbe redondeos de centavos). Backend `toleranciaPago()` (caché 5 min) +
  `GET cobranza/tolerancia-pago`. Si la diferencia cae dentro del margen, el depósito se da por **agotado**.
- **Modal** (`AplicarPagoModal`): trae **TODAS las partidas pendientes del arrendatario**, cualquier mes
  (`GET cobranza/partidas-pendientes?arrendatario=`), agrupadas por **mes → nave** (conceptos **comprimidos**,
  se despliegan con ▸), con etiqueta Atrasado/Mes actual/Adelantado y **selector de año** (default año en curso).
  El depósito seleccionado se **deriva de la lista** (no se copia el objeto) para que su saldo se refresque tras
  aplicar/desaplicar. Selección por mes, nave o concepto.

### Agregar concepto libre (v2.38.0 — caso 3: penalización/interés)
- En el desglose de una nave-mes, botón **"+ Agregar concepto"** (concepto libre + monto). Crea una partida
  nueva en `arrePdpDetalle` (misma nave/mes de referencia), pendiente y seleccionable. `POST cobranza/agregar-concepto`.
- ⚠️ **`cantidad` es columna GENERADA** (`= pm2 × constM2`) y el trigger `v2_arrepdpdetalle_calc_iva` calcula
  `iva = pm2 × constM2 × tasa`. Por eso **NO se inserta `cantidad` directo** (Postgres lo rechaza): el backend
  **reparte el monto** → `pm2 = monto/(1+tasa)`, `constM2 = 1`, de modo que **`cantidad + iva` = el monto
  capturado exacto** (IVA incluido, igual que el resto). `uidc` (FK a `catUsers`) = quién lo crea. Auditado.

### Tabla `arre_pagos` + desaplicar + sugerencias
- **`arre_pagos`** (`trg_auditoria`, sin prefijo `v2_`): `id`, `idArrePdpDet`, `idArrePdp`, `idArrendador`,
  `idmov`, `uidPago` (agrupa la aplicación), `monto` (con IVA), `fecPago`, `uid`, `estado`, `aplicadoEn`,
  `desaplicadoPor/En`, `motivoDesaplicacion`. Índice único parcial `WHERE estado='aplicado'` por `idArrePdpDet`.
  Sin FKs estrictas a v1.
- **Dual-write (Fase 1):** la RPC actualiza `arrePdpDetalle` + se insertan filas en `arre_pagos`. Lectores
  (dashboard `pagos_arrendatarios`/Estado de Cuenta) siguen en `arrePdpDetalle`.
- **Desaplicar:** RPC `desaplicar_pago_arrendatario` (revierte partidas + `aplicado=false`) + marca `arre_pagos`
  `desaplicado` (quién/cuándo/motivo). Al desaplicar, **el depósito recupera su saldo**. `POST cobranza/desaplicar-pago`.
- **Quitar sugerencia (⭐):** click en la estrella de un depósito sugerido → `POST cobranza/quitar-sugerencia`
  borra la fila `arre_ordenante` (ordenante↔arrendatario). Útil si se aplicó a un arrendatario equivocado; se
  vuelve a aprender al aplicar de nuevo.

### Registro de movimientos (📋) — v2.38.0
- `GET cobranza/historial-pagos?anio=&mes=&limite=` agrupa por `uidPago` y **filtra por periodo aplicado**
  (mes/año de las partidas) para no crecer sin límite; default los del tablero. Cada entrada trae los
  **`periodos`** (yyyy-MM) de sus partidas.
- `RegistroMovimientosModal`: encabezado **azul** (regla 7), **selectores Año/Mes**, **filtros por columna**
  (regla 7c: Ordenante/Arrendatario/Mes/Año/Estado), **export a Excel (CSV)**, columnas **"Fecha de depósito"**
  + **Mes/Año aplicado**, fila **expandible** (▸ → `GET cobranza/aplicacion-detalle?uidPago=`: a qué
  naves/conceptos/meses se aplicó) y **Desaplicar**.
- **Plan de migración:** Fase 2 (migrar lectores a `arre_pagos` + históricos) y Fase 3 (eliminar las 4 columnas
  de pago de `arrePdpDetalle`) siguen **pendientes**.
- 📌 **Pendiente:** mostrar el **nombre** (catUsers) de quién aplicó/desaplicó; botón para **eliminar** un
  concepto agregado por error.

## ⚠️ Gotcha crítico — desfase del `anio` por concepto (diagnóstico de "actualizar el INPC manual no funciona")

> **Para el agente de soporte: esto NO es un bug del código de v2 ni de la RPC de edición; es un problema
> de DATOS.** El mismo síntoma aparece igual en v1 (Flutter) y en v2, porque ambos invocan la misma RPC
> con los mismos parámetros.

**Síntoma que reporta el usuario:** "al actualizar manualmente el INPC de un concepto **en el año 2** (o
posterior), el cambio se aplica **desde el año 1** y/o **el monto no cambia**". Se nota sobre todo en
**Renta** (la tabla principal de la corrida muestra los valores de la Renta), pero **puede ocurrir en
CUALQUIER concepto**: Administración, Mantenimiento, Vigilancia y también conceptos financiados / KVA
(p. ej. **Adecuaciones**, **Otros servicios inmobiliarios**).

**Causa raíz.** Dentro de una **misma partida (mes)**, la fila de un concepto puede quedar con un `anio`
**distinto (un número menor)** que el del resto de conceptos de esa misma partida. Cómo se produce:

1. Al generar la corrida (`arrepdp_generar_corrida_desde_plan_simple`), la **Renta** se inserta con
   `fecha` = **día 1** del mes y **Admin/Mtto/Vig** con `fecha` = **día 2** (`+1 día`); los conceptos
   financiados llevan sus propias fechas.
2. Dos crons diarios (07:00) recalculan `anio`/`ciclo` **por tiempo transcurrido**:
   `actualizar-anios-planes-diario` → **`actualizar_anios_planes_nuevos()`** y
   `actualizar-ciclo-planes-diario` → `actualizar_ciclo_plan_pago()`. La fórmula es
   `FLOOR( (fecha − fecha_inicio_plan) / 365.25 días ) + 1`, con `fecha_inicio_plan = MIN(fecha)` del plan.
3. En el **mes de aniversario**, el concepto cuya `fecha` cae **exactamente** en el aniversario (p. ej. la
   Renta de 1/5/2026 = **365 días** desde 1/5/2025 → `365 / 365.25 < 1`) queda en el **año anterior**,
   mientras que los conceptos con `+1 día` (2/5/2026 = **366 días** → `≥ 1`) quedan en el **año correcto**.
   → ese concepto queda con `anio` **una unidad por debajo** del resto de su partida.

**Por qué rompe la edición manual del INPC.** La RPC
`arrepdpdetalle_actualizar_campo_manual(idArrePdp, anio, concepto, campo, valor)` aplica el cambio con
`WHERE concepto = … AND anio >= anio_de_la_fila` y **solo recalcula `pm2` si `anio >= 2`**. Si la fila del
concepto en el mes de aniversario quedó con `anio = 1`:
- el `UPDATE … WHERE anio >= 1` **machaca el INPC de TODO el primer año** ("lo modifica desde el año 1"), y
- como `anio < 2`, **no recalcula el `pm2`** → **el monto no cambia**.

**Cómo diagnosticarlo (consultas de SOLO LECTURA).**

```sql
-- (A) Todas las filas con anio desalineado respecto al resto de su partida (todo el sistema)
with f as (
  select "idArrePdp", "numPartida", concepto, anio,
         max(anio) over (partition by "idArrePdp","numPartida") as anio_part
  from public."arrePdpDetalle"
  where status = true and "numPartida" > 0
)
select "idArrePdp", "numPartida", concepto, anio, anio_part
from f where anio <> anio_part
order by "idArrePdp", "numPartida";

-- (B) Para un plan concreto, comparar el anio por concepto en la partida sospechosa:
select "numPartida", concepto, fecha::date, anio, "INPC", "ptsINPC", pm2, cantidad
from public."arrePdpDetalle"
where "idArrePdp" = '<idArrePdp>' and "numPartida" = <n> and status = true
order by concepto;
```

Señal inequívoca: dentro de una misma `numPartida`, un concepto tiene `anio` **menor** que los demás
(normalmente con `fecha` en el **día 1** mientras los otros están en el **día 2**).

**Corrección (es de DATOS; requiere autorización — `arrePdpDetalle` es tabla compartida con v1):**
realinear el `anio` de las filas desfasadas **por número de partida** (`((numPartida−1)/12)+1`, depósito
= año 0), igual que ya hace la RPC `arrepdpdetalle_recalcular_anos_contrato`. Para que **no se repita**, la
causa de fondo está en el cálculo por días/365.25 de `actualizar_anios_planes_nuevos()` /
`actualizar_ciclo_plan_pago()` (crons de v1): deberían calcular por número de partida o por meses con
`date_trunc('month', …)`. Tras realinear el `anio`, si ese mes de aniversario debía llevar el incremento de
INPC y quedó sin él, se aplica el INPC del año correspondiente (ya con el `anio` correcto, la RPC manual
recalcula bien).

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
  - **Activación (v2.27.3)**: al registrar la renovación, la RPC `v2_arrepdp_renovar` ramifica:
    - **Si hay un contrato vigente activo corriendo** → la renovación queda **programada**: el job pg_cron
      diario (`v2-arrepdp-activar-renovaciones`, 02:00, `v2_arrepdp_activar_renovaciones()`) la activa cuando
      el vigente vence (apunta `arrenPropiedades` a ella, `pdpActivo=true`), antes del job de desvinculación
      (07:30), así la nave no se libera.
    - **Si NO hay contrato vigente** (el plan anterior ya venció / la nave sin plan activo) → la RPC **la
      vincula y activa en el acto** (mismo UPDATE que el cron), para que se muestre de inmediato.
    - ⚠️ **Antes de v2.27.3** la RPC **solo insertaba** el plan y dependía 100% del cron; una renovación hecha
      cuando ya no había vigente quedaba **creada pero invisible** (no era el plan activo, y el cron exige un
      plan vencido vinculado para actuar). Ver `migraciones/2026-06-15-arrepdp-renovar-activacion-inmediata.sql`.

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

> 🔽 **Filtros multi-selección (regla 7c, v2.37.0):** en *Vencimientos* (Estado, Parque) y *Cancelaciones*
> (Año, Parque) se puede elegir **uno o varios** valores (`MultiSearchSelect`; filtran en cliente). En
> **Gestión de Pagos** (Dashboard de Cobranza) el **Año** y el **Mes** también son multi: la RPC
> `pagos_arrendatarios` se llama una vez por año (con `p_mes=null`) y los meses se filtran en memoria.
> Los selectores Arrendatario→Nave→Plan (cascada que carga datos) **siguen siendo de selección única**.

- **`/arrendatarios/reportes`** (`ReportesArrePage.tsx`, lazy). Calca el patrón de **Ventas → Reportes**
  (`Tabs` + filtros + tabla `useSort`/`SortableTh` + export). El CSV vive en `csv-export.ts` (ligero, sin
  jsPDF, para que el Dashboard no arrastre jsPDF al bundle principal); el PDF en `reportes-arre-export.ts`
  (`exportarPDF` simple y `exportarPDFConEncabezado` con logo).
- **Estado de Cuenta** (tab): estado de cuenta **por nave y plan**. Se elige **Parque → Nave → Plan**
  (vigente o terminado); muestra la **cabecera del plan** (`arrePdp`: arrendatario, fechas, plazo, moneda,
  depósito, $×m², const m², INPC adic.) y la **corrida completa** (`arrePdpDetalle`) **desglosada por
  partida**: una fila por mes con **INPC total**, el monto separado en **Renta/Admin/Mtto/Vig** + **Otros
  Servicios** (suma del resto) + **Nota** (detalle), **Total**, **Pagado** (cantidadAplicada), **Fecha de
  pago** y **Estado** (Pagado/Pendiente), con **totales** al pie. Export **CSV** (incluye Nave/Parque/Razón
  Social/Divisa por fila; montos a 2 decimales) y **PDF con encabezado (logo SPH + datos del plan; montos con
  formato de moneda a 2 decimales)**. Backend `reportes-arre.service.ts`:
  `estadoCuentaOpciones()` (naves arrendadas con plan, excluye Tickets) y `estadoCuentaCorrida(idArrePdp)`
  (cabecera + corrida pivotada por concepto). Endpoints `GET /arrendatarios/reportes/estado-cuenta/opciones`
  y `GET /arrendatarios/reportes/estado-cuenta/:idArrePdp`.
- **Cancelaciones Anticipadas** (tab): lista los `arrePdp` con `canceladoAnticipado=true`,
  enriquecidos **en memoria sin vistas** (backend `reportes-arre.service.ts` → `cancelaciones()`): arrendatario
  (`inversionista`), parque/nave (`arrenPropiedades`+`naves`+`parques`, **excluye Tickets**), quién canceló
  (`catUsers.nomCompleto`). Columnas: Arrendatario · Parque · Nave · Inicio · Fin contractual · Fecha
  cancelación · Motivo · Canceló · Moneda. Filtros año/parque/búsqueda + export CSV/PDF.
- Endpoint `GET /arrendatarios/reportes/cancelaciones` (`@RequierePermiso(20)`).
- **Vencimientos** (tab, v2.29.0 — **pestaña por defecto**): dos grupos (excluye Tickets y cancelados):
  - **Por vencer** (`'1 Mes'`/`'2 Meses'`/`'3 Meses'`): el **contrato activo** de la nave (vínculo
    `arrenPropiedades.status=true`), que sigue corriendo.
  - **Vencidos** (`'No'`): planes con **`fecFin` < hoy** que **siguen vinculados** a su nave
    (`arrenPropiedades.status=true`) y cuya **nave física (`idNave`) no tiene contrato vigente** — misma
    regla que el sidebar del dashboard (`contratos_vencidos_sin_renovacion`). Excluye datos de prueba.
  - ⚠️ **Regla vigente (2026-07-02, v2.52.1) — REEMPLAZA el gotcha de 2026-06-17**: si la nave se
    **desvincula** (`status=false`: el cliente se fue o se re-rentó a otro, incl. botón 🔓 Liberar nave), el
    contrato **SALE** de "sin renovación" (la nave queda disponible). Antes (2026-06-17) se listaban los
    vencidos aunque el vínculo estuviera inactivo → dejaba clientes que ya no tenían la nave (caso real
    **DON CACAHUATO**, naves 37/38 Spartek; la 37 re-rentada a otro). Además la deduplicación pasó de
    `idNavArrend` a **`idNave`** (nave física) para descontar re-rentas a otro arrendatario. En prod la lista
    bajó de **22 → 14** (salen desvinculados, re-rentados y datos de prueba; quedan los pendientes reales con
    vínculo activo, p. ej. SEMINUEVOS 113/110).
  - ⚠️ **Próximos por vencer (`contratos_por_vencer`)**: verificado que NO arrastra el bug (0 vínculos
    cerrados, 0 re-rentas) — solo se cuelan **2 filas de prueba**. El fix (excluir `pruebas`) quedó
    **PENDIENTE de OK** (ver `migraciones/2026-07-02-arrepdp-vencimientos-vinculo-activo.sql`, Parte 2).
  - Backend `reportes-arre.service.ts` → `vencimientos()` (enriquece en memoria, sin vistas; "hoy" en zona
    México; ordena por urgencia Vencido→1→2→3). Columnas: Arrendatario · Parque · Nave · Inicio · Fin ·
    **Estado** (badge) · **Días** ("Vence en N d"/"Venció hace N d", front con `hoyMexico()`) · Renta base
    (`rtaBase`) · Moneda. **Tarjetas-resumen** clicables por estado, filtros estado/parque/búsqueda, export CSV/PDF.
- Endpoint `GET /arrendatarios/reportes/vencimientos` (`@RequierePermiso(20)`).

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
- **Tabla `arre_ordenante`** (mapeo aprendido ordenante↔arrendatario para sugerir depósitos al aplicar pagos;
  ver "Aplicar pago — sugerencias"). ⚠️ **SIN prefijo `v2_`**: desde 2026-06-19 los objetos nuevos **ya no
  llevan el prefijo `v2_`** (decisión del usuario — v1 ya no la usa ningún usuario, solo existe para validación).
  Auditada por `trg_auditoria('id')`. Se agregó su tipo a `database.types.ts` (Tables: `arre_ordenante`).
- **Tabla `arre_pagos`** + **RPC `desaplicar_pago_arrendatario(p_idmov, p_ids_detalle)`** (modelo de pagos:
  fuente de verdad + historial + desaplicar; ver "Modelo de pagos"). Sin prefijo `v2_`; `trg_auditoria('id')`;
  tipos agregados a `database.types.ts`. La eliminación de las columnas de pago de `arrePdpDetalle` es la
  Fase 3 (pendiente, NO hecha).
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
  `constM2`, `INPC`, `ptsINPC`, `cantidad`, **`iva`** (v2; monto de IVA, ver "IVA en la
  corrida"), `tieneMesGratis`, `fecPago`, `comprobantePago`).
- `catParametros` — parámetros de negocio (`idCorto`, `valor`). Incluye **`idCorto='iva'`**
  (tasa de IVA = 0.16) usado por el trigger de IVA y la cobranza.
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
- "Actualizo el INPC manual de un concepto en el año 2 y se aplica al año 1 / el monto no cambia" → es el
  **desfase del `anio` por concepto**: esa fila quedó con un `anio` menor que el resto de su partida (mes de
  aniversario). Pasa en **cualquier concepto** (Renta, Admin/Mtto/Vig, Adecuaciones, Otros servicios). Ver
  la sección **"⚠️ Gotcha crítico — desfase del `anio` por concepto"** de este documento para el diagnóstico
  (consultas) y la corrección. **No es un fallo del código de v2 ni de la RPC** (ocurre igual en v1).
- "El depósito no me deja aplicar" → es **Insuficiente** (importe menor a la suma de
  partidas) o las partidas son de **otra divisa** que el depósito.
- "No aparece el depósito de un pago que sí recibimos" → probablemente el correo del banco no se registró.
  Usa **📥 Importar estado de cuenta** (Gestión de Pagos) y sube el **.xlsx de BanBajío**: registra los
  **SPEI recibidos** faltantes (sin duplicar, por clave de rastreo) y luego ya puedes aplicarlos con 💲.
  Ver "Importar estado de cuenta (BanBajío → `movbancarios`)" en este documento.
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
- "Renové un contrato pero no aparece / no se activó" → desde **v2.27.3** la renovación se activa al instante
  si la nave ya **no** tenía contrato vigente; si **sí** había uno corriendo, queda **programada** y el cron
  (02:00) la activa al vencer. Una renovación **anterior** a v2.27.3 pudo quedar colgada (vínculo
  `arrenPropiedades` sin plan activo, `idArrePdp` NULL): se corrige re-apuntando el vínculo al plan de la
  renovación (`pdpActivo=true`). El plan futuro **no** se ve en Planes de Renta hasta que es el activo (la
  pantalla solo lista vencidos y el activo).
