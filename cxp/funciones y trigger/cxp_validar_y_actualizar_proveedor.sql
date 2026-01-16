--[Fecha y Hora]: 29/10/2025 23:15:45
--[Descripción]: Valida que idProveedor exista según tipoProveedor y actualiza nombreProveedor
--
--[Parámetros]: No requiere parámetros directos (función trigger)
--
--[Salida]:
--   - trigger: Retorna NEW con nombreProveedor actualizado o NULL si hay error
--
--[Trigger asociado]: trigger_cxp_validar_y_actualizar_proveedor
--
--[Eventos]: 
--   - BEFORE INSERT: Al insertar nuevos registros
--   - BEFORE UPDATE: Al actualizar registros existentes
--
--[Uso típico]: Se ejecuta automáticamente al insertar o actualizar registros CXP
--               para garantizar la integridad referencial con proveedores/inversionistas
--
--[Relaciones]: 
--   - Tabla principal: cxp
--   - Tabla: catProveedores (para tipoProveedor = 1)
--   - Tabla: inversionista (para tipoProveedor = 2)
--
--[Validaciones]:
--   - Verifica que tipoProveedor no sea nulo
--   - Verifica que idProveedor no sea nulo o vacío
--   - Valida que tipoProveedor esté en el rango 1-3
--   - Verifica existencia del proveedor/inversionista
--   - Para proveedores: verifica status = true
--
--[Lógica de búsqueda]:
--   - Tipo 1: Busca en catProveedores por idProveedor
--   - Tipo 2: Busca en inversionista por idInversionista
--   - Tipo 3: Retorna error de no implementado (comisionistas)
--
--[Actualización automática]:
--   - Si encuentra el proveedor/inversionista, actualiza nombreProveedor
--   - Para proveedores: usa razonSocial
--   - Para inversionistas: prefiere razonsocial sobre nombre
--
--[Mensajes de error]:
--   - CXP_TIPO_PROVEEDOR_REQUERIDO: tipoProveedor es obligatorio
--   - CXP_ID_PROVEEDOR_REQUERIDO: idProveedor es obligatorio
--   - CXP_ENTIDAD_NO_EXISTE: El proveedor/inversionista no existe o está inactivo
--   - CXP_COMISIONISTA_NO_IMPLEMENTADO: Tipo 3 (Comisionista) no implementado
--   - CXP_TIPO_PROVEEDOR_INVALIDO: tipoProveedor fuera de rango
--
--[Consideraciones]:
--   - Función de tipo SECURITY DEFINER (ejecuta con permisos del propietario)
--   - Genera logs informativos con RAISE NOTICE para debugging
--   - Manejo completo de excepciones con mensajes específicos
--   - No permite operaciones si la validación falla

CREATE OR REPLACE FUNCTION public.cxp_validar_y_actualizar_proveedor()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    nombre_encontrado TEXT := NULL;
    tipo_entidad TEXT := '';
BEGIN
    -- [Fecha y Hora]: 29/10/2025 23:15:45
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
        RAISE EXCEPTION 'CXP_TIPO_PROVEEDOR_REQUERIDO: El campo tipoProveedor es obligatorio. Valores permitidos: 1=Proveedor, 2=Inversionista, 3=Comisionista' 
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
$function$;