# Funciones de Presupuestos

## Descripción

Esta carpeta contiene las funciones relacionadas con la gestión de presupuestos y sus detalles mensuales.

## Tabla Principal

### PresDetalle
- **Documentación completa**: [`../PresDetalle.md`](../PresDetalle.md)
- **Propósito**: Almacena el desglose mensual de los presupuestos por categoría
- **Relaciones**: Presupuestos, PresCategorias, catUsers

## Componentes Actuales

### 1. presdetalle_crear_registros_completos(p_id_categoria text)

**Propósito**: Crea los 12 registros mensuales del presupuesto para una categoría específica usando el año del presupuesto activo y distribuyendo el presupuesto anual entre los 12 meses.

**Parámetros**:
- `p_id_categoria` (text): ID de la categoría a la que se le crearán los registros

**Salida**:
- `mensaje` (text): Mensaje descriptivo del resultado
- `registros_creados` (integer): Cantidad de registros creados
- `id_categoria` (text): ID de la categoría procesada
- `anio_presupuesto` (integer): Año del presupuesto utilizado

**Uso típico**:
```sql
SELECT * FROM presdetalle_crear_registros_completos('52-471-0');
```

**Validaciones realizadas**:
1. Verifica que exista un presupuesto activo
2. Verifica que la categoría exista y esté activa
3. Verifica si ya existen registros para esta categoría y año (evita duplicados)
4. Verifica que la categoría no tenga ya los 12 meses completos

**Comportamiento**:
- Si no hay usuario autenticado, usa el uid del responsable de la categoría
- Si no hay responsable, usa el uid del presupuesto activo
- Divide el presupuesto anual de la categoría entre 12 meses
- Crea registros para todos los meses (1-12) del año del presupuesto activo

**Relaciones con otras tablas**:
- `PresCategorias`: Obtiene datos de la categoría y presupuesto anual
- `Presupuestos`: Obtiene el año activo y ID del presupuesto
- `PresDetalle`: Inserta los nuevos registros mensuales

## Flujo de Procesamiento

```
INICIO
  ↓
Verificar presupuesto activo
  ↓ (si existe)
Verificar categoría activa
  ↓ (si existe)
Verificar registros existentes
  ↓ (si no existen)
Calcular monto mensual
  ↓
Crear 12 registros mensuales
  ↓
Retornar resultado
FIN
```

## Instalación

Para instalar esta función, ejecutar:

```sql
-- La función se crea automáticamente al ejecutar el archivo SQL
SELECT 'Función presdetalle_crear_registros_completos instalada correctamente';
```

## Ejemplos de Uso

### Caso 1: Crear registros para categoría sin datos
```sql
SELECT * FROM presdetalle_crear_registros_completos('52-471-0');
-- Resultado: Se crearon 12 registros mensuales
```

### Caso 2: Intentar crear registros para categoría ya completa
```sql
SELECT * FROM presdetalle_crear_registros_completos('52-050-0');
-- Resultado: Ya existen 12 registros para esta categoría y año. No se crearon nuevos registros.
```

### Caso 3: Categoría no existe
```sql
SELECT * FROM presdetalle_crear_registros_completos('ID-INEXISTENTE');
-- Resultado: La categoría no existe o no está activa
```

## Consideraciones de Seguridad

- La función utiliza `SECURITY INVOKER` para respetar las políticas RLS
- Maneja casos donde `auth.uid()` retorna null
- Valida todos los datos antes de realizar inserciones

## Estado Actual

- **Componentes**: 1 función
- **Tablas documentadas**: 1 (PresDetalle)
- **Estado**: Activo y funcional
- **Última actualización**: 30/10/2025 04:44:00

## Notas Importantes

### Sobre la función
- Esta función es idempotente: si se ejecuta múltiples veces con la misma categoría, no creará duplicados
- El monto mensual se calcula dividiendo el presupuesto anual entre 12 meses
- Todos los registros se crean con el mismo uid de creación y modificación
- La función respeta el año del presupuesto activo, no usa un año fijo

### Sobre la tabla PresDetalle
- Para documentación completa de la tabla, consultar [`../PresDetalle.md`](../PresDetalle.md)
- La tabla mantiene auditoría completa de usuarios de creación y modificación
- Cada categoría debe tener 12 registros (uno por mes)
- Los montos se almacenan con precisión double para mayor exactitud