# Funciones Generales - Proyecto supaSPH-QR

## 📋 Descripción

Esta carpeta contiene las funciones generales del sistema que no están asociadas a una tabla específica. Estas funciones proporcionan funcionalidades reutilizables en todo el proyecto.

## 📁 Estructura de la Carpeta

```
funciones generales/
├── README.md                    # Este archivo
├── cdg.sql                      # Consulta Dinámica General
└── instalar_todo.sql            # Script de instalación de todas las funciones
```

## 🔧 Componentes Actuales

### 1. CDG (Consulta Dinámica General)
- **Archivo**: `cdg.sql`
- **Propósito**: Ejecución segura de consultas SELECT encriptadas
- **Funcionalidad**: 
  - Desencripta consultas usando algoritmo XOR con clave dividida
  - Valida que solo se ejecuten consultas SELECT
  - Implementa medidas de seguridad (rate limiting, timeout, límite de registros)
  - Retorna resultados en formato JSON
- **Seguridad**: 
  - SECURITY INVOKER
  - Prevención de inyección SQL
  - Encriptación de extremo a extremo

## 🚀 Flujo de Procesamiento

```
Cliente (Frontend)
    ↓ (1. Encripta query con clave parcial)
Servidor (Función CDG)
    ↓ (2. Combina clave parcial con clave del servidor)
    ↓ (3. Desencripta query usando XOR)
    ↓ (4. Valida que sea SELECT)
    ↓ (5. Ejecuta query)
    ↓ (6. Retorna resultados en JSON)
Cliente (Frontend)
```

## 📦 Instalación

Para instalar todas las funciones generales:

```sql
-- Ejecutar el script de instalación
\i funciones generales/instalar_todo.sql
```

Para instalar una función específica:

```sql
-- Ejecutar el archivo SQL de la función
\i funciones generales/cdg.sql
```

## 🔐 Consideraciones de Seguridad

- Todas las funciones usan SECURITY INVOKER por defecto
- La función CDG implementa múltiples capas de seguridad
- Las claves de encriptación están divididas entre cliente y servidor
- Solo se permiten consultas SELECT para prevenir modificaciones no autorizadas

## 📊 Estado Actual

- **Total de funciones**: 1
- **Última actualización**: 24/10/2025 10:29:35
- **Estado**: Activo

## 🔄 Mantenimiento

### Para agregar nuevas funciones generales:
1. Crear archivo SQL con la función
2. Incluir documentación completa según estándares
3. Actualizar este README.md
4. Actualizar script `instalar_todo.sql`
5. Actualizar README.md general del proyecto

### Para modificar funciones existentes:
1. Actualizar archivo SQL de la función
2. Actualizar fecha y hora en la documentación
3. Actualizar este README.md si es necesario
4. Actualizar script de instalación si es necesario

## 📝 Notas Importantes

- Las funciones generales deben ser completamente independientes de tablas específicas
- Todas las funciones deben incluir manejo de errores apropiado
- La documentación debe mantenerse actualizada con cada cambio
- Las funciones que manejen datos sensibles deben incluir consideraciones de seguridad

---
**Última actualización**: 24/10/2025 10:29:35