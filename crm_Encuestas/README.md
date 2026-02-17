# Tabla: crm_Encuestas

**Última actualización**: 13/02/2026  
**Versión**: 1.0

---

## 📋 Descripción

La tabla [`crm_Encuestas`](crm_Encuestas/README.md) almacena las diferentes encuestas de satisfacción disponibles en el sistema CRM. Cada registro representa una encuesta específica que puede ser asignada a los leads para medir su satisfacción o recopilar información adicional. Las encuestas se utilizan para mejorar el servicio y obtener retroalimentación de los clientes.

---

## 📊 Estadísticas

- **Total de registros**: 4
- **Estado**: Activa
- **RLS**: Habilitado

---

## 🏗️ Estructura de la Tabla

| Columna | Tipo | Nulable | Default | Descripción |
|---------|------|---------|---------|-------------|
| `id` | `integer` | No | `nextval('crm_encuestas_id_seq'::regclass)` | Identificador único de la encuesta |
| `fc` | `timestamp` | No | `now()` | Fecha y hora de creación del registro |
| `status` | `boolean` | No | `true` | Estado del registro (activo/inactivo) |
| `nombre` | `text` | No | | Nombre de la encuesta |

---

## 🔗 Claves Foráneas

No tiene claves foráneas.

---

## 🔄 Relaciones con Otras Tablas

### Tablas que Referencian a `crm_Encuestas`

1. **[`leads`](leads/README.md)**
   - Relación: Cada lead puede tener una encuesta asignada
   - Campo: `idEncuesta` → `id`

2. **[`leads_porAprobar`](leads_porAprobar/README.md)**
   - Relación: Cada lead por aprobar puede tener una encuesta asignada
   - Campo: `idEncuesta` → `id`

3. **[`leads_duplicate`](leads_duplicate/README.md)**
   - Relación: Cada lead duplicado puede tener una encuesta asignada
   - Campo: `idEncuesta` → `id`

---

## ⚙️ Funciones Asociadas

No hay funciones específicas que operen directamente sobre la tabla [`crm_Encuestas`](crm_Encuestas/README.md).

---

## 🔒 Seguridad

### Row Level Security (RLS)

La tabla [`crm_Encuestas`](crm_Encuestas/README.md) tiene RLS habilitado. Las políticas de RLS controlan el acceso a los registros basándose en los permisos del usuario.

---

## 📝 Notas Importantes

1. **Encuestas de Satisfacción**: Las encuestas representan cuestionarios de satisfacción o recopilación de información adicional.

2. **Mejora del Servicio**: Las encuestas se utilizan para mejorar el servicio y obtener retroalimentación de los clientes.

3. **Asignación a Leads**: Las encuestas pueden ser asignadas a los leads para medir su satisfacción o recopilar información adicional.

4. **Encuestas Activas**: Solo las encuestas con `status = true` están disponibles para asignación a leads.

5. **Flexibilidad**: La tabla permite agregar nuevas encuestas según las necesidades del negocio.

---

## 📞 Soporte

Para más información sobre la tabla [`crm_Encuestas`](crm_Encuestas/README.md), consulte:
- Documentación del módulo Leads: [`Leads/README.md`](Leads/README.md)
- Documentación de funciones CRM: [`docs/CRM/Documentacion_Funciones_CRM.md`](docs/CRM/Documentacion_Funciones_CRM.md)
- Diagrama de relaciones CRM: [`docs/CRM/schema_crm.dbml`](docs/CRM/schema_crm.dbml)
