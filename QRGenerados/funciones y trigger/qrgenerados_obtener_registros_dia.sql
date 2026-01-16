--[Fecha y Hora]: 11/11/2025 08:05:00
--[Descripción]: Función para obtener los registros de accesos del día actual.
--                Genera un registro por cada evento (entrada o salida) del día.
--
--[Parámetros]: No requiere parámetros
--
--[Salida]:
--   - TABLE: Conjunto de registros con información completa de accesos del día
--     - idQR: UUID del registro
--     - claveAcceso: Clave de acceso de 15 caracteres
--     - nombreVisitante: Nombre completo del visitante
--     - placasVehiculo: Placas del vehículo
--     - tipoVehiculo: Tipo de vehículo
--     - fecha_evento: Fecha/hora del evento (entrada o salida)
--     - tipo_evento: 'Entrada' o 'Salida'
--     - estado: Estado del proceso (1=Pendiente, 2=En uso, 3=Terminada)
--     - urlIdentificacion: URL de identificación del visitante
--
--[Uso típico]: Se utiliza para generar reportes diarios de accesos,
--               mostrar visitantes en instalaciones y controlar flujo de personas.
--
--[Ejemplo]: SELECT * FROM qrgenerados_obtener_registros_dia();
--
--[Relaciones]:
--   - Tabla qrGenerados: Contiene los códigos y registros de acceso
--   - Tabla datosVisitantes: Proporciona información del visitante
--
--[Validaciones]:
--   - Filtra registros donde fecEntrada o fecSalida sean del día actual
--   - Genera un registro por cada evento (entrada y/o salida)
--   - Muestra las fechas exactamente como están almacenadas en la tabla

CREATE OR REPLACE FUNCTION public.qrgenerados_obtener_registros_dia()
 RETURNS TABLE (
    id_qr UUID,
    clave_acceso TEXT,
    nombre_visitante TEXT,
    id_empresa UUID,
    nombre_empresa TEXT,
    id_parque TEXT,
    placas_vehiculo TEXT,
    tipo_vehiculo TEXT,
    fecha_evento TIMESTAMP WITHOUT TIME ZONE,
    tipo_evento TEXT,
    estado INTEGER,
    url_identificacion TEXT
 )
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $BODY$
BEGIN
    --[Fecha y Hora]: 11/11/2025 17:36:00
    -- [Descripción]: Función para obtener registros de accesos del día actual
    -- [Salida]: TABLE con registros del día mostrando un registro por evento
    -- [Uso]: SELECT * FROM qrgenerados_obtener_registros_dia();
    
    RETURN QUERY
    SELECT * FROM (
        -- Registros de entrada
        SELECT
            qr."idQR",
            qr."claveAcceso",
            COALESCE(dv."nomVisitante", '') as "nomVisitante",
            emp."idEmpresa" as "idEmpresa",
            COALESCE(emp."nombreEmpresa", '') as "nombreEmpresa",
            emp."idParque" as "idParque",
            COALESCE(qr."placasVehiculo", '') as "placasVehiculo",
            COALESCE(qr."tipoVehiculo", '') as "tipoVehiculo",
            qr."fecEntrada" as "fecha_evento",
            'Entrada' as "tipo_evento",
            qr."estado",
            COALESCE(dv."urlIdentificacion", '') as "urlIdentificacion"
        FROM public."qrGenerados" qr
        LEFT JOIN public."datosVisitantes" dv ON qr."idVisitante" = dv."idVisitante"
        LEFT JOIN public."qrEmpresas" qre ON qr."idQrEmpresas" = qre."idQrEmpresas"
        LEFT JOIN public."empresas" emp ON qre."idEmpresa" = emp."idEmpresa"
        WHERE qr."fecEntrada" IS NOT NULL
        AND DATE(qr."fecEntrada") = CURRENT_DATE
        
        UNION ALL
        
        -- Registros de salida
        SELECT
            qr."idQR",
            qr."claveAcceso",
            COALESCE(dv."nomVisitante", '') as "nomVisitante",
            emp."idEmpresa" as "idEmpresa",
            COALESCE(emp."nombreEmpresa", '') as "nombreEmpresa",
            emp."idParque" as "idParque",
            COALESCE(qr."placasVehiculo", '') as "placasVehiculo",
            COALESCE(qr."tipoVehiculo", '') as "tipoVehiculo",
            qr."fecSalida" as "fecha_evento",
            'Salida' as "tipo_evento",
            qr."estado",
            COALESCE(dv."urlIdentificacion", '') as "urlIdentificacion"
        FROM public."qrGenerados" qr
        LEFT JOIN public."datosVisitantes" dv ON qr."idVisitante" = dv."idVisitante"
        LEFT JOIN public."qrEmpresas" qre ON qr."idQrEmpresas" = qre."idQrEmpresas"
        LEFT JOIN public."empresas" emp ON qre."idEmpresa" = emp."idEmpresa"
        WHERE qr."fecSalida" IS NOT NULL
        AND DATE(qr."fecSalida") = CURRENT_DATE
    ) AS todos_eventos
    ORDER BY fecha_evento DESC;
    
    RETURN;
END;
$BODY$;