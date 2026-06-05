# =============================================================================
# Frontend React + Vite (@erp/web) — SPA estática servida con nginx.
# Build context = RAÍZ del monorepo (version2/). Dockerfile path = apps/web/Dockerfile.
# La URL del backend (VITE_API_URL) se inyecta en BUILD time (Vite la "hornea" en
# el bundle), por eso se pasa como build arg desde EasyPanel.
# =============================================================================

FROM node:22-slim AS build
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# URL del backend (p. ej. https://api-erp.tu-dominio.com). Configurable en EasyPanel.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Copia todo el monorepo (el .dockerignore excluye node_modules, dist, .env, etc.)
COPY . .
RUN pnpm install --frozen-lockfile
# Compila la lib de tipos (dependencia) y el frontend (genera apps/web/dist).
RUN pnpm --filter @erp/types build \
 && pnpm --filter @erp/web build

# ----- Runtime: nginx sirve el estático -----
FROM nginx:alpine AS runner
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
