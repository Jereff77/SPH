# Tabla: fideicomiso

## Descripción
Tabla que almacena la configuración y parámetros de los fideicomisos utilizados en el sistema SPH.

## Estructura de la tabla

| Columna | Tipo | Nulable | Default | Descripción |
|---------|------|---------|---------|-------------|
| `"idFide"` | text | NO | - | Clave primaria del fideicomiso |
| `status` | boolean | NO | true | Estado del registro (activo/inactivo) |
| `uidr` | uuid | NO | - | UUID del usuario responsable (FK a catUsers) |
| `titulo` | text | YES | - | Título o nombre del fideicomiso |
| `"Status"` | boolean | NO | - | Estado del fideicomiso (activo/inactivo) |
| `"fecinicio"` | date | YES | - | Fecha de inicio del fideicomiso |
| `"fecfin"` | date | YES | - | Fecha de fin del fideicomiso |
| `"cantdispersiones"` | integer | NO | 4 | Cantidad de dispersiones en el año |
| `"DxA"` | integer | NO | 365 | Días por Año |
| `rendimiento` | smallint | NO | 9 | Rendimiento máximo del fideicomiso |

## Relaciones

### Clave Primaria
- `"idFide"` (text)

### Claves Foráneas
- `uidr` → `catUsers.uid` (NO ACTION)

## Componentes Asociados

### Funciones (3)

#### 1. fideicomiso_rendimientos_promocion
**Propósito**: Calcula los rendimientos de fideicomiso considerando la promoción del 9% durante el primer año desde el primer pago de cada inversionista.

**Características**:
- Maneja períodos mixtos donde parte del cálculo cae en promoción y parte no
- Calcula automáticamente el período promocional basándose en el primer pago
- Aplica retención de ISR del 10% solo para personas físicas
- Identifica 4 tipos de períodos: SIN_PROMOCION, TOTAL_PROMOCION, TOTAL_NORMAL, PERIODO_MIXTO

**Ubicación**: `funciones y trigger/fideicomiso_rendimientos_promocion.sql`

#### 2. fideicomiso_rendimientos_resumen_consulta
**Propósito**: Versión simplificada de resumen por inversionista basada en consulta directa.

**Características**:
- Agrupa por inversionista sumando rendimientos
- Utiliza ranking por días para obtener el registro más representativo
- Ordena correctamente números y texto en "noAdhesion"

**Ubicación**: `funciones y trigger/fideicomiso_rendimientos_resumen_consulta.sql`

#### 3. resumen_fideicomiso_completo
**Propósito**: Resumen consolidado con filtros opcionales por período.

**Características**:
- Construye query dinámico para cada adherente
- Aplica filtros de período con conversión correcta de fechas
- Agrupa por adherente para obtener totales consolidados

**Ubicación**: `funciones y trigger/resumen_fideicomiso_completo.sql`

### Triggers (0)
No hay triggers asociados a esta tabla.

### Vistas (1)

#### 1. v_fideicomiso
**Propósito**: Vista que muestra información consolidada de fideicomisos con datos relacionados de propiedades, inversionistas y planes de pago.

**Características**:
- Proporciona una vista unificada para consultar información de fideicomisos
- Muestra datos de propiedades, inversionistas y planes de pago en una sola consulta
- Utiliza LEFT JOIN para incluir registros aunque no tengan relaciones

**Ubicación**: `vistas/v_fideicomiso.sql`

## Flujo de Procesamiento

```
┌─────────────────────────────────────────────────────────────────┐
│                    fideicomiso_rendimientos_promocion         │
│         (Cálculo detallado por inversión)                     │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│      fideicomiso_rendimientos_resumen_consulta                │
│         (Agrupa por inversionista)                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              resumen_fideicomiso_completo                     │
│         (Resumen por adherente con filtros)                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    v_fideicomiso                             │
│         (Vista consolidada de información)                     │
└─────────────────────────────────────────────────────────────────┘
```

## Tablas Relacionadas

- **fideCondiciones**: Condiciones específicas por fideicomiso
- **propiedades**: Propiedades asociadas a los fideicomisos
- **inversionista**: Información de los inversionistas
- **pagos**: Pagos realizados a los inversionistas
- **fideMesDispersion**: Configuración de fechas de dispersión
- **pdp**: Planes de pago
- **pdpDetalle**: Detalle de planes de pago
- **catUsers**: Usuarios responsables de los fideicomisos

## Notas Importantes

- La tabla tiene dos columnas de estado: `status` y `"Status"` (diferencian mayúsculas)
- El rendimiento máximo del fideicomiso es 9% por defecto
- La cantidad de dispersiones por año es 4 por defecto
- Los días por año se establecen en 365 por defecto
- La promoción del 9% se aplica durante el primer año desde el primer pago de cada inversionista
- La retención de ISR del 10% se aplica solo a personas físicas

## Estado Actual
- **Funciones documentadas**: 3
- **Triggers documentados**: 0
- **Vistas documentadas**: 1
- **Última actualización**: 31/12/2025

## Instalación

Para instalar todos los componentes asociados a la tabla fideicomiso:

1. **Funciones**:
   ```bash
   cd "fideicomiso/funciones y trigger"
   psql -d tu_base_de_datos -f instalar_todo.sql
   ```

2. **Vistas**:
   ```bash
   cd "fideicomiso/vistas"
   psql -d tu_base_de_datos -f instalar_todo.sql
   ```

## Ejemplos de Uso

### Consultar todos los fideicomisos
```sql
SELECT * FROM fideicomiso WHERE status = true;
```

### Calcular rendimientos para un período específico
```sql
SELECT * FROM fideicomiso_rendimientos_promocion(6, 2025, 3, 2025);
```

### Obtener resumen por inversionista
```sql
SELECT * FROM fideicomiso_rendimientos_resumen_consulta(6, 2025, 3, 2025);
```

### Consultar vista consolidada
```sql
SELECT * FROM v_fideicomiso ORDER BY razonsocial;
```

### Resumen completo de un fideicomiso
```sql
SELECT * FROM resumen_fideicomiso_completo('ID_FIDEICOMISO', 2025, 6);
```
