# Módulo de Reportes Dinámicos

## Archivos principales

| Archivo | Líneas | Rol |
|---------|--------|-----|
| `components/reportes/dashboard-studio.tsx` | 246 | Orquestador principal del editor |
| `components/reportes/panels/properties-panel-dnd.tsx` | 565 | Panel propiedades + Drag-and-Drop |
| `components/reportes/panels/properties-panel.tsx` | 458 | Panel alternativo sin DnD |
| `components/reportes/panels/advanced-chart-config.tsx` | 603 | Config avanzada de gráficos |
| `components/reportes/chart-renderer-v2.tsx` | 427 | Renderizado de gráficos (V2 activo) |
| `components/reportes/chart-renderer.tsx` | 166 | V1 legacy — deprecado |
| `components/reportes/canvas/studio-canvas.tsx` | ~150 | Canvas Gridstack arrastrable |
| `components/reportes/canvas/widget-card.tsx` | — | Tarjeta de widget en canvas |
| `components/reportes/share-dialog.tsx` | 168 | Compartir reporte con usuarios |
| `lib/reportes/types.ts` | 150+ | Tipos e interfaces |
| `lib/reportes/actions.ts` | 200+ | Server actions CRUD |

## Tipos de datos clave

```typescript
type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'kpi' | 'table'
type Agregacion = 'count' | 'sum' | 'avg'
type Visibilidad = 'privado' | 'publico' | 'restringido'
type RolReporte = 'creador' | 'editor' | 'visor'

interface Widget {
  id: string
  id_report: string
  titulo: string
  tipo: ChartType
  fuente: 'v_leads_completo' | 'v_actividades_completo'
  campos_x: string[]    // dimensiones
  campos_y: string[]    // métricas
  agregacion: Agregacion
  filtros: FiltroWidget[]
  limite: number
  color_hex: string
  gs_x, gs_y, gs_w, gs_h: number  // posición Gridstack
  chart_config?: AdvancedChartConfig
}

interface WidgetData {
  labels: string[]
  values: number[]
  series?: { name: string; data: number[] }[]
  tableData?: { rows: string[][]; headers: string[] }
  kpiValue?: string | number
  isKpi: boolean
}
```

## Server actions disponibles

```typescript
// Reportes
getReports()                           // mis reportes + compartidos
getReportById(id)                      // reporte + widgets
createReport(nombre, descripcion)
updateReport(id, cambios)
deleteReport(id)

// Widgets
createWidget(idReport, campo_x, fuente)
updateWidget(id, cambios)
updateWidgetLayout(id, gs_x, gs_y, gs_w, gs_h)
deleteWidget(id)
getWidgetData(widgetId)                // datos para renderizar

// Permisos
getPermissions(reportId)
addPermission(reportId, uid, rol)
removePermission(permisoId)
getUsuariosDisponibles()
```

## Dashboard Studio — estado y handlers

```typescript
// Estado en dashboard-studio.tsx
const [report, setReport] = useState(initialReport)
const [widgets, setWidgets] = useState<Widget[]>(initialWidgets)
const [widgetData, setWidgetData] = useState<Record<string, WidgetData>>({})
const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null)
const [editMode, setEditMode] = useState(true)

// Handlers principales
handleFieldClick()      // asignar campo o crear widget
handleWidgetUpdate()    // actualizar configuración
handleAddWidget()       // crear widget
handleDeleteWidget()    // eliminar widget
loadWidgetData(id)      // cargar datos — llama getWidgetData server action
```

## Drag-and-Drop — properties-panel-dnd.tsx

**Solución implementada (30 abril 2026):**
- Usa `useDraggable` (NO `useSortable`) — no hay SortableContext
- Transform manual: `translate3d(${x}px, ${y}px, 0)` con objeto `{x, y}` de useDraggable
- `DndContext.onDragStart` lee `event.active.data.current?.campo` para activar DragOverlay
- `PointerSensor` con `activationConstraint: { distance: 8 }` para prevenir drag accidental
- `setActiveCampo(null)` en `handleDragEnd` para limpiar overlay

**Bug crítico resuelto:**
- `useSortable` requiere `SortableContext` ancestral — sin él isDragging y transform son null
- DragOverlay NO se activa con evento `onDragStart` nativo del HTML — requiere el de DndContext
- El campo `fuente` se propaga desde el estado local del widget, NO hardcodeado

## Bug de stale closure — dashboard-studio.tsx

**Solución implementada (30 abril 2026):**
- Eliminado `reloadWidget` useCallback por completo
- `handleWidgetUpdate` llama `loadWidgetData(id)` directamente en el setTimeout
- Dependency array actualizado a `[loadWidgetData]`
- `loadWidgetData` no depende del estado `widgets` — es seguro llamar desde setTimeout

## Canvas Gridstack

- 12 columnas por defecto, cellHeight: 5px, float: true
- Guarda layout en DB vía `updateWidgetLayout` con debounce 400ms
- Persiste preferencias de columnas y altura en localStorage
- Handles de drag: `.widget-drag-handle, .grid-stack-item-content`

## Configuración de zonas por tipo de gráfico

```typescript
const ZONES_CONFIG = {
  bar:   { campos_x: 'Eje X (Dimensiones)', campos_y: 'Eje Y (Métricas)' },
  line:  { campos_x: 'Eje X (Dimensiones)', campos_y: 'Eje Y (Métricas)' },
  pie:   { campos_x: 'Categoría',           campos_y: 'Valor' },
  area:  { campos_x: 'Eje X (Dimensiones)', campos_y: 'Eje Y (Métricas)' },
  kpi:   {                                   campos_y: 'Métrica KPI' },
  table: { campos_x: 'Filas',               campos_y: 'Columnas' }
}
```

## Fuentes de datos

| Vista | Uso principal |
|-------|--------------|
| `v_leads_completo` | Campos: nombreLead, Etapa, Origen, fecCreacion, FecSeguimiento, nomRC, etc. |
| `v_actividades_completo` | Campos: Descripción, Tipo, Fecha, Usuario, etc. |

## Chart Renderer V2 — defaults por tipo

```typescript
Bar:  xAxis angled -35°, yAxis visible, grid dotted, rounded corners
Line: strokeWidth 2.5, dotSize 3, grid, animate 400ms
Pie:  outerRadius 70%, paddingAngle 2
Area: showArea true, areaOpacity 0.3, strokeWidth 2
```
