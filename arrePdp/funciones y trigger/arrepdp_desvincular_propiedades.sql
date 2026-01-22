--[Fecha y Hora]: 21/01/2026 14:17:57
--[Descripción]: Desvincula propiedades de todos los planes de pago no vigentes en el sistema
--
--[Parámetros]: No recibe parámetros
--
--[Salida]:
--   - void: No devuelve valor, solo actualiza registros en la tabla arrenPropiedades
--
--[Uso típico]: Se utiliza para desvincular masivamente todas las propiedades asociadas a planes de pago
--               que no están vigentes (arrePdpVigente = 'No'). Esta función limpia las referencias
--               de propiedades a planes inactivos, estableciendo los campos de control de PDP en false.
--
--[Ejemplo]: SELECT arrepdp_desvincular_propiedades();
--
--[Relaciones]:
--   - Tablas relacionadas:
--     * public."arrePdp" - Tabla de planes de pago (fuente de planes no vigentes)
--     * public."arrenPropiedades" - Tabla de propiedades arrendadas (destino de actualizaciones)
--   - Funciones/triggers asociados: Ninguno
--
--[Validaciones]:
--   - No requiere validaciones de entrada (sin parámetros)
--   - Solo afecta registros donde arrePdpVigente = 'No'
--   - Actualiza múltiples campos en arrenPropiedades para mantener consistencia

CREATE OR REPLACE FUNCTION public.arrepdp_desvincular_propiedades()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $function$
DECLARE
    v_plan RECORD;
BEGIN
    FOR v_plan IN
        SELECT "idArrePdp"
        FROM public."arrePdp"
        WHERE "arrePdpVigente" = 'No'
    LOOP
        UPDATE public."arrenPropiedades"
        SET 
            "idArrePdp" = NULL,
            "tienePdp" = false,
            "pdpActivo" = false,
            "pdpVigente" = false
        WHERE "idArrePdp" = v_plan."idArrePdp";
    END LOOP;
END;
$function$;
