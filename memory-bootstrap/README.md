# Memory Bootstrap — CRM Ventas SPH Bienes Raíces

Archivos de referencia rápida generados el 2026-04-30 tras análisis exhaustivo del proyecto.

## Índice

| Archivo | Contenido |
|---------|-----------|
| [arquitectura-general.md](arquitectura-general.md) | Stack, estructura de directorios, rutas, patrones generales |
| [modulo-reportes.md](modulo-reportes.md) | Sistema de reportes dinámicos: archivos, tipos, DnD, bugs resueltos |
| [supabase-integracion.md](supabase-integracion.md) | Proyecto Supabase, tablas, RLS, convenciones SQL del ecosistema SPH |
| [autenticacion-estado.md](autenticacion-estado.md) | Auth flow, middleware, Zustand stores, React Query |
| [componentes-ui.md](componentes-ui.md) | shadcn/ui, layout (sidebar/topbar), patrones de formulario |
| [despliegue-docker.md](despliegue-docker.md) | Docker multi-stage, EasyPanel, health check |
| [decisiones-tecnicas.md](decisiones-tecnicas.md) | 11 decisiones de arquitectura con contexto y razonamiento |

## Estado del proyecto al 2026-04-30

### Módulos implementados
- Autenticación (Supabase Auth + middleware)
- Dashboard con KPIs
- Pipeline Kanban
- Gestión de Leads (tabla + detalle + creación + aprobación)
- Calendario de actividades (FullCalendar)
- **Sistema de Reportes Dinámicos V2** (módulo principal)
- Catálogos (etapas, orígenes, SMTP)
- Bandeja de aprobación

### Última sesión de trabajo (2026-04-30)
Corrección de 3 bugs en el sistema de reportes:
1. `useSortable` → `useDraggable` en properties-panel-dnd.tsx
2. DragOverlay activado vía DndContext, no evento HTML nativo
3. Stale closure en dashboard-studio.tsx: `reloadWidget` eliminado, se llama `loadWidgetData` directo

### Próximos pasos pendientes
- Iniciar servidor de desarrollo: `cd web && npm run dev`
- Probar manualmente el reporteador: drag visual, drop en zonas, renderización de gráficos
- Verificar fuente correcta al hacer click en campo con fuente no-default
