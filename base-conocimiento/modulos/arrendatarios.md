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
| `/arrendatarios` | 10 | **Dashboard de cobranza**: filtros (año/mes/parque/solo pendientes), totales **separados por divisa** (MXN/USD), tabla de partidas (pendientes en rojo), vencimientos (por vencer / vencidos) y **Aplicar pago**. En vivo por SSE. |

**Configuración (⚙)** — 4 sub-pestañas: **Datos Generales** (solo lectura; el
alta/edición del padrón vive en **Clientes**), **Documentos** (bucket `Documentos`),
**Propiedades** (vincular naves), **Plan de Pagos** (crear/activar/desactivar/
eliminar plan + conceptos financiados).

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
- **Meses de gracia (`tieneMesGratis` = `Si`/`Medio`/`No`)**: las partidas con
  cortesía se **resaltan en amarillo** y no se cobran (o medio mes).
- **Divisas (MXN/USD)**: la cobranza agrupa y totaliza **por divisa por separado**;
  nunca se suman MXN + USD.
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
