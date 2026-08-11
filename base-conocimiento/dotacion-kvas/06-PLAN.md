# 06 · Plan de implementación — Dotación de KVA por nave

> Anclado a `00-brief-conceptual.md`. **No se empieza sin la aprobación de Jereff** y sin que
> `07-VERIFICACION-ADVERSARIAL.md` esté cerrado sin bloqueantes.

## Hitos

| # | Hito | Qué deja funcionando |
|---|---|---|
| **H1** | Esquema y migración de datos | La dotación existe y los 935 KVA viven en las naves |
| **H2** | Backend | Endpoints y restricción operando |
| **H3** | Frontend | Se captura y se ve |
| **H4** | Compromisos que caducan | Cron + correo |
| **H5** | Cierre | KB, changelog, verificación |

---

## H1 · Esquema y migración `⚠️ RIESGO ALTO`

| # | Tarea | Modelo | Riesgo |
|---|---|---|---|
| 1.1 | Migración F5a: columnas nuevas + CHECK + `COMMENT ON` | Toribio | Bajo (solo agrega) |
| 1.2 | `kva_validar_dotacion()` + triggers **STATEMENT** | Toribio | Medio |
| 1.3 | Migración F5b: sembrar dotación → borrar `POR_ASIGNAR` → reducir CHECK | **Toribio** | **ALTO — borra datos** |
| 1.4 | Reemplazar `kva_consumo` (5→4 args) y `kva_recalcular_disponibles` | Toribio | Medio |
| 1.5 | Recalcular los 12 parques y **verificar los 4 números** de Spartek | Toribio | — |
| 1.6 | `database.types.ts` + rebuild de `@erp/types` | Nicanor | Bajo |

⛔ **1.3 es el punto de no retorno.** Se ejecuta en una transacción con la verificación
incluida: si Spartek I & II no da 935/790/145/227, **rollback**. Requiere autorización
explícita de Jereff en el momento, no solo la de este paquete.

**Dependencias:** 1.3 después de 1.1 · 1.4 después de 1.3 · 1.5 al final.

---

## H2 · Backend

| # | Tarea | Modelo | Depende |
|---|---|---|---|
| 2.1 | `parques.schemas.ts`: `dotacion*Nave` en crear/editar parque | Nicanor | H1 |
| 2.2 | `parques.service.ts`: aplicar la dotación al crear parque y al agregar naves | Nicanor | 2.1 |
| 2.3 | `PATCH /parques/naves/:idNave/dotacion` con permiso **721** | Nicanor | 2.1 |
| 2.4 | Traducir el `RAISE EXCEPTION` de la restricción a **409** legible | Toribio | 1.2 |
| 2.5 | `kvas.service.ts`: `dotado` y `sinDotar` en el resumen | Nicanor | H1 |
| 2.6 | Validación **arrendatario → solo RENTA** en crear y editar | Toribio | — |
| 2.7 | `venceCompromiso` al crear/editar un COMPROMETIDO | Nicanor | H1 |
| 2.8 | `POST /kvas/asignacion/:id/renovar` | Nicanor | 2.7 |

---

## H3 · Frontend

| # | Tarea | Modelo | Depende |
|---|---|---|---|
| 3.1 | `ParqueModal`: bloque de dotación con el cálculo en vivo | Nicanor | 2.1 |
| 3.2 | `KvasPage`: filas «Dotado a naves» y «Sin dotar»; quitar la nota obsoleta | Nicanor | 2.5 |
| 3.3 | `NaveKvaModal`: dotación editable en línea | Nicanor | 2.3 |
| 3.4 | `NaveKvaModal`: vencimiento con ⏳ y botón Renovar | Nicanor | 2.8 |
| 3.5 | `AsignacionKvaModal`: figura fija en Rentado si la nave está arrendada | Nicanor | 2.6 |

---

## H4 · Compromisos que caducan

| # | Tarea | Modelo | Depende |
|---|---|---|---|
| 4.1 | `TAREA_KVAS_COMPROMISOS` en `cron.tareas.ts` | Nicanor | H1 |
| 4.2 | `kvas-compromisos.scheduler.ts`: avisar y borrar, aislando error por parque | Toribio | 4.1 |
| 4.3 | Plantilla de correo siguiendo `invitaciones.mailer.ts` | Nicanor | 4.2 |
| 4.4 | Columna `avisoCompromiso` para no reenviar a diario | Toribio | H1 |
| 4.5 | Probar con disparo manual desde la pantalla Cron | Toribio | 4.2 |

---

## H5 · Cierre

| # | Tarea | Modelo |
|---|---|---|
| 5.1 | Skill `revision-escalabilidad` sobre lo construido | Toribio |
| 5.2 | Gate de seguridad (dinero/RBAC/datos → validador adversarial) | Fabián (Fable 5) |
| 5.3 | KB: `modulos/kvas.md` + `bd/kvas.dbml` regenerado + `INDICE.md` | Nicanor |
| 5.4 | HANDOFF §5d-bis, bitácora, contexto | Toribio |
| 5.5 | Changelog + `APP_VERSION_RAW` + commit | Toribio |

---

## Esfuerzo

| Hito | Estimación |
|---|---|
| H1 | 3 h (de las cuales 1 h es verificación de la migración) |
| H2 | 4 h |
| H3 | 3 h |
| H4 | 3 h |
| H5 | 2 h |
| **Total** | **~15 h · dos jornadas** |

## Orden de despliegue

1. H1 en producción **fuera de horario**, con el API detenido.
2. Verificar los 4 números antes de levantar el API.
3. H2 + H3 + H4 se despliegan juntos: el front nuevo necesita el backend nuevo.
4. Publicar el changelog después del deploy.

## Qué NO se hace en este trabajo

- Retirar las columnas espejo (`kvasAlta`…) — sigue siendo pendiente aparte.
- Migración F1b (DROP de `tipoTension`/`tipoContrato`) — ídem.
- Corregir las 20 naves donde el Excel excede su propio paquete — es del cliente.
- El importador configurable de Excel — módulo aparte.
