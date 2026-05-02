# Decisiones Técnicas Importantes

## 1. Next.js App Router con Server Actions (sin API REST)

**Decisión:** Toda la lógica de datos usa Server Components y Server Actions directamente.
**Por qué:** Elimina la capa de API Routes para operaciones internas. Los Server Actions tienen acceso directo a Supabase server-side con la cookie de sesión. Más simple y seguro.
**Implicación:** Las mutaciones se importan desde `lib/reportes/actions.ts` y se llaman con `await` en handlers de cliente. Las queries en Server Components se llaman directamente.

## 2. @dnd-kit: useDraggable vs useSortable

**Decisión:** En `properties-panel-dnd.tsx` se usa `useDraggable`, NO `useSortable`.
**Por qué:** `useSortable` requiere `SortableContext` ancestral para computar transforms. Sin él, `isDragging` y `transform` siempre son `null/undefined`. El caso de uso es arrastrar campos a zonas drop (no reordenar una lista), por lo que `useDraggable` es el hook correcto.
**Implicación:** El transform es `{ x: number, y: number }` — se construye manualmente: `translate3d(${x}px, ${y}px, 0)`.

## 3. DragOverlay activado vía DndContext, no via evento nativo

**Decisión:** `activeCampo` se setea en el handler `onDragStart` de `DndContext` leyendo `event.active.data.current?.campo`.
**Por qué:** El `onDragStart` nativo del HTML no está integrado con dnd-kit. El DragOverlay solo funciona si el estado activo lo establece dnd-kit.
**Implicación:** Siempre pasar `data: { campo }` al llamar `useDraggable({ id, data: { campo } })`.

## 4. loadWidgetData en lugar de reloadWidget (stale closure fix)

**Decisión:** `handleWidgetUpdate` en `dashboard-studio.tsx` llama `loadWidgetData(id)` directamente dentro del `setTimeout`, no `reloadWidget`.
**Por qué:** `reloadWidget` era un useCallback que capturaba el array `widgets` de su closure en tiempo de creación — antes de que `setWidgets` committeara el nuevo valor. `loadWidgetData` solo llama el server action `getWidgetData` sin depender del estado `widgets`.
**Implicación:** No crear funciones intermedias que dependan de estado mutable cuando se usan dentro de `setTimeout`.

## 5. Gridstack para layout de widgets

**Decisión:** Layout del canvas con Gridstack (no CSS Grid ni Flexbox manual).
**Por qué:** Gridstack provee resize + drag nativo del canvas, persistencia de posiciones (gs_x, gs_y, gs_w, gs_h), y 12-columnas responsivas.
**Implicación:** Las posiciones se guardan en `crm_widgets` con `updateWidgetLayout` con debounce de 400ms para no hacer un request por cada pixel de arrastre.

## 6. Zustand con persist para estado de sesión

**Decisión:** El `auth.store.ts` usa Zustand con `persist` middleware.
**Por qué:** Evita parpadeo (flash of unauthenticated content) al recargar. El `session-hydrator.tsx` sincroniza desde el servidor.

## 7. Docker standalone output

**Decisión:** `next.config.ts` tiene `output: 'standalone'`.
**Por qué:** EasyPanel despliega contenedores. El standalone output incluye solo los archivos necesarios para correr, sin `node_modules` completo. Reduce el tamaño de la imagen ~70%.
**Implicación:** `images.unoptimized: true` es requerido en modo standalone para que Next.js Image funcione sin el servidor de optimización de imágenes.

## 8. Módulo 340 para proteger /catalogos

**Decisión:** El middleware verifica `segModulosUsuarios` para el módulo con id `340` antes de permitir acceso a `/catalogos`.
**Por qué:** La misma tabla de módulos del ERP controla acceso en el CRM Ventas. Consistencia con el ecosistema SPH.

## 9. Vistas materializadas como fuentes de datos para reportes

**Decisión:** Las fuentes disponibles en el reporteador son vistas (`v_leads_completo`, `v_actividades_completo`), no tablas directas.
**Por qué:** Las vistas encapsulan JOINs, formateo de campos y campos calculados. El reporteador no necesita conocer la estructura interna de las tablas normalizadas.
**Implicación:** Para agregar nuevas fuentes al reporteador hay que crear una vista y registrarla en el tipo `fuente` de `Widget`.

## 10. Sistema de reportes V2 (versión actual)

**Decisión:** Se deprecó el sistema V1 (`chart-renderer.tsx`) y se usa V2 (`chart-renderer-v2.tsx`).
**Por qué:** V2 agrega configuración avanzada (ejes, leyenda, animación, grid, colores personalizados por serie), soporte de multi-series, y KPI cards.
**Implicación:** `chart-renderer.tsx` se mantiene en el repositorio solo por referencia. Toda implementación nueva usa V2.

## 11. PointerSensor con activationConstraint en dnd-kit

**Decisión:** `PointerSensor` configurado con `{ distance: 8 }` como activationConstraint.
**Por qué:** Sin constraint, cualquier click en un campo lo activa como drag. La distancia mínima de 8px distingue click de arrastre intencional.
