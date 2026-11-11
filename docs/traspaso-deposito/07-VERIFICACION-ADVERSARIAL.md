# 07 — Verificación adversarial del diseño (ronda 1)

> Fecha: 2026-10-20. Alcance: el **brief v1** (`00`). Tres revisores **Opus** con lentes distintas, solo lectura
> (SELECT en producción + lectura del código). Informes completos (no versionados) en
> `temp/traspaso-deposito/adv-{A-seguridad,B-consumidores,C-casos-reales}.md`.
> **Veredicto de la ronda 1: el brief v1 NO pasaba el gate** (A: 5 ALTA · B: 4 ALTA · C: 4 ALTA).
> El brief **v2.1** incorpora todo lo de abajo. La ronda 2 (sobre el SQL compilado) es obligatoria antes de aplicar.

## 1. Hallazgos ALTA y su disposición

| Lente | Hallazgo | Disposición en v2.1 |
|---|---|---|
| A1 | Carrera *Aplicar pago* ↔ traspaso: `FOR UPDATE` de v1 no protege (`aplicarPago` calcula montos en JS y el RPC salta partidas ya pagadas pero marca el movimiento como aplicado) | **D9**: `arre_aplicar_pago_atomico` (candado + montos esperados + `arre_pagos` en la misma transacción). *Vetable por Jereff.* |
| A2 | Fraude con depósitos nunca cobrados (234 depósitos, 1 con `fecPago`, en 0; control = una casilla) | **D11**: nota obligatoria, orígenes acotados en servidor, doble permiso 23+25, auditoría. Segundo aprobador: **decisión abierta** (§9 de `00`). |
| A3/A4/B1 | Reversa por foto `pm2Antes` rompe destinos con varios traspasos; un traspaso total no se podía revertir | **D8**: reversa aditiva `pm2 += T`, por fila; `marcoPagada`; reglas de orden inverso. |
| A5/B3 | Eliminar el plan origen/destino deja traspasos huérfanos o filtra error crudo | **D2** FK `RESTRICT` + **D13** `PLAN_CON_TRASPASOS` (incluye filas revertidas). |
| B2/C2 | La cadena 2023→2025→2026 rompe el disponible | **D5**: `cantidad + Σ recibidos − Σ emitidos`. |
| B4 | `v2_arrepdpdetalle_cambiar_moneda` re-etiqueta MXN→USD sin convertir | **D13**: `TRASPASO_APLICADO` (chequeo en API; sin tocar el RPC). |
| C1 | El origen seguiría «por cobrar» en Aplicar pago y cobranza | **D6**: `pagos()` (único consumidor de `pagos_arrendatarios`) lo omite. |
| C3 | Regla de fechas débil; planes duplicados | **D7** `COALESCE(fecCancelacion,fecFin) < fecInicio destino` + «no duplicado» (`00` §10 #8). |
| C4 | *Renovar* solo conocía el plan renovado (complemento 263,642.07 en vez de 26,639.11) | **D1**: candidatos incluyen **naves hermanas** y se muestra el complemento resultante. |

## 2. Hallazgos MEDIA/BAJA relevantes (todos con disposición)

Permiso 25 también en Renovar (**D11**) · `PATCH detalle` edita el depósito con permiso de solo *ver* (guarda **D13** solo cuando hay traspasos) · idempotencia (**D15**) · varios orígenes todo-o-nada con locks ordenados (**D9**) · actor
perdible en la auditoría → `auth.uid()` (**D10**) · captura con 2 decimales rechaza 237,002.955 → **la persona elige
orígenes, no teclea montos** (**D3**) · moneda `''`/`'null'` y `constM2≠1` (**D7**, 25 y 1 casos) · modal de Renovar
pierde el aviso de fallo → estado de resultado + Reintentar (**D12**) · estado de cuenta incoherente (**D14**) ·
localizar depósito por `numPartida` y no por sufijo `_DEP` (33 casos).

## 3. Verificado OK por los revisores

Aritmética de Deumex exacta en `numeric` (474,005.91 → 26,639.11) · no hay IDOR entre tenants en `PermisoGuard` ·
KPIs del dashboard y *Aplicar pago* cuadran con la reducción de `pm2` (pendiente baja, «cobrado» no se infla) ·
cancelación anticipada e INPC no tocan la partida 0 · ningún cron ni trigger toca `pm2`/`fecPago` del depósito ·
**«lo que ya existe no se mueve» se cumple**: el único escritor es la función del traspaso, disparada por una
persona; la migración es solo CREATE.

## 4. Redacción (Nicanor) y verificación de Toribio

Nicanor redactó `01`–`06` y verificó `05` contra la BD (solo SELECT). Sus 11 objeciones están resueltas en `00` §10.
Toribio revisó el SQL de `05`: bloqueo ordenado, `RAISE` con rollback del bloque, idempotencia con
`unique_violation`, reversa aditiva con candados de orden, auditoría y `REVOKE`/`GRANT` son coherentes con D1–D17.
**Es una revisión de lectura, no una ejecución.**

## 5. Pendiente antes de construir / aplicar (ronda 2)

1. **Visto bueno de Jereff** al texto y al wireframe (`mockup.html`; excepción «continúa sin Pencil», 2026-10-20). Al dibujarlo apareció una
   regla nueva (`INCLUIDO_EN_SIGUIENTE`, `00` §10 #12) que **ajusta el SQL de `05`** y entra en la ronda 2.
2. **Compilar y ejercitar el SQL en una BD desechable** (rama Supabase o Postgres local): sintaxis plpgsql, `jsonb_to_recordset`,
   `lock_timeout`, concurrencia con dos sesiones.
3. **Barrer las 10 consolidaciones multinave restantes** con la regla de hermanas/no-duplicado.
4. **Validador Opus (ronda 2)** sobre el SQL compilado y las pruebas (hallazgo ALTA = no se cierra).
5. **Autorización explícita de Jereff con el SQL exacto** (regla 1 de `contexto.md`).
