# 01 — PRD · Presupuesto por año, «solo anual» y Ajuste Presupuestal

> Anclado a `00-brief-conceptual.md` (nomenclatura y decisiones). Escrito en lenguaje de negocio.

## 1. Problema

1. Algunas cuentas (sobre todo las de obra) no tienen presupuesto mensual, solo anual; hoy el sistema solo
   conoce el presupuesto «acumulado por mes» y esas cuentas se ven bien solo porque su presupuesto quedó
   cargado en enero. No hay forma de decirle al sistema «esta cuenta se mide por año».
2. Hay gastos que ocurrieron antes o fuera de la plataforma. Para que el presupuesto muestre la realidad,
   alguien tuvo que meterlos como «pagos urgentes», que no fue una solución (no cuentan en el consumido y
   se confunden con urgencias reales).
3. La pantalla de Cuentas solo muestra el año en curso; los gastos de años anteriores no se pueden consultar.
4. Las solicitudes **Urgentes** y de **Línea de Captura** guardan subtotal 0 y el presupuesto no las ve: en 2026 hay 13 urgentes por 24.3 millones de pesos y 22 líneas por 1.45 millones (aprobadas o pagadas) que no
   suman a su cuenta (hay pagos de 5.6 y 17.9 millones con consumido 0), y el control de aprobación las ve como de 0 pesos (pendiente #80).

## 2. Objetivos

| # | Objetivo | Cómo se sabrá que se logró |
|---|---|---|
| O1 | Marcar cuentas «solo anual» y que se midan contra su anual completo. | Una cuenta marcada muestra como disponible el anual desde enero; desmarcada vuelve a lo mensual. |
| O2 | Cargar gastos históricos sin factura, con control de quién puede hacerlo y con trazabilidad. | El consumido de la cuenta sube exactamente el monto capturado, en el mes y año de la fecha del gasto. |
| O3 | Consultar el presupuesto de años anteriores. | El selector de año muestra consumido y presupuesto de 2025 con la **misma lógica** que el año en curso. Ojo: por la decisión de Jereff de julio (contar estados 7 y 99), 2025 mostrará **$6.67 M más** que como se veía cuando era el año en curso (es el cambio esperado, no un error; la cifra es previa a F0, que agrega a 2025 ≈ 3.46 M en urgentes/líneas aprobadas sin pago: se recalcula después de M10). |
| O4 | No romper nada de lo que ya funciona. | Para el año en curso y sin cuentas «solo anual», todas las cifras de hoy quedan **idénticas** (prueba de equivalencia; se corre **después de F0**, con los datos ya corregidos: F0 es el único cambio de cifras esperado). |
| O5 | Que las urgentes y líneas de captura **consuman presupuesto**. | Una urgente autorizada aparta su subtotal (comprometido); al pagarse lo consume. Si la cuenta no alcanza, el aprobador ve «fuera de presupuesto» y solo el aprobador de fuera de presupuesto puede autorizarla. Las 86 ya cargadas cuentan desde la migración. |

## 3. Usuarios

- **Contabilidad / quien administra presupuestos (clave 213):** marca «solo anual», consulta otros años.
- **Quien captura históricos (permiso nuevo «Ajuste presupuestal»):** crea y anula ajustes.
- **Aprobadores de CxP:** ven cifras correctas al aprobar; no cambia su flujo.
- **Soporte:** ve y opera todo (misma visibilidad y mismo permiso asignable).
- **Quien captura urgentes y líneas de captura:** además del monto, indica el **subtotal sin IVA**.

## 4. Historias y criterios de aceptación

**H1 — Marcar «solo anual».** Como administrador de cuentas quiero un interruptor «Solo anual» por cuenta.
- Dado que enciendo «Solo anual» en una cuenta con presupuesto anual 120 y consumido 30 en febrero, el
  disponible acumulado es 90 (no el prorrateo mensual).
- Al apagarlo vuelve al cálculo por mes. La acción queda auditada.
- Sin la clave 213 el interruptor no se puede cambiar (el servidor responde 403).

**H2 — Ver otro año.** Como administrador quiero elegir el año en Cuentas.
- El selector ofrece los años con presupuesto o con gasto. Por defecto, el año en curso.
- El engrane del presupuesto mensual se deshabilita solo si ese año no tiene presupuesto cargado; no hay regla
  de «solo lectura» por año (no fue decisión de Jereff). El resto de la pantalla funciona igual.

**H3 — Capturar un ajuste.** Como persona con el permiso quiero registrar un gasto histórico.
- Captura: cuenta, fecha real del gasto (no futura), monto sin IVA en pesos, descripción obligatoria,
  proveedor opcional.
- Resultado: el consumido de esa cuenta, en ese mes y año, sube por ese monto; el ajuste aparece en el listado
  con quién lo capturó y cuándo.
- Sin el permiso: no ve la opción y el servidor rechaza la captura.
- No se pide factura, no pasa por aprobación, no genera pago bancario ni bloqueos de complemento.
- Si el ajuste deja la cuenta sobre su presupuesto, se muestra un aviso antes de guardar; guardar sigue permitido.

**H4 — Anular un ajuste.** Como persona con el permiso quiero deshacer un ajuste mal capturado.
- Pide motivo. El ajuste deja de contar de inmediato, queda en el listado como «Anulado» con motivo, quién y cuándo.
- No se puede editar ni reactivar; se anula y se captura otro.

**H5 — Reportes coherentes.** Como contador quiero poder identificar los ajustes en los reportes.
- En la pantalla «Ajustes presupuestales» y en su Excel aparecen rotulados como ajuste, con su descripción. En el **Estado de cuenta** de Reportes (que usa una función compartida que no
  distingue tipos) aparecen como «Pagado» bajo su proveedor —el genérico «AJUSTE PRESUPUESTAL (SIN PROVEEDOR)» o el real que se haya elegido— con la descripción en el concepto y sin folio ni documentos.
  Etiquetarlos con una columna «Tipo» en ese reporte exigiría cambiar esa función compartida y no entra en este paquete.
- En Looker (`lkr_cxp`) salen con `tipoOperacion = 98`; los ajustes **anulados** no salen.

**H6 — Urgentes y líneas de captura que sí consumen presupuesto (F0).** Como aprobador y como contador quiero que un pago urgente o de línea de captura cuente contra su cuenta igual que una factura.
- Los formularios piden **«Subtotal (sin IVA)»**, que arranca igual al monto; no puede ser 0; si es mayor al monto (pago con **retenciones**, p. ej. honorarios) el formulario pide confirmarlo, con tope de 1.2 × el monto (el servidor responde 400; la BD rechaza el 0 aunque el servidor fallara).
- Dado un presupuesto anual de 100 y una urgente con subtotal 40: al **autorizarse** el comprometido sube 40; al **aplicarse el pago** el consumido sube 40 y el comprometido baja 40.
- Si la cuenta no alcanza, el modal de aprobación marca «fuera de presupuesto» y la autorización la hace el aprobador de fuera de presupuesto (la misma ruta que una factura normal).
- Las 86 ya cargadas (35 urgentes y 51 líneas) quedan con subtotal = monto total. En 2026 el consumido sube ≈ 25.7 millones de pesos y 3 cuentas pasan a «fuera de presupuesto»
  (TRAMITES ACUPARK II, TRAMITES ACUPARK III e IMSS Patronal; detalle en `05-BACKEND.md` §7).
- Editar una urgente o línea regresada a Guardado también exige un subtotal válido.

## 5. Reglas de negocio

Ver `00-brief-conceptual.md` §5 (invariantes 1–9). Las más importantes: el ajuste no se edita ni se borra; el
monto es sin IVA; la fecha no puede ser futura; todo queda auditado a nombre de quien lo capturó; una sola
fuente del cálculo de presupuesto.

## 6. Fuera de alcance

Carga masiva desde Excel (decisión: «por ahora uno por uno»), apartado de facturas PPD al autorizar y año de
origen de las parcialidades (Paquete 2), divisas distintas de pesos (#79), edición de un ajuste ya capturado, **devoluciones** (sus cuentas no son presupuestables).

## 7. Riesgos de negocio que se aceptan conscientemente

- Un ajuste **sube** el consumido sin pasar por aprobación; el control es el permiso + la auditoría + la
  anulación con motivo. (Decisión de Jereff A1.)
- Marcar mal una cuenta como «solo anual» permite gastar su anual completo antes de lo previsto; es reversible
  al instante y queda auditado.
- Cualquier año se puede consultar desde Cuentas; si hay que corregir el presupuesto mensual de un año (p. ej. el cierre de 2026 en enero), se puede, igual que hoy.
- **F0:** rellenar el subtotal de las 86 existentes con el monto total **sobreestima hasta 16 %** donde el pago sí llevó IVA (trámites, licencias, IMSS e ISN no llevan). Y **subestima** donde hubo retenciones (honorarios: se paga menos que la
  base). Si contabilidad indica un pago con IVA o con retenciones, esa fila se corrige con registro. Las cifras de consumido suben y 3 cuentas pasan a «fuera de presupuesto»: **avisar al equipo antes** de aplicarlo.
  Desde F0, una urgente que no cabe en su cuenta ya no la autoriza el gerente de la cuenta: la reasigna al aprobador de fuera de presupuesto (como cualquier factura).
