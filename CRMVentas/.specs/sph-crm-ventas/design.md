# Diseño — SPH CRM Ventas
**Versión:** 1.1 | **Fecha:** 2026-04-28

---

## Arquitectura General

```
┌─────────────────────────────────────────────────────┐
│           Next.js 14 App (Web)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │ Server       │  │ Client       │  │ shadcn/ui │ │
│  │ Components   │  │ Components   │  │ + Tailwind│ │
│  └──────┬───────┘  └──────┬───────┘  └───────────┘ │
│         │                 │                          │
│  ┌──────▼─────────────────▼──────────────────────┐  │
│  │   TanStack Query (caché + server state)        │  │
│  └──────┬─────────────────────────────────────────┘  │
│         │                                            │
│  ┌──────▼─────────────────────────────────────────┐  │
│  │   Supabase JS Client (auth + db + realtime)    │  │
│  └──────┬─────────────────────────────────────────┘  │
└─────────┼───────────────────────────────────────────┘
          │
┌─────────▼───────────────────────────────────────────┐
│        Supabase Backend                              │
│  ┌──────────┐  ┌──────────┐  ┌────────┐  ┌───────┐ │
│  │PostgreSQL│  │Realtime  │  │  Auth  │  │  RLS  │ │
│  │ + RLS    │  │Channels  │  │  JWT   │  │       │ │
│  └──────────┘  └──────────┘  └────────┘  └───────┘ │
└─────────────────────────────────────────────────────┘
```

---

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 14 (App Router) + TypeScript |
| UI Components | shadcn/ui (Radix UI + Tailwind CSS) |
| Estilos | Tailwind CSS 3.x con CSS variables SPH |
| Estado del servidor | TanStack Query v5 (React Query) |
| Estado local | Zustand (UI state: filtros, sidebars, modales) |
| Formularios | React Hook Form + Zod |
| Navegación | Next.js App Router (file-based routing) |
| Backend | Supabase (PostgreSQL + RLS + Auth + Realtime) |
| Gráficas | Recharts |
| Calendario | FullCalendar (react-fullcalendar) |
| Animaciones | Framer Motion |
| Drag & Drop | @dnd-kit/core |
| Iconos | Lucide React |
| Fechas | date-fns |
| Tablas | TanStack Table v8 |

---

## Sistema de Diseño SPH

### Paleta de Colores (CSS Variables)
```css
:root {
  /* Primarios SPH */
  --sph-primary:        #2C2C2C;  /* Gris oscuro — textos, sidebar */
  --sph-primary-light:  #4A4A4A;
  --sph-accent:         #C9963A;  /* Dorado industrial — CTAs, badges */
  --sph-accent-light:   #E8B86D;

  /* Superficies */
  --sph-surface:        #FFFFFF;
  --sph-surface-var:    #F5F5F5;
  --sph-background:     #F0F0F0;
  --sph-border:         #E2E2E2;

  /* Calor de lead (heat_level) */
  --heat-frio:          #90A4AE;  /* Frío — azul gris */
  --heat-tibio:         #FFB74D;  /* Tibio — naranja */
  --heat-caliente:      #E53935;  /* Caliente — rojo */

  /* Estados de etapa */
  --stage-ganado:       #43A047;
  --stage-perdido:      #E53935;
  --stage-pausa:        #78909C;

  /* Tipos de actividad (calendario) */
  --act-llamada:        #3B82F6;  /* Azul */
  --act-whatsapp:       #10B981;  /* Verde */
  --act-visita:         #8B5CF6;  /* Violeta */
  --act-reunion:        #F59E0B;  /* Ámbar */
  --act-correo:         #6B7280;  /* Gris */
  --act-agendar:        #EC4899;  /* Rosa */
}

.dark {
  --sph-surface:        #1E1E1E;
  --sph-surface-var:    #2A2A2A;
  --sph-background:     #111111;
  --sph-border:         #333333;
}
```

### Tipografía
```ts
// next/font — Inter Variable
import { Inter } from 'next/font/google'
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

// Escala
// display:   32px / 700
// title:     20px / 600
// body:      14px / 400  (base CRM — más compacto que 16)
// small:     12px / 400
// label:     11px / 500
```

---

## Estructura de Rutas (App Router)

```
app/
├── (auth)/
│   └── login/              → LoginPage (Server Component)
├── (crm)/
│   ├── layout.tsx          → AppShell (sidebar + topbar)
│   ├── dashboard/          → DashboardPage
│   ├── pipeline/           → PipelineKanbanPage
│   ├── leads/
│   │   ├── page.tsx        → LeadsListPage
│   │   └── [id]/
│   │       └── page.tsx    → LeadDetailPage
│   ├── calendario/         → CalendarioPage
│   ├── aprobar/            → LeadsPorAprobarPage
│   ├── catalogos/          → CatalogosPage (solo admin)
│   └── perfil/             → PerfilPage
└── api/
    └── auth/callback/      → Supabase Auth callback
```

---

## Pantallas Clave

### 1. AppShell — Layout Principal
```
┌──────────────────────────────────────────────────────────┐
│ [Logo SPH]  CRM Ventas                    [RC: Nombre ▼] │
├────────┬─────────────────────────────────────────────────┤
│        │                                                  │
│ 📊     │                                                  │
│ Panel  │         <Contenido de la ruta activa>           │
│        │                                                  │
│ 📋     │                                                  │
│ Pipeline│                                                 │
│        │                                                  │
│ 👥     │                                                  │
│ Leads  │                                                  │
│        │                                                  │
│ 📅     │                                                  │
│ Agenda │                                                  │
│        │                                                  │
│ ✅     │                                                  │
│ Aprobar│                                                  │
│  (61)  │                                                  │
│        │                                                  │
│ ⚙️     │                                                  │
│ Catálog│                                                  │
└────────┴─────────────────────────────────────────────────┘
```
Sidebar colapsable (icon-only mode) — state persistido en localStorage.

### 2. Dashboard
```
┌─────────────────────────────────────────────────────────┐
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │  5,227   │ │ $12.4M   │ │   18%    │ │  61 ⚠️   │  │
│  │  Leads   │ │ Pipeline │ │  Conv.   │ │  Aprobar  │  │
│  │ activos  │ │  total   │ │          │ │           │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
│                                                          │
│  ┌───────────────────────┐  ┌──────────────────────┐   │
│  │   Funnel por Etapa    │  │  Leads por Origen    │   │
│  │   [Recharts Funnel]   │  │  [Recharts BarChart] │   │
│  └───────────────────────┘  └──────────────────────┘   │
│                                                          │
│  ┌───────────────────────┐  ┌──────────────────────┐   │
│  │  Sin actividad +7días │  │  Tendencia mensual   │   │
│  │  [Lista con link]     │  │  [Recharts LineChart]│   │
│  └───────────────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 3. Pipeline Kanban (drag & drop con @dnd-kit)
```
┌──────────────────────────────────────────────────────────────┐
│  Pipeline   [RC ▼]  [Origen ▼]  [Tipo ▼]     [+ Nuevo Lead] │
├──────────────┬──────────────┬──────────────┬─────────────────┤
│ REGISTRO     │ ENV. INFO    │ VISITA       │ PROPUESTA       │
│ 142  $0      │ 89  $8.2M   │ 45  $12.4M  │ 23  $18.1M      │
├──────────────┼──────────────┼──────────────┼─────────────────┤
│ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐  │
│ │● Lina C  │ │ │○ Pedro V │ │ │● Ana R   │ │ │● Corp SA │  │
│ │750m²     │ │ │Nave 5    │ │ │500m²     │ │ │$2.1M     │  │
│ │4 días    │ │ │2 días    │ │ │1 día     │ │ │8 días    │  │
│ │Mariana P │ │ │Carlos M  │ │ │Mariana P │ │ │Carlos M  │  │
│ └──────────┘ │ └──────────┘ │ └──────────┘ │ └──────────┘  │
│              │              │              │                  │
│ ┌──────────┐ │              │              │                  │
│ │○ Juan M  │ │              │              │                  │
│ │BTS 12d   │ │              │              │                  │
│ └──────────┘ │              │              │                  │
└──────────────┴──────────────┴──────────────┴─────────────────┘
```
- Borde izquierdo de tarjeta = calor (rojo/amarillo/gris)
- Click en tarjeta → slide-over panel con detalle de lead (sin navegar)
- Drag entre columnas → optimistic update + INSERT historial

### 4. Detalle de Lead (con árbol de historial)
```
┌─────────────────────────────────────────────────────────┐
│ ← Leads    Lina Correa              🔴 Caliente  [···]  │
│ 📞 442 865 4853  ✉️ —   🏢 Inmobiliaria XYZ             │
├───────────────────────────────────────────────────┬─────┤
│                                                   │     │
│  ━━ Etapa ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │  N  │
│  [Registro]━━[Env.Info]━━[Visita]━━[Propuesta]   │  a  │
│              ↑ activa                             │  v  │
│                                                   │  e  │
│  ━━ Datos ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │  s  │
│  Origen: Tel. Oficina   RC: Mariana P             │     │
│  Tipo: Inmobiliaria / Renta   Valor: $0           │  P  │
│  Necesidad: "Nave 750-800m², 45kVAs, Costco"      │  r  │
│                                                   │  e  │
│  ━━ Nueva Actividad ━━━━━━━━━━━━━━━━━━━━━━━━━━  │  s  │
│  [Llamada ▼]  [Nota____________]  [📅 Fecha]      │  e  │
│                              [Guardar Actividad]  │  n  │
│                                                   │  t  │
│  ━━ Historial ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │  a  │
│  │                                               │  d  │
│  ├─ 📞 28/04  10:30  Llamada                    │  a  │
│  │     "Interesada, volver a llamar la próxima"  │  s  │
│  │     Mariana Pulquero                          │     │
│  │                                               │     │
│  ├─ 🔄 25/04  09:00  Cambio de Etapa            │     │
│  │     Registro → Envío de Info                  │     │
│  │     Mariana Pulquero                          │     │
│  │                                               │     │
│  └─ ✅ 20/04  14:15  Registro                   │     │
│        Lead creado desde formulario web           │     │
│        Admin SPH                                  │     │
└───────────────────────────────────────────────────┴─────┘
```
- Historial en árbol vertical — íconos por tipo de actividad, línea conectora
- Los nodos son expandibles para mostrar detalle completo
- El panel de "Naves Presentadas" aparece como columna derecha en desktop
- Nueva actividad: formulario siempre visible (no colapsado), se actualiza el árbol al guardar con animación

### 5. Calendario por Asesor
```
┌─────────────────────────────────────────────────────────┐
│  Agenda   [Mes ▼]  [Asesor: Todos ▼]   < Abril 2026 >  │
├─────────────────────────────────────────────────────────┤
│  Lun    Mar    Mié    Jue    Vie    Sáb    Dom           │
│                                                          │
│   6      7      8      9     10     11     12            │
│                ┌─────┐       ┌─────┐                    │
│                │📞   │       │🏢   │                    │
│                │Lina │       │Corp │                    │
│                │10:00│       │15:00│                    │
│                └─────┘       └─────┘                    │
│                                                          │
│  13     14     15     16     17     18     19            │
│         ┌─────┐              ┌─────┐                    │
│         │💬   │              │📞   │                    │
│         │Juan │              │Ana R│                    │
│         │09:30│              │11:00│                    │
│         └─────┘              └─────┘                    │
└─────────────────────────────────────────────────────────┘
```
- Vistas: Mes / Semana / Día (FullCalendar)
- Click en evento → Sheet lateral con datos del lead y acceso directo al detalle
- Color por tipo de actividad (llamada=azul, visita=violeta, WhatsApp=verde, etc.)
- Filtro por RC — dropdown con todos los asesores (admin/gerente) o solo "Mi Agenda" (RC)

---

## Arquitectura de Datos (TypeScript)

### Tipos principales
```ts
interface Lead {
  id: string               // uuid
  nombreLead: string
  telefono?: string
  correo?: string
  idEtapa: number
  etapa: string            // desnormalizado
  uidRC?: string
  nomRC: string
  valor: number
  idOrigen: number
  origen: string           // desnormalizado
  heatLevel?: number       // 1=frío 2=tibio 3=caliente
  idCampania?: number
  fc: string               // ISO
  fechaContacto?: string
}

interface ActivityHistory {
  id: string
  leadId: string
  type?: string
  message?: string
  activityDate?: string
  heatLevel?: number
  fechaAgenda?: string
  uidr?: string            // RC que registró
  nomRC?: string           // join con catUsers
}

interface CrmEtapa {
  id: number
  titulo: string
  orden: number
  bkColor: string
  txtColor: string
  status: boolean
}

interface CalendarEvent {
  id: string
  title: string            // nombre del lead
  start: Date
  end: Date
  activityType: string
  leadId: string
  rcName: string
  color: string
}
```

### Capa de datos — Supabase + TanStack Query
```ts
// Hooks de React Query
const { data: leads }     = useQuery({ queryKey: ['leads', filters], queryFn: fetchLeads })
const { data: activities} = useQuery({ queryKey: ['activities', leadId], queryFn: fetchActivities })
const { data: eventos }   = useQuery({ queryKey: ['calendario', mes, rcUid], queryFn: fetchEventos })

// Mutations con optimistic update
const updateEtapa = useMutation({
  mutationFn: ({ leadId, idEtapa }) => supabase.rpc('crm_leads_cambiar_etapa', ...),
  onMutate: async (vars) => { /* optimistic update del caché de Kanban */ },
  onError: (err, vars, ctx) => { /* rollback */ },
})

const createActivity = useMutation({
  mutationFn: (dto) => supabase.from('activity_history').insert(dto),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['activities', leadId] }),
})
```

---

## Flujos Críticos

### Cambio de etapa (drag & drop Kanban)
```
Usuario arrastra card → columna nueva (@dnd-kit onDragEnd)
    ↓
Optimistic update inmediato en caché de TanStack Query
    ↓ (background)
supabase.rpc('crm_leads_cambiar_etapa', { p_idlead, p_id_etapa_nueva, p_uidr })
    ├── UPDATE leads SET idEtapa, Etapa, fum
    ├── INSERT crm_historial_etapas
    └── INSERT activity_history (type='Cambio Etapa')
    ↓
onError → rollback del optimistic update + toast de error
    ↓
Supabase Realtime notifica a otros usuarios conectados → invalidate query
```

### Registro de actividad (inline en detalle de lead)
```
Usuario llena: tipo + nota [+ fechaAgenda opcional]
    ↓ click "Guardar Actividad"
INSERT activity_history (con leadId, uidr, fechaAgenda si aplica)
    ↓ si heatLevel cambia
UPDATE leads.heat_level (desnormalizado)
    ↓
invalidateQueries(['activities', leadId]) → árbol se actualiza con animación
    ↓ si tiene fechaAgenda
invalidateQueries(['calendario', mes]) → aparece en calendario
```

---

## Realtime — Supabase Channels
```ts
// Kanban en tiempo real — cambios de leads visibles para todos
supabase
  .channel('kanban_leads')
  .on('postgres_changes', {
    event: '*', schema: 'public', table: 'leads'
  }, () => queryClient.invalidateQueries({ queryKey: ['leads'] }))
  .subscribe()

// Notificaciones — nuevo lead asignado al RC activo
supabase
  .channel('crm_notifications')
  .onBroadcast({ event: 'lead_asignado' }, ({ payload }) => {
    if (payload.uidRC === currentUser.uid) toast.info(`Nuevo lead: ${payload.nombre}`)
  })
  .subscribe()
```

---

## Estructura de Directorios

```
src/
├── app/
│   ├── (auth)/login/
│   ├── (crm)/
│   │   ├── layout.tsx          # AppShell
│   │   ├── dashboard/
│   │   ├── pipeline/
│   │   ├── leads/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── calendario/
│   │   ├── aprobar/
│   │   ├── catalogos/
│   │   └── perfil/
│   └── api/auth/callback/
├── components/
│   ├── ui/                     # shadcn/ui (button, card, sheet, etc.)
│   ├── layout/                 # AppShell, Sidebar, Topbar
│   ├── dashboard/              # KPICard, FunnelChart, LeadsSinActividad
│   ├── pipeline/               # KanbanBoard, KanbanColumn, LeadCard
│   ├── leads/                  # LeadsList, LeadDetail, LeadForm
│   ├── actividades/            # ActivityTree, ActivityForm, ActivityNode
│   ├── calendario/             # CalendarioView, EventCard
│   ├── aprobar/
│   ├── catalogos/
│   └── shared/                 # HeatBadge, EtapaProgress, RCAvatar
├── lib/
│   ├── supabase/               # client, server, middleware
│   ├── queries/                # TanStack Query hooks por feature
│   ├── mutations/              # useMutation hooks
│   ├── types/                  # Lead, Activity, Etapa, etc.
│   └── utils/                  # formatters, heat colors, date helpers
└── middleware.ts               # auth redirect (Supabase SSR)
```
