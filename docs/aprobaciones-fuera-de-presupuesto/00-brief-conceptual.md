# 00 — Brief · Aprobaciones fuera de presupuesto: motivo obligatorio y reporte de auditoría

> Pedido de Jereff el 2026-11-17, **«para esta sesión»** (no es un pendiente diferido: no va al tablero).
> Estado: **BRIEF**. Nada diseñado en detalle ni construido. Paquete completo (PRD, TRD, UI/UX en Skydraw, flujos,
> backend, plan, verificación adversarial) por generar con el gate de diseño.

## 1. Qué se pidió
1. **Un reporte detallado de las facturas aprobadas fuera de presupuesto**, útil para cualquier auditoría.
2. **Un comentario de «por qué»** cada vez que se aprueba fuera de presupuesto.

## 2. Evidencia verificada el 2026-11-17 (solo lectura)
- Las 142 aprobaciones fuera de presupuesto de 2026 (junio a octubre; 21 a 37 por mes) tienen la marca `autorizadoFP`, quién aprobó
  (el aprobador configurado en `SPHConfiguraciones 'Aprobar fuera de presupuesto'`: Evelyn, las 142) y la fecha y hora.
- Al pasar la solicitud a ese aprobador queda un comentario automático fijo, «Se solicitó aprobación fuera de presupuesto», con autor y hora.
- **No queda el motivo:** 0 de 142 tienen un comentario del aprobador al aprobar. El campo existe (`comentar()` en `aprobacion.service.ts`) y es opcional.
- **No queda la foto del presupuesto al momento de aprobar:** la vista `v_resumenPresupuesto` se calcula en vivo; hoy no se puede decir
  «cuando se aprobó, la cuenta llevaba X de Y y se pasaba por Z» sin reconstruirlo.
- 93 de las 142 son de una sola cuenta (52-210-0 Mant. de Edificios, presupuesto acumulado 3,886,214 contra 5,685,220 gastado y apartado).
- Hay cuentas sobrepasadas **sin ninguna aprobación fuera de presupuesto** (53-470-0 Legal P,F; 53-980-0): se pasaron porque el sistema no veía
  las PPD, urgentes y líneas con subtotal vacío (tablero #80 y plan PPD). Una auditoría también debe verlas.

## 3. Alcance propuesto (a confirmar en el diseño)
### 3.1 Motivo obligatorio
- Al **solicitar** aprobación fuera de presupuesto (el aprobador de la cuenta) y al **aprobar** fuera de presupuesto (el aprobador FP): campo de texto obligatorio, mínimo 10 caracteres.
- Se guarda como comentario tipo propio en `cxpComentarios` (con autor y hora) y se copia a la foto de auditoría (§3.2).
- Lo anterior a esta fecha **no se inventa**: en el reporte aparece como «Sin motivo registrado (anterior al <fecha de salida>)».

### 3.2 Foto de auditoría al aprobar
- Al aprobar fuera de presupuesto se guarda, en ese instante: cuenta, presupuesto acumulado y anual, gastado, apartado, importe de la solicitud, cuánto se pasa, quién solicitó, quién pidió la excepción, quién aprobó, motivo, versión de la regla.
- Evita reconstruir con datos que cambian después (presupuesto corregido, facturas movidas).
- Cambio de esquema (tabla nueva o columnas): requiere migración autorizada por Jereff.

### 3.3 Reporte «Aprobaciones fuera de presupuesto»
- Ubicación: CxP ▸ Reportes (clave 460), pestaña nueva. Permiso de exportar propio (`reportes.exportar` ya existente o clave nueva: a decidir).
- Por factura: folio, proveedor, concepto, cuenta y sección, tipo de solicitud, subtotal y total, fecha de la solicitud, fecha de aprobación, fecha de pago,
  presupuesto acumulado y anual, gastado, apartado, cuánto se pasó (importe y porcentaje), quién solicitó, quién pidió la excepción, quién aprobó, **motivo**.
- Filtros por columna estilo Excel, rango de fechas, por cuenta. Exportación a Excel y PDF **armada en el servidor**, que respeta e imprime los filtros.
- **Segunda sección: «Sobrepasadas sin aprobación fuera de presupuesto»** (las que se pasaron sin que nadie las autorizara), marcadas aparte.
- Registros anteriores a la foto de auditoría: columnas de presupuesto **reconstruidas** y marcadas como «reconstruido».

## 4. Preguntas para Jereff (se responden en el diseño)
1. ¿Quién debe ver y exportar el reporte? (Contabilidad, Dirección, auditoría externa por exportación).
2. ¿El motivo es libre o con lista de motivos más texto? (Recomiendo texto libre obligatorio; una lista se vuelve rutina.)
3. ¿Tope de monto desde el cual el motivo exige además un segundo comentario o aviso? (opcional)
4. ¿Se incluye 2025 en el reporte o solo 2026 en adelante?

## 5. Relación con otros trabajos
- **F0 / consulta del presupuesto** (`docs/presupuesto-anual-y-ajustes/`): el reporte depende de que el consumo sea correcto; el motivo obligatorio puede ir en el mismo despliegue que F0.
- **Plan de seguridad P0** (`docs/remediacion-p0-seguridad/`): independiente; el reporte lee por el backend (`service_role`).
- **Reglas de UI** (`reglas-ui`): filtros por columna, exportación Excel/PDF corporativa en servidor, modales en portal, fechas dd/mm/aaaa.
- **Mockups:** en Skydraw (no Pencil), según la regla global del 2026-11-11.
