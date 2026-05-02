'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import { useReportStudioStore, Widget } from '@/lib/reportes/studio-store';
import { ChartRenderer } from '../renderers/chart-renderer';
import { KpiRenderer } from '../renderers/kpi-renderer';
import { TableRenderer } from '../renderers/table-renderer';
import { FilterRenderer } from '../renderers/filter-renderer';
import { updateWidgetLayout } from '@/lib/reportes/actions';
import { createClient } from '@/lib/supabase/client';
import { WidgetData } from '@/lib/reportes/types';

// ========== COMPONENTE ==========

interface WidgetWrapperProps {
  widget: Widget;
  selected: boolean;
  onSelect: () => void;
  zoom: number;
  mode?: 'design' | 'preview';
}

export function WidgetWrapper({ widget, selected, onSelect, zoom, mode = 'design' }: WidgetWrapperProps) {
  const { updateWidget } = useReportStudioStore();
  const [widgetData, setWidgetData] = useState<WidgetData | undefined>(undefined);

  // Cargar datos del widget cuando la configuración está completa
  useEffect(() => {
    const cargarDatos = async () => {
      const { config } = widget;
      if (!config) return;

      // Verificar si config está completa según tipo de widget
      const esKPI = widget.tipo === 'kpi';
      const configCompleta = esKPI
        ? !!(config.dimension && config.agregacion)
        : !!(config.dimension && config.metrica && config.agregacion);

      if (!configCompleta) {
        setWidgetData(undefined);
        return;
      }

      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from(config.fuente)
          .select('*')
          .limit(config.limite || 25);

        if (error) {
          console.error('Error cargando datos:', error);
          return;
        }

        // Transformar datos al formato del renderer
        const transformedData = transformarDatos(data || [], widget);
        setWidgetData({
          tipo: widget.tipo,
          datos: transformedData,
          metadata: {
            total: transformedData.length,
            campos: esKPI ? [config.dimension] : [config.dimension, config.metrica]
          }
        });
      } catch (err) {
        console.error('Error cargando datos:', err);
      }
    };

    cargarDatos();
  }, [widget.config?.dimension, widget.config?.metrica, widget.config?.agregacion, widget.id, widget.tipo]);

  // Debounce de persistencia de layout (no guardar en cada pixel de movimiento)
  const debouncedSave = useMemo(
    () =>
      debounce((layout: { pos_x: number; pos_y: number; width: number; height: number }) => {
        console.log('💾 Guardando layout:', {
          widgetId: widget.id,
          layout
        });

        // ✅ ACTUALIZAR STORE LOCAL INMEDIATAMENTE (para re-render con datos nuevos)
        updateWidget(widget.id, layout);

        // ✅ PERSISTIR EN SUPABASE (background, no bloquea UI)
        updateWidgetLayout(widget.id, layout).catch((err) => {
          console.error('Error persistiendo layout en Supabase:', err);
        });
      }, 300),
    [widget.id, updateWidget]
  );

  // Determinar qué renderer usar según tipo de widget
  const getRenderer = () => {
    const isFilter = widget.widget_category === 'filter';

    if (isFilter) {
      return <FilterRenderer widget={widget} width={widget.width} height={widget.height} />;
    }

    switch (widget.tipo) {
      case 'kpi':
        return <KpiRenderer widget={widget} width={widget.width} height={widget.height} data={widgetData} />;
      case 'table':
        return <TableRenderer widget={widget} width={widget.width} height={widget.height} data={widgetData} />;
      case 'bar':
      case 'bar_horizontal':
      case 'line':
      case 'area':
      case 'pie':
        return <ChartRenderer widget={widget} width={widget.width} height={widget.height} data={widgetData} />;
      default:
        return <div>Tipo no implementado: {widget.tipo}</div>;
    }
  };

  return (
    <Rnd
      scale={zoom / 100} // ✅ Compensar transform:scale() del canvas padre
      size={{
        width: widget.width,
        height: widget.height
      }}
      position={{
        x: widget.pos_x,
        y: widget.pos_y
      }}
      disableDragging={mode === 'preview'}
      enableResizing={mode === 'preview' ? false : undefined}
      onDrag={(e, d) => {
        // ✅ Actualizar store DURANTE el movimiento (elimina flash visual)
        updateWidget(widget.id, {
          pos_x: Math.round(d.x),
          pos_y: Math.round(d.y)
        });
      }}
      onDragStop={(e, d) => {
        // ✅ Solo persistir a Supabase al soltar (con debounce)
        debouncedSave({
          pos_x: Math.round(d.x),
          pos_y: Math.round(d.y),
          width: widget.width,
          height: widget.height
        });
      }}
      onResize={(e, direction, ref, delta, position) => {
        // ✅ Leer dimensiones reales del DOM (ya actualizadas por react-rnd)
        // Esto evita desincronización entre cálculo y renderizado
        const newWidth = parseInt(ref.style.width);
        const newHeight = parseInt(ref.style.height);

        updateWidget(widget.id, {
          width: newWidth,
          height: newHeight,
          pos_x: Math.round(position?.x || widget.pos_x),
          pos_y: Math.round(position?.y || widget.pos_y)
        });
      }}
      onResizeStop={(e, direction, ref, delta, position) => {
        // ✅ Leer dimensiones finales del DOM
        const finalWidth = parseInt(ref.style.width);
        const finalHeight = parseInt(ref.style.height);

        // ✅ Solo persistir a Supabase al soltar (con debounce)
        debouncedSave({
          pos_x: Math.round(position?.x || widget.pos_x),
          pos_y: Math.round(position?.y || widget.pos_y),
          width: finalWidth,
          height: finalHeight
        });
      }}
      // Compensar zoom para comportamiento natural del mouse
      dragGrid={!selected ? [1, 1] : [8, 8]} // Snap a 8px si seleccionado
      resizeHandleStyles={{
        bottomRight: {
          background: selected ? '#7dc244' : '#e2e6ef'
        },
        bottomLeft: {
          background: selected ? '#7dc244' : '#e2e6ef'
        },
        topRight: {
          background: selected ? '#7dc244' : '#e2e6ef'
        },
        topLeft: {
          background: selected ? '#7dc244' : '#e2e6ef'
        }
      }}
      style={{
        border: selected ? '2px solid #7dc244' : '1px solid #e2e6ef',
        borderRadius: 8,
        boxShadow: selected
          ? '0 0 0 3px rgba(125, 194, 68, 0.2), 0 2px 12px rgba(0,0,0,0.1)'
          : '0 1px 4px rgba(0,0,0,0.06)',
        zIndex: widget.z_index + (selected ? 1000 : 0),
        background: '#ffffff'
      }}
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation(); // Evitar burbujeo al canvas
        console.log('🖱️ Click en widget:', widget.id, 'título:', widget.titulo);
        onSelect();
      }}
    >
      {getRenderer()}
    </Rnd>
  );
}

// ========== UTILIDADES ==========

function transformarDatos(data: any[], widget: Widget): any[] {
  const { config } = widget;
  if (!config) return [];

  const esKPI = widget.tipo === 'kpi';

  // Para KPIs: agregar con la función especificada
  if (esKPI) {
    const campo = config.dimension;
    const agregacion = config.agregacion || 'count';

    if (agregacion === 'count') {
      // COUNT: retornar un solo registro con el total
      return [{ label: 'Total', value: data.length }];
    } else if (agregacion === 'sum' && campo) {
      // SUM: sumar el campo numérico
      const suma = data.reduce((acc, row) => acc + (Number(row[campo]) || 0), 0);
      return [{ label: 'Suma', value: suma }];
    } else if (agregacion === 'avg' && campo) {
      // AVG: promedio del campo numérico
      const valores = data.map(row => Number(row[campo]) || 0).filter(v => !isNaN(v));
      const promedio = valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : 0;
      return [{ label: 'Promedio', value: promedio }];
    } else if (agregacion === 'min' && campo) {
      // MIN: valor mínimo
      const valores = data.map(row => Number(row[campo]) || 0).filter(v => !isNaN(v));
      const min = valores.length > 0 ? Math.min(...valores) : 0;
      return [{ label: 'Mínimo', value: min }];
    } else if (agregacion === 'max' && campo) {
      // MAX: valor máximo
      const valores = data.map(row => Number(row[campo]) || 0).filter(v => !isNaN(v));
      const max = valores.length > 0 ? Math.max(...valores) : 0;
      return [{ label: 'Máximo', value: max }];
    }
    return [{ label: 'Total', value: data.length }];
  }

  // Para gráficos: agrupar por dimensión y aplicar agregación al campo métrica
  const dimension = config.dimension;
  const metrica = config.metrica;
  const agregacion = config.agregacion || 'sum';

  if (!dimension || !metrica) return [];

  // Agrupar datos por dimensión
  const agrupados = data.reduce((acc: any, row: any) => {
    const key = row[dimension];
    if (!acc[key]) {
      acc[key] = { label: key, value: 0, valores: [] };
    }

    // Recolectar valores para poder calcular avg, min, max
    const valor = Number(row[metrica]) || 0;
    acc[key].valores.push(valor);
    acc[key].value += valor; // Por defecto sumamos

    return acc;
  }, {});

  // Aplicar la función de agregación a cada grupo
  return Object.values(agrupados).map((grupo: any) => {
    if (agregacion === 'count') {
      grupo.value = grupo.valores.length;
    } else if (agregacion === 'sum') {
      grupo.value = grupo.valores.reduce((a: number, b: number) => a + b, 0);
    } else if (agregacion === 'avg') {
      grupo.value = grupo.valores.length > 0
        ? grupo.valores.reduce((a: number, b: number) => a + b, 0) / grupo.valores.length
        : 0;
    } else if (agregacion === 'min') {
      grupo.value = grupo.valores.length > 0 ? Math.min(...grupo.valores) : 0;
    } else if (agregacion === 'max') {
      grupo.value = grupo.valores.length > 0 ? Math.max(...grupo.valores) : 0;
    }
    // sum es el default, ya está calculado
    return grupo;
  });
}

function debounce(
  func: (...args: any[]) => void,
  wait: number
): (...args: any[]) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: any[]) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}
