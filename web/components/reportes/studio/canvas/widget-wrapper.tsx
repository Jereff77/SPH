'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import { useReportStudioStore, Widget } from '@/lib/reportes/studio-store';
import { ChartRenderer } from '../renderers/chart-renderer';
import { KpiRenderer } from '../renderers/kpi-renderer';
import { TableRenderer } from '../renderers/table-renderer';
import { FilterRenderer } from '../renderers/filter-renderer';
import { updateWidgetLayout, getWidgetData } from '@/lib/reportes/actions';
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
  const activeFilters = useReportStudioStore((s) => s.activeFilters);
  const [widgetData, setWidgetData] = useState<WidgetData | undefined>(undefined);

  // Cargar datos del widget cuando la configuración está completa
  useEffect(() => {
    const cargarDatos = async () => {
      // Widgets de filtro no cargan datos de gráfica
      if (widget.widget_category === 'filter') return;

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
        const data = await getWidgetData(widget.id, activeFilters);
        setWidgetData(data);
      } catch (err) {
        console.error('Error cargando datos del widget:', err);
        setWidgetData(undefined);
      }
    };

    cargarDatos();
  }, [widget.id, widget.config?.dimension, widget.config?.metrica, widget.config?.agregacion, widget.tipo, activeFilters]);

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
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header del título */}
        {widget.mostrar_titulo && (
          <div
            style={{
              height: 28,
              background: '#ffffff',
              borderBottom: '1px solid #e2e6ef',
              padding: '0 8px',
              display: 'flex',
              alignItems: 'center',
              fontSize: 11,
              fontWeight: 600,
              color: '#1b2d5e',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              flexShrink: 0
            }}
          >
            {widget.titulo || 'Sin título'}
          </div>
        )}

        {/* Contenido del widget */}
        <div
          style={{
            flex: 1,
            overflow: 'hidden'
          }}
        >
          {getRenderer()}
        </div>
      </div>
    </Rnd>
  );
}

// ========== UTILIDADES ==========

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
