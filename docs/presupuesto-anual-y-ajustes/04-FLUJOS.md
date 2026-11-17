# 04 — Flujos · Presupuesto por año, «solo anual» y Ajuste Presupuestal

> Anclado a `00-brief-conceptual.md`. Cada flujo dice quién, qué ve, qué valida el **servidor** y qué queda
> en la auditoría. Los nombres de pantallas y campos son los canónicos del brief.

## F-1 · Marcar una cuenta como «Solo anual»

**Quién:** quien tenga la clave 213 (Configuraciones▸Parámetros▸Cuentas). Hoy es quien ya puede cambiar «Presup.».

1. Configuraciones▸Cuentas muestra una columna nueva **«Solo anual»** con un interruptor por cuenta.
2. La persona lo enciende. La pantalla lo refleja al instante; si el servidor falla, lo regresa y avisa.
3. **Servidor:** `PATCH /parametros/cuentas/:id/solo-anual {valor}` exige la clave 213, valida que la cuenta
   exista y guarda `PresCategorias.soloAnual`. Queda en `auditoria` con el actor del JWT (trigger).
4. **Efecto inmediato en todo el sistema** (una sola función de cálculo): el «disponible» de esa cuenta
   pasa a ser el presupuesto anual completo desde enero; el modal de aprobación, Cuentas, la validación de
   la RPC de autorización y el agente de soporte leen el mismo número.
5. Apagarlo revierte al comportamiento mensual. No hay datos que migrar.

**Casos límite**
- Cuenta sin presupuesto del año: «solo anual» no inventa dinero; el disponible sigue en 0.
- Se marca a mitad de año: las autorizaciones ya hechas no cambian de estado; solo cambia el cálculo hacia adelante.
- Un año cerrado se ve igual con o sin la casilla (en un año cerrado el acumulado ya es el anual completo).

## F-2 · Ver otro año en Cuentas

**Quién:** quien ve Configuraciones▸Cuentas.

1. Arriba de la tabla hay un **selector de año** (años con presupuesto cargado o con gasto: hoy 2025 y 2026).
2. Al elegir un año, la tabla pide al servidor `GET /parametros/cuentas?anio=AAAA`; el servidor llama a la
   función de presupuesto con ese año y a la RPC de cuentas con ese año.
3. Año en curso: comportamiento de hoy (acumulado hasta el mes actual, hora de México).
   Cualquier **otro año** (anterior o futuro): acumulado = año completo (12 meses); consumido = lo que haya en ese año. El engrane de «ajustar presupuesto mensual» sigue
   como hoy (solo se deshabilita si el año no tiene presupuesto cargado); no hay regla de «solo lectura» por año. Si hay gasto de cuentas que ya no existen en el catálogo,
   aparece una fila final «Sin cuenta en catálogo» para que el total cuadre. Nota: al ver 2025 se incluyen los estados 7 y 99 (decisión de Jereff de julio): 2025 muestra más que antes.
4. Las casillas «Presup.», «Solo anual», responsable y activa son de la **cuenta**, no del año: siguen editables.

## F-3 · Capturar un Ajuste Presupuestal

**Quién:** solo con el permiso **«Ajuste presupuestal» (432)**. Sin él, la opción no aparece en el menú y
el servidor responde 403 (Soporte lo recibe como cualquier otro permiso).

1. Cuentas por Pagar▸**Ajustes presupuestales** muestra el listado y el botón **Nuevo ajuste**.
2. El modal pide: **Cuenta** (selector con Cuenta·Sección, solo activas), **Fecha del gasto**
   (`InputFecha` dd/mm/aaaa, no futura), **Monto sin IVA** (pesos), **Descripción** (obligatoria),
   **Proveedor** (opcional).
3. Al elegir cuenta y fecha, el modal muestra una **línea informativa**: «Con este ajuste, *Cuenta* quedaría
   en X% de su presupuesto del año AAAA (disponible: N pesos)». Si lo rebasa, la línea se pone en ámbar: es un
   aviso, **no bloquea** (el gasto ya ocurrió).
   Si en esa cuenta y mes hay urgentes o líneas de captura ya cargadas (desde F0 **ya cuentan** en el presupuesto), se muestra un aviso ámbar con cuántas son y cuánto suman (para no contarlas dos veces).
4. «Guardar» (se deshabilita mientras se envía) → `POST /cxp/ajustes`. Un doble envío del mismo ajuste en menos de 60 segundos responde 409.
5. **Servidor (en este orden):** JWT válido → clave 432 vigente → esquema Zod (monto >0, ≤ 2 decimales, fecha
   válida y ≤ hoy MX, descripción 5–1000 caracteres tras `trim`, `idCategoria` existe y está activa,
   `idProveedor` —si viene— existe, está activo y no es el genérico) → inserta la fila de `cxp` con el actor del
   JWT → verifica la fila insertada (re-lectura) → responde `{ idCxp }`.
6. La fila nace: `tipoOperacion 98 · idEstado 6 · status true · subtotal = total = montoAplicado = monto ·
   moneda MXN · fecha del gasto en fc/fecSolicitud/fecAutorizacion/fecPago · sin archivos ni movimiento bancario`.
7. El presupuesto de esa cuenta, **mes y año** del gasto, refleja el consumo al instante (la vista lee `cxp`).
8. **Auditoría:** el trigger `trg_auditoria` de `cxp` registra el INSERT con el uid del actor y la hora real de
   captura (aunque `fc` lleve la fecha del gasto). Además se deja un comentario de captura (`cxpComentarios`, `tipo` 10) a nombre del actor: un segundo rastro que no depende de la tabla `auditoria`.

**Errores esperados (mensajes redactados a mano, nunca el error crudo de la BD)**
| Situación | Respuesta |
|---|---|
| Sin permiso | 403 «No tiene permiso para capturar ajustes presupuestales.» |
| Cuenta inexistente o inactiva | 400 «La cuenta seleccionada no existe o está inactiva.» |
| Fecha futura | 400 «La fecha del gasto no puede ser posterior a hoy.» |
| Monto ≤ 0 o con más de 2 decimales | 400 «El monto debe ser mayor a cero y tener máximo 2 decimales.» |
| Descripción vacía/corta | 400 «Escriba una descripción del ajuste (mínimo 5 caracteres).» |
| Falla de BD | 500 genérico («No se pudo registrar el ajuste.») + detalle solo en el log del servidor |

## F-4 · Anular un Ajuste Presupuestal

**Quién:** quien tenga la clave 432.

1. En el listado, el icono **Anular** de un ajuste activo abre un diálogo que pide **motivo** (obligatorio).
2. `POST /cxp/ajustes/:idCxp/anular {motivo}`.
3. **Servidor:** valida clave 432; lee la fila y comprueba que `tipoOperacion = 98` y `status = true`
   (nunca anula algo que no sea un ajuste, aunque el id exista); **un solo `UPDATE` atómico** `SET status = false, ultimoComentario = 'ANULADO: <motivo>'` con
   `.eq('tipoOperacion', 98).eq('status', true)` (condición de carrera: dos anulaciones simultáneas →
   la segunda recibe 409); después deja el historial en `cxpComentarios` (`tipo` 11). Siempre con `comoActor` (queda a nombre de quien anula).
4. La vista deja de contarlo de inmediato (filtra `status = true`). El ajuste sigue en el listado con la
   etiqueta **Anulado**, quién, cuándo y por qué.
5. **No se reactiva** ni se edita: para corregir se anula y se captura uno nuevo.

## F-5 · Qué cambia para el resto de la gente

- **Aprobadores:** al aprobar una factura de una cuenta «solo anual», el modal muestra el anual completo como
  disponible. Un ajuste previo ya está descontado en el consumido que ven.
- **Reportes / Excel:** los ajustes salen con la etiqueta «Ajuste presupuestal» en el tipo y con su descripción
  en el concepto; no tienen folio, XML ni proveedor real.
- **Solicitudes de pago, Pagar solicitudes, Solicitudes pendientes:** el ajuste **no aparece** (no es una solicitud) y su pago **no se puede desaplicar**
  (el servidor lo rechaza aunque alguien llame la ruta a mano). Tampoco se puede editar, enviar, devolver ni reasignar.
- **Proveedores:** el proveedor genérico «AJUSTE PRESUPUESTAL (SIN PROVEEDOR)» no se ofrece en solicitudes reales, no aparece en el padrón y no se puede editar ni desactivar.
- **Bancos / REP:** no aparecen ni generan bloqueos (no hay movimiento bancario ni factura PPD) y capturar un ajuste no se frena por complementos vencidos.
- **Agente de soporte (Montse):** puede explicar un ajuste y su efecto (la KB del módulo lo describe).

## F-6 · Urgente o línea de captura que consume presupuesto (F0 · #80)

**Quién:** quien hoy captura urgentes o líneas de captura (clave 420) y el aprobador de la cuenta (430). Cambia el dato que se captura, no el flujo.

1. En «Nueva solicitud urgente» o «Nueva línea de captura» la persona captura el **Monto** (total a pagar) y el **Subtotal (sin IVA)** (arranca igual al monto).
2. **Servidor:** esquema Zod (`subtotal` > 0, ≤ 1.2 × total por las retenciones, 2 decimales; si no, 400) → inserta con `subtotal` → igual que hoy (estado 2, aprobador = responsable de la cuenta).
3. El aprobador abre la solicitud: el modal de aprobación ya muestra el subtotal y calcula «fuera de presupuesto» con ese dato.
4. **Aprobar:** la RPC `cxp_autorizar_solicitud_pago` compara `gastado + comprometido + subtotal` contra el presupuesto acumulado de la cuenta.
   - Cabe → estado 4: el subtotal queda **apartado** (comprometido).
   - No cabe → «PAGO RECHAZADO: Presupuesto insuficiente…»; el aprobador usa «reasignar a fuera de presupuesto» y solo el aprobador configurado en `SPHConfiguraciones 'Aprobar fuera de presupuesto'` puede autorizarla (igual que una factura).
5. **Aplicar el pago** → estado 6: el subtotal pasa de comprometido a **consumido** (del mes de su fecha de autorización, como toda factura).
6. **Editar** una urgente o línea regresada a Guardado: el servidor revalida el subtotal (si no, un editar la regresaría a 0).
7. **Las ya cargadas:** M10 rellena `subtotal = total` en las 86 existentes (35 urgentes, 51 líneas); desde entonces cuentan. 3 cuentas de 2026 pasan a «fuera de presupuesto» (ver `05-BACKEND.md` §7).
