'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useReportStudioStore } from '@/lib/reportes/studio-store';
import { updateReporte } from '@/lib/reportes/actions';

// ========== CONSTANTES ==========

const PAGE_SIZES = [
  { label: 'Carta vertical', width: 816, height: 1056 },
  { label: 'Carta horizontal', width: 1056, height: 816 },
  { label: 'A4 vertical', width: 794, height: 1123 },
  { label: 'A4 horizontal', width: 1123, height: 794 },
  { label: 'Personalizado', width: 0, height: 0 }  // Se maneja especialmente
];

const ZOOM_OPTIONS = [50, 60, 75, 90, 100, 125, 150];

// ========== COMPONENTE ==========

export function StudioToolbar() {
  const report = useReportStudioStore((s) => s.report);
  const zoom = useReportStudioStore((s) => s.zoom);
  const zoomMode = useReportStudioStore((s) => s.zoomMode);
  const setZoom = useReportStudioStore((s) => s.setZoom);
  const setZoomMode = useReportStudioStore((s) => s.setZoomMode);
  const pageWidth = useReportStudioStore((s) => s.pageWidth);
  const pageHeight = useReportStudioStore((s) => s.pageHeight);
  const setPageSize = useReportStudioStore((s) => s.setPageSize);
  const mode = useReportStudioStore((s) => s.mode);
  const setMode = useReportStudioStore((s) => s.setMode);
  const isSaving = useReportStudioStore((s) => s.isSaving);
  const setIsSaving = useReportStudioStore((s) => s.setIsSaving);

  const [reportName, setReportName] = useState(report?.nombre || 'Nuevo Reporte');
  const [customWidth, setCustomWidth] = useState(pageWidth);
  const [customHeight, setCustomHeight] = useState(pageHeight);

  // Debounce para auto-guardado del nombre (800ms)
  const debouncedSaveName = useMemo(
    () => debounce(async (nombre: string) => {
      if (!report?.id) return;

      try {
        await updateReporte(report.id, { nombre });
        setIsSaving(false);
      } catch (error) {
        console.error('Error guardando nombre:', error);
        setIsSaving(false);
      }
    }, 800),
    [report?.id, setIsSaving]
  );

  // Debounce para auto-guardado del zoom (500ms)
  const debouncedSaveZoom = useMemo(
    () => debounce(async (zoomMode: 'fixed' | 'fit_width' | 'fit_height', zoomValue?: number) => {
      if (!report?.id) return;

      try {
        await updateReporte(report.id, {
          zoom_mode: zoomMode,
          zoom_value: zoomValue
        });
        setIsSaving(false);
      } catch (error) {
        console.error('Error guardando zoom:', error);
        setIsSaving(false);
      }
    }, 500),
    [report?.id, setIsSaving]
  );

  // Debounce para auto-guardado del tamaño de página (500ms)
  const debouncedSavePageSize = useMemo(
    () => debounce(async (width: number, height: number) => {
      if (!report?.id) return;

      try {
        await updateReporte(report.id, {
          page_width: width,
          page_height: height
        });
        setIsSaving(false);
      } catch (error) {
        console.error('Error guardando tamaño de página:', error);
        setIsSaving(false);
      }
    }, 500),
    [report?.id, setIsSaving]
  );

  // Aplicar zoom automáticamente según el modo al cargar reporte
  useEffect(() => {
    // Solo ejecutar DESPUÉS de que el DOM esté montado
    if (zoomMode === 'fit_width') {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          fitToWidth();  // segundo frame garantiza layout completo
        });
      });
    } else if (zoomMode === 'fit_height') {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          fitToHeight();  // segundo frame garantiza layout completo
        });
      });
    }
  }, []); // Array vacío = solo ejecutar una vez al montar

  // Función para ajustar al ancho
  const fitToWidth = () => {
    const canvasContainer = document.querySelector('.canvas-container');
    if (!canvasContainer) return;

    const containerWidth = canvasContainer.clientWidth - 64; // 32px padding cada lado
    const scale = containerWidth / pageWidth;
    const zoomPercent = Math.round(scale * 100);

    const clampedZoom = Math.max(40, Math.min(150, zoomPercent));
    setZoom(clampedZoom);
  };

  // Función para ajustar a la altura
  const fitToHeight = () => {
    const canvasContainer = document.querySelector('.canvas-container');
    if (!canvasContainer) return;

    const containerHeight = canvasContainer.clientHeight - 64; // 32px padding cada lado
    const scale = containerHeight / pageHeight;
    const zoomPercent = Math.round(scale * 100);

    const clampedZoom = Math.max(40, Math.min(150, zoomPercent));
    setZoom(clampedZoom);
  };

  // Handler para cambiar zoom
  const handleZoomChange = (value: string) => {
    setIsSaving(true);  // ⚡ Feedback visual inmediato

    if (value === 'fit_width') {
      setZoomMode('fit_width');
      fitToWidth();
      debouncedSaveZoom('fit_width');
    } else if (value === 'fit_height') {
      setZoomMode('fit_height');
      fitToHeight();
      debouncedSaveZoom('fit_height');
    } else {
      const zoomValue = Number(value);
      setZoom(zoomValue);
      setZoomMode('fixed');
      debouncedSaveZoom('fixed', zoomValue);
    }
  };

  // Handler para cambiar tamaño de página
  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedSize = PAGE_SIZES.find(size => size.label === e.target.value);
    if (!selectedSize) return;

    if (selectedSize.label === 'Personalizado') {
      // No hacer nada - el usuario ingresa valores manualmente
      return;
    }

    setIsSaving(true);  // ⚡ Feedback visual inmediato
    setPageSize(selectedSize.width, selectedSize.height);
    setCustomWidth(selectedSize.width);
    setCustomHeight(selectedSize.height);
    debouncedSavePageSize(selectedSize.width, selectedSize.height);

    // Si el zoom es fit_width o fit_height, recalcular
    if (zoomMode === 'fit_width') {
      setTimeout(fitToWidth, 0);
    } else if (zoomMode === 'fit_height') {
      setTimeout(fitToHeight, 0);
    }
  };

  // Handler para tamaño personalizado
  const handleCustomSizeChange = (field: 'width' | 'height', value: string) => {
    const numValue = Number(value);
    if (isNaN(numValue) || numValue < 200 || numValue > 2000) return;

    setIsSaving(true);  // ⚡ Feedback visual inmediato

    const newWidth = field === 'width' ? numValue : pageWidth;
    const newHeight = field === 'height' ? numValue : pageHeight;

    if (field === 'width') {
      setCustomWidth(newWidth);
    } else {
      setCustomHeight(newHeight);
    }

    setPageSize(newWidth, newHeight);
    debouncedSavePageSize(newWidth, newHeight);

    // Si el zoom es fit_width o fit_height, recalcular
    if (zoomMode === 'fit_width') {
      setTimeout(fitToWidth, 0);
    } else if (zoomMode === 'fit_height') {
      setTimeout(fitToHeight, 0);
    }
  };

  // Determinar opción seleccionada en el dropdown de tamaño
  const selectedPageSize = PAGE_SIZES.find(
    size => size.width === pageWidth && size.height === pageHeight
  )?.label || 'Personalizado';

  return (
    <div
      style={{
        height: 52,
        background: '#ffffff',
        borderBottom: '1px solid #e2e6ef',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 12
      }}
    >
      {/* Breadcrumb + nombre editable */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flex: 1,
          minWidth: 0
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: '#7a84a0',
            flexShrink: 0
          }}
        >
          Reporteador /
        </span>
        <input
          value={reportName}
          onChange={(e) => {
            const nuevoNombre = e.target.value;
            setReportName(nuevoNombre);
            setIsSaving(true);  // ⚡ Feedback visual inmediato
            debouncedSaveName(nuevoNombre);
          }}
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: '#1b2d5e',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            minWidth: 0,
            width: `${reportName.length + 1}ch`
          }}
        />
        {/* Indicador visual de guardado */}
        {isSaving && (
          <span
            style={{
              fontSize: 10,
              color: '#7dc244',
              fontWeight: 600,
              flexShrink: 0
            }}
          >
            Guardando...
          </span>
        )}
      </div>

      {/* Tamaño de página */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: '#7a84a0'
          }}
        >
          Página:
        </span>
        <select
          value={selectedPageSize}
          onChange={handlePageSizeChange}
          style={{
            fontSize: 12,
            border: '1px solid #e2e6ef',
            borderRadius: 5,
            padding: '3px 6px',
            color: '#1b2d5e',
            outline: 'none',
            background: '#ffffff'
          }}
        >
          {PAGE_SIZES.map((size) => (
            <option key={size.label} value={size.label}>
              {size.label}
            </option>
          ))}
        </select>

        {/* Inputs personalizados (solo cuando es Personalizado) */}
        {selectedPageSize === 'Personalizado' && (
          <>
            <input
              type="number"
              value={customWidth}
              onChange={(e) => handleCustomSizeChange('width', e.target.value)}
              placeholder="Ancho"
              min={200}
              max={2000}
              style={{
                width: 60,
                fontSize: 11,
                border: '1px solid #e2e6ef',
                borderRadius: 5,
                padding: '3px 6px',
                color: '#1b2d5e',
                outline: 'none'
              }}
            />
            <span style={{ fontSize: 10, color: '#7a84a0' }}>×</span>
            <input
              type="number"
              value={customHeight}
              onChange={(e) => handleCustomSizeChange('height', e.target.value)}
              placeholder="Alto"
              min={200}
              max={2000}
              style={{
                width: 60,
                fontSize: 11,
                border: '1px solid #e2e6ef',
                borderRadius: 5,
                padding: '3px 6px',
                color: '#1b2d5e',
                outline: 'none'
              }}
            />
          </>
        )}
      </div>

      {/* Zoom */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: '#7a84a0'
          }}
        >
          Zoom:
        </span>
        <select
          value={zoomMode === 'fixed' ? String(zoom) : zoomMode}
          onChange={(e) => handleZoomChange(e.target.value)}
          style={{
            fontSize: 12,
            border: '1px solid #e2e6ef',
            borderRadius: 5,
            padding: '3px 6px',
            color: '#1b2d5e',
            outline: 'none',
            background: '#ffffff'
          }}
        >
          <optgroup label="Porcentaje">
            {ZOOM_OPTIONS.map((z) => (
              <option key={z} value={String(z)}>
                {z}%
              </option>
            ))}
          </optgroup>
          <optgroup label="Ajustar a">
            <option value="fit_width">Ajustar al ancho</option>
            <option value="fit_height">Ajustar a la altura</option>
          </optgroup>
        </select>
      </div>

      {/* Toggle Modo Diseño/Vista */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: '#f2f4f8',
          borderRadius: 6,
          padding: 3
        }}
      >
        {['Diseño', 'Vista previa'].map((m, i) => {
          const isActive =
            (i === 0 && mode === 'design') || (i === 1 && mode === 'preview');
          return (
            <button
              key={m}
              onClick={() => setMode(i === 0 ? 'design' : 'preview')}
              style={{
                padding: '4px 10px',
                borderRadius: 4,
                border: 'none',
                fontSize: 11,
                fontWeight: 600,
                background: isActive ? '#ffffff' : 'transparent',
                color: isActive ? '#1b2d5e' : '#7a84a0',
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer'
              }}
            >
              {m}
            </button>
          );
        })}
      </div>

      {/* Avatar usuario */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: '#1b2d5e',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 700,
          flexShrink: 0
        }}
      >
        J
      </div>
    </div>
  );
}

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
