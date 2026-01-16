# catAsesoresInm - Catálogo de Asesores Inmobiliarios

## Overview
Tabla que almacena el catálogo de asesores inmobiliarios del sistema supaSPH-QR, incluyendo su información de contacto y relación con las inmobiliarias.

## Estructura de la Tabla

| Campo | Tipo | Nullable | Descripción |
|-------|------|----------|-------------|
| id | uuid | NO | Identificador único del asesor |
| fc | timestamp without time zone | NO | Fecha y hora de creación |
| status | boolean | NO | Estado del registro (activo/inactivo) |
| uidr | uuid | YES | Usuario que registró el asesor |
| idInmobiliaria | uuid | YES | Relación con la inmobiliaria |
| nombre | text | NO | Nombre del asesor |
| telefono | text | NO | Teléfono del asesor (único) |
| a | text | NO | Iniciales del asesor (único) |
| correo | text | YES | Correo electrónico del asesor |

## Relaciones con Otras Tablas

- **catUsers**: Relación a través del campo `uidr` (usuario que registró)
- **catInmobiliarias**: Relación a través del campo `idInmobiliaria`
- **leads**: Relación a través del campo `idAsesorInm`

## Componentes Asociados

### Funciones y Triggers
Ubicación: `catAsesoresInm/funciones y trigger/`

1. **catasoresinm_validar_telefono**
   - Valida si un teléfono ya existe en la tabla
   - Retorna el nombre del usuario que lo registró
   - Útil para evitar duplicidad de teléfonos

## Flujo de Procesamiento

```
Registro de nuevo asesor
        ↓
Validación de teléfono duplicado
        ↓
¿Teléfono existe? ──Sí──→ Mostrar usuario que lo registró
        ↓No
Guardar nuevo asesor
        ↓
Actualizar catálogo
```

## Políticas de Seguridad (RLS)
La tabla cuenta con políticas de seguridad que restringen el acceso según el perfil del usuario.

## Instalación de Componentes

Para instalar todos los componentes asociados a esta tabla:

```sql
\i catAsesoresInm/funciones y trigger/instalar_todo.sql
```

## Estado Actual
- **Total de funciones**: 1
- **Total de triggers**: 0
- **Total de vistas**: 0
- **Última actualización**: 24/10/2025 00:19:04

## Notas Importantes
- El campo `telefono` tiene restricción de unicidad
- El campo `a` (iniciales) también tiene restricción de unicidad
- Todos los registros deben tener nombre y teléfono obligatorios
- La relación con `catUsers` permite auditoría de quién registró cada asesor

## Cambios Recientes
- **24/10/2025**: Creación de la función `catasoresinm_validar_telefono` para validación de teléfonos duplicados