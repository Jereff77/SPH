# Sistema de Gestión de Leads - SPH Bines Raíces

## Información General
- **Módulo**: Gestión de Leads y Clientes Potenciales
- **Tablas principales**: `leads`, `leads_porAprobar`
- **Total de componentes**: 8 funciones, 6 triggers
- **Fecha de creación**: 20/10/2025
- **Última actualización**: 04/12/2025

---

## Tablas Documentadas

### 1. Tabla: `leads_porAprobar`
- **Descripción**: Tabla de almacenamiento temporal para leads pendientes de aprobación
- **Propósito**: Funciona como área de staging/aprobación antes de incorporar leads al sistema principal
- **Archivo de documentación**: [`leads_porAprobar_estructura.sql`](Leads/leads_porAprobar_estructura.sql)

#### Características principales:
- **Campo de control**: `aprobado` con valores NULL (pendiente), true (aprobado), false (rechazado)
- **Relaciones completas**: Con catUsers, catInmobiliarias, catAsesoresInm y tablas CRM
- **Campos descriptivos**: Mantenidos automáticamente mediante triggers
- **Flujo completo**: leads_puente → leads_porAprobar → leads

#### Flujo de trabajo:
1. Los leads ingresan inicialmente desde la tabla `leads_puente`
2. Pasan a `leads_porAprobar` para revisión y validación
3. El campo `aprobado` controla el estado: NULL = pendiente, true = aprobado, false = rechazado
4. Los leads aprobados migran a la tabla principal `leads`
5. Los leads rechazados pueden eliminarse o mantenerse para auditoría

---

## Funciones Principales

### 1. `leads_poraprobar_obtener_detalle`
- **Archivo**: [`leads_poraprobar_obtener_detalle.sql`](Leads/funciones%20y%20trigger/leads_poraprobar_obtener_detalle.sql)
- **Retorno**: TABLE con estructura completa
- **Seguridad**: SECURITY INVOKER
- **Propósito**: Obtener todos los leads pendientes de aprobación con información detallada

#### Descripción:
Función que retorna una tabla con todos los campos de `leads_porAprobar` y sus relaciones con tablas catálogo. Utiliza LEFT JOIN para incluir todos los registros aunque no tengan todas las relaciones completas.

#### Uso típico:
```sql
-- Obtener todos los leads pendientes de aprobación
SELECT * FROM leads_poraprobar_obtener_detalle();

-- Filtrar por teléfono específico
SELECT * FROM leads_poraprobar_obtener_detalle()
WHERE telefono IS NOT NULL;

-- Ordenar por fecha de registro
SELECT * FROM leads_poraprobar_obtener_detalle()
ORDER BY "fechaRegistro" DESC;
```

---

### 2. `leads_notificar_cambio_uidrc`
- **Archivo**: [`leads_notificar_cambio_uidrc.sql`](Leads/funciones%20y%20trigger/leads_notificar_cambio_uidrc.sql)
- **Retorno**: jsonb con estructura estandarizada
- **Seguridad**: SECURITY DEFINER
- **Propósito**: Enviar notificaciones por correo cuando se crea o modifica un lead con cambio en uidRC

#### Descripción:
Función principal para enviar notificaciones por correo electrónico cuando se crea un nuevo lead o se modifica el responsable comercial asignado (uidRC). Integra con Edge Functions para el envío de correos.

#### Uso típico:
```sql
-- Enviar notificación manualmente
SELECT leads_notificar_cambio_uidrc('123e4567-e89b-12d3-a456-426614174000', 'INSERT');

-- Notificar cambio de responsable
SELECT leads_notificar_cambio_uidrc('123e4567-e89b-12d3-a456-426614174000', 'UPDATE', 'uid-anterior');
```

---

### 3. `leads_poraprobar_actualizar_nomrc`
- **Archivo**: [`leads_poraprobar_actualizar_nomrc.sql`](Leads/funciones%20y%20trigger/leads_poraprobar_actualizar_nomrc.sql)
- **Retorno**: jsonb con estructura estandarizada
- **Seguridad**: SECURITY INVOKER
- **Propósito**: Actualizar el campo nomRC en leads_porAprobar cuando se modifica uidRC

#### Descripción:
Función que mantiene sincronizado el campo descriptivo nomRC cuando se cambia el responsable comercial asignado a un lead en la tabla de aprobación.

#### Uso típico:
```sql
-- Actualización manual del responsable comercial
SELECT leads_poraprobar_actualizar_nomrc('uuid-del-lead', 'nuevo-uid-rc');
```

---

### 4. `leads_poraprobar_insertar_registro`
- **Archivo**: [`leads_poraprobar_insertar_registro.sql`](Leads/funciones%20y%20trigger/leads_poraprobar_insertar_registro.sql)
- **Retorno**: jsonb con estructura estandarizada
- **Seguridad**: SECURITY INVOKER
- **Propósito**: Insertar nuevos registros en leads_porAprobar con validaciones completas

#### Descripción:
Función para registrar nuevos leads en el sistema de aprobación con validaciones completas de campos requeridos y relaciones con tablas catálogo.

#### Uso típico:
```sql
-- Insertar un nuevo lead básico
SELECT leads_poraprobar_insertar_registro(
    'uid-usuario-registro',
    'Juan Pérez García',
    '5512345678',
    'juan.perez@email.com'
);
```

---

### 5. `leads_poraprobar_migrar_a_leads`
- **Archivo**: [`leads_poraprobar_migrar_a_leads.sql`](Leads/funciones%20y%20trigger/leads_poraprobar_migrar_a_leads.sql)
- **Retorno**: jsonb con estructura estandarizada
- **Seguridad**: SECURITY INVOKER
- **Propósito**: Migrar leads aprobados desde leads_porAprobar a la tabla principal leads

#### Descripción:
Función que completa el flujo de aprobación migrando leads aprobados a la tabla principal del sistema, manteniendo toda la información y relaciones.

#### Uso típico:
```sql
-- Migrar un lead aprobado
SELECT leads_poraprobar_migrar_a_leads('uuid-del-lead-aprobado');

-- Forzar migración de un lead específico (uso administrativo)
SELECT leads_poraprobar_migrar_a_leads('uuid-del-lead', true);
```

---

## Flujo de Trabajo del Sistema

### Flujo Completo de Gestión de Leads
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   leads_puente   │───▶│ leads_porAprobar │───▶│      leads       │
│  (Ingreso inicial)│    │  (Aprobación)    │    │ (Producción)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │  Revisión y      │
                       │  Validación      │
                       └──────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
              ┌──────────┐         ┌──────────┐
              │ Aprobado │         │Rechazado │
              └──────────┘         └──────────┘
                    │                   │
                    ▼                   ▼
              ┌──────────┐         ┌──────────┐
              │ Migrar a │         │Mantener  │
              │  leads   │         │Auditoría │
              └──────────┘         └──────────┘
```

### Proceso Detallado por Etapa

#### 1. Etapa de Ingreso (leads_puente → leads_porAprobar)
```
┌─────────────────────────────────────────────────────────────┐
│                    INGRESO DE LEADS                        │
├─────────────────────────────────────────────────────────────┤
│ 1. Datos ingresados en leads_puente                        │
│ 2. Validación básica de campos                             │
│ 3. Transferencia a leads_porAprobar                        │
│ 4. Estado inicial: aprobado = NULL (pendiente)             │
└─────────────────────────────────────────────────────────────┘
```

#### 2. Etapa de Aprobación (leads_porAprobar)
```
┌─────────────────────────────────────────────────────────────┐
│                  PROCESO DE APROBACIÓN                      │
├─────────────────────────────────────────────────────────────┤
│ 1. Consulta de leads pendientes:                           │
│    SELECT * FROM leads_poraprobar_obtener_detalle();       │
│                                                             │
│ 2. Revisión y validación por supervisor:                   │
│    - Verificar datos de contacto                           │
│    - Validar relaciones con catálogos                      │
│    - Comprobar completitud de información                  │
│                                                             │
│ 3. Decisión de aprobación:                                 │
│    UPDATE leads_porAprobar                                  │
│    SET aprobado = true   -- Aprobado                        │
│    WHERE id = 'uuid-lead';                                 │
│                                                             │
│    UPDATE leads_porAprobar                                  │
│    SET aprobado = false  -- Rechazado                      │
│    WHERE id = 'uuid-lead';                                 │
└─────────────────────────────────────────────────────────────┘
```

#### 3. Etapa de Migración (leads_porAprobar → leads)
```
┌─────────────────────────────────────────────────────────────┐
│                   MIGRACIÓN AUTOMÁTICA                      │
├─────────────────────────────────────────────────────────────┤
│ 1. Detección de leads aprobados:                           │
│    WHERE aprobado = true                                   │
│                                                             │
│ 2. Ejecución de migración:                                 │
│    SELECT leads_poraprobar_migrar_a_leads('uuid-lead');    │
│                                                             │
│ 3. Proceso de migración:                                   │
│    - Validación de duplicados                              │
│    - Transferencia de datos completos                      │
│    - Mantenimiento de relaciones                          │
│    - Registro en activity_history                          │
│                                                             │
│ 4. Confirmación de migración:                              │
│    - Respuesta JSON con resultado                          │
│    - Registro de actividad                                │
│    - Notificación automática (si aplica)                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Componentes Relacionados

### Políticas RLS Implementadas
- **Control de acceso por usuario**: Los usuarios solo ven los leads que registraron
- **Permisos de supervisión**: Los supervisores pueden ver todos los leads pendientes
- **Permisos de administración**: Los administradores pueden aprobar/rechazar leads
- **Seguridad de datos**: Protección de información sensible del cliente

### Triggers Asociados
- **`trigger_leads_poraprobar_actualizar_nomrc`**: Actualiza automáticamente el campo nomRC cuando cambia uidRC
- **`trigger_leads_poraprobar_insertar_registro`**: Procesa datos posteriores a la inserción
- **`trigger_leads_poraprobar_migrar_a_leads`**: Migra automáticamente cuando se aprueba un lead
- **`trigger_leads_webhook_uidrc`**: Envía información a webhook externo

### Vistas y Consultas Relacionadas
- **`leads_poraprobar_obtener_detalle`**: Vista completa con relaciones para revisión
- **Consultas de filtrado**: Por estado, origen, tipo de cliente, etc.
- **Consultas de estadísticas**: Conteos por estado, origen, responsable

### Integraciones Externas
- **Webhook n8n**: `https://sph-n8n.fn5wy3.easypanel.host/webhook/c66df01e-daaa-4c6f-be11-65945b760318`
- **Edge Functions**: `leads-notificar-lead-asignado` para envío de correos
- **Activity History**: Registro completo de todas las actividades

---

## Estructura de Archivos

```
Leads/
├── README.md                                    # Este archivo (documentación principal)
├── leads_porAprobar_estructura.sql              # Documentación completa de la tabla
├── consulta_leads_sin_actualizaciones.sql      # Consulta especializada
├── Correccion_Politica_Vista_Gerencial.sql     # Corrección de políticas
├── Funciones_Leads.md                          # Documentación adicional
├── Implementacion_Politicas_Leads_Definitivas.sql # Políticas RLS
├── Politicas_RLS_Leads_Definitivas.md          # Documentación de políticas
├── Verificacion_Politicas_Leads_Definitivas.sql # Verificación de políticas
└── funciones y trigger/                        # Carpeta de funciones y triggers
    ├── README.md                               # Documentación detallada de funciones
    ├── instalar_todo.sql                       # Script de instalación completa
    ├── leads_poraprobar_obtener_detalle.sql    # Función de consulta
    ├── leads_notificar_cambio_uidrc.sql         # Función de notificaciones
    ├── leads_poraprobar_actualizar_nomrc.sql   # Función de sincronización
    ├── leads_poraprobar_insertar_registro.sql   # Función de inserción
    ├── leads_poraprobar_migrar_a_leads.sql     # Función de migración
    ├── leads_poraprobar_validar_y_migrar_similitud.sql # Función de validación por similitud
    ├── leads_eliminar_lead.sql                 # Función de eliminación
    └── _templates/                             # Plantillas de notificaciones
        └── notificacion_lead_asignado.tsx      # Plantilla de correo
```

---

## Instrucciones de Instalación

### Requisitos Previos
- Tablas catUsers, catInmobiliarias, catAsesoresInm deben existir
- Tablas crm_* (Etapas, Origen, tipoCliente, etc.) deben existir
- Tabla activity_history debe existir para registro de actividades
- Políticas RLS deben estar configuradas adecuadamente

### Instalación Completa
```sql
-- Ejecutar el script de instalación completo
\i Leads/funciones y trigger/instalar_todo.sql;
```

### Instalación Individual de Componentes
```sql
-- 1. Funciones de leads_porAprobar
\i Leads/funciones y trigger/leads_poraprobar_obtener_detalle.sql;
\i Leads/funciones y trigger/leads_poraprobar_actualizar_nomrc.sql;
\i Leads/funciones y trigger/leads_poraprobar_insertar_registro.sql;
\i Leads/funciones y trigger/leads_poraprobar_migrar_a_leads.sql;
\i Leads/funciones y trigger/leads_poraprobar_validar_y_migrar_similitud.sql;

-- 2. Funciones de notificaciones
\i Leads/funciones y trigger/leads_notificar_cambio_uidrc.sql;

-- 3. Función de eliminación
\i Leads/funciones y trigger/leads_eliminar_lead.sql;
```

### Verificación de Instalación
```sql
-- Verificar que todas las funciones existen
SELECT routine_name, routine_type, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE 'leads_%'
ORDER BY routine_name;

-- Verificar que los triggers existen
SELECT trigger_name, event_manipulation, event_object_table, action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND trigger_name LIKE 'trigger_leads_%'
ORDER BY trigger_name;

-- Probar funcionamiento básico
SELECT COUNT(*) FROM leads_poraprobar_obtener_detalle();
```

---

## Estado Actual

### Componentes Completados ✅
- **✅ Tabla leads_porAprobar**: Estructura completa documentada
- **✅ Función `leads_poraprobar_obtener_detalle`**: Consulta de leads pendientes
- **✅ Función `leads_notificar_cambio_uidrc`**: Sistema de notificaciones
- **✅ Función `leads_poraprobar_actualizar_nomrc`**: Sincronización de campos
- **✅ Función `leads_poraprobar_insertar_registro`**: Inserción con validaciones
- **✅ Función `leads_poraprobar_migrar_a_leads`**: Migración a tabla principal
- **✅ Función `leads_poraprobar_validar_y_migrar_similitud`**: Validación por similitud y migración automática
- **✅ Función `leads_eliminar_lead`**: Eliminación con permisos
- **✅ Triggers automáticos**: 6 triggers para automatización completa
- **✅ Sistema de aprobación**: Flujo completo implementado
- **✅ Sistema de notificaciones**: Correos y webhooks
- **✅ Sistema de migración**: Automática y en lote
- **✅ Políticas RLS**: Seguridad implementada

### Estadísticas de Implementación
- **Total de funciones**: 8
- **Total de triggers**: 6
- **Archivos de documentación**: 12
- **Componentes con seguridad**: 100%
- **Componentes documentados**: 100%

---

## Notas Importantes

### Proceso de Aprobación
1. **Validación de datos**: Todos los campos son validados antes de la aprobación
2. **Seguimiento de auditoría**: Cada acción queda registrada en activity_history
3. **Control de calidad**: Los leads rechazados pueden mantenerse para análisis
4. **Migración segura**: Prevención de duplicados y pérdida de datos

### Consideraciones de Seguridad
- **Autenticación obligatoria**: Todas las funciones requieren `auth.uid() IS NOT NULL`
- **Control de permisos**: Validación de permisos específicos por función
- **Prevención de acceso anónimo**: Bloqueo de ejecución no autorizada
- **Registro de auditoría**: Todas las operaciones quedan registradas

### Integraciones y Webhooks
- **Webhook n8n**: Configurado para notificaciones automáticas
- **Edge Functions**: Integración con Supabase para envío de correos
- **Activity History**: Registro completo para auditoría y seguimiento
- **Manejo de errores**: Robusto con respuestas JSON estandarizadas

### Mantenimiento y Monitoreo
- **Revisión periódica**: Verificar logs de activity_history
- **Monitoreo de errores**: Revisar fallos en notificaciones
- **Actualización de documentación**: Mantener sincronizada con cambios
- **Optimización de rendimiento**: Monitorear tiempos de ejecución

### Mejores Prácticas
1. **Validar siempre**: Antes de aprobar, verificar completitud de datos
2. **Documentar cambios**: Actualizar documentación con cada modificación
3. **Probar exhaustivamente**: Verificar flujo completo con datos de prueba
4. **Monitorear rendimiento**: Revisar tiempos de ejecución periódicamente
5. **Mantener seguridad**: Revisar permisos y políticas RLS regularmente

---

## Registro de Cambios

### 03/12/2025 - Implementación completa del sistema de leads por aprobar
- ✅ Creación de documentación completa de `leads_poraprobar_estructura.sql`
- ✅ Implementación de todas las funciones del sistema de aprobación
- ✅ Creación de triggers automáticos para sincronización
- ✅ Documentación completa según estándares del proyecto supaSPH-QR
- ✅ Implementación de flujo completo de aprobación de leads
- ✅ Sistema de migración automática y en lote
- ✅ Integración con webhooks y notificaciones
- ✅ Actualización integral del README.md principal

### 04/12/2025 - Implementación de función de validación por similitud
- ✅ Creación de la función `leads_poraprobar_validar_y_migrar_similitud`
- ✅ Implementación de validación de similitud de nombre con umbral del 35%
- ✅ Implementación de validaciones de teléfono y correo duplicados
- ✅ Sistema de migración automática basado en validaciones
- ✅ Integración completa con el flujo de aprobación existente
- ✅ Documentación completa según estándares del proyecto supaSPH-QR
- ✅ Actualización de README.md principal y de funciones

### 20/10/2025 - Creación inicial del sistema
- ✅ Creación de la función `leads_poraprobar_obtener_detalle`
- ✅ Documentación inicial de componentes
- ✅ Creación del script de instalación `instalar_todo.sql`
- ✅ Estructura inicial de la carpeta

### 01/12/2025 - Mejoras de seguridad y notificaciones
- ✅ Implementación de validación de autenticación obligatoria
- ✅ Creación de sistema de webhook para notificaciones externas
- ✅ Mejora de manejo de errores y logging
- ✅ Implementación de permisos específicos por función

---

*Documento generado el: 04/12/2025*
*Proyecto: SPH Bines Raices - Sistema de Gestión de Leads*
*Última actualización: 04/12/2025*