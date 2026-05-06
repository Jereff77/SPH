'use server';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { Widget, CampoDisponible, WidgetData, ChartData, WidgetLayout } from './types';
import { buildQueryParams, classifyCampoType, generateCampoLabel } from './query-builder';

// ========== CLIENTE SUPABASE ==========

// NOTA: Usamos el cliente de servidor para tener acceso a las cookies de autenticación
// En lugar de crear un cliente nuevo aquí, cada función crea su propio cliente
async function getSupabaseClient() {
  return createServerClient();
}

// ========== CONSULTA DE CAMPOS DISPONIBLES ==========

/**
 * Obtiene campos por defecto para cuando no se puede consultar information_schema
 */
function getDefaultFields(fuente: string): CampoDisponible[] {
  const fields: Record<string, CampoDisponible[]> = {
    'v_leads_completo': [
      { nombre: 'lead_id', tipo: 'dimension', tipo_dato: 'uuid', etiqueta: 'ID Lead' },
      { nombre: 'nombreLead', tipo: 'dimension', tipo_dato: 'text', etiqueta: 'Nombre' },
      { nombre: 'etapa', tipo: 'dimension', tipo_dato: 'text', etiqueta: 'Etapa' },
      { nombre: 'lead_status', tipo: 'dimension', tipo_dato: 'boolean', etiqueta: 'Estado' },
      { nombre: 'origen', tipo: 'dimension', tipo_dato: 'text', etiqueta: 'Origen' },
      { nombre: 'responsable_comercial', tipo: 'dimension', tipo_dato: 'text', etiqueta: 'Asesor' },
      { nombre: 'fecha_creacion', tipo: 'dimension', tipo_dato: 'timestamp', etiqueta: 'Fecha Creación' },
      { nombre: 'valor', tipo: 'metrica', tipo_dato: 'numeric', etiqueta: 'Valor' }
    ],
    'v_actividades_completo': [
      { nombre: 'id', tipo: 'dimension', tipo_dato: 'uuid', etiqueta: 'ID Actividad' },
      { nombre: 'tipo_actividad', tipo: 'dimension', tipo_dato: 'text', etiqueta: 'Tipo' },
      { nombre: 'fecha', tipo: 'dimension', tipo_dato: 'timestamp', etiqueta: 'Fecha' },
      { nombre: 'mensaje', tipo: 'dimension', tipo_dato: 'text', etiqueta: 'Mensaje' },
      { nombre: 'nombreLead', tipo: 'dimension', tipo_dato: 'text', etiqueta: 'Lead' },
      { nombre: 'etapa', tipo: 'dimension', tipo_dato: 'text', etiqueta: 'Etapa' },
      { nombre: 'responsable_comercial', tipo: 'dimension', tipo_dato: 'text', etiqueta: 'Asesor' }
    ]
  };

  return fields[fuente] || [];
}

/**
 * Obtiene los campos disponibles de una vista (v_leads_completo o v_actividades_completo)
 * de forma dinámica desde information_schema.columns
 *
 * @param fuente - Nombre de la vista ('v_leads_completo' | 'v_actividades_completo')
 * @returns Array de campos clasificados como dimensión o métrica
 */
export async function getFieldsBySource(
  fuente: string
): Promise<CampoDisponible[]> {
  const supabase = await getSupabaseClient();

  // Validar que la fuente sea permitida
  const fuentesPermitidas = ['v_leads_completo', 'v_actividades_completo'];
  if (!fuentesPermitidas.includes(fuente)) {
    throw new Error(`Fuente de datos no permitida: ${fuente}`);
  }

  // Consultar information_schema.columns directamente
  const { data, error } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type')
    .eq('table_name', fuente)
    .eq('table_schema', 'public')
    .order('ordinal_position');

  // Si la consulta directa funciona, usar esos datos
  if (!error && data && data.length > 0) {
    return data.map((col: any) => ({
      nombre: col.column_name,
      tipo: classifyCampoType(col.data_type),
      tipo_dato: col.data_type,
      etiqueta: col.column_name
    }));
  }

  // Fallback: usar campos hardcoded cuando information_schema no funciona
  console.warn(`⚠️ information_schema no disponible, usando campos hardcoded para ${fuente}`);

  const defaultFields = getDefaultFields(fuente);
  if (defaultFields.length > 0) {
    return defaultFields;
  }

  throw new Error(`No se pudo obtener campos para ${fuente}. La vista no existe o no tienes acceso.`);
}

// ========== OBTENER DATOS DE WIDGET ==========

/**
 * Obtiene datos de un widget desde Supabase usando RPC segura
 *
 * @param widgetId - ID del widget
 * @param activeFilters - Filtros globales activos en el reporte
 * @returns Datos formateados para Recharts
 */
export async function getWidgetData(
  widgetId: string,
  activeFilters: any[] = []
): Promise<WidgetData> {
  const supabase = await getSupabaseClient();

  // Primero obtener el widget
  const { data: widget, error: widgetError } = await supabase
    .from('crm_widgets')
    .select('*')
    .eq('id', widgetId)
    .single();

  if (widgetError || !widget) {
    throw new Error(`Widget no encontrado: ${widgetId}`);
  }

  // Construir parámetros usando query-builder
  const params = buildQueryParams(widget, activeFilters);

  // Llamar RPC get_widget_grouped con parámetros seguros
  const { data: result, error: rpcError } = await supabase.rpc('get_widget_grouped', {
    p_fuente: params.p_fuente,
    p_dimension: params.p_dimension,
    p_metrica: params.p_metrica,
    p_agregacion: params.p_agregacion,
    p_fecha_desde: params.p_fecha_desde,
    p_fecha_hasta: params.p_fecha_hasta,
    p_filtros: params.p_filtros,
    p_limit: params.p_limit
  });

  if (rpcError) {
    console.error('Error en RPC get_widget_grouped:', rpcError);
    throw new Error(`Error al obtener datos: ${rpcError.message}`);
  }

  // Transformar resultado a formato de gráfico
  const chartData: ChartData[] = result || [];

  return {
    tipo: widget.tipo,
    datos: chartData,
    metadata: {
      total: chartData.reduce((sum, item) => sum + (item.value || 0), 0),
      campos: [params.p_dimension, params.p_metrica].filter(Boolean)
    }
  };
}

// ========== CRUD DE REPORTES ==========

/**
 * Obtiene un reporte por ID con todos sus widgets
 */
export async function getReporteById(
  reporteId: string
): Promise<{ reporte: any; widgets: any[] }> {
  const supabase = await getSupabaseClient();

  // Verificar autenticación primero
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    throw new Error('Debes estar autenticado para ver reportes');
  }

  // 1. Obtener reporte
  const { data: reporte, error: reporteError } = await supabase
    .from('crm_reports')
    .select('*')
    .eq('id', reporteId)
    .single();

  if (reporteError) {
    throw new Error(`Reporte no encontrado: ${reporteError.message}`);
  }

  // Verificar que el usuario sea el dueño del reporte
  if (reporte.creado_por !== user.id) {
    throw new Error('No tienes permiso para ver este reporte');
  }

  // 2. Obtener widgets del reporte
  const { data: widgets, error: widgetsError } = await supabase
    .from('crm_widgets')
    .select('*')
    .eq('reporte_id', reporteId)
    .order('z_index', { ascending: true });

  if (widgetsError) {
    throw new Error(`Error cargando widgets: ${widgetsError.message}`);
  }

  return { reporte, widgets: widgets || [] };
}

/**
 * Crea un nuevo reporte
 */
export async function createReporte(
  reporte: {
    nombre: string;
    descripcion?: string;
    visibilidad: 'privado' | 'publico' | 'restringido';
  }
): Promise<any> {
  const supabase = await getSupabaseClient();

  // Obtener usuario autenticado
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    throw new Error('Debes estar autenticado para crear reportes');
  }

  console.log('🔐 Usuario autenticado:', user.id);

  const reporteData = {
    nombre: reporte.nombre,
    descripcion: reporte.descripcion || '',
    visibilidad: reporte.visibilidad,
    creado_por: user.id
  };

  console.log('📊 Insertando reporte:', reporteData);

  const { data, error } = await supabase
    .from('crm_reports')
    .insert(reporteData)
    .select()
    .single();

  if (error) {
    console.error('❌ Error Supabase insert:', error);
    throw new Error(`Error creando reporte: ${error.message}`);
  }

  if (!data || !data.id) {
    console.error('❌ Reporte creado sin ID:', data);
    throw new Error('El reporte se creó pero no tiene ID');
  }

  console.log('✅ Reporte insertado en Supabase:', data);
  return data;
}

/**
 * Actualiza un reporte existente
 */
export async function updateReporte(
  reporteId: string,
  cambios: {
    nombre?: string;
    descripcion?: string;
    visibilidad?: 'privado' | 'publico' | 'restringido';
    page_width?: number;
    page_height?: number;
    zoom_mode?: 'fixed' | 'fit_width' | 'fit_height';
    zoom_value?: number;
    filtros_activos?: object[];
  }
): Promise<void> {
  const supabase = await getSupabaseClient();

  const { error } = await supabase
    .from('crm_reports')
    .update(cambios)
    .eq('id', reporteId);

  if (error) {
    throw new Error(`Error actualizando reporte: ${error.message}`);
  }
}

/**
 * Obtiene todos los reportes del usuario actual
 */
export async function getReportes(): Promise<any[]> {
  const supabase = await getSupabaseClient();

  // Verificar autenticación - regla de negocio
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    throw new Error('Debes estar autenticado para acceder a los reportes');
  }

  const { data, error } = await supabase
    .from('crm_reports')
    .select('*')
    .eq('creado_por', user.id)
    .order('fecha_creacion', { ascending: false });

  if (error) {
    throw new Error(`Error obteniendo reportes: ${error.message}`);
  }

  return data || [];
}

// ========== CRUD DE WIDGETS ==========

/**
 * Actualiza el layout de un widget (posición y tamaño)
 * Se llama después de drag/resize con debounce
 */
export async function updateWidgetLayout(
  widgetId: string,
  layout: WidgetLayout
): Promise<void> {
  const supabase = await getSupabaseClient();

  const { error } = await supabase
    .from('crm_widgets')
    .update({
      pos_x: layout.pos_x,
      pos_y: layout.pos_y,
      width: layout.width,
      height: layout.height
    })
    .eq('id', widgetId);

  if (error) {
    throw new Error(`Error actualizando layout: ${error.message}`);
  }
}

/**
 * Crea un nuevo widget
 */
export async function createWidget(
  widget: Partial<Widget>
): Promise<Widget> {
  const supabase = await getSupabaseClient();

  const { data, error } = await supabase
    .from('crm_widgets')
    .insert({
      reporte_id: widget.reporte_id ?? null,  // ✅ Fase 2: permite NULL temporal
      tipo: widget.tipo!,
      widget_category: widget.widget_category || 'chart',
      titulo: widget.titulo!,
      mostrar_titulo: widget.mostrar_titulo ?? true,
      pos_x: widget.pos_x ?? 16,
      pos_y: widget.pos_y ?? 16,
      width: widget.width ?? 380,
      height: widget.height ?? 240,
      z_index: widget.z_index ?? 1,
      config: widget.config || {},
      filter_config: widget.filter_config || {}
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Error creando widget: ${error.message}`);
  }

  return data;
}

/**
 * Obtiene valores distintos de un campo para populatear filtros multiselect
 *
 * @param fuente - Vista a consultar (v_leads_completo | v_actividades_completo)
 * @param campo - Campo a consultar
 * @returns Array de strings con valores únicos (max 50)
 */
export async function getDistinctValues(
  fuente: string,
  campo: string
): Promise<string[]> {
  const supabase = await getSupabaseClient();

  // Whitelist de fuentes permitidas
  const fuentesPermitidas = ['v_leads_completo', 'v_actividades_completo'];
  if (!fuentesPermitidas.includes(fuente)) {
    throw new Error(`Fuente no permitida: ${fuente}`);
  }

  // Whitelist de campos permitidos por fuente
  const camposPermitidos: Record<string, string[]> = {
    'v_leads_completo': [
      'lead_id', 'nombreLead', 'telefono', 'correo', 'lead_status',
      'fecha_creacion', 'responsable_comercial', 'etapa', 'origen',
      'tipo_cliente', 'tipo_operacion', 'tipo_venta'
    ],
    'v_actividades_completo': [
      'id', 'tipo_actividad', 'fecha', 'nombre', 'mensaje',
      'nivel_calor', 'nombreLead', 'etapa', 'responsable_comercial'
    ]
  };

  const camposFuente = camposPermitidos[fuente];
  if (!camposFuente || !camposFuente.includes(campo)) {
    throw new Error(`Campo no permitido para ${fuente}: ${campo}`);
  }

  // Ejecutar query DISTINCT
  const { data, error } = await supabase
    .rpc('get_distinct_values', {
      p_fuente: fuente,
      p_campo: campo,
      p_limit: 50
    });

  if (error) {
    throw new Error(`Error cargando valores distintos: ${error.message}`);
  }

  // La RPC retorna TABLE(valor TEXT)
  return data?.map((row: any) => row.valor).filter(Boolean) || [];
}

/**
 * Actualiza la configuración de un widget
 */
export async function updateWidgetConfig(
  widgetId: string,
  config: any,
  filterConfig?: any  // 🆕 Parámetro opcional para filter_config
): Promise<void> {
  const supabase = await getSupabaseClient();

  // Construir objeto de actualización con ambas columnas
  const updateData: any = { config };
  if (filterConfig !== undefined) {
    updateData.filter_config = filterConfig;
  }

  const { error } = await supabase
    .from('crm_widgets')
    .update(updateData)
    .eq('id', widgetId);

  if (error) {
    throw new Error(`Error actualizando widget: ${error.message}`);
  }
}

/**
 * Elimina un widget
 */
export async function deleteWidget(widgetId: string): Promise<void> {
  const supabase = await getSupabaseClient();

  const { error } = await supabase
    .from('crm_widgets')
    .delete()
    .eq('id', widgetId);

  if (error) {
    throw new Error(`Error eliminando widget: ${error.message}`);
  }
}

// ========== FUNCIONES AUXILIARES ==========

/**
 * Guarda el reporte completo (metadatos + widgets)
 */
export async function saveReporte(
  reporteId: string,
  widgets: Widget[]
): Promise<void> {
  const supabase = await getSupabaseClient();

  // Actualizar fecha de actualización
  const { error: reportError } = await supabase
    .from('crm_reports')
    .update({ fecha_actualizacion: new Date().toISOString() })
    .eq('id', reporteId);

  if (reportError) {
    throw new Error(`Error guardando reporte: ${reportError.message}`);
  }

  // Los widgets ya se persistieron individualmente durante drag/resize/config
  // No necesita hacer nada más aquí
}
