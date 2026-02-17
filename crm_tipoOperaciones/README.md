# Tabla: crm_tipoOperaciones

**Última actualización**: 13/02/2026  
**Versión**: 1.0

---

## 📋 Descripción

La tabla [`crm_tipoOperaciones`](crm_tipoOperaciones/README.md) almacena los diferentes tipos de operaciones inmobiliarias que pueden ser de interés para los leads en el sistema CRM. Cada registro representa una categoría general de operación, como venta, renta, arrendamiento financiero, entre otros. Los tipos de operaciones se utilizan para clasificar los leads según el tipo de operación que desean realizar.

---

## 📊 Estadísticas

- **Total de registros**: 5
- **Estado**: Activa
- **RLS**: Habilitado

---

## 🏗️ Estructura de la Tabla

| Columna | Tipo | Nulable | Default | Descripción |
|---------|------|---------|---------|-------------|
| `id` | `integer` | No | `nextval('crm_tipooperaciones_id_seq'::regclass)` | Identificador único del tipo de operación |
| `fc` | `timestamp` | No | `now()` | Fecha y hora de creación del registro |
| `status` | `boolean` | No | `true` | Estado del registro (activo/inactivo) |
| `nombre` | `text` | No | | Nombre del tipo de operación |

---

## 🔗 Claves Foráneas

No tiene claves foráneas.

---

## 🔄 Relaciones con Otras Tablas

### Tablas que Referencian a `crm_tipoOperaciones`

1. **[`crm_tipoVenta`](crm_tipoVenta/README.md)**
   - Relación: Cada tipo de venta pertenece a un tipo de operación
   - Campo: `idTipoOperacion` → `id`

2. **[`leads`](leads/README.md)**
   - Relación: Cada lead está interesado en un tipo de operación
   - Campo: `idTipoOperacion` → `id`

3. **[`leads_porAprobar`](leads_porAprobar/README.md)**
   - Relación: Cada lead por aprobar está interesado en un tipo de operación
   - Campo: `idTipoOperacion` → `id`

4. **[`leads_duplicate`](leads_duplicate/README.md)**
   - Relación: Cada lead duplicado está interesado en un tipo de operación
   - Campo: `idTipoOperacion` → `id`

---

## ⚙️ Funciones Asociadas

### Funciones que Operan sobre `crm_tipoOperaciones`

1. **[`crm_tipooperaciones_obtener_activos`](Leads/funciones y trigger/trigger_leads_poraprobar_validar_y_migrar_automaticamente.sql)**
   - **Descripción**: Obtener tipos de operación activos
   - **Retorno**: TABLE con todos los campos de la tabla
   - **Uso**: Para mostrar la lista de tipos de operación disponibles en formularios
   - **Filtro**: Solo retorna registros con `status = true`

---

## 🔒 Seguridad

### Row Level Security (RLS)

La tabla [`crm_tipoOperaciones`](crm_tipoOperaciones/README.md) tiene RLS habilitado. Las políticas de RLS controlan el acceso a los registros basándose en los permisos del usuario.

---

## 📝 Notas Importantes

1. **Categorización de Operaciones**: Los tipos de operaciones representan categorías generales de operaciones inmobiliarias.

2. **Jerarquía**: Los tipos de operaciones son categorías generales que pueden tener tipos de venta específicos asociados.

3. **Clasificación de Leads**: Los tipos de operaciones se utilizan para clasificar los leads según el tipo de operación que desean realizar.

4. **Tipos de Operación Activos**: Solo los tipos de operación con `status = true` están disponibles para asignación a leads.

5. **Flexibilidad**: La tabla permite agregar nuevos tipos de operación según las necesidades del negocio.

---

## 📞 Soporte

Para más información sobre la tabla [`crm_tipoOperaciones`](crm_tipoOperaciones/README.md), consulte:
- Documentación del módulo Leads: [`Leads/README.md`](Leads/README.md)
- Documentación de funciones CRM: [`docs/CRM/Documentacion_Funciones_CRM.md`](docs/CRM/Documentacion_Funciones_CRM.md)
- Diagrama de relaciones CRM: [`docs/CRM/schema_crm.dbml`](docs/CRM/schema_crm.dbml)
