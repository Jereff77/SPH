'use client';

import React from 'react';
import { Widget } from '@/lib/reportes/studio-store';

// ========== COMPONENTE ==========

interface FilterRendererProps {
  widget: Widget;
  width: number;
  height: number;
}

export function FilterRenderer({ widget, width, height }: FilterRendererProps) {
  if (!widget.mostrar_titulo) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#7a84a0',
          fontSize: 11
        }}
      >
        Filtro sin título
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: 8
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: '#7a84a0',
          whiteSpace: 'nowrap'
        }}
      >
        {widget.titulo}:
      </span>

      {/* Placeholder según tipo de filtro */}
      {widget.tipo === 'filter_daterange' && (
        <DateRangePlaceholder />
      )}
      {widget.tipo === 'filter_multiselect' && (
        <MultiSelectPlaceholder />
      )}
      {widget.tipo === 'filter_numericrange' && (
        <NumericRangePlaceholder />
      )}
      {widget.tipo === 'filter_toggle' && <TogglePlaceholder />}
    </div>
  );
}

// ========== PLACEHOLDERS ==========

function DateRangePlaceholder() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: '#f2f4f8',
        border: '1px solid #e2e6ef',
        borderRadius: 6,
        padding: '5px 10px',
        flex: 1,
        fontSize: 11,
        color: '#1b2d5e',
        cursor: 'pointer',
        justifyContent: 'space-between'
      }}
    >
      <span>01 Abr 2026</span>
      <span style={{ color: '#7a84a0' }}>—</span>
      <span>30 Abr 2026</span>
      <span style={{ color: '#7a84a0', fontSize: 13 }}>📅</span>
    </div>
  );
}

function MultiSelectPlaceholder() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        flex: 1,
        flexWrap: 'wrap'
      }}
    >
      {['Registro', 'Perdido', 'Contrato'].map(s => (
        <span
          key={s}
          style={{
            background: '#1b2d5e12',
            border: '1px solid #1b2d5e30',
            borderRadius: 4,
            padding: '3px 8px',
            fontSize: 10,
            color: '#1b2d5e',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}
        >
          {s}
          <span
            style={{
              color: '#7a84a0',
              fontSize: 9,
              cursor: 'pointer'
            }}
          >
            ×
          </span>
        </span>
      ))}
      <span
        style={{
          fontSize: 10,
          color: '#7dc244',
          cursor: 'pointer',
          fontWeight: 600
        }}
      >
        +
      </span>
    </div>
  );
}

function NumericRangePlaceholder() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flex: 1
      }}
    >
      <input
        type="number"
        placeholder="Mín"
        style={{
          flex: 1,
          padding: '4px 8px',
          border: '1px solid #e2e6ef',
          borderRadius: 4,
          fontSize: 11,
          color: '#1b2d5e'
        }}
      />
      <span style={{ color: '#7a84a0' }}>—</span>
      <input
        type="number"
        placeholder="Máx"
        style={{
          flex: 1,
          padding: '4px 8px',
          border: '1px solid #e2e6ef',
          borderRadius: 4,
          fontSize: 11,
          color: '#1b2d5e'
        }}
      />
    </div>
  );
}

function TogglePlaceholder() {
  return (
    <button
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        background: '#e2e6ef',
        border: 'none',
        position: 'relative',
        cursor: 'pointer'
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
          left: 2,
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
        }}
      />
    </button>
  );
}
