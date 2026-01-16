# supaSPH-QR - Sistema de Gestión

## Overview

Sistema integral de gestión para el proyecto supaSPH-QR, desarrollado con Supabase y PostgreSQL. Este sistema incluye módulos para gestión de arrendamientos, catálogos, leads, usuarios y cuentas por pagar.

## Estructura del Proyecto

```
supaSPH-QR/
├── README.md                          # Este archivo
├── instalar_todo_general.sql          # Script de instalación general
├── funciones generales/               # Funciones generales del sistema (NUEVO)
│   ├── README.md                      # Documentación de funciones generales
│   ├── instalar_todo.sql              # Script de instalación
│   └── *.sql                          # Archivos de funciones generales
├── arrePdp/                           # Módulo de planes de pago principales (NUEVO)
│   ├── README.md                      # Documentación del módulo
│   └── funciones y trigger/           # Funciones y triggers del módulo
│       ├── README.md                  # Documentación de funciones
│       ├── instalar_todo.sql          # Script de instalación del módulo
│       └── *.sql                      # Archivos de funciones y triggers
├── arrePdpDetalle/                    # Módulo de detalles de planes de pago
│   ├── README.md                      # Documentación del módulo
│   └── funciones y trigger/           # Funciones y triggers del módulo
│       ├── README.md                  # Documentación de funciones
│       ├── instalar_todo.sql          # Script de instalación del módulo
│       └── *.sql                      # Archivos de funciones y triggers
├── catAsesoresInm/                    # Módulo de asesores inmobiliarios
│   ├── README.md                      # Documentación del módulo
│   └── funciones y trigger/           # Funciones y triggers del módulo
│       ├── README.md                  # Documentación de funciones
│       ├── instalar_todo.sql          # Script de instalación del módulo
│       └── *.sql                      # Archivos de funciones y triggers
├── catUsers/                          # Módulo de catálogo de usuarios
│   ├── Politicas_RLS_catUsers.md    # Políticas RLS
│   └── Politicas_RLS_catUsers.sql    # Implementación de políticas
├── Leads/                             # Módulo de gestión de leads
│   ├── Funciones_Leads.md              # Documentación de funciones
│   ├── Politicas_Leads_Definitivas.md # Políticas
│   ├── Politicas_Leads_Definitivas.sql # Implementación
│   ├── Verificacion_Politicas_Leads_Definitivas.sql # Verificación
│   ├── Correccion_Politica_Vista_Gerencial.md # Corrección
│   ├── Implementacion_Politicas_Leads_Definitivas.sql # Implementación
│   ├── consulta_leads_sin_actualizaciones.sql # Consulta
│   └── funciones y trigger/           # Funciones y triggers del módulo
│       ├── README.md                  # Documentación de funciones
│       ├── instalar_todo.sql          # Script de instalación del módulo
│       └── *.sql                      # Archivos de funciones y triggers
├── propiedades/                        # Módulo de gestión de propiedades (NUEVO)
│   ├── README.md                      # Documentación del módulo
│   └── funciones y trigger/           # Funciones y triggers del módulo
│       ├── README.md                  # Documentación de funciones
│       ├── instalar_todo.sql          # Script de instalación del módulo
│       └── *.sql                      # Archivos de funciones y triggers
├── segModulosUsuarios/                # Módulo de seguridad y permisos
│   ├── Politicas_RLS_segModulosUsuarios.md # Políticas RLS
│   └── Politicas_RLS_segModulosUsuarios.sql # Implementación
├── Presupuestos/                        # Módulo de Presupuestos (NUEVO)
│   ├── README.md                      # Documentación del módulo
│   ├── PresDetalle.md                 # Documentación de tabla PresDetalle
│   ├── funciones y trigger/           # Funciones y triggers del módulo
│   │   ├── README.md                  # Documentación de funciones
│   │   ├── instalar_todo.sql          # Script de instalación de funciones
│   │   └── *.sql                      # Archivos de funciones y triggers
│   └── vistas/                        # Vistas del módulo
│       ├── README.md                  # Documentación de vistas
│       ├── instalar_todo.sql          # Script de instalación de vistas
│       └── *.sql                      # Archivos de vistas
└── cxp/                               # Módulo de Cuentas por Pagar (CXP)
    ├── README.md                      # Documentación del módulo
    └── funciones y trigger/           # Funciones y triggers del módulo
        ├── README.md                  # Documentación de funciones
        ├── instalar_todo.sql          # Script de instalación del módulo
        └── *.sql                      # Archivos de funciones y triggers
└── fideicomiso/                       # Módulo de Fideicomisos (NUEVO)
    ├── README.md                      # Documentación del módulo
    ├── funciones y trigger/           # Funciones del módulo
    │   ├── README.md                  # Documentación de funciones
    │   ├── instalar_todo.sql          # Script de instalación de funciones
    │   └── *.sql                      # Archivos de funciones
    └── vistas/                        # Vistas del módulo
        ├── README.md                  # Documentación de vistas
        ├── instalar_todo.sql          # Script de instalación de vistas
        └── *.sql                      # Archivos de vistas
```

## Módulos del Sistema

### 1. funciones generales (NUEVO)
Funciones generales del sistema que no están asociadas a tablas específicas.

**Funciones principales:**
- `cdg` - Consulta Dinámica General para ejecución segura de consultas SELECT encriptadas

### 2. arrePdp (NUEVO)
Gestiona los planes de pago principales de arrendamiento con una función RPC que encapsula todo el proceso de creación.

**Funciones principales:**
- `arrepdp_crear_plan_completo_rpc` - Función RPC que reemplaza ~300 líneas de código Flutter
- `arrepdp_crear_plan_simple_rpc` - Función RPC para planes simples con parámetros pm2 e inpcPlus
- `arrepdp_agregar_concepto_financiado` - Función para agregar conceptos financiados a planes existentes (documentada)
- `rapdp_obtener_datos_propiedad` - Función para obtener datos de propiedad (idNavArrend, comSPH, idRtaA)
- `rapdp_Actualizar` - Función para actualizar campos comSPH e idRtaA en arrePdpDetalle (solo registros con concepto='Renta')

### 3. arrePdpDetalle
Gestiona los detalles de los planes de pago de arrendamiento, incluyendo cálculos de cantidades, actualización de INPC y generación de planes completos.

**Funciones principales:**
- `arrepdpdetalle_calcular_cantidad` - Calcula cantidades en partidas
- `arrepdpdetalle_actualizar_inpc` - Actualiza valores de INPC
- `arrepdpdetalle_actualizar_inpc_desde_anio` - Actualiza INPC desde año específico
- `arrepdpdetalle_generar_plan_completo` - Genera plan completo de pagos
- `arrepdpdetalle_recalcular_anos_contrato` - Recalcula años de contrato
- `arrepdpdetalle_recalcular_todas_cantidades` - Recalcula todas las cantidades
- `trigger_arrepdpdetalle_calcular_cantidad` - Trigger para recálculo automático

### 4. catAsesoresInm
Catálogo de asesores inmobiliarios con validación de teléfonos únicos y relación con usuarios.

**Funciones principales:**
- `catasesoresinm_validar_telefono` - Valida si un teléfono ya existe y retorna el usuario que lo registró

### 5. catUsers
Catálogo principal de usuarios del sistema con perfiles y permisos.

**Componentes:**
- `Politicas_RLS_catUsers.md` - Documentación de políticas RLS
- `Politicas_RLS_catUsers.sql` - Implementación de políticas de seguridad

### 6. Leads
Gestión de leads del sistema con funciones de aprobación y seguimiento.

**Componentes:**
- `Funciones_Leads.md` - Documentación de funciones
- `Politicas_Leads_Definitivas.md` - Políticas de negocio
- `Politicas_Leads_Definitivas.sql` - Implementación de políticas
- `Verificacion_Politicas_Leads_Definitivas.sql` - Verificación de políticas
- `Correccion_Politica_Vista_Gerencial.md` - Corrección de políticas
- `Implementacion_Politicas_Leads_Definitivas.sql` - Implementación final
- `leads_poraprobar_obtener_detalle` - Función para obtener detalles de leads por aprobar
- `trigger_leads_poraprobar_validar_y_migrar_automaticamente` - Trigger automático para validación y migración al insertar
- `leads_poraprobar_validar_y_migrar_similitud_trigger_func` - Función auxiliar del trigger automático

### 7. propiedades (NUEVO)
Gestión de propiedades del sistema con validación de eliminación segura.

**Funciones principales:**
- `propiedades_eliminar_propiedad` - Elimina propiedades validando que no tengan pagos aplicados

### 8. segModulosUsuarios
Módulo de seguridad para gestión de permisos por usuario y módulo.

**Componentes:**
- `Politicas_RLS_segModulosUsuarios.md` - Documentación de políticas RLS
- `Politicas_RLS_segModulosUsuarios.sql` - Implementación de políticas de seguridad

### 9. Presupuestos (NUEVO)
Gestiona la creación y mantenimiento de presupuestos anuales con sus detalles mensuales.

**Funciones principales:**
- `presdetalle_crear_registros_completos` - Crea los 12 registros mensuales del presupuesto para una categoría específica usando el año del presupuesto activo

**Vistas principales:**
- `v_resumenPresupuesto` - Vista principal de resumen presupuestario con KPIs y estados de alerta para control presupuestario

### 10. cxp (Cuentas por Pagar)
Gestiona el ciclo completo de pagos a proveedores, desde la solicitud hasta la autorización y pago final. Incluye validación de fechas habilitadas, gestión de proveedores, control de estados de pago y actualización automática de datos.

**Funciones principales:**
- `cxp_agregar_fecha_manual` - Agrega fechas específicas manualmente
- `cxp_actualizar_nomcfdi_vacio` - Función que verifica y actualiza el campo nomCFDI cuando está vacío después de insertar un registro
- `cxp_autorizar_solicitud_pago` - Autoriza solicitudes de pago con validación de presupuesto y opción para omitir validación para usuarios autorizados
- `cxp_fechas_habilitadas_anual` - Genera calendario anual de fechas
- `cxp_fechas_habilitadas_actualizar_dia_semana` - Trigger para actualizar día de la semana
- `cxp_get_estado_cuenta_detalle` - Obtiene estado de cuenta con filtros
- `cxp_get_filtros_dependientes` - Obtiene filtros dependientes para UI
- `cxp_get_unique_values` - Obtiene valores únicos para listas desplegables
- `cxp_puede_autorizar` - Verifica si se pueden autorizar pagos hoy
- `cxp_puede_insertar` - Verifica si se pueden insertar registros hoy
- `cxp_probar_validacion_proveedor` - Prueba validación de proveedores
- `cxp_trigger_validar_fecha` - Trigger principal de validación de operaciones
- `trigger_cxp_actualizar_nomcfdi` - Trigger que se ejecuta después de insertar para actualizar nomCFDI cuando está vacío
- `cxp_validar_fecha_habilitada` - Valida si una fecha está habilitada
- `cxp_validar_y_actualizar_proveedor` - Valida y actualiza datos de proveedores

### 11. fideicomiso (NUEVO)
Gestiona la configuración y cálculos de rendimientos de fideicomisos con promociones del 9% durante el primer año.

**Funciones principales:**
- `fideicomiso_rendimientos_promocion` - Calcula rendimientos considerando promoción del 9% durante el primer año desde el primer pago de cada inversionista
- `fideicomiso_rendimientos_resumen_consulta` - Resumen por inversionista con totales consolidados
- `resumen_fideicomiso_completo` - Resumen consolidado con filtros opcionales por período

**Vistas principales:**
- `v_fideicomiso` - Vista consolidada de fideicomisos con información de propiedades, inversionistas y planes de pago

## Instalación

### Instalación Completa del Sistema
Para instalar todos los componentes del sistema:

```sql
-- Instalar todas las funciones y triggers
\i instalar_todo_general.sql
```

### Instalación por Módulos
Para instalar módulos específicos:

```sql
-- Instalar funciones generales
\i 'funciones generales/instalar_todo.sql'

-- Instalar arrePdp
\i arrePdp/funciones y trigger/instalar_todo.sql

-- Instalar arrePdpDetalle
\i arrePdpDetalle/funciones y trigger/instalar_todo.sql

-- Instalar catAsesoresInm
\i catAsesoresInm/funciones y trigger/instalar_todo.sql

-- Instalar Leads
\i Leads/funciones y trigger/instalar_todo.sql

-- Instalar propiedades
\i propiedades/funciones y trigger/instalar_todo.sql

-- Instalar segModulosUsuarios
\i segModulosUsuarios/Politicas_RLS_segModulosUsuarios.sql

-- Instalar catUsers
\i catUsers/Politicas_RLS_catUsers.sql

-- Instalar Presupuestos (funciones)
\i Presupuestos/funciones y trigger/instalar_todo.sql

-- Instalar Presupuestos (vistas)
\i Presupuestos/vistas/instalar_todo.sql

-- Instalar CXP
\i cxp/funciones y trigger/instalar_todo.sql

-- Instalar fideicomiso (funciones)
\i fideicomiso/funciones y trigger/instalar_todo.sql

-- Instalar fideicomiso (vistas)
\i fideicomiso/vistas/instalar_todo.sql
```

## Estándares de Documentación

Todos los componentes del sistema siguen la guía de documentación estándar del proyecto.

### Encabezado Obligatorio
```sql
--[Fecha y Hora]: DD/MM/YYYY HH:MM:SS
--[Descripción]: Descripción clara y concisa del componente
--
--[Parámetros] (si aplica):
--   - nombre_parametro (tipo): Descripción del parámetro
--
--[Salida] (si aplica):
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
- **Funciones**: `tabla_funcion_descripcion.sql`
- **Triggers**: `trigger_tabla_accion.sql`
- **Vistas**: `v_nombrevista.sql`
- **Tablas y campos**: Usar comillas dobles si tienen mayúsculas: `"nombreCampo"`

## Estado Actual del Sistema

### Resumen de Componentes
- **Total de funciones**: 31+
- **Total de triggers**: 5+
- **Total de vistas**: 2+
- **Total de módulos**: 11
- **Última actualización**: 31/12/2025 11:06:00

### Cambios Recientes

#### 22/11/2025 04:43
- **Corrección completa de tipos de datos y campos en arrepdp_crear_plan_simple_rpc**: Se corrigieron múltiples errores de tipos y estructura
- **Problemas resueltos**:
  - Error en `ROUND()`: `p_plazomeses` (smallint) necesita conversión explícita a double precision
  - Campos no existentes: `numDepositos` y `montoMensual` en el INSERT
  - Conversión de tipos incorrecta en cálculo de intervalos
  - Estructura del INSERT con campos que no existen en la tabla
- **Solución aplicada**:
  - Conversión explícita: `p_plazomeses::double precision` en `ROUND()`
  - Conversión explícita: `p_plazomeses::text` en cálculo de intervalos
  - Eliminados campos no existentes del INSERT
  - Mantenida estructura correcta solo con campos existentes
  - Mantenida compatibilidad con respuesta JSON y lógica de negocio
- **Impacto**: Evita errores de tipo y estructura al crear planes de pago, usando correctamente los tipos de datos
- **Componentes actualizados**:
  - Función `arrepdp_crear_plan_simple_rpc.sql` corregida
  - README.md del módulo arrePdp actualizado con documentación completa
  - Script de instalación del módulo arrePdp actualizado
  - README.md general actualizado con la corrección

#### 22/11/2025 04:33
- **Corrección crítica en validación de superposición y campos booleanos de arrepdp_crear_plan_simple_rpc**: Se corrigió el uso incorrecto de valores de texto en campos booleanos
- **Problema resuelto**: La función usaba incorrectamente valores de texto ('Vigente', 'Concluido') en campos booleanos `status` y `vigente`
- **Solución aplicada**:
  - Corregida validación de superposición para usar campos booleanos:
    - `"status" = true AND "vigente" = true` en lugar de `IN ('Vigente', 'Concluido')`
  - Corregido INSERT para usar valores booleanos:
    - `status = true, vigente = true` en lugar de `'Vigente'`
  - Agregado campo `"vigente"` en el INSERT (faltaba)
  - Mantenida compatibilidad con respuesta JSON ('estatus': 'Vigente')
- **Impacto**: Evita errores de tipo al validar superposición y al insertar planes, usando correctamente los campos booleanos
- **Componentes actualizados**:
  - Función `arrepdp_crear_plan_simple_rpc.sql` corregida
  - README.md del módulo arrePdp actualizado con documentación del cambio
  - Script de instalación del módulo arrePdp actualizado
  - README.md general actualizado con la corrección

#### 22/11/2025 04:15
- **Corrección adicional en validación de disponibilidad de arrepdp_crear_plan_simple_rpc**: Se corrigió el uso incorrecto del campo "status"
- **Problema resuelto**: La función usaba incorrectamente el campo `"status"` (booleano) para validar si la nave estaba "Disponible"
- **Solución aplicada**:
  - Corregida la lógica de validación para usar los campos correctos:
    - `status` (boolean): Para verificar si la nave está activa
    - `tienePdp` (boolean): Para verificar si tiene plan de pago
    - `pdpActivo` (boolean): Para verificar si el plan está activo
  - Lógica correcta: Una nave está disponible si está activa Y no tiene un PDP activo
  - Actualizadas las variables para usar tipos booleanos correctos
- **Impacto**: Mejora la validación de disponibilidad usando la lógica correcta de campos booleanos
- **Componentes actualizados**:
  - Función `arrepdp_crear_plan_simple_rpc.sql` corregida
  - README.md del módulo arrePdp actualizado con documentación del cambio
  - Script de instalación del módulo arrePdp actualizado
  - README.md general actualizado con la corrección

#### 22/11/2025 03:15
- **Corrección crítica en arrepdp_crear_plan_simple_rpc**: Se eliminó la modificación incorrecta del campo "status"
- **Problema resuelto**: La función estaba modificando incorrectamente el campo `"status"` de `arrenPropiedades` poniéndolo en `false`
- **Solución aplicada**:
  - Eliminada la línea `"status" = false` del UPDATE
  - Ahora solo se actualizan campos específicos del plan: `idArrePdp`, `tienePdp`, `pdpActivo`
  - El campo `"status"` permanece siempre en `true` (indica que el registro está activo)
- **Impacto**: Evita desactivación incorrecta de propiedades al crear planes de pago
- **Componentes actualizados**:
  - Función `arrepdp_crear_plan_simple_rpc.sql` corregida
  - README.md del módulo arrePdp actualizado con documentación del cambio
  - Script de instalación del módulo arrePdp actualizado
  - README.md general actualizado con la corrección

#### 22/11/2025 02:29
- **Corrección completa con parámetros pm2 e inpcPlus en función simple**: Se modificó `arrepdp_crear_plan_simple_rpc` para aceptar parámetros directos
- **Nuevos parámetros agregados**:
  - `p_pm2_admin` (double precision): Precio por m² de administración
  - `p_pm2_mtto` (double precision): Precio por m² de mantenimiento
  - `p_pm2_vig` (double precision): Precio por m² de vigilancia
  - `p_inpc_plus` (double precision): Puntos INPC adicionales
- **Corrección de conversión UUID**: Se corrigió el problema de conversión de tipo UUID en múltiples funciones:
  - `arrepdp_crear_plan_simple_rpc`: Agregada conversión `p_uid::uuid` en INSERT a arrePdp
  - `arrepdp_crear_plan_completo_rpc`: Agregada conversión `p_uid::uuid` en INSERT a arrePdp y arreConceptos
  - `arrepdp_generar_corrida_desde_plan_simple`: Eliminada conversión "::uuid" del campo uid
  - `arrepdp_generar_detalle_desde_plan`: Eliminada conversión "::uuid" del campo uid
- **Componentes actualizados**:
  - README.md del módulo arrePdp actualizado con nueva documentación
  - Script de instalación del módulo arrePdp actualizado
  - README.md general actualizado con los cambios

#### 07/11/2025
- **Nueva funcionalidad de actualización automática de nomCFDI**: Se agregó función y trigger para actualizar automáticamente el campo nomCFDI cuando está vacío después de insertar un registro
- **Nuevos componentes**:
  - `cxp_actualizar_nomcfdi_vacio`: Función que verifica si nomCFDI está vacío y lo actualiza con el valor de nombreProveedor
  - `trigger_cxp_actualizar_nomcfdi`: Trigger que se ejecuta después de insertar para llamar a la función de actualización
- **Componentes actualizados**:
  - Script de instalación del módulo CXP actualizado para incluir nuevos componentes
  - README.md del módulo CXP actualizado con documentación completa de la nueva funcionalidad
  - README.md general actualizado con la nueva función y trigger

#### 05/11/2025
- **Modificación de función `cxp_autorizar_solicitud_pago`**: Se corrigió la lógica de validación para autorización fuera de presupuesto
- **Función mejorada**:
  - `cxp_autorizar_solicitud_pago`: Ahora compara `p_autorizo` (UID del usuario que autoriza) con la configuración "Aprobar fuera de presupuesto" en lugar de `p_uidsolicita`
- **Componentes actualizados**:
  - Lógica de validación corregida en línea 139
  - Documentación actualizada con nueva descripción y parámetros
  - README.md del módulo actualizado con explicación correcta del flujo
  - Script de pruebas actualizado con casos específicos para el nuevo comportamiento
  - Script de instalación actualizado con nota sobre la modificación
  - README.md general actualizado con el cambio

#### 30/10/2025
- **Mejora completa de vista `v_resumenPresupuesto`**: Se agregó cobertura total y columna de estado
- **Vista mejorada**:
  - `v_resumenPresupuesto`: Ahora incluye TODAS las categorías (activas e inactivas)
  - Se agregó columna `presupuestable` desde la tabla `PresCategorias`
  - Se agregó columna `status` para indicar si la categoría está activa o no
- **Componentes actualizados**:
  - Modificación del CTE `categorias` para incluir columna `status`
  - Modificación del CTE `todas_categorias` para incluir todas las categorías
  - Eliminación de filtro restrictivo que excluía categorías sin actividad
  - Documentación actualizada con ejemplos para filtrar por estado y presupuestabilidad
  - READMEs del módulo y general actualizados
  - Se mantiene compatibilidad con nombres de columnas existentes

#### 30/10/2025 (anterior)
- **Mejora de vista `v_resumenPresupuesto`**: Se agregó cobertura total de categorías
- **Vista mejorada**:
  - `v_resumenPresupuesto`: Ahora incluye TODAS las categorías activas, incluso las sin presupuesto ni gastos
  - Se agregó columna `presupuestable` desde la tabla `PresCategorias`
- **Componentes actualizados**:
  - Modificación del CTE `todas_categorias` para incluir todas las categorías
  - Eliminación de filtro restrictivo que excluía categorías sin actividad
  - Documentación actualizada con ejemplos para categorías sin presupuesto
  - READMEs del módulo y general actualizados
  - Se mantiene compatibilidad con nombres de columnas existentes

#### 30/10/2025 (anterior)
- **Mejora de vista `v_resumenPresupuesto`**: Se agregó la columna `presupuestable` desde la tabla `PresCategorias`
- **Vista mejorada**:
  - `v_resumenPresupuesto`: Ahora incluye indicador de si la categoría es presupuestable o no
- **Componentes actualizados**:
  - Documentación de la vista actualizada con nueva columna
  - Ejemplos de uso actualizados para filtrar por categorías presupuestables
  - READMEs del módulo y general actualizados
  - Se mantiene compatibilidad con nombres de columnas existentes

#### 30/10/2025 (anterior)
- **Documentación de vista `v_resumenPresupuesto`**: Documentación completa de la vista principal de resumen presupuestario
- **Vista documentada**:
  - `v_resumenPresupuesto`: Vista principal con KPIs y estados de alerta para control presupuestario
- **Componentes creados**:
  - Carpeta de vistas para el módulo Presupuestos
  - Documentación completa de la vista con ejemplos de uso
  - Script de instalación específico para vistas
  - Actualización de READMEs del módulo y general

#### 30/10/2025 (anterior)
- **Creación del módulo `Presupuestos`**: Documentación completa de todas las funciones y triggers del módulo de gestión de presupuestos
- **Funciones documentadas**:
  - `presdetalle_crear_registros_completos`: Función para crear 12 registros mensuales del presupuesto para una categoría específica
- **Componentes creados**:
  - Estructura completa de carpetas para Presupuestos
  - README.md general del módulo con flujo de procesamiento
  - Script de instalación con orden correcto y verificación

## Políticas de Seguridad (RLS)

El sistema implementa políticas de seguridad a nivel de fila (Row Level Security) para proteger los datos según los perfiles de usuario.

## Soporte y Mantenimiento

Para reportar issues o solicitar cambios, seguir el protocolo establecido en el proyecto y asegurar la documentación correspondiente.

## Consideraciones Técnicas

- Todas las funciones utilizan `SECURITY INVOKER` por defecto
- Se manejan excepciones para evitar errores en la aplicación
- Se sigue un patrón de nomenclatura consistente en todo el sistema
- Se incluyen validaciones de estado (status = true) en las consultas

## 📝 Cambios Recientes

### 12/12/2025 09:51:00
- **Corrección crítica en función arrepdpdetalle_aplicar_meses_gracia**: Se corrigieron dos problemas importantes que causaban errores al ejecutar la función
- **Problemas resueltos**:
  1. **Error de transacción**: "ERROR: 2D000: invalid transaction termination" en línea 134
     - Causa: La función intentaba controlar explícitamente transacciones con BEGIN/COMMIT/ROLLBACK dentro de una FUNCTION
     - Solución: Eliminado el control explícito de transacciones, permitiendo que la función se ejecute en el contexto de transacción del llamante
  2. **Error de tipo de datos**: "ERROR: 42804: column "tieneMesGratis" is of type "mesGratis" but expression is of type text"
     - Causa: Se intentaba asignar valores TEXT a un campo de tipo ENUM "mesGratis"
     - Solución: Agregado casteo explícito al tipo ENUM para todas las asignaciones al campo "tieneMesGratis"
- **Solución implementada**:
  - Eliminado bloque BEGIN/EXCEPTION/END con control de transacciones
  - Modificada declaración de variable v_tiene_mes_gracia a tipo "mesGratis"
  - Agregados casteos explícitos: 'Si'::"mesGratis", 'Medio'::"mesGratis", NULL::"mesGratis"
  - Actualizada documentación para reflejar que la función se ejecuta en contexto de transacción del llamante
- **Impacto**: Función ahora ejecuta correctamente sin errores de transacción ni de tipo de datos
- **Componentes actualizados**:
  - Función `arrepdpdetalle_aplicar_meses_gracia.sql` corregida
  - README.md del módulo arrePdpDetalle actualizado con las correcciones
  - Script de instalación del módulo arrePdpDetalle actualizado
  - README.md general actualizado con las correcciones realizadas

### 01/12/2025 01:58:49
- **Corrección de trigger leads_webhook_uidrc**: Se corrigieron los tipos de datos en los parámetros del trigger
- **Problema resuelto**: El trigger estaba pasando parámetros sin las conversiones explícitas de tipo necesarias para la función `leads_enviar_webhook_uidrc`
- **Solución implementada**:
  - Agregadas conversiones explícitas de tipo (`::uuid`, `::text`) en los parámetros del trigger
  - `NEW.id::uuid` para asegurar tipo UUID para el primer parámetro
  - `TG_OP::text` para asegurar tipo texto para el segundo parámetro
  - `OLD."uidRC"::uuid` y `NULL::uuid` para asegurar tipo UUID en el tercer parámetro
  - Actualizada documentación del trigger con fecha y hora actual
  - Actualizado README.md del módulo Leads con la corrección realizada
  - Actualizado script de instalación del módulo Leads con la corrección
- **Impacto**: Trigger ahora funciona correctamente con la firma de la función, evitando errores de tipo de datos
- **Componentes actualizados**:
  - Trigger `trigger_leads_webhook_uidrc.sql` corregido
  - README.md del módulo Leads actualizado con la corrección
  - Script de instalación del módulo Leads actualizado
  - README.md general actualizado con la corrección realizada

### 27/11/2025 18:06:00
- **Documentación completa de arrepdp_agregar_concepto_financiado**: Se documentó completamente la función para agregar conceptos financiados a planes existentes
- **Cambios realizados**:
  - Actualizado encabezado completo con fecha y hora actual
  - Documentación detallada según estándares del proyecto
  - Agregadas secciones de uso típico, validaciones y consideraciones de seguridad
  - Actualizado script de instalación para indicar que la función está documentada
  - Actualizado README.md del módulo con información detallada de la función
  - Actualizado README.md general con la nueva función documentada
- **Impacto**: Función completamente documentada según guías del proyecto
- **Componentes actualizados**:
  - Función `arrepdp_agregar_concepto_financiado.sql` documentada
  - README.md del módulo arrePdp actualizado
  - Script de instalación del módulo arrePdp actualizado
  - README.md general actualizado con la nueva función

### 27/11/2025 18:13:00
- **Corrección de problema de duplicidad en arrepdp_agregar_concepto_financiado**: Se agregó validación para prevenir conceptos duplicados en el mismo mes
- **Problema resuelto**: Cuando se intentaba agregar un concepto en un mes donde ya existía otro concepto para el mismo plan, la función marcaba error de duplicidad
- **Solución implementada**:
  - Agregada validación para verificar si ya existe un concepto con el mismo nombre en el mes especificado para este plan
  - Nueva validación consulta la tabla `arrePdpDetalle` buscando duplicados por `idArrePdp`, `numPartida`, `concepto` y `status = true`
  - Nuevo código de error: `CONCEPTO_DUPLICADO` con mensaje descriptivo
  - Actualizada documentación de la función con la nueva validación
  - Actualizados README.md del módulo y general con la nueva funcionalidad
- **Impacto**: Función ahora previene correctamente la duplicidad de conceptos en el mismo mes para el mismo plan
- **Componentes actualizados**:
  - Función `arrepdp_agregar_concepto_financiado.sql` con nueva validación de duplicidad
  - README.md del módulo arrePdp actualizado con documentación de la validación
  - README.md general actualizado con la corrección realizada

## 🔄 Registro de Cambios

### 2025-01-27
- **Corrección**: Función `arrepdp_agregar_concepto_financiado()` - Corregida generación de ID único para evitar violación de constraint
- **Mejora**: Implementada generación de IDs únicos usando timestamp y hash aleatorio
- **Actualización**: Validación corregida para permitir múltiples conceptos diferentes en el mismo mes

### 2024-12-01
- **Mejora**: Actualización de documentación general del proyecto
- **Corrección**: Estandarización de formatos de documentación en todos los módulos

### 2025-12-04 05:20:00
- **NUEVO TRIGGER**: Implementación de `trigger_leads_poraprobar_validar_y_migrar_automaticamente`
  - Trigger automático que ejecuta validación y migración al insertar nuevos leads
  - Implementado con manejo de errores para no afectar inserciones
  - Función auxiliar `leads_poraprobar_validar_y_migrar_similitud_trigger_func` creada
  - Sistema de validación automática ahora funciona sin intervención manual
- **Componentes actualizados**:
  - Leads/funciones y trigger/trigger_leads_poraprobar_validar_y_migrar_automaticamente.sql
  - Leads/funciones y trigger/instalar_todo.sql
  - Leads/funciones y trigger/README.md
  - README.md general del proyecto
- **Impacto**: Sistema de leads ahora incluye validación y migración automática completa al insertar nuevos registros

### 2025-12-17 17:44:00
- **MEJORA**: Función `rapdp_Actualizar` mejorada con parámetro opcional para limpiar valores
- **Cambios realizados**:
  - Agregado parámetro opcional `p_actualizar_valores` (boolean, default true)
  - Cuando `p_actualizar_valores` es false: establece `idRtaA = null` y `comSPH = 0`
  - Cuando `p_actualizar_valores` es true (default): usa los valores de raPdp como antes
  - Modificada validación de datos raPdp para que solo se ejecute cuando `p_actualizar_valores` es true
  - Actualizada lógica de actualización para manejar ambos casos
  - Incluido campo `actualizar_valores` en la respuesta JSON
- **Ejemplos de uso**:
  - `SELECT * FROM rapdp_Actualizar('ABcqzhvE8a3x')` - Actualiza con valores de raPdp
  - `SELECT * FROM rapdp_Actualizar('ABcqzhvE8a3x', false)` - Limpia valores (idRtaA=null, comSPH=0)
- **Componentes actualizados**:
  - Función `rapdp_Actualizar.sql` modificada con nuevo parámetro y lógica
  - README.md del módulo raPdp actualizado con documentación completa
  - Script de instalación del módulo raPdp actualizado con nuevos ejemplos
  - README.md general del proyecto actualizado con la mejora realizada
- **Impacto**: La función ahora permite tanto actualizar con valores de raPdp como limpiar los campos según se necesite

### 2025-12-17 17:22:30
- **CORRECCIÓN**: Función `rapdp_Actualizar` corregida con validaciones mejoradas y filtro por concepto='Renta'
- **Problema resuelto**: La función original no validaba adecuadamente que `comSPH` e `idRtaA` no fueran nulos, y mezclaba validaciones de diferentes tablas
- **Cambios realizados**:
  - `rapdp_Actualizar`: Agregada condición `AND concepto = 'Renta'` en la consulta UPDATE
  - Separadas validaciones para verificar específicamente:
    - `comSPH` e `idRtaA` no nulos (datos de raPdp)
    - `idNavArrend` no nulo (datos de arrenPropiedades)
  - Nuevos códigos de error agregados: `DATOS_INCOMPLETOS_RA_PDP` y `SIN_DATOS_ARRENPROPIEDADES`
  - Actualizada documentación para reflejar las nuevas validaciones
- **Resultado de pruebas**:
  - Función probada con ID 'ABcqzhvE8a3x' actualizó correctamente 36 registros con concepto='Renta'
  - Registros con concepto diferente a 'Renta' permanecieron sin cambios (comSPH=0, idRtaA="")
  - La función ahora previene actualizaciones con valores nulos
- **Componentes actualizados**:
  - Función `rapdp_Actualizar.sql` corregida con validaciones mejoradas
  - README.md del módulo raPdp actualizado con documentación de las correcciones
  - Script de instalación del módulo raPdp actualizado con notas sobre las correcciones
  - README.md general del proyecto actualizado con la corrección realizada
- **Impacto**: La función ahora actualiza correctamente solo los registros con concepto='Renta' y previene errores por datos nulos

### 2025-12-31 11:06:00
- **Documentación completa del módulo fideicomiso**: Se documentó completamente la tabla de fideicomiso y todos sus componentes asociados
- **Nuevos componentes documentados**:
  - Tabla `fideicomiso` con estructura completa, relaciones y notas importantes
  - Función `fideicomiso_rendimientos_promocion` - Calcula rendimientos considerando promoción del 9% durante el primer año
  - Función `fideicomiso_rendimientos_resumen_consulta` - Resumen por inversionista con totales consolidados
  - Función `resumen_fideicomiso_completo` - Resumen consolidado con filtros opcionales por período
  - Vista `v_fideicomiso` - Vista consolidada de fideicomisos con información relacionada
- **Estructura creada**:
  - Carpeta `fideicomiso/` con documentación completa
  - Subcarpeta `funciones y trigger/` con 3 funciones documentadas
  - Subcarpeta `vistas/` con 1 vista documentada
  - Scripts de instalación para funciones y vistas
  - README.md detallados para cada nivel
- **Características documentadas**:
  - Manejo de períodos mixtos (promoción + normal)
  - Cálculo automático de período promocional basado en primer pago
  - Retención de ISR del 10% solo para personas físicas
  - 4 tipos de períodos identificados: SIN_PROMOCION, TOTAL_PROMOCION, TOTAL_NORMAL, PERIODO_MIXTO
- **Componentes actualizados**:
  - README.md general del proyecto con nuevo módulo fideicomiso
  - Estructura de proyecto actualizada con nuevo módulo
  - Instrucciones de instalación actualizadas
  - Contador de componentes actualizado (31+ funciones, 2+ vistas, 11 módulos)
- **Impacto**: Sistema ahora incluye documentación completa del módulo de fideicomisos con todas sus funciones y vistas