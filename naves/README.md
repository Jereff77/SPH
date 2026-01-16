# Tabla naves - Documentación Completa

Este directorio contiene toda la documentación relacionada con la tabla `naves` en el proyecto supaSPH-QR.

## 📁 Estructura de Archivos

```
naves/
├── funciones y trigger/    # Funciones y triggers asociados
│   ├── README.md           # Documentación de funciones y triggers
│   ├── naves_asignadas_sync_trigger.sql
│   └── naves_buscar_disponibles.sql
└── politicas_rls.sql       # Políticas de seguridad a nivel de fila
```

## 🔐 Políticas de Seguridad (RLS)

### Política: naves_ver_parques_asignados

**Propósito**: Restringir el acceso a las naves según los parques asignados al usuario.

**Características**:
- Solo usuarios autenticados pueden ver naves
- Solo naves cuyo `idParque` esté en `catUsers.parques` del usuario
- El usuario debe estar activo (`status = true`)

**Implementación**:
```sql
CREATE POLICY "naves_ver_parques_asignados" ON naves
FOR SELECT
USING (
    auth.uid() IS NOT NULL 
    AND "idParque" IN (
        SELECT value::text 
        FROM jsonb_array_elements_text(
            (SELECT parques 
             FROM "catUsers" 
             WHERE uid = auth.uid() AND status = true)
        ) AS parques_usuario(value)
    )
);
```

## 🔄 Funciones y Triggers

### 1. naves_asignadas_sync_trigger()
- **Tipo**: Función Trigger
- **Propósito**: Mantener sincronizada la tabla `naves` cuando ocurren cambios en `empresasNaves`
- **Trigger asociado**: `trigger_naves_asignadas_sync` (en `empresasNaves/funciones y trigger/`)

### 2. naves_buscar_disponibles()
- **Tipo**: Función de consulta
- **Propósito**: Buscar naves disponibles para asignación

## 📋 Relaciones con otras tablas

### Sincronización con empresasNaves
```
empresasNaves (cambios)
    ↓
trigger_naves_asignadas_sync (en empresasNaves)
    ↓
naves_asignadas_sync_trigger() (aquí)
    ↓
naves (actualización de campos)
```

### Relación con catUsers (para RLS)
```
catUsers.parques (JSONB)
    ↓
Política RLS (naves_ver_parques_asignados)
    ↓
Filtrado de naves por parque
```

## 🚀 Instalación

1. **Políticas RLS**: Se instalan con el archivo `politicas_rls.sql`
2. **Funciones y triggers**: Se instalan con los scripts en `funciones y trigger/`

## 📊 Estado Actual

- **Políticas RLS**: 1 implementada
- **Funciones**: 2 documentadas
- **Triggers**: 1 asociado (en otra tabla)
- **Relaciones**: empresasNaves, catUsers, parques

## 📝 Notas Importantes

- La tabla `naves` tiene RLS habilitado para restringir el acceso
- Los usuarios anónimos no pueden ver ninguna nave
- Cada usuario solo ve las naves de los parques a los que tiene acceso
- La sincronización con `empresasNaves` es automática mediante triggers