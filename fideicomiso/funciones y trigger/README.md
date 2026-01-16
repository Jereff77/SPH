# Funciones y Triggers - fideicomiso

## Descripción
Esta carpeta contiene todas las funciones asociadas a la tabla `fideicomiso` y sus componentes relacionados.

## Componentes

### 1. fideicomiso_rendimientos_promocion.sql
**Propósito**: Calcula los rendimientos de fideicomiso considerando la promoción del 9% durante el primer año desde el primer pago de cada inversionista.

**Características**:
- Maneja períodos mixtos donde parte del cálculo cae en promoción y parte no
- Calcula automáticamente el período promocional basándose en el primer pago
- Aplica retención de ISR del 10% solo para personas físicas
- Identifica 4 tipos de períodos: SIN_PROMOCION, TOTAL_PROMOCION, TOTAL_NORMAL, PERIODO_MIXTO
- Calcula días en promoción para análisis y auditoría

**Parámetros**:
- `mes_periodo` (integer): Mes del período de dispersión (1-12)
- `anio_periodo` (integer): Año del período de dispersión
- `mes_anterior` (integer): Mes del período anterior (1-12)
- `anio_anterior` (integer): Año del período anterior
- `id_propiedad_filtro` (text, opcional): ID de propiedad específica

**Salida**: Tabla con cálculos detallados de rendimiento por inversión

### 2. fideicomiso_rendimientos_resumen_consulta.sql
**Propósito**: Versión simplificada de resumen por inversionista basada en consulta directa.

**Características**:
- Agrupa por inversionista sumando rendimientos
- Utiliza ranking por días para obtener el registro más representativo
- Ordena correctamente números y texto en "noAdhesion"
- Suma todos los rendimientos y retenciones por inversionista
- Cuenta pagos con promoción y pagos mixtos para análisis

**Parámetros**:
- `mes_periodo` (integer): Mes del período de dispersión (1-12)
- `anio_periodo` (integer): Año del período de dispersión
- `mes_anterior` (integer): Mes del período anterior (1-12)
- `anio_anterior` (integer): Año del período anterior
- `id_propiedad_filtro` (text, opcional): ID de propiedad específica

**Salida**: Tabla con un registro por inversionista con totales consolidados

### 3. plan_dispersiones_dinamico.sql
**Propósito**: Calcula los rendimientos de una inversión en base a los pagos realizados y los períodos de un fideicomiso.

**Características**:
- Valida que el fideicomiso y número de adhesión existan
- Determina el período promocional (primer año desde el primer pago)
- Procesa todos los períodos de dispersión del fideicomiso
- Identifica los pagos aplicables a cada período
- Calcula rendimientos según el tipo de período y tasas aplicables
- Maneja casos especiales como períodos mixtos (parte en promoción, parte normal)
- Aplica retención de ISR del 10% solo para personas físicas
- Calcula rendimiento SPH basado en la diferencia entre rendimiento del fideicomiso y rendimiento contratado

**Parámetros**:
- `p_id_fideicomiso` (text): ID del fideicomiso
- `p_no_adhesion` (text): Número de adhesión del inversionista

**Salida**: Tabla con información detallada incluyendo datos del inversionista, período, pagos y cálculos de rendimiento

### 4. resumen_dispersion_dinamico.sql
**Propósito**: Obtiene el resumen sumarizado de dispersiones para un número de dispersión específico.

**Características**:
- Utiliza `plan_dispersiones_dinamico` para obtener los registros
- Filtra por número de dispersión específico (ej: "8va")
- Sumariza las columnas numéricas:
  - `monto_pago`: SUM DISTINCT (solo pagos distintos)
  - `rendimiento_bruto`: SUM (todos los registros)
  - `retencion_isr`: SUM (todos los registros)
  - `rendimiento_neto`: SUM (todos los registros)
  - `rendimiento_sph`: SUM (todos los registros)
  - `dispersion_neta`: SUM (todos los registros)
- Proporciona desglose por tipo de período (promoción vs normal)
- Calcula tasa promedio de rendimiento
- Incluye información de auditoría

**Parámetros**:
- `p_id_fideicomiso` (text): ID del fideicomiso
- `p_no_adhesion` (text): Número de adhesión del inversionista
- `p_no_dispersion` (text): Número de dispersión a sumarizar (ej: "8va")

**Salida**: Tabla con resumen sumarizado del período de dispersión

### 5. plan_dispersiones_dinamico_json.sql
**Propósito**: Versión JSON de plan_dispersiones_dinamico que calcula los rendimientos y los devuelve en formato JSON.

**Características**:
- Ejecuta la función principal y convierte los resultados a JSON
- Incluye un resumen con totales de montos y rendimientos
- Facilita el consumo de datos desde aplicaciones web
- Mantiene la misma lógica de cálculo que la función principal

**Parámetros**:
- `p_id_fideicomiso` (text): ID del fideicomiso
- `p_no_adhesion` (text): Número de adhesión del inversionista

**Salida**: JSON con datos detallados y resumen de los cálculos

### 6. resumen_fideicomiso_completo.sql
**Propósito**: Resumen consolidado de todos los fideicomitentes para un número de dispersión específico.

**Características**:
- Utiliza resumen_dispersion_dinamico para obtener datos sumarizados de cada adherente
- Filtra por número de dispersión específico (ej: "8va")
- Muestra un registro por adherente con todos los cálculos sumarizados
- Incluye información del inversionista, período, pagos y cálculos
- Proporciona desglose por tipo de período (promoción vs normal)
- Ordena resultados por "noAdhesion" (numéricos primero, luego texto)
- Utiliza SECURITY DEFINER

**Parámetros**:
- `p_id_fideicomiso` (text): ID del fideicomiso a consultar
- `p_no_dispersion` (text): Número de dispersión a consultar (ej: "8va")

**Salida**: Tabla con resumen por adherente para la dispersión especificada

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
│              plan_dispersiones_dinamico                        │
│         (Cálculo de rendimientos por período y pago)           │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
┌───────────────────────────────┐ ┌──────────────────────────────────┐
│ resumen_dispersion_dinamico  │ │ plan_dispersiones_dinamico_json   │
│ (Resumen por número de       │ │ (Versión JSON de los cálculos)   │
│  dispersión específico)      │ └──────────────────────────────────┘
└───────────────────────────────┘            │
                                           ▼
                          ┌──────────────────────────────────────┐
                          │   resumen_fideicomiso_completo      │
                          │  (Resumen de todos los adherentes) │
                          │       para una dispersión específica)  │
                          └──────────────────────────────────────┘
```

## Tablas Relacionadas

- **fideicomiso**: Tabla principal de configuración de fideicomisos
- **fideCondiciones**: Condiciones específicas por fideicomiso
- **propiedades**: Propiedades asociadas a los fideicomisos
- **inversionista**: Información de los inversionistas
- **pagos**: Pagos realizados a los inversionistas
- **fideMesDispersion**: Configuración de fechas de dispersión

## Estado Actual

- **Total de funciones**: 6
- **Total de triggers**: 0
- **Última actualización**: 08/01/2026

## Notas Importantes

1. **Promoción del 9%**: Se aplica durante el primer año desde el primer pago de cada inversionista
2. **Retención ISR**: Solo se aplica a personas físicas (10%)
3. **Períodos mixtos**: La función maneja correctamente períodos donde parte está en promoción y parte no
4. **Ordenamiento**: Las funciones respetan el ordenamiento numérico cuando "noAdhesion" es numérico

## Instalación

Ejecutar el script `instalar_todo.sql` para instalar todas las funciones en el orden correcto.

## Notas Importantes

1. **Promoción del 9%**: Se aplica durante el primer año desde el primer pago de cada inversionista
2. **Retención ISR**: Solo se aplica a personas físicas (10%)
3. **Períodos mixtos**: La función maneja correctamente períodos donde parte está en promoción y parte no
4. **Ordenamiento**: Las funciones respetan el ordenamiento numérico cuando "noAdhesion" es numérico
5. **plan_dispersiones_dinamico**: Función clave utilizada internamente para obtener datos detallados de dispersiones por adherente en columnas separadas
6. **plan_dispersiones_dinamico_json**: Versión que devuelve los mismos datos que plan_dispersiones_dinamico pero en formato JSON explícito
