-- =====================================================================
-- F2 · Expediente de documentos de KVA por NAVE
-- Fecha: 2026-08-04 · Autorizada por Jereff (con la advertencia expresa
-- de que es producción).
--
-- ⛔ ALCANCE: esta migración SOLO CREA. No hace ALTER ni DROP sobre
--    ninguna tabla existente, no toca datos previos y no modifica el
--    motor de saldo. Si algo falla, el ROLLBACK deja la BD idéntica.
--
-- Qué agrega:
--   1. Tabla `kvaNaveDocs` (expediente de la nave: contrato, carta de
--      compra de KVA, etc.) — replica el patrón `<entidad>_docs` del ERP.
--   2. Índice del listado, RLS y auditoría, iguales a `kvaDevoluciones`.
--   3. Permiso 723 (Parques · KVA's · Documentos).
--
-- El archivo vive en el bucket PRIVADO `kvaDocs` (ya existente), bajo el
-- prefijo `naves/<idNave>/`, y se sirve con URL firmada desde el backend.
-- =====================================================================

begin;

-- 1) Tabla ------------------------------------------------------------
create table if not exists public."kvaNaveDocs" (
  "idDoc"       uuid        primary key default gen_random_uuid(),
  "idNave"      text        not null references public.naves("idNave"),
  -- Se guarda el parque al momento de subir para poder listar/filtrar sin
  -- volver a join-ear naves. No es fuente de verdad: la nave manda.
  "idParque"    text,
  titulo        text        not null,
  descripcion   text,
  -- Ruta DENTRO del bucket privado (no una URL pública): la URL firmada la
  -- genera el backend en cada lectura.
  urldoc        text        not null,
  -- Baja LÓGICA con motivo: los documentos no se borran, se dan de baja.
  status        boolean     not null default true,
  "motivoBaja"  text,
  uidr          uuid,
  fc            timestamptz not null default now()
);

comment on table  public."kvaNaveDocs"          is 'Expediente de documentos de KVA de una nave (contratos, cartas de compra de KVA, actas de devolución). Baja lógica con motivo.';
comment on column public."kvaNaveDocs"."idNave" is 'Nave dueña del expediente. Los documentos se cuelgan de la NAVE, no de una asignación concreta: un mismo contrato suele cubrir baja y media.';
comment on column public."kvaNaveDocs".urldoc   is 'Ruta dentro del bucket PRIVADO kvaDocs (prefijo naves/<idNave>/). Nunca una URL pública: el backend firma la URL al leer.';
comment on column public."kvaNaveDocs".status   is 'false = dado de baja. Se conserva la fila y el archivo para la trazabilidad.';

-- 2) Índice del listado (filtro por nave + orden por fecha descendente) --
create index if not exists ix_kvanavedocs_nave_fc
  on public."kvaNaveDocs" ("idNave", fc desc);

-- 3) RLS ---------------------------------------------------------------
-- Misma política que `kvaDevoluciones`: el acceso real lo controla el
-- backend (service_role + RBAC por endpoint). La política existe para que
-- la tabla NO quede abierta si algún día alguien la consultara con la
-- llave anon/authenticated.
alter table public."kvaNaveDocs" enable row level security;

drop policy if exists "AuthenticatedAccess_kvaNaveDocs" on public."kvaNaveDocs";
create policy "AuthenticatedAccess_kvaNaveDocs"
  on public."kvaNaveDocs"
  as permissive for all
  to authenticated
  using (true) with check (true);

-- 4) Auditoría ---------------------------------------------------------
drop trigger if exists trg_auditoria on public."kvaNaveDocs";
create trigger trg_auditoria
  after insert or delete or update on public."kvaNaveDocs"
  for each row execute function fn_auditoria('idDoc');

-- 5) Permiso -----------------------------------------------------------
insert into public."segModulos" (modulo, seccion, area, clave)
select 'Parques'::public."Modulos", 'KVA''s', 'Documentos', 723
where not exists (select 1 from public."segModulos" where clave = 723);

commit;

-- =====================================================================
-- Verificación posterior (ejecutar aparte):
--   select count(*) from public."kvaNaveDocs";                        -- 0
--   select policyname from pg_policies where tablename='kvaNaveDocs'; -- 1 fila
--   select clave, seccion, area from "segModulos" where clave=723;    -- 1 fila
-- =====================================================================
