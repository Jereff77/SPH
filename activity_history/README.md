# Tabla: activity_history

**Última actualización**: 13/02/2026  
**Versión**: 1.0

---

## 📋 Descripción

La tabla [`activity_history`](activity_history/README.md) almacena el historial de actividades y seguimientos realizados sobre los leads en el sistema CRM. Cada registro representa una actividad específica como llamadas, correos, reuniones, o cualquier interacción con un lead, permitiendo mantener un seguimiento completo del proceso de ventas.

---

## 📊 Estadísticas

- **Total de registros**: 1,351
- **Estado**: Activa
- **RLS**: Habilitado

---

## 🏗️ Estructura de la Tabla

| Columna | Tipo | Nulable | Default | Descripción |
|---------|------|---------|---------|-------------|
| `id` | `uuid` | No | `gen_random_uuid()` | Identificador único de la actividad |
| `created_at` | `timestamp with time zone` | No | `now()` | Fecha y hora de creación de la actividad |
| `lead_id` | `uuid` | Sí | | ID del lead asociado (FK a leads) |
| `name` | `text` | Sí | | Nombre o tipo de actividad |
| `activity_date` | `timestamp without time zone` | Sí | | Fecha en que se realizó la actividad |
| `message` | `text` | Sí | | Mensaje o descripción de la actividad |
| `heat_level` | `smallint` | Sí | | Nivel de importancia/urgencia de la actividad |
| `user_id` | `uuid` | Sí | | ID del usuario que registró la actividad (FK a catUsers) |
| `type` | `text` | Sí | | Tipo de actividad (llamada, correo, visita, etc.) |
| `fechaAgenda` | `timestamp with time zone` | Sí | | Fecha agendada para la actividad (si aplica) |
| `docs` | `jsonb` | Sí | | Documentos adjuntos a la actividad en formato JSON |

---

## 🔗 Claves Foráneas

| Columna | Tabla Referenciada | Columna Referenciada |
|---------|-------------------|---------------------|
| `lead_id` | `leads` | `id` |
| `user_id` | `catUsers` | `uid` |

---

## 🔄 Relaciones con Otras Tablas

### Tablas Referenciadas por `activity_history`

1. **[`leads`](leads/README.md)**
   - Relación: Cada actividad pertenece a un lead específico
   - Campo: `lead_id` → `id`

2. **[`catUsers`](catUsers/README.md)**
   - Relación: Cada actividad es registrada por un usuario
   - Campo: `user_id` → `uid`

### Tablas que Referencian a `activity_history`

Actualmente no hay tablas que referencien directamente a `activity_history`.

---

## ⚙️ Funciones Asociadas

Actualmente no hay funciones específicas documentadas para esta tabla.

---

## 🔒 Seguridad

### Row Level Security (RLS)

La tabla [`activity_history`](activity_history/README.md) tiene RLS habilitado. Las políticas de RLS controlan el acceso a los registros basándose en los permisos del usuario.

---

## 📝 Notas Importantes

1. **Seguimiento de Leads**: Esta tabla es fundamental para mantener el historial completo de interacciones con cada lead, permitiendo a los responsables comerciales conocer el estado y progreso del proceso de ventas.

2. **Tipos de Actividades**: El campo `type` permite clasificar diferentes tipos de interacciones (llamadas, correos, visitas, reuniones, etc.).

3. **Documentos Adjuntos**: El campo `docs` en formato JSON permite almacenar información sobre documentos adjuntos a cada actividad.

4. **Nivel de Importancia**: El campo `heat_level` indica la urgencia o importancia de la actividad, útil para priorizar seguimientos.

5. **Fecha Agendada**: El campo `fechaAgenda` permite registrar actividades futuras o programadas.

---

## 📞 Soporte

Para más información sobre la tabla [`activity_history`](activity_history/README.md), consulte:
- Documentación del módulo Leads: [`Leads/README.md`](Leads/README.md)
- Documentación de funciones CRM: [`Leads/Funciones_Leads.md`](Leads/Funciones_Leads.md)
- Diagrama de relaciones CRM: [`docs/CRM/schema_crm.dbml`](docs/CRM/schema_crm.dbml)
