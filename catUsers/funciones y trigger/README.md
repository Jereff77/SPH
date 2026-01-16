# Funciones y Triggers - catUsers

## Descripción

Esta carpeta contiene las funciones y triggers asociados a la tabla `catUsers` para el manejo automático de permisos de usuarios.

## Componentes Actuales

### 1. Sistema de Desactivación Automática de Permisos

#### Función: `catusers_desactivar_permisos_al_cambiar_status()`
- **Archivo**: [`catusers_desactivar_permisos_al_cambiar_status.sql`](catusers_desactivar_permisos_al_cambiar_status.sql:1)
- **Propósito**: Desactiva automáticamente todos los permisos de un usuario en `segModulosUsuarios` cuando su status cambia a false
- **Tipo**: SECURITY DEFINER
- **Parámetros**: Se ejecuta mediante trigger, no requiere parámetros directos

#### Trigger: `trigger_catusers_desactivar_permisos`
- **Archivo**: [`trigger_catusers_desactivar_permisos.sql`](trigger_catusers_desactivar_permisos.sql:1)
- **Evento**: UPDATE sobre el campo `status` de `catUsers`
- **Timing**: BEFORE
- **Propósito**: Disparar la función de desactivación cuando el status cambia de true a false

## Flujo de Procesamiento

```
Usuario actualiza status a false en catUsers
           ↓
    Trigger se dispara (BEFORE UPDATE)
           ↓
    Función verifica cambio (true → false)
           ↓
    Actualiza permisos en segModulosUsuarios
           ↓
    Todos los permisos del usuario quedan inactivos
```

## Instalación

### Instalación Completa
Ejecutar el script de instalación para todos los componentes:

```sql
\i instalar_desactivacion_permisos.sql
```

### Instalación Individual
1. Instalar la función:
```sql
\i catusers_desactivar_permisos_al_cambiar_status.sql
```

2. Instalar el trigger:
```sql
\i trigger_catusers_desactivar_permisos.sql
```

## Pruebas

### Script de Pruebas
- **Archivo**: [`test_desactivacion_permisos.sql`](test_desactivacion_permisos.sql:1)
- **Propósito**: Verificar el funcionamiento correcto del sistema
- **Nota**: Usa transacciones con ROLLBACK para no afectar datos reales

### Ejecución de Pruebas
```sql
\i test_desactivacion_permisos.sql
```

## Comportamiento Detallado

### ¿Cuándo se activa el sistema?
El sistema se activa únicamente cuando:
- El campo `status` de `catUsers` cambia de `true` a `false`
- No se activa si el status ya era `false`
- No se activa si el status cambia de `false` a `true`

### ¿Qué permisos se afectan?
- Todos los registros en `segModulosUsuarios` del usuario afectado
- El campo `acceso` se establece en `false`
- Se mantienen los demás campos (módulo, sección, área, clave)

### Manejo de Errores
- La función incluye manejo de excepciones
- En caso de error, se registra un NOTICE y la transacción continúa
- El trigger no bloquea la actualización del usuario

## Consideraciones de Seguridad

### Permisos Requeridos
- La función utiliza `SECURITY DEFINER` para poder modificar `segModulosUsuarios`
- El usuario que ejecuta el trigger debe tener permisos de UPDATE en `catUsers`

### Auditoría
- Se recomienda implementar una tabla de logs para registrar las desactivaciones
- El código incluye comentarios con ejemplos de cómo implementar logging

## Mantenimiento

### Verificación de Instalación
```sql
-- Verificar que la función existe
SELECT proname FROM pg_proc WHERE proname = 'catusers_desactivar_permisos_al_cambiar_status';

-- Verificar que el trigger existe
SELECT tgname FROM pg_trigger WHERE tgname = 'trigger_catusers_desactivar_permisos';
```

### Desinstalación
```sql
-- Eliminar el trigger
DROP TRIGGER IF EXISTS trigger_catusers_desactivar_permisos ON public."catUsers";

-- Eliminar la función
DROP FUNCTION IF EXISTS public.catusers_desactivar_permisos_al_cambiar_status();
```

## Problemas Resueltos

### Problema Original
- Usuarios con `status = false` mantenían permisos activos en `segModulosUsuarios`
- Riesgo de seguridad por acceso no autorizado
- Necesidad de gestión manual de permisos

### Solución Implementada
- Desactivación automática de permisos al cambiar status a false
- Proceso transparente para el usuario
- Reducción del riesgo de seguridad

## Registro de Cambios

### 16/11/2025 - Versión 1.0
- Creación del sistema de desactivación automática de permisos
- Implementación de función y trigger asociados
- Creación de scripts de instalación y pruebas
- Documentación completa del sistema

## Estado Actual

- **Componentes instalados**: 2 (1 función, 1 trigger)
- **Estado**: Activo y funcional
- **Pruebas**: Incluidas y verificadas
- **Documentación**: Completa y actualizada

## Notas Importantes

1. **Producción**: Antes de instalar en producción, ejecutar pruebas en entorno de desarrollo
2. **Backup**: Se recomienda realizar backup de las tablas afectadas antes de la instalación
3. **Monitoreo**: Monitorear el funcionamiento después de la instalación para detectar anomalías
4. **Logs**: Considerar implementar sistema de logs para auditoría de cambios

## Contacto

Para dudas o sugerencias sobre este sistema, contactar al equipo de desarrollo de base de datos.