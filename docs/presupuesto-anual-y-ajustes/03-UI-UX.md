# 03 — UI/UX · Presupuesto por año, «solo anual» y Ajuste Presupuestal

> Anclado a `00-brief-conceptual.md`. **Visuales: DIBUJADOS el 2026-11-04, pendientes de aprobación de Jereff.**
> El mockup vive en `presupuesto-ajustes.pen` (esta carpeta; se abre con Pencil) y sus capturas en `mockups/`
> (`1-cuentas-anio-en-curso`, `2-cuentas-anio-anterior`, `3-ajustes-listado`, `4-modal-nuevo-ajuste`,
> `5-modal-nuevo-ajuste-avisos`, `6-dialogo-anular`, `7-menu-lateral`, `8-formulario-urgente-subtotal`). El logo se ve en el `.pen` solo si
> `logo.png` está junto al archivo; **no se versiona** (los logos viven en la BD, `branding.md`). Los datos del
> mockup son de ejemplo. Hasta que Jereff apruebe el mockup, **no se construye**.
> **2026-11-04 (F0):** se agrega la pantalla 8 (formulario de urgente/línea de captura con «Subtotal (sin IVA)», §8) y cambia el texto del aviso ámbar de la pantalla 5 (las urgentes **ya cuentan**).
> Marca: `base-conocimiento/modulos/branding.md` (azul `#1f2a4d`, fondo `#f9fafb`, tarjetas `#ffffff` con
> borde `#e5e7eb`, peligro `#dc2626`, tipografía Inter, esquinas 8–12 px, encabezado de tabla azul con texto
> blanco en mayúsculas). Logos: por MCP desde `SPHConfiguraciones` (nunca copiados).

## 1. Pantallas y componentes (todo con componentes compartidos existentes)

| Elemento | Componente existente |
|---|---|
| Tablas | `SortableTh`, `THEAD_STICKY`, `THEAD_TR`, `useSort`, filtros por columna `FiltroColumnaOpciones` (multi-selección) |
| Modales y diálogos | `components/ui/Modal.tsx` (portal sobre `body`) |
| Interruptores | `components/Toggle.tsx` |
| Fechas | `components/InputFecha.tsx` (dd/mm/aaaa) |
| Selectores con búsqueda | `components/SearchSelect.tsx` |
| Etiquetas de estado | `components/Badge.tsx` |
| Paginación | `components/Paginacion.tsx` |
| Importes | formato `es-MX` en pesos (`moneda()` como en `CuentasTab.tsx`); todo importe dice su divisa |
| Exportar | Excel con ExcelJS en el navegador sobre las filas filtradas (excepción acordada 2026-10-06), con tooltip en el icono |

## 2. Pantalla A — Configuraciones ▸ Cuentas (cambios sobre la existente)

1. **Selector de año** (a la izquierda del buscador): lista de años disponibles; por defecto el año en curso.
   Mientras carga otro año, la tabla conserva las filas y muestra un indicador sutil (sin parpadeo).
2. **Etiqueta de contexto** junto al selector cuando el año no es el actual: chip gris «Año anterior» (años pasados) o
   «Año futuro» (años siguientes), solo informativo.
3. **Columna nueva «Solo anual»** con `Toggle`, entre «Presup.» y «Acciones». Tooltip del encabezado:
   «La cuenta se mide contra su presupuesto anual completo, sin tope mensual.» Orden y filtro por columna
   (Sí/No), como el resto.
4. **El engrane «Ajustar presupuesto mensual»** funciona como hoy: se deshabilita solo si el año elegido **no tiene presupuesto cargado**
   (tooltip «Este año no tiene presupuesto cargado»). No se agrega ninguna regla de solo lectura por año (no es decisión de Jereff).
   Si hay gasto de cuentas que ya no existen en el catálogo (p. ej. 2025), la tabla agrega al final una fila **«Sin cuenta en catálogo»** con su consumido y comprometido, para que el total cuadre.
5. Cuando una cuenta es «solo anual», la celda «Presupuesto» muestra una marca pequeña «anual» al lado del
   importe (para que no se confunda con un presupuesto mensual prorrateado).
6. Errores: banner rojo existente. Falla al cambiar el interruptor → el interruptor regresa y se muestra el aviso.

## 3. Pantalla B — Cuentas por Pagar ▸ Ajustes presupuestales (nueva; clave 432)

**Menú:** nuevo ítem «Ajustes presupuestales» (`/cxp/ajustes`, `clave: 432`) bajo «Cuentas por Pagar». Descripción
del permiso en Configuraciones▸Permisos: «Registrar ajustes presupuestales (gastos históricos sin factura) y anularlos.»

**Encabezado de la página:** título, subtítulo «Gastos históricos que se registran directo en el presupuesto, sin
factura», botón primario **Nuevo ajuste**, botón secundario con icono **Exportar** (tooltip «Exportar a Excel lo que
muestra la tabla, con sus filtros»).

**Filtros superiores:** Año (selector, por defecto el año en curso), «Mostrar anulados» (casilla, apagada).
Mes, Cuenta, Capturó y Estado se filtran con el embudo de cada columna.

**Tabla (encabezado fijo azul, scroll interno sin barra visible):**

| Columna | Contenido | Notas |
|---|---|---|
| Fecha del gasto | dd/mm/aaaa | orden por defecto: más reciente primero |
| Cuenta | «Cuenta · Sección» + clave en gris | |
| Descripción | texto, 2 líneas con elipsis + tooltip completo | |
| Proveedor | nombre o «—» | el genérico se muestra «—» |
| Monto sin IVA | pesos MXN, alineado a la derecha | |
| Capturó | nombre de quien lo registró | |
| Registrado | dd/mm/aaaa hh:mm (hora real de captura, de la auditoría) | |
| Estado | Badge verde «Activo» / gris «Anulado» | |
| Acciones | icono **Anular** (tooltip «Anular ajuste»), solo en activos | no hay editar |

Fila anulada: texto atenuado y tachado en el monto; al pasar el cursor, tooltip con motivo, quién y cuándo.

**Pie de tabla:** total del monto de las filas visibles (solo activas) y paginación (50 por página).
**Estados:** cargando (esqueleto de filas), vacío («Todavía no hay ajustes en este año.»), error (banner rojo con reintentar).

## 4. Modal «Nuevo ajuste presupuestal»

Campos (en este orden):
1. **Cuenta** `SearchSelect` — «Cuenta · Sección», solo activas. Obligatorio.
2. **Fecha del gasto** `InputFecha` — dd/mm/aaaa; no futura; valor por defecto vacío (se elige a propósito, para no registrar «hoy» por inercia). Obligatorio.
3. **Monto sin IVA (pesos)** — numérico, se puede dejar vacío mientras se escribe, máximo 2 decimales; se muestra formateado al salir del campo. Obligatorio. Leyenda fija: «Capture el monto antes de IVA; el presupuesto se mide sin IVA.»
4. **Proveedor (opcional)** `SearchSelect` — activos; vacío = sin proveedor.
5. **Descripción del ajuste** — área de texto, contador de caracteres (5–1000). Obligatorio.

**Línea informativa dinámica** (debajo de los campos, aparece al elegir cuenta + fecha + monto):
«Con este ajuste, **{Cuenta}** quedaría en **{x}%** de su presupuesto de **{AAAA}** (disponible: **{N}** pesos).»
Color: gris si ≤ 100%; ámbar si > 100% con el texto «Quedaría **sobre** su presupuesto por **{N}** pesos. Puede guardarlo: es un gasto ya ocurrido.»
Si el año de la fecha no tiene presupuesto cargado: «No hay presupuesto cargado para {AAAA}; el ajuste igual se registra como consumido.»
**Aviso de urgentes y líneas de captura ya cargadas** (ámbar, solo si existen; desde F0 **sí cuentan** en el presupuesto): «Hay **{n}** pagos urgentes o de línea de captura en esta cuenta y mes que suman **{N}** pesos y **ya cuentan** en el presupuesto. Si este ajuste repite alguno de esos gastos, se contaría dos veces.»

**Botones:** «Cancelar» (secundario) y **«Guardar ajuste»** (primario; deshabilitado hasta que todo sea válido; muestra «Guardando…» y se bloquea mientras envía). Éxito: cierra, refresca el listado y avisa «Ajuste registrado». Error de negocio: mensaje dentro del modal, sin cerrarlo y sin perder lo capturado.

## 5. Diálogo «Anular ajuste»

Título «Anular ajuste presupuestal». Muestra fecha, cuenta y monto (solo lectura). Campo **Motivo** obligatorio (10–500
caracteres). Texto: «El ajuste dejará de contar en el presupuesto de inmediato. No se puede reactivar; si fue un error de captura, registre uno nuevo.»
Botones: «Cancelar» y **«Anular ajuste»** (rojo `#dc2626`).

## 6. Accesibilidad y adaptación

- Todo flotante y todo modal en portal; foco atrapado en el modal, `Esc` cierra, foco regresa al botón que lo abrió.
- Etiquetas `label` asociadas a cada campo; errores con `aria-describedby`; colores con contraste suficiente (el verde de marca no se usa para texto).
- Iconos con tooltip y `aria-label`.
- Anchos: tabla con `min-w` y scroll interno; el modal ocupa `max-w-lg` y en pantallas angostas pasa a ancho completo.

## 7. Mockups dibujados en Pencil (2026-11-04) — `mockups/`

1. `1-cuentas-anio-en-curso`: Configuraciones▸Parámetros▸Cuentas con selector de año (2026), columna «Solo anual» con su tooltip, marca «anual» y engrane deshabilitado donde no hay presupuesto.
2. `2-cuentas-anio-anterior`: año 2025 con etiqueta gris «Año anterior», engrane deshabilitado con tooltip «Este año no tiene presupuesto cargado» y fila «Sin cuenta en catálogo» (**sin** regla de solo lectura por año).
3. `3-ajustes-listado`: listado con «Mostrar anulados» encendido, una fila anulada (atenuada, con tooltip de quién/cuándo/por qué), total de activos y paginación. En el mockup la fila anulada va atenuada y con etiqueta «Anulado»; el **monto tachado** se aplica al construir (Pencil no lo dibujó).
4. `4-modal-nuevo-ajuste`: estado normal, con la línea informativa gris.
5. `5-modal-nuevo-ajuste-avisos`: aviso ámbar de «sobre su presupuesto» y aviso ámbar de urgentes y líneas de captura ya cargadas (**texto actualizado el 2026-11-04**: «ya cuentan en el presupuesto»).
6. `6-dialogo-anular`: resumen de solo lectura, motivo obligatorio, botón rojo.
7. `7-menu-lateral`: menú de Cuentas por Pagar sin el permiso 432 y con él (el ítem «Ajustes presupuestales» va entre «Bancos» y «Reportes»).
8. `8-formulario-urgente-subtotal` (F0): modal «Nueva solicitud urgente» con el campo nuevo «Subtotal (sin IVA)» (ver §8).

## 8. Formularios «Nueva solicitud urgente» y «Nueva línea de captura» (F0 · pendiente #80)

Cambio sobre los modales existentes (`NuevaSolicitudEspecial.tsx`); no cambia nada más de su diseño.
1. Debajo de **Monto** (el total a pagar) aparece **«Subtotal (sin IVA)»**. Arranca **igual al monto** y lo sigue mientras la persona no lo toque; si lo edita, deja de seguir al monto.
2. Leyenda fija bajo el campo: «Es la base del presupuesto. Si el pago no lleva IVA (trámites, impuestos, IMSS), déjelo igual al monto.»
3. Validación: obligatorio, mayor a 0, máximo 2 decimales. Si es **mayor al monto** (pago con retenciones de ISR/IVA, p. ej. honorarios) aparece una casilla **«El pago lleva retenciones: el subtotal es mayor al monto»** que hay que marcar para guardar; tope de 1.2 × el monto. Errores en línea: «El subtotal no puede ser 0.» / «El subtotal es demasiado alto respecto al monto.»
4. **Guardar** se habilita solo con subtotal válido. Mismo estilo de campo numérico que «Monto» (puede quedar vacío mientras se escribe).
5. «Editar solicitud» (urgente o línea regresada a Guardado): el campo Subtotal ya existe; para estos tipos pasa a ser obligatorio con la misma validación.
6. Modal de aprobación (sin cambio de diseño): ya muestra el subtotal; ahora mostrará el real y, si la cuenta no alcanza, la marca «fuera de presupuesto» que ya existe.
