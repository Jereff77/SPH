# Documentación Completa de Funciones del CRM - SPH Bines Raices

**Fecha de creación**: 13/02/2026  
**Última actualización**: 13/02/2026  
**Autor**: Kilo Code  
**Versión**: 1.0

---

## 📋 Índice

1. [Introducción](#introducción)
2. [Funciones de Gestión de Leads](#funciones-de-gestión-de-leads)
3. [Funciones de Leads por Aprobar](#funciones-de-leads-por-aprobar)
4. [Funciones de Reportes y Análisis](#funciones-de-reportes-y-análisis)
5. [Funciones de Catálogos](#funciones-de-catálogos)
6. [Funciones de Triggers](#funciones-de-triggers)
7. [Funciones de Validación](#funciones-de-validación)

---

## 📖 Introducción

Las funciones del CRM de SPH Bines Raices gestionan el ciclo de vida completo de los leads/prospectos. Este documento describe todas las funciones disponibles, sus parámetros, valores de retorno y casos de uso.

---

## 🔧 Funciones de Gestión de Leads

### 1. `leads_eliminar_lead(p_id_lead uuid)`

**Fecha de creación**: 18/11/2025 17:05:00  
**Tipo de seguridad**: SECURITY DEFINER  
**Descripción**: Elimina un registro de la tabla leads con validación de permisos.

**Parámetros**:
- `p_id_lead` (uuid, OBLIGATORIO): El ID del lead que se desea eliminar

**Retorna**: `jsonb` con la siguiente estructura:
```json
{
  "success": boolean,
  "error": string | null,
  "message": string,
  "error_code": integer | null,
  "data": {
    "lead_id": uuid,
    "lead_name": string,
    "deleted_at": timestamp,
    "deleted_by": uuid
  }
}
```

**Validaciones**:
- El usuario debe estar autenticado (`auth.uid() IS NOT NULL`)
- El usuario debe tener el permiso 327 activo en `segModulosUsuarios`
- El lead debe existir en la tabla `leads`

**Códigos de error**:
- `AUTHENTICATION_REQUIRED` (401): Usuario no autenticado
- `PERMISSION_DENIED` (403): Usuario sin permiso 327
- `LEAD_NOT_FOUND` (404): Lead no existe
- `DATABASE_ERROR` (500): Error en la base de datos

**Ejemplo de uso**:
```sql
SELECT leads_eliminar_lead('123e4567-e89b-12d3-a456-426614174000');
```

**Resultado exitoso**:
```json
{
  "success": true,
  "message": "Lead eliminado correctamente",
  "data": {
    "lead_id": "123e4567-e89b-12d3-a456-426614174000",
    "lead_name": "Juan Pérez",
    "deleted_at": "2026-02-13 04:45:00",
    "deleted_by": "896f01e5-283f-4bdb-b3f3-11381adedb30"
  }
}
```

---

## 📝 Funciones de Leads por Aprobar

### 2. `leads_poraprobar_insertar_registro(...)`

**Fecha de creación**: 29/09/2025 05:00:00  
**Tipo de seguridad**: SECURITY DEFINER  
**Descripción**: Inserta un nuevo registro en la tabla `leads_porAprobar` con validaciones completas y sanitización de datos.

**Parámetros**:
- `p_nombre_lead` (text, OBLIGATORIO): Nombre del lead
- `p_id_tipo_operacion` (bigint, OBLIGATORIO): ID del tipo de operación
- `p_id_tipo_venta` (bigint, OBLIGATORIO): ID del tipo de venta
- `p_telefono` (text, OPCIONAL): Teléfono de contacto
- `p_correo` (text, OPCIONAL): Correo electrónico
- `p_id_inmobiliaria` (uuid, OPCIONAL): ID de la inmobiliaria
- `p_id_asesor_inm` (uuid, OPCIONAL): ID del asesor inmobiliario
- `p_mensaje` (text, OPCIONAL): Mensaje inicial
- `p_id_origen` (bigint, OPCIONAL): ID del origen
- `p_id_tipo_cliente` (bigint, OPCIONAL): ID del tipo de cliente
- `p_valor` (double precision, OPCIONAL): Valor estimado (default: 0)
- `p_uid_rc` (uuid, OPCIONAL): ID del responsable comercial
- `p_superficie` (text, OPCIONAL): Superficie requerida
- `p_kvas` (text, OPCIONAL): KVAs requeridos
- `p_ubicacion` (text, OPCIONAL): Ubicación preferida (default: 'Indistinto')
- `p_persona_fisica` (boolean, OPCIONAL): Persona física o moral (default: true)

**Retorna**: `jsonb` con la siguiente estructura:
```json
{
  "exito": boolean,
  "codigo": string,
  "mensaje": string,
  "detalles": {
    "id_registro": uuid,
    "nombre": string,
    "telefono": string,
    "correo": string,
    "superficie": string,
    "kvAs": string,
    "ubicacion": string,
    "fecha_registro": timestamp
  }
}
```

**Validaciones**:
- `p_nombre_lead` es obligatorio y debe tener entre 2 y 200 caracteres
- `p_id_tipo_operacion` es obligatorio
- `p_id_tipo_venta` es obligatorio
- Debe proporcionarse al menos `p_telefono` o `p_correo`
- `p_telefono` debe tener al menos 7 dígitos válidos
- `p_correo` debe tener formato válido de email
- `p_mensaje` máximo 1000 caracteres
- `p_superficie` máximo 100 caracteres
- `p_kvas` máximo 50 caracteres
- `p_ubicacion` máximo 200 caracteres

**Sanitización**:
- Elimina caracteres peligrosos: `<`, `>`, `"`, `'`, `;`, `&`
- Normaliza espacios múltiples
- Convierte correos a minúsculas
- Limpia teléfonos de caracteres no numéricos

**Códigos de error**:
- `PARAMETRO_INVALIDO`: Parámetro obligatorio faltante
- `ERROR_VALIDACION`: Validación de datos fallida
- `ERROR_BASE_DATOS`: Error al insertar en la base de datos

**Ejemplo de uso**:
```sql
SELECT leads_poraprobar_insertar_registro(
  'Juan Pérez',
  1,
  2,
  '555-1234-5678',
  'juan.perez@email.com',
  NULL,
  NULL,
  'Estoy interesado en naves industriales',
  1,
  1,
  5000000,
  '896f01e5-283f-4bdb-b3f3-11381adedb30',
  '500 m2',
  '100 KVA',
  'Norte'
);
```

---

### 3. `leads_poraprobar_obtener_detalle()`

**Fecha de creación**: 20/10/2025 08:39:00  
**Tipo de seguridad**: SECURITY DEFINER  
**Descripción**: Retorna todos los leads pendientes de aprobación con información completa de tablas relacionadas usando LEFT JOIN.

**Parámetros**: Ninguno

**Retorna**: `TABLE` con las siguientes columnas:
- `id` (uuid): ID del lead
- `uidr` (uuid): Usuario que registró
- `status` (boolean): Estado activo/inactivo
- `fc` (timestamp): Fecha de creación
- `nombreLead` (text): Nombre del lead
- `telefono` (text): Teléfono
- `correo` (text): Correo electrónico
- `idInmobiliaria` (uuid): ID de inmobiliaria
- `fechaContacto` (timestamp): Fecha de contacto
- `fechaRegistro` (timestamptz): Fecha de registro
- `mensaje` (text): Mensaje inicial
- `KVAs` (text): KVAs requeridos
- `superficie` (text): Superficie requerida
- `ubicacion` (text): Ubicación preferida
- `uidRC` (uuid): Responsable comercial
- `idEtapa` (bigint): ID de etapa
- `idOrigen` (bigint): ID de origen
- `idTipoCliente` (bigint): ID de tipo de cliente
- `idTipoOperacion` (bigint): ID de tipo de operación
- `idTipoVenta` (bigint): ID de tipo de venta
- `Etapa` (text): Nombre de la etapa
- `Origen` (text): Nombre del origen
- `tipoCliente` (text): Tipo de cliente
- `tipoOperacion` (text): Tipo de operación
- `tipoVenta` (text): Tipo de venta
- `nomRC` (text): Nombre del RC
- `valor` (double precision): Valor estimado
- `aprobado` (boolean): Estado de aprobación
- `nombreRegistro` (text): Nombre del usuario que registró
- `nombreInmobiliaria` (text): Nombre de la inmobiliaria
- `nombreAsesorInm` (text): Nombre del asesor inmobiliario
- `tituloEtapa` (text): Título de la etapa
- `tituloOrigen` (text): Título del origen
- `tituloTipoCliente` (text): Título del tipo de cliente
- `tituloTipoOperacion` (text): Título del tipo de operación
- `tituloTipoVenta` (text): Título del tipo de venta

**Filtros aplicados**:
- Solo leads con `aprobado IS NULL`
- Ordenados por `fechaRegistro` DESC

**Ejemplo de uso**:
```sql
SELECT * FROM leads_poraprobar_obtener_detalle();
```

---

### 4. `leads_poraprobar_validar_y_migrar_similitud(p_id_lead_poraprobar uuid)`

**Fecha de creación**: 04/12/2025 04:24:00  
**Tipo de seguridad**: SECURITY DEFINER  
**Descripción**: Valida un lead por similitudes o duplicados y, si pasa la validación, lo migra automáticamente a la tabla `leads`.

**Parámetros**:
- `p_id_lead_poraprobar` (uuid, OBLIGATORIO): ID del lead en `leads_porAprobar`

**Retorna**: `jsonb` con la siguiente estructura:
```json
{
  "success": boolean,
  "message": string,
  "migrated": boolean,
  "error": string | null,
  "error_code": integer | null,
  "validation_results": {
    "similarity_name": boolean,
    "duplicate_phone": boolean,
    "duplicate_email": boolean,
    "threshold_used": numeric,
    "validated_name": string,
    "validated_phone": string,
    "validated_email": string
  },
  "data": {
    "lead_id": string,
    "lead_name": string,
    "reason_for_no_migration": string | null,
    "migration_reason": string | null,
    "validation_timestamp": timestamp
  }
}
```

**Validaciones**:
- El usuario debe estar autenticado
- El lead debe existir en `leads_porAprobar`
- **Similitud de nombre**: Busca nombres con similitud > 0.35
- **Duplicado de teléfono**: Coincidencia exacta de teléfono
- **Duplicado de correo**: Coincidencia exacta de correo

**Umbral de similitud**: 0.35 (35%)

**Lógica de migración**:
- Si NO hay duplicados/similitudes → Migrar automáticamente a `leads`
- Si HAY duplicados/similitudes → NO migrar, retornar razón

**Códigos de error**:
- `AUTHENTICATION_REQUIRED` (401): Usuario no autenticado
- `LEAD_NOT_FOUND` (404): Lead no existe en `leads_porAprobar`
- `MIGRATION_FAILED` (500): Error al migrar
- `FUNCTION_ERROR` (500): Error en la función

**Ejemplo de uso**:
```sql
SELECT leads_poraprobar_validar_y_migrar_similitud('123e4567-e89b-12d3-a456-426614174000');
```

**Resultado con duplicado**:
```json
{
  "success": true,
  "message": "Lead no migrado por detectarse similitudes o duplicados",
  "migrated": false,
  "validation_results": {
    "similarity_name": true,
    "duplicate_phone": false,
    "duplicate_email": false,
    "threshold_used": 0.35,
    "validated_name": "Juan Pérez",
    "validated_phone": "555-1234-5678",
    "validated_email": "juan.perez@email.com"
  },
  "data": {
    "lead_id": "123e4567-e89b-12d3-a456-426614174000",
    "lead_name": "Juan Pérez",
    "reason_for_no_migration": "Similitud de nombre detectada",
    "validation_timestamp": "2026-02-13 04:50:00"
  }
}
```

---

## 📊 Funciones de Reportes y Análisis

### 5. `leads_sin_interaccion_reciente(dias_sin_interaccion integer DEFAULT 8)`

**Fecha de creación**: 03/11/2025 17:45:00  
**Tipo de seguridad**: SECURITY DEFINER  
**Descripción**: Obtiene una lista de leads que no han tenido ninguna interacción en los últimos N días especificados (por defecto 8 días).

**Parámetros**:
- `dias_sin_interaccion` (integer, OPCIONAL): Número de días sin interacción a filtrar (default: 8)

**Retorna**: `TABLE` con las siguientes columnas:
- `idLead` (uuid): ID del lead
- `Nombre del Lead` (text): Nombre completo del lead
- `UID Responsable Comercial` (uuid): UID del RC asignado
- `Nombre RC` (text): Nombre completo del RC
- `Última Interacción` (timestamp): Fecha de la última actividad (NULL si nunca hubo)
- `Días sin Interacción` (integer): Cantidad de días desde la última interacción

**Filtros aplicados**:
- Solo leads activos (`status = true`)
- Solo leads aprobados (`Aprobado = true`)
- Excluye leads con interacciones recientes (últimos N días)
- Ordenados por fecha de última interacción (más antiguos primero)

**Ejemplo de uso**:
```sql
-- Con parámetro por defecto (8 días)
SELECT * FROM leads_sin_interaccion_reciente();

-- Con parámetro personalizado (15 días)
SELECT * FROM leads_sin_interaccion_reciente(15);

-- Filtrar solo leads sin RC asignado
SELECT * FROM leads_sin_interaccion_reciente()
WHERE "UID Responsable Comercial" IS NULL;
```

---

### 6. `leads_mas_7_dias_sin_interaccion()`

**Fecha de creación**: 13/10/2025 15:05:00  
**Tipo de seguridad**: SECURITY INVOKER  
**Descripción**: Devuelve los leads activos que no han tenido interacción en los últimos 7 días.

**Parámetros**: Ninguno

**Retorna**: `TABLE` con las siguientes columnas:
- `id_lead` (uuid): ID del lead
- `nombre_lead` (text): Nombre del lead
- `correo` (text): Correo electrónico
- `telefono` (text): Teléfono
- `id_responsable_comercial` (uuid): UID del RC
- `responsable_comercial` (text): Nombre del RC
- `etapa_actual` (text): Etapa actual del lead
- `ultima_interaccion` (timestamptz): Fecha de la última interacción
- `dias_sin_interaccion` (integer): Días sin interacción

**Ejemplo de uso**:
```sql
SELECT * FROM leads_mas_7_dias_sin_interaccion();
```

---

### 7. `leads_ultima_interaccion()`

**Fecha de creación**: 13/10/2025 14:58:00  
**Tipo de seguridad**: SECURITY INVOKER  
**Descripción**: Devuelve la última interacción de cada lead activo, indicando si hace más de 7 días o no desde la última actualización.

**Parámetros**: Ninguno

**Retorna**: `TABLE` con las siguientes columnas:
- `id_lead` (uuid): ID del lead
- `nombre_lead` (text): Nombre del lead
- `correo` (text): Correo electrónico
- `telefono` (text): Teléfono
- `id_responsable_comercial` (uuid): UID del RC
- `responsable_comercial` (text): Nombre del RC
- `etapa_actual` (text): Etapa actual
- `ultima_interaccion` (timestamptz): Fecha de la última interacción
- `mas_de_7_dias_sin_interaccion` (text): 'Sí' o 'No' con días
- `dias_sin_interaccion` (integer): Días sin interacción

**Ejemplo de uso**:
```sql
SELECT * FROM leads_ultima_interaccion();
```

---

### 8. `leads_generar_email_html()`

**Fecha de creación**: 03/11/2025 20:10:00  
**Tipo de seguridad**: SECURITY DEFINER  
**Descripción**: Genera un correo HTML profesional con el reporte de leads sin interacción en los últimos 8 días.

**Parámetros**: Ninguno

**Retorna**: `text` - Código HTML del correo electrónico formateado

**Características del HTML**:
- Diseño responsive y profesional
- Compatible con la mayoría de clientes de correo
- Si no hay leads, retorna un mensaje positivo
- Tabla con información detallada de cada lead
- Indicadores visuales de urgencia (colores según días sin contacto)

**Ejemplo de uso**:
```sql
SELECT leads_generar_email_html();
```

---

### 9. `leads_obtener_destinatarios_reporte()`

**Fecha de creación**: 03/11/2025 20:05:00  
**Tipo de seguridad**: SECURITY DEFINER  
**Descripción**: Obtiene la lista de correos electrónicos de usuarios que tienen acceso al módulo de reportes de leads (clave 328 en `segModulosUsuarios`).

**Parámetros**: Ninguno

**Retorna**: `text[]` - Array de correos electrónicos

**Filtros aplicados**:
- Solo usuarios activos (`status = true`)
- Solo usuarios con acceso habilitado (`acceso = true`)
- Solo usuarios con clave 328 en `segModulosUsuarios`
- Solo usuarios con email válido (no NULL y no vacío)

**Ejemplo de resultado**:
```sql
ARRAY['usuario1@gruposph.mx', 'usuario2@gruposph.mx']
```

**Ejemplo de uso**:
```sql
SELECT leads_obtener_destinatarios_reporte();
```

**Notas**: Si no encuentra usuarios, retorna un array vacío.

---

## 📚 Funciones de Catálogos

### 10. `crm_tipooperaciones_obtener_activos()`

**Fecha de creación**: 28/09/2025 18:15:45  
**Tipo de seguridad**: SECURITY DEFINER  
**Descripción**: Obtiene todos los tipos de operación activos de la tabla `crm_tipoOperaciones` para llenar dropdowns en formularios públicos.

**Parámetros**: Ninguno

**Retorna**: `TABLE` con las siguientes columnas:
- `id` (bigint): ID del tipo de operación
- `titulo` (text): Nombre del tipo de operación

**Filtros aplicados**:
- Solo registros con `status = true`
- Ordenados por `titulo` ASC

**Ejemplo de uso**:
```sql
SELECT * FROM crm_tipooperaciones_obtener_activos() ORDER BY titulo;
```

---

### 11. `crm_tipoventa_obtener_activos()`

**Fecha de creación**: 28/09/2025 18:16:30  
**Tipo de seguridad**: SECURITY DEFINER  
**Descripción**: Obtiene todos los tipos de venta activos de la tabla `crm_tipoVenta` para llenar dropdowns en formularios públicos.

**Parámetros**: Ninguno

**Retorna**: `TABLE` con las siguientes columnas:
- `id` (bigint): ID del tipo de venta
- `titulo` (text): Nombre del tipo de venta

**Filtros aplicados**:
- Solo registros con `status = true`
- Ordenados por `titulo` ASC

**Ejemplo de uso**:
```sql
SELECT * FROM crm_tipoventa_obtener_activos() ORDER BY titulo;
```

---

### 12. `catasesoresinm_obtener_por_codigo(p_codigo text)`

**Fecha de creación**: 28/09/2025 20:15:00  
**Tipo de seguridad**: SECURITY DEFINER  
**Descripción**: Obtiene la información de un asesor inmobiliario buscando por su código 'a'.

**Parámetros**:
- `p_codigo` (text, OBLIGATORIO): Código del asesor (columna 'a')

**Retorna**: `TABLE` con las siguientes columnas:
- `uuid` (uuid): ID del asesor (id de `catAsesoresInm`)
- `status` (boolean): Estado activo/inactivo del asesor
- `idInmobiliaria` (uuid): ID de la inmobiliaria a la que pertenece
- `nombre` (text): Nombre del asesor
- `uidr` (uuid): UUID del asesor interno/responsable comercial

**Validaciones**:
- El código es case-insensitive (se convierte a minúsculas para búsqueda)
- Solo retorna asesores activos (`status = true`)

**Ejemplo de uso**:
```sql
SELECT * FROM catasesoresinm_obtener_por_codigo('jd');
```

---

## ⚙️ Funciones de Triggers

### 13. `leads_poraprobar_actualizar_nomrc()`

**Fecha de creación**: 29/09/2025 05:00:00  
**Tipo**: TRIGGER FUNCTION  
**Descripción**: Trigger que actualiza automáticamente la columna `nomRC` en `leads_porAprobar` cuando se inserta un nuevo registro. Obtiene el nombre completo desde `catUsers` usando `uidRC`.

**Trigger asociado**: `trg_leads_poraprobar_actualizar_nomrc`  
**Evento**: BEFORE INSERT  
**Tabla**: `leads_porAprobar`

**Lógica**:
- Si `NEW.uidRC` no es NULL, busca en `catUsers` el `nomCompleto`
- Si encuentra el usuario, actualiza `NEW.nomRC` con ese nombre
- Si no encuentra o `uidRC` es NULL, deja `nomRC` con su valor por defecto ('Sin asignar')

**Ejemplo de uso**:
```sql
-- El trigger se ejecuta automáticamente al insertar
INSERT INTO leads_porAprobar (nombreLead, uidRC, ...)
VALUES ('Juan Pérez', '896f01e5-283f-4bdb-b3f3-11381adedb30', ...);
-- nomRC se actualizará automáticamente con el nombre del usuario
```

---

### 14. `leads_poraprobar_migrar_a_leads()`

**Fecha de creación**: 29/09/2025 05:35:00  
**Tipo**: TRIGGER FUNCTION  
**Descripción**: Trigger que migra automáticamente un lead de `leads_porAprobar` a la tabla `leads` cuando el campo `aprobado` cambia a TRUE. También registra la actividad en `activity_history`.

**Trigger asociado**: `trg_leads_poraprobar_migrar_aprobados`  
**Evento**: AFTER UPDATE  
**Tabla**: `leads_porAprobar`  
**Condición**: Cuando `aprobado` cambia de FALSE/NULL a TRUE

**Lógica**:
1. Verifica que `aprobado` cambió a TRUE
2. Maneja `uidr` NULL: usa `uidRC` o usuario por defecto
3. Verifica que el lead no exista ya en tabla `leads`
4. Inserta el lead en la tabla `leads`
5. Registra la actividad en `activity_history`
6. El registro original permanece en `leads_porAprobar` con `aprobado=TRUE`

**Manejo de uidr**:
- Si `uidr` tiene valor: lo usa
- Si `uidr` es NULL pero `uidRC` tiene valor: usa `uidRC`
- Si ambos son NULL: usa usuario por defecto `00000000-0000-0000-0000-000000000000`

**Ejemplo de uso**:
```sql
-- El trigger se ejecuta automáticamente al actualizar
UPDATE leads_porAprobar 
SET aprobado = TRUE 
WHERE id = '123e4567-e89b-12d3-a456-426614174000';
-- El lead se migrará automáticamente a la tabla leads
```

---

### 15. `leads_poraprobar_validar_y_migrar_similitud_trigger_func()`

**Fecha de creación**: 04/12/2025 05:19:00  
**Tipo**: TRIGGER FUNCTION  
**Descripción**: Trigger que ejecuta la validación y migración automática de leads por similitudes al insertar un nuevo registro en `leads_porAprobar`.

**Trigger asociado**: `trg_leads_poraprobar_validar_y_migrar_automaticamente`  
**Evento**: AFTER INSERT  
**Tabla**: `leads_porAprobar`

**Lógica**:
1. Ejecuta `leads_poraprobar_validar_y_migrar_similitud(NEW.id)`
2. Usa un bloque BEGIN/EXCEPTION para evitar que errores en la validación afecten la inserción
3. Si hay error en la validación, lo registra pero no afecta la inserción
4. El lead siempre se guarda, aunque la validación falle

**Manejo de errores**:
- Los errores en la validación no interrumpen la inserción
- En producción, los errores podrían registrarse en una tabla de logs

**Ejemplo de uso**:
```sql
-- El trigger se ejecuta automáticamente al insertar
INSERT INTO leads_porAprobar (nombreLead, telefono, correo, ...)
VALUES ('Juan Pérez', '555-1234-5678', 'juan@email.com', ...);
-- Se validará automáticamente y, si no hay duplicados, se migrará a leads
```

---

### 16. `leads_puente_sync_to_leads_before()`

**Fecha de creación**: 04/12/2025 05:00:00  
**Tipo**: TRIGGER FUNCTION  
**Descripción**: Trigger que se ejecuta antes de cada inserción en la tabla `leads_puente`. Valida campos mínimos, inserta en `leads_porAprobar` y evita que el registro quede en `leads_puente`.

**Trigger asociado**: `trg_leads_puente_sync_to_leads_before`  
**Evento**: BEFORE INSERT  
**Tabla**: `leads_puente`

**Lógica**:
1. Valida que `nombreLead` es obligatorio
2. Valida que debe haber al menos un medio de contacto: teléfono o correo
3. Inserta el registro validado en la tabla `leads_porAprobar`
4. Evita que el registro se inserte en `leads_puente` (RETURN NULL)

**Validaciones**:
- `nombreLead` es obligatorio
- Debe proporcionarse al menos un medio de contacto: teléfono o correo

**Notas**:
- No se copia el campo `id`, se genera uno nuevo en `leads_porAprobar`
- Si falla la validación, se lanza un error y no se permite la inserción
- El registro nunca llega a quedarse en `leads_puente`

---

### 17. `update_etapa_column()`

**Fecha de creación**: 29/09/2025 05:00:00  
**Tipo**: TRIGGER FUNCTION  
**Descripción**: Trigger que actualiza automáticamente la columna `Etapa` en las tablas de leads cuando se actualiza `idEtapa`.

**Trigger asociado**: `trg_update_etapa_column`  
**Evento**: BEFORE INSERT OR UPDATE  
**Tabla**: `leads`, `leads_porAprobar`, `leads_duplicate`

**Lógica**:
- Busca el `titulo` en `crm_Etapas` donde `id = NEW.idEtapa`
- Actualiza `NEW.Etapa` con ese título

**Ejemplo de uso**:
```sql
-- El trigger se ejecuta automáticamente al actualizar
UPDATE leads 
SET idEtapa = 2 
WHERE id = '123e4567-e89b-12d3-a456-426614174000';
-- Etapa se actualizará automáticamente con el título de la etapa 2
```

---

### 18. `update_origen_column()`

**Fecha de creación**: 29/09/2025 05:00:00  
**Tipo**: TRIGGER FUNCTION  
**Descripción**: Trigger que actualiza automáticamente la columna `Origen` en las tablas de leads cuando se actualiza `idOrigen`.

**Trigger asociado**: `trg_update_origen_column`  
**Evento**: BEFORE INSERT OR UPDATE  
**Tabla**: `leads`, `leads_porAprobar`, `leads_duplicate`

**Lógica**:
- Busca el `titulo` en `crm_Origen` donde `id = NEW.idOrigen`
- Actualiza `NEW.Origen` con ese título

**Ejemplo de uso**:
```sql
-- El trigger se ejecuta automáticamente al actualizar
UPDATE leads 
SET idOrigen = 1 
WHERE id = '123e4567-e89b-12d3-a456-426614174000';
-- Origen se actualizará automáticamente con el título del origen 1
```

---

### 19. `reordenar_etapas()`

**Fecha de creación**: 29/09/2025 05:00:00  
**Tipo**: TRIGGER FUNCTION  
**Descripción**: Trigger que mantiene el orden consecutivo de las etapas en la tabla `crm_Etapas`.

**Trigger asociado**: `trg_reordenar_etapas`  
**Evento**: BEFORE INSERT OR UPDATE  
**Tabla**: `crm_Etapas`

**Lógica**:
- Caso INSERT sin valor explícito de `orden`: Asigna el siguiente número consecutivo
- Caso UPDATE del campo `orden` o INSERT con valor explícito: Reordena todos los registros asignando números consecutivos

**Ejemplo de uso**:
```sql
-- Insert sin orden (se asigna automáticamente)
INSERT INTO crm_Etapas (titulo) VALUES ('Nueva Etapa');

-- Update de orden (se reordenan todos)
UPDATE crm_Etapas SET orden = 5 WHERE id = 3;
```

---

## ✅ Funciones de Validación

Las funciones de validación están integradas en las funciones principales:

### Validaciones en `leads_poraprobar_insertar_registro`:
1. **Nombre obligatorio**: Debe tener entre 2 y 200 caracteres
2. **Tipo de operación obligatorio**
3. **Tipo de venta obligatorio**
4. **Contacto obligatorio**: Al menos teléfono o correo
5. **Teléfono válido**: Mínimo 7 dígitos
6. **Correo válido**: Formato de email correcto
7. **Longitud de campos**: Límites de caracteres por campo
8. **Sanitización**: Eliminación de caracteres peligrosos

### Validaciones en `leads_poraprobar_validar_y_migrar_similitud`:
1. **Similitud de nombre**: > 0.35 (35%)
2. **Duplicado de teléfono**: Coincidencia exacta
3. **Duplicado de correo**: Coincidencia exacta

### Validaciones en `leads_eliminar_lead`:
1. **Autenticación**: Usuario debe estar autenticado
2. **Permiso 327**: Usuario debe tener permiso para eliminar leads
3. **Existencia**: El lead debe existir

---

## 🔒 Seguridad

Todas las funciones del CRM utilizan el modelo de seguridad apropiado:

- **SECURITY DEFINER**: Funciones que requieren permisos elevados o acceso a datos sensibles
- **SECURITY INVOKER**: Funciones que respetan los permisos del usuario que las ejecuta

### Permisos Requeridos

- **Permiso 327**: CRM > Leads > Eliminar Leads
- **Permiso 328**: CRM > Reportes de Leads

---

## 📞 Soporte

Para más información sobre las funciones del CRM, contacte al equipo de desarrollo de SPH Bines Raices.
