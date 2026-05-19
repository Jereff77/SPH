--[Fecha y Hora]: 15/05/2026 12:07:00
--[Descripción]: Script de instalación para todas las funciones y triggers del módulo CXP
--
--[Componentes instalados]:
--   - Funciones de gestión de fechas habilitadas
--   - Funciones de validación y permisos
--   - Funciones de consultas y reportes
--   - Funciones v2 corregidas (usando tablas correctas)
--   - Triggers de validación automática
--   - Función para actualizar nomCFDI cuando está vacío
--
--[Orden de instalación]:
--   1. Funciones de validación y permisos (sin dependencias)
--   2. Funciones de gestión de fechas
--   3. Funciones de consultas
--   4. Funciones v2 corregidas (recomendadas)
--   5. Funciones de actualización automática
--   6. Triggers (al final, dependen de funciones anteriores)
--
--[Verificación]: Al finalizar, muestra conteo de funciones instaladas
--
--[Actualización importante]: La función cxp_autorizar_solicitud_pago ha sido modificada
--   para comparar p_autorizo (UID del usuario que autoriza) con la configuración
--   "Aprobar fuera de presupuesto" en lugar de p_uidsolicita.
--
--[Nueva funcionalidad]: Se agregó función y trigger para actualizar automáticamente
--   el campo nomCFDI cuando está vacío después de insertar un registro.
--
--[CORRECCIÓN CRÍTICA]: Se agregaron funciones v2 que usan PresCategorias
--   en lugar de catCategorias (tabla que no existe). Estas funciones usan
--   SECURITY DEFINER para cumplir con políticas RLS.
--   [ACTUALIZACIÓN 14/11/2025]: Corregidas todas las referencias a
--   catCategorias por PresCategorias en funciones originales y v2.

-- Iniciar transacción para asegurar instalación atómica
BEGIN;

-- Mensaje de inicio
RAISE NOTICE '=== INICIANDO INSTALACIÓN DEL MÓDULO CXP ===';
RAISE NOTICE 'Fecha y hora: %', NOW();
RAISE NOTICE '';

-- Crear tipo compuesto para retorno de funciones
RAISE NOTICE 'Creando tipo compuesto para retorno de funciones...';
CREATE TYPE public.resultado_funcion AS (
    estatus boolean,           -- true=éxito, false=error
    mensaje text,              -- mensaje descriptivo del resultado
    registros_afectados integer  -- cantidad de registros actualizados
);

RAISE NOTICE '   → Tipo resultado_funcion creado';
RAISE NOTICE '';

-- 1. Funciones de validación y permisos (sin dependencias)
RAISE NOTICE '1. Instalando funciones de validación y permisos...';

-- Función para validar si se puede insertar
\i cxp_puede_insertar.sql

-- Función para validar si se puede autorizar
\i cxp_puede_autorizar.sql

-- Función para autorizar solicitudes de pago con validación de presupuesto
\i cxp_autorizar_solicitud_pago.sql

-- Función para validar proveedores
\i cxp_probar_validacion_proveedor.sql

-- Función para validar fechas habilitadas
\i cxp_validar_fecha_habilitada.sql

RAISE NOTICE '   → Funciones de validación instaladas: 5';

-- 2. Funciones de gestión de fechas
RAISE NOTICE '2. Instalando funciones de gestión de fechas...';

-- Función para agregar fechas manualmente
\i cxp_agregar_fecha_manual.sql

-- Función para generar calendario anual
\i cxp_fechas_habilitadas_anual.sql

-- Función trigger para actualizar día de la semana
\i cxp_fechas_habilitadas_actualizar_dia_semana.sql

RAISE NOTICE '   → Funciones de fechas instaladas: 3';

-- 3. Funciones de consultas y reportes
RAISE NOTICE '3. Instalando funciones de consultas y reportes...';

-- Función para obtener estado de cuenta detallado
\i cxp_get_estado_cuenta_detalle.sql

-- Función para obtener filtros dependientes
\i cxp_get_filtros_dependientes.sql

-- Función para obtener valores únicos
\i cxp_get_unique_values.sql

RAISE NOTICE '   → Funciones de consultas instaladas: 3';

-- 4. Funciones v2 corregidas (recomendadas)
RAISE NOTICE '4. Instalando funciones v2 corregidas (tablas correctas)...';

-- Función v2 para obtener estado de cuenta detallado (usa PresCategorias)
\i cxp_get_estado_cuenta_detalle_v2.sql

-- Función v2 para obtener filtros dependientes (usa PresCategorias)
\i cxp_get_filtros_dependientes_v2.sql

-- Función v2 para obtener valores únicos (usa PresCategorias)
\i cxp_get_unique_values_v2.sql

RAISE NOTICE '   → Funciones v2 corregidas instaladas: 3';
RAISE NOTICE '   → NOTA: Se recomienda usar las funciones v2 para evitar errores';

-- 5. Funciones de actualización automática
RAISE NOTICE '5. Instalando funciones de actualización automática...';

-- Función para actualizar nomCFDI cuando está vacío
\i cxp_actualizar_nomcfdi_vacio.sql

-- Función para actualizar estatus de aprobados sin pago aplicado
\i cxp_aprobados_sin_pago_aplicado.sql

-- Función trigger para actualizar uidGerente y nomGerente según idCategoria
\i cxp_actualizar_gerente.sql

RAISE NOTICE '   → Funciones de actualización automática instaladas: 3';

-- 6. Triggers (al final, dependen de funciones anteriores)
RAISE NOTICE '6. Instalando triggers...';

-- Trigger para validar operaciones en tabla cxp
\i cxp_trigger_validar_fecha.sql

-- Trigger para validar y actualizar proveedores
\i cxp_validar_y_actualizar_proveedor.sql

-- Trigger para actualizar nomCFDI cuando está vacío
\i trigger_cxp_actualizar_nomcfdi.sql

-- Trigger para actualizar uidGerente y nomGerente según idCategoria
\i trigger_cxp_actualizar_gerente.sql

RAISE NOTICE '   → Triggers instalados: 4';

-- Crear trigger para actualizar día de la semana en fechas habilitadas
-- Nota: Este trigger se crea aquí porque depende de la función de actualización
RAISE NOTICE '6. Creando trigger para actualización automática de día de semana...';

CREATE TRIGGER trigger_cxp_fechas_habilitadas_dia_semana
BEFORE INSERT OR UPDATE ON public.cxp_fechas_habilitadas
FOR EACH ROW
EXECUTE FUNCTION public.cxp_fechas_habilitadas_actualizar_dia_semana();

RAISE NOTICE '   → Trigger para día de semana creado';

-- Verificación final de instalación
RAISE NOTICE '';
RAISE NOTICE '=== VERIFICACIÓN DE INSTALACIÓN ===';
RAISE NOTICE 'Contando funciones CXP instaladas...';

SELECT 
    COUNT(*) as total_funciones,
    ARRAY_AGG(routine_name ORDER BY routine_name) as funciones_instaladas
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE 'cxp_%'
AND routine_type = 'FUNCTION';

RAISE NOTICE 'Funciones CXP instaladas: %', 
    (SELECT COUNT(*) FROM information_schema.routines 
     WHERE routine_schema = 'public' 
     AND routine_name LIKE 'cxp_%'
     AND routine_type = 'FUNCTION');

RAISE NOTICE '=== INSTALACIÓN DEL MÓDULO CXP COMPLETADA ===';
RAISE NOTICE 'Total de funciones instaladas: %',
    (SELECT COUNT(*) FROM information_schema.routines
     WHERE routine_schema = 'public'
     AND routine_name LIKE 'cxp_%'
     AND routine_type = 'FUNCTION');

-- Confirmar transacción
COMMIT;

-- Mensaje final
RAISE NOTICE '';
RAISE NOTICE 'Para verificar la instalación, ejecute:';
RAISE NOTICE 'SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = ''public'' AND routine_name LIKE ''cxp_%'' AND routine_type = ''FUNCTION'';';
RAISE NOTICE '';
RAISE NOTICE '=== RECOMENDACIONES DE USO ===';
RAISE NOTICE '1. Use funciones v2 para reportes (evitan errores de tablas inexistentes):';
RAISE NOTICE '   - cxp_get_estado_cuenta_detalle_v2()';
RAISE NOTICE '   - cxp_get_unique_values_v2()';
RAISE NOTICE '   - cxp_get_filtros_dependientes_v2()';
RAISE NOTICE '';
RAISE NOTICE '2. Para el reporte web, use:';
RAISE NOTICE '   cxp/reportes/reporte_cxp.html';
RAISE NOTICE '';
RAISE NOTICE '3. Las funciones v2 usan SECURITY DEFINER para cumplir con RLS';
RAISE NOTICE '';