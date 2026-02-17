# Tabla: crm_Recepcion

**Última actualización**: 13/02/2026  
**Versión**: 1.0

---

## 📋 Descripción

La tabla [`crm_Recepcion`](crm_Recepcion/README.md) almacena los diferentes medios de recepción de leads en el sistema CRM. Cada registro representa un medio específico por el cual un lead puede ser recibido, como formulario web, email, teléfono, redes sociales, entre otros. Los medios de recepción se utilizan para clasificar y analizar los canales de entrada de leads.

---

## 📊 Estadísticas

- **Total de registros**: 7
- **Estado**: Activa
- **RLS**: Habilitado

---

## 🏗️ Estructura de la Tabla

| Columna | Tipo | Nulable | Default | Descripción |
|---------|------|---------|---------|-------------|
| `id` | `integer` | No | `nextval('crm_recepcion_id_seq'::regclass)` | Identificador único del medio de recepción |
| `fc` | `timestamp` | No | `now()` | Fecha y hora de creación del registro |
| `status` | `boolean` | No | `true` | Estado del registro (activo/inactivo) |
| `nombre` | `text` | No | | Nombre del medio de recepción |

---

## 🔗 Claves Foráneas

No tiene claves foráneas.

---

## 🔄 Relaciones con Otras Tablas

### Tablas que Referencian a `crm_Recepcion`

1. **[`leads`](leads/README.md)**
   - Relación: Cada lead fue recibido por un medio específico
   - Campo: `idRecepcion` → `id`

2. **[`leads_porAprobar`](leads_porAprobar/README.md)**
   - Relación: Cada lead por aprobar fue recibido por un medio específico
   - Campo: `idRecepcion` → `id`

3. **[`leads_duplicate`](leads_duplicate/README.md)**
   - Relación: Cada lead duplicado fue recibido por un medio específico
   - Campo: `idRecepcion` → `id`

---

## ⚙️ Funciones Asociadas

No hay funciones específicas que operen directamente sobre la tabla [`crm_Recepcion`](crm_Recepcion/README.md).

---

## 🔒 Seguridad

### Row Level Security (RLS)

La tabla [`crm_Recepcion`](crm_Recepcion/README.md) tiene RLS habilitado. Las políticas de RLS controlan el acceso a los registros basándose en los permisos del usuario.

---

## 📝 Notas Importantes

1. **Medios de Recepción**: Los medios de recepción representan los diferentes canales por los cuales se pueden recibir leads en el sistema.

2. **Análisis de Canales**: Los medios de recepción se utilizan para analizar la efectividad de los diferentes canales de entrada de leads.

3. **Clasificación de Leads**: Los medios de recepción permiten clasificar los leads según el canal por el cual fueron recibidos.

4. **Medios de Recepción Activos**: Solo los medios de recepción con `status = true` están disponibles para asignación a leads.

5. **Flexibilidad**: La tabla permite agregar nuevos medios de recepción según las necesidades del negocio.

---

## 📞 Soporte

Para más información sobre la tabla [`crm_Recepcion`](crm_Recepcion/README.md), consulte:
- Documentación del módulo Leads: [`Leads/README.md`](Leads/README.md)
- Documentación de funciones CRM: [`docs/CRM/Documentacion_Funciones_CRM.md`](docs/CRM/Documentacion_Funciones_CRM.md)
- Diagrama de relaciones CRM: [`docs/CRM/schema_crm.dbml`](docs/CRM/schema_crm.dbml)
