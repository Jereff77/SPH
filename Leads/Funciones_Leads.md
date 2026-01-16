# Documentación de Funciones que Afectan la Tabla Leads

## Información General
- **Tabla principal**: `leads`
- **Tablas relacionadas**: `leads_porAprobar`, `activity_history`
- **Total de funciones documentadas**: 11

---

## Funciones Directamente Relacionadas con Leads

### 1. Función: `update_etapa_column`
- **Tipo**: Función de trigger
- **Retorno**: TRIGGER
- **Seguridad**: SECURITY INVOKER (por defecto)
- **Propósito**: Actualiza automáticamente el campo descriptivo `Etapa` cuando cambia `idEtapa`

#### Implementación completa:
```sql
CREATE OR REPLACE FUNCTION public.update_etapa_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    SELECT "titulo" INTO NEW."Etapa"
    FROM "crm_Etapas"
    WHERE id = NEW."idEtapa";
    RETURN NEW;
END;
$function$
```

#### Trigger asociado:
- **Nombre**: `trg_update_etapa`
- **Tabla**: `leads`
- **Evento**: BEFORE UPDATE
- **Función**: `update_etapa_column`

**Descripción**:
- Se ejecuta antes de actualizar un registro en la tabla leads
- Busca el título correspondiente en `crm_Etapas` basado en `idEtapa`
- Actualiza el campo `Etapa` con el valor descriptivo

---

### 2. Función: `update_nom_rc_column`
- **Tipo**: Función de trigger
- **Retorno**: TRIGGER
- **Seguridad**: SECURITY INVOKER (por defecto)
- **Propósito**: Actualiza automáticamente el campo `nomRC` cuando cambia `uidRC`

#### Implementación completa:
```sql
CREATE OR REPLACE FUNCTION public.update_nom_rc_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Si uidRC tiene valor, busca el nomCompleto en catUsers
    IF NEW."uidRC" IS NOT NULL THEN
        SELECT "nomCompleto" INTO NEW."nomRC"
        FROM public."catUsers"
        WHERE uid = NEW."uidRC";
    ELSE
        -- Opcional: limpiar el campo si uidRC es eliminado o puesto a NULL
        NEW."nomRC" := NULL;
    END IF;

    RETURN NEW;
END;
$function$
```

#### Trigger asociado:
- **Nombre**: `trg_update_nom_rc`
- **Tabla**: `leads`
- **Evento**: BEFORE UPDATE
- **Función**: `update_nom_rc_column`

**Descripción**:
- Mantiene sincronizado el nombre del responsable comercial
- Busca el nombre completo en `catUsers` usando el UID
- Limpia el campo si `uidRC` es NULL

---

### 3. Función: `update_origen_column`
- **Tipo**: Función de trigger
- **Retorno**: TRIGGER
- **Seguridad**: SECURITY INVOKER (por defecto)
- **Propósito**: Actualiza automáticamente el campo `Origen` cuando cambia `idOrigen`

#### Implementación completa:
```sql
CREATE OR REPLACE FUNCTION public.update_origen_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    SELECT "titulo" INTO NEW."Origen"
    FROM "crm_Origen"
    WHERE id = NEW."idOrigen";
    RETURN NEW;
END;
$function$
```

#### Trigger asociado:
- **Nombre**: `trg_update_origen`
- **Tabla**: `leads`
- **Evento**: BEFORE UPDATE
- **Función**: `update_origen_column`

**Descripción**:
- Actualiza el campo descriptivo del origen del lead
- Busca el título en `crm_Origen` basado en `idOrigen`

---

### 4. Función: `update_tipo_cliente_column`
- **Tipo**: Función de trigger
- **Retorno**: TRIGGER
- **Seguridad**: SECURITY INVOKER (por defecto)
- **Propósito**: Actualiza automáticamente el campo `tipoCliente` cuando cambia `idTipoCliente`

#### Implementación completa:
```sql
CREATE OR REPLACE FUNCTION public.update_tipo_cliente_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    SELECT "titulo" INTO NEW."tipoCliente"
    FROM "crm_tipoCliente"
    WHERE id = NEW."idTipoCliente";
    RETURN NEW;
END;
$function$
```

#### Trigger asociado:
- **Nombre**: `trg_update_tipo_cliente`
- **Tabla**: `leads`
- **Evento**: BEFORE UPDATE
- **Función**: `update_tipo_cliente_column`

**Descripción**:
- Mantiene actualizada la descripción del tipo de cliente
- Consulta la tabla `crm_tipoCliente` para obtener el título

---

### 5. Función: `update_tipo_operacion_column`
- **Tipo**: Función de trigger
- **Retorno**: TRIGGER
- **Seguridad**: SECURITY INVOKER (por defecto)
- **Propósito**: Actualiza automáticamente el campo `tipoOperacion` cuando cambia `idTipoOperacion`

#### Implementación completa:
```sql
CREATE OR REPLACE FUNCTION public.update_tipo_operacion_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    SELECT "titulo" INTO NEW."tipoOperacion"
    FROM "crm_tipoOperaciones"
    WHERE id = NEW."idTipoOperacion";
    RETURN NEW;
END;
$function$
```

#### Trigger asociado:
- **Nombre**: `trg_update_tipo_operacion`
- **Tabla**: `leads`
- **Evento**: BEFORE UPDATE
- **Función**: `update_tipo_operacion_column`

**Descripción**:
- Sincroniza el nombre del tipo de operación
- Obtiene el valor desde `crm_tipoOperaciones`

---

### 6. Función: `update_tipo_venta_column`
- **Tipo**: Función de trigger
- **Retorno**: TRIGGER
- **Seguridad**: SECURITY INVOKER (por defecto)
- **Propósito**: Actualiza automáticamente el campo `tipoVenta` cuando cambia `idTipoVenta`

#### Implementación completa:
```sql
CREATE OR REPLACE FUNCTION public.update_tipo_venta_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    SELECT "titulo" INTO NEW."tipoVenta"
    FROM "crm_tipoVenta"
    WHERE id = NEW."idTipoVenta";
    RETURN NEW;
END;
$function$
```

#### Trigger asociado:
- **Nombre**: `trg_update_tipo_venta`
- **Tabla**: `leads`
- **Evento**: BEFORE UPDATE
- **Función**: `update_tipo_venta_column`

**Descripción**:
- Actualiza el campo descriptivo del tipo de venta
- Consulta la tabla `crm_tipoVenta` para obtener el título

---

## Funciones Relacionadas con Flujo de Aprobación

### 7. Función: `leads_poraprobar_actualizar_nomrc`
- **Tipo**: Función de trigger
- **Retorno**: TRIGGER
- **Seguridad**: SECURITY INVOKER (por defecto)
- **Propósito**: Actualiza automáticamente `nomRC` en `leads_porAprobar` antes de insertar

#### Implementación completa:
```sql
CREATE OR REPLACE FUNCTION public.leads_poraprobar_actualizar_nomrc()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- [Fecha y Hora]: 29/09/2025 05:00:00
    -- [Descripción]: Trigger que actualiza automáticamente la columna nomRC
    --                en leads_porAprobar cuando se inserta un nuevo registro.
    --                Obtiene el nombre completo desde catUsers usando uidRC.
    --
    -- [Trigger]: trg_leads_poraprobar_actualizar_nomrc
    -- [Evento]: BEFORE INSERT
    -- [Tabla]: leads_porAprobar
    --
    -- [Lógica]:
    --   - Si NEW.uidRC no es NULL, busca en catUsers el nomCompleto
    --   - Si encuentra el usuario, actualiza NEW.nomRC con ese nombre
    --   - Si no encuentra o uidRC es NULL, deja nomRC con su valor por defecto
    
    -- Solo actualizar si uidRC tiene valor
    IF NEW."uidRC" IS NOT NULL THEN
        -- Buscar el nombre completo del usuario en catUsers
        SELECT "nomCompleto" INTO NEW."nomRC"
        FROM public."catUsers"
        WHERE uid = NEW."uidRC"
        AND status = true;
        
        -- Si no se encontró el usuario, usar el valor por defecto
        IF NEW."nomRC" IS NULL THEN
            NEW."nomRC" := 'Sin asignar';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$
```

**Descripción**:
- Se ejecuta antes de insertar en `leads_porAprobar`
- Busca el nombre completo del responsable comercial
- Asigna 'Sin asignar' si no encuentra el usuario

---

### 8. Función: `leads_poraprobar_insertar_registro`
- **Tipo**: Función almacenada
- **Retorno**: JSONB
- **Seguridad**: SECURITY DEFINER
- **Propósito**: Inserta un nuevo registro en `leads_porAprobar` con validaciones completas

#### Parámetros:
- `p_nombre_lead` (text, OBLIGATORIO)
- `p_id_tipo_operacion` (bigint, OBLIGATORIO)
- `p_id_tipo_venta` (bigint, OBLIGATORIO)
- `p_telefono` (text, OPCIONAL, default: NULL)
- `p_correo` (text, OPCIONAL, default: NULL)
- `p_id_inmobiliaria` (uuid, OPCIONAL, default: NULL)
- `p_id_asesor_inm` (uuid, OPCIONAL, default: NULL)
- `p_mensaje` (text, OPCIONAL, default: NULL)
- `p_id_origen` (bigint, OPCIONAL, default: NULL)
- `p_id_tipo_cliente` (bigint, OPCIONAL, default: NULL)
- `p_valor` (double precision, OPCIONAL, default: 0)
- `p_uid_rc` (uuid, OPCIONAL, default: NULL)

#### Retorna:
JSONB con estructura `{exito, codigo, mensaje, detalles}`

#### Implementación completa:
```sql
CREATE OR REPLACE FUNCTION public.leads_poraprobar_insertar_registro(p_nombre_lead text, p_id_tipo_operacion bigint, p_id_tipo_venta bigint, p_telefono text DEFAULT NULL::text, p_correo text DEFAULT NULL::text, p_id_inmobiliaria uuid DEFAULT NULL::uuid, p_id_asesor_inm uuid DEFAULT NULL::uuid, p_mensaje text DEFAULT NULL::text, p_id_origen bigint DEFAULT NULL::bigint, p_id_tipo_cliente bigint DEFAULT NULL::bigint, p_valor double precision DEFAULT 0, p_uid_rc uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_nuevo_id uuid;
    v_nombre_limpio text;
    v_telefono_limpio text;
    v_correo_limpio text;
    v_mensaje_limpio text;
BEGIN
    -- [Fecha y Hora]: 29/09/2025 05:05:00
    -- [Descripción]: Inserta un nuevo registro en la tabla leads_porAprobar con validaciones
    --                y sanitización completa de todos los campos de entrada.
    --                El trigger automáticamente llenará nomRC desde catUsers.
    --
    -- [Parámetros]:
    --   p_nombre_lead (text) - Nombre del lead (OBLIGATORIO)
    --   p_id_tipo_operacion (bigint) - ID del tipo de operación (OBLIGATORIO)
    --   p_id_tipo_venta (bigint) - ID del tipo de venta (OBLIGATORIO)
    --   p_telefono (text) - Teléfono del lead (OPCIONAL)
    --   p_correo (text) - Email del lead (OPCIONAL)
    --   p_id_inmobiliaria (uuid) - ID de la inmobiliaria (OPCIONAL)
    --   p_id_asesor_inm (uuid) - ID del asesor inmobiliario (OPCIONAL)
    --   p_mensaje (text) - Mensaje adicional (OPCIONAL)
    --   p_id_origen (bigint) - ID del origen del lead (OPCIONAL)
    --   p_id_tipo_cliente (bigint) - ID del tipo de cliente (OPCIONAL)
    --   p_valor (double precision) - Valor asociado al lead (OPCIONAL, default: 0)
    --   p_uid_rc (uuid) - UID del responsable comercial - Se guarda en uidr Y uidRC (OPCIONAL)
    --
    -- [Retorna]: JSONB con estructura {exito, codigo, mensaje, detalles}
    --
    -- [Códigos]: EXITO, PARAMETRO_INVALIDO, ERROR_VALIDACION, ERROR_BASE_DATOS
    
    -- Validaciones
    IF p_nombre_lead IS NULL OR trim(p_nombre_lead) = '' THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PARAMETRO_INVALIDO',
            'mensaje', 'El nombre del lead es obligatorio'
        );
    END IF;
    
    IF p_id_tipo_operacion IS NULL THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PARAMETRO_INVALIDO',
            'mensaje', 'El ID de tipo de operación es obligatorio'
        );
    END IF;
    
    IF p_id_tipo_venta IS NULL THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PARAMETRO_INVALIDO',
            'mensaje', 'El ID de tipo de venta es obligatorio'
        );
    END IF;
    
    IF (p_telefono IS NULL OR trim(p_telefono) = '') AND
       (p_correo IS NULL OR trim(p_correo) = '') THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PARAMETRO_INVALIDO',
            'mensaje', 'Debe proporcionar al menos un teléfono o correo electrónico'
        );
    END IF;
    
    -- Sanitización
    v_nombre_limpio := trim(
        regexp_replace(
            regexp_replace(p_nombre_lead, '[<>"'';&]', '', 'g'),
            '\\s+', ' ', 'g'
        )
    );
    
    IF length(v_nombre_limpio) < 2 OR length(v_nombre_limpio) > 200 THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'ERROR_VALIDACION',
            'mensaje', 'El nombre debe tener entre 2 y 200 caracteres válidos'
        );
    END IF;
    
    IF p_telefono IS NOT NULL AND trim(p_telefono) != '' THEN
        v_telefono_limpio := trim(regexp_replace(p_telefono, '[^0-9+\\-\\s\\(\\)]', '', 'g'));
        IF length(regexp_replace(v_telefono_limpio, '[^0-9]', '', 'g')) < 7 THEN
            RETURN jsonb_build_object(
                'exito', false,
                'codigo', 'ERROR_VALIDACION',
                'mensaje', 'El teléfono debe contener al menos 7 dígitos válidos'
            );
        END IF;
    ELSE
        v_telefono_limpio := NULL;
    END IF;
    
    IF p_correo IS NOT NULL AND trim(p_correo) != '' THEN
        v_correo_limpio := lower(trim(
            regexp_replace(p_correo, '[<>"'';&]', '', 'g')
        ));
        IF v_correo_limpio !~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$' THEN
            RETURN jsonb_build_object(
                'exito', false,
                'codigo', 'ERROR_VALIDACION',
                'mensaje', 'El formato del correo electrónico no es válido'
            );
        END IF;
    ELSE
        v_correo_limpio := NULL;
    END IF;
    
    IF p_mensaje IS NOT NULL AND trim(p_mensaje) != '' THEN
        v_mensaje_limpio := trim(
            regexp_replace(
                regexp_replace(p_mensaje, '[<>"'';&]', '', 'g'),
                '\\s+', ' ', 'g'
            )
        );
        IF length(v_mensaje_limpio) > 1000 THEN
            v_mensaje_limpio := substring(v_mensaje_limpio, 1, 1000);
        END IF;
    ELSE
        v_mensaje_limpio := NULL;
    END IF;
    
    BEGIN
        -- Insertar: El trigger se encargará de llenar nomRC automáticamente
        INSERT INTO public."leads_porAprobar" (
            "nombreLead",
            telefono,
            correo,
            "idTipoOperacion",
            "idTipoVenta",
            "idEtapa",
            "idInmobiliaria",
            "idAsesorInm",
            mensaje,
            "idOrigen",
            "idTipoCliente",
            valor,
            uidr,
            "uidRC",
            "fechaContacto",
            "fechaRegistro"
        ) VALUES (
            v_nombre_limpio,
            v_telefono_limpio,
            v_correo_limpio,
            p_id_tipo_operacion,
            p_id_tipo_venta,
            1,
            p_id_inmobiliaria,
            p_id_asesor_inm,
            v_mensaje_limpio,
            p_id_origen,
            p_id_tipo_cliente,
            COALESCE(p_valor, 0),
            p_uid_rc,
            p_uid_rc,
            NOW(),
            NOW()
        ) RETURNING id INTO v_nuevo_id;
        
        RETURN jsonb_build_object(
            'exito', true,
            'codigo', 'EXITO',
            'mensaje', 'Lead registrado exitosamente',
            'detalles', jsonb_build_object(
                'id_registro', v_nuevo_id,
                'nombre', v_nombre_limpio,
                'telefono', v_telefono_limpio,
                'correo', v_correo_limpio,
                'fecha_registro', NOW()
            )
        );
        
    EXCEPTION
        WHEN foreign_key_violation THEN
            RETURN jsonb_build_object(
                'exito', false,
                'codigo', 'ERROR_VALIDACION',
                'mensaje', 'Uno o más IDs de referencia no existen en el sistema'
            );
        WHEN check_violation THEN
            RETURN jsonb_build_object(
                'exito', false,
                'codigo', 'ERROR_VALIDACION',
                'mensaje', 'Los datos no cumplen con las restricciones de la tabla'
            );
        WHEN OTHERS THEN
            RETURN jsonb_build_object(
                'exito', false,
                'codigo', 'ERROR_BASE_DATOS',
                'mensaje', 'Error al insertar registro: ' || SQLERRM,
                'detalles', jsonb_build_object('sqlstate', SQLSTATE)
            );
    END;
    
END;
$function$
```

**Descripción**:
- Realiza validaciones exhaustivas de los datos de entrada
- Sanitiza todos los campos para prevenir inyección SQL
- Valida formatos de email y teléfono
- Inserta el registro con valores por defecto apropiados
- Maneja diferentes tipos de errores de forma específica

---

### 9. Función: `leads_poraprobar_migrar_a_leads`
- **Tipo**: Función de trigger
- **Retorno**: TRIGGER
- **Propósito**: Migra automáticamente un lead de `leads_porAprobar` a `leads` cuando es aprobado

#### Código:
```sql
DECLARE
    v_lead_existe boolean;
    v_uidr_final uuid;
    v_usuario_aprobo uuid;
BEGIN
    -- [Fecha y Hora]: 29/09/2025 05:35:00
    -- [Descripción]: Trigger que migra automáticamente un lead de leads_porAprobar
    --                a la tabla leads cuando el campo aprobado cambia a TRUE.
    --                También registra la actividad en activity_history.
    --
    -- [Trigger]: trg_leads_poraprobar_migrar_aprobados
    -- [Evento]: AFTER UPDATE
    -- [Tabla]: leads_porAprobar
    -- [Condición]: Cuando aprobado cambia de FALSE/NULL a TRUE
    
    -- Solo proceder si aprobado cambió a TRUE
    IF NEW.aprobado = TRUE AND (OLD.aprobado IS NULL OR OLD.aprobado = FALSE) THEN
        
        -- Determinar el valor final de uidr
        IF NEW.uidr IS NOT NULL THEN
            v_uidr_final := NEW.uidr;
        ELSIF NEW."uidRC" IS NOT NULL THEN
            v_uidr_final := NEW."uidRC";
        ELSE
            v_uidr_final := '00000000-0000-0000-0000-000000000000'::uuid;
        END IF;
        
        -- Determinar quién aprobó el lead
        v_usuario_aprobo := COALESCE(NEW."uidRC", '00000000-0000-0000-0000-000000000000'::uuid);
        
        -- Verificar si el lead ya existe en la tabla leads
        SELECT EXISTS(
            SELECT 1 FROM public.leads WHERE id = NEW.id
        ) INTO v_lead_existe;
        
        -- Solo insertar si NO existe
        IF NOT v_lead_existe THEN
            -- 1. INSERTAR EN TABLA LEADS
            INSERT INTO public.leads (
                id, uidr, status, fc, "nombreLead", telefono, correo,
                "idInmobiliaria", "fechaContacto", "fechaRegistro", mensaje,
                "uidRC", "idEtapa", "idOrigen", "idTipoCliente",
                "idTipoOperacion", "idTipoVenta", "Etapa", "Origen",
                "tipoCliente", "tipoOperacion", "tipoVenta", "nomRC",
                valor, "Aprobado", "idAsesorInm"
            ) VALUES (
                NEW.id, v_uidr_final, NEW.status, NEW.fc, NEW."nombreLead",
                NEW.telefono, NEW.correo, NEW."idInmobiliaria",
                NEW."fechaContacto", NEW."fechaRegistro", NEW.mensaje,
                NEW."uidRC", NEW."idEtapa", NEW."idOrigen", NEW."idTipoCliente",
                NEW."idTipoOperacion", NEW."idTipoVenta", NEW."Etapa",
                NEW."Origen", NEW."tipoCliente", NEW."tipoOperacion",
                NEW."tipoVenta", NEW."nomRC", NEW.valor, TRUE, NEW."idAsesorInm"
            );
            
            -- 2. REGISTRAR ACTIVIDAD EN activity_history
            INSERT INTO public.activity_history (
                lead_id, name, activity_date, message, heat_level,
                user_id, type
            ) VALUES (
                NEW.id,
                'Lead Aprobado',
                NOW(),
                'Lead aprobado y migrado de la lista de pre-aprobación. ' ||
                'Nombre: ' || COALESCE(NEW."nombreLead", 'Sin nombre') || '. ' ||
                'Teléfono: ' || COALESCE(NEW.telefono, 'Sin teléfono') || '. ' ||
                'Responsable: ' || COALESCE(NEW."nomRC", 'Sin asignar') || '.',
                3,
                v_usuario_aprobo,
                'aprobacion'
            );
            
            RAISE NOTICE 'Lead migrado exitosamente: % - % (uidr usado: %)', 
                        NEW.id, NEW."nombreLead", v_uidr_final;
            
        ELSE
            RAISE NOTICE 'Lead ya existe en tabla leads: % - %', 
                        NEW.id, NEW."nombreLead";
        END IF;
        
    END IF;
    
    RETURN NEW;
END;
```

**Descripción**: 
- Se activa cuando un lead cambia de estado a aprobado
- Maneja la lógica de asignación de uidr (uidr > uidRC > usuario por defecto)
- Verifica que el lead no exista previamente en la tabla leads
- Inserta el lead en la tabla principal
- Registra la actividad en `activity_history`
- Mantiene el registro original en `leads_porAprobar` con `aprobado = TRUE`

---

### 10. Función: `leads_puente_sync_to_leads_before`
- **Tipo**: Función de trigger
- **Retorno**: TRIGGER
- **Propósito**: Función de puente que valida y redirige inserciones a `leads_porAprobar`

#### Código:
```sql
/*
 * Función: leads_puente_sync_to_leads_before
 *
 * Descripción:
 * Este trigger se ejecuta antes de cada inserción en la tabla "leads_puente".
 * Su objetivo es:
 * 1. Validar que el registro tenga los campos mínimos requeridos:
 *    - "nombreLead" (obligatorio)
 *    - Al menos uno entre "telefono" o "correo"
 * 2. Insertar el registro validado en la tabla "leads"
 * 3. Evitar que el registro quede almacenado en "leads_puente"
 * 
 * Notas:
 * - No se copia el campo "id", se genera uno nuevo en "leads"
 * - Si falla la validación, se lanza un error y no se permite la inserción
 * - El registro nunca llega a quedarse en "leads_puente"
 */
BEGIN

    -- Validación: "nombreLead" es obligatorio
    IF NEW."nombreLead" IS NULL OR TRIM(NEW."nombreLead") = '' THEN
        RAISE EXCEPTION 'El nombre del lead es obligatorio.';
    END IF;

    -- Validación: debe haber al menos un medio de contacto: teléfono o correo
    IF (NEW.telefono IS NULL OR TRIM(NEW.telefono) = '') AND 
       (NEW.correo IS NULL OR TRIM(NEW.correo) = '') THEN
        RAISE EXCEPTION 'Debe proporcionarse al menos un medio de contacto: teléfono o correo.';
    END IF;

    -- Insertar en la tabla leads (sin copiar el id, se genera uno nuevo)
    INSERT INTO public."leads_porAprobar" (
        uidr, status, fc, "nombreLead", telefono, correo,
        "idInmobiliaria", "fechaContacto", "fechaRegistro", mensaje,
        "uidRC", "idEtapa", "idOrigen", "idTipoCliente",
        "idTipoOperacion", "idTipoVenta", "Etapa", "Origen",
        "tipoCliente", "tipoOperacion", "tipoVenta", "nomRC",
        valor
    )
    VALUES (
        NEW.uidr, NEW.status, NEW.fc, NEW."nombreLead", NEW.telefono, NEW.correo,
        NEW."idInmobiliaria", NEW."fechaContacto", NEW."fechaRegistro", NEW.mensaje,
        NEW."uidRC", NEW."idEtapa", NEW."idOrigen", NEW."idTipoCliente",
        NEW."idTipoOperacion", NEW."idTipoVenta", NEW."Etapa", NEW."Origen",
        NEW."tipoCliente", NEW."tipoOperacion", NEW."tipoVenta", NEW."nomRC",
        NEW.valor
    );

    -- Evitar que el registro se inserte en leads_puente
    RETURN NULL;
END;
```

**Descripción**: 
- Actúa como una tabla de puente para redirigir inserciones
- Realiza validaciones básicas obligatorias
- Redirige los registros válidos a `leads_porAprobar`
- Evita almacenamiento en la tabla puente retornando NULL

---

## Flujo de Trabajo de Leads

### 1. Ingreso de Leads
```
leads_puente (validación) → leads_porAprobar (espera aprobación)
```

### 2. Aprobación y Migración
```
leads_porAprobar.aprobado = TRUE → leads (tabla principal)
                              ↓
                        activity_history (registro)
```

### 3. Actualizaciones Automáticas
```
UPDATE leads → Triggers → Actualización de campos descriptivos
```

## Tablas Involucradas

### Principales
- **leads**: Tabla principal con todos los leads aprobados
- **leads_porAprobar**: Tabla temporal para leads pendientes de aprobación
- **activity_history**: Registro de actividades y cambios

### Catálogos
- **catUsers**: Usuarios del sistema
- **crm_Etapas**: Etapas del proceso de ventas
- **crm_Origen**: Orígenes de los leads
- **crm_tipoCliente**: Tipos de cliente
- **crm_tipoOperaciones**: Tipos de operación
- **crm_tipoVenta**: Tipos de venta

## Consideraciones Importantes

1. **Integridad de datos**: Los triggers aseguran que los campos descriptivos siempre estén sincronizados
2. **Validación**: Se realizan validaciones tanto en el frontend como en la base de datos
3. **Auditoría**: Todas las migraciones de leads quedan registradas en `activity_history`
4. **Seguridad**: Las funciones incluyen sanitización para prevenir inyección SQL
5. **Manejo de errores**: Las funciones retornan códigos de error específicos para mejor diagnóstico
---

## Función de Consulta de Leads por Aprobar

### 11. Función: `leads_poraprobar_obtener_detalle`
- **Tipo**: Función almacenada
- **Retorno**: TABLE con estructura completa
- **Seguridad**: SECURITY INVOKER
- **Propósito**: Obtener todos los leads pendientes de aprobación con información detallada

#### Implementación completa:
```sql
CREATE OR REPLACE FUNCTION public.leads_poraprobar_obtener_detalle()
 RETURNS TABLE(
    id uuid,
    uidr uuid,
    status boolean,
    fc timestamp without time zone,
    "nombreLead" text,
    telefono text,
    correo text,
    "idInmobiliaria" uuid,
    "fechaContacto" timestamp without time zone,
    "fechaRegistro" timestamp with time zone,
    mensaje text,
    "KVAs" text,
    superficie text,
    ubicacion text,
    "uidRC" uuid,
    "idEtapa" bigint,
    "idOrigen" bigint,
    "idTipoCliente" bigint,
    "idTipoOperacion" bigint,
    "idTipoVenta" bigint,
    "Etapa" text,
    "Origen" text,
    "tipoCliente" text,
    "tipoOperacion" text,
    "tipoVenta" text,
    "nomRC" text,
    valor double precision,
    aprobado boolean,
    "nombreRegistro" text,
    "nombreInmobiliaria" text,
    "nombreAsesorInm" text,
    "tituloEtapa" text,
    "tituloOrigen" text,
    "tituloTipoCliente" text,
    "tituloTipoOperacion" text,
    "tituloTipoVenta" text
 )
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $BODY$
BEGIN
    RETURN QUERY
    SELECT
      lpa.id,
      lpa.uidr,
      lpa.status,
      lpa.fc,
      lpa."nombreLead",
      lpa.telefono,
      lpa.correo,
      lpa."idInmobiliaria",
      lpa."fechaContacto",
      lpa."fechaRegistro",
      lpa.mensaje,
      lpa."KVAs",
      lpa.superficie,
      lpa.ubicacion,
      lpa."uidRC",
      lpa."idEtapa",
      lpa."idOrigen",
      lpa."idTipoCliente",
      lpa."idTipoOperacion",
      lpa."idTipoVenta",
      lpa."Etapa",
      lpa."Origen",
      lpa."tipoCliente",
      lpa."tipoOperacion",
      lpa."tipoVenta",
      lpa."nomRC",
      lpa.valor,
      lpa.aprobado,
      ur."nomCompleto" as "nombreRegistro",
      ci.nombre as "nombreInmobiliaria",
      ai.nombre as "nombreAsesorInm",
      ce."titulo" as "tituloEtapa",
      co."titulo" as "tituloOrigen",
      ctc."titulo" as "tituloTipoCliente",
      cto."titulo" as "tituloTipoOperacion",
      ctv."titulo" as "tituloTipoVenta"
    FROM
      "leads_porAprobar" lpa
      LEFT JOIN public."catUsers" ur ON lpa.uidr = ur.uid
      LEFT JOIN public."catUsers" rc ON lpa."uidRC" = rc.uid
      LEFT JOIN public."catInmobiliarias" ci ON lpa."idInmobiliaria" = ci."idInmobiliaria"
      LEFT JOIN public."crm_Etapas" ce ON lpa."idEtapa" = ce.id
      LEFT JOIN public."crm_Origen" co ON lpa."idOrigen" = co.id
      LEFT JOIN public."crm_tipoCliente" ctc ON lpa."idTipoCliente" = ctc.id
      LEFT JOIN public."crm_tipoOperaciones" cto ON lpa."idTipoOperacion" = cto.id
      LEFT JOIN public."crm_tipoVenta" ctv ON lpa."idTipoVenta" = ctv.id
      LEFT JOIN public."catAsesoresInm" ai ON lpa."idAsesorInm" = ai.id
    WHERE
      lpa.aprobado IS NULL
    ORDER BY
      lpa."fechaRegistro" DESC;
      
    RETURN;
END;
$BODY$;
```

**Descripción**:
- Convierte la consulta compleja de leads por aprobar en una función reutilizable
- Retorna una estructura TABLE completa con todos los campos necesarios
- Usa LEFT JOIN para incluir todos los registros aunque falten relaciones
- Filtra automáticamente `aprobado IS NULL` para mostrar solo pendientes
- Ordena por `fechaRegistro DESC` para mostrar los más recientes primero

**Uso típico**:
```sql
-- Obtener todos los leads pendientes
SELECT * FROM leads_poraprobar_obtener_detalle();

-- Contar leads pendientes
SELECT COUNT(*) FROM leads_poraprobar_obtener_detalle();

-- Filtrar por inmobiliaria específica
SELECT * FROM leads_poraprobar_obtener_detalle()
WHERE "nombreInmobiliaria" = 'Nombre Inmobiliaria';
```

---

*Documento generado el: 2025-10-11*
*Proyecto: SPH Bines Raices - Sistema de Gestión de Leads*
*Última actualización: 20/10/2025*