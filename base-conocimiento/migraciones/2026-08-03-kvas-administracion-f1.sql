-- =============================================================================
-- Migración v2 · Administración de KVA's — FASE 1 (esquema)  ·  2026-08-03
-- Plan: base-conocimiento/PLAN-administracion-kvas.md
-- ⛔ REQUIERE AUTORIZACIÓN EXPLÍCITA DE JEREFF ANTES DE APLICAR (toca `parques`,
--    `kvasAsignados` y sus triggers, en PRODUCCIÓN).
--
-- CONTEXTO
--   `parques` llama "Alta/Media" a lo que el negocio llama "Media/Baja" tensión.
--   `kvasAsignados` guarda el nivel y la figura en dos smallint SIN catálogo, con
--   la convención INVERTIDA entre el trigger (2=Alta) y el código v2 (1=alta).
--   v1 (FlutterFlow) está APAGADO desde 2026-06-21, así que el rename no rompe
--   la app vieja. Los 10 parques reales tienen los KVA en 0 y `kvasAsignados`
--   tiene 3 filas, todas de "Prueba Parque": no hay dato productivo en riesgo.
--
-- QUÉ HACE
--   1. parques: rename Alta→Mt / Media→Bt + integer→numeric(12,2) + regenera las
--      2 columnas GENERADAS + nueva columna `idAcometida`.
--   2. Tabla nueva `kvaAcometidas` (la fuente física contratada a CFE).
--   3. kvasAsignados: columnas nuevas (nivel, figura, etapa, contrato CFE,
--      vínculos, cantDevuelta) y migración de las 3 filas existentes.
--      ⚠️ `tipoTension`/`tipoContrato` se CONSERVAN (deprecadas) — su DROP va en
--      una migración F1b, DESPUÉS de desplegar el código corregido.
--   4. Tabla nueva `kvaDevoluciones` (acredita el regreso de KVA vendidos).
--   5. Motor de saldo REESCRITO: se pasa de deltas incrementales a RECÁLCULO
--      desde la fuente (más simple y no se desincroniza).
--   6. RLS + trg_auditoria en las tablas nuevas + permisos 720/721/722.
--
-- 📌 SUPUESTOS A CONFIRMAR (marcados en el PLAN §5/§6.1)
--   a) `kvasAlta` de la BD = **Media** tensión real; `kvasMedia` = **Baja**.
--   b) `tipoContrato = 1` = VENTA. Afecta a 3 filas de prueba; si es al revés se
--      corrige con un UPDATE de 3 filas.
--
-- REVERSIBLE: al final del archivo (sección 9), rollback completo.
-- TRAS APLICAR: regenerar packages/types/src/database.types.ts + build de @erp/types.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 0) Bajar los triggers viejos ANTES de tocar tipos
--    Postgres rechaza `ALTER COLUMN ... TYPE` si la columna aparece en la
--    definición de un trigger (`UPDATE OF "kvasAlta","kvasMedia"`):
--      ERROR 0A000: cannot alter type of a column used in a trigger definition
--    Ambos se recrean en la sección 5 con la lógica nueva.
-- =============================================================================
DROP TRIGGER IF EXISTS trg_parques_actualizar_kvas_disponibles ON public.parques;
DROP TRIGGER IF EXISTS trg_kvasasignados_actualizar_parques_kvasdisponibles ON public."kvasAsignados";

-- =============================================================================
-- 1) `parques` · rename + numeric + columnas generadas
--    Las generadas se DROPean primero porque dependen de las que se renombran.
-- =============================================================================
ALTER TABLE public.parques DROP COLUMN IF EXISTS "kvasAltaUtilizados";
ALTER TABLE public.parques DROP COLUMN IF EXISTS "kvasMediaUtilizados";

ALTER TABLE public.parques RENAME COLUMN "kvasAlta"             TO "kvasMt";
ALTER TABLE public.parques RENAME COLUMN "kvasAltaDisponibles"  TO "kvasMtDisponibles";
ALTER TABLE public.parques RENAME COLUMN "kvasMedia"            TO "kvasBt";
ALTER TABLE public.parques RENAME COLUMN "kvasMediaDisponibles" TO "kvasBtDisponibles";

-- Decimales reales del control operativo (Acupark II: 732.5 BT / 2620.5 MT).
ALTER TABLE public.parques
  ALTER COLUMN "kvasMt"             TYPE numeric(12,2),
  ALTER COLUMN "kvasMtDisponibles"  TYPE numeric(12,2),
  ALTER COLUMN "kvasBt"             TYPE numeric(12,2),
  ALTER COLUMN "kvasBtDisponibles"  TYPE numeric(12,2);

-- Se recrean con el nombre nuevo. NO se acotan a 0: un disponible NEGATIVO es un
-- sobregiro real y debe VERSE (el Excel operativo ya trae -283 en Spartek).
ALTER TABLE public.parques
  ADD COLUMN "kvasMtUtilizados" numeric(12,2)
    GENERATED ALWAYS AS ("kvasMt" - "kvasMtDisponibles") STORED,
  ADD COLUMN "kvasBtUtilizados" numeric(12,2)
    GENERATED ALWAYS AS ("kvasBt" - "kvasBtDisponibles") STORED;

COMMENT ON COLUMN public.parques."kvasMt" IS 'Capacidad electrica del parque en MEDIA tension (KVA). Antes se llamaba kvasAlta.';
COMMENT ON COLUMN public.parques."kvasBt" IS 'Capacidad electrica del parque en BAJA tension (KVA). Antes se llamaba kvasMedia.';
COMMENT ON COLUMN public.parques."kvasMtDisponibles" IS 'KVA de media tension sin asignar. Lo recalcula kva_recalcular_disponibles(); puede ser NEGATIVO si hay sobregiro.';
COMMENT ON COLUMN public.parques."kvasBtDisponibles" IS 'KVA de baja tension sin asignar. Lo recalcula kva_recalcular_disponibles(); puede ser NEGATIVO si hay sobregiro.';

-- =============================================================================
-- 2) Tabla nueva `kvaAcometidas` — la fuente física contratada con CFE
--    Un parque cuelga de una acometida; una acometida puede alimentar VARIOS
--    parques (caso real: Spartek I y II comparten 34.5 kV).
-- =============================================================================
CREATE TABLE IF NOT EXISTS public."kvaAcometidas" (
  "idAcometida"  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre         text          NOT NULL,
  "tensionKv"    numeric(6,2),
  "capacidadMt"  numeric(12,2) NOT NULL DEFAULT 0,
  "capacidadBt"  numeric(12,2) NOT NULL DEFAULT 0,
  "folioCfe"     text,
  notas          text,
  status         boolean       NOT NULL DEFAULT true,
  uidr           uuid,
  fc             timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public."kvaAcometidas" IS
  'Acometida electrica: la fuente fisica contratada con CFE (capacidad en media y baja tension). Alimenta a uno o varios parques. Objeto nuevo v2; solo backend (service_role).';

ALTER TABLE public.parques ADD COLUMN IF NOT EXISTS "idAcometida" uuid
  REFERENCES public."kvaAcometidas"("idAcometida");

COMMENT ON COLUMN public.parques."idAcometida" IS
  'Acometida de la que cuelga el parque. NULL si aun no se captura. La suma de capacidades de los parques de una acometida no deberia exceder la de la acometida (se valida en backend, no se bloquea).';

CREATE INDEX IF NOT EXISTS ix_parques_acometida ON public.parques ("idAcometida");

-- =============================================================================
-- 3) `kvasAsignados` · columnas nuevas + migración de las 3 filas existentes
-- =============================================================================
ALTER TABLE public."kvasAsignados"
  ADD COLUMN IF NOT EXISTS nivel              text,
  ADD COLUMN IF NOT EXISTS figura             text,
  ADD COLUMN IF NOT EXISTS etapa              text,
  ADD COLUMN IF NOT EXISTS "contratoCfe"      text,
  ADD COLUMN IF NOT EXISTS "fechaContratoCfe" date,
  ADD COLUMN IF NOT EXISTS "idPropiedad"      text,
  ADD COLUMN IF NOT EXISTS "idNavArrend"      text,
  ADD COLUMN IF NOT EXISTS "cantDevuelta"     numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "motivoBaja"       text;

ALTER TABLE public."kvasAsignados"
  ALTER COLUMN "cantKvas" TYPE numeric(12,2);

-- Migración de datos (3 filas de "Prueba Parque").
--   nivel: se toma la convención del TRIGGER, que es la que produjo los saldos
--   reales (tipoTension=2 descontaba de kvasAlta => 2 = MEDIA tension).
UPDATE public."kvasAsignados"
   SET nivel  = CASE "tipoTension"  WHEN 2 THEN 'MT' WHEN 1 THEN 'BT' END,
       figura = CASE "tipoContrato" WHEN 1 THEN 'VENTA' WHEN 2 THEN 'RENTA' END,  -- 📌 supuesto (b)
       etapa  = COALESCE(etapa, 'POR_ASIGNAR')
 WHERE nivel IS NULL OR figura IS NULL OR etapa IS NULL;

ALTER TABLE public."kvasAsignados"
  ALTER COLUMN nivel  SET NOT NULL,
  ALTER COLUMN figura SET NOT NULL,
  ALTER COLUMN etapa  SET NOT NULL,
  ALTER COLUMN etapa  SET DEFAULT 'POR_ASIGNAR';

ALTER TABLE public."kvasAsignados"
  ADD CONSTRAINT kvasasignados_nivel_ck  CHECK (nivel  IN ('MT','BT')),
  ADD CONSTRAINT kvasasignados_figura_ck CHECK (figura IN ('VENTA','RENTA')),
  ADD CONSTRAINT kvasasignados_etapa_ck  CHECK (etapa  IN ('POR_ASIGNAR','COMPROMETIDO','ASIGNADO')),
  ADD CONSTRAINT kvasasignados_cant_ck   CHECK ("cantKvas" >= 0 AND "cantDevuelta" >= 0
                                                AND "cantDevuelta" <= "cantKvas");

COMMENT ON COLUMN public."kvasAsignados".nivel IS 'Nivel de tension del KVA asignado: MT = media, BT = baja. Sustituye al smallint tipoTension (sin catalogo y con convencion invertida entre el trigger y el codigo v2).';
COMMENT ON COLUMN public."kvasAsignados".figura IS 'Bajo que figura se entrego el KVA: VENTA (se va con la nave; solo regresa al parque con devolucion acreditada) o RENTA (regresa solo al cerrar el vinculo). Sustituye al smallint tipoContrato.';
COMMENT ON COLUMN public."kvasAsignados".etapa IS 'Etapa del tramite, tomada del control operativo: POR_ASIGNAR (reservado del paquete de la nave), COMPROMETIDO (apalabrado con el inquilino) o ASIGNADO (ya hay contrato con CFE a nombre del usuario final).';
COMMENT ON COLUMN public."kvasAsignados"."contratoCfe" IS 'Numero de servicio/contrato de CFE del usuario final. Es lo que hace real la etapa ASIGNADO.';
COMMENT ON COLUMN public."kvasAsignados"."cantDevuelta" IS 'KVA ya devueltos al parque y acreditados con documento. Lo mantiene el trigger de kvaDevoluciones; NO se escribe a mano.';
COMMENT ON COLUMN public."kvasAsignados"."tipoTension" IS 'DEPRECADA (2026-08-03): sustituida por `nivel`. Se elimina en la migracion F1b, tras desplegar el codigo corregido.';
COMMENT ON COLUMN public."kvasAsignados"."tipoContrato" IS 'DEPRECADA (2026-08-03): sustituida por `figura`. Se elimina en la migracion F1b.';

CREATE INDEX IF NOT EXISTS ix_kvasasignados_nave   ON public."kvasAsignados" ("idNave");
CREATE INDEX IF NOT EXISTS ix_kvasasignados_parque ON public."kvasAsignados" ("idParque", nivel);

-- =============================================================================
-- 4) Tabla nueva `kvaDevoluciones` — acredita el regreso de KVA VENDIDOS
--    Requisito de negocio: no se libera una nave con KVA vendidos si no está
--    documentado que regresaron al parque.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public."kvaDevoluciones" (
  "idDevolucion"    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  "idKvas"          uuid          NOT NULL REFERENCES public."kvasAsignados"("idKvas") ON DELETE RESTRICT,
  cantidad          numeric(12,2) NOT NULL CHECK (cantidad > 0),
  "fechaDevolucion" date          NOT NULL DEFAULT current_date,
  documento         text          NOT NULL,          -- folio/numero del comprobante
  urldoc            text          NOT NULL,          -- bucket PRIVADO, servido firmado
  observaciones     text,
  "uidValida"       uuid,                            -- quien la dio por buena (si aplica)
  status            boolean       NOT NULL DEFAULT true,
  uidr              uuid,
  fc                timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public."kvaDevoluciones" IS
  'Acredita con documento que unos KVA VENDIDOS regresaron al parque. Mientras no exista, la nave no se puede liberar. Objeto nuevo v2; solo backend (service_role).';

CREATE INDEX IF NOT EXISTS ix_kvadevoluciones_kvas ON public."kvaDevoluciones" ("idKvas");

-- =============================================================================
-- 5) MOTOR DE SALDO — recálculo desde la fuente (sustituye los deltas)
--
--    Consumo de una asignación:
--      · RENTA : consume mientras el vínculo esté vivo (status = true).
--      · VENTA : consume `cantKvas - cantDevuelta` SIEMPRE, viva o no. El KVA se
--                fue con la nave y solo vuelve al pool con devolución acreditada.
--    disponible = capacidad - SUM(consumo). Puede quedar NEGATIVO (sobregiro).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.kva_consumo(
  p_figura text, p_status boolean, p_cant numeric, p_devuelta numeric
) RETURNS numeric
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_figura = 'VENTA' THEN GREATEST(COALESCE(p_cant,0) - COALESCE(p_devuelta,0), 0)
    WHEN p_status IS TRUE   THEN COALESCE(p_cant,0)
    ELSE 0
  END;
$$;

COMMENT ON FUNCTION public.kva_consumo(text, boolean, numeric, numeric) IS
  'KVA que una asignacion sigue consumiendo del parque. VENTA: lo no devuelto, aunque el vinculo este cerrado. RENTA: todo mientras status=true.';

CREATE OR REPLACE FUNCTION public.kva_recalcular_disponibles(p_id_parque text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_mt numeric(12,2) := 0;
  v_bt numeric(12,2) := 0;
BEGIN
  IF p_id_parque IS NULL THEN RETURN; END IF;

  SELECT COALESCE(SUM(public.kva_consumo(figura, status, "cantKvas", "cantDevuelta"))
                  FILTER (WHERE nivel = 'MT'), 0),
         COALESCE(SUM(public.kva_consumo(figura, status, "cantKvas", "cantDevuelta"))
                  FILTER (WHERE nivel = 'BT'), 0)
    INTO v_mt, v_bt
    FROM public."kvasAsignados"
   WHERE "idParque" = p_id_parque;

  UPDATE public.parques
     SET "kvasMtDisponibles" = "kvasMt" - v_mt,
         "kvasBtDisponibles" = "kvasBt" - v_bt
   WHERE "idParque" = p_id_parque;
END;
$$;

COMMENT ON FUNCTION public.kva_recalcular_disponibles(text) IS
  'Recalcula parques.kvasMtDisponibles/kvasBtDisponibles desde kvasAsignados. Sustituye a los triggers de deltas incrementales, que se desincronizaban.';

-- --- Trigger sobre kvasAsignados -------------------------------------------
CREATE OR REPLACE FUNCTION public.kvasasignados_recalcular()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    PERFORM public.kva_recalcular_disponibles(OLD."idParque");
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') THEN
    PERFORM public.kva_recalcular_disponibles(NEW."idParque");
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_kvasasignados_actualizar_parques_kvasdisponibles ON public."kvasAsignados";
DROP TRIGGER IF EXISTS trg_kvasasignados_recalcular ON public."kvasAsignados";
CREATE TRIGGER trg_kvasasignados_recalcular
  AFTER INSERT OR UPDATE OR DELETE ON public."kvasAsignados"
  FOR EACH ROW EXECUTE FUNCTION public.kvasasignados_recalcular();

-- --- Trigger sobre kvaDevoluciones (mantiene cantDevuelta y recalcula) ------
CREATE OR REPLACE FUNCTION public.kvadevoluciones_aplicar()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id_kvas uuid := COALESCE(NEW."idKvas", OLD."idKvas");
  v_parque  text;
BEGIN
  UPDATE public."kvasAsignados" a
     SET "cantDevuelta" = COALESCE((
           SELECT SUM(d.cantidad) FROM public."kvaDevoluciones" d
            WHERE d."idKvas" = v_id_kvas AND d.status IS TRUE), 0)
   WHERE a."idKvas" = v_id_kvas
   RETURNING a."idParque" INTO v_parque;

  PERFORM public.kva_recalcular_disponibles(v_parque);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_kvadevoluciones_aplicar ON public."kvaDevoluciones";
CREATE TRIGGER trg_kvadevoluciones_aplicar
  AFTER INSERT OR UPDATE OR DELETE ON public."kvaDevoluciones"
  FOR EACH ROW EXECUTE FUNCTION public.kvadevoluciones_aplicar();

-- --- Trigger sobre parques (al cambiar la capacidad) -----------------------
--     Se reemplaza la función vieja (usaba kvasAlta/kvasMedia y tipoTension).
--     Es AFTER: el recálculo actualiza SOLO los *Disponibles*, así que no se
--     vuelve a disparar (el trigger escucha UPDATE OF kvasMt/kvasBt).
CREATE OR REPLACE FUNCTION public.parques_actualizar_kvas_disponibles()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.kva_recalcular_disponibles(NEW."idParque");
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_parques_actualizar_kvas_disponibles ON public.parques;
CREATE TRIGGER trg_parques_actualizar_kvas_disponibles
  AFTER INSERT OR UPDATE OF "kvasMt", "kvasBt" ON public.parques
  FOR EACH ROW EXECUTE FUNCTION public.parques_actualizar_kvas_disponibles();

-- --- Helper para el candado de liberación de nave (lo usa el backend) ------
CREATE OR REPLACE FUNCTION public.kva_pendientes_por_devolver(p_id_nave text)
RETURNS TABLE (nivel text, pendiente numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.nivel, SUM(a."cantKvas" - a."cantDevuelta")
    FROM public."kvasAsignados" a
   WHERE a."idNave" = p_id_nave
     AND a.figura = 'VENTA'
     AND a."cantKvas" > a."cantDevuelta"
   GROUP BY a.nivel;
$$;

COMMENT ON FUNCTION public.kva_pendientes_por_devolver(text) IS
  'KVA VENDIDOS de una nave que aun no acreditan su devolucion al parque. Si devuelve filas, la nave NO se puede liberar.';

-- Deja los saldos correctos desde el primer momento.
SELECT public.kva_recalcular_disponibles("idParque") FROM public.parques;

-- =============================================================================
-- 6) RLS + auditoría en las tablas nuevas (patrón del proyecto)
--    RBAC real = por clave de permiso en el backend; RLS es defensa en profundidad
--    (que nada quede accesible sin sesión). El backend usa service_role (BYPASSRLS).
-- =============================================================================
ALTER TABLE public."kvaAcometidas"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."kvaDevoluciones" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AuthenticatedAccess_kvaAcometidas" ON public."kvaAcometidas";
CREATE POLICY "AuthenticatedAccess_kvaAcometidas" ON public."kvaAcometidas"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "AuthenticatedAccess_kvaDevoluciones" ON public."kvaDevoluciones";
CREATE POLICY "AuthenticatedAccess_kvaDevoluciones" ON public."kvaDevoluciones"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_auditoria ON public."kvaAcometidas";
CREATE TRIGGER trg_auditoria
  AFTER INSERT OR UPDATE OR DELETE ON public."kvaAcometidas"
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria('idAcometida');

DROP TRIGGER IF EXISTS trg_auditoria ON public."kvaDevoluciones";
CREATE TRIGGER trg_auditoria
  AFTER INSERT OR UPDATE OR DELETE ON public."kvaDevoluciones"
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria('idDevolucion');

-- =============================================================================
-- 7) PERMISOS (segModulos) — idempotente
-- =============================================================================
INSERT INTO public."segModulos" (modulo, seccion, area, clave)
SELECT 'Parques', 'KVA''s', 'Modulo', 720
WHERE NOT EXISTS (SELECT 1 FROM public."segModulos" WHERE clave = 720);

INSERT INTO public."segModulos" (modulo, seccion, area, clave)
SELECT 'Parques', 'KVA''s', 'Asignar', 721
WHERE NOT EXISTS (SELECT 1 FROM public."segModulos" WHERE clave = 721);

INSERT INTO public."segModulos" (modulo, seccion, area, clave)
SELECT 'Parques', 'KVA''s', 'Registrar devolucion', 722
WHERE NOT EXISTS (SELECT 1 FROM public."segModulos" WHERE clave = 722);

COMMIT;

-- =============================================================================
-- 8) VERIFICACIÓN (correr después de aplicar)
-- =============================================================================
-- SELECT "nomParque","kvasMt","kvasMtDisponibles","kvasMtUtilizados",
--        "kvasBt","kvasBtDisponibles","kvasBtUtilizados"
--   FROM parques WHERE status AND NOT "esTicket" ORDER BY "nomParque";
--   -- Esperado: "Prueba Parque" MT 1500/1450/50 (los 3 registros son MT=50) y el resto en 0.
-- SELECT "idKvas", nivel, figura, etapa, "cantKvas", "cantDevuelta" FROM "kvasAsignados";
-- SELECT * FROM kva_pendientes_por_devolver('9was0s1030Qy');
-- SELECT clave, modulo, seccion, area FROM "segModulos" WHERE clave BETWEEN 720 AND 722;

-- =============================================================================
-- 9) ROLLBACK
-- =============================================================================
-- BEGIN;
--   DROP TRIGGER IF EXISTS trg_kvadevoluciones_aplicar ON "kvaDevoluciones";
--   DROP TRIGGER IF EXISTS trg_kvasasignados_recalcular ON "kvasAsignados";
--   DROP TRIGGER IF EXISTS trg_parques_actualizar_kvas_disponibles ON parques;
--   DROP TABLE IF EXISTS "kvaDevoluciones";
--   ALTER TABLE parques DROP COLUMN IF EXISTS "idAcometida";
--   DROP TABLE IF EXISTS "kvaAcometidas";
--   DROP FUNCTION IF EXISTS kva_pendientes_por_devolver(text), kva_recalcular_disponibles(text),
--                           kva_consumo(text, boolean, numeric, numeric),
--                           kvasasignados_recalcular(), kvadevoluciones_aplicar();
--   ALTER TABLE "kvasAsignados"
--     DROP CONSTRAINT IF EXISTS kvasasignados_nivel_ck,  DROP CONSTRAINT IF EXISTS kvasasignados_figura_ck,
--     DROP CONSTRAINT IF EXISTS kvasasignados_etapa_ck,  DROP CONSTRAINT IF EXISTS kvasasignados_cant_ck,
--     DROP COLUMN IF EXISTS nivel, DROP COLUMN IF EXISTS figura, DROP COLUMN IF EXISTS etapa,
--     DROP COLUMN IF EXISTS "contratoCfe", DROP COLUMN IF EXISTS "fechaContratoCfe",
--     DROP COLUMN IF EXISTS "idPropiedad", DROP COLUMN IF EXISTS "idNavArrend",
--     DROP COLUMN IF EXISTS "cantDevuelta", DROP COLUMN IF EXISTS "motivoBaja";
--   ALTER TABLE parques DROP COLUMN "kvasMtUtilizados", DROP COLUMN "kvasBtUtilizados";
--   ALTER TABLE parques RENAME COLUMN "kvasMt" TO "kvasAlta";
--   ALTER TABLE parques RENAME COLUMN "kvasMtDisponibles" TO "kvasAltaDisponibles";
--   ALTER TABLE parques RENAME COLUMN "kvasBt" TO "kvasMedia";
--   ALTER TABLE parques RENAME COLUMN "kvasBtDisponibles" TO "kvasMediaDisponibles";
--   ALTER TABLE parques
--     ADD COLUMN "kvasAltaUtilizados"  integer GENERATED ALWAYS AS ("kvasAlta" - "kvasAltaDisponibles") STORED,
--     ADD COLUMN "kvasMediaUtilizados" integer GENERATED ALWAYS AS ("kvasMedia" - "kvasMediaDisponibles") STORED;
--   -- + restaurar las 2 funciones viejas desde el historial de este archivo.
-- COMMIT;
