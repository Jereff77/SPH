// ========== TIPOS DE DOMINIO ==========

export interface Reporte {
  id: string;
  nombre: string;
  descripcion?: string;
  visibilidad: 'privado' | 'publico' | 'restringido';
  creado_por: string;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export interface Widget {
  id: string;
  reporte_id?: string | null;  // ✅ Fase 2: opcional, permite NULL temporal
  tipo: WidgetType;
  widget_category: 'chart' | 'filter';
  titulo: string;
  mostrar_titulo: boolean;
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
  z_index: number;
  config: WidgetConfig;
  filter_config?: FilterWidgetConfig;
  fecha_creacion: string;
}

// ========== CONFIGURACIÓN DE WIDGET ==========

export interface WidgetConfig {
  // Fuente de datos
  fuente: DataSource;

  // Campos seleccionados
  dimension?: string;          // Para eje X o categoría
  metrica?: string;           // Para eje Y o valor

  // Agregación y límites
  agregacion?: Agregacion;
  limite?: number;

  // Filtros locales del widget
  filtros_locales?: FiltroLocal[];

  // Estilo (básico Fase 2, se expande Fase 3)
  estilo?: WidgetStyle;
}

export interface FilterWidgetConfig {
  campo_vinculado: string;
  valor_defecto: any;
  widgets_vinculados: string[];  // IDs de widgets que responden a este filtro
}

// ========== ESTILOS DE WIDGET ==========

export interface WidgetStyle {
  color_principal?: string;
  padding?: number;
  background?: string;
  border_radius?: number;
  mostrar_grilla?: boolean;
}

// ========== CAMPOS DISPONIBLES ==========

export interface CampoDisponible {
  nombre: string;              // Nombre de la columna en la vista
  tipo: CampoTipo;             // dimensión | métrica
  tipo_dato: string;           // Tipo de dato PostgreSQL
  etiqueta?: string;           // Eteta amigable (opcional)
}

export type CampoTipo = 'dimension' | 'metrica';
export type DataSource = 'v_leads_completo' | 'v_actividades_completo';

// ========== FILTROS ==========

export interface FiltroActivo {
  campo: string;
  operador: OperadorFiltro;
  valor: any;
  valor2?: any;  // Para operador 'entre'
}

export interface FiltroLocal {
  campo: string;
  operador: OperadorFiltro;
  valor: any;
}

export type OperadorFiltro =
  | 'igual'
  | 'distinto'
  | 'contiene'
  | 'no_contiene'
  | 'mayor'
  | 'menor'
  | 'entre'
  | 'en_lista'
  | 'is_null'
  | 'not_null';

// ========== TIPOS DE WIDGET ==========

export type WidgetType =
  // Gráficas
  | 'bar'
  | 'bar_horizontal'
  | 'line'
  | 'area'
  | 'pie'
  | 'kpi'
  | 'table'
  // Filtros
  | 'filter_daterange'
  | 'filter_multiselect'
  | 'filter_numericrange'
  | 'filter_toggle'
  | 'filter_dropdown';

export type Agregacion = 'count' | 'sum' | 'avg' | 'max' | 'min';

// ========== DATOS DE GRÁFICO ==========

export interface ChartData {
  label: string;
  value: number;
  [key: string]: any;  // Campos adicionales (color, icono, etc.)
}

export interface WidgetData {
  tipo: WidgetType;
  datos: ChartData[];
  metadata?: {
    total?: number;
    filtrado?: number;
    campos?: string[];
  };
}

// ========== PERMISOS ==========

export interface PermisoReporte {
  id: string;
  reporte_id: string;
  usuario_id: string;
  rol: 'editor' | 'visor';
}

// ========== LAYOUT ==========

export interface WidgetLayout {
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
}
