-- =============================================================================
-- 2026-07-07 · CxP · Fix de ZONA HORARIA en la validación de días habilitados
-- =============================================================================
-- INCIDENTE (reporte de usuario, ~18:03 hora México):
--   Al subir una factura PPD (y cualquier alta de CxP no urgente) por la
--   TARDE/NOCHE, el sistema respondía "Error interno del servidor" (500).
--
-- CAUSA RAÍZ:
--   La regla "solo se captura CFDI en días habilitados" (cxp_fechas_habilitadas)
--   se validaba en dos capas que NO usaban la misma fecha:
--     - App / RPC  cxp_puede_insertar()  → (now() AT TIME ZONE 'America/Mexico_City')::date  (CORRECTA)
--     - Trigger     cxp_trigger_validar_fecha()  → CURRENT_DATE  (= fecha del servidor, UTC)  (BUG)
--   México es UTC-6 (sin horario de verano). A partir de las 18:00 hora de México
--   el servidor (UTC) ya está en el DÍA SIGUIENTE. Si ese día siguiente no está
--   habilitado (cfdi=false) o no existe en la tabla, el trigger lanzaba
--   'CXP_CFDI_NO_HABILITADO' y abortaba el INSERT → el filtro global lo
--   neutralizaba a "Error interno del servidor".
--   Confirmado en logs de Postgres: ERROR ...(2026-07-08)... mientras en México
--   era 2026-07-07.
--
-- ALCANCE (auditoría integral de funciones que tocan cxp_fechas_habilitadas):
--   Buggy (UTC):  cxp_trigger_validar_fecha (ACTIVO, crítico) y
--                 cxp_validar_fecha_habilitada (helper JSONB huérfano, latente).
--   Correctas:    cxp_puede_insertar, cxp_puede_autorizar (ya usaban hora México).
--   Sin cambios:  triggers set_estado/set_week_info/validar_categoria/validar_proveedor
--                 (no dependen del reloj); trigger_cxp_validar_fecha_cfdi sigue 'D'.
--
-- FIX: alinear ambas funciones a la fecha de calendario MEXICANO, igual que la
--      capa de app. Verificado adversarialmente (Opus): 0 hallazgos ALTA; sin
--      impacto en RLS/auth; corrige de paso la ventana de AUTORIZACIÓN vespertina.
--
-- NOTA: cambio de SOLO BD (no toca apps/api ni apps/web) → NO requiere redeploy
--       ni bump de APP_VERSION_RAW (la versión visible sale del bundle, regla §2).
-- =============================================================================

-- 1) Trigger crítico (BEFORE INSERT OR UPDATE ON cxp): captura + autorización.
CREATE OR REPLACE FUNCTION public.cxp_trigger_validar_fecha()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    -- FIX zona horaria: la regla de días habilitados de CxP es de calendario
    -- MEXICANO (la empresa opera en México, UTC-6, sin horario de verano). Antes
    -- se usaba CURRENT_DATE (fecha del servidor = UTC), que después de las 18:00
    -- hora de México ya apuntaba al día siguiente y bloqueaba la captura/autorización
    -- con "CXP_CFDI_NO_HABILITADO" (500). Se alinea con cxp_puede_insertar()/
    -- cxp_puede_autorizar(), que ya usan hora de México.
    fecha_actual DATE := (now() AT TIME ZONE 'America/Mexico_City')::date;
    cfdi_habilitado BOOLEAN := false;
    autorizar_habilitado BOOLEAN := false;
    es_usuario_autorizador BOOLEAN := false;
    estado_anterior SMALLINT;
BEGIN
    SELECT cfdi, autorizar
    INTO cfdi_habilitado, autorizar_habilitado
    FROM public.cxp_fechas_habilitadas
    WHERE fecha = fecha_actual;

    IF NOT FOUND THEN
        cfdi_habilitado := false;
        autorizar_habilitado := false;
    END IF;

    SELECT EXISTS(
        SELECT 1
        FROM public."segModulosUsuarios"
        WHERE uid = COALESCE(NEW.autorizo, NEW.uidr)
          AND clave = 430
          AND acceso = true
    ) INTO es_usuario_autorizador;

    IF TG_OP = 'INSERT' THEN
        IF NOT cfdi_habilitado AND COALESCE(NEW."esUrgente", false) = false THEN
            RAISE EXCEPTION 'CXP_CFDI_NO_HABILITADO: No se pueden insertar registros en CxP. La fecha actual (%) no permite generar CFDI. Solo se permite en fechas con cfdi=true (generalmente lunes y martes).',
                fecha_actual
            USING HINT = 'Verifique la tabla cxp_fechas_habilitadas o espere a una fecha habilitada para CFDI.';
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD."idEstado" = NEW."idEstado" OR NEW."idEstado" IS NULL THEN
            RETURN NEW;
        END IF;

        estado_anterior := COALESCE(OLD."idEstado", 1);

        IF NOT es_usuario_autorizador THEN
            IF NEW."idEstado" NOT IN (1, 2) THEN
                RAISE EXCEPTION 'CXP_ESTADO_NO_AUTORIZADO: Usuario sin permisos para cambiar al estado %. Solo se permiten estados: 1=Guardado, 2=Enviado',
                    NEW."idEstado"
                USING HINT = 'Contacte a un usuario con permisos de autorización (clave 430) para cambios de estado de aprobación.';
            END IF;
        END IF;

        IF es_usuario_autorizador THEN
            IF NEW."idEstado" IN (3, 4) AND NOT autorizar_habilitado THEN
                RAISE EXCEPTION 'CXP_AUTORIZACION_NO_HABILITADA: No se pueden realizar autorizaciones hoy (%). La fecha actual no permite autorizar. Solo se permite en fechas con autorizar=true.',
                    fecha_actual
                USING HINT = 'Las autorizaciones están permitidas generalmente en lunes, martes y miércoles habilitados.';
            END IF;
        END IF;

        RETURN NEW;
    END IF;

    RETURN NEW;

EXCEPTION
    WHEN OTHERS THEN
        RAISE;
END;
$function$;

-- 2) Helper JSONB (huérfano a nivel BD y app; se alinea por consistencia).
CREATE OR REPLACE FUNCTION public.cxp_validar_fecha_habilitada()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    fecha_mexico DATE := (now() AT TIME ZONE 'America/Mexico_City')::date;
BEGIN
    IF EXISTS (SELECT 1 FROM public.cxp_fechas_habilitadas WHERE fecha = fecha_mexico) THEN
        RETURN jsonb_build_object(
            'exito', true,
            'codigo', 'EXITO',
            'mensaje', 'Fecha actual habilitada para insertar en CxP',
            'detalles', jsonb_build_object(
                'fecha_actual', fecha_mexico,
                'dia_semana', TO_CHAR(fecha_mexico, 'Day'),
                'habilitada', true
            )
        );
    ELSE
        RETURN jsonb_build_object(
            'exito', false,
            'codigo', 'FECHA_NO_HABILITADA',
            'mensaje', 'La fecha actual no está habilitada para insertar registros en CxP',
            'detalles', jsonb_build_object(
                'fecha_actual', fecha_mexico,
                'dia_semana', TO_CHAR(fecha_mexico, 'Day'),
                'habilitada', false
            )
        );
    END IF;
END;
$function$;

-- 3) Reversión del paliativo: el 2026-07-08 (miércoles) se había habilitado a mano
--    (cfdi=true) para desbloquear mientras se aplicaba el fix. Con el trigger ya en
--    hora México, se re-cierra el miércoles. IMPORTANTE: ejecutar SIEMPRE DESPUÉS
--    del paso 1 (si se cierra antes, con el trigger aún en UTC, re-bloquea la
--    captura de esa misma noche).
UPDATE public.cxp_fechas_habilitadas SET cfdi = false WHERE fecha = '2026-07-08';
