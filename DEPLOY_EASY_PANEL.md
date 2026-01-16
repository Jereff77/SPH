# Despliegue del Procesador de Correos en Easy Panel

## Resumen
Esta guía describe cómo desplegar el sistema de procesamiento de correos electrónicos en un contenedor Docker usando Easy Panel.

## Requisitos Previos
- Easy Panel instalado y funcionando
- Acceso a Docker en el servidor
- Archivos del proyecto listos para subir

## Pasos de Despliegue

### 1. Subir Archivos al Servidor
Subir todos los archivos del proyecto al servidor:
- `src/` (directorio completo)
- `main.py`
- `config.py`
- `requirements.txt`
- `Dockerfile`
- `docker-compose.yml`
- `.dockerignore`

### 2. Configurar Variables de Entorno
En Easy Panel, configurar las siguientes variables de entorno:

**Configuración IMAP:**
- `IMAP_SERVER`: `imap.hostinger.com`
- `IMAP_PORT`: `993`
- `IMAP_USER`: Correo electrónico completo
- `IMAP_PASSWORD`: Contraseña del correo

**Configuración Supabase:**
- `SUPABASE_URL`: URL del proyecto Supabase
- `SUPABASE_KEY**: API key de Supabase

**Configuración del Procesador:**
- `POLLING_INTERVAL`: `60` (segundos entre revisiones)
- `LOG_LEVEL`: `INFO`

### 3. Desplegar con Docker Compose
Opción 1: Usar Easy Panel para crear proyecto Docker Compose
1. En Easy Panel → Projects → Create Project
2. Subir el archivo `docker-compose.yml`
3. Aplicar variables de entorno
4. Iniciar el proyecto

Opción 2: Ejecutar desde línea de comandos
```bash
# En el directorio del proyecto
docker-compose up -d --build

# Ver logs
docker-compose logs -f

# Detener
docker-compose down
```

### 4. Verificar Funcionamiento
El sistema debería:
1. Iniciar automáticamente
2. Conectarse al servidor IMAP
3. Procesar correos no leídos cada 60 segundos
4. Organizar correos en carpetas correspondientes
5. Guardar datos en Supabase

## Monitoreo y Logs

### Ver Logs en Easy Panel
- Projects → (proyecto) → Logs
- Los logs también se guardan en el volumen `email-processor-logs`

### Ver Logs desde Línea de Comandos
```bash
# Ver logs en tiempo real
docker-compose logs -f email-processor

# Ver los últimos 100 logs
docker-compose logs --tail=100 email-processor
```

## Mantenimiento

### Actualizar el Sistema
1. Subir nuevos archivos al servidor
2. Ejecutar: `docker-compose up -d --build`
3. Verificar logs para confirmar actualización

### Reiniciar el Sistema
```bash
# Reiniciar contenedor
docker-compose restart email-processor

# Reiniciar todo el proyecto
docker-compose restart
```

### Verificar Estado
```bash
# Ver estado de los contenedores
docker-compose ps

# Ver recursos utilizados
docker stats
```

## Troubleshooting

### Problemas Comunes
1. **Contenedor no inicia**
   - Verificar variables de entorno
   - Revisar logs: `docker-compose logs email-processor`

2. **Error de conexión IMAP**
   - Verificar credenciales del correo
   - Confirmar servidor IMAP y puerto

3. **Error de conexión Supabase**
   - Verificar URL y API key
   - Confirmar permisos en Supabase

4. **Problema con volúmenes**
   - Verificar que los volúmenes se crearon: `docker volume ls`
   - Limpiar volúmenes si es necesario: `docker-compose down -v`

### Recrear Contenedor desde Cero
```bash
# Detener y eliminar todo
docker-compose down -v

# Eliminar imágenes (opcional)
docker system prune -a

# Reconstruir y ejecutar
docker-compose up -d --build
```

## Configuración Adicional

### Personalizar Intervalo de Procesamiento
Cambiar la variable de entorno `POLLING_INTERVAL`:
- `30`: Procesar cada 30 segundos
- `60`: Por defecto, cada 60 segundos
- `300`: Cada 5 minutos

### Cambiar Nivel de Logs
Usar variable de entorno `LOG_LEVEL`:
- `DEBUG`: Máximo detalle
- `INFO`: Por defecto
- `WARNING`: Solo advertencias y errores
- `ERROR`: Solo errores

### Ejecutar en Modo Prueba
Para probar sin procesar correos:
```bash
docker-compose exec email-processor python main.py --test
```

### Procesar Solo una Vez
Para procesar correos pendientes y salir:
```bash
docker-compose exec email-processor python main.py --mode once
```

## Backup

### Backup de Logs
Los logs se guardan en el volumen `email-processor-logs`. Para hacer backup:
```bash
# Copiar logs del contenedor
docker cp $(docker-compose ps -q email-processor):/app/logs ./backup/logs
```

### Backup de Sesiones
Las sesiones y contexto se guardan en `email-processor-sessions`:
```bash
# Copiar sesiones del contenedor
docker cp $(docker-compose ps -q email-processor):/app/.sessions ./backup/sessions
```

## Notas Importantes
- El sistema está diseñado para funcionar continuamente
- Los correos bancarios no se marcan como leídos por diseño
- Las facturas XML sí se marcan como leídas después de procesar
- Los correos "otros" se archivan sin marcar como leídos
- El sistema es escalable para nuevos tipos de correos