-- v2.55.1 — Corrige la vista v_naves (módulo Parques).
--
-- Problema 1 (crítico): el LEFT JOIN a "arrenPropiedades" no filtraba status=true,
-- por lo que cualquier vínculo de renta YA CERRADO (histórico) seguía apareciendo
-- como si la nave estuviera ocupada, y si una nave tenía más de un vínculo en
-- "arrenPropiedades" (activo o no), la nave se DUPLICABA en la pantalla (una fila
-- por cada vínculo). Verificado en prod contra "Prueba Parque": 6 de 10 naves
-- mostraban un arrendatario ya desvinculado; reproducido en vivo por el usuario al
-- vincular/desvincular una nave de prueba (quedó mostrada 2 veces).
--
-- Problema 2 (secundario): "parq" (parques) se unía por prop."idParque" (el parque
-- de la PROPIEDAD/dueño) en vez de n."idParque" (el parque real de la NAVE). Si la
-- nave no tenía propiedad (la mayoría), "nomParque" salía vacío aunque la nave sí
-- perteneciera a un parque.
--
-- Ningún otro objeto de BD depende de v_naves (verificado con pg_depend y búsqueda
-- en el código fuente de todas las funciones). Consumidores: ParquesService
-- (listarNavesDeParque/obtenerNave) y el Agente de IA de Soporte (solo lectura,
-- rol v2_agente_ro). Verificado que hoy ningún vínculo activo se duplica (a lo
-- sumo 1 fila con status=true por nave en arrenPropiedades) y ninguna nave tiene
-- más de 1 fila en propiedades, así que basta el filtro simple (sin blindaje
-- adicional tipo LATERAL+LIMIT 1).
--
-- Aplicada ya en prod el 2026-07-04 (autorizada, verificada: 0 naves duplicadas en
-- todo el sistema tras el cambio). Este archivo documenta el estado actual para
-- que quede como fuente de verdad versionada.

CREATE OR REPLACE VIEW v_naves AS
SELECT
    COALESCE(prop."idInversionista", '') AS "idInversionista",
    COALESCE(i.razonsocial, '') AS razonsocial,
    COALESCE(arren."idArrendador", '') AS "idArrendador",
    COALESCE(prop."nomDescriptivo", '') AS "nomDescriptivo",
    COALESCE(parq."nomParque", '') AS "nomParque",
    COALESCE(prop."tienenPdp", false) AS "tienePdp",
    COALESCE(prop."pdpActivo", false) AS "pdpActivo",
    n."idUser", n.fc, n.status, n."idNave", n."idParque", n.situacion, n.lote, n.mza,
    n.terreno, n.construccion, n.precio, n."fecEntrega", n."numNave", n.fum, n."fumUser", n."numNaveNAME"
FROM naves n
LEFT JOIN propiedades prop ON prop."idNave" = n."idNave"
LEFT JOIN inversionista i ON i."idInversionista" = prop."idInversionista"
LEFT JOIN parques parq ON parq."idParque" = n."idParque"              -- FIX #2: antes prop."idParque"
LEFT JOIN "arrenPropiedades" arren
       ON arren."idNave" = n."idNave" AND arren.status = true         -- FIX #1: antes sin filtro de status
ORDER BY i.razonsocial;
