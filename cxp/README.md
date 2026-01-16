# Módulo CXP (Cuentas por Pagar)

## 📋 Descripción General

El módulo de Cuentas por Pagar (CXP) gestiona el ciclo completo de pagos a proveedores, desde la solicitud hasta la autorización y pago final. Incluye validación de fechas habilitadas, gestión de proveedores y control de estados de pago.

## 📁 Estructura de Archivos

### Funciones y Triggers
- `funciones y trigger/` - Contiene todas las funciones y triggers del módulo

### Componentes Principales

#### Gestión de Fechas Habilitadas
- `cxp_agregar_fecha_manual.sql` - Agrega fechas específicas manualmente
- `cxp_fechas_habilitadas_anual.sql` - Genera calendario anual de fechas
- `cxp_fechas_habilitadas_actualizar_dia_semana.sql` - Trigger para actualizar día de la semana
- `cxp_validar_fecha_habilitada.sql` - Valida si una fecha está habilitada

#### Validaciones y Permisos
- `cxp_puede_insertar.sql` - Verifica si se pueden insertar registros hoy
- `cxp_puede_autorizar.sql` - Verifica si se pueden autorizar pagos hoy
- `cxp_autorizar_solicitud_pago.sql` - Autoriza solicitudes de pago con validación de presupuesto
- `cxp_trigger_validar_fecha.sql` - Trigger principal de validación de operaciones

#### Gestión de Proveedores
- `cxp_validar_y_actualizar_proveedor.sql` - Valida y actualiza datos de proveedores
- `cxp_probar_validacion_proveedor.sql` - Prueba validación sin insertar

#### Consultas y Reportes
- `cxp_get_estado_cuenta_detalle.sql` - Obtiene estado de cuenta con filtros
- `cxp_get_estado_cuenta_detalle_v2.sql` - Versión corregida que usa PresCategorias (tablas correctas)
- `cxp_get_filtros_dependientes.sql` - Obtiene filtros dependientes para UI
- `cxp_get_filtros_dependientes_v2.sql` - Versión corregida que usa PresCategorias (tablas correctas)
- `cxp_get_unique_values.sql` - Obtiene valores únicos para listas desplegables
- `cxp_get_unique_values_v2.sql` - Versión corregida que usa PresCategorias (tablas correctas)
- `cxp_reporte_datos_prueba.sql` - Función para generar datos de prueba (desactivada)

#### Actualización Masiva de Datos
- `cxp_aprobados_sin_pago_aplicado.sql` - Actualiza masivamente el idEstatus de registros aprobados (estatus 4) sin pago aplicado a estatus 99 (con restricción de seguridad para no ejecutar en mes en curso)

#### Reportes Web
- `reportes/reporte_cxp.html` - Reporte web completo con filtros y exportación
- `reportes/README.md` - Documentación del reporte web

## 🔄 Flujo de Procesamiento

```
1. Validación de Fechas
   ├── cxp_validar_fecha_habilitada()
   ├── cxp_puede_insertar()
   └── cxp_puede_autorizar()

2. Inserción de Registros
   ├── cxp_trigger_validar_fecha() [BEFORE INSERT]
   ├── cxp_validar_y_actualizar_proveedor() [BEFORE INSERT]
   └── cxp_agregar_fecha_manual() [manual]

3. Autorización de Pagos
   ├── cxp_puede_autorizar() [validación de fechas]
   ├── cxp_autorizar_solicitud_pago() [validación de presupuesto]
   └── cxp_trigger_validar_fecha() [trigger de validación]

4. Consultas y Reportes
   ├── cxp_get_estado_cuenta_detalle()
   ├── cxp_get_estado_cuenta_detalle_v2() [Recomendada]
   ├── cxp_get_filtros_dependientes()
   ├── cxp_get_filtros_dependientes_v2() [Recomendada]
   ├── cxp_get_unique_values()
   └── cxp_get_unique_values_v2() [Recomendada]

5. Actualización Masiva de Datos
   └── cxp_aprobados_sin_pago_aplicado() [Actualización de aprobados sin pago]

6. Reportes Web
   ├── reporte_cxp.html [Filtros dinámicos + Exportación]
   └── Conexión directa a Supabase con funciones RPC

7. Mantenimiento de Calendario
   ├── cxp_fechas_habilitadas_anual()
   ├── cxp_agregar_fecha_manual()
   └── cxp_fechas_habilitadas_actualizar_dia_semana() [trigger]
```

## 📊 Tablas Relacionadas

### Principales
- `cxp` - Registro principal de cuentas por pagar
- `cxp_fechas_habilitadas` - Calendario de fechas habilitadas
- `cxp_ppd` - Facturas con pagos diferidos

### Catálogos
- `catProveedores` - Proveedores del sistema
- `PresCategorias` - Categorías de gastos (TABLA CORRECTA)
- `catUsers` - Usuarios del sistema
- `segModulosUsuarios` - Permisos por módulo

## 📅 Calendario de Operaciones

### Fechas Habilitadas por Defecto
- **Lunes**: cfdi=true, autorizar=true
- **Martes**: cfdi=true, autorizar=true
- **Miércoles**: cfdi=false, autorizar=true
- **Jueves a Domingo**: No habilitadas (requieren agregado manual)

### Estados del Flujo
1. **Guardado** (1) - Registro inicial
2. **Enviado** (2) - Enviado para autorización
3. **Rechazado** (3) - Rechazado por autorizador
4. **Aprobado** (4) - Aprobado para pago
5. **Reprogramado** (5) - Reprogramado
6. **Pagado** (6) - Pagado completamente
7. **Pago T. Bancaria** (7) - Pagado vía transferencia

## 🔐 Seguridad y Permisos

### Claves de Acceso
- **Clave 430**: Usuarios autorizadores (pueden cambiar cualquier estado)
- **Usuarios normales**: Solo pueden cambiar entre estados 1 y 2

### Validaciones Automáticas
- Fechas habilitadas para CFDI (lunes y martes)
- Fechas habilitadas para autorización (lunes, martes y miércoles)
- Integridad referencial con proveedores/inversionistas

## 📈 Métricas y Monitoreo

### Indicadores Clave
- Tiempo promedio de aprobación
- Porcentaje de rechazos
- Monto promedio por proveedor
- Frecuencia de uso por categoría

## 🚀 Instalación

Para instalar el módulo completo de CXP:

```sql
-- Instalar todas las funciones y triggers
\i cxp/funciones y trigger/instalar_todo.sql

-- Verificar instalación
SELECT COUNT(*) as funciones_instaladas
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE 'cxp_%';

-- Instalar funciones v2 (recomendadas)
\i cxp/funciones y trigger/cxp_get_estado_cuenta_detalle_v2.sql
\i cxp/funciones y trigger/cxp_get_unique_values_v2.sql
\i cxp/funciones y trigger/cxp_get_filtros_dependientes_v2.sql
```

### Reporte Web

El reporte web está disponible en `cxp/reportes/reporte_cxp.html` e incluye:

- **Filtros dinámicos**: Año, mes, proveedor, categoría, sección, estado, usuarios
- **Exportación**: Excel (XLSX) y PDF
- **Diseño responsive**: Adaptable a escritorio, tablet y móvil
- **Conexión real**: Datos en tiempo real desde Supabase
- **Seguridad**: Usa funciones RPC con SECURITY DEFINER

Para usar el reporte:
1. Abrir `cxp/reportes/reporte_cxp.html` en un navegador
2. Los filtros se cargarán automáticamente desde la base de datos
3. Aplicar filtros según se necesite
4. Exportar resultados usando los botones correspondientes

## 📝 Notas Importantes

- Las funciones originales usan SECURITY INVOKER por defecto
- Las funciones v2 usan SECURITY DEFINER para cumplir con políticas RLS
- El sistema opera en zona horaria 'America/Mexico_City'
- Las validaciones de fecha son cruciales para el funcionamiento
- Los triggers aseguran la integridad de datos en tiempo real
- **IMPORTANTE**: Usar funciones v2 para evitar problemas con tablas inexistentes

## 🔄 Cambios Recientes (13/11/2025)

### Correcciones Realizadas
- **Tablas incorrectas**: Se identificó que `catCategorias` no existe, se corrigió a `PresCategorias`
- **Funciones v2**: Se crearon versiones corregidas de las funciones de consulta
- **Reporte web**: Se implementó reporte completo con filtros y exportación
- **Seguridad RLS**: Se implementaron funciones con SECURITY DEFINER para evitar problemas de permisos

### Nuevos Componentes
- `cxp_get_estado_cuenta_detalle_v2.sql` - Función principal corregida
- `cxp_get_unique_values_v2.sql` - Valores únicos corregidos
- `cxp_get_filtros_dependientes_v2.sql` - Filtros dependientes corregidos
- `cxp_actualizar_estatus_mes_anio.sql` - Función para actualización masiva de estatus por mes y año
- `test_cxp_actualizar_estatus_mes_anio.sql` - Script de prueba para la función de actualización masiva
- `reportes/reporte_cxp.html` - Reporte web completo
- `reportes/README.md` - Documentación del reporte

### Problemas Resueltos
- Error de tabla no existente (`catCategorias` → `PresCategorias`)
- Problemas de RLS en consultas directas a tablas
- Conexión con Supabase usando clave API correcta
- Carga dinámica de filtros en el reporte web

### Cambios Recientes (20/11/2025)

### Nueva Funcionalidad Agregada
- **Función de actualización masiva**: Se implementó `cxp_aprobados_sin_pago_aplicado()` para cambiar el estatus de registros de "Aprobado" (4) que no tienen pago aplicado a "Personalizado" (99) para un mes y año específicos
- **Retorno compuesto**: La función devuelve un tipo `resultado_funcion` con `estatus` (boolean), `mensaje` (text) y `registros_afectados` (integer)
- **Registro automático de actividad**: Se implementó función `rau()` con SECURITY DEFINER para registrar actividad sin restricciones RLS, y la función principal la utiliza para registrar cada ejecución
- **Restricción de seguridad**: La función incluye una validación que impide su ejecución en el mes en curso para evitar modificaciones accidentales de datos actuales
- **Script de prueba**: Se agregó `test_cxp_aprobados_sin_pago_aplicado.sql` para verificar el funcionamiento correcto de la nueva función, incluyendo pruebas de la restricción de mes en curso y manejo del nuevo tipo de retorno
- **Validaciones incluidas**: La función valida que el mes esté entre 1-12, el año sea razonable (2000-2100) y no sea el mes en curso
- **Documentación completa**: Se actualizó toda la documentación relacionada con la nueva funcionalidad