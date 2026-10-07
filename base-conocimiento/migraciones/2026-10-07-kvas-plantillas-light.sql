-- =====================================================================
-- Plantillas de documentos de KVA's · VERSION LIGHT (2026-10-07)
-- Solo plantillas de texto con versionado: crear / guardar (version nueva) /
-- baja logica. SIN campos automaticos, SIN PDF, SIN kvaDocGenerados,
-- SIN tocar kvaNaveDocs. Subconjunto del borrador de
-- docs/plantillas-kvas/05-BACKEND.md.
--
-- ⛔ NO APLICADA. La aplica Toribio/Jereff tras su visto bueno.
-- ⛔ ALCANCE: solo CREA (tablas, funciones, triggers) e inserta 2 permisos
--    (730 ver plantillas, 731 editar plantillas). Ningun ALTER/DROP sobre
--    tablas existentes. Idempotente.
-- Si falla, el ROLLBACK deja la BD identica.
-- =====================================================================
begin;

-- 0) Helpers ----------------------------------------------------------
-- Actor = sub del JWT de la peticion (lo firma el API con comoActor()).
create or replace function public.kva_actor() returns uuid
language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
$$;

create or replace function public.kva_inmutable() returns trigger
language plpgsql as $$
begin
  raise exception 'Los registros de % son inmutables.', tg_table_name using errcode = 'KV423';
end $$;

-- 1) kvaPlantillas — CABECERA (mutable: nombre, version vigente, baja) -
create table if not exists public."kvaPlantillas" (
  "idPlantilla"   uuid        primary key default gen_random_uuid(),
  tipo            text        not null,
  nombre          text        not null,
  descripcion     text,
  "versionActual" integer     not null default 1,
  status          boolean     not null default true,
  "motivoBaja"    text,
  uidr            uuid        not null,
  fc              timestamptz not null default now(),
  "fumUser"       uuid,
  fum             timestamptz,
  constraint kvaplantillas_tipo_chk    check (tipo in ('ASIGNACION_CARGA','DEVOLUCION')),
  constraint kvaplantillas_nombre_chk  check (char_length(btrim(nombre)) between 1 and 120),
  constraint kvaplantillas_desc_chk    check (descripcion is null or char_length(descripcion) <= 400),
  constraint kvaplantillas_version_chk check ("versionActual" >= 1),
  constraint kvaplantillas_baja_chk    check (status or char_length(btrim(coalesce("motivoBaja",''))) > 0)
);
comment on table  public."kvaPlantillas" is 'Cabecera de las plantillas de documentos de KVA (machotes). El texto vive en kvaPlantillaVersiones (inmutable). Baja logica con motivo. Solo la lee/escribe el backend (service_role).';
comment on column public."kvaPlantillas".tipo is 'ASIGNACION_CARGA | DEVOLUCION.';
comment on column public."kvaPlantillas"."versionActual" is 'Numero de la version vigente en kvaPlantillaVersiones. Sirve de bloqueo optimista al guardar.';

-- Nombre unico entre las plantillas VIVAS del mismo tipo (ignora mayusculas/espacios).
create unique index if not exists ux_kvaplantillas_nombre_vivo
  on public."kvaPlantillas" (tipo, lower(btrim(nombre))) where status;
create index if not exists ix_kvaplantillas_tipo_vivas
  on public."kvaPlantillas" (tipo) where status;

-- 2) kvaPlantillaVersiones — INMUTABLE --------------------------------
create table if not exists public."kvaPlantillaVersiones" (
  "idPlantilla" uuid        not null references public."kvaPlantillas"("idPlantilla") on delete restrict,
  version       integer     not null,
  contenido     jsonb       not null,  -- {encabezado, cuerpo, pie}: cada zona es un Doc Tiptap saneado
  nota          text,
  uidr          uuid        not null,
  fc            timestamptz not null default now(),
  primary key ("idPlantilla", version),
  constraint kvaplantver_version_chk   check (version >= 1),
  constraint kvaplantver_contenido_chk check (jsonb_typeof(contenido) = 'object' and octet_length(contenido::text) <= 200000),
  constraint kvaplantver_nota_chk      check (nota is null or char_length(nota) <= 200)
);
comment on table public."kvaPlantillaVersiones" is 'Versiones INMUTABLES de una plantilla (una fila por guardado). Trigger prohibe UPDATE y DELETE.';

drop trigger if exists trg_inmutable on public."kvaPlantillaVersiones";
create trigger trg_inmutable
  before update or delete on public."kvaPlantillaVersiones"
  for each row execute function public.kva_inmutable();

-- 3) Seguridad: RLS activa SIN politicas + REVOKE (patron v2_*) --------
alter table public."kvaPlantillas"         enable row level security;
alter table public."kvaPlantillaVersiones" enable row level security;
revoke all on public."kvaPlantillas", public."kvaPlantillaVersiones" from anon, authenticated;

-- 4) Auditoria ----------------------------------------------------------
drop trigger if exists trg_auditoria on public."kvaPlantillas";
create trigger trg_auditoria after insert or delete or update on public."kvaPlantillas"
  for each row execute function fn_auditoria('idPlantilla');
drop trigger if exists trg_auditoria on public."kvaPlantillaVersiones";
create trigger trg_auditoria after insert or delete or update on public."kvaPlantillaVersiones"
  for each row execute function fn_auditoria('idPlantilla');

-- 5) Funciones de escritura (TODO o NADA).
--    SQLSTATE: KV401 sin actor · KV404 no existe · KV409 conflicto · KV410 de baja · KV423 inmutable
create or replace function public.kva_plantilla_crear(
  p_tipo text, p_nombre text, p_descripcion text, p_contenido jsonb, p_nota text)
returns uuid language plpgsql set search_path to 'public' as $$
declare v_uid uuid := public.kva_actor(); v_id uuid;
begin
  if v_uid is null then raise exception 'SIN_ACTOR' using errcode = 'KV401'; end if;
  insert into public."kvaPlantillas"(tipo, nombre, descripcion, uidr)
    values (p_tipo, btrim(p_nombre), nullif(btrim(coalesce(p_descripcion,'')),''), v_uid)
    returning "idPlantilla" into v_id;
  insert into public."kvaPlantillaVersiones"("idPlantilla", version, contenido, nota, uidr)
    values (v_id, 1, p_contenido, nullif(btrim(coalesce(p_nota,'')),''), v_uid);
  return v_id;
exception when unique_violation then
  raise exception 'NOMBRE_DUPLICADO' using errcode = 'KV409';
end $$;

-- Guardar = version nueva. Bloqueo optimista: p_base debe ser la version vigente.
-- p_nombre / p_descripcion NULL = conservar; p_descripcion '' = vaciar.
create or replace function public.kva_plantilla_guardar(
  p_id uuid, p_base integer, p_nombre text, p_descripcion text, p_contenido jsonb, p_nota text)
returns integer language plpgsql set search_path to 'public' as $$
declare v_uid uuid := public.kva_actor(); v_actual integer; v_status boolean; v_nueva integer;
begin
  if v_uid is null then raise exception 'SIN_ACTOR' using errcode = 'KV401'; end if;
  select "versionActual", status into v_actual, v_status
    from public."kvaPlantillas" where "idPlantilla" = p_id for update;
  if not found then raise exception 'PLANTILLA_NO_EXISTE' using errcode = 'KV404'; end if;
  if not v_status then raise exception 'PLANTILLA_DE_BAJA' using errcode = 'KV410'; end if;
  if v_actual <> p_base then
    raise exception 'VERSION_DESACTUALIZADA' using errcode = 'KV409', detail = v_actual::text;
  end if;
  v_nueva := v_actual + 1;
  insert into public."kvaPlantillaVersiones"("idPlantilla", version, contenido, nota, uidr)
    values (p_id, v_nueva, p_contenido, nullif(btrim(coalesce(p_nota,'')),''), v_uid);
  update public."kvaPlantillas"
     set "versionActual" = v_nueva, fum = now(), "fumUser" = v_uid,
         nombre = coalesce(nullif(btrim(coalesce(p_nombre,'')),''), nombre),
         descripcion = case when p_descripcion is null then descripcion
                            else nullif(btrim(p_descripcion),'') end
   where "idPlantilla" = p_id;
  return v_nueva;
exception when unique_violation then
  raise exception 'NOMBRE_DUPLICADO' using errcode = 'KV409';
end $$;

create or replace function public.kva_plantilla_baja(p_id uuid, p_motivo text)
returns void language plpgsql set search_path to 'public' as $$
declare v_uid uuid := public.kva_actor(); v_status boolean;
begin
  if v_uid is null then raise exception 'SIN_ACTOR' using errcode = 'KV401'; end if;
  select status into v_status from public."kvaPlantillas" where "idPlantilla" = p_id for update;
  if not found then raise exception 'PLANTILLA_NO_EXISTE' using errcode = 'KV404'; end if;
  if not v_status then raise exception 'PLANTILLA_DE_BAJA' using errcode = 'KV410'; end if;
  update public."kvaPlantillas"
     set status = false, "motivoBaja" = btrim(p_motivo), fum = now(), "fumUser" = v_uid
   where "idPlantilla" = p_id;
end $$;

-- ⛔ Funciones: NO ejecutables por anon/authenticated (en public lo son por defecto).
revoke all on function public.kva_actor() from public, anon, authenticated;
revoke all on function public.kva_plantilla_crear(text,text,text,jsonb,text) from public, anon, authenticated;
revoke all on function public.kva_plantilla_guardar(uuid,integer,text,text,jsonb,text) from public, anon, authenticated;
revoke all on function public.kva_plantilla_baja(uuid,text) from public, anon, authenticated;
grant execute on function public.kva_actor() to service_role;
grant execute on function public.kva_plantilla_crear(text,text,text,jsonb,text) to service_role;
grant execute on function public.kva_plantilla_guardar(uuid,integer,text,text,jsonb,text) to service_role;
grant execute on function public.kva_plantilla_baja(uuid,text) to service_role;

-- 6) Permisos (patron de 720-723; nadie los tiene hasta que Jereff los otorgue) --
insert into public."segModulos" (modulo, seccion, area, clave)
select 'Parques'::public."Modulos", v.seccion, v.area, v.clave
  from (values ('Plantillas','Modulo',730),
               ('Plantillas','Editar',731)) as v(seccion, area, clave)
 where not exists (select 1 from public."segModulos" s where s.clave = v.clave);

commit;

-- =====================================================================
-- Verificacion posterior (ejecutar aparte):
--   select count(*) from public."kvaPlantillas";                                   -- 0
--   select clave, seccion, area from public."segModulos" where clave in (730,731) order by 1;  -- 2 filas
--   select tablename, count(*) from pg_policies where tablename like 'kvaPlantilla%' group by 1; -- 0 filas
--   select has_function_privilege('anon','public.kva_plantilla_crear(text,text,text,jsonb,text)','execute'); -- false
--   select relrowsecurity from pg_class where relname in ('kvaPlantillas','kvaPlantillaVersiones'); -- true, true
-- Rollback:
--   drop table public."kvaPlantillaVersiones", public."kvaPlantillas" cascade;
--   drop function public.kva_plantilla_baja(uuid,text),
--                 public.kva_plantilla_guardar(uuid,integer,text,text,jsonb,text),
--                 public.kva_plantilla_crear(text,text,text,jsonb,text),
--                 public.kva_inmutable();
--   -- kva_actor() se conserva si otras migraciones (documentos generados) lo usan; si no: drop function public.kva_actor();
--   delete from public."segModulos" where clave in (730,731)
--     and not exists (select 1 from "segModulosUsuarios" u where u.clave in (730,731));
-- =====================================================================
