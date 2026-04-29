# -----------------------------------------------------------------------------
# Dockerfile Multi-Stage para CRM Ventas - Next.js 16.2.4
# Optimizado para producción en EasyPanel
# -----------------------------------------------------------------------------

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# Aprovecha el cache de Docker separando dependencies del código
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps

# Instalar dependencias del sistema
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copiar solo archivos de dependencias para mejor cache
COPY package.json package-lock.json* ./

# Instalar dependencias de producción
RUN npm ci --only=production && \
    npm cache clean --force

# -----------------------------------------------------------------------------
# Stage 2: Builder
# Compila la aplicación Next.js
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar node_modules desde stage de deps
COPY --from=deps /app/node_modules ./node_modules

# Copiar el resto del código fuente
COPY . .

# Deshabilitar telemetría de Next.js
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Construir la aplicación
# NOTA: next.config.ts debe tener output: 'standalone'
RUN npm run build && \
    # Limpiar archivos innecesarios para reducir tamaño
    rm -rf .next/cache/images

# -----------------------------------------------------------------------------
# Stage 3: Runner (Producción)
# Imagen final optimizada con solo lo necesario
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Entorno de producción
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Crear usuario no-root para seguridad
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copiar archivos necesarios desde builder
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Configurar permisos
RUN chown -R nextjs:nodejs /app

# Cambiar a usuario no-root
USER nextjs

# Exponer puerto 3000
EXPOSE 3000

# Health check para EasyPanel
# Verifica que el servidor esté respondiendo
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Iniciar aplicación
# NOTA: server.js es generado por Next.js con output: 'standalone'
CMD ["node", "server.js"]
