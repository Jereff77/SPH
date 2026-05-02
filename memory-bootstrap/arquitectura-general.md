# Arquitectura General — CRM Ventas SPH Bienes Raíces

## Stack tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework | Next.js App Router | 16.2.4 |
| UI | React | 19.2.4 |
| Lenguaje | TypeScript | 5 |
| Estilos | TailwindCSS | 4 |
| Componentes | shadcn/ui | — |
| Backend | Supabase (PostgreSQL + RLS) | — |
| Estado global | Zustand | 5.0.12 |
| Data fetching | @tanstack/react-query | 5.100.6 |
| Formularios | react-hook-form + zod | 7.74 / 4.3.6 |
| Drag-and-drop | @dnd-kit/core + sortable | 6.3.1 / 10.0.0 |
| Gráficos | Recharts | 3.8.1 |
| Grid layout | Gridstack | 12.6.0 |
| Tablas | @tanstack/react-table | 8.21.3 |
| Calendario | @fullcalendar/react | 6.1.20 |
| Animaciones | Framer Motion | — |
| Iconos | Lucide React | — |
| Fechas | date-fns | 4.1.0 |
| Email | nodemailer | 8.0.7 |
| Despliegue | Docker + EasyPanel | — |

## Estructura de directorios

```
web/
├── app/                       # App Router Next.js
│   ├── (auth)/login/          # Sin layout — solo autenticación
│   ├── (crm)/                 # Con layout Sidebar + Topbar
│   │   ├── layout.tsx
│   │   ├── dashboard/
│   │   ├── pipeline/
│   │   ├── leads/ + [id]/
│   │   ├── reportes/ + [id]/
│   │   ├── calendario/
│   │   ├── aprobar/
│   │   └── catalogos/
│   └── api/
│       ├── auth/callback/     # Supabase OAuth callback
│       ├── health/            # Health check Docker
│       └── notifications/     # Webhooks email
│
├── components/
│   ├── ui/                    # shadcn/ui (24 componentes)
│   ├── layout/                # sidebar, topbar, mobile-overlay, session-hydrator
│   ├── reportes/              # Módulo principal (ver modulo-reportes.md)
│   ├── leads/
│   ├── pipeline/
│   ├── dashboard/
│   ├── actividades/
│   ├── calendario/
│   ├── catalogos/
│   └── aprobar/
│
├── lib/
│   ├── reportes/actions.ts    # Server actions CRUD reportes
│   ├── reportes/types.ts      # Tipos e interfaces
│   ├── queries/               # Server-side queries por módulo
│   ├── stores/                # Zustand: auth, kanban, ui
│   ├── supabase/              # client.ts, server.ts, get-user-role.ts
│   ├── providers/             # query-provider.tsx (React Query)
│   ├── types/index.ts         # Tipos globales
│   ├── utils.ts               # cn() helper
│   └── mailer.ts              # Nodemailer SMTP
│
├── middleware.ts              # Protección de rutas
└── public/
```

## Rutas y protección

| Ruta | Protección | Notas |
|------|-----------|-------|
| `/login` | Pública | Redirige a /dashboard si hay sesión |
| `/dashboard` | Auth | Panel de KPIs |
| `/pipeline` | Auth | Kanban de etapas |
| `/leads` + `/leads/[id]` | Auth | CRUD de leads |
| `/reportes` + `/reportes/[id]` | Auth | Editor dinámico |
| `/calendario` | Auth | FullCalendar + actividades |
| `/aprobar` | Auth | Bandeja aprobación supervisores |
| `/catalogos` | Auth + módulo 340 | Etapas, orígenes, SMTP |
| `/api/auth/callback` | Pública | Supabase OAuth |
| `/api/health` | Pública | Health check Docker |

## Patrones clave

- **Server Components + Server Actions**: queries y mutaciones sin API REST propia
- **Alias `@/*`** apunta a `web/` — rutas relativas evitables
- **Next.js output standalone** para Docker multi-stage build
- **Route groups** `(auth)` y `(crm)` para layouts diferenciados sin afectar URL
- **Middleware** intercept antes del render para validar sesión y módulos
