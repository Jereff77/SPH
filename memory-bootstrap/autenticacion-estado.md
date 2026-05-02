# Autenticación y Estado Global

## Auth Flow

```
Usuario sin sesión
  → Middleware detecta ausencia de cookie Supabase
  → Redirect a /login

Login en /login
  → Supabase Auth (email/password)
  → Callback a /api/auth/callback
  → Supabase establece cookie de sesión
  → Redirect a /dashboard

En /login con sesión activa
  → Middleware redirige a /dashboard

/catalogos
  → Middleware verifica módulo 340 en segModulosUsuarios
  → Sin módulo → redirect a /dashboard
```

## Middleware (`web/middleware.ts`)

Corre en cada request a rutas protegidas:
1. Intenta refrescar sesión Supabase SSR
2. Sin sesión → `/login`
3. En `/login` con sesión → `/dashboard`
4. En `/catalogos` → consulta `segModulosUsuarios` para módulo 340
5. Error de Supabase → `/login`

## Zustand Stores

### Auth Store (`lib/stores/auth.store.ts`)

```typescript
interface AuthStore {
  user: AuthUser | null
  setUser: (user: AuthUser | null) => void
  isRole: (role: UserRole) => boolean
  isAdmin: () => boolean
  isGerente: () => boolean
}
```

Usado por componentes cliente para saber rol actual sin roundtrip al servidor.

### UI Store (`lib/stores/ui.store.ts`)

```typescript
// Controla:
mobileSidebarOpen: boolean
closeMobileSidebar(): void
```

### Kanban Store (`lib/stores/kanban.store.ts`)

```typescript
// Controla estado del drag en kanban de pipeline:
draggingCard: Lead | null
setDraggingCard(card: Lead | null): void
```

## Session Hydration

`components/layout/session-hydrator.tsx` — hidrata el Auth Store en el cliente leyendo la sesión SSR del layout del servidor. Evita flicker de UI por mismatch servidor/cliente.

## React Query

`lib/providers/query-provider.tsx` wrappea toda la app CRM con `QueryClientProvider`. Permite usar `useQuery` / `useMutation` en componentes cliente junto con Server Actions.

## Helpers de roles

```typescript
// lib/supabase/get-user-role.ts
// Consulta catUsers para obtener el rol del usuario autenticado
```

## Variables de sesión críticas

| Variable | Origen | Uso |
|----------|--------|-----|
| `auth.uid()` | Supabase session | Filtra datos en RLS y queries |
| `user.role` | catUsers | Controla visibilidad (asesor/gerente/admin) |
| Módulo 340 | segModulosUsuarios | Acceso a /catalogos |
