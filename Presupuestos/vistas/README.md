# Vistas del Módulo de Presupuestos

## Descripción

Esta carpeta contiene las vistas relacionadas con el módulo de presupuestos, que proporcionan resúmenes y análisis de datos para reportes y dashboards.

## Componentes Actuales

### 1. v_resumenPresupuesto

**Propósito**: Vista principal que proporciona un resumen completo del estado de presupuestos por categoría, incluyendo comparativas entre lo presupuestado, lo gastado y lo comprometido.

**Características principales**:
- Calcula indicadores clave de desempeño (KPIs) para control presupuestario
- Proporciona estados de alerta para identificar desviaciones
- Incluye proyecciones y análisis de tendencias
- Filtra automáticamente por el año en curso
- **Incluye TODAS las categorías activas**, incluso las que no tienen presupuesto ni gastos asignados

**Campos principales**:
- `idCategoria`: Identificador de la categoría
- `presupuestable`: Indica si la categoría es presupuestable o no
- `status`: Indica si la categoría está activa o no (de PresCategorias)
- `presupuesto_acumulado`: Presupuesto acumulado hasta el mes actual
- `presupuesto_total_anual`: Presupuesto total anual
- `subtotal_gastado`: Total de gastos autorizados
- `subtotal_comprometido`: Total de gastos aprobados
- `dentro_presupuesto`: Indicador booleano de cumplimiento
- `avance_acumulado`: Porcentaje de avance vs presupuesto acumulado
- `estado_acumulado`: Estado categorizado (BAJO, MODERADO, ALTO, EXCEDIDO)
- `disponible_real`: Presupuesto disponible considerando compromisos

**Estados de alerta**:
- `estado_acumulado`: SIN_GASTOS, BAJO, MODERADO, ALTO, EXCEDIDO
- `estado_vs_anual`: CONSERVADOR, NORMAL, ACELERADO, CRITICO
- `estado_comprometido`: SIN_COMPROMISOS, BAJO_COMPROMISO, MODERADO_COMPROMISO, ALTO_COMPROMISO, SOBRE_COMPROMETIDO
- `tipo_categoria`: NORMAL, PRESUPUESTO_SIN_USO, ESPECIAL_SOLO_GASTOS, INACTIVA

## Flujo de Procesamiento

```
INICIO
  ↓
Presupuestos del año actual
  ↓
Cálculo de acumulados por categoría
  ↓
Cálculo de gastos autorizados (estado 6)
  ↓
Cálculo de gastos aprobados (estado 4)
  ↓
Cálculo de compromisos totales
  ↓
Unión de todas las categorías con actividad
  ↓
Cálculo de indicadores y estados
  ↓
Ordenamiento por prioridad y avance
FIN
```

## Consultas Útiles

### Ver categorías con presupuesto excedido
```sql
SELECT * FROM public.v_resumenPresupuesto
WHERE estado_acumulado = 'EXCEDIDO' AND presupuestable = true
ORDER BY avance_acumulado DESC;
```

### Ver categorías sin uso de presupuesto
```sql
SELECT * FROM public.v_resumenPresupuesto
WHERE tipo_categoria = 'PRESUPUESTO_SIN_USO' AND presupuestable = true
ORDER BY presupuesto_total_anual DESC;
```

### Ver categorías sin presupuesto ni gastos
```sql
SELECT * FROM public.v_resumenPresupuesto
WHERE presupuesto_total_anual = 0 AND subtotal_gastado = 0
ORDER BY status DESC, presupuestable DESC, "idCategoria";
```

### Ver categorías inactivas
```sql
SELECT * FROM public.v_resumenPresupuesto
WHERE status = false
ORDER BY presupuestable DESC, "idCategoria";
```

### Ver categorías activas pero no presupuestables
```sql
SELECT * FROM public.v_resumenPresupuesto
WHERE status = true AND presupuestable = false
ORDER BY "idCategoria";
```

### Resumen general por estado
```sql
SELECT
    estado_acumulado,
    presupuestable,
    COUNT(*) as cantidad_categorias,
    SUM(presupuesto_total_anual) as total_presupuesto,
    SUM(subtotal_gastado) as total_gastado
FROM public.v_resumenPresupuesto
GROUP BY estado_acumulado, presupuestable
ORDER BY cantidad_categorias DESC;
```

### Top 10 categorías con mayor compromiso
```sql
SELECT
    idCategoria,
    presupuestable,
    presupuesto_acumulado,
    total_gastado_comprometido,
    avance_comprometido,
    estado_comprometido
FROM public.v_resumenPresupuesto
WHERE presupuestable = true
ORDER BY total_gastado_comprometido DESC
LIMIT 10;
```

## Instalación

Para instalar esta vista, ejecutar:

```sql
-- La vista se crea automáticamente al ejecutar el archivo SQL
SELECT 'Vista v_resumenPresupuesto instalada correctamente';
```

## Consideraciones de Rendimiento

- La vista utiliza CTEs (Common Table Expressions) para optimizar los cálculos
- Los filtros por año y mes actual reducen el volumen de datos procesados
- Se recomienda indexar los campos utilizados en los JOINs:
  - `PresDetalle.idCategoria`, `PresDetalle.anio`, `PresDetalle.mes`
  - `cxp.idCategoria`, `cxp.idEstado`, `cxp.fecAutorizacion`, `cxp.fc`

## Estado Actual

- **Vistas**: 1 (v_resumenPresupuesto)
- **Documentación**: Completa
- **Estado**: Activo y funcional
- **Última actualización**: 30/10/2025 01:27:00

## Notas Importantes

### Sobre los cálculos
- Los porcentajes manejan divisiones por cero retornando 999.99 cuando hay gastos sin presupuesto
- Los acumulados consideran solo hasta el mes actual para comparaciones justas
- Las proyecciones anuales se basan en el promedio mensual actual

### Sobre los estados
- Los estados de alerta permiten identificar rápidamente desviaciones presupuestarias
- Los tipos de categoría ayudan a clasificar para acciones específicas
- El ordenamiento prioriza categorías con gastos sin presupuesto asignado

## Mantenimiento

### Tareas Periódicas
1. Verificar que los cálculos de acumulados sean correctos al inicio de cada mes
2. Validar que los estados de alerta reflejen la realidad del negocio
3. Monitorear el rendimiento de la vista con el crecimiento de datos
4. Actualizar umbrales de estados si cambian las reglas del negocio

### Monitoreo
- Revisar el tiempo de ejecución de consultas complejas
- Verificar la consistencia de datos vs reportes manuales
- Identificar categorías con comportamientos anómalos