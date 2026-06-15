-- =============================================================================
-- Migración v2: Renovación de plan — activación inmediata si no hay vigente
-- Fecha: 2026-06-15  ·  Versión: v2.27.3
-- Módulo: Arrendatarios → Planes de Renta
--
-- ⚠️ APLICADA CON AUTORIZACIÓN EXPLÍCITA DEL USUARIO (regla 1 del HANDOFF).
--    Solo se REEMPLAZA una función v2_ propia (CREATE OR REPLACE). No se toca
--    ninguna lógica del sistema viejo (v1/Flutter) ni el esquema.
--
-- PROBLEMA QUE CORRIGE
--   `v2_arrepdp_renovar` solo INSERTABA el plan de renovación; nunca vinculaba
--   ni activaba en `arrenPropiedades`. La activación dependía 100% del cron
--   nocturno `v2_arrepdp_activar_renovaciones`, cuyo filtro exige que el vínculo
--   apunte a un plan vencido ('No'). Si al renovar la nave YA no tenía contrato
--   vigente (plan anterior vencido o vínculo sin plan), la renovación quedaba
--   creada pero invisible y sin activar (caso real: Sitapark-F / SEGURITECH).
--
-- SOLUCIÓN
--   Tras crear el plan, la RPC comprueba si hay un contrato vigente ACTIVO
--   corriendo en la nave:
--     · SÍ  → la renovación queda PROGRAMADA (la activa el cron al vencer).
--     · NO  → se vincula y activa EN EL ACTO (mismo UPDATE que hace el cron).
--   El historial de planes (arrePdp 1:N por idNavArrend) queda intacto.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.v2_arrepdp_renovar(p_id_arre_pdp_actual text, p_uid text, p_plazo integer, p_precio_m2 double precision, p_construccion_m2 double precision, p_deposito double precision DEFAULT 0.0, p_pm2_admin double precision DEFAULT 0.0, p_pm2_mtto double precision DEFAULT 0.0, p_pm2_vig double precision DEFAULT 0.0, p_inpc_plus double precision DEFAULT 0.0, p_moneda text DEFAULT 'MXN'::text, p_mes_gracia_renta double precision DEFAULT 0.0, p_mes_gracia_administracion double precision DEFAULT 0.0, p_mes_gracia_mantenimiento double precision DEFAULT 0.0, p_mes_gracia_vigilancia double precision DEFAULT 0.0)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_id_nav text; v_id_arr text; v_fec_fin_actual date; v_vig text;
  v_id_nuevo text; v_fec_inicio date; v_rta_base double precision;
  v_hay_vigente boolean; v_activada boolean := false;
BEGIN
  IF p_plazo IS NULL OR p_plazo <= 0 OR p_plazo > 120 THEN
    RETURN jsonb_build_object('exito',false,'codigo','PARAMETRO_INVALIDO','mensaje','El plazo debe estar entre 1 y 120 meses');
  END IF;

  SELECT "idNavArrend","idArrendador","fecFin","arrePdpVigente"
    INTO v_id_nav, v_id_arr, v_fec_fin_actual, v_vig
  FROM public."arrePdp" WHERE "idArrePdp" = p_id_arre_pdp_actual AND status = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('exito',false,'codigo','PLAN_NO_EXISTE','mensaje','El plan a renovar no existe');
  END IF;
  IF v_fec_fin_actual IS NULL THEN
    RETURN jsonb_build_object('exito',false,'codigo','SIN_FECHA_FIN','mensaje','El plan actual no tiene fecha de fin');
  END IF;
  IF v_vig NOT IN ('3 Meses','2 Meses','1 Mes','No') THEN
    RETURN jsonb_build_object('exito',false,'codigo','NO_RENOVABLE','mensaje','El plan aún no es renovable (faltan más de 3 meses)');
  END IF;

  v_fec_inicio := v_fec_fin_actual + 1;  -- día siguiente al fin del vigente

  IF EXISTS (
    SELECT 1 FROM public."arrePdp"
    WHERE "idNavArrend" = v_id_nav AND status = true
      AND "idArrePdp" <> p_id_arre_pdp_actual
      AND "fecInicio" >= v_fec_fin_actual
  ) THEN
    RETURN jsonb_build_object('exito',false,'codigo','YA_RENOVADO','mensaje','Esta propiedad ya tiene un plan de renovación registrado');
  END IF;

  v_id_nuevo := 'PDP_' || to_char(NOW(),'YYMMDDHH24MISS') || '_' || substr(md5(random()::text),1,8);
  v_rta_base := COALESCE(p_precio_m2,0.0) * COALESCE(p_construccion_m2,0.0);

  INSERT INTO public."arrePdp"(
    "idArrePdp","uid","idArrendador","idNavArrend","fecInicio",
    "plazo","deposito","precioM2","construccionM2","rtaBase",
    "pm2Admin","pm2Mtto","pm2Vig","INPCPlus","Moneda","mesGracia"
  ) VALUES (
    v_id_nuevo, p_uid::uuid, v_id_arr, v_id_nav, v_fec_inicio,
    p_plazo, p_deposito, p_precio_m2, p_construccion_m2, v_rta_base,
    p_pm2_admin, p_pm2_mtto, p_pm2_vig, p_inpc_plus, p_moneda,
    jsonb_build_object('renta',p_mes_gracia_renta,'administracion',p_mes_gracia_administracion,
                       'mantenimiento',p_mes_gracia_mantenimiento,'vigilancia',p_mes_gracia_vigilancia)
  );

  PERFORM public.arrepdp_generar_corrida_desde_plan_simple(v_id_nuevo, 0, p_inpc_plus);
  PERFORM public.arrepdpdetalle_aplicar_meses_gracia(v_id_nuevo);

  -- ¿La nave tiene HOY un contrato vigente ACTIVO corriendo?
  SELECT EXISTS (
    SELECT 1
    FROM public."arrenPropiedades" prop
    JOIN public."arrePdp" ap ON ap."idArrePdp" = prop."idArrePdp"
    WHERE prop."idNavArrend" = v_id_nav
      AND prop.status = true
      AND prop."pdpActivo" = true
      AND ap."arrePdpVigente" <> 'No'
  ) INTO v_hay_vigente;

  IF NOT v_hay_vigente THEN
    -- Sin contrato vigente corriendo: la renovación toma el control en el acto
    -- (mismo UPDATE que hace el cron al vencer; el historial de planes queda intacto).
    UPDATE public."arrenPropiedades"
    SET "idArrePdp" = v_id_nuevo, "tienePdp" = true, "pdpActivo" = true, "pdpVigente" = true
    WHERE "idNavArrend" = v_id_nav AND status = true;
    v_activada := true;
  END IF;

  RETURN jsonb_build_object('exito',true,'codigo','EXITO',
    'mensaje', CASE WHEN v_activada
                    THEN 'Renovación registrada y activada (no había contrato vigente)'
                    ELSE 'Plan de renovación registrado (se activará al vencer el vigente)' END,
    'detalles',jsonb_build_object('id_plan',v_id_nuevo,'fec_inicio',v_fec_inicio,'activada',v_activada));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('exito',false,'codigo','ERROR_GENERAL','mensaje','Error interno: '||SQLERRM,
    'detalles',jsonb_build_object('sqlstate',SQLSTATE));
END;
$function$;


-- =============================================================================
-- FIXES DE DATOS PUNTUALES aplicados el 2026-06-15 (con autorización del usuario)
-- Documentados aquí para trazabilidad. Son baja/ajuste lógicos: conservan historial.
-- =============================================================================

-- 1) Sitapark-F (SEGURITECH PRIVADA SA DE CV) — el vínculo había quedado sin plan
--    (idArrePdp NULL, pdpActivo=false) y la renovación creada el 2026-06-12 colgaba
--    sin activar. Se re-apunta el vínculo al plan vigente (no toca el historial).
--    UPDATE public."arrenPropiedades"
--    SET "idArrePdp"='PDP_260612211043_f0758c8a',"tienePdp"=true,"pdpActivo"=true,"pdpVigente"=true
--    WHERE "idNavArrend"='oE5KEnAyb5O9oUcWxoX' AND status=true AND "idArrePdp" IS NULL;

-- 2) Sitapark-F — plan DUPLICADO del periodo 2022-04-01→2025-03-31 (copia v2
--    'PDP_251223164103_6e33fdf9', sin pagos). Baja lógica (conserva sus 145 partidas);
--    se conserva el original v1 'Cm9y6GCiXKhcPnC'.
--    UPDATE public."arrePdp" SET status=false
--    WHERE "idArrePdp"='PDP_251223164103_6e33fdf9' AND "idNavArrend"='oE5KEnAyb5O9oUcWxoX';
