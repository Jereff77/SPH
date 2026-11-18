# 00 — Brief · Facturas PPD y presupuesto (Paquete 2, tablero #77)

> Reglas acordadas con Jereff el 2026-11-17. Estado: **✅ APLICADO EN PRODUCCIÓN el 2026-11-17 (v2.82.5)** — `aplicar.sql` en una transacción (validado por Opus; 4 pruebas en seco).
> Es una pieza del paquete `docs/presupuesto-anual-y-ajustes/` (adelanta la parte de PPD; F1 la absorberá en la función por año).

## 1. Qué problema resuelve
- Las parcialidades PPD nacían con `subtotal` vacío, así que no contaban en `v_resumenPresupuesto` y la función de aprobación las veía de 0 pesos.
- Hoy: 36 parcialidades en pesos sin subtotal (20 pagadas por 2.77 M y 16 en trámite por 34.2 M) y 21 aprobadas con un subtotal que el modelo nuevo no quiere.
- Una factura PPD se paga en partes: el presupuesto debe apartarse **al aprobar la primera parcialidad** (si no, se aprueban otras facturas con ese dinero y luego no alcanza para pagarla).

## 2. Reglas (Jereff, 2026-11-17)
1. **La cuenta se pide una sola vez, al subir la factura.** «Solicitar otro pago» hereda la cuenta de la factura y no puede cambiarla (ya en v2.82.0; falta bloquear el cambio al editar el pago).
2. **Una parcialidad PPD no lleva subtotal mientras no esté pagada** (estado 1, 2, 3 o 4). Al **pagarse** (estado 6) lleva su parte proporcional de la base de la factura; el pago que liquida la factura cierra con el remanente exacto. Al desaplicarse, vuelve a quedar vacío.
3. **El apartado lo hace la factura:** desde la **primera parcialidad aprobada o pagada** se aparta la **base completa** (`cxp_ppd.subtotal`), en la **cuenta, el año y el mes de esa primera aprobación**. Lo pagado pasa a «consumido» (subtotal de las parcialidades pagadas); el resto es «comprometido». Apartado + consumido = base, siempre.
4. **No se duplica:** las parcialidades aprobadas sin pagar no suman por sí mismas (su subtotal es vacío); solo suma el saldo de la factura.
5. **Función de aprobación:** la primera aprobación de una factura valida la **base completa** contra el presupuesto; las siguientes ya no validan (la base ya está apartada).
6. **Solo pesos:** una factura PPD con alguna parcialidad en otra moneda no afecta el presupuesto todavía.
7. Pendiente con contabilidad (tablero #77): qué pasa con el saldo sin pagar al cambiar de año. Hoy el apartado cuenta en el año de la primera aprobación.

## 3. Datos verificados (2026-11-17)
- 238 facturas PPD; 234 con una sola solicitud. Ninguna factura con algo aprobado o pagado tiene saldo pendiente mayor a 1 peso (el efecto en cifras de hoy es solo la corrección de las 20 pagadas sin subtotal).
- La tabla de facturas `cxp_ppd` ya trae base (`subtotal`), `total` y `montoAplicado` (cuadra con lo pagado en las 238). No guarda fecha ni aprobador de aprobación: «aprobada» se deduce de las parcialidades.
- 2 facturas migradas de la v1 tienen base 0: el trigger y la vista las dejan como están.
- Simulación (escenario «base completa por factura aprobada»): 53-480-0 (Legal P,M) y 53-490-0 (Contabilidad P,F) pasan a sobrepasadas; 53-550-0 solo si se cuentan las no aprobadas. El aprobador de fuera de presupuesto (Evelyn) sigue siendo la válvula.

## 4. Qué cambia
| Pieza | Cambio |
|---|---|
| Base de datos | Trigger `trg_cxp_ppd_subtotal` (subtotal al pagar, vacío si no está pagada); corrección de datos idempotente; las dos vistas de presupuesto suman el saldo apartado de las facturas; función `cxp_autorizar_solicitud_pago` con la regla de primera aprobación |
| API | `aprobacion.service.ts`: el modal calcula «fuera de presupuesto» con la base en la primera aprobación y sin validar en las siguientes; `ppd.service.ts`: deja de calcular y escribir el subtotal; `solicitudes.service.ts editar()`: en un pago PPD no se cambia la cuenta |
| Web | `EditarSolicitudModal`: cuenta bloqueada en pagos PPD; modal de aprobación: aviso de PPD ya apartada |

## 5. Riesgos
- **Alto:** se reemplazan la vista central y la función de aprobación (la usan Cuentas, el modal, el agente de soporte y Looker `lkr_cxp`). Mitigación: prueba en seco con ROLLBACK, validador Opus, reversa literal, aplicar fuera del horario de captura y autorización de Jereff sobre el SQL exacto.
- **Medio:** F1 envolverá estas vistas con la función por año; el cambio se porta allí.
