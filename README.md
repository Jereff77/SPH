# Proyecto SPH Bines Raíces - Sistema de Gestión

## 📋 Descripción General

Este proyecto implementa un sistema de gestión para la empresa SPH Bines Raíces, diseñado para manejar operaciones financieras y de arrendamiento. El sistema incluye módulos para la gestión de propiedades, pagos, conceptos y detalles de contratos.

## 📁 Estructura del Proyecto

```
.
├── .kilocode/
│   └── rules/
│       ├── Contexto.md
│       ├── Creacion y Actualizacion de Modelos DBML.md
│       ├── GUIA_DE_DOCUMENTACION.md
│       ├── INSTRUCCION_DOCUMENTACION.md
│       └── Supabase.md
├── docs/
│   └── dbml/
│       └── schema.dbml
├── arrePdp/
│   ├── README.md
│   └── funciones y trigger/
│       ├── README.md
│       └── instalar_todo.sql
├── arrePdpDetalle/
│   ├── README.md
│   └── funciones y trigger/
│       ├── README.md
│       └── instalar_todo.sql
├── catUsers/
│   ├── README.md
│   └── funciones y trigger/
│       ├── README.md
│       └── instalar_todo.sql
├── cxp/
│   ├── README.md
│   └── funciones y trigger/
│       ├── README.md
│       └── instalar_todo.sql
├── fideicomiso/
│   ├── README.md
│   └── funciones y trigger/
│       ├── README.md
│       └── instalar_todo.sql
├── Leads/
│   ├── README.md
│   └── funciones y trigger/
│       ├── README.md
│       └── instalar_todo.sql
├── Presupuestos/
│   ├── README.md
│   └── funciones y trigger/
│       ├── README.md
│       └── instalar_todo.sql
├── propiedades/
│   ├── README.md
│   └── funciones y trigger/
│       ├── README.md
│       └── instalar_todo.sql
├── raPdp/
│   ├── README.md
│   └── funciones y trigger/
│       ├── README.md
│       └── instalar_todo.sql
├── segModulosUsuarios/
│   ├── README.md
│   └── funciones y trigger/
│       ├── README.md
│       └── instalar_todo.sql
└── README.md
```

## 📊 Tablas Principales

### 1. `rgPdp` (rentaGarantizada)
- **Descripción**: Almacena los planes de pago de arrendamiento garantizados.
- **Componentes asociados**:
  - Funciones: `rgpdp_insertar_registro.sql`, `arrepdp_crear_plan_completo_rpc.sql`, `arrepdp_crear_plan_simple_rpc.sql`, etc.
  - Triggers: Ninguno

### 2. `rgConceptos` (rentaGarantizada)
- **Descripción**: Almacena los conceptos de pago de los planes de arrendamiento garantizados.
- **Componentes asociados**:
  - Funciones: `arrepdp_crear_plan_completo_rpc.sql`, `arrepdp_crear_plan_simple_rpc.sql`, etc.
  - Triggers: Ninguno

### 3. `rgPdpDetalle` (rentaGarantizada)
- **Descripción**: Almacena el detalle de los planes de pago de arrendamiento garantizados.
- **Componentes asociados**:
  - Funciones: `arrepdpdetalle_generar_plan_completo.sql`, `arrepdpdetalle_calcular_cantidad.sql`, etc.
  - Triggers: `trigger_arrepdpdetalle_calcular_cantidad.sql`

## 📝 Documentación

### Tablas con Documentación
- **ArrePdp**: Documentación completa en `arrePdp/README.md`
- **ArrePdpDetalle**: Documentación completa en `arrePdpDetalle/README.md`
- **CatUsers**: Documentación completa en `catUsers/README.md`
- **Cxp**: Documentación completa en `cxp/README.md`
- **Fideicomiso**: Documentación completa en `fideicomiso/README.md`
- **Leads**: Documentación completa en `Leads/README.md`
- **Presupuestos**: Documentación completa en `Presupuestos/README.md`
- **Propiedades**: Documentación completa en `propiedades/README.md`
- **RaPdp**: Documentación completa en `raPdp/README.md`
- **RentaGarantizada**: Documentación completa en `rentaGarantizada/README.md` (NUEVO)
- **SegModulosUsuarios**: Documentación completa en `segModulosUsuarios/README.md`

### Documentación del CRM (NUEVO)
- **Documentación de Tablas CRM**: `docs/CRM/Documentacion_Tablas_CRM.md` - Descripción completa de todas las tablas del CRM
- **Documentación de Funciones CRM**: `docs/CRM/Documentacion_Funciones_CRM.md` - Descripción completa de todas las funciones del CRM
- **Diagrama de Relaciones CRM**: `docs/CRM/schema_crm.dbml` - Diagrama DBML de relaciones entre tablas del CRM
- **README del CRM**: `docs/CRM/README.md` - Guía general del sistema CRM

### Guías de Documentación
- **Guía de Documentación Estándar**: [`/.kilocode/rules/GUIA_DE_DOCUMENTACION.md`](../.kilocode/rules/GUIA_DE_DOCUMENTACION.md)
- **Instrucción de Documentación**: [`/.kilocode/rules/INSTRUCCION_DOCUMENTACION.md`](../.kilocode/rules/INSTRUCCION_DOCUMENTACION.md)
- **Reglas de Supabase**: [`/.kilocode/rules/Supabase.md`](../.kilocode/rules/Supabase.md)

## 🚀 Instalación General

Para instalar todo el sistema:

```bash
# Instalar todo el sistema completo
psql -d nombre_db -f instalar_todo_general.sql

# Instalar módulo específico
psql -d nombre_db -f "cxp/funciones y trigger/instalar_todo.sql"

# Ejecutar pruebas de una función específica
psql -d nombre_db -f "cxp/funciones y trigger/test_cxp_autorizar_solicitud_pago.sql"
```

## 📚 Guías de Estilo

### Estructura de Archivos SQL

#### Encabezado Obligatorio para Funciones
```sql
--[Fecha y Hora]: DD/MM/YYYY HH:MM:SS
--[Descripción]: Descripción clara y concisa de lo que hace la función
--
--[Parámetros]:
--   - p_nombre_param (tipo): Descripción del parámetro
--
--[Salida]:
--   - tipo: Descripción del valor de retorno
--
--[Uso típico]: Descripción de cuándo y cómo se utiliza
--[Ejemplo]: Ejemplo de uso o llamada
--
--[Relaciones]: 
--   - Tablas relacionadas
--   - Funciones/triggers asociados
--
--[Validaciones] (si aplica):
--   - Validaciones realizadas
--   - Condiciones especiales
```

### Convenciones de Nomenclatura

#### Funciones
- Formato: `[modulo]_[tabla]_[accion].sql`
- Ejemplos: `cxp_autorizar_solicitud_pago.sql`, `arrepdp_crear_plan_completo_rpc.sql`
- Prefijo RPC para funciones que encapsulan lógica compleja: `*_rpc`
- Prefijos para tipos de operaciones:
  - `get_*` - Consultas/retrieval
  - `crear_*`, `insertar_*` - Creación
  - `actualizar_*`, `modificar_*` - Actualización
  - `eliminar_*`, `borrar_*` - Eliminación
  - `validar_*` - Validaciones

#### Triggers
- Formato: `trigger_[tabla]_[accion].sql`
- Ejemplos: `trigger_cxp_actualizar_nomcfdi.sql`, `trigger_leads_webhook_uidrc.sql`

#### Vistas
- Prefijo: `v_`
- Ejemplos: `v_resumenPresupuesto.sql`, `v_fideicomiso.sql`

#### Parámetros
- Prefijo: `p_`
- Ejemplo: `p_idcxp`, `p_autorizo`, `p_uidsolicita`

#### Variables Locales
- Prefijo: `v_`
- Ejemplo: `v_categoria_activa`, `v_subtotal`, `v_resultado_plan`

#### Tablas y Campos
- Nombres de tablas: camelCase o snake_case según contexto
- Campos con mayúsculas: USAR COMILLAS DOBLES
  - Correcto: `"idCategoria"`, `"idEstado"`, `"uid"`
  - Incorrecto: `idCategoria`, `idEstado`
- Campos sin mayúsculas: sin comillas
  - Ejemplo: `subtotal`, `id`, `status`

### Tipos de Datos Comunes

#### PostgreSQL
- `uuid` - Identificadores únicos (conversión: `valor::uuid`)
- `text` - Cadenas de texto
- `integer` / `smallint` - Números enteros
- `double precision` - Números decimales
- `numeric` - Valores monetarios precisos
- `boolean` - Verdadero/falso
- `date` - Fechas sin hora
- `timestamp` - Fechas con hora
- `jsonb` - JSON binario optimizado

#### Conversiones Explícitas (Crítico)
Siempre usar conversión explícita cuando haya duda sobre el tipo:
```sql
-- UUID
p_uid::uuid
valor::uuid

-- TEXT
TG_OP::text
p_plazomeses::text

-- NUMERIC/DOUBLE PRECISION
p_plazomeses::double precision
valor::numeric

-- ENUM
'Valor'::"mesGratis"
```

### Estructura de Funciones

#### Firma de Función
```sql
CREATE OR REPLACE FUNCTION public.nombre_funcion(
    p_parametro1 tipo DEFAULT valor_defecto,
    p_parametro2 tipo
)
 RETURNS tipo_retorno
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $function$
```

#### Seguridad
- **SIEMPRE** usar `SECURITY INVOKER` para funciones del sistema
- Las funciones respetan los permisos del usuario que las ejecuta
- Nunca usar `SECURITY DEFINER` a menos que sea absolutamente necesario

#### Manejo de Transacciones
- Las funciones NO deben controlar transacciones con BEGIN/COMMIT/ROLLBACK
- Deben ejecutarse en el contexto de transacción del llamante
- El control de transacciones debe hacerse desde la aplicación o script que llama

#### Manejo de Errores
- Usar `RAISE EXCEPTION` con códigos de error específicos
- Código de error formato: `NOMBRE_ERROR_EN_MAYUSCULAS`
- Retornar información detallada en JSON cuando sea apropiado:
```sql
RETURN jsonb_build_object(
    'exito', false,
    'codigo', 'PARAMETRO_INVALIDO',
    'mensaje', 'El UID del usuario es obligatorio'
);
```

### Códigos de Error Estándar
- `PARAMETRO_INVALIDO` - Parámetro nulo o vacío
- `REGISTRO_NO_ENCONTRADO` - Registro no existe
- `CATEGORIA_INACTIVA` - Categoría con status=false
- `DATOS_INCOMPLETOS_RA_PDP` - Datos incompletos en raPdp
- `CONCEPTO_DUPLICADO` - Duplicidad de conceptos
- `SIN_DATOS_ARRENPROPIEDADES` - Sin datos en arrenPropiedades

### Documentación de Cambios
Siempre incluir comentarios con fecha y descripción:
```sql
--[Actualización]: DD/MM/YYYY - Descripción del cambio
```

### Reglas de Limpieza
- **NO** agregar comentarios de explicación en el código
- **NO** agregar emojis a menos que se solicite explícitamente
- Mantener el código limpio y conciso
- El encabezado con descripción es la única documentación necesaria dentro del archivo

### Instalación y Scripts
- Scripts de instalación: `instalar_todo.sql` en cada módulo
- Scripts de prueba: `test_[nombre_funcion].sql` en cada módulo
- README.md en cada carpeta describe el propósito del módulo
- El script `instalar_todo_general.sql` instala todo el sistema

### Consideraciones de Rendimiento
- Usar CURSOR para consultas que se ejecutan múltiples veces
- Optimizar funciones que insertan muchos registros (batch operations)
- Considerar usar WITH (CTE) para consultas complejas
- Limitar el número de registros en operaciones masivas

### Integración con Aplicaciones
- Funciones RPC devuelven JSON con estructura: `{exito: boolean, datos: any, mensaje: text}`
- Funciones que devuelven múltiples filas: `RETURNS TABLE(columna1 tipo, columna2 tipo)`

## 📚 Ejemplos de Referencia

Consultar los siguientes archivos como referencia:

- `catUsers/funciones y trigger/catusorsinm_validar_telefono.sql` (Función trigger)
- `empresas/vistas/v_resumenempresas.sql` (Vista)
- `empresas/funciones y trigger/README.md` (README de carpeta)
- `instalar_todo_general.sql` (Script de instalación)

## 🔄 Mantenimiento de la Documentación

La documentación debe mantenerse actualizada con cada cambio en los componentes. Revisar y actualizar periódicamente para asegurar que refleje el estado actual del sistema.