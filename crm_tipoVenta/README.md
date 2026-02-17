# Tabla: crm_tipoVenta

**Última actualización**: 13/02/2026  
**Versión**: 1.0

---

## 📋 Descripción

La tabla [`crm_tipoVenta`](crm_tipoVenta/README.md) almacena los diferentes tipos de venta específicos que pueden ser de interés para los leads en el sistema CRM. Cada registro representa un tipo de venta específico que pertenece a un tipo de operación general. Los tipos de venta se utilizan para clasificar los leads según el tipo de venta específico que desean realizar.

---

## 📊 Estadísticas

- **Total de registros**: 8
- **Estado**: Activa
- **RLS**: Habilitado

---

## 🏗️ Estructura de la Tabla

| Columna | Tipo | Nulable | Default | Descripción |
|---------|------|---------|---------|-------------|
| `id` | `integer` | No | `nextval('crm_tipoventa_id_seq'::regclass)` | Identificador único del tipo de venta |
| `fc` | `timestamp` | No | `now()` | Fecha y hora de creación del registro |
| `status` | `boolean` | No | `true` | Estado del registro (activo/inactivo) |
| `nombre` | `text` | No | | Nombre del tipo de venta |
| `idTipoOperacion` | `integer` | No | | Tipo de operación al que pertenece (FK a crm_tipoOperaciones) |

---

## 🔗 Claves Foráneas

| Columna | Tabla Referenciada | Columna Referenciada |
|---------|-------------------|---------------------|
| `idTipoOperacion` | `crm_tipoOperaciones` | `id` |

---

## 🔄 Relaciones con Otras Tablas

### Tablas que Referencian a `crm_tipoVenta`

1. **[`leads`](leads/README.md)**
   - Relación: Cada lead está interesado en un tipo de venta específico
   - Campo: `idTipoVenta` → `id`

2. **[`leads_porAprobar`](leads_porAprobar/README.md)**
   - Relación: Cada lead por aprobar está interesado en un tipo de venta específico
   - Campo: `idTipoVenta` → `id`

3. **[`leads_duplicate`](leads_duplicate/README.md)**
   - Relación: Cada lead duplicado está interesado en un tipo de venta específico
   - Campo: `idTipoVenta` → `id`

### Tablas Referenciadas por `crm_tipoVenta`

1. **[`crm_tipoOperaciones`](crm_tipoOperaciones/README.md)**
   - Relación: Cada tipo de venta pertenece a un tipo de operación
   - Campo: `idTipoOperacion` → `id`

---

## ⚙️ Funciones Asociadas

### Funciones que Operan sobre `crm_tipoVenta`

1. **[`crm_tipoventa_obtener_activos`](Leads/funciones y trigger/trigger_leads_poraprobar_validar_y_migrar_automaticamente.sql)**
   - **Descripción**: Obtener tipos de venta activos
   - **Retorno**: TABLE con todos los campos de la tabla
   - **Uso**: Para mostrar la lista de tipos de venta disponibles en formularios
   - **Filtro**: Solo retorna registros con `status = true`

---

## 🔒 Seguridad

### Row Level Security (RLS)

La tabla [`crm_tipoVenta`](crm_tipoVenta/README.md) tiene RLS habilitado. Las políticas de RLS controlan el acceso a los registros basándose en los permisos del usuario.

---

## 📝 Notas Importantes

1. **Tipos de Venta Específicos**: Los tipos de venta representan opciones específicas dentro de cada tipo de operación.

2. **Jerarquía**: Los tipos de venta son hijos de los tipos de operaciones. Cada tipo de venta pertenece a un tipo de operación específico.

3. **Clasificación de Leads**: Los tipos de venta se utilizan para clasificar los leads según el tipo de venta específico que desean realizar.

4. **Tipos de Venta Activos**: Solo los tipos de venta con `status = true` están disponibles para asignación a leads.

5. **Flexibilidad**: La tabla permite agregar nuevos tipos de venta según las necesidades del negocio.

---

## 📞 Soporte

Para más información sobre la tabla [`crm_tipoVenta`](crm_tipoVenta/README.md), consulte:
- Documentación del módulo Leads: [`Leads/README.md`](Leads/README.md)
- Documentación de funciones CRM: [`docs/CRM/Documentacion_Funciones_CRM.md`](docs/CRM/Documentacion_Funciones_CRM.md)
- Diagrama de relaciones CRM: [`docs/CRM/schema_crm.dbml`](docs/CRM/schema_crm.dbml)
