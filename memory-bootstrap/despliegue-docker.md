# Despliegue — Docker + EasyPanel

## Configuración Next.js para Docker

```typescript
// next.config.ts
{
  output: 'standalone',        // genera build autocontenido
  reactStrictMode: true,
  swcMinify: true,
  images: { unoptimized: true } // necesario para standalone
}
```

## Dockerfile (multi-stage)

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

## docker-compose.yml

```yaml
services:
  crm-ventas:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_SUPABASE_URL
      - NEXT_PUBLIC_SUPABASE_ANON_KEY
      - NODE_ENV=production
    healthcheck:
      test: curl -f http://localhost:3000/api/health
      interval: 30s
```

## Health check

`GET /api/health` — devuelve `{ status: 'ok' }` con HTTP 200. Sin autenticación.

## EasyPanel

Metadatos en `web/easypanel.json`. Deploy apunta al `Dockerfile` en `web/`.

Variables de entorno requeridas en EasyPanel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Flujo de deploy

```bash
# Local
cd web && npm run build    # Verifica que compila
docker-compose up -d       # Prueba contenedor

# EasyPanel
# Push al repositorio → EasyPanel hace build automático
# o trigger manual desde el panel
```

## .dockerignore (archivos excluidos)

```
node_modules/
.next/
.env*
*.log
```
