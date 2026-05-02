'use client';

import React from 'react';
import { Widget } from '@/lib/reportes/studio-store';
import { WidgetData } from '@/lib/reportes/types';

// ========== COMPONENTE ==========

interface KpiRendererProps {
  widget: any;
  data?: WidgetData;  // Opcional en Fase 2 - se conectará a datos reales en fases posteriores
  width: number;
  height: number;
}

// Íconos por defecto para KPIs
const KPI_ICONS: Record<string, string> = {
  count: '📊',
  sum: '💰',
  avg: '📈',
  max: '📈',
  min: '⬇️'
};

export function KpiRenderer({ widget, data, width, height }: KpiRendererProps) {
  // Fase 2: Si no hay datos, mostrar placeholder
  if (!data) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#7a84a0',
          fontSize: 12
        }}
      >
        Configura los datos
      </div>
    );
  }

  const { datos } = data;

  if (!datos || datos.length === 0) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#7a84a0',
          fontSize: 12
        }}
      >
        Sin datos
      </div>
    );
  }

  const valor = datos[0]?.value ?? 0;
  const agregacion = widget.config?.agregacion || 'count';
  const icon = KPI_ICONS[agregacion] || '▣';
  const color = widget.config?.estilo?.color_principal || '#3b82f6';

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '12px 16px',
        gap: 4
      }}
    >
      {/* Row 1: Icono + Valor */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}
      >
        {/* Icono */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: `${color}18`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            flexShrink: 0
          }}
        >
          {icon}
        </div>

        {/* Valor grande */}
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: '#7a84a0',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              lineHeight: 1.2
            }}
          >
            {widget.titulo}
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: '#1b2d5e',
              lineHeight: 1.1
            }}
          >
            {formatValue(valor, widget.config?.metrica)}
          </div>
        </div>
      </div>

      {/* Subtítulo (opcional) */}
      {widget.config?.subtitulo && (
        <div
          style={{
            fontSize: 10,
            color: '#7a84a0',
            paddingLeft: 40
          }}
        >
          {widget.config.subtitulo}
        </div>
      )}
    </div>
  );
}

// ========== UTILIDADES ==========

function formatValue(valor: number, metrica?: string): string {
  if (metrica === 'monto') {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0
    }).format(valor);
  }

  if (valor >= 1000000) {
    return `${(valor / 1000000).toFixed(1)}M`;
  }

  if (valor >= 1000) {
    return `${(valor / 1000).toFixed(1)}K`;
  }

  return new Intl.NumberFormat('es-MX').format(valor);
}
