# Vistas - fideicomiso

## Descripción
Esta carpeta contiene todas las vistas asociadas a la tabla `fideicomiso` y sus componentes relacionados.

## Componentes

### 1. v_fideicomiso.sql
**Propósito**: Vista que muestra información consolidada de fideicomisos con datos relacionados de propiedades, inversionistas y planes de pago.

**Características**:
- Proporciona una vista unificada para consultar información de fideicomisos
- Muestra datos de propiedades, inversionistas y planes de pago en una sola consulta
- Utiliza LEFT JOIN para incluir registros aunque no tengan relaciones
- Ordena los resultados por razonsocial del inversionista
- Muestra solo el primer pago de cada plan de pago

**Campos principales**:
- `idfide`: ID del fideicomiso (de fideCondiciones."idfideCond")
- `"idPropiedad"`: ID de la propiedad
- `"noAdhesion"`: Número de adhesión
- `rendimiento`: Rendimiento del fideicomiso
- `"idInversionista"`: ID del inversionista
- `razonsocial`: Razón social del inversionista
- `monto`: Monto del plan de pago
- `cantpagos`: Cantidad de pagos
- `fecha`: Fecha del primer pago del plan

**Tablas base**:
- `fideCondiciones`: Condiciones del fideicomiso
- `propiedades`: Propiedades asociadas
- `inversionista`: Información de inversionistas
- `pdp`: Planes de pago
- `pdpDetalle`: Detalle de planes de pago (subquery)

**Casos de uso**:
- Consultas de reportes de fideicomisos
- Listados de inversionistas con sus propiedades
- Análisis de planes de pago por fideicomiso
- Exportación de datos consolidados

## Flujo de Datos

```
┌─────────────────┐     ┌──────────────┐     ┌──────────────┐
│ fideCondiciones │────▶│ propiedades  │────▶│ inversionista│
└─────────────────┘     └──────────────┘     └──────────────┘
       │                       │
       │                       ▼
       │                 ┌──────────────┐
       └────────────────▶│     pdp      │
                         └──────────────┘
                               │
                               ▼
                         ┌──────────────┐
                         │ pdpDetalle   │
                         │ (subquery)   │
                         └──────────────┘
```

## Estado Actual

- **Total de vistas**: 1
- **Última actualización**: 31/12/2025

## Notas Importantes

1. **LEFT JOIN**: La vista utiliza LEFT JOIN para incluir todos los registros de fideCondiciones aunque no tengan propiedades, inversionistas o planes de pago asociados
2. **Primer pago**: El campo `fecha` muestra solo el primer pago de cada plan de pago (subquery con LIMIT 1)
3. **Bloque**: El campo `bloque` se deriva de los últimos 2 caracteres de `nomDescriptivo`
4. **Ordenamiento**: Los resultados se ordenan por `razonsocial` del inversionista

## Instalación

Ejecutar el script `instalar_todo.sql` para instalar todas las vistas en el orden correcto.
