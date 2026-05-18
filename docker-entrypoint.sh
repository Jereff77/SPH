#!/bin/sh
echo "[entrypoint] Iniciando..."

# Buscar archivo .env en ubicaciones comunes de EasyPanel
echo "[entrypoint] Buscando archivos .env..."
find / -maxdepth 4 -name ".env" 2>/dev/null | while read f; do
  echo "[entrypoint] Encontrado: $f"
done

# Cargar .env si existe
for envfile in /app/.env /.env /run/secrets/.env /etc/environment /usr/share/nginx/html/.env; do
  if [ -f "$envfile" ]; then
    echo "[entrypoint] Cargando: $envfile"
    set -a
    . "$envfile"
    set +a
    break
  fi
done

# Debug: mostrar valores (sin exponer la key completa)
echo "[entrypoint] VITE_SUPABASE_URL=${VITE_SUPABASE_URL}"
echo "[entrypoint] VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY:0:20}..."
echo "[entrypoint] VITE_TOKEN_LIMIT=${VITE_TOKEN_LIMIT}"

# Reemplazar placeholders
for f in $(find /usr/share/nginx/html/assets -name "*.js"); do
  sed -i "s|__SPH_SUPABASE_URL__|${VITE_SUPABASE_URL}|g" "$f"
  sed -i "s|__SPH_ANON_KEY__|${VITE_SUPABASE_ANON_KEY}|g" "$f"
  sed -i "s|__SPH_TOKEN_LIMIT__|${VITE_TOKEN_LIMIT:-1000000}|g" "$f"
done

echo "[entrypoint] Reemplazo completado. Iniciando nginx..."
exec "$@"