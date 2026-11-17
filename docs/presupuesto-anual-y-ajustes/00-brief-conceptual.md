# 00 — Brief conceptual · Presupuesto por año, cuentas «solo anual» y Ajuste Presupuestal

> **Fuente de verdad y nomenclatura canónica** de este paquete. Si otro documento del paquete contradice
> a este, manda este. Creado el 2026-11-03 (sesión de la corrección de subtotales PPD).
> **Estado del paquete: BORRADOR — sin construir.** Falta: aprobación del mockup y visto bueno de Jereff (gate de diseño).
> **2026-11-04: entra la fase F0** (urgentes y líneas de captura consumen presupuesto; pendiente #80 del tablero). Su alcance
> nuevo pasa por su propia validación adversarial (ver `07`).

## 1. Qué se pide (palabras de Jereff y de contabilidad)

1. **Cuentas «solo anual»** (Jereff, 2026-11-03): poder marcar qué cuentas se miden únicamente contra su
   presupuesto **anual**, sin presupuesto mensual.
2. **Cargar históricos** (Jereff, 2026-11-03): que los gastos que ocurrieron fuera de la plataforma
   queden **dentro** de ella. Se intentó con «pagos urgentes» y «no funcionó del todo». Solución pedida:
   un concepto **98 – Ajuste Presupuestal**, que **solo** usuarios con el permiso adecuado puedan
   capturar, **sin factura**, con un campo de **descripción** del ajuste.
3. **Selector de año** (Jereff, 2026-11-03): hay gastos de años anteriores; la pantalla de Cuentas debe
   poder verlos.
4. **Regla de cambio de año de contabilidad** (relato de Jereff, 2026-11-02): el presupuesto de un año
   **se queda en ese año**: una factura autorizada con presupuesto 2026 sigue consumiendo el 2026 aunque
   se termine de pagar en 2027 o 2028. La mayoría de las facturas cierra antes de fin de año; unas pocas
   «brincan». Esto resuelve el pendiente #77 y se construye en el **Paquete 2** (§7); este paquete deja
   listo el cimiento.

## 2. Decisiones ya tomadas por Jereff (no se re-litigan)

| # | Decisión | Fecha |
|---|---|---|
| A1 | El ajuste **nace ya contabilizado**, sin pasar por aprobación (el permiso es el control; queda toda la trazabilidad). | 2026-11-03 |
| A2 | Se captura la **fecha real del gasto**; hay gastos de años anteriores → **selector de año** en Cuentas. | 2026-11-03 |
| A3 | El monto del ajuste es **sin IVA** (el presupuesto mide el subtotal). | 2026-11-03 |
| A4 | Captura **uno por uno** (no hay carga masiva en este paquete). | 2026-11-03 |
| A5 | **Proveedor opcional** en el ajuste. | 2026-11-03 |
| A6 | Todos los montos son pesos mexicanos; divisas distintas quedan fuera (#79). | 2026-11-02 |
| A8 | En el cálculo del presupuesto **cuentan los estados 7** (Pago T. Bancaria = gastado) **y 99** (Aprobado sin pago = comprometido), además de 6 y 4. Decisión de Jereff del plan de julio, que esta función respeta. Efecto en 2026: **cero pesos al decidirlo** (todo el monto de 7/99 era de 2025; con F0 antes de F1, las 4 líneas en 99 de 2026 aportan 65,013.00); sí cambia lo que se ve al consultar 2025. | 2026-07-02 |
| A7 | Apartado PPD al autorizar, «liberar saldo», «reasignar factura», el pago toma la partida de su factura: **ya acordados** (#77) y van en el Paquete 2. | 2026-11-02 |
| A9 | **Las solicitudes Urgentes y de Línea de Captura consumen presupuesto** como cualquier gasto: al **autorizarse** se **aparta** (comprometido, estado 4) y al **aplicarse el pago** se **consume** (gastado, estado 6). Para eso deben llevar subtotal (pendiente #80). Incluye las ya cargadas. | 2026-11-04 |
| A10 | **Línea de captura (4), Devolución (5) y Sin XML (6): `subtotal = total` siempre, resuelto en BD con un trigger** (`docs/subtotal-igual-total-tipos-4-5-6/`), sin tocar el código. **Reemplaza a F0 para el tipo 4**: ya no lleva el campo «Subtotal (sin IVA)» capturado ni el tope 1.2×; F0 (formulario, M10, M11) queda solo para las **urgentes (tipo 2)**. | 2026-11-17 |

## 3. Nomenclatura canónica

- **Cuenta** = `PresCategorias` (en la UI «Cuentas»; en la calle «partida»). PK `idCategoria`.
- **Solo anual** = bandera de la cuenta (`PresCategorias.soloAnual`): su presupuesto disponible es el
  **anual completo** desde enero; no hay tope mensual.
- **Año presupuestal** = el año de presupuesto contra el que cuenta un gasto. En este paquete, un gasto **pagado** (6/7) se fecha por
  `COALESCE(fecAutorizacion, fecPago, fc)` y uno **aprobado sin pagar** (4/99) por `fc` (la fecha de alta), **igual que hoy**; todo en hora de México.
  Hueco conocido y medido: 3 facturas dic-2025 → ene-2026 ($630,572.58) cuentan como comprometidas de 2025 y no de 2026; alinear el compromiso con el año de
  autorización es justo la regla de contabilidad y **se resuelve en el Paquete 2** (aquí no se mueven cifras).
- **Función de presupuesto** = `cxp_resumen_presupuesto_por_anio(p_anio)`: **única fuente del cálculo**. Las vistas
  `v_resumenPresupuesto` y `v_resumenpresupuesto` (la gemela en minúsculas es la que lee la RPC que autoriza pagos)
  la envuelven con el año en curso. Es la misma función que ya describe `PLAN-reporte-presupuesto-cxp.md` (julio, acordada
  con Jereff y aún sin construir); este paquete la construye **una sola vez** y le agrega «solo anual», `status = true` y hora de México.
- **Ajuste presupuestal** = fila de `cxp` con `tipoOperacion = 98`. Es un **gasto histórico sin factura**.
  Nunca se llama «solicitud» ni «pago» en la UI: se llama **«Ajuste presupuestal»**.
- **Permiso «Ajuste presupuestal»** = clave nueva de `segModulos`, hermana de la 431 «Aprobar fuera de
  Presupuesto» (propuesta: **432**; modulo «Cuentas por Pagar», seccion «Ajuste Presupuestal», area «Opcion»).
- **Anular** un ajuste = `status=false` + motivo. **Nunca se borra.**

## 4. Qué ES y qué NO es el Ajuste Presupuestal

**Es:** una forma controlada de dejar constancia de un gasto real ya ocurrido para que el presupuesto de
su cuenta, mes y año refleje la realidad.

**No es:** una solicitud de pago, una factura, un pago bancario, un gasto urgente, ni una forma de
saltarse la aprobación de un gasto **nuevo**. No mueve dinero. No pasa por bancos, REP ni aprobación.
No se edita (se **anula** y se captura otro): así cada cifra tiene un solo responsable y una sola historia.

## 5. Reglas de negocio (invariantes)

1. Solo quien tenga el permiso de ajuste ve la opción **y** el servidor lo valida (nunca solo la UI). Hoy cualquier usuario con sesión puede
   escribir directo en la BD y concederse permisos (P0 conocido, tablero **#2** y **#3**): el permiso 432 es tan fuerte como el resto de los permisos del sistema,
   y la guardia M8 impide al menos que una fila 98 se cree, edite o borre sin pasar por el servicio.
2. Un ajuste lleva: **cuenta**, **fecha real del gasto** (≤ hoy, hora de México), **monto sin IVA**
   (pesos, > 0, máx. 2 decimales), **descripción** obligatoria, proveedor **opcional**.
3. Cuenta en el presupuesto como **consumido** del **mes y año de su fecha** (subtotal = monto).
4. Una cuenta «solo anual» se compara contra el presupuesto anual completo del año consultado.
5. Un ajuste **anulado** deja de contar de inmediato (la vista excluye `status=false`), y queda en el
   historial con quién, cuándo y por qué.
6. Todo queda **auditado a nombre de quien lo capturó** (actor del JWT, nunca del cuerpo de la petición).
7. **Soporte ve y opera todo** (regla transversal de Jereff): el permiso de ajuste es asignable a soporte
   y los ajustes se ven con la misma visibilidad que el resto de CxP.
8. El ajuste **no** pasa por la validación «fuera de presupuesto»: es un hecho consumado. Si deja la
   cuenta sobre su presupuesto, **se le avisa** a quien captura, pero no se bloquea.
9. Un mismo cambio de datos no puede dejar los reportes distintos entre pantallas: **una sola fuente**
   del cálculo de presupuesto (la función de la vista), consumida por todas.
10. Un ajuste **no es una solicitud de pago**: no se edita, no se envía, no se aprueba, **no se paga ni se desaplica**
    (hoy «Desaplicar pago» regresaría un pagado a Aprobado: debe bloquearse para el 98) y **no sale** en los listados de
    solicitudes, «Pagar solicitudes» ni «Solicitudes pendientes». Sí sale en Reportes (estado de cuenta, Excel) y en el
    listado propio de ajustes.
11. El ajuste **no pasa por el candado de complementos (REP)**: no genera obligaciones nuevas con un proveedor ni lo bloquea
    a quien lo captura. El proveedor genérico **no se puede elegir** en solicitudes reales y **no se puede editar ni desactivar**.
12. Una solicitud **Urgente** o de **Línea de Captura** vigente lleva siempre **subtotal > 0** (la base sin IVA; si el pago no lleva IVA, igual al total). El servidor exige además
    `subtotal ≤ 1.2 × total` al crear y al editar (si es mayor que el total —pagos con **retenciones** de ISR/IVA, p. ej. honorarios— el formulario pide confirmarlo); el CHECK de BD solo exige `> 0`
    (sin tope, aunque el servidor fallara). Sin subtotal el presupuesto no la ve (pendiente #80).

## 6. Lo que este paquete entrega (alcance)

| Fase | Entrega | Visible para el usuario |
|---|---|---|
| **F0** | **Urgentes y líneas de captura con subtotal (#80):** campo «Subtotal (sin IVA)» en sus formularios, exigido por el servidor y por un candado de BD; las ya cargadas se rellenan (subtotal = total). Así el presupuesto las aparta al autorizar y las consume al pagar. **Va primero.** | Sí: un campo nuevo en dos formularios; el consumido de 2026 sube ≈ 25.7 millones de pesos y 3 cuentas pasan a «fuera de presupuesto». |
| **F1** | Cimientos: cálculo de presupuesto **por año** (función + vistas de compatibilidad), casilla **Solo anual**, selector de año en Cuentas. | Sí: casilla y selector en Configuraciones▸Cuentas. |
| **F2** | **Ajuste Presupuestal (98)**: permiso, pantalla de captura y listado, anulación, etiquetas en reportes. | Sí: pantalla «Ajustes presupuestales» (solo con permiso). |

## 7. Fuera de este paquete (con dueño)

- **Paquete 2 — PPD y cambio de año (#77):** apartar la base completa al autorizar, año presupuestal
  heredado por las parcialidades, «liberar saldo», «reasignar factura». Va **inmediatamente después** de
  este paquete (depende de la función por año de F1). Se diseña con su propio gate.
- **Carga masiva desde Excel de ajustes:** decisión de Jereff «por ahora uno por uno». El servicio de
  creación se escribe reutilizable para que una carga masiva lo llame sin rehacer reglas.
- **Divisas (#79):** tablero propio; este paquete no lo toca. (Los pagos de captura especial con subtotal 0 —#80— **entraron** al paquete como F0 el 2026-11-04. **Devoluciones** quedan
  fuera: sus cuentas no son presupuestables.)
- **Pestaña «Presupuesto» en Reportes CxP** (`PLAN-reporte-presupuesto-cxp.md`, julio): reporte con gráfica y detalle mensual. Este paquete
  construye su **base de datos** (la función por año) pero no la pestaña. **Ese plan no está registrado en el tablero de pendientes**;
  Jereff dispone si se construye ahora o se descarta.

## 8. Preguntas que siguen abiertas para Jereff

1. **¿Cierra el presupuesto 2026 en enero?** (que en 2027 ya no se puedan autorizar facturas nuevas contra
   2026 y solo se sigan pagando las ya apartadas). Es del Paquete 2; aquí solo se anota.
2. **Quién recibe el permiso de ajuste** (operación, no desarrollo): se asigna desde Configuraciones▸Permisos.
3. **Gastos que ya se cargaron como «urgentes» para que contaran — RESUELTA el 2026-11-04 por la decisión A9:** las urgentes y líneas de captura ya cargadas **pasan a contar**
   (F0 rellena su subtotal). Un histórico que ya esté cargado así **no se recaptura** como ajuste (se contaría dos veces): el ajuste es solo para gastos que **no** estén en la
   plataforma. La captura del ajuste avisa cuántas urgentes/líneas hay en esa cuenta y mes y que **ya cuentan**.
4. **¿El compromiso de una factura aprobada se fecha por su autorización?** (Paquete 2; hoy por la fecha de alta; ver §3).
5. **Facturas sin XML (tipo 6)** tienen el mismo defecto (5 pagos, 1,250 pesos): ¿entran a F0? Recomendación: sí (mismo campo, mismo relleno, costo casi nulo). Hasta que Jereff decida, **no** están en F0.
6. **Las dos cargas manuales del 29-sep-2026 (validación F0-01):** `FNTUPiGcP6fIk0x` (TRAMITES ACUPARK II, 17,879,857.53) y `VOlZZBqFAqsBAPv` (TRAMITES ACUPARK III, 5,561,857.34) son el 91 % del efecto de F0; se
   crearon como urgentes con movimiento bancario «CARGA MANUAL». ¿Son gasto de **2026**? Si sí: M10 las asienta en septiembre 2026 y esas dos cuentas quedan «fuera de presupuesto» todo el año. Si son de años
   anteriores: se **excluyen de M10** y se capturan como ajustes 98 con su fecha real (F2), y las dos urgentes se dan de baja. **Bloquea M10, no el diseño.**
7. **34 urgentes/líneas aprobadas (estado 4/99) que nunca se pagaron (validación F0-02):** 4,558,801.58 pesos en total; 2 son duplicados confirmados de facturas ya pagadas (48,531.32). CxP debe decir cuáles siguen
   vivas (lista en `temp/respaldos/f0-urgentes-lineas-4-99-sin-pago.csv`); las ya pagadas por otra vía se eliminan por la ruta existente (`devolver` → `eliminar`) o se excluyen de M10. **Bloquea M10, no el diseño.**
