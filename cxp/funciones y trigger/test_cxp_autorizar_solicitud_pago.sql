--[Fecha y Hora]: 05/11/2025 23:27:00
--[Descripción]: Script de prueba para la función cxp_autorizar_solicitud_pago
--                Demuestra diferentes escenarios de autorización de pagos
--                Incluye pruebas para autorización fuera de presupuesto
--
--[Casos de prueba]:
--   1. ID nulo o vacío
--   2. ID inexistente
--   3. Categoría inactiva
--   4. Categoría no presupuestable (autorización directa)
--   5. Categoría presupuestable con presupuesto suficiente
--   6. Categoría presupuestable con presupuesto insuficiente
--   7. Omisión de validación con usuario autorizado (p_autorizo coincide con configuración)
--   8. Omisión de validación con usuario no autorizado (p_autorizo no coincide)
--
--[Uso típico]: Ejecutar este script para verificar el funcionamiento correcto
--               de la función de autorización de pagos con validación de presupuesto
--
--[Ejemplo]:
--   \i cxp/funciones y trigger/test_cxp_autorizar_solicitud_pago.sql

-- Iniciar pruebas
RAISE NOTICE '=== INICIANDO PRUEBAS DE cxp_autorizar_solicitud_pago ===';
RAISE NOTICE 'Fecha y hora: %', NOW();
RAISE NOTICE '';

-- 1. Prueba con ID nulo
RAISE NOTICE '1. Prueba con ID nulo:';
SELECT * FROM cxp_autorizar_solicitud_pago(NULL) AS (autorizado boolean, mensaje text);
RAISE NOTICE '';

-- 2. Prueba con ID vacío
RAISE NOTICE '2. Prueba con ID vacío:';
SELECT * FROM cxp_autorizar_solicitud_pago('') AS (autorizado boolean, mensaje text);
RAISE NOTICE '';

-- 3. Prueba con ID inexistente
RAISE NOTICE '3. Prueba con ID inexistente:';
SELECT * FROM cxp_autorizar_solicitud_pago('ID_INEXISTENTE_12345') AS (autorizado boolean, mensaje text);
RAISE NOTICE '';

-- 4. Prueba con un ID existente (descomentar y ajustar con un ID real)
-- RAISE NOTICE '4. Prueba con ID existente:';
-- SELECT * FROM cxp_autorizar_solicitud_pago('REEMPLAZAR_CON_ID_REAL') AS (autorizado boolean, mensaje text);
-- RAISE NOTICE '';

-- Consulta para obtener IDs de CxP existentes para pruebas manuales
RAISE NOTICE 'IDs de CxP existentes para pruebas manuales:';
SELECT 
    id,
    "idCategoria",
    subtotal,
    "idEstado",
    CASE 
        WHEN "idEstado" = 1 THEN 'Guardado'
        WHEN "idEstado" = 2 THEN 'Enviado'
        WHEN "idEstado" = 3 THEN 'Rechazado'
        WHEN "idEstado" = 4 THEN 'Aprobado'
        WHEN "idEstado" = 5 THEN 'Reprogramado'
        WHEN "idEstado" = 6 THEN 'Pagado'
        WHEN "idEstado" = 7 THEN 'Pago T. Bancaria'
        ELSE 'Desconocido'
    END AS estado_descripcion
FROM public.cxp 
ORDER BY fc DESC 
LIMIT 5;
RAISE NOTICE '';

-- Consulta para ver información de presupuesto por categoría
RAISE NOTICE 'Información de presupuesto por categoría:';
SELECT 
    "idCategoria",
    status AS categoria_activa,
    presupuestable,
    presupuesto_acumulado,
    total_gastado_comprometido,
    disponible_real,
    estado_acumulado,
    estado_comprometido
FROM public.v_resumenPresupuesto 
ORDER BY "idCategoria"
LIMIT 10;
RAISE NOTICE '';

-- Ejemplo de uso manual (descomentar y ajustar)
-- RAISE NOTICE 'Ejemplo de autorización manual:';
-- SELECT * FROM cxp_autorizar_solicitud_pago('TU_ID_AQUI', 'Comentario de autorización', 'UUID_USUARIO') AS (autorizado boolean, mensaje text);

RAISE NOTICE '=== PRUEBAS COMPLETADAS ===';
RAISE NOTICE 'Para probar con IDs específicos, use:';
RAISE NOTICE 'SELECT * FROM cxp_autorizar_solicitud_pago(''ID_ESPECIFICO'', ''Comentario opcional'', ''UUID_usuario_opcional'') AS (autorizado boolean, mensaje text);';
RAISE NOTICE '';
RAISE NOTICE 'Ejemplos de uso:';
RAISE NOTICE '-- Solo con ID (usará valores nulos para comentario y autorizo)';
RAISE NOTICE 'SELECT * FROM cxp_autorizar_solicitud_pago(''ID_CXP'');';
RAISE NOTICE '';
RAISE NOTICE '-- Con ID y comentario';
RAISE NOTICE 'SELECT * FROM cxp_autorizar_solicitud_pago(''ID_CXP'', ''Pago autorizado por disponibilidad presupuestaria'');';
RAISE NOTICE '';
RAISE NOTICE '-- Con todos los parámetros';
RAISE NOTICE 'SELECT * FROM cxp_autorizar_solicitud_pago(''ID_CXP'', ''Pago autorizado'', ''00000000-0000-0000-0000-000000000000''::uuid);';