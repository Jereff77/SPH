--[Fecha y Hora]: 16/10/2025 23:39:50
-- [Descripción]: Función para insertar en la tabla "empresasNaves" todos los registros de naves
--                que tengan un "idEmpresa" asignado en la tabla "naves".
--                Utilizada para sincronizar inicialmente las tablas.
--
-- [Entrada]: No requiere parámetros.
--
-- [Salida]: void - No devuelve valor, solo realiza inserciones en la tabla.
--
-- [Uso típico]: Se ejecuta para poblar inicialmente la tabla empresasNaves
--               con todas las naves que ya tienen empresa asignada.
--
-- [Ejemplo]: SELECT empresasnaves_insertar_desde_naves();

CREATE OR REPLACE FUNCTION public.empresasnaves_insertar_desde_naves()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $BODY$
BEGIN
    --[Fecha y Hora]: 16/10/2025 23:39:50
    -- [Descripción]: Inserta en la tabla "empresasNaves" todos los registros de naves
    --                que tengan un "idEmpresa" asignado en la tabla "naves".
    --
    -- [Entrada]: No requiere parámetros.
    --
    -- [Salida]: void - No devuelve valor, solo realiza inserciones en la tabla.
    --
    -- [Uso típico]: Se ejecuta para sincronizar las naves asignadas a empresas
    --               con la tabla de relación "empresasNaves".
    --
    -- [Ejemplo]: SELECT empresasnaves_insertar_desde_naves();

    INSERT INTO public."empresasNaves" ("idEmpresa", "idParque", "idNave", "fc", "status")
    SELECT 
        n."idEmpresa",
        n."idParque",
        n."idNave",
        NOW() as "fc",
        true as "status"
    FROM public.naves n
    WHERE n."idEmpresa" IS NOT NULL;

END;
$BODY$;