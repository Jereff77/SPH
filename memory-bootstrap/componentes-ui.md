# Componentes UI y Layout

## shadcn/ui — componentes base (`components/ui/`)

24 componentes base instalados:

| Componente | Uso típico |
|-----------|-----------|
| `alert` | Alertas informativas |
| `alert-dialog` | Confirmaciones destructivas |
| `avatar` | Foto/inicial de usuario |
| `badge` | Etiquetas de estado |
| `button` | Acciones |
| `card` | Contenedores de sección |
| `checkbox` | Selección múltiple |
| `dialog` | Modales |
| `dropdown-menu` | Menús contextuales |
| `input` | Campos de texto |
| `label` | Etiquetas de formulario |
| `select` | Dropdowns |
| `separator` | Divisores visuales |
| `sheet` | Panels laterales deslizantes |
| `slider` | Control numérico deslizable |
| `switch` | Toggles on/off |
| `table` | Tablas de datos |
| `tabs` | Pestañas |
| `textarea` | Área de texto multilinea |
| `tooltip` | Tooltips al hover |
| `chart` | Wrapper de Recharts |

## Layout principal (`components/layout/`)

### Sidebar (`sidebar.tsx`)
Navegación lateral con 6 items:

```
/dashboard   → LayoutDashboard (Panel)
/pipeline    → Columns3 (Pipeline)
/leads       → Users (Leads)
/calendario  → Calendar (Agenda)
/aprobar     → CheckSquare (Aprobar) + badge conteo
/reportes    → BarChart2 (Reportes)

--- Config ---
/catalogos              → BookOpen
/catalogos/configuracion → Mail (SMTP)
```

### Topbar (`topbar.tsx`)
Barra superior con usuario autenticado y campana de notificaciones.

### Notificaciones en tiempo real (`realtime-notifications.tsx`)
Suscripción a canal Supabase Realtime para notificaciones push al usuario actual.

### Mobile overlay (`mobile-overlay.tsx`)
Overlay oscuro que cierra el sidebar en mobile al hacer tap fuera.

### Session Hydrator (`session-hydrator.tsx`)
Componente cliente que hidrata el Zustand Auth Store desde la sesión SSR del servidor. Evita mismatch hidratación servidor/cliente.

## Patrones de formulario

Todos los formularios usan:
```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({ ... })
const form = useForm({ resolver: zodResolver(schema) })
```

## Notificaciones toast

```typescript
import { toast } from 'sonner'

toast.success('Mensaje de éxito')
toast.error('Mensaje de error')
```

## Utilidad cn()

```typescript
// lib/utils.ts
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

Usar `cn()` para combinar clases condicionales con Tailwind sin conflictos.

## Módulos de UI por feature

| Directorio | Componentes principales |
|-----------|------------------------|
| `components/leads/` | leads-table, nuevo-lead-sheet, lead-sheet |
| `components/pipeline/` | kanban-board, kanban-column, lead-card |
| `components/dashboard/` | funnel-chart, kpi-card |
| `components/actividades/` | — |
| `components/calendario/` | — |
| `components/catalogos/` | — |
| `components/aprobar/` | — |
