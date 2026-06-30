-- 2026-06-30 · CxP — Exención de Solicitudes Urgentes en la validación de fecha CFDI
--
-- CONTEXTO: el trigger `trigger_cxp_validar_fecha_insert` (función
-- `cxp_trigger_validar_fecha`, BEFORE INSERT OR UPDATE ON cxp) bloquea CUALQUIER
-- INSERT con `CXP_CFDI_NO_HABILITADO` cuando la fecha de hoy no tiene `cfdi=true`
-- en `cxp_fechas_habilitadas`. Eso impedía registrar Solicitudes Urgentes en días
-- no habilitados, pese a que el negocio las considera un atajo manual permitido
-- siempre (autorizado por el usuario, 2026-06-30).
--
-- CAMBIO: en la rama INSERT, se exenta del bloqueo a las filas con `esUrgente=true`.
-- TODO LO DEMÁS queda IDÉNTICO al original (la lógica RBAC `COALESCE(autorizo,uidr)`
-- de la rama UPDATE NO se modifica; se preserva verbatim porque CREATE OR REPLACE
-- exige reescribir el cuerpo completo de la función).
--
-- IMPACTO: solo RELAJA el caso `esUrgente=true` en INSERT (permite más, no rompe
-- nada existente). El resto de tipos sigue bloqueado en días no habilitados; la
-- validación de autorización (UPDATE → estados 3/4) no cambia. Sin cambios de esquema.
--
-- REVERTIR: volver a aplicar la versión sin la condición `AND COALESCE(NEW."esUrgente", false) = false`.

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
    -- Obtener información de fechas habilitadas para hoy
    SELECT cfdi, autorizar
    INTO cfdi_habilitado, autorizar_habilitado
    FROM public.cxp_fechas_habilitadas
    WHERE fecha = fecha_actual;

    IF NOT FOUND THEN
        cfdi_habilitado := false;
        autorizar_habilitado := false;
    END IF;

    -- (Sin cambios) Permiso de autorización (clave 430) contra el AUTORIZADOR real
    -- (NEW.autorizo); COALESCE preserva el comportamiento previo en envíos 1->2.
    SELECT EXISTS(
        SELECT 1
        FROM public."segModulosUsuarios"
        WHERE uid = COALESCE(NEW.autorizo, NEW.uidr)
          AND clave = 430
          AND acceso = true
    ) INTO es_usuario_autorizador;

    -- === VALIDACIONES PARA INSERT ===
    IF TG_OP = 'INSERT' THEN
        -- Las Solicitudes Urgentes (esUrgente=true) son un atajo manual y NO dependen
        -- del periodo de captura de CFDI: pueden registrarse cualquier día. El resto
        -- de tipos sí requiere una fecha con cfdi=true.
        IF NOT cfdi_habilitado AND COALESCE(NEW."esUrgente", false) = false THEN
            RAISE EXCEPTION 'CXP_CFDI_NO_HABILITADO: No se pueden insertar registros en CxP. La fecha actual (%) no permite generar CFDI. Solo se permite en fechas con cfdi=true (generalmente lunes y martes).',
                fecha_actual
            USING HINT = 'Verifique la tabla cxp_fechas_habilitadas o espere a una fecha habilitada para CFDI.';
        END IF;
        RETURN NEW;
    END IF;

    -- === VALIDACIONES PARA UPDATE === (sin cambios respecto al original)
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
