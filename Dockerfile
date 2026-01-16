# Dockerfile optimizado para EasyPanel - Procesador de Correos
# Usar Python 3.11 slim para producción
FROM python:3.11-slim

# Establecer directorio de trabajo
WORKDIR /app

# Configurar variables de entorno para Python
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

# Instalar dependencias del sistema necesarias
RUN apt-get update && apt-get install -y \
    gcc \
    libxml2-dev \
    libxslt-dev \
    libffi-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copiar y instalar dependencias de Python (optimizado para caché de Docker)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copiar el código de la aplicación
COPY src/ ./src/
COPY main.py .

# Crear directorios necesarios con permisos adecuados
RUN mkdir -p logs .sessions && \
    chmod 755 logs .sessions

# Crear usuario no-root para seguridad
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app
USER appuser

# Health check para EasyPanel - Verifica que el proceso esté funcionando
# Usa el comando --status para verificar el estado del procesador
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python main.py --status || exit 1

# Comando por defecto para ejecución (modo continuo)
CMD ["python", "main.py", "--mode", "continuous"]