-- ============================================================================
-- Notas por entidad (chat de notas reutilizable) — 2026-10-07
-- Primer uso: Arrendatarios > Planes de Renta (una conversación por plan).
-- Genérica: cada nota se ubica por modulo + pantalla + entidadTipo + entidadId,
-- para replicarla en otras pantallas sin tablas nuevas.
--
-- tipo='usuario' : nota escrita por una persona (uid = autor).
-- tipo='sistema' : aviso automático de MontseAI (uid = quien provocó el cambio;
--                  el mensaje se muestra a nombre de MontseAI, nunca del usuario).
-- Solo backend (service_role): RLS activo SIN políticas (igual que
-- incidentes_seguimientos). Baja de notas = DELETE (queda rastro en auditoria).
-- Objeto NUEVO: no modifica ni depende de ningún objeto existente salvo la
-- función de auditoría fn_auditoria.
-- ============================================================================

create table public."notasEntidad" (
  id            uuid        primary key default gen_random_uuid(),
  modulo        text        not null,
  pantalla      text        not null,
  "entidadTipo" text        not null,
  "entidadId"   text        not null,
  tipo          text        not null default 'usuario'
                            check (tipo in ('usuario', 'sistema')),
  evento        text,
  texto         text        not null
                            check (char_length(btrim(texto)) between 1 and 2000),
  detalle       jsonb,
  uid           uuid,
  fc            timestamptz not null default now(),
  fa            timestamptz not null default now(),
  constraint "notasEntidad_sistema_con_evento"
    check (tipo = 'usuario' or evento is not null)
);

create index "notasEntidad_entidad_idx"
  on public."notasEntidad" (modulo, "entidadTipo", "entidadId", fc);

alter table public."notasEntidad" enable row level security;
revoke all on public."notasEntidad" from anon, authenticated;

create trigger trg_auditoria
  after insert or update or delete on public."notasEntidad"
  for each row execute function fn_auditoria('id');

comment on table public."notasEntidad" is
  'Notas/chat por entidad (reutilizable). Se ubica por modulo+pantalla+entidadTipo+entidadId. tipo=usuario (persona) o sistema (aviso de MontseAI, agrupable vía detalle.cambios). Objeto nuevo v2; solo backend (service_role).';
comment on column public."notasEntidad".evento is
  'Solo tipo=sistema: cambio_manual | inpc | contrato | cancelacion | liberacion.';
comment on column public."notasEntidad".detalle is
  'Tipo=sistema: datos del aviso (p. ej. cambios[] agrupados con campo, antes→después).';
comment on column public."notasEntidad".uid is
  'Autor (tipo=usuario) o quien provocó el cambio (tipo=sistema). Sale del JWT, nunca del body.';
comment on column public."notasEntidad".fa is
  'Última actualización (los avisos agrupados se actualizan en vez de duplicarse).';


-- ----------------------------------------------------------------------------
-- Candados adicionales (migración `notas_entidad_candados`, aplicada en prod
-- el 2026-10-07 con visto bueno de Jereff; recomendados por el validador).
-- ----------------------------------------------------------------------------
alter table public."notasEntidad"
  add constraint "notasEntidad_evento_valido"
    check (evento is null or evento in ('cambio_manual','inpc','contrato','cancelacion','liberacion')),
  add constraint "notasEntidad_usuario_con_uid"
    check (tipo = 'sistema' or uid is not null);
create index "notasEntidad_pantalla_idx"
  on public."notasEntidad" (modulo, pantalla, "entidadTipo", "entidadId", fc);

-- Rollback (si hiciera falta): drop table public."notasEntidad";
