--[Fecha y Hora]: 20/11/2025 21:51:03
--[Descripción]: Script de prueba para la función cxp_aprobados_sin_pago_aplicado
--                Verifica el funcionamiento correcto de la actualización masiva de estatus
--                de registros aprobados sin pago aplicado con retorno compuesto

-- =====================================================
-- PRUEBA 1: Verificar función con datos reales
-- =====================================================

-- Contar registros con idEstado = 4 (Aprobados) y montoAplicado = 0 antes de la actualización
SELECT 
    COUNT(*) as registros_antes,
    "numMes",
    "numAnio"
FROM public.cxp 
WHERE "idEstado" = 4
  AND "montoAplicado" = 0
GROUP BY "numMes", "numAnio"
ORDER BY "numAnio", "numMes";

-- Probar la función con un mes y año específicos (ej: noviembre 2024)
SELECT cxp_aprobados_sin_pago_aplicado(11, 2024) AS (estatus boolean, mensaje text, registros_afectados integer);

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

-- Verificar que no queden registros con idEstado = 4 y montoAplicado = 0 para el período actualizado
SELECT COUNT(*) as registros_no_actualizados
FROM public.cxp 
WHERE "idEstado" = 4
  AND "montoAplicado" = 0
  AND "numMes" = 11
  AND "numAnio" = 2024;

-- =====================================================
-- PRUEBA 3: Probar validaciones
-- =====================================================

-- Probar con mes inválido (debería dar error)
-- SELECT * FROM cxp_aprobados_sin_pago_aplicado(13, 2024) AS (estatus boolean, mensaje text, registros_afectados integer);

-- Probar con año inválido (debería dar error)
-- SELECT * FROM cxp_aprobados_sin_pago_aplicado(11, 1999) AS (estatus boolean, mensaje text, registros_afectados integer);

-- Probar con mes en curso (debería dar error)
-- SELECT * FROM cxp_aprobados_sin_pago_aplicado(EXTRACT(MONTH FROM CURRENT_DATE)::integer, 
--                                       EXTRACT(YEAR FROM CURRENT_DATE)::integer) AS (estatus boolean, mensaje text, registros_afectados integer);

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
     'Registro de prueba aprobado sin pago', 'TEST_CFDI', 4, false, false, false, 'MXN', 1, false),
    ('TEST_002', NOW(), true, gen_random_uuid(), 'PROV_TEST', 1, 
     'Proveedor Test', CURRENT_DATE, 'TEST002', 'CAT_TEST', 
     2000.00, 2320.00, 0.00, 45, 2024, 11, 
     'Registro de prueba aprobado sin pago', 'TEST_CFDI', 4, false, false, false, 'MXN', 1, false),
    ('TEST_003', NOW(), true, gen_random_uuid(), 'PROV_TEST', 1, 
     'Proveedor Test', CURRENT_DATE, 'TEST003', 'CAT_TEST', 
     1500.00, 1740.00, 500.00, 45, 2024, 11, 
     'Registro de prueba aprobado con pago parcial', 'TEST_CFDI', 4, false, false, false, 'MXN', 1, false);

-- Probar la función con los datos de prueba
SELECT * FROM cxp_aprobados_sin_pago_aplicado(11, 2024) AS (estatus boolean, mensaje text, registros_afectados integer);

-- Verificar resultados
SELECT "idCxp", "idEstado", "montoAplicado", "numMes", "numAnio"
FROM public.cxp 
WHERE "idCxp" LIKE 'TEST_%'
ORDER BY "idCxp";

-- Limpiar datos de prueba
DELETE FROM public.cxp WHERE "idCxp" LIKE 'TEST_%';
*/

-- =====================================================
-- PRUEBA 5: Verificar registro de actividad
-- =====================================================

-- Verificar que se registró la actividad en la tabla actividad
SELECT 
    fc,
    uid,
    correo,
    pantalla,
    widget,
    nomwidget,
    comentario
FROM public.actividad 
WHERE pantalla = 'cxp_actualizacion_masiva'
  AND nomwidget = 'cxp_aprobados_sin_pago_aplicado'
ORDER BY fc DESC
LIMIT 5;

-- =====================================================
-- PRUEBA 6: Verificar tipos de retorno
-- =====================================================

-- Probar diferentes escenarios para verificar el tipo compuesto
SELECT 
    CASE 
        WHEN estatus THEN '✅ ÉXITO'
        ELSE '❌ ERROR'
    END as resultado,
    mensaje,
    registros_afectados
FROM (
    SELECT * FROM cxp_aprobados_sin_pago_aplicado(11, 2024) AS (estatus boolean, mensaje text, registros_afectados integer)
) AS prueba;

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

-- Verificar específicamente los registros con montoAplicado = 0 por estatus
SELECT 
    "idEstado",
    COUNT(*) as cantidad_sin_pago,
    SUM("total") as total_sin_pago
FROM public.cxp 
WHERE "montoAplicado" = 0
GROUP BY "idEstado"
ORDER BY "idEstado";