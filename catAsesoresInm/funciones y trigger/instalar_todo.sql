--[Fecha y Hora]: 24/10/2025 00:18:44
--[Descripción]: Script de instalación para todas las funciones y triggers de catAsesoresInm
--
--[Parámetros]: No aplica
--
--[Salida]: No aplica
--
--[Uso típico]: Ejecutar este script para instalar o actualizar todos los componentes
--               de la tabla catAsesoresInm
--
--[Ejemplo]: \i catAsesoresInm/funciones y trigger/instalar_todo.sql
--
--[Relaciones]: 
--   - catAsesoresInm/funciones y trigger/catasoresinm_validar_telefono.sql
--
--[Validaciones]:
--   - Verifica que las funciones se creen correctamente
--   - Muestra mensajes de confirmación para cada componente instalado

-- Iniciar transacción
BEGIN;

-- Mensaje de inicio
RAISE NOTICE '==================================================';
RAISE NOTICE 'Instalando funciones y triggers de catAsesoresInm';
RAISE NOTICE 'Fecha y Hora: 24/10/2025 00:18:44';
RAISE NOTICE '==================================================';

-- Instalar función de validación de teléfono
RAISE NOTICE 'Instalando función: catasoresinm_validar_telefono...';
\i catAsesoresInm/funciones y trigger/catasoresinm_validar_telefono.sql

-- Verificar instalación de funciones
RAISE NOTICE '';
RAISE NOTICE 'Verificando instalación de funciones...';

DO $$
DECLARE
    v_count integer;
BEGIN
    -- Verificar función catasesoresinm_validar_telefono
    SELECT COUNT(*) INTO v_count 
    FROM pg_proc 
    WHERE proname = 'catasesoresinm_validar_telefono';
    
    IF v_count > 0 THEN
        RAISE NOTICE '✓ Función catasesoresinm_validar_telefono instalada correctamente';
    ELSE
        RAISE NOTICE '✗ Error: Función catasesoresinm_validar_telefono no se instaló';
    END IF;
END $$;

-- Mensaje de finalización
RAISE NOTICE '';
RAISE NOTICE '==================================================';
RAISE NOTICE 'Instalación completada';
RAISE NOTICE 'Total de funciones instaladas: 1';
RAISE NOTICE 'Total de triggers instalados: 0';
RAISE NOTICE '==================================================';

-- Confirmar transacción
COMMIT;

-- Mensaje de éxito
RAISE NOTICE 'Todos los componentes de catAsesoresInm han sido instalados correctamente';