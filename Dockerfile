# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# EasyPanel crea el archivo .env en el build context antes del docker build.
# COPY . . lo incluye y Vite lo lee automáticamente — no se necesitan ARGs ni inyección en runtime.
COPY . .

RUN NODE_OPTIONS=--max-old-space-size=1536 npx vite build

# ── Stage 2: Serve con nginx ───────────────────────────────────────────────────
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
