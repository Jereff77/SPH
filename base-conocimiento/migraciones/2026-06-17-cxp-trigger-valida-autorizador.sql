-- ============================================================================
-- 2026-06-17 · FIX CxP — Autorización de solicitudes/facturas devolvía HTTP 500
-- ============================================================================
-- SÍNTOMA: al "Pagar/Aprobar Solicitudes" (y "Aprobar facturas") -> 500.
--   API:      POST /rest/v1/rpc/cxp_autorizar_solicitud_pago -> 500
--   Postgres: ERROR "invalid transaction termination" (2D000)
--
-- CAUSA RAÍZ (la que bloquea): el trigger BEFORE INSERT/UPDATE
--   public.cxp_trigger_validar_fecha() (trigger trigger_cxp_validar_fecha_insert)
--   validaba la clave de permiso 430 contra NEW.uidr (el SOLICITANTE que registró
--   la factura) en lugar del AUTORIZADOR. Como el solicitante normal no tiene la
--   430, TODO cambio de estado 2 -> 4 disparaba:
--     'CXP_ESTADO_NO_AUTORIZADO: Usuario sin permisos para cambiar al estado 4...'
--
-- CAUSA SECUNDARIA (oculta el error, NO corregida aquí — ver nota): la función
--   public.cxp_autorizar_solicitud_pago() contiene COMMIT;/ROLLBACK; ilegales en
--   una función PL/pgSQL; el ROLLBACK convierte la excepción del trigger en el
--   2D000 "invalid transaction termination" -> 500 opaco. (Pendiente: Fix B.)
--
-- VERIFICADO: hoy 2026-06-17 cxp_fechas_habilitadas.autorizar = true, por lo que
--   tras el fix la autorización pasa (no cae en CXP_AUTORIZACION_NO_HABILITADA).
--   Prueba con UPDATE simulado + ROLLBACK forzado: "OK estado 2 -> 4".
--
-- Cambio mínimo: WHERE uid = NEW.uidr  ->  WHERE uid = COALESCE(NEW.autorizo, NEW.uidr)
--   El COALESCE preserva el comportamiento previo cuando no hay autorizador en la
--   operación (envíos 1->2), por lo que NO hay regresión en otros flujos ni en v1.
-- ============================================================================

-- ---------- FIX (aplicado vía apply_migration) ----------
CREATE OR REPLACE FUNCTION public.cxp_trigger_validar_fecha()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    fecha_actual DATE := CURRENT_DATE;
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

    -- ✅ FIX: validar contra el AUTORIZADOR real (NEW.autorizo); fallback a NEW.uidr.
    SELECT EXISTS(
        SELECT 1
        FROM public."segModulosUsuarios"
        WHERE uid = COALESCE(NEW.autorizo, NEW.uidr)
          AND clave = 430
          AND acceso = true
    ) INTO es_usuario_autorizador;

    IF TG_OP = 'INSERT' THEN
        IF NOT cfdi_habilitado THEN
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

-- ---------- REVERT (definición ORIGINAL, restaurar si fuera necesario) ----------
-- Reemplazar el bloque SELECT EXISTS(...) por la versión con NEW.uidr:
--     WHERE uid = NEW.uidr
--       AND clave = 430
--       AND acceso = true
-- (el resto de la función es idéntico al de arriba).
