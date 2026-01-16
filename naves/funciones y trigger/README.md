# Funciones y Triggers para la tabla naves

Este directorio contiene las funciones y triggers relacionados con la tabla `naves` en el proyecto supaSPH-QR.

## 📁 Archivos

### 1. `naves_asignadas_sync_trigger.sql`
- **Tipo**: Función Trigger
- **Propósito**: Mantener sincronizada la tabla `naves` cuando ocurren cambios en `empresasNaves`
- **Trigger asociado**: `trigger_naves_asignadas_sync` (ubicado en `empresasNaves/funciones y trigger/`)

## 🔄 Relación con otras tablas

Esta función se ejecuta cuando ocurren cambios en la tabla `empresasNaves` y actualiza los campos de la tabla `naves`:

```
empresasNaves (cambios)
    ↓
trigger_naves_asignadas_sync (en empresasNaves)
    ↓
naves_asignadas_sync_trigger() (aquí)
    ↓
naves (actualización de campos)
```

## 📋 Comportamiento

### INSERT en empresasNaves
- ✅ `naves.asignado = true`
- ✅ `naves.idEmpresa = NEW.idEmpresa`
- ✅ `naves.uidAsignador = auth.uid()`

### UPDATE en empresasNaves
- ✅ Si cambia `idEmpresa`: actualiza el campo
- ✅ `naves.uidAsignador = auth.uid()`

### DELETE en empresasNaves
- ✅ `naves.asignado = false`
- ✅ `naves.idEmpresa = NULL`
- ✅ `naves.uidAsignador = NULL`

## 🚀 Instalación

1. Función de sincronización: Se instala automáticamente al ejecutar el script:
   `../empresasNaves/funciones y trigger/instalar_todo.sql`
2. Función de consulta: Se instala individualmente con el archivo SQL

## 📝 Notas

- La función está ubicada aquí porque modifica la tabla `naves`
- El trigger que la llama está en la tabla `empresasNaves`
- Usa `SECURITY INVOKER` por defecto
- Incluye documentación completa con fecha y hora de creación