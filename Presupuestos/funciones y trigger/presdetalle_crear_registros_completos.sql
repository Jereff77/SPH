--[Fecha y Hora]: 30/10/2025 03:01:00
--[Descripción]: Función que crea los 12 registros mensuales del presupuesto para una categoría específica
--                usando el año del presupuesto activo y distribuyendo el presupuesto anual entre los 12 meses
--
--[Parámetros]:
--   - p_id_categoria (text): ID de la categoría a la que se le crearán los registros
--
--[Salida]:
--   - TABLE con mensaje, registros_creados, id_categoria y anio_presupuesto
--
--[Uso típico]: Se usa para completar las categorías que no tienen sus 12 registros mensuales
--
--[Ejemplo]: SELECT * FROM presdetalle_crear_registros_completos('52-471-0');
--
--[Relaciones]: 
--   - Tabla PresCategorias (para obtener datos de la categoría)
--   - Tabla Presupuestos (para obtener el año activo)
--   - Tabla PresDetalle (para insertar los registros)
--
--[Validaciones]:
--   - Verifica que la categoría exista y esté activa
--   - Verifica que exista un presupuesto activo
--   - Verifica si ya existen registros antes de crear nuevos
--   - Verifica que la categoría no tenga ya los 12 meses completos

CREATE OR REPLACE FUNCTION public.presdetalle_crear_registros_completos(p_id_categoria text)
RETURNS TABLE(
  mensaje text,
  registros_creados integer,
  id_categoria text,
  anio_presupuesto integer
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_anio_presupuesto integer;
  v_id_presupuesto uuid;
  v_uid_actual uuid;
  v_registros_creados integer := 0;
  v_monto_presupuesto numeric;
  v_monto_mensual numeric;
  v_registros_existentes integer;
BEGIN
  --[Fecha y Hora]: 30/10/2025 02:59:25
  -- [Descripción]: Función que crea los 12 registros mensuales del presupuesto para una categoría específica
  --                usando el año del presupuesto activo y distribuyendo el presupuesto anual entre los 12 meses
  --
  -- [Entrada]: p_id_categoria (text) - ID de la categoría a la que se le crearán los registros
  --
  -- [Salida]: TABLE con mensaje, registros_creados, id_categoria y anio_presupuesto
  --
  -- [Uso típico]: Se usa para completar las categorías que no tienen sus 12 registros mensuales
  --
  -- [Ejemplo]: SELECT * FROM presdetalle_crear_registros_completos('52-471-0');
  --
  -- [Relaciones]: 
  --   - Tabla PresCategorias (para obtener datos de la categoría)
  --   - Tabla Presupuestos (para obtener el año activo)
  --   - Tabla PresDetalle (para insertar los registros)
  --
  -- [Validaciones]:
  --   - Verifica que la categoría exista y esté activa
  --   - Verifica que exista un presupuesto activo
  --   - Verifica si ya existen registros antes de crear nuevos
  --   - Verifica que la categoría no tenga ya los 12 meses completos

  -- Obtener el usuario actual (manejar caso donde auth.uid() sea null)
  v_uid_actual := auth.uid();
  
  -- Si no hay usuario autenticado, usar el uid del responsable de la categoría
  IF v_uid_actual IS NULL THEN
    SELECT "uidResponsable" 
    INTO v_uid_actual
    FROM public."PresCategorias" 
    WHERE "idCategoria" = p_id_categoria;
  END IF;
  
  -- Si todavía es null, usar el uid del presupuesto
  IF v_uid_actual IS NULL THEN
    SELECT uidr 
    INTO v_uid_actual
    FROM public."Presupuestos" 
    WHERE status = true 
    LIMIT 1;
  END IF;
  
  -- Obtener el año del presupuesto activo
  SELECT anio, "idPresupuesto" 
  INTO v_anio_presupuesto, v_id_presupuesto
  FROM public."Presupuestos" 
  WHERE status = true 
  LIMIT 1;
  
  -- Verificar que exista un presupuesto activo
  IF v_anio_presupuesto IS NULL THEN
    RETURN QUERY SELECT 'No existe un presupuesto activo'::text, 0::integer, p_id_categoria::text, NULL::integer;
    RETURN;
  END IF;
  
  -- Verificar que la categoría exista y esté activa
  IF NOT EXISTS (SELECT 1 FROM public."PresCategorias" WHERE "idCategoria" = p_id_categoria AND status = true) THEN
    RETURN QUERY SELECT 'La categoría no existe o no está activa'::text, 0::integer, p_id_categoria::text, v_anio_presupuesto::integer;
    RETURN;
  END IF;
  
  -- Verificar si ya existen registros para esta categoría y año
  SELECT COUNT(*) 
  INTO v_registros_existentes
  FROM public."PresDetalle" 
  WHERE "idCategoria" = p_id_categoria AND anio = v_anio_presupuesto;
  
  -- Si ya existen registros, informar y no crear nuevos
  IF v_registros_existentes > 0 THEN
    RETURN QUERY SELECT 
      'Ya existen ' || v_registros_existentes || ' registros para esta categoría y año. No se crearon nuevos registros.'::text, 
      0::integer, 
      p_id_categoria::text, 
      v_anio_presupuesto::integer;
    RETURN;
  END IF;
  
  -- Verificar que la categoría no tenga ya los 12 meses completos
  IF EXISTS (
    SELECT 1 FROM public."PresDetalle" 
    WHERE "idCategoria" = p_id_categoria AND anio = v_anio_presupuesto 
    GROUP BY "idCategoria" 
    HAVING COUNT(DISTINCT mes) = 12
  ) THEN
    RETURN QUERY SELECT 'La categoría ya tiene los 12 meses completos'::text, 0::integer, p_id_categoria::text, v_anio_presupuesto::integer;
    RETURN;
  END IF;
  
  -- Obtener el presupuesto anual de la categoría
  SELECT "Presupuesto" 
  INTO v_monto_presupuesto
  FROM public."PresCategorias" 
  WHERE "idCategoria" = p_id_categoria;
  
  -- Calcular el monto mensual (dividir el presupuesto anual entre 12 meses)
  v_monto_mensual := COALESCE(v_monto_presupuesto, 0) / 12;
  
  -- Crear los 12 registros mensuales
  INSERT INTO public."PresDetalle" (
    "idCategoria", 
    anio, 
    mes, 
    monto, 
    uidc, 
    uidm, 
    "idPresupuesto"
  ) 
  SELECT 
    p_id_categoria,
    v_anio_presupuesto,
    mes,
    v_monto_mensual,
    v_uid_actual,
    v_uid_actual,
    v_id_presupuesto
  FROM generate_series(1, 12) AS mes;
  
  GET DIAGNOSTICS v_registros_creados = ROW_COUNT;
  
  -- Retornar el resultado
  RETURN QUERY SELECT 
    'Se crearon exitosamente los 12 registros mensuales'::text, 
    v_registros_creados::integer, 
    p_id_categoria::text, 
    v_anio_presupuesto::integer;
  
END;
$$;