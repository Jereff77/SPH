--[Fecha y Hora]: 16/10/2025 18:40:00
-- [Descripción]: Busca y filtra empresas en la vista v_resumenempresas con criterios opcionales.
--                Permite buscar por idParque y/o por nombre de empresa/número de nave.
--                Strings vacíos ('') se tratan como NULL.
--
-- [Parámetros]:
--   - id_parque (text, opcional): Filtra empresas por ID de parque específico.
--                                 Si es '' (vacío) se trata como NULL.
--   - nombre_empresa (text, opcional): Busca empresas por nombre (ILIKE) o por número de nave.
--                                      Si coincide con numNaveNombre en tabla naves, busca por idEmpresa.
--                                      Si es '' (vacío) se trata como NULL.
--
-- [Comportamiento]:
--   - Si ambos parámetros son NULL o '': Retorna todas las empresas.
--   - Si se proporciona id_parque: Filtra por ese parque (AND con otros criterios).
--   - Si se proporciona nombre_empresa: 
--       * Busca en v_resumenempresas.nombreEmpresa usando ILIKE '%valor%'
--       * Busca en naves.numNaveNombre usando ILIKE '%valor%'
--       * Si encuentra coincidencias en naves, incluye esas empresas por idEmpresa
--   - Los filtros se combinan con AND (ambos deben cumplirse si se proporcionan).
--
-- [Salida]: Conjunto de registros con todos los campos de v_resumenempresas que cumplan los criterios.
--
-- [Trigger]: N/A (función de consulta, no se ejecuta automáticamente)
--
-- [Ejemplos de uso]:
--   -- Todas las empresas (cualquiera de estas formas):
--   SELECT * FROM v_resumenempresas_buscar();
--   SELECT * FROM v_resumenempresas_buscar(NULL, NULL);
--   SELECT * FROM v_resumenempresas_buscar('', '');
--
--   -- Empresas de un parque específico:
--   SELECT * FROM v_resumenempresas_buscar('E6WBu55bKjha', NULL);
--   SELECT * FROM v_resumenempresas_buscar('E6WBu55bKjha', '');
--
--   -- Empresas que contengan "TRANS" en el nombre:
--   SELECT * FROM v_resumenempresas_buscar(NULL, 'TRANS');
--   SELECT * FROM v_resumenempresas_buscar('', 'TRANS');
--
--   -- Empresas en nave "60":
--   SELECT * FROM v_resumenempresas_buscar('', '60');
--
--   -- Empresas de un parque específico que contengan "TRANS":
--   SELECT * FROM v_resumenempresas_buscar('E6WBu55bKjha', 'TRANS');

CREATE OR REPLACE FUNCTION public.v_resumenempresas_buscar(id_parque text DEFAULT NULL::text, nombre_empresa text DEFAULT NULL::text)
 RETURNS TABLE("idEmpresa" uuid, "nombreEmpresa" text, "idParque" text, "nombreParque" text, "totalAsignados" integer, "QRdiarios" integer, "QRLigeros" integer, "QRCarga" integer, disponibles bigint, "activosLigeros" bigint, "activosCarga" bigint, "accesosUtilizados" bigint, "accesosEnviados" bigint, suspendida boolean)
 LANGUAGE plpgsql
AS $BODY$
DECLARE
    v_id_parque text;
    v_nombre_empresa text;
BEGIN
    --[Fecha y Hora]: 16/10/2025 18:40:00
    -- [Descripción]: Busca y filtra empresas en la vista v_resumenempresas con criterios opcionales.
    --                Permite buscar por idParque y/o por nombre de empresa/número de nave.
    --                Strings vacíos ('') se tratan como NULL.
    --
    -- [Parámetros]:
    --   - id_parque (text, opcional): Filtra empresas por ID de parque específico.
    --                                 Si es '' (vacío) se trata como NULL.
    --   - nombre_empresa (text, opcional): Busca empresas por nombre (ILIKE) o por número de nave.
    --                                      Si coincide con numNaveNombre en tabla naves, busca por idEmpresa.
    --                                      Si es '' (vacío) se trata como NULL.
    --
    -- [Comportamiento]:
    --   - Si ambos parámetros son NULL o '': Retorna todas las empresas.
    --   - Si se proporciona id_parque: Filtra por ese parque (AND con otros criterios).
    --   - Si se proporciona nombre_empresa: 
    --       * Busca en v_resumenempresas.nombreEmpresa usando ILIKE '%valor%'
    --       * Busca en naves.numNaveNombre usando ILIKE '%valor%'
    --       * Si encuentra coincidencias en naves, incluye esas empresas por idEmpresa
    --   - Los filtros se combinan con AND (ambos deben cumplirse si se proporcionan).
    --
    -- [Salida]: Conjunto de registros con todos los campos de v_resumenempresas que cumplan los criterios.
    --
    -- [Trigger]: N/A (función de consulta, no se ejecuta automáticamente)
    --
    -- [Ejemplos de uso]:
    --   -- Todas las empresas (cualquiera de estas formas):
    --   SELECT * FROM v_resumenempresas_buscar();
    --   SELECT * FROM v_resumenempresas_buscar(NULL, NULL);
    --   SELECT * FROM v_resumenempresas_buscar('', '');
    --
    --   -- Empresas de un parque específico:
    --   SELECT * FROM v_resumenempresas_buscar('E6WBu55bKjha', NULL);
    --   SELECT * FROM v_resumenempresas_buscar('E6WBu55bKjha', '');
    --
    --   -- Empresas que contengan "TRANS" en el nombre:
    --   SELECT * FROM v_resumenempresas_buscar(NULL, 'TRANS');
    --   SELECT * FROM v_resumenempresas_buscar('', 'TRANS');
    --
    --   -- Empresas en nave "60":
    --   SELECT * FROM v_resumenempresas_buscar('', '60');
    --
    --   -- Empresas de un parque específico que contengan "TRANS":
    --   SELECT * FROM v_resumenempresas_buscar('E6WBu55bKjha', 'TRANS');

    -- Normalizar strings vacíos a NULL
    v_id_parque := NULLIF(TRIM(id_parque), '');
    v_nombre_empresa := NULLIF(TRIM(nombre_empresa), '');

    RETURN QUERY
    SELECT DISTINCT
        v."idEmpresa",
        v."nombreEmpresa",
        v."idParque",
        v."nombreParque",
        v."totalAsignados",
        v."QRdiarios",
        v."QRLigeros",
        v."QRCarga",
        v.disponibles,
        v."activosLigeros",
        v."activosCarga",
        v."accesosUtilizados",
        v."accesosEnviados",
        v.suspendida
    FROM v_resumenempresas v
    WHERE 
        -- Filtro por idParque (si se proporciona)
        (v_id_parque IS NULL OR v."idParque" = v_id_parque)
        AND
        -- Filtro por nombre de empresa o número de nave (si se proporciona)
        (
            v_nombre_empresa IS NULL 
            OR 
            v."nombreEmpresa" ILIKE '%' || v_nombre_empresa || '%'
            OR
            v."idEmpresa" IN (
                SELECT n."idEmpresa"
                FROM naves n
                WHERE n."numNaveNombre" ILIKE '%' || v_nombre_empresa || '%'
                  AND n."idEmpresa" IS NOT NULL
            )
        )
    ORDER BY v."nombreEmpresa";

END;
$BODY$;