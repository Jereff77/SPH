#!/bin/bash

# Script de despliegue del Procesador de Correos SPH

set -e

echo "🚀 Iniciando despliegue del Procesador de Correos SPH..."

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Funciones
info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar que Docker esté instalado
if ! command -v docker &> /dev/null; then
    error "Docker no está instalado. Por favor instala Docker primero."
    exit 1
fi

# Verificar que docker-compose esté instalado
if ! command -v docker-compose &> /dev/null; then
    error "Docker Compose no está instalado. Por favor instala Docker Compose primero."
    exit 1
fi

# Verificar variables de entorno requeridas
required_vars=("IMAP_USER" "IMAP_PASSWORD" "SUPABASE_URL" "SUPABASE_KEY")
missing_vars=()

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    error "Faltan las siguientes variables de entorno:"
    printf '  %s\n' "${missing_vars[@]}"
    warning "Puedes configurarlas en un archivo .env o exportarlas:"
    echo "export IMAP_USER='tu_correo@dominio.com'"
    echo "export IMAP_PASSWORD='tu_contraseña'"
    echo "export SUPABASE_URL='https://tu-proyecto.supabase.co'"
    echo "export SUPABASE_KEY='tu_api_key'"
    exit 1
fi

# Información del despliegue
info "Iniciando construcción del contenedor..."
docker-compose build --no-cache

info "Deteniendo contenedores existentes..."
docker-compose down

info "Iniciando servicio..."
docker-compose up -d

# Esperar a que el contenedor inicie
info "Esperando a que el servicio inicie..."
sleep 10

# Verificar estado
if docker-compose ps | grep -q "Up"; then
    info "✅ Contenedor iniciado correctamente"
else
    error "❌ El contenedor no pudo iniciar"
    docker-compose logs
    exit 1
fi

# Mostrar estado final
echo ""
info "📊 Estado del despliegue:"
docker-compose ps

echo ""
info "📝 Logs recientes:"
docker-compose logs --tail=20

echo ""
info "🎉 Despliegue completado!"
echo ""
echo "Comandos útiles:"
echo "  Ver logs en tiempo real: docker-compose logs -f"
echo "  Ver estado: docker-compose ps"
echo "  Reiniciar: docker-compose restart"
echo "  Detener: docker-compose down"
echo "  Probar conexión: docker-compose exec email-processor python main.py --test"
echo ""
warning "Nota: El sistema procesará correos cada 60 segundos (configurable con POLLING_INTERVAL)"