--[Fecha y Hora]: 29/10/2025 23:12:20
--[Descripción]: Obtiene el estado de cuenta detallado de CXP con múltiples filtros
--
--[Parámetros]:
--   - p_anio (integer): Filtro por año de solicitud (opcional)
--   - p_mes (integer): Filtro por mes de solicitud (opcional)
--   - p_proveedor (text): Filtro por nombre/razón social del proveedor (opcional)
--   - p_categoria (text): Filtro por descripción de categoría (opcional)
--   - p_seccion (text): Filtro por sección/departamento (opcional)
--   - p_estado (text): Filtro por estado del pago (opcional)
--   - p_quien_solicito (text): Filtro por usuario que solicitó (opcional)
--   - p_quien_autorizo (text): Filtro por usuario que autorizó (opcional)
--   - p_quien_pago (text): Filtro por usuario que pagó (opcional)
--   - p_tipo_proveedor (integer): Filtro por tipo de proveedor (opcional)
--   - p_urgente (boolean): Filtro por urgente/no urgente (opcional)
--
--[Salida]:
--   - TABLE: Tabla con detalles completos de CXP incluyendo:
--     * idCxp, folio, proveedor, estado, idEstado
--     * categoria, seccion, concepto
--     * fecSolicitud, fecCFDI, fecPago
--     * subtotal, total, montoAplicado, balance
--     * quienSolicito, quienAutorizo, quienPago
--     * esUrgente, tipoProveedor, anio, mes
--
--[Uso típico]: Se utiliza para generar reportes y consultas del estado de cuenta
--               de Cuentas por Pagar con filtros flexibles
--
--[Ejemplo]: SELECT * FROM cxp_get_estado_cuenta_detalle(2025, 8, NULL, 'Mantenimiento', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
--
--[Relaciones]: 
--   - Tabla principal: cxp
--   - Tabla: catProveedores (para datos del proveedor)
--   - Tabla: PresCategorias (para datos de categoría) - TABLA CORRECTA
--   - Tabla: catUsers (para datos de usuarios solicitantes, autorizadores y pagadores)
--
--[Validaciones]:
--   - Todos los parámetros son opcionales (pueden ser NULL)
--   - Filtra solo registros con status = true
--   - Usa ILIKE para búsquedas parciales insensibles a mayúsculas/minúsculas
--
--[Consideraciones de seguridad]:
--   - Función de tipo SECURITY DEFINER (ejecuta con permisos del propietario)
--   - Permite acceso a datos de múltiples tablas relacionadas
--
--[Ordenamiento]:
--   - Orden primario: fecSolicitud DESC
--   - Orden secundario: fc DESC (fecha de creación)
--
--[Cálculos incluidos]:
--   - balance = total - montoAplicado
--   - anio = EXTRACT(year FROM fecSolicitud)
--   - mes = EXTRACT(month FROM fecSolicitud)
--
--[Joins realizados]:
--   - LEFT JOIN con catProveedores para obtener razón social
--   - LEFT JOIN con PresCategorias para descripción y sección - TABLA CORRECTA
--   - LEFT JOIN con catUsers (3 veces) para nombres de usuarios involucrados

CREATE OR REPLACE FUNCTION public.cxp_get_estado_cuenta_detalle(
    p_anio integer DEFAULT NULL::integer, 
    p_mes integer DEFAULT NULL::integer, 
    p_proveedor text DEFAULT NULL::text, 
    p_categoria text DEFAULT NULL::text, 
    p_seccion text DEFAULT NULL::text, 
    p_estado text DEFAULT NULL::text, 
    p_quien_solicito text DEFAULT NULL::text, 
    p_quien_autorizo text DEFAULT NULL::text, 
    p_quien_pago text DEFAULT NULL::text, 
    p_tipo_proveedor integer DEFAULT NULL::integer, 
    p_urgente boolean DEFAULT NULL::boolean
)
 RETURNS TABLE(
    "idCxp" text, 
    folio text, 
    proveedor text, 
    estado text, 
    "idEstado" smallint, 
    categoria text, 
    seccion text, 
    concepto text, 
    "fecSolicitud" date, 
    "fecCFDI" date, 
    "fecPago" timestamp without time zone, 
    subtotal double precision, 
    total double precision, 
    "montoAplicado" double precision, 
    "quienSolicito" text, 
    "quienAutorizo" text, 
    "quienPago" text, 
    "esUrgente" boolean, 
    "tipoProveedor" integer, 
    anio integer, 
    mes integer, 
    balance double precision
)
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $function$
BEGIN
    -- [Fecha y Hora]: 29/10/2025 23:12:20
    -- [Descripción]: Obtiene el estado de cuenta detallado de CXP con filtros
    -- [Parámetros]:
    --   p_anio (INTEGER) - Filtro por año de solicitud
    --   p_mes (INTEGER) - Filtro por mes de solicitud
    --   p_proveedor (TEXT) - Filtro por nombre/razón social del proveedor
    --   p_categoria (TEXT) - Filtro por descripción de categoría
    --   p_seccion (TEXT) - Filtro por sección/departamento
    --   p_estado (TEXT) - Filtro por estado del pago
    --   p_quien_solicito (TEXT) - Filtro por usuario que solicitó
    --   p_quien_autorizo (TEXT) - Filtro por usuario que autorizó
    --   p_quien_pago (TEXT) - Filtro por usuario que pagó
    --   p_tipo_proveedor (INTEGER) - Filtro por tipo de proveedor
    --   p_urgente (BOOLEAN) - Filtro por urgente/no urgente
    -- [Retorna]: TABLE con detalles completos de CXP
    -- [Uso]: SELECT * FROM cxp_get_estado_cuenta_detalle(2025, 8);
    
    RETURN QUERY
    SELECT 
        c."idCxp"::TEXT,
        c.folio::TEXT,
        COALESCE(p."razonSocial", c."nombreProveedor")::TEXT as proveedor,
        c.estado::TEXT,
        c."idEstado"::SMALLINT,
        cat.descripcion::TEXT as categoria,
        cat.seccion::TEXT,
        c.concepto::TEXT,
        c."fecSolicitud"::DATE,
        c."fecCFDI"::DATE,
        c."fecPago"::TIMESTAMP,
        c.subtotal::DOUBLE PRECISION,
        c.total::DOUBLE PRECISION,
        c."montoAplicado"::DOUBLE PRECISION,
        (u1.nombre || ' ' || u1.apellidos)::TEXT as "quienSolicito",
        (u2.nombre || ' ' || u2.apellidos)::TEXT as "quienAutorizo",
        (u3.nombre || ' ' || u3.apellidos)::TEXT as "quienPago",
        c."esUrgente"::BOOLEAN,
        c."tipoProveedor"::INTEGER,
        EXTRACT(year FROM c."fecSolicitud")::INTEGER as anio,
        EXTRACT(month FROM c."fecSolicitud")::INTEGER as mes,
        (c.total - c."montoAplicado")::DOUBLE PRECISION as balance
    FROM cxp c
    LEFT JOIN "catProveedores" p ON c."idProveedor" = p."idProveedor"
    LEFT JOIN "PresCategorias" cat ON c."idCategoria" = cat."idCategoria"  -- TABLA CORRECTA
    LEFT JOIN "catUsers" u1 ON c.uidr = u1.uid
    LEFT JOIN "catUsers" u2 ON c.autorizo = u2.uid
    LEFT JOIN "catUsers" u3 ON c.pagador = u3.uid
    WHERE c.status = true
    -- Filtros aplicados dinámicamente
    AND (p_anio IS NULL OR EXTRACT(year FROM c."fecSolicitud") = p_anio)
    AND (p_mes IS NULL OR EXTRACT(month FROM c."fecSolicitud") = p_mes)
    AND (p_proveedor IS NULL OR COALESCE(p."razonSocial", c."nombreProveedor") ILIKE '%' || p_proveedor || '%')
    AND (p_categoria IS NULL OR cat.descripcion ILIKE '%' || p_categoria || '%')
    AND (p_seccion IS NULL OR cat.seccion ILIKE '%' || p_seccion || '%')
    AND (p_estado IS NULL OR c.estado ILIKE '%' || p_estado || '%')
    AND (p_quien_solicito IS NULL OR (u1.nombre || ' ' || u1.apellidos) ILIKE '%' || p_quien_solicito || '%')
    AND (p_quien_autorizo IS NULL OR (u2.nombre || ' ' || u2.apellidos) ILIKE '%' || p_quien_autorizo || '%')
    AND (p_quien_pago IS NULL OR (u3.nombre || ' ' || u3.apellidos) ILIKE '%' || p_quien_pago || '%')
    AND (p_tipo_proveedor IS NULL OR c."tipoProveedor" = p_tipo_proveedor)
    AND (p_urgente IS NULL OR c."esUrgente" = p_urgente)
    ORDER BY c."fecSolicitud" DESC, c.fc DESC;
END;
$function$;