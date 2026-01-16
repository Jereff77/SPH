--[Fecha y Hora]: 16/10/2025 18:30:00
-- [Descripción]: Vista que proporciona un resumen completo de las empresas con sus estadísticas
--                de QRs, accesos y disponibilidad. Agrega datos de parques y calcula métricas.
--
-- [Tablas base]: 
--   - empresas (principal)
--   - qrEmpresas (relación)
--   - qrGenerados (accesos diarios)
--   - parques (información de parques)
--
-- [Campos calculados]:
--   - totalAsignados: Cantidad total de QRs diarios asignados
--   - disponibles: QRs diarios disponibles para hoy (totalAsignados - usados hoy)
--   - activosLigeros: QRs de vehículos ligeros activos (estado 1 o 2)
--   - activosCarga: QRs de vehículos de carga activos (estado 1 o 2)
--   - accesosUtilizados: QRs utilizados hoy (estado 3)
--   - accesosEnviados: Total de QRs enviados hoy (estados 1, 2, 3)
--   - navesAsignadas: Array JSON de objetos con idNave, numNaveNombre, idParque y nombreParque de todas las naves asignadas
--
-- [Uso típico]: Panel de control y reportes de empresas
-- [Ejemplo]: SELECT * FROM v_resumenempresas WHERE "idParque" = 'ID_PARQUE';
--
-- [Relaciones]:
--   - Función asociada: v_resumenempresas_buscar() (en empresas/funciones y trigger/)

CREATE OR REPLACE VIEW public.v_resumenempresas AS
 SELECT e."idEmpresa",
    e."nombreEmpresa",
    e."idParque",
    par."nomParque" AS "nombreParque",
    e."qrDiarios" AS "totalAsignados",
    e."qrDiarios" AS "QRdiarios",
    e."qrLigero" AS "QRLigeros",
    e."qrCarga" AS "QRCarga",
    GREATEST(e."qrDiarios" - COALESCE(qr_hoy.count, 0::bigint), 0::bigint) AS disponibles,
    COALESCE(sum(
        CASE
            WHEN qrg."tipoVehiculo" = 'ligero'::text AND (qrg.estado = ANY (ARRAY[1, 2])) THEN 1
            ELSE 0
        END), 0::bigint) AS "activosLigeros",
    COALESCE(sum(
        CASE
            WHEN qrg."tipoVehiculo" = 'carga'::text AND (qrg.estado = ANY (ARRAY[1, 2])) THEN 1
            ELSE 0
        END), 0::bigint) AS "activosCarga",
    COALESCE(sum(
        CASE
            WHEN qrg.estado = 3 THEN 1
            ELSE 0
        END), 0::bigint) AS "accesosUtilizados",
    COALESCE(sum(
        CASE
            WHEN qrg.estado = ANY (ARRAY[1, 2, 3]) THEN 1
            ELSE 0
        END), 0::bigint) AS "accesosEnviados",
    e.suspendida,
    (SELECT COALESCE(
        JSON_AGG(
            JSON_BUILD_OBJECT(
                'idNave', en."idNave",
                'numNaveNombre', n."numNaveNombre",
                'idParque', en."idParque",
                'nombreParque', p."nomParque"
            )
        ),
        '[]'::json
     )
     FROM "empresasNaves" en
     LEFT JOIN naves n ON n."idNave" = en."idNave"
     LEFT JOIN parques p ON p."idParque" = en."idParque"
     WHERE en."idEmpresa" = e."idEmpresa" AND en.status = true) AS "navesAsignadas"
   FROM empresas e
     LEFT JOIN "qrEmpresas" qre ON qre."idEmpresa" = e."idEmpresa"
     LEFT JOIN LATERAL ( SELECT count(*) AS count
           FROM "qrGenerados" qrg2
          WHERE qrg2."idQrEmpresas" = qre."idQrEmpresas" AND qrg2."fechaValidez" = CURRENT_DATE) qr_hoy ON true
     LEFT JOIN "qrGenerados" qrg ON qrg."idQrEmpresas" = qre."idQrEmpresas" AND qrg."fechaValidez" = CURRENT_DATE
     LEFT JOIN parques par ON par."idParque" = e."idParque"
  GROUP BY e."idEmpresa", e."nombreEmpresa", e."idParque", e."qrDiarios", e."qrLigero", e."qrCarga", par."nomParque", qr_hoy.count, e.suspendida