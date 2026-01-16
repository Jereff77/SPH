# Propiedades - Funciones y Triggers

## Overview
Esta carpeta contiene las funciones y triggers asociados a la gestión de propiedades en el sistema SPH.

## Componentes Actuales

### Funciones

#### 1. propiedades_eliminar_propiedad.sql
- **Propósito**: Eliminar una propiedad validando que no tenga pagos aplicados
- **Parámetros**: 
  - `p_id_propiedad` (text): ID de la propiedad a eliminar
- **Retorno**: text - Mensaje indicando el resultado de la operación
- **Validaciones realizadas**:
  - Verifica que la propiedad exista y esté activa
  - Verifica que no existan pagos直接 asociados a la propiedad
  - Nota: Los planes de pago (pdp) y sus detalles (pdpDetalle) se eliminarán en cascada
- **Comportamiento**: 
  - Si todas las validaciones pasan, marca la propiedad como inactiva (status = false)
  - Si alguna validación falla, retorna un mensaje de error específico
- **Manejo de errores**: Captura excepciones y retorna mensaje descriptivo

## Flujo de Procesamiento

```
Inicio
  │
  ├─ ¿Existe la propiedad? ── No ──→ Retornar error "No existe"
  │
  ├─ ¿Tiene pagos直接? ── Sí ──→ Retornar error "Tiene pagos"
  │
  └─ Todas las validaciones pasan ──→ Marcar como inactiva y retornar éxito
```

## Relaciones con Otras Tablas

- **propiedades**: Tabla principal que se modifica
- **pagos**: Tabla de validación para evitar eliminar propiedades con pagos
- **pdp**: Tabla que se elimina en cascada automáticamente
- **pdpDetalle**: Tabla que se elimina en cascada automáticamente

## Instalación

Para instalar estos componentes en la base de datos, ejecutar:

```sql
-- Ejecutar el script de la función
\i propiedades/funciones y trigger/propiedades_eliminar_propiedad.sql
```

O ejecutar el script de instalación completo:

```sql
\i propiedades/funciones y trigger/instalar_todo.sql
```

## Uso

### Ejemplo de uso básico:

```sql
-- Intentar eliminar una propiedad
SELECT propiedades_eliminar_propiedad('PROP-123');
```

### Ejemplos de respuestas:

**Caso exitoso:**
```
ÉXITO: La propiedad PROP-123 ha sido eliminada correctamente
```

**Casos de error:**
```
ERROR: La propiedad PROP-999 no existe o está inactiva
ERROR: No se puede eliminar la propiedad PROP-123 porque tiene 5 pago(s) aplicado(s)
ERROR: No se puede eliminar la propiedad PROP-123 porque tiene 5 pago(s) aplicado(s)
```

## Consideraciones de Seguridad

- La función utiliza `SECURITY INVOKER` para respetar los permisos del usuario que la ejecuta
- No elimina físicamente el registro, solo lo marca como inactivo (status = false)
- Realiza validaciones exhaustivas antes de permitir la eliminación

## Estado Actual

- **Total de funciones**: 1
- **Total de triggers**: 0
- **Última actualización**: 24/10/2025 08:05:00

## Notas Importantes

1. **Política de eliminación**: Por política de negocio, no se permite eliminar propiedades que tengan pagos aplicados
2. **Eliminación suave**: La función no elimina físicamente el registro, solo lo marca como inactivo
3. **Eliminación en cascada**: Los planes de pago y sus detalles se eliminan automáticamente por la base de datos
4. **Validación específica**: Solo se valida la existencia de pagos直接, ya que los planes se eliminan en cascada
5. **Mensajes descriptivos**: Todos los errores incluyen información detallada sobre la causa