-- Report Studio - Migración de coordenadas Gridstack a píxeles absolutos
-- Fecha: 2026-04-30
-- Descripción: Convierte el sistema de layout de Gridstack (gs_x, gs_y, gs_w, gs_h)
--              a coordenadas absolutas en píxeles (pos_x, pos_y, width, height)

-- Agregar columnas nuevas para posicionamiento absoluto
ALTER TABLE crm_widgets
  ADD COLUMN IF NOT EXISTS pos_x integer DEFAULT 16,
  ADD COLUMN IF NOT EXISTS pos_y integer DEFAULT 16,
  ADD COLUMN IF NOT EXISTS width integer DEFAULT 380,
  ADD COLUMN IF NOT EXISTS height integer DEFAULT 240,
  ADD COLUMN IF NOT EXISTS widget_type text DEFAULT 'chart',
  ADD COLUMN IF NOT EXISTS filter_config jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS z_index integer DEFAULT 1;

-- Conversión de widgets existentes (Gridstack → px absolutos)
-- Cálculos:
-- - Ancho hoja: 816px, 12 columnas → 816/12 = 68px por columna
-- - cellHeight Gridstack: 5px
UPDATE crm_widgets
SET
  pos_x = gs_x * 68,      -- 816px / 12 columnas = 68px por columna
  pos_y = gs_y * 5,       -- cellHeight Gridstack = 5px por row
  width = gs_w * 68,      -- ancho en columnas → px
  height = gs_h * 5,      -- alto en rows → px
  widget_type = CASE
    WHEN tipo IN ('filter_daterange', 'filter_multiselect', 'filter_numericrange', 'filter_toggle')
    THEN 'filter'
    ELSE 'chart'
  END,
  z_index = 1
WHERE gs_x IS NOT NULL;

-- Crear índices para performance
CREATE INDEX IF NOT EXISTS idx_crm_widgets_posicion
  ON crm_widgets(reporte_id, pos_x, pos_y);

CREATE INDEX IF NOT EXISTS idx_crm_widgets_tipo
  ON crm_widgets(widget_type);

-- Comentario para documentar la migración
COMMENT ON COLUMN crm_widgets.pos_x IS 'Posición horizontal en px desde borde izquierdo de la hoja (Report Studio)';
COMMENT ON COLUMN crm_widgets.pos_y IS 'Posición vertical en px desde borde superior de la hoja (Report Studio)';
COMMENT ON COLUMN crm_widgets.width IS 'Ancho del widget en px (Report Studio)';
COMMENT ON COLUMN crm_widgets.height IS 'Alto del widget en px (Report Studio)';
COMMENT ON COLUMN crm_widgets.widget_type IS 'Tipo de widget: chart | filter (Report Studio)';
COMMENT ON COLUMN crm_widgets.filter_config IS 'Configuración de filtro: campo, valor_defecto, widgets_vinculados[] (Report Studio)';
COMMENT ON COLUMN crm_widgets.z_index IS 'Orden de apilamiento (Report Studio)';
