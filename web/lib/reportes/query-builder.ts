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
    p_filtros: [],
    p_limit: config.limite || 25
  };

  // Procesar filtros activos
  if (activeFilters.length > 0) {
    const filtrosProcesados = activeFilters
      .filter(filtro => {
        // Excluir filtros de fecha especiales (se manejan con p_fecha_desde/hasta)
        if (filtro.campo === 'fecha_creacion') {
          // Los operadores mayor/menor/entre para fecha van a p_fecha_desde/hasta
          if (filtro.operador === 'mayor') {
            params.p_fecha_desde = filtro.valor;
          } else if (filtro.operador === 'menor') {
            params.p_fecha_hasta = filtro.valor;
          } else if (filtro.operador === 'entre') {
            params.p_fecha_desde = filtro.valor;
            params.p_fecha_hasta = filtro.valor2;
          }
          return false; // No incluir en p_filtros
        }
        return true; // Incluir en p_filtros
      })
      .map(filtro => {
        // Mapear operadores en español a valores del filtro
        const operadorMap: Record<string, string> = {
          'igual': 'igual',
          'en_lista': 'en_lista',
          'entre': 'entre'
        };

        return {
          campo: filtro.campo,
          operador: operadorMap[filtro.operador] || 'igual',
          valor: filtro.valor,
          valor2: filtro.valor2
        };
      });

    // Convertir a JSONB para Supabase (array JavaScript → JSONB automático)
    params.p_filtros = filtrosProcesados;
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
  p_filtros: object[];
  p_limit: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}
