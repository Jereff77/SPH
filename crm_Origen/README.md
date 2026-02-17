# Tabla: crm_Origen

**Última actualización**: 13/02/2026  
**Versión**: 1.0

---

## 📋 Descripción

La tabla [`crm_Origen`](crm_Origen/README.md) almacena los diferentes canales de origen de los leads en el sistema CRM. Cada registro representa un canal específico por el cual un lead puede ser capturado, como formulario web, email, redes sociales, referidos, entre otros. Los orígenes se utilizan para clasificar y analizar la efectividad de los diferentes canales de captación de leads.

---

## 📊 Estadísticas

- **Total de registros**: 20
- **Estado**: Activa
- **RLS**: Habilitado

---

## 🏗️ Estructura de la Tabla

| Columna | Tipo | Nulable | Default | Descripción |
|---------|------|---------|---------|-------------|
| `id` | `integer` | No | `nextval('crm_origen_id_seq'::regclass)` | Identificador único del origen |
| `fc` | `timestamp` | No | `now()` | Fecha y hora de creación del registro |
| `status` | `boolean` | No | `true` | Estado del registro (activo/inactivo) |
| `nombre` | `text` | No | | Nombre del canal de origen |

---

## 🔗 Claves Foráneas

No tiene claves foráneas.

---

## 🔄 Relaciones con Otras Tablas

### Tablas que Referencian a `crm_Origen`

1. **[`leads`](leads/README.md)**
   - Relación: Cada lead tiene un origen específico
   - Campo: `idOrigen` → `id`

2. **[`leads_porAprobar`](leads_porAprobar/README.md)**
   - Relación: Cada lead por aprobar tiene un origen específico
   - Campo: `idOrigen` → `id`

3. **[`leads_duplicate`](leads_duplicate/README.md)**
   - Relación: Cada lead duplicado tiene un origen específico
   - Campo: `idOrigen` → `id`

---

## ⚙️ Funciones Asociadas

### Funciones que Operan sobre `crm_Origen`

1. **[`update_origen_column`](Leads/funciones y trigger/trigger_leads_poraprobar_validar_y_migrar_automaticamente.sql)**
   - **Descripción**: Actualizar campo Origen denormalizado
   - **Trigger**: Se ejecuta en UPDATE de la tabla
   - **Retorno**: void
   - **Funcionalidades**:
     - Actualiza el campo denormalizado `Origen` en las tablas de leads
     - Sincroniza el nombre del origen con las tablas relacionadas

---

## 🔒 Seguridad

### Row Level Security (RLS)

La tabla [`crm_Origen`](crm_Origen/README.md) tiene RLS habilitado. Las políticas de RLS controlan el acceso a los registros basándose en los permisos del usuario.

---

## 📝 Notas Importantes

1. **Canales de Captación**: Los orígenes representan los diferentes canales por los cuales se pueden capturar leads en el sistema.

2. **Análisis de Efectividad**: Los orígenes se utilizan para analizar la efectividad de los diferentes canales de captación de leads.

3. **Campos Denormalizados**: Las tablas de leads mantienen el campo denormalizado `Origen` para optimizar consultas. Este campo se actualiza automáticamente mediante el trigger [`update_origen_column`](Leads/funciones y trigger/trigger_leads_poraprobar_validar_y_migrar_automaticamente.sql).

4. **Orígenes Activos**: Solo los orígenes con `status = true` están disponibles para asignación a leads.

5. **Clasificación de Leads**: Los orígenes permiten clasificar los leads según el canal por el cual fueron capturados.

---

## 📞 Soporte

Para más información sobre la tabla [`crm_Origen`](crm_Origen/README.md), consulte:
- Documentación del módulo Leads: [`Leads/README.md`](Leads/README.md)
- Documentación de funciones CRM: [`docs/CRM/Documentacion_Funciones_CRM.md`](docs/CRM/Documentacion_Funciones_CRM.md)
- Diagrama de relaciones CRM: [`docs/CRM/schema_crm.dbml`](docs/CRM/schema_crm.dbml)
