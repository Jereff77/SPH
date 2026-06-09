-- =============================================================================
-- Migración v2: tabla de Changelog del sistema  ·  2026-06-09
-- Objeto NUEVO de v2 (regla 2: no toca nada del sistema viejo).
-- Autorización: REQUIERE autorización explícita del usuario antes de aplicar (regla 1).
--
-- Qué crea:
--   1. Tabla public.v2_changelog (una fila por versión publicada, SemVer).
--   2. RLS ON sin políticas  -> solo el backend (service_role) accede; el frontend
--      NUNCA toca la tabla (misma postura que correo_cuentas/correo_mensajes).
--   3. Trigger trg_auditoria (regla 6: toda tabla de datos lleva auditoría).
--   4. SEED: historial reconstruido de versiones (fechas previas a jun-2026 son
--      APROXIMADAS; ajústalas si tienes las reales). Idempotente (ON CONFLICT).
-- =============================================================================

-- 1) Tabla -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.v2_changelog (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  version     text        NOT NULL UNIQUE,               -- SemVer 'MAJOR.MINOR.PATCH'
  fecha       date        NOT NULL,                      -- fecha de publicación
  titulo      text,                                      -- título corto opcional
  cambios     jsonb       NOT NULL DEFAULT '[]'::jsonb,  -- [{ "tipo", "descripcion" }]
  publicada   boolean     NOT NULL DEFAULT true,         -- visible en la app
  "creadoEn"  timestamptz NOT NULL DEFAULT now(),
  "creadoPor" uuid,                                      -- uid del actor (del JWT)
  "fum"       timestamptz,                               -- última modificación
  "fumUser"   uuid,
  CONSTRAINT v2_changelog_version_semver_chk
    CHECK (version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  CONSTRAINT v2_changelog_cambios_arr_chk
    CHECK (jsonb_typeof(cambios) = 'array')
);

COMMENT ON TABLE public.v2_changelog IS
  'Changelog / versiones del ERP v2 (SemVer). Objeto nuevo v2; solo lo lee el backend (service_role). El frontend lo consume por GET /api/changelog.';

CREATE INDEX IF NOT EXISTS ix_v2_changelog_fecha ON public.v2_changelog (fecha DESC);

-- 2) Seguridad: RLS ON sin políticas -> solo service_role (backend) ----------
ALTER TABLE public.v2_changelog ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.v2_changelog FROM anon, authenticated;

-- 3) Auditoría obligatoria (regla 6): registra quién publica/edita versiones --
DROP TRIGGER IF EXISTS trg_auditoria ON public.v2_changelog;
CREATE TRIGGER trg_auditoria
  AFTER INSERT OR UPDATE OR DELETE ON public.v2_changelog
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria('id');

-- 4) SEED: historial reconstruido --------------------------------------------
-- (Fechas anteriores a 2026-06-07 son APROXIMADAS. Ajusta a las reales si las tienes.)
INSERT INTO public.v2_changelog (version, fecha, titulo, cambios) VALUES
('2.0.0', '2026-05-15', 'Lanzamiento base v2', '[
  {"tipo":"Agregado","descripcion":"Núcleo de seguridad: autenticación por backend (proxy), guards JWT/RBAC y permisos server-side."},
  {"tipo":"Agregado","descripcion":"Auditoría server-side con triggers (registro antes/después) y «Ver como» para soporte."},
  {"tipo":"Agregado","descripcion":"Configuraciones → Sistema: logos, favicon, dominios y correos autorizados."},
  {"tipo":"Agregado","descripcion":"Configuraciones → Usuarios: estado activo/inactivo, soporte y responsable comercial."},
  {"tipo":"Seguridad","descripcion":"El frontend deja de ejecutar SQL y de recibir llaves de Supabase (toda la BD pasa por el backend)."}
]'::jsonb),
('2.1.0', '2026-05-20', 'Parámetros, Permisos e Indicadores', '[
  {"tipo":"Agregado","descripcion":"Configuraciones → Parámetros: INPC, Cuentas, Fechas de CxP y Claves SAT."},
  {"tipo":"Agregado","descripcion":"Configuraciones → Permisos: administración de permisos por usuario."},
  {"tipo":"Agregado","descripcion":"Indicadores del inicio: tipo de cambio (Banxico) e INPC reales."}
]'::jsonb),
('2.2.0', '2026-05-23', 'Parques', '[
  {"tipo":"Agregado","descripcion":"Módulo Parques: catálogo de parques y disponibilidad de naves."}
]'::jsonb),
('2.3.0', '2026-05-28', 'Cuentas por Pagar', '[
  {"tipo":"Agregado","descripcion":"Proveedores y Bancos."},
  {"tipo":"Agregado","descripcion":"Solicitudes de pago con alta de CFDI (lector propio y validaciones fiscales)."},
  {"tipo":"Agregado","descripcion":"Aprobar solicitudes (dentro y fuera de presupuesto)."},
  {"tipo":"Agregado","descripcion":"Pagar solicitudes (3 vías de pago) con actualización en tiempo real."},
  {"tipo":"Agregado","descripcion":"Solicitudes pendientes."}
]'::jsonb),
('2.4.0', '2026-05-31', 'Correo (buzón de facturas)', '[
  {"tipo":"Agregado","descripcion":"Buzón de facturas por IMAP/SMTP integrado en el backend (sin N8N)."},
  {"tipo":"Seguridad","descripcion":"El cuerpo HTML de los correos se muestra en un marco aislado sin scripts (anti-XSS)."}
]'::jsonb),
('2.5.0', '2026-06-03', 'Ventas — Etapa 1', '[
  {"tipo":"Agregado","descripcion":"Ventas → Dashboard: objetivo, cobranza y balance, con actualización en tiempo real."},
  {"tipo":"Agregado","descripcion":"Ventas → Planes: plan de pagos detallado, comentarios y configuración."}
]'::jsonb),
('2.6.0', '2026-06-04', 'Clientes', '[
  {"tipo":"Agregado","descripcion":"Padrón de Clientes: inversionistas, arrendatarios, ticket, usuario final y papelera."}
]'::jsonb),
('2.7.0', '2026-06-05', 'Arrendatarios', '[
  {"tipo":"Agregado","descripcion":"Dashboard de cobranza de rentas."},
  {"tipo":"Agregado","descripcion":"Planes de Renta: corrida con INPC, liberar nave, configuración y plan de pagos."},
  {"tipo":"Agregado","descripcion":"Renovación de planes con activación automática."}
]'::jsonb),
('2.8.0', '2026-06-07', 'Ventas — Propiedades', '[
  {"tipo":"Agregado","descripcion":"Alta de propiedades por Parque/Nave, listado en tarjetas y KVAs Alta/Media."},
  {"tipo":"Agregado","descripcion":"Desvincular nave de una propiedad (regresa la nave a «Disponible»)."}
]'::jsonb),
('2.8.1', '2026-06-08', 'Corrección de vigencia de planes', '[
  {"tipo":"Corregido","descripcion":"La fecha fin de los planes de renta se calculaba un día de más; se corrigieron los 173 planes existentes."}
]'::jsonb),
('2.9.0', '2026-06-09', 'Correo — carpetas', '[
  {"tipo":"Agregado","descripcion":"Selector de carpetas del buzón en vivo, incluidas las personalizadas."},
  {"tipo":"Cambiado","descripcion":"La bandeja sigue los movimientos de un correo entre carpetas."}
]'::jsonb),
('2.9.1', '2026-06-09', 'Hotfix CxP', '[
  {"tipo":"Corregido","descripcion":"Se desactivó un trigger que re-rechazaba facturas y corrompía registros ya pagados o aprobados."}
]'::jsonb),
('2.10.0', '2026-06-09', 'Novedades (Changelog)', '[
  {"tipo":"Agregado","descripcion":"Configuraciones → Novedades: historial de versiones y cambios del sistema, visible para todos los usuarios."}
]'::jsonb)
ON CONFLICT (version) DO NOTHING;

-- 5) Función de registro a prueba de concurrencia ---------------------------
-- Varios agentes trabajan en paralelo: el número de versión lo ASIGNA LA BD (no
-- el agente), con advisory lock, para que no se tropiecen. Es la única vía de
-- registro correcta (no hacer INSERT manual con versión hardcodeada).
CREATE OR REPLACE FUNCTION public.v2_changelog_registrar(
  p_salto text, p_titulo text, p_cambios jsonb, p_publicada boolean DEFAULT true
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_max text; v_maj int; v_min int; v_pat int; v_nueva text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('v2_changelog_registrar'));

  SELECT version INTO v_max FROM public.v2_changelog
    ORDER BY string_to_array(version,'.')::int[] DESC LIMIT 1;

  IF v_max IS NULL THEN
    v_maj := 2; v_min := 0; v_pat := 0;
  ELSE
    v_maj := split_part(v_max,'.',1)::int;
    v_min := split_part(v_max,'.',2)::int;
    v_pat := split_part(v_max,'.',3)::int;
    CASE lower(p_salto)
      WHEN 'major' THEN v_maj := v_maj+1; v_min := 0; v_pat := 0;
      WHEN 'minor' THEN v_min := v_min+1; v_pat := 0;
      WHEN 'patch' THEN v_pat := v_pat+1;
      ELSE RAISE EXCEPTION 'p_salto invalido: % (use major|minor|patch)', p_salto;
    END CASE;
  END IF;

  v_nueva := format('%s.%s.%s', v_maj, v_min, v_pat);

  INSERT INTO public.v2_changelog (version, fecha, titulo, cambios, publicada, "creadoPor")
  VALUES (v_nueva, CURRENT_DATE, p_titulo, p_cambios, p_publicada,
          nullif(current_setting('request.jwt.claims', true),'')::jsonb->>'sub');

  RETURN v_nueva;
END $$;

COMMENT ON FUNCTION public.v2_changelog_registrar(text,text,jsonb,boolean) IS
  'Registra una versión en v2_changelog calculando el siguiente SemVer desde la BD con advisory lock (a prueba de concurrencia entre agentes). p_salto: major|minor|patch. Devuelve la versión asignada.';

REVOKE ALL ON FUNCTION public.v2_changelog_registrar(text,text,jsonb,boolean) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_changelog_registrar(text,text,jsonb,boolean) TO service_role;

-- Verificación rápida:
-- SELECT version, fecha, titulo, jsonb_array_length(cambios) AS n_cambios
-- FROM public.v2_changelog ORDER BY string_to_array(version,'.')::int[] DESC;
-- Registrar una versión (la BD asigna el número):
-- SELECT public.v2_changelog_registrar('minor','Título','[{"tipo":"Agregado","descripcion":"…"}]'::jsonb);
