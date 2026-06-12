-- =============================================================================
-- Migración v2: Permisos de visualización por pestaña en Configuraciones → Parámetros
-- Fecha: 2026-06-10
-- Módulo: Configuraciones → Parámetros
--
-- ⚠️ REQUIERE AUTORIZACIÓN EXPLÍCITA DEL USUARIO (regla 1 del HANDOFF).
--    Es 100% ADITIVO: solo inserta 2 filas NUEVAS en el catálogo public."segModulos".
--    NO se elimina ni se altera ninguna fila/lógica del sistema viejo (v1/Flutter).
--
-- Contexto: el módulo Parámetros tiene 5 pestañas. Tres ya tenían clave fina en el
--   catálogo (212=INPC, 213=Cuentas, 214=Fechas CxP). Las otras dos son tabs
--   propios de v2 y NO tenían clave: "Claves SAT" (catálogo SAT, objeto nuevo v2)
--   y "Pizarra de Avisos" (en desarrollo). Se les asigna clave nueva para poder
--   controlar su VISUALIZACIÓN por usuario igual que el resto.
--
--     215 = Configuraciones / Parametros / Claves SAT
--     216 = Configuraciones / Parametros / Pizarra de Avisos
--
--   (210 = acceso al módulo, 211 = General — se conservan sin cambios.)
--
-- Tras aplicar: asignar las claves a los usuarios que correspondan desde
--   Configuraciones → Permisos (los usuarios isSupport ya las ven por bypass).
-- =============================================================================

-- Inserción guardada (idempotente): no duplica si la clave ya existe.
INSERT INTO public."segModulos" ("idsegModulos", fc, modulo, seccion, area, clave)
SELECT gen_random_uuid(), now(), 'Configuraciones'::"Modulos", 'Parametros', 'Claves SAT', 215
WHERE NOT EXISTS (SELECT 1 FROM public."segModulos" WHERE clave = 215);

INSERT INTO public."segModulos" ("idsegModulos", fc, modulo, seccion, area, clave)
SELECT gen_random_uuid(), now(), 'Configuraciones'::"Modulos", 'Parametros', 'Pizarra de Avisos', 216
WHERE NOT EXISTS (SELECT 1 FROM public."segModulos" WHERE clave = 216);

-- Verificación:
--   SELECT clave, area FROM public."segModulos"
--   WHERE seccion = 'Parametros' ORDER BY clave;
