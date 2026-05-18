#!/bin/sh
# Reemplaza los placeholders con las variables de entorno reales en tiempo de ejecución
find /usr/share/nginx/html/assets -name "*.js" -exec sed -i \
  -e "s|__SPH_SUPABASE_URL__|${VITE_SUPABASE_URL}|g" \
  -e "s|__SPH_ANON_KEY__|${VITE_SUPABASE_ANON_KEY}|g" \
  -e "s|__SPH_TOKEN_LIMIT__|${VITE_TOKEN_LIMIT:-1000000}|g" \
  {} \;

exec "$@"
