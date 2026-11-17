# 06 — PLAN de construcción · Presupuesto por año, «solo anual» y Ajuste Presupuestal

> Anclado a `00-brief-conceptual.md`, `02-TRD.md` y `05-BACKEND.md`. **No se ejecuta nada hasta el visto bueno de
> Jereff** (texto + mockup de Pencil + validación adversarial). Cada migración de BD pide su autorización con el
> SQL exacto de `migraciones-borrador.sql`. Los archivos del repo con trabajo ajeno sin commitear
> (`solicitudes.service.ts`, `pagos.service.ts`, `NuevaSolicitudEspecial.tsx`, …) se tocan lo mínimo y, donde se pueda,
> se prefieren **archivos nuevos**; el commit es selectivo por hunks propios.

## 0. Puertas (en orden)

| Puerta | Qué | Estado |
|---|---|---|
| G1 | Paquete escrito (00–06 + SQL borrador) | ✅ listo (reconciliado con `PLAN-reporte-presupuesto-cxp.md`) |
| G2 | Validación adversarial (Opus, 3 lentes) → `07-VERIFICACION-ADVERSARIAL.md`; hallazgo ALTA = no se construye | ✅ hecha 2026-11-03: 0 ALTA propios (1 ALTA preexistente = P0 #2/#3); todo MEDIA incorporado |
| G3 | Mockup en Pencil aprobado por Jereff (`presupuesto-ajustes.pen`, capturas en `mockups/`) | 🟡 dibujado 2026-11-04 (8 pantallas: la 8 —formulario de urgente con «Subtotal (sin IVA)»— y el texto de la 5 son de F0, dibujadas el mismo día); falta la aprobación de Jereff |
| G2b | Validación adversarial del alcance **F0** (relleno de subtotal, control de aprobación, candado, orden de despliegue) → `07-VERIFICACION-ADVERSARIAL.md` §7 | ✅ hecha 2026-11-04: CONDICIONADO, 0 ALTA, 4 MEDIA incorporadas (ver `07` §7). **M10 espera** las respuestas de Jereff a F0-01 y F0-02 (brief §8.6 y §8.7) |
| G4 | Visto bueno explícito de Jereff al plan completo | ⏳ |

## 1. Fases y tareas

### F0 — Urgentes y líneas de captura con subtotal (#80) · **va primero** (agregada el 2026-11-04 por decisión A9 de Jereff)

F1 no arranca hasta que la 0.8 esté hecha: la prueba de equivalencia de F1 debe correr sobre los datos ya corregidos. (Si Jereff incluye «Facturas sin XML», las tareas 0.1 a 0.3 y M10 suman el tipo 6: 5 filas, 1,250 pesos.)

| # | Tarea | Quién | Aceptación |
|---|---|---|---|
| 0.1 | Respaldo en `temp/respaldos/`: CSV de las 86 filas vigentes tipo 2/4 con subtotal 0 (`idCxp, tipoOperacion, idEstado, idCategoria, subtotal, total, uidGerente`) + recuento por tipo y estado | Perico (Haiku) | CSV con 86 filas; los conteos coinciden con `05 §7` |
| 0.1b | **Revisión de CxP antes de M10** (validación F0-01/F0-02): la lista de las 34 urgentes/líneas aprobadas sin pago (`temp/respaldos/f0-urgentes-lineas-4-99-sin-pago.csv`) y la pregunta de las dos cargas manuales del 29-sep. Cada fila se queda, se elimina por la ruta existente (`devolver` → `eliminar`) o se excluye de M10 | Jereff / CxP | Lista devuelta con decisión por fila; los `idCxp` excluidos quedan en el SQL de M10 (`AND "idCxp" NOT IN (…)`) |
| 0.2 | API: `subtotal` en `crearUrgenteSchema` y `crearLineaCapturaSchema` (> 0, ≤ 1.2 × total, 2 decimales); `crearUrgente`/`crearLineaCaptura` lo escriben; `editable()` trae `tipoOperacion` y `editar()` lo exige para tipos 2/4; `mapearErrorCxp` reconoce el `23514` del candado y se llama en `insertarEspecial` y `editar()`; pruebas | Nicanor | Subtotal 0 → 400; subtotal > 1.2 × total → 400; subtotal mayor que el total pero ≤ 1.2 × total pasa; el rechazo del candado sale como 400, no 500; editar una urgente regresada con subtotal 0 → 400; editar una factura normal sin cambios; typecheck/lint/build |
| 0.3 | Web: campo «Subtotal (sin IVA)» en `NuevaUrgente` y `NuevaLineaCaptura` (+ `solicitudes.api.ts`), con la casilla de confirmación de retenciones cuando es mayor al monto; validar también en `EditarSolicitudModal` para tipos 2/4 | Nicanor | Se ve como la pantalla 8 aprobada; `tsc` limpio |
| 0.4 | Validador adversarial Opus de F0 (relleno, control de aprobación, candado y orden, edición, consumidores, doble conteo con ajustes) | Toribio + Opus | Sin hallazgo ALTA |
| 0.5 | **Push 0** (orden explícita de Jereff; Jereff avisa al equipo **antes de M10**: el consumido sube) | Jereff | api + web desplegados |
| 0.6 | **M10** relleno (con autorización y su SQL exacto; **excluye** los `idCxp` que se decidan en la 0.1b) + verificación | Toribio | 0 filas vigentes tipo 2/4 con subtotal 0 (salvo las excluidas); la suma agregada = 25,728,787.14 en 2026 menos lo excluido; 3 cuentas «fuera de presupuesto»; en `auditoria` solo cambió `subtotal` |
| 0.7 | Prueba de la autorización con una urgente que no cabe, **dentro de `BEGIN … ROLLBACK`** (con autorización): se crea una urgente de prueba y se llama la RPC | Toribio | La RPC responde «PAGO RECHAZADO: Presupuesto insuficiente…»; se revierte; conteos finales = iniciales |
| 0.8 | CSV de respaldo propio de lo que toque la 2.ª corrida; re-ejecutar M10 (idempotente) y aplicar **M11** (candado) | Toribio | Ninguna fila viola el candado; un INSERT de prueba con subtotal 0 rebota con `23514` (en ROLLBACK) |

### F1 — Cimientos: presupuesto por año + «Solo anual» + selector de año

| # | Tarea | Quién | Aceptación |
|---|---|---|---|
| 1.1 | Respaldos en `temp/respaldos/`: `pg_get_viewdef` + `reloptions` + GRANTs de las **dos** vistas; `pg_get_functiondef` de `cxp_trigger_validar_fecha`, `prescategorias_obtener_con_presupuesto`; CSV de `PresCategorias`; lista de GRANTs/ACL | Perico (Haiku) | Archivos con fecha; conteos verificados |
| 1.2 | **M1** columna `soloAnual` (con autorización) | Toribio | Columna existe, todo `false`, `trg_auditoria` activo |
| 1.3 | **M2** función `cxp_resumen_presupuesto_por_anio` + REVOKE/GRANT (con autorización) | Toribio | Creada; vistas intactas |
| 1.4 | **Ejecutar la función real** (`variable_conflict=error` revienta en la 1.ª ejecución, no al crear) y correr `prueba-equivalencia.sql` para el año en curso y para 2025 | Toribio | La función responde; en 2026 las **únicas** diferencias contra la vista de hoy son las filas en estado 7/99 que F0 dejó con subtotal (hoy 4 líneas en 99 = 65,013.00), con ese monto exacto y ninguna más; 2025 cuadra con sumas por estado |
| 1.5 | **M2b** las **dos** vistas envueltas | Toribio | `reloptions` = `security_invoker=on` en ambas; GRANTs conservados; `SELECT *` de cada vista = función; ambas devuelven lo mismo |
| 1.6 | Probar los 4 consumidores (solo lectura, cuenta de Toribio): modal de aprobación, Configuraciones▸Cuentas, **RPC `cxp_autorizar_solicitud_pago` con una cuenta de prueba en transacción con ROLLBACK**, agente Montse | Toribio | Responden sin error y con las mismas cifras |
| 1.7 | **M7** RPC de cuentas con `p_anio` | Toribio | Llamada con 3 y con 4 argumentos responde; año sin presupuesto lista cuentas con 0 |
| 1.8 | Regenerar `packages/types/src/database.types.ts` (vistas, RPC, `PresCategorias`) | Nicanor | `tsc` limpio en api y web |
| 1.9 | API parámetros: `anio` en `listarCuentas`, `aniosDisponibles`, `setSoloAnual` (+ ruta `PATCH …/solo-anual`, schemas), **escritura con `comoActor(uid)`** (hoy `setPresupuestable` y hermanas escriben con `admin` y la auditoría guarda `uid NULL`: se corrigen las que están en el mismo archivo), errores a `fallaBd` en lo tocado, pruebas. **No** se agrega ningún bloqueo por año (no está entre las decisiones de Jereff; se decide con la pregunta abierta del cierre de año) | Nicanor | Pruebas verdes; typecheck/lint/build; la auditoría de `soloAnual` trae el uid del actor |
| 1.10 | Web `CuentasTab`: selector de año, columna «Solo anual», marca «anual»; el engrane se deshabilita solo si el año **no tiene presupuesto cargado** (`idPresupuesto` nulo, como hoy); `parametros.api.ts` | Nicanor | Se ve como el mockup aprobado; `tsc` limpio |
| 1.11 | Pruebas de zona horaria con la función real: gasto con `fecAutorizacion` 31-dic 23:59 UTC-6 (= 1-ene 05:59 UTC) y 1-ene 00:00 | Toribio | El gasto cae en el año correcto (México) |
| 1.12 | Validador adversarial Opus sobre función, vistas, RPC y grants | Toribio + Opus | Sin hallazgo ALTA |

### F2 — Ajuste Presupuestal (98)

| # | Tarea | Quién | Aceptación |
|---|---|---|---|
| 2.1 | **M3** trigger de fecha, **M4** permiso 432 (con cast al enum), **M5** proveedor genérico, **M6** CHECK, **M8** guardia (solo el servicio toca un 98), **M9** vistas externas sin anulados, con autorización. **Todo F2 de BD va ANTES del código F2** | Toribio | Cada objeto existe |
| 2.2 | Prueba de forma: INSERT de la fila de `05-BACKEND §3` **en una transacción con ROLLBACK**; verificar que no revienta (días no habilitados incluidos), que `fecCFDI` queda `NULL` y que el trigger de proveedor no la rechaza | Toribio (con autorización) | La fila queda como se espera y se revierte; conteos finales = iniciales |
| 2.3 | API `ajustes.constants/schemas/service/controller` + registro en `cxp.module.ts`; `mapearErrorCxp` (incluye `23514` → 400); sin `bloqueo.verificar`; comentarios de captura/anulación (`tipo` 10/11); anulación en **un solo UPDATE**; guarda de doble envío (60 s); montos como cadena; «hoy» en hora de México; `anular` con `comoActor`; vista previa con aviso de urgentes/especiales; exportar con saneo de celdas | Nicanor | Pruebas unitarias e integración (fake en memoria) verdes, incluida la franja 18:00–24:00 México y «anular con proveedor desactivado» |
| 2.4 | **Exclusiones** (cada una con su prueba «una fila 98 no aparece / no se puede»): C2–C3 `desaplicarPago`, C5 Pagar, C6 Pendientes, C7 Solicitudes, C8 catálogos, C9 Proveedores (ocultar el genérico, rechazar editar/desactivar el genérico y **rechazar desactivar a un proveedor con ajustes activos**), C10 movimientos/comprobante/transferencia; clave 432 en la lista del agente (`consultas.service.ts:55`) | Nicanor | Pruebas verdes; una por consumidor |
| 2.5 | Web: `AjustesPage`, `NuevoAjusteModal`, `AnularAjusteModal`, `ajustes.api.ts` (archivos **nuevos**), ruta, ítem de menú `clave: 432`, texto del permiso, exportar Excel, ocultar 🏦/Desaplicar para el 98 | Nicanor | Se ve como el mockup aprobado; flujos F-3/F-4 funcionan |
| 2.6 | Prueba que ningún endpoint existente puede crear un 98 y que el controlador de ajustes **falla si pierde `@RequierePermiso(432)`** | Nicanor | Pruebas verdes |
| 2.7 | Validador adversarial Opus (RBAC server-side, forma de la fila, CHECK, anulación y carrera, auditoría, exclusiones, descripción en Excel) | Toribio + Opus | Sin hallazgo ALTA |
| 2.8 | Validación manual con la cuenta de Toribio **solo de lectura** (pantalla, permiso, listados sin el 98). El alta y la anulación se prueban **dentro de `BEGIN … ROLLBACK`** (o en una rama de Supabase), **no con un ajuste demo en producción**: un ajuste nunca se borra y anularlo deja la fila, así que «conteos en 0» sería imposible | Toribio | Conteos finales = estado inicial |

### Cierre del paquete (antes de commitear)
Bitácora (entrada + «Estado actual»), KB `modulos/cxp.md` (tipo 98, clave 432, estados 7/99 en presupuesto) y `modulos/configuraciones.md` («solo anual», selector de
año) en formato `kb-agente-soporte`, `GLOSARIO.md`, diagrama de BD (skill `diagrama-bd`: columna, función, CHECK), changelog + versión con el protocolo anti-colisión,
revisión de escalabilidad (skill `revision-escalabilidad`: `EXPLAIN` de la función; índice `cxp(idCategoria, idEstado)` solo si hace falta), marcar `v_resumenPresupuesto_backup_20250820`
como obsoleto en `OBSOLESCENCIA-BD.md`, actualizar `PLAN-reporte-presupuesto-cxp.md` (su §A queda construido por este paquete), y cerrar/actualizar en el tablero los pendientes
relacionados (#77: regla de contabilidad conocida, Paquete 2 abierto). Commit **selectivo** (nunca `git add .`; aislar los hunks propios de los archivos con trabajo ajeno);
el **push es paso aparte y explícito** de Jereff.

## 2. Estimación (para quien ejecuta)

| Fase | Esfuerzo | Notas |
|---|---|---|
| F0 | ≈ medio día | Código, formularios y pruebas ≈ 3 horas; respaldo, relleno y verificación ≈ 1 hora; la validación adversarial va aparte. |
| F1 | ≈ 1 jornada | La parte BD es corta (la lógica ya se probó en solo lectura); lo largo es la UI, la regeneración de tipos y las pruebas con la función real. |
| F2 | ≈ 2 jornadas | Servicio ≈ medio día; pantalla ≈ medio día; exclusiones y sus pruebas ≈ medio día; validación y pruebas de BD ≈ medio día. |
| Cierre | ≈ medio día | Documentación, KB, versión, escalabilidad, commit selectivo. |

## 3. Reversa por fase
F0 (en este orden): (1) `DROP CONSTRAINT cxp_subtotal_captura_especial_chk` (M11); (2) restaurar el subtotal anterior desde el CSV de respaldo, solo en las filas cuyo subtotal siga igual al total relleno; (3) desplegar el código anterior.
Con el candado vivo y el código viejo, las altas de urgentes/líneas fallarían con 400: por eso el candado se quita primero.
F1 (en este orden): (1) desplegar el **código anterior** (si no, Cuentas da 500); (2) por cada vista, `DROP VIEW` + `CREATE VIEW` con la definición vieja y sus GRANTs (`CREATE OR REPLACE` **no** puede volver de 27 a 26 columnas); (3) recrear la RPC de 3 parámetros;
(4) `DROP FUNCTION cxp_resumen_presupuesto_por_anio` (falla mientras una vista la use); (5) `DROP COLUMN soloAnual`. El SQL exacto de la reversa se escribe y se prueba en seco **antes** de aplicar M2b.
F2: anular los ajustes capturados (nunca borrar), quitar el permiso 432 de los usuarios, `DROP CONSTRAINT cxp_ajuste_presupuestal_chk`, restaurar el trigger de fecha, quitar el proveedor genérico
(solo si no tiene ajustes).

## 3b. Despliegues (tres pushes separados; cada push es orden explícita de Jereff y redespliega api+web)
0. **Push 0 = F0** (va primero). Antes: respaldo CSV de las 86 filas y la validación adversarial de F0 hecha. Después del push, **en este orden y cada paso con autorización y su SQL exacto**: **M10** (relleno del subtotal) →
   verificar → **re-ejecutar M10** (idempotente; cubre lo capturado entre el push y la primera corrida) → **M11** (candado). Aquí la BD va **después** del código a propósito (el código nuevo ya escribe el subtotal).
   Jereff avisa al equipo **antes** de M10: el consumido de 2026 sube ≈ 25.7 millones y 3 cuentas pasan a «fuera de presupuesto». El aviso nombra a **Jorge Aceves** (según la validación, ya no puede aprobar las líneas del IMSS: pasan a Evelyn Aparicio, solo en días con autorizar habilitado; ojo con la fecha límite legal del IMSS),
   a **Paul-Henri Gauvin** (trámites) y a **Evelyn Aparicio** (aprobadora de fuera de presupuesto); confirmar los nombres al avisar.
1. **Push 1 = F1.** Antes: M1 → M2 → prueba → M2b → M7 aplicadas y verificadas. Después del push: probar los 4 consumidores en producción (solo lectura).
2. **Push 2 = F2.** Antes: M3 → M4 → M5 → M6 → M8 → M9 aplicadas y la prueba de forma con ROLLBACK hecha. Si el código de F2 saliera antes que sus candados, Soporte (que pasa cualquier permiso) podría capturar ajustes sin CHECK ni proveedor genérico.
3. Tras el Push 2: Jereff abre al usuario en Configuraciones▸Permisos y enciende la clave 432 a quien corresponda.

## 4. Qué NO se hace aquí (y quién lo decide)
- Pestaña «Presupuesto» de Reportes (`PLAN-reporte-presupuesto-cxp.md` §A.3, B, C): su SQL base queda construido; la pantalla la dispone Jereff (hacer ahora o descartar).
- Paquete 2 (#77): apartado PPD al autorizar, año de origen de las parcialidades, liberar saldo, reasignar factura. Va inmediatamente después y se diseña con su propio gate.
- Carga masiva de ajustes desde Excel («por ahora uno por uno»): el servicio de creación queda reutilizable.
