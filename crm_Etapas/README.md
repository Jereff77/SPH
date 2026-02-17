# Tabla: crm_Etapas

**Última actualización**: 13/02/2026  
**Versión**: 1.0

---

## 📋 Descripción

La tabla [`crm_Etapas`](crm_Etapas/README.md) almacena las etapas del proceso de ventas del sistema CRM. Cada etapa representa un paso en el ciclo de vida de un lead, desde su captura inicial hasta su conversión en cliente. Las etapas se utilizan para clasificar y organizar los leads según su estado actual en el proceso de ventas.

---

## 📊 Estadísticas

- **Total de registros**: 12
- **Estado**: Activa
- **RLS**: Habilitado

---

## 🏗️ Estructura de la Tabla

| Columna | Tipo | Nulable | Default | Descripción |
|---------|------|---------|---------|-------------|
| `id` | `integer` | No | `nextval('crm_etapas_id_seq'::regclass)` | Identificador único de la etapa |
| `fc` | `timestamp` | No | `now()` | Fecha y hora de creación del registro |
| `status` | `boolean` | No | `true` | Estado del registro (activo/inactivo) |
| `nombre` | `text` | No | | Nombre de la etapa |
| `orden` | `integer` | No | | Orden de la etapa en el proceso de ventas |
| `color` | `text` | Sí | | Color asociado a la etapa para visualización |

---

## 🔗 Claves Foráneas

No tiene claves foráneas.

---

## 🔄 Relaciones con Otras Tablas

### Tablas que Referencian a `crm_Etapas`

1. **[`leads`](leads/README.md)**
   - Relación: Cada lead está en una etapa del proceso de ventas
   - Campo: `idEtapa` → `id`

2. **[`leads_porAprobar`](leads_porAprobar/README.md)**
   - Relación: Cada lead por aprobar está en una etapa del proceso de ventas
   - Campo: `idEtapa` → `id`

3. **[`leads_duplicate`](leads_duplicate/README.md)**
   - Relación: Cada lead duplicado está en una etapa del proceso de ventas
   - Campo: `idEtapa` → `id`

---

## ⚙️ Funciones Asociadas

### Funciones que Operan sobre `crm_Etapas`

1. **[`reordenar_etapas`](Leads/funciones y trigger/trigger_leads_poraprobar_validar_y_migrar_automaticamente.sql)**
   - **Descripción**: Mantener orden consecutivo de etapas
   - **Trigger**: Se ejecuta en INSERT, UPDATE, DELETE de la tabla
   - **Retorno**: void
   - **Funcionalidades**:
     - Actualiza automáticamente el orden de las etapas
     - Mantiene el orden consecutivo
     - Soporta colores personalizados

2. **[`update_etapa_column`](Leads/funciones y trigger/trigger_leads_poraprobar_validar_y_migrar_automaticamente.sql)**
   - **Descripción**: Actualizar campo Etapa denormalizado
   - **Trigger**: Se ejecuta en UPDATE de la tabla
   - **Retorno**: void
   - **Funcionalidades**:
     - Actualiza el campo denormalizado `Etapa` en las tablas de leads
     - Sincroniza el nombre de la etapa con las tablas relacionadas

---

## 🔒 Seguridad

### Row Level Security (RLS)

La tabla [`crm_Etapas`](crm_Etapas/README.md) tiene RLS habilitado. Las políticas de RLS controlan el acceso a los registros basándose en los permisos del usuario.

---

## 📝 Notas Importantes

1. **Orden Consecutivo**: El campo `orden` define la secuencia de las etapas en el proceso de ventas. Este campo se mantiene automáticamente mediante el trigger [`reordenar_etapas`](Leads/funciones y trigger/trigger_leads_poraprobar_validar_y_migrar_automaticamente.sql).

2. **Colores Personalizados**: El campo `color` permite asignar un color específico a cada etapa para su visualización en la interfaz del CRM.

3. **Campos Denormalizados**: Las tablas de leads mantienen el campo denormalizado `Etapa` para optimizar consultas. Este campo se actualiza automáticamente mediante el trigger [`update_etapa_column`](Leads/funciones y trigger/trigger_leads_poraprobar_validar_y_migrar_automaticamente.sql).

4. **Etapas Activas**: Solo las etapas con `status = true` están disponibles para asignación a leads.

5. **Proceso de Ventas**: Las etapas representan el flujo completo del proceso de ventas, desde la captura inicial hasta la conversión en cliente.

---

## 📞 Soporte

Para más información sobre la tabla [`crm_Etapas`](crm_Etapas/README.md), consulte:
- Documentación del módulo Leads: [`Leads/README.md`](Leads/README.md)
- Documentación de funciones CRM: [`docs/CRM/Documentacion_Funciones_CRM.md`](docs/CRM/Documentacion_Funciones_CRM.md)
- Diagrama de relaciones CRM: [`docs/CRM/schema_crm.dbml`](docs/CRM/schema_crm.dbml)
