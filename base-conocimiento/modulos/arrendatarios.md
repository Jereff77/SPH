---
modulo: Arrendatarios
estado: desarrollado
version_doc: 1.0
ultima_actualizacion: 2026-06-07
rutas_v2: [/arrendatarios, /arrendatarios/planes]
rutas_v1: [i02_arrendatarios]
claves_permiso: [10, 20]
tablas: [inversionista, arrenPropiedades, arrePdp, arrePdpDetalle, arreConceptos, inversionista_docs, naves, parques, inpc, movbancarios, v_arrendadasNaves]
rpcs: [arrepdp_crear_plan_simple_rpc, arrepdp_generar_corrida_desde_plan_simple, arrepdpdetalle_aplicar_meses_gracia, arrepdpdetalle_obtener_resumen_por_plan, arrepdpdetalle_actualizar_campo_manual, arrepdp_agregar_concepto_financiado, arrepdp_eliminar_plan_con_restricciones, aplicar_pago_arrendatario, pagos_arrendatarios, contratos_por_vencer, contratos_vencidos_sin_renovacion, movbancarios_sin_aplicar]
palabras_clave: [arrendatario, inquilino, renta, arrendamiento, contrato, arrePdp, plan de renta, corrida, vigencia, meses de gracia, cortesía, concepto financiado, KVA, INPC, cobranza, aplicar pago, depósito, contrato por vencer, contrato vencido]
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
| `/arrendatarios/planes` | 20 | Selector arrendatario → propiedad → historial de planes (`arrePdp`) → **corrida** (tabla con expandible por partida y edición de campos por doble clic). Botón **Configuración** (⚙) y **Consulta INPC**. |
| `/arrendatarios` | 10 | **Dashboard de cobranza** (réplica del de v1): barra de stats (Naves / Naves pendientes / Monto pendiente MXN / Cobrado MXN), toggle **Todos/Pendientes/Pagados**, filtro de **divisa** (Ambos/MXN/USD) y periodo (Mes con "Todos" / Año). **Tabla agrupada por nave+parque+razón social** con columnas Pendiente MXN, USD (pend/cob), Cobrado MXN; **filtros por columna** (nave/parque/razón social/concepto), **orden** por clic, **tooltip de desglose por concepto** al pasar el cursor sobre los montos, filas en rojo (todo pendiente)/verde (todo pagado) y **fila de totales** al pie. Botón **💲** por arrendatario con pendientes → modal. **Sidebar de vencimientos colapsable**: Vencidos (con días) + Próximos a 1/2/3 meses (calculados por `fec_fin`). **Aplicar pago** (modal por razón social: depósitos `movbancarios_sin_aplicar` + naves pendientes con checkbox, validación Exacto/Sobrante/Insuficiente). En vivo por SSE. |

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

## Objetos nuevos en BD (v2_, autorizados)
- RPC `v2_arrepdp_renovar(...)` — registra la renovación (inserta `arrePdp` + corrida vía RPCs
  existentes), sin tocar el plan vigente.
- RPC `v2_arrepdp_activar_renovaciones()` — transición automática al vencer.
- Job pg_cron `v2-arrepdp-activar-renovaciones` (diario 02:00).
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
