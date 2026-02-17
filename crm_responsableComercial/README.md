# Tabla: crm_responsableComercial

**Última actualización**: 13/02/2026  
**Versión**: 1.0

---

## 📋 Descripción

La tabla [`crm_responsableComercial`](crm_responsableComercial/README.md) almacena los diferentes responsables comerciales que pueden ser asignados a los leads en el sistema CRM. Cada registro representa un responsable comercial específico que puede ser asignado a leads para su seguimiento y atención. Los responsables comerciales son los encargados de gestionar los leads y avanzarlos en el proceso de ventas.

---

## 📊 Estadísticas

- **Total de registros**: 5
- **Estado**: Activa
- **RLS**: Habilitado

---

## 🏗️ Estructura de la Tabla

| Columna | Tipo | Nulable | Default | Descripción |
|---------|------|---------|---------|-------------|
| `id` | `integer` | No | `nextval('crm_responsablecomercial_id_seq'::regclass)` | Identificador único del responsable comercial |
| `fc` | `timestamp` | No | `now()` | Fecha y hora de creación del registro |
| `status` | `boolean` | No | `true` | Estado del registro (activo/inactivo) |
| `nombre` | `text` | No | | Nombre del responsable comercial |

---

## 🔗 Claves Foráneas

No tiene claves foráneas.

---

## 🔄 Relaciones con Otras Tablas

### Tablas que Referencian a `crm_responsableComercial`

No hay tablas que referencien directamente a `crm_responsableComercial`. Esta tabla se utiliza como catálogo de responsables comerciales disponibles para asignación a leads.

---

## ⚙️ Funciones Asociadas

No hay funciones específicas que operen directamente sobre la tabla [`crm_responsableComercial`](crm_responsableComercial/README.md).

---

## 🔒 Seguridad

### Row Level Security (RLS)

La tabla [`crm_responsableComercial`](crm_responsableComercial/README.md) tiene RLS habilitado. Las políticas de RLS controlan el acceso a los registros basándose en los permisos del usuario.

---

## 📝 Notas Importantes

1. **Responsables Comerciales**: Los responsables comerciales son los encargados de gestionar los leads y avanzarlos en el proceso de ventas.

2. **Asignación a Leads**: Los responsables comerciales pueden ser asignados a leads para su seguimiento y atención.

3. **Gestión de Leads**: Los responsables comerciales son responsables de gestionar los leads asignados y avanzarlos en el proceso de ventas.

4. **Responsables Comerciales Activos**: Solo los responsables comerciales con `status = true` están disponibles para asignación a leads.

5. **Flexibilidad**: La tabla permite agregar nuevos responsables comerciales según las necesidades del negocio.

---

## 📞 Soporte

Para más información sobre la tabla [`crm_responsableComercial`](crm_responsableComercial/README.md), consulte:
- Documentación del módulo Leads: [`Leads/README.md`](Leads/README.md)
- Documentación de funciones CRM: [`docs/CRM/Documentacion_Funciones_CRM.md`](docs/CRM/Documentacion_Funciones_CRM.md)
- Diagrama de relaciones CRM: [`docs/CRM/schema_crm.dbml`](docs/CRM/schema_crm.dbml)
