--[Fecha y Hora]: 16/11/2025 10:50:00
--[Descripción]: Script para crear las tablas del sistema de plantillas de permisos
--
--Este script crea las tablas necesarias para almacenar y gestionar plantillas de permisos
--que podrán ser aplicadas a los usuarios del sistema.
--
--Tablas creadas:
--  - segPlantillasPermisos: Almacena las plantillas principales
--  - segDetallesPlantilla: Almacena los detalles de permisos de cada plantilla
--
--Relaciones:
--  - segPlantillasPermisos → segDetallesPlantilla (1:N)
--  - segPlantillasPermisos → catUsers (N:1, creador)
--  - segDetallesPlantilla → segModulosUsuarios (estructura similar)
--
--Notas importantes:
--  - No se modifican datos existentes
--  - Se mantienen las políticas RLS existentes
--  - Las nuevas tablas tendrán sus propias políticas RLS

-- Habilitar RLS para las nuevas tablas
ALTER TABLE IF EXISTS public."segPlantillasPermisos" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."segDetallesPlantilla" DISABLE ROW LEVEL SECURITY;

-- Eliminar tablas si existen (para desarrollo)
-- DROP TABLE IF EXISTS public."segDetallesPlantilla" CASCADE;
-- DROP TABLE IF EXISTS public."segPlantillasPermisos" CASCADE;

-- Crear tabla principal de plantillas
CREATE TABLE IF NOT EXISTS public."segPlantillasPermisos" (
    "idPlantilla" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "fc" timestamp with time zone DEFAULT now(),
    "status" boolean DEFAULT true NOT NULL,
    "nombrePlantilla" text NOT NULL,
    "descripcion" text,
    "uidCreador" uuid NOT NULL REFERENCES public."catUsers"("uid"),
    "fechaCreacion" timestamp with time zone DEFAULT now(),
    "fechaUltimaModificacion" timestamp with time zone,
    "uidModificador" uuid REFERENCES public."catUsers"("uid"),
    "esPublica" boolean DEFAULT false NOT NULL,
    "categoria" text DEFAULT 'General' NOT NULL,
    
    -- Restricciones
    CONSTRAINT "segplantillas_nombre_unico" UNIQUE ("nombrePlantilla"),
    CONSTRAINT "segplantillas_categoria_check" CHECK ("categoria" IN ('General', 'Ventas', 'Administración', 'Soporte', 'Gerencia', 'Operaciones', 'Finanzas')),
    CONSTRAINT "segplantillas_status_check" CHECK ("status" IN (true, false))
);

-- Crear tabla de detalles de plantillas
CREATE TABLE IF NOT EXISTS public."segDetallesPlantilla" (
    "idDetalle" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "fc" timestamp with time zone DEFAULT now(),
    "status" boolean DEFAULT true NOT NULL,
    "idPlantilla" uuid NOT NULL REFERENCES public."segPlantillasPermisos"("idPlantilla") ON DELETE CASCADE,
    "modulo" text NOT NULL,
    "seccion" text NOT NULL,
    "area" text,
    "acceso" boolean NOT NULL DEFAULT false,
    "clave" smallint,
    
    -- Restricciones
    CONSTRAINT "segdetalles_plantilla_unique" UNIQUE ("idPlantilla", "modulo", "seccion", "area"),
    CONSTRAINT "segdetalles_status_check" CHECK ("status" IN (true, false)),
    CONSTRAINT "segdetalles_acceso_check" CHECK ("acceso" IN (true, false))
);

-- Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS "idx_segplantillas_status" ON public."segPlantillasPermisos" ("status");
CREATE INDEX IF NOT EXISTS "idx_segplantillas_categoria" ON public."segPlantillasPermisos" ("categoria");
CREATE INDEX IF NOT EXISTS "idx_segplantillas_creador" ON public."segPlantillasPermisos" ("uidCreador");
CREATE INDEX IF NOT EXISTS "idx_segplantillas_publicas" ON public."segPlantillasPermisos" ("esPublica") WHERE "esPublica" = true;

CREATE INDEX IF NOT EXISTS "idx_segdetalles_plantilla" ON public."segDetallesPlantilla" ("idPlantilla");
CREATE INDEX IF NOT EXISTS "idx_segdetalles_status" ON public."segDetallesPlantilla" ("status");
CREATE INDEX IF NOT EXISTS "idx_segdetalles_modulo" ON public."segDetallesPlantilla" ("modulo");
CREATE INDEX IF NOT EXISTS "idx_segdetalles_acceso" ON public."segDetallesPlantilla" ("acceso") WHERE "acceso" = true;

-- Comentarios descriptivos
COMMENT ON TABLE public."segPlantillasPermisos" IS 'Catálogo de plantillas de permisos para asignación rápida a usuarios';
COMMENT ON TABLE public."segDetallesPlantilla" IS 'Detalles específicos de permisos para cada plantilla';

COMMENT ON COLUMN public."segPlantillasPermisos"."idPlantilla" IS 'Identificador único de la plantilla';
COMMENT ON COLUMN public."segPlantillasPermisos"."nombrePlantilla" IS 'Nombre descriptivo de la plantilla';
COMMENT ON COLUMN public."segPlantillasPermisos"."descripcion" IS 'Descripción detallada del propósito y uso de la plantilla';
COMMENT ON COLUMN public."segPlantillasPermisos"."uidCreador" IS 'Usuario que creó la plantilla';
COMMENT ON COLUMN public."segPlantillasPermisos"."esPublica" IS 'Indica si la plantilla puede ser utilizada por otros administradores';
COMMENT ON COLUMN public."segPlantillasPermisos"."categoria" IS 'Categoría para organizar las plantillas por departamento o tipo';

COMMENT ON COLUMN public."segDetallesPlantilla"."idPlantilla" IS 'Referencia a la plantilla principal';
COMMENT ON COLUMN public."segDetallesPlantilla"."modulo" IS 'Módulo del sistema al que aplica el permiso';
COMMENT ON COLUMN public."segDetallesPlantilla"."seccion" IS 'Sección específica dentro del módulo';
COMMENT ON COLUMN public."segDetallesPlantilla"."area" IS 'Área funcional dentro de la sección';
COMMENT ON COLUMN public."segDetallesPlantilla"."acceso" IS 'Indica si se concede o no el acceso';
COMMENT ON COLUMN public."segDetallesPlantilla"."clave" IS 'Código numérico identificador del permiso';

-- Habilitar RLS para las nuevas tablas
ALTER TABLE public."segPlantillasPermisos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."segDetallesPlantilla" ENABLE ROW LEVEL SECURITY;

-- Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE 'Tablas de plantillas de permisos creadas exitosamente';
    RAISE NOTICE '- segPlantillasPermisos: Catálogo de plantillas';
    RAISE NOTICE '- segDetallesPlantilla: Detalles de permisos por plantilla';
    RAISE NOTICE 'RLS habilitado en ambas tablas';
END $$;