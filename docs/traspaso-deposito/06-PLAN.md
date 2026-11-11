# 06 — Plan de construcción: Traspaso de depósito de garantía

> Anclado a `00 v2`. Rutas relativas a `version2/`. **Nada de esto se ejecuta** hasta cumplir las puertas de §1.

## 1. Puertas previas (en orden; ninguna se salta)

1. ✅ **Visto bueno de Jereff** al texto (`00`–`04`) **y al mockup** (`mockup.html`, §8 de `03`; wireframe HTML por excepción de Jereff, porque Pencil no conectó) — **otorgado el 2026-10-20 («dale»)**, con las 3 decisiones del brief §9.
2. **Gate adversarial sobre el SQL** de `05` (Opus, lentes seguridad/consumidores/casos reales) — **pendiente sobre el SQL final**. La compilación y los
   ensayos en una **BD desechable** (Postgres 15 local, datos sintéticos) **ya se hicieron** (Nicanor, 2026-10-20): el SQL de `05` §3 es el probado
   (`temp/traspaso-deposito/test/migracion-final.sql`; informe en `…/test/resultados.md`). Nunca se ha ejecutado en producción.
3. **Autorización explícita de Jereff con el SQL exacto** (regla 1 de `contexto.md`) para aplicar la migración.

## 2. Fases

| Fase | Trabajo | Salida verificable |
|---|---|---|
| **F0** | Reservar versión en `.sessions/version-en-curso.md` (máx. de todas las fuentes); leer `HANDOFF.md` §1 si aplica. | Número reservado. |
| **F1 BD** | Crear `base-conocimiento/migraciones/2026-10-20-traspaso-deposito.sql` (copia de `05` §3, ya validada); aplicar (tras autorización); correr `05` §4; pruebas SQL (§5); regenerar tipos solo si se desea (`packages/types`). | Tabla + 4 funciones; *grants* correctos; tabla en 0 filas; 234 depósitos intactos. |
| **F2 API** | Esquemas, servicio nuevo, controlador, guardas, `pagos()`, `aplicarPago` atómico, historial, reportes. | `pnpm --filter @erp/api typecheck && lint && test` verdes. |
| **F3 Web** | Cliente API, formulario, modales, tarjeta, Renovar, página, Aplicar pago, estado de cuenta, tipos de historial. | `pnpm --filter @erp/web typecheck && lint && build` verdes; cotejo visual con Pencil. |
| **F4 Pruebas** | §5 completo + validador Opus (§6). | Informe sin hallazgo ALTA abierto. |
| **F5 Cierre** | «Documenta todo»: KB, glosario, diagrama BD, bitácora, versión/changelog, commit **selectivo**. | Commit; el **push es aparte**. |

## 3. Archivos exactos

**BD (nuevo):** `base-conocimiento/migraciones/2026-10-20-traspaso-deposito.sql`.

**API (`apps/api/src/`):**

| Archivo | Acción |
|---|---|
| `modules/arrendatarios/traspasos-deposito.service.ts` | **Nuevo**: `candidatos…`, `estadoPlan`, `traspasar`, `revertir`, `exigirSinTraspasos`, `emitidosPorPartida`, mapa `MENSAJES_TRASPASO`, `calcularDeposito()` |
| `common/auth/exigir-permiso.ts` | **Nuevo**: misma regla que `PermisoGuard` (soporte pasa; si no, clave concedida) |
| `modules/arrendatarios/arrendatarios.schemas.ts` | `traspasarDepositoSchema`, `revertirTraspasoSchema`, `renovarPlanSchema.traspaso?` |
| `modules/arrendatarios/arrendatarios.controller.ts` | 5 rutas nuevas (`05`/`02` §2) |
| `modules/arrendatarios/arrendatarios.module.ts` | registrar el servicio |
| `modules/arrendatarios/planes-arre.service.ts` | `renovar()` (D12), guardas D13 en `eliminarPlan`/`cambiarMoneda`/`editarCampo`/`eliminarConcepto`, mapeo de `ERROR_GENERAL` |
| `modules/arrendatarios/cobranza.service.ts` | `pagos()` (D6/D16), `aplicarPago` → `arre_aplicar_pago_atomico` (D9), extraer `esConceptoDeposito`, `navePorPlan` público |
| `modules/arrendatarios/historial-plan.service.ts` | eventos `traspaso_deposito`/`traspaso_revertido` |
| `modules/arrendatarios/reportes-arre.service.ts` | nota del renglón 0 + resumen D14 |
| `modules/arrendatarios/*.spec.ts` | **Nuevos** (§5.2) |

**Web (`apps/web/src/`):** `features/arrendatarios/` → **nuevos** `TraspasoDepositoForm.tsx`, `TraspasarDepositoModal.tsx`,
`ResumenDeposito.tsx` (incluye el modal de revertir); **modifica** `arrendatarios.api.ts` (tipos, métodos, `montoExacto`),
`RenovarPlanModal.tsx` (**conserva su contenedor actual**; solo sección nueva y estado de resultado), `ArrendatariosPage.tsx` (botón, tarjeta),
`AplicarPagoModal.tsx` (etiqueta), `ReportesArrePage.tsx` y `reportes-arre-export.ts` (D14);
`components/notas/notas.api.ts` y `PanelNotas.tsx` (tipos de evento).

**Docs/KB (F5):** `base-conocimiento/modulos/arrendatarios.md` + `INDICE.md` + `GLOSARIO.md` (Traspaso, Disponible,
Complemento); diagrama BD (skill `diagrama-bd`); bitácora.

## 4. Criterios de aceptación verificables

1. `arre_traspasos_deposito` con RLS, 0 políticas, sin `DELETE` para `service_role`; las 4 funciones sin `EXECUTE` para `anon`/`authenticated`/`public` (`05` §4).
2. Caso Deumex en prueba con *rollback*: `pm2` destino **exactamente** `26639.11000000`; 2 filas; `arrePdpDetalle` de los orígenes **idénticas** antes/después.
3. Auditoría: filas de `auditoria` de la partida destino y de la tabla nueva con `origen=2` y `uid` del actor.
4. Nave 18: `pm2=0`, `fecPago` = fecha del traspaso, `cantidadAplicada=0`, fila `marcoPagada`; revertir restaura `pm2` y `fecPago=NULL`.
5. Doble envío con la misma clave ⇒ `YA_APLICADO`, 0 filas nuevas; clave distinta ⇒ rechazo.
6. `GET cobranza/partidas-pendientes` y `GET cobranza/pagos` **no devuelven** los depósitos ya traspasados; devuelven el complemento con `traspasoRecibido`.
7. `aplicarPago` hace **una** llamada de BD de escritura; con `cantidadEsperada` alterada ⇒ 409 `PARTIDA_CAMBIO` y `movbancarios.aplicado` intacto.
8. Con 0 traspasos, `eliminarPlan`/`cambiarMoneda`/`editarCampo`/`eliminarConcepto`/`pagos()`/estado de cuenta responden **igual que antes** (pruebas de no regresión).
9. Ninguna respuesta de error contiene `mensaje` de RPC, `error.message`, nombres de tabla/columna/constraint (revisión de las ~25 rutas de error).
10. `typecheck`, `lint`, `test`, `build` de api y web verdes; migración **solo CREATE** (revisión: 0 `ALTER`/`UPDATE`/`INSERT` sobre tablas existentes).

## 5. Plan de pruebas

**5.1 SQL (tras F1; en producción solo con autorización, o en BD desechable).** Patrón seguro: un bloque `DO` que fija el actor con
`set_config('request.jwt.claims', json_build_object('role','service_role','sub',<uid de catUsers>)::text, true)`,
ejecuta los casos, junta resultados en un texto y termina con `RAISE EXCEPTION 'ROLLBACK_PRUEBA %', resultado` ⇒ **nada persiste**.
Usar la fecha de México (`(now() at time zone 'America/Mexico_City')::date`), no `current_date`. Casos:
T1 Deumex (destino `PDP_261005173412_d1cc795b`, orígenes `PDP_260313183715_64bf0ef1` + `PDP_260313184109_26812019`) ·
T2 misma clave ⇒ `YA_APLICADO` · T3 clave nueva con los mismos orígenes ⇒ `ORIGEN_BLOQUEADO` con `detalles.bloq='YA_TRASPASADO'`
(el `codigo` es `ORIGEN_BLOQUEADO`; el motivo viaja en `detalles.bloq`) · T4 nave 18 total · T5 revertir T4 ·
T6 revertir la fila 1 con la 2 aplicada y luego ambas ⇒ `pm2` vuelve a `500645.02` exacto · T7 cadena 2023→2025→2026
y `DESTINO_YA_EMITIO` · T8 tres orígenes ⇒ `EXCEDE_DESTINO` · T9 otro arrendador / nave 18 vigente ⇒ `ORIGEN_NO_VALIDO` ·
T10 destino pagado (`PDP_261019184419_c6220a90`) · T11 `constM2≠1` (`vjFS0eM0idFrJKD`) y moneda `''`/`'null'` ·
T12 sin actor, nota corta, sin confirmar · T13 `arre_aplicar_pago_atomico`: pago normal equivalente al flujo actual,
`PARTIDA_CAMBIO`, `DEPOSITO_TRASPASADO`, tolerancia, `unique_violation`.
**Casos añadidos tras la ronda 2 (todos probados en la BD desechable; repetirlos si el SQL cambia):**
T14 `INCLUIDO_EN_SIGUIENTE` (nave A: 2023 con el 2025 como sucesor que carga depósito) y `SUCESOR_SIN_DEPOSITO` (sucesor con cantidad + recibido = 0 y depósito del plan = 0;
el sucesor con partida en 0 pero `plan.deposito > 0` sigue siendo `INCLUIDO_EN_SIGUIENTE`; el sucesor dado de baja no bloquea) · T15 plan con **2 partidas de depósito** ⇒ una sola fila
en candidatos y `ORIGEN_BLOQUEADO`/`DEPOSITO_AMBIGUO` · T16 `sub` inválido (no UUID, vacío, claims no JSON) ⇒ `SIN_ACTOR` en las 3 funciones de escritura, nunca excepción cruda ·
T17 `p_fec_traspaso` anterior al 2020-01-01 ⇒ `FECHA_INVALIDA` (2020-01-01 inclusive) · T18 secuencia identity de `seq`: sin `USAGE` para `anon`/`authenticated`, el `INSERT` de `service_role` funciona ·
T19 cadena 2023→2025→2026 con `disponible` en cada paso, reversas D8 (`DESTINO_YA_EMITIO`, `REVERTIR_ANTES_OTRO`, `PAGO_APLICADO`, `ESTADO_INCONSISTENTE`) · T20 pureza del catálogo (antes/después idéntico) y
preludio de la migración (`lock_timeout 3s` aborta sin dejar nada) · T21 `MONTO_INSUFICIENTE`: monto 1 sobre una partida de 97,710 se rechaza y los montos de 3-4 decimales
redondeados a centavos por la API **no** (margen de 1 centavo) · T22 interbloqueo forzado traspasar ‖ `DELETE` del plan origen ⇒ `OCUPADO` (nunca `ERROR_INTERNO`) ·
T23 con `statement_timeout = 8s` (rol `authenticator` de producción) ninguna función cae en `57014`: `lock_timeout = 3s` ⇒ espera máxima 2 × 3 s. **Solo en BD desechable** (no en producción):
concurrencia con dos sesiones (traspaso ‖ traspaso mismo destino y mismo origen, traspaso ‖ aplicar pago, aplicar ‖ aplicar mismo movimiento, revertir ‖ revertir,
orden de bloqueos cruzado, `OCUPADO` a los 5 s, y **doble envío concurrente con la misma clave ⇒ `YA_APLICADO`**).

**5.2 API (Jest, patrón de `modules/soporte/kb.service.spec.ts`).** `traspasos-deposito.service.spec.ts`: mapa código→HTTP completo,
nunca reenvía `mensaje`/`detalle`; zod (nota < 10, `confirmado` falso, orígenes repetidos o > 10, uuid inválido).
`planes-arre.service.spec.ts`: `renovar` con traspaso y sin 25 ⇒ 403 **sin** llamar `v2_arrepdp_renovar`; traspaso fallido ⇒ 200 `fallido`
y plan intacto; guardas D13 (con y sin traspaso). `cobranza.service.spec.ts`: `pagos()` omite origen / etiqueta complemento;
`aplicarPago` usa la función atómica y mapea códigos. `calcularDeposito()` con los casos de `04` (paridad con SQL).

**5.3 Web y flujo.** Typecheck/lint/build; recorrido con Playwright y la cuenta de Toribio (solo validación: **no mutar producción**
salvo plan acordado con datos demo y limpieza verificada en 0); cotejo contra el Pencil aprobado: estados vacío, bloqueado,
exceso, resultado ✓/✗, reintento, revertir, Historial, *Aplicar pago* y estado de cuenta.

## 6. Verificación de riesgo (dinero, RLS, migración, varios contratos)

**Toribio + validador Opus**, no negociable: revisa OWASP/JWT/RBAC/zod, SQL parametrizado, errores que no filtran (4b), RLS y *grants*,
auditoría con actor, **reutilización** (`Modal`, `fallaBd`, `monedaEfectiva`, `navePorPlan`, `esConceptoDeposito`; sin duplicar reglas) y
escalabilidad (`revision-escalabilidad`: tabla minúscula, consultas por clave indexada). **Hallazgo ALTA = no se cierra.**
Riesgos ya conocidos que el validador debe atacar: lock-order entre traspasar/revertir/aplicar, `aplicar_pago_arrendatario` abierto a `anon`
(ajeno al traspaso: un llamado directo se salta todo), definición de «no duplicado» y hermana «día anterior» en SQL.

## 7. Requiere autorización explícita de Jereff

1. **Aplicar la migración** (con el SQL exacto). 2. **Correr las pruebas SQL en producción** (bloque `DO` con *rollback*; toma candados breves) o
usar BD desechable. 3. **Endurecer *Aplicar pago*** (D9, vetable: si se veta, no se crea `arre_aplicar_pago_atomico` y el rechazo de depósitos
traspasados queda solo en API). 4. **Versión y changelog** (el registro de `v2_changelog` lo pre-autoriza «documenta todo»; el número se
reserva antes). 5. **Push a `erp_v2`** (redespliega api+web automáticamente; paso aparte, nunca automático). 6. Asignar el permiso 25 a quien
corresponda (lo hace Jereff). 7. Cualquier corrección de datos reales (Deumex): la ejecuta el equipo de Mónica con la herramienta, no Toribio.

## 8. Orden de despliegue y reversa

BD primero (aditiva, no rompe nada) → **api y web juntos** en un mismo push (el `Record<TipoEventoHistorial>` y `aplicarPago` dependen de la BD ya migrada).
Reversa de código: revertir el commit y redesplegar (las funciones y la tabla quedan inertes). Reversa de BD: `DROP` de las 4 funciones y de la
tabla, **solo si está en 0 filas**; con traspasos aplicados primero se revierten desde la herramienta.

> **Nota de reversa:** con traspasos aplicados se revierten uno a uno en orden inverso de `seq` desde la herramienta ANTES del `DROP`; el `DROP` solo es válido con la tabla vacía.
> (Razón: el `DROP` borra el registro del traspaso pero el `pm2` reducido de los destinos se queda en `arrePdpDetalle`, y ya no habría forma de revertirlo.)
