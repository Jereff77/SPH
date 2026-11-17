# 00 — Brief · Reporte de consumos por cuenta, con el desglose de las facturas aplicadas

> Pedido de Jereff el 2026-11-17, **«para esta sesión»** (no es un pendiente diferido: no va al tablero).
> Estado: **BRIEF**. Nada diseñado en detalle ni construido. Paquete completo por generar con el gate de diseño.

## 1. Qué se pidió
Un reporte de **consumos por cuenta** donde se **desglosen las facturas que se aplicaron** (qué compone cada cifra de «consumido»).

## 2. Por qué ahora
- Las cifras de «consumido» de Configuraciones ▸ Cuentas salen de la vista `v_resumenPresupuesto`; nadie puede ver **qué solicitudes** las forman. Hoy, para explicar un número, hay que consultar la base.
- Esta sesión mostró que el consumo estaba incompleto (urgentes, líneas, PPD, devoluciones, sin XML con subtotal vacío). Con el reporte, cualquier diferencia se ve en una línea.
- Se corrigió el 2026-11-17 el consumo de líneas de captura, devoluciones y sin XML (trigger `subtotal = total`). Siguen pendientes PPD y urgentes.

## 3. Alcance propuesto (a confirmar en el diseño)
- **Resumen por cuenta:** presupuesto acumulado y anual, consumido (pagado), comprometido (aprobado sin pagar), disponible, % de avance, por **año** (selector de año del paquete de presupuesto).
- **Desglose al abrir una cuenta:** una fila por solicitud aplicada: folio, proveedor, concepto, tipo de solicitud (normal, PPD, urgente, línea de captura, devolución, sin XML, ajuste), estado, fecha de autorización, fecha de pago, **subtotal que cuenta** y total, quién solicitó y quién autorizó, y si se aprobó fuera de presupuesto.
- **PPD:** se muestra por factura con su base, no por parcialidad (regla de Jereff: al aprobar, la factura compromete su base completa).
- **Cuadre:** el total del desglose es igual a la cifra de la vista; si no cuadra, el reporte lo marca.
- Filtros por columna estilo Excel, por mes y por tipo. Exportación a Excel y PDF **armada en el servidor**, que respeta e imprime los filtros. Permiso de exportar propio.
- Ubicación probable: CxP ▸ Reportes, pestaña «Presupuesto» (la del plan de julio, `base-conocimiento/PLAN-reporte-presupuesto-cxp.md`, que este reporte absorbe).

## 4. Preguntas para Jereff (se responden en el diseño)
1. ¿Quién lo ve? (Contabilidad, Dirección, responsables de cuenta solo de sus cuentas).
2. ¿Incluye lo **comprometido** (aprobado sin pagar) o solo lo pagado? Recomiendo ambos, separados.
3. ¿Años: 2026 y 2025, o todo?
4. ¿El desglose de una PPD muestra las parcialidades pagadas dentro de la factura?

## 5. Dependencias
- Que el consumo sea correcto: líneas, devoluciones y sin XML ya lo son; PPD (subtotal de 38 filas, código por desplegar) y urgentes siguen en trabajo.
- Función de presupuesto por año (`cxp_resumen_presupuesto_por_anio`, F1 del paquete `docs/presupuesto-anual-y-ajustes/`): el reporte debe leer la misma fuente para que siempre cuadre.
- Reglas de UI (`reglas-ui`); mockups en Skydraw.
