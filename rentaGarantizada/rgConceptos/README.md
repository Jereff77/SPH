# Documentación de la Tabla rgConceptos

## 📋 Descripción General

La tabla `rgConceptos` almacena los conceptos de pago de los planes de arrendamiento garantizados del sistema SPH. Contiene la información de los conceptos financieros que componen cada plan de pago, incluyendo detalles de montos, fechas y estados.

## 🏗️ Estructura de la Tabla

### Campos Principales

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `idRgConceptos` | text | Identificador único del concepto |
| `fc` | timestamp | Fecha de creación |
| `status` | boolean | Estado del registro (activo/inactivo) |
| `idRtaG` | text | Identificador del plan de pago |
| `concepto` | text | Descripción del concepto de pago |
| `monto` | numeric | Monto del concepto |
| `mesInicio` | smallint | Mes de inicio del concepto |
| `meses` | smallint | Número de meses que dura el concepto |
| `IVA` | numeric | Tasa de IVA del concepto |
| `total` | numeric | Monto total del concepto |
| `uid` | uuid | Identificador único del registro |

### Campos de Control

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `fc` | timestamp | Fecha de creación |
| `uidc` | uuid | Usuario que creó el registro |
| `montoDividido` | boolean | Indica si el monto fue dividido |
| `UltimoPago` | boolean | Marca si es el último pago |
| `ciclo` | integer | Ciclo de pago (año de inicio) |

### Campos de Pago

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `comprobantePago` | text | Referencia del comprobante de pago |
| `cantidadAplicada` | double precision | Monto realmente pagado |
| `uidPago` | uuid | Usuario que registró el pago |
| `fecPago` | date | Fecha del pago realizado |

## 🔗 Relaciones con Otras Tablas

### Relaciones Principales
- **`rentaGarantizada.rgPdp`** (`idRtaG`) - Plan de pago asociado
- **`catUsers`** (`uidc`) - Usuario que crea el registro
- **`catTipoOperacion`** (`tipoOperacion`) - Tipo de operación

### Relaciones Secundarias
- **`inpc`** - Para obtener valores del índice INPC

## 📁 Estructura de Carpetas

```
rentaGarantizada/rgConceptos/
├── funciones y trigger/          # Funciones y triggers asociados
│   ├── README.md               # Documentación detallada de componentes
│   ├── instalar_todo.sql       # Script de instalación completa
│   └── ...                     # Funciones y triggers específicos de rgConceptos
├── vistas/                     # Vistas asociadas (vacío - no hay vistas)
└── README.md                  # Documentación de la tabla principal
```

## 🔄 Flujo de Procesamiento

```mermaid
graph TD
    A[Nuevo Contrato] --> B[Insertar registro en rgConceptos]
    B --> C[Trigger: Calcular Cantidad]
    C --> D{pm2 > 0?}
    D -->|Sí| E[Cálculo Automático]
    D -->|No| F[Valor Manual]
    E --> G[Registro Guardado]
    F --> G
    G --> H[Calcular Años]
    H --> I[arrepdpdetalle_calcular_anio_por_plan]
    I --> J[Recálculo Completo]
    J --> K[arrepdpdetalle_recalcular_anos_contrato]
    K --> L[Actualizar INPC]
    L --> M[arrepdpdetalle_actualizar_inpc]
    M --> N[Lógica Acumulativa]
    N --> O[Contrato Listo]
```

## 🔧 Componentes Disponibles

### Funciones (5)
1. `arrepdp_crear_plan_completo_rpc.sql` - Función RPC principal para crear planes completos
2. `arrepdp_crear_plan_simple_rpc.sql` - Función RPC simplificada con validación de superposición de períodos
3. `arrepdp_generar_detalle_desde_plan.sql` - Función para generar detalles de plan desde un plan existente
4. `arrepdp_agregar_concepto_financiado.sql` - Función para agregar conceptos financiados a planes existentes
5. `arrepdp_eliminar_plan_y_actualizar_estados.sql` - Función para eliminar un plan y actualizar estados de propiedad y nave

### Triggers (0)
- No hay triggers asociados directamente a esta tabla

### Vistas (0)
- No hay vistas asociadas

## 📊 Estado Actual
- **Total funciones**: 5 ✅
- **Total triggers**: 0 ✅
- **Total vistas**: 0 ❌
- **Documentación**: Completa ✅
- **Scripts de instalación**: Disponibles ✅

## 🚀 Instalación
### Instalación Completa
```sql
-- Desde la carpeta funciones y trigger/
\i instalar_todo.sql
```

### Instalación Individual
```sql
-- Instalar funciones en orden
\i arrepdp_crear_plan_completo_rpc.sql
\i arrepdp_crear_plan_simple_rpc.sql
\i arrepdp_generar_detalle_desde_plan.sql
\i arrepdp_agregar_concepto_financiado.sql
\i arrepdp_eliminar_plan_y_actualizar_estados.sql

-- Instalar trigger al final
\i trigger_arrepdpdetalle_calcular_cantidad.sql
```

## 💡 Casos de Uso Típicos

### 1. Crear Nuevo Contrato
```sql
-- Insertar registro en rgConceptos
INSERT INTO "rentaGarantizada"."rgConceptos" (idRgConceptos, fc, status, idRtaG, concepto, monto, mesInicio, meses, IVA, total, uid)
VALUES ('RC_2026_01_01_001', now(), true, 'PROP_001', 'Renta', 15000.0, 1, 24, 16.0, 1920.0, 'uuid_abc123');

-- Calcular años automáticamente
SELECT arrepdpdetalle_calcular_anio_por_plan('PROP_001');

-- Recalcular con manejo de depósitos
SELECT arrepdpdetalle_recalcular_anos_contrato('PROP_001');

-- Actualizar INPC
SELECT * FROM arrepdpdetalle_actualizar_inpc('PROP_001');

-- Actualizar ciclos
SELECT actualizar_ciclo_plan_pago();
```

### 2. Ajuste Manual de Montos
```sql
-- Actualizar campo específico de forma segura
SELECT arrepdpdetalle_actualizar_campo_manual(
    'PROP_001', 3, 'rentaActiva', 'precioM2', 5.2
);
```

### 3. Recálculo Masivo
```sql
-- Recalcular todas las cantidades del sistema
SELECT arrepdpdetalle_recalcular_todas_cantidades();
```

### 4. Actualización Parcial de INPC
```sql
-- Actualizar INPC desde año específico
SELECT * FROM arrepdpdetalle_actualizar_inpc_desde_anio('PROP_001', 3);
```

### 5. Actualización de Ciclos
```sql
-- Actualizar ciclos para todos los contratos
SELECT actualizar_ciclo_plan_pago();
```

### 6. Aplicar Meses de Gracia
```sql
-- Aplicar meses de gracia según configuración JSON del plan
SELECT arrePdpDetalle_aplicar_meses_gracia('PROP_001');

-- Ejemplo con JSON {"renta": 1, "vigilancia": 6, "mantenimiento": 5.5, "administracion": 0}:
-- - Renta: Mes 1 → pm2 = 0, tieneMesGratis = 'Si'
-- - Vigilancia: Meses 1-6 → pm2 = 0, tieneMesGratis = 'Si'
-- - Mantenimiento: Meses 1-5 → pm2 = 0, tieneMesGratis = 'Si'; Mes 6 → pm2 = pm2/2, tieneMesGratis = 'Medio'
-- - Administración: Sin descuentos aplicados
```

### 7. Generación de Plan Completo
```sql
-- Generar plan completo con todos los conceptos
SELECT * FROM arrepdpdetalle_generar_plan_completo(
    'PROP_001', 'ID_ARRENDADOR', 'UUID_USER',
    '2026-01-01', 24, 50000.0, 150.0, 100.0,
    110.5, 2.0, 25.0, 15.0, 10.0,
    0, 1, 2, 0
);
```

### 8. Obtener Resumen de Plan
```sql
-- Obtener resumen agrupado por partida de un plan específico (con validación por defecto)
SELECT * FROM arrepdpdetalle_obtener_resumen_por_plan('PROP_001');

-- Obtener resumen SIN validación de pdpActivo
SELECT * FROM arrepdpdetalle_obtener_resumen_por_plan('PROP_001', false);

-- Resultado esperado: tabla con:
-- - numPartida: número de partida agrupado
-- - anio: año máximo de la partida
-- - fecha: fecha mínima de la partida
-- - pm2, constM2, INPC, ptsINPC, totalINPC: valores del concepto 'Renta'
-- - ciclo: ciclo máximo de la partida
-- - total_cantidad: suma de cantidades de todos los conceptos
-- - idArrePdp: ID del plan
```

## ⚠️ Consideraciones Importantes
1. **Orden de Instalación**: Las funciones dependen de las funciones de `arrepdpDetalle`
2. **Rendimiento**: Las funciones masivas afectan a toda la tabla
3. **Seguridad**: Todas las funciones usan SECURITY INVOKER
4. **Dependencias**: Las funciones de INPC requieren datos en tabla `inpc`
5. **Cálculo Automático**: El trigger garantiza consistencia en cantidades

## 🔗 Políticas RLS
La tabla tiene Row Level Security (RLS) habilitado. Las funciones heredan los permisos del usuario que las ejecuta (SECURITY INVOKER).

## 📝 Historial de Cambios
- **27/11/2025 18:06:00**: Documentación completa de `arrepdp_agregar_concepto_financiado()` - Función para agregar conceptos financiados a planes existentes
- **19/11/2025 11:05**: Creación de `arrepdp_eliminar_plan_y_actualizar_estados()` - Función para eliminar planes y actualizar estados
- **27/10/2025 18:15**: Actualización de `arrepdp_crear_plan_simple_rpc()` - Agregada validación de superposición de períodos
- **27/10/2025 01:51**: Creación de la función RPC simple - `arrepdp_crear_plan_simple_rpc()`
- **27/10/2025**: Creación de la función RPC principal - `arrepdp_crear_plan_completo_rpc()`
- **25/09/2025**: Fecha de referencia de las funciones originales

## 📚 Documentación Adicional
- **Documentación detallada de componentes**: [`funciones y trigger/README.md`](funciones%20y%20trigger/README.md)
- **Script de instalación**: [`funciones y trigger/instalar_todo.sql`](funciones%20y%20trigger/instalar_todo.sql)
- **Guía de documentación**: [`/.kilocode/rules/GUIA_DE_DOCUMENTACION.md`](../.kilocode/rules/GUIA_DE_DOCUMENTACION.md)

---
**Última actualización**: 27/11/2025 18:06:00
**Estado**: Documentación completa ✅
**Componentes listos para instalación**: 5/5 ✅