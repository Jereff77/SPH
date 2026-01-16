--[Fecha y Hora]: 21/10/2025 23:47:00
--[Descripción]: Calcula automáticamente la cantidad solo cuando pm2 > 0
--                Cuando pm2 = 0, respeta el valor manual ingresado
--
--[Parámetros]: 
--   - NEW (record): Registro nuevo o modificado de la tabla arrePdpDetalle
--
--[Salida]: RECORD - Registro modificado con cantidad calculada o valor manual preservado
--
--[Lógica]: Si pm2 > 0 → calcula automáticamente
--           Si pm2 = 0 → mantiene valor manual
--
--[Trigger]: BEFORE INSERT OR UPDATE en arrePdpDetalle
--
--[Uso]: Se ejecuta automáticamente en inserts/updates
--
--[Fórmula de cálculo]: ((pm2 * "constM2") * ((1) + (("INPC" + "ptsINPC") / (100))))
--
--[Relaciones]: 
--   - Tabla principal: public."arrePdpDetalle"
--
--[Validaciones]:
--   - Solo calcula cuando pm2 > 0
--   - Preserva valores manuales cuando pm2 = 0
--
--[Trigger asociado]: trigger_arrepdpdetalle_calcular_cantidad
--
--[Consideraciones]:
--   - Función trigger que se ejecuta automáticamente
--   - Permite manejo mixto: automático y manual
--   - Respeta valores manuales cuando se establece pm2 = 0
--
--[Notas importantes]:
--   - Esta función es llamada por el trigger trigger_arrepdpdetalle_calcular_cantidad
--   - No debe ejecutarse manualmente
--   - El cálculo incluye INPC y ptsINPC como porcentajes de ajuste
--   - Cuando pm2 es 0, se asume que la cantidad será establecida manualmente

CREATE OR REPLACE FUNCTION public.arrepdpdetalle_calcular_cantidad()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $BODY$
BEGIN
    -- [Descripción]: Calcula automáticamente la cantidad solo cuando pm2 > 0
    --                Cuando pm2 = 0, respeta el valor manual ingresado
    -- [Lógica]: Si pm2 > 0 → calcula automáticamente
    --           Si pm2 = 0 → mantiene valor manual
    -- [Trigger]: BEFORE INSERT OR UPDATE en arrePdpDetalle
    -- [Uso]: Se ejecuta automáticamente en inserts/updates
    
    -- Solo calcular cuando pm2 > 0
    IF NEW.pm2 > 0 THEN
        NEW.cantidad := ((NEW.pm2 * NEW."constM2") * 
                        ((1)::double precision + 
                        ((NEW."INPC" + NEW."ptsINPC") / (100)::double precision)));
    END IF;
    
    -- Si pm2 = 0, NEW.cantidad mantiene el valor que se insertó/actualizó manualmente
    
    RETURN NEW;
END;
$BODY$;