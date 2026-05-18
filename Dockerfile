# ── Stage 1: Build con valores placeholder ────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# Build con placeholders — serán reemplazados al iniciar el contenedor
RUN VITE_SUPABASE_URL=__SPH_SUPABASE_URL__ \
    VITE_SUPABASE_ANON_KEY=__SPH_ANON_KEY__ \
    VITE_TOKEN_LIMIT=__SPH_TOKEN_LIMIT__ \
    npm run build

# ── Stage 2: Serve con nginx ───────────────────────────────────────────────────
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
