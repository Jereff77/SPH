--[Fecha y Hora]: 13/02/2026 06:30:00
--[Descripción]: Estructura de la tabla catInmobiliarias
--
--[Parámetros]: No aplica
--
--[Salida]: No aplica
--
--[Uso típico]: Documentación de la estructura de la tabla
--[Ejemplo]: No aplica
--
--[Relaciones]: 
--   - Tablas relacionadas: catAsesoresInm, leads, leads_porAprobar, leads_duplicate
--
--[Validaciones]: No aplica

CREATE TABLE IF NOT EXISTS public.catInmobiliarias (
    id integer PRIMARY KEY DEFAULT nextval('catinmobiliarias_id_seq'::regclass),
    fc timestamp NOT NULL DEFAULT now(),
    status boolean NOT NULL DEFAULT true,
    nombre text NOT NULL,
    codigo text,
    telefono text,
    correo text,
    direccion text
);

-- Comentarios sobre la tabla
COMMENT ON TABLE public.catInmobiliarias IS 'Almacena las diferentes inmobiliarias externas que colaboran con SPH Bines Raices';

-- Comentarios sobre las columnas
COMMENT ON COLUMN public.catInmobiliarias.id IS 'Identificador único de la inmobiliaria';
COMMENT ON COLUMN public.catInmobiliarias.fc IS 'Fecha y hora de creación del registro';
COMMENT ON COLUMN public.catInmobiliarias.status IS 'Estado del registro (activo/inactivo)';
COMMENT ON COLUMN public.catInmobiliarias.nombre IS 'Nombre de la inmobiliaria';
COMMENT ON COLUMN public.catInmobiliarias.codigo IS 'Código de la inmobiliaria';
COMMENT ON COLUMN public.catInmobiliarias.telefono IS 'Teléfono de la inmobiliaria';
COMMENT ON COLUMN public.catInmobiliarias.correo IS 'Correo electrónico de la inmobiliaria';
COMMENT ON COLUMN public.catInmobiliarias.direccion IS 'Dirección de la inmobiliaria';

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_catinmobiliarias_status ON public.catInmobiliarias(status);
CREATE INDEX IF NOT EXISTS idx_catinmobiliarias_codigo ON public.catInmobiliarias(codigo);
CREATE INDEX IF NOT EXISTS idx_catinmobiliarias_nombre ON public.catInmobiliarias(nombre);
