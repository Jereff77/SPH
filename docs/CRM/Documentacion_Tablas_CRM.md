# Documentación Completa de Tablas del CRM - SPH Bines Raices

**Fecha de creación**: 13/02/2026  
**Última actualización**: 13/02/2026  
**Autor**: Kilo Code  
**Versión**: 1.0

---

## 📋 Índice

1. [Introducción](#introducción)
2. [Tablas Principales del CRM](#tablas-principales-del-crm)
3. [Tablas de Catálogos CRM](#tablas-de-catálogos-crm)
4. [Tablas de Relación](#tablas-de-relación)
5. [Tablas de Actividades y Seguimiento](#tablas-de-actividades-y-seguimiento)
6. [Diagrama de Relaciones](#diagrama-de-relaciones)

---

## 📖 Introducción

El CRM (Customer Relationship Management) del sistema SPH Bines Raices gestiona el ciclo de vida completo de los leads/prospectos desde su captura hasta su conversión. El sistema incluye funcionalidades de:

- Captura de leads desde múltiples canales
- Gestión de etapas del proceso de ventas
- Asignación de responsables comerciales
- Seguimiento de actividades e interacciones
- Validación y aprobación de leads
- Integración con inmobiliarias y asesores externos

---

## 📊 Tablas Principales del CRM

### 1. `leads` - Tabla Principal de Leads

**Propósito**: Almacena todos los leads/prospectos aprobados y activos en el sistema.

**Cantidad de registros**: 5,226

**Estructura**:

| Columna | Tipo | Descripción | Default |
|---------|------|-------------|---------|
| `id` | uuid | ID único del lead (PK) | gen_random_uuid() |
| `uidr` | uuid | Usuario que registró el lead | '896f01e5-283f-4bdb-b3f3-11381adedb30' |
| `status` | boolean | Estado activo/inactivo del lead | true |
| `fc` | timestamp | Fecha de creación | now() |
| `nombreLead` | text | Nombre completo del lead | NULL |
| `telefono` | text | Teléfono de contacto | NULL |
| `correo` | text | Correo electrónico | NULL |
| `idInmobiliaria` | uuid | FK: Inmobiliaria asociada | NULL |
| `fechaContacto` | timestamp | Fecha del primer contacto | now() |
| `fechaRegistro` | timestamp | Fecha de registro en el sistema | now() |
| `mensaje` | text | Mensaje inicial del lead | NULL |
| `uidRC` | uuid | FK: Responsable Comercial asignado | NULL |
| `idEtapa` | bigint | FK: Etapa actual del proceso | NULL |
| `idOrigen` | bigint | FK: Origen del lead | 0 |
| `idTipoCliente` | bigint | FK: Tipo de cliente | 0 |
| `idTipoOperacion` | bigint | FK: Tipo de operación | 0 |
| `idTipoVenta` | bigint | FK: Tipo de venta | NULL |
| `Etapa` | text | Nombre de la etapa (denormalizado) | NULL |
| `Origen` | text | Nombre del origen (denormalizado) | NULL |
| `tipoCliente` | text | Tipo de cliente (denormalizado) | NULL |
| `tipoOperacion` | text | Tipo de operación (denormalizado) | NULL |
| `tipoVenta` | text | Tipo de venta (denormalizado) | NULL |
| `nomRC` | text | Nombre del RC (denormalizado) | 'Sin asignar' |
| `valor` | double precision | Valor estimado del lead | 0 |
| `Aprobado` | boolean | Indica si el lead fue aprobado | false |
| `idAsesorInm` | uuid | FK: Asesor inmobiliario externo | NULL |

**Llaves foráneas**:
- `uidr` → `catUsers.uid`
- `uidRC` → `catUsers.uid`
- `idInmobiliaria` → `catInmobiliarias.idInmobiliaria`
- `idEtapa` → `crm_Etapas.id`
- `idOrigen` → `crm_Origen.id`
- `idTipoCliente` → `crm_tipoCliente.id`
- `idTipoOperacion` → `crm_tipoOperaciones.id`
- `idTipoVenta` → `crm_tipoVenta.id`
- `idAsesorInm` → `catAsesoresInm.id`

**Notas importantes**:
- Los campos denormalizados (Etapa, Origen, etc.) se mantienen sincronizados mediante triggers
- El campo `Aprobado` marca los leads que pasaron el proceso de aprobación
- Los leads sin RC asignado muestran 'Sin asignar' en `nomRC`

---

### 2. `leads_porAprobar` - Leads Pendientes de Aprobación

**Propósito**: Almacena temporalmente los leads capturados que requieren aprobación antes de migrarse a la tabla principal.

**Cantidad de registros**: 61

**Estructura**:

| Columna | Tipo | Descripción | Default |
|---------|------|-------------|---------|
| `id` | uuid | ID único del lead (PK) | gen_random_uuid() |
| `uidr` | uuid | Usuario que registró el lead | NULL |
| `status` | boolean | Estado activo/inactivo | true |
| `fc` | timestamp | Fecha de creación | now() |
| `nombreLead` | text | Nombre completo del lead | NULL |
| `telefono` | text | Teléfono de contacto | NULL |
| `correo` | text | Correo electrónico | NULL |
| `idInmobiliaria` | uuid | FK: Inmobiliaria asociada | NULL |
| `fechaContacto` | timestamp | Fecha del primer contacto | now() |
| `fechaRegistro` | timestamptz | Fecha de registro | now() |
| `mensaje` | text | Mensaje inicial del lead | NULL |
| `uidRC` | uuid | FK: Responsable Comercial asignado | NULL |
| `idEtapa` | bigint | FK: Etapa actual (default: 1) | NULL |
| `idOrigen` | bigint | FK: Origen del lead | NULL |
| `idTipoCliente` | bigint | FK: Tipo de cliente | NULL |
| `idTipoOperacion` | bigint | FK: Tipo de operación | NULL |
| `idTipoVenta` | bigint | FK: Tipo de venta | NULL |
| `Etapa` | text | Nombre de la etapa (denormalizado) | NULL |
| `Origen` | text | Nombre del origen (denormalizado) | NULL |
| `tipoCliente` | text | Tipo de cliente (denormalizado) | NULL |
| `tipoOperacion` | text | Tipo de operación (denormalizado) | NULL |
| `tipoVenta` | text | Tipo de venta (denormalizado) | NULL |
| `nomRC` | text | Nombre del RC (denormalizado) | 'Sin asignar' |
| `valor` | double precision | Valor estimado del lead | 0 |
| `aprobado` | boolean | Indica si fue aprobado | NULL |
| `idAsesorInm` | uuid | FK: Asesor inmobiliario externo | NULL |
| `superficie` | text | Superficie requerida | NULL |
| `KVAs` | text | KVAs requeridos | NULL |
| `ubicacion` | text | Ubicación preferida | 'Indistinto' |
| `personaFisica` | boolean | Persona física o moral | true |

**Llaves foráneas**:
- `uidr` → `catUsers.uid`
- `uidRC` → `catUsers.uid`
- `idInmobiliaria` → `catInmobiliarias.idInmobiliaria`
- `idEtapa` → `crm_Etapas.id`
- `idOrigen` → `crm_Origen.id`
- `idTipoCliente` → `crm_tipoCliente.id`
- `idTipoOperacion` → `crm_tipoOperaciones.id`
- `idTipoVenta` → `crm_tipoVenta.id`
- `idAsesorInm` → `catAsesoresInm.id`

**Notas importantes**:
- Cuando `aprobado` cambia a `true`, el lead se migra automáticamente a la tabla `leads`
- El registro original permanece en esta tabla con `aprobado=true`
- Campos adicionales como `superficie`, `KVAs`, `ubicacion` y `personaFisica` son específicos para el formulario público

---

### 3. `leads_duplicate` - Duplicado de Leads

**Propósito**: Tabla de respaldo duplicada de la tabla `leads`.

**Cantidad de registros**: 5,225

**Estructura**: Idéntica a la tabla `leads`

**Notas importantes**:
- Esta tabla es un duplicado para propósitos de respaldo
- No debe modificarse directamente
- Se mantiene sincronizada con la tabla `leads`

---

## 📚 Tablas de Catálogos CRM

### 4. `crm_Etapas` - Etapas del Proceso de Ventas

**Propósito**: Define las etapas por las que pasa un lead en el proceso de ventas.

**Cantidad de registros**: 12

**Estructura**:

| Columna | Tipo | Descripción | Default |
|---------|------|-------------|---------|
| `id` | bigint | ID único de la etapa (PK) | IDENTITY |
| `fc` | timestamptz | Fecha de creación | now() |
| `uidr` | uuid | Usuario que creó la etapa | NULL |
| `titulo` | text | Nombre de la etapa | NULL |
| `bkColor` | text | Color de fondo (hex) | '#39d2c0' |
| `txtColor` | text | Color de texto (hex) | '#ffffff' |
| `orden` | smallint | Orden de visualización | NULL |
| `status` | boolean | Estado activo/inactivo | true |
| `Posicion` | text | Posición en el pipeline | 'medio' |

**Notas importantes**:
- Las etapas se ordenan por el campo `orden`
- Los colores se usan para visualización en el frontend
- El campo `Posicion` indica: 'inicio', 'medio', 'fin'

---

### 5. `crm_Origen` - Origen de Leads

**Propósito**: Define los canales o fuentes de donde provienen los leads.

**Cantidad de registros**: 20

**Estructura**:

| Columna | Tipo | Descripción | Default |
|---------|------|-------------|---------|
| `id` | bigint | ID único del origen (PK) | IDENTITY |
| `fc` | timestamptz | Fecha de creación | now() |
| `uidc` | uuid | Usuario que creó el origen | NULL |
| `titulo` | text | Nombre del origen | NULL |
| `status` | boolean | Estado activo/inactivo | true |
| `bkColor` | text | Color de fondo (hex) | '#ffffff' |
| `txtColor` | text | Color de texto (hex) | '#000000' |

**Notas importantes**:
- Ejemplos de orígenes: Web, Referido, Publicidad, Evento, etc.
- Los colores se usan para diferenciación visual

---

### 6. `crm_tipoCliente` - Tipos de Cliente

**Propósito**: Clasifica a los leads según su tipo.

**Cantidad de registros**: 6

**Estructura**:

| Columna | Tipo | Descripción | Default |
|---------|------|-------------|---------|
| `id` | bigint | ID único del tipo (PK) | IDENTITY |
| `fc` | timestamptz | Fecha de creación | now() |
| `uidc` | uuid | Usuario que creó el tipo | NULL |
| `titulo` | text | Nombre del tipo de cliente | NULL |
| `status` | boolean | Estado activo/inactivo | true |
| `bkColor` | text | Color de fondo (hex) | '#ffffff' |
| `txtColor` | text | Color de texto (hex) | '#000000' |

**Notas importantes**:
- Ejemplos: Persona Física, Persona Moral, Inversionista, etc.

---

### 7. `crm_tipoOperaciones` - Tipos de Operaciones

**Propósito**: Define los tipos de operaciones de venta.

**Cantidad de registros**: 5

**Estructura**:

| Columna | Tipo | Descripción | Default |
|---------|------|-------------|---------|
| `id` | bigint | ID único del tipo (PK) | IDENTITY |
| `fc` | timestamptz | Fecha de creación | now() |
| `uidc` | uuid | Usuario que creó el tipo | NULL |
| `titulo` | text | Nombre del tipo de operación | NULL |
| `status` | boolean | Estado activo/inactivo | true |

**Notas importantes**:
- Ejemplos: Compra, Renta, Arrendamiento, etc.

---

### 8. `crm_tipoVenta` - Tipos de Venta

**Propósito**: Define las modalidades de venta.

**Cantidad de registros**: 8

**Estructura**:

| Columna | Tipo | Descripción | Default |
|---------|------|-------------|---------|
| `id` | bigint | ID único del tipo (PK) | IDENTITY |
| `fc` | timestamptz | Fecha de creación | now() |
| `uidc` | uuid | Usuario que creó el tipo | NULL |
| `idTipoOperacion` | bigint | FK: Tipo de operación padre | NULL |
| `titulo` | text | Nombre del tipo de venta | NULL |
| `status` | boolean | Estado activo/inactivo | true |

**Llaves foráneas**:
- `idTipoOperacion` → `crm_tipoOperaciones.id`

**Notas importantes**:
- Relaciona tipos de venta con tipos de operaciones
- Ejemplos: Contado, Financiado, Crédito, etc.

---

### 9. `crm_campania` - Campañas de Marketing

**Propósito**: Registra las campañas de marketing activas.

**Cantidad de registros**: 4

**Estructura**:

| Columna | Tipo | Descripción | Default |
|---------|------|-------------|---------|
| `id` | bigint | ID único de la campaña (PK) | IDENTITY |
| `fc` | timestamptz | Fecha de creación | now() |
| `uidc` | uuid | Usuario que creó la campaña | NULL |
| `titulo` | text | Nombre de la campaña | NULL |
| `status` | boolean | Estado activo/inactivo | true |
| `bkColor` | text | Color de fondo (hex) | '#ffffff' |
| `txtColor` | text | Color de texto (hex) | '#000000' |

**Llaves foráneas**:
- `uidc` → `catUsers.uid`

**Notas importantes**:
- Se usa para rastrear qué campaña generó un lead

---

### 10. `crm_Recepcion` - Medios de Recepción

**Propósito**: Define los medios por los que se recibieron los leads.

**Cantidad de registros**: 7

**Estructura**:

| Columna | Tipo | Descripción | Default |
|---------|------|-------------|---------|
| `id` | bigint | ID único del medio (PK) | IDENTITY |
| `fc` | timestamptz | Fecha de creación | now() |
| `uidc` | uuid | Usuario que creó el medio | NULL |
| `titulo` | text | Nombre del medio | NULL |
| `status` | boolean | Estado activo/inactivo | true |
| `bkColor` | text | Color de fondo (hex) | '#FFFFFF' |
| `txtColor` | text | Color de texto (hex) | '#000000' |

**Notas importantes**:
- Ejemplos: Email, Teléfono, WhatsApp, Formulario Web, etc.

---

### 11. `crm_Encuestas` - Encuestas del CRM

**Propósito**: Define las encuestas disponibles para leads.

**Cantidad de registros**: 4

**Estructura**:

| Columna | Tipo | Descripción | Default |
|---------|------|-------------|---------|
| `id` | bigint | ID único de la encuesta (PK) | IDENTITY |
| `fc` | timestamptz | Fecha de creación | now() |
| `uidc` | uuid | Usuario que creó la encuesta | NULL |
| `titulo` | text | Nombre de la encuesta | NULL |
| `status` | boolean | Estado activo/inactivo | true |
| `bkColor` | text | Color de fondo (hex) | '#FFFFFF' |
| `txtColor` | text | Color de texto (hex) | '#000000' |

**Notas importantes**:
- Se usa para registrar satisfacción de leads

---

### 12. `crm_responsableComercial` - Responsables Comerciales

**Propósito**: Define los usuarios que pueden ser responsables comerciales.

**Cantidad de registros**: 5

**Estructura**:

| Columna | Tipo | Descripción | Default |
|---------|------|-------------|---------|
| `uid` | uuid | FK: Usuario responsable (PK) | NULL |
| `id` | integer | ID numérico del RC (UNIQUE) | NULL |

**Llaves foráneas**:
- `uid` → `catUsers.uid`

**Notas importantes**:
- Tabla de referencia para asignar RCs
- El campo `id` es un identificador numérico único

---

## 🔗 Tablas de Relación

### 13. `catInmobiliarias` - Inmobiliarias

**Propósito**: Catálogo de inmobiliarias externas que pueden capturar leads.

**Cantidad de registros**: 65

**Estructura**:

| Columna | Tipo | Descripción | Default |
|---------|------|-------------|---------|
| `idInmobiliaria` | uuid | ID único de la inmobiliaria (PK) | gen_random_uuid() |
| `fc` | timestamp | Fecha de creación | now() |
| `status` | boolean | Estado activo/inactivo | true |
| `uidr` | uuid | Usuario que registró | NULL |
| `nombre` | text | Nombre de la inmobiliaria | NULL |
| `uidRC` | uuid | FK: Responsable Comercial asignado | NULL |
| `descripcion` | text | Descripción de la inmobiliaria | NULL |
| `paginaWeb` | text | Sitio web | NULL |
| `telefono` | text | Teléfono | NULL |
| `correo` | text | Correo electrónico | NULL |
| `nombreRepresentante` | text | Nombre del representante | NULL |
| `telRepresentante` | text | Teléfono del representante | NULL |
| `correoRepresentante` | text | Correo del representante | NULL |
| `puestoRepresentante` | text | Puesto del representante | NULL |

**Llaves foráneas**:
- `uidRC` → `catUsers.uid`
- `uidr` → `catUsers.uid`

---

### 14. `catAsesoresInm` - Asesores Inmobiliarios

**Propósito**: Catálogo de asesores inmobiliarios externos.

**Cantidad de registros**: 1

**Estructura**:

| Columna | Tipo | Descripción | Default |
|---------|------|-------------|---------|
| `id` | uuid | ID único del asesor (PK) | gen_random_uuid() |
| `fc` | timestamp | Fecha de creación | now() |
| `status` | boolean | Estado activo/inactivo | true |
| `uidr` | uuid | Usuario que registró | NULL |
| `idInmobiliaria` | uuid | FK: Inmobiliaria a la que pertenece | NULL |
| `nombre` | text | Nombre del asesor | NULL |
| `telefono` | text | Teléfono (UNIQUE) | NULL |
| `a` | text | Iniciales del asesor (UNIQUE) | NULL |
| `correo` | text | Correo electrónico | NULL |

**Llaves foráneas**:
- `idInmobiliaria` → `catInmobiliarias.idInmobiliaria`
- `uidr` → `catUsers.uid`

**Restricciones**:
- `telefono` debe ser único
- `a` (iniciales) debe ser único
- `nombre` debe tener más de 5 caracteres

---

## 📝 Tablas de Actividades y Seguimiento

### 15. `activity_history` - Historial de Actividades

**Propósito**: Registra todas las actividades e interacciones con los leads.

**Cantidad de registros**: 1,351

**Estructura**:

| Columna | Tipo | Descripción | Default |
|---------|------|-------------|---------|
| `id` | uuid | ID único de la actividad (PK) | gen_random_uuid() |
| `created_at` | timestamptz | Fecha y hora de creación | now() |
| `lead_id` | uuid | FK: Lead asociado | NULL |
| `name` | text | Nombre de la actividad | NULL |
| `activity_date` | timestamp | Fecha de la actividad | NULL |
| `message` | text | Mensaje de la actividad | NULL |
| `heat_level` | smallint | Nivel de importancia (1-5) | NULL |
| `user_id` | uuid | FK: Usuario que realizó la actividad | NULL |
| `type` | text | Tipo de actividad | NULL |
| `fechaAgenda` | timestamptz | Fecha agendada (si aplica) | NULL |
| `docs` | jsonb | Documentos adjuntos | NULL |

**Llaves foráneas**:
- `lead_id` → `leads.id`
- `user_id` → `catUsers.uid`

**Notas importantes**:
- Se usa para rastrear el historial completo de interacciones
- `heat_level` indica la importancia o urgencia
- `type` puede ser: llamada, email, visita, nota, aprobacion, etc.

---

### 16. `agenda` - Agenda de Actividades

**Propósito**: Registra actividades agendadas para seguimiento de leads.

**Cantidad de registros**: 1

**Estructura**:

| Columna | Tipo | Descripción | Default |
|---------|------|-------------|---------|
| `created_at` | timestamptz | Fecha de creación | now() |
| `user_ref` | uuid | FK: Usuario responsable | NULL |
| `name` | text | Nombre de la actividad | NULL |
| `description` | text | Descripción detallada | NULL |
| `lead_name` | text | Nombre del lead (referencia) | NULL |
| `date` | timestamp | Fecha de la actividad | NULL |
| `duration` | smallint | Duración en minutos | NULL |
| `ref` | text | Referencia externa | NULL |
| `id` | uuid | ID único (PK) | gen_random_uuid() |

**Llaves foráneas**:
- `user_ref` → `catUsers.uid`

**Notas importantes**:
- Se usa para gestionar citas y seguimientos agendados
- No tiene PK definida explícitamente

---

### 17. `crm_incidencias` - Incidencias del CRM

**Propósito**: Registra incidencias o problemas detectados en el CRM.

**Cantidad de registros**: 0

**Estructura**:

| Columna | Tipo | Descripción | Default |
|---------|------|-------------|---------|
| `id` | bigint | ID único de la incidencia (PK) | IDENTITY |
| `fc` | timestamptz | Fecha de creación | now() |
| `status` | boolean | Estado activo/inactivo | true |
| `idMensaje` | text | ID del mensaje relacionado | NULL |
| `fecha` | text | Fecha del incidente | NULL |
| `date` | timestamp | Fecha y hora del incidente | NULL |
| `messageid` | text | ID del mensaje | NULL |
| `from` | text | Remitente | NULL |
| `to` | text | Destinatario | NULL |
| `subject` | text | Asunto | NULL |
| `cuerpoPlano` | text | Cuerpo en texto plano | NULL |
| `textasHtml` | text | Cuerpo en HTML | NULL |
| `reference` | text | Referencia | NULL |
| `cadena` | boolean | Indica si es parte de una cadena | true |
| `fum` | timestamp | Fecha última modificación | NULL |

**Notas importantes**:
- Se usa para rastrear problemas en el procesamiento de correos
- Actualmente sin registros

---

### 18. `seguimientoComentarios` - Comentarios de Seguimiento

**Propósito**: Registra comentarios adicionales en el seguimiento de leads.

**Cantidad de registros**: 0

**Estructura**:

| Columna | Tipo | Descripción | Default |
|---------|------|-------------|---------|
| `idComentario` | text | ID único del comentario (PK) | NULL |
| `uidr` | text | Usuario que registró | NULL |
| `status` | boolean | Estado activo/inactivo | NULL |
| `fc` | timestamp | Fecha de creación | now() |
| `idCliente` | text | ID del cliente | NULL |
| `idLead` | text | ID del lead | NULL |
| `comentario` | text | Contenido del comentario | NULL |
| `fechaComentario` | date | Fecha del comentario | NULL |

**Notas importantes**:
- Tabla alternativa para comentarios
- Actualmente sin registros

---

## 📊 Diagrama de Relaciones

Para visualizar el diagrama de relaciones entre las tablas del CRM, consulte el archivo `schema_crm.dbml` en este mismo directorio.

---

## 🔒 Seguridad y Permisos

Todas las tablas del CRM tienen habilitado **Row Level Security (RLS)**. Los permisos se gestionan a través de la tabla `segModulosUsuarios` con las siguientes claves relevantes:

- **Clave 327**: CRM > Leads > Eliminar Leads
- **Clave 328**: CRM > Reportes de Leads

---

## 📝 Notas Importantes

1. **Campos Denormalizados**: Las tablas `leads` y `leads_porAprobar` mantienen campos denormalizados (como `Etapa`, `Origen`, etc.) para optimizar consultas. Estos campos se sincronizan mediante triggers.

2. **Migración de Leads**: El flujo de migración es:
   - Lead capturado → `leads_porAprobar`
   - Lead aprobado → `leads`
   - Validación de duplicados antes de migrar

3. **Activity History**: Cada interacción con un lead debe registrarse en `activity_history` para mantener un historial completo.

4. **Responsables Comerciales**: Los RCs se asignan a través del campo `uidRC` en las tablas de leads.

5. **Inmobiliarias Externas**: El sistema permite que inmobiliarias externas capturen leads a través de sus asesores.

---

## 📞 Soporte

Para más información sobre el CRM, contacte al equipo de desarrollo de SPH Bines Raices.
