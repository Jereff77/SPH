# Tabla: agenda

**Última actualización**: 13/02/2026  
**Versión**: 1.0

---

## 📋 Descripción

La tabla [`agenda`](agenda/README.md) almacena actividades agendadas relacionadas con leads y usuarios del sistema CRM. Permite programar reuniones, llamadas, visitas y otras actividades futuras, asegurando un seguimiento organizado y oportuno de los prospectos y clientes.

---

## 📊 Estadísticas

- **Total de registros**: 1
- **Estado**: Activa
- **RLS**: Habilitado

---

## 🏗️ Estructura de la Tabla

| Columna | Tipo | Nulable | Default | Descripción |
|---------|------|---------|---------|-------------|
| `created_at` | `timestamp with time zone` | No | `now()` | Fecha y hora de creación del registro |
| `user_ref` | `uuid` | Sí | | ID del usuario que creó la agenda (FK a catUsers) |
| `name` | `text` | Sí | | Nombre o título de la actividad agendada |
| `description` | `text` | Sí | | Descripción detallada de la actividad |
| `lead_name` | `text` | Sí | | Nombre del lead asociado a la actividad |
| `date` | `timestamp without time zone` | Sí | | Fecha y hora programada para la actividad |
| `duration` | `smallint` | Sí | | Duración estimada de la actividad en minutos |
| `ref` | `text` | Sí | | Referencia o identificador adicional |
| `id` | `uuid` | Sí | `gen_random_uuid()` | Identificador único del registro de agenda |

---

## 🔗 Claves Foráneas

| Columna | Tabla Referenciada | Columna Referenciada |
|---------|-------------------|---------------------|
| `user_ref` | `catUsers` | `uid` |

---

## 🔄 Relaciones con Otras Tablas

### Tablas Referenciadas por `agenda`

1. **[`catUsers`](catUsers/README.md)**
   - Relación: Cada actividad agendada es creada por un usuario
   - Campo: `user_ref` → `uid`

### Tablas que Referencian a `agenda`

Actualmente no hay tablas que referencian directamente a `agenda`.

---

## ⚙️ Funciones Asociadas

Actualmente no hay funciones específicas documentadas para esta tabla.

---

## 🔒 Seguridad

### Row Level Security (RLS)

La tabla [`agenda`](agenda/README.md) tiene RLS habilitado. Las políticas de RLS controlan el acceso a los registros basándose en los permisos del usuario.

---

## 📝 Notas Importantes

1. **Organización de Actividades**: Esta tabla permite mantener un calendario organizado de actividades futuras, facilitando la planificación del trabajo de los responsables comerciales.

2. **Asociación con Leads**: Aunque no tiene una FK directa a la tabla `leads`, el campo `lead_name` permite identificar el lead asociado a cada actividad.

3. **Duración de Actividades**: El campo `duration` permite especificar cuánto tiempo se espera que dure cada actividad, útil para planificar el día de trabajo.

4. **Referencias**: El campo `ref` permite agregar identificadores adicionales para integración con otros sistemas o procesos.

5. **Estado Actual**: La tabla tiene muy pocos registros (1), lo que sugiere que esta funcionalidad podría estar subutilizada o en proceso de implementación.

---

## 📞 Soporte

Para más información sobre la tabla [`agenda`](agenda/README.md), consulte:
- Documentación del módulo Leads: [`Leads/README.md`](Leads/README.md)
- Documentación de funciones CRM: [`Leads/Funciones_Leads.md`](Leads/Funciones_Leads.md)
- Diagrama de relaciones CRM: [`docs/CRM/schema_crm.dbml`](docs/CRM/schema_crm.dbml)
