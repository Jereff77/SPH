'use client';

import React, { forwardRef, useEffect } from 'react';
import { useReportStudioStore } from '@/lib/reportes/studio-store';
import { WidgetWrapper } from './widget-wrapper';

// ========== COMPONENTE ==========

interface ReportCanvasProps {
  // Props adicionales pueden agregarse en el futuro
}

export const ReportCanvas = forwardRef<HTMLDivElement, ReportCanvasProps>(
  (props, ref) => {
    const widgets = useReportStudioStore((s) => s.widgets);
    const selectedId = useReportStudioStore((s) => s.selectedId);
    const zoom = useReportStudioStore((s) => s.zoom);
    const pageWidth = useReportStudioStore((s) => s.pageWidth);
    const pageHeight = useReportStudioStore((s) => s.pageHeight);
    const mode = useReportStudioStore((s) => s.mode);
    const setSelectedId = useReportStudioStore((s) => s.setSelectedId);
    const setDeleteDialogOpen = useReportStudioStore((s) => s.setDeleteDialogOpen);

    // Hotkey: Delete / Backspace para eliminar widget seleccionado
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        // Solo Delete o Backspace
        if (e.key !== 'Delete' && e.key !== 'Backspace') return;

        // Guard: No dispararse si el foco está en un input/textarea/select
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

        // Solo si hay un widget seleccionado
        if (!selectedId) return;

        // Abrir el diálogo de confirmación
        setDeleteDialogOpen(true);
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedId, setDeleteDialogOpen]);

    const scale = zoom / 100;

    return (
      <div
        className="canvas-container"
        style={{
          overflow: 'auto',
          padding: '32px',
          background: '#e8ebf2',
          width: '100%',
          height: '100%'
        }}
        onClick={() => setSelectedId(null)}
      >
        {/* Contenedor externo con dimensiones escaladas (para scroll nativo) */}
        <div
          style={{
            width: pageWidth * scale,
            height: pageHeight * scale,
            margin: '0 auto',
            position: 'relative'
          }}
        >
          {/* Hoja interna con tamaño fijo + transform: scale()
              Este ref es el que se usa para exportación PDF */}
          <div
            ref={ref}
            className="report-page"
            style={{
              width: pageWidth,
              height: pageHeight,
              background: '#ffffff',
              boxShadow: '0 4px 32px rgba(0,0,0,0.18)',
              borderRadius: 2,
              transform: `scale(${scale})`,
              transformOrigin: 'top left'
            }}
          >
            {/* Widgets con drag + resize - Fase 2 */}
            {widgets.map((widget) => (
              <WidgetWrapper
                key={widget.id}
                widget={widget}
                selected={widget.id === selectedId}
                onSelect={() => setSelectedId(widget.id)}
                zoom={zoom}
                mode={mode}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }
);

ReportCanvas.displayName = 'ReportCanvas';
