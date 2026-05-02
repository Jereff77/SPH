'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useReportStudioStore } from '@/lib/reportes/studio-store';
import { getFieldsBySource, updateWidgetConfig } from '@/lib/reportes/actions';
import { CampoDisponible } from '@/lib/reportes/types';
import { validateWidgetConfig } from '@/lib/reportes/query-builder';

// ========== COMPONENTE ==========

export function DataPanel() {
  const selectedWidget = useReportStudioStore((s) =>
    s.widgets.find((w) => w.id === s.selectedId)
  );
  const selectedId = useReportStudioStore((s) => s.selectedId);
  const updateWidget = useReportStudioStore((s) => s.updateWidget);
  const setIsSaving = useReportStudioStore((s) => s.setIsSaving);

  const [availableFields, setAvailableFields] = useState<CampoDisponible[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Debounce para auto-guardado de config (500ms)
  const debouncedSaveConfig = useMemo(
    () => debounce(async (widgetId: string, config: any) => {
      try {
        await updateWidgetConfig(widgetId, config);
        setIsSaving(false);
      } catch (error) {
        console.error('Error guardando config:', error);
        setIsSaving(false);
      }
    }, 500),
    [setIsSaving]
  );

  // Cargar campos disponibles al cambiar widget o fuente
  useEffect(() => {
    if (!selectedWidget) return;

    const loadFields = async () => {
      if (!selectedWidget.config) return;

      setIsLoading(true);
      try {
        const fields = await getFieldsBySource(selectedWidget.config.fuente);
        setAvailableFields(fields);
      } catch (error) {
        console.error('Error cargando campos:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFields();
  }, [selectedWidget?.id, selectedWidget?.config?.fuente]);

  // Limpiar campos inválidos al cambiar fuente
  const handleFuenteChange = async (nuevaFuente: string) => {
    if (!selectedWidget || !selectedWidget.config) return;

    // Limpiar campos seleccionados (excepto fuente)
    const configLimpia = {
      ...selectedWidget.config,
      fuente: nuevaFuente,
      dimension: undefined,
      metrica: undefined
    };

    await updateWidget(selectedWidget.id, { config: configLimpia });

    // Los campos disponibles se actualizarán en el siguiente useEffect
  };

  // Wrapper para updateWidget con auto-save
  const handleUpdateWidget = (patch: any) => {
    if (!selectedWidget) return;

    // Actualizar store localmente (inmediato)
    updateWidget(selectedWidget.id, patch);

    // Si hay cambios en config, guardar a Supabase con debounce
    if (patch.config) {
      setIsSaving(true);  // ⚡ Feedback visual inmediato
      debouncedSaveConfig(selectedWidget.id, patch.config);
    }
  };

  // Placeholder cuando no hay widget seleccionado
  if (!selectedWidget) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#7a84a0',
          fontSize: 12,
          textAlign: 'center',
          padding: 20
        }}
      >
        Selecciona un widget para configurarlo
      </div>
    );
  }

  const isFilter = selectedWidget.widget_category === 'filter';
  const dimensiones = availableFields.filter((c) => c.tipo === 'dimension');
  const metricas = availableFields.filter((c) => c.tipo === 'metrica');
  const isKPI = selectedWidget.tipo === 'kpi';
  // Para KPIs, permitir seleccionar cualquier campo (dimensiones o métricas) para contar
  const camposParaKPI = isKPI ? availableFields : [];

  return (
    <div
      style={{
        width: '100%',  // ✅ Siempre 100% del padre - el padre controla el ancho
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        height: '100%'
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid #e2e6ef',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#1b2d5e'
            }}
          >
            {selectedWidget.titulo}
          </div>
          <div
            style={{
              fontSize: 10,
              color: '#7a84a0',
              marginTop: 1
            }}
          >
            {selectedWidget.tipo}
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}
      >
        {/* Filtros NO se configuran en Data Panel, vienen en Properties Panel Fase 3 */}
        {isFilter ? (
          <FilterConfigPanel
            widget={selectedWidget}
            availableFields={availableFields}
            onChange={handleUpdateWidget}
          />
        ) : (
          <ChartConfigPanel
            widget={selectedWidget}
            dimensiones={dimensiones}
            metricas={metricas}
            camposParaKPI={camposParaKPI}
            isLoadingFields={isLoading}
            onFuenteChange={handleFuenteChange}
            onChange={handleUpdateWidget}
          />
        )}
      </div>
    </div>
  );
}

// ========== SUBCOMPONENTES ==========

function ChartConfigPanel({
  widget,
  dimensiones,
  metricas,
  camposParaKPI,
  isLoadingFields,
  onFuenteChange,
  onChange
}: {
  widget: any;
  dimensiones: CampoDisponible[];
  metricas: CampoDisponible[];
  camposParaKPI: CampoDisponible[];
  isLoadingFields: boolean;
  onFuenteChange: (fuente: string) => void;
  onChange: (patch: any) => void;
}) {
  const config = widget.config || {};

  return (
    <>
      {/* Título */}
      <Field label="Título">
        <input
          value={widget.titulo}
          onChange={(e) =>
            onChange({ titulo: e.target.value })
          }
          style={inputStyle}
        />
      </Field>

      {/* Mostrar título */}
      <Field label="Mostrar título">
        <Toggle
          value={widget.mostrar_titulo}
          onChange={(val) => onChange({ mostrar_titulo: val })}
        />
      </Field>

      {/* Fuente de datos */}
      <Field label="Fuente de datos">
        <select
          value={config.fuente || ''}
          onChange={(e) => onFuenteChange(e.target.value)}
          style={inputStyle}
        >
          <option value="">Seleccionar fuente...</option>
          <option value="v_leads_completo">Leads Completos</option>
          <option value="v_actividades_completo">Actividades Completas</option>
        </select>
      </Field>

      {/* Campos según tipo de gráfico */}
      {getDropZonesByType(widget.tipo, dimensiones, metricas, camposParaKPI, config, onChange)}
    </>
  );
}

function FilterConfigPanel({
  widget,
  availableFields,
  onChange
}: {
  widget: any;
  availableFields: CampoDisponible[];
  onChange: (patch: any) => void;
}) {
  return (
    <>
      <Field label="Título">
        <input
          value={widget.titulo}
          onChange={(e) =>
            onChange({ titulo: e.target.value })
          }
          style={inputStyle}
        />
      </Field>

      <Field label="Mostrar título">
        <Toggle
          value={widget.mostrar_titulo}
          onChange={(val) => onChange({ mostrar_titulo: val })}
        />
      </Field>

      <Field label="Campo vinculado">
        <select
          value={widget.filter_config?.campo_vinculado || ''}
          onChange={(e) =>
            onChange({
              filter_config: {
                ...widget.filter_config,
                campo_vinculado: e.target.value
              }
            })
          }
          style={inputStyle}
        >
          <option value="">Seleccionar campo...</option>
          {availableFields.map((campo) => (
            <option key={campo.nombre} value={campo.nombre}>
              {campo.etiqueta || campo.nombre}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}

// ========== UTILIDADES ==========

function getDropZonesByType(
  tipo: string,
  dimensiones: CampoDisponible[],
  metricas: CampoDisponible[],
  camposParaKPI: CampoDisponible[],
  config: any,
  onChange: any
) {
  switch (tipo) {
    case 'kpi':
      return (
        <>
          <Field label="Dimensión">
            <select
              value={config.dimension || ''}
              onChange={(e) =>
                onChange({ config: { ...config, dimension: e.target.value } })
              }
              style={inputStyle}
            >
              <option value="">Seleccionar campo...</option>
              {camposParaKPI.map((c) => (
                <option key={c.nombre} value={c.nombre}>
                  {c.etiqueta || c.nombre}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Acción">
            <select
              value={config.agregacion || 'count'}
              onChange={(e) =>
                onChange({ config: { ...config, agregacion: e.target.value } })
              }
              style={inputStyle}
            >
              <option value="count">Contar registros (COUNT)</option>
              <option value="sum">Sumar valores (SUM)</option>
              <option value="avg">Promedio (AVG)</option>
              <option value="min">Mínimo (MIN)</option>
              <option value="max">Máximo (MAX)</option>
            </select>
          </Field>
        </>
      );

    case 'bar':
    case 'bar_horizontal':
    case 'line':
    case 'area':
    case 'pie':
      return (
        <>
          <Field label="Eje X (Dimensión)">
            <select
              value={config.dimension || ''}
              onChange={(e) =>
                onChange({ config: { ...config, dimension: e.target.value } })
              }
              style={inputStyle}
            >
              <option value="">Seleccionar dimensión...</option>
              {dimensiones.map((d) => (
                <option key={d.nombre} value={d.nombre}>
                  {d.etiqueta || d.nombre}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Eje Y (Campo)">
            <select
              value={config.metrica || ''}
              onChange={(e) =>
                onChange({ config: { ...config, metrica: e.target.value } })
              }
              style={inputStyle}
            >
              <option value="">Seleccionar campo...</option>
              {[...dimensiones, ...metricas].map((c) => (
                <option key={c.nombre} value={c.nombre}>
                  {c.etiqueta || c.nombre}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Acción">
            <select
              value={config.agregacion || 'sum'}
              onChange={(e) =>
                onChange({ config: { ...config, agregacion: e.target.value } })
              }
              style={inputStyle}
            >
              <option value="count">Contar registros (COUNT)</option>
              <option value="sum">Sumar valores (SUM)</option>
              <option value="avg">Promedio (AVG)</option>
              <option value="min">Mínimo (MIN)</option>
              <option value="max">Máximo (MAX)</option>
            </select>
          </Field>
        </>
      );

    case 'pie':
      return (
        <>
          <Field label="Categoría">
            <select
              value={config.dimension || ''}
              onChange={(e) =>
                onChange( { dimension: e.target.value })
              }
              style={inputStyle}
            >
              <option value="">Seleccionar categoría...</option>
              {dimensiones.map((d) => (
                <option key={d.nombre} value={d.nombre}>
                  {d.etiqueta || d.nombre}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Valor">
            <select
              value={config.metrica || ''}
              onChange={(e) =>
                onChange( { metrica: e.target.value })
              }
              style={inputStyle}
            >
              <option value="">Seleccionar valor...</option>
              {metricas.map((m) => (
                <option key={m.nombre} value={m.nombre}>
                  {m.etiqueta || m.nombre}
                </option>
              ))}
            </select>
          </Field>
        </>
      );

    default:
      return (
        <div style={{ color: '#7a84a0', fontSize: 11 }}>
          Configuración no disponible para: {tipo}
        </div>
      );
  }
}

// ========== COMPONENTES DE UI ==========

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: '#7a84a0',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginBottom: 5
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function Toggle({
  value,
  onChange
}: {
  value: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        background: value ? '#7dc244' : '#e2e6ef',
        border: 'none',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background 0.2s'
      }}
    >
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#ffffff',
          position: 'absolute',
          top: 2,
          left: value ? 18 : 2,
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
        }}
      />
    </button>
  );
}

// ========== ESTILOS ==========

const inputStyle = {
  width: '100%',
  border: '1px solid #e2e6ef',
  borderRadius: 5,
  padding: '5px 8px',
  fontSize: 12,
  color: '#1b2d5e',
  outline: 'none',
  background: '#ffffff'
};

// ========== UTILIDADES ==========

function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}
