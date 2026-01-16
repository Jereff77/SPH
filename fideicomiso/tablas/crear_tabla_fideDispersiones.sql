--[Fecha y Hora]: 08/01/2026 10:50:00
--[Descripción]: Tabla para almacenar las dispersiones generadas por plan_dispersiones_dinamico
--
--[Estructura]:
--   - Clave primaria serial (autoincremental)
--   - Información del inversionista y fideicomiso
--   - Información del período (trimestral con sub-períodos de promoción)
--   - Información de dispersiones (pagos y fechas)
--   - Cálculos financieros (rendimientos, retenciones, dispersiones)
--   - Auditoría (fecha de cálculo)
--
--[Relaciones]:
--   - id_fideicomiso → fideicomiso.idFide
--   - id_pago → pagos.idPago
--   - no_adhesion → fideCondiciones.noAdhesion
--
--[Uso]:
--   Esta tabla almacena los resultados de plan_dispersiones_dinamico para
--   historial, consulta rápida y generación de reportes.
--
--[Nota]:
--   - La columna sub_periodo puede ser NULL cuando no es un período mixto
--   - Se usan índices parciales para garantizar unicidad dependiendo de si sub_periodo es NULL o no
--   - Esto permite tener múltiples registros para el mismo pago cuando hay sub-períodos (PROMOCION y NORMAL)

CREATE TABLE IF NOT EXISTS public."fideDispersiones" (
    -- Clave primaria serial
    id SERIAL PRIMARY KEY,

    -- Columnas para información del inversionista y fideicomiso
    id_fideicomiso TEXT NOT NULL,
    no_adhesion TEXT NOT NULL,
    nombre_inversionista TEXT NOT NULL,
    rfc_inversionista TEXT,
    tipo_persona TEXT NOT NULL,

    -- Columnas para información del período
    periodo_anio INTEGER NOT NULL,
    periodo_mes INTEGER NOT NULL,
    periodo_dia_inicio INTEGER NOT NULL,
    periodo_dia_fin INTEGER NOT NULL,
    tipo_periodo TEXT NOT NULL,
    sub_periodo TEXT,

    -- Columnas para información de dispersiones
    id_pago TEXT NOT NULL,
    monto_pago DOUBLE PRECISION NOT NULL,
    fecha_pago DATE NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    dias_periodo INTEGER NOT NULL,
    "noDispersion" TEXT NOT NULL,

    -- Columnas para cálculos
    tasa_rendimiento DOUBLE PRECISION NOT NULL,
    rendimiento_bruto DOUBLE PRECISION NOT NULL,
    retencion_isr DOUBLE PRECISION NOT NULL,
    rendimiento_neto DOUBLE PRECISION NOT NULL,
    rendimiento_sph DOUBLE PRECISION NOT NULL,
    dispersion_neta DOUBLE PRECISION NOT NULL,

    -- Columnas para auditoría
    fecha_calculo TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Crear índices únicos parciales para evitar duplicados
-- Para registros CON sub_periodo (PERIODO_MIXTO)
CREATE UNIQUE INDEX IF NOT EXISTS uq_fideDispersiones_registro
ON public."fideDispersiones" (id_fideicomiso, no_adhesion, id_pago, fecha_inicio, fecha_fin, sub_periodo)
WHERE sub_periodo IS NOT NULL;

-- Para registros SIN sub_periodo (todos los demás tipos de período)
CREATE UNIQUE INDEX IF NOT EXISTS uq_fideDispersiones_registro_sin_sub
ON public."fideDispersiones" (id_fideicomiso, no_adhesion, id_pago, fecha_inicio, fecha_fin)
WHERE sub_periodo IS NULL;

-- Crear índices para mejorar el rendimiento de consultas
CREATE INDEX IF NOT EXISTS idx_fideDispersiones_id_fideicomiso ON public."fideDispersiones"(id_fideicomiso);
CREATE INDEX IF NOT EXISTS idx_fideDispersiones_no_adhesion ON public."fideDispersiones"(no_adhesion);
CREATE INDEX IF NOT EXISTS idx_fideDispersiones_id_pago ON public."fideDispersiones"(id_pago);
CREATE INDEX IF NOT EXISTS idx_fideDispersiones_periodo ON public."fideDispersiones"(periodo_anio, periodo_mes);
CREATE INDEX IF NOT EXISTS idx_fideDispersiones_fechas ON public."fideDispersiones"(fecha_inicio, fecha_fin);
CREATE INDEX IF NOT EXISTS idx_fideDispersiones_fecha_calculo ON public."fideDispersiones"(fecha_calculo);

-- Comentarios de tabla y columnas
COMMENT ON TABLE public."fideDispersiones" IS 'Almacena las dispersiones calculadas por plan_dispersiones_dinamico para cada fideicomiso';

COMMENT ON COLUMN public."fideDispersiones".id IS 'Identificador único autoincremental del registro';
COMMENT ON COLUMN public."fideDispersiones".id_fideicomiso IS 'ID del fideicomiso';
COMMENT ON COLUMN public."fideDispersiones".no_adhesion IS 'Número de adhesión del inversionista';
COMMENT ON COLUMN public."fideDispersiones".nombre_inversionista IS 'Nombre completo del inversionista';
COMMENT ON COLUMN public."fideDispersiones".rfc_inversionista IS 'RFC del inversionista';
COMMENT ON COLUMN public."fideDispersiones".tipo_persona IS 'Tipo de persona (Fisica/Moral)';
COMMENT ON COLUMN public."fideDispersiones".periodo_anio IS 'Año del período de dispersión';
COMMENT ON COLUMN public."fideDispersiones".periodo_mes IS 'Mes de inicio del período de dispersión';
COMMENT ON COLUMN public."fideDispersiones".periodo_dia_inicio IS 'Día de inicio del período';
COMMENT ON COLUMN public."fideDispersiones".periodo_dia_fin IS 'Día de fin del período';
COMMENT ON COLUMN public."fideDispersiones".tipo_periodo IS 'Tipo de período (SIN_PROMOCION, TOTAL_PROMOCION, TOTAL_NORMAL, PERIODO_MIXTO)';
COMMENT ON COLUMN public."fideDispersiones".sub_periodo IS 'Sub-período (PROMOCION, NORMAL) solo para PERIODO_MIXTO, NULL en otros casos';
COMMENT ON COLUMN public."fideDispersiones".id_pago IS 'ID del pago que genera la dispersión';
COMMENT ON COLUMN public."fideDispersiones".monto_pago IS 'Monto del pago';
COMMENT ON COLUMN public."fideDispersiones".fecha_pago IS 'Fecha del pago';
COMMENT ON COLUMN public."fideDispersiones".fecha_inicio IS 'Fecha de inicio del período';
COMMENT ON COLUMN public."fideDispersiones".fecha_fin IS 'Fecha de fin del período';
COMMENT ON COLUMN public."fideDispersiones".dias_periodo IS 'Número de días del período';
COMMENT ON COLUMN public."fideDispersiones"."noDispersion" IS 'Número ordinal de la dispersión (ej: 1era, 2da)';
COMMENT ON COLUMN public."fideDispersiones".tasa_rendimiento IS 'Tasa de rendimiento aplicada';
COMMENT ON COLUMN public."fideDispersiones".rendimiento_bruto IS 'Rendimiento bruto calculado';
COMMENT ON COLUMN public."fideDispersiones".retencion_isr IS 'Retención de ISR (10% para personas físicas)';
COMMENT ON COLUMN public."fideDispersiones".rendimiento_neto IS 'Rendimiento neto (bruto - retención)';
COMMENT ON COLUMN public."fideDispersiones".rendimiento_sph IS 'Rendimiento para SPH';
COMMENT ON COLUMN public."fideDispersiones".dispersion_neta IS 'Dispersión neta a pagar';
COMMENT ON COLUMN public."fideDispersiones".fecha_calculo IS 'Fecha y hora en que se calculó la dispersión';
