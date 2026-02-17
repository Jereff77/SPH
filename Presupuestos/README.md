# Módulo de Presupuestos

## Descripción

Este módulo contiene todos los componentes relacionados con la gestión de presupuestos y sus detalles mensuales, incluyendo tablas, funciones y documentación asociada.

## Componentes Actuales

### Tablas Principales

#### 1. PresDetalle
- **Archivo**: [`PresDetalle.md`](PresDetalle.md)
- **Propósito**: Almacena el desglose mensual de los presupuestos por categoría
- **Registros**: 673 (aproximado)
- **Relaciones**: 
  - Presupuestos (idPresupuesto)
  - PresCategorias (idCategoria)
  - catUsers (uidc, uidm)

### Funciones

#### 1. presdetalle_crear_registros_completos(p_id_categoria text)

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

#### 2. prescategorias_obtener_con_presupuesto(p_id_categoria text DEFAULT NULL, p_cuenta text DEFAULT NULL, p_seccion text DEFAULT NULL)

**Propósito**: Obtiene un listado de categorías de presupuesto con su presupuesto anual calculado, junto con información del responsable y el presupuesto asociado. Permite filtrar opcionalmente por idCategoria, cuenta o sección.

**Parámetros**:
- `p_id_categoria` (text, opcional): ID de la categoría para filtrar (búsqueda parcial, default: NULL)
- `p_cuenta` (text, opcional): Número de cuenta para filtrar (búsqueda parcial, default: NULL)
- `p_seccion` (text, opcional): Sección para filtrar (búsqueda parcial, default: NULL)

**Salida**:
- `idCategoria` (text): ID de la categoría
- `status` (boolean): Estado de la categoría
- `presupuestable` (boolean): Indica si es presupuestable
- `cuenta` (text): Número de cuenta
- `seccion` (text): Sección
- `descripcion` (text): Descripción de la categoría
- `presupuesto_anual` (double precision): Suma de montos de presupuesto anual
- `uidResponsable` (uuid): UID del usuario responsable
- `nomCompleto` (text): Nombre completo del responsable
- `idPresupuesto` (uuid): ID del presupuesto
- `statusPres` (boolean): Estado del presupuesto

**Uso típico**:
```sql
-- Obtener todas las categorías
SELECT * FROM prescategorias_obtener_con_presupuesto();

-- Filtrar por idCategoria
SELECT * FROM prescategorias_obtener_con_presupuesto('52-471-0', NULL, NULL);

-- Filtrar por cuenta
SELECT * FROM prescategorias_obtener_con_presupuesto(NULL, '100', NULL);

-- Filtrar por sección
SELECT * FROM prescategorias_obtener_con_presupuesto(NULL, NULL, 'INGRESOS');
```

**Validaciones realizadas**:
1. Solo retorna categorías asociadas a presupuestos con status = true
2. Aplica filtros opcionales por idCategoria, cuenta o sección usando búsqueda parcial (ILIKE)
3. La búsqueda es insensible a mayúsculas/minúsculas y permite coincidencias parciales
4. Calcula el presupuesto anual sumando los montos de PresDetalle
5. Maneja valores nulos en descripción usando COALESCE

**Comportamiento**:
- Retorna todas las categorías si no se proporcionan parámetros de filtro
- Aplica filtros combinados si se proporcionan múltiples parámetros
- La búsqueda por texto usa ILIKE con comodines '%' para permitir coincidencias parciales
- Ordena los resultados por cuenta y sección en orden ascendente
- Agrupa por los campos necesarios para el cálculo del presupuesto anual

**Relaciones con otras tablas**:
- `PresCategorias`: Tabla principal de categorías
- `PresDetalle`: Detalles de presupuesto para calcular montos
- `Presupuestos`: Información del presupuesto activo
- `catUsers`: Información del usuario responsable

### Vistas

#### 1. v_resumenPresupuesto

**Propósito**: Vista principal que proporciona un resumen completo del estado de presupuestos por categoría, incluyendo comparativas entre lo presupuestado, lo gastado y lo comprometido.

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

**Característica importante**:
- **Incluye TODAS las categorías activas**, incluso las que no tienen presupuesto ni gastos asignados
- Las categorías sin actividad aparecen con valores en 0, facilitando identificación de necesidades de asignación

**Uso típico**:
```sql
-- Ver categorías con presupuesto excedido
SELECT * FROM public.v_resumenPresupuesto
WHERE estado_acumulado = 'EXCEDIDO' AND presupuestable = true
ORDER BY avance_acumulado DESC;

-- Ver categorías sin presupuesto ni gastos
SELECT * FROM public.v_resumenPresupuesto
WHERE presupuesto_total_anual = 0 AND subtotal_gastado = 0
ORDER BY presupuestable DESC, "idCategoria";
```

## Estructura de Archivos

```
Presupuestos/
├── PresDetalle.md                    # Documentación completa de la tabla PresDetalle
├── funciones y trigger/
│   ├── README.md                    # Documentación de funciones
│   ├── instalar_todo.sql            # Script de instalación de funciones
│   └── presdetalle_crear_registros_completos.sql  # Función principal
├── vistas/
│   ├── README.md                    # Documentación de vistas
│   ├── instalar_todo.sql            # Script de instalación de vistas
│   └── v_resumenPresupuesto.sql     # Vista principal de resumen presupuestario
└── README.md                        # Este archivo
```

## Flujo de Procesamiento del Módulo

```
INICIO
  ↓
Presupuesto Activo
  ↓
PresCategorias
  ↓
PresDetalle
  ↓
Función presdetalle_crear_registros_completos
  ↓
12 Registros Mensuales por Categoría
  ↓
Vista v_resumenPresupuesto
  ↓
Análisis y KPIs de Control Presupuestario
FIN
```

## Proceso de Instalación

1. Ejecutar el script de instalación de funciones:
   ```sql
   \i Presupuestos/funciones y trigger/instalar_todo.sql
   ```

2. Ejecutar el script de instalación de vistas:
   ```sql
   \i Presupuestos/vistas/instalar_todo.sql
   ```

3. Verificar instalación:
   ```sql
   SELECT COUNT(*) FROM public."PresDetalle";
   SELECT COUNT(*) FROM public.v_resumenPresupuesto;
   ```

## Consultas Útiles

### Verificar estado de presupuestos por año
```sql
SELECT 
    p.anio,
    p.titulo,
    COUNT(pd.id) as total_registros,
    SUM(pd.monto) as total_presupuesto
FROM public."Presupuestos" p
LEFT JOIN public."PresDetalle" pd ON p."idPresupuesto" = pd."idPresupuesto"
WHERE p.status = true
GROUP BY p.anio, p.titulo
ORDER BY p.anio DESC;
```

### Categorías sin detalles mensuales
```sql
SELECT 
    pc."idCategoria",
    pc.descripcion,
    pc."Presupuesto" as presupuesto_anual
FROM public."PresCategorias" pc
WHERE pc.status = true 
  AND pc.presupuestable = true
  AND NOT EXISTS (
    SELECT 1 FROM public."PresDetalle" pd 
    WHERE pd."idCategoria" = pc."idCategoria" 
      AND pd.anio = (SELECT anio FROM public."Presupuestos" WHERE status = true LIMIT 1)
  );
```

## Estado Actual

- **Tablas**: 1 (PresDetalle)
- **Funciones**: 2 (presdetalle_crear_registros_completos, prescategorias_obtener_con_presupuesto)
- **Vistas**: 1 (v_resumenPresupuesto)
- **Documentación**: Completa
- **Estado**: Activo y funcional
- **Última actualización**: 05/02/2026 03:47:00

## Notas Importantes

### Sobre la Tabla PresDetalle
- Almacena el desglose mensual de cada categoría presupuestaria
- Cada categoría debe tener 12 registros (uno por mes)
- Los montos se calculan automáticamente dividiendo el presupuesto anual entre 12 meses
- Mantiene auditoría completa con usuarios de creación y modificación

### Sobre las Funciones
- La función `presdetalle_crear_registros_completos` es idempotente
- Respeta el año del presupuesto activo
- Realiza validaciones completas antes de crear registros
- Maneja casos donde no hay usuario autenticado

### Sobre las Vistas
- La vista `v_resumenPresupuesto` es la principal herramienta de análisis
- Proporciona KPIs y estados de alerta para control presupuestario
- Se actualiza automáticamente con los datos del año en curso
- Incluye proyecciones y análisis de tendencias

## Consideraciones de Seguridad

- Todas las tablas tienen RLS (Row Level Security) habilitado
- Las funciones utilizan `SECURITY INVOKER` para respetar políticas RLS
- Se valida la existencia de presupuestos activos antes de operaciones
- Se mantiene registro de auditoría en todas las operaciones

## Mantenimiento

### Tareas Periódicas
1. Verificar que todas las categorías tengan sus 12 registros mensuales
2. Validar que la suma de montos mensuales coincida con el presupuesto anual
3. Revisar categorías sin detalles creados
4. Analizar reportes de la vista v_resumenPresupuesto para identificar desviaciones
5. Actualizar documentación ante cambios estructurales

### Monitoreo
- Monitorear el crecimiento de la tabla PresDetalle
- Verificar el rendimiento de consultas mensuales
- Revisar logs de ejecución de funciones
- Monitorear el rendimiento de la vista v_resumenPresupuesto
- Validar la consistencia de datos entre tablas y vistas