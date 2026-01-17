# Frontend - SPH Facturas Dashboard

Frontend web moderno para el monitoreo del sistema de procesamiento de facturas.

## Tecnologías

- **React 18+** - Framework de UI
- **TypeScript** - Tipado estático
- **Vite** - Build tool y dev server
- **Tailwind CSS** - Framework de CSS
- **Axios** - Cliente HTTP
- **Socket.IO Client** - WebSocket para tiempo real
- **React Router** - Enrutamiento

## Instalación

```bash
npm install
```

## Configuración

Crear un archivo `.env` en la raíz del proyecto:

```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=http://localhost:8000
```

## Desarrollo

```bash
npm run dev
```

El frontend estará disponible en http://localhost:5173

## Build

```bash
npm run build
npm run preview
```

## Características

### Autenticación
- Login con email/contraseña
- Token JWT almacenado en localStorage
- Protección de rutas privadas
- Roles de usuario (admin/user)

### Dashboard
- Estado del procesador (running/stopped)
- Actividad dentro de horario
- Estadísticas en tiempo real
- Uptime del sistema
- Control del procesador (solo admin)

### Configuración (Solo Admin)
- Intervalo de sondeo activo
- Intervalo de sondeo inactivo
- Horario de actividad
- Días de la semana activos

### Visor de Logs
- Logs en tiempo real vía WebSocket
- Filtrado por nivel (DEBUG, INFO, WARNING, ERROR, CRITICAL)
- Auto-scroll opcional
- Colores por nivel de log
