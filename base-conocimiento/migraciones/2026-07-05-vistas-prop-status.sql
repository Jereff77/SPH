-- 2026-07-05 · Prerequisito de la baja lógica de VENTAS (Fase B trazabilidad de la nave)
--
-- Blinda las dos vistas de listado de naves para que NO muestren como "fantasma" las
-- propiedades dadas de baja (propiedades.status=false). Antes hacían LEFT JOIN a
-- `propiedades` SIN filtrar status, así que una nave cuyo ticket/propiedad fue eliminado
-- seguía apareciendo con su inversionista (en Parques) u ocupada (en Disponibilidad),
-- aunque la nave física estuviera libre. Al pasar `desvincularNave` a baja lógica, esos
-- fantasmas se multiplicarían; por eso este fix es prerequisito.
--
-- Único cambio en cada vista: `AND prop.status = true` en el LEFT JOIN a `propiedades`.
-- (El `arren.status = true` de v_naves ya estaba.) NO toca cálculos de pagos/dispersiones
-- (esos salen de pagos/v_pagos/fidePdpDispersion, no de estas vistas). Reversible.
--
-- Gotcha preservado: v_naves NO tiene security_invoker; v_disponibilidad SÍ.

CREATE OR REPLACE VIEW public.v_naves AS
 SELECT COALESCE(prop."idInversionista", ''::text) AS "idInversionista",
    COALESCE(i.razonsocial, ''::text) AS razonsocial,
    COALESCE(arren."idArrendador", ''::text) AS "idArrendador",
    COALESCE(prop."nomDescriptivo", ''::text) AS "nomDescriptivo",
    COALESCE(parq."nomParque", ''::text) AS "nomParque",
    COALESCE(prop."tienenPdp", false) AS "tienePdp",
    COALESCE(prop."pdpActivo", false) AS "pdpActivo",
    n."idUser", n.fc, n.status, n."idNave", n."idParque", n.situacion,
    n.lote, n.mza, n.terreno, n.construccion, n.precio, n."fecEntrega",
    n."numNave", n.fum, n."fumUser", n."numNaveNAME"
   FROM naves n
     LEFT JOIN propiedades prop
       ON prop."idNave" = n."idNave" AND prop.status = true
     LEFT JOIN inversionista i ON i."idInversionista" = prop."idInversionista"
     LEFT JOIN parques parq ON parq."idParque" = n."idParque"
     LEFT JOIN "arrenPropiedades" arren
       ON arren."idNave" = n."idNave" AND arren.status = true
  ORDER BY i.razonsocial;

CREATE OR REPLACE VIEW public.v_disponibilidad
WITH (security_invoker = on) AS
 SELECT n."idNave", n."idParque", p."nomParque",
    prop."idPropiedad", prop."idInversionista", inv.razonsocial AS nombre,
    n."numNave", n."numNaveNAME", n.situacion, n.lote, n.mza, n.terreno, n.construccion
   FROM naves n
     LEFT JOIN parques p ON n."idParque" = p."idParque"
     LEFT JOIN propiedades prop
       ON n."idNave" = prop."idNave" AND prop.status = true
     LEFT JOIN inversionista inv ON prop."idInversionista" = inv."idInversionista"
  ORDER BY p."nomParque", n."numNave";
