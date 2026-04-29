// Tipos y constantes de reportes — sin imports de servidor, usable en client components

export interface WidgetConfig {
  // Filtros globales
  fechaInicio?: string | null
  fechaFin?: string | null
  uidRC?: string | null

  // Modo dinámico (bar / pie / table): el usuario elige fuente, X e Y
  fuente?: 'leads' | 'actividades'
  dimension?: string                              // campo para agrupar (eje X)
  metrica_tipo?: 'count' | 'sum_valor' | 'avg_valor'

  // Modo temporal (line)
  linea_metrica?: 'leads_mensual' | 'valor_mensual'

  // Modo KPI
  kpi?: 'leads_activos' | 'valor_pipeline' | 'tasa_conversion'

  // Display
  orientacion?: 'vertical' | 'horizontal'
}

// ── Catálogos de opciones para el configurador ─────────────────

export const DIMENSIONES_LEADS = [
  { value: 'Etapa',         label: 'Etapa del pipeline' },
  { value: 'Origen',        label: 'Origen' },
  { value: 'nomRC',         label: 'Responsable comercial' },
  { value: 'tipoCliente',   label: 'Tipo de cliente' },
  { value: 'tipoOperacion', label: 'Tipo de operación' },
  { value: 'tipoVenta',     label: 'Tipo de venta' },
]

export const DIMENSIONES_ACTIVIDADES = [
  { value: 'type', label: 'Tipo de actividad' },
]

export const METRICAS_Y_LEADS = [
  { value: 'count',    label: 'Cantidad de leads' },
  { value: 'sum_valor', label: 'Suma de valor ($)' },
  { value: 'avg_valor', label: 'Promedio de valor ($)' },
]

export const METRICAS_Y_ACTIVIDADES = [
  { value: 'count', label: 'Cantidad de actividades' },
]

export const LINEA_METRICAS = [
  { value: 'leads_mensual', label: 'Leads creados por mes' },
  { value: 'valor_mensual', label: 'Valor acumulado por mes ($)' },
]

export const KPI_OPCIONES = [
  { value: 'leads_activos',    label: 'Total de leads activos' },
  { value: 'valor_pipeline',   label: 'Valor del pipeline ($)' },
  { value: 'tasa_conversion',  label: 'Tasa de conversión (%)' },
]

// ── Filtros globales del dashboard ────────────────────────────

export type FiltroKey =
  | 'fecha_rango'
  | 'rc'
  | 'etapa'
  | 'origen'
  | 'tipo_cliente'
  | 'tipo_operacion'

export const FILTROS_CATALOGO: Record<FiltroKey, { label: string; descripcion: string }> = {
  fecha_rango:    { label: 'Rango de fechas',    descripcion: 'Filtra por fecha de creación del lead' },
  rc:             { label: 'Responsable (RC)',    descripcion: 'Filtra por el RC asignado' },
  etapa:          { label: 'Etapa del pipeline', descripcion: 'Filtra por etapa actual del lead' },
  origen:         { label: 'Origen del lead',    descripcion: 'Filtra por cómo llegó el lead' },
  tipo_cliente:   { label: 'Tipo de cliente',    descripcion: 'Filtra por tipo de cliente' },
  tipo_operacion: { label: 'Tipo de operación',  descripcion: 'Filtra por tipo de operación' },
}

export interface ActiveFilters {
  fechaInicio?:   string
  fechaFin?:      string
  uidRC?:         string
  etapa?:         string
  origen?:        string
  tipoCliente?:   string
  tipoOperacion?: string
}

// ── Catálogos de filtros para la UI ───────────────────────────

export interface FiltroOption { value: string; label: string }

export interface FiltroCatalogs {
  rcs:            FiltroOption[]
  etapas:         FiltroOption[]
  origenes:       FiltroOption[]
  tiposCliente:   FiltroOption[]
  tiposOperacion: FiltroOption[]
}

export interface CrmReporte {
  id: string
  uid_creador: string
  nombre: string
  descripcion?: string
  es_publico: boolean
  fc: string
  nomCreador?: string
  filtros_disponibles: FiltroKey[]
}

export interface CrmWidget {
  id: string
  id_reporte: string
  titulo: string
  tipo: 'bar' | 'line' | 'pie' | 'kpi' | 'table'
  metrica: string
  config: WidgetConfig
  orden: number
  ancho: 'full' | 'half' | 'third'
}

export interface WidgetData {
  labels: string[]
  values: number[]
  kpiValue?: number | string
  kpiLabel?: string
  tableRows?: Record<string, string | number>[]
  tableColumns?: string[]
}

