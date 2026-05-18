#!/bin/sh
# Si EasyPanel crea archivo .env en lugar de pasar env vars reales, cargarlo
for envfile in /app/.env /.env /etc/environment; do
  if [ -f "$envfile" ]; then
    set -a
    . "$envfile"
    set +a
    break
  fi
done

for f in $(find /usr/share/nginx/html/assets -name "*.js"); do
  sed -i "s|__SPH_SUPABASE_URL__|${VITE_SUPABASE_URL}|g" "$f"
  sed -i "s|__SPH_ANON_KEY__|${VITE_SUPABASE_ANON_KEY}|g" "$f"
  sed -i "s|__SPH_TOKEN_LIMIT__|${VITE_TOKEN_LIMIT:-1000000}|g" "$f"
done
exec "$@"