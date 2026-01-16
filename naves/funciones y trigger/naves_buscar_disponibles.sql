--[Fecha y Hora]: 16/10/2025 19:00:00
-- [Descripción]: Busca naves disponibles para asignar a empresas nuevas o existentes.
--                Maneja dos casos de uso principales: creación y edición de empresas.
--
-- [Parámetros]:
--   - id_parque (text, opcional): ID del parque para buscar naves disponibles (sin asignar).
--                                 Usado al CREAR una nueva empresa.
--                                 Si es '' (vacío) se trata como NULL.
--   - id_empresa (uuid, opcional): ID de la empresa para buscar sus naves ya asignadas.
--                                  Usado al EDITAR una empresa existente.
--
-- [Comportamiento]:
--   - Si ambos parámetros son NULL o '': Retorna conjunto vacío.
--   - Si SOLO se proporciona id_parque: 
--       * Busca naves del parque donde idEmpresa IS NULL y uidAsignador IS NULL
--       * Caso de uso: Mostrar naves disponibles al crear nueva empresa
--   - Si SOLO se proporciona id_empresa:
--       * Busca naves asignadas a esa empresa
--       * Valida que pertenezcan al mismo parque que tiene asignado la empresa
--       * Caso de uso: Mostrar naves asignadas al editar empresa
--   - Si se proporcionan AMBOS parámetros:
--       * Valida que el id_parque proporcionado coincida con el parque de la empresa
--       * Si no coinciden, retorna conjunto vacío (inconsistencia de datos)
--       * Si coinciden, busca las naves asignadas a la empresa
--
-- [Salida]: Conjunto de registros de naves que cumplen los criterios, ordenados por numNave ASC.
--
-- [Trigger]: N/A (función de consulta, no se ejecuta automáticamente)
--
-- [Ejemplos de uso]:
--   -- Sin parámetros (retorna vacío):
--   SELECT * FROM naves_buscar_disponibles();
--   SELECT * FROM naves_buscar_disponibles('', NULL);
--
--   -- Naves disponibles de un parque (para CREAR empresa):
--   SELECT * FROM naves_buscar_disponibles('E6WBu55bKjha', NULL);
--
--   -- Naves asignadas a una empresa (para EDITAR empresa):
--   SELECT * FROM naves_buscar_disponibles(NULL, '001f42ce-29a2-426e-ac46-7afc0a8af7d6');
--
--   -- Con ambos parámetros (valida coincidencia):
--   SELECT * FROM naves_buscar_disponibles('E6WBu55bKjha', '001f42ce-29a2-426e-ac46-7afc0a8af7d6');

CREATE OR REPLACE FUNCTION public.naves_buscar_disponibles(id_parque text DEFAULT NULL::text, id_empresa uuid DEFAULT NULL::uuid)
 RETURNS TABLE("idNave" text, "idParque" text, "numNave" integer, "numNaveNombre" text, "idEmpresa" uuid, asignado boolean, "uidAsignador" uuid)
 LANGUAGE plpgsql
AS $BODY$
DECLARE
    v_id_parque text;
    v_id_empresa uuid;
    v_parque_empresa text;
BEGIN
    --[Fecha y Hora]: 16/10/2025 19:00:00
    -- [Descripción]: Busca naves disponibles para asignar a empresas nuevas o existentes.
    --                Maneja dos casos de uso principales: creación y edición de empresas.
    --
    -- [Parámetros]:
    --   - id_parque (text, opcional): ID del parque para buscar naves disponibles (sin asignar).
    --                                 Usado al CREAR una nueva empresa.
    --                                 Si es '' (vacío) se trata como NULL.
    --   - id_empresa (uuid, opcional): ID de la empresa para buscar sus naves ya asignadas.
    --                                  Usado al EDITAR una empresa existente.
    --
    -- [Comportamiento]:
    --   - Si ambos parámetros son NULL o '': Retorna conjunto vacío.
    --   - Si SOLO se proporciona id_parque: 
    --       * Busca naves del parque donde idEmpresa IS NULL y uidAsignador IS NULL
    --       * Caso de uso: Mostrar naves disponibles al crear nueva empresa
    --   - Si SOLO se proporciona id_empresa:
    --       * Busca naves asignadas a esa empresa
    --       * Valida que pertenezcan al mismo parque que tiene asignado la empresa
    --       * Caso de uso: Mostrar naves asignadas al editar empresa
    --   - Si se proporcionan AMBOS parámetros:
    --       * Valida que el id_parque proporcionado coincida con el parque de la empresa
    --       * Si no coinciden, retorna conjunto vacío (inconsistencia de datos)
    --       * Si coinciden, busca las naves asignadas a la empresa
    --
    -- [Salida]: Conjunto de registros de naves que cumplen los criterios, ordenados por numNave ASC.
    --
    -- [Trigger]: N/A (función de consulta, no se ejecuta automáticamente)
    --
    -- [Ejemplos de uso]:
    --   -- Sin parámetros (retorna vacío):
    --   SELECT * FROM naves_buscar_disponibles();
    --   SELECT * FROM naves_buscar_disponibles('', NULL);
    --
    --   -- Naves disponibles de un parque (para CREAR empresa):
    --   SELECT * FROM naves_buscar_disponibles('E6WBu55bKjha', NULL);
    --
    --   -- Naves asignadas a una empresa (para EDITAR empresa):
    --   SELECT * FROM naves_buscar_disponibles(NULL, '001f42ce-29a2-426e-ac46-7afc0a8af7d6');
    --
    --   -- Con ambos parámetros (valida coincidencia):
    --   SELECT * FROM naves_buscar_disponibles('E6WBu55bKjha', '001f42ce-29a2-426e-ac46-7afc0a8af7d6');

    -- Normalizar strings vacíos a NULL
    v_id_parque := NULLIF(TRIM(id_parque), '');
    v_id_empresa := id_empresa;

    -- Si ambos son NULL, retornar vacío
    IF v_id_parque IS NULL AND v_id_empresa IS NULL THEN
        RETURN;
    END IF;

    -- CASO 1: Solo se proporciona idParque (crear nueva empresa)
    IF v_id_parque IS NOT NULL AND v_id_empresa IS NULL THEN
        RETURN QUERY
        SELECT 
            n."idNave",
            n."idParque",
            n."numNave",
            n."numNaveNombre",
            n."idEmpresa",
            n.asignado,
            n."uidAsignador"
        FROM naves n
        WHERE n."idParque" = v_id_parque
          AND n."idEmpresa" IS NULL
          AND n."uidAsignador" IS NULL
        ORDER BY n."numNave" ASC;
        RETURN;
    END IF;

    -- CASO 2 y 3: Se proporciona idEmpresa (con o sin idParque)
    IF v_id_empresa IS NOT NULL THEN
        -- Obtener el parque de la empresa
        SELECT e."idParque" INTO v_parque_empresa
        FROM empresas e
        WHERE e."idEmpresa" = v_id_empresa;

        -- Si la empresa no existe, retornar vacío
        IF v_parque_empresa IS NULL THEN
            RETURN;
        END IF;

        -- Si se proporcionaron ambos parámetros, validar coincidencia
        IF v_id_parque IS NOT NULL AND v_id_parque != v_parque_empresa THEN
            -- No coinciden: inconsistencia de datos, retornar vacío
            RETURN;
        END IF;

        -- Buscar naves asignadas a la empresa (validando que sean del mismo parque)
        RETURN QUERY
        SELECT 
            n."idNave",
            n."idParque",
            n."numNave",
            n."numNaveNombre",
            n."idEmpresa",
            n.asignado,
            n."uidAsignador"
        FROM naves n
        WHERE n."idEmpresa" = v_id_empresa
          AND n."idParque" = v_parque_empresa
        ORDER BY n."numNave" ASC;
        RETURN;
    END IF;

END;
$BODY$;