# 05 — BACKEND · Presupuesto por año, «solo anual» y Ajuste Presupuestal

> Verificado contra la BD real (MCP `supaSPH`, solo lectura) el **2026-11-03**. Anclado a `00-brief-conceptual.md`.
> SQL exacto de las migraciones: `migraciones-borrador.sql` (NO aplicado).

## 1. Hechos verificados en la BD

| # | Hecho | Evidencia |
|---|---|---|
| V1 | `cxp.tipoOperacion` ya existe: 1 normal, 2 urgente, 4 línea de captura, 5 devolución, 6 sin XML (el 3 existe en datos: 33 filas en estado 7). El **98 no choca** con ninguno. | Conteo por `tipoOperacion/idEstado/esUrgente`. |
| V2 | Los tipos 2, 4, 5 y 6 nacen con `subtotal = 0`; la vista del presupuesto suma `subtotal`, por eso no cuentan. El ajuste debe nacer con `subtotal = monto`. **F0 (2026-11-04) corrige los tipos 2 y 4** (pendiente #80); el 5 (devoluciones, cuentas no presupuestables) queda fuera y el 6 espera la decisión de Jereff (brief §8.5). | Mismo conteo (columna `sub`) + conteo del 2026-11-04: los 35 urgentes y los 51 líneas de captura vigentes tienen subtotal 0. |
| V3 | Trigger `trigger_cxp_validar_fecha_insert` (`cxp_trigger_validar_fecha`): el INSERT solo se permite en días con `cfdi = true`, **salvo `esUrgente`**. Es la razón por la que históricos se metían como urgentes. | Definición de la función. |
| V4 | Trigger `trigger_cxp_validar_y_actualizar_proveedor`: exige `idProveedor` existente y activo en `catProveedores` (o `inversionista`) y **sobrescribe `nombreProveedor`**. | Definición. |
| V5 | Trigger `trigger_cxp_validar_fecha_cfdi` (`cxp_validar_fecha_cfdi_estado`): **DESACTIVADO de forma permanente** (`tgenabled = 'D'`; decisión de Jereff 2026-09-07). No actúa; no se reactiva. | `pg_trigger.tgenabled`. |
| V5b | Trigger AFTER INSERT `trigger_cxp_actualizar_nomcfdi` (`cxp_actualizar_nomcfdi_vacio`): si `nomCFDI` viene vacío y hay `nombreProveedor`, hace UPDATE `nomCFDI = nombreProveedor` y `fecCFDI = fecSolicitud`. El ajuste manda `nomCFDI` no vacío para evitarlo. | Definición. |
| V6 | `update_estado`: si `tdc = true` fuerza `idEstado = 7`. El ajuste lleva `tdc = false`. | Definición. |
| V7 | `numAnio`, `numMes` y `numSem` son **columnas generadas** (`EXTRACT` de `fc`, `fc` y `fecSolicitud`); `rangoSemana` lo pone el trigger `update_week_info` desde `fecSolicitud`. | `information_schema.columns`. |
| V8 | La vista `v_resumenPresupuesto`: consumido = Σ `subtotal` de `idEstado = 6` por mes/año de `fecAutorizacion`; comprometido = estado 4 por `fc`; año y mes de corte = `now()` (UTC). **No filtra `cxp.status`.** 0 filas de estados 4/6/99 tienen `status=false`. | `pg_get_viewdef` + conteo. |
| V9 | Las vistas son `security_invoker = on`, dueño `postgres`, con grants a `anon/authenticated/service_role` (RLS decide). | `pg_class`/grants. |
| V10 | La BD está en **UTC**. Desde nov-2025 `fecAutorizacion` se guarda como `timestamp` sin zona con hora UTC (horas 6–10 ausentes); **de mar a oct-2025 (datos de v1) se guardó en hora local de México**. Convertir UTC→México no mueve **ninguna** fila de mes ni de año (0 de 1,863 pagadas y 0 de 309 comprometidas), así que la conversión es segura hoy; el texto anterior «siempre UTC» era inexacto (validación adversarial D6). | `show timezone` + histograma por mes + consultas de comparación. |
| V11 | `PresCategorias` tiene `presupuestable` (bandera usada por el modal de aprobación para marcar «fuera de presupuesto»); **no** hay bandera de «solo anual». `presupuestable=false` en 2 cuentas, `true` en 76. | Conteo. |
| V12 | `Presupuestos`: 2025 (`status=false`) y 2026 (`status=true`, activo). `PresDetalle`: 2025 = 661 filas, 2026 = 816. La RPC `prescategorias_obtener_con_presupuesto` toma **solo** el presupuesto activo. | Consultas. |
| V13 | Las 12 cuentas con presupuesto en un solo mes lo tienen en **enero** (acumulado = anual todo el año): hoy ya se comportan como «solo anual» de hecho. | Consulta de `PresDetalle`. |
| V14 | `segModulos` usa 430 y 431; la **432 está libre**. `segModulosUsuarios` y `segModulos` tienen `trg_auditoria`. | Consulta. |
| V15 | `catProveedores` tiene `unique_rfc`, columnas NOT NULL: `idProveedor, status, rfc, razonSocial, nombreBanco, tipoCuenta`. No existe proveedor genérico; ningún RFC `XAXX%`. | Consultas. |
| V16 | `cxp`, `PresCategorias`, `PresDetalle`, `catProveedores`, `cxpComentarios`, `segModulos`, `segModulosUsuarios` ya tienen `trg_auditoria`. | `pg_trigger`. |
| V17 | `cxp_autorizar_solicitud_pago` (RPC, **no** `SECURITY DEFINER`) lee `public.v_resumenPresupuesto` **sin comillas = la vista en minúsculas** `v_resumenpresupuesto`, por `idCategoria`, y compara `total_gastado_comprometido + subtotal ≤ presupuesto_acumulado`. Con **ambas** vistas envueltas y `solo anual`, esta validación hereda la nueva regla sin cambiar su código. | Definición + `proacl`. |
| V18 | `prescategorias_obtener_con_presupuesto` tiene 3 parámetros; agregar un 4.º exige DROP+CREATE (un REPLACE crea sobrecarga y las llamadas de 3 argumentos quedarían ambiguas). ACL actual: `=X, postgres, anon, authenticated, service_role`. | Diseño de la migración + `proacl`. |
| V19 | **Ya existe un plan acordado con Jereff y revisado adversarialmente, sin construir**: `base-conocimiento/PLAN-reporte-presupuesto-cxp.md` (2026-07-02): función por año + vista envolvente + estados 7/99 + REVOKE/GRANT + pestaña de reporte. **No está en el tablero de pendientes** (búsqueda en `dev_pendientes`: 0 filas). Este paquete construye su SQL una sola vez. | Lectura del plan + consulta. |
| V20 | Efecto de los estados 7/99 y de `COALESCE(fecAutorizacion, fecPago, fc)` en 2026: **cero pesos** (estados 7: 33 filas y 99: 104 filas con monto, todas de 2025; 2 filas pagadas con `fecAutorizacion NULL`, de 2025; 6 filas en 99 de 2026 con subtotal 0; **F0 llena el subtotal de 4 de ellas: +65,013.00 en 2026**, ver §7). | Consultas del 2026-11-03. |
| V26 | **El comprometido (estados 4/99) se fecha por `fc`** (alta de la solicitud), igual que la vista de hoy y que el plan de julio. Hueco conocido: 3 facturas creadas en dic-2025 y aprobadas en ene-2026 (`f6wAQJ5cqiHCLW9` $614,331.86 en 11-603-0; `gvbZAfvFqhiIFUm` $11,440.72 y `ozcA6vx5jrbeBcT` $4,800.00 en 11-602-0 = **$630,572.58**) no cuentan como comprometido de 2026 y sí de 2025. No voltea ningún `dentro_presupuesto` hoy. Fecharlo por autorización es justo la regla de contabilidad (año de origen) y **se resuelve en el Paquete 2**; aquí se conserva el comportamiento actual para no mover cifras en F1. | Validación adversarial D1. |
| V27 | Un CHECK que evalúa a NULL **pasa** en Postgres: el CHECK del 98 debe usar `IS DISTINCT FROM`, `IS NOT NULL` y `COALESCE` (corregido en M6). Un 98 con proveedor real **no se puede anular** si luego desactivan a ese proveedor (el trigger de proveedor exige activo en todo UPDATE): se bloquea desactivar un proveedor con ajustes activos. | Validación adversarial D2, D3. |
| V28 | Las políticas RLS de `cxp`, `segModulosUsuarios` y `auditoria` son `USING (true)` para `authenticated` (P0 conocido del tablero: **#2** «cualquier empleado con login puede leer y escribir la BD saltándose el backend» y **#3** «cualquiera puede concederse todos los permisos»). El permiso 432 es tan fuerte como todos los demás permisos del sistema; M8 evita al menos que un 98 se cree/edite/borre sin pasar por el servicio. | Validación adversarial S-1 + `pg_policies`. |
| V29 | `status = false` nunca ha existido en `cxp` (todas las filas son `true`); Looker (`lkr_cxp`) y n8n no lo filtran. M9 los ajusta (sin efecto con los datos de hoy). El agente de soporte consulta con SQL libre: la KB debe decirle «para gasto real, `status = true`». | Validación adversarial D4, M-02. |
| V30 | **F0.** La RPC `cxp_autorizar_solicitud_pago` valida `total_gastado_comprometido + subtotal ≤ presupuesto_acumulado` con el subtotal **de la fila** (NULL→0): con subtotal 0 toda urgente/línea pasa «dentro de presupuesto». Con el dato lleno, una que no cabe recibe «PAGO RECHAZADO: Presupuesto insuficiente» y solo la autoriza el aprobador de `SPHConfiguraciones 'Aprobar fuera de presupuesto'` (la ruta `reasignarFueraPresupuesto` ya existe). Si cabe, pone `idEstado = 4` y `fecAutorizacion = NOW()`. | Definición de la RPC, 2026-11-04. |
| V31 | **F0.** Un `UPDATE` que solo cambia `subtotal` no cambia nada más: `trigger_cxp_actualizar_gerente` retorna sin tocar si `idCategoria` no cambia; `trigger_cxp_validar_y_actualizar_proveedor`, `trigger_cxp_validar_categoria` y `trigger_actualizar_nom_gerente` son `UPDATE OF` otras columnas (no se disparan); `cxp_trigger_validar_fecha` retorna si no cambia `idEstado`; `set_estado` y `set_week_info` recalculan lo mismo. `trg_auditoria` registra el cambio (por MCP queda `uid NULL`, `origen = 3`, como en la corrección PPD). Las 86 filas a tocar: 0 con proveedor inexistente o inactivo; 2 urgentes en cuentas inactivas/inexistentes y 7 con aprobador distinto al responsable actual de su cuenta (irrelevante para el UPDATE). | `pg_get_triggerdef` + `pg_get_functiondef` + consulta, 2026-11-04. |
| V32 | **F0.** `SolicitudesService.editar()` (`solicitudes.service.ts:686-733`) escribe `subtotal` y `total` desde el cuerpo (esquema con `subtotal` default 0) **sin mirar el tipo**: una urgente o línea regresada a Guardado y editada volvería a subtotal 0. `editable()` no trae `tipoOperacion`. El modal de edición (`EditarSolicitudModal.tsx`) ya tiene el campo Subtotal. | Lectura del código, 2026-11-04. |
| V33 | **F0.** Solo existen 2 filas pagadas con `fecAutorizacion NULL` (una urgente de 2025 y una factura normal); la función las cuenta con `COALESCE(fecAutorizacion, fecPago, fc)`. No requiere nada especial. | Consulta, 2026-11-04. |
| V34 | **Corrección a V27/C9 (por confirmar en la prueba 2.2).** El trigger `trigger_cxp_validar_y_actualizar_proveedor` está definido `BEFORE INSERT OR UPDATE OF "idProveedor", "tipoProveedor"`: una **anulación** (UPDATE de `status`/`ultimoComentario`) **no lo dispara**, así que anular un ajuste cuyo proveedor fue desactivado funcionaría. La regla «rechazar desactivar un proveedor con ajustes activos» sería una precaución, no una necesidad; se decide en la validación de F2. | `pg_get_triggerdef`, 2026-11-04. |
| V35 | **F0-01.** Dos cargas manuales hacen el 91 % del efecto de F0: las urgentes `FNTUPiGcP6fIk0x` (TRAMITES ACUPARK II, 17,879,857.53) y `VOlZZBqFAqsBAPv` (TRAMITES ACUPARK III, 5,561,857.34), creadas, aprobadas y pagadas el **29-sep-2026** con movimiento bancario «CARGA MANUAL» (históricos metidos como urgentes). Son las únicas filas de esas dos cuentas. Si son gasto de años anteriores, M10 las asienta en septiembre 2026 (contra A2: fecha real). | Validación adversarial F0 + consulta 2026-11-04. |
| V36 | **F0-02.** Hay 34 urgentes/líneas en estado 4 o 99 sin pago aplicado (4,558,801.58 pesos en total) y 2 son duplicados confirmados de facturas ya pagadas: `j0z0Vt7IWrW1i8l` = `R93lNrp8vRXrwsN` (3,248.00) y `8yDZ3C0soB2ejVH` = `oS1dO6bAbeCeH9V` (45,283.32). M10 las volvería comprometido permanente (doble conteo de 48,531.32). Lista para CxP: `temp/respaldos/f0-urgentes-lineas-4-99-sin-pago.csv`. | Consulta 2026-11-04 (coincidencia exacta de proveedor, cuenta y total). |
| V37 | **F0-03.** Con retenciones el subtotal es MAYOR que lo que se paga: 124 de 2,005 facturas normales aprobadas/pagadas tienen `subtotal > total` (24 proveedores). Ejemplo: la urgente `8yDZ3C0soB2ejVH` paga 45,283.32 y su factura `oS1dO6bAbeCeH9V` dice subtotal 47,500. La regla «subtotal ≤ total» y la frase «lado conservador» eran incorrectas para esos casos. | Consulta 2026-11-04. |
| V21 | `PagosService.desaplicarPago` (`pagos.service.ts:822-864`) acepta cualquier `idEstado ∈ {6,7}` aunque no haya movimiento bancario y lo regresa a `idEstado = 4`, `montoAplicado = 0`, `fecPago = NULL`: **destruiría un ajuste**. UI: botón 🏦 y «Desaplicar pago» (`PagarSolicitudesPage.tsx:368,422-430`, `TransferenciaModal.tsx:52-54,85-96`). | Mapeo de consumidores. |
| V22 | `SolicitudesService.insertarEspecial` (`solicitudes.service.ts:951-972`) **no usa `mapearErrorCxp`**: un `CXP_CFDI_NO_HABILITADO` se vería como 500 genérico. | Mapeo. |
| V23 | La clave **431 no se usa** en ningún `@RequierePermiso` ni `tienePermiso`: el «aprobar fuera de presupuesto» real lo decide `SPHConfiguraciones.'Aprobar fuera de presupuesto'`. El molde de gating correcto es el de la **403** (`ppd.controller.ts:149-150`, `PpdPage.tsx:311`). `segModulos.modulo` es un ENUM `"Modulos"` (cast obligatorio). Claves libres en CxP: 404, 421–429, 432+. | Mapeo + consulta. |
| V24 | No existe proveedor «genérico». `catProveedores` no tiene columna de tipo: el único filtro posible es `status`. Un genérico activo saldría en `catalogos()`, `filtros()` de pagos, `proveedores.listar()` (editable/desactivable) y los combos de Reportes. | Mapeo. |
| V25 | `cxp` no tiene CHECK sobre `tipoOperacion`/`idEstado`; `UNIQUE(folio)` → el ajuste lleva `folio NULL`. `'-'` como `idCategoria` fuerza `idEstado = 1` (el ajuste exige una cuenta real con responsable). | Mapeo. |

### Evidencia de equivalencia (corrida el 2026-11-03, solo lectura)
La lógica **unificada** (estados 6+7 / 4+99, `COALESCE` de fechas, `status = true`, hora de México) se ejecutó como
consulta (sin crear nada) para 2026 con `soloAnual = false` y se comparó contra `v_resumenPresupuesto`:
**82 cuentas en ambos lados; 0 diferencias de dinero** (presupuestos, gastado, comprometido, disponibles, avances, dentro de presupuesto);
**solo** `transacciones_comprometidas` cambia en 3 cuentas (6 aprobaciones en estado 99 con monto 0 ahora cuentan como transacción).
Un segundo revisor (Opus) repitió la comparación de las 26 columnas por su cuenta —incluido `estado_comprometido`— con el mismo resultado; la única diferencia
restante es ruido de doble precisión ≤ 1e-9 pesos. Con M1+M2+M2b **y sin contar F0**, 0 cuentas cambian su disponible mañana (F0 sí cambia cifras: ver §7 y la tarea 1.4 del plan).
Una primera versión sin 7/99 había dado 0 diferencias en 22 columnas. La prueba se repite con la función ya creada y **antes**
de reemplazar las vistas (M2 → prueba → M2b): `temp/diseno-ajuste-presupuestal/prueba-equivalencia.sql`.
⚠️ La prueba se corrió como consulta, no como función: **falta ejecutar la función real** (la BD tiene `plpgsql.variable_conflict = error`;
una referencia sin calificar revienta en la primera ejecución, no al crear). Va en el plan como paso obligatorio.

## 2. Cambios de BD (migraciones; cada una con autorización caso por caso)

Ver `migraciones-borrador.sql`. **Tres despliegues.** **F0** (va primero): código F0 → push 0 → **M10** relleno del subtotal → verificar → **re-ejecutar M10** (idempotente) → **M11** candado `cxp_subtotal_captura_especial_chk`. Aquí la BD va
**después** del código a propósito: el código nuevo ya escribe el subtotal, así no nacen filas nuevas en 0 y el CHECK no rompe altas ni la propia migración; M11 solo después de M10. F1: **M1** columna `soloAnual` → **M2** función `cxp_resumen_presupuesto_por_anio` (`SECURITY INVOKER`, REVOKE/GRANT) →
*(ejecutar la función real + prueba de equivalencia)* → **M2b** las **dos** vistas envueltas → **M7** RPC de cuentas con año → código F1. F2: **M3** trigger de fecha →
**M4** permiso 432 → **M5** proveedor genérico → **M6** CHECK del 98 → **M8** guardia (solo el servicio toca un 98) → **M9** vistas externas sin anulados →
prueba de forma con ROLLBACK → código F2 (**la BD siempre antes que el código**). Cada bloque tiene reversa. Antes de aplicar: respaldo de
definiciones (`pg_get_viewdef` + `reloptions` + GRANTs de las dos vistas, `pg_get_functiondef` de las funciones tocadas) y CSV de
`PresCategorias` en `temp/respaldos/`. Prueba de forma del INSERT del ajuste: una transacción con `ROLLBACK` (también requiere autorización).

## 3. Forma exacta de la fila de un Ajuste Presupuestal

Insertada por el servicio con `comoActor(actorUid)`. **Nada de esto viene del cliente salvo `idCategoria`, `fecha`,
`monto`, `descripcion`, `idProveedor?`.**

| Columna | Valor |
|---|---|
| `idCxp` | id aleatorio de 15 caracteres (mismo generador que los especiales) |
| `tipoOperacion` | `98` |
| `idEstado` | `6` (el trigger pone `estado = 'Pagado'`) |
| `status` | `true` |
| `uidr`, `autorizo` | uid del actor (JWT) |
| `idProveedor` / `tipoProveedor` | el elegido o `'AJUSTE-PRESUPUESTAL'` / `1` |
| `idCategoria` | la elegida (cuenta activa) |
| `concepto`, `ultimoComentario` | la descripción (trim) |
| `subtotal`, `total`, `montoAplicado` | el monto (2 decimales, > 0) |
| `moneda`, `tdc`, `diferido`, `esUrgente`, `completada` | `'MXN'`, `false`, `false`, `false`, `true` |
| `fc`, `fecAutorizacion`, `fecPago` | `fecha + 'T12:00:00'` (hora neutra: no cambia de día al convertir UTC↔México) |
| `fecSolicitud` | `fecha` |
| `folio`, `fecCFDI`, `urlCFDI`, `urlXLM`, `idMovBancarios`, `idCxpPPD`, `lineaCaptura`, `referencia` | `NULL` |
| `nomCFDI` | `'AJUSTE PRESUPUESTAL'` (no vacío: evita que el trigger AFTER INSERT rellene `fecCFDI`; ver V5b) |
| `autorizadoFP` | `false` |

La hora real de captura y el actor quedan en `auditoria` (INSERT) — no se sobrescribe con la fecha del gasto.

## 4. API NestJS

Archivos nuevos en `apps/api/src/modules/cxp/`: `ajustes.service.ts`, `ajustes.controller.ts`, `ajustes.schemas.ts`,
`ajustes.service.spec.ts`, `ajustes-integracion.spec.ts` (+ registro en `cxp.module.ts`). Parámetros: ampliar
`parametros.service.ts`/`.controller.ts`/`.schemas.ts` (año y `soloAnual`).

### 4.1 Esquemas (Zod)
Todos con `.strict()` (campos desconocidos = 400).
- `crearAjusteSchema`: `idCategoria` string no vacío; `fecha` ISO `YYYY-MM-DD` válida, **≤ hoy en `America/Mexico_City`** (calculado con `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' })`, no con `new Date()` en UTC; prueba en la franja 18:00–24:00 México), ≥ `2000-01-01`;
  `monto` recibido como **cadena** con `^\d{1,9}(\.\d{1,2})?$` y luego `Number()` (los flotantes de JS rechazarían montos válidos: `1.15*100 = 114.99999999999999`); `> 0`; **tope 999,999,999.99** (la RPC de autorización formatea con `'999,999,999.99'`);
  `descripcion` `trim`, 5–1000, **sin caracteres de control ni bidireccionales** (U+202A–U+202E, U+2066–U+2069, U+200E/F);
  `idProveedor` opcional string (no vacío) distinto de `AJUSTE-PRESUPUESTAL`.
- `anularAjusteSchema`: `motivo` `trim`, 10–500 (mismo saneo).
- `listarAjustesQuery`: `anio` (2000–2100, opcional), `mes` 1–12 opcional, `idCategoria` opcional, `incluirAnulados` parseado a mano (`'true'` → true; `z.coerce.boolean('false')` daría `true`), `pagina`/`tamano` (máx. 200).

### 4.2 Reglas del servicio (`AjustesService`)
1. `crear(dto, actorUid)`: valida cuenta (`PresCategorias` existe y `status = true`); valida proveedor si viene
   (existe, `status = true`, `tipoProveedor`=1, ≠ genérico); arma la fila (§3) **desde constantes**, nunca desde el DTO crudo; inserta; **relee la fila**
   y verifica la forma (`tipoOperacion 98`, `idEstado 6`, `subtotal = monto`) — si no coincide, revierte con `status=false` y responde 500 (patrón de verificación posterior de `ppd.service.ts`); responde `{ idCxp }`.
   **Protección contra doble envío:** si el mismo actor ya registró un ajuste activo con la misma cuenta, fecha, monto y descripción en los últimos 60 segundos → 409 «Este ajuste ya se registró.» (la UI además deshabilita el botón al enviar).
   **Rastro propio de la captura:** inserta un `cxpComentarios` con `tipo = 10` (captura de ajuste) y `uidr` = actor, para no depender de la tabla `auditoria` (que hoy cualquier usuario con sesión puede borrar; ver V28).
2. `anular(idCxp, motivo, actorUid)` — **con `comoActor`**, nunca `admin`: lee por `idCxp` y exige `tipoOperacion = 98`; si `status = false` → 409 «El ajuste ya estaba anulado.»;
   **un solo `UPDATE` atómico** `SET status = false, "ultimoComentario" = 'ANULADO: <motivo>' WHERE idCxp=? AND tipoOperacion=98 AND status=true` con `.select()` y 409 si no afectó filas (carrera) —
   así el motivo viaja en la misma sentencia que el cambio de estado y nunca queda un ajuste anulado sin motivo—; después inserta `cxpComentarios` con `tipo = 11` (anulación) como historial
   (si ese insert falla se registra en el log y la anulación sigue vigente). «Anulado por/cuándo/por qué» se deriva del comentario `tipo = 11` y de `ultimoComentario`, **no** de un prefijo de texto.
   Anular un ajuste cuyo proveedor fue desactivado funciona porque se bloquea desactivar proveedores con ajustes activos (ver C9).
3. `listar(query)`: `from('cxp').eq('tipoOperacion', 98)`, filtros, `status` según `incluirAnulados`, orden por `fecAutorizacion desc`, `range()`; une nombres de cuenta, de quien capturó (`uidr`) y, si está anulado, el comentario `tipo = 11` (motivo, autor, fecha).
4. `vistaPrevia(idCategoria, fecha, monto)`: `rpc('cxp_resumen_presupuesto_por_anio', {p_anio})` filtrada por cuenta; calcula consumido proyectado y porcentaje (solo cifras de **esa** cuenta; exige 432); **solo lectura**.
   Además cuenta las **urgentes y líneas de captura de esa cuenta y mes** (tipos 2 y 4, `status = true`, estados 4/6/7/99, fechadas como las cuenta la función: pagadas por
   `COALESCE(fecAutorizacion, fecPago, fc)`, aprobadas por `fc`) y devuelve cuántas son y cuánto suman (`subtotal`), para avisar a quien captura que **ya cuentan** en el presupuesto
   (desde F0) y que, si repite alguno como ajuste, se contaría dos veces (validación adversarial D5; texto actualizado el 2026-11-04).
5. `catalogos()`: cuentas activas (`idCategoria, cuenta, seccion`) y proveedores activos **excluyendo** `AJUSTE-PRESUPUESTAL`.
6. Errores: los `CXP_*` de los triggers pasan por `mapearErrorCxp` (`common/filters/cxp-error-mapper.ts`) **antes** del 500 (hoy `insertarEspecial` no lo hace);
   todo 5xx con `fallaBd(this.logger, 'cxp.ajustes.<op>', error)`; todo 4xx con texto redactado (ver `04-FLUJOS.md`).
7. **No** llama `bloqueo.verificar` (decisión: el ajuste no es una solicitud ni crea obligaciones con un proveedor; ver brief §5.11).
8. Constante única `ID_PROVEEDOR_AJUSTE = 'AJUSTE-PRESUPUESTAL'` y `TIPO_OPERACION_AJUSTE = 98` en `ajustes.constants.ts`, importadas por todos los servicios que excluyen.

### 4.3 Permisos
`@RequierePermiso(432)` a nivel de **clase** en el controlador **propio** de ajustes (`@Controller('cxp/ajustes')`, con `JwtAuthGuard` + `PermisoGuard`;
no hereda el 420). `@RequierePermiso(213)` en las rutas de cuentas (incluida la nueva de `solo-anual`, molde `setPresupuestable`). La clave 432 se agrega a
`permisos-descripciones.ts` (web, junto a la 431) y al menú (`menu.tsx`, ítem «Ajustes presupuestales» → `/cxp/ajustes`, `clave: 432`) y a la ruta en `router.tsx`.
Para asignarla: la RPC `segmodulosusuarios_smu` crea la fila `acceso=false` al abrir al usuario en Configuraciones▸Permisos; Soporte (`isSupport`) pasa siempre.
**Se agrega una prueba que falla si el controlador de ajustes pierde su decorador de permiso.**

### 4.4 Cuentas y año
- `listarCuentas(anio?)`: llama `rpc('prescategorias_obtener_con_presupuesto', { …, p_anio })` y `rpc('cxp_resumen_presupuesto_por_anio', { p_anio })`
  (en vez de leer la vista) para el consumido del año elegido; devuelve además `soloAnual` y `anio`. En los métodos de `parametros.service.ts` que se
  toquen, los errores pasan a `fallaBd` (hoy devuelven `error.message` crudo: incumple la regla 4b; «cada error nuevo que se identifique, se corrige»).
- `aniosDisponibles()`: años de `Presupuestos` ∪ años de `PresDetalle` ∪ años con `cxp` estado 6 (hora México).
- `setSoloAnual(idCategoria, valor)`: `update PresCategorias set soloAnual` por `idCategoria` **con `comoActor(actorUid)`** (el molde `setPresupuestable` escribe con `admin` y la auditoría guarda `uid NULL`; se corrige junto con sus hermanas `cambiarResponsable`/`setStatusCuenta` por estar en el mismo archivo); 404 si no afectó filas.
- **No** se agrega ninguna regla de «años anteriores = solo lectura» en el servidor (no está entre las decisiones de Jereff y bloquearía en enero corregir el presupuesto 2026, que seguiría siendo el activo). El engrane de presupuesto mensual solo se deshabilita si el año no tiene presupuesto cargado (como hoy).
- Cuentas que **no existen en el catálogo** pero sí tienen gasto en el año (p. ej. 2025: `-`, 31, 50, 63, 71, 79, 80, $1,095,324.32): `listarCuentas(anio)` agrega una fila «Sin cuenta en catálogo» con su consumido y comprometido, para que la suma de la pantalla cuadre con la función.

### 4.5 F0 — Urgentes y líneas de captura con subtotal (pendiente #80)

Archivos **existentes** (no nuevos): `solicitudes.schemas.ts`, `solicitudes.service.ts` (+ su spec), `common/filters/cxp-error-mapper.ts`; web `NuevaSolicitudEspecial.tsx`, `EditarSolicitudModal.tsx`,
`solicitudes.api.ts`. ⚠ Varios tienen trabajo ajeno sin commitear (plan §0): se toca lo mínimo y el commit es por hunks propios.
1. `crearUrgenteSchema` y `crearLineaCapturaSchema`: campo `subtotal` (`z.coerce.number()` como `total`, > 0, máx. 2 decimales, **≤ 1.2 × total**: cubre IVA y **retenciones** (124 facturas normales aprobadas o pagadas ya tienen `subtotal > total`, V37); si es mayor que el total el formulario pide confirmarlo; mensajes «El subtotal no puede ser 0.» y «El subtotal es demasiado alto respecto al monto.»).
   En la línea de captura llega como cadena en el multipart: la coerción lo cubre.
2. `crearUrgente` y `crearLineaCaptura` escriben `subtotal: dto.subtotal` (hoy no lo escriben y queda el DEFAULT 0 de la columna).
3. `editable()` agrega `tipoOperacion` al select; `editar()`: si `tipoOperacion ∈ {2, 4}` exige `0 < subtotal ≤ total` (400 con el mismo mensaje).
4. `mapearErrorCxp`: hoy solo reconoce mensajes `CXP_…` (regex `^(CXP_[A-Z_]+)`, `cxp-error-mapper.ts:69-73`) y `insertarEspecial` y `editar()` **no lo llaman** (lanzan 500 directo): se amplía para reconocer
   `code === '23514'` + el nombre de `cxp_subtotal_captura_especial_chk` (400 «Capture el subtotal (sin IVA) de la solicitud.»; mismo cambio del `23514` del 98) y se llama en `insertarEspecial` y en `editar()`; prueba unitaria de ambos.
5. **Sin cambio** en `aprobacion.service.ts` ni en la RPC: leen el `subtotal` de la fila; con el dato lleno, el modal y la RPC dejan de ver 0 (V30).
6. Pruebas: subtotal 0 → 400; subtotal > total → 400; subtotal = total → pasa; la fila insertada lleva el subtotal; editar una urgente con subtotal 0 → 400; editar una factura normal (tipo 1) no cambia
   de comportamiento; el modal de aprobación calcula «fuera de presupuesto» con el subtotal real de una urgente.

## 5. Compatibilidad y despliegue

**Push 0 (F0):** código F0 → push → M10 → verificar → M10 otra vez → M11 (la BD va después del código a propósito; ver §2). **Push 1 (F1):** M1 → M2 → función real + prueba → M2b → M7 → push. **Push 2 (F2):** M3 → M4 → M5 → M6 → M8 → M9 → prueba de forma con ROLLBACK → push → Jereff asigna la 432.
Siempre la BD antes que el código (si F2 saliera antes que sus candados, Soporte —que pasa cualquier permiso— podría capturar ajustes sin CHECK ni proveedor genérico).
Entre la migración y el despliegue, el código viejo sigue funcionando (vistas con las mismas columnas; RPC con `p_anio` opcional). Cada push es **paso aparte
y explícito** de Jereff (redespliega api+web). `mapearErrorCxp` se amplía para traducir el CHECK `23514` de un 98 a 400 legible.

## 6. Consumidores afectados (mapeo del 2026-11-03; completo en `temp/diseno-ajuste-presupuestal/consumidores.md`)

Supuesto: fila 98 = Pagado, sin proveedor real, sin archivos, sin banco, fecha histórica. Rutas relativas a `version2/`.

### 6.1 Cambios obligatorios (riesgo alto/medio) → cada uno es una tarea de `06-PLAN.md` con su prueba

| # | Consumidor | Problema | Acción |
|---|---|---|---|
| C1 | `cxp_trigger_validar_fecha` (BD) | Rechaza el INSERT en días sin `cfdi=true` salvo urgentes | M3 |
| C2 | `apps/api/src/modules/cxp/pagos.service.ts:822-864` `desaplicarPago` | Destruye el ajuste | Rechazar si `tipoOperacion = 98` (400 «Un ajuste presupuestal no se puede desaplicar; anúlelo.») |
| C3 | `pagos.service.ts:108` (`COLS`) y `apps/web/src/features/cxp/pagos.api.ts:14-23` (`PagoRow`) | No traen `tipoOperacion` | Agregarlo |
| C4 | `PagarSolicitudesPage.tsx:368,422-430`, `TransferenciaModal.tsx:52-54,85-96` | 🏦 y «Desaplicar» para todo 6/7 | Ocultar para el 98 (defensa; el 98 ya no llega por C5) |
| C5 | `pagos.service.ts:119-197` `listar()` y `:293-319` `filtros()` | El 98 saldría en «Pagado» y en los totales del pie; el genérico en el filtro de proveedor | `.neq('tipoOperacion', 98)`; excluir el genérico |
| C6 | `pendientes.service.ts:41-51` `anios()`, `:71-118` `listar()`, `:208-233` `cambiarResponsable()` | Listaría el 98; se podría reasignar | `.neq('tipoOperacion', 98)` en lecturas; rechazar `cambiarResponsable` para 98 |
| C7 | `solicitudes.service.ts:64-85` `semanas()` y `:88-132` `listar()` | Semanas históricas en el selector del solicitante | `.neq('tipoOperacion', 98)` |
| C8 | `solicitudes.service.ts:230-246` `catalogos()`; `pagos.service.ts:300-304` | El genérico sale como proveedor en todas las solicitudes | Excluir `idProveedor = 'AJUSTE-PRESUPUESTAL'` |
| C9 | `proveedores.service.ts:38-46` `listar()`, `:78-107` editar, `:109-119` `setStatus` y `ProveedoresPage.tsx:36-44` | El genérico sale en el padrón y se puede desactivar (rompería nuevos ajustes) | Ocultarlo del listado y rechazar editar/desactivar (400). **Además: rechazar desactivar (`setStatus(false)`) a cualquier proveedor que tenga ajustes 98 activos** (si no, ese ajuste quedaría imposible de anular: el trigger de proveedor exige proveedor activo en todo UPDATE) |
| C10 | `pagos.service.ts:537-584` `movimientos()`, `:721-795` `analizarComprobante()`, `:798-819` `verTransferencia()` | No validan que no sea 98 | Rechazar para 98 (defensa en profundidad) |
| C11 | `parametros.service.ts:88-124` `listarCuentas`, `:137-166` crear/editar cuenta + `parametros.schemas.ts:19-34`, `parametros.controller.ts:134-142`, `parametros.api.ts`, `CuentasTab.tsx` | Año + `soloAnual` | Ver §4.4 y 06-PLAN F1 |
| C12 | `aprobacion.service.ts:159-201,259-311` + RPC `cxp_autorizar_solicitud_pago` | Leen la vista (columnas por nombre) | Sin cambio de código; **prueba** con una cuenta `soloAnual` y con consumo de un ajuste |
| C13 | `packages/types/src/database.types.ts:9017,9048,10501` | Tipos de vistas/RPC/`PresCategorias` | **Regenerar** (el `.select()` tipado de `aprobacion.service.ts:162` depende de ellos) |
| C14 | `base-conocimiento/modulos/cxp.md` §2 (lista tipos 1–6) y frontmatter `claves_permiso`; `configuraciones.md` | El agente de soporte ruta por ese frontmatter | Documentar el tipo 98, la clave 432 y «solo anual» (skill `kb-agente-soporte`) |
| C15 | F0: `solicitudes.schemas.ts` (`crearUrgenteSchema`, `crearLineaCapturaSchema`), `solicitudes.service.ts` (`crearUrgente`, `crearLineaCaptura`, `editable`, `editar`), `NuevaSolicitudEspecial.tsx`, `EditarSolicitudModal.tsx`, `solicitudes.api.ts`, `cxp-error-mapper.ts` | Alta y edición no capturan/validan el subtotal | Ver §4.5 |
| C16 | F0: reportes (`ReportesCxpPage.tsx` columna Subtotal), Looker (`lkr_cxp`), `n8n_cxp_resumen`, agente de soporte, KB `cxp.md` | El subtotal de urgentes/líneas deja de ser 0 | Sin cambio de código (mejora); la KB de `cxp.md` explica que urgentes y líneas **consumen presupuesto** desde F0 |

### 6.2 Etiquetar / aceptar (riesgo bajo o medio sin cambio de código)

- `cxp_get_estado_cuenta_detalle_v2` (RPC compartida; `reportes.service.ts:149`): el 98 aparece como Pagado bajo su proveedor (el genérico, o el elegido), suma en totales y **no devuelve `tipoOperacion`**. Aceptado: se identifica por el nombre del proveedor y el concepto. Cambiar la RPC no entra en este paquete.
- `cxp_get_unique_values_v2`, `cxp_get_filtros_dependientes_v2`: el genérico sale en combos de Reportes: aceptado (es informativo).
- Vistas `lkr_cxp` (Looker) y `n8n_cxp_resumen`: incluyen el 98 (`lkr_cxp` ya expone `tipoOperacion`). **No se verificó qué tableros de Looker o flujos de n8n existen**: se avisa a Jereff.
- Realtime (`realtime.service.ts:35-43`): cualquier cambio de `cxp` refresca pantallas; con captura uno por uno no es problema (una carga masiva futura deberá espaciarse).
- Agente de soporte (`consultas.service.ts:54-63`, `v2_agente_ro`): ve el 98 con el resto de `cxp`; la KB le explica qué es.
- `ia_consulta_sql` (Montse de Ventas): `cxp` está en su lista de bloqueo; sin efecto.

### 6.3 No afecta (verificado)
Bloqueos y avisos de REP (`bloqueo.service.ts`, `rep-pendientes.service.ts`, landing, `complementos.scheduler.ts`: filtran `diferido = true`; el 98 es `false`); todo `ppd.service.ts` (por `idCxpPPD`/`folio`);
recordatorios de aprobación (estado 2); pantalla de aprobar (estados 2/3/4); `cxp_aprobados_sin_pago_aplicado` (estado 4); `tipoOperacion` de Ventas/Fideicomiso (otras tablas).

### 6.4 Pruebas que faltan por limitación del mapeo
No se ejecutó ningún INSERT de prueba: el comportamiento de los triggers sobre una fila 98 se dedujo de sus definiciones. Antes de construir el servicio se corre, **con autorización**,
un INSERT dentro de `BEGIN … ROLLBACK` (una sola llamada) con la fila exacta de §3 y se verifica que no revienta y que la fila queda como se espera; y se vuelve a correr
después de M3/M5/M6. No se probó Flutter v1 (apagado según el contrato) ni los tableros externos.

## 7. Efecto medido de F0 (2026-11-04, solo lectura)

**Relleno M10:** 86 filas vigentes con subtotal 0 (35 urgentes + 51 líneas de captura; todas con proveedor activo). Regla: `subtotal = total`.

**2026** (año en curso; estados 4 y 6, que son los que cuenta la vista de hoy), todo en cuentas presupuestables. Coincide con el alcance del #80 (13 urgentes por 24,275,721.79 y 22 líneas por 1,453,065.35):

| Tipo | Estado | Filas | Total (pesos) |
|---|---|---|---|
| Urgente | 4 aprobada (se aparta) | 5 | 679,022.12 |
| Urgente | 6 pagada (se consume) | 8 | 23,596,699.67 |
| Línea de captura | 4 aprobada | 1 | 22,222.00 |
| Línea de captura | 6 pagada | 21 | 1,430,843.35 |
| **Efecto de F0 en 2026** | | **35** | **25,728,787.14** |
| Línea de captura | 99 aprobada sin pago (cuenta desde F1 por la regla de julio, A8) | 4 | 65,013.00 |

Nota sobre A8: el brief decía «cero pesos en 2026» para los estados 7/99 porque esas filas tenían subtotal 0; con F0 antes de F1, las 4 líneas en 99 de 2026 aportan 65,013.00 cuando entre la función.
Se mueven 14 cuentas. **3 pasan a «fuera de presupuesto»** (contra el acumulado a la fecha):
- TRAMITES · TRAMITES ACUPARK II: 17,879,857.53 contra 10,612,676.52.
- TRAMITES · TRAMITES ACUPARK III: 5,561,857.34 contra 1,583,328.66.
- HR - Nomina · IMSS (Patronal): 952,591.35 contra 735,070.75 acumulado (803,449.42 anual).

Ya estaba fuera y sube: Operaciones · Mant. de Edificios (5,685,219.81 → 5,702,899.31 contra 3,886,214.09). Las otras 10 cuentas siguen dentro de su presupuesto.
**2025** (al consultarlo con el selector de año): 12 urgentes por 248,532.01 y 23 líneas por 3,991,831.85 (de ese total, 828,577.82 en cuentas presupuestables).
Los montos son el **total** capturado; con `subtotal = total` el presupuesto sobreestima hasta 16 % donde hubo IVA y subestima donde hubo retenciones (V37).
**El 91 % del efecto (23,441,714.87) son dos cargas manuales del 29-sep** (V35) y **antes de M10 CxP debe revisar 34 urgentes/líneas aprobadas sin pago** (V36): ambas cosas bloquean M10, no el diseño.
