# 00 — Brief conceptual v2: Traspaso de depósito de garantía

> **Fuente de verdad del paquete.** Los demás documentos (`01`–`07`) se anclan a este y no lo contradicen.
> Estado: **v2.1 — corregido tras el gate adversarial (3 Opus, lentes seguridad/consumidores/casos reales) y con
> las objeciones de redacción resueltas (§10).**
> **Estado de ejecución (2026-11-11): CONSTRUIDO (v2.81.0); migración aplicada en producción el 2026-10-21 (SHA-256 `ec18366d…`); pendiente el push.** Aprobado por Jereff el 2026-10-20 (texto + wireframe).
> Origen: reunión «SPH - Arrendatarios» del 2026-10-20 (Jereff + Mónica Echeverry, Gemini Notes en Drive).
> Redactó: Toribio (arquitecto), 2026-10-20. Informes del gate en `temp/traspaso-deposito/adv-{A,B,C}-*.md`.

## 0. Qué cambió de v1 a v2 (resumen del gate)

El gate dio **13 hallazgos ALTA** (varios coincidentes). Las correcciones de fondo:

| Hallazgo | Corrección en v2 |
|---|---|
| Reversa por `pm2Antes` rompía destinos con varios traspasos; un traspaso total no se podía revertir (A3, A4, B1) | Reversa **aditiva** (`pm2 += T`), por fila, con reglas claras → D8 |
| Disponible mal en cadenas 2023→2025→2026 (B2, C2, A5-M5) | `disponible = cantidad + Σ recibidos − Σ emitidos` → D5 |
| El origen seguía «por cobrar» en Aplicar pago y cobranza (C1, A2) | La cobranza **oculta** lo ya traspasado (capa API) → D6 |
| Carrera Aplicar pago ↔ traspaso, `FOR UPDATE` insuficiente (A1) | Aplicar pago pasa a una función **atómica** (misma conducta) → D9 |
| Plan eliminado/moneda cambiada con traspaso aplicado (A5, B3, B4) | Guardas solo cuando hay traspaso → D13 |
| Depósitos nunca cobrados como origen = riesgo de fraude (A2) | Controles v1: nota obligatoria, orígenes acotados, doble permiso, auditoría → D11 |
| Renovar solo conocía el plan que se renueva: complemento 263,642.07 en vez de 26,639.11 (C4) | Sugerencia incluye **naves hermanas** del mismo día → D1 |
| Captura de montos con 2 decimales rechazaba 237,002.955 (C5, A-B2) | **La persona elige orígenes, no teclea montos** → D3 |
| Actor perdible en la auditoría (A6) | Actor = `auth.uid()` en la función; sin `p_uid` → D10 |

## 1. Decisión de Jereff (2026-10-20)

- Enfoque **híbrido**: al **renovar** el sistema *sugiere* el traspaso y la persona lo confirma; además hay un
  **botón manual** para contratos ya renovados.
- **«Lo que ya existe no lo muevas; solo démosles la opción para que ellos lo corrijan.»** →
  **cero backfill, cero jobs, cero UPDATE masivo.** Ningún dato existente cambia si una persona no ejecuta un
  traspaso. La migración es **solo CREATE** (D17). La corrección la hace el equipo de Mónica, caso por caso.

## 2. Glosario canónico (no mezclar)

| Término | Qué es |
|---|---|
| **Depósito de garantía** | La partida `numPartida=0`, `concepto` tipo `deposito%garantia%`, de cada plan (id usual `<idArrePdp>_DEP`; 33 no lo siguen → se localiza por `numPartida`+concepto). |
| **Depósito bancario** | Fila de `movbancarios` (dinero que entró al banco). En *Aplicar pago* el «saldo de depósito» se refiere a **esto**, NO a la garantía. |
| **Traspaso** | Mover en papel el depósito de garantía ya recibido de un contrato anterior hacia el de uno nuevo. **No entra dinero al banco.** |
| **Origen / Destino** | Plan(es) cuyo depósito se traspasa / plan cuyo depósito queda cubierto en parte o todo. Un plan puede ser destino y luego origen (cadena de renovaciones). |
| **Complemento** | Lo que sí falta cobrar en efectivo del depósito destino. |
| **Disponible** | Depósito que un plan puede emitir hoy: `cantidad de su partida + Σ traspasos recibidos − Σ traspasos emitidos` (D5). |

## 3. Problema

Al renovar, el sistema crea un depósito **nuevo y completo** (`v2_arrepdp_renovar` → `p_deposito`) que queda
«por cobrar», aunque el inquilino ya tiene un depósito en poder de SPH. La partida se paga **completa** (todo o
nada) y `arre_pagos.idmov` es NOT NULL (todo pago nace de un movimiento bancario): hoy no hay forma de decir
«474,005.91 ya los tenía; solo faltan 26,639.11». Es un patrón general: **11 renovaciones** dejaron el depósito
nuevo en 0 por consolidarlo en una sola nave (6 clientes); no es solo Deumex.

## 4. Hechos verificados contra la BD (SELECT, 2026-10-20)

1. Partida de depósito: `pm2` = monto, `constM2` = 1 (1 excepción), `cantidad` es **columna GENERADA**
   (`pm2 × constM2`), `pm2` es `numeric` (guarda 237,002.955 exacto). `trg_v2_iva_*` deja `iva=0` en depósitos.
2. La corrida de partidas **no se regenera** (`PARTIDAS_YA_EXISTEN`): un ajuste al `pm2` del depósito no se pisa.
3. `aplicar_pago_arrendatario` salta en silencio las partidas con `fecPago` pero igual marca el movimiento
   bancario como aplicado; `CobranzaService.aplicarPago` calcula montos en JS antes (ventana de carrera).
4. Datos: **234** partidas de depósito, **145** con monto y **0 pagadas** (solo hay una «pagada en 0»); 56
   renovaciones; **30** vigentes/futuras con depósito pendiente = **$8,207,927.43**. Nada de esto es «cobrado
   en plataforma» → el traspaso lo **confirma una persona**; no se puede calcular.
5. `pagos_arrendatarios` (usada por Aplicar pago y dashboard) une **todos los planes de la nave** con
   `pdpActivo=true`: los depósitos de planes vencidos aparecen hoy como «por cobrar» (fantasmas preexistentes).
   KPIs: pendiente = `cantidad` sin `fecPago`; cobrado = con `fecPago` → **no se debe poner `fecPago` en un
   origen** (inflaría «cobrado»).
6. Deumex (`DEUMEX TRADING SA DE CV`, `Tok8tXCiPfo0S8d3whWs`): nave A (`yalWrsuLkXoNI5jBfT`) planes
   2023 (218,283.70), 2025 (237,002.955), 2026 (500,645.02); nave B (`OvwNpNwnhU84z5IqIH`) 2025 (237,002.955)
   y 2026 (depósito 0, «pagada en 0» el 2026-10-08); nave 18 (`dpYkbPy0wg2ipcwtxf`) 97,710/97,710.
   2×237,002.955 = **474,005.91**; 500,645.02 − 474,005.91 = **26,639.11** (= lo que dice el contrato).
7. *Historial* se reconstruye de `auditoria`, `arre_incrementos`, `arre_pagos`. Permisos: 20 ver · 22 cancelar ·
   23 renovar · 25 editar planes (`PATCH planes/:id/detalle` hoy exige solo 20 — deuda ajena, ver §7).
8. Candidatos a origen: máx. 6 por destino; la regla «misma nave anterior, o hermana que vence el día antes»
   da exactamente los 3 correctos de Deumex; sin ella, 47 % de los candidatos serían contratos aún vigentes.
9. Datos sucios: 25 depósitos con moneda `''`/`'null'`; 6 renovaciones con origen en 0 aunque `plan.deposito>0`;
   6 planes duplicados no activados; 5 depósitos con `anio=1` editables a mano.

## 5. Decisiones de diseño

| # | Decisión |
|---|---|
| D1 | **Híbrido**: sección «Traspasar depósito» en el modal *Renovar* + botón **«Traspasar depósito»** en el plan destino; un solo componente de formulario. **Candidatos a origen** (mismo arrendador): (a) planes anteriores de la **misma nave** ya terminados — **por cada nave solo el más reciente es seleccionable**; los más antiguos salen bloqueados «Ya incluido en el contrato siguiente de esta nave» (`INCLUIDO_EN_SIGUIENTE`), para no contar dos veces el mismo depósito (p. ej. 2023 y 2025 de la nave 12); (b) planes de **naves hermanas** cuyo fin = día anterior al inicio del destino. Se muestra en grande el **complemento resultante** antes de confirmar. |
| D2 | **Entidad propia** `arre_traspasos_deposito`, una fila por par origen→destino, con `claveIdempotencia` UNIQUE, `uid` (actor), `nota` NOT NULL, `confirmadoRecibido`, `marcoPagada`, `pm2Antes` (solo auditoría), `estado` (`aplicado`/`revertido`) y FKs **ON DELETE RESTRICT** a plan y partida. NO se inventa un `movbancarios` ni se fuerza `arre_pagos`. |
| D3 | **Traspaso total por origen**: la persona **elige orígenes** y el sistema traspasa el `disponible` completo de cada uno; **nunca teclea montos** (adiós al problema de 2 decimales/redondeo). `Σ T ≤ cantidad del destino`; si no, se bloquea con mensaje claro (la devolución de excedente es fase posterior). |
| D4 | **Efecto en el destino**: `pm2 −= T` (exige `constM2 = 1`; `cantidad` baja sola). Si `cantidad` queda en 0 → `fecPago = fecTraspaso` (la fila que lo deja en 0 guarda `marcoPagada=true`; sin `arre_pagos`). `arrePdp.deposito` (total contractual) no se toca. |
| D5 | **Disponible** de un plan = `cantidad(partida) + Σ recibidos aplicados − Σ emitidos aplicados`. Soporta cadenas. El **origen no se modifica** en `arrePdpDetalle` (ni `pm2` ni `fecPago`). |
| D6 | **La cobranza oculta lo traspasado** (capa API, no se cambia el RPC `pagos_arrendatarios`): `CobranzaService.pagos()` muestra para cada partida de depósito `monto = max(0, cantidad − Σ emitidos)` y la **omite si es 0**, con etiqueta «Traspasado → plan X». Cubre Aplicar pago y dashboard (a verificar en TRD que ambos pasan por `pagos()`). |
| D7 | **Invariantes (server-side en la función)**: mismo arrendador · misma **moneda efectiva** (`NULLIF(NULLIF(moneda,''),'null')` con respaldo en `arrePdp.Moneda`) · origen ≠ destino · `COALESCE(fecCancelacion,fecFin)` del origen < `fecInicio` del destino · plan origen activo (`status`) y no duplicado · partida destino **sin** `fecPago` y sin `arre_pagos` aplicados · `constM2 = 1` en ambas · origen con partida > 0 (si es 0 pero `plan.deposito>0` → bloquear y mostrar ambos montos) · `disponible > 0` · `Σ T ≤ cantidad destino`. Depósitos localizados por `numPartida=0` + concepto, **no** por sufijo `_DEP`. |
| D8 | **Reversa** por fila, motivo obligatorio: `pm2 += T`; limpia `fecPago`/`cantidadAplicada` solo si lo puso el traspaso (`marcoPagada`), no hay `arre_pagos` aplicados y la `cantidad` resultante > 0. **Bloqueada** si el destino ya emitió traspasos aplicados (se revierte en orden inverso) o si su partida tiene pagos aplicados (primero *Desaplicar pago*). Nunca se borra la fila. |
| D9 | **Concurrencia**: función transaccional, **todo o nada** con N orígenes, `SELECT … FOR UPDATE` en orden determinista (por `idArrePdpDet`). Además **se endurece *Aplicar pago***: nueva función `arre_aplicar_pago_atomico` (bloquea partidas, verifica los montos esperados, aborta con `PARTIDA_CAMBIO` si cambiaron, marca el movimiento y registra `arre_pagos` en la misma transacción) y `CobranzaService.aplicarPago` pasa a usarla. Conducta visible igual salvo un 409 «la partida cambió, recarga». La función vieja se conserva (se marca obsoleta después). |
| D10 | **Seguridad de BD**: tabla con RLS activa **sin políticas** y `REVOKE ALL` a `anon`/`authenticated`/`public`; funciones `SECURITY INVOKER`, `search_path` fijo, `EXECUTE` solo a `service_role`; **actor = `auth.uid()`** dentro de la función (sin parámetro `p_uid`; `RAISE` si es NULL) y guardado en la fila. Verificación de *grants* posterior a la migración. API: nunca reenvía `mensaje` de RPC ni `error.message` (regla 4b); mapea códigos propios. |
| D11 | **Permisos y controles v1**: botón manual = **25**; traspaso dentro de *Renovar* exige **23 y 25**. Anti-fraude: nota obligatoria (≥10 caracteres, p. ej. folio del contrato), casilla «Confirmo que el depósito del contrato anterior fue recibido», orígenes acotados (D1/D7), auditoría + línea en *Historial*. **Sin segundo aprobador en v1** (decisión abierta, §9). |
| D12 | **Renovar**: no se toca `v2_arrepdp_renovar`; el traspaso va **después** de crear el plan. El modal **se queda en un estado de resultado** («Plan creado ✓ / Traspaso ✗ — Reintentar»); reintentar no vuelve a crear el plan (evita `YA_RENOVADO`). |
| D13 | **Guardas en flujos existentes, solo si hay traspaso aplicado** (sin traspasos, comportamiento idéntico): eliminar plan origen/destino → `PLAN_CON_TRASPASOS` (pre-chequeo en API + FK `RESTRICT`); cambiar moneda de la partida → `TRASPASO_APLICADO` (chequeo en API); edición manual del `pm2` del depósito → bloqueada. |
| D14 | **Estado de cuenta/reportes**: el renglón 0 lleva la nota «Traspaso de <plan>: T» y el resumen muestra «Depósito contractual · Traspasado · Por cobrar» (hoy la cabecera dice 500,645.02 y el renglón 26,639.11 sin explicación). |
| D15 | **Idempotencia**: el formulario genera un UUID por envío; un reintento o doble clic devuelve el resultado ya aplicado, no duplica. |
| D16 | *Aplicar pago* etiqueta la partida reducida como «Depósito (complemento)». |
| D17 | **Migración solo CREATE** (tabla, funciones, índices). Ningún `UPDATE`/`ALTER` sobre tablas existentes; sin backfill ni jobs. SQL exacto autorizado por Jereff antes de aplicar. |

## 6. Caso Deumex (cómo lo resolvería *Mónica*, no nosotros)

Destino: plan nave A 2026 (`PDP_261005173412_d1cc795b`, 500,645.02). Orígenes: nave A 2025
(`PDP_260313183715_64bf0ef1`, 237,002.955) y nave B 2025 (`PDP_260313184109_26812019`, 237,002.955; hermana,
fin 2026-10-16 = día anterior al inicio). `T = 474,005.91` → `pm2` destino **26,639.11** (se cobra con *Aplicar
pago* de siempre). Nave B 2026 conserva su depósito en 0. Cadena 2023→2025 (218,283.70): opcional, la decide ella.
Nave 18 (97,710 → 97,710): destino queda en 0 y se marca pagada por traspaso.

## 7. Fuera del alcance de esta versión

- Devolución de depósito al terminar el contrato y excedente cuando el nuevo depósito < lo traspasable.
- Carga «depósito recibido antes de la plataforma» para los 145 existentes y limpieza de fantasmas.
- Pantalla/reporte «Traspasos de depósito» (con filtros por columna y exportación) y segundo aprobador.
- Incluir la tabla nueva en la fuente del agente de soporte (`v_arrepdpdet_totales`).
- Lo que no es del traspaso (permisos de edición del plan, funciones de pago antiguas, puntos de la reunión del 2026-10-20)
  no se resuelve aquí: lo dispone Jereff por separado.

## 8. Superficie que se toca

BD (solo CREATE): tabla + 4 funciones (`arre_traspaso_candidatos` —solo lectura—, `arre_traspasar_deposito`, `arre_revertir_traspaso`,
`arre_aplicar_pago_atomico`). API: `planes-arre.service` (renovar + guardas), `cobranza.service`
(`pagos()` oculta traspasado; `aplicarPago` usa la función atómica), `reportes-arre.service` (nota),
controlador y esquemas zod. Web: `RenovarPlanModal`, botón/modal en `ArrendatariosPage`, historial, etiqueta
en `AplicarPagoModal`. **No cambia:** `v2_arrepdp_renovar`, `pagos_arrendatarios`, `aplicar_pago_arrendatario`,
ningún dato existente.

## 9. Decisiones de Jereff (2026-10-20) — tomadas

1. **Segundo visto bueno en traspasos: NO en la v1.** Controles de D11 + auditoría; el reporte «Traspasos de depósito» queda
   como fase 2 para que Jereff los revise.
2. **Endurecer *Aplicar pago* (D9): SÍ.** Se crea `arre_aplicar_pago_atomico` y `aplicarPago` pasa a usarla (conducta visible
   igual; 409 «recarga» si algo cambió). Es lo único que toca un flujo que hoy funciona. *Sin veto.*
3. **`RenovarPlanModal` conserva su contenedor actual** (no se migra a `Modal` en esta entrega; la migración a portal no entra en esta
   entrega) — ver §10 #13.

**Limitación v1 (aceptada con el diseño):** sin devolución de excedente; si los depósitos a traspasar superan el nuevo, se
bloquea y se resuelve fuera (ajustando el depósito nuevo o devolviendo).

**Visto bueno de Jereff (2026-10-20, «dale»):** al wireframe v2 (`mockup.html`) y al paquete de texto `00`–`07`. *(Registrado por
Toribio como aprobación del plan; la construcción puede empezar en lo que no muta producción.)*

**Sigue pendiente de Jereff:** la autorización de la migración con el SQL exacto (después de la ronda 2: SQL probado en BD
desechable + validador Opus), y el push (paso aparte).

## 10. Resoluciones de Toribio a las objeciones de redacción (Nicanor, 2026-10-20)

| # | Objeción | Resolución |
|---|---|---|
| 1 | D6: una fila omitida no puede llevar etiqueta | **Aceptada.** `pagos()` omite el origen traspasado; la etiqueta «Traspasado → plan X» va en el resumen, el estado de cuenta y el Historial; el destino lleva «Depósito (complemento…)». |
| 2 | Regla de candidatos no era invariante de servidor | **Aceptada: va en SQL** (D1/D7 son server-side; la UI solo consume la lista). Es parte del control anti-fraude de D11. |
| 3 | Función extra `arre_traspaso_candidatos` | **Aceptada** (solo lectura): fuente única de las reglas D1/D7; evita duplicarlas en TS. |
| 4 | `claveIdempotencia` con N orígenes | **Aceptada:** `UNIQUE(clave, idArrePdpOrigen)`. |
| 5 | D8 necesita candado extra | **Aceptada:** `REVERTIR_ANTES_OTRO` + verificación de cordura con `max(pm2Antes)`. |
| 6 | D13 incompleto | **Aceptada:** guarda también en `eliminarConcepto`; `eliminarPlan` bloquea además con filas **revertidas** (la FK `RESTRICT` las bloquea igual); `eliminarPlan` y `renovar()` dejan de reenviar `SQLERRM`/`ERROR_GENERAL` (regla 4b). Con 0 traspasos el comportamiento es idéntico al actual. |
| 7 | «23 y 25» no cabe en `PermisoGuard` | **Aceptada:** chequeo del 25 en el servicio **antes** de crear el plan. El helper `exigir-permiso.ts` debe **extraer la lógica de `PermisoGuard`**, no duplicarla (el validador lo revisa). |
| 8 | «No duplicado» sin definir | **Aceptada:** no existe otro plan **vinculado** de la misma nave cuyo rango contenga el del origen. |
| 9 | Estado de cuenta del origen seguiría contando su renglón 0 como pendiente | **Decidido:** el renglón 0 del **origen** se marca «Traspasado → plan X» y no suma al pendiente (se añade a D14). |
| 10 | Quien recibió y luego emitió deja de mostrar su complemento por cobrar | **Aceptada como intencional:** al emitir, la persona confirmó «recibido» sobre **todo** el disponible (incluida su parte en efectivo). Se documenta en la KB y en el glosario. |
| 11 | Fecha de traspaso y motivo de reversa | **Aceptadas:** fecha editable, obligatoria, no futura (hora de México); motivo de reversa 5–400 caracteres. |
| 12 | *(Toribio, al dibujar el mockup)* Con la regla de v2, 2023 **y** 2025 de la nave 12 eran candidatos a la vez: elegir ambos cuenta dos veces el mismo depósito y solo lo atajaba el tope «Σ ≤ depósito nuevo», que no basta si el depósito nuevo es mayor | **Nueva regla en D1/D7:** por cada nave solo el plan terminado más reciente antes del destino es seleccionable; el resto sale bloqueado `INCLUIDO_EN_SIGUIENTE`. Limpiar el historial (2023→2025) se hace como un traspaso aparte con el 2025 como destino. **Ajusta `arre_traspaso_candidatos` en `05`** y se prueba en la ronda 2. |
| 13 | *(Jereff, 2026-10-20, tras ver el wireframe v1)* «Cambiaste el diseño de las pantallas»: v1 dibujó de memoria Aplicar pago, Historial, estado de cuenta y barra de planes | **Wireframe v2** replicado del código real; **lo existente no cambia de aspecto**, lo nuevo se marca. `RenovarPlanModal` conserva su contenedor (no se migra a `Modal`); la franja de depósito reutiliza el patrón de la franja de incrementos INPC; el estado de cuenta usa la columna Nota existente. Ver `03` §1/§5/§7. |

**Hallazgos de la BD incorporados:** `aplicarPago` hoy traga el error del insert en `arre_pagos` (refuerza D9);
`movbancarios.importe`, `arre_pagos.monto` y `arrePdp.deposito` son `double precision` (solo `pm2` es `numeric`);
`uid` referencia `catUsers` (todo actor, incluida la cuenta de Toribio, debe tener fila allí); `RenovarPlanModal`
no usa el `Modal` en portal (se migra al tocarlo); `fechaCorta` de la web no rellena ceros (se corrige al tocarlo).

**Sin verificar todavía (se cierra antes de aplicar):** el SQL de `05` no se ha compilado ni ejercitado
(`ORDER BY … FOR UPDATE`, `lock_timeout`, `jsonb_to_recordset` con cadenas→`numeric`, concurrencia); la regla de
hermanas/no-duplicado solo se probó con Deumex (quedan 10 consolidaciones multinave por barrer).
