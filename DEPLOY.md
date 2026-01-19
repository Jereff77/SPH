# Guía de Despliegue en Easypanel

Esta aplicación está contenerizada usando Docker y sirve los archivos estáticos mediante Nginx.

## Configuración del Servicio en Easypanel

1.  **Tipo de Fuente**: Git (conecta este repositorio).
2.  **Ruta de Construcción (Build Path)**: `/app-qr/SPH` (o la ruta raíz donde se encuentra el Dockerfile).
3.  **Puerto del Contenedor**: `80`.

## Variables de Entorno y Build Args

Dado que es una aplicación de React (Vite), las variables de entorno se "queman" en el código durante la fase de construcción (Build).

Debes configurar las siguientes **Build Arguments** (Argumentos de Construcción) en Easypanel:

*   `VITE_SUPABASE_URL`: Tu URL de Supabase.
*   `VITE_SUPABASE_ANON_KEY`: Tu clave anónima (public) de Supabase.

> **Nota Importante**: No basta con ponerlas solo en "Environment Variables". Deben estar en la sección de **Build Args** para que Vite las reconozca al compilar.

## Persistencia

No se requiere volumen persistente ya que es una aplicación frontend estática.
