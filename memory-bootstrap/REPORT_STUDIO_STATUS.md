# Report Studio - Estado del Proyecto

**Proyecto**: CRM Ventas - SPH Bienes Raíces  
**Módulo**: Report Studio - Constructor de reportes y dashboards  
**Fecha**: 2026-05-01  
**Fase Actual**: Fase 2 completada + Mejoras de canvas  
**Stack**: Next.js 16, Supabase, React, Zustand, Recharts, react-rnd

---

## 1. Resumen del Módulo

**Qué es Report Studio**: Un constructor visual de reportes y dashboards que permite a usuarios no técnicos crear reportes interactivos con gráficos, KPIs, tablas y filtros, similares a Google Data Studio o Power BI.

**Características principales**:
- Canvas libre con drag & drop de widgets
- 7 tipos de widgets: KPI, Barras vertical/horizontal, Línea, Área, Pastel, Tabla
- Configuración visual sin código (paneles laterales)
- Datos en tiempo real desde Supabase (vistas materializadas)
- Auto-save con debounce inteligente
- Zoom con 3 modos: fijo, ajustar al ancho, ajustar a la altura
- Tamaños de página configurables (Carta, A4, personalizado)
- Modo diseño / modo vista previa

**Rutas principales**:
- `/reportes` - Listado de reportes del usuario
- `/reportes/[id]` - Editor de Report Studio
- `/api/reportes` - API REST para crear reportes

---

## 2. Estado Actual por Fase

### ✅ Fase 1: Completada

**Objetivo**: Estructura base del módulo con layout y navegación

**Implementado**:
- ✅ Layout principal con toolbar, panel izquierdo, canvas, panel derecho
- ✅ Navegación desde `/reportes` hacia el editor
- ✅ Store de Zustand con estado inicial
- ✅ Integración con layout padre (crm) existente
- ✅ Modo diseño / modo vista previa (toggle en toolbar)

**Archivos creados**:
- `web/app/(crm)/reportes/page.tsx`
- `web/app/(crm)/reportes/[id]/page.tsx`
- `web/app/(crm)/reportes/[id]/reporte-page-client.tsx`
- `web/components/reportes/studio/report-studio.tsx`
- `web/lib/reportes/studio-store.ts`
- `web/components/reportes/studio/toolbar/studio-toolbar.tsx`
- `web/components/reportes/studio/canvas/report-canvas.tsx`

---

### ✅ Fase 2: Completada

**Objetivo**: Crear, configurar y visualizar widgets con datos reales de Supabase

**Implementado**:

#### 2.1. Panel izquierdo - Paleta de widgets
- ✅ Click-to-add de widgets al canvas
- ✅ 6 tipos de gráficos + KPI
- ✅ Colapsable (▶ / ◀)
- ✅ Posicionamiento aleatorio sin solapamiento

#### 2.2. Canvas con drag & resize
- ✅ `react-rnd` v10.5.3 con libertad total de movimiento
- ✅ Compensación de zoom con prop `scale`
- ✅ Drag suavizado sin flash visual (optimistic UI updates)
- ✅ Resize con handles en 4 esquinas
- ✅ Persistencia de layout con debounce 300ms
- ✅ z-index automático (último widget agregado arriba)

#### 2.3. Panel derecho - Configuración de widgets
- ✅ Tabs: "Datos" | "Propiedades"
- ✅ Selección de widget por click en canvas
- ✅ Panel siempre visible en modo diseño (40px colapsado | 264px expandido)
- ✅ Placeholder "Selecciona un widget para configurarlo"
- ✅ Botón de colapso (▶ / ◀) igual al panel izquierdo

**Panel de Datos**:
- ✅ Título editable
- ✅ Toggle para mostrar/ocultar título
- ✅ Selector de fuente de datos (v_leads_completo, v_actvidades_completo)
- ✅ Dropdowns dinámicos según tipo de widget:
  - **KPIs**: Dimensión + Acción (5 funciones de agregación)
  - **Gráficos**: Eje X (Dimensión) + Eje Y (Campo) + Acción
  - **Tablas**: Métrica
- ✅ 5 funciones de agregación: COUNT, SUM, AVG, MIN, MAX
- ✅ Auto-save con debounce 500ms al cambiar configuración
- ✅ Validación de configuración antes de guardar

**Panel de Propiedades** (Fase 3):
- Placeholder implementado, funcionalidad pendiente

#### 2.4. Conexión a datos reales
- ✅ Consulta dinámica de campos desde `information_schema.columns`
- ✅ Clasificación automática: dimensión vs métrica
- ✅ Fallback a campos hardcoded si information_schema no funciona
- ✅ Carga de datos desde Supabase en browser client
- ✅ Transformación de datos según tipo de widget y agregación
- ✅ Re-fetch automático al cambiar configuración

**Archivos creados/modificados**:
- `web/components/reportes/studio/panels/library-panel.tsx`
- `web/components/reportes/studio/panels/data-panel.tsx`
- `web/components/reportes/studio/panels/properties-panel.tsx`
- `web/components/reportes/studio/canvas/widget-wrapper.tsx`
- `web/lib/reportes/query-builder.ts`
- `web/lib/reportes/actions.ts`
- `web/lib/reportes/types.ts`
- `web/components/reportes/studio/renderers/` (4 archivos)

---

### ✅ Mejoras de Canvas: Completadas

**Objetivo**: Configuración avanzada del lienzo y zoom inteligente

**Implementado**:

#### 3.1. Tamaño de página configurable
- ✅ Estado en store: `pageWidth: 816, pageHeight: 1056`
- ✅ Persistencia en localStorage y Supabase
- ✅ Selector en toolbar con 4 opciones predefinidas:
  - Carta vertical: 816 × 1056px
  - Carta horizontal: 1056 × 816px
  - A4 vertical: 794 × 1123px
  - A4 horizontal: 1123 × 794px
- ✅ Personalizado: Inputs numéricos libres (200-2000px)
- ✅ Auto-save con debounce 500ms
- ✅ Widgets mantienen coordenadas al cambiar tamaño

#### 3.2. Zoom inteligente con 3 modos
- ✅ `zoom_mode` en Supabase: 'fixed' | 'fit_width' | 'fit_height'
- ✅ Default para reportes nuevos: `fit_width` (se adapta a cualquier pantalla)
- ✅ Selector de zoom con 2 grupos:
  - **Porcentaje fijo**: 50%, 60%, 75%, 90%, 100%, 125%, 150%
  - **Ajustar a**: Ajustar al ancho | Ajustar a la altura
- ✅ Auto-save con debounce 500ms

**Cálculo de zoom automático**:
- `fit_width`: scale = (containerWidth - 64) / pageWidth
- `fit_height`: scale = (containerHeight - 64) / pageHeight
- Clamp entre 40-150%
- Usa `requestAnimationFrame` doble para garantizar layout completo del DOM

**Recálculo automático en 4 situaciones**:
1. ✅ Cambio modo diseño ↔ vista previa
2. ✅ Toggle panel izquierdo (colapsar/expandir)
3. ✅ Toggle panel derecho (colapsar/expandir)
4. ✅ Resize de ventana (window resize event)

#### 3.3. Bugs corregidos

**Bug 1 - Dropdown de zoom**:
- **Problema**: Selector mostraba '50%' en lugar de 'Ajustar al ancho' cuando `zoom_mode` era `fit_width`
- **Causa**: El valor del select era el número calculado, no el modo
- **Solución**: `value={zoomMode === 'fixed' ? String(zoom) : zoomMode}`

**Bug 2 - Cálculo inicial de zoom**:
- **Problema**: Al cargar reporte con `zoom_mode: fit_width`, el DOM no estaba listo y `clientWidth` retornaba 0
- **Causa**: Cálculo síncrono antes de que el layout del DOM estuviera completo
- **Solución**: `requestAnimationFrame` doble en todas las funciones de recálculo:
  - Segundo frame garantiza que el layout está completo
  - Más confiable que `setTimeout(50ms)`

**Archivos modificados**:
- `web/lib/reportes/studio-store.ts` - Agregado `pageWidth, pageHeight, zoomMode, recalcZoom()`
- `web/components/reportes/studio/toolbar/studio-toolbar.tsx` - Selector de tamaño y zoom
- `web/components/reportes/studio/canvas/report-canvas.tsx` - Usa tamaño dinámico del store
- `web/lib/reportes/actions.ts` - `updateReporte()` acepta nuevos campos

**Migración SQL**:
```sql
ALTER TABLE crm_reports 
  ADD COLUMN IF NOT EXISTS page_width INTEGER DEFAULT 816,
  ADD COLUMN IF NOT EXISTS page_height INTEGER DEFAULT 1056,
  ADD COLUMN IF NOT EXISTS zoom_mode TEXT DEFAULT 'fit_width',
  ADD COLUMN IF NOT EXISTS zoom_value INTEGER DEFAULT 100,
  ADD CONSTRAINT crm_reports_zoom_mode_check 
    CHECK (zoom_mode IN ('fixed', 'fit_width', 'fit_height'));
```

---

### 🔄 Fase 3: Pendiente

**Objetivo**: Eliminación de widgets, filtros globales interactivos, permissions

**Por implementar**:
- Eliminar widgets (botón en panel derecho + hotkey Delete)
- Sistema de filtros globales interactivos
- Permissions (RLS policies para crm_reports)
- Exportación básica (imagen del canvas)

---

### 🔄 Fase 4: Pendiente

**Objetivo**: Sistema de filtros interactivos avanzado

**Por implementar**:
- 4 tipos de filtros: rango fechas, multiselect, rango numérico, toggle
- Filtros vinculados a widgets (afectan datos de múltiples widgets)
- Lógica de filtrado en Server Side (RPC segura)
- Estado de filtros persistido en Supabase

---

### 🔄 Fase 5: Pendiente

**Objetivo**: Exportación PDF y pulido final

**Por implementar**:
- Exportación PDF con biblioteca (jsPDF o similar)
- Estilos finales y pulido de UI
- Documentación de usuario
- Testing completo E2E

---

## 3. Arquitectura Actual

### Estructura de archivos

```
web/
├── app/(crm)/reportes/
│   ├── page.tsx                          # Listado de reportes (Server Component)
│   ├── reportes-list-client.tsx           # Cliente del listado (widgets)
│   └── [id]/
│       ├── page.tsx                       # Loader del reporte (Server Component)
│       └── reporte-page-client.tsx        # Inicializador del store (Client Component)
│
├── components/reportes/studio/
│   ├── report-studio.tsx                  # Orquestador principal (layout) ~200 líneas
│   ├── toolbar/
│   │   └── studio-toolbar.tsx             # Toolbar superior ~350 líneas
│   ├── panels/
│   │   ├── library-panel.tsx              # Paleta de widgets (izquierda) ~180 líneas
│   │   ├── data-panel.tsx                 # Configuración de datos (derecha) ~600 líneas
│   │   └── properties-panel.tsx           # Configuración visual (derecha) ~380 líneas
│   ├── canvas/
│   │   ├── report-canvas.tsx              # Canvas con scroll ~80 líneas
│   │   └── widget-wrapper.tsx             # Wrapper de cada widget ~300 líneas
│   └── renderers/
│       ├── chart-renderer.tsx             # Renderiza Recharts (bar, line, pie) ~200 líneas
│       ├── kpi-renderer.tsx               # Renderiza KPIs ~80 líneas
│       ├── table-renderer.tsx             # Renderiza tablas ~60 líneas
│       └── filter-renderer.tsx            # Renderiza filtros ~40 líneas
│
├── lib/reportes/
│   ├── studio-store.ts                    # Zustand store ~250 líneas
│   ├── actions.ts                         # Server Actions + API calls ~420 líneas
│   ├── query-builder.ts                   # Construye params RPC ~160 líneas
│   └── types.ts                           # Interfaces TypeScript ~180 líneas
```

**Total aproximado**: ~3,200 líneas de código TypeScript/TSX

### Responsabilidades por archivo

**Capa de Presentación (Client Components)**:
- `report-studio.tsx`: Layout principal, conecta paneles y canvas
- `studio-toolbar.tsx`: Header con nombre, zoom, tamaño página, toggle modo
- `library-panel.tsx`: Paleta de widgets click-to-add
- `data-panel.tsx`: Configuración de datos (dimensión, métrica, agregación)
- `properties-panel.tsx`: Configuración visual (colores, padding, borde)
- `report-canvas.tsx`: Canvas scrollable con transform scale
- `widget-wrapper.tsx`: Wrapper individual de cada widget con drag/resize
- `renderers/`: Componentes visuales para cada tipo de widget

**Capa de Lógica (Store + Actions)**:
- `studio-store.ts`: Estado global con Zustand, persist UI en localStorage
- `actions.ts`: Server Actions para CRUD + funciones auxiliares
- `query-builder.ts`: Construye params tipados para RPC
- `types.ts`: Interfaces TypeScript del dominio

**Capa de Datos (Supabase)**:
- `v_leads_completo`: Vista materializada de leads
- `v_actividades_completo`: Vista materializada de actividades
- `crm_reports`: Metadatos de reportes
- `crm_widgets`: Configuración de widgets
- `get_widget_grouped`: RPC segura para datos agrupados

---

## 4. Decisiones Técnicas Tomadas

### 1. Zustand con persist limitado solo para UI

**Decisión**: Usar Zustand con `persist` middleware solo para estado de UI (zoom, paneles colapsados, tamaño página), NO para datos sincronizados con Supabase.

**Razonamiento**:
- ✅ Los datos (report, widgets) deben venir siempre de Supabase como "source of truth"
- ✅ Evita conflicts de merge entre localStorage y Supabase
- ✅ La UI es preferencia de usuario, sí tiene sentido persistirla localmente
- ✅ Al recargar la página, los datos se cargan desde Supabase, la UI desde localStorage

**Implementación**:
```typescript
persist(
  (set) => ({ /* store */ }),
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
```

---

### 2. Auto-save con debounce por tipo de cambio

**Decisión**: Diferentes tiempos de debounce según el tipo de cambio:
- Nombre: 800ms (usuario escribe más lento)
- Config widget: 500ms (cambios de dropdown)
- Layout widget: 300ms (drag/resize es muy frecuente)
- Zoom: 500ms
- Tamaño página: 500ms

**Razonamiento**:
- ✅ Equilibra UX (feedback rápido) con performance (no saturar Supabase)
- ✅ El indicador "Guardando..." aparece INMEDIATAMENTE (no espera al debounce)
- ✅ Debounce solo reduce las llamadas a Supabase, no afecta la UI local

**Implementación**:
```typescript
// Al cambiar cualquier valor:
setIsSaving(true)  // aparece "Guardando..." inmediatamente
debouncedSave()    // espera 500-800ms

// Dentro del debouncedSave:
await updateReporte(...)  // ejecuta el Server Action
setIsSaving(false)        // desaparece "Guardando..."
```

---

### 3. react-rnd con prop scale para zoom

**Decisión**: Usar `react-rnd` v10.5.3 con `scale` prop para compensar el `transform: scale()` del canvas padre.

**Razonamiento**:
- ✅ Evita bugs de mouse offset al hacer drag/zoom
- ✅ Sin scale, el mouse se desincroniza del elemento arrastrado
- ✅ `react-rnd` apply scale automáticamente a coordenadas del mouse
- ✅ Más performant que reconstruir el layout en cada zoom

**Implementación**:
```typescript
<Rnd
  scale={zoom / 100}  // ✅ Compensar transform:scale() del canvas padre
  size={{ width: widget.width, height: widget.height }}
  position={{ x: widget.pos_x, y: widget.pos_y }}
  // ...
/>
```

---

### 4. Campos de vistas como constante en TypeScript

**Decisión**: Definir campos disponibles de `v_leads_completo` y `v_actividades_completo` como constante fallback en código, no solo depender de `information_schema`.

**Razonamiento**:
- ✅ `information_schema.columns` no funciona igual para vistas en PostgreSQL
- ✅ Algunos hosting no exponen information_schema por seguridad
- ✅ La constante garantiza que la UI siempre tenga campos disponibles
- ✅ Se intenta consultar information_schema primero, si falla usa la constante

**Implementación**:
```typescript
// En actions.ts
function getDefaultFields(fuente: string): CampoDisponible[] {
  const fields: Record<string, CampoDisponible[]> = {
    'v_leads_completo': [
      { nombre: 'lead_id', tipo: 'dimension', tipo_dato: 'uuid', etiqueta: 'ID Lead' },
      { nombre: 'nombreLead', tipo: 'dimension', tipo_dato: 'text', etiqueta: 'Nombre' },
      // ...
    ],
    'v_actividades_completo': [
      // ...
    ]
  };
  return fields[fuente] || [];
}

export async function getFieldsBySource(fuente: string): Promise<CampoDisponible[]> {
  // Intentar consultar information_schema primero
  const { data, error } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type')
    .eq('table_name', fuente);

  if (!error && data?.length > 0) {
    return data.map(col => ({ /* mapear */ }));
  }

  // Fallback a campos hardcoded
  return getDefaultFields(fuente);
}
```

---

### 5. zoom_mode en Supabase (fit_width/fit_height/fixed)

**Decisión**: Guardar el modo de zoom en Supabase (`zoom_mode`) además del valor numérico (`zoom_value`), con default `fit_width` para reportes nuevos.

**Razonamiento**:
- ✅ Reportes son "responsive" — se adaptan a cualquier pantalla del usuario
- ✅ `fit_width` = "siempre veo el reporte completo en ancho"
- ✅ `fit_height` = "siempre veo el reporte completo en alto"
- ✅ `fixed` = usuario eligió un zoom específico (ej: 100%)
- ✅ Al compartir reporte entre usuarios con pantallas distintas, `fit_width` garantiza usabilidad

**Implementación**:
```sql
CREATE TABLE crm_reports (
  -- ...
  zoom_mode TEXT DEFAULT 'fit_width',
  zoom_value INTEGER DEFAULT 100,
  CONSTRAINT crm_reports_zoom_mode_check 
    CHECK (zoom_mode IN ('fixed', 'fit_width', 'fit_height'))
);
```

**Lógica de inicialización**:
```typescript
if (report.zoom_mode === 'fixed' && report.zoom_value) {
  setZoom(report.zoom_value);
} else if (report.zoom_mode === 'fit_width') {
  fitToWidth();  // calcula según pantalla del usuario
} else if (report.zoom_mode === 'fit_height') {
  fitToHeight();
}
```

---

### 6. Server Components + Client Components separados

**Decisión**: Usar patrón Server Component + Client Component separados, NO mezclar lógica de servidor en componentes del editor.

**Razonamiento**:
- ✅ Server Components (`page.tsx`) manejan autenticación y carga inicial de datos
- ✅ Client Components (`reporte-page-client.tsx`, `report-studio.tsx`) manejan estado interactivo
- ✅ Separación clara entre "qué mostrar" (server) y "cómo interactuar" (client)
- ✅ Server Actions marcados con `'use server'` se pueden llamar desde Client Components

**Implementación**:
```typescript
// app/(crm)/reportes/[id]/page.tsx (Server Component)
export default async function ReportePage({ params }: ReportePageProps) {
  const { id } = await params;
  const { reporte, widgets } = await getReporteById(id);  // Server Action
  return <ReportePageClient reporte={reporte} widgets={widgets} />;
}

// app/(crm)/reportes/[id]/reporte-page-client.tsx (Client Component)
'use client';
export function ReportePageClient({ reporte, widgets }) {
  const initializeFromSupabase = useReportStudioStore(s => s.initializeFromSupabase);
  useEffect(() => {
    initializeFromSupabase(reporte, widgets);
  }, [reporte, widgets]);
  return <ReportStudio />;
}
```

---

### 7. API Route para createReporte en lugar de Server Action

**Decisión**: Usar REST API endpoint `/api/reportes` (POST) en lugar de Server Action `createReporte()`.

**Razonamiento**:
- ✅ El usuario ya implementó la ruta API antes de que yo llegara
- ✅ Server Actions existentes (`updateReporte`, `getWidgetData`, etc.) funcionan correctamente
- ✅ Solo `createReporte` usa API Route por decisión del usuario (posiblemente para manejar autenticación de forma diferente)
- ✅ No hay conflicto en tener ambos patrones en el mismo proyecto

**Implementación**:
```typescript
// web/app/api/reportes/route.ts (API Route - POST)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const supabase = createServerClient();
  
  // Verificar autenticación
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  
  // Crear reporte
  const { data } = await supabase
    .from('crm_reports')
    .insert({ /* ... */ })
    .select()
    .single();
  
  return NextResponse.json(data);
}

// Server Actions para otras operaciones
export async function updateReporte(id, cambios) {
  const supabase = await getSupabaseClient();
  await supabase.from('crm_reports').update(cambios).eq('id', id);
}
```

---

## 5. Bugs Conocidos Pendientes

### ✅ Bugs Corregidos (Fase 2 + Mejoras Canvas)

1. **✅ Dropdown de zoom muestra porcentaje incorrecto** - CORREGIDO
   - Cambiado de `value={zoomMode === 'fixed' ? zoom : zoomMode}` a `value={zoomMode === 'fixed' ? String(zoom) : zoomMode}`

2. **✅ Cálculo inicial de zoom falla** - CORREGIDO
   - Cambiado de cálculo síncrono a `requestAnimationFrame` doble

3. **✅ IDs temporales causan UUIDs inválidos** - CORREGIDO (Fase 2)
   - `createWidget` ahora retorna ID generado por Supabase

4. **✅ Flash visual al arrastrar widgets** - CORREGIDO (Fase 2)
   - `onDrag` actualiza store local inmediatamente, `onDragStop` persiste a Supabase

5. **✅ Dropdowns no guardan selección** - CORREGIDO (Fase 2)
   - Cambiado de `onChange({ dimension: value })` a `onChange({ config: { ...config, dimension: value } })`

6. **✅ KPIs solo permiten métricas numéricas** - CORREGIDO (Fase 2)
   - Agregado dropdown de "Acción" con 5 funciones para todos los widgets

7. **✅ Panel derecho desaparece** - CORREGIDO (Fase 2)
   - Panel derecho siempre visible en modo diseño, colapsable

8. **✅ Doble scroll en canvas** - CORREGIDO (Mejoras Canvas)
   - Canvas usa `height: '100%'`, solo `.canvas-container` scrollea

9. **✅ Ancho variable del panel derecho** - CORREGIDO (Mejoras Canvas)
   - Panel derecho usa `width: '100%'`, el padre controla el ancho fijo (264px | 40px)

10. **✅ Zoom no recalcuza al cambiar modo** - CORREGIDO (Mejoras Canvas)
    - `setMode`, `togglePalette`, `toggleRightPanel` recalculan zoom automáticamente

---

## 6. Schema Completo de Supabase

### Tabla: `crm_reports`

Metadatos de reportes creados por usuarios.

```sql
CREATE TABLE crm_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  visibilidad TEXT NOT NULL DEFAULT 'privado',
  
  -- Tamaño del lienzo
  page_width INTEGER DEFAULT 816,
  page_height INTEGER DEFAULT 1056,
  
  -- Configuración de zoom
  zoom_mode TEXT DEFAULT 'fit_width',
  zoom_value INTEGER DEFAULT 100,
  
  -- Metadatos
  creado_por UUID NOT NULL REFERENCES auth.users(id),
  fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
  fecha_actualizacion TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT crm_reports_visibilidad_check 
    CHECK (visibilidad IN ('privado', 'publico', 'restringido')),
  CONSTRAINT crm_reports_zoom_mode_check 
    CHECK (zoom_mode IN ('fixed', 'fit_width', 'fit_height'))
);

-- Índices
CREATE INDEX idx_crm_reports_creado_por ON crm_reports(creado_por);
CREATE INDEX idx_crm_reports_visibilidad ON crm_reports(visibilidad);
CREATE INDEX idx_crm_reports_zoom_mode ON crm_reports(zoom_mode);
```

**Columnas**:
- `id`: UUID único del reporte
- `nombre`: Nombre del reporte (ej: "Dashboard Ventas por Asesor")
- `descripcion`: Descripción opcional del reporte
- `visibilidad`: 'privado' (solo dueño), 'publico' (todos), 'restringido' (permisos específicos)
- `page_width`: Ancho del lienzo en píxeles (default 816 - Carta vertical)
- `page_height`: Alto del lienzo en píxeles (default 1056 - Carta vertical)
- `zoom_mode`: Modo de zoom ('fixed', 'fit_width', 'fit_height')
- `zoom_value`: Valor de zoom cuando `zoom_mode='fixed'` (40-150)
- `creado_por`: ID del usuario dueño del reporte
- `fecha_creacion`: Timestamp de creación
- `fecha_actualizacion`: Timestamp de última modificación

---

### Tabla: `crm_widgets`

Configuración de widgets dentro de un reporte.

```sql
CREATE TABLE crm_widgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporte_id UUID REFERENCES crm_reports(id) ON DELETE CASCADE,
  
  -- Tipo y categoría
  tipo TEXT NOT NULL,
  widget_category TEXT NOT NULL DEFAULT 'chart',
  
  -- Layout
  pos_x INTEGER NOT NULL DEFAULT 16,
  pos_y INTEGER NOT NULL DEFAULT 16,
  width INTEGER NOT NULL DEFAULT 380,
  height INTEGER NOT NULL DEFAULT 240,
  z_index INTEGER NOT NULL DEFAULT 1,
  
  -- Configuración
  titulo TEXT NOT NULL,
  mostrar_titulo BOOLEAN DEFAULT TRUE,
  config JSONB NOT NULL DEFAULT '{}',
  filter_config JSONB DEFAULT '{}',
  
  -- Metadatos
  fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT crm_widgets_tipo_check 
    CHECK (tipo IN ('bar', 'bar_horizontal', 'line', 'area', 'pie', 'kpi', 'table',
                'filter_daterange', 'filter_multiselect', 'filter_numericrange', 'filter_toggle'))
);

-- Índices
CREATE INDEX idx_crm_widgets_reporte_id ON crm_widgets(reporte_id);
CREATE INDEX idx_crm_widgets_z_index ON crm_widgets(z_index);
CREATE INDEX idx_crm_widgets_tipo ON crm_widgets(tipo);
```

**Columnas**:
- `id`: UUID único del widget
- `reporte_id`: ID del reporte padre (CASCADE delete)
- `tipo`: Tipo de widget ('bar', 'kpi', 'table', 'filter_daterange', etc.)
- `widget_category`: 'chart' | 'filter'
- `pos_x`, `pos_y`: Coordenadas en píxeles desde la esquina superior izquierda
- `width`, `height`: Dimensiones del widget en píxeles
- `z_index`: Orden de apilamiento (widgets con mayor z_index van arriba)
- `titulo`: Título del widget (ej: "Ventas por Asesor")
- `mostrar_titulo`: Si `false`, oculta el título en el renderizado
- `config`: Configuración de datos (fuente, dimensión, métrica, agregación, etc.)
- `filter_config`: Configuración de filtros (solo para widgets tipo 'filter')

**Estructura de `config`**:
```json
{
  "fuente": "v_leads_completo",
  "dimension": "responsable_comercial",
  "metrica": "valor",
  "agregacion": "sum",
  "limite": 25,
  "estilo": {
    "color_principal": "#7dc244",
    "padding": 12,
    "border_radius": 8,
    "opacidad": 1.0
  }
}
```

**Estructura de `filter_config`** (para widgets de filtro):
```json
{
  "campo_vinculado": "etapa",
  "valor_defecto": null,
  "widgets_vinculados": ["uuid-1", "uuid-2"]
}
```

---

### Tabla: `crm_reporte_permisos` (Fase 3)

Permisos para compartir reportes con otros usuarios cuando `visibilidad='restringido'`.

```sql
CREATE TABLE crm_reporte_permisos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporte_id UUID NOT NULL REFERENCES crm_reports(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rol TEXT NOT NULL DEFAULT 'visor',
  
  UNIQUE(reporte_id, usuario_id),
  CONSTRAINT crm_reporte_permisos_rol_check 
    CHECK (rol IN ('editor', 'visor'))
);

-- Índices
CREATE INDEX idx_crm_reporte_permisos_reporte_id ON crm_reporte_permisos(reporte_id);
CREATE INDEX idx_crm_reporte_permisos_usuario_id ON crm_reporte_permisos(usuario_id);
```

**Columnas**:
- `id`: UUID único del permiso
- `reporte_id`: ID del reporte compartido
- `usuario_id`: ID del usuario con permiso
- `rol`: 'editor' (puede modificar) | 'visor' (solo ver)

---

### ENUMs y Tipos

**Tipo WidgetType**:
```typescript
type WidgetType =
  // Gráficas
  | 'bar'
  | 'bar_horizontal'
  | 'line'
  | 'area'
  | 'pie'
  | 'kpi'
  | 'table'
  // Filtros
  | 'filter_daterange'
  | 'filter_multiselect'
  | 'filter_numericrange'
  | 'filter_toggle';
```

**Tipo Agregacion**:
```typescript
type Agregacion = 'count' | 'sum' | 'avg' | 'max' | 'min';
```

**Tipo ZoomMode**:
```typescript
type ZoomMode = 'fixed' | 'fit_width' | 'fit_height';
```

**Tipo Visibilidad**:
```typescript
type Visibilidad = 'privado' | 'publico' | 'restringido';
```

---

### Vistas Materializadas (Fuentes de Datos)

**`v_leads_completo`**: Vista con todos los datos de leads relevantes para reportes.
```sql
-- Campos principales (ejemplo)
lead_id UUID
nombreLead TEXT
etapa TEXT
lead_status BOOLEAN
origen TEXT
responsable_comercial TEXT
fecha_creacion TIMESTAMPTZ
valor NUMERIC
-- ... otros campos
```

**`v_actividades_completo`**: Vista con actividades de seguimiento.
```sql
-- Campos principales (ejemplo)
id UUID
tipo_actividad TEXT
fecha TIMESTAMPTZ
mensaje TEXT
nombreLead TEXT
etapa TEXT
responsable_comercial TEXT
-- ... otros campos
```

---

## 7. PRD COMPLETO - Report Studio

### Contexto y Motivación

**Problema**: El equipo de ventas de SPH Bienes Raíces necesita generar reportes personalizados para analizar métricas de ventas (leads por asesor, conversión por etapa, seguimiento de actividades) sin depender del equipo de desarrollo para cada reporte nuevo.

**Solución**: Report Studio — un constructor visual de reportes self-service que permite a usuarios no técnicos crear dashboards interactivos arrastrando y soltando widgets, similar a Google Data Studio o Power BI, pero integrado completamente con el CRM existente.

**Usuario target**: Gerentes de ventas, analistas, usuarios del CRM con conocimiento del negocio pero sin habilidades técnicas de programación.

---

### Visión del Producto

Un editor WYSIWYG ("lo que ves es lo que obtienes") donde:
1. El usuario selecciona un tipo de gráfica de una paleta (KPI, barras, líneas, pastel, tabla)
2. Lo arrastra al canvas
3. Lo configura seleccionando dimensiones (ej: "asesor"), métricas (ej: "valor") y funciones de agregación (ej: "suma")
4. El widget se conecta automáticamente a los datos reales del CRM
5. Puede añadir filtros interactivos para permitir exploración (ej: rango de fechas, selector de etapa)
6. Exporta a PDF para compartir por email

**Diferenciadores**:
- Integrado 100% con datos existentes de Supabase (no ingesta datos externos)
- Configuración 100% visual, sin SQL ni código
- Filtros interactivos que afectan múltiples widgets simultáneamente
- Responsive (se adapta a pantallas de diferentes usuarios)

---

### Layout General

```
┌─────────────────────────────────────────────────────────────────┐
│  Toolbar (altura fija 52px)                                      │
│  [Nombre editable] [Página ▼] [Zoom ▼] [Diseño | Vista previa] [@]│
├──────┬──────────────────────────────────────────────────────────┬─────┤
│      │                                                          │     │
│ Pa-  │  Canvas (scrollable, zoom escalable)                    │De-  │
│ nel  │  ┌──────┐  ┌──────┐  ┌──────┐                          │re-  │
│ Iz-  │  │KPI  │  │Bar  │  │Pie  │                          │cho  │
│ qui-  │  └──────┘  └──────┘  └──────┘                          │     │
│ erdo │  ┌─────────────────┐                                   │     │
│(col- │  │   Bar Chart     │                                   │     │
│aps.) │  │   (x: Asesor,    │                                   │     │
│200px │  │    y: Valor)     │                                   │     │
│|40px │  └─────────────────┘                                   │     │
│      │                                                          │     │
│      │  (página configurable: 816×1056 por defecto)            │     │
└──────┴──────────────────────────────────────────────────────────┴─────┘
```

**Dimensiones**:
- Toolbar: 52px alto
- Panel izquierdo: 200px ancho (expandido) | 40px (colapsado)
- Canvas: Flex restante (scrollable)
- Panel derecho: 264px ancho (expandido) | 40px (colapsado)
- Altura total: 100vh (sin scroll en body, solo en canvas)

---

### Toolbar

**Componentes**:
1. **Breadcrumb + nombre editable**: "Reporteador / [Nuevo Reporte]" → "Reporteador / Dashboard Ventas"
2. **Selector de tamaño de página**: Dropdown con 4 opciones predefinidas + personalizado
3. **Selector de zoom**: 2 grupos:
   - Porcentaje fijo: 50%, 75%, 100%, 125%, 150%
   - Ajustar a: Ajustar al ancho | Ajustar a la altura
4. **Toggle modo**: Diseño | Vista previa
5. **Avatar usuario**: Inicial del usuario

**Comportamiento**:
- Nombre: Auto-save con debounce 800ms al escribir
- Zoom: Auto-save con debounce 500ms al cambiar
- Tamaño página: Auto-save con debounce 500ms al cambiar
- Indicador "Guardando..." aparece inmediatamente al hacer cualquier cambio

---

### Panel Izquierdo - Paleta de Widgets

**Secciones**:
1. **Gráficas** (6 tipos):
   - ▣ KPI
   - ▨ Barras vertical
   - ▤ Barras horizontal
   - ∿ Línea
   - ◔ Pastel
   - ⊞ Tabla

2. **Filtros** (4 tipos, Fase 3-4):
   - 📅 Rango fechas
   - ☰ Multiselect
   - ⇔ Rango numérico
   - ⊙ Toggle

**Comportamiento**:
- Click en widget → se agrega al canvas en posición aleatoria sin solapamiento
- Posición aleatoria: `x = Math.random() * (pageWidth - 400)`, `y = Math.random() * (pageHeight - 300)`
- Colapsable con botón ▶ / ◀
- Persistencia en localStorage

---

### Canvas

**Características**:
- Scrollable (overflow: auto)
- Transform scale aplicado a hoja interna
- Widgets arrastrables con `react-rnd`
- Z-index automático (último widget agregado va arriba)
- Background blanco con sombra

**Tamaños de página configurables**:
- Carta vertical: 816 × 1056px (default)
- Carta horizontal: 1056 × 816px
- A4 vertical: 794 × 1123px
- A4 horizontal: 1123 × 794px
- Personalizado: 200-2000px

**Zoom**:
- Rango: 40% - 150%
- Modo fijo: Usuario selecciona porcentaje
- Modo fit_width: Ajusta automáticamente para ver todo el ancho
- Modo fit_height: Ajusta automáticamente para ver todo el alto
- Recálculo automático al cambiar modo diseño ↔ vista previa

---

### Panel de Datos (Tab "Datos")

**Campos según tipo de widget**:

**KPIs (2 dropdowns)**:
- Campo a contar: Cualquier campo de la vista (dimensiones o métricas)
- Acción: Contar (COUNT) | Sumar (SUM) | Promedio (AVG) | Mínimo (MIN) | Máximo (MAX)

**Gráficas (3 dropdowns)**:
- Eje X (Dimensión): Campo categórico (ej: etapa, asesor, origen)
- Eje Y (Campo): Campo numérico o categórico (ej: valor, nombre)
- Acción: Contar (COUNT) | Sumar (SUM) | Promedio (AVG) | Mínimo (MIN) | Máximo (MAX)

**Tablas (1 dropdown)**:
- Campo: Campo a mostrar en tabla

**Otros campos**:
- Título editable
- Mostrar título (toggle)
- Fuente de datos (v_leads_completo | v_actividades_completo)

---

### Panel de Propiedades (Tab "Propiedades")

**Configuración visual** (Fase 3):
- Color principal: Selector de 6 colores predefinidos
- Padding: Slider 0-32px
- Borde redondeado: Slider 0-16px
- Opacidad: Slider 50-100%

---

### Sistema de Filtros (Fase 4)

**4 tipos de filtros**:
1. **Rango de fechas**: Two date pickers (desde - hasta)
2. **Multiselect**: Dropdown con checkboxes (múltiples valores)
3. **Rango numérico**: Two inputs numéricos (min - max)
4. **Toggle**: Switch booleano (verdadero/falso)

**Configuración**:
- Campo vinculado: Campo de la vista que filtra (ej: etapa, origen, responsable_comercial)
- Valor defecto: Valor inicial del filtro
- Widgets vinculados: Lista de IDs de widgets afectados por el filtro

**Comportamiento**:
- Filtros se agregan al canvas como widgets
- Al cambiar filtro, se re-ejecuta query de todos los widgets vinculados
- Estado de filtros persiste en Supabase

---

### Exportación PDF (Fase 5)

**Características**:
- Genera PDF del canvas actual (todos los widgets)
- Incluye título del reporte
- Respetar tamaño de página configurado
- Fondo blanco, gráficos en color
- Download automático al hacer click en "Exportar PDF"

**Librería propuesta**: `jsPDF` o `react-pdf`

---

## 8. Plan Detallado - Fase 3

**Objetivo**: Eliminación de widgets, filtros globales básicos, permissions, exportación básica

### 8.1. Eliminación de Widgets

**Archivos a modificar**:
- `web/components/reportes/studio/panels/properties-panel.tsx`
- `web/lib/reportes/actions.ts`

**Implementación**:
1. ✅ Botón "Eliminar widget" ya existe en `properties-panel.tsx`
2. ✅ Handler `handleEliminar()` ya existe (muestra alert)
3. 🔲 Implementar lógica real:
   - Llamar `deleteWidget(widgetId)` Server Action
   - Remover del store local
   - Confirmar con usuario: `confirm('¿Eliminar este widget? Esta acción no se puede deshacer.')`

**Server Action** (ya existe en `actions.ts`):
```typescript
export async function deleteWidget(widgetId: string): Promise<void> {
  const supabase = await getSupabaseClient();
  const { error } = await supabase
    .from('crm_widgets')
    .delete()
    .eq('id', widgetId);
  
  if (error) {
    throw new Error(`Error eliminando widget: ${error.message}`);
  }
}
```

**Hotkey** (opcional):
- Agregar `onDelete` key en canvas: presionar Delete → eliminar widget seleccionado

---

### 8.2. Permissions (RLS Policies)

**Archivos a modificar**:
- `web/lib/reportes/actions.ts`
- Supabase SQL migrations

**Politicas RLS a implementar**:

```sql
-- Policy: Solo dueño puede ver sus reportes privados
CREATE POLICY "Solo dueño puede ver reportes privados"
ON crm_reports FOR SELECT
USING (
  auth.uid() = creado_por 
  AND visibilidad = 'privado'
);

-- Policy: Todos pueden ver reportes públicos
CREATE POLICY "Todos pueden ver reportes públicos"
ON crm_reports FOR SELECT
USING (visibilidad = 'publico');

-- Policy: Solo dueño puede actualizar sus reportes
CREATE POLICY "Solo dueño puede actualizar reportes"
ON crm_reports FOR UPDATE
USING (auth.uid() = creado_por);

-- Policy: Solo dueño puede eliminar sus reportes
CREATE POLICY "Solo dueño puede eliminar reportes"
ON crm_reports FOR DELETE
USING (auth.uid() = creado_por);

-- Policy: Solo dueño puede ver widgets de sus reportes
CREATE POLICY "Solo dueño puede ver widgets"
ON crm_widgets FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM crm_reports 
    WHERE crm_reports.id = crm_widgets.reporte_id 
      AND crm_reports.creado_por = auth.uid()
  )
);

-- Policy: Solo dueño puede actualizar widgets
ON crm_widgets FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM crm_reports 
    WHERE crm_reports.id = crm_widgets.reporte_id 
      AND crm_reports.creado_por = auth.uid()
  )
);

-- Policy: Solo dueño puede eliminar widgets
ON crm_widgets FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM crm_reports 
    WHERE crm_reports.id = crm_widgets.reporte_id 
      AND crm_reports.creado_por = auth.uid()
  )
);
```

**Validación en `actions.ts`**:
- ✅ Ya existe en `getReporteById()`: verifica `auth.uid() === reporte.creado_por`
- 🔲 Agregar misma validación en `updateReporte()` y `deleteReporte()` (Fase 3)

---

### 8.3. Exportación Básica

**Archivos a crear**:
- `web/lib/reportes/export-pdf.ts`

**Implementación**:
1. Usar `html2canvas` + `jsPDF` (librerías probadas para React)
2. Función `exportCanvasToPDF(ref, reportName)`:
   - Captura screenshot del canvas con `html2canvas`
   - Crea PDF con `jsPDF`
   - Download automático
3. Botón en toolbar: "Exportar PDF"

**Instalación**:
```bash
npm install html2canvas jspdf
npm install @types/html2canvas --save-dev
```

**Ejemplo de implementación**:
```typescript
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export async function exportCanvasToPDF(
  canvasRef: HTMLDivElement,
  reportName: string
): Promise<void> {
  // Capturar canvas
  const canvas = await html2canvas(canvasRef, {
    scale: 2,  // mejor calidad
    useCORS: true,
    logging: false
  });
  
  // Crear PDF
  const pdf = new jsPDF({
    orientation: pageWidth > pageHeight ? 'landscape' : 'portrait',
    unit: 'px',
    format: [pageWidth, pageHeight]
  });
  
  const imgData = canvas.toDataURL('image/png');
  pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight);
  pdf.save(`${reportName}.pdf`);
}
```

---

## 9. Plan Detallado - Fase 4

**Objetivo**: Sistema de filtros globales interactivos avanzado

### 9.1. Widgets de Filtro (UI)

**Archivos a crear**:
- `web/components/reportes/studio/renderers/filter-renderer.tsx` (ya existe placeholder)
- `web/lib/reportes/filter-types.ts` - Definir tipos de filtros

**4 tipos de filtros**:

1. **Rango de fechas** (`filter_daterange`):
   - Dos date pickers: Desde | Hasta
   - Config: campo_vinculado, valor_defecto (rango inicial)
   - Operador: `between`

2. **Multiselect** (`filter_multiselect`):
   - Dropdown con checkboxes (múltiples valores)
   - Config: campo_vinculado, opciones_disponibles, valor_defecto (array)
   - Operador: `in`

3. **Rango numérico** (`filter_numericrange`):
   - Dos inputs numéricos: Mín | Máx
   - Config: campo_vinculado, valor_defecto (rango inicial)
   - Operador: `between`

4. **Toggle** (`filter_toggle`):
   - Switch booleano: Verdadero | Falso
   - Config: campo_vinculado, valor_defecto (boolean)
   - Operador: `eq`

**Implementación**:
```typescript
// Ejemplo filter-renderer.tsx
export function FilterRenderer({ widget, width, height }) {
  const { filter_config } = widget;
  const [valor, setValor] = useState(filter_config.valor_defecto);
  
  const handleChange = (nuevoValor) => {
    setValor(nuevoValor);
    // Disparar recálculo de widgets vinculados
    updateLinkedWidgets(widget.id, nuevoValor);
  };
  
  switch (widget.tipo) {
    case 'filter_daterange':
      return <DateRangeFilter value={valor} onChange={handleChange} />;
    case 'filter_multiselect':
      return <MultiselectFilter value={valor} onChange={handleChange} />;
    // ...
  }
}
```

---

### 9.2. Lógica de Filtrado

**Archivos a modificar**:
- `web/lib/reportes/query-builder.ts` - Agregar lógica de filtros
- `web/lib/reportes/actions.ts` - Modificar `getWidgetData()`

**Implementación**:

1. **Store de filtros globales** (ya existe en `studio-store.ts`):
```typescript
interface FiltroActivo {
  campo: string;
  operador: 'eq' | 'neq' | 'contains' | 'in' | 'gt' | 'gte' | 'lt' | 'lte' | 'between';
  valor: any;
  valor2?: any;  // Para between
}

activeFilters: FiltroActivo[];
```

2. **Modificar `buildQueryParams()` para incluir filtros**:
```typescript
export function buildQueryParams(
  widget: Widget,
  activeFilters: FiltroActivo[] = []
): QueryParams {
  // ... código existente
  
  // Filtrar activeFilters que aplican a este widget
  const applicableFilters = activeFilters.filter(f => 
    widget.filter_config?.widgets_vinculados?.includes(widget.id)
  );
  
  // Mapear filtros a parámetros WHERE
  applicableFilters.forEach(filtro => {
    switch (filtro.campo) {
      case 'fecCreacion':
        if (filtro.operador === 'between') {
          params.p_fecha_desde = filtro.valor;
          params.p_fecha_hasta = filtro.valor2;
        }
        break;
      case 'etapa':
        if (filtro.operador === 'in') {
          params.p_etapa_in = filtro.valor;  // array
        }
        break;
      // ... otros campos
    }
  });
  
  return params;
}
```

3. **RPC `get_widget_grouped` debe soportar filtros dinámicos**:
```sql
CREATE OR REPLACE FUNCTION get_widget_grouped(
  p_fuente TEXT,
  p_dimension TEXT,
  p_metrica TEXT,
  p_agregacion TEXT DEFAULT 'sum',
  p_fecha_desde DATE DEFAULT NULL,
  p_fecha_hasta DATE DEFAULT NULL,
  p_etapa_in TEXT[] DEFAULT NULL,  -- Nuevo: array de etapas
  p_asesor TEXT DEFAULT NULL,
  p_origen TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 25
) RETURNS TABLE(...) ...
```

---

### 9.3. Panel de Configuración de Filtros

**Archivos a modificar**:
- `web/components/reportes/studio/panels/data-panel.tsx` - Agregar caso `widget_category === 'filter'`

**Implementación**:
```typescript
const isFilter = selectedWidget.widget_category === 'filter';

if (isFilter) {
  return <FilterConfigPanel widget={selectedWidget} onChange={handleUpdateWidget} />;
}

// FilterConfigPanel:
function FilterConfigPanel({ widget, onChange }) {
  const { filter_config } = widget;
  
  return (
    <>
      <Field label="Título">
        <input value={widget.titulo} onChange={(e) => onChange({ titulo: e.target.value })} />
      </Field>
      
      <Field label="Mostrar título">
        <Toggle value={widget.mostrar_titulo} onChange={(val) => onChange({ mostrar_titulo: val })} />
      </Field>
      
      <Field label="Campo vinculado">
        <select value={filter_config?.campo_vinculado || ''} 
                onChange={(e) => onChange({ filter_config: { ...filter_config, campo_vinculado: e.target.value } })}>
          <option value="">Seleccionar campo...</option>
          {availableFields.map(campo => (
            <option value={campo.nombre}>{campo.etiqueta}</option>
          ))}
        </select>
      </Field>
      
      <Field label="Widgets vinculados">
        <Multiselect
          options={widgets}
          value={filter_config?.widgets_vinculados || []}
          onChange={(val) => onChange({ filter_config: { ...filter_config, widgets_vinculados: val })} />
      </Field>
    </>
  );
}
```

---

## 10. Plan Detallado - Fase 5

**Objetivo**: Exportación PDF robusta y pulido final

### 10.1. Exportación PDF Mejorada

**Mejoras sobre Fase 3**:
- ✅ Capturar solo hoja interna (no paneles laterales)
- ✅ Respetar orientación (portrait/landscape) según tamaño página
- ✅ Agregar header al PDF con título del reporte + fecha
- ✅ Multi-página si widgets exceden altura de página
- ✅ Opción de descargar como imagen (PNG) además de PDF

**Librería recomendada**: `@react-pdf/renderer` (más integrado con React que `jsPDF` plano)

**Ejemplo con @react-pdf/renderer**:
```typescript
import { Document, Page, Text, View, Image } from '@react-pdf/renderer';
import { pdf } from '@react-pdf/renderer';

const MyDocument = ({ widgets, reporte }) => (
  <Document>
    <Page size="LETTER" orientation="portrait">
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>
        {reporte.nombre}
      </Text>
      <Text style={{ fontSize: 10, color: 'gray' }}>
        Generado: {new Date().toLocaleDateString()}
      </Text>
      {widgets.map(widget => (
        <WidgetToPDF key={widget.id} widget={widget} />
      ))}
    </Page>
  </Document>
);

// Exportar
await pdf(<MyDocument widgets={widgets} reporte={reporte} />)
  .toBlob()
  .then(blob => download(blob, `${reporte.nombre}.pdf`));
```

---

### 10.2. Pulido de UI

**Mejoras visuales**:
- ✅ Animaciones suaves en colapso de paneles (transition: 0.2s)
- ✅ Hover effects en botones y widgets
- ✅ Loading skeleton mientras cargan datos
- ✅ Empty states cuando no hay widgets
- ✅ Tooltips explicativos en iconos
- ✅ Breadcrumbs de navegación

**Accesibilidad**:
- ✅ Navegación por teclado (Tab, Enter, Delete)
- ✅ ARIA labels en botones y formularios
- ✅ Contraste de colores suficiente (WCAG AA)

---

### 10.3. Testing E2E

**Herramientas**:
- Playwright (ya configurado en proyecto)
- Jest + React Testing Library (unit tests)

**Casos de prueba**:
1. Crear reporte nuevo
2. Agregar 3 widgets (KPI, barras, tabla)
3. Configurar widget (cambiar dimensión, métrica)
4. Arrastrar widget a nueva posición
5. Redimensionar widget
6. Cambiar zoom (fijo, fit_width, fit_height)
7. Cambiar tamaño de página
8. Exportar PDF
9. Eliminar widget
10. Guardar y recargar página (verificar persistencia)

---

## 11. Instrucciones de Arranque para Sesión Nueva

Cuando inicies una nueva sesión de Claude Code en este proyecto, sigue estos pasos:

### 1. Verificar estructura del proyecto
```bash
cd web
ls -la lib/reportes/
ls -la components/reportes/
```

### 2. Leer archivos clave primero (en orden)

**Prioridad Alta** (leer primero):
1. `CLAUDE.md` - Instrucciones generales del proyecto
2. `web/lib/reportes/types.ts` - Entender dominio y modelos de datos
3. `web/lib/reportes/studio-store.ts` - Entender estado global y acciones
4. `web/components/reportes/studio/report-studio.tsx` - Entender estructura del editor

**Prioridad Media** (leer después):
5. `web/lib/reportes/actions.ts` - Server Actions y llamadas a Supabase
6. `web/lib/reportes/query-builder.ts` - Lógica de construcción de queries
7. `web/components/reportes/studio/toolbar/studio-toolbar.tsx` - Auto-save y zoom
8. `web/components/reportes/studio/canvas/widget-wrapper.tsx` - Drag, resize, carga de datos

**Prioridad Baja** (leer según necesidad):
9. `web/components/reportes/studio/panels/data-panel.tsx` - Panel de configuración
10. `web/components/reportes/studio/renderers/` - Renderizado de gráficos

### 3. Comandos útiles

**Levantar dev server**:
```bash
cd web
npm run dev
# Acceder a http://localhost:3000/reportes
```

**Compilar**:
```bash
cd web
npm run build
```

**Ejecutar tests**:
```bash
cd web
npm run test
```

**Playwright (E2E)**:
```bash
npx playwright test
```

### 4. Contexto crítico a mantener

**Decisiones técnicas importantes**:
1. ✅ Zustand persiste solo UI en localStorage, datos vienen de Supabase
2. ✅ Auto-save con debounce diferenciado (800ms nombre, 500ms config, 300ms layout)
3. ✅ react-rnd usa `scale` prop para compensar zoom
4. ✅ Campos de vistas tienen fallback hardcoded si information_schema falla
5. ✅ `zoom_mode: 'fit_width'` es default para reportes nuevos (responsive)
6. ✅ Server Components para carga inicial, Client Components para interactividad
7. ✅ `requestAnimationFrame` doble para calcular zoom (garantiza layout completo)

**Bugs corregidos** (no reintroducir):
1. ✅ Dropdowns de config no guardaban → Usar `onChange({ config: { ...config, campo: value } })`
2. ✅ Flash visual al arrastrar → `onDrag` actualiza store local inmediatamente
3. ✅ Panel derecho ancho variable → `width: '100%'` en hijos, padre controla ancho fijo
4. ✅ Zoom no recalcula → `requestAnimationFrame` doble en todas las funciones de recálculo

**Estado actual**:
- Fase 1: ✅ Completada
- Fase 2: ✅ Completada (incluyendo todos los bugs)
- Mejoras Canvas: ✅ Completadas
- Fase 3: 🔄 Próxima (eliminación, filtros, permissions)
- Fase 4: ⏳ Pendiente
- Fase 5: ⏳ Pendiente

---

**Última actualización**: 2026-05-01  
**Estado**: Fase 2 cerrada con mejoras de canvas. Listo para iniciar Fase 3.
