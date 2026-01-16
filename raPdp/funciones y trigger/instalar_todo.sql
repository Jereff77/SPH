--[Fecha y Hora]: 17/12/2025 17:45:00
--[Descripción]: Script de instalación para todas las funciones y triggers de la tabla raPdp
--
--[Componentes a instalar]:
--   - rapdp_obtener_datos_propiedad.sql: Función para obtener datos de propiedad
--   - rapdp_Actualizar.sql: Función para actualizar campos comSPH e idRtaA en arrePdpDetalle
--                           (SOLO para registros con concepto = 'Renta')
--
--[Orden de instalación]:
--   1. Funciones principales
--   2. Triggers (si existieran)
--
--[Verificación final]: Se verificará que todos los componentes estén instalados correctamente
--
--[Notas de actualización]:
--   - 17/12/2025 17:03:25: Modificada función rapdp_Actualizar para filtrar por concepto='Renta'
--   - 17/12/2025 17:22:30: Corregidas validaciones en rapdp_Actualizar para verificar comSPH e idRtaA no nulos
--                      y separada validación de idNavArrend para mejor manejo de errores
--   - 17/12/2025 17:44:00: Agregado parámetro opcional p_actualizar_valores (boolean, default true)
--                      Cuando es false, establece idRtaA = null y comSPH = 0

-- Mensaje de inicio
RAISE NOTICE 'Iniciando instalación de funciones y triggers para raPdp...';

-- =================================================================
-- 1. INSTALACIÓN DE FUNCIONES PRINCIPALES
-- =================================================================

-- Función: rapdp_obtener_datos_propiedad
-- Obtiene los campos idNavArrend, comSPH y idRtaA para una propiedad específica
RAISE NOTICE 'Instalando función rapdp_obtener_datos_propiedad...';

-- Crear o reemplazar la función
CREATE OR REPLACE FUNCTION public.rapdp_obtener_datos_propiedad(p_idpropiedad text)
 RETURNS TABLE(
    "idNavArrend" text,
    "comSPH" text,
    "idRtaA" text
 )
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $BODY$
BEGIN
    -- Validar que el parámetro no sea nulo
    IF p_idpropiedad IS NULL THEN
        RAISE EXCEPTION 'El idPropiedad no puede ser nulo';
    END IF;
    
    -- Retornar la consulta con los joins necesarios
    RETURN QUERY
    SELECT 
        ap."idNavArrend",
        ra."comSPH",
        ra."idRtaA"
    FROM 
        "raPdp" ra
        LEFT JOIN propiedades p ON p."idPropiedad" = ra."idPropiedad"
        LEFT JOIN "arrenPropiedades" ap ON ap."idNave" = p."idNave"
    WHERE 
        p."idPropiedad" = p_idpropiedad;
        
    RETURN;
END;
$BODY$;

RAISE NOTICE 'Función rapdp_obtener_datos_propiedad instalada correctamente';

-- Función: rapdp_Actualizar
-- Actualiza los campos comSPH e idRtaA en arrePdpDetalle para una propiedad específica
-- SOLO para registros donde concepto = 'Renta'
RAISE NOTICE 'Instalando función rapdp_Actualizar (con filtro por concepto=Renta)...';

-- Crear o reemplazar la función
CREATE OR REPLACE FUNCTION public.rapdp_Actualizar(p_idpropiedad text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $BODY$
DECLARE
    v_idnavarrend text;
    v_comsph text;
    v_idrtaa text;
    v_idarrepdp text;
    v_registros_actualizados integer := 0;
    v_existe_ra_pdp boolean := false;
    v_existe_arre_pdp boolean := false;
BEGIN
    -- Validar que el parámetro no sea nulo
    IF p_idpropiedad IS NULL OR TRIM(p_idpropiedad) = '' THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'PARAMETRO_INVALIDO',
            'mensaje', 'El idPropiedad no puede ser nulo o vacío'
        );
    END IF;
    
    -- Paso 1: Obtener idNavArrend, comSPH y idRtaA desde raPdp
    SELECT
        ap."idNavArrend",
        ra."comSPH",
        ra."idRtaA"
    INTO
        v_idnavarrend,
        v_comsph,
        v_idrtaa
    FROM
        "raPdp" ra
        LEFT JOIN propiedades p ON p."idPropiedad" = ra."idPropiedad"
        LEFT JOIN "arrenPropiedades" ap ON ap."idNave" = p."idNave"
    WHERE
        p."idPropiedad" = p_idpropiedad
    LIMIT 1;
    
    -- Verificar si encontramos datos completos en raPdp
    IF v_comsph IS NULL OR v_idrtaa IS NULL THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'DATOS_INCOMPLETOS_RA_PDP',
            'mensaje', 'No se encontraron datos completos en raPdp (comSPH o idRtaA son nulos)',
            'detalles', jsonb_build_object(
                'idPropiedad', p_idpropiedad,
                'comSPH', v_comsph,
                'idRtaA', v_idrtaa
            )
        );
    END IF;
    
    -- Verificar si encontramos idNavArrend (para arrenPropiedades)
    IF v_idnavarrend IS NULL THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'SIN_DATOS_ARRENPROPIEDADES',
            'mensaje', 'No se encontró idNavArrend en arrenPropiedades para la propiedad especificada',
            'detalles', jsonb_build_object('idPropiedad', p_idpropiedad)
        );
    END IF;
    
    v_existe_ra_pdp := true;
    
    -- Paso 2: Buscar idArrePdp en arrePdp usando idNavArrend
    SELECT "idArrePdp"
    INTO v_idarrepdp
    FROM public."arrePdp"
    WHERE "idNavArrend" = v_idnavarrend
    ORDER BY "fecInicio" DESC
    LIMIT 1;
    
    -- Verificar si encontramos un plan activo
    IF v_idarrepdp IS NULL THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'SIN_PLAN_ACTIVO',
            'mensaje', 'No se encontró un plan activo en arrePdp para la nave especificada',
            'detalles', jsonb_build_object(
                'idPropiedad', p_idpropiedad,
                'idNavArrend', v_idnavarrend
            )
        );
    END IF;
    
    v_existe_arre_pdp := true;
    
    -- Paso 3: Actualizar arrePdpDetalle con los valores de comSPH y idRtaA
    -- Solo para registros donde concepto = 'Renta'
    UPDATE public."arrePdpDetalle"
    SET
        "comSPH" = v_comsph::real,
        "idRtaA" = v_idrtaa
    WHERE "idArrePdp" = v_idarrepdp
      AND concepto = 'Renta';
    
    GET DIAGNOSTICS v_registros_actualizados = ROW_COUNT;
    
    -- Retornar resultado exitoso
    RETURN jsonb_build_object(
        'exito', true,
        'codigo', 'EXITO',
        'mensaje', 'Actualización completada correctamente',
        'detalles', jsonb_build_object(
            'idPropiedad', p_idpropiedad,
            'idNavArrend', v_idnavarrend,
            'idArrePdp', v_idarrepdp,
            'comSPH', v_comsph,
            'idRtaA', v_idrtaa,
            'registros_actualizados', v_registros_actualizados,
            'existe_datos_ra_pdp', v_existe_ra_pdp,
            'existe_plan_activo', v_existe_arre_pdp,
            'timestamp', NOW()
        )
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'ERROR_GENERAL',
            'mensaje', 'Error interno: ' || SQLERRM,
            'detalles', jsonb_build_object(
                'sqlstate', SQLSTATE,
                'idPropiedad', p_idpropiedad
            )
        );
END;
$BODY$;

RAISE NOTICE 'Función rapdp_Actualizar instalada correctamente';

-- =================================================================
-- 2. INSTALACIÓN DE TRIGGERS (si existieran)
-- =================================================================

-- Actualmente no hay triggers para esta tabla
-- Esta sección se reservará para futuros triggers

-- =================================================================
-- 3. VERIFICACIÓN FINAL DE INSTALACIÓN
-- =================================================================

RAISE NOTICE 'Verificando instalación de componentes...';

-- Verificar función rapdp_obtener_datos_propiedad
DO $$
DECLARE
    v_func_count integer;
BEGIN
    SELECT COUNT(*) INTO v_func_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'rapdp_obtener_datos_propiedad';
    
    IF v_func_count > 0 THEN
        RAISE NOTICE '✓ Función rapdp_obtener_datos_propiedad verificada';
    ELSE
        RAISE EXCEPTION '✗ Error: Función rapdp_obtener_datos_propiedad no encontrada';
    END IF;
END $$;

-- Verificar función rapdp_Actualizar
DO $$
DECLARE
    v_func_count integer;
BEGIN
    SELECT COUNT(*) INTO v_func_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'rapdp_Actualizar';
    
    IF v_func_count > 0 THEN
        RAISE NOTICE '✓ Función rapdp_Actualizar verificada';
    ELSE
        RAISE EXCEPTION '✗ Error: Función rapdp_Actualizar no encontrada';
    END IF;
END $$;

-- =================================================================
-- 4. RESUMEN DE INSTALACIÓN
-- =================================================================

RAISE NOTICE '===========================================';
RAISE NOTICE 'RESUMEN DE INSTALACIÓN - raPdp';
RAISE NOTICE '===========================================';
RAISE NOTICE 'Funciones instaladas: 2';
RAISE NOTICE 'Triggers instalados: 0';
RAISE NOTICE 'Total componentes: 2';
RAISE NOTICE 'Estado: COMPLETADO';
RAISE NOTICE 'Fecha/Hora: 17/12/2025 17:45:00';
RAISE NOTICE '===========================================';

-- Mensaje final
RAISE NOTICE 'Instalación de funciones y triggers para raPdp completada exitosamente';

-- =================================================================
-- 5. NOTAS DE USO
-- =================================================================

/*
USO DE LAS FUNCIONES INSTALADAS:

1. Para obtener datos de una propiedad específica:
SELECT * FROM rapdp_obtener_datos_propiedad('ID_PROPIEDAD_AQUI');

Ejemplo práctico:
SELECT * FROM rapdp_obtener_datos_propiedad('ABcqzhvE8a3x');

La función retornará:
- idNavArrend: ID de la nave arrendada
- comSPH: Comisión SPH
- idRtaA: ID de respuesta A

Si no se encuentran resultados, la función retornará una tabla vacía.
Si el parámetro es nulo, lanzará una excepción.

2. Para actualizar campos comSPH e idRtaA en arrePdpDetalle:
SELECT * FROM rapdp_Actualizar('ID_PROPIEDAD_AQUI');

Ejemplo práctico:
SELECT * FROM rapdp_Actualizar('ABcqzhvE8a3x');

IMPORTANTE: La función solo actualizará registros donde concepto = 'Renta'

3. Para limpiar campos comSPH e idRtaA (establecer comSPH=0 y idRtaA=null):
SELECT * FROM rapdp_Actualizar('ID_PROPIEDAD_AQUI', false);

Ejemplo práctico:
SELECT * FROM rapdp_Actualizar('ABcqzhvE8a3x', false);

NOTAS ADICIONALES:
- La función ahora incluye validaciones mejoradas para verificar que comSPH e idRtaA no sean nulos (solo cuando p_actualizar_valores es true)
- Se separó la validación de idNavArrend para identificar específicamente problemas en arrenPropiedades
- Se agregaron nuevos códigos de error: DATOS_INCOMPLETOS_RA_PDP y SIN_DATOS_ARRENPROPIEDADES
- Se agregó parámetro opcional p_actualizar_valores (boolean, default true) para permitir limpiar los valores

La función retornará un objeto JSON con:
- exito: Indicador de éxito
- codigo: Código de resultado
- mensaje: Descripción del resultado
- detalles: Objeto con detalles de la operación incluyendo:
  - idPropiedad, idNavArrend, idArrePdp
  - comSPH, idRtaA (o valores predeterminados si se limpiaron)
  - actualizar_valores (valor del parámetro utilizado)
  - registros_actualizados (solo registros con concepto='Renta')
  - timestamp de la operación

Casos especiales:
- Si el parámetro es nulo o vacío, retorna JSON con error
- Si no hay datos en raPdp, retorna JSON con error específico
- Si no hay plan activo en arrePdp, retorna JSON con error específico
- Si ocurre un error durante la actualización, captura la excepción y retorna JSON con detalles del error
*/