--[Fecha y Hora]: 29/10/2025 23:12:55
--[Descripción]: Obtiene datos únicos para filtros dependientes en CXP
--
--[Parámetros]:
--   - p_proveedor (text): Filtro por proveedor para obtener categorías/secciones relacionadas (opcional)
--   - p_categoria (text): Filtro por categoría para obtener secciones relacionadas (opcional)
--   - p_seccion (text): Filtro por sección para obtener proveedores relacionados (opcional)
--
--[Salida]:
--   - TABLE: Tabla con valores únicos filtrados:
--     * proveedor: Nombre o razón social del proveedor
--     * categoria: Descripción de la categoría
--     * seccion: Nombre de la sección/departamento
--     * anio: Año de la solicitud
--
--[Uso típico]: Se utiliza para poblar filtros dinámicos en interfaces de usuario
--               donde las opciones dependen de selecciones previas
--
--[Ejemplo]: 
--   -- Obtener categorías y secciones de un proveedor específico
--   SELECT * FROM cxp_get_filtros_dependientes('PROVEEDOR XYZ', NULL, NULL);
--   
--   -- Obtener secciones de una categoría específica
--   SELECT * FROM cxp_get_filtros_dependientes(NULL, 'Mantenimiento', NULL);
--
--[Relaciones]: 
--   - Tabla principal: cxp
--   - Tabla: catProveedores (para razón social)
--   - Tabla: PresCategorias (para descripción y sección) - TABLA CORRECTA
--
--[Validaciones]:
--   - Todos los parámetros son opcionales (pueden ser NULL)
--   - Filtra solo registros con status = true
--   - Usa ILIKE para búsquedas parciales insensibles a mayúsculas/minúsculas
--
--[Lógica de filtrado]:
--   - Si se especifica p_proveedor: retorna categorías y secciones asociadas a ese proveedor
--   - Si se especifica p_categoria: retorna secciones asociadas a esa categoría
--   - Si se especifica p_seccion: retorna proveedores asociados a esa sección
--   - Si todos son NULL: retorna todas las combinaciones únicas
--
--[Ordenamiento]:
--   - Primario: proveedor (alfabético)
--   - Secundario: categoria (alfabético)
--   - Terciario: seccion (alfabético)
--   - Final: anio DESC (más reciente primero)
--
--[Consideraciones]:
--   - Función optimizada para filtros dinámicos en UI
--   - Usa DISTINCT para evitar duplicados
--   - Retorna datos únicos para cada combinación

CREATE OR REPLACE FUNCTION public.cxp_get_filtros_dependientes(
    p_proveedor text DEFAULT NULL::text, 
    p_categoria text DEFAULT NULL::text, 
    p_seccion text DEFAULT NULL::text
)
 RETURNS TABLE(
    proveedor text, 
    categoria text, 
    seccion text, 
    anio integer
)
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $function$
BEGIN
    -- [Fecha y Hora]: 29/10/2025 23:12:55
    -- [Descripción]: Obtiene datos únicos para filtros dependientes en CXP
    -- [Parámetros]:
    --   p_proveedor (TEXT) - Filtro por proveedor para obtener categorías/secciones relacionadas
    --   p_categoria (TEXT) - Filtro por categoría para obtener secciones relacionadas
    --   p_seccion (TEXT) - Filtro por sección para obtener proveedores relacionados
    -- [Retorna]: TABLE con valores únicos filtrados
    -- [Uso]: SELECT * FROM cxp_get_filtros_dependientes('PROVEEDOR XYZ', null, null);
    
    RETURN QUERY
    SELECT DISTINCT
        COALESCE(p."razonSocial", c."nombreProveedor")::TEXT as proveedor,
        cat.descripcion::TEXT as categoria,
        cat.seccion::TEXT,
        EXTRACT(year FROM c."fecSolicitud")::INTEGER as anio
    FROM cxp c
    LEFT JOIN "catProveedores" p ON c."idProveedor" = p."idProveedor"
    LEFT JOIN "PresCategorias" cat ON c."idCategoria" = cat."idCategoria"  -- TABLA CORRECTA
    WHERE c.status = true
    -- Aplicar filtros para obtener datos relacionados
    AND (p_proveedor IS NULL OR COALESCE(p."razonSocial", c."nombreProveedor") ILIKE '%' || p_proveedor || '%')
    AND (p_categoria IS NULL OR cat.descripcion ILIKE '%' || p_categoria || '%')
    AND (p_seccion IS NULL OR cat.seccion ILIKE '%' || p_seccion || '%')
    ORDER BY proveedor, categoria, seccion, anio DESC;
END;
$function$;