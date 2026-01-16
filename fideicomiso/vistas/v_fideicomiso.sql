--[Fecha y Hora]: 31/12/2025 11:05:00
--[Descripción]: Vista que muestra información consolidada de fideicomisos con datos relacionados
--                de propiedades, inversionistas y planes de pago.
--
--[Propósito]: Proporcionar una vista unificada para consultar información de fideicomisos
--              junto con sus propiedades asociadas, inversionistas y planes de pago.
--
--[Campos]:
--   - idfide: ID del fideicomiso (de fideCondiciones."idfideCond")
--   - "idPropiedad": ID de la propiedad
--   - "noAdhesion": Número de adhesión
--   - "PM": Porcentaje de mantenimiento
--   - "Medio": Tipo de medio
--   - "Apartado": Estado de apartado
--   - rendimiento: Rendimiento del fideicomiso
--   - comentarios: Comentarios adicionales
--   - uid: UUID del usuario responsable
--   - "idInversionista": ID del inversionista
--   - "nomDescriptivo": Nombre descriptivo de la propiedad
--   - bloque: Últimos 2 caracteres del nombre descriptivo
--   - razonsocial: Razón social del inversionista
--   - monto: Monto del plan de pago
--   - cantpagos: Cantidad de pagos
--   - fecha: Fecha del primer pago del plan
--
--[Uso típico]: Consultas de reportes y listados de fideicomisos con información relacionada
--
--[Ejemplo]: 
--   -- Consultar todos los fideicomisos
--   SELECT * FROM v_fideicomiso ORDER BY razonsocial;
--   
--   -- Filtrar por inversionista específico
--   SELECT * FROM v_fideicomiso WHERE "idInversionista" = 'ID_INVERSIONISTA';
--   
--   -- Filtrar por rango de montos
--   SELECT * FROM v_fideicomiso WHERE monto BETWEEN 100000 AND 500000;
--
--[Relaciones]: 
--   - Tablas base: fideCondiciones, propiedades, inversionista, pdp, pdpDetalle
--   - Joins realizados:
--     * fideCondiciones LEFT JOIN propiedades (por idPropiedad)
--     * propiedades LEFT JOIN inversionista (por idInversionista)
--     * propiedades LEFT JOIN pdp (por idPropiedad)
--   - Subquery para obtener el primer pago de pdpDetalle
--
--[Consideraciones]:
--   - La vista muestra solo el primer pago de cada plan de pago
--   - Ordena los resultados por razonsocial del inversionista
--   - Utiliza LEFT JOIN para incluir registros aunque no tengan relaciones
--   - El campo "bloque" se deriva de los últimos 2 caracteres de nomDescriptivo

CREATE OR REPLACE VIEW v_fideicomiso AS
 SELECT f."idfideCond" AS idfide,
    f."idPropiedad",
    f."noAdhesion",
    f."PM",
    f."Medio",
    f."Apartado",
    f.rendimiento,
    f.comentarios,
    f.uid,
    p."idInversionista",
    p."nomDescriptivo",
    "right"(p."nomDescriptivo", 2) AS bloque,
    i.razonsocial,
    pdp.monto,
    pdp.cantpagos,
    ( SELECT "pdpDetalle".fecha
           FROM "pdpDetalle"
          WHERE ("pdpDetalle"."idPdp" = pdp."idPdp")
          ORDER BY "pdpDetalle"."numPago"
         LIMIT 1) AS fecha
   FROM (("fideCondiciones" f
     LEFT JOIN propiedades p ON ((p."idPropiedad" = f."idPropiedad")))
     LEFT JOIN inversionista i ON ((i."idInversionista" = p."idInversionista")))
     LEFT JOIN pdp ON ((pdp."idPropiedad" = p."idPropiedad"))
  ORDER BY i.razonsocial;
