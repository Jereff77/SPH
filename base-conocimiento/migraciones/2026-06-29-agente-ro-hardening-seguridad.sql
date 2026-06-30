-- =============================================================================
-- 2026-06-29 · HARDENING del agente text-to-SQL (tras validación de seguridad)
-- -----------------------------------------------------------------------------
-- Cierra 2 hallazgos ALTA + 2 medios encontrados por la validación adversarial:
--   ALTA-1: el parser de tablas del backend era ciego a `FROM a, b` (cross join con
--           coma) → se podía leer un módulo sin su clave. (Fix en backend +
--           refuerzo aquí: el rol ya no puede leer fuera de negocio.)
--   ALTA-2: el rol usaba LISTA NEGRA (GRANT ALL + REVOKE) → quedaban accesibles
--           lkr_cxp, catProveedores (cuentas bancarias), movbancarios, backups,
--           duplicados, n8n_*, etc. → se invierte a LISTA BLANCA.
--   MEDIA-1: funciones que ejecutan SQL/IO desde texto (query_to_xml, dblink,
--            pg_read_file…) evadían el control → se bloquean en la RPC.
--   BAJA-2: DoS por cross joins → statement_timeout del rol.
-- =============================================================================

-- 1) LISTA BLANCA: el rol v2_agente_ro solo lee tablas/vistas de NEGOCIO declaradas
--    en el mapa del backend (consultas.service.ts: MODULOS_DATOS + COMUNES).
REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM v2_agente_ro;
GRANT SELECT ON
  "inversionista","inversionista_docs","propiedades","naves","parques","pdp","pdpDetalle",
  "pagos","kvasAsignados","rgPdp","rgPdpDetalle","rgConceptos","raPdp","raPdpDetalle","raConceptos",
  "v_pdpdetalle","v_pagos","v_propiedades","v_naves","v_detClientes","v_disponibilidad","v_totales",
  "v_montoTotalAnual","v_pagosTotalAnual","v_sumMontosTotalesPagos","v_sumMontosTotalesPdpDet",
  "v_box_cumpl_pdp","v_configPdpDet","v_rentasAdministradas","v_rentasGarantizadas","v_rentasCombinadas",
  "arrePdp","arrePdpDetalle","arrenPropiedades","arre_pagos","arre_ordenante","arreConceptos",
  "v_arrendadasNaves","v_arreNavConPdp","v_arrenPdpMes","v_arrenPdpMesTotales","v_arrepdpdet_totales",
  "v_arreContratosUnMes","v_ContratosTresMeses","v_arrecontratosproximos",
  "cxp","cxp_ppd","cxp_fechas_habilitadas","catFacturas","catFacturasDocs","catProveedores",
  "catProveedores_docs","proveedoresDocsCFDI","facturasProveedor","comprobantesPago","movbancarios",
  "conciliacion","autorizaciones","Presupuestos","PresCategorias","PresDetalle","v_autorizaciones",
  "v_ResumenPagos","v_resumenPresupuesto",
  "fideicomiso","fideCondiciones","fideContabilidad","fideContaConceptos","fideContaHistorial",
  "fideDispersiones","fideMesDispersion","fidePdpDispersion","fideSaldosBanco","fide_periodos_dispersion",
  "v_fideicomiso","v_propiedadesfide",
  "catEmpresas","catInmobiliarias","catAsesoresInm","leads","leads_porAprobar","crm_lead_naves",
  "actividad","agenda","tareas","tareas_Notas","clasificaciones","crm_Etapas","crm_Origen","crm_campania",
  "crm_tipoCliente","crm_tipoOperaciones","crm_tipoVenta","crm_historial_etapas",
  "catParametros","catTipoMovimientos","catTipoOperacion","catBancos","catRegimenFiscal","catUsoCFDI",
  "catClavesProdServ","catGirosComerciales","catEstadosRG","inpc"
TO v2_agente_ro;

-- 2) statement_timeout (anti-DoS).
ALTER ROLE v2_agente_ro SET statement_timeout TO '5000';

-- 3) RPC con bloqueo de funciones SQL/IO-desde-texto (ver definición final aplicada en
--    la BD): agente_consulta_sql ahora rechaza QUERY_TO_XML|TABLE_TO_XML|DBLINK|
--    PG_READ_FILE|PG_LS_DIR|LO_IMPORT|LO_EXPORT|PG_SLEEP, además de DML/DDL/SET/comentarios.
--    (Definición completa en 2026-06-29-agente-consulta-sql-rol-ro.sql + este bloqueo.)

-- 4) (opcional, defensa en profundidad) agente_explain(query): EXPLAIN FORMAT JSON para
--    extraer las relaciones reales del plan; disponible para validación robusta futura.

-- NOTA / DEUDA: el aislamiento por-módulo en el backend usa un parser textual mejorado
-- (capta comas/subqueries/CTEs). Migrar a parser SQL real o validación por plan EXPLAIN
-- con expansión de vistas para blindarlo al 100%. La barrera DURA es la lista blanca.
