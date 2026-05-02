'use client';

import React from 'react';
import { useReportStudioStore } from '@/lib/reportes/studio-store';
import { createWidget, createReporte } from '@/lib/reportes/actions';
import { useRouter } from 'next/navigation';

// ========== PALETTE DE WIDGETS ==========

const PALETTE = [
  {
    group: 'Gráficas',
    items: [
      { tipo: 'kpi', label: 'KPI', icon: '▣' },
      { tipo: 'bar', label: 'Barras vertical', icon: '▨' },
      { tipo: 'bar_horizontal', label: 'Barras horiz.', icon: '▤' },
      { tipo: 'line', label: 'Línea', icon: '∿' },
      { tipo: 'pie', label: 'Pastel', icon: '◔' },
      { tipo: 'table', label: 'Tabla', icon: '⊞' }
    ]
  },
  {
    group: 'Filtros',
    items: [
      { tipo: 'filter_daterange', label: 'Rango fechas', icon: '📅' },
      { tipo: 'filter_multiselect', label: 'Multiselect', icon: '☰' },
      { tipo: 'filter_numericrange', label: 'Rango numérico', icon: '⇔' },
      { tipo: 'filter_toggle', label: 'Toggle', icon: '⊙' }
    ]
  }
];

// ========== COMPONENTE ==========

export function LibraryPanel() {
  const collapsed = useReportStudioStore((s) => s.paletteCollapsed);
  const togglePalette = useReportStudioStore((s) => s.togglePalette);
  const addWidget = useReportStudioStore((s) => s.addWidget);
  const setReport = useReportStudioStore((s) => s.setReport);
  const setWidgets = useReportStudioStore((s) => s.setWidgets);
  const report = useReportStudioStore((s) => s.report);
  const [isCreating, setIsCreating] = React.useState(false);
  const router = useRouter();

  const handleAdd = async (tipo: string) => {
    if (isCreating) return; // Prevenir múltiples clics durante creación

    const isFilter = tipo.startsWith('filter_');
    const newItem = PALETTE.flatMap((g) => g.items).find(
      (i) => i.tipo === tipo
    );

    setIsCreating(true);

    try {
      // ✅ Paso 1: Si no hay reporte activo, crear uno automáticamente
      let reporteId = report?.id;

      if (!reporteId) {
        console.log('📄 Creando reporte automáticamente...');
        const nuevoReporte = await createReporte({
          nombre: 'Mi Reporte',
          descripcion: 'Creado automáticamente',
          visibilidad: 'privado'
        });
        reporteId = nuevoReporte.id;

        // Actualizar store y redirigir a la URL del nuevo reporte
        setReport(nuevoReporte);
        router.push(`/reportes/${nuevoReporte.id}`);
        console.log('✅ Reporte creado, redirigiendo a:', `/reportes/${nuevoReporte.id}`);
      }

      // Paso 2: Crear widget en Supabase con reporte_id real
      const widgetCreado = await createWidget({
        reporte_id: reporteId, // ✅ UUID real del reporte
        tipo: tipo as any,
        widget_category: isFilter ? 'filter' : 'chart',
        titulo: newItem?.label || 'Nuevo Widget',
        mostrar_titulo: true,
        pos_x: Math.round(16 + Math.random() * 100),
        pos_y: Math.round(16 + Math.random() * 100),
        width: isFilter ? 220 : 380,
        height: isFilter ? 52 : 240,
        z_index: 1,
        config: {
          fuente: 'v_leads_completo'
        },
        filter_config: undefined
      });

      // Paso 3: Agregar al store con UUID real de Supabase
      addWidget(widgetCreado);
    } catch (error) {
      console.error('Error creando widget:', error);
      alert('Error al crear widget. Revisa la consola para detalles.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div
      style={{
        width: collapsed ? 40 : 200,
        background: '#ffffff',
        borderRight: '1px solid #e2e6ef',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'width 0.2s',
        flexShrink: 0
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid #e2e6ef',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        {!collapsed && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#1b2d5e',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            Widgets
          </span>
        )}
        <button
          onClick={togglePalette}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 14,
            color: '#7a84a0',
            padding: 2,
            marginLeft: collapsed ? 'auto' : 0,
            cursor: 'pointer'
          }}
          title={collapsed ? 'Expandir paleta' : 'Colapsar paleta'}
        >
          {collapsed ? '▶' : '◀'}
        </button>
      </div>

      {/* Lista de widgets */}
      {!collapsed && (
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 0'
          }}
        >
          {PALETTE.map((group) => (
            <div key={group.group}>
              {/* Group header */}
              <div
                style={{
                  padding: '8px 12px 4px',
                  fontSize: 9,
                  fontWeight: 700,
                  color: '#7a84a0',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em'
                }}
              >
                {group.group}
              </div>

              {/* Group items */}
              {group.items.map((item) => (
                <div
                  key={item.tipo}
                  onClick={() => !isCreating && handleAdd(item.tipo)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 12px',
                    cursor: isCreating ? 'not-allowed' : 'pointer',
                    borderRadius: 4,
                    margin: '1px 6px',
                    fontSize: 12,
                    color: isCreating ? '#7a84a0' : '#1b2d5e',
                    userSelect: 'none',
                    opacity: isCreating ? 0.5 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!isCreating) {
                      e.currentTarget.style.background = '#f2f4f8';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isCreating) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                  title={isCreating ? 'Creando widget...' : `Agregar ${item.label}`}
                >
                  <span
                    style={{
                      width: 20,
                      textAlign: 'center',
                      fontSize: 13,
                      opacity: 0.7,
                      flexShrink: 0
                    }}
                  >
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                  {isCreating && (
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: 10,
                        color: '#7dc244',
                        fontWeight: 600
                      }}
                    >
                      Creando...
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
