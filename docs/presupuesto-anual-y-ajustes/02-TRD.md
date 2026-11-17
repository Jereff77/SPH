# 02 — TRD · Presupuesto por año, «solo anual» y Ajuste Presupuestal

> Anclado a `00-brief-conceptual.md`. Verificado contra la BD real el 2026-11-03 (ver `05-BACKEND.md`).
> SQL exacto en `migraciones-borrador.sql` (no aplicado).

## 1. Decisiones de arquitectura (Toribio)

| # | Decisión | Por qué | Alternativa descartada |
|---|---|---|---|
| T1 | **Una sola fuente del cálculo**: la función `cxp_resumen_presupuesto_por_anio(p_anio)` (la misma del plan de julio, ya acordada con Jereff, ahora con «solo anual», `status = true` y hora de México); **las dos vistas** (`v_resumenPresupuesto` y la gemela en minúsculas) pasan a envolverla con el año en curso. | Todos los consumidores (modal de aprobación, Cuentas, **RPC `cxp_autorizar_solicitud_pago`, que lee la gemela en minúsculas**, agente Montse) siguen leyendo la vista sin cambios y no pueden divergir. El plan de julio decía «no tocar la hermana en minúsculas»: eso dejaría al autorizador y al modal con reglas distintas, así que aquí se corrige. Prueba en solo lectura (2026-11-03): 82 cuentas, **0 diferencias de dinero**; solo cambia un conteo de transacciones en 3 cuentas (6 aprobaciones en estado 99 con monto 0). Un segundo revisor repitió la comparación con el mismo resultado. **Se usa `SECURITY INVOKER`** (el plan de julio decía DEFINER): los dos únicos llamadores ya saltan RLS y tienen SELECT, y con INVOKER un error futuro de ACL no filtra datos. | Duplicar la vista por año (dos fuentes del mismo dinero); dos funciones (la de julio y la de este paquete); parchar el front con el año. |
| T2 | **Hora de México en el cálculo.** «Hoy» y el año/mes de cada fila se leen convirtiendo UTC→México. | La BD está en UTC; de 18:00 a 24:00 del 31-dic la vista actual ya creería que es otro año. Desde nov-2025 los timestamps se guardan en UTC; los de v1 (mar–oct 2025) ya estaban en hora local. Hoy 0 de 1,863 filas pagadas y 0 de 309 comprometidas cambian de mes o año al convertir → es seguro. | Dejarlo en UTC (bomba el 31 de diciembre). |
| T3 | **`soloAnual` es bandera de la cuenta** (columna en `PresCategorias`), no de cuenta-año. | Es lo que dijo contabilidad («ciertas partidas no tienen presupuesto mensual, solo anual»). En un año cerrado el acumulado ya es el anual, así que la bandera no reescribe la historia. | Bandera por año (más flexible, nadie lo pidió, más UI). |
| T4 | **El Ajuste es una fila de `cxp` con `tipoOperacion = 98`**, nacida `idEstado = 6`. | Reutiliza la tabla, la vista, los reportes y la auditoría existentes (regla «reutilizar antes que duplicar»). El presupuesto ya suma `cxp.subtotal` de estado 6 → el ajuste cuenta sin tocar la lógica del consumido. | Tabla nueva `ajustes_presupuestales` (obliga a modificar la vista, los reportes y el agente para sumarla). |
| T5 | **`fc`, `fecSolicitud`, `fecAutorizacion` y `fecPago` del ajuste = fecha del gasto (12:00).** La hora real de captura vive en `auditoria`. | `numAnio/numMes` son columnas **generadas desde `fc`** y la vista agrupa por `fecAutorizacion`; así el ajuste cae en el periodo correcto en todas las pantallas sin tocar cada consumidor. | Dejar `fc = now()` y usar solo `fecAutorizacion` (los filtros por mes/año de listados mostrarían el ajuste en el mes de captura). |
| T6 | **Proveedor genérico sembrado** (`AJUSTE-PRESUPUESTAL`, RFC genérico) para ajustes sin proveedor. | `cxp.idProveedor` es NOT NULL y el trigger `cxp_validar_y_actualizar_proveedor` exige uno activo. | Relajar ese trigger (compartido por todos los flujos). |
| T7 | **Trigger de fecha: se exime `tipoOperacion = 98`.** | El trigger solo deja insertar en días con CFDI habilitado, salvo urgentes: por eso se usaban urgentes. Eximir el 98 es un cambio de una línea y reversible. | Marcar el ajuste como `esUrgente` (contamina reportes y reglas de urgentes). |
| T8 | **CHECK `cxp_ajuste_presupuestal_chk`** fija la forma del 98 en la BD. | Defensa en profundidad: aunque un bug futuro del servicio se equivoque, la BD no admite un 98 con factura, banco, divisa o estado distinto de Pagado. | Confiar solo en el servicio. |
| T9 | **Anular = `status = false`**; la vista filtra `status = true` en `cxp`. | Hoy 0 filas de estados 4/6/99 tienen `status=false`, así que el filtro es neutro para lo existente, y permite anular sin tocar `idEstado` (cambiar el estado exige permisos de autorizador en el trigger de fecha). | Mover a otro estado (los estados tienen significado de flujo). |
| T10 | **Un solo permiso (432) para capturar, ver y anular ajustes**, declarado `@RequierePermiso(432)` en el controlador **propio** de ajustes (no en `SolicitudesController`, que hereda el 420 de la clase). | Mínimo privilegio simple; Soporte pasa siempre. Un controlador aparte evita que se herede o se olvide el decorador por método (riesgo detectado en el mapeo: «si se olvida el decorador, cualquiera con 420 crearía un gasto pagado»). | Tres permisos; sexto tipo dentro de «Nueva solicitud» (obliga a gatear por método y ensucia las semanas del solicitante con fechas históricas). |
| T11 | **El ajuste NO es una solicitud: se excluye de los listados de solicitudes, de «Pagar solicitudes» y de «Solicitudes pendientes»** (`.neq('tipoOperacion', 98)`), y se **bloquea** `desaplicarPago`, la transferencia y el cambio de responsable para el 98. Sí aparece en Reportes y Looker. | El mapeo encontró que «Desaplicar pago» acepta cualquier `idEstado 6` y lo regresaría a Aprobado (el ajuste se destruiría y quedaría como pagable). | Etiquetar solamente (deja abierta la puerta de destruirlo). |
| T12 | **El servicio manda `nomCFDI` no vacío (`'AJUSTE PRESUPUESTAL'`).** | El trigger AFTER INSERT `cxp_actualizar_nomcfdi_vacio` rellena `fecCFDI = fecSolicitud` y `nomCFDI = nombreProveedor` cuando `nomCFDI` viene vacío; así `fecCFDI` queda en `NULL` y no hay un UPDATE sorpresa tras el INSERT. El CHECK no exige `fecCFDI NULL`, para no depender de ese trigger. | Dejar que el trigger lo rellene (funciona, pero deja un «CFDI» con fecha en un registro que no tiene CFDI). |
| T14 | **Guardia M8: una fila 98 solo la toca el servicio** (trigger `BEFORE INSERT/UPDATE/DELETE` que rechaza si `current_user` es `anon` o `authenticated`). | Hoy las políticas RLS de `cxp`, `segModulosUsuarios` y `auditoria` son `USING (true)`: cualquier usuario con sesión puede escribir directo en la BD con su token (P0 del tablero **#2** y **#3**). `comoActor()` firma un JWT con `role = service_role`, así que el servicio pasa y el navegador rebota. **No resuelve** #2/#3 (alguien podría concederse la clave 432 y usar la pantalla): el permiso 432 es tan fuerte como todos los demás permisos del sistema hasta que ese P0 se cierre. | Confiar solo en el CHECK (no impide editar monto/estado de un 98 desde el navegador). |
| T13 | **No se reactiva `trigger_cxp_validar_fecha_cfdi`** (desactivado de forma permanente por decisión de Jereff, 2026-09-07). | Si se reactivara, un 98 con `fecCFDI` de otro mes iría a Rechazado. | — |
| T15 | **F0 — el subtotal de urgentes y líneas de captura lo captura la persona (sin IVA), arranca igual al monto, y lo exigen el servidor y la BD.** El cálculo del presupuesto **no cambia**: estado 4 aparta y estado 6 consume, igual que una factura. | La vista ya hace eso con todo lo demás; solo faltaba el dato (las urgentes/líneas nacen con `subtotal = 0`, el defecto de la columna). El relleno de las existentes usa `subtotal = total` (sobreestima hasta 16 % si hubo IVA; subestima si hubo retenciones). El candado `cxp_subtotal_captura_especial_chk` (M11) va **después** del código y del relleno, para no romper altas ni la propia migración. | Calcular el subtotal en el servidor quitando 16 % (adivina: trámites e IMSS no llevan IVA); dejarlo solo en la BD con un DEFAULT (el 0 actual es justo el defecto). |

## 2. Modelo de datos

- `PresCategorias."soloAnual" boolean NOT NULL DEFAULT false` (+ `trg_auditoria` ya existente en la tabla).
- `cxp`: **sin columnas nuevas**. Un ajuste usa: `tipoOperacion 98`, `idEstado 6`, `status true`, `subtotal = total = montoAplicado`,
  `moneda MXN`, `concepto = descripción`, `idProveedor` (genérico u opcional elegido), `tipoProveedor 1`,
  `idCategoria`, `uidr = autorizo = actor`, fechas del gasto, `folio NULL`, sin `urlCFDI/urlXLM/fecCFDI/idMovBancarios`.
- `catProveedores`: una fila sembrada (`AJUSTE-PRESUPUESTAL`).
- `segModulos`: una fila (`432`).
- Funciones: `cxp_resumen_presupuesto_por_anio(integer)` (nueva, `SECURITY DEFINER`, `REVOKE` a `public/anon/authenticated`, `GRANT` a `service_role` y `v2_agente_ro`),
  `cxp_trigger_validar_fecha()` (una condición más), `prescategorias_obtener_con_presupuesto(…, p_anio)` (firma ampliada, `p_anio` opcional → compatible;
  un año sin fila en `Presupuestos` igual lista las cuentas con presupuesto 0).
- Vistas `v_resumenPresupuesto` y `v_resumenpresupuesto` (**ambas**): mismas 26 columnas + `solo_anual` al final; `security_invoker = true` se conserva.
- `cxp`: un CHECK nuevo (`cxp_ajuste_presupuestal_chk`) y, en F0, otro (`cxp_subtotal_captura_especial_chk`: una urgente o línea vigente no puede tener subtotal vacío o 0).

## 3. Semántica del cálculo (`presupuesto_resumen`)

- `mes_corte` = mes actual (México) si el año consultado es el año actual; **12 para cualquier otro año** (cerrado o futuro; igual que el plan de julio).
- `presupuesto_acumulado` = suma de `PresDetalle.monto` de meses ≤ `mes_corte`; **si la cuenta es `soloAnual`, = presupuesto anual**.
- `consumido` (`subtotal_gastado`) = Σ `subtotal` de `cxp` con `idEstado IN (6, 7)`, `status = true`, mes/año (México) de `COALESCE(fecAutorizacion, fecPago, fc)` dentro del corte.
- `comprometido` = Σ `subtotal` con `idEstado IN (4, 99)`, `status = true`, por mes/año (México) de `fc`.
- Todo lo demás (avances, disponibles, estados, proyección) se deriva igual que hoy. `promedio_mensual_gastado` divide entre `mes_corte` (hoy: entre el mes actual → igual para el año en curso).

## 4. API (resumen; detalle en `05-BACKEND.md`)

| Método y ruta | Permiso | Qué hace |
|---|---|---|
| `GET /parametros/cuentas?anio=AAAA` | 213 (como hoy) | Lista cuentas con presupuesto y consumido del año (RPC de cuentas con `p_anio` + `cxp_resumen_presupuesto_por_anio`). Sin `anio` = año en curso. |
| `GET /parametros/cuentas/anios` | 213 | Años con presupuesto o con gasto. |
| `PATCH /parametros/cuentas/:id/solo-anual` | 213 | Cambia la bandera. |
| `GET /cxp/ajustes?anio&mes&idCategoria&incluirAnulados` | 432 | Lista ajustes. |
| `GET /cxp/ajustes/catalogos` | 432 | Cuentas activas y proveedores activos (sin el genérico). |
| `GET /cxp/ajustes/vista-previa?idCategoria&fecha&monto` | 432 | Efecto del ajuste sobre la cuenta (aviso informativo). |
| `POST /cxp/ajustes` | 432 | Crea. Esquema Zod. Actor del JWT. |
| `POST /cxp/ajustes/:idCxp/anular` | 432 | Anula con motivo. |
| Alta de urgente, alta de línea de captura y editar solicitud (rutas **existentes** de solicitudes, F0) | las de hoy | Reciben y exigen `subtotal` (> 0, ≤ 1.2 × total por las retenciones, 2 decimales); el servidor lo escribe. |

## 5. Seguridad (frontera de confianza)

1. `apps/web` no toca el SDK de Supabase: todo por `apps/api` (service_role solo allí).
2. Cada ruta lleva `@UseGuards(JwtAuthGuard, PermisoGuard)` + `@RequierePermiso(clave)`; el permiso se valida **en el servidor** siempre.
3. El actor sale del JWT (`comoActor(uid)`), nunca del cuerpo. `tipoOperacion`, `idEstado`, `status`, `subtotal`, `moneda` los fija el servidor, **nunca** el cliente.
4. Zod en todos los cuerpos y query strings; consultas por el cliente de Supabase (parametrizadas).
5. Errores: 4xx redactados a mano; 5xx con `fallaBd(this.logger, 'cxp.ajustes.<op>', error)` (nunca `error.message`).
6. Ningún otro **endpoint de la API** puede crear un 98: los de solicitudes fijan `tipoOperacion` 1/2/4/5/6; se agrega una prueba que lo garantiza. **Vía BD directa**, hoy cualquier usuario con sesión puede escribir en `cxp` (P0 #2): la guardia M8 (T14) cierra eso **para los 98**, y el CHECK (T8) fija la forma.
7. El CHECK de BD (T8) y la guardia (T14) acotan el daño aunque el servicio fallara. La asignación de la clave 432 vía `segModulosUsuarios` sigue siendo tan abierta como la de cualquier otra clave hasta cerrar el P0 #3.
8. El rastro de captura/anulación no depende solo de `auditoria` (que hoy cualquiera con sesión puede borrar): cada alta y cada anulación dejan además un `cxpComentarios` con `tipo` propio (10 captura, 11 anulación).
8. Auditoría: `cxp`, `PresCategorias`, `catProveedores`, `segModulos`, `cxpComentarios` ya tienen `trg_auditoria`.

## 6. Rendimiento y escalabilidad

- Volumen: `cxp` ≈ 2,500 filas, 82 cuentas, 2 años de presupuesto. La función recorre `cxp` una vez por estado; mismo costo que la vista actual. Se verificará con `EXPLAIN (ANALYZE)` antes y después y se revisará si `cxp(idCategoria, idEstado)` necesita índice (skill `revision-escalabilidad` en el cierre).
- El listado de ajustes pagina en servidor (`range`) y filtra por año/mes/cuenta; sin `select *`.
- La vista previa del ajuste es una lectura puntual por cuenta (`presupuesto_resumen` filtrada por `idCategoria`).

## 7. Consumidores afectados (resultado del mapeo)

> Mapeo completo (api/web/SQL, con archivo:línea): `temp/diseno-ajuste-presupuestal/consumidores.md`. Resumen y tareas en
> `05-BACKEND.md` §6 y `06-PLAN.md` §2. Los de riesgo **alto**: (1) trigger de fecha (M3); (2) `desaplicarPago` y su UI;
> (3) la vista y la RPC `cxp_autorizar_solicitud_pago` (lee la gemela en minúsculas); (4) el permiso a nivel de controlador propio.

## 8. Modos de falla y reversa

| Falla | Efecto | Reversa |
|---|---|---|
| M2b deja las vistas distintas a las de hoy | Cifras de aprobación/Cuentas cambian | La prueba de equivalencia se corre **antes** de M2b; reversa = restaurar `pg_get_viewdef` guardado. |
| RPC de cuentas (M7) incompatible con el código desplegado | Cuentas no carga | `p_anio` opcional + columnas añadidas al final; se despliega código y BD en este orden: M7 → código. Reversa: recrear la RPC vieja. |
| Se captura un ajuste equivocado | Consumido incorrecto | Anular (inmediato, auditado). |
| Alguien «desaplica» un ajuste desde Pagar solicitudes | El ajuste regresa a Aprobado y queda pagable | Bloqueo en `desaplicarPago` (400 legible) + UI sin 🏦/Desaplicar para el 98; además el CHECK lo frena (`idEstado = 6` obligatorio: el UPDATE a 4 revienta con `23514`, que se traduce a 400) → prueba específica. |
| El INSERT del ajuste falla en un día no habilitado | 500 genérico | M3 exime el 98 + el servicio traduce los errores `CXP_*` con `mapearErrorCxp`. |
| La vista gemela en minúsculas queda sin envolver | El autorizador y el modal usan reglas distintas | M2b envuelve **las dos**; prueba de que ambas devuelven lo mismo. |
| El proveedor genérico aparece en un selector | Alguien lo elige en una solicitud real | Filtro por `idProveedor <> 'AJUSTE-PRESUPUESTAL'` en los listados (ver consumidores) + trigger/validación en alta de solicitudes. |
| Año equivocado por zona horaria | Un gasto cae en otro año | T2 + pruebas con fechas 31-dic 18:00–23:59 MX y 1-ene 00:00–05:59 UTC. |
| F0: el relleno (M10) sobreestima un pago que sí llevó IVA | Esa cuenta muestra hasta 16 % más consumido | Se corrige esa fila con registro; el CSV de respaldo conserva el valor anterior. |
| F0: un navegador con el bundle viejo crea una urgente con subtotal 0 después de M11 | 400 legible («Capture el subtotal…»), no una pérdida de datos | Aviso de nueva versión; el CHECK rechaza (23514 → 400: `mapearErrorCxp` se amplía para reconocer el código y se llama en `insertarEspecial` y `editar()`, que hoy lanzan 500 directo). |
| F0: se aplica M11 antes de M10 | El `ALTER TABLE` falla (hay filas vigentes con subtotal 0) | Orden fijo del plan: código → M10 → verificar → re-ejecutar M10 → M11. |

## 9. Pruebas (resumen; detalle en `06-PLAN.md`)

Equivalencia de la vista (BD), pruebas unitarias del servicio de ajustes (esquema, permisos, forma de la fila,
anulación idempotente/409), prueba de integración con fake en memoria (patrón de `ppd-integracion.spec.ts`),
pruebas de zona horaria, e2e manual con la cuenta de Toribio (solo validación: sin mutar producción; la captura
real de un ajuste de prueba solo con plan acordado, dato demo y limpieza verificada).
