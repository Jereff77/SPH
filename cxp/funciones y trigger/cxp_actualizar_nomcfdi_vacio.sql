--[Fecha y Hora]: 07/11/2025 09:15:30
--[Descripción]: Función que verifica si el campo nomCFDI está vacío después de insertar un registro
--                en la tabla cxp y, si es así, lo actualiza con el valor del campo nombreProveedor.
--
--[Parámetros]:
--   - Ninguno (se utiliza con NEW en el contexto del trigger)
--
--[Salida]:
--   - void: No devuelve valor, solo realiza actualizaciones en la tabla
--
--[Uso típico]: Se ejecuta automáticamente a través de un trigger AFTER INSERT
--               para asegurar que nomCFDI siempre tenga un valor válido.
--
--[Ejemplo]: No se llama directamente, se usa con el trigger trigger_cxp_actualizar_nomcfdi
--
--[Relaciones]: 
--   - Tabla: cxp
--   - Trigger: trigger_cxp_actualizar_nomcfdi
--
--[Validaciones]:
--   - Verifica si nomCFDI está vacío (NULL o cadena vacía)
--   - Solo actualiza si nombreProveedor tiene un valor válido

CREATE OR REPLACE FUNCTION public.cxp_actualizar_nomcfdi_vacio()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $BODY$
BEGIN
    --[Fecha y Hora]: 07/11/2025 09:15:30
    -- [Descripción]: Función trigger que se ejecuta después de insertar un registro en la tabla cxp
    --                Verifica si el campo nomCFDI está vacío y lo actualiza con nombreProveedor
    
    -- Verificar si nomCFDI está vacío (NULL o cadena vacía) y nombreProveedor tiene valor
    IF (NEW."nomCFDI" IS NULL OR NEW."nomCFDI" = '' OR NEW."nomCFDI" = 'EMPTY')
       AND NEW."nombreProveedor" IS NOT NULL
       AND NEW."nombreProveedor" != '' THEN
       
        -- Actualizar el campo nomCFDI con el valor de nombreProveedor
        -- y también actualizar fecCFDI con fecSolicitud solo si fecCFDI es NULL
        UPDATE public.cxp
        SET
            "nomCFDI" = NEW."nombreProveedor",
            "fecCFDI" = CASE
                WHEN NEW."fecCFDI" IS NULL AND NEW."fecSolicitud" IS NOT NULL
                THEN NEW."fecSolicitud"
                ELSE NEW."fecCFDI"
            END
        WHERE "idCxp" = NEW."idCxp";
        
        -- Actualizar también el valor en NEW para consistencia
        NEW."nomCFDI" := NEW."nombreProveedor";
        IF NEW."fecCFDI" IS NULL AND NEW."fecSolicitud" IS NOT NULL THEN
            NEW."fecCFDI" := NEW."fecSolicitud";
        END IF;
    END IF;
    
    RETURN NEW;
END;
$BODY$;