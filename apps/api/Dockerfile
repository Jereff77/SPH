# =============================================================================
# Backend NestJS (@erp/api) — imagen de producción para EasyPanel.
# Build context = RAÍZ del monorepo (version2/). Dockerfile path = apps/api/Dockerfile.
# Monorepo pnpm: se instala desde la raíz, se compila @erp/types + @erp/api y se
# genera un paquete autocontenido con `pnpm deploy` para una imagen final liviana.
# =============================================================================

FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# ----- Build -----
FROM base AS build
# Copia todo el monorepo (el .dockerignore excluye node_modules, dist, .env, etc.)
COPY . .
# Instala TODAS las dependencias del workspace (incluye devDeps para compilar).
RUN pnpm install --frozen-lockfile
# Compila la lib de tipos (dependencia) y el backend.
RUN pnpm --filter @erp/types build \
 && pnpm --filter @erp/api build
# Genera un paquete de producción autocontenido (node_modules solo de prod).
RUN pnpm deploy --filter=@erp/api --prod /prod/api

# ----- Runtime -----
FROM node:22-slim AS runner
ENV NODE_ENV=production
# API_PORT se puede sobreescribir en EasyPanel; por defecto 3001.
ENV API_PORT=3001
WORKDIR /app
COPY --from=build /prod/api .
EXPOSE 3001
# Healthcheck: GET /api/health (público, sin auth).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
