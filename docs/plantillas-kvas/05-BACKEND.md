# 05 · Backend y modelo de datos — Plantillas de documentos de KVA's

> ⚠️ **Verificado contra la BD y el código reales** (MCP `supaSPH`, solo `SELECT`; lectura de fuentes), fecha
> **2026-10-07**. El SQL de §2 es un **BORRADOR: no se ha aplicado**. Las decisiones y su porqué viven en
> `02-TRD.md` (referencias «D-n», «X-n», «P-n»).

## 1. Estado actual verificado

| Objeto | Hoy | Evidencia |
|---|---|---|
| Tablas nuevas de este paquete | **No existen** (`kvaPlantillas`, `kvaPlantillaVersiones`, `kvaDocGenerados`, `kvaDocGeneradoNaves`) | catálogo; el brief ya lo decía |
| `segModulos` claves 700-801 | 700, 701, 702, 710, 720, 721, 722, 723, 800, 801. **Libres:** 724, 730, 731 | `select clave… from "segModulos"`; sin usos en `@RequierePermiso` ni `menu.tsx` |
| `segModulos` columnas | `idsegModulos uuid, fc, modulo "Modulos" (enum), seccion, area, clave smallint` | `information_schema` |
| Enum `public."Modulos"` | …, `Parques`, `Correo` (valor `Parques` existe) | `pg_enum` |
| `segModulosUsuarios` | `(idsegModulos, uid, clave, acceso bool, modulo, seccion, area, fc)`; 8 filas por clave de KVA's (las crea la pantalla de Permisos al conceder) | consulta |
| `kvaNaveDocs` | `idDoc uuid PK default gen_random_uuid(), idNave text NOT NULL FK naves, idParque text, titulo text NOT NULL, descripcion, urldoc text NOT NULL, status bool default true, motivoBaja, uidr uuid, fc timestamptz default now()`; índice `ix_kvanavedocs_nave_fc (idNave, fc DESC)`; `trg_auditoria` = `fn_auditoria('idDoc')`; RLS activa + política `FOR ALL TO authenticated USING (true)`; `anon` y `authenticated` con todos los GRANT | catálogo / `pg_policies` / `role_table_grants` |
| `fn_auditoria()` | `SECURITY DEFINER`; actor = `request.jwt.claims->>'sub'`; origen 2 si `role = service_role`; en UPDATE solo registra si hubo cambio; **nunca aborta** la operación; recibe **una** columna PK | `pg_get_functiondef` |
| `comoActor(uid)` | JWT `service_role` con `sub = uid` firmado por el API; **toda escritura** debe usarlo | `supabase.service.ts:78-100` |
| Patrón de tabla nueva «solo backend» | `v2_invitaciones` y otras 9 con **RLS activa sin políticas** + `REVOKE ALL … FROM anon, authenticated` + `trg_auditoria` | migración `2026-06-12-invitaciones.sql`; consulta de tablas con RLS y 0 políticas |
| Funciones en `public` | Ejecutables por `PUBLIC`/`anon`/`authenticated` por defecto (`proacl` con `=X`, `anon=X`, `authenticated=X`) | `pg_proc` de `pagos_arrendatarios` |
| Bucket `kvaDocs` | existe, **`public = false`**, sin límite de tamaño ni lista de MIME a nivel bucket; prefijo actual `yyyy-MM/naves/<idNave>/<uuid>.<ext>`; URL firmada 3 600 s | `storage.buckets`; `kvas.service.ts:22-25,854-896,920-930` |
| Validación de entrada | **`ZodValidationPipe` por endpoint** (no hay `ValidationPipe` global de class-validator); body JSON global ≤ 2 MB; `AllExceptionsFilter` global | `zod-validation.pipe.ts`; `main.ts:23,38-42` |
| Rate limit | `ThrottlerGuard` global 120/min; endpoints sensibles usan `@Throttle({ default: { ttl: 60_000, limit: N } })` | `app.module.ts:47-49,80`; `auth.controller.ts:52` |
| Motor de PDF en el API | **Ninguno.** `apps/api/package.json`: `exceljs`, `pdf-parse` (lectura). `jspdf`/`jspdf-autotable` solo en `apps/web` | `package.json` de ambos |
| Imagen del API | `node:22-slim`, `pnpm deploy --prod`; **sin Chromium ni fuentes** | `apps/api/Dockerfile` |
| Logo de la plataforma | `SPHConfiguraciones`: `LOGO_FONDO_CLARO` = `{url: …/storage/v1/object/public/branding/logo-claro.jpg?v=…, ancho: 400, alto: null}` (**JPG**); `LOGO_FONDO_OSCURO` = `logo.png` (200 px). Bucket `branding`: **público**, límite 2 MB, MIME png/jpeg/svg+xml/webp. `ConfiguracionService.obtenerLogos()` (módulo `@Global`) | `select` en `SPHConfiguraciones` y `storage.buckets`; `configuracion.service.ts:16-24,128` |
| Empresas | `inversionista`: PK `idInversionista text`; `razonsocial` (nullable, **0 vacías**), `NomComercial`, `nombre`, `RFC`; 10 razones sociales repetidas (minúsculas/trim) | consulta |
| Naves | `naves`: PK `idNave text`; `idParque`; `numNaveNAME` (texto: **196/636 no numéricos, 9 con cero inicial**); `dotacionBt/Mt numeric` NOT NULL | consulta |
| Datos de dotación (solo PRELLENADO, D10) | Solo Spartek (60 de 62 naves con dotación), Spartek II (67/67), Spartek III (30/30) y Prueba Parque (10 naves, 2 con MT). **Acupark I-III, Actitek, Norponiente, Omega, Sitapark, A3: 0** | consulta por parque |

## 2. Migración (BORRADOR) — `base-conocimiento/migraciones/2026-10-XX-kvas-plantillas-documentos.sql`

> ⛔ **Solo crea.** Ningún `ALTER`/`DROP` sobre tablas existentes. Requiere visto bueno de Toribio (migración, no es
> producción de dinero pero sí producción) y pasar por la verificación adversarial (`07`) antes de aplicarse.

```sql
-- =====================================================================
-- Plantillas de documentos de KVA's · tablas, funciones y permisos
-- BORRADOR (2026-10-07) — NO APLICADO.
-- Solo CREA. Si falla, el ROLLBACK deja la BD idéntica.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- 0) Helpers
-- ---------------------------------------------------------------------
-- Actor = sub del JWT de la petición (lo firma el API con comoActor()).
create or replace function public.kva_actor() returns uuid
language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
$$;

-- ---------------------------------------------------------------------
-- 1) kvaPlantillas — CABECERA (mutable: nombre, versión vigente, baja)
-- ---------------------------------------------------------------------
create table public."kvaPlantillas" (
  "idPlantilla"   uuid        primary key default gen_random_uuid(),
  tipo            text        not null,
  nombre          text        not null,
  descripcion     text,
  "versionActual" integer     not null default 1,
  status          boolean     not null default true,
  "motivoBaja"    text,
  uidr            uuid        not null,                 -- creador (JWT)
  fc              timestamptz not null default now(),
  "fumUser"       uuid,                                  -- último que guardó
  fum             timestamptz,
  constraint kvaplantillas_tipo_chk    check (tipo in ('ASIGNACION_CARGA','DEVOLUCION')),
  constraint kvaplantillas_nombre_chk  check (char_length(btrim(nombre)) between 1 and 120),
  constraint kvaplantillas_desc_chk    check (descripcion is null or char_length(descripcion) <= 400),
  constraint kvaplantillas_version_chk check ("versionActual" >= 1),
  constraint kvaplantillas_baja_chk    check (status or char_length(btrim(coalesce("motivoBaja",''))) > 0)
);
comment on table  public."kvaPlantillas" is 'Cabecera de las plantillas de documentos de KVA (machotes). El texto vive en kvaPlantillaVersiones (inmutable). Baja logica con motivo. Solo la lee/escribe el backend (service_role).';
comment on column public."kvaPlantillas".tipo is 'ASIGNACION_CARGA | DEVOLUCION. Define el catalogo cerrado de campos automaticos (codigo: kvas-plantillas.campos.ts).';
comment on column public."kvaPlantillas"."versionActual" is 'Numero de la version vigente en kvaPlantillaVersiones. Sirve de bloqueo optimista al guardar.';

-- Nombre único entre las plantillas VIVAS del mismo tipo (ignora mayúsculas/espacios).
create unique index ux_kvaplantillas_nombre_vivo
  on public."kvaPlantillas" (tipo, lower(btrim(nombre))) where status;
create index ix_kvaplantillas_tipo_vivas
  on public."kvaPlantillas" (tipo) where status;

-- ---------------------------------------------------------------------
-- 2) kvaPlantillaVersiones — INMUTABLE
-- ---------------------------------------------------------------------
create table public."kvaPlantillaVersiones" (
  "idPlantilla" uuid        not null references public."kvaPlantillas"("idPlantilla") on delete restrict,
  version       integer     not null,
  contenido     jsonb       not null,                   -- árbol Tiptap/ProseMirror saneado
  "datosFijos"  jsonb       not null default '{}'::jsonb, -- apoderado, domicilio, destinatario, oficio, solicitud_cfe
  nota          text,
  uidr          uuid        not null,
  fc            timestamptz not null default now(),
  primary key ("idPlantilla", version),
  constraint kvaplantver_version_chk  check (version >= 1),
  constraint kvaplantver_contenido_chk check (jsonb_typeof(contenido) = 'object' and contenido ->> 'type' = 'doc'
                                              and octet_length(contenido::text) <= 200000),
  constraint kvaplantver_datos_chk    check (jsonb_typeof("datosFijos") = 'object' and octet_length("datosFijos"::text) <= 4000),
  constraint kvaplantver_nota_chk     check (nota is null or char_length(nota) <= 200)
);
comment on table public."kvaPlantillaVersiones" is 'Versiones INMUTABLES de una plantilla (una fila por guardado). Un documento generado referencia (idPlantilla, version). Trigger prohibe UPDATE y DELETE.';

create or replace function public.kva_inmutable() returns trigger
language plpgsql as $$
begin
  raise exception 'Los registros de % son inmutables.', tg_table_name using errcode = 'KV423';
end $$;

create trigger trg_inmutable
  before update or delete on public."kvaPlantillaVersiones"
  for each row execute function public.kva_inmutable();

-- ---------------------------------------------------------------------
-- 3) kvaDocGenerados — el documento emitido (inmutable salvo la baja)
-- ---------------------------------------------------------------------
create table public."kvaDocGenerados" (
  "idDocGenerado"     uuid        primary key default gen_random_uuid(),
  "idPlantilla"       uuid        not null,
  version             integer     not null,
  tipo                text        not null,
  "idInversionista"   text        not null references public.inversionista("idInversionista"),
  "empresaNombre"     text        not null,             -- snapshot de razonsocial al generar
  fecha               date        not null,             -- fecha impresa en el documento
  "contenidoFinal"    jsonb       not null,             -- árbol saneado, con nodos campo/datoFijo (ya ajustado por el usuario)
  "datosFijos"        jsonb       not null,             -- los usados (ya ajustados)
  "camposResueltos"   jsonb       not null,             -- {empresa, parque(s), naves, kvas_por_nave, nivel, fecha} tal como se imprimieron + cantidades declaradas
  "hashPdf"           text        not null,             -- SHA-256 hex de los bytes del PDF subido
  "bytesPdf"          integer     not null,
  "rutaPdf"           text        not null,             -- ruta en el bucket PRIVADO kvaDocs
  "claveIdempotencia" uuid        not null,
  status              boolean     not null default true,
  "motivoBaja"        text,
  "fechaBaja"         timestamptz,
  "uidBaja"           uuid,
  uidr                uuid        not null,
  fc                  timestamptz not null default now(),
  constraint kvadocgen_version_fk foreign key ("idPlantilla", version)
    references public."kvaPlantillaVersiones"("idPlantilla", version),
  constraint kvadocgen_tipo_chk   check (tipo in ('ASIGNACION_CARGA','DEVOLUCION')),
  constraint kvadocgen_hash_chk   check ("hashPdf" ~ '^[0-9a-f]{64}$'),
  constraint kvadocgen_bytes_chk  check ("bytesPdf" > 0 and "bytesPdf" <= 2097152),
  constraint kvadocgen_ruta_chk   check ("rutaPdf" !~ '(^/|\.\.|\\)'),
  constraint kvadocgen_contenido_chk check (octet_length("contenidoFinal"::text) <= 200000),
  constraint kvadocgen_baja_chk   check ((status and "motivoBaja" is null and "fechaBaja" is null and "uidBaja" is null)
                                      or (not status and char_length(btrim(coalesce("motivoBaja",''))) > 0
                                          and "fechaBaja" is not null and "uidBaja" is not null))
);
comment on table  public."kvaDocGenerados" is 'Documento PDF emitido a partir de una plantilla para UNA empresa (dueña o arrendataria) y naves de uno o varios parques (el parque de cada nave vive en kvaDocGeneradoNaves). Inmutable: solo cambian los campos de baja (trigger). Guarda la version de plantilla, el contenido final, los campos resueltos y el hash del PDF.';
comment on column public."kvaDocGenerados"."camposResueltos" is 'Valores impresos al generar. empresa, parque, naves, naves_etiqueta y fecha los resuelve el SERVIDOR desde la BD; kvas_por_nave y nivel se REDACTAN en el servidor a partir de la cantidad/nivel por nave DECLARADOS por el usuario (D10, validados con Zod).';
comment on column public."kvaDocGenerados"."claveIdempotencia" is 'uuid generado por el cliente por apertura del modal; (uidr, claveIdempotencia) es unico: evita duplicados por doble clic.';

create unique index ux_kvadocgen_idem on public."kvaDocGenerados" (uidr, "claveIdempotencia");
create index ix_kvadocgen_empresa on public."kvaDocGenerados" ("idInversionista", fc desc);
create index ix_kvadocgen_version on public."kvaDocGenerados" ("idPlantilla", version);

-- Guardia: solo se permite la BAJA (status true -> false con motivo); nada más cambia, nada se borra.
create or replace function public.kva_docgen_guardia() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Los documentos generados no se borran: se dan de baja.' using errcode = 'KV423';
  end if;
  if old.status is false then
    raise exception 'El documento ya esta dado de baja.' using errcode = 'KV423';
  end if;
  if (to_jsonb(new) - 'status' - 'motivoBaja' - 'fechaBaja' - 'uidBaja')
       is distinct from (to_jsonb(old) - 'status' - 'motivoBaja' - 'fechaBaja' - 'uidBaja') then
    raise exception 'Un documento generado es inmutable: solo puede darse de baja.' using errcode = 'KV423';
  end if;
  return new;
end $$;

create trigger trg_docgen_guardia
  before update or delete on public."kvaDocGenerados"
  for each row execute function public.kva_docgen_guardia();

-- ---------------------------------------------------------------------
-- 4) kvaDocGeneradoNaves — tabla puente (naves incluidas + snapshot de KVA)
-- ---------------------------------------------------------------------
create table public."kvaDocGeneradoNaves" (
  "idDocGenerado" uuid          not null references public."kvaDocGenerados"("idDocGenerado") on delete restrict,
  "idNave"        text          not null references public.naves("idNave"),
  "idParque"      text          not null references public.parques("idParque"), -- el de la nave al generar (D13: puede haber varios por documento)
  "idDoc"         uuid          not null unique references public."kvaNaveDocs"("idDoc"), -- su fila en el expediente
  "kvasBt"        numeric(12,2) not null default 0,
  "kvasMt"        numeric(12,2) not null default 0,
  "origenKvas"    text          not null default 'DOTACION',
  primary key ("idDocGenerado", "idNave"),
  constraint kvadocgennav_kvas_chk   check ("kvasBt" >= 0 and "kvasMt" >= 0 and ("kvasBt" + "kvasMt") > 0),
  constraint kvadocgennav_origen_chk check ("origenKvas" in ('DOTACION','DECLARADO'))
);
comment on table public."kvaDocGeneradoNaves" is 'Naves incluidas en un documento generado, con la cantidad de KVA impresa (snapshot) y su fila en el expediente (kvaNaveDocs). kvasBt/kvasMt son la cantidad DECLARADA por el usuario (D10); origenKvas = DOTACION si dejo el prellenado de naves.dotacion*, DECLARADO si lo cambio o lo tecleo.';
create index ix_kvadocgennav_nave   on public."kvaDocGeneradoNaves" ("idNave");
create index ix_kvadocgennav_parque on public."kvaDocGeneradoNaves" ("idParque");

-- ---------------------------------------------------------------------
-- 5) Seguridad: RLS activa SIN políticas + REVOKE (patrón v2_*). Solo service_role.
-- ---------------------------------------------------------------------
alter table public."kvaPlantillas"         enable row level security;
alter table public."kvaPlantillaVersiones" enable row level security;
alter table public."kvaDocGenerados"       enable row level security;
alter table public."kvaDocGeneradoNaves"   enable row level security;
revoke all on public."kvaPlantillas", public."kvaPlantillaVersiones",
              public."kvaDocGenerados", public."kvaDocGeneradoNaves" from anon, authenticated;

-- ---------------------------------------------------------------------
-- 6) Auditoría (regla: toda tabla de datos). fn_auditoria recibe UNA columna PK:
--    en versiones y en la puente se usa idPlantilla / idDocGenerado (agrupa por entidad).
-- ---------------------------------------------------------------------
create trigger trg_auditoria after insert or delete or update on public."kvaPlantillas"
  for each row execute function fn_auditoria('idPlantilla');
create trigger trg_auditoria after insert or delete or update on public."kvaPlantillaVersiones"
  for each row execute function fn_auditoria('idPlantilla');
create trigger trg_auditoria after insert or delete or update on public."kvaDocGenerados"
  for each row execute function fn_auditoria('idDocGenerado');
create trigger trg_auditoria after insert or delete or update on public."kvaDocGeneradoNaves"
  for each row execute function fn_auditoria('idDocGenerado');

-- ---------------------------------------------------------------------
-- 7) Regla empresa <-> nave (FUENTE ÚNICA), D12: UNIÓN dueño vivo ∪ arrendatario vivo.
--    A diferencia de KvasService.ocupantesDeNaves ("arrendatario manda, si no el dueño"), aquí una
--    nave aparece en las listas de AMBAS empresas si dueño y arrendatario son distintos
--    (hoy: 96 naves). Si la misma empresa es las dos cosas, una sola fila con rol AMBOS.
--    propiedades.PActual se ignora. NO filtra por parque (D13) ni por dotación (D10): devuelve
--    las columnas dotacionBt/Mt solo para PRELLENAR.
-- ---------------------------------------------------------------------
create or replace function public.kva_naves_elegibles(p_id_inversionista text default null)
returns table ("idInversionista" text, rol text, "idNave" text, "idParque" text,
               "numNaveNAME" text, "numNave" integer, "dotacionBt" numeric, "dotacionMt" numeric)
language sql stable set search_path to 'public' as $$
  with v as (
    select a."idArrendador" as emp, a."idNave" as nave, 'ARRENDATARIO'::text as rol
      from public."arrenPropiedades" a
     where a.status is true
       and (p_id_inversionista is null or a."idArrendador" = p_id_inversionista)
    union all
    select p."idInversionista", p."idNave", 'INVERSIONISTA'::text
      from public.propiedades p
     where p.status is true and p."idNave" is not null
       and (p_id_inversionista is null or p."idInversionista" = p_id_inversionista)
  )
  select v.emp,
         case when count(*) > 1 then 'AMBOS' else min(v.rol) end,
         n."idNave", n."idParque", n."numNaveNAME", n."numNave", n."dotacionBt", n."dotacionMt"
    from v
    join public.naves n on n."idNave" = v.nave and n.status is true
   where v.emp is not null
   group by v.emp, n."idNave"     -- n.* depende funcionalmente de la PK de naves
$$;

-- ---------------------------------------------------------------------
-- 8) Funciones de escritura (TODO o NADA). SQLSTATE propios:
--    KV401 sin actor · KV404 no existe · KV409 conflicto · KV410 de baja · KV422 regla de negocio · KV423 inmutable
-- ---------------------------------------------------------------------
create or replace function public.kva_plantilla_crear(
  p_tipo text, p_nombre text, p_descripcion text, p_contenido jsonb, p_datos jsonb, p_nota text)
returns uuid language plpgsql set search_path to 'public' as $$
declare v_uid uuid := public.kva_actor(); v_id uuid;
begin
  if v_uid is null then raise exception 'SIN_ACTOR' using errcode = 'KV401'; end if;
  insert into public."kvaPlantillas"(tipo, nombre, descripcion, uidr)
    values (p_tipo, btrim(p_nombre), nullif(btrim(coalesce(p_descripcion,'')),''), v_uid)
    returning "idPlantilla" into v_id;
  insert into public."kvaPlantillaVersiones"("idPlantilla", version, contenido, "datosFijos", nota, uidr)
    values (v_id, 1, p_contenido, coalesce(p_datos,'{}'::jsonb), nullif(btrim(coalesce(p_nota,'')),''), v_uid);
  return v_id;
exception when unique_violation then
  raise exception 'NOMBRE_DUPLICADO' using errcode = 'KV409';
end $$;

-- Guardar = versión nueva. Bloqueo optimista: p_base debe ser la versión vigente.
create or replace function public.kva_plantilla_guardar(
  p_id uuid, p_base integer, p_nombre text, p_contenido jsonb, p_datos jsonb, p_nota text)
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
  insert into public."kvaPlantillaVersiones"("idPlantilla", version, contenido, "datosFijos", nota, uidr)
    values (p_id, v_nueva, p_contenido, coalesce(p_datos,'{}'::jsonb), nullif(btrim(coalesce(p_nota,'')),''), v_uid);
  update public."kvaPlantillas"
     set "versionActual" = v_nueva, fum = now(), "fumUser" = v_uid,
         nombre = coalesce(nullif(btrim(coalesce(p_nombre,'')),''), nombre)
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

-- Registro atómico del documento: cabecera + 1 fila por nave en el expediente + puente.
-- p_naves = [{ "idNave", "kvasBt", "kvasMt", "origenKvas" }] (cantidad DECLARADA, D10).
-- El parque de cada nave sale de public.naves (D13), nunca de un parámetro.
-- Defensa en profundidad: revalida que TODAS las naves sean de la empresa (dueña o arrendataria).
-- NO valida contra la dotación: la cantidad es declarada por el usuario (D10).
create or replace function public.kva_documento_registrar(
  p_id_doc_generado uuid, p_id_plantilla uuid, p_version integer,
  p_id_inversionista text, p_empresa text, p_fecha date,
  p_contenido jsonb, p_datos jsonb, p_campos jsonb,
  p_hash text, p_bytes integer, p_ruta text, p_clave uuid,
  p_titulo text, p_descripcion text, p_naves jsonb)
returns jsonb language plpgsql set search_path to 'public' as $$
declare
  v_uid uuid := public.kva_actor(); v_tipo text; v_status boolean;
  v_total integer; v_ok integer; v_distintas integer; v_malas integer;
  v_n record; v_doc uuid; v_docs jsonb := '[]'::jsonb;
begin
  if v_uid is null then raise exception 'SIN_ACTOR' using errcode = 'KV401'; end if;

  select tipo, status into v_tipo, v_status from public."kvaPlantillas" where "idPlantilla" = p_id_plantilla;
  if not found then raise exception 'PLANTILLA_NO_EXISTE' using errcode = 'KV404'; end if;
  if not v_status then raise exception 'PLANTILLA_DE_BAJA' using errcode = 'KV410'; end if;

  v_total := coalesce(jsonb_array_length(p_naves), 0);
  if v_total < 1 or v_total > 50 then raise exception 'NAVES_FUERA_DE_RANGO' using errcode = 'KV422'; end if;

  select count(distinct x."idNave") into v_distintas
    from jsonb_to_recordset(p_naves) as x("idNave" text);
  if v_distintas <> v_total then raise exception 'NAVES_REPETIDAS' using errcode = 'KV422'; end if;

  -- Cada nave es de la empresa (misma función que el listado). Sin filtro de parque (D13).
  select count(*) into v_ok
    from jsonb_to_recordset(p_naves) as x("idNave" text)
    join public.kva_naves_elegibles(p_id_inversionista) e on e."idNave" = x."idNave";
  if v_ok <> v_total then raise exception 'NAVE_NO_PERTENECE' using errcode = 'KV422'; end if;

  -- Cantidades: al menos un nivel > 0, sin negativos, origen válido (el CHECK de la puente lo repite).
  select count(*) into v_malas
    from jsonb_to_recordset(p_naves) as x("kvasBt" numeric, "kvasMt" numeric, "origenKvas" text)
   where coalesce(x."kvasBt",-1) < 0 or coalesce(x."kvasMt",-1) < 0
      or coalesce(x."kvasBt",0) + coalesce(x."kvasMt",0) <= 0
      or x."origenKvas" not in ('DOTACION','DECLARADO');
  if v_malas > 0 then raise exception 'CANTIDAD_INVALIDA' using errcode = 'KV422'; end if;

  begin
    insert into public."kvaDocGenerados"(
      "idDocGenerado","idPlantilla",version,tipo,"idInversionista","empresaNombre",
      fecha,"contenidoFinal","datosFijos","camposResueltos","hashPdf","bytesPdf","rutaPdf","claveIdempotencia",uidr)
    values (
      p_id_doc_generado,p_id_plantilla,p_version,v_tipo,p_id_inversionista,p_empresa,
      p_fecha,p_contenido,p_datos,p_campos,p_hash,p_bytes,p_ruta,p_clave,v_uid);
  exception when unique_violation then
    raise exception 'REPETIDO' using errcode = 'KV409';   -- (uidr, claveIdempotencia) ya existe
  end;

  for v_n in
    select x."idNave", n."idParque", coalesce(x."kvasBt",0) as "kvasBt", coalesce(x."kvasMt",0) as "kvasMt", x."origenKvas"
      from jsonb_to_recordset(p_naves) as x("idNave" text, "kvasBt" numeric, "kvasMt" numeric, "origenKvas" text)
      join public.naves n on n."idNave" = x."idNave"
  loop
    insert into public."kvaNaveDocs"("idNave","idParque",titulo,descripcion,urldoc,uidr)
      values (v_n."idNave", v_n."idParque", p_titulo, p_descripcion, p_ruta, v_uid)
      returning "idDoc" into v_doc;
    insert into public."kvaDocGeneradoNaves"("idDocGenerado","idNave","idParque","idDoc","kvasBt","kvasMt","origenKvas")
      values (p_id_doc_generado, v_n."idNave", v_n."idParque", v_doc, v_n."kvasBt", v_n."kvasMt", v_n."origenKvas");
    v_docs := v_docs || jsonb_build_object('idNave', v_n."idNave", 'idDoc', v_doc);
  end loop;

  return jsonb_build_object('idDocGenerado', p_id_doc_generado, 'docs', v_docs);
end $$;

-- Baja del documento generado: él y TODAS sus filas del expediente, en una transacción.
create or replace function public.kva_documento_baja(p_id uuid, p_motivo text)
returns void language plpgsql set search_path to 'public' as $$
declare v_uid uuid := public.kva_actor(); v_status boolean;
begin
  if v_uid is null then raise exception 'SIN_ACTOR' using errcode = 'KV401'; end if;
  select status into v_status from public."kvaDocGenerados" where "idDocGenerado" = p_id for update;
  if not found then raise exception 'DOCUMENTO_NO_EXISTE' using errcode = 'KV404'; end if;
  if not v_status then raise exception 'DOCUMENTO_DE_BAJA' using errcode = 'KV410'; end if;
  update public."kvaDocGenerados"
     set status = false, "motivoBaja" = btrim(p_motivo), "fechaBaja" = now(), "uidBaja" = v_uid
   where "idDocGenerado" = p_id;
  update public."kvaNaveDocs"
     set status = false, "motivoBaja" = left('Baja del documento generado: ' || btrim(p_motivo), 400)
   where status and "idDoc" in (select "idDoc" from public."kvaDocGeneradoNaves" where "idDocGenerado" = p_id);
end $$;

-- ⛔ Funciones: NO ejecutables por anon/authenticated (en public lo son por defecto).
revoke all on function public.kva_actor() from public, anon, authenticated;
revoke all on function public.kva_naves_elegibles(text) from public, anon, authenticated;
revoke all on function public.kva_plantilla_crear(text,text,text,jsonb,jsonb,text) from public, anon, authenticated;
revoke all on function public.kva_plantilla_guardar(uuid,integer,text,jsonb,jsonb,text) from public, anon, authenticated;
revoke all on function public.kva_plantilla_baja(uuid,text) from public, anon, authenticated;
revoke all on function public.kva_documento_registrar(uuid,uuid,integer,text,text,date,jsonb,jsonb,jsonb,text,integer,text,uuid,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.kva_documento_baja(uuid,text) from public, anon, authenticated;
grant execute on function public.kva_actor() to service_role;
grant execute on function public.kva_naves_elegibles(text) to service_role;
grant execute on function public.kva_plantilla_crear(text,text,text,jsonb,jsonb,text) to service_role;
grant execute on function public.kva_plantilla_guardar(uuid,integer,text,jsonb,jsonb,text) to service_role;
grant execute on function public.kva_plantilla_baja(uuid,text) to service_role;
grant execute on function public.kva_documento_registrar(uuid,uuid,integer,text,text,date,jsonb,jsonb,jsonb,text,integer,text,uuid,text,text,jsonb) to service_role;
grant execute on function public.kva_documento_baja(uuid,text) to service_role;

-- ---------------------------------------------------------------------
-- 9) Permisos (nadie los tiene hasta que Jereff los otorgue en la pantalla de Permisos)
-- ---------------------------------------------------------------------
insert into public."segModulos" (modulo, seccion, area, clave)
select 'Parques'::public."Modulos", v.seccion, v.area, v.clave
  from (values ('KVA''s','Generar documento',724),
               ('Plantillas','Modulo',730),
               ('Plantillas','Editar',731)) as v(seccion, area, clave)
 where not exists (select 1 from public."segModulos" s where s.clave = v.clave);

-- ---------------------------------------------------------------------
-- 10) (OPCIONAL, NO INCLUIDO — toca tablas compartidas; decide Toribio)
--    create index if not exists ix_arrenpropiedades_nave on public."arrenPropiedades"("idNave") where status;
--    create index if not exists ix_arrenpropiedades_arrendador on public."arrenPropiedades"("idArrendador") where status;
--    create index if not exists ix_propiedades_nave on public.propiedades("idNave") where status;
-- ---------------------------------------------------------------------
commit;

-- Verificación posterior (aparte):
--   select count(*) from public."kvaPlantillas";                                   -- 0
--   select clave, seccion, area from public."segModulos" where clave in (724,730,731) order by 1;  -- 3 filas
--   select tablename, count(*) from pg_policies where tablename like 'kvaPlantilla%' or tablename like 'kvaDocGenerad%' group by 1; -- 0 filas
--   select has_function_privilege('anon','public.kva_naves_elegibles(text)','execute');            -- false
--   select count(*) from public.kva_naves_elegibles(null);                                          -- 510 (hoy; 313 empresas, 96 naves en 2 empresas)
-- Rollback: drop table public."kvaDocGeneradoNaves", public."kvaDocGenerados", public."kvaPlantillaVersiones", public."kvaPlantillas" cascade;
--           drop function public.kva_documento_baja(uuid,text), public.kva_documento_registrar(...), public.kva_plantilla_baja(uuid,text),
--                public.kva_plantilla_guardar(...), public.kva_plantilla_crear(...), public.kva_naves_elegibles(text),
--                public.kva_docgen_guardia(), public.kva_inmutable(), public.kva_actor();
--           delete from public."segModulos" where clave in (724,730,731) and not exists (select 1 from "segModulosUsuarios" u where u.clave in (724,730,731));
```

**Notas de verificación del SQL** (a revisar en el gate adversarial):
- `kva_naves_elegibles` es la **unión** dueño ∪ arrendatario (D12): `UNION ALL` de los dos vínculos vivos, `GROUP BY (empresa, nave)`; si la misma empresa figura en los dos, `rol = 'AMBOS'` (hoy 1 caso). `n.*` se toma por dependencia funcional de la PK de `naves`. Con los datos de hoy devuelve 510 filas / 313 empresas / 96 naves presentes en dos empresas.
- **D10/D13:** `kva_documento_registrar` ya **no** recibe parque (cada nave toma el suyo de `naves`) ni compara con la dotación (la cantidad es declarada). `kvaDocGenerados` ya no tiene `idParque`/`parqueNombre`; el parque vive por nave en `kvaDocGeneradoNaves."idParque"`.
- Los `RAISE … USING ERRCODE = 'KVxxx'` usan SQLSTATE propios de 5 caracteres; PostgREST los devuelve en `error.code` y el mensaje en `error.message`/`error.details`.
- `fn_auditoria` solo acepta una columna PK; para tablas de PK compuesta se audita por `idPlantilla` / `idDocGenerado` (el `id_entidad` agrupa todas las versiones/naves de la misma entidad).
- La FK `kvaDocGeneradoNaves."idDoc" → kvaNaveDocs` es **una FK entrante en una tabla existente, no una alteración de esa tabla**; sin embargo impide borrar (no se borran) esas filas: coherente con «baja lógica».

## 3. Contenido, datos fijos y catálogo — Zod (`kvas-plantillas.schemas.ts`)

```ts
import { z } from 'zod';

export const TIPOS_PLANTILLA = ['ASIGNACION_CARGA', 'DEVOLUCION'] as const;
export type TipoPlantilla = (typeof TIPOS_PLANTILLA)[number];

/** Catálogo CERRADO por tipo. v1: los 7 comunes (P-2: sin `figura`; P-3: DEVOLUCION sin campos propios). */
const COMUNES = ['empresa', 'parque', 'naves', 'naves_etiqueta', 'kvas_por_nave', 'nivel', 'fecha'] as const;
export const CAMPOS_AUTOMATICOS = { ASIGNACION_CARGA: COMUNES, DEVOLUCION: COMUNES } as const;

export const CLAVES_DATO_FIJO = ['apoderado', 'domicilio', 'destinatario', 'oficio', 'solicitud_cfe'] as const;
export const MARCAS = ['bold', 'italic', 'underline'] as const;
export const ALINEACIONES = ['left', 'center', 'right', 'justify'] as const;

export const LIMITES = {
  bytes: 200_000, nodos: 2_000, profundidad: 6, textoTotal: 50_000, textoNodo: 5_000,
  navesPorDocumento: 50, pdfBytes: 2 * 1024 * 1024, pdfPaginas: 10,
} as const;

/** Quita control, ancho cero y reordenado bidireccional; normaliza a NFC. */
export const textoSeguro = z.string().transform((s) =>
  s.normalize('NFC')
    .replace(/[\t\r\n]+/g, ' ')
    .replace(/[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g, ''));

const linea = (max: number) => textoSeguro.pipe(z.string().trim().max(max));

export const datosFijosSchema = z.object({
  apoderado: linea(200).optional(),
  domicilio: linea(400).optional(),
  destinatario: linea(300).optional(),
  oficio: linea(80).optional(),
  solicitud_cfe: linea(80).optional(),
}).strict();
export type DatosFijos = z.infer<typeof datosFijosSchema>;

/** Esquema del árbol, dependiente del TIPO (las claves de `campo` salen del catálogo de ese tipo). */
export function crearContenidoSchema(tipo: TipoPlantilla) {
  const claves = CAMPOS_AUTOMATICOS[tipo] as unknown as [string, ...string[]];
  const marca = z.object({ type: z.enum(MARCAS) }).strict();
  const texto = z.object({
    type: z.literal('text'),
    text: textoSeguro.pipe(z.string().min(1).max(LIMITES.textoNodo)),
    marks: z.array(marca).max(3).optional(),
  }).strict();
  const salto = z.object({ type: z.literal('hardBreak') }).strict();
  const campo = z.object({ type: z.literal('campo'),
    attrs: z.object({ clave: z.enum(claves) }).strict() }).strict();
  const datoFijo = z.object({ type: z.literal('datoFijo'),
    attrs: z.object({ clave: z.enum(CLAVES_DATO_FIJO) }).strict() }).strict();
  const inline = z.union([texto, salto, campo, datoFijo]);
  const align = z.object({ textAlign: z.enum(ALINEACIONES).nullish() }).strict();

  const parrafo = z.object({ type: z.literal('paragraph'), attrs: align.optional(),
    content: z.array(inline).max(500).optional() }).strict();
  const titulo = z.object({ type: z.literal('heading'),
    attrs: z.object({ level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
                      textAlign: z.enum(ALINEACIONES).nullish() }).strict(),
    content: z.array(inline).max(500).optional() }).strict();

  // Listas (recursivas, con tope de profundidad que además revisa `revisarLimites`).
  const item: z.ZodTypeAny = z.lazy(() => z.object({ type: z.literal('listItem'),
    content: z.array(z.union([parrafo, listaVi, listaNum])).min(1).max(50) }).strict());
  const listaVi: z.ZodTypeAny = z.lazy(() => z.object({ type: z.literal('bulletList'),
    content: z.array(item).min(1).max(100) }).strict());
  const listaNum: z.ZodTypeAny = z.lazy(() => z.object({ type: z.literal('orderedList'),
    attrs: z.object({ start: z.number().int().min(1).max(999).optional() }).strict().optional(),
    content: z.array(item).min(1).max(100) }).strict());

  return z.object({ type: z.literal('doc'),
    content: z.array(z.union([parrafo, titulo, listaVi, listaNum])).min(1).max(500) })
    .strict().superRefine(revisarLimites);
}

/** Recorre el árbol una vez: nodos, profundidad, texto total y bytes del JSON. */
function revisarLimites(doc: unknown, ctx: z.RefinementCtx): void {
  let nodos = 0, texto = 0, maxProf = 0;
  const visitar = (n: any, prof: number): void => {
    nodos++; maxProf = Math.max(maxProf, prof);
    if (typeof n?.text === 'string') texto += n.text.length;
    for (const h of n?.content ?? []) visitar(h, prof + 1);
  };
  visitar(doc, 1);
  const bytes = Buffer.byteLength(JSON.stringify(doc));
  if (nodos > LIMITES.nodos) ctx.addIssue({ code: 'custom', message: `Demasiados elementos (máx. ${LIMITES.nodos}).` });
  if (maxProf > LIMITES.profundidad + 2) ctx.addIssue({ code: 'custom', message: 'Listas demasiado anidadas.' });
  if (texto > LIMITES.textoTotal) ctx.addIssue({ code: 'custom', message: `El texto supera ${LIMITES.textoTotal} caracteres.` });
  if (bytes > LIMITES.bytes) ctx.addIssue({ code: 'custom', message: 'El documento es demasiado grande.' });
}
```
> Contrato con el front: el editor Tiptap se configura **solo** con las extensiones permitidas
> (`StarterKit` con `heading.levels = [1,2,3]` y sin código, cita, regla, enlace, tachado, ni historial en el JSON) y los
> nodos atómicos `campo`/`datoFijo`. Cualquier `attrs` fuera de lo listado se **rechaza** (strict); el front no debe emitirlos.

### 3.1 Bodies

```ts
const idUuid = z.string().uuid();
const motivo = z.string().trim().min(1, 'El motivo es obligatorio.').max(400);

export const crearPlantillaSchema = z.object({
  tipo: z.enum(TIPOS_PLANTILLA),
  nombre: linea(120).pipe(z.string().min(1, 'El nombre es obligatorio.')),
  descripcion: linea(400).optional().nullable(),
  contenido: z.unknown(),
  datosFijos: datosFijosSchema.default({}),
  nota: linea(200).optional().nullable(),
}).superRefine((d, ctx) => {
  const r = crearContenidoSchema(d.tipo).safeParse(d.contenido);
  if (!r.success) r.error.issues.forEach((i) => ctx.addIssue({ ...i, path: ['contenido', ...i.path] }));
});

/** El tipo NO viaja: es inmutable y sale de la cabecera; el servicio valida `contenido` contra ese tipo. */
export const guardarPlantillaSchema = z.object({
  baseVersion: z.number().int().min(1),
  nombre: linea(120).optional(),
  contenido: z.unknown(),
  datosFijos: datosFijosSchema,
  nota: linea(200).optional().nullable(),
});
export const restaurarVersionSchema = z.object({
  version: z.number().int().min(1),     // la que se copia
  baseVersion: z.number().int().min(1), // la vigente que el usuario vio
});
export const bajaSchema = z.object({ motivo });

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (yyyy-MM-dd).');

/** D10: cantidad DECLARADA por el usuario (prellenada desde naves.dotacion*, pero nunca obligatoria de la BD). */
export const cantidadKva = z.coerce.number().finite().gt(0, 'La cantidad debe ser mayor a 0.').max(100_000)
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, 'Máximo 2 decimales.');   // cabe en numeric(12,2)

const kvasNaveSchema = z.array(z.object({ nivel: z.enum(['BT', 'MT']), cantidad: cantidadKva }).strict())
  .min(1, 'Captura la cantidad de KVA de la nave.').max(2)
  .refine((a) => new Set(a.map((x) => x.nivel)).size === a.length, 'Nivel repetido en la misma nave.');

const naveElegidaSchema = z.object({
  idNave: z.string().trim().min(1).max(40),
  kvas: kvasNaveSchema,          // SIEMPRE viene (D10). El servidor decide origenKvas comparando con la dotación.
}).strict();

// D13: NO hay idParque en el body (cada nave aporta el suyo desde la BD); naves de uno o varios parques.
export const generarBase = z.object({
  idPlantilla: idUuid,
  idInversionista: z.string().trim().min(1).max(40),
  naves: z.array(naveElegidaSchema).min(1).max(LIMITES.navesPorDocumento),
  fecha: fecha.optional(),                       // por omisión: hoy (America/Mexico_City)
  // Ajustes de este documento (NO tocan la plantilla). Si se omiten, se usa la versión vigente tal cual.
  contenido: z.unknown().optional(),
  datosFijos: datosFijosSchema.optional(),
}).superRefine((d, ctx) => {
  const ids = d.naves.map((n) => n.idNave);
  if (new Set(ids).size !== ids.length)
    ctx.addIssue({ code: 'custom', path: ['naves'], message: 'Hay naves repetidas.' });
});
export const vistaPreviaSchema = generarBase;   // misma forma, sin idempotencia
export const generarSchema = generarBase.and(z.object({
  huellaCampos: z.string().regex(/^[0-9a-f]{64}$/),          // la de la vista previa que el usuario aceptó
  claveIdempotencia: idUuid,
}));
```
`contenido` ajustado se valida en el servicio con `crearContenidoSchema(<tipo de la plantilla>)` (no con el del body, que no conoce el tipo) y se rechaza con el mismo formato de `ZodValidationPipe` (`{ message: 'Datos de entrada inválidos', issues: [...] }`, 400).

## 4. Resolución de campos y lógica (`kvas-plantillas.campos.ts`, `kvas-documentos.service.ts`)

### 4.1 Consultas reales (todas por `service_role`, lecturas con `admin`)

| Qué | Consulta |
|---|---|
| Naves de una empresa (todas) | `admin.rpc('kva_naves_elegibles', { p_id_inversionista })` → `.range(0, 4999)` |
| Empresas (selector; dueñas **y** arrendatarias, D12) | `rpc('kva_naves_elegibles', { p_id_inversionista: null })` (sin filtro de dotación: D10) → agrupar por `idInversionista` → un `select idInversionista, razonsocial, NomComercial, nombre, RFC from inversionista where idInversionista in (…) and status` (`.in`, 1 llamada) |
| Parques de las naves elegidas (D13: 1..n) | `select idParque, nomParque from parques where idParque in (<idParque de cada nave devuelto por la función>)` — **nunca** un `idParque` del cliente |
| Empresa | `select idInversionista, razonsocial, NomComercial, nombre from inversionista where idInversionista = :id and status` |
| Versión vigente | `select … from kvaPlantillas where idPlantilla = :id` (+ `status`) y `select contenido, datosFijos from kvaPlantillaVersiones where idPlantilla = :id and version = :versionActual` |

### 4.2 Campos

| Clave | Resolución |
|---|---|
| `empresa` | `razonsocial?.trim() \|\| NomComercial?.trim() \|\| nombre?.trim()` (idéntico a `kvas.service.ts:520`) |
| `parque` (D13) | `unirY([...new Set(nomParque de las naves elegidas)].sort(localeCompare 'es'))` → «A», «A y B», «A, B y C» |
| `naves` | `agruparNaves(numNaveNAME[])` (abajo) |
| `naves_etiqueta` | `'nave'` si 1; `'naves'` si > 1 |
| `kvas_por_nave`, `nivel` | `redactarKvas(...)` (abajo) sobre las cantidades **declaradas** (D10) de `body.naves[].kvas`; el servidor redacta el texto, el usuario solo aporta números y nivel. En la vista previa el campo puede convertirse en texto editable (TRD §3.5) |
| `fecha` | `body.fecha ?? hoy('America/Mexico_City')` → «7 de octubre de 2026»; rango ±365 días de hoy, si no 422 |

```ts
const NUM = /^[1-9][0-9]*$/;
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const unirY = (p: string[]) => p.length <= 1 ? (p[0] ?? '') : `${p.slice(0, -1).join(', ')} y ${p[p.length - 1]}`;
const fmtNum = (n: number) => String(Number(n.toFixed(2)));                 // 5 → "5", 2.5 → "2.5"
const kva = (n: number) => `${fmtNum(n)} ${n === 1 ? 'KVA' : 'KVAS'}`;

/** «107-110 y 119-122», «1, 3-5 y 9». ≥3 consecutivos → rango; no numéricos y con cero inicial NUNCA se agrupan. */
export function agruparNaves(etiquetas: string[]): string {
  const u = [...new Set(etiquetas.map((e) => e.trim()).filter(Boolean))];
  const nums = u.filter((e) => NUM.test(e)).map(Number).sort((a, b) => a - b);
  const resto = u.filter((e) => !NUM.test(e)).sort((a, b) => a.localeCompare(b, 'es'));
  const partes: string[] = [];
  for (let i = 0; i < nums.length; ) {
    let j = i;
    while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
    if (j - i + 1 >= 3) partes.push(`${nums[i]}-${nums[j]}`);
    else for (let k = i; k <= j; k++) partes.push(String(nums[k]));
    i = j + 1;
  }
  return unirY([...partes, ...resto]);
}

export interface NaveKva { etiqueta: string; bt: number; mt: number }

export function redactarKvas(naves: NaveKva[]): { kvasPorNave: string; nivel: string; mixto: boolean } {
  const hayBt = naves.some((n) => n.bt > 0), hayMt = naves.some((n) => n.mt > 0);
  const mixto = hayBt && hayMt;
  const nivel = mixto ? 'baja y media tensión' : hayBt ? 'baja tensión' : 'media tensión';
  const grupos = new Map<string, NaveKva[]>();                               // clave `${bt}|${mt}`, orden de primera aparición
  for (const n of [...naves].sort(porEtiquetaCanonica)) {
    const k = `${n.bt}|${n.mt}`; (grupos.get(k) ?? grupos.set(k, []).get(k)!).push(n);
  }
  const frases = [...grupos.values()].map((g) => {
    const { bt, mt } = g[0];
    const cant = mixto
      ? [bt > 0 && `${kva(bt)} en baja tensión`, mt > 0 && `${kva(mt)} en media tensión`].filter(Boolean).join(' y ')
      : kva(bt > 0 ? bt : mt);
    return grupos.size === 1 ? cant
      : `${cant} en ${g.length > 1 ? 'las naves' : 'la nave'} ${agruparNaves(g.map((x) => x.etiqueta))}`;
  });
  return { kvasPorNave: mixto ? frases.join('; ') : unirY(frases), nivel, mixto };
}
```
(`porEtiquetaCanonica` = mismo orden que `agruparNaves`: enteros por valor, luego alfabético.) Casos de prueba obligatorios:
`agruparNaves(['107','108','109','110','119','120','121','122']) → '107-110 y 119-122'` (el ejemplo del cliente) ·
`['1','3','4','5','9'] → '1, 3-5 y 9'` · `['010','011','012'] → '010, 011 y 012'` · `['A','B','12'] → '12, A y B'` ·
8 naves × 5 BT → `{ '5 KVAS', 'baja tensión' }` · 1 nave 1 BT → `'1 KVA'` · BT 5 en 107-110 y BT 10 en 120 → `'5 KVAS en las naves 107-110 y 10 KVAS en la nave 120'` · nave con 5 BT + 16 MT → `mixto`, `nivel = 'baja y media tensión'`.

### 4.3 Cantidad de KVA: declarada por el usuario, prellenada desde la dotación (D10)

- **Nunca hay bloqueo por dotación.** Toda nave de la empresa (según `kva_naves_elegibles`) es seleccionable, tenga o no `dotacionBt/Mt`.
- **Prellenado** (en `GET …/empresas/:id/naves`): `kvasSugeridos = [{nivel:'BT', cantidad: dotacionBt}]` si `dotacionBt > 0`, más `{nivel:'MT', cantidad: dotacionMt}` si `dotacionMt > 0`; con 0/0 → `kvasSugeridos: []` y la interfaz pide teclearlo. La interfaz manda **siempre** `kvas` en `generar` (aunque el usuario no lo haya cambiado).
- **Es dato declarado**, no verificado contra la BD: lo acota Zod (`cantidadKva`: finito, > 0, ≤ 100 000, ≤ 2 decimales; nivel ∈ {BT, MT} sin repetir; 1-2 entradas por nave). Queda **auditado** en tres sitios: `kvaDocGenerados."camposResueltos"` (texto impreso y cantidades), `"contenidoFinal"` (texto final) y `kvaDocGeneradoNaves("kvasBt","kvasMt","origenKvas")`.
- **`origenKvas`** lo calcula el servidor: `'DOTACION'` si lo declarado coincide exactamente con `dotacionBt/Mt` de la nave en ese instante (y alguno > 0); `'DECLARADO'` en cualquier otro caso. No altera el PDF; sirve para auditoría («esta carta dice 5 KVAS y el sistema no los tenía registrados»).
- **Avisos informativos** (`advertencias` de la vista previa, no bloquean): `DIFIERE_DE_DOTACION` (la nave tiene dotación > 0 y se declaró otra cosa), `NAVE_CON_DOCUMENTO_VIGENTE` (existe un `kvaDocGeneradoNaves` vivo de la misma nave y tipo), `NIVEL_MIXTO` (§4.2), `LOGO_NO_DISPONIBLE` (§7).
- **Sin efecto sobre `naves.dotacion*` ni `kvasAsignados`**: el documento declara, no modifica el control de KVA.

### 4.4 Flujo de `POST /kvas/documentos/generar` (todo o nada)

1. `ZodValidationPipe(generarSchema)`; `JwtAuthGuard` + `PermisoGuard(724)`; `@Throttle(10/min)`.
2. **Idempotencia**: `select … from kvaDocGenerados where uidr = :uid and claveIdempotencia = :clave` → si existe: `200 { …, repetido: true }` y fin. Candado en memoria `uid+clave` mientras corre.
3. Cargar plantilla vigente (404/409 si de baja); validar `contenido`/`datosFijos` ajustados con `crearContenidoSchema(tipo)` y `datosFijosSchema` (400).
4. **Resolver** (§4.1): empresa; `kva_naves_elegibles(:emp)`; cada `idNave` del body ∈ resultado (si no: **422** «Alguna nave no corresponde a la empresa elegida»); parques = los de esas naves (BD); `origenKvas` por nave (§4.3); campos (§4.2); `datoFijo` referenciado y vacío → **422 `DATO_FIJO_VACIO`** con la lista.
5. `huella = sha256(JSON canónico de { campos, naves[{idNave,idParque,kvas,origenKvas}], idPlantilla, version })`; si ≠ `huellaCampos` → **409 `DATOS_CAMBIARON`** con la vista previa nueva (cubre cambios de tenencia entre vista previa y generación).
6. `LogoPdfService.obtener()` (best-effort, nunca falla el flujo) y `KvasPdfService.render(modelo)` → `Buffer` (semáforo, timeout 10 s). Comprobar: `contenidoCoincide(buf,'pdf')`, `buf.length ≤ 2 MB`, páginas ≤ 10 → si no **422**.
7. `hashPdf = sha256(buf)`; `idDocGenerado = randomUUID()`; `ruta = rutaSegura(['plantillas', idDocGenerado], 'pdf')`; `storage.from('kvaDocs').upload(ruta, buf, { contentType: 'application/pdf', upsert: false })`.
8. `comoActor(uid).rpc('kva_documento_registrar', {…})` (parámetros: `p_id_doc_generado, p_id_plantilla, p_version, p_id_inversionista, p_empresa, p_fecha, p_contenido, p_datos, p_campos, p_hash, p_bytes, p_ruta, p_clave, p_titulo, p_descripcion, p_naves`) → inserta documento + N filas de expediente + puente en **una** transacción. `p_titulo` = «Asignación de carga — {empresa} — dd/mm/aaaa» recortado a 150.
9. Si el paso 8 falla: `storage.from('kvaDocs').remove([ruta])` (sin huérfanos, mismo patrón de `kvas.service.ts:887-889`); `KV409/REPETIDO` → devolver el documento ya existente; `KV422` → 422; el resto → `fallaBd()` (500 genérico).
10. Respuesta: `201 { idDocGenerado, docs:[{idNave,idDoc}], urlPdf (firmada 1 h), hashPdf, repetido:false }`.

## 5. Endpoints REST (prefijo global `/api`)

Convención del módulo: **baja = `POST …/baja` con motivo** (no `DELETE`). Errores con el filtro global (`AllExceptionsFilter`); mensajes de negocio redactados a mano.
Permisos: «720» = ver KVA's (ya existente). `PermisoGuard` es any-of y **soporte (`isSupport`) siempre pasa**.

### 5.1 Plantillas — `kvas-plantillas.controller.ts` (`@Controller('kvas/plantillas')`, **sin** `@RequierePermiso` de clase)

| Método y ruta | Permiso | Body (Zod) | Respuesta | Errores |
|---|---|---|---|---|
| `GET /kvas/plantillas/catalogo/:tipo` | 730 o 724 | — (param `z.enum(TIPOS)`) | `{ tipo, camposAutomaticos:[{clave,etiqueta,ejemplo}], datosFijos:[{clave,etiqueta,max}], limites }` | 400 tipo |
| `GET /kvas/plantillas?tipo=&incluirBajas=` | 730 o 724 | query: `tipo?`, `incluirBajas?` (solo con 730) | `[{ idPlantilla, tipo, nombre, descripcion, versionActual, status, fc, fum }]` (≤ 200) | — |
| `GET /kvas/plantillas/:id` | 730 o 724 | — | `{ …cabecera, version, contenido, datosFijos, nota, fcVersion }` (la vigente) | 404 |
| `GET /kvas/plantillas/:id/versiones` | 730 | — | `[{ version, nota, uidr, fc }]` DESC (sin contenido) | 404 |
| `GET /kvas/plantillas/:id/versiones/:n` | 730 | — | `{ version, contenido, datosFijos, nota, fc }` | 404 |
| `POST /kvas/plantillas` | **731** | `crearPlantillaSchema` | `201 { idPlantilla, version: 1 }` (rpc `kva_plantilla_crear`) | 400 · 409 `NOMBRE_DUPLICADO` |
| `PUT /kvas/plantillas/:id` | **731** | `guardarPlantillaSchema` (+ contenido validado con el tipo de la cabecera) | `{ version }` nueva (rpc `kva_plantilla_guardar`) | 400 · 404 · **409 `VERSION_DESACTUALIZADA` con `{ versionActual, contenido, datosFijos }`** · 409 `PLANTILLA_DE_BAJA` · 409 `NOMBRE_DUPLICADO` |
| `POST /kvas/plantillas/:id/restaurar` | **731** | `restaurarVersionSchema` | `{ version }` nueva = copia de la elegida (lee la versión elegida y llama `kva_plantilla_guardar`) | 404 · 409 (igual que `PUT`) |
| `POST /kvas/plantillas/:id/baja` | **731** | `bajaSchema` | `{ ok: true }` (rpc `kva_plantilla_baja`) | 404 · 409 ya de baja |

> Las plantillas dadas de baja **no se pueden usar** para generar (409 `PLANTILLA_DE_BAJA`) pero sus versiones y los documentos ya emitidos se conservan.
> Orden de rutas: `catalogo/:tipo` se declara **antes** de `:id` (si no, `:id` capturaría «catalogo»).

### 5.2 Documentos — `kvas-documentos.controller.ts` (`@Controller('kvas/documentos')`)

Sin conflicto con `KvasController` (`kvas/resumen|parque|nave|asignacion|documento|acometida`): verificado en `kvas.controller.ts`. Nota: la ruta existente `POST kvas/documento/:idDoc/baja` (singular) sigue siendo la del expediente; esta es `kvas/documentos` (plural).

| Método y ruta | Permiso | Body / query | Respuesta | Errores |
|---|---|---|---|---|
| `GET /kvas/documentos/empresas?q=` | **724** | `q?` ≤ 60 (filtra por `razonsocial` en memoria) | `[{ idInversionista, razonsocial, rfc, roles:['INVERSIONISTA'\|'ARRENDATARIO'\|'AMBOS'], naves, parques:[{idParque,nomParque,naves}] }]` (hoy 313; tope 1 000) — incluye dueñas **y** arrendatarias (D12) | — |
| `GET /kvas/documentos/empresas/:idInversionista/naves` | **724** | — | `{ empresa:{id,razonsocial}, parques:[{ idParque, nomParque, naves:[{ idNave, numNaveNAME, rol, kvasSugeridos:[{nivel,cantidad}] }] }] }` — **todas** las naves de la empresa, de todos los parques, sin marcar «no elegible» (D10/D13) | 404 empresa |
| `POST /kvas/documentos/vista-previa` | **724** | `vistaPreviaSchema` | `{ camposResueltos:{…7}, naves:[{idNave,numNaveNAME,idParque,kvas:[{nivel,cantidad}],origenKvas}], advertencias:['NIVEL_MIXTO'\|'DIFIERE_DE_DOTACION'\|'NAVE_CON_DOCUMENTO_VIGENTE'\|'LOGO_NO_DISPONIBLE'…], faltantes:['oficio'?…], huellaCampos, contenidoResuelto }` (árbol con `campo`/`datoFijo` sustituidos por `text`, **solo para pintar**; nunca se reenvía) | 400 · 404 · 422 nave ajena |
| `POST /kvas/documentos/vista-previa-pdf` | **724** | `vistaPreviaSchema` | `application/pdf` con marca de agua «VISTA PREVIA»; **no se guarda** ni toca Storage | igual + 422 PDF; `@Throttle(10/min)` |
| `POST /kvas/documentos/generar` | **724** | `generarSchema` | `201 { idDocGenerado, docs:[{idNave,idDoc}], urlPdf, hashPdf, repetido }` (§4.4) | 400 · 404 · 409 `DATOS_CAMBIARON` / `PLANTILLA_DE_BAJA` · 422 `NAVE_NO_PERTENECE` / `DATO_FIJO_VACIO` / PDF · 503 render saturado · 504 timeout; `@Throttle(10/min)` |
| `GET /kvas/documentos?idInversionista=&idParque=&idNave=&incluirBajas=&limit=&offset=` | **720** | `limit` ≤ 100 | `[{ idDocGenerado, tipo, empresaNombre, parques (texto de camposResueltos), fecha, naves:[{idNave,idParque,kvasBt,kvasMt}], status, motivoBaja, fc, urlPdf }]` (URLs con `firmarVarias`); el filtro `idParque`/`idNave` se resuelve por la tabla puente | — |
| `GET /kvas/documentos/:idDocGenerado` | **720** | — | detalle + `camposResueltos`, `version`, `hashPdf`, naves, `urlPdf` | 404 |
| `POST /kvas/documentos/:idDocGenerado/baja` | **723 o 724** | `bajaSchema` | `{ ok: true }` (rpc `kva_documento_baja`: baja el documento **y** todas sus filas del expediente) | 404 · 409 ya de baja |

**Cambio en código existente (X-9)** — `kvas.service.ts#bajaDocumentoNave`: antes de actualizar, `select idDoc from kvaDocGeneradoNaves where idDoc = :idDoc`; si existe → `ConflictException('Este documento fue generado desde una plantilla: dalo de baja desde el documento generado, para que todas sus naves queden consistentes.')`.

### 5.3 Matriz de permisos (resumen)

| Acción | 720 | 724 | 730 | 731 | 723 |
|---|:-:|:-:|:-:|:-:|:-:|
| Ver catálogo / lista / detalle de plantillas | | ✔ | ✔ | | |
| Ver versiones, historial | | | ✔ | | |
| Crear, guardar, restaurar, baja de plantilla | | | | ✔ | |
| Empresas / naves elegibles, vista previa, generar | | ✔ | | | |
| Ver documentos generados | ✔ | | | | |
| Baja de documento generado | | ✔ | | | ✔ |
| Soporte (`isSupport`) | todo | todo | todo | todo | todo |

## 6. Permisos nuevos (claves sin colisión)

Verificado: en `segModulos` no existen 724, 730, 731; `max(clave)` global = 801; ni `@RequierePermiso` ni `menu.tsx` los usan.

| Clave | `modulo` / `seccion` / `area` | Texto para `permisos-descripciones.ts` |
|---|---|---|
| **724** | `Parques` / `KVA's` / `Generar documento` | `Generar documentos de KVA's (p. ej. la carta de Asignación de Carga a CFE) a partir de una plantilla: elegir empresa y naves, ver la vista previa, emitir el PDF —que queda en el expediente de cada nave— y darlo de baja con motivo.` |
| **730** | `Parques` / `Plantillas` / `Modulo` | `Entrar a Parques → Plantillas: consultar las plantillas de documentos de KVA's y el historial de versiones de cada una. Quien genera documentos desde KVA's también las lee.` |
| **731** | `Parques` / `Plantillas` / `Editar` | `Crear plantillas de documentos de KVA's, guardar cambios (cada guardado crea una versión nueva), restaurar una versión anterior y dar de baja una plantilla. No modifica los documentos ya generados.` |

Front: `menu.tsx` + ítem `{ label: 'Plantillas', to: '/parques/plantillas', clave: 730 }` bajo Parques; `permisos-descripciones.ts` + las 3 descripciones (si falta una, la pantalla de Permisos pinta «—»: lo avisa el propio archivo, líneas 17-18).

## 7. Motor de PDF (`kvas-pdf.service.ts`)

- Dependencia: **`pdfmake` ^0.3** (+ `@types/pdfmake`) en `apps/api`. JS puro: no cambia el `Dockerfile` (`pnpm deploy --prod` la incluye); **sin Chromium**.
- Entrada: `{ contenidoResuelto (árbol ya sin campos), fecha, titulo, folio, vistaPrevia: boolean, logo?: { buffer: Buffer; formato: 'png' \| 'jpg' } }`. Salida: `Buffer`. No toca BD ni red.
- **Logo y membrete (D11) — `kvas-logo-pdf.service.ts`, `LogoPdfService.obtener()`:**
  ```ts
  // ConfiguracionModule es @Global → se inyecta ConfiguracionService (obtenerLogos(): { claro, oscuro, favicon }).
  const { claro } = await this.config.obtenerLogos();            // { url, ancho, alto } de LOGO_FONDO_CLARO (hoy: .jpg, 400 px)
  const base = `${SUPABASE_URL}/storage/v1/object/public/branding/`;
  if (!claro.url || !claro.url.startsWith(base)) return null;     // anti-SSRF: solo el bucket público branding del proyecto
  const cache = this.cache.get(claro.url);                        // clave = URL completa (lleva ?v=timestamp → se invalida sola); TTL 10 min
  const res = await fetch(claro.url, { redirect: 'error', signal: AbortSignal.timeout(5000) });
  const buf = Buffer.from(await res.arrayBuffer());               // tope 2 MB (límite del bucket); si excede → null
  const formato = contenidoCoincide(buf, 'png') ? 'png' : contenidoCoincide(buf, 'jpg') ? 'jpg' : null;  // magic bytes (archivo-seguro.ts)
  return formato ? { buffer: buf, formato } : null;               // SVG/WebP → null (pdfmake solo soporta PNG y JPEG)
  ```
  Cualquier excepción (red, 404, tipo) se registra con `Logger.warn` y devuelve `null`. **Sin logo el PDF se genera igual** (membrete sin imagen) y la vista previa añade `LOGO_NO_DISPONIBLE`. Tamaño: `image: dataURI, fit: [150, 60]` (pt) en el encabezado de la **primera** página, alineado a la izquierda; el `ancho` de la configuración no se usa como medida. Pie de todas las páginas: «Documento generado el dd/mm/aaaa · Folio {primeros 8 de idDocGenerado} · pág. n de m». Texto adicional del membrete (razón social/domicilio de la plataforma): **no existe en la BD** → pregunta N-1 del TRD.
- Mapeo: `paragraph → { text:[…], alignment }`; `heading 1-3 → tamaños fijos`; `bulletList/orderedList → ul/ol`; `bold/italic/underline → { bold, italics, decoration:'underline' }`; `hardBreak → '\n'`. Estilo corporativo fijo en el servidor (azul `#1f2a4d` solo en títulos/pie; texto negro; Roboto; margen carta). **Ningún** valor del árbol se interpreta como estilo ni como código.
- Metadatos: `info.title` = título; `info.creationDate` = fecha del documento (sin autor del usuario).
- Control: `class Semaforo(2)` + `Promise.race` con 10 s + comprobación de tamaño y páginas (`/\/Type\s*\/Page[^s]/g` sobre el buffer). Errores → 503/504/422 genéricos; el detalle al `Logger`.
- Pruebas: snapshot del árbol→docDefinition; PDF del ejemplo del cliente (8 naves) < 100 KB y 1 página; fuzz con árboles hostiles (profundidad, 2 000 nodos, 50 000 caracteres) dentro de tiempo.

## 8. Concurrencia, idempotencia y límites (resumen operativo)

| Caso | Mecanismo | Resultado visible |
|---|---|---|
| Dos editores guardan la misma plantilla | `kva_plantilla_guardar` + `SELECT … FOR UPDATE` + `baseVersion` | El segundo recibe 409 con la versión vigente; nada se pierde (versiones inmutables) |
| Doble clic en «Generar» | `claveIdempotencia` + índice único `(uidr, claveIdempotencia)` + candado en memoria + `REPETIDO` | Un solo documento; la segunda llamada devuelve el mismo (`repetido: true`) |
| Tenencia, naves o cantidades cambian entre vista previa y generar | `huellaCampos` (servicio) + `NAVE_NO_PERTENECE` (SQL) | 409/422 con vista previa nueva (la dotación ya no cuenta: D10) |
| Plantilla dada de baja mientras alguien genera | Revalidación en `kva_documento_registrar` | 409 `PLANTILLA_DE_BAJA` |
| Documento enorme | Límites de §3 + semáforo + timeout + PDF ≤ 2 MB / 10 págs | 400/422/503/504 |
| Sin actor (llamada con `admin` en lugar de `comoActor`) | `kva_actor()` nulo → `KV401` | 500 genérico: es un bug del servidor, no del usuario |

Límites: contenido 200 KB · 2 000 nodos · profundidad 6 · 50 000 caracteres · 50 naves/documento · PDF 2 MB · 10 páginas · 10 generaciones/min por usuario · ≤ 200 plantillas vivas · aviso a 500 versiones.

## 9. Seguridad — verificación de las amenazas (ver TRD §6 para la tabla completa)

| Amenaza | Prueba negativa que debe existir |
|---|---|
| HTML/JSON inyectado | `contenido` con `{"type":"image"}`, `{"type":"text","marks":[{"type":"link","attrs":{"href":"javascript:…"}}]}`, `attrs` extra, `__proto__` → 400 |
| Campo fuera del catálogo | `{"type":"campo","attrs":{"clave":"password"}}` → 400; clave válida de otro tipo → 400 |
| Nave de otra empresa | `idNave` de una nave que no es ni de la empresa como dueña ni como arrendataria → 422 mensaje único; y dentro de `kva_documento_registrar` aunque el servicio se saltara el chequeo → `KV422` |
| Parque falsificado (D13) | Body con un `idParque` extra → 400 (no existe en el esquema); las filas de `kvaNaveDocs` y la puente llevan el `idParque` de `naves` |
| Cantidad declarada hostil (D10) | `cantidad` = -1, 0, 1e9, 1.234, `"abc"`, `NaN`; `nivel` = `"XX"`; nivel repetido; `kvas: []`; 3 entradas → 400. Texto inyectado: imposible por esa vía (el servidor redacta) |
| Logo ajeno | URL fuera de `…/storage/v1/object/public/branding/`, redirección, archivo > 2 MB, SVG/WebP, contenido no-imagen → PDF sin logo + `LOGO_NO_DISPONIBLE`, nunca error |
| Unión dueño ∪ arrendatario (D12) | Una nave con dueño A y arrendatario B: aparece en las listas de A y de B; un `generar` para A con esa nave funciona; para una empresa C → 422 |
| Path traversal | Ninguna ruta usa texto del cliente; test: la ruta guardada coincide con `^\d{4}-\d{2}/plantillas/[0-9a-f-]{36}\.pdf$` |
| DoS | Árbol de 3 000 nodos, texto de 60 000 caracteres, 60 naves, ráfaga de 20 `generar` → 400/429 sin degradar el API |
| Acceso directo PostgREST | Con llave `anon` y con JWT de usuario `authenticated`: `select` en las 4 tablas y `rpc` de las 7 funciones → denegado |
| Mutar lo inmutable | `update kvaPlantillaVersiones`, `delete kvaDocGenerados`, `update kvaDocGenerados set "contenidoFinal"=…` → `KV423` |
| Fuga de errores | Forzar `KV409/KV422` y un error de SQL: el cliente nunca ve nombres de tabla/columna |

## 10. Verificación posterior al construir (checklist para el ejecutor y el validador)

1. `tsc --noEmit`, `eslint`, `jest` del API; pruebas unitarias de `agruparNaves`/`redactarKvas`/esquemas hostiles (casos de §3-§4).
2. Migración en una **rama** de Supabase primero (`create_branch`), con las consultas de verificación del §2; luego producción con visto bueno de Toribio.
3. Prueba de integración «generar» de punta a punta, en dos casos: (a) una empresa de Spartek con dotación (prellenado, `origenKvas = DOTACION`); (b) **EM BAJÍO EMPAQUES** (Acupark III, dotación 0, teclear «5» en 8 naves → «107-110 y 119-122», «5 KVAS», `origenKvas = DECLARADO`) y una empresa con naves en dos parques (`parque` = «A y B»). Verificar: 1 `kvaDocGenerados`, N filas en `kvaNaveDocs` y en la puente, 1 archivo en `kvaDocs`, `hashPdf` = SHA-256 del archivo descargado, filas de auditoría con `origen = 2` y el `uid` del actor.
4. Regresión: el expediente de la nave (`documentosDeNave`) lista el documento generado; la baja manual de esa fila responde 409; la baja del documento generado da de baja todas.
5. Validador adversarial Opus (obligatorio: permisos, RLS/REVOKE, migración, entrada hostil, dinero indirecto —documento ante CFE—): confirmar que `07-VERIFICACION-ADVERSARIAL.md` cubre S-1…S-15 y las 4 decisiones de esquema (D-1, D-2, X-6, D-6).
6. Cierre: regenerar `database.types.ts`, diagrama de BD (`diagrama-bd`), KB `kvas.md` (sección nueva) y descripciones de permisos.
