# Funciones y Triggers para la tabla empresasNaves

Este directorio contiene las funciones y triggers que mantienen sincronizadas las tablas `empresasNaves` y `naves` en el proyecto supaSPH-QR.

## 📁 Archivos

### 1. `empresasnaves_insertar_desde_naves.sql`
- **Tipo**: Función SQL
- **Propósito**: Insertar inicialmente todos los registros de naves con empresa asignada en la tabla `empresasNaves`
- **Uso**: `SELECT empresasnaves_insertar_desde_naves();`

### 2. `naves_asignadas_sync_trigger.sql` (ubicada en `naves/funciones y trigger/`)
- **Tipo**: Función Trigger
- **Propósito**: Mantener sincronizada la tabla `naves` cuando ocurren cambios en `empresasNaves`
- **Eventos manejados**: INSERT, UPDATE, DELETE
- **Ubicación**: `naves/funciones y trigger/` (porque modifica la tabla naves)

### 3. `trigger_naves_asignadas_sync.sql`
- **Tipo**: Trigger
- **Propósito**: Ejecutar automáticamente la función de sincronización
- **Tabla objetivo**: `empresasNaves`

## 🔄 Flujo de Sincronización

```
empresasNaves (tabla principal)
    ↓ (cambios: INSERT/UPDATE/DELETE)
trigger_naves_asignadas_sync
    ↓ (ejecuta)
naves_asignadas_sync_trigger()
    ↓ (actualiza)
naves (campos: asignado, idEmpresa, uidAsignador)
```

## 📋 Comportamiento Detallado

### INSERT en empresasNaves
- ✅ Marca la nave como asignada (`naves.asignado = true`)
- ✅ Establece la empresa (`naves.idEmpresa = NEW.idEmpresa`)
- ✅ Registra quién asignó (`naves.uidAsignador = auth.uid()`)

### UPDATE en empresasNaves
- ✅ Si cambia `idEmpresa`, actualiza el campo correspondiente en `naves`
- ✅ Actualiza quién realizó el cambio (`naves.uidAsignador = auth.uid()`)

### DELETE en empresasNaves
- ✅ Desasigna la nave (`naves.asignado = false`)
- ✅ Elimina referencia a empresa (`naves.idEmpresa = NULL`)
- ✅ Limpia referencia de asignador (`naves.uidAsignador = NULL`)

## 🚀 Instalación

Ejecutar los archivos en orden:

1. `empresasnaves_insertar_desde_naves.sql` - Crear función de inicialización
2. `../naves/funciones y trigger/naves_asignadas_sync_trigger.sql` - Crear función del trigger
3. `trigger_naves_asignadas_sync.sql` - Crear y activar el trigger

O usar el script `instalar_todo.sql` que ejecuta todo en orden automático.

## 📊 Estado Actual

- **Registros en empresasNaves**: 143
- **Naves asignadas**: 150
- **Naves con empresa**: 143
- **Trigger activo**: ✅

## 🧪 Pruebas Realizadas

1. ✅ Inserción inicial de 143 registros
2. ✅ Eliminación de registro (desasignación correcta)
3. ✅ Restauración de registro (reasignación correcta)
4. ✅ Sincronización automática en ambas direcciones

## 📝 Notas

- Todas las funciones usan `SECURITY INVOKER` por defecto
- Los nombres de columnas con mayúsculas usan comillas dobles
- El trigger se ejecuta después de los cambios (`AFTER`)
- Cada función incluye documentación completa con fecha y hora de creación