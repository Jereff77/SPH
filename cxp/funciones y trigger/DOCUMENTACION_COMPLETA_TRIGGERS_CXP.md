# Documentación Completa de Triggers y Funciones de la Tabla CXP

## [Fecha y Hora]: 07/01/2026 05:21:00
## [Descripción]: Documentación completa de todos los triggers y funciones asociadas a la tabla cxp

---

## Resumen de Triggers en la Tabla CXP

La tabla `cxp` tiene 6 triggers asociados que se ejecutan automáticamente en diferentes eventos:

| # | Trigger | Función | Evento | Timing | Descripción |
|---|---------|---------|---------|---------|-------------|
| 1 | `set_estado` | `update_estado` | INSERT/UPDATE | AFTER | Actualiza el campo `estado` según el valor de `idEstado` |
| 2 | `set_week_info` | `update_week_info` | INSERT/UPDATE | BEFORE | Calcula y actualiza `numSem` y `rangoSemana` |
| 3 | `trigger_actualizar_nom_gerente` | `actualizar_nom_gerente` | INSERT/UPDATE | BEFORE | Actualiza `nomGerente` basado en `uidGerente` |
| 4 | `trigger_cxp_actualizar_nomcfdi` | `cxp_actualizar_nomcfdi_vacio` | INSERT | AFTER | Actualiza `nomCFDI` cuando está vacío |
| 5 | `trigger_cxp_validar_fecha_insert` | `cxp_trigger_validar_fecha` | INSERT/UPDATE | BEFORE | Valida fechas habilitadas y permisos |
| 6 | `trigger_cxp_validar_y_actualizar_proveedor` | `cxp_validar_y_actualizar_proveedor` | INSERT/UPDATE | BEFORE | Valida y actualiza datos del proveedor |

---

## Detalle de Cada Función

### 1. Función: `update_estado()`

**Trigger asociado**: `set_estado`
**Evento**: AFTER INSERT OR UPDATE
**Propósito**: Actualiza el campo descriptivo `estado` según el valor numérico `idEstado`

```sql
CREATE OR REPLACE FUNCTION public.update_estado()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    -- Actualizar el campo "estado" según el valor de "idEstado"
    CASE NEW."idEstado"
        WHEN 1 THEN NEW.estado := 'Guardado';
        WHEN 2 THEN NEW.estado := 'Enviado';
        WHEN 3 THEN NEW.estado := 'Rechazado';
        WHEN 4 THEN NEW.estado := 'Aprobado';
        WHEN 5 THEN NEW.estado := 'Reprogramado';
        WHEN 6 THEN NEW.estado := 'Pagado';
        WHEN 7 THEN NEW.estado := 'Pago T. Bancaria';
        WHEN 99 THEN NEW.estado := 'Aprobado sin pago aplicado';
        ELSE NEW.estado := 'Desconocido';
    END CASE;
    
    -- Si tdc es TRUE, establecer "idEstado" a 7
    IF NEW.tdc = TRUE THEN
        NEW."idEstado" = 7;
        NEW.estado := 'Pago T. Bancaria';
    END IF;
    
    RETURN NEW;
END;
$function$
```

**Valores de estado**:
- 1 = Guardado
- 2 = Enviado
- 3 = Rechazado
- 4 = Aprobado
- 5 = Reprogramado
- 6 = Pagado
- 7 = Pago T. Bancaria
- 99 = Aprobado sin pago aplicado

---

### 2. Función: `update_week_info()` ⭐

**Trigger asociado**: `set_week_info`
**Evento**: BEFORE INSERT OR UPDATE
**Propósito**: Calcula el número de semana y genera un rango descriptivo de la semana

```sql
CREATE OR REPLACE FUNCTION public.update_week_info()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    NEW."numSem" = EXTRACT(WEEK FROM NEW."fecSolicitud");
    NEW."rangoSemana" = 'Sem ' || EXTRACT(WEEK FROM NEW."fecSolicitud")::text || 
    ' del ' || 
    TO_CHAR(DATE_TRUNC('week', NEW."fecSolicitud")::date, 'DD') ||
    ' al ' ||
    TO_CHAR((DATE_TRUNC('week', NEW."fecSolicitud") + INTERVAL '6 days')::date, 'DD') ||
    ' de ' ||
    CASE EXTRACT(MONTH FROM NEW."fecSolicitud")::integer
        WHEN 1 THEN 'ene'
        WHEN 2 THEN 'feb'
        WHEN 3 THEN 'mar'
        WHEN 4 THEN 'abr'
        WHEN 5 THEN 'may'
        WHEN 6 THEN 'jun'
        WHEN 7 THEN 'jul'
        WHEN 8 THEN 'ago'
        WHEN 9 THEN 'sep'
        WHEN 10 THEN 'oct'
        WHEN 11 THEN 'nov'
        WHEN 12 THEN 'dic'
    END ||
    ' ' ||
    EXTRACT(YEAR FROM NEW."fecSolicitud")::text;
    RETURN NEW;
END;
$function$
```

**Columnas actualizadas**:
- `numSem`: Número de semana del año (1-52)
- `rangoSemana`: Texto con formato "Sem X del DD al DD de mes YYYY"

**Ejemplo**: "Sem 15 del 08 al 14 de abr 2024"

---

### 3. Función: `actualizar_nom_gerente()`

**Trigger asociado**: `trigger_actualizar_nom_gerente`
**Evento**: BEFORE INSERT OR UPDATE OF "uidGerente"
**Propósito**: Actualiza el nombre completo del gerente basado en su UID

```sql
CREATE OR REPLACE FUNCTION public.actualizar_nom_gerente()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Solo actualizar si uidGerente tiene un valor válido
  IF NEW."uidGerente" IS NOT NULL 
     AND NEW."uidGerente" != '' 
     AND NEW."uidGerente" != '-' THEN
    
    -- Actualizar nomGerente con el nombre completo del gerente
    SELECT CONCAT(nombre, ' ', apellidos)
    INTO NEW."nomGerente"
    FROM "catUsers"
    WHERE uid = NEW."uidGerente"::uuid;
    
  ELSE
    -- Si no hay gerente válido, dejar el campo en NULL
    NEW."nomGerente" := NULL;
  END IF;
  
  RETURN NEW;
END;
$function$
```

**Comportamiento**:
- Busca en `catUsers` el nombre y apellidos del gerente
- Concatena nombre completo y lo guarda en `nomGerente`
- Si `uidGerente` es inválido, establece `nomGerente` en NULL

---

### 4. Función: `cxp_actualizar_nomcfdi_vacio()`

**Trigger asociado**: `trigger_cxp_actualizar_nomcfdi`
**Evento**: AFTER INSERT
**Propósito**: Actualiza `nomCFDI` cuando está vacío usando `nombreProveedor`

```sql
CREATE OR REPLACE FUNCTION public.cxp_actualizar_nomcfdi_vacio()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    --[Fecha y Hora]: 07/11/2025 09:15:30
    -- [Descripción]: Función trigger que se ejecuta después de insertar un registro en la tabla cxp
    --                Verifica si el campo nomCFDI está vacío y lo actualiza con nombreProveedor
    --                También actualiza fecCFDI con fecSolicitud si está vacía
    
    -- Verificar si nomCFDI está vacío (NULL o cadena vacía) y nombreProveedor tiene valor
    IF (NEW."nomCFDI" IS NULL OR NEW."nomCFDI" = '' OR NEW."nomCFDI" = 'EMPTY') 
       AND NEW."nombreProveedor" IS NOT NULL 
       AND NEW."nombreProveedor" != '' THEN
        
        -- Actualizar el campo nomCFDI con el valor de nombreProveedor
        -- y también actualizar fecCFDI con fecSolicitud solo si fecCFDI es NULL
        UPDATE public.cxp
        SET 
            "nomCFDI" = NEW."nombreProveedor",
            "fecCFDI" = CASE 
                WHEN NEW."fecCFDI" IS NULL AND NEW."fecSolicitud" IS NOT NULL 
                THEN NEW."fecSolicitud"
                ELSE NEW."fecCFDI"
            END
        WHERE "idCxp" = NEW."idCxp";
        
        -- Actualizar también el valor en NEW para consistencia
        NEW."nomCFDI" := NEW."nombreProveedor";
        IF NEW."fecCFDI" IS NULL AND NEW."fecSolicitud" IS NOT NULL THEN
            NEW."fecCFDI" := NEW."fecSolicitud";
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$
```

**Comportamiento**:
- Si `nomCFDI` está vacío y `nombreProveedor` tiene valor, copia el nombre
- Si `fecCFDI` es NULL y `fecSolicitud` tiene valor, copia la fecha
- Se ejecuta después del INSERT para asegurar que el registro ya existe

---

### 5. Función: `cxp_trigger_validar_fecha()`

**Trigger asociado**: `trigger_cxp_validar_fecha_insert`
**Evento**: BEFORE INSERT OR UPDATE
**Propósito**: Valida operaciones según fechas habilitadas y permisos de usuario

```sql
CREATE OR REPLACE FUNCTION public.cxp_trigger_validar_fecha()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    fecha_actual DATE := CURRENT_DATE;
    cfdi_habilitado BOOLEAN := false;
    autorizar_habilitado BOOLEAN := false;
    es_usuario_autorizador BOOLEAN := false;
    estado_anterior SMALLINT;
BEGIN
    -- [Descripción]: Función trigger que valida operaciones en tabla cxp según reglas de negocio
    -- [Trigger]: trigger_cxp_validar_fecha_insert
    -- [Eventos]: BEFORE INSERT OR UPDATE en tabla public.cxp
    -- [Validaciones]:
    --   - INSERT: Requiere fecha con cfdi=true en cxp_fechas_habilitadas
    --   - UPDATE: Permite actualizaciones excepto cambios de estado sin permisos
    --   - Estado: Solo usuarios con clave 430 pueden cambiar a estados de autorización
    -- [Estados]:
    --   - Usuario normal: 1=Guardado, 2=Enviado
    --   - Usuario autorizador (clave 430): 3=Rechazado, 4=Aprobado, 1=Guardado
    -- [Uso]: Se ejecuta automáticamente en operaciones sobre tabla cxp
    
    -- Obtener información de fechas habilitadas para hoy
    SELECT cfdi, autorizar 
    INTO cfdi_habilitado, autorizar_habilitado
    FROM public.cxp_fechas_habilitadas 
    WHERE fecha = fecha_actual;
    
    -- Si no existe la fecha en la tabla, considerar ambos como false
    IF NOT FOUND THEN
        cfdi_habilitado := false;
        autorizar_habilitado := false;
    END IF;
    
    -- Verificar si el usuario tiene permisos de autorización (clave 430)
    SELECT EXISTS(
        SELECT 1 
        FROM public."segModulosUsuarios" 
        WHERE uid = NEW.uidr 
          AND clave = 430 
          AND acceso = true
    ) INTO es_usuario_autorizador;
    
    -- === VALIDACIONES PARA INSERT ===
    IF TG_OP = 'INSERT' THEN
        -- Para insertar nuevos registros, la fecha debe tener cfdi=true
        IF NOT cfdi_habilitado THEN
            RAISE EXCEPTION 'CXP_CFDI_NO_HABILITADO: No se pueden insertar registros en CxP. La fecha actual (%) no permite generar CFDI. Solo se permite en fechas con cfdi=true (generalmente lunes y martes).', 
                fecha_actual
            USING HINT = 'Verifique la tabla cxp_fechas_habilitadas o espere a una fecha habilitada para CFDI.';
        END IF;
        
        -- Si llega aquí, permitir la inserción
        RETURN NEW;
    END IF;
    
    -- === VALIDACIONES PARA UPDATE ===
    IF TG_OP = 'UPDATE' THEN
        -- Permitir actualizaciones en general, pero validar cambios de estado
        
        -- Si no cambió el estado, permitir la actualización
        IF OLD."idEstado" = NEW."idEstado" OR NEW."idEstado" IS NULL THEN
            RETURN NEW;
        END IF;
        
        -- Si cambió el estado, aplicar validaciones según el usuario
        estado_anterior := COALESCE(OLD."idEstado", 1);
        
        -- === VALIDACIONES PARA USUARIOS NORMALES ===
        IF NOT es_usuario_autorizador THEN
            -- Usuarios normales solo pueden cambiar entre estados 1 (Guardado) y 2 (Enviado)
            IF NEW."idEstado" NOT IN (1, 2) THEN
                RAISE EXCEPTION 'CXP_ESTADO_NO_AUTORIZADO: Usuario sin permisos para cambiar al estado %. Solo se permiten estados: 1=Guardado, 2=Enviado', 
                    NEW."idEstado"
                USING HINT = 'Contacte a un usuario con permisos de autorización (clave 430) para cambios de estado de aprobación.';
            END IF;
        END IF;
        
        -- === VALIDACIONES PARA USUARIOS AUTORIZADORES ===
        IF es_usuario_autorizador THEN
            -- Usuarios autorizadores pueden cambiar a cualquier estado, pero validar fecha para ciertas operaciones
            -- Estados permitidos: 1=Guardado, 3=Rechazado, 4=Aprobado, (y otros según necesidad)
            
            -- Para cambios que requieren autorización (3, 4), validar que autorizar=true
            IF NEW."idEstado" IN (3, 4) AND NOT autorizar_habilitado THEN
                RAISE EXCEPTION 'CXP_AUTORIZACION_NO_HABILITADA: No se pueden realizar autorizaciones hoy (%). La fecha actual no permite autorizar. Solo se permite en fechas con autorizar=true.', 
                    fecha_actual
                USING HINT = 'Las autorizaciones están permitidas generalmente en lunes, martes y miércoles habilitados.';
            END IF;
        END IF;
        
        -- Si llegó aquí, permitir la actualización
        RETURN NEW;
    END IF;
    
    -- Por defecto, permitir la operación
    RETURN NEW;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Re-lanzar la excepción para mantener el comportamiento de bloqueo
        RAISE;
END;
$function$
```

**Validaciones implementadas**:
- **INSERT**: Requiere que la fecha actual tenga `cfdi=true` en `cxp_fechas_habilitadas`
- **UPDATE**:
  - Usuarios normales (sin clave 430): Solo pueden cambiar entre estados 1 (Guardado) y 2 (Enviado)
  - Usuarios autorizadores (clave 430): Pueden cambiar a cualquier estado, pero para autorizaciones (3,4) requiere `autorizar=true`
- **Fechas habilitadas**: Generalmente lunes y martes para CFDI, lunes-miércoles para autorizaciones

---

### 6. Función: `cxp_validar_y_actualizar_proveedor()`

**Trigger asociado**: `trigger_cxp_validar_y_actualizar_proveedor`
**Evento**: BEFORE INSERT OR UPDATE OF "idProveedor", "tipoProveedor"
**Propósito**: Valida que el proveedor exista y actualiza `nombreProveedor`

```sql
CREATE OR REPLACE FUNCTION public.cxp_validar_y_actualizar_proveedor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    nombre_encontrado TEXT := NULL;
    tipo_entidad TEXT := '';
BEGIN
    -- [Descripción]: Valida que idProveedor exista según tipoProveedor y actualiza nombreProveedor
    -- [Trigger]: trigger_cxp_validar_y_actualizar_proveedor
    -- [Eventos]: BEFORE INSERT OR UPDATE en tabla cxp
    -- [Validaciones]:
    --   - tipoProveedor = 1: Busca en catProveedores usando idProveedor
    --   - tipoProveedor = 2: Busca en inversionista usando idInversionista 
    --   - tipoProveedor = 3: No implementado (comisionistas)
    -- [Comportamiento]: 
    --   - Si encuentra: actualiza nombreProveedor y permite operación
    --   - Si no encuentra: bloquea operación con excepción específica
    -- [Seguridad]: DEFINER - ejecuta con permisos del propietario de la función
    -- [Uso]: Se ejecuta automáticamente en operaciones sobre tabla cxp

    -- Validar que los campos requeridos tengan valor
    IF NEW."tipoProveedor" IS NULL THEN
        RAISE EXCEPTION 'CXP_TIPO_PROVEEDOR_REQUERIDO: El campo tipoProveedor es obligatorio. Valores permitidos: 1=Proveedor, 2=Inversionista'
        USING HINT = 'Especifique tipoProveedor antes de guardar el registro.';
    END IF;

    IF NEW."idProveedor" IS NULL OR NEW."idProveedor" = '' THEN
        RAISE EXCEPTION 'CXP_ID_PROVEEDOR_REQUERIDO: El campo idProveedor es obligatorio cuando tipoProveedor tiene valor'
        USING HINT = 'Especifique un ID válido según el tipo: Proveedor, Inversionista o Comisionista.';
    END IF;

    -- Procesar según el tipo de proveedor
    CASE NEW."tipoProveedor"
        WHEN 1 THEN
            -- Tipo 1: Buscar en catProveedores
            tipo_entidad := 'Proveedor';
            
            SELECT p."razonSocial" 
            INTO nombre_encontrado
            FROM public."catProveedores" p 
            WHERE p."idProveedor" = NEW."idProveedor"
                AND p.status = true;  -- Solo proveedores activos
            
        WHEN 2 THEN
            -- Tipo 2: Buscar en inversionista
            tipo_entidad := 'Inversionista';
            
            SELECT COALESCE(i.razonsocial, i.nombre) 
            INTO nombre_encontrado
            FROM public.inversionista i 
            WHERE i."idInversionista" = NEW."idProveedor";
            
        WHEN 3 THEN
            -- Tipo 3: Comisionistas - No implementado aún
            RAISE EXCEPTION 'CXP_COMISIONISTA_NO_IMPLEMENTADO: Los comisionistas (tipoProveedor=3) aún no están implementados en esta validación'
            USING HINT = 'Use tipoProveedor 1 (Proveedor) o 2 (Inversionista) por el momento.';
            
        ELSE
            -- Tipo no válido
            RAISE EXCEPTION 'CXP_TIPO_PROVEEDOR_INVALIDO: tipoProveedor debe ser 1 (Proveedor), 2 (Inversionista) o 3 (Comisionista). Recibido: %', 
                NEW."tipoProveedor"
            USING HINT = 'Verifique que el valor de tipoProveedor sea correcto.';
    END CASE;

    -- Validar que se encontró el registro
    IF nombre_encontrado IS NULL THEN
        RAISE EXCEPTION 'CXP_ENTIDAD_NO_EXISTE: % con ID "%" no existe o está inactivo', 
            tipo_entidad, NEW."idProveedor"
        USING HINT = 'Verifique que el ID existe en la tabla correspondiente y que el registro esté activo.';
    END IF;

    -- Si llegó hasta aquí, actualizar el nombre automáticamente
    NEW."nombreProveedor" := nombre_encontrado;

    -- Log informativo para debugging (visible en development)
    RAISE NOTICE 'CXP_PROVEEDOR_VALIDADO: % "%" (ID: %) validado exitosamente', 
        tipo_entidad, nombre_encontrado, NEW."idProveedor";

    RETURN NEW;

EXCEPTION
    WHEN OTHERS THEN
        -- Re-lanzar la excepción para mantener el comportamiento de bloqueo
        -- Esto asegura que la inserción/actualización se detenga
        RAISE;
END;
$function$
```

**Validaciones por tipo de proveedor**:
- **Tipo 1 (Proveedor)**: Busca en `catProveedores` por `idProveedor` (requiere `status=true`)
- **Tipo 2 (Inversionista)**: Busca en `inversionista` por `idInversionista` (usa `razonsocial` o `nombre`)
- **Tipo 3 (Comisionista)**: No implementado aún

**Comportamiento**:
- Si encuentra el registro, actualiza automáticamente `nombreProveedor`
- Si no encuentra, lanza excepción específica
- Usa `SECURITY DEFINER` para ejecutar con permisos elevados

---

## Orden de Ejecución de los Triggers

Los triggers se ejecutan en el siguiente orden durante las operaciones:

### Para INSERT:
1. **BEFORE** (en orden de creación):
   - `set_week_info` → `update_week_info()`
   - `trigger_actualizar_nom_gerente` → `actualizar_nom_gerente()`
   - `trigger_cxp_validar_fecha_insert` → `cxp_trigger_validar_fecha()`
   - `trigger_cxp_validar_y_actualizar_proveedor` → `cxp_validar_y_actualizar_proveedor()`

2. **AFTER**:
   - `set_estado` → `update_estado()`
   - `trigger_cxp_actualizar_nomcfdi` → `cxp_actualizar_nomcfdi_vacio()`

### Para UPDATE:
1. **BEFORE** (según columnas modificadas):
   - `set_week_info` → `update_week_info()` (siempre)
   - `trigger_actualizar_nom_gerente` → `actualizar_nom_gerente()` (solo si cambia `uidGerente`)
   - `trigger_cxp_validar_fecha_insert` → `cxp_trigger_validar_fecha()` (siempre)
   - `trigger_cxp_validar_y_actualizar_proveedor` → `cxp_validar_y_actualizar_proveedor()` (solo si cambia `idProveedor` o `tipoProveedor`)

2. **AFTER**:
   - `set_estado` → `update_estado()` (siempre)

---

## Consideraciones Importantes

1. **Seguridad**: La función `cxp_validar_y_actualizar_proveedor()` usa `SECURITY DEFINER` para poder acceder a tablas que podrían tener políticas RLS restrictivas.

2. **Validación de Fechas**: Las operaciones de CxP están restringidas por fechas habilitadas en la tabla `cxp_fechas_habilitadas`.

3. **Permisos de Autorización**: Solo usuarios con clave 430 en `segModulosUsuarios` pueden realizar autorizaciones.

4. **Tipos de Proveedor**: Actualmente solo están implementados tipos 1 (Proveedor) y 2 (Inversionista). El tipo 3 (Comisionista) está pendiente de implementación.

5. **Consistencia de Datos**: Los triggers aseguran la consistencia automática de campos derivados como `estado`, `rangoSemana`, `nomGerente`, y `nombreProveedor`.

---

## Archivos Relacionados

- `cxp_fechas_habilitadas`: Tabla que controla qué fechas permiten operaciones de CFDI y autorización
- `catProveedores`: Catálogo de proveedores (tipoProveedor=1)
- `inversionista`: Catálogo de inversionistas (tipoProveedor=2)
- `catUsers`: Usuarios del sistema (para nombres de gerentes)
- `segModulosUsuarios`: Permisos de usuarios (clave 430 para autorizadores)

---

## Actualización: 07/01/2026

Se documentó completamente la función `update_week_info()` que responde a la pregunta original sobre quién actualiza la columna `rangoSemana`. Esta función genera un rango descriptivo de la semana basado en la fecha de solicitud.