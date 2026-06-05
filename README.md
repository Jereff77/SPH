# ERP SPH Bienes Raíces — v2 (Node.js + React + Supabase)

Reescritura del ERP (originalmente FlutterFlow) sobre un nuevo stack, conservando Supabase
(misma base de datos, funciones y RPCs **saneados**) y aplicando las correcciones de seguridad
documentadas en [`../documentacion-replicacion/`](../documentacion-replicacion/).

## Principio rector: frontera de confianza

> El **frontend nunca habla con Supabase directamente**. El **backend Node (NestJS) es la única vía
> de acceso** a la base de datos, usando la `service_role` key **solo en el servidor**, validando el
> JWT del usuario y aplicando **RBAC server-side** (reemplazo de `permisos.dart`). Esto cierra el
> hallazgo crítico #1 de la auditoría: el cliente ya no puede ejecutar SQL ni saltarse la autorización.

## Stack

| Capa | Tecnología |
|------|-----------|
| Monorepo | pnpm workspaces + Turborepo |
| Backend (`apps/api`) | NestJS 10 + TypeScript + Zod + `@supabase/supabase-js` (service_role) |
| Frontend (`apps/web`) | React 19 + Vite + TypeScript + TanStack Query + React Router + Tailwind + shadcn/ui |
| Tipos compartidos (`packages/types`) | Tipos generados de Supabase + contratos de API |
| Config compartida (`packages/config`) | tsconfig base, ESLint |
| Base de datos / Auth / Storage | Supabase (Postgres) |

## Estructura

```
version2/
├── apps/
│   ├── api/        # Backend NestJS — única vía a Supabase
│   └── web/        # Frontend React + Vite (SPA) — solo consume la API
├── packages/
│   ├── types/      # Tipos compartidos (DB de Supabase + DTOs)
│   └── config/     # tsconfig base + ESLint compartido
├── package.json    # raíz del workspace
├── pnpm-workspace.yaml
└── turbo.json
```

## Puesta en marcha

```bash
# 1. Instalar dependencias (desde version2/)
pnpm install

# 2. Configurar entorno
cp .env.example .env            # raíz (referencia)
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
#   -> rellenar SUPABASE_* en apps/api/.env (service_role SOLO aquí)

# 3. Arrancar todo en desarrollo (api + web)
pnpm dev

# o por separado:
pnpm dev:api      # http://localhost:3001
pnpm dev:web      # http://localhost:5173
```

## Scripts

| Script | Descripción |
|--------|-------------|
| `pnpm dev` | Arranca api + web en modo desarrollo (Turborepo) |
| `pnpm build` | Compila todos los paquetes y apps |
| `pnpm lint` | Lint en todo el monorepo |
| `pnpm typecheck` | Verificación de tipos |
| `pnpm test` | Pruebas |
| `pnpm format` | Formatea con Prettier |

## Roadmap de migración

1. ✅ **Estructura base del monorepo** (este scaffold).
2. ⬜ Capa de seguridad: auth (verificación JWT), `PermisoGuard` (RBAC), cliente Supabase service_role.
3. ⬜ Remediaciones P0 en Supabase (DDL): ver `../documentacion-replicacion/06-*` (las aplica el equipo de BD).
4. ⬜ Generar tipos de Supabase en `packages/types`.
5. ⬜ Migrar módulo por módulo (sugerido: empezar por Autenticación + Configuraciones/Seguridad, luego Inversionistas).
6. ⬜ Retirar el código Flutter original.
