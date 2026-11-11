# 02 — TRD: Traspaso de depósito de garantía

> Anclado a `00 v2` (D1–D17). Rutas relativas a `version2/`. SQL exacto en `05-BACKEND.md` (borrador).
> Estado: **aprobado y construido (v2.81.0, 2026-11-11).**

## 1. Componentes tocados

| Capa | Cambio |
|---|---|
| **BD** (solo CREATE, D17) | Tabla `arre_traspasos_deposito` + funciones `arre_traspasar_deposito`, `arre_revertir_traspaso`, `arre_aplicar_pago_atomico` y la de solo lectura `arre_traspaso_candidatos` (ver §10). |
| **API NestJS** (`apps/api/src/modules/arrendatarios/`) | **Nuevo** `traspasos-deposito.service.ts`. **Modifica** `planes-arre.service.ts` (renovar + guardas D13), `cobranza.service.ts` (`pagos()` D6, `aplicarPago` D9), `historial-plan.service.ts`, `reportes-arre.service.ts` (D14), `arrendatarios.controller.ts`, `arrendatarios.schemas.ts`, `arrendatarios.module.ts`. |
| **Web React** (`apps/web/src/features/arrendatarios/`) | Formulario compartido, modal «Traspasar depósito», tarjeta de resumen, `RenovarPlanModal`, `ArrendatariosPage`, `AplicarPagoModal` (etiqueta D16), estado de cuenta, `components/notas` (tipos de evento). Detalle en `03`. |
| **No cambia** | `v2_arrepdp_renovar`, `pagos_arrendatarios`, `aplicar_pago_arrendatario`/`desaplicar_pago_arrendatario`, ningún dato existente. |

## 2. Contratos HTTP (controlador `arrendatarios`, todo con `JwtAuthGuard + PermisoGuard`)

| Ruta | Permiso | Cuerpo / respuesta |
|---|---|---|
| `GET planes/:id/deposito` | 20 | `{ deposito: {idArrePdpDet, moneda, cantidad, recibido, emitido, contractual, porCobrar, pagada}\|null, traspasos: TraspasoDto[] }` |
| `GET planes/:id/traspaso-origenes` | 25 | candidatos del destino `:id` (filas de `arre_traspaso_candidatos` + etiqueta nave/periodo + `bloqueo`) |
| `GET planes/:id/renovacion-traspaso-origenes?moneda=` | 23 (+25 en servicio) | igual, calculado para la renovación de `:id` (destino aún no existe: arrendador y nave del plan, `fecFin+1`) |
| `POST planes/:id/traspasos` | 25 | `TraspasarDepositoDto` → `{ total, cantidadRestante, pagadaPorTraspaso, traspasos[] }` |
| `POST traspasos/:id/revertir` | 25 | `{ motivo }` → `{ ok: true }` |
| `POST planes/:id/renovar` | 23 (+25 si trae `traspaso`) | `RenovarPlanDto` + `traspaso?` → `{ idArrePdp, mensaje, traspaso: {estado:'omitido'\|'aplicado'\|'fallido', codigo?, mensaje?} }` |

**DTO zod** (`arrendatarios.schemas.ts`; el cliente **no envía montos**, D3):
`traspasarDepositoSchema = { origenes: z.array(z.string().trim().min(1)).min(1).max(10) (sin repetir), fecTraspaso: FECHA,
nota: z.string().trim().min(10).max(400), confirmado: z.literal(true), claveIdempotencia: z.string().uuid() }`.
`renovarPlanSchema` gana `traspaso: traspasarDepositoSchema.optional()` — **sin valor por defecto** (sin traspaso
explícito no hay traspaso). `revertirTraspasoSchema = { motivo: z.string().trim().min(5).max(400) }`.

## 3. Validación server-side (invariantes D7)

La **autoridad es la BD**, dentro de la misma transacción que escribe: mismo arrendador, misma moneda efectiva,
origen ≠ destino, fechas (`COALESCE(fecCancelacion,fecFin) < fecInicio` destino), `status`, no duplicado, destino
sin `fecPago`/`arre_pagos`, `constM2=1`, origen > 0, `disponible > 0`, `Σ T ≤ cantidad destino`; el origen debe ser
candidato D1 (misma nave o hermana que termina el día anterior). **Nada viene del body**: arrendador, montos,
moneda y actor se derivan en SQL. La API solo valida forma (zod), permisos y guardas D13; no replica reglas
(DRY: la lista de la UI sale de la misma función `arre_traspaso_candidatos`).

## 4. Concurrencia (D8, D9, D15)

- `SELECT … FOR UPDATE` de **todas** las partidas de depósito involucradas, `ORDER BY "idArrePdpDet"`, el mismo
  orden en traspasar, revertir y `arre_aplicar_pago_atomico` ⇒ sin interbloqueos entre ellas. `lock_timeout 5 s`
  ⇒ código `OCUPADO` (409) en vez de colgar.
- **Todo o nada** con N orígenes: cualquier `RAISE` deshace el bloque completo.
- **Idempotencia**: índice único `(claveIdempotencia, idArrePdpOrigen)`; reintento/doble clic ⇒ `YA_APLICADO`
  (éxito con lo ya aplicado). La clave la genera el cliente por envío.
- **`CobranzaService.aplicarPago`** deja de llamar `aplicar_pago_arrendatario` + `insert arre_pagos` + `update movbancarios`
  por separado y llama **una** `arre_aplicar_pago_atomico` (líneas = `idArrePdpDet`, `cantidadEsperada`, `monto` con
  IVA). Las validaciones de moneda/tolerancia en TS **se conservan** (mismos mensajes); la función revalida saldo y
  partidas bajo candado. Nuevo 409 `PARTIDA_CAMBIO`: «La partida cambió mientras aplicabas el pago; recarga».
  `aprenderOrdenante` y `registrarActividad` siguen en TS tras el éxito. Residual: ninguno conocido entre
  traspaso y pago; sí sigue abierta la deuda ajena de `aplicar_pago_arrendatario` (00 §7).

## 5. Actor y auditoría (verificado en `common/supabase/supabase.service.ts` y en la BD)

`comoActor(uid)` firma un JWT HS256 con `role=service_role` y `sub=uid` y crea un cliente cuyas peticiones lo
llevan; PostgREST fija `request.jwt.claims` por petición y `fn_auditoria` (SECURITY DEFINER) y `auth.uid()` lo
leen. Evidencia: 60 días de `auditoria` de `arrePdp`: origen 2 (backend) → 0 filas sin uid. **Trampas**:
`comoActor('')` devuelve el cliente `admin` **sin `sub`**, y `fn_auditoria` traga sus propios errores. Por eso:
(1) **toda** llamada de este paquete usa `comoActor(actor.uid)`, nunca `admin`; (2) las funciones leen
`auth.uid()` y lanzan `SIN_ACTOR` si es NULL (sin `p_uid`); (3) el actor se guarda **en la propia fila**
(`uid`, `revertidoPor`, `fecReversion`), no solo en `auditoria`; (4) `arrePdpDetalle` ya audita el cambio de `pm2`.
`registrarActividad` (tabla `actividad`) se invoca como en `renovar`: «Traspaso de depósito … nota».

## 6. Errores seguros (regla 4b)

La API **nunca** reenvía `mensaje` de la RPC ni `error.message`: mapea `codigo` → HTTP + texto escrito a mano
(`MENSAJES_TRASPASO` en el servicio; cifras tomadas de `detalles` y formateadas con 2–4 decimales). 5xx →
`fallaBd(this.logger, 'traspasos.op', …)`; `ERROR_INTERNO`/`SIN_ACTOR` → log con `detalles.detalle` y mensaje genérico.

| Código (RPC) | HTTP | Texto al usuario (resumen) |
|---|---|---|
| `CONFIRMACION_REQUERIDA`, `NOTA_INVALIDA`, `FECHA_INVALIDA` (vacía, futura —hora de México— o anterior al 2020-01-01), `PARAMETRO_INVALIDO`, `MOTIVO_INVALIDO` | 400 | Dato faltante o inválido, dicho en claro |
| `ORIGEN_NO_VALIDO` | 400 | «Ese contrato no es un origen válido para este destino» |
| `ORIGEN_BLOQUEADO` (+ `detalles.bloq`, el **motivo**) | 409 | un texto por motivo (ver la lista bajo la tabla) |
| `EXCEDE_DESTINO` | 409 | «Los depósitos elegidos (X) superan el del nuevo contrato (Y)…» |
| `DESTINO_PAGADO`, `DESTINO_SIN_SALDO`, `DEPOSITO_NO_ESTANDAR`, `DEPOSITO_DESTINO_INVALIDO`, `MONEDA_INVALIDA` | 409 | el destino no admite traspaso (y por qué) |
| `PAGO_APLICADO` | 409 | «Primero desaplica el pago del depósito (Registro de movimientos)» |
| `DESTINO_YA_EMITIO`, `REVERTIR_ANTES_OTRO`, `YA_REVERTIDO` | 409 | orden de reversa / ya revertido |
| `OCUPADO` (incluye el interbloqueo `deadlock_detected`), `PARTIDA_CAMBIO`, `DEPOSITO_TRASPASADO` | 409 | «Cambió mientras operabas; recarga» / «ese depósito ya fue traspasado» |
| `MONTO_INSUFICIENTE` (`arre_aplicar_pago_atomico`: línea con `monto < cantidadEsperada − 0.01`) | 500 | defensa en profundidad: en el flujo real el monto (con IVA) siempre es ≥ la cantidad, así que solo ocurre ante un bug de la API; mensaje genérico y el detalle al log |
| `TRASPASO_APLICADO` (guarda de `desaplicarPago`: el depósito de un origen ya traspasado) | 409 | «Revierte primero el traspaso de este depósito» |
| `DESTINO_NO_ENCONTRADO`, `TRASPASO_NO_ENCONTRADO` | 404 | no existe |
| `ESTADO_INCONSISTENTE` | 409 | «Cambió después del traspaso; contacta a soporte» |
| `YA_APLICADO` | 200 | éxito idempotente (también para el doble envío **concurrente** con la misma clave) |
| `SIN_ACTOR` (también si el `sub` del JWT no es un UUID), `ERROR_INTERNO` | 500 | mensaje genérico; el detalle solo al log (`fallaBd`), como dice el párrafo de arriba |

Motivos de `ORIGEN_BLOQUEADO` (`detalles.bloq`; la función los evalúa **en este orden** y devuelve el primero que aplique; la API lee `detalles.bloq`, no el `codigo`):

| `detalles.bloq` | Texto al usuario (resumen) |
|---|---|
| `INCLUIDO_EN_SIGUIENTE` | «Ya incluido en el contrato siguiente de esta nave» (el sucesor de la nave carga depósito; solo el plan terminado más reciente por nave es seleccionable) |
| `SUCESOR_SIN_DEPOSITO` | «El contrato siguiente de esta nave tiene depósito en 0; probablemente se consolidó en otra nave del mismo arrendatario: revisa los planes» (sucesor con cantidad + recibido = 0 **y** depósito del plan = 0; **no se desbloquea**, decisión de Toribio) |
| `DEPOSITO_AMBIGUO` | «El contrato tiene más de una partida de depósito» (corrige primero la estructura) |
| `MONEDA_DISTINTA` | «Está en otra moneda que el contrato nuevo» (moneda efectiva: partida válida, si no la del plan) |
| `DEPOSITO_NO_ESTANDAR` | «La partida de depósito no tiene la estructura estándar (constM2 ≠ 1)» |
| `DEPOSITO_EN_CERO` | «El depósito está en 0» (se muestran contrato y partida: monto de la partida vs. depósito del plan) |
| `YA_TRASPASADO` | «Ese depósito ya fue traspasado completo» (disponible = 0) |

`ORIGEN_NO_VALIDO` queda para lo que ni siquiera es candidato (otro arrendatario, contrato aún vigente, sin relación de nave ni «día anterior», duplicado no vinculado, plan inexistente).

## 7. Renovar (D11, D12) — `PlanesArreService.renovar()`

1. Si trae `traspaso`: `exigirPermiso(uid, 25)` **antes** de crear nada (403 claro; no queda plan a medias).
   Helper nuevo `common/auth/exigir-permiso.ts` (misma regla que `PermisoGuard`, ya duplicada en `notas.service`).
2. `v2_arrepdp_renovar` **sin cambios** → `idNuevo` (su `ERROR_GENERAL` trae `SQLERRM`: se mapea a mensaje genérico, hoy se reenvía). 3. Si trae `traspaso`: `TraspasosDepositoService.traspasar(idNuevo, …)`
dentro de `try/catch`. 4. Respuesta **200** con `traspaso.estado`; el plan **nunca** se revierte por un fallo del
traspaso. *Reintentar* llama `POST planes/{idNuevo}/traspasos` con **la misma clave** (no vuelve a `/renovar` ⇒ sin `YA_RENOVADO`).

## 8. Guardas en flujos existentes (D13, solo si hay traspaso; si no, idéntico)

`TraspasosDepositoService.exigirSinTraspasos(idArrePdp, accion)` (consulta `arre_traspasos_deposito` por origen o destino):
`eliminarPlan` → 409 `PLAN_CON_TRASPASOS` (cualquier fila, aplicada **o** revertida, porque la FK `RESTRICT` la bloquearía);
además se corrige el mapeo de `ERROR_GENERAL` en `eliminarPlan` (hoy reenvía `SQLERRM`). `cambiarMoneda` →
`TRASPASO_APLICADO` si `esConceptoDeposito(concepto)`. `editarCampo` y `eliminarConcepto` → bloqueados para el
concepto de depósito si hay traspaso aplicado (en `eliminarConcepto` también lo exige la FK a la partida).
`esConceptoDeposito` = la normalización que hoy está inline en `ivaDePartida` (se extrae y reutiliza).

## 9. Cobranza, Historial y reportes

- **D6** en `CobranzaService.pagos()` (único consumidor de `pagos_arrendatarios`; lo usan `cobranza/pagos` y
  `cobranza/partidas-pendientes`): una consulta a `arre_traspasos_deposito` (`estado='aplicado'`, tabla minúscula)
  y, por fila `num_partida=0` de depósito, `monto = max(0, base − Σ emitidos)`; si es 0 **se omite**. Cada fila de
  destino con recibidos lleva `traspasoRecibido` (D16). *(El brief dice «omite … con etiqueta»: omitida no puede
  llevar etiqueta; la etiqueta «Traspasado → plan X» vive en el resumen, estado de cuenta e Historial.)*
- **Historial**: `historial-plan.service.ts` suma `traspaso_deposito` y `traspaso_revertido` leyendo la tabla
  (MontseAI no los cubre ⇒ siempre desde la tabla, como los pagos); tipos y estilos también en
  `components/notas/notas.api.ts` y `PanelNotas.tsx` (`Record` exhaustivo ⇒ falla al compilar si falta uno).
- **D14** `reportes-arre.service.ts`: cabecera suma `depositoTraspasado`, `depositoPorCobrar`; el renglón 0 lleva
  `nota` «Traspaso de <plan>: T» (destino) o «Traspasado → <plan>: T» (origen). Web: pantalla, PDF y Excel.
- Fórmula D5 en TS (solo presentación) = función pura `calcularDeposito()` con pruebas de paridad (casos de `04`).

## 10. Decisiones técnicas a validar

1. **4.ª función de solo lectura** `arre_traspaso_candidatos` (el brief cuenta 3): evita duplicar en TS las reglas
   D1/D7; si se rechaza, esas reglas pasan a TS y SQL (peor).
2. `SECURITY INVOKER` (D10): `service_role` ya salta RLS y tiene permisos de tabla; una fuga de *grants* no basta para abusar.
3. Se **conserva** que la partida y `arre_pagos` lleven `uidPago` distintos (deuda ajena, 00 §7).
4. El tipado de `@erp/types` no incluye las RPC nuevas: mismo *cast* localizado que `renovar`/`cancelarAnticipado`.
