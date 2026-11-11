# 04 — Flujos: Traspaso de depósito de garantía

> Anclado a `00 v2`. Cifras reales de Deumex (`Tok8tXCiPfo0S8d3whWs`) verificadas con `SELECT` el 2026-10-20.
> Convención: **P** = persona (Mónica / equipo, permiso 25; en *Renovar* 23 y 25) · **S** = sistema.

## 1. Renovar con traspaso sugerido (D1, D11, D12)

1. **P** abre *Arrendatarios · Planes de Renta* → arrendatario → nave → 🔄 *Renovar*.
2. **S** precarga la renovación (ya existente) y pide los candidatos (`renovacion-traspaso-origenes?moneda=MXN`).
   Muestra: el plan renovado **preseleccionado**; naves hermanas que vencen el mismo día **sin marcar**.
3. **P** ajusta el depósito nuevo (p. ej. 500,645.02), marca los orígenes que correspondan; **S** recalcula en grande
   «Por cobrar en efectivo» y bloquea si la suma supera el depósito nuevo.
4. **P** escribe la nota (≥ 10 caracteres), marca «Confirmo que el depósito … fue recibido» y pulsa *Registrar renovación*.
5. **S** (API): valida forma (zod) y permisos 23+25 **antes** de crear nada → `v2_arrepdp_renovar` (sin cambios) →
   `arre_traspasar_deposito(idNuevo, orígenes, fecha, nota, true, clave)`.
6. **S** responde 200 con `traspaso.estado`. El modal **no se cierra**: muestra «Plan creado ✓ · Traspaso ✓ · Por cobrar $X» y
   [Cerrar]. Sin orígenes marcados: renovación normal (`estado='omitido'`), nada cambia.

## 2. Traspaso manual — caso Deumex (00 §6)

Estado inicial: destino nave A 2026 `PDP_261005173412_d1cc795b` (500,645.02, sin cobrar). Candidatos que devuelve
`arre_traspaso_candidatos`: A 2025 (237,002.955), **B 2025** (237,002.955, hermana: fin 2026-10-16 = día anterior)
y A 2023 (218,283.70). No aparecen la nave 18 ni B 2026.

1. **P** elige Deumex → nave A → plan 2026 → botón *Traspasar depósito* (solo si hay depósito por cobrar).
2. **P** marca A 2025 y B 2025 (**no** A 2023: la cadena histórica la decide ella). **S**: Σ = **474,005.91**;
   complemento = **26,639.11**.
3. **P** escribe nota (folio), fecha, casilla → *Traspasar depósito*.
4. **S**: bloquea las 3 partidas en orden de id, valida D7, hace `pm2 = 500,645.02 − 237,002.955 − 237,002.955 =
   26,639.11` y crea **2 filas** (una por par), todo o nada; `fecPago` queda `NULL` (no llegó a 0).
5. **Resultado visible**: tarjeta «Contractual 500,645.02 · Traspasado 474,005.91 · Por cobrar 26,639.11»; en
   *Aplicar pago* el depósito sale «Depósito (complemento; 474,005.91 traspasados)» por 26,639.11 y los depósitos
   de A 2025 y B 2025 **ya no aparecen** (D6); *Historial* del destino y de los orígenes con la línea del traspaso.
6. **P** cobra el complemento con *Aplicar pago* de siempre (partida completa por 26,639.11).

## 3. Revertir (D8)

1. **P** en la tarjeta del destino pulsa [Revertir] en la fila deseada → modal con consecuencias → escribe motivo (≥ 5).
2. **S** (`arre_revertir_traspaso`): bloquea partidas, exige `estado='aplicado'`, que el destino **no haya emitido**
   traspasos aplicados, que no haya otra fila que lo dejó en 0, y que la partida no tenga pagos (`arre_pagos` o `fecPago` real).
3. **S** hace `pm2 += T`; si la fila tenía `marcoPagada` limpia `fecPago` y pone `cantidadAplicada=0`; marca la fila
   `revertido` con `revertidoPor`, `fecReversion`, motivo. La fila nunca se borra; el depósito del origen queda **disponible** otra vez.
4. **Si falla**: «Primero desaplica el pago» (`PAGO_APLICADO`) → **P** va a *Registro de movimientos*, desaplica y repite.
   «Revierte primero …» (orden inverso) → **P** revierte la fila posterior y luego esta.

## 4. Fallo del traspaso tras crear la renovación (D12)

1. El plan **ya está creado** (queda siempre). El traspaso falla por: `OCUPADO` (otro usuario operando), `EXCEDE_DESTINO`
   (el depósito cambió), origen ya traspasado por otra persona, etc.
2. **S** responde 200 con `traspaso: {estado:'fallido', codigo, mensaje en claro}`; el modal muestra «Renovación registrada ✓ ·
   El traspaso no se aplicó: <motivo>» con [Reintentar traspaso] y [Cerrar].
3. **P** corrige (p. ej. quita un origen) y pulsa [Reintentar]: `POST planes/{idNuevo}/traspasos` con la **misma
   clave**. Si el primer intento sí se había aplicado (timeout), `YA_APLICADO` devuelve lo aplicado: **no se duplica**.
4. Si cierra el modal, el mismo trabajo se hace después con el botón manual (§2); `/renovar` no se vuelve a llamar
   (daría `YA_RENOVADO`).

## 5. Casos borde

| Caso | Comportamiento |
|---|---|
| **T = depósito completo** (nave 18: 2023 → 2025, 97,710 → 0) | `pm2 = 0`, `fecPago = fecTraspaso`, `cantidadAplicada = 0`, fila `marcoPagada=true`, sin `arre_pagos`. Sale de pendientes de *Aplicar pago* y del dashboard; etiqueta «Pagado por traspaso». Revertir limpia `fecPago`. El origen 2023 (`moneda='null'`) usa la moneda del plan (MXN). |
| **Depósito nuevo < lo traspasable** | `EXCEDE_DESTINO`: se bloquea con las dos cifras. Salidas: quitar un origen, subir el depósito nuevo (si procede) o devolver fuera del sistema; el excedente en sistema es fase posterior (00 §9.3). |
| **Moneda distinta** | Candidato visible pero **bloqueado** («otra moneda»). Moneda efectiva = la de la partida si es MXN/USD; si es `''`/`'null'`, la del plan; si ninguna sirve, `MONEDA_INVALIDA`. Cambiar la moneda del depósito con traspaso aplicado → `TRASPASO_APLICADO` (D13). |
| **Destino ya pagado** (p. ej. B 2026 de Deumex, «pagada en 0») o complemento cobrado después | `DESTINO_PAGADO`: no se traspasa. Para revertir tras cobrar el complemento: *Desaplicar pago* primero. |
| **Cadena 2023 → 2025 → 2026** | Cualquier orden. 2025 recibe 218,283.70 (`pm2` 237,002.955 → 18,719.255) y su `disponible` = 18,719.255 + 218,283.70 − 0 = **237,002.955**; luego emite a 2026. Revertir exige orden inverso (`DESTINO_YA_EMITIO`). |
| **Doble clic / dos personas** | Misma clave ⇒ `YA_APLICADO`. Claves distintas ⇒ la segunda ve el `disponible`/`cantidad` ya actualizados y se rechaza (`ORIGEN_BLOQUEADO … YA_TRASPASADO` o `EXCEDE_DESTINO`). |
| **Carrera con *Aplicar pago*** | La función atómica aborta con `PARTIDA_CAMBIO` (409 «recarga»); el saldo bancario **no** se consume. Un depósito traspasado rechaza el cobro (`DEPOSITO_TRASPASADO`). |
| **Origen en 0 con depósito contractual > 0** (21 planes; p. ej. `fCFmKCwJk6WWTay` 868,305.55) | Visible y bloqueado: «Depósito en 0 en la corrida; el contrato dice $X» (ambos montos). Requiere la fase «depósito previo». |
| **Complemento menor a la tolerancia** (0.05) | *Aplicar pago* lo absorbe como hoy (`ARRE_TOLERANCIA_PAGO`). |
| **Eliminar o cancelar** | Eliminar plan con filas de traspaso (aplicadas o revertidas) → `PLAN_CON_TRASPASOS` (API + FK `RESTRICT`). Cancelación anticipada no toca la partida 0 (corte ≥ 1): el depósito traspasado se queda en el destino y, si ese contrato termina antes, puede ser origen de otro. |
| **Datos sucios** | `constM2 ≠ 1` (1 plan): bloqueado. Depósito localizado por `numPartida=0`+concepto (33 sin sufijo `_DEP`). Planes duplicados vinculados: el no vinculado no es candidato. Sin partida de depósito o con 2: `DEPOSITO_DESTINO_INVALIDO`. |
| **Sin permiso** | Sin 25 no hay botón ni endpoints; sin 25 dentro de *Renovar* no se muestra la sección y la API responde 403 antes de crear el plan. |
