'use client';

import React, { useMemo } from 'react';
import { useReportStudioStore } from '@/lib/reportes/studio-store';
import { updateWidgetConfig } from '@/lib/reportes/actions';
import { Button } from '@/components/ui/button';

// ========== COMPONENTE ==========

export function PropertiesPanel() {
  const selectedWidget = useReportStudioStore((s) =>
    s.widgets.find((w) => w.id === s.selectedId)
  );
  const updateWidget = useReportStudioStore((s) => s.updateWidget);
  const setIsSaving = useReportStudioStore((s) => s.setIsSaving);
  const setDeleteDialogOpen = useReportStudioStore((s) => s.setDeleteDialogOpen);

  // Debounce para auto-guardado de estilo (500ms)
  const debouncedSaveConfig = useMemo(
    () => debounce(async (widgetId: string, config: any) => {
      try {
        await updateWidgetConfig(widgetId, config);
        setIsSaving(false);
      } catch (error) {
        console.error('Error guardando estilo:', error);
        setIsSaving(false);
      }
    }, 500),
    [setIsSaving]
  );

  // Wrapper para actualizar estilo con auto-save
  const handleUpdateEstilo = (campoEstilo: string, valor: any) => {
    if (!selectedWidget) return;

    const nuevoConfig = {
      ...selectedWidget.config,
      estilo: {
        ...(selectedWidget.config?.estilo || {}),
        [campoEstilo]: valor
      }
    };

    // Actualizar store local inmediatamente
    updateWidget(selectedWidget.id, { config: nuevoConfig });

    // Persistir a Supabase con debounce 500ms
    setIsSaving(true);
    debouncedSaveConfig(selectedWidget.id, nuevoConfig);
  };

  if (!selectedWidget) {
    return (
      <div
        style={{
          width: '100%',  // ✅ Siempre 100% del padre
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

  const estilo = selectedWidget.config?.estilo || {};

  return (
    <div
      style={{
        width: '100%',  // ✅ Siempre 100% del padre
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
            Propiedades
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
        {/* Color principal */}
        <Field label="Color principal">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, 1fr)',
              gap: 6
            }}
          >
            {COLORS.map((color) => (
              <ColorButton
                key={color.value}
                color={color.value}
                selected={estilo.color_principal === color.value}
                onClick={() => handleUpdateEstilo('color_principal', color.value)}
              />
            ))}
          </div>
        </Field>

        {/* Padding */}
        <Field label="Padding">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <input
              type="range"
              min="0"
              max="32"
              value={estilo.padding || 12}
              onChange={(e) => handleUpdateEstilo('padding', parseInt(e.target.value))}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: '#e2e6ef',
                outline: 'none',
                WebkitAppearance: 'none'
              }}
            />
            <span
              style={{
                fontSize: 11,
                color: '#7a84a0',
                minWidth: 24,
                textAlign: 'right'
              }}
            >
              {estilo.padding || 12}px
            </span>
          </div>
        </Field>

        {/* Borde redondeado */}
        <Field label="Borde redondeado">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <input
              type="range"
              min="0"
              max="16"
              value={estilo.border_radius || 8}
              onChange={(e) => handleUpdateEstilo('border_radius', parseInt(e.target.value))}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: '#e2e6ef',
                outline: 'none',
                WebkitAppearance: 'none'
              }}
            />
            <span
              style={{
                fontSize: 11,
                color: '#7a84a0',
                minWidth: 24,
                textAlign: 'right'
              }}
            >
              {estilo.border_radius || 8}px
            </span>
          </div>
        </Field>

        {/* Opacidad */}
        <Field label="Opacidad">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <input
              type="range"
              min="50"
              max="100"
              value={((estilo.opacidad || 1) * 100).toFixed(0)}
              onChange={(e) => handleUpdateEstilo('opacidad', parseInt(e.target.value) / 100)}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: '#e2e6ef',
                outline: 'none',
                WebkitAppearance: 'none'
              }}
            />
            <span
              style={{
                fontSize: 11,
                color: '#7a84a0',
                minWidth: 32,
                textAlign: 'right'
              }}
            >
              {((estilo.opacidad || 1) * 100).toFixed(0)}%
            </span>
          </div>
        </Field>
      </div>

      {/* Footer con botón Eliminar */}
      <div
        style={{
          padding: '10px 14px',
          borderTop: '1px solid #e2e6ef'
        }}
      >
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setDeleteDialogOpen(true)}
          className="w-full"
        >
          Eliminar widget
        </Button>
      </div>
    </div>
  );
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

function ColorButton({
  color,
  selected,
  onClick
}: {
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 28,
        height: 28,
        borderRadius: 6,
        background: color,
        border: selected ? `2px solid ${color}` : '2px solid #e2e6ef',
        cursor: 'pointer',
        position: 'relative',
        transition: 'all 0.2s'
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.borderColor = color;
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.borderColor = '#e2e6ef';
        }
      }}
    >
      {selected && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 4,
            border: '2px solid #ffffff',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.1)'
          }}
        />
      )}
    </button>
  );
}

// ========== CONSTANTES ==========

const COLORS = [
  { value: '#7dc244', label: 'Verde' },
  { value: '#1b2d5e', label: 'Navy' },
  { value: '#3b82f6', label: 'Azul' },
  { value: '#f59e0b', label: 'Naranja' },
  { value: '#e85d4a', label: 'Rojo' },
  { value: '#8b5cf6', label: 'Púrpura' }
];

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
