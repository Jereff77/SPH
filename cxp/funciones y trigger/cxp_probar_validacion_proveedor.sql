--[Fecha y Hora]: 29/10/2025 23:13:40
--[Descripción]: Función de prueba para validar proveedores sin insertar en CXP
--
--[Parámetros]:
--   - p_tipo_proveedor (integer): Tipo de proveedor:
--     * 1 = Proveedor
--     * 2 = Inversionista
--     * 3 = Comisionista
--   - p_id_proveedor (text): ID del proveedor/inversionista a validar
--
--[Salida]:
--   - jsonb: Objeto JSON con resultado de la validación:
--     * exito: boolean
--     * codigo: código de resultado
--     * mensaje: mensaje descriptivo
--     * detalles: objeto con información del proveedor validado
--
--[Uso típico]: Se utiliza para validar proveedores antes de crear
--               registros CXP, evitando errores de referencias
--
--[Ejemplo]: SELECT cxp_probar_validacion_proveedor(1, 'PROV001');
--
--[Relaciones]: 
--   - Tabla: catProveedores (para tipo_proveedor = 1)
--   - Tabla: inversionista (para tipo_proveedor = 2)
--
--[Validaciones]:
--   - Verifica que tipo_proveedor no sea nulo
--   - Verifica que id_proveedor no sea nulo o vacío
--   - Valida que tipo_proveedor esté en el rango 1-3
--   - Verifica existencia del proveedor/inversionista
--   - Para proveedores: verifica status = true
--
--[Códigos de respuesta]:
--   - EXITO: Proveedor validado correctamente
--   - PARAMETRO_INVALIDO: Parámetros nulos o inválidos
--   - ENTIDAD_NO_EXISTE: El proveedor/inversionista no existe o está inactivo
--   - TIPO_NO_IMPLEMENTADO: Tipo 3 (Comisionista) no implementado aún
--   - ERROR_GENERAL: Error en la base de datos
--
--[Lógica de búsqueda]:
--   - Tipo 1: Busca en catProveedores por idProveedor
--   - Tipo 2: Busca en inversionista por idInversionista
--   - Tipo 3: Retorna error de no implementado
--
--[Consideraciones]:
--   - Función de tipo SECURITY DEFINER (ejecuta con permisos del propietario)
--   - Para inversionistas: prefiere razonsocial sobre nombre
--   - No realiza inserciones, solo validación
--   - Manejo completo de excepciones

CREATE OR REPLACE FUNCTION public.cxp_probar_validacion_proveedor(p_tipo_proveedor integer, p_id_proveedor text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    nombre_resultado TEXT := NULL;
    tipo_entidad TEXT := '';
BEGIN
    -- [Fecha y Hora]: 29/10/2025 23:13:40
    -- [Descripción]: Función de prueba para validar proveedores sin insertar en CXP
    -- [Parámetros]: 
    --   p_tipo_proveedor (INTEGER) - 1=Proveedor, 2=Inversionista, 3=Comisionista
    --   p_id_proveedor (TEXT) - ID del proveedor/inversionista a validar
    -- [Retorna]: JSONB con resultado de la validación
    -- [Uso]: SELECT cxp_probar_validacion_proveedor(1, 'PROV001');
    -- [Códigos]: EXITO, PARAMETRO_INVALIDO, ENTIDAD_NO_EXISTE, TIPO_NO_IMPLEMENTADO
    
    -- Validaciones básicas
    IF p_tipo_proveedor IS NULL THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PARAMETRO_INVALIDO',
            'mensaje', 'tipoProveedor es requerido'
        );
    END IF;

    IF p_id_proveedor IS NULL OR p_id_proveedor = '' THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PARAMETRO_INVALIDO',
            'mensaje', 'idProveedor es requerido'
        );
    END IF;

    -- Buscar según tipo
    CASE p_tipo_proveedor
        WHEN 1 THEN
            tipo_entidad := 'Proveedor';
            SELECT p."razonSocial" 
            INTO nombre_resultado
            FROM public."catProveedores" p 
            WHERE p."idProveedor" = p_id_proveedor AND p.status = true;
            
        WHEN 2 THEN
            tipo_entidad := 'Inversionista';
            SELECT COALESCE(i.razonsocial, i.nombre) 
            INTO nombre_resultado
            FROM public.inversionista i 
            WHERE i."idInversionista" = p_id_proveedor;
            
        WHEN 3 THEN
            RETURN jsonb_build_object(
                'exito', false,
                'codigo', 'TIPO_NO_IMPLEMENTADO',
                'mensaje', 'Comisionistas aún no implementados'
            );
            
        ELSE
            RETURN jsonb_build_object(
                'exito', false,
                'codigo', 'PARAMETRO_INVALIDO',
                'mensaje', 'tipoProveedor debe ser 1, 2 o 3. Recibido: ' || p_tipo_proveedor
            );
    END CASE;

    -- Verificar resultado
    IF nombre_resultado IS NULL THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'ENTIDAD_NO_EXISTE',
            'mensaje', tipo_entidad || ' con ID "' || p_id_proveedor || '" no existe o está inactivo'
        );
    END IF;

    -- Éxito
    RETURN jsonb_build_object(
        'exito', true,
        'codigo', 'EXITO',
        'mensaje', tipo_entidad || ' validado exitosamente',
        'detalles', jsonb_build_object(
            'tipo_entidad', tipo_entidad,
            'id', p_id_proveedor,
            'nombre', nombre_resultado
        )
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'ERROR_GENERAL',
            'mensaje', 'Error al validar: ' || SQLERRM
        );
END;
$function$;