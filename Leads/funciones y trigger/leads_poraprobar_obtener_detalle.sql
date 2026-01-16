--[Fecha y Hora]: 03/12/2025 11:46:00
--[Descripción]: Función que obtiene todos los leads pendientes de aprobación
--                con información detallada incluyendo relaciones con tablas catálogo.
--
--[Parámetros]: No requiere parámetros de entrada
--
--[Salida]: TABLE con estructura completa que incluye:
--   - Datos principales del lead (id, nombre, contacto, etc.)
--   - Campos de clasificación (etapa, origen, tipo cliente, etc.)
--   - Información de relaciones (usuarios, inmobiliaria, asesor)
--   - Campos descriptivos de catálogos para facilitar visualización
--
--[Uso típico]: Se utiliza para obtener la lista completa de leads que están
--               pendientes de aprobación (campo aprobado = NULL) con toda
--               la información necesaria para su evaluación y decisión.
--
--[Ejemplo]:
--   -- Obtener todos los leads pendientes
--   SELECT * FROM leads_poraprobar_obtener_detalle();
--
--   -- Filtrar por teléfono específico
--   SELECT * FROM leads_poraprobar_obtener_detalle()
--   WHERE telefono IS NOT NULL;
--
--   -- Ordenar por fecha de registro
--   SELECT * FROM leads_poraprobar_obtener_detalle()
--   ORDER BY "fechaRegistro" DESC;
--
--[Relaciones]:
--   - Tabla principal: "leads_porAprobar"
--   - catUsers (ur): Usuario que registró el lead (uidr = uid)
--   - catUsers (rc): Responsable comercial asignado (uidRC = uid)
--   - catInmobiliarias: Inmobiliaria asociada (idInmobiliaria)
--   - catAsesoresInm: Asesor inmobiliario (idAsesorInm)
--   - crm_Etapas: Etapa actual del lead (idEtapa)
--   - crm_Origen: Origen de donde provino el lead (idOrigen)
--   - crm_tipoCliente: Tipo de cliente (idTipoCliente)
--   - crm_tipoOperaciones: Tipo de operación (idTipoOperacion)
--   - crm_tipoVenta: Tipo específico de venta (idTipoVenta)
--
--[Validaciones]:
--   - Filtra automáticamente solo los registros con aprobado IS NULL
--   - Usa LEFT JOIN para incluir leads aunque no tengan todas las relaciones completas
--   - Ordena por fechaRegistro DESC para mostrar los más recientes primero
--
--[Consideraciones de rendimiento]:
--   - Los LEFT JOIN pueden impactar rendimiento con grandes volúmenes de datos
--   - Se recomienda indexar los campos de FK utilizados en los JOIN
--   - Para consultas específicas, filtrar por campos específicos en lugar de cargar todo
--
--[Triggers asociados]: Ninguno (función de consulta independiente)
--
--[Manejo de errores]:
--   - No genera errores si faltan relaciones (gracias a LEFT JOIN)
--   - Retorna conjunto vacío si no hay leads pendientes
--
--[Consideraciones de seguridad]:
--   - Función tipo SECURITY INVOKER (ejecuta con permisos del usuario)
--   - El acceso a los datos está controlado por políticas RLS de las tablas base
--   - Los usuarios solo verán los leads permitidos por las políticas RLS

CREATE OR REPLACE FUNCTION public.leads_poraprobar_obtener_detalle()
 RETURNS TABLE(
    id uuid,
    uidr uuid,
    status boolean,
    fc timestamp without time zone,
    "nombreLead" text,
    telefono text,
    correo text,
    "idInmobiliaria" uuid,
    "fechaContacto" timestamp without time zone,
    "fechaRegistro" timestamp with time zone,
    mensaje text,
    "KVAs" text,
    superficie text,
    ubicacion text,
    "uidRC" uuid,
    "idEtapa" bigint,
    "idOrigen" bigint,
    "idTipoCliente" bigint,
    "idTipoOperacion" bigint,
    "idTipoVenta" bigint,
    "Etapa" text,
    "Origen" text,
    "tipoCliente" text,
    "tipoOperacion" text,
    "tipoVenta" text,
    "nomRC" text,
    valor double precision,
    aprobado boolean,
    "nombreRegistro" text,
    "nombreInmobiliaria" text,
    "nombreAsesorInm" text,
    "tituloEtapa" text,
    "tituloOrigen" text,
    "tituloTipoCliente" text,
    "tituloTipoOperacion" text,
    "tituloTipoVenta" text
 )
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $BODY$
BEGIN
    -- [Fecha y Hora]: 20/10/2025 08:22:00
    -- [Descripción]: Retorna todos los leads pendientes de aprobación con 
    --                información completa de tablas relacionadas usando LEFT JOIN.
    --
    -- [Retorna]: TABLE con estructura completa para facilitar el consumo
    --           desde aplicaciones frontend o reportes.
    --
    -- [Consideraciones]: 
    --   - Usa LEFT JOIN para incluir todos los leads aunque falten relaciones
    --   - Filtra automáticamente aprobado IS NULL para mostrar solo pendientes
    --   - Incluye campos descriptivos tanto de la tabla principal como de catálogos
    
    RETURN QUERY
    SELECT
      lpa.id,
      lpa.uidr,
      lpa.status,
      lpa.fc,
      lpa."nombreLead",
      lpa.telefono,
      lpa.correo,
      lpa."idInmobiliaria",
      lpa."fechaContacto",
      lpa."fechaRegistro",
      lpa.mensaje,
      lpa."KVAs",
      lpa.superficie,
      lpa.ubicacion,
      lpa."uidRC",
      lpa."idEtapa",
      lpa."idOrigen",
      lpa."idTipoCliente",
      lpa."idTipoOperacion",
      lpa."idTipoVenta",
      lpa."Etapa",
      lpa."Origen",
      lpa."tipoCliente",
      lpa."tipoOperacion",
      lpa."tipoVenta",
      lpa."nomRC",
      lpa.valor,
      lpa.aprobado,
      ur."nomCompleto" as "nombreRegistro",
      ci.nombre as "nombreInmobiliaria",
      ai.nombre as "nombreAsesorInm",
      ce."titulo" as "tituloEtapa",
      co."titulo" as "tituloOrigen",
      ctc."titulo" as "tituloTipoCliente",
      cto."titulo" as "tituloTipoOperacion",
      ctv."titulo" as "tituloTipoVenta"
    FROM
      "leads_porAprobar" lpa
      LEFT JOIN public."catUsers" ur ON lpa.uidr = ur.uid
      LEFT JOIN public."catUsers" rc ON lpa."uidRC" = rc.uid
      LEFT JOIN public."catInmobiliarias" ci ON lpa."idInmobiliaria" = ci."idInmobiliaria"
      LEFT JOIN public."crm_Etapas" ce ON lpa."idEtapa" = ce.id
      LEFT JOIN public."crm_Origen" co ON lpa."idOrigen" = co.id
      LEFT JOIN public."crm_tipoCliente" ctc ON lpa."idTipoCliente" = ctc.id
      LEFT JOIN public."crm_tipoOperaciones" cto ON lpa."idTipoOperacion" = cto.id
      LEFT JOIN public."crm_tipoVenta" ctv ON lpa."idTipoVenta" = ctv.id
      LEFT JOIN public."catAsesoresInm" ai ON lpa."idAsesorInm" = ai.id
    WHERE
      lpa.aprobado IS NULL
    ORDER BY
      lpa."fechaRegistro" DESC;
      
    RETURN;
END;
$BODY$;