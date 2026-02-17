# Tabla: crm_campania

**Última actualización**: 13/02/2026  
**Versión**: 1.0

---

## 📋 Descripción

La tabla [`crm_campania`](crm_campania/README.md) almacena las diferentes campañas de marketing del sistema CRM. Cada registro representa una campaña específica de marketing o promoción que puede ser origen de leads. Las campañas se utilizan para rastrear la efectividad de las diferentes iniciativas de marketing y promoción.

---

## 📊 Estadísticas

- **Total de registros**: 4
- **Estado**: Activa
- **RLS**: Habilitado

---

## 🏗️ Estructura de la Tabla

| Columna | Tipo | Nulable | Default | Descripción |
|---------|------|---------|---------|-------------|
| `id` | `integer` | No | `nextval('crm_campania_id_seq'::regclass)` | Identificador único de la campaña |
| `fc` | `timestamp` | No | `now()` | Fecha y hora de creación del registro |
| `status` | `boolean` | No | `true` | Estado del registro (activo/inactivo) |
| `nombre` | `text` | No | | Nombre de la campaña de marketing |

---

## 🔗 Claves Foráneas

No tiene claves foráneas.

---

## 🔄 Relaciones con Otras Tablas

### Tablas que Referencian a `crm_campania`

1. **[`leads`](leads/README.md)**
   - Relación: Cada lead puede provenir de una campaña específica
   - Campo: `idCampania` → `id`

2. **[`leads_porAprobar`](leads_porAprobar/README.md)**
   - Relación: Cada lead por aprobar puede provenir de una campaña específica
   - Campo: `idCampania` → `id`

3. **[`leads_duplicate`](leads_duplicate/README.md)**
   - Relación: Cada lead duplicado puede provenir de una campaña específica
   - Campo: `idCampania` → `id`

---

## ⚙️ Funciones Asociadas

No hay funciones específicas que operen directamente sobre la tabla [`crm_campania`](crm_campania/README.md).

---

## 🔒 Seguridad

### Row Level Security (RLS)

La tabla [`crm_campania`](crm_campania/README.md) tiene RLS habilitado. Las políticas de RLS controlan el acceso a los registros basándose en los permisos del usuario.

---

## 📝 Notas Importantes

1. **Campañas de Marketing**: Las campañas representan iniciativas de marketing y promoción para la captación de leads.

2. **Rastreo de Efectividad**: Las campañas se utilizan para rastrear la efectividad de las diferentes iniciativas de marketing.

3. **Origen de Leads**: Las campañas pueden ser el origen de los leads capturados en el sistema.

4. **Campañas Activas**: Solo las campañas con `status = true` están disponibles para asignación a leads.

5. **Flexibilidad**: La tabla permite agregar nuevas campañas según las necesidades del negocio.

---

## 📞 Soporte

Para más información sobre la tabla [`crm_campania`](crm_campania/README.md), consulte:
- Documentación del módulo Leads: [`Leads/README.md`](Leads/README.md)
- Documentación de funciones CRM: [`docs/CRM/Documentacion_Funciones_CRM.md`](docs/CRM/Documentacion_Funciones_CRM.md)
- Diagrama de relaciones CRM: [`docs/CRM/schema_crm.dbml`](docs/CRM/schema_crm.dbml)
