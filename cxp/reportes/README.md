# Reporte de Cuentas por Pagar (CXP)

## Descripción

Reporte web interactivo para la consulta y análisis de las Cuentas por Pagar del sistema SPH. Permite filtrar, visualizar y exportar datos de manera eficiente.

## Características

### 📊 Filtros Avanzados
- **Filtros de fecha**: Año, mes individual, selección múltiple de meses y rango de fechas
- **Filtros de proveedor**: Proveedor específico y tipo de proveedor (Proveedor, Inversionista, Comisionista)
- **Filtros de categoría**: Categoría y sección con dependencias automáticas
- **Filtros de estado**: Estados del flujo de pago (Guardado, Enviado, Rechazado, Aprobado, Reprogramado, Pagado, Pago T. Bancaria)
- **Filtros de usuarios**: Quién solicitó, autorizó y pagó
- **Búsqueda general**: Por folio o concepto

### 📈 Panel de Resumen
- Total de registros filtrados
- Monto total
- Monto aplicado
- Balance pendiente

### 📋 Tabla de Datos
- Visualización de todos los campos relevantes
- Estados con códigos de color
- Indicadores visuales de urgencia
- Paginación con 20 registros por página

### 🔍 Modal de Detalles
- Vista completa de cada registro
- Información completa del pago
- Fechas y usuarios involucrados

### 📤 Funcionalidad de Exportación
- **Exportación a Excel**: Con todos los campos y formato de moneda
- **Exportación a PDF**: Con tabla resumida y totales

## Instalación y Configuración

### Requisitos
- Navegador web moderno (Chrome, Firefox, Safari, Edge)
- Acceso a internet para las librerías CDN
- Credenciales de Supabase

### Configuración
1. **Configurar credenciales de Supabase**:
   ```javascript
   const supabaseUrl = 'https://szjlkvakwljssdnysazp.supabase.co';
   const supabaseKey = 'TU_CLAVE_DE_SUPABASE';
   ```

2. **Abrir el archivo**:
   - Abrir `cxp/reporte_cxp.html` en un navegador web
   - O desplegar en un servidor web

## Uso

### Comportamiento por Defecto
- **Carga automática**: Al abrir el reporte, automáticamente se establecen filtros para mostrar los datos del mes y año en curso
- **Año actual**: Se selecciona automáticamente el año actual en el filtro de año
- **Mes actual**: Se selecciona automáticamente el mes actual tanto en el selector de mes como en la selección múltiple de meses
- **Beneficio**: Reduce significativamente el tiempo de carga al evitar cargar todo el historial de datos

### 1. Aplicar Filtros
- Los filtros por defecto (mes y año actual) se aplican automáticamente al cargar la página
- Seleccionar filtros adicionales según sea necesario
- Usar la selección múltiple de meses para filtrar varios meses a la vez
- Utilizar el rango de fechas para periodos específicos
- Hacer clic en "Aplicar Filtros" para actualizar los resultados

### 2. Navegar Resultados
- Usar los controles de paginación para navegar entre páginas
- Hacer clic en el ícono del ojo para ver detalles completos
- Los estados se muestran con colores diferenciados

### 3. Exportar Datos
- **Excel**: Hacer clic en "Exportar Excel" para descargar archivo .xlsx
- **PDF**: Hacer clic en "Exportar PDF" para descargar archivo .pdf

## Estructura de Datos

### Campos Principales
- **idCxp**: Identificador único del registro
- **folio**: Folio de la cuenta por pagar
- **proveedor**: Nombre o razón social del proveedor
- **estado**: Estado actual del pago
- **categoria**: Categoría del gasto
- **seccion**: Sección o departamento
- **concepto**: Descripción del concepto
- **fecSolicitud**: Fecha de solicitud
- **fecCFDI**: Fecha del CFDI
- **fecPago**: Fecha de pago
- **subtotal**: Subtotal del documento
- **total**: Monto total
- **montoAplicado**: Monto aplicado/pagado
- **balance**: Saldo pendiente (total - montoAplicado)
- **esUrgente**: Indicador de urgencia

## Estados del Flujo

| Estado | Descripción | Color |
|--------|-------------|--------|
| Guardado | Registro inicial | Azul |
| Enviado | Enviado para autorización | Naranja |
| Rechazado | Rechazado por autorizador | Rojo |
| Aprobado | Aprobado para pago | Verde |
| Reprogramado | Reprogramado | Púrpura |
| Pagado | Pagado completamente | Verde claro |
| Pago T. Bancaria | Pagado vía transferencia | Rosa |

## Consideraciones Técnicas

### Funciones de Supabase Utilizadas
- `cxp_get_estado_cuenta_detalle`: Obtiene datos filtrados
- `cxp_get_unique_values`: Obtiene valores únicos para filtros
- `cxp_get_filtros_dependientes`: Obtiene filtros dependientes

### Rendimiento
- Paginación de 20 registros por página para optimizar carga
- Carga asíncrona de datos
- Filtros dependientes para reducir opciones irrelevantes
- **Filtros por defecto**: Automáticamente carga solo datos del mes y año actual, reduciendo significativamente el tiempo de carga inicial
- **Optimización de consultas**: Las funciones SQL v2 están optimizadas para mejor rendimiento

### Seguridad
- Conexión segura via Supabase
- Sin almacenamiento de credenciales en el cliente
- Validación de datos en el backend

## Personalización

### Modificar Colores
Editar las variables CSS en `:root`:
```css
:root {
    --primary-color: #2c3e50;
    --secondary-color: #3498db;
    /* ... otras variables */
}
```

### Modificar Registros por Página
Cambiar la variable `itemsPerPage`:
```javascript
let itemsPerPage = 20; // Cambiar al valor deseado
```

## Soporte

Para problemas o sugerencias:
1. Verificar la consola del navegador para errores
2. Validar credenciales de Supabase
3. Comprobar conexión a internet

## Actualizaciones

El reporte se mantiene actualizado con las últimas funciones del sistema CXP y se adapta automáticamente a cambios en la estructura de datos.