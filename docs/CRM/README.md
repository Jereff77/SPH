# Documentación del CRM - SPH Bines Raices

**Última actualización**: 13/02/2026  
**Versión**: 1.0

---

## 📋 Índice

1. [Descripción General](#descripción-general)
2. [Documentación Disponible](#documentación-disponible)
3. [Estructura del CRM](#estructura-del-crm)
4. [Flujo de Trabajo](#flujo-de-trabajo)
5. [Funcionalidades Principales](#funcionalidades-principales)

---

## 📖 Descripción General

El CRM (Customer Relationship Management) de SPH Bines Raices es el sistema completo encargado de gestionar el ciclo de vida de los leads/prospectos desde su captura hasta su conversión en clientes. Este módulo incluye múltiples tablas interrelacionadas que forman el ecosistema de gestión de relaciones con clientes.

### Características Principales

- ✅ Captura de leads desde múltiples canales (web, email, formulario público)
- ✅ Gestión de etapas del proceso de ventas
- ✅ Asignación de responsables comerciales
- ✅ Seguimiento de actividades e interacciones
- ✅ Validación y aprobación de leads
- ✅ Detección de duplicados y similitudes
- ✅ Integración con inmobiliarias y asesores externos
- ✅ Reportes y análisis de seguimiento
- ✅ Gestión de campañas de marketing
- ✅ Encuestas de satisfacción

---

## 📚 Documentación Disponible

### 1. [Documentación de Tablas CRM](./Documentacion_Tablas_CRM.md)

Describe TODAS las tablas relacionadas con el sistema CRM:

**Tablas Principales del CRM**:
- [`leads`](./Documentacion_Tablas_CRM.md#1-leads---tabla-principal-de-leads) (5,226 registros) - Leads aprobados y activos en el sistema
- [`leads_porAprobar`](./Documentacion_Tablas_CRM.md#2-leads_poraprobar---leads-pendientes-de-aprobación) (61 registros) - Leads pendientes de aprobación
- [`leads_duplicate`](./Documentacion_Tablas_CRM.md#3-leads_duplicate---duplicado-de-leads) (5,225 registros) - Duplicado de respaldo de leads

**Tablas de Catálogos del CRM**:
- [`crm_Etapas`](./Documentacion_Tablas_CRM.md#4-crm_etapas---etapas-del-proceso-de-ventas) (12 registros) - Etapas del proceso de ventas
- [`crm_Origen`](./Documentacion_Tablas_CRM.md#5-crm_origen---origen-de-leads) (20 registros) - Canales de origen de leads
- [`crm_tipoCliente`](./Documentacion_Tablas_CRM.md#6-crm_tipocliente---tipos-de-cliente) (6 registros) - Tipos de cliente
- [`crm_tipoOperaciones`](./Documentacion_Tablas_CRM.md#7-crm_tipooperaciones---tipos-de-operaciones) (5 registros) - Tipos de operaciones
- [`crm_tipoVenta`](./Documentacion_Tablas_CRM.md#8-crm_tipoventa---tipos-de-venta) (8 registros) - Tipos de venta (hijos de crm_tipoOperaciones)
- [`crm_campania`](./Documentacion_Tablas_CRM.md#9-crm_campania---campañas-de-marketing) (4 registros) - Campañas de marketing
- [`crm_Recepcion`](./Documentacion_Tablas_CRM.md#10-crm_recepcion---medios-de-recepción) (7 registros) - Medios de recepción
- [`crm_Encuestas`](./Documentacion_Tablas_CRM.md#11-crm_encuestas---encuestas-del-crm) (4 registros) - Encuestas disponibles
- [`crm_responsableComercial`](./Documentacion_Tablas_CRM.md#12-crm_responsablecomercial---responsables-comerciales) (5 registros) - Responsables comerciales asignables

**Tablas de Relación del CRM**:
- [`catInmobiliarias`](./Documentacion_Tablas_CRM.md#13-catinmobiliarias---inmobiliarias) (65 registros) - Inmobiliarias externas
- [`catAsesoresInm`](./Documentacion_Tablas_CRM.md#14-catacesoresinm---asesores-inmobiliarios) (1 registro) - Asesores inmobiliarios externos

**Tablas de Actividades y Seguimiento del CRM**:
- [`activity_history`](./Documentacion_Tablas_CRM.md#15-activity_history---historial-de-actividades) (1,351 registros) - Historial de interacciones con leads
- [`agenda`](./Documentacion_Tablas_CRM.md#16-agenda---agenda-de-actividades) (1 registro) - Actividades agendadas para seguimiento
- [`crm_incidencias`](./Documentacion_Tablas_CRM.md#17-crm_incidencias---incidencias-del-crm) (0 registros) - Incidencias del CRM
- [`seguimientoComentarios`](./Documentacion_Tablas_CRM.md#18-seguimientocomentarios---comentarios-de-seguimiento) (0 registros) - Comentarios adicionales de seguimiento

### 2. [Documentación de Funciones CRM](./Documentacion_Funciones_CRM.md)

Describe TODAS las funciones relacionadas con el sistema CRM:

**Funciones de Gestión de Leads**:
- [`leads_eliminar_lead`](./Documentacion_Funciones_CRM.md#1-leads_eliminar_leadp_id_lead-uuid) - Eliminar leads con validación de permisos

**Funciones de Leads por Aprobar**:
- [`leads_poraprobar_insertar_registro`](./Documentacion_Funciones_CRM.md#2-leads_poraprobar_insertar_registro) - Insertar nuevos leads con validaciones completas
- [`leads_poraprobar_obtener_detalle`](./Documentacion_Funciones_CRM.md#3-leads_poraprobar_obtener_detalle) - Obtener todos los leads pendientes con información completa
- [`leads_poraprobar_validar_y_migrar_similitud`](./Documentacion_Funciones_CRM.md#4-leads_poraprobar_validar_y_migrar_similitudp_id_lead_poraprobar-uuid) - Validar duplicados y migrar automáticamente

**Funciones de Reportes y Análisis**:
- [`leads_sin_interaccion_reciente`](./Documentacion_Funciones_CRM.md#5-leads_sin_interaccion_recientedias_sin_interaccion-integer-default-8) - Leads sin interacción en los últimos N días
- [`leads_mas_7_dias_sin_interaccion`](./Documentacion_Funciones_CRM.md#6-leads_mas_7_dias_sin_interaccion) - Leads sin interacción en los últimos 7 días
- [`leads_ultima_interaccion`](./Documentacion_Funciones_CRM.md#7-leads_ultima_interaccion) - Última interacción de cada lead
- [`leads_generar_email_html`](./Documentacion_Funciones_CRM.md#8-leads_generar_email_html) - Generar correo HTML con reporte de leads abandonados
- [`leads_obtener_destinatarios_reporte`](./Documentacion_Funciones_CRM.md#9-leads_obtener_destinatarios_reporte) - Obtener usuarios con permiso de reportes

**Funciones de Catálogos**:
- [`crm_tipooperaciones_obtener_activos`](./Documentacion_Funciones_CRM.md#10-crm_tipooperaciones_obtener_activos) - Obtener tipos de operación activos
- [`crm_tipoventa_obtener_activos`](./Documentacion_Funciones_CRM.md#11-crm_tipoventa_obtener_activos) - Obtener tipos de venta activos
- [`catasesoresinm_obtener_por_codigo`](./Documentacion_Funciones_CRM.md#12-catacesoresinm_obtener_por_codigop_codigo-text) - Obtener asesor inmobiliario por código

**Funciones de Triggers**:
- [`leads_poraprobar_actualizar_nomrc`](./Documentacion_Funciones_CRM.md#13-leads_poraprobar_actualizar_nomrc) - Actualizar automáticamente el campo nomRC
- [`leads_poraprobar_migrar_a_leads`](./Documentacion_Funciones_CRM.md#14-leads_poraprobar_migrar_a_leads) - Migrar automáticamente leads aprobados a tabla principal
- [`leads_poraprobar_validar_y_migrar_similitud_trigger_func`](./Documentacion_Funciones_CRM.md#15-leads_poraprobar_validar_y_migrar_similitud_trigger_func) - Validar y migrar automáticamente al insertar
- [`leads_puente_sync_to_leads_before`](./Documentacion_Funciones_CRM.md#16-leads_puente_sync_to_leads_before) - Validar e insertar en leads desde leads_puente
- [`update_etapa_column`](./Documentacion_Funciones_CRM.md#17-update_etapa_column) - Actualizar campo Etapa denormalizado
- [`update_origen_column`](./Documentacion_Funciones_CRM.md#18-update_origen_column) - Actualizar campo Origen denormalizado
- [`reordenar_etapas`](./Documentacion_Funciones_CRM.md#19-reordenar_etapas) - Mantener orden consecutivo de etapas

### 3. [Diagrama de Relaciones DBML](./schema_crm.dbml)

Diagrama visual de las relaciones entre todas las tablas del CRM en formato DBML.

**Para visualizar el diagrama**:
1. Copia el contenido de `schema_crm.dbml`
2. Visita [dbdiagram.io](https://dbdiagram.io)
3. Pega el contenido en el editor
4. El diagrama se generará automáticamente

---

## 🏗️ Estructura del CRM

### Tablas Principales

```
leads (5,226 registros)
├── Leads aprobados y activos
├── Migrados desde leads_porAprobar
└── Con historial de actividades en activity_history

leads_porAprobar (61 registros)
├── Leads pendientes de aprobación
├── Capturados desde formulario público
├── Con validación de duplicados
└── Se migran a leads cuando aprobado = true

leads_duplicate (5,225 registros)
├── Duplicado de respaldo de leads
└── No debe modificarse directamente
```

### Catálogos CRM

```
crm_Etapas (12 registros)
└── Etapas del proceso de ventas

crm_Origen (20 registros)
└── Canales de origen de leads

crm_tipoCliente (6 registros)
└── Tipos de cliente

crm_tipoOperaciones (5 registros)
└── Tipos de operaciones

crm_tipoVenta (8 registros)
└── Tipos de venta (hijos de crm_tipoOperaciones)

crm_campania (4 registros)
└── Campañas de marketing

crm_Recepcion (7 registros)
└── Medios de recepción

crm_Encuestas (4 registros)
└── Encuestas disponibles

crm_responsableComercial (5 registros)
└── Responsables comerciales asignables
```

### Tablas de Relación

```
catInmobiliarias (65 registros)
├── Inmobiliarias externas
└── Asociadas a asesores inmobiliarios

catAsesoresInm (1 registro)
├── Asesores inmobiliarios externos
└── Pertenecen a inmobiliarias
```

### Actividades y Seguimiento

```
activity_history (1,351 registros)
├── Historial de interacciones
└── Asociado a leads

agenda (1 registro)
├── Actividades agendadas
└── Para seguimiento de leads

crm_incidencias (0 registros)
├── Incidencias del CRM
└── Para rastreo de problemas

seguimientoComentarios (0 registros)
├── Comentarios adicionales
└── Para seguimiento de leads
```

---

## 🔄 Flujo de Trabajo

### 1. Captura de Leads

```
Formulario Público / Email / Web
         ↓
leads_porAprobar (pendiente de aprobación)
         ↓
Validación de duplicados y similitudes
         ↓
┌────────┴────────┐
│                 │
Sin duplicados   Con duplicados
│                 │
↓                 ↓
Migrar a leads   Permanecer en leads_porAprobar
│                 │
└─────────────────┘
```

### 2. Aprobación de Leads

1. Lead capturado en `leads_porAprobar`
2. Validación automática de:
   - Similitud de nombre (> 35%)
   - Duplicado de teléfono (exacto)
   - Duplicado de correo (exacto)
3. Si pasa validación → Migrar automáticamente a `leads`
4. Si hay duplicados → Permanecer en `leads_porAprobar`
5. Manualmente, el RC puede aprobar el lead (cambiar `aprobado` a `true`)

### 3. Gestión de Leads en CRM

```
Lead en leads
         ↓
Asignar Responsable Comercial (uidRC)
         ↓
Asignar Etapa (idEtapa)
         ↓
Registrar Actividades (activity_history)
         ↓
Agendar Seguimientos (agenda)
         ↓
Avanzar en el proceso hasta conversión
```

### 4. Seguimiento y Actividades

1. Cada interacción se registra en `activity_history`
2. Se pueden agendar actividades en `agenda`
3. El sistema monitorea leads sin interacción reciente
4. Reportes automáticos de leads abandonados

---

## ⚙️ Funcionalidades Principales

### 1. Captura de Leads

**Función**: `leads_poraprobar_insertar_registro`

**Características**:
- Validación completa de datos
- Sanitización de entradas
- Detección de duplicados
- Soporte para inmobiliarias y asesores externos

**Campos obligatorios**:
- `nombreLead`
- `idTipoOperacion`
- `idTipoVenta`
- Al menos uno de: `telefono` o `correo`

### 2. Validación de Duplicados

**Función**: `leads_poraprobar_validar_y_migrar_similitud`

**Validaciones**:
- **Similitud de nombre**: Busca nombres con similitud > 35%
- **Duplicado de teléfono**: Coincidencia exacta
- **Duplicado de correo**: Coincidencia exacta

**Resultado**:
- Sin duplicados → Migrar automáticamente a `leads`
- Con duplicados → No migrar, retornar razón

### 3. Gestión de Etapas

**Trigger**: `reordenar_etapas`

**Funcionalidades**:
- Mantener orden consecutivo de etapas
- Actualización automática de campos denormalizados
- Soporte para colores personalizados

### 4. Seguimiento de Actividades

**Tabla**: `activity_history`

**Tipos de actividades**:
- Llamadas
- Emails
- Visitas
- Notas
- Aprobaciones
- Cambios de etapa

**Campos**:
- `lead_id`: Lead asociado
- `user_id`: Usuario que realizó la actividad
- `name`: Nombre de la actividad
- `message`: Descripción detallada
- `heat_level`: Nivel de importancia (1-5)
- `type`: Tipo de actividad

### 5. Reportes y Análisis

**Funciones de reportes**:

1. **`leads_sin_interaccion_reciente(dias)`**
   - Leads sin interacción en los últimos N días
   - Por defecto: 8 días
   - Incluye información del RC

2. **`leads_mas_7_dias_sin_interaccion()`**
   - Leads sin interacción en los últimos 7 días
   - Para seguimiento urgente

3. **`leads_ultima_interaccion()`**
   - Última interacción de cada lead
   - Indica si hace más de 7 días

4. **`leads_generar_email_html()`**
   - Genera correo HTML con reporte de leads abandonados
   - Diseño responsive y profesional

5. **`leads_obtener_destinatarios_reporte()`**
   - Obtiene usuarios con permiso de reportes (clave 328)
   - Para envío de reportes automáticos

### 6. Eliminación de Leads

**Función**: `leads_eliminar_lead(p_id_lead)`

**Validaciones**:
- Usuario autenticado
- Permiso 327 activo (CRM > Leads > Eliminar Leads)
- Lead existe en la tabla

**Retorna**: JSON con resultado de la operación

---

## 🔒 Seguridad y Permisos

### Row Level Security (RLS)

Todas las tablas del CRM tienen RLS habilitado.

### Permisos Requeridos

- **Permiso 327**: CRM > Leads > Eliminar Leads
- **Permiso 328**: CRM > Reportes de Leads

### Tipos de Seguridad de Funciones

- **SECURITY DEFINER**: Funciones que requieren permisos elevados
- **SECURITY INVOKER**: Funciones que respetan permisos del usuario

---

## 📞 Soporte

Para más información sobre el CRM, contacte al equipo de desarrollo de SPH Bines Raices.

---

## 📝 Notas de Actualización

### Versión 1.0 (13/02/2026)
- Documentación inicial completa
- Incluye todas las tablas del sistema CRM
- Incluye todas las funciones del sistema CRM
- Incluye diagrama DBML de relaciones
- Flujo de trabajo documentado
- Funcionalidades principales documentadas
