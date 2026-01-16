# Guía para Agentes de Código - SPH Bines Raices Sistema de Gestión

## Comandos de Construcción y Pruebas

### Ejecución de Scripts SQL
```bash
# Instalar todo el sistema completo
psql -d nombre_db -f instalar_todo_general.sql

# Instalar módulo específico
psql -d nombre_db -f "cxp/funciones y trigger/instalar_todo.sql"

# Ejecutar pruebas de una función específica
psql -d nombre_db -f "cxp/funciones y trigger/test_cxp_autorizar_solicitud_pago.sql"

# Ejecutar dentro de psql
\i instalar_todo_general.sql
\i "cxp/funciones y trigger/instalar_todo.sql"
```

### Ejecutar Pruebas Individuales
Los archivos de prueba se nombran `test_[nombre_funcion].sql`:
```bash
psql -d nombre_db -f "cxp/funciones y trigger/test_cxp_autorizar_solicitud_pago.sql"
```

## Guías de Estilo de Código

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

### Validaciones y Control de Flujo

#### Validaciones de Entrada
```sql
IF p_parametro IS NULL OR TRIM(p_parametro) = '' THEN
    RETURN jsonb_build_object(
        'exito', false,
        'codigo', 'PARAMETRO_INVALIDO',
        'mensaje', 'El parámetro es obligatorio'
    );
END IF;
```

#### Consultas con Comillas en Campos
```sql
SELECT "idCategoria", subtotal, "idEstado"
FROM public.cxp
WHERE id = p_idcxp;
```

#### Insert/Update con Campos Especiales
```sql
INSERT INTO public.cxp (
    "idCategoria",
    "uid",
    subtotal,
    "idEstado"
) VALUES (
    p_idcategoria,
    p_uid::uuid,  -- Conversión explícita
    p_subtotal,
    1
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
- Manejar errores en la aplicación basándose en los códigos de error retornados
