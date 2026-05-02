'use client';

import React, { useRef, useState } from 'react';
import { useReportStudioStore } from '@/lib/reportes/studio-store';
import { deleteWidget } from '@/lib/reportes/actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { StudioToolbar } from './toolbar/studio-toolbar';
import { LibraryPanel } from './panels/library-panel';
import { ReportCanvas } from './canvas/report-canvas';
import { DataPanel } from './panels/data-panel';
import { PropertiesPanel } from './panels/properties-panel';

// ========== COMPONENTE ORQUESTADOR ==========

export function ReportStudio() {
  const mode = useReportStudioStore((s) => s.mode);
  const rightPanelCollapsed = useReportStudioStore((s) => s.rightPanelCollapsed);
  const toggleRightPanel = useReportStudioStore((s) => s.toggleRightPanel);
  const zoomMode = useReportStudioStore((s) => s.zoomMode);
  const recalcZoom = useReportStudioStore((s) => s.recalcZoom);
  const pageRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'data' | 'properties'>('data');

  // Estado para eliminación de widgets
  const selectedId = useReportStudioStore((s) => s.selectedId);
  const isDeleteDialogOpen = useReportStudioStore((s) => s.isDeleteDialogOpen);
  const setDeleteDialogOpen = useReportStudioStore((s) => s.setDeleteDialogOpen);
  const deleteWidgetFromStore = useReportStudioStore((s) => s.deleteWidget);

  // Handler de eliminación de widget (con confirmación)
  const handleEliminarWidget = async () => {
    if (!selectedId) return;

    try {
      // 1. Eliminar de Supabase (persistencia)
      await deleteWidget(selectedId);
    } catch (error) {
      console.error('Error eliminando widget:', error);
      setDeleteDialogOpen(false);
      return; // ← No actualizar el store si Supabase falló
    }

    // 2. Eliminar del store local (automáticamente deselecciona)
    deleteWidgetFromStore(selectedId);

    // 3. Cerrar diálogo
    setDeleteDialogOpen(false);
  };

  // Recalcular zoom cuando cambia el tamaño de la ventana
  React.useEffect(() => {
    const handleResize = () => {
      if (zoomMode !== 'fixed') {
        // Usar requestAnimationFrame doble para esperar layout completo
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            recalcZoom();
          });
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [zoomMode, recalcZoom]);

  return (
    <div
      style={{
        display: 'flex',
        flex: 1,  // ✅ Ocupar todo el espacio disponible del padre
        height: '100%',  // ✅ Usar 100% porque el wrapper ya define la altura
        overflow: 'hidden',
        background: '#f2f4f8'
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          overflow: 'hidden'
        }}
      >
        {/* Toolbar superior */}
        <StudioToolbar />

        {/* Área principal: paneles + canvas */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            overflow: 'hidden'  // ✅ Sin scroll aquí - solo el canvas scrollea
          }}
        >
          {/* Panel izquierdo - Paleta de widgets (solo modo diseño) */}
          {mode === 'design' && <LibraryPanel />}

          {/* Canvas central (siempre visible) */}
          <ReportCanvas ref={pageRef} />

          {/* Panel derecho - Configuración (siempre visible en modo diseño) */}
          {mode === 'design' && <RightPanel />}
        </div>
      </div>

      {/* AlertDialog de eliminación de widget (siempre montado) */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar widget?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El widget se eliminará permanentemente del reporte.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleEliminarWidget}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ========== COMPONENTES DE UI ==========

function RightPanel() {
  const rightPanelCollapsed = useReportStudioStore((s) => s.rightPanelCollapsed);
  const toggleRightPanel = useReportStudioStore((s) => s.toggleRightPanel);
  const [activeTab, setActiveTab] = useState<'data' | 'properties'>('data');

  const panelWidth = rightPanelCollapsed ? 40 : 264;

  return (
    <div
      style={{
        width: panelWidth,  // ✅ SIEMPRE fijo aquí (264px | 40px)
        flexShrink: 0,  // ✅ Nunca se encoge
        height: '100%',
        background: '#ffffff',
        borderLeft: rightPanelCollapsed ? 'none' : '1px solid #e2e6ef',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease'
      }}
    >
      {/* Header con botón de colapso */}
      <div
        style={{
          height: 52,
          borderBottom: rightPanelCollapsed ? 'none' : '1px solid #e2e6ef',
          display: 'flex',
          alignItems: 'center',
          justifyContent: rightPanelCollapsed ? 'center' : 'space-between',
          padding: rightPanelCollapsed ? 0 : '0 16px',
          position: 'relative'
        }}
      >
        {/* Botón de colapso (lado izquierdo del panel derecho) */}
        <button
          onClick={toggleRightPanel}
          style={{
            position: 'absolute',
            left: -12,
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: '#ffffff',
            border: '1px solid #e2e6ef',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: 10,
            color: '#7a84a0',
            boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
            zIndex: 10
          }}
          title={rightPanelCollapsed ? 'Expandir panel' : 'Colapsar panel'}
        >
          {rightPanelCollapsed ? '◀' : '▶'}
        </button>

        {!rightPanelCollapsed && (
          <>
            <div
              style={{
                display: 'flex',
                gap: 8
              }}
            >
              <TabButton
                label="Datos"
                active={activeTab === 'data'}
                onClick={() => setActiveTab('data')}
              />
              <TabButton
                label="Propiedades"
                active={activeTab === 'properties'}
                onClick={() => setActiveTab('properties')}
              />
            </div>
          </>
        )}
      </div>

      {/* Contenido del panel */}
      {!rightPanelCollapsed && (
        <div
          style={{
            flex: 1,
            overflowY: 'auto'
          }}
        >
          {activeTab === 'data' && <DataPanel />}
          {activeTab === 'properties' && <PropertiesPanel />}
        </div>
      )}
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '10px 0',
        background: 'transparent',
        border: 'none',
        borderBottom: active ? '2px solid #7dc244' : '2px solid transparent',
        fontSize: 11,
        fontWeight: 600,
        color: active ? '#1b2d5e' : '#7a84a0',
        cursor: 'pointer',
        transition: 'all 0.2s'
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.color = '#1b2d5e';
          e.currentTarget.style.background = '#f8f9fa';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.color = '#7a84a0';
          e.currentTarget.style.background = 'transparent';
        }
      }}
    >
      {label}
    </button>
  );
}
