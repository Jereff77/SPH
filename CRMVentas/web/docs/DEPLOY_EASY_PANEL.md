# Guía de Despliegue - CRM Ventas en EasyPanel

## Resumen

Esta guía describe paso a paso cómo desplegar el CRM Ventas de SPH Bines Raíces en un contenedor Docker usando EasyPanel con Docker Compose.

**Tiempo estimado**: 60-90 minutos

**Nivel de dificultad**: Intermedio

## Requisitos Previos

### Servidor
- ✅ EasyPanel instalado y funcionando en el servidor
- ✅ Docker y Docker Compose instalados
- ✅ Mínimo 2GB RAM y 2 CPU disponibles
- ✅ Acceso SSH o interfaz web de EasyPanel

### Credenciales
- ✅ URL del proyecto Supabase
- ✅ Clave anónima (anon key) de Supabase

### Archivos del Proyecto
- ✅ Dockerfile
- ✅ docker-compose.yml
- ✅ .dockerignore
- ✅ Código fuente de Next.js (web/)

---

## Arquitectura del Despliegue

### Componentes

```
┌─────────────────────────────────────────────────────────────┐
│                     EasyPanel Server                         │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Docker Container: sph-crm-ventas                    │   │
│  │  - Next.js 16.2.4 (Frontend)                         │   │
│  │  - Nodemailer (Notificaciones)                       │   │
│  │  - Puerto: 3000                                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↑↓                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Volúmenes:                                          │   │
│  │  - crm-ventas-cache (Next.js cache)                  │   │
│  │  - crm-ventas-logs (Logs de aplicación)              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                           ↑↓ (Internet)
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Cloud                           │
│  - PostgreSQL (Base de datos)                              │
│  - Supabase Auth (Autenticación)                           │
│  - Supabase Storage (Archivos)                             │
└─────────────────────────────────────────────────────────────┘
```

### Ventajas

- ✅ **Sin contenedor de base de datos**: Menor mantenimiento
- ✅ **Escalabilidad automática**: Supabase escala automáticamente
- ✅ **Backups automáticos**: Incluidos en Supabase
- ✅ **Actualizaciones sin reinicio**: Cambios en schema no requieren reiniciar contenedor

---

## Paso 1: Obtener Credenciales de Supabase

### 1.1 Acceder a Supabase Dashboard

1. Ir a https://supabase.com/dashboard
2. Iniciar sesión
3. Seleccionar el proyecto: `szjlkvakwljssdnysazp`

### 1.2 Copiar URL y Clave Anónima

1. Navegar a: **Settings → API**
2. Copiar los siguientes valores:

   ```
   Project URL: https://szjlkvakwljssdnysazp.supabase.co
   anon/public key: eyJhbGci... (copiar toda la clave)
   ```

3. Guardar estas credenciales temporalmente (se usarán en el Paso 4)

---

## Paso 2: Preparar Archivos del Proyecto

### 2.1 Verificar Estructura de Archivos

Asegúrate de tener los siguientes archivos en el proyecto:

```
web/
├── Dockerfile                  ✅ Requerido
├── docker-compose.yml          ✅ Requerido
├── .dockerignore              ✅ Requerido
├── easypanel.json             ✅ Opcional (metadatos)
├── .env.example               ✅ Plantilla de variables
├── next.config.ts             ✅ Modificado (output: 'standalone')
├── package.json               ✅ Dependencias
├── package-lock.json          ✅ Lock file
├── app/                       ✅ Código Next.js
│   ├── api/
│   │   └── health/           ✅ Health check endpoint
│   ├── (auth)/
│   ├── (crm)/
│   └── layout.tsx
├── components/                ✅ Componentes React
├── lib/                       ✅ Utilidades y Supabase client
└── public/                    ✅ Archivos estáticos
```

### 2.2 Comprimir Archivos (Opcional)

Si vas a subir por SFTP/SSH:

```bash
# En tu máquina local
cd "D:/Clientes/SPH Bines Raices/codigo/repoSPH/CRM Ventas"
tar -czf crm-ventas.tar.gz web/
```

---

## Paso 3: Crear Proyecto en EasyPanel

### 3.1 Acceder a EasyPanel

1. Abrir navegador e ir a: `http://tu-servidor:3000`
2. Iniciar sesión con credenciales de EasyPanel

### 3.2 Crear Nuevo Proyecto

1. Click en **"Projects"**
2. Click en **"Create Project"**
3. Seleccionar **"Docker Compose"**
4. Nombrar el proyecto: `crm-ventas-sph`
5. Click en **"Create"**

---

## Paso 4: Subir Archivos al Servidor

### Opción A: Vía Interfaz Web de EasyPanel

1. En el proyecto recién creado, click en **"Files"**
2. Arrastrar o seleccionar los archivos:
   - `Dockerfile`
   - `docker-compose.yml`
   - `.dockerignore`
   - `package.json`
   - `package-lock.json`
   - Toda la carpeta `app/`, `components/`, `lib/`, `public/`

### Opción B: Vía SFTP/SSH (Recomendado para proyectos grandes)

```bash
# En tu máquina local
sftp usuario@tu-servidor

# Navegar al directorio del proyecto
cd /ruta/easypanel/projects/crm-ventas-sph

# Subir archivos
put -r web/
put docker-compose.yml
put Dockerfile
put .dockerignore

# Salir
exit
```

### Opción C: Vía Git Clone (Si el código está en GitHub)

```bash
# SSH al servidor
ssh usuario@tu-servidor

# Navegar al directorio de proyectos
cd /ruta/easypanel/projects/crm-ventas-sph

# Clonar el mono-repo (ajustar ruta según tu estructura)
git clone https://github.com/Jereff77/SPH.git temp
cp -r temp/CRM\ Ventas/web/* .
rm -rf temp
```

---

## Paso 5: Configurar Variables de Entorno

### 5.1 En EasyPanel (Interfaz Web)

1. En el proyecto, click en **"Environment"**
2. Agregar las siguientes variables:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://szjlkvakwljssdnysazp.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci... (pegar tu clave completa)
   NODE_ENV=production
   ```

3. Click en **"Save"**

### 5.2 Vía Archivo .env (Alternativa)

Crear archivo `.env` en el directorio del proyecto:

```bash
# SSH al servidor
cd /ruta/easypanel/projects/crm-ventas-sph

# Crear archivo .env
cat > .env << EOF
NEXT_PUBLIC_SUPABASE_URL=https://szjlkvakwljssdnysazp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci... (tu clave completa)
NODE_ENV=production
EOF
```

---

## Paso 6: Construir y Desplegar

### 6.1 Construir la Imagen Docker

**Vía EasyPanel UI:**
1. Click en **"Build & Deploy"**
2. Esperar a que termine la construcción
3. El proceso puede tomar 5-10 minutos

**Vía Línea de Comandos:**
```bash
# SSH al servidor
cd /ruta/easypanel/projects/crm-ventas-sph

# Construir imagen
docker-compose build

# Ver progreso de construcción
docker-compose build --progress=plain
```

### 6.2 Iniciar el Contenedor

**Vía EasyPanel UI:**
1. Click en **"Start"** o **"Up"**
2. El contenedor comenzará a ejecutarse

**Vía Línea de Comandos:**
```bash
# Iniciar contenedor
docker-compose up -d

# Ver logs en tiempo real
docker-compose logs -f crm-ventas
```

### 6.3 Verificar Estado del Contenedor

```bash
# Ver estado
docker-compose ps

# Salida esperada:
# NAME              STATUS          PORTS
# sph-crm-ventas    Up (healthy)    0.0.0.0:3000->3000/tcp
```

---

## Paso 7: Verificar el Despliegue

### 7.1 Health Check

```bash
# Probar health check endpoint
curl http://localhost:3000/api/health
```

**Respuesta esperada:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "service": "crm-ventas",
  "version": "1.0.0",
  "supabase": {
    "configured": true,
    "url": "https://***.supabase.co"
  }
}
```

### 7.2 Verificar Logs

```bash
# Ver logs recientes
docker-compose logs --tail=50 crm-ventas

# Ver logs en tiempo real
docker-compose logs -f crm-ventas

# Buscar errores
docker-compose logs crm-ventas | grep -i error
```

### 7.3 Probar Funcionalidad

1. **Acceder al CRM:**
   - Abrir navegador: `http://localhost:3000` (desde el servidor)
   - O `http://tu-servidor:3000` (desde tu máquina local)

2. **Probar Login:**
   - Intentar iniciar sesión con Supabase Auth
   - Verificar que no haya errores de conexión

3. **Probar Funcionalidades:**
   - Crear un lead nuevo
   - Aprobar/rechazar un lead
   - Verificar que las notificaciones se envíen

---

## Paso 8: Configurar Dominio (Opcional)

Si tienes un dominio configurado (ej: `crm.sph-binesraices.com`):

### 8.1 Configurar DNS

En tu proveedor de DNS:

```
Tipo: A
Nombre: crm
Valor: IP-del-servidor-EasyPanel
TTL: 3600
```

### 8.2 Configurar Dominio en EasyPanel

1. En el proyecto, click en **"Domains"**
2. Agregar dominio: `crm.sph-binesraices.com`
3. Habilitar SSL (Let's Encrypt)
4. Guardar cambios

### 8.3 Verificar DNS

```bash
# Verificar propagación DNS
dig crm.sph-binesraices.com
nslookup crm.sph-binesraices.com
```

---

## Paso 9: Configurar Notificaciones SMTP

Las notificaciones por correo usan Nodemailer. La configuración se guarda en la base de datos de Supabase.

### 9.1 Configurar SMTP en Supabase

1. Acceder a Supabase Dashboard
2. Table Editor → Buscar tabla `crm_config` (o crearla si no existe)
3. Insertar configuración SMTP:

```sql
INSERT INTO crm_config (id, valor)
VALUES (
  'smtp_notif',
  '{
    "host": "smtp.gmail.com",
    "port": 587,
    "secure": false,
    "auth": {
      "user": "noreply@sph-binesraices.com",
      "pass": "tu_contraseña_aplicación"
    },
    "from": "CRM SPH <noreply@sph-binesraices.com>"
  }'::jsonb
);
```

### 9.2 Probar Notificaciones

1. En el CRM, ir a **Catálogos → Configuración**
2. Buscar configuración de SMTP
3. Click en **"Probar SMTP"**
4. Verificar que llegue el correo de prueba

---

## Monitoreo y Mantenimiento

### Ver Logs en Tiempo Real

```bash
# Logs del contenedor
docker-compose logs -f crm-ventas

# Últimos 100 logs
docker-compose logs --tail=100 crm-ventas

# Solo errores
docker-compose logs crm-ventas | grep -i error
```

### Monitorear Recursos

```bash
# Uso de recursos del contenedor
docker stats sph-crm-ventas

# Espacio en disco
df -h

# Uso de memoria
free -h
```

### Backups

Los datos del CRM se almacenan en Supabase, no en el contenedor. Para backups:

**Backup Automático (Supabase):**
1. Supabase Dashboard → Database → Backups
2. Configurar backups automáticos diarios

**Backup de Configuraciones:**
```bash
# Exportar variables de entorno
docker-compose config | grep environment

# Backup de volúmenes (cache y logs)
docker run --rm -v crm-ventas-cache:/data -v $(pwd):/backup alpine tar czf /backup/crm-cache-backup.tar.gz -C /data .
docker run --rm -v crm-ventas-logs:/data -v $(pwd):/backup alpine tar czf /backup/crm-logs-backup.tar.gz -C /data .
```

---

## Troubleshooting

### Problema: Contenedor no inicia

**Síntomas:** `docker-compose ps` muestra "Exit"

**Solución:**
```bash
# 1. Ver logs de error
docker-compose logs crm-ventas

# 2. Verificar variables de entorno
docker-compose config

# 3. Reconstruir desde cero
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

### Problema: Error de Conexión Supabase

**Síntomas:** Error 500 en API routes, auth no funciona

**Solución:**
1. Verificar variables de entorno en EasyPanel
2. Confirmar que el proyecto Supabase esté activo
3. Verificar que la URL y clave sean correctas
4. Revisar RLS policies en Supabase

```bash
# Verificar variables de entorno
docker-compose exec crm-ventas env | grep SUPABASE
```

### Problema: Build Falla

**Síntomas:** Error durante `docker-compose build`

**Solución:**
```bash
# 1. Limpiar cache de Docker
docker system prune -a

# 2. Reconstruir sin cache
docker-compose build --no-cache

# 3. Verificar que next.config.ts tenga output: 'standalone'
cat web/next.config.ts
```

### Problema: Health Check Falla

**Síntomas:** Contenedor marcado como "unhealthy"

**Solución:**
```bash
# 1. Probar health check manualmente
curl http://localhost:3000/api/health

# 2. Verificar que el endpoint exista
ls -la web/app/api/health/

# 3. Aumentar start_period en docker-compose.yml si el inicio es lento
```

### Problema: Notificaciones no Llegan

**Síntomas:** No se envían correos de aprobación/rechazo

**Solución:**
1. Verificar configuración SMTP en Supabase tabla `crm_config`
2. Revisar logs del contenedor buscando errores de nodemailer
3. Probar configuración SMTP desde el CRM
4. Verificar que el puerto SMTP no esté bloqueado en el firewall

```bash
# Buscar errores de email en logs
docker-compose logs crm-ventas | grep -i "mail\|smtp\|nodemailer"
```

### Recrear Contenedor desde Cero

Si nada funciona:
```bash
# 1. Detener y eliminar todo
docker-compose down -v

# 2. Eliminar imágenes (opcional)
docker rmi $(docker images | grep crm-ventas)

# 3. Reconstruir
docker-compose build --no-cache
docker-compose up -d

# 4. Monitorear
docker-compose logs -f crm-ventas
```

---

## Actualización del Sistema

### Proceso de Actualización

```bash
# 1. Hacer backup (opcional, los datos están en Supabase)
docker-compose down

# 2. Actualizar código
git pull origin main
cd web
npm install
npm run build

# 3. Reconstruir contenedor
docker-compose build
docker-compose up -d

# 4. Verificar actualización
docker-compose logs -f crm-ventas
curl http://localhost:3000/api/health
```

### Rollback si Falla

```bash
# 1. Restaurar versión anterior
git checkout commit_hash_anterior
docker-compose build
docker-compose up -d

# 2. Verificar
docker-compose logs -f crm-ventas
```

---

## Seguridad

### Buenas Prácticas

1. **Variables de Entorno:** Nunca hacer commit de archivos `.env`
2. **SSL/TLS:** Siempre habilitar certificados SSL en producción
3. **Actualizaciones:** Mantener Next.js y dependencias actualizadas
4. **Backups:** Configurar backups automáticos en Supabase
5. **Monitoreo:** Revisar logs regularmente

### Firewalls

Asegurar que solo los puertos necesarios estén expuestos:

```bash
# Solo permitir puerto 80 y 443 desde fuera
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 3000/tcp  # No exponer directamente en producción
```

### RLS en Supabase

Verificar que todas las tablas tengan Row Level Security:

```sql
-- Verificar RLS
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- Habilitar RLS si está deshabilitado
ALTER TABLE nombre_tabla ENABLE ROW LEVEL SECURITY;
```

---

## Comandos Útiles

### Desarrollo Local
```bash
cd web
npm install              # Instalar dependencias
npm run dev             # Modo desarrollo
npm run build           # Build de producción
npm start               # Iniciar producción
```

### Docker Local
```bash
cd web
docker-compose build           # Construir imagen
docker-compose up -d           # Iniciar contenedor
docker-compose logs -f         # Ver logs
docker-compose ps              # Ver estado
docker-compose restart         # Reiniciar
docker-compose down            # Detener
docker-compose down -v         # Detener y eliminar volúmenes
```

### Servidor EasyPanel
```bash
# Via SSH en el servidor
cd /ruta/al/proyecto
docker-compose up -d --build    # Construir y desplegar
docker-compose logs -f crm-ventas  # Ver logs
docker ps -a | grep crm        # Ver estado
docker exec -it sph-crm-ventas sh # Acceder al contenedor
```

---

## Recursos Adicionales

### Documentación
- [Documentación de Next.js](https://nextjs.org/docs)
- [Documentación de Supabase](https://supabase.com/docs)
- [Documentación de Docker](https://docs.docker.com)
- [Documentación de EasyPanel](https://easypanel.io/docs)

### Soporte
Para soporte técnico:
1. Revisar logs del contenedor
2. Consultar documentación de Supabase
3. Verificar issues en GitHub del proyecto
4. Contactar al equipo de desarrollo de SPH

---

## Checklist Final de Verificación

Antes de considerar el despliegue completo, verifica:

**Infraestructura:**
- [ ] Contenedor Docker en ejecución (`docker ps`)
- [ ] Health check respondiendo (`curl http://localhost:3000/api/health`)
- [ ] Logs sin errores críticos
- [ ] Recursos dentro de límites (CPU < 50%, RAM < 1GB)
- [ ] Volúmenes creados correctamente

**Funcionalidad:**
- [ ] Login funciona con Supabase Auth
- [ ] Dashboard carga métricas correctamente
- [ ] Kanban de leads funciona
- [ ] Creación de leads funciona
- [ ] Aprobación/rechazo de leads funciona
- [ ] Notificaciones por email se envían
- [ ] Catálogos se cargan correctamente

**Supabase:**
- [ ] Conexión a base de datos funciona
- [ ] Queries se ejecutan sin errores
- [ ] RLS policies funcionan correctamente
- [ ] Auth callback funciona

**Rendimiento:**
- [ ] Tiempo de carga < 3 segundos
- [ ] Health check responde < 500ms
- [ ] Sin memory leaks
- [ ] CPU uso estable < 50%

¡Felicidades! Si has completado todos los pasos, el CRM Ventas está desplegado y funcionando en EasyPanel. 🎉
