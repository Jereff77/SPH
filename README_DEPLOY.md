# Guía de Despliegue - Sistema Full-Stack

## Despliegue con Docker Compose

### Opción 1: Solo API FastAPI (sin frontend incluido)

```bash
# 1. Construir imagen
docker build -t sph-facturas-api .

# 2. Ejecutar con docker-compose
docker-compose up -d

# 3. El frontend debe ejecutarse por separado:
cd frontend
npm install
npm run dev
```

### Opción 2: Sistema Completo (Recomendado para EasyPanel)

Esta opción incluye:
- Frontend React servido por nginx
- API FastAPI en puerto 8000
- Procesador Python corriendo en background

#### Build y Despliegue

```bash
# 1. Construir imagen full-stack
docker build -f Dockerfile.fullstack -t sph-facturas-fullstack .

# 2. Ejecutar con docker-compose fullstack
docker-compose -f docker-compose.fullstack.yml up -d

# 3. Acceder al dashboard
# Abrir navegador en: http://localhost:8080
```

## Configuración en EasyPanel

### 1. Crear Nuevo Proyecto

1. En EasyPanel, crear un nuevo proyecto "Docker Compose"
2. Pegar el contenido de `docker-compose.fullstack.yml`
3. Configurar las variables de entorno en la sección de configuración

### 2. Variables de Entorno Requeridas

```
IMAP_SERVER=imap.hostinger.com
IMAP_PORT=993
IMAP_USER=agente@portal.gruposph.mx
IMAP_PASSWORD=tu_contraseña

SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_KEY=tu_clave_service_role
TABLE_NAME=catFacturas

API_PORT=8000
POLLING_INTERVAL=60
POLLING_INTERVAL_IDLE=600
LOG_LEVEL=INFO

SCHEDULE_ENABLED=true
SCHEDULE_START_TIME=06:00
SCHEDULE_END_TIME=23:00
SCHEDULE_DAYS=1,2,3,4,5,7
SCHEDULE_TIMEZONE=America/Mexico_City

AUTO_START_PROCESSOR=true
```

### 3. Configuración de Dominio (Opcional)

Si tienes un dominio configurado, actualiza los labels en `docker-compose.fullstack.yml`:

```yaml
labels:
  - "traefik.http.routers.sph-facturas.rule=Host(`tudominio.com`)"
  - "traefik.http.routers.sph-facturas.entrypoints=websecure"
  - "traefik.http.routers.sph-facturas.tls.certresolver=letsencrypt"
```

### 4. Configuración de Puertos

- **8080**: Puerto del dashboard web (nginx)
- **8000**: Puerto de la API FastAPI (acceso directo)

## Configuración de Usuarios en Supabase

El sistema usa la autenticación de Supabase. Para crear un usuario admin:

### 1. Crear Usuario via Supabase Dashboard

1. Ir a Authentication > Users
2. Click en "Add user" > "Create new user"
3. Email: `admin@tu-dominio.com`
4. Password: (segura)
5. Auto Confirm User: ✓
6. Click en "Create user"

### 2. Asignar Rol de Admin

1. Ir a Authentication > Users
2. Seleccionar el usuario creado
3. En "User Metadata", agregar:
   ```json
   {
     "role": "admin"
   }
   ```
4. Guardar cambios

### 3. Probar Login

1. Acceder al dashboard: `http://tu-servidor:8080`
2. Login con el email y password creados
3. Verificar que tienes acceso a todas las funcionalidades admin

## Verificación del Despliegue

### 1. Verificar Servicios

```bash
# Ver contenedores corriendo
docker ps

# Ver logs del contenedor
docker logs -f sph-facturas-fullstack

# Ver salud del contenedor
docker inspect sph-facturas-fullstack | grep -A 10 Health
```

### 2. Verificar Endpoints

```bash
# Health check
curl http://localhost:8080/health

# API status
curl http://localhost:8000/api/status

# Frontend
curl http://localhost:8080
```

### 3. Ver Logs

```bash
# Logs del contenedor
docker logs -f sph-facturas-fullstack

# Logs de la aplicación
docker exec sph-facturas-fullstack tail -f /app/logs/facturas_*.log
```

## Solución de Problemas

### El contenedor no inicia

```bash
# Ver logs para identificar el problema
docker logs sph-facturas-fullstack

# Verificar que todas las variables de entorno están configuradas
docker inspect sph-facturas-fullstack | grep -A 50 Env
```

### El frontend no carga

1. Verificar que nginx esté corriendo:
```bash
docker exec sph-facturas-fullstack ps aux | grep nginx
```

2. Verificar logs de nginx:
```bash
docker exec sph-facturas-fullstack cat /var/log/nginx/error.log
```

### La API no responde

1. Verificar que la API esté corriendo:
```bash
docker exec sph-facturas-fullstack ps aux | grep python
```

2. Verificar puerto 8000:
```bash
docker exec sph-facturas-fullstack netstat -tlnp | grep 8000
```

### Error de autenticación

1. Verificar que el usuario esté creado en Supabase
2. Verificar que tenga el rol `admin` en user_metadata
3. Verificar que SUPABASE_URL y SUPABASE_KEY sean correctas

## Actualización del Sistema

### Actualizar Código

```bash
# 1. Detener contenedor
docker-compose -f docker-compose.fullstack.yml down

# 2. Reconstruir imagen
docker build -f Dockerfile.fullstack -t sph-facturas-fullstack .

# 3. Iniciar nuevamente
docker-compose -f docker-compose.fullstack.yml up -d
```

### Actualizar Solo Frontend

```bash
# 1. Reconstruir frontend local
cd frontend
npm run build

# 2. Copiar al contenedor
docker cp dist/. sph-facturas-fullstack:/var/www/html/

# 3. Reiniciar nginx
docker exec sph-facturas-fullstack nginx -s reload
```

## Backups

### Backup de Logs

```bash
# Copiar logs del contenedor
docker cp sph-facturas-fullstack:/app/logs ./backup-logs-$(date +%Y%m%d)
```

### Backup de Volumenes

```bash
# Backup de volumen de logs
docker run --rm -v sph-logs:/data -v $(pwd):/backup alpine tar czf /backup/sph-logs-backup.tar.gz /data
```

## Monitoreo

### Métricas Disponibles

El sistema expone las siguientes métricas vía API:

- Estado del procesador (running/stopped)
- Estadísticas de procesamiento
- Logs en tiempo real
- Configuración actual

### Integración con Prometeus (Opcional)

Para integrar con Prometheus, puedes usar las métricas de health check:

```yaml
# Agregar a docker-compose.yml
labels:
  - "prometheus.io/scrape=true"
  - "prometheus.io/path=/health"
  - "prometheus.io/port=8000"
```

## Seguridad

### Recomendaciones

1. **Usar HTTPS**: Configurar certificados SSL en Traefik
2. **Firewall**: Limitar acceso a puertos necesarios
3. **Actualizar Regularmente**: Mantener imágenes actualizadas
4. **Backups**: Automatizar backups de logs y configuración
5. **Monitoreo**: Configurar alertas para contenedores unhealthy

### Variables Sensibles

Nunca incluir contraseñas en:
- Dockerfile
- docker-compose.yml
- Repositorios Git

Usar siempre variables de entorno de EasyPanel.
