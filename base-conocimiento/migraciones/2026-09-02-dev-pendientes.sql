-- =============================================================================
-- Tablero de pendientes del proyecto — tabla `dev_pendientes`
-- Fecha: 2026-09-02 · Autor: Toribio/Opus 5
-- Skill: ~/.claude/skills/tablero-pendientes/SKILL.md
--
-- CONTEXTO
-- Hoy los pendientes del proyecto viven repartidos en CINCO lugares:
--   1. version2/base-conocimiento/DEUDA.md      (32 IDs + 12 hallazgos SIN ID)
--   2. .sessions/base-conocimiento/DEUDA.md     (version de julio, desfasada)
--   3. .sessions/contexto.md §8 y §9            (proximos pasos / trabajo diferido)
--   4. Las secciones "Estado y pendientes" de base-conocimiento/modulos/*.md
--   5. Lo que dejo dicho la ultima sesion en la bitacora
-- Un pendiente anotado en dos lugares se desincroniza y termina mintiendo en los
-- dos. Verificado en vivo el 2026-09-02 al preparar esta migracion: los documentos
-- decian "~80 politicas USING(true)" cuando son 130, "3 buckets publicos" cuando
-- son 5, y "51 funciones definer expuestas a anon" cuando son 57.
--
-- QUE HACE ESTA MIGRACION
--   1. Tabla `dev_pendientes`: destino UNICO de todo trabajo pendiente.
--   2. Indice (estado, urgencia, id DESC): es exactamente el orden del listado.
--   3. RLS ON sin politicas + REVOKE  -> solo el backend (service_role) la toca.
--      En la app el gate es SoporteGuard (catUsers.isSupport), sin clave de
--      permiso: el tablero lista deuda tecnica y hallazgos de seguridad, que no
--      son material para repartir con una clave asignable. Hoy isSupport lo tiene
--      1 sola persona (verificado el 2026-09-02).
--   4. trg_auditoria (regla 6 del proyecto).
--   5. Trigger de `fm` (fecha de modificacion) con search_path fijo.
--
-- ES 100 % ADITIVA: crea objetos nuevos, no altera ni lee nada existente.
-- Reversible con el bloque del final.
-- =============================================================================

-- 1) Tabla ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dev_pendientes (
  -- `id` ES el folio corto para hablar ("el 12"). El orden de captura ya es
  -- informacion, por eso serial y no uuid.
  id                bigserial   PRIMARY KEY,
  titulo            text        NOT NULL,
  descripcion       text        NULL,
  notas             text        NULL,
  -- Traza al analisis largo: "DEUDA.md P0-1", "contexto.md §9", "Sesion 2026-08-26".
  origen            text        NULL,
  tipo              text        NOT NULL DEFAULT 'deuda_tecnica',
  urgencia          text        NOT NULL DEFAULT 'p2',
  estado            text        NOT NULL DEFAULT 'propuesto',
  -- TEXTO LIBRE a proposito: los modulos nacen y se renombran mas rapido de lo
  -- que costaria mantener un catalogo, y un pendiente puede ser transversal.
  modulo            text        NULL,
  version_resuelto  text        NULL,
  resuelto_at       timestamptz NULL,
  fc                timestamptz NOT NULL DEFAULT now(),
  fm                timestamptz NOT NULL DEFAULT now(),
  -- catUsers.uid de quien lo capturo (lo pone el backend desde el JWT).
  "creadoPor"       uuid        NULL,

  CONSTRAINT dev_pendientes_titulo_chk
    CHECK (length(btrim(titulo)) > 0),
  CONSTRAINT dev_pendientes_tipo_chk
    CHECK (tipo IN ('modulo_nuevo','mejora','bug','deuda_tecnica','seguridad','datos')),
  CONSTRAINT dev_pendientes_urgencia_chk
    CHECK (urgencia IN ('p0','p1','p2','p3')),
  CONSTRAINT dev_pendientes_estado_chk
    CHECK (estado IN ('propuesto','aprobado','en_curso','bloqueado','terminado','descartado'))
);

COMMENT ON TABLE public.dev_pendientes IS
  'Tablero de pendientes del proyecto: destino UNICO de todo trabajo pendiente (deuda tecnica, bug conocido, mejora, modulo nuevo, peticion de negocio, decision abierta). Objeto nuevo de v2; solo lo escribe el backend (service_role) y solo lo ve personal con catUsers.isSupport. Los archivos DEUDA.md quedan congelados como historico de solo lectura: el estado vigente es el de la fila.';

COMMENT ON COLUMN public.dev_pendientes.id IS
  'Folio corto del pendiente. Es el numero con el que se le nombra en una conversacion.';
COMMENT ON COLUMN public.dev_pendientes.titulo IS
  'El problema afirmado en lenguaje de negocio, no un identificador. Bien: "Cualquier usuario autenticado puede concederse permisos". Mal: "P0-3".';
COMMENT ON COLUMN public.dev_pendientes.descripcion IS
  'El QUE y el POR QUE, con evidencia concreta (archivo:linea, tabla, cifras reales) y, si se difirio, POR QUE se difirio. La fila debe bastarse sola: si hay que abrir otro archivo para entenderla, esta mal escrita.';
COMMENT ON COLUMN public.dev_pendientes.notas IS
  'El arreglo propuesto y las trampas al implementarlo. Es lo que ahorra rehacer el analisis la proxima vez.';
COMMENT ON COLUMN public.dev_pendientes.origen IS
  'Traza al analisis largo (DEUDA.md P0-1, contexto.md §9, Sesion YYYY-MM-DD, quien lo pidio). Sirve para LEER el detalle, nunca para saber el ESTADO.';
COMMENT ON COLUMN public.dev_pendientes.tipo IS
  'modulo_nuevo (exige gate de diseno) | mejora | bug | deuda_tecnica | seguridad | datos.';
COMMENT ON COLUMN public.dev_pendientes.urgencia IS
  'p0 critica (se atiende ya) | p1 alta | p2 media | p3 cuando se pueda. Si todo es p0, nada es p0.';
COMMENT ON COLUMN public.dev_pendientes.estado IS
  'propuesto | aprobado | en_curso | bloqueado | terminado | descartado. "bloqueado" es la etiqueta mas util: separa "no lo hemos hecho" de "no lo podemos hacer todavia" (espera una decision, un tercero u otro pendiente).';
COMMENT ON COLUMN public.dev_pendientes.modulo IS
  'Modulo de negocio al que pertenece. Texto libre a proposito (sin FK a catalogo).';
COMMENT ON COLUMN public.dev_pendientes.version_resuelto IS
  'SemVer en el que se resolvio (cierra el circulo con v2_changelog).';
COMMENT ON COLUMN public.dev_pendientes.resuelto_at IS
  'Se sella al pasar a terminado/descartado y se LIMPIA al reabrir (lo hace el backend, no a mano): si no, un reabierto seguiria contando como resuelto.';

-- 2) Indice del listado --------------------------------------------------------
-- Es exactamente el orden de la pantalla: primero lo abierto, dentro por urgencia,
-- luego lo mas reciente.
CREATE INDEX IF NOT EXISTS ix_dev_pendientes_listado
  ON public.dev_pendientes (estado, urgencia, id DESC);

-- 3) Seguridad: RLS ON sin politicas -> solo service_role (backend) ------------
-- Segunda capa real: aunque alguien llamara el endpoint sin ser isSupport, la
-- tabla no es alcanzable con anon ni authenticated.
ALTER TABLE public.dev_pendientes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dev_pendientes FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.dev_pendientes_id_seq FROM anon, authenticated;

-- 4) Auditoria obligatoria (regla 6) ------------------------------------------
DROP TRIGGER IF EXISTS trg_auditoria ON public.dev_pendientes;
CREATE TRIGGER trg_auditoria
  AFTER INSERT OR UPDATE OR DELETE ON public.dev_pendientes
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria('id');

-- 5) Fecha de modificacion -----------------------------------------------------
-- search_path fijo a proposito: 163 funciones heredadas lo tienen mutable (P1-4);
-- los objetos nuevos no suman a esa deuda.
CREATE OR REPLACE FUNCTION public.fn_dev_pendientes_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
BEGIN
  NEW.fm := now();
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_dev_pendientes_touch() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_dev_pendientes_touch ON public.dev_pendientes;
CREATE TRIGGER trg_dev_pendientes_touch
  BEFORE UPDATE ON public.dev_pendientes
  FOR EACH ROW EXECUTE FUNCTION public.fn_dev_pendientes_touch();

-- 6) Verificacion (correr despues de aplicar) ---------------------------------
-- SELECT
--   (SELECT count(*) FROM information_schema.tables
--     WHERE table_schema='public' AND table_name='dev_pendientes')            AS tabla,
--   (SELECT relrowsecurity FROM pg_class WHERE oid='public.dev_pendientes'::regclass) AS rls_on,
--   (SELECT count(*) FROM information_schema.role_table_grants
--     WHERE table_schema='public' AND table_name='dev_pendientes'
--       AND grantee IN ('anon','authenticated'))                              AS grants_publicos,
--   (SELECT count(*) FROM pg_trigger
--     WHERE tgrelid='public.dev_pendientes'::regclass AND NOT tgisinternal)   AS triggers;
-- Esperado: tabla=1, rls_on=true, grants_publicos=0, triggers=2

-- =============================================================================
-- ROLLBACK (si hiciera falta deshacer)
-- =============================================================================
-- DROP TRIGGER IF EXISTS trg_dev_pendientes_touch ON public.dev_pendientes;
-- DROP TRIGGER IF EXISTS trg_auditoria ON public.dev_pendientes;
-- DROP FUNCTION IF EXISTS public.fn_dev_pendientes_touch();
-- DROP TABLE IF EXISTS public.dev_pendientes;
