--[Fecha y Hora]: 13/11/2025 23:58:30
--[Descripción]: Función DEFINER para generar datos de prueba para el reporte CXP
--
--[Parámetros]:
--   - p_cantidad (integer): Cantidad de registros a generar (opcional, default 50)
--
--[Salida]:
--   - TABLE: Datos de prueba para el reporte CXP con estructura similar a cxp_get_estado_cuenta_detalle
--
--[Uso típico]: Se utiliza para poblar el reporte con datos de prueba cuando no hay conexión a Supabase
--
--[Ejemplo]: SELECT * FROM cxp_reporte_datos_prueba(100);
--
--[Relaciones]:
--   - Simula la estructura de la tabla cxp con joins a catProveedores, PresCategorias y catUsers
--
--[Validaciones]:
--   - Genera datos aleatorios pero realistas
--   - Usa fechas del último año
--   - Distribuye estados de manera realista
--
--[Consideraciones de seguridad]:
--   - Función de tipo SECURITY DEFINER para acceso completo
--   - No requiere permisos especiales del usuario que ejecuta
--
--[Datos generados]:
--   - Folios secuenciales con formato realista
--   - Proveedores variados (incluyendo personas físicas y morales)
--   - Categorías comunes de gastos empresariales
--   - Montos realistas según categoría
--   - Estados distribuidos según flujo típico de CXP

CREATE OR REPLACE FUNCTION public.cxp_reporte_datos_prueba(
    p_cantidad integer DEFAULT 50
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
 SECURITY DEFINER
AS $function$
BEGIN
    -- [Fecha y Hora]: 13/11/2025 23:58:30
    -- [Descripción]: Genera datos de prueba realistas para el reporte CXP
    -- [Parámetros]: p_cantidad (INTEGER) - Cantidad de registros a generar
    -- [Retorna]: TABLE con datos de prueba para el reporte
    -- [Uso]: SELECT * FROM cxp_reporte_datos_prueba(100);
    
    RETURN QUERY
    WITH 
    -- Generar secuencias de datos
    secuencia AS (
        SELECT generate_series(1, p_cantidad) AS id
    ),
    
    -- Datos de proveedores de prueba
    proveedores AS (
        SELECT * FROM (VALUES
            ('PROV-001', 'Constructora ABC SA de CV', 1),
            ('PROV-002', 'Servicios de Mantenimiento Integral', 1),
            ('PROV-003', 'Juan Pérez López', 1),
            ('PROV-004', 'Inmobiliaria del Norte SA', 1),
            ('PROV-005', 'María González Rodríguez', 2),
            ('PROV-006', 'Tech Solutions SA', 1),
            ('PROV-007', 'Carlos Hernández Martínez', 3),
            ('PROV-008', 'Suministros Industriales del Bajío', 1),
            ('PROV-009', 'Ana Silva Torres', 2),
            ('PROV-010', 'Servicios Profesionales Especializados', 1)
        ) AS p(id, razon_social, tipo)
    ),
    
    -- Categorías de gastos
    categorias AS (
        SELECT * FROM (VALUES
            ('Mantenimiento', 'Operaciones'),
            ('Construcción', 'Proyectos'),
            ('Servicios Profesionales', 'Administración'),
            ('Suministros', 'Compras'),
            ('Honorarios', 'Administración'),
            ('Seguros', 'Administración'),
            ('Impuestos', 'Administración'),
            ('Servicios Tecnológicos', 'TI'),
            ('Consultoría', 'Administración'),
            ('Marketing', 'Ventas'),
            ('Legal', 'Administración')
        ) AS c(categoria, seccion)
    ),
    
    -- Estados posibles y su distribución
    estados AS (
        SELECT * FROM (VALUES
            ('Guardado', 1, 0.15),
            ('Enviado', 2, 0.25),
            ('Rechazado', 3, 0.05),
            ('Aprobado', 4, 0.20),
            ('Reprogramado', 5, 0.10),
            ('Pagado', 6, 0.20),
            ('Pago T. Bancaria', 7, 0.05)
        ) AS e(estado, id_estado, probabilidad)
    ),
    
    -- Usuarios de prueba
    usuarios AS (
        SELECT * FROM (VALUES
            ('Carlos Rodríguez Mendoza'),
            ('Ana Patricia Silva Guzmán'),
            ('Luis Fernando Torres López'),
            ('María del Carmen González Pérez'),
            ('Juan Manuel Hernández Sánchez'),
            ('Patricia Morales Díaz')
        ) AS u(nombre_completo)
    )
    
    SELECT 
        'CXP-' || LPAD(s.id::TEXT, 6, '0') as "idCxp",
        'FOLIO-' || EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month') || '-' || LPAD(s.id::TEXT, 6, '0') as folio,
        p.razon_social as proveedor,
        e.estado as estado,
        e.id_estado as "idEstado",
        cat.categoria as categoria,
        cat.seccion as seccion,
        CASE cat.categoria
            WHEN 'Mantenimiento' THEN 'Mantenimiento preventivo de instalaciones'
            WHEN 'Construcción' THEN 'Obra civil en nave industrial'
            WHEN 'Servicios Profesionales' THEN 'Consultoría especializada'
            WHEN 'Suministros' THEN 'Compra de materiales y equipos'
            WHEN 'Honorarios' THEN 'Honorarios por servicios profesionales'
            WHEN 'Seguros' THEN 'Póliza de seguro anual'
            WHEN 'Impuestos' THEN 'Pago de impuestos prediales'
            WHEN 'Servicios Tecnológicos' THEN 'Implementación de sistema ERP'
            WHEN 'Consultoría' THEN 'Asesoría financiera'
            WHEN 'Marketing' THEN 'Campaña publicitaria Q4'
            WHEN 'Legal' THEN 'Honorarios legales'
            ELSE 'Servicios diversos'
        END as concepto,
        
        -- Fechas aleatorias realistas
        (CURRENT_DATE - INTERVAL '1 month') - (RANDOM() * 90 || ' days')::INTERVAL as "fecSolicitud",
        (CURRENT_DATE - INTERVAL '1 month') - (RANDOM() * 60 || ' days')::INTERVAL as "fecCFDI",
        CASE 
            WHEN e.id_estado IN (6, 7) THEN 
                (CURRENT_DATE - INTERVAL '1 month') - (RANDOM() * 30 || ' days')::INTERVAL + 
                (RANDOM() * 86400 || ' seconds')::INTERVAL
            ELSE NULL
        END as "fecPago",
        
        -- Montos realistas según categoría
        CASE cat.categoria
            WHEN 'Construcción' THEN 50000 + (RANDOM() * 150000)
            WHEN 'Mantenimiento' THEN 5000 + (RANDOM() * 20000)
            WHEN 'Servicios Profesionales' THEN 8000 + (RANDOM() * 25000)
            WHEN 'Suministros' THEN 10000 + (RANDOM() * 50000)
            WHEN 'Honorarios' THEN 15000 + (RANDOM() * 35000)
            WHEN 'Seguros' THEN 25000 + (RANDOM() * 75000)
            WHEN 'Impuestos' THEN 20000 + (RANDOM() * 80000)
            WHEN 'Servicios Tecnológicos' THEN 12000 + (RANDOM() * 40000)
            WHEN 'Consultoría' THEN 18000 + (RANDOM() * 30000)
            WHEN 'Marketing' THEN 8000 + (RANDOM() * 20000)
            WHEN 'Legal' THEN 22000 + (RANDOM() * 28000)
            ELSE 10000 + (RANDOM() * 25000)
        END * 0.8 as subtotal,
        
        CASE cat.categoria
            WHEN 'Construcción' THEN 50000 + (RANDOM() * 150000)
            WHEN 'Mantenimiento' THEN 5000 + (RANDOM() * 20000)
            WHEN 'Servicios Profesionales' THEN 8000 + (RANDOM() * 25000)
            WHEN 'Suministros' THEN 10000 + (RANDOM() * 50000)
            WHEN 'Honorarios' THEN 15000 + (RANDOM() * 35000)
            WHEN 'Seguros' THEN 25000 + (RANDOM() * 75000)
            WHEN 'Impuestos' THEN 20000 + (RANDOM() * 80000)
            WHEN 'Servicios Tecnológicos' THEN 12000 + (RANDOM() * 40000)
            WHEN 'Consultoría' THEN 18000 + (RANDOM() * 30000)
            WHEN 'Marketing' THEN 8000 + (RANDOM() * 20000)
            WHEN 'Legal' THEN 22000 + (RANDOM() * 28000)
            ELSE 10000 + (RANDOM() * 25000)
        END as total,
        
        CASE 
            WHEN e.id_estado IN (6, 7) THEN 
                CASE cat.categoria
                    WHEN 'Construcción' THEN 50000 + (RANDOM() * 150000)
                    WHEN 'Mantenimiento' THEN 5000 + (RANDOM() * 20000)
                    WHEN 'Servicios Profesionales' THEN 8000 + (RANDOM() * 25000)
                    WHEN 'Suministros' THEN 10000 + (RANDOM() * 50000)
                    WHEN 'Honorarios' THEN 15000 + (RANDOM() * 35000)
                    WHEN 'Seguros' THEN 25000 + (RANDOM() * 75000)
                    WHEN 'Impuestos' THEN 20000 + (RANDOM() * 80000)
                    WHEN 'Servicios Tecnológicos' THEN 12000 + (RANDOM() * 40000)
                    WHEN 'Consultoría' THEN 18000 + (RANDOM() * 30000)
                    WHEN 'Marketing' THEN 8000 + (RANDOM() * 20000)
                    WHEN 'Legal' THEN 22000 + (RANDOM() * 28000)
                    ELSE 10000 + (RANDOM() * 25000)
                END
            ELSE 0
        END as "montoAplicado",
        
        (SELECT nombre_completo FROM usuarios ORDER BY RANDOM() LIMIT 1) as "quienSolicito",
        CASE 
            WHEN e.id_estado IN (4, 5, 6, 7) THEN (SELECT nombre_completo FROM usuarios ORDER BY RANDOM() LIMIT 1)
            ELSE NULL
        END as "quienAutorizo",
        CASE 
            WHEN e.id_estado IN (6, 7) THEN (SELECT nombre_completo FROM usuarios ORDER BY RANDOM() LIMIT 1)
            ELSE NULL
        END as "quienPago",
        
        RANDOM() > 0.8 as "esUrgente",
        p.tipo as "tipoProveedor",
        EXTRACT(YEAR FROM (CURRENT_DATE - INTERVAL '1 month') - (RANDOM() * 90 || ' days')::INTERVAL) as anio,
        EXTRACT(MONTH FROM (CURRENT_DATE - INTERVAL '1 month') - (RANDOM() * 90 || ' days')::INTERVAL) as mes,
        
        -- Balance calculado
        CASE 
            WHEN e.id_estado IN (6, 7) THEN 0
            ELSE 
                CASE cat.categoria
                    WHEN 'Construcción' THEN 50000 + (RANDOM() * 150000)
                    WHEN 'Mantenimiento' THEN 5000 + (RANDOM() * 20000)
                    WHEN 'Servicios Profesionales' THEN 8000 + (RANDOM() * 25000)
                    WHEN 'Suministros' THEN 10000 + (RANDOM() * 50000)
                    WHEN 'Honorarios' THEN 15000 + (RANDOM() * 35000)
                    WHEN 'Seguros' THEN 25000 + (RANDOM() * 75000)
                    WHEN 'Impuestos' THEN 20000 + (RANDOM() * 80000)
                    WHEN 'Servicios Tecnológicos' THEN 12000 + (RANDOM() * 40000)
                    WHEN 'Consultoría' THEN 18000 + (RANDOM() * 30000)
                    WHEN 'Marketing' THEN 8000 + (RANDOM() * 20000)
                    WHEN 'Legal' THEN 22000 + (RANDOM() * 28000)
                    ELSE 10000 + (RANDOM() * 25000)
                END
        END as balance
        
    FROM secuencia s
    CROSS JOIN LATERAL (
        SELECT * FROM proveedores ORDER BY RANDOM() LIMIT 1
    ) p
    CROSS JOIN LATERAL (
        SELECT * FROM categorias ORDER BY RANDOM() LIMIT 1
    ) cat
    CROSS JOIN LATERAL (
        SELECT * FROM estados 
        ORDER BY RANDOM() 
        LIMIT 1
    ) e
    ORDER BY s.id;
END;
$function$;