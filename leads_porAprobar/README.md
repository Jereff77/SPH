# Tabla: leads_porAprobar

**Última actualización**: 13/02/2026  
**Versión**: 1.0

---

## 📋 Descripción

La tabla [`leads_porAprobar`](leads_porAprobar/README.md) almacena los leads/prospectos que han sido capturados pero aún no han sido aprobados. Esta tabla funciona como un área de espera donde los nuevos leads se validan antes de ser migrados a la tabla principal [`leads`](leads/README.md). Los leads en esta tabla son capturados desde el formulario público, email, u otros canales, y pasan por un proceso de validación de duplicados y similitudes antes de ser aprobados.

---

## 📊 Estadísticas

- **Total de registros**: 61
- **Estado**: Activa
- **RLS**: Habilitado

---

## 🏗️ Estructura de la Tabla

| Columna | Tipo | Nulable | Default | Descripción |
|---------|------|---------|---------|-------------|
| `uid` | `uuid` | No | `gen_random_uuid()` | Identificador único del lead por aprobar |
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
| `aprobado` | `boolean` | No | `false` | Indica si el lead ha sido aprobado |
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

### Tablas Referenciadas por `leads_porAprobar`

1. **[`crm_Etapas`](crm_Etapas/README.md)**
   - Relación: Cada lead por aprobar está en una etapa del proceso de ventas
   - Campo: `idEtapa` → `id`

2. **[`crm_Origen`](crm_Origen/README.md)**
   - Relación: Cada lead por aprobar tiene un origen específico
   - Campo: `idOrigen` → `id`

3. **[`crm_tipoCliente`](crm_tipoCliente/README.md)**
   - Relación: Cada lead por aprobar puede tener un tipo de cliente
   - Campo: `idTipoCliente` → `id`

4. **[`crm_tipoOperaciones`](crm_tipoOperaciones/README.md)**
   - Relación: Cada lead por aprobar está interesado en un tipo de operación
   - Campo: `idTipoOperacion` → `id`

5. **[`crm_tipoVenta`](crm_tipoVenta/README.md)**
   - Relación: Cada lead por aprobar está interesado en un tipo de venta específico
   - Campo: `idTipoVenta` → `id`

6. **[`crm_campania`](crm_campania/README.md)**
   - Relación: Cada lead por aprobar puede provenir de una campaña
   - Campo: `idCampania` → `id`

7. **[`crm_Recepcion`](crm_Recepcion/README.md)**
   - Relación: Cada lead por aprobar fue recibido por un medio específico
   - Campo: `idRecepcion` → `id`

8. **[`crm_Encuestas`](crm_Encuestas/README.md)**
   - Relación: Cada lead por aprobar puede tener una encuesta asignada
   - Campo: `idEncuesta` → `id`

9. **[`catInmobiliarias`](catInmobiliarias/README.md)**
   - Relación: Cada lead por aprobar puede estar asociado a una inmobiliaria
   - Campo: `idInmobiliaria` → `id`

10. **[`catAsesoresInm`](catAsesoresInm/README.md)**
    - Relación: Cada lead por aprobar puede estar asociado a un asesor inmobiliario
    - Campo: `idAsesorInm` → `id`

11. **[`catUsers`](catUsers/README.md)**
    - Relación: Cada lead por aprobar puede tener un responsable comercial asignado
    - Campo: `uidRC` → `uid`

### Tabla Destino

1. **[`leads`](leads/README.md)**
   - Relación: Los leads aprobados se migran a esta tabla
   - Proceso: Se ejecuta cuando `aprobado = true`

---

## ⚙️ Funciones Asociadas

### Funciones que Operan sobre `leads_porAprobar`

1. **[`leads_poraprobar_insertar_registro`](Leads/funciones y trigger/leads_poraprobar_insertar_registro.sql)**
   - **Descripción**: Inserta nuevos leads con validaciones completas
   - **Parámetros**: Todos los campos de la tabla
   - **Retorno**: JSON con resultado de la operación
   - **Validaciones**:
     - Nombre completo obligatorio
     - Tipo de operación y tipo de venta obligatorios
     - Al menos uno de teléfono o correo obligatorio
     - Sanitización de entradas
     - Detección de duplicados

2. **[`leads_poraprobar_obtener_detalle`](Leads/funciones y trigger/leads_poraprobar_obtener_detalle.sql)**
   - **Descripción**: Obtiene todos los leads pendientes con información completa
   - **Retorno**: TABLE con todos los campos de la tabla
   - **Uso**: Para mostrar la lista de leads pendientes de aprobación

3. **[`leads_poraprobar_validar_y_migrar_similitud`](Leads/funciones y trigger/leads_poraprobar_validar_y_migrar_similitud.sql)**
   - **Descripción**: Valida duplicados y migra automáticamente a [`leads`](leads/README.md)
   - **Parámetros**: `p_id_lead_poraprobar` (uuid)
   - **Retorno**: JSON con resultado de la operación
   - **Validaciones**:
     - Similitud de nombre (> 35%)
     - Duplicado de teléfono (exacto)
     - Duplicado de correo (exacto)
   - **Resultado**:
     - Sin duplicados → Migrar automáticamente a [`leads`](leads/README.md)
     - Con duplicados → No migrar, retornar razón

4. **[`leads_poraprobar_actualizar_nomrc`](Leads/funciones y trigger/leads_poraprobar_actualizar_nomrc.sql)**
   - **Descripción**: Actualiza automáticamente el campo `nomRC` cuando cambia `uidRC`
   - **Trigger**: Se ejecuta en UPDATE de `uidRC`
   - **Retorno**: void

5. **[`leads_poraprobar_migrar_a_leads`](Leads/funciones y trigger/leads_poraprobar_migrar_a_leads.sql)**
   - **Descripción**: Migra automáticamente leads aprobados a [`leads`](leads/README.md)
   - **Trigger**: Se ejecuta cuando `aprobado = true`
   - **Retorno**: JSON con resultado de la operación

6. **[`leads_poraprobar_validar_y_migrar_similitud_trigger_func`](Leads/funciones y trigger/leads_poraprobar_validar_y_migrar_similitud_trigger_func.sql)**
   - **Descripción**: Valida y migra automáticamente al insertar un nuevo lead
   - **Trigger**: Se ejecuta en INSERT de la tabla
   - **Retorno**: JSON con resultado de la operación

---

## 🔒 Seguridad

### Row Level Security (RLS)

La tabla [`leads_porAprobar`](leads_porAprobar/README.md) tiene RLS habilitado. Las políticas de RLS controlan el acceso a los registros basándose en los permisos del usuario.

---

## 📝 Notas Importantes

1. **Proceso de Aprobación**: Los leads se insertan en esta tabla con `aprobado = false`. Cuando se aprueban (`aprobado = true`), se migran automáticamente a [`leads`](leads/README.md).

2. **Validación de Duplicados**: La función [`leads_poraprobar_validar_y_migrar_similitud`](Leads/funciones y trigger/leads_poraprobar_validar_y_migrar_similitud.sql) valida:
   - Similitud de nombre > 35% con leads existentes
   - Duplicado exacto de teléfono
   - Duplicado exacto de correo

3. **Campos Denormalizados**: La tabla mantiene campos denormalizados como `nomRC`, `Etapa`, y `Origen` para optimizar consultas. Estos campos se actualizan automáticamente mediante triggers.

4. **Captura de Leads**: Los leads se capturan desde el formulario público, email, u otros canales y se insertan en esta tabla para su aprobación.

5. **Migración Automática**: Cuando un lead se aprueba, se migra automáticamente a [`leads`](leads/README.md) mediante el trigger [`leads_poraprobar_migrar_a_leads`](Leads/funciones y trigger/leads_poraprobar_migrar_a_leads.sql).

---

## 📞 Soporte

Para más información sobre la tabla [`leads_porAprobar`](leads_porAprobar/README.md), consulte:
- Documentación del módulo Leads: [`Leads/README.md`](Leads/README.md)
- Documentación de funciones CRM: [`docs/CRM/Documentacion_Funciones_CRM.md`](docs/CRM/Documentacion_Funciones_CRM.md)
- Diagrama de relaciones CRM: [`docs/CRM/schema_crm.dbml`](docs/CRM/schema_crm.dbml)
