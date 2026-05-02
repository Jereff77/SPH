# Tareas — SPH CRM Ventas
**Versión:** 1.1 | **Fecha:** 2026-04-28

**Estado:** `⬜` Pendiente · `🔄` En progreso · `✅` Completada · `⛔` Bloqueada

---

## Fase 1 — Migraciones de Base de Datos

> Ejecutar en Supabase producción (`szjlkvakwljssdnysazp`) vía `apply_migration`.

| Estado | ID | Tarea | Prioridad |
|---|---|---|---|
| ✅ | T-001 | Crear tabla `crm_tipoActividad` con datos iniciales (11 tipos) + RLS | Alta |
| ✅ | T-002 | Crear tabla `crm_historial_etapas` con FKs a leads, crm_Etapas, catUsers + RLS | Alta |
| ✅ | T-003 | Crear tabla `crm_lead_naves` con FKs a leads, catUsers + RLS | Alta |
| ✅ | T-004 | `ALTER TABLE leads ADD COLUMN "idCampania"` (nullable, FK a crm_campania) | Media |
| ✅ | T-005 | Verificar RLS activo en las 3 tablas nuevas | Alta |
| ✅ | T-006 | Crear función RPC `crm_leads_cambiar_etapa(p_idlead, p_id_etapa_nueva, p_uidr)` — atomiza UPDATE leads + INSERT historial + INSERT activity | Alta |

---

## Fase 2 — Setup del Proyecto Next.js

| Estado | ID | Tarea | Prioridad |
|---|---|---|---|
| ✅ | T-010 | `npx create-next-app@latest` con TypeScript, Tailwind, App Router | Alta |
| ✅ | T-011 | Instalar y configurar shadcn/ui (`npx shadcn@latest init`) | Alta |
| ✅ | T-012 | Instalar dependencias: `@supabase/supabase-js`, `@supabase/ssr`, TanStack Query v5, Zustand, React Hook Form, Zod, `@dnd-kit/core`, `date-fns`, Recharts, FullCalendar, Framer Motion, Lucide React | Alta |
| ✅ | T-013 | Configurar cliente Supabase para SSR (`lib/supabase/client.ts`, `lib/supabase/server.ts`) | Alta |
| ✅ | T-014 | Configurar `middleware.ts` — redirección automática a `/login` si sin sesión | Alta |
| ✅ | T-015 | Configurar CSS variables del tema SPH en `globals.css` (colores, dark mode) | Alta |
| ✅ | T-016 | Configurar fuente Inter vía `next/font` | Media |
| ✅ | T-017 | Crear tipos TypeScript: `Lead`, `ActivityHistory`, `CrmEtapa`, `CalendarEvent`, etc. en `lib/types/` | Alta |

---

## Fase 3 — Autenticación

| Estado | ID | Tarea | Prioridad |
|---|---|---|---|
| ✅ | T-020 | Crear `app/(auth)/login/page.tsx` — formulario email/contraseña con shadcn/ui | Alta |
| ✅ | T-021 | Implementar `signInWithPassword` vía Supabase Auth | Alta |
| ✅ | T-022 | Crear `app/api/auth/callback/route.ts` — exchange code por sesión (PKCE) | Alta |
| ✅ | T-023 | Leer rol desde `segModulosUsuarios` al iniciar sesión → guardarlo en Zustand (`useAuthStore`) | Alta |
| ✅ | T-024 | Implementar `signOut` desde menú de perfil | Alta |
| ✅ | T-025 | Proteger rutas: RC sin acceso a `/catalogos` (redirect en middleware) | Alta |

---

## Fase 4 — AppShell y Navegación

| Estado | ID | Tarea | Prioridad |
|---|---|---|---|
| ✅ | T-030 | Crear `app/(crm)/layout.tsx` — AppShell con Sidebar + Topbar | Alta |
| ✅ | T-031 | Sidebar colapsable: icon-only / expanded, state en localStorage | Media |
| ✅ | T-032 | Badge de contador en ítem "Aprobar" del sidebar (consulta `leads_porAprobar` count) | Media |
| ✅ | T-033 | Topbar: nombre del usuario, avatar con iniciales, menú de perfil + logout | Alta |
| ⬜ | T-034 | Breadcrumbs en Topbar para rutas de detalle (`/leads/[id]`) | Baja |

---

## Fase 5 — Dashboard

| Estado | ID | Tarea | Prioridad |
|---|---|---|---|
| ✅ | T-040 | Query `useDashboardStats()` — total leads, valor pipeline, conversión, pendientes aprobación | Alta |
| ✅ | T-041 | Componente `KPICard` con valor, etiqueta, ícono, delta vs semana anterior | Alta |
| ✅ | T-042 | Gráfico de embudo por etapa con Recharts (`FunnelChart`) | Alta |
| ✅ | T-043 | Gráfico de barras: leads por origen (Recharts `BarChart`) | Alta |
| ✅ | T-044 | Gráfico de línea: tendencia mensual últimos 6 meses (Recharts `LineChart`) | Alta |
| ✅ | T-045 | Lista de top 5 leads sin actividad +7 días — link directo al detalle | Alta |
| ⬜ | T-046 | Suscripción Supabase Realtime en dashboard — invalidar stats en cambios | Media |

---

## Fase 6 — Pipeline Kanban

| Estado | ID | Tarea | Prioridad |
|---|---|---|---|
| ✅ | T-050 | Query `useLeadsKanban(filters)` — leads agrupados por etapa | Alta |
| ✅ | T-051 | `KanbanBoard` con `@dnd-kit` — columnas drag-droppable | Alta |
| ✅ | T-052 | `KanbanColumn` — header con nombre, contador, suma de valor | Alta |
| ✅ | T-053 | `LeadCard` — nombre, teléfono, inmobiliaria, días en etapa, valor, RC, borde de calor | Alta |
| ✅ | T-054 | `onDragEnd` → optimistic update + llamada a RPC `crm_leads_cambiar_etapa` + rollback en error | Alta |
| ✅ | T-055 | Filtros: RC, Origen, Tipo Operación — dropdowns en toolbar, state en URL params | Alta |
| ✅ | T-056 | Click en `LeadCard` → `Sheet` lateral con resumen del lead (sin navegar fuera del Kanban) | Alta |
| ⬜ | T-057 | Botón "+ Nuevo Lead" → modal con formulario de registro | Alta |
| ⬜ | T-058 | Realtime: suscribirse a cambios en `leads` → invalidar query del Kanban | Media |

---

## Fase 7 — Lista de Leads

| Estado | ID | Tarea | Prioridad |
|---|---|---|---|
| ✅ | T-060 | `LeadsDataTable` con TanStack Table — 50 rows por página, paginación cursor | Alta |
| ✅ | T-061 | Columnas: Nombre, Teléfono, Etapa, RC, Origen, Tipo Operación, Valor, Última actividad, Días sin actividad | Alta |
| ✅ | T-062 | Búsqueda global debounced (nombre, teléfono, correo) | Alta |
| ✅ | T-063 | Filtros combinables: Etapa, RC, Origen, Tipo Operación, Tipo Cliente, Rango fechas | Alta |
| ✅ | T-064 | Indicador visual (badge rojo) si lead +7 días sin actividad | Alta |
| ✅ | T-065 | Acciones rápidas por fila sin navegar: `tel:` (llamar), WhatsApp link, ver detalle (link) | Media |
| ⬜ | T-066 | Exportar a CSV — solo admin/gerente | Baja |

---

## Fase 8 — Detalle de Lead

| Estado | ID | Tarea | Prioridad |
|---|---|---|---|
| ✅ | T-070 | `LeadDetailPage` — layout en dos columnas desktop (detalle izq \| naves der) | Alta |
| ✅ | T-071 | Header: nombre, teléfono clickeable, correo, inmobiliaria, badge de calor | Alta |
| ✅ | T-072 | `EtapaProgressBar` — todas las etapas activas como pasos, tap para avanzar/retroceder | Alta |
| ✅ | T-073 | Sección de datos: edición inline de valor, RC, calor (sin botón "Editar") | Alta |
| ✅ | T-074 | `ActivityForm` inline — tipo (select), nota (textarea), fecha agenda (datepicker) | Alta |
| ✅ | T-075 | Mutation `createActivity` → INSERT + invalidar árbol de historial | Alta |
| ✅ | T-076 | `ActivityTree` — árbol vertical con línea conectora, ícono por tipo, fecha, nota, RC | Alta |
| ✅ | T-077 | Nodos del árbol expandibles — detalle completo en expand | Media |
| ⬜ | T-078 | Panel "Naves Presentadas" — lista con nave, precio, resultado; botón "+ Nave" | Media |

---

## Fase 9 — Calendario

| Estado | ID | Tarea | Prioridad |
|---|---|---|---|
| ✅ | T-080 | Query `useCalendarEvents(mes, rcUid)` — lee `activity_history` WHERE `fechaAgenda` NOT NULL | Alta |
| ✅ | T-081 | `CalendarioView` con FullCalendar — vistas Mes / Semana / Día | Alta |
| ✅ | T-082 | Color por tipo de actividad en eventos del calendario | Alta |
| ✅ | T-083 | Filtro "Asesor" — admin/gerente ven todos; RC solo ve su agenda | Alta |
| ✅ | T-084 | Click en evento → `Sheet` lateral con datos del lead + link al detalle | Alta |
| ✅ | T-085 | Evento creado al guardar actividad con `fechaAgenda` → invalidar query calendario | Alta |

---

## Fase 10 — Aprobación de Leads Web

| Estado | ID | Tarea | Prioridad |
|---|---|---|---|
| ✅ | T-090 | Query `useLeadsPorAprobar()` — lee tabla `leads_porAprobar` donde status activo | Alta |
| ✅ | T-091 | `BandejaAprobacion` — lista de tarjetas con nombre, teléfono, superficie, KVAs, fecha | Alta |
| ✅ | T-092 | Acción "Aprobar" → ejecuta función Supabase existente de migración/aprobación | Alta |
| ✅ | T-093 | Acción "Rechazar" → UPDATE status=false | Alta |
| ⬜ | T-094 | Edición inline antes de aprobar — modal simple | Media |
| ✅ | T-095 | Badge clickeable → Sheet comparador lado a lado (nuevo vs existente) con acciones Rechazar/Aprobar | Media |

---

## Fase 11 — Notificaciones

| Estado | ID | Tarea | Prioridad |
|---|---|---|---|
| ✅ | T-100 | Canal Supabase Realtime `crm_notifications` — broadcast desde RPC de asignación | Media |
| ✅ | T-101 | Toast de notificación cuando se asigna lead al RC activo | Media |
| ⬜ | T-102 | Toast cuando lead +7 días sin actividad (check periódico o trigger BD) | Baja |
| ✅ | T-103 | Badge de contador en sidebar "Aprobar" — actualizado por Realtime | Media |

---

## Fase 12 — Catálogos (solo Admin)

| Estado | ID | Tarea | Prioridad |
|---|---|---|---|
| ✅ | T-110 | Layout de catálogos — tabs por tabla: Etapas, Origen, Tipo Operación, Tipo Venta, Tipo Cliente, Campaña, Recepción | Media |
| ✅ | T-111 | CRUD genérico con DataTable + formulario modal — activar/desactivar, editar | Media |
| ✅ | T-112 | Reordenamiento de etapas con drag & drop (actualiza campo `orden`) | Media |
| ✅ | T-113 | Editor de color inline para bkColor/txtColor (color picker nativo HTML) | Baja |

---

## Fase 13 — Pulido y QA

| Estado | ID | Tarea | Prioridad |
|---|---|---|---|
| ⬜ | T-120 | Dark mode — toggle en perfil, persistido en cookie, CSS variables automáticas | Media |
| ⬜ | T-121 | Skeleton loaders para todas las páginas (evitar layout shifts) | Media |
| ⬜ | T-122 | Error boundaries + toast de error global | Alta |
| ⬜ | T-123 | Estados vacíos (empty states) con ilustración SPH en listas sin datos | Baja |
| ⬜ | T-124 | Verificar regla de 3 clicks para acciones frecuentes (actividad, cambio etapa, ver lead) | Alta |
| ⬜ | T-125 | Performance: revisar bundle size, lazy load de FullCalendar y Recharts | Media |
| ⬜ | T-126 | Pruebas manuales en Chrome, Edge, Safari | Alta |

---

## Fase 14 — Integración Google ⚠️ DIFERIDA

> No iniciar hasta que el admin de SPH tramite acceso en Google Cloud Console y configure la app OAuth en `admin.google.com`.

| Estado | ID | Tarea | Prioridad |
|---|---|---|---|
| ⛔ | T-130 | Pantalla de configuración por asesor: email SMTP + App Password (cifrado en BD con pgcrypto) | Alta |
| ⛔ | T-131 | Envío de correos desde detalle de lead via nodemailer (Route Handler Next.js) | Alta |
| ⛔ | T-132 | IMAP polling: recibir respuestas de clientes con tag `[SPH-{leadId}]` → INSERT activity_history | Media |
| ⛔ | T-133 | Google OAuth por usuario: flujo de autorización, guardar refresh_token por asesor | Alta |
| ⛔ | T-134 | Crear cita en CRM → POST a Google Calendar API del asesor | Alta |
| ⛔ | T-135 | Leer eventos de Google Calendar del asesor → mostrar en calendario CRM | Alta |
| ⛔ | T-136 | Sync bidireccional: cambios en GCal → webhook → actualizar CRM | Baja |

---

## Resumen de Dependencias

```
Fase 1 (BD) → Fase 2 (Setup) → Fase 3 (Auth) → Fase 4 (Shell)
                                                      │
                         ┌────────────────────────────┤
                         ↓                            ↓
                    Fase 5 (Dashboard)           Fase 6 (Kanban)
                         │                            │
                         └───────────┬────────────────┘
                                     ↓
                              Fase 7 (Leads Lista)
                                     │
                                     ↓
                              Fase 8 (Lead Detalle)
                                     │
                         ┌───────────┴──────────────┐
                         ↓                          ↓
                   Fase 9 (Calendario)    Fase 10 (Aprobación)
                         │
                         └──────────────────────────→ Fase 13 (QA)

Fase 14 (Google) — DIFERIDA, sin dependencias bloqueantes
```

## Estimación orientativa

| Fase | Días |
|---|---|
| 1–2 (BD + Setup) | 1 día |
| 3–4 (Auth + Shell) | 1 día |
| 5 (Dashboard) | 2 días |
| 6 (Kanban) | 2 días |
| 7–8 (Leads + Detalle + Árbol) | 3 días |
| 9 (Calendario) | 1.5 días |
| 10–11 (Aprobación + Notif.) | 1.5 días |
| 12–13 (Catálogos + QA) | 2 días |
| **Total Fase 1–13** | **~14 días** |
| 14 (Google — diferida) | ~3 días |
