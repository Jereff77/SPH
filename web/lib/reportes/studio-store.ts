import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { WidgetType } from './types';
import { updateReporte } from './actions';

// ========== TIPOS ==========

export interface WidgetLayout {
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
}

export interface Widget {
  id: string;
  tipo: WidgetType;
  widget_category: 'chart' | 'filter';
  titulo: string;
  mostrar_titulo: boolean;
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
  z_index: number;
  config?: Record<string, any>;
  filter_config?: Record<string, any>;
}

export interface Reporte {
  id: string;
  nombre: string;
  descripcion?: string;
  visibilidad: 'privado' | 'publico' | 'restringido';
  creado_por: string;
  fecha_creacion: string;
  fecha_actualizacion: string;
  page_width?: number;      // Ancho del lienzo (default 816)
  page_height?: number;     // Alto del lienzo (default 1056)
  zoom_mode?: 'fixed' | 'fit_width' | 'fit_height';  // Modo de zoom
  zoom_value?: number;      // Valor de zoom (solo para modo 'fixed')
}

interface FiltroActivo {
  campo: string;
  operador: 'igual' | 'distinto' | 'contiene' | 'no_contiene' | 'mayor' | 'menor' | 'entre' | 'en_lista';
  valor: any;
  valor2?: any; // Para operador 'entre'
}

interface ReportStudioState {
  // ========== DATOS SINCRONIZADOS CON SUPABASE ==========
  report: Reporte | null;
  widgets: Widget[];
  selectedId: string | null;
  activeFilters: FiltroActivo[]; // Fase 2: base, Fase 4: interactivos

  // ========== UI (PERSISTE EN LOCALSTORAGE) ==========
  zoom: number;                  // 40-150
  zoomMode: 'fixed' | 'fit_width' | 'fit_height';  // Modo de zoom actual
  pageWidth: number;             // Ancho del lienzo
  pageHeight: number;            // Alto del lienzo
  paletteCollapsed: boolean;     // Panel izquierdo colapsado
  rightPanelCollapsed: boolean;  // Panel derecho colapsado
  mode: 'design' | 'preview';    // Modo edición/vista

  // ========== ESTADO TEMPORAL ==========
  isSaving: boolean;             // Indicador visual de guardado en curso
  isDeleteDialogOpen: boolean;   // AlertDialog de confirmación de eliminación (efímero, no persiste)

  // ========== ACCIONES - DATOS ==========
  setReport: (report: Reporte) => void;
  setWidgets: (widgets: Widget[]) => void;
  addWidget: (widget: Widget) => void;
  updateWidget: (id: string, patch: Partial<Widget>) => void;
  updateWidgetLayout: (id: string, layout: WidgetLayout) => void;
  deleteWidget: (id: string) => void;
  setSelectedId: (id: string | null) => void;
  setDeleteDialogOpen: (open: boolean) => void;

  // ========== ACCIONES - FILTROS ==========
  setActiveFilters: (filters: FiltroActivo[]) => void;
  addFilter: (filter: FiltroActivo) => void;
  removeFilter: (campo: string) => void;

  // ========== ACCIONES - SUPABASE ==========
  initializeFromSupabase: (reporte: any, widgets: any[]) => void;

  // ========== ACCIONES - UI ==========
  setZoom: (zoom: number) => void;
  setZoomMode: (mode: 'fixed' | 'fit_width' | 'fit_height') => void;
  recalcZoom: () => void;  // Recalcular zoom según el modo actual
  setPageSize: (width: number, height: number) => void;
  togglePalette: () => void;
  toggleRightPanel: () => void;
  setMode: (mode: 'design' | 'preview') => void;

  // ========== ACCIONES - GUARDADO ==========
  setIsSaving: (isSaving: boolean) => void;
}

// ========== STORE ==========

// Debounce para persistir filtros en Supabase (500ms)
const debouncedSaveFilters = debounce(async (reporteId: string, filtros: object[]) => {
  try {
    await updateReporte(reporteId, { filtros_activos: filtros });
  } catch (error) {
    console.error('Error guardando filtros:', error);
  }
}, 500);

export const useReportStudioStore = create<ReportStudioState>()(
  persist(
    (set, get) => ({
      // ========== ESTADO INICIAL ==========
      report: null,
      widgets: [],
      selectedId: null,
      activeFilters: [],
      zoom: 75,
      zoomMode: 'fit_width',
      pageWidth: 816,
      pageHeight: 1056,
      paletteCollapsed: false,
      rightPanelCollapsed: false,
      mode: 'design',
      isSaving: false,
      isDeleteDialogOpen: false,

      // ========== ACCIONES - DATOS ==========
      setReport: (report) => set({ report }),

      setWidgets: (widgets) => set({ widgets }),

      addWidget: (widget) => set((state) => ({
        widgets: [...state.widgets, widget]
      })),

      updateWidget: (id, patch) => set((state) => ({
        widgets: state.widgets.map((w) =>
          w.id === id ? { ...w, ...patch } : w
        )
      })),

      updateWidgetLayout: (id, layout) => set((state) => ({
        widgets: state.widgets.map((w) =>
          w.id === id ? { ...w, ...layout } : w
        )
      })),

      deleteWidget: (id) => set((state) => ({
        widgets: state.widgets.filter((w) => w.id !== id),
        selectedId: state.selectedId === id ? null : state.selectedId
      })),

      setSelectedId: (id) => set({ selectedId: id }),

      setDeleteDialogOpen: (open) => set({ isDeleteDialogOpen: open }),

      // ========== ACCIONES - FILTROS ==========
      setActiveFilters: (filters) => {
        set({ activeFilters: filters });
        const { report } = get();
        if (report?.id) {
          debouncedSaveFilters(report.id, filters);
        }
      },

      addFilter: (filter) => {
        const nuevosFiltros = [
          ...get().activeFilters.filter((f) => f.campo !== filter.campo),
          filter
        ];
        set({ activeFilters: nuevosFiltros });
        const { report } = get();
        if (report?.id) {
          debouncedSaveFilters(report.id, nuevosFiltros);
        }
      },

      removeFilter: (campo) => {
        const nuevosFiltros = get().activeFilters.filter((f) => f.campo !== campo);
        set({ activeFilters: nuevosFiltros });
        const { report } = get();
        if (report?.id) {
          debouncedSaveFilters(report.id, nuevosFiltros);
        }
      },

      // ========== ACCIONES - UI ==========
      setZoom: (zoom) => set({ zoom, zoomMode: 'fixed' }),

      setZoomMode: (zoomMode) => set({ zoomMode }),

      setPageSize: (pageWidth, pageHeight) => set({ pageWidth, pageHeight }),

      togglePalette: () => set((state) => {
        const newState = {
          paletteCollapsed: !state.paletteCollapsed
        };

        // Recalcular zoom si es fit_width/fit_height
        if (state.zoomMode !== 'fixed') {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const canvasContainer = document.querySelector('.canvas-container');
              if (canvasContainer) {
                const padding = 64;
                let containerSize: number;
                let pageSize: number;

                if (state.zoomMode === 'fit_width') {
                  containerSize = canvasContainer.clientWidth - padding;
                  pageSize = state.pageWidth;
                } else {
                  containerSize = canvasContainer.clientHeight - padding;
                  pageSize = state.pageHeight;
                }

                const scale = containerSize / pageSize;
                const zoomPercent = Math.round(scale * 100);
                const clampedZoom = Math.max(40, Math.min(150, zoomPercent));

                useReportStudioStore.getState().setZoom(clampedZoom);
              }
            });
          });
        }

        return newState;
      }),

      toggleRightPanel: () => set((state) => {
        const newState = {
          rightPanelCollapsed: !state.rightPanelCollapsed
        };

        // Recalcular zoom si es fit_width/fit_height
        if (state.zoomMode !== 'fixed') {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const canvasContainer = document.querySelector('.canvas-container');
              if (canvasContainer) {
                const padding = 64;
                let containerSize: number;
                let pageSize: number;

                if (state.zoomMode === 'fit_width') {
                  containerSize = canvasContainer.clientWidth - padding;
                  pageSize = state.pageWidth;
                } else {
                  containerSize = canvasContainer.clientHeight - padding;
                  pageSize = state.pageHeight;
                }

                const scale = containerSize / pageSize;
                const zoomPercent = Math.round(scale * 100);
                const clampedZoom = Math.max(40, Math.min(150, zoomPercent));

                useReportStudioStore.getState().setZoom(clampedZoom);
              }
            });
          });
        }

        return newState;
      }),

      setMode: (mode) => set((state) => {
        const newState = { mode };

        // Recalcular zoom si es fit_width/fit_height y cambió a/desde preview
        if (state.zoomMode !== 'fixed') {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const canvasContainer = document.querySelector('.canvas-container');
              if (canvasContainer) {
                const padding = 64;
                let containerSize: number;
                let pageSize: number;

                if (state.zoomMode === 'fit_width') {
                  containerSize = canvasContainer.clientWidth - padding;
                  pageSize = state.pageWidth;
                } else {
                  containerSize = canvasContainer.clientHeight - padding;
                  pageSize = state.pageHeight;
                }

                const scale = containerSize / pageSize;
                const zoomPercent = Math.round(scale * 100);
                const clampedZoom = Math.max(40, Math.min(150, zoomPercent));

                // Actualizar el estado después del segundo frame
                useReportStudioStore.getState().setZoom(clampedZoom);
              }
            });
          });
        }

        return newState;
      }),

      recalcZoom: () => set((state) => {
        if (state.zoomMode === 'fit_width' || state.zoomMode === 'fit_height') {
          // Calcular zoom según el modo actual
          const canvasContainer = document.querySelector('.canvas-container');
          if (!canvasContainer) return state;

          const padding = 64; // 32px cada lado
          let containerSize: number;
          let pageSize: number;

          if (state.zoomMode === 'fit_width') {
            containerSize = canvasContainer.clientWidth - padding;
            pageSize = state.pageWidth;
          } else { // fit_height
            containerSize = canvasContainer.clientHeight - padding;
            pageSize = state.pageHeight;
          }

          const scale = containerSize / pageSize;
          const zoomPercent = Math.round(scale * 100);
          const clampedZoom = Math.max(40, Math.min(150, zoomPercent));

          return { zoom: clampedZoom };
        }

        return state; // No cambiar si es modo 'fixed'
      }),

      // ========== ACCIONES - GUARDADO ==========
      setIsSaving: (isSaving) => set({ isSaving }),

      // ========== ACCIONES - SUPABASE ==========
      initializeFromSupabase: (reporte: any, widgets: any[]) =>
        set((state) => {
          const newState: Partial<ReportStudioState> = {
            report: reporte,
            widgets
          };

          // Aplicar configuración de zoom desde Supabase
          if (reporte.zoom_mode === 'fixed' && reporte.zoom_value) {
            newState.zoom = reporte.zoom_value;
            newState.zoomMode = 'fixed';
          } else if (reporte.zoom_mode === 'fit_width') {
            newState.zoomMode = 'fit_width';
            // El zoom se calculará en el toolbar con fitToWidth()
          } else if (reporte.zoom_mode === 'fit_height') {
            newState.zoomMode = 'fit_height';
            // El zoom se calculará en el toolbar con fitToHeight()
          } else {
            // Default para reportes sin configuración de zoom
            newState.zoomMode = 'fit_width';
          }

          // Aplicar tamaño de página desde Supabase
          if (reporte.page_width && reporte.page_height) {
            newState.pageWidth = reporte.page_width;
            newState.pageHeight = reporte.page_height;
          }

          // Restaurar filtros activos desde Supabase
          if (reporte.filtros_activos && Array.isArray(reporte.filtros_activos)) {
            newState.activeFilters = reporte.filtros_activos;
          }

          return newState;
        }),
    }),
    {
      name: 'report-studio-ui',
      partialize: (state) => ({
        zoom: state.zoom,
        zoomMode: state.zoomMode,
        pageWidth: state.pageWidth,
        pageHeight: state.pageHeight,
        paletteCollapsed: state.paletteCollapsed,
        rightPanelCollapsed: state.rightPanelCollapsed
      })
    }
  )
);

// ========== UTILIDADES ==========
// Función debounce para auto-guardado de filtros
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
