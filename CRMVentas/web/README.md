# CRM Ventas - SPH Bines Raíces

Sistema de Gestión de Relaciones con Clientes (CRM) para SPH Bines Raíces.

## 🌟 Características

- ✅ Gestión completa de leads y clientes
- ✅ Autorización de leads por supervisores
- ✅ Kanban interactivo para pipeline de ventas
- ✅ Dashboard con métricas en tiempo real
- ✅ Calendario de actividades y seguimientos
- ✅ Sistema de notificaciones por correo electrónico
- ✅ Autenticación con Supabase Auth
- ✅ Gestión de catálogos y configuración
- ✅ Reportes y exportación de datos

## 📊 Stack Tecnológico

- **Frontend**: Next.js 16.2.4 con App Router
- **UI**: React 19, TailwindCSS 4, shadcn/ui
- **Backend**: Supabase (Base de datos, Auth, Storage)
- **Estado**: Zustand
- **Formularios**: React Hook Form + Zod
- **Notificaciones**: Nodemailer
- **Despliegue**: Docker + EasyPanel

## 🚀 Inicio Rápido

### Requisitos Previos

- Node.js 20.x o superior
- npm o yarn
- Cuenta de Supabase

### Instalación

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/Jereff77/SPH.git
   cd "SPH/CRM Ventas/web"
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   ```bash
   cp .env.example .env.local
   ```

   Editar `.env.local` con tus credenciales de Supabase:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-clave-anon-aqui
   ```

4. **Ejecutar en modo desarrollo**
   ```bash
   npm run dev
   ```

5. **Abrir en el navegador**
   ```
   http://localhost:3000
   ```

## 🐳 Despliegue en EasyPanel

El CRM Ventas está configurado para desplegarse fácilmente en EasyPanel usando Docker Compose.

### Requisitos para EasyPanel

- EasyPanel instalado y funcionando
- Docker y Docker Compose
- Proyecto de Supabase configurado
- Credenciales de Supabase (URL y anon key)

### Pasos Rápidos

1. **Construir la imagen Docker**
   ```bash
   docker-compose build
   ```

2. **Iniciar el contenedor**
   ```bash
   docker-compose up -d
   ```

3. **Verificar el despliegue**
   ```bash
   curl http://localhost:3000/api/health
   ```

4. **Ver logs**
   ```bash
   docker-compose logs -f crm-ventas
   ```

### Documentación Completa

Para instrucciones detalladas de despliegue, troubleshooting y configuración, consulta:

📖 **[Guía de Despliegue en EasyPanel](docs/DEPLOY_EASY_PANEL.md)**

## 📖 Estructura del Proyecto

```
web/
├── app/                    # App Router de Next.js
│   ├── (auth)/            # Rutas de autenticación
│   ├── (crm)/             # Rutas principales del CRM
│   ├── api/               # API Routes
│   │   ├── auth/          # Endpoints de autenticación
│   │   ├── notifications/ # Endpoints de notificaciones
│   │   └── health/        # Health check para EasyPanel
│   ├── layout.tsx         # Layout raíz
│   └── globals.css        # Estilos globales
├── components/            # Componentes reutilizables
│   ├── ui/               # Componentes base de shadcn/ui
│   ├── auth/             # Componentes de autenticación
│   ├── dashboard/        # Componentes del dashboard
│   └── ...
├── lib/                   # Utilidades y configuraciones
│   ├── supabase/         # Cliente de Supabase
│   ├── stores/           # Zustand stores
│   ├── queries/          # Queries de Supabase
│   └── mailer.ts         # Configuración de email
├── public/               # Archivos estáticos
├── middleware.ts         # Middleware de autenticación
├── next.config.ts        # Configuración de Next.js
├── Dockerfile            # Configuración de Docker
├── docker-compose.yml    # Orquestación de contenedores
└── package.json          # Dependencias
```

## 🔧 Scripts Disponibles

```bash
# Desarrollo
npm run dev          # Iniciar servidor de desarrollo

# Producción
npm run build        # Construir para producción
npm start           # Iniciar servidor de producción

# Código
npm run lint        # Verificar código con ESLint
```

## 🔐 Seguridad

- Autenticación basada en Supabase Auth
- Middleware de protección de rutas
- Validación de permisos por módulos
- Variables de entorno sensibles
- Conexión segura con Supabase

## 📧 Notificaciones

El sistema envía notificaciones por correo cuando:
- Un lead es aprobado por un supervisor
- Un lead es rechazado con motivo
- Se asigna un lead a un asesor

Las configuraciones SMTP se gestionan dinámicamente desde la base de datos en la tabla `crm_config`.

## 🐛 Troubleshooting

### El contenedor no inicia
```bash
# Ver logs de error
docker-compose logs crm-ventas

# Reconstruir desde cero
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

### Error de conexión con Supabase
- Verificar URL y claves en las variables de entorno
- Confirmar que el proyecto de Supabase esté activo
- Revisar RLS policies en Supabase

### Las notificaciones no se envían
- Verificar configuración SMTP en Catálogos → Configuración
- Revisar logs del contenedor para errores de nodemailer
- Probar configuración SMTP desde el CRM

## 📄 Licencia

MIT License - SPH Bines Raíces

## 👥 Soporte

Para soporte técnico:
1. Consultar la [guía de despliegue](docs/DEPLOY_EASY_PANEL.md)
2. Revisar logs del contenedor
3. Verificar documentación de [Supabase](https://supabase.com/docs)
4. Contactar al equipo de desarrollo de SPH Bines Raíces

## 🔗 Recursos Adicionales

- [Documentación de Next.js](https://nextjs.org/docs)
- [Documentación de Supabase](https://supabase.com/docs)
- [Documentación de EasyPanel](https://easypanel.io/docs)
- [Documentación de Docker](https://docs.docker.com)
