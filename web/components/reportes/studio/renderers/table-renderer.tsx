'use client';

import React, { useState } from 'react';
import { WidgetData } from '@/lib/reportes/types';

// ========== COMPONENTE ==========

interface TableRendererProps {
  widget: any;
  data?: WidgetData;  // Opcional en Fase 2 - se conectará a datos reales en fases posteriores
  width: number;
  height: number;
}

interface TableData {
  [key: string]: any;
}

export function TableRenderer({ widget, data, width, height }: TableRendererProps) {
  const estilo = widget.config?.estilo || {};
  const colorPrincipal = estilo.color_principal || '#1b2d5e';
  const padding = estilo.padding ?? 12;
  const opacidad = estilo.opacidad ?? 1;

  const [pagina, setPagina] = useState(1);
  const filasPorPagina = 10;

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

  const datos = (data.datos || []) as TableData[];
  const totalFilas = datos.length;

  // Calcular índices para paginación
  const indiceInicio = (pagina - 1) * filasPorPagina;
  const indiceFin = indiceInicio + filasPorPagina;
  const filasVisibles = datos.slice(indiceInicio, indiceFin);

  const totalPaginas = Math.ceil(totalFilas / filasPorPagina);

  if (totalFilas === 0) {
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

  // Obtener columnas dinámicamente desde la primera fila
  const columnas = Object.keys(filasVisibles[0]).filter(
    key => key !== 'label' && !key.startsWith('_')
  );

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontSize: 11,
        opacity: opacidad
      }}
    >
      {/* Header de tabla */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columnas.length}, 1fr)`,
          background: `${colorPrincipal}12`,
          padding: `${padding * 0.3}px ${padding * 0.6}px`,
          borderBottom: '1px solid #e2e6ef',
          color: '#7a84a0',
          fontWeight: 600,
          letterSpacing: '0.03em',
          textTransform: 'uppercase',
          fontSize: 10,
          flexShrink: 0
        }}
      >
        {columnas.map(col => (
          <div key={col}>{col}</div>
        ))}
      </div>

      {/* Filas de datos */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto'
        }}
      >
        {filasVisibles.map((fila, index) => (
          <div
            key={index}
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${columnas.length}, 1fr)`,
              padding: `${padding * 0.5}px ${padding * 0.7}px`,
              borderBottom: '1px solid #e2e6ef',
              alignItems: 'center',
              background: index % 2 === 0 ? '#ffffff' : '#fafbfd'
            }}
          >
            {columnas.map(col => (
              <div
                key={col}
                style={{
                  color: '#1b2d5e',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {fila[col]}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Paginación */}
      {totalPaginas > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderTop: '1px solid #e2e6ef',
            background: '#ffffff',
            flexShrink: 0
          }}
        >
          <div style={{ color: '#7a84a0', fontSize: 10 }}>
            {indiceInicio + 1}-{Math.min(indiceFin, totalFilas)} de {totalFilas}
          </div>

          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => setPagina(Math.max(1, pagina - 1))}
              disabled={pagina === 1}
              style={{
                padding: `${padding * 0.3}px ${padding * 0.5}px`,
                borderRadius: 4,
                border: '1px solid #e2e6ef',
                background: pagina === 1 ? '#f2f4f8' : '#ffffff',
                color: pagina === 1 ? '#7a84a0' : colorPrincipal,
                fontSize: 10,
                cursor: pagina === 1 ? 'not-allowed' : 'pointer',
            }}
            >
              Anterior
            </button>

            <button
              onClick={() => setPagina(Math.min(totalPaginas, pagina + 1))}
              disabled={pagina === totalPaginas}
              style={{
                padding: `${padding * 0.3}px ${padding * 0.5}px`,
                borderRadius: 4,
                border: '1px solid #e2e6ef',
                background: pagina === totalPaginas ? '#f2f4f8' : '#ffffff',
                color: pagina === totalPaginas ? '#7a84a0' : colorPrincipal,
                fontSize: 10,
                cursor: pagina === totalPaginas ? 'not-allowed' : 'pointer'
              }}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
