-- =====================================================================
-- Función: numero_ordinal_espanol
-- Descripción: Convierte un número entero a ordinal en español
-- Autor: Sistema
-- Fecha: 2026-01-08
-- =====================================================================

CREATE OR REPLACE FUNCTION public.numero_ordinal_espanol(
    p_numero INTEGER
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_ultima_cifra INTEGER;
    v_sufijo TEXT;
BEGIN
    -- Manejar casos especiales para números negativos o nulos
    IF p_numero IS NULL THEN
        RETURN NULL;
    END IF;
    
    IF p_numero < 0 THEN
        RAISE EXCEPTION 'El número debe ser positivo';
    END IF;
    
    -- Obtener la última cifra del número
    v_ultima_cifra := p_numero % 10;
    
    -- Determinar el sufijo basado en la última cifra
    CASE v_ultima_cifra
        WHEN 1 THEN v_sufijo := 'ra';
        WHEN 2 THEN v_sufijo := 'da';
        WHEN 3 THEN v_sufijo := 'ra';
        WHEN 4 THEN v_sufijo := 'ta';
        WHEN 5 THEN v_sufijo := 'ta';
        WHEN 6 THEN v_sufijo := 'ta';
        WHEN 7 THEN v_sufijo := 'ma';
        WHEN 8 THEN v_sufijo := 'va';
        WHEN 9 THEN v_sufijo := 'na';
        WHEN 0 THEN v_sufijo := 'ma';
        ELSE v_sufijo := 'ma';
    END CASE;
    
    -- Retornar el número con el sufijo ordinal
    RETURN p_numero::TEXT || v_sufijo;
END;
$$;

-- =====================================================================
-- Pruebas de la función
-- =====================================================================

-- Pruebas básicas
-- SELECT public.numero_ordinal_espanol(1);   -- Debería retornar "1ra"
-- SELECT public.numero_ordinal_espanol(2);   -- Debería retornar "2da"
-- SELECT public.numero_ordinal_espanol(3);   -- Debería retornar "3ra"
-- SELECT public.numero_ordinal_espanol(4);   -- Debería retornar "4ta"
-- SELECT public.numero_ordinal_espanol(5);   -- Debería retornar "5ta"
-- SELECT public.numero_ordinal_espanol(6);   -- Debería retornar "6ta"
-- SELECT public.numero_ordinal_espanol(7);   -- Debería retornar "7ma"
-- SELECT public.numero_ordinal_espanol(8);   -- Debería retornar "8va"
-- SELECT public.numero_ordinal_espanol(9);   -- Debería retornar "9na"
-- SELECT public.numero_ordinal_espanol(10);  -- Debería retornar "10ma"
-- SELECT public.numero_ordinal_espanol(11);  -- Debería retornar "11ra"
-- SELECT public.numero_ordinal_espanol(12);  -- Debería retornar "12da"
-- SELECT public.numero_ordinal_espanol(13);  -- Debería retornar "13ra"
-- SELECT public.numero_ordinal_espanol(14);  -- Debería retornar "14ta"
-- SELECT public.numero_ordinal_espanol(15);  -- Debería retornar "15ta"
-- SELECT public.numero_ordinal_espanol(16);  -- Debería retornar "16ta"
-- SELECT public.numero_ordinal_espanol(17);  -- Debería retornar "17ma"
-- SELECT public.numero_ordinal_espanol(18);  -- Debería retornar "18va"
-- SELECT public.numero_ordinal_espanol(19);  -- Debería retornar "19na"
-- SELECT public.numero_ordinal_espanol(20);  -- Debería retornar "20ma"
-- SELECT public.numero_ordinal_espanol(21);  -- Debería retornar "21ra"
-- SELECT public.numero_ordinal_espanol(22);  -- Debería retornar "22da"
-- SELECT public.numero_ordinal_espanol(23);  -- Debería retornar "23ra"
