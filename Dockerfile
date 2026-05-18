# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# EasyPanel crea el archivo .env en el build context antes del docker build.
# COPY . . lo incluye y Vite lo lee automáticamente — no se necesitan ARGs ni inyección en runtime.
COPY . .

# Temporal: valores hardcodeados hasta resolver inyección desde EasyPanel
RUN VITE_SUPABASE_URL=https://szjlkvakwljssdnysazp.supabase.co \
    VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6amxrdmFrd2xqc3NkbnlzYXpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTY4MTkxOTEsImV4cCI6MjAxMjM5NTE5MX0.OvICpRi2IHrrzwQ6TDl_031QRU6qTy2gRWylMrGU8y8 \
    VITE_TOKEN_LIMIT=1000000 \
    NODE_OPTIONS=--max-old-space-size=1536 \
    npx vite build

# ── Stage 2: Serve con nginx ───────────────────────────────────────────────────
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
