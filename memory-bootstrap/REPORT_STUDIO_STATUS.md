# Report Studio - Estado del Proyecto

**Proyecto**: CRM Ventas - SPH Bienes Raíces
**Módulo**: Report Studio - Constructor de reportes y dashboards
**Fecha**: 01/05/2026 (actualizado: 9:45pm)
**Fase Actual**: Fase 3 completada (3.1-3.4)
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
- ✅ **Fase 3.4**: Función RPC `get_widget_grouped` creada en Supabase
  - Ejecuta queries agrupados sobre `v_leads_completo` y `v_actividades_completo`
  - Soporta 5 funciones de agregación: COUNT, SUM, AVG, MIN, MAX
  - Soporta 4 filtros opcionales: fecha (desde/hasta), etapa, asesor, origen
  - 3 capas de whitelist de seguridad (fuentes, dimensiones, agregación)
  - Retorno compatible con Recharts: `TABLE(label TEXT, value NUMERIC)`

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

### ✅ Fase 3: Completada

**Objetivo**: Eliminación de widgets, panel de propiedades visual, permissions

---

#### 3.1. Eliminación de Widgets

**Implementado**:
- ✅ AlertDialog de shadcn/ui para confirmación de eliminación
- ✅ Hotkey Delete/Backspace en canvas (con guards para inputs de texto)
- ✅ Botón "Eliminar widget" en properties-panel
- ✅ Estado `isDeleteDialogOpen` centralizado en store
- ✅ Handler `handleEliminarWidget()` con manejo robusto de errores
- ✅ Server Action `deleteWidget()` ya existente

**Archivos modificados**:
- `web/lib/reportes/studio-store.ts` - Agregado `isDeleteDialogOpen`, `setDeleteDialogOpen()`
- `web/components/reportes/studio/panels/properties-panel.tsx` - Botón con `variant="destructive"`
- `web/components/reportes/studio/canvas/report-canvas.tsx` - Hotkey Delete/Backspace
- `web/components/reportes/studio/report-studio.tsx` - AlertDialog + handler de eliminación

**Características**:
- Eliminación solo si hay widget seleccionado
- Guards previenen activación accidental en inputs de texto
- Manejo de errores: si Supabase falla, widget no se elimina visualmente
- Estado visual siempre sincronizado con base de datos

---

#### 3.2. RLS Policies (Row Level Security)

**Implementado**:
- ✅ Tabla `crm_reporte_permisos` creada con estructura correcta
- ✅ Función SECURITY DEFINER `usuario_tiene_permiso_reporte()` para romper recursión
- ✅ 12 políticas RLS implementadas:
  - 6 políticas para `crm_reports` (SELECT/UPDATE/DELETE × 3 visibilidades)
  - 6 políticas para `crm_widgets` (SELECT/UPDATE/DELETE × propietario)

**Política de recursión resuelta**:
- **Problema**: Políticas originales creaban ciclo infinito entre `crm_reports` y `crm_reporte_permisos`
- **Solución**: Función `usuario_tiene_permiso_reporte()` con `SECURITY DEFINER` que bypassea RLS
- **Resultado**: Funcionalidad de negocio preservada (usuarios con permiso ven reportes restringidos)

**Archivos SQL**:
- Migración aplicada con `apply_migration` en Supabase
- Función marca: `--[2026-05-01]`

**Validación**:
- ✅ Usuarios ven sus propios reportes privados
- ✅ Todos ven reportes públicos
- ✅ Solo usuarios con permiso explícito ven reportes restringidos
- ✅ Solo dueño puede modificar/eliminar sus reportes
- ✅ Widgets heredan permisos del reporte padre

---

#### 3.3. Panel de Propiedades + Renderers Conectados

**Implementado**:

**Properties Panel** (ya existente, funcional):
- ✅ Selector de color principal (6 colores predefinidos SPH)
- ✅ Slider de padding (0-32px)
- ✅ Slider de border radius (0-16px)
- ✅ Slider de opacidad (50-100%)
- ✅ Botón "Eliminar widget" con estilo destructive

**Renderers conectados a Properties Panel**:

1. **kpi-renderer.tsx** ✅ Ya estaba conectado
   - Usa `widget.config?.estilo?.color_principal`
   - Aplica color con opacidad en background del icono
   - Formatea valores según métrica (monto, número compacto)

2. **chart-renderer.tsx** ✅ Ahora conectado
   - `BarChartWidget`: Color principal en fill, padding como margin en BarChart, wrapper con opacidad
   - `BarHorizontalWidget`: Paleta personalizada con color_principal como primer color
   - `LineChartWidget`: Color principal en stroke y dot, padding dinámico
   - `AreaChartWidget`: Color principal en stroke y fill, padding dinámico
   - `PieChartWidget`: Paleta personalizada con color_principal
   - Wrapper con opacidad en todos los componentes
   - **Corrección técnica**: `margin` va en componentes de chart (BarChart, LineChart, AreaChart), NO en ResponsiveContainer

3. **table-renderer.tsx** ✅ Ahora conectado
   - Header con color_principal (opacidad fija 12)
   - Wrapper principal con opacidad dinámica
   - Filas de datos con padding dinámico
   - Botones de paginación con color_principal para botones activos

**Bug de título corregido**:
- **Problema**: Título del widget no se mostraba aunque `mostrar_titulo` estuviera activado
- **Causa**: `widget-wrapper.tsx` no renderizaba header de título
- **Solución**: Agregado wrapper flex column con header de 28px
- **Corrección secundaria**: `chart-renderer.tsx` linea 44 eliminada resta de 32px → `innerHeight = height`

**Archivos modificados**:
- `web/components/reportes/studio/renderers/chart-renderer.tsx` - Conexión a `widget.config?.estilo`
- `web/components/reportes/studio/renderers/table-renderer.tsx` - Conexión a `widget.config?.estilo`
- `web/components/reportes/studio/canvas/widget-wrapper.tsx` - Header de título con wrapper flex

---

#### 3.4. Conexión a Datos Reales + Bugs Corregidos

**Implementado**:

**Función RPC get_widget_grouped creada**:
- ✅ Función SQL en Supabase con `SECURITY INVOKER` (respeta RLS)
- ✅ 3 capas de whitelist de seguridad:
  - **Fuentes**: Solo `v_leads_completo` y `v_actividades_completo`
  - **Dimensiones**: 13 campos para leads, 9 para actividades (coinciden con estructura real de BD)
  - **Agregación**: Solo `count`, `sum`, `avg`, `min`, `max`
- ✅ `quote_ident()` en métrica para proteger contra SQL injection
- ✅ Soporta 4 filtros opcionales: `p_fecha_desde`, `p_fecha_hasta`, `p_etapa`, `p_asesor`, `p_origen`
- ✅ Retorna formato compatible con Recharts: `TABLE(label TEXT, value NUMERIC)`
- ✅ Marca temporal: `[2026-05-01 18:00:00]`

**Archivos modificados**:
- `web/lib/reportes/query-builder.ts` - Corregido `fecCreacion` → `fecha_creacion`
- `web/lib/reportes/actions.ts` - Llama a `supabase.rpc('get_widget_grouped')` con parámetros seguros
- `web/lib/reportes/studio-store.ts` - Tiene `activeFilters: FiltroActivo[]` en estado (preparado para Fase 4)

**Bugs corregidos**:

1. **✅ Widgets muestran datos reales de Supabase** - COMPLETADO
   - Función `get_widget_grouped` ejecuta queries agrupados sobre vistas
   - Datos transformados a formato `ChartData[]` para Recharts
   - Filtros globales soportados (aunque UI de filtros pendiente para Fase 4)

2. **✅ Campo de fecha con nombre incorrecto** - CORREGIDO
   - **Problema**: `query-builder.ts` usaba `fecCreacion` pero la columna en BD es `fecha_creacion`
   - **Solución**: Cambiado `case 'fecCreacion'` → `case 'fecha_creacion'` en [query-builder.ts:41](web/lib/reportes/query-builder.ts#L41)

3. **✅ Estilos del Panel de Propiedades no persistían** - CORREGIDO
   - **Problema**: Cambios de color/padding/border_radius/opacidad se perdían al recargar
   - **Causa**: `properties-panel.tsx` solo actualizaba estado local, nunca llamaba a Supabase
   - **Solución**: Implementado patrón de `data-panel.tsx` con:
     - Debounce 500ms con `useMemo` + función `debounce` local
     - Feedback visual inmediato: `setIsSaving(true)`
     - Handler `handleUpdateEstilo` que actualiza store local + persiste a Supabase
     - Llamada a `updateWidgetConfig` de actions.ts
   - **Archivos modificados**: `web/components/reportes/studio/panels/properties-panel.tsx`

---

### 🔄 Fase 4: Pendiente (Próxima Fase)

**Objetivo**: Sistema de filtros interactivos avanzado

**Estado actual**:
- ✅ **Backend preparado**: Función `get_widget_grouped` ya acepta parámetros de filtro (`p_fecha_desde`, `p_fecha_hasta`, `p_etapa`, `p_asesor`, `p_origen`)
- ✅ **Frontend preparado**: `studio-store.ts` ya tiene `activeFilters: FiltroActivo[]` en estado
- ✅ **Query builder listo**: `buildQueryParams()` mapea filtros activos a parámetros RPC

**Por implementar**:
- 4 tipos de widgets de filtro: rango fechas, multiselect, rango numérico, toggle
- UI de filtros interactivos (panel lateral o flotante)
- Conexión de filtros a widgets (afectan datos de múltiples widgets)
- Estado de filtros persistido en Supabase (columna `filter_config` ya existe en `crm_widgets`)

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

### 📋 Radar: Fase 3.5 - Configuración Avanzada por Tipo de Widget (Futura)

**Objetivo**: Propiedades específicas según tipo de widget

**Por implementar**:
- **Gráficos**: Ángulo de etiquetas en ejes (0°, 45°, 90°), mostrar/ocultar grid, mostrar/ocultar leyenda
- **Tablas**: Selector de columnas visibles, orden de columnas, paginación configurable (10/25/50 filas)
- **KPIs**: Formato numérico (decimal, moneda, porcentaje), subtítulo personalizable, icono personalizable
- **Todos**: Borde superior/inferior (no solo radius), sombra, fondo gradiente

**Nota**: Esta fase surge de necesidad natural de personalización más granular. Se implementará después de Fase 4.

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
│       ├── chart-renderer.tsx             # Renderiza Recharts (bar, line, pie) ~280 líneas
│       ├── kpi-renderer.tsx               # Renderiza KPIs ~170 líneas
│       ├── table-renderer.tsx             # Renderiza tablas ~200 líneas
│       └── filter-renderer.tsx            # Renderiza filtros ~40 líneas
│
├── lib/reportes/
│   ├── studio-store.ts                    # Zustand store ~250 líneas
│   ├── actions.ts                         # Server Actions + API calls ~420 líneas
│   ├── query-builder.ts                   # Construye params RPC ~160 líneas
│   └── types.ts                           # Interfaces TypeScript ~180 líneas
```

**Total aproximado**: ~3,400 líneas de código TypeScript/TSX

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
  await supabase.from('crm_reports').update(cambios).eq('id, id);
}
```

---

### 8. Properties Panel y Renderers con Estilos Conectados

**Decisión**: Conectar renderers (chart, table, kpi) a `widget.config?.estilo` definido en Properties Panel.

**Razonamiento**:
- ✅ Personalización visual sin necesidad de código
- ✅ Consistencia de diseño usando paleta SPH predefinida
- ✅ Los cambios en Properties Panel se reflejan inmediatamente en canvas
- ✅ Fallback a valores por defecto si estilo no está completo

**Implementación**:
```typescript
// En cada renderer:
const estilo = widget.config?.estilo || {};
const color = estilo.color_principal || '#7dc244';  // fallback
const padding = estilo.padding ?? 12;
const opacidad = estilo.opacidad ?? 1;

// Aplicar estilos
<div style={{ opacity: opacidad }}>
  <ResponsiveContainer margin={{ top: padding, right: padding, bottom: padding, left: padding }}>
    <BarChart data={datos}>
      <Bar fill={color} />
    </BarChart>
  </ResponsiveContainer>
</div>
```

**Patrón de fallback**: Siempre usar `||` o `??` con valores por defecto. Nunca asumir que `estilo` está completo.

---

## 5. Bugs Conocidos Pendientes

### ✅ Bugs Corregidos (Fase 2 + Mejoras Canvas + Fase 3)

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

11. **✅ Título del widget no se muestra** - CORREGIDO (Fase 3.3)
    - Agregado wrapper flex column en `widget-wrapper.tsx` con header de 28px
    - Eliminada resta innecesaria de 32px en `chart-renderer.tsx`

12. **✅ chart-renderer.tsx restaba 32px innecesariamente** - CORREGIDO (Fase 3.3)
    - Cambiado `innerHeight = height - (widget.mostrar_titulo ? 32 : 0)` a `innerHeight = height`
    - Wrapper flex con `flex: 1` maneja automáticamente el espacio del título

13. **✅ Widgets no mostraban datos reales** - CORREGIDO (Fase 3.4)
    - Creada función `get_widget_grouped` en Supabase con SECURITY INVOKER
    - Función RPC ejecuta queries agrupados sobre vistas `v_leads_completo` y `v_actividades_completo`
    - 3 capas de whitelist: fuentes, dimensiones, agregación
    - Formato de retorno compatible con Recharts: `TABLE(label TEXT, value NUMERIC)`

14. **✅ Campo de fecha con nombre incorrecto en query-builder** - CORREGIDO (Fase 3.4)
    - Cambiado `case 'fecCreacion'` → `case 'fecha_creacion'` para coincidir con columna real
    - El mapeo de filtros ahora usa el nombre correcto de la columna

15. **✅ Estilos del Panel de Propiedades no persistían** - CORREGIDO (Fase 3.4)
    - **Problema**: Cambios de color/padding/border_radius/opacidad se perdían al recargar
    - **Causa**: `properties-panel.tsx` solo actualizaba estado local de Zustand
    - **Solución**: Implementado debounce 500ms + `updateWidgetConfig` de actions.ts
    - Patrón replicado de `data-panel.tsx`: `handleUpdateEstilo` + feedback visual inmediato

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
- `config`: Configuración de datos (fuente, dimensión, métrica, agregación, estilo, etc.)
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

### Tabla: `crm_reporte_permisos`

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

## 7. Instrucciones de Arranque para Sesión Nueva

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
8. ✅ Properties Panel conectado a renderers via `widget.config?.estilo`
9. ✅ RLS Policies con función SECURITY DEFINER para evitar recursión

**Bugs corregidos** (no reintroducir):
1. ✅ Dropdowns de config no guardaban → Usar `onChange({ config: { ...config, campo: value } })`
2. ✅ Flash visual al arrastrar → `onDrag` actualiza store local inmediatamente
3. ✅ Panel derecho ancho variable → `width: '100%'` en hijos, padre controla ancho fijo
4. ✅ Zoom no recalcula → `requestAnimationFrame` doble en todas las funciones de recálculo
5. ✅ Título no se muestra → Wrapper flex column en widget-wrapper.tsx
6. ✅ chart-renderer resta 32px innecesarios → `innerHeight = height`

**Estado actual**:
- Fase 1: ✅ Completada
- Fase 2: ✅ Completada (incluyendo todos los bugs)
- Mejoras Canvas: ✅ Completadas
- Fase 3: ✅ Completada (eliminación, RLS, properties panel + renderers)
- Fase 4: 🔄 Próxima (filtros interactivos)
- Fase 5: ⏳ Pendiente (exportación PDF, pulido)

---

**Última actualización**: 01/05/2026 9:45pm
**Estado**: Fase 3 cerrada (3.1-3.4 completadas). Backend preparado para Fase 4: get_widget_grouped acepta parámetros de filtro, studio-store tiene activeFilters en estado. Listo para implementar UI de filtros interactivos.
