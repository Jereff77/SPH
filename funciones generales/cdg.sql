--[Descripción]: Función de desencriptación y ejecución de queries seguros (CDG)
-- [Propósito]: Permite ejecutar consultas SELECT encriptadas con doble capa de seguridad
--
-- [Entrada]: 
--   - p_encrypted_query (text): Query encriptado en base64
--   - p_partial_key (text): Parte de la clave de desencriptación (cliente)
--
-- [Salida]: json - Resultados del query ejecutado
--
-- [Uso típico]: Ejecutar consultas SELECT seguras desde el frontend
-- [Ejemplo]: SELECT cdg('encrypted_base64_query', 'client_partial_key')
--
-- [Mecanismo de seguridad]:
--   1. Clave compuesta: parte_servidor + parte_cliente
--   2. Solo permite consultas SELECT
--   3. Desencriptación XOR con SHA256
--   4. Validación de estructura del query

CREATE OR REPLACE FUNCTION public.cdg(p_encrypted_query text, p_partial_key text)
 RETURNS json
 LANGUAGE plpgsql
AS $BODY$
DECLARE
    v_result json;
    v_decrypted_query text;
    v_server_key_part text := 'JUVf12Mc73ZcxUfm1tmfiNSFpg7Dxi';
    v_complete_key text;
    v_padded_query text;
    v_combined_data bytea;
    v_iv bytea;
    v_encrypted_data bytea;
    v_key_hash bytea;
    v_decrypted bytea := '\x';
    i integer;
    xor_result integer;
BEGIN
    v_complete_key := v_server_key_part || p_partial_key;
    
    -- Restaurar padding base64
    v_padded_query := p_encrypted_query;
    WHILE length(v_padded_query) % 4 != 0 LOOP
        v_padded_query := v_padded_query || '=';
    END LOOP;
    
    v_combined_data := decode(v_padded_query, 'base64');
    v_key_hash := digest(v_complete_key::bytea, 'sha256');
    
    v_iv := substring(v_combined_data from 1 for 16);
    v_encrypted_data := substring(v_combined_data from 17);
    
    -- Desencriptar XOR simplificado
    FOR i IN 0..length(v_encrypted_data)-1 LOOP
        xor_result := get_byte(v_encrypted_data, i) # 
                     get_byte(v_key_hash, i % 32) # 
                     get_byte(v_iv, i % 16);
        v_decrypted := v_decrypted || set_byte('\x00'::bytea, 0, xor_result);
    END LOOP;
    
    v_decrypted_query := convert_from(v_decrypted, 'UTF8');
    
    -- Validar SELECT
    IF NOT UPPER(trim(v_decrypted_query)) LIKE 'SELECT%' THEN
        RAISE EXCEPTION 'Solo SELECT permitido';
    END IF;
    
    -- Ejecutar query
    EXECUTE 'SELECT COALESCE(json_agg(row_to_json(t)), ''[]''::json) FROM (' || 
            trim(v_decrypted_query) || ') t' INTO v_result;
    
    RETURN v_result;
    
EXCEPTION
    WHEN others THEN
        RAISE EXCEPTION 'CDG Error: %', SQLERRM;
END;
$BODY$;