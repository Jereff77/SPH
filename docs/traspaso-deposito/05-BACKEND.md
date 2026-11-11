# 05 — Backend (BD) verificado + borrador de migración

> Anclado a `00 v2`. Verificado el **2026-10-20** contra producción (proyecto SPH) con **solo `SELECT`** vía
> `mcp__supaSPH__execute_sql`. PostgreSQL **15.14**. El SQL de abajo es el **FINAL probado** en una BD desechable (Postgres 15 local, datos sintéticos; 303 comprobaciones SQL, 18 casos de
> concurrencia real y el fuzz del validador, todo en verde; informe en `temp/traspaso-deposito/test/resultados.md`, SQL idéntico en `…/test/migracion-final.sql`,
> SHA-256 `2cbb1c7eda734a524658bc8fa9c37a411217c3c0b6b998faacd1c3fb4c1f1c2c`) y **nunca se ha ejecutado en producción**.

## 1. Lo verificado (nombres y tipos reales)

| Objeto | Hecho verificado |
|---|---|
| `arrePdp` | PK `idArrePdp text`; `idArrendador text NOT NULL` → FK `inversionista(idInversionista)`; `idNavArrend text NOT NULL` → FK `arrenPropiedades` **ON DELETE CASCADE**; `fecInicio date`; `fecFin date` **GENERADA** (`fecInicio + plazo meses − 1 día`); `fecCancelacion date`; `deposito double precision`; `"Moneda" text NOT NULL`; `status boolean`. |
| `arrePdpDetalle` | PK `idArrePdpDet text`; FK `idArrePdp` → `arrePdp` **ON DELETE CASCADE**; `numPartida int`; `concepto text`; `pm2 numeric(15,8) NOT NULL`; `"constM2" numeric(15,8)`; `cantidad numeric` **GENERADA** (`pm2 × constM2`); `iva numeric`; `"fecPago" date`; `"uidPago" uuid`; `"cantidadAplicada" double precision` (default 0); `moneda text NOT NULL`; `status boolean`. |
| Depósitos (`numPartida=0`) | 234 partidas, **exactamente 1 por plan**; 201 con id `<plan>_DEP`, **33 no** → localizar por `numPartida=0` + concepto `deposito%garantia%` (sin acentos/mayúsculas, igual que `trg_v2_iva_*`). `moneda`: MXN 197 · `''` 16 · `'null'` 9 · USD 12. `constM2 ≠ 1`: 1 (`vjFS0eM0idFrJKD`). 5 con `anio=1`. 21 planes con `cantidad ≠ deposito`. Hasta 4 decimales (`pm2` numeric lo guarda exacto). |
| Triggers en `arrePdpDetalle` | `trg_auditoria` · `trg_v2_iva_ins` · `trg_v2_iva_upd` (**BEFORE UPDATE OF pm2, constM2, concepto** → `iva=0` en depósitos: nuestro `UPDATE pm2` lo dispara y es inocuo). |
| `arre_pagos` | PK `id uuid`; `idArrePdpDet text NOT NULL`, `idmov text NOT NULL`, `"uidPago" uuid NOT NULL`, `monto double precision NOT NULL`, `"fecPago" date NOT NULL`, `uid text`, `estado` CHECK (`aplicado`/`desaplicado`). **Sin FKs.** Índice único parcial `arre_pagos_partida_activa_idx ("idArrePdpDet") WHERE estado='aplicado'`; índices en `idmov`, `uidPago`. RLS con 1 política y *grants* amplios (deuda ajena, no se replica). |
| `inversionista` | PK `"idInversionista" text`; `razonsocial`, `nombre`, `apellido1`, `apellido2`; `arrendatario`, `"usuarioFinal"`, `pruebas` boolean. `arrePdp.idArrendador` = `idInversionista`. |
| `movbancarios` | PK `idmov text`; `importe double precision`; `aplicado boolean NOT NULL`; `moneda text`. |
| `catUsers` | PK `uid` (`users_pkey`) → destino de las FK de actor. |
| **`fn_auditoria`** | `SECURITY DEFINER`, `search_path=public`. Toma el actor de `current_setting('request.jwt.claims')->>'sub'` (columna `auditoria.uid text`); `role=service_role` ⇒ `origen=2`; sin JWT ⇒ `origen=3`; **traga cualquier error** (`EXCEPTION WHEN OTHERS`). Evidencia (60 días, `arrePdp`): origen 2 = 251 filas, 0 sin uid; origen 3 = 1,034 filas sin uid (crons/directo). |
| `auth.uid()` | `coalesce(claim.sub, claims->>'sub')::uuid`; `EXECUTE` y `USAGE` del esquema `auth` concedidos a `service_role`. |
| *Default privileges* `public` | Tablas nuevas: `arwdDxt` a `anon`, `authenticated`, `service_role`. Funciones nuevas: `EXECUTE` a `anon`, `authenticated`, `service_role` y `PUBLIC` ⇒ el `REVOKE` explícito es **obligatorio**. |
| `aplicar_pago_arrendatario` | `SECURITY DEFINER` sin `search_path`, ejecutable por `anon`; actualiza `fecPago`/`uidPago`/`cantidadAplicada` (`WHERE fecPago IS NULL`, sin contar filas) y **siempre** marca `movbancarios.aplicado=true`. **No se modifica.** |
| `pagos_arrendatarios` | Solo la llama `CobranzaService.pagos()` (único punto), que alimenta `cobranza/pagos` (dashboard) y `cobranza/partidas-pendientes` (*Aplicar pago*) → D6 se resuelve en una sola capa. |
| Consumidores del `pm2` del depósito | `arrepdpdetalle_actualizar_campo_manual` rechaza `anio_desde<=0` (depósito `anio=0` a salvo; 5 con `anio=1` no); `v2_arrepdpdetalle_cambiar_moneda` admite `anio=0` (guarda D13); INPC y `cancelar_anticipado` no tocan la partida 0; `arrepdp_eliminar_plan_con_restricciones` hace `DELETE` físico y devuelve `SQLERRM` en `ERROR_GENERAL`. |
| Candidatos Deumex | La regla (misma nave o hermana que termina el día anterior; fin < inicio destino; sin duplicados) probada con `SELECT` devuelve **exactamente 3**: A 2023 (218,283.70), A 2025 y B 2025 (237,002.955 c/u). |

## 2. Diseño de las funciones (resumen)

Todas `SECURITY INVOKER`, `SET search_path = public, pg_temp`, `EXECUTE` solo a `service_role`, **actor =
`auth.uid()`** (sin `p_uid`; `SIN_ACTOR` si es NULL). Errores de negocio: `RAISE … USING ERRCODE='SPH01'`
(deshace todo el bloque) que el manejador convierte en `{exito:false, codigo, mensaje, detalles}`; imprevistos →
`ERROR_INTERNO` (el `detalles.detalle` es **solo para el log**; la API nunca lo reenvía, regla 4b).

- `arre_traspaso_candidatos` (**4.ª función, solo lectura**; ver Objeciones): fuente única de las reglas D1/D7 para
  la lista de la UI y para `arre_traspasar_deposito`. Una fila por plan. Motivos de `bloqueo`, evaluados **en este orden**:
  `INCLUIDO_EN_SIGUIENTE` (el sucesor de la nave carga depósito) · `SUCESOR_SIN_DEPOSITO` (el sucesor tiene depósito total 0: cantidad + recibido = 0 y depósito del plan = 0; no se desbloquea) ·
  `DEPOSITO_AMBIGUO` · `MONEDA_DISTINTA` · `DEPOSITO_NO_ESTANDAR` · `DEPOSITO_EN_CERO` · `YA_TRASPASADO`. En `arre_traspasar_deposito` llegan como `ORIGEN_BLOQUEADO` con `detalles.bloq` = el motivo.
- `arre_traspasar_deposito(destino, orígenes[], fecha, nota, confirmado, clave)`: bloquea en orden de
  `idArrePdpDet`, exige cada origen ∈ candidatos sin bloqueo, `Σ disponible ≤ cantidad destino`, aplica todo o nada.
  Fecha: obligatoria, no futura (hora de México) y `≥ 2020-01-01`. La idempotencia (clave + destino) se chequea **antes y otra vez después del candado**, así que un doble envío concurrente recibe `YA_APLICADO`.
  Un `sub` del JWT que no sea UUID cuenta como `SIN_ACTOR` (en las 3 funciones de escritura).
- `arre_revertir_traspaso(id, motivo)`: reversa aditiva con las reglas de D8.
- `arre_aplicar_pago_atomico(mov, líneas, fecha, uidPago, tolerancia)`: D9. Rechaza con `MONTO_INSUFICIENTE` (detalle: la partida) una línea cuyo `monto` sea menor que su `cantidadEsperada` en más de 1 centavo
  (el margen cubre el redondeo a centavos de la API en depósitos con 3–4 decimales).

Las 3 funciones de escritura llevan `lock_timeout = 3s` (el rol `authenticator` de producción trae `statement_timeout = 8s`: 2 esperas de 3 s caben, de 5 s no) y devuelven `OCUPADO` también ante `deadlock_detected`
(p. ej. cruce con el `DELETE` de un plan); la operación se deshace y se puede reintentar.

## 3. SQL aplicado en producción el 2026-10-21 (migración `2026-10-21-traspaso-deposito.sql`, solo CREATE)

> SQL **final probado** (pegado tal cual de `temp/traspaso-deposito/test/migracion-final.sql`). **Aplicado en producción el 2026-10-21 con autorización de Jereff sobre este SQL exacto** (SHA-256 `ec18366d186f64dad48bb89d9d4d1da6003796fbcc2c66f8092ec6fdca951d36`); verificado con la misma huella md5 de las 4 funciones que en el laboratorio.
> Se debe ejecutar **dentro de una transacción** (el preludio usa `set local`).

```sql
-- =============================================================================
-- Traspaso de depósito de garantía (brief 00 v2.1, docs/traspaso-deposito).
-- SOLO CREATE: tabla nueva + 4 funciones nuevas. Ningún ALTER/UPDATE/INSERT/DELETE sobre
-- tablas existentes; sin backfill ni jobs. Probada en BD desechable (303 comprobaciones y
-- 72 de concurrencia) y revisada por dos validadores. Se aplica SOLO con autorización
-- explícita de Jereff sobre este SQL exacto (regla 1 del proyecto).
-- Rollback: con la tabla vacía, DROP de las 4 funciones y de la tabla; con traspasos
-- aplicados, revertirlos primero uno a uno en orden inverso de seq desde la herramienta.
-- =============================================================================

-- ---------- 0) Preludio (se aplica dentro de la transacción de la migración) ------
-- Las FOREIGN KEY de la tabla nueva añaden triggers internos de integridad referencial
-- en arrePdp, arrePdpDetalle, catUsers e inversionista, y CREATE TABLE ... REFERENCES toma
-- un candado SHARE ROW EXCLUSIVE breve sobre esas cuatro tablas. Si algo las tiene
-- bloqueadas, la migración se aborta en 3 s (y no deja nada a medias) en vez de hacer fila.
set local lock_timeout = '3s';
set local statement_timeout = '30s';

-- ---------- A) Tabla ---------------------------------------------------------
create table public.arre_traspasos_deposito (
  id                   uuid          primary key default gen_random_uuid(),
  seq                  bigint        generated always as identity,   -- orden estricto de aplicación
  "idArrePdpOrigen"    text          not null references public."arrePdp" ("idArrePdp") on delete restrict,
  "idArrePdpDestino"   text          not null references public."arrePdp" ("idArrePdp") on delete restrict,
  "idDetOrigen"        text          not null references public."arrePdpDetalle" ("idArrePdpDet") on delete restrict,
  "idDetDestino"       text          not null references public."arrePdpDetalle" ("idArrePdpDet") on delete restrict,
  "idArrendador"       text          not null references public.inversionista ("idInversionista") on delete restrict,
  moneda               text          not null check (moneda in ('MXN','USD')),
  monto                numeric(15,8) not null check (monto > 0),
  "pm2Antes"           numeric(15,8) not null,                       -- solo auditoría (la reversa NO restaura fotos)
  "marcoPagada"        boolean       not null default false,         -- esta fila dejó el destino en 0 y puso fecPago
  "fecTraspaso"        date          not null,
  nota                 text          not null,
  "confirmadoRecibido" boolean       not null,
  estado               text          not null default 'aplicado' check (estado in ('aplicado','revertido')),
  "claveIdempotencia"  uuid          not null,
  uid                  uuid          not null references public."catUsers" (uid),   -- actor = auth.uid()
  fc                   timestamptz   not null default now(),
  "revertidoPor"       uuid          references public."catUsers" (uid),
  "fecReversion"       timestamptz,
  "motivoReversion"    text,
  constraint arre_traspasos_distintos   check ("idArrePdpOrigen" <> "idArrePdpDestino"),
  constraint arre_traspasos_pm2antes    check ("pm2Antes" >= monto),
  constraint arre_traspasos_nota        check (char_length(btrim(nota)) between 10 and 400),
  constraint arre_traspasos_confirmado  check ("confirmadoRecibido"),
  constraint arre_traspasos_reversion   check (
    (estado = 'aplicado'  and "revertidoPor" is null and "fecReversion" is null and "motivoReversion" is null)
    or (estado = 'revertido' and "revertidoPor" is not null and "fecReversion" is not null
        and char_length(btrim("motivoReversion")) between 5 and 400))
);
-- Idempotencia (D15): una clave por envío; un envío con N orígenes = N filas con la misma clave.
create unique index arre_traspasos_clave_origen_uk on public.arre_traspasos_deposito ("claveIdempotencia", "idArrePdpOrigen");
create index arre_traspasos_destino_idx on public.arre_traspasos_deposito ("idArrePdpDestino", estado);
create index arre_traspasos_origen_idx  on public.arre_traspasos_deposito ("idArrePdpOrigen", estado);
create index arre_traspasos_detorigen_idx on public.arre_traspasos_deposito ("idDetOrigen") where estado = 'aplicado';
-- (idDetDestino/idArrendador sin índice: tabla minúscula y de escritura rara.)

alter table public.arre_traspasos_deposito enable row level security;   -- SIN políticas: solo service_role
revoke all on table public.arre_traspasos_deposito from public, anon, authenticated, service_role;
grant select, insert, update on table public.arre_traspasos_deposito to service_role;   -- nunca DELETE (D2)
-- La secuencia de la columna identity "seq" hereda los default privileges de `public` (rwU a anon/authenticated):
-- el REVOKE de la tabla no la cubre. Solo el backend (service_role) necesita USAGE.
revoke all on sequence public.arre_traspasos_deposito_seq_seq from public, anon, authenticated, service_role;
grant usage on sequence public.arre_traspasos_deposito_seq_seq to service_role;
create trigger trg_auditoria after insert or update or delete on public.arre_traspasos_deposito
  for each row execute function public.fn_auditoria('id');

comment on table public.arre_traspasos_deposito is
  'Traspaso en papel de depósito de garantía entre planes del mismo arrendatario (una fila por par origen→destino). Nunca se borra: la reversa cambia estado. Solo backend (service_role).';
comment on column public.arre_traspasos_deposito."pm2Antes" is 'pm2 de la partida destino antes de este traspaso. Solo auditoría.';
comment on column public.arre_traspasos_deposito."marcoPagada" is 'true si esta fila dejó el destino en 0 y puso fecPago (sin arre_pagos).';

-- ---------- B) Candidatos (solo lectura; fuente única de las reglas D1/D7) ----
create or replace function public.arre_traspaso_candidatos(
  p_id_arrendador      text,
  p_id_nav_arrend      text,
  p_fec_inicio_destino date,
  p_moneda             text,
  p_excluir            text default null
) returns table (
  "idArrePdp" text, "idNavArrend" text, "idArrePdpDet" text,
  "fecInicio" date, "fecFin" date, "finEfectivo" date, "mismaNave" boolean,
  moneda text, cantidad numeric, recibido numeric, emitido numeric, disponible numeric,
  "depositoPlan" numeric, bloqueo text
)
language sql stable
set search_path = public, pg_temp
as $fn$
  with dep as (
    select distinct on (p."idArrePdp")                  -- una fila por plan aunque tenga 2 partidas de depósito (n_dep las cuenta)
           p."idArrePdp", p."idNavArrend", p."fecInicio", p."fecFin",
           p.deposito::numeric as dep_plan,
           coalesce(p."fecCancelacion", p."fecFin") as fin_ef,
           d."idArrePdpDet", d.cantidad, d."constM2",
           case when upper(btrim(d.moneda)) in ('MXN','USD') then upper(btrim(d.moneda))
                when upper(btrim(p."Moneda")) in ('MXN','USD') then upper(btrim(p."Moneda")) end as mon,
           count(*) over (partition by p."idArrePdp") as n_dep
      from public."arrePdp" p
      join public."arrePdpDetalle" d
        on d."idArrePdp" = p."idArrePdp" and d."numPartida" = 0 and d.status
       and translate(lower(btrim(coalesce(d.concepto, ''))), 'áéíóú', 'aeiou') like 'deposito%garantia%'
     where p."idArrendador" = p_id_arrendador          -- mismo arrendador (D7), nunca del body
       and p.status
       and p."idArrePdp" is distinct from p_excluir
     order by p."idArrePdp", d."idArrePdpDet"
  ),
  rec as (select t."idArrePdpDestino" as id, sum(t.monto) as s
            from public.arre_traspasos_deposito t where t.estado = 'aplicado' group by 1),
  emi as (select t."idArrePdpOrigen" as id, sum(t.monto) as s
            from public.arre_traspasos_deposito t where t.estado = 'aplicado' group by 1)
  select x."idArrePdp", x."idNavArrend", x."idArrePdpDet", x."fecInicio", x."fecFin", x.fin_ef,
         (x."idNavArrend" = p_id_nav_arrend),
         x.mon, x.cantidad, coalesce(r.s, 0), coalesce(e.s, 0),
         greatest(x.cantidad + coalesce(r.s, 0) - coalesce(e.s, 0), 0),           -- D5
         x.dep_plan,
         case -- 00 §10 #12: por nave solo el plan terminado más reciente antes del destino es seleccionable.
              -- Si el sucesor de la nave carga depósito => INCLUIDO_EN_SIGUIENTE.
              when exists (select 1 from dep y left join rec ry on ry.id = y."idArrePdp"
                            where y."idNavArrend" = x."idNavArrend" and y."idArrePdp" <> x."idArrePdp"
                              and y."fecInicio" > x."fecInicio" and y.fin_ef < p_fec_inicio_destino
                              and (y.cantidad + coalesce(ry.s, 0) > 0 or coalesce(y.dep_plan, 0) > 0))
                                                                         then 'INCLUIDO_EN_SIGUIENTE'
              -- Si el sucesor tiene depósito TOTAL en 0 (cantidad + recibido = 0 y depósito del plan = 0): probablemente
              -- se consolidó en otra nave del mismo arrendatario. No se desbloquea; se avisa con un motivo propio.
              when exists (select 1 from dep y
                            where y."idNavArrend" = x."idNavArrend" and y."idArrePdp" <> x."idArrePdp"
                              and y."fecInicio" > x."fecInicio" and y.fin_ef < p_fec_inicio_destino)
                                                                         then 'SUCESOR_SIN_DEPOSITO'
              when x.n_dep <> 1                                          then 'DEPOSITO_AMBIGUO'
              when x.mon is null or x.mon is distinct from upper(p_moneda) then 'MONEDA_DISTINTA'
              when x."constM2" is distinct from 1                        then 'DEPOSITO_NO_ESTANDAR'
              when x.cantidad + coalesce(r.s, 0) <= 0                    then 'DEPOSITO_EN_CERO'
              when x.cantidad + coalesce(r.s, 0) - coalesce(e.s, 0) <= 0 then 'YA_TRASPASADO'
         end
    from dep x
    left join rec r on r.id = x."idArrePdp"
    left join emi e on e.id = x."idArrePdp"
   where x."fecInicio" is not null and x.fin_ef is not null
     and x."fecInicio" < p_fec_inicio_destino and x.fin_ef < p_fec_inicio_destino      -- D7: terminó antes
     and (x."idNavArrend" = p_id_nav_arrend                                            -- D1(a) misma nave
          or x.fin_ef = p_fec_inicio_destino - 1)                                      -- D1(b) hermana: fin = día anterior
     and not exists (                                   -- "no duplicado": otro plan VINCULADO de la misma nave que lo contiene
           select 1
             from public."arrenPropiedades" pr
             join public."arrePdp" q on q."idArrePdp" = pr."idArrePdp" and q.status
            where pr."idNavArrend" = x."idNavArrend" and pr.status
              and q."idArrePdp" <> x."idArrePdp"
              and q."fecInicio" <= x."fecInicio" and q."fecFin" >= x."fecFin")
     and (x.cantidad + coalesce(r.s, 0) > 0 or coalesce(x.dep_plan, 0) > 0 or coalesce(e.s, 0) > 0)
   order by x."fecInicio" desc, x."idArrePdp";
$fn$;

-- ---------- C) Traspasar (D3, D4, D5, D7, D9, D10, D15) ------------------------
create or replace function public.arre_traspasar_deposito(
  p_id_destino         text,
  p_origenes           text[],
  p_fec_traspaso       date,
  p_nota               text,
  p_confirmado         boolean,
  p_clave_idempotencia uuid
) returns jsonb
language plpgsql
set search_path = public, pg_temp
set lock_timeout = '3s'
as $fn$
declare
  v_actor  uuid;                -- se asigna dentro del bloque (un `sub` que no sea UUID no debe escapar del manejador)
  v_hoy    date    := (now() at time zone 'America/Mexico_City')::date;
  v_nota   text    := btrim(coalesce(p_nota, ''));
  v_dest   record;
  v_dd     record;            -- partida de depósito del destino
  v_mon    text;              -- moneda efectiva del destino
  v_orig   jsonb;             -- candidatos pedidos (foto única, antes de escribir)
  v_bloq   jsonb;
  v_cand   record;
  v_n      integer;
  v_total  numeric := 0;
  v_pm2    numeric;
  v_resta  numeric;
  v_marco  boolean;
  v_id     uuid;
  v_filas  jsonb   := '[]'::jsonb;
  v_pagada boolean := false;
  v_codigo text;
  v_msg    text;
  v_det    text;
begin
  -- 0) actor y parámetros
  begin
    v_actor := auth.uid();
  exception when invalid_text_representation then
    v_actor := null;            -- `sub` que no es UUID => se trata como petición sin actor
  end;
  if v_actor is null then
    raise exception 'SIN_ACTOR' using errcode = 'SPH01', hint = 'auth.uid() es NULL: la petición no trae JWT con sub.';
  end if;
  if p_confirmado is distinct from true then
    raise exception 'CONFIRMACION_REQUERIDA' using errcode = 'SPH01', hint = 'Falta confirmar que el depósito anterior fue recibido.';
  end if;
  if p_clave_idempotencia is null or p_id_destino is null or btrim(p_id_destino) = ''
     or p_origenes is null or cardinality(p_origenes) not between 1 and 10
     or exists (select 1 from unnest(p_origenes) o where o is null or btrim(o) = '')
     or (select count(distinct o) from unnest(p_origenes) o) <> cardinality(p_origenes) then
    raise exception 'PARAMETRO_INVALIDO' using errcode = 'SPH01', hint = 'Destino, orígenes (1 a 10, sin repetir) y clave son obligatorios.';
  end if;
  if p_id_destino = any (p_origenes) then
    raise exception 'ORIGEN_ES_DESTINO' using errcode = 'SPH01', hint = 'Un plan no puede traspasarse a sí mismo.';
  end if;
  if char_length(v_nota) not between 10 and 400 then
    raise exception 'NOTA_INVALIDA' using errcode = 'SPH01', hint = 'La nota debe tener entre 10 y 400 caracteres.';
  end if;
  if p_fec_traspaso is null or p_fec_traspaso > v_hoy or p_fec_traspaso < date '2020-01-01' then
    raise exception 'FECHA_INVALIDA' using errcode = 'SPH01', hint = 'La fecha del traspaso es obligatoria, no puede ser futura ni anterior al 2020-01-01.';
  end if;

  -- 1) idempotencia (D15): mismo envío ya aplicado => devolver lo aplicado
  select count(*), coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'idArrePdpOrigen', t."idArrePdpOrigen",
                                                         'monto', t.monto) order by t.seq), '[]'::jsonb)
    into v_n, v_filas
    from public.arre_traspasos_deposito t
   where t."claveIdempotencia" = p_clave_idempotencia and t."idArrePdpDestino" = p_id_destino;
  if v_n > 0 then
    return jsonb_build_object('exito', true, 'codigo', 'YA_APLICADO', 'mensaje', 'Este traspaso ya estaba registrado.',
             'detalles', jsonb_build_object('idDestino', p_id_destino, 'traspasos', v_filas));
  end if;

  -- 2) destino y bloqueo determinista de TODAS las partidas de depósito (D9; mismo orden que aplicar_pago_atomico)
  select p."idArrePdp", p."idArrendador", p."idNavArrend", p."fecInicio", p."Moneda"
    into v_dest from public."arrePdp" p where p."idArrePdp" = p_id_destino and p.status;
  if not found then
    raise exception 'DESTINO_NO_ENCONTRADO' using errcode = 'SPH01', hint = 'El plan destino no existe o está dado de baja.';
  end if;
  if v_dest."fecInicio" is null then
    raise exception 'FECHAS_INVALIDAS' using errcode = 'SPH01', hint = 'El plan destino no tiene fecha de inicio.';
  end if;

  perform 1
     from public."arrePdpDetalle" d
    where d."idArrePdp" = any (array_append(p_origenes, p_id_destino))
      and d."numPartida" = 0 and d.status
      and translate(lower(btrim(coalesce(d.concepto, ''))), 'áéíóú', 'aeiou') like 'deposito%garantia%'
    order by d."idArrePdpDet"
      for update;

  -- 2b) idempotencia (D15) otra vez, YA bajo candado: un doble envío concurrente con la misma clave espera aquí
  --     y, al entrar, ve lo que la otra sesión confirmó => YA_APLICADO (no un error de origen bloqueado/destino pagado).
  select count(*), coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'idArrePdpOrigen', t."idArrePdpOrigen",
                                                         'monto', t.monto) order by t.seq), '[]'::jsonb)
    into v_n, v_filas
    from public.arre_traspasos_deposito t
   where t."claveIdempotencia" = p_clave_idempotencia and t."idArrePdpDestino" = p_id_destino;
  if v_n > 0 then
    return jsonb_build_object('exito', true, 'codigo', 'YA_APLICADO', 'mensaje', 'Este traspaso ya estaba registrado.',
             'detalles', jsonb_build_object('idDestino', p_id_destino, 'traspasos', v_filas));
  end if;

  -- 3) partida destino (después del bloqueo)
  select count(*) into v_n
    from public."arrePdpDetalle" d
   where d."idArrePdp" = p_id_destino and d."numPartida" = 0 and d.status
     and translate(lower(btrim(coalesce(d.concepto, ''))), 'áéíóú', 'aeiou') like 'deposito%garantia%';
  if v_n <> 1 then
    raise exception 'DEPOSITO_DESTINO_INVALIDO' using errcode = 'SPH01',
      hint = 'El plan destino debe tener exactamente una partida de depósito.';
  end if;
  select d."idArrePdpDet", d.pm2, d."constM2", d.cantidad, d."fecPago", d.moneda
    into v_dd
    from public."arrePdpDetalle" d
   where d."idArrePdp" = p_id_destino and d."numPartida" = 0 and d.status
     and translate(lower(btrim(coalesce(d.concepto, ''))), 'áéíóú', 'aeiou') like 'deposito%garantia%';

  v_mon := case when upper(btrim(v_dd.moneda)) in ('MXN','USD') then upper(btrim(v_dd.moneda))
                when upper(btrim(v_dest."Moneda")) in ('MXN','USD') then upper(btrim(v_dest."Moneda")) end;
  if v_mon is null then
    raise exception 'MONEDA_INVALIDA' using errcode = 'SPH01', hint = 'El depósito destino no tiene moneda válida (ni el plan).';
  end if;
  if v_dd."constM2" is distinct from 1 then
    raise exception 'DEPOSITO_NO_ESTANDAR' using errcode = 'SPH01', hint = 'El depósito destino no tiene constM2 = 1.';
  end if;
  if v_dd."fecPago" is not null
     or exists (select 1 from public.arre_pagos ap where ap."idArrePdpDet" = v_dd."idArrePdpDet" and ap.estado = 'aplicado') then
    raise exception 'DESTINO_PAGADO' using errcode = 'SPH01', hint = 'El depósito destino ya tiene pago aplicado.';
  end if;
  if v_dd.cantidad is null or v_dd.cantidad <= 0 then
    raise exception 'DESTINO_SIN_SALDO' using errcode = 'SPH01', hint = 'El depósito destino ya está en 0.';
  end if;

  -- 4) orígenes: deben ser candidatos del destino (mismo arrendador, D1, fechas, moneda) y sin bloqueo
  select coalesce(jsonb_agg(jsonb_build_object('id', c."idArrePdp", 'det', c."idArrePdpDet", 'disp', c.disponible,
                                               'cant', c.cantidad, 'depPlan', c."depositoPlan", 'bloq', c.bloqueo)
                            order by array_position(p_origenes, c."idArrePdp")), '[]'::jsonb)
    into v_orig
    from public.arre_traspaso_candidatos(v_dest."idArrendador", v_dest."idNavArrend", v_dest."fecInicio",
                                         v_mon, p_id_destino) c
   where c."idArrePdp" = any (p_origenes);
  if jsonb_array_length(v_orig) <> cardinality(p_origenes) then
    raise exception 'ORIGEN_NO_VALIDO' using errcode = 'SPH01',
      hint = 'Algún origen no es candidato válido de este destino (otro arrendatario, contrato vigente o no relacionado).';
  end if;
  select x into v_bloq from jsonb_array_elements(v_orig) as x where x ->> 'bloq' is not null limit 1;
  if v_bloq is not null then
    raise exception 'ORIGEN_BLOQUEADO' using errcode = 'SPH01', hint = 'Un origen tiene bloqueo.', detail = v_bloq::text;
  end if;
  select coalesce(sum((x ->> 'disp')::numeric), 0) into v_total from jsonb_array_elements(v_orig) as x;
  if v_total > v_dd.cantidad then      -- D3: nunca se traspasa más que el depósito nuevo (sin excedente en v1)
    raise exception 'EXCEDE_DESTINO' using errcode = 'SPH01', hint = 'Lo traspasable supera el depósito destino.',
      detail = jsonb_build_object('total', v_total, 'cantidadDestino', v_dd.cantidad)::text;
  end if;

  -- 5) aplicar (todo o nada: cualquier RAISE posterior deshace el bloque completo)
  v_pm2 := v_dd.pm2;
  for v_cand in
    select x ->> 'id' as id, x ->> 'det' as det, (x ->> 'disp')::numeric as disp
      from jsonb_array_elements(v_orig) as x
  loop
    v_resta := v_pm2 - v_cand.disp;
    v_marco := (v_resta = 0);
    update public."arrePdpDetalle"
       set pm2 = v_resta,                                                        -- cantidad baja sola (constM2 = 1)
           "fecPago" = case when v_marco then p_fec_traspaso else "fecPago" end, -- D4
           "cantidadAplicada" = case when v_marco then 0 else "cantidadAplicada" end
     where "idArrePdpDet" = v_dd."idArrePdpDet";
    insert into public.arre_traspasos_deposito
      ("idArrePdpOrigen", "idArrePdpDestino", "idDetOrigen", "idDetDestino", "idArrendador", moneda, monto,
       "pm2Antes", "marcoPagada", "fecTraspaso", nota, "confirmadoRecibido", "claveIdempotencia", uid)
    values
      (v_cand.id, p_id_destino, v_cand.det, v_dd."idArrePdpDet", v_dest."idArrendador", v_mon, v_cand.disp,
       v_pm2, v_marco, p_fec_traspaso, v_nota, true, p_clave_idempotencia, v_actor)
    returning id into v_id;
    v_filas  := v_filas || jsonb_build_object('id', v_id, 'idArrePdpOrigen', v_cand.id, 'monto', v_cand.disp);
    v_pm2    := v_resta;
    v_pagada := v_pagada or v_marco;
  end loop;

  return jsonb_build_object('exito', true, 'codigo', 'EXITO', 'mensaje', 'Depósito traspasado.',
           'detalles', jsonb_build_object('idDestino', p_id_destino, 'total', v_total, 'cantidadRestante', v_pm2,
                                          'pagadaPorTraspaso', v_pagada, 'traspasos', v_filas));
exception
  when sqlstate 'SPH01' then
    get stacked diagnostics v_codigo = message_text, v_msg = pg_exception_hint, v_det = pg_exception_detail;
    return jsonb_build_object('exito', false, 'codigo', v_codigo, 'mensaje', v_msg,
                              'detalles', coalesce(nullif(v_det, '')::jsonb, '{}'::jsonb));
  when lock_not_available then
    return jsonb_build_object('exito', false, 'codigo', 'OCUPADO', 'mensaje', 'Otro usuario está modificando este depósito.');
  when deadlock_detected then         -- p. ej. cruce con un DELETE de plan (FK): se deshace esta operación; se puede reintentar
    return jsonb_build_object('exito', false, 'codigo', 'OCUPADO', 'mensaje', 'Otro usuario está modificando este depósito.');
  when unique_violation then          -- dos envíos simultáneos con la misma clave
    select count(*), coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'idArrePdpOrigen', t."idArrePdpOrigen",
                                                           'monto', t.monto) order by t.seq), '[]'::jsonb)
      into v_n, v_filas
      from public.arre_traspasos_deposito t
     where t."claveIdempotencia" = p_clave_idempotencia and t."idArrePdpDestino" = p_id_destino;
    if v_n > 0 then
      return jsonb_build_object('exito', true, 'codigo', 'YA_APLICADO', 'mensaje', 'Este traspaso ya estaba registrado.',
               'detalles', jsonb_build_object('idDestino', p_id_destino, 'traspasos', v_filas));
    end if;
    return jsonb_build_object('exito', false, 'codigo', 'ERROR_INTERNO', 'mensaje', 'Error interno.',
                              'detalles', jsonb_build_object('sqlstate', '23505'));
  when others then
    get stacked diagnostics v_msg = message_text;
    return jsonb_build_object('exito', false, 'codigo', 'ERROR_INTERNO', 'mensaje', 'Error interno.',
                              'detalles', jsonb_build_object('sqlstate', sqlstate, 'detalle', v_msg));  -- SOLO log
end;
$fn$;

-- ---------- D) Revertir (D8: aditiva, por fila) --------------------------------
create or replace function public.arre_revertir_traspaso(p_id_traspaso uuid, p_motivo text)
returns jsonb
language plpgsql
set search_path = public, pg_temp
set lock_timeout = '3s'
as $fn$
declare
  v_actor  uuid;                -- se asigna dentro del bloque (un `sub` que no sea UUID no debe escapar del manejador)
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_t      public.arre_traspasos_deposito%rowtype;
  v_d      record;
  v_max    numeric;
  v_codigo text;
  v_msg    text;
  v_det    text;
begin
  begin
    v_actor := auth.uid();
  exception when invalid_text_representation then
    v_actor := null;            -- `sub` que no es UUID => se trata como petición sin actor
  end;
  if v_actor is null then
    raise exception 'SIN_ACTOR' using errcode = 'SPH01', hint = 'auth.uid() es NULL.';
  end if;
  if p_id_traspaso is null then
    raise exception 'PARAMETRO_INVALIDO' using errcode = 'SPH01', hint = 'Falta el traspaso.';
  end if;
  if char_length(v_motivo) not between 5 and 400 then
    raise exception 'MOTIVO_INVALIDO' using errcode = 'SPH01', hint = 'El motivo debe tener entre 5 y 400 caracteres.';
  end if;

  select * into v_t from public.arre_traspasos_deposito where id = p_id_traspaso;       -- solo para conocer las partidas
  if not found then
    raise exception 'TRASPASO_NO_ENCONTRADO' using errcode = 'SPH01', hint = 'No existe ese traspaso.';
  end if;

  perform 1 from public."arrePdpDetalle" d                                              -- mismo orden que traspasar
   where d."idArrePdpDet" in (v_t."idDetOrigen", v_t."idDetDestino")
   order by d."idArrePdpDet" for update;
  select * into v_t from public.arre_traspasos_deposito where id = p_id_traspaso for update;
  if v_t.estado <> 'aplicado' then
    raise exception 'YA_REVERTIDO' using errcode = 'SPH01', hint = 'Ese traspaso ya fue revertido.';
  end if;

  -- D8: el destino ya emitió traspasos aplicados => revertir primero esos (orden inverso)
  if exists (select 1 from public.arre_traspasos_deposito x
              where x."idArrePdpOrigen" = v_t."idArrePdpDestino" and x.estado = 'aplicado') then
    raise exception 'DESTINO_YA_EMITIO' using errcode = 'SPH01', hint = 'El destino ya traspasó depósito a otro contrato.';
  end if;
  -- otra fila que dejó el destino en 0 (puso fecPago): revertir primero esa
  if not v_t."marcoPagada" and exists (select 1 from public.arre_traspasos_deposito x
              where x."idDetDestino" = v_t."idDetDestino" and x.estado = 'aplicado' and x."marcoPagada" and x.id <> v_t.id) then
    raise exception 'REVERTIR_ANTES_OTRO' using errcode = 'SPH01', hint = 'Hay otro traspaso al mismo destino que lo dejó en 0.';
  end if;

  select d.pm2, d."constM2", d."fecPago", d."uidPago" into v_d
    from public."arrePdpDetalle" d where d."idArrePdpDet" = v_t."idDetDestino";
  if not found then
    raise exception 'ESTADO_INCONSISTENTE' using errcode = 'SPH01', hint = 'La partida destino ya no existe.';
  end if;
  -- pagos reales aplicados (primero Desaplicar pago). "Pagada por traspaso" = fecPago = fecTraspaso, uidPago NULL.
  if exists (select 1 from public.arre_pagos ap where ap."idArrePdpDet" = v_t."idDetDestino" and ap.estado = 'aplicado')
     or (v_d."fecPago" is not null
         and not (v_t."marcoPagada" and v_d."fecPago" = v_t."fecTraspaso" and v_d."uidPago" is null)) then
    raise exception 'PAGO_APLICADO' using errcode = 'SPH01', hint = 'El depósito destino tiene un pago aplicado.';
  end if;
  -- cordura: pm2 + T no puede exceder el mayor pm2 que tuvo la partida antes de un traspaso
  select max("pm2Antes") into v_max from public.arre_traspasos_deposito where "idDetDestino" = v_t."idDetDestino";
  if v_d."constM2" is distinct from 1 or v_d.pm2 + v_t.monto > v_max then
    raise exception 'ESTADO_INCONSISTENTE' using errcode = 'SPH01', hint = 'La partida destino cambió después del traspaso.';
  end if;

  update public."arrePdpDetalle"
     set pm2 = pm2 + v_t.monto,                                                         -- aditiva, nunca una foto
         "fecPago" = case when v_t."marcoPagada" then null else "fecPago" end,
         "cantidadAplicada" = case when v_t."marcoPagada" then 0 else "cantidadAplicada" end
   where "idArrePdpDet" = v_t."idDetDestino";
  update public.arre_traspasos_deposito
     set estado = 'revertido', "revertidoPor" = v_actor, "fecReversion" = now(), "motivoReversion" = v_motivo
   where id = v_t.id;

  return jsonb_build_object('exito', true, 'codigo', 'EXITO', 'mensaje', 'Traspaso revertido.',
           'detalles', jsonb_build_object('id', v_t.id, 'monto', v_t.monto, 'idDestino', v_t."idArrePdpDestino"));
exception
  when sqlstate 'SPH01' then
    get stacked diagnostics v_codigo = message_text, v_msg = pg_exception_hint, v_det = pg_exception_detail;
    return jsonb_build_object('exito', false, 'codigo', v_codigo, 'mensaje', v_msg,
                              'detalles', coalesce(nullif(v_det, '')::jsonb, '{}'::jsonb));
  when lock_not_available then
    return jsonb_build_object('exito', false, 'codigo', 'OCUPADO', 'mensaje', 'Otro usuario está modificando este depósito.');
  when deadlock_detected then
    return jsonb_build_object('exito', false, 'codigo', 'OCUPADO', 'mensaje', 'Otro usuario está modificando este depósito.');
  when others then
    get stacked diagnostics v_msg = message_text;
    return jsonb_build_object('exito', false, 'codigo', 'ERROR_INTERNO', 'mensaje', 'Error interno.',
                              'detalles', jsonb_build_object('sqlstate', sqlstate, 'detalle', v_msg));  -- SOLO log
end;
$fn$;

-- ---------- E) Aplicar pago atómico (D9): misma conducta que hoy + candado y verificación ----
-- p_lineas = [{"idArrePdpDet":"...","cantidadEsperada":"<arrePdpDetalle.cantidad leída>","monto":"<cantidad+IVA>"}]
create or replace function public.arre_aplicar_pago_atomico(
  p_idmov      text,
  p_lineas     jsonb,
  p_fec_pago   date,
  p_uid_pago   uuid,      -- agrupa las filas de arre_pagos (como hoy, lo genera la API)
  p_tolerancia numeric    -- ARRE_TOLERANCIA_PAGO (la API ya lo lee)
) returns jsonb
language plpgsql
set search_path = public, pg_temp
set lock_timeout = '3s'
as $fn$
declare
  v_actor     uuid;                       -- se asigna dentro del bloque (un `sub` que no sea UUID no debe escapar del manejador)
  v_ids       text[];
  v_n         integer;
  v_nd        integer;
  v_l         record;
  v_mov       record;
  v_saldo     numeric;
  v_total     numeric;
  v_rem       numeric;
  v_agotado   boolean;
  v_linea     text;
  v_uid_part  uuid    := gen_random_uuid();   -- como aplicar_pago_arrendatario: uidPago propio de la partida
  v_codigo    text;
  v_msg       text;
  v_det       text;
begin
  begin
    v_actor := auth.uid();
  exception when invalid_text_representation then
    v_actor := null;            -- `sub` que no es UUID => se trata como petición sin actor
  end;
  if v_actor is null then
    raise exception 'SIN_ACTOR' using errcode = 'SPH01', hint = 'auth.uid() es NULL.';
  end if;
  if p_idmov is null or btrim(p_idmov) = '' or p_fec_pago is null or p_uid_pago is null
     or p_tolerancia is null or p_tolerancia < 0
     or p_lineas is null or jsonb_typeof(p_lineas) <> 'array'
     or jsonb_array_length(p_lineas) not between 1 and 500 then
    raise exception 'PARAMETRO_INVALIDO' using errcode = 'SPH01', hint = 'Movimiento, líneas, fecha, clave y tolerancia son obligatorios.';
  end if;
  select array_agg(l."idArrePdpDet" order by l."idArrePdpDet"), count(*), count(distinct l."idArrePdpDet")
    into v_ids, v_n, v_nd
    from jsonb_to_recordset(p_lineas) as l("idArrePdpDet" text, "cantidadEsperada" numeric, monto numeric);
  if v_n <> v_nd or exists (select 1 from jsonb_to_recordset(p_lineas) as l("idArrePdpDet" text, "cantidadEsperada" numeric, monto numeric)
                            where l."idArrePdpDet" is null or l."cantidadEsperada" is null or l.monto is null or l.monto < 0) then
    raise exception 'PARAMETRO_INVALIDO' using errcode = 'SPH01', hint = 'Líneas repetidas o incompletas.';
  end if;
  -- el monto de una línea (cantidad + IVA) no puede ser menor que el importe de la partida que se marca pagada completa.
  -- Margen de 1 centavo: la API redondea el monto a centavos (round(cantidad + iva, 2)) y, con IVA 0 (depósitos) y 3-4 decimales,
  -- ese redondeo puede dejarlo hasta 0.005 por debajo de la cantidad; con un margen menor se rechazarían pagos legítimos.
  select l."idArrePdpDet" into v_linea
    from jsonb_to_recordset(p_lineas) as l("idArrePdpDet" text, "cantidadEsperada" numeric, monto numeric)
   where l.monto < l."cantidadEsperada" - 0.01
   order by l."idArrePdpDet" limit 1;
  if v_linea is not null then
    raise exception 'MONTO_INSUFICIENTE' using errcode = 'SPH01', hint = 'El monto de una partida es menor a su importe.',
      detail = jsonb_build_object('idArrePdpDet', v_linea)::text;
  end if;

  -- 1) bloquear partidas (mismo orden que traspasar) y verificar que siguen igual
  perform 1 from public."arrePdpDetalle" d where d."idArrePdpDet" = any (v_ids) order by d."idArrePdpDet" for update;
  for v_l in
    select l."idArrePdpDet" as id, l."cantidadEsperada" as esperada, d."idArrePdpDet" as existe, d.cantidad, d."fecPago"
      from jsonb_to_recordset(p_lineas) as l("idArrePdpDet" text, "cantidadEsperada" numeric, monto numeric)
      left join public."arrePdpDetalle" d on d."idArrePdpDet" = l."idArrePdpDet"
     order by l."idArrePdpDet"
  loop
    if v_l.existe is null then
      raise exception 'PARTIDA_NO_ENCONTRADA' using errcode = 'SPH01', hint = 'Una partida no existe.';
    end if;
    if v_l."fecPago" is not null then
      raise exception 'PARTIDA_PAGADA' using errcode = 'SPH01', hint = 'Una partida ya estaba pagada.';
    end if;
    if abs(coalesce(v_l.cantidad, 0) - v_l.esperada) > 0.0001 then
      raise exception 'PARTIDA_CAMBIO' using errcode = 'SPH01', hint = 'Una partida cambió desde que se leyó.',
        detail = jsonb_build_object('idArrePdpDet', v_l.id)::text;
    end if;
  end loop;
  if exists (select 1 from public.arre_traspasos_deposito t
              where t.estado = 'aplicado' and t."idDetOrigen" = any (v_ids)) then      -- D6 a prueba de carreras
    raise exception 'DEPOSITO_TRASPASADO' using errcode = 'SPH01', hint = 'Un depósito de garantía seleccionado ya fue traspasado.';
  end if;

  -- 2) movimiento bancario: saldo bajo candado (corrige también dos pagos simultáneos al mismo depósito)
  select m.importe, m.aplicado into v_mov from public.movbancarios m where m.idmov = p_idmov for update;
  if not found then
    raise exception 'MOV_NO_ENCONTRADO' using errcode = 'SPH01', hint = 'El movimiento bancario no existe.';
  end if;
  if v_mov.aplicado then
    raise exception 'MOV_AGOTADO' using errcode = 'SPH01', hint = 'El depósito ya fue aplicado por completo.';
  end if;
  v_saldo := round(coalesce(v_mov.importe, 0)::numeric
                   - coalesce((select sum(ap.monto) from public.arre_pagos ap
                                where ap.idmov = p_idmov and ap.estado = 'aplicado'), 0)::numeric, 2);
  if v_saldo <= 0.005 then
    raise exception 'MOV_SIN_SALDO' using errcode = 'SPH01', hint = 'El depósito ya no tiene saldo disponible.';
  end if;
  select round(sum(l.monto), 2) into v_total
    from jsonb_to_recordset(p_lineas) as l("idArrePdpDet" text, "cantidadEsperada" numeric, monto numeric);
  if v_total <= 0.005 then
    raise exception 'SIN_MONTO' using errcode = 'SPH01', hint = 'Selecciona al menos una partida con monto.';
  end if;
  if v_total - v_saldo > p_tolerancia + 0.0001 then
    raise exception 'SALDO_INSUFICIENTE' using errcode = 'SPH01', hint = 'El total excede el saldo del depósito.',
      detail = jsonb_build_object('total', v_total, 'saldo', v_saldo, 'tolerancia', p_tolerancia)::text;
  end if;

  -- 3) escribir (todo o nada)
  update public."arrePdpDetalle" d
     set "fecPago" = p_fec_pago, "uidPago" = v_uid_part, "cantidadAplicada" = d.cantidad
   where d."idArrePdpDet" = any (v_ids) and d."fecPago" is null;
  get diagnostics v_n = row_count;
  if v_n <> cardinality(v_ids) then
    raise exception 'PARTIDA_CAMBIO' using errcode = 'SPH01', hint = 'No se pudieron marcar todas las partidas.';
  end if;
  insert into public.arre_pagos ("idArrePdpDet", "idArrePdp", "idArrendador", idmov, "uidPago", monto, "fecPago", uid, estado)
  select l."idArrePdpDet", d."idArrePdp", p."idArrendador", p_idmov, p_uid_pago, l.monto, p_fec_pago, v_actor::text, 'aplicado'
    from jsonb_to_recordset(p_lineas) as l("idArrePdpDet" text, "cantidadEsperada" numeric, monto numeric)
    join public."arrePdpDetalle" d on d."idArrePdpDet" = l."idArrePdpDet"
    left join public."arrePdp" p on p."idArrePdp" = d."idArrePdp";
  v_rem     := round(v_saldo - v_total, 2);
  v_agotado := v_rem <= p_tolerancia + 0.0001;
  update public.movbancarios set aplicado = v_agotado where idmov = p_idmov;

  return jsonb_build_object('exito', true, 'codigo', 'EXITO', 'mensaje', 'Pago aplicado.',
           'detalles', jsonb_build_object('importe', v_mov.importe, 'aplicado', v_total,
                         'saldoAFavor', case when v_agotado then 0 else v_rem end,
                         'agotado', v_agotado, 'partidas', cardinality(v_ids)));
exception
  when sqlstate 'SPH01' then
    get stacked diagnostics v_codigo = message_text, v_msg = pg_exception_hint, v_det = pg_exception_detail;
    return jsonb_build_object('exito', false, 'codigo', v_codigo, 'mensaje', v_msg,
                              'detalles', coalesce(nullif(v_det, '')::jsonb, '{}'::jsonb));
  when lock_not_available then
    return jsonb_build_object('exito', false, 'codigo', 'OCUPADO', 'mensaje', 'Otro usuario está aplicando pagos a estas partidas.');
  when deadlock_detected then
    return jsonb_build_object('exito', false, 'codigo', 'OCUPADO', 'mensaje', 'Otro usuario está modificando este depósito.');
  when unique_violation then          -- índice único parcial arre_pagos_partida_activa_idx
    return jsonb_build_object('exito', false, 'codigo', 'PARTIDA_CAMBIO', 'mensaje', 'Una partida ya tiene un pago activo.');
  when others then
    get stacked diagnostics v_msg = message_text;
    return jsonb_build_object('exito', false, 'codigo', 'ERROR_INTERNO', 'mensaje', 'Error interno.',
                              'detalles', jsonb_build_object('sqlstate', sqlstate, 'detalle', v_msg));  -- SOLO log
end;
$fn$;

-- ---------- F) Permisos de las funciones (D10) -----------------------------------
revoke all on function public.arre_traspaso_candidatos(text, text, date, text, text)            from public, anon, authenticated;
revoke all on function public.arre_traspasar_deposito(text, text[], date, text, boolean, uuid)  from public, anon, authenticated;
revoke all on function public.arre_revertir_traspaso(uuid, text)                                from public, anon, authenticated;
revoke all on function public.arre_aplicar_pago_atomico(text, jsonb, date, uuid, numeric)       from public, anon, authenticated;
grant execute on function public.arre_traspaso_candidatos(text, text, date, text, text)            to service_role;
grant execute on function public.arre_traspasar_deposito(text, text[], date, text, boolean, uuid) to service_role;
grant execute on function public.arre_revertir_traspaso(uuid, text)                                to service_role;
grant execute on function public.arre_aplicar_pago_atomico(text, jsonb, date, uuid, numeric)       to service_role;
```

## 4. Verificación posterior a la migración (solo `SELECT`)

```sql
-- 1) EXECUTE: las 4 filas deben ser {postgres=X/postgres,service_role=X/postgres}
select proname, proacl::text from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname in ('arre_traspaso_candidatos','arre_traspasar_deposito','arre_revertir_traspaso','arre_aplicar_pago_atomico');
-- 1b) SECURITY INVOKER (prosecdef=false) y configuración: las 3 de escritura con lock_timeout=3s; las 4 con search_path=public, pg_temp
select proname, prosecdef, proconfig, has_function_privilege('anon', oid, 'execute') as anon_exec,                 -- false
       has_function_privilege('authenticated', oid, 'execute') as auth_exec                                        -- false
  from pg_proc where pronamespace = 'public'::regnamespace
   and proname in ('arre_traspaso_candidatos','arre_traspasar_deposito','arre_revertir_traspaso','arre_aplicar_pago_atomico');
-- 2) la tabla: RLS=true, 0 políticas, sin DELETE para service_role, trigger de auditoría
select c.relrowsecurity, (select count(*) from pg_policy where polrelid = c.oid) as politicas,
       has_table_privilege('anon','public.arre_traspasos_deposito','select') as anon_select,        -- false
       has_table_privilege('authenticated','public.arre_traspasos_deposito','insert') as auth_insert, -- false
       has_table_privilege('service_role','public.arre_traspasos_deposito','delete') as svc_delete,  -- false
       (select string_agg(tgname, ',') from pg_trigger where tgrelid = c.oid and not tgisinternal) as triggers  -- trg_auditoria
  from pg_class c where c.oid = 'public.arre_traspasos_deposito'::regclass;
-- 2b) la secuencia identity de seq: ACL = {postgres=rwU/postgres,service_role=U/postgres}; anon/authenticated sin USAGE
select c.relacl::text as acl_secuencia,
       has_sequence_privilege('anon','public.arre_traspasos_deposito_seq_seq','usage') as anon_usage,                 -- false
       has_sequence_privilege('authenticated','public.arre_traspasos_deposito_seq_seq','usage') as auth_usage,       -- false
       has_sequence_privilege('service_role','public.arre_traspasos_deposito_seq_seq','usage') as svc_usage           -- true
  from pg_class c where c.oid = 'public.arre_traspasos_deposito_seq_seq'::regclass;
-- 3) cero cambios a datos existentes: debe seguir en 0 (y 234 depósitos intactos)
select count(*) from public.arre_traspasos_deposito;
```
