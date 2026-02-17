# Tabla: crm_incidencias

**Última actualización**: 13/02/2026  
**Versión**: 1.0

---

## 📋 Descripción

La tabla [`crm_incidencias`](crm_incidencias/README.md) almacena las incidencias o problemas reportados en el sistema CRM. Permite rastrear y gestionar errores, problemas técnicos o incidencias operativas que ocurran durante el uso del sistema, facilitando su seguimiento y resolución.

---

## 📊 Estadísticas

- **Total de registros**: 0
- **Estado**: Activa
- **RLS**: Habilitado

---

## 🏗️ Estructura de la Tabla

| Columna | Tipo | Nulable | Default | Descripción |
|---------|------|---------|---------|-------------|
| `id` | `bigint` | No | `nextval('crm_incidencias_id_seq'::regclass)` | Identificador único de la incidencia |
| `fc` | `timestamp with time zone` | No | `now()` | Fecha y hora de creación del registro |
| `status` | `boolean` | Sí | `true` | Estado del registro (activo/inactivo) |
| `uidc` | `uuid` | Sí | | Usuario que creó el registro (FK a catUsers) |
| `comentario` | `text` | Sí | | Comentario o descripción de la incidencia |
| `incidencia` | `text` | No | | Identificador único de la incidencia |
| `fecha` | `text` | Sí | | Fecha asociada a la incidencia |
| `date` | `timestamp without time zone` | Sí | | Fecha y hora de la incidencia |
| `messageid` | `text` | Sí | | ID del mensaje asociado |
| `from` | `text` | Sí | | Remitente o origen del mensaje |
| `to` | `text` | Sí | | Destinatario del mensaje |
| `subject` | `text` | Sí | | Asunto del mensaje |
| `cuerpoPlano` | `text` | Sí | | Cuerpo del mensaje en texto plano |
| `textasHtml` | `text` | Sí | | Cuerpo del mensaje en formato HTML |
| `reference` | `text` | Sí | | Referencia adicional |
| `cadena` | `boolean` | Sí | `true` | Indica si es parte de una cadena |
| `fum` | `timestamp without time zone` | Sí | | Fecha de última modificación |

---

## 🔗 Claves Foráneas

| Columna | Tabla Referenciada | Columna Referenciada |
|---------|-------------------|---------------------|
| `uidc` | `catUsers` | `uid` |
| `incidencia` | `soportes` | `insidencia` |

---

## 🔄 Relaciones con Otras Tablas

### Tablas Referenciadas por `crm_incidencias`

1. **[`catUsers`](catUsers/README.md)**
   - Relación: Cada incidencia es creada por un usuario
   - Campo: `uidc` → `uid`

### Tablas que Referencian a `crm_incidencias`

1. **[`soportes`](soportes/README.md)**
   - Relación: Las incidencias están asociadas a tickets de soporte
   - Campo: `incidencia` → `insidencia`

---

## ⚙️ Funciones Asociadas

Actualmente no hay funciones específicas documentadas para esta tabla.

---

## 🔒 Seguridad

### Row Level Security (RLS)

La tabla [`crm_incidencias`](crm_incidencias/README.md) tiene RLS habilitado. Las políticas de RLS controlan el acceso a los registros basándose en los permisos del usuario.

---

## 📝 Notas Importantes

1. **Rastreo de Problemas**: Esta tabla es fundamental para mantener un historial de incidencias en el sistema CRM, permitiendo análisis de problemas recurrentes y métricas de calidad.

2. **Información Detallada**: Los campos `from`, `to`, `subject`, `cuerpoPlano` y `textasHtml` permiten almacenar información completa sobre las comunicaciones relacionadas con la incidencia.

3. **Cadena de Mensajes**: El campo `cadena` indica si la incidencia es parte de una cadena o secuencia de mensajes relacionados.

4. **Estado Actual**: La tabla no tiene registros (0), lo que sugiere que esta funcionalidad podría estar en proceso de implementación o subutilizada.

5. **Seguimiento de Modificaciones**: El campo `fum` permite rastrear cuándo fue la última modificación del registro, útil para auditoría.

---

## 📞 Soporte

Para más información sobre la tabla [`crm_incidencias`](crm_incidencias/README.md), consulte:
- Documentación del módulo CRM: [`docs/CRM/README.md`](docs/CRM/README.md)
- Documentación de funciones CRM: [`docs/CRM/Documentacion_Funciones_CRM.md`](docs/CRM/Documentacion_Funciones_CRM.md)
- Diagrama de relaciones CRM: [`docs/CRM/schema_crm.dbml`](docs/CRM/schema_crm.dbml)
