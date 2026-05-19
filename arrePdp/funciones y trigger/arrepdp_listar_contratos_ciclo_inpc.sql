--[Fecha y Hora]: 24/04/2026 00:00:00
--[Descripción]: Función de consulta que lista los contratos de arrendamiento cuyo
--                ciclo anual inicia en el mes y año indicados como parámetros.
--                Su propósito principal es identificar qué planes requieren la
--                aplicación del incremento por INPC en ese periodo, ya que cada
--                año se aplica un aumento a la renta base basado en el índice INPC.
--
--[Parámetros]:
--   - p_anio (integer): Año del ciclo a consultar. Ejemplo: 2026
--   - p_mes  (integer): Mes de inicio del ciclo (1-12). Ejemplo: 6 para junio
--
--[Salida]:
--   TABLE con los siguientes campos:
--   - idArrePdp   (text)            : ID único del plan de arrendamiento
--   - arrendatario (text)           : Razón social del arrendatario (de tabla inversionista)
--   - idNavArrend (text)            : ID de la nave/propiedad arrendada
--   - fecInicio   (date)            : Fecha de inicio del contrato
--   - fecFin      (date)            : Fecha de fin del contrato
--   - plazo       (smallint)        : Duración del contrato en meses
--   - ciclo       (integer)         : Número de ciclo que inicia en p_anio (= p_anio - año(fecInicio) + 1)
--   - rtaBase     (double precision): Renta base del contrato
--   - Moneda      (text)            : Moneda del contrato (MXN, USD, etc.)
--   - vigente      (boolean)        : Indica si el contrato está marcado como vigente
--
--[Uso típico]: Se ejecuta antes de aplicar el incremento INPC anual para obtener
--              la lista exacta de contratos que deben ser actualizados en ese mes/año.
--              Se complementa con las funciones arrepdpdetalle_actualizar_inpc() y
--              arrepdpdetalle_actualizar_inpc_desde_anio() para aplicar el incremento.
--
--[Ejemplo]:
--   -- Listar contratos que inician ciclo en junio 2026
--   SELECT * FROM arrepdp_listar_contratos_ciclo_inpc(2026, 6);
--
--   -- Listar contratos que inician ciclo en enero 2027
--   SELECT * FROM arrepdp_listar_contratos_ciclo_inpc(2027, 1);
--
--[Relaciones]:
--   - Tabla principal  : public."arrePdp"          (planes de arrendamiento)
--   - Tabla JOIN       : public."inversionista"     (datos del arrendatario vía idArrendador = idInversionista)
--   - Funciones relacionadas:
--       * arrepdpdetalle_actualizar_inpc(id_arrepdp)           - Aplica incremento INPC a un plan
--       * arrepdpdetalle_actualizar_inpc_desde_anio(id, anio)  - Aplica INPC desde un año específico
--       * actualizar_inpc_por_ciclo(ciclo_inicio, nuevo_inpc)  - Actualiza INPC masivo por ciclo
--
--[Validaciones]:
--   - Solo retorna contratos cuyo fecInicio sea en el mes p_mes
--   - Solo retorna contratos iniciados ANTES del año p_anio (ciclo >= 2, excluye contratos nuevos)
--   - Solo retorna contratos con fecFin posterior al 31 de diciembre de p_anio
--     (contratos que siguen activos después del año indicado)
--
--[Consideraciones de seguridad]:
--   - STABLE: Función de solo lectura, no modifica datos
--   - SECURITY INVOKER (por defecto): Ejecuta con permisos del usuario que la invoca
--   - No expone datos sensibles más allá de lo que el usuario ya tiene acceso

CREATE OR REPLACE FUNCTION public.arrepdp_listar_contratos_ciclo_inpc(
    p_anio integer,
    p_mes  integer
)
RETURNS TABLE (
    "idArrePdp"    text,
    arrendatario   text,
    "idNavArrend"  text,
    "fecInicio"    date,
    "fecFin"       date,
    plazo          smallint,
    ciclo          integer,
    "rtaBase"      double precision,
    "Moneda"       text,
    vigente        boolean
)
LANGUAGE sql
STABLE
AS $$
SELECT
    a."idArrePdp",
    i."razonsocial"                                           AS arrendatario,
    a."idNavArrend",
    a."fecInicio",
    a."fecFin",
    a."plazo",
    (p_anio - EXTRACT(YEAR FROM a."fecInicio")::integer + 1) AS ciclo,
    a."rtaBase",
    a."Moneda",
    a."vigente"
FROM public."arrePdp" a
LEFT JOIN public."inversionista" i
       ON i."idInversionista" = a."idArrendador"
WHERE EXTRACT(MONTH FROM a."fecInicio") = p_mes
  AND EXTRACT(YEAR  FROM a."fecInicio") < p_anio
  AND a."fecFin" > make_date(p_anio, 12, 31)
ORDER BY a."fecInicio";
$$;

COMMENT ON FUNCTION public.arrepdp_listar_contratos_ciclo_inpc(integer, integer) IS
'Lista contratos de arrendamiento cuyo ciclo anual inicia en p_mes/p_anio, para identificar
los planes que requieren aplicación del incremento por INPC en ese periodo.
Parámetros: p_anio = año del ciclo (ej: 2026), p_mes = mes de inicio del ciclo (1-12, ej: 6 para junio).
Columna ciclo = p_anio - año(fecInicio) + 1. Excluye contratos que inicien en p_anio (ciclo 1)
y contratos cuyo fecFin no supere el 31/12/p_anio.
Ejemplo: SELECT * FROM arrepdp_listar_contratos_ciclo_inpc(2026, 6);';
