# Funciones y Triggers de CXP (Cuentas por Pagar)

## 📋 Descripción General

Este directorio contiene todas las funciones y triggers asociados al módulo de Cuentas por Pagar (CXP) del sistema SPH. Estas funciones gestionan la validación, autorización y procesamiento de pagos a proveedores.

## 📁 Estructura de Archivos

### Funciones Principales
- `cxp_agregar_fecha_manual.sql` - Agrega fechas manualmente al calendario de fechas habilitadas
- `cxp_aprobados_sin_pago_aplicado.sql` - Actualiza masivamente el idEstatus de registros aprobados (estatus 4) sin pago aplicado a estatus 99
- `cxp_actualizar_nomcfdi_vacio.sql` - Función que verifica y actualiza el campo nomCFDI cuando está vacío después de insertar un registro
- `cxp_autorizar_solicitud_pago.sql` - Autoriza solicitudes de pago con validación de presupuesto, incluye variante para autorizar fuera de presupuesto con permisos especiales
- `cxp_fechas_habilitadas_actualizar_dia_semana.sql` - Actualiza el día de la semana en fechas habilitadas
- `cxp_fechas_habilitadas_anual.sql` - Genera fechas habilitadas para un año completo
- `cxp_get_estado_cuenta_detalle.sql` - Obtiene el detalle del estado de cuenta
- `cxp_get_filtros_dependientes.sql` - Obtiene filtros dependientes para consultas
- `cxp_get_unique_values.sql` - Obtiene valores únicos para filtros
- `cxp_probar_validacion_proveedor.sql` - Prueba la validación de proveedores
- `cxp_puede_autorizar.sql` - Verifica permisos de autorización
- `cxp_puede_insertar.sql` - Verifica permisos de inserción
- `cxp_trigger_validar_fecha.sql` - Trigger para validar fechas
- `cxp_actualizar_gerente.sql` - Función trigger que actualiza uidGerente y nomGerente automáticamente según idCategoria
- `trigger_cxp_actualizar_gerente.sql` - Trigger BEFORE INSERT OR UPDATE que sincroniza uidGerente y nomGerente con PresCategorias y catUsers
- `trigger_cxp_actualizar_nomcfdi.sql` - Trigger que se ejecuta después de insertar para actualizar nomCFDI cuando está vacío
- `cxp_validar_fecha_habilitada.sql` - Valida si una fecha está habilitada
- `cxp_validar_y_actualizar_proveedor.sql` - Valida y actualiza datos de proveedores

### Scripts de Prueba
- `test_cxp_autorizar_solicitud_pago.sql` - Script de prueba para la función de autorización de pagos
- `test_cxp_aprobados_sin_pago_aplicado.sql` - Script de prueba para la función de actualización masiva de estatus de aprobados sin pago

## 🔄 Flujo de Procesamiento

```
1. Validación de Fechas
   ├── cxp_validar_fecha_habilitada()
   ├── cxp_trigger_validar_fecha()
   └── cxp_agregar_fecha_manual()

2. Gestión de Proveedores
   ├── cxp_validar_y_actualizar_proveedor()
   └── cxp_probar_validacion_proveedor()

3. Permisos y Autorización
   ├── cxp_puede_insertar()
   ├── cxp_puede_autorizar()
   └── cxp_autorizar_solicitud_pago()

4. Consultas y Reportes
   ├── cxp_get_estado_cuenta_detalle()
   ├── cxp_get_filtros_dependientes()
   └── cxp_get_unique_values()

5. Actualización Automática de Datos
   ├── cxp_actualizar_nomcfdi_vacio()
   ├── cxp_aprobados_sin_pago_aplicado()
   ├── trigger_cxp_actualizar_nomcfdi()
   ├── cxp_actualizar_gerente()
   └── trigger_cxp_actualizar_gerente()

6. Mantenimiento de Calendario
   ├── cxp_fechas_habilitadas_anual()
   └── cxp_fechas_habilitadas_actualizar_dia_semana()
```

## 📊 Estado Actual

- **Total de funciones**: 16
- **Total de triggers**: 4
- **Funciones documentadas**: 4
- **Scripts de prueba**: 2
- **Última actualización**: 15/05/2026

## 🔧 Instalación

Para instalar todas las funciones de CXP, ejecutar:

```sql
\i cxp/funciones y trigger/instalar_todo.sql
```

## 🔄 Funcionalidad de Actualización Automática de Gerente

### Descripción

El sistema incluye una funcionalidad automática para mantener sincronizados los campos `uidGerente` y `nomGerente` de cada registro CXP con el responsable definido en la categoría presupuestal asignada.

### Componentes

1. **Función**: `cxp_actualizar_gerente()`
   - Busca el `uidResponsable` en `PresCategorias` usando el `idCategoria` del registro
   - Con ese UUID, busca el `nomCompleto` en `catUsers`
   - Asigna ambos valores al registro antes de guardarse (BEFORE trigger)
   - Optimización: en UPDATE, solo recalcula si `idCategoria` cambió

2. **Trigger**: `trigger_cxp_actualizar_gerente`
   - Se ejecuta BEFORE INSERT OR UPDATE en la tabla `cxp`
   - Llama a `cxp_actualizar_gerente()` para realizar la sincronización

### Comportamiento

| Escenario | Resultado |
|---|---|
| INSERT con `idCategoria` válida | Llena `uidGerente` y `nomGerente` automáticamente |
| INSERT con `idCategoria` NULL | Deja ambos campos en NULL |
| UPDATE cambiando `idCategoria` | Recalcula y actualiza ambos campos |
| UPDATE sin cambiar `idCategoria` | No hace consultas extra (optimización) |
| Categoría sin `uidResponsable` asignado | Pone NULL en ambas columnas |

### Ejemplo

```sql
-- Al insertar, uidGerente y nomGerente se llenan automáticamente
INSERT INTO cxp ("idCxp", "idCategoria", ...) VALUES ('CXP001', 'CAT_ADMIN', ...);

-- Verificar resultado
SELECT "idCxp", "idCategoria", "uidGerente", "nomGerente" FROM cxp WHERE "idCxp" = 'CXP001';
```

---

## 📝 Notas Importantes

- Todas las funciones siguen el estándar de seguridad INVOKER por defecto
- Las funciones de validación incluyen manejo de errores detallado
- El calendario de fechas habilitadas es crucial para el funcionamiento del sistema
- Los permisos son validados antes de cualquier operación de inserción o autorización
- La función `cxp_autorizar_solicitud_pago()` integra validación presupuestaria con el módulo de Presupuestos
- `cxp_autorizar_solicitud_pago()` actualiza campos adicionales: `ultimoComentario`, `autorizo`, `fecAutorizacion` y `autorizadoFP`
- `cxp_autorizar_solicitud_pago()` incluye variante para autorizar fuera de presupuesto basada en configuración de `SPHConfiguraciones`
- La función `cxp_actualizar_nomcfdi_vacio()` se ejecuta automáticamente después de insertar un registro para asegurar que el campo `nomCFDI` siempre tenga un valor válido
- El trigger `trigger_cxp_actualizar_nomcfdi` se activa después de cada inserción en la tabla `cxp` para actualizar el campo `nomCFDI` cuando está vacío
- La función `cxp_aprobados_sin_pago_aplicado()` permite actualizar masivamente el estatus de registros de "Aprobado" (4) que no tienen pago aplicado a un estatus personalizado (99) para un mes y año específicos, incluyendo validaciones de parámetros y una restricción de seguridad que impide ejecutarla en el mes en curso
- **Retorno compuesto**: Devuelve un tipo `resultado_funcion` con `estatus` (boolean), `mensaje` (text) y `registros_afectados` (integer)
- **Registro automático de actividad**: Utiliza la función `rau()` para registrar cada ejecución (éxito o error) en la tabla `actividad`

## 🧪 Pruebas

Para probar la función de autorización de pagos:

```sql
-- Ejecutar script de pruebas completo
\i cxp/funciones y trigger/test_cxp_autorizar_solicitud_pago.sql

-- Probar autorización específica (solo con ID)
SELECT * FROM cxp_autorizar_solicitud_pago('ID_DEL_CXP') AS (autorizado boolean, mensaje text);

-- Probar autorización con comentario
SELECT * FROM cxp_autorizar_solicitud_pago('ID_DEL_CXP', 'Comentario de autorización') AS (autorizado boolean, mensaje text);

-- Probar autorización con todos los parámetros
SELECT * FROM cxp_autorizar_solicitud_pago('ID_DEL_CXP', 'Comentario completo', 'UUID_DEL_USUARIO'::uuid) AS (autorizado boolean, mensaje text);

-- Probar autorización omitiendo validación de presupuesto (requiere permisos configurados)
SELECT * FROM cxp_autorizar_solicitud_pago('ID_DEL_CXP', 'Autorización especial', 'UUID_USUARIO_AUTORIZADO'::uuid) AS (autorizado boolean, mensaje text);
```

Para probar la función de actualización masiva de estatus de aprobados sin pago:

```sql
-- Ejecutar script de pruebas completo
\i cxp/funciones y trigger/test_cxp_aprobados_sin_pago_aplicado.sql

-- Probar actualización para noviembre 2024
SELECT * FROM cxp_aprobados_sin_pago_aplicado(11, 2024) AS (estatus boolean, mensaje text, registros_afectados integer);

-- Verificar resultados
SELECT COUNT(*) as registros_actualizados
FROM cxp
WHERE "idEstado" = 99
  AND "numMes" = 11
  AND "numAnio" = 2024;

-- Probar restricción de mes en curso (debería dar error)
-- SELECT * FROM cxp_aprobados_sin_pago_aplicado(EXTRACT(MONTH FROM CURRENT_DATE)::integer,
--                                       EXTRACT(YEAR FROM CURRENT_DATE)::integer);
```

**Nota**: La función ahora devuelve un tipo compuesto. Para acceder a los valores, usa:
```sql
SELECT (resultado).estatus, (resultado).mensaje, (resultado).registros_afectados
FROM cxp_aprobados_sin_pago_aplicado(11, 2024) AS resultado;
```

## 🔐 Configuración de Omisión de Validación de Presupuesto

La función incluye una variante para omitir la validación de presupuesto cuando:

1. Se configura un usuario autorizado en la tabla `SPHConfiguraciones` con el parámetro `Aprobar fuera de presupuesto`
2. Se pasa el UID del usuario que autoriza en el parámetro `p_autorizo`
3. El UID del usuario que autoriza coincide con el configurado en `SPHConfiguraciones`

### Parámetros Adicionales

- `p_autorizo (uuid)`: UID del usuario que autoriza el pago. Si coincide con el usuario configurado en `SPHConfiguraciones`, se omite la validación de presupuesto
- `p_uidsolicita (uuid)`: UID del usuario que solicita la aprobación (no utilizado para validación de presupuesto)

## 🔄 Funcionalidad de Actualización Automática de nomCFDI

### Descripción

El sistema incluye una funcionalidad automática para asegurar que el campo `nomCFDI` siempre tenga un valor válido después de insertar un registro en la tabla `cxp`.

### Componentes

1. **Función**: `cxp_actualizar_nomcfdi_vacio()`
   - Verifica si el campo `nomCFDI` está vacío (NULL, cadena vacía o 'EMPTY')
   - Si está vacío y `nombreProveedor` tiene un valor, actualiza `nomCFDI` con ese valor

2. **Trigger**: `trigger_cxp_actualizar_nomcfdi`
   - Se ejecuta automáticamente después de cada inserción en la tabla `cxp`
   - Llama a la función `cxp_actualizar_nomcfdi_vacio()` para realizar la actualización

### Comportamiento

- Solo se actualiza el campo `nomCFDI` cuando está vacío
- Se respeta el valor existente si `nomCFDI` ya tiene datos
- La actualización solo ocurre si `nombreProveedor` tiene un valor válido
- El trigger se ejecuta de forma transparente para el usuario

### Ejemplo

```sql
-- Insertar un registro con nomCFDI vacío
INSERT INTO cxp (idCxp, nomCFDI, nombreProveedor, ...)
VALUES ('TEST001', '', 'Proveedor Ejemplo', ...);

-- El trigger actualizará automáticamente nomCFDI a 'Proveedor Ejemplo'
```