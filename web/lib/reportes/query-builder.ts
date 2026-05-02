import { Widget, FiltroActivo, Agregacion } from './types';

// ========== QUERY BUILDER ==========

/**
 * Construye parámetros para la RPC get_widget_grouped
 *
 * SEPARACIÓN DE RESPONSABILIDADES:
 * - Este archivo SOLO construye parámetros tipados
 * - NO ejecuta queries directamente (eso hace actions.ts)
 * - NO construye SQL dinámico (la RPC ya tiene el query estático)
 *
 * @param widget - Widget con configuración
 * @param activeFilters - Filtros globales activos en el reporte
 * @returns Parámetros para RPC get_widget_grouped
 */
export function buildQueryParams(
  widget: Widget,
  activeFilters: FiltroActivo[] = []
): QueryParams {
  const { config } = widget;

  // Extraer parámetros base de la configuración del widget
  const params: QueryParams = {
    p_fuente: config.fuente,
    p_dimension: config.dimension || '',
    p_metrica: config.metrica || '',
    p_agregacion: config.agregacion || 'sum',
    p_fecha_desde: null,
    p_fecha_hasta: null,
    p_etapa: null,
    p_asesor: null,
    p_origen: null,
    p_limit: config.limite || 25
  };

  // Mapear filtros activos a parámetros específicos
  if (activeFilters.length > 0) {
    activeFilters.forEach(filtro => {
      switch (filtro.campo) {
        case 'fecha_creacion':
          if (filtro.operador === 'gte') {
            params.p_fecha_desde = filtro.valor;
          } else if (filtro.operador === 'lte') {
            params.p_fecha_hasta = filtro.valor;
          }
          break;

        case 'etapa':
          if (filtro.operador === 'eq') {
            params.p_etapa = filtro.valor;
          }
          break;

        case 'responsable_comercial':
          if (filtro.operador === 'eq') {
            params.p_asesor = filtro.valor;
          }
          break;

        case 'origen':
          if (filtro.operador === 'eq') {
            params.p_origen = filtro.valor;
          }
          break;
      }
    });
  }

  return params;
}

/**
 * Valida que la configuración del widget sea completa para generar query
 */
export function validateWidgetConfig(config: any, tipo?: string): ValidationResult {
  const errors: string[] = [];

  // Validar fuente
  if (!config.fuente) {
    errors.push('Debe seleccionar una fuente de datos');
  }

  // Validar campos según tipo de gráfico
  if (tipo === 'kpi') {
    // KPIs cuentan un campo (dimension)
    if (!config.dimension) {
      errors.push('Debe seleccionar un campo a contar');
    }
  } else if (tipo === 'table') {
    // Table solo requiere métrica
    if (!config.metrica) {
      errors.push('Debe seleccionar una métrica');
    }
  } else {
    // Barras, Línea, Área, Pastel requieren dimensión y campo
    if (!config.dimension) {
      errors.push('Debe seleccionar una dimensión (eje X)');
    }
    if (!config.metrica) {
      errors.push('Debe seleccionar un campo (eje Y)');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// ========== UTILIDADES ==========

/**
 * Clasifica un campo de la base de datos como dimensión o métrica
 *
 * @param dataType - Tipo de dato de PostgreSQL (text, integer, numeric, boolean, timestamp, uuid, etc.)
 * @returns 'dimension' | 'metrica'
 */
export function classifyCampoType(dataType: string): 'dimension' | 'metrica' {
  const tiposMetrica = ['integer', 'numeric', 'decimal', 'real', 'double precision', 'smallint', 'bigint'];
  return tiposMetrica.includes(dataType.toLowerCase()) ? 'metrica' : 'dimension';
}

/**
 * Genera etiqueta legible para un campo
 *
 * @param nombre - Nombre del campo en la base de datos (ej: "nombreLead", "fecha_creacion")
 * @returns Etiqueta legible (ej: "Nombre Lead", "Fecha Creación")
 */
export function generateCampoLabel(nombre: string): string {
  return nombre
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

/**
 * Construye parámetros de query desde la configuración del widget
 */
export interface QueryParams {
  p_fuente: string;
  p_dimension: string;
  p_metrica: string;
  p_agregacion: 'count' | 'sum' | 'avg' | 'min' | 'max';
  p_fecha_desde: string | null;
  p_fecha_hasta: string | null;
  p_etapa: string | null;
  p_asesor: string | null;
  p_origen: string | null;
  p_limit: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}
