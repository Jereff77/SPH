# Funciones y Triggers para la tabla segModulos

Este directorio contiene las funciones y triggers relacionados con la tabla `segModulos` en el proyecto supaSPH-QR.

## 📁 Archivos

### Funciones

1. **`segmodulos_agregar_todos_usuarios.sql`**
   - **Tipo**: Función Trigger (SECURITY DEFINER)
   - **Propósito**: Agrega automáticamente el nuevo módulo a todos los usuarios existentes
   - **Comportamiento**: Crea registros en `segModulosUsuarios` para cada usuario activo

### Triggers

1. **`trigger_segmodulos_auto_asignar.sql`**
   - **Eventos**: INSERT en `segModulos`
   - **Timing**: AFTER
   - **Función**: `segmodulos_agregar_todos_usuarios()`

## 🔄 Flujo de Procesamiento

```
INSERT en segModulos
    ↓
trigger_segmodulos_auto_asignar (AFTER)
    ↓
segmodulos_agregar_todos_usuarios()
    ↓
INSERT masivo en segModulosUsuarios para todos los usuarios activos
```

## 🚀 Instalación

Usar el script `instalar_todo.sql` para instalar todos los componentes en orden automático.

## 📋 Comportamiento Detallado

### INSERT en segModulos
1. Se crea un nuevo módulo en `segModulos`
2. El trigger se ejecuta automáticamente AFTER INSERT
3. La función crea registros en `segModulosUsuarios` para:
   - Todos los usuarios con `status = true` en `catUsers`
   - Con el mismo `idSM` del módulo creado
   - Con la misma `clave` del módulo (para consistencia)
   - Con `acceso = false` (sin acceso por defecto)

## 🔐 Seguridad

- **segmodulos_agregar_todos_usuarios**: SECURITY DEFINER (necesita permisos elevados)
- **SET search_path TO 'public'**: Evita conflictos con otros esquemas

## 📊 Estado Actual

- **Funciones documentadas**: 1
- **Triggers activos**: 1
- **Relaciones con otras tablas**: catUsers, segModulosUsuarios
- **Impacto**: Automatización completa de asignación de permisos

## 📝 Notas

- El trigger solo se ejecuta en INSERT, no en UPDATE o DELETE
- Los usuarios nuevos que se creen después del módulo necesitarán asignación manual
- Todos los usuarios obtienen el módulo con acceso `false` por defecto
- La clave del módulo se copia para mantener consistencia en el sistema de permisos
- La función incluye validación para asegurar que se ejecuta solo desde trigger