# Tabla: leads_duplicate

**Última actualización**: 13/02/2026  
**Versión**: 1.0

---

## 📋 Descripción

La tabla [`leads_duplicate`](leads_duplicate/README.md) es una tabla de respaldo que contiene una copia de los leads de la tabla principal [`leads`](leads/README.md). Esta tabla se utiliza para mantener un historial de seguridad de los leads y no debe modificarse directamente. Los registros en esta tabla son duplicados de los leads activos y se mantienen para propósitos de auditoría y recuperación.

---

## 📊 Estadísticas

- **Total de registros**: 5,225
- **Estado**: Activa
- **RLS**: Habilitado

---

## 🏗️ Estructura de la Tabla

| Columna | Tipo | Nulable | Default | Descripción |
|---------|------|---------|---------|-------------|
| `uid` | `uuid` | No | `gen_random_uuid()` | Identificador único del lead duplicado |
| `fc` | `timestamp` | No | `now()` | Fecha y hora de creación del registro |
| `status` | `boolean` | No | `true` | Estado del registro (activo/inactivo) |
| `nombreLead` | `text` | No | | Nombre completo del lead |
| `apellidoPaterno` | `text` | No | | Apellido paterno del lead |
| `apellidoMaterno` | `text` | Sí | | Apellido materno del lead |
| `telefono` | `text` | Sí | | Número de teléfono del lead |
| `correo` | `text` | Sí | | Correo electrónico del lead |
| `idTipoOperacion` | `integer` | No | | Tipo de operación de interés (FK a crm_tipoOperaciones) |
| `idTipoVenta` | `integer` | No | | Tipo de venta específico (FK a crm_tipoVenta) |
| `idTipoCliente` | `integer` | Sí | | Tipo de cliente (FK a crm_tipoCliente) |
| `idCampania` | `integer` | Sí | | Campaña de origen (FK a crm_campania) |
| `idOrigen` | `integer` | Sí | | Origen del lead (FK a crm_Origen) |
| `idRecepcion` | `integer` | Sí | | Medio de recepción (FK a crm_Recepcion) |
| `idEtapa` | `integer` | No | | Etapa actual del proceso de ventas (FK a crm_Etapas) |
| `uidRC` | `uuid` | Sí | | Responsable comercial asignado (FK a catUsers) |
| `nomRC` | `text` | Sí | | Nombre del responsable comercial (denormalizado) |
| `idInmobiliaria` | `integer` | Sí | | Inmobiliaria asociada (FK a catInmobiliarias) |
| `idAsesorInm` | `integer` | Sí | | Asesor inmobiliario (FK a catAsesoresInm) |
| `presupuesto` | `numeric` | Sí | | Presupuesto estimado del lead |
| `comentarios` | `text` | Sí | | Comentarios adicionales sobre el lead |
| `aprobado` | `boolean` | No | `true` | Indica si el lead ha sido aprobado |
| `Etapa` | `text` | Sí | | Nombre de la etapa (denormalizado) |
| `Origen` | `text` | Sí | | Nombre del origen (denormalizado) |
| `idEncuesta` | `integer` | Sí | | Encuesta asignada (FK a crm_Encuestas) |
| `encuestaEnviada` | `boolean` | Sí | `false` | Indica si se ha enviado la encuesta |
| `fechaEncuesta` | `timestamp` | Sí | | Fecha de envío de la encuesta |

---

## 🔗 Claves Foráneas

| Columna | Tabla Referenciada | Columna Referenciada |
|---------|-------------------|---------------------|
| `idTipoOperacion` | `crm_tipoOperaciones` | `id` |
| `idTipoVenta` | `crm_tipoVenta` | `id` |
| `idTipoCliente` | `crm_tipoCliente` | `id` |
| `idCampania` | `crm_campania` | `id` |
| `idOrigen` | `crm_Origen` | `id` |
| `idRecepcion` | `crm_Recepcion` | `id` |
| `idEtapa` | `crm_Etapas` | `id` |
| `uidRC` | `catUsers` | `uid` |
| `idInmobiliaria` | `catInmobiliarias` | `id` |
| `idAsesorInm` | `catAsesoresInm` | `id` |
| `idEncuesta` | `crm_Encuestas` | `id` |

---

## 🔄 Relaciones con Otras Tablas

### Tablas Referenciadas por `leads_duplicate`

1. **[`crm_Etapas`](crm_Etapas/README.md)**
   - Relación: Cada lead duplicado está en una etapa del proceso de ventas
   - Campo: `idEtapa` → `id`

2. **[`crm_Origen`](crm_Origen/README.md)**
   - Relación: Cada lead duplicado tiene un origen específico
   - Campo: `idOrigen` → `id`

3. **[`crm_tipoCliente`](crm_tipoCliente/README.md)**
   - Relación: Cada lead duplicado puede tener un tipo de cliente
   - Campo: `idTipoCliente` → `id`

4. **[`crm_tipoOperaciones`](crm_tipoOperaciones/README.md)**
   - Relación: Cada lead duplicado está interesado en un tipo de operación
   - Campo: `idTipoOperacion` → `id`

5. **[`crm_tipoVenta`](crm_tipoVenta/README.md)**
   - Relación: Cada lead duplicado está interesado en un tipo de venta específico
   - Campo: `idTipoVenta` → `id`

6. **[`crm_campania`](crm_campania/README.md)**
   - Relación: Cada lead duplicado puede provenir de una campaña
   - Campo: `idCampania` → `id`

7. **[`crm_Recepcion`](crm_Recepcion/README.md)**
   - Relación: Cada lead duplicado fue recibido por un medio específico
   - Campo: `idRecepcion` → `id`

8. **[`crm_Encuestas`](crm_Encuestas/README.md)**
   - Relación: Cada lead duplicado puede tener una encuesta asignada
   - Campo: `idEncuesta` → `id`

9. **[`catInmobiliarias`](catInmobiliarias/README.md)**
   - Relación: Cada lead duplicado puede estar asociado a una inmobiliaria
   - Campo: `idInmobiliaria` → `id`

10. **[`catAsesoresInm`](catAsesoresInm/README.md)**
    - Relación: Cada lead duplicado puede estar asociado a un asesor inmobiliario
    - Campo: `idAsesorInm` → `id`

11. **[`catUsers`](catUsers/README.md)**
    - Relación: Cada lead duplicado puede tener un responsable comercial asignado
    - Campo: `uidRC` → `uid`

### Tabla Origen

1. **[`leads`](leads/README.md)**
   - Relación: Esta tabla es una copia de respaldo de la tabla principal
   - Propósito: Mantener un historial de seguridad de los leads

---

## ⚙️ Funciones Asociadas

No hay funciones específicas que operen directamente sobre la tabla [`leads_duplicate`](leads_duplicate/README.md). Esta tabla es una tabla de respaldo y no debe modificarse directamente.

---

## 🔒 Seguridad

### Row Level Security (RLS)

La tabla [`leads_duplicate`](leads_duplicate/README.md) tiene RLS habilitado. Las políticas de RLS controlan el acceso a los registros basándose en los permisos del usuario.

---

## 📝 Notas Importantes

1. **Tabla de Respaldo**: Esta tabla es una copia de respaldo de la tabla principal [`leads`](leads/README.md) y no debe modificarse directamente.

2. **Propósito de Auditoría**: Los registros en esta tabla se mantienen para propósitos de auditoría y recuperación de datos.

3. **Sincronización**: La tabla se mantiene sincronizada con la tabla principal [`leads`](leads/README.md) mediante procesos automáticos.

4. **Campos Denormalizados**: La tabla mantiene campos denormalizados como `nomRC`, `Etapa`, y `Origen` para optimizar consultas.

5. **No Modificar Directamente**: Esta tabla no debe modificarse directamente. Cualquier modificación debe hacerse a través de la tabla principal [`leads`](leads/README.md).

---

## 📞 Soporte

Para más información sobre la tabla [`leads_duplicate`](leads_duplicate/README.md), consulte:
- Documentación del módulo Leads: [`Leads/README.md`](Leads/README.md)
- Documentación de funciones CRM: [`docs/CRM/Documentacion_Funciones_CRM.md`](docs/CRM/Documentacion_Funciones_CRM.md)
- Diagrama de relaciones CRM: [`docs/CRM/schema_crm.dbml`](docs/CRM/schema_crm.dbml)
