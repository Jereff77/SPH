# Tabla: crm_tipoCliente

**Última actualización**: 13/02/2026  
**Versión**: 1.0

---

## 📋 Descripción

La tabla [`crm_tipoCliente`](crm_tipoCliente/README.md) almacena los diferentes tipos de clientes que pueden ser asignados a los leads en el sistema CRM. Cada registro representa una clasificación específica de cliente, como persona física, persona moral, inversionista, entre otros. Los tipos de cliente se utilizan para segmentar y personalizar el tratamiento de los leads según sus características.

---

## 📊 Estadísticas

- **Total de registros**: 6
- **Estado**: Activa
- **RLS**: Habilitado

---

## 🏗️ Estructura de la Tabla

| Columna | Tipo | Nulable | Default | Descripción |
|---------|------|---------|---------|-------------|
| `id` | `integer` | No | `nextval('crm_tipocliente_id_seq'::regclass)` | Identificador único del tipo de cliente |
| `fc` | `timestamp` | No | `now()` | Fecha y hora de creación del registro |
| `status` | `boolean` | No | `true` | Estado del registro (activo/inactivo) |
| `nombre` | `text` | No | | Nombre del tipo de cliente |

---

## 🔗 Claves Foráneas

No tiene claves foráneas.

---

## 🔄 Relaciones con Otras Tablas

### Tablas que Referencian a `crm_tipoCliente`

1. **[`leads`](leads/README.md)**
   - Relación: Cada lead puede tener un tipo de cliente asignado
   - Campo: `idTipoCliente` → `id`

2. **[`leads_porAprobar`](leads_porAprobar/README.md)**
   - Relación: Cada lead por aprobar puede tener un tipo de cliente asignado
   - Campo: `idTipoCliente` → `id`

3. **[`leads_duplicate`](leads_duplicate/README.md)**
   - Relación: Cada lead duplicado puede tener un tipo de cliente asignado
   - Campo: `idTipoCliente` → `id`

---

## ⚙️ Funciones Asociadas

No hay funciones específicas que operen directamente sobre la tabla [`crm_tipoCliente`](crm_tipoCliente/README.md).

---

## 🔒 Seguridad

### Row Level Security (RLS)

La tabla [`crm_tipoCliente`](crm_tipoCliente/README.md) tiene RLS habilitado. Las políticas de RLS controlan el acceso a los registros basándose en los permisos del usuario.

---

## 📝 Notas Importantes

1. **Clasificación de Clientes**: Los tipos de cliente permiten clasificar a los leads según sus características y necesidades.

2. **Segmentación**: Los tipos de cliente se utilizan para segmentar los leads y personalizar el tratamiento según su clasificación.

3. **Tipos de Cliente Activos**: Solo los tipos de cliente con `status = true` están disponibles para asignación a leads.

4. **Personalización del Tratamiento**: Los tipos de cliente permiten adaptar el enfoque de ventas según las características del lead.

5. **Flexibilidad**: La tabla permite agregar nuevos tipos de cliente según las necesidades del negocio.

---

## 📞 Soporte

Para más información sobre la tabla [`crm_tipoCliente`](crm_tipoCliente/README.md), consulte:
- Documentación del módulo Leads: [`Leads/README.md`](Leads/README.md)
- Documentación de funciones CRM: [`docs/CRM/Documentacion_Funciones_CRM.md`](docs/CRM/Documentacion_Funciones_CRM.md)
- Diagrama de relaciones CRM: [`docs/CRM/schema_crm.dbml`](docs/CRM/schema_crm.dbml)
