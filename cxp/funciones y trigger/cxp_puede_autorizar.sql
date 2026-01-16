--[Fecha y Hora]: 29/10/2025 23:14:15
--[Descripción]: Valida si se puede autorizar en CxP en la fecha actual (zona horaria México)
--
--[Parámetros]: No requiere parámetros directos
--
--[Salida]:
--   - boolean: true si se puede autorizar, false si no se puede
--
--[Uso típico]: Se utiliza para validar si el usuario actual tiene permisos
--               para autorizar pagos en el día de hoy
--
--[Ejemplo]: SELECT cxp_puede_autorizar();
--
--[Relaciones]: 
--   - Tabla: cxp_fechas_habilitadas
--
--[Validaciones]:
--   - Verifica que la fecha actual exista en cxp_fechas_habilitadas
--   - Verifica que el campo autorizar esté en true para esa fecha
--
--[Lógica de funcionamiento]:
--   1. Obtiene la fecha actual en zona horaria de México
--   2. Busca la fecha en cxp_fechas_habilitadas
--   3. Verifica que el campo autorizar = true
--   4. Retorna true si cumple todas las condiciones
--
--[Consideraciones de zona horaria]:
--   - Usa 'America/Mexico_City' para obtener la fecha local correcta
--   - Esto es crucial para operaciones que dependen del día hábil
--   - Evita problemas con zonas horarias diferentes
--
--[Manejo de errores]:
--   - Si no encuentra la fecha, retorna false
--   - En caso de error en la base de datos, retorna false (modo conservador)
--
--[Casos de uso]:
--   - Habilitar/deshabilitar botones de autorización en UI
--   - Validar en triggers antes de permitir operaciones
--   - Verificar permisos en funciones de negocio
--
--[Rendimiento]:
--   - Consulta simple con índice en campo fecha
--   - Retorno rápido de booleano
--   - Uso eficiente en validaciones frecuentes

CREATE OR REPLACE FUNCTION public.cxp_puede_autorizar()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $function$
DECLARE
    autorizar_habilitado BOOLEAN := false;
    fecha_mexico DATE;
BEGIN
    -- [Fecha y Hora]: 29/10/2025 23:14:15
    -- [Descripción]: Valida si se puede autorizar en CxP en la fecha actual (zona horaria México)
    -- [Lógica]: Verifica que la fecha local de México exista en cxp_fechas_habilitadas con autorizar=true
    -- [Zona Horaria]: Usa 'America/Mexico_City' para obtener la fecha local correcta
    -- [Retorna]: BOOLEAN - true si se puede autorizar, false si no se puede
    -- [Uso]: SELECT cxp_puede_autorizar();
    
    -- Obtener la fecha actual en zona horaria de México
    fecha_mexico := (NOW() AT TIME ZONE 'America/Mexico_City')::DATE;
    
    SELECT autorizar 
    INTO autorizar_habilitado
    FROM public.cxp_fechas_habilitadas 
    WHERE fecha = fecha_mexico;
    
    -- Si no encontró la fecha, retornar false
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    -- Retornar el estado de autorizar
    RETURN autorizar_habilitado;
    
EXCEPTION
    WHEN OTHERS THEN
        -- En caso de error, ser conservador y no permitir
        RETURN false;
END;
$function$;