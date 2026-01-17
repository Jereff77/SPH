#!/bin/bash
set -e

# Script de entrada para Docker
# Inicia nginx (frontend), la API FastAPI y el procesador Python

echo "=========================================="
echo "  Iniciando Sistema Full-Stack"
echo "=========================================="

# Función para manejar señales y apagar servicios gracefulmente
cleanup() {
    echo "Deteniendo servicios..."

    # Detener el procesador Python si está corriendo
    if [ -n "$PROCESSOR_PID" ]; then
        echo "Deteniendo procesador Python (PID: $PROCESSOR_PID)..."
        kill -TERM $PROCESSOR_PID 2>/dev/null || true
        wait $PROCESSOR_PID 2>/dev/null || true
    fi

    # Detener la API FastAPI si está corriendo
    if [ -n "$API_PID" ]; then
        echo "Deteniendo API FastAPI (PID: $API_PID)..."
        kill -TERM $API_PID 2>/dev/null || true
        wait $API_PID 2>/dev/null || true
    fi

    # Detener nginx
    if [ -n "$NGINX_PID" ]; then
        echo "Deteniendo nginx (PID: $NGINX_PID)..."
        kill -TERM $NGINX_PID 2>/dev/null || true
        wait $NGINX_PID 2>/dev/null || true
    fi

    echo "Todos los servicios detenidos."
    exit 0
}

# Configurar trap para señales
trap cleanup SIGTERM SIGINT

# ============================================================================
# 1. INICIAR NGINX (Frontend)
# ============================================================================
echo ""
echo "📂 INICIANDO NGINX (Frontend React)..."
nginx -g "daemon off;" &
NGINX_PID=$!
echo "✅ Nginx iniciado (PID: $NGINX_PID) - Puerto 80"
echo "   Frontend disponible en: http://localhost:80"

# Esperar a que nginx inicie
sleep 2

# ============================================================================
# 2. INICIAR API FASTAPI
# ============================================================================
echo ""
echo "🔌 INICIANDO API FASTAPI..."
python api_server.py &
API_PID=$!
echo "✅ API FastAPI iniciada (PID: $API_PID) - Puerto 8000"
echo "   API disponible en: http://localhost:8000"
echo "   Docs Swagger: http://localhost:8000/docs"

# Esperar a que la API inicie
sleep 3

# Verificar que la API esté corriendo
if ! kill -0 $API_PID 2>/dev/null; then
    echo "❌ ERROR: La API FastAPI no pudo iniciarse correctamente"
    exit 1
fi

# ============================================================================
# 3. INICIAR PROCESADOR PYTHON (opcional según variable de entorno)
# ============================================================================
if [ "${AUTO_START_PROCESSOR:-true}" = "true" ]; then
    echo ""
    echo "📧 INICIANDO PROCESADOR PYTHON..."
    python main.py --mode continuous &
    PROCESSOR_PID=$!
    echo "✅ Procesador Python iniciado (PID: $PROCESSOR_PID)"
    echo "   Monitoreando correos automáticamente"
else
    echo ""
    echo "⏸️  PROCESADOR PYTHON CONFIGURADO PARA NO INICIAR AUTOMÁTICAMENTE"
    echo "   Para iniciarlo manualmente, use la API: POST /api/control/start"
fi

# ============================================================================
# MANTENER CONTENEDOR EJECUTÁNDOSE
# ============================================================================
echo ""
echo "=========================================="
echo "  ✅ SISTEMA INICIADO CORRECTAMENTE"
echo "=========================================="
echo ""
echo "📊 SERVICIOS EJECUTÁNDOSE:"
echo "   - Nginx (Frontend):      PID $NGINX_PID  - Puerto 80"
echo "   - API FastAPI:           PID $API_PID    - Puerto 8000"
if [ -n "$PROCESSOR_PID" ]; then
    echo "   - Procesador Python:      PID $PROCESSOR_PID"
fi
echo ""
echo "📝 LOGS:"
echo "   - API:             Ver stdout/stderr"
echo "   - Procesador:      Ver logs/ en el volumen"
echo "   - Nginx:           /var/log/nginx/"
echo ""
echo "🔗 DASHBOARD WEB:"
echo "   Acceda a: http://<host-ip>"
echo ""
echo "=========================================="
echo ""

# Esperar por cualquier proceso que termine
# Si uno muere, matamos los otros
wait -n

echo "❌ Un servicio se ha detenido inesperadamente"
cleanup
