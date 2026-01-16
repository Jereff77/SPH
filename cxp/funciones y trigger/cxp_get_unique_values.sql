--[Fecha y Hora]: 29/10/2025 23:13:15
--[Descripción]: Obtiene valores únicos para los filtros del reporte CXP
--
--[Parámetros]:
--   - tipo_dato (integer): Tipo de dato a obtener:
--     * 1 = Proveedores (razonSocial)
--     * 2 = Categorías (descripcion)
--     * 3 = Secciones (seccion)
--     * 4 = Años (extraído de fecSolicitud)
--     * 5 = Usuarios solicitantes
--     * 6 = Usuarios autorizadores
--     * 7 = Usuarios pagadores
--
--[Salida]:
--   - TABLE: Tabla con columna valor (TEXT) conteniendo los valores únicos
--
--[Uso típico]: Se utiliza para poblar listas desplegables (dropdowns) 
--               en interfaces de usuario para filtros de reportes
--
--[Ejemplos]:
--   -- Obtener todos los proveedores únicos
--   SELECT * FROM cxp_get_unique_values(1);
--   
--   -- Obtener todas las categorías únicas
--   SELECT * FROM cxp_get_unique_values(2);
--   
--   -- Obtener todos los años disponibles
--   SELECT * FROM cxp_get_unique_values(4);
--
--[Relaciones]: 
--   - Tabla principal: cxp
--   - Tabla: catProveedores (para tipo_dato = 1)
--   - Tabla: PresCategorias (para tipo_dato = 2, 3) - TABLA CORRECTA
--   - Tabla: catUsers (para tipo_dato = 5, 6, 7)
--
--[Validaciones]:
--   - Filtra solo registros con status = true
--   - Excluye valores nulos o vacíos
--   - Usa INNER JOIN para garantizar existencia de registros relacionados
--
--[Tipos de datos detallados]:
--   1. Proveedores: Obtiene razón social de catProveedores
--   2. Categorías: Obtiene descripción de PresCategorias - TABLA CORRECTA
--   3. Secciones: Obtiene campo seccion de PresCategorias - TABLA CORRECTA
--   4. Años: Extrae año de fecSolicitud con EXTRACT()
--   5. Solicitantes: Concatena nombre y apellidos de catUsers (uidr)
--   6. Autorizadores: Concatena nombre y apellidos de catUsers (autorizo)
--   7. Pagadores: Concatena nombre y apellidos de catUsers (pagador)
--
--[Ordenamiento]:
--   - Textos: Orden alfabético ASC
--   - Años: Orden descendente (más reciente primero)
--
--[Consideraciones]:
--   - Función optimizada para UI con consultas específicas por tipo
--   - Usa DISTINCT para evitar duplicados
--   - Formato consistente de salida (una columna 'valor')
--   - Concatena nombre y apellidos para usuarios

CREATE OR REPLACE FUNCTION public.cxp_get_unique_values(tipo_dato integer)
 RETURNS TABLE(valor text)
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $function$
BEGIN
    -- [Fecha y Hora]: 29/10/2025 23:13:15
    -- [Descripción]: Obtiene valores únicos para los filtros del reporte CXP
    -- [Parámetros]: 
    --   tipo_dato (INTEGER) - Tipo de dato a obtener:
    --     1 = Proveedores (razonSocial)
    --     2 = Categorías (descripcion)
    --     3 = Secciones (seccion)
    --     4 = Años (extraído de fecSolicitud)
    --     5 = Usuarios solicitantes
    --     6 = Usuarios autorizadores
    --     7 = Usuarios pagadores
    -- [Retorna]: TABLE con columna valor (TEXT)
    -- [Uso]: SELECT * FROM cxp_get_unique_values(1);
    
    IF tipo_dato = 1 THEN
        -- Proveedores únicos
        RETURN QUERY
        SELECT DISTINCT p."razonSocial"::TEXT as valor
        FROM cxp c
        INNER JOIN "catProveedores" p ON c."idProveedor" = p."idProveedor"
        WHERE c.status = true 
        AND p."razonSocial" IS NOT NULL 
        AND p."razonSocial" != ''
        ORDER BY valor;
        
    ELSIF tipo_dato = 2 THEN
        -- Categorías únicas - TABLA CORRECTA
        RETURN QUERY
        SELECT DISTINCT cat.descripcion::TEXT as valor
        FROM cxp c
        INNER JOIN "PresCategorias" cat ON c."idCategoria" = cat."idCategoria"  -- TABLA CORRECTA
        WHERE c.status = true
        AND cat.descripcion IS NOT NULL
        AND cat.descripcion != ''
        ORDER BY valor;
        
    ELSIF tipo_dato = 3 THEN
        -- Secciones únicas - TABLA CORRECTA
        RETURN QUERY
        SELECT DISTINCT cat.seccion::TEXT as valor
        FROM cxp c
        INNER JOIN "PresCategorias" cat ON c."idCategoria" = cat."idCategoria"  -- TABLA CORRECTA
        WHERE c.status = true
        AND cat.seccion IS NOT NULL
        AND cat.seccion != ''
        ORDER BY valor;
        
    ELSIF tipo_dato = 4 THEN
        -- Años únicos
        RETURN QUERY
        SELECT DISTINCT EXTRACT(year FROM c."fecSolicitud")::TEXT as valor
        FROM cxp c
        WHERE c.status = true 
        AND c."fecSolicitud" IS NOT NULL
        ORDER BY valor DESC;
        
    ELSIF tipo_dato = 5 THEN
        -- Usuarios solicitantes únicos
        RETURN QUERY
        SELECT DISTINCT (u.nombre || ' ' || u.apellidos)::TEXT as valor
        FROM cxp c
        INNER JOIN "catUsers" u ON c.uidr = u.uid
        WHERE c.status = true 
        AND u.nombre IS NOT NULL 
        AND u.apellidos IS NOT NULL
        ORDER BY valor;
        
    ELSIF tipo_dato = 6 THEN
        -- Usuarios autorizadores únicos
        RETURN QUERY
        SELECT DISTINCT (u.nombre || ' ' || u.apellidos)::TEXT as valor
        FROM cxp c
        INNER JOIN "catUsers" u ON c.autorizo = u.uid
        WHERE c.status = true 
        AND c.autorizo IS NOT NULL
        AND u.nombre IS NOT NULL 
        AND u.apellidos IS NOT NULL
        ORDER BY valor;
        
    ELSIF tipo_dato = 7 THEN
        -- Usuarios pagadores únicos
        RETURN QUERY
        SELECT DISTINCT (u.nombre || ' ' || u.apellidos)::TEXT as valor
        FROM cxp c
        INNER JOIN "catUsers" u ON c.pagador = u.uid
        WHERE c.status = true 
        AND c.pagador IS NOT NULL
        AND u.nombre IS NOT NULL 
        AND u.apellidos IS NOT NULL
        ORDER BY valor;
        
    END IF;
END;
$function$;