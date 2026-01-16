--[Fecha y Hora]: 30/10/2025 04:43:00
--[Descripción]: Documentación completa de la tabla PresDetalle
--                Almacena los detalles mensuales de los presupuestos por categoría
--
--[Estructura]:
--   - Tabla principal para almacenar los desgloses mensuales de presupuestos
--
--[Relaciones]: 
--   - Presupuestos (idPresupuesto): Presupuesto al que pertenece el detalle
--   - PresCategorias (idCategoria): Categoría del presupuesto
--   - catUsers (uidc): Usuario que crea el registro
--   - catUsers (uidm): Usuario que modifica el registro
--
--[Políticas de seguridad]: RLS habilitado

# Tabla: PresDetalle

## Descripción General
La tabla `PresDetalle` almacena el desglose mensual de los presupuestos por categoría. Cada registro representa el monto asignado a una categoría específica para un mes y año determinados.

## Estructura de la Tabla

### Columnas Principales

| Nombre | Tipo | Nulo | Por Defecto | Descripción |
|--------|------|------|-------------|-------------|
| `id` | bigint | NO | - | Identificador único autoincremental (PRIMARY KEY) |
| `fc` | timestamp with time zone | NO | now() | Fecha y hora de creación del registro |
| `uidc` | uuid | NO | - | UUID del usuario que crea el registro |
| `idCategoria` | text | NO | - | ID de la categoría del presupuesto |
| `anio` | smallint | NO | - | Año del presupuesto |
| `mes` | smallint | NO | - | Mes del presupuesto (1-12) |
| `monto` | double precision | NO | '0'::double precision | Monto asignado para el mes |
| `fua` | timestamp with time zone | SÍ | - | Fecha y hora de última actualización |
| `uidm` | uuid | NO | - | UUID del usuario que modificó el registro |
| `idPresupuesto` | uuid | NO | - | UUID del presupuesto principal |

## Relaciones con Otras Tablas

### Claves Foráneas

1. **Presupuestos**
   - Columna: `idPresupuesto` → `Presupuestos.idPresupuesto`
   - Descripción: Relaciona el detalle con el presupuesto principal

2. **PresCategorias**
   - Columna: `idCategoria` → `PresCategorias.idCategoria`
   - Descripción: Relaciona el detalle con la categoría presupuestaria

3. **catUsers (Usuario Creación)**
   - Columna: `uidc` → `catUsers.uid`
   - Descripción: Usuario que crea el registro

4. **catUsers (Usuario Modificación)**
   - Columna: `uidm` → `catUsers.uid`
   - Descripción: Usuario que modifica el registro

## Comportamiento y Flujo de Datos

### Proceso de Creación
1. Se crea un presupuesto principal en la tabla `Presupuestos`
2. Se asignan categorías con montos anuales en `PresCategorias`
3. Se generan los detalles mensuales en `PresDetalle` mediante la función `presdetalle_crear_registros_completos()`
4. Cada categoría genera 12 registros (uno por mes) con el monto mensual calculado

### Cálculo de Montos
- El monto mensual se calcula dividiendo el presupuesto anual de la categoría entre 12 meses
- Es posible modificar los montos mensuales individualmente después de la creación

## Validaciones y Restricciones

### Integridad de Datos
- Cada combinación de `idCategoria`, `anio` y `mes` debe ser única
- El `mes` debe estar en el rango de 1 a 12
- El `anio` debe corresponder al año del presupuesto activo

### Políticas de Seguridad (RLS)
- Los usuarios solo pueden ver y modificar los detalles de los presupuestos de su área
- Se requiere autenticación para realizar cualquier operación

## Funciones Asociadas

### presdetalle_crear_registros_completos(p_id_categoria text)
- **Propósito**: Crea automáticamente los 12 registros mensuales para una categoría
- **Parámetros**: ID de la categoría
- **Retorno**: Tabla con mensaje, registros_creados, id_categoria y anio_presupuesto
- **Comportamiento**: 
  - Valida existencia de presupuesto activo
  - Verifica que la categoría esté activa
  - Evita duplicados
  - Calcula y distribuye el monto anual entre 12 meses

## Consultas Típicas

### Obtener detalles de un presupuesto por año
```sql
SELECT 
    pd.*,
    pc.descripcion as categoria,
    pc.seccion
FROM public."PresDetalle" pd
JOIN public."PresCategorias" pc ON pd."idCategoria" = pc."idCategoria"
WHERE pd.anio = 2024
ORDER BY pc.seccion, pc.descripcion, pd.mes;
```

### Resumen mensual por categoría
```sql
SELECT 
    pc.descripcion,
    pd.anio,
    pd.mes,
    pd.monto,
    uc.nombre as usuario_creacion,
    um.nombre as usuario_modificacion
FROM public."PresDetalle" pd
JOIN public."PresCategorias" pc ON pd."idCategoria" = pc."idCategoria"
LEFT JOIN public."catUsers" uc ON pd.uidc = uc.uid
LEFT JOIN public."catUsers" um ON pd.uidm = um.uid
WHERE pd.anio = 2024
ORDER BY pc.descripcion, pd.mes;
```

### Total anual por categoría
```sql
SELECT 
    pc.descripcion,
    pc.seccion,
    pd.anio,
    SUM(pd.monto) as total_anual
FROM public."PresDetalle" pd
JOIN public."PresCategorias" pc ON pd."idCategoria" = pc."idCategoria"
WHERE pd.anio = 2024
GROUP BY pc.descripcion, pc.seccion, pd.anio
ORDER BY pc.seccion, pc.descripcion;
```

## Consideraciones de Rendimiento

### Índices Recomendados
- Índice compuesto en (`idCategoria`, `anio`, `mes`) para búsquedas rápidas
- Índice en `idPresupuesto` para filtrar por presupuesto
- Índice en `anio` para consultas anuales

### Buenas Prácticas
- Utilizar transacciones al modificar múltiples registros
- Validar la suma de montos mensuales contra el presupuesto anual
- Mantener actualizados los campos de auditoría (`fua`, `uidm`)

## Estado Actual

- **Registros**: 673 (aproximado)
- **RLS**: Habilitado
- **Última actualización**: 30/10/2025
- **Funciones asociadas**: 1 (`presdetalle_crear_registros_completos`)

## Notas Importantes

- La tabla es el corazón del sistema de presupuestos mensuales
- Todos los montos se almacenan en tipo `double precision` para mayor precisión
- La función de creación automática evita errores humanos en la distribución mensual
- Se mantiene historial completo de auditoría mediante campos de creación y modificación