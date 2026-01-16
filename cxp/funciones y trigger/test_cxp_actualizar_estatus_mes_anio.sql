--[Fecha y Hora]: 20/11/2025 13:24:15
--[Descripción]: Script de prueba para la función cxp_actualizar_estatus_mes_anio
--                Verifica el funcionamiento correcto de la actualización masiva de estatus

-- =====================================================
-- PRUEBA 1: Verificar función con datos reales
-- =====================================================

-- Contar registros con idEstado = 2 antes de la actualización
SELECT 
    COUNT(*) as registros_antes,
    "numMes",
    "numAnio"
FROM public.cxp 
WHERE "idEstado" = 2
GROUP BY "numMes", "numAnio"
ORDER BY "numAnio", "numMes";

-- Probar la función con un mes y año específicos (ej: noviembre 2024)
SELECT cxp_actualizar_estatus_mes_anio(11, 2024) as registros_actualizados;

-- Verificar que los registros se actualizaron correctamente
SELECT 
    COUNT(*) as registros_despues,
    "numMes",
    "numAnio"
FROM public.cxp 
WHERE "idEstado" = 99
GROUP BY "numMes", "numAnio"
ORDER BY "numAnio", "numMes";

-- =====================================================
-- PRUEBA 2: Verificar que solo se actualizaron los registros correctos
-- =====================================================

-- Verificar que no queden registros con idEstado = 2 para el período actualizado
SELECT COUNT(*) as registros_no_actualizados
FROM public.cxp 
WHERE "idEstado" = 2
  AND "numMes" = 11
  AND "numAnio" = 2024;

-- =====================================================
-- PRUEBA 3: Probar validaciones
-- =====================================================

-- Probar con mes inválido (debería dar error)
-- SELECT cxp_actualizar_estatus_mes_anio(13, 2024);

-- Probar con año inválido (debería dar error)
-- SELECT cxp_actualizar_estatus_mes_anio(11, 1999);

-- Probar con mes en curso (debería dar error)
-- Nota: Esta prueba fallará intencionalmente para demostrar la restricción
-- SELECT cxp_actualizar_estatus_mes_anio(EXTRACT(MONTH FROM CURRENT_DATE)::integer,
--                                       EXTRACT(YEAR FROM CURRENT_DATE)::integer);

-- =====================================================
-- PRUEBA 4: Verificar con datos simulados (si no hay datos reales)
-- =====================================================

-- Si no hay registros para probar, podemos crear datos de prueba
-- (Descomentar solo si es necesario y se tienen permisos)
/*
-- Insertar datos de prueba
INSERT INTO public.cxp (
    "idCxp", fc, status, "uidr", "idProveedor", "tipoProveedor", 
    "nombreProveedor", "fecSolicitud", "folio", "idCategoria", 
    "subtotal", "total", "montoAplicado", "numSem", "numAnio", 
    "numMes", "ultimoComentario", "nomCFDI", "idEstado", 
    "esUrgente", "completada", "tdc", "moneda", "tipoOperacion", 
    "autorizadoFP"
) VALUES 
    ('TEST_001', NOW(), true, gen_random_uuid(), 'PROV_TEST', 1, 
     'Proveedor Test', CURRENT_DATE, 'TEST001', 'CAT_TEST', 
     1000.00, 1160.00, 0.00, 45, 2024, 11, 
     'Registro de prueba', 'TEST_CFDI', 2, false, false, false, 'MXN', 1, false),
    ('TEST_002', NOW(), true, gen_random_uuid(), 'PROV_TEST', 1, 
     'Proveedor Test', CURRENT_DATE, 'TEST002', 'CAT_TEST', 
     2000.00, 2320.00, 0.00, 45, 2024, 11, 
     'Registro de prueba', 'TEST_CFDI', 2, false, false, false, 'MXN', 1, false),
    ('TEST_003', NOW(), true, gen_random_uuid(), 'PROV_TEST', 1, 
     'Proveedor Test', CURRENT_DATE, 'TEST003', 'CAT_TEST', 
     1500.00, 1740.00, 0.00, 45, 2024, 10, 
     'Registro de prueba', 'TEST_CFDI', 2, false, false, false, 'MXN', 1, false);

-- Probar la función con los datos de prueba
SELECT cxp_actualizar_estatus_mes_anio(11, 2024) as registros_actualizados_prueba;

-- Verificar resultados
SELECT "idCxp", "idEstado", "numMes", "numAnio"
FROM public.cxp 
WHERE "idCxp" LIKE 'TEST_%'
ORDER BY "idCxp";

-- Limpiar datos de prueba
DELETE FROM public.cxp WHERE "idCxp" LIKE 'TEST_%';
*/

-- =====================================================
-- RESUMEN DE PRUEBA
-- =====================================================

-- Verificar estado final de los registros
SELECT 
    "idEstado",
    COUNT(*) as cantidad,
    MIN("numAnio") as anio_min,
    MAX("numAnio") as anio_max,
    MIN("numMes") as mes_min,
    MAX("numMes") as mes_max
FROM public.cxp 
GROUP BY "idEstado"
ORDER BY "idEstado";