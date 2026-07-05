import { z } from 'zod';

const FECHA = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (yyyy-MM-dd).');

/**
 * Crear un Plan de Pago de arrendamiento (arrePdp) para una nave ya vinculada al
 * arrendatario (`arrenPropiedades`). El backend orquesta las 3 RPCs:
 * `arrepdp_crear_plan_simple_rpc` → `arrepdp_generar_corrida_desde_plan_simple`
 * → `arrepdpdetalle_aplicar_meses_gracia`. Replica el botón "Crear" de v1
 * (`arre_pdp_widget`). Las cortesías son meses de gracia por concepto.
 */
export const crearPlanRentaSchema = z.object({
  /**
   * idInversionista del arrendatario (gotcha: idArrendador = idInversionista).
   * El `idNavArrend` NO va en el body: viaja en la ruta
   * (`/propiedades/:idNavArrend/planes`) y lo inyecta el controller.
   */
  idArrendador: z.string().trim().min(1, 'Falta el arrendatario.'),
  fecInicio: FECHA,
  plazo: z.coerce.number().int().positive('El plazo debe ser mayor a 0.'),
  m2Construccion: z.coerce.number().positive('La construcción (m²) debe ser mayor a 0.'),
  deposito: z.coerce.number().min(0).default(0),
  precioM2: z.coerce.number().min(0).default(0),
  pm2Admin: z.coerce.number().min(0).default(0),
  pm2Mtto: z.coerce.number().min(0).default(0),
  pm2Vig: z.coerce.number().min(0).default(0),
  inpcPlus: z.coerce.number().min(0).default(0),
  moneda: z.enum(['MXN', 'USD']).default('MXN'),
  /** Meses de gracia (cortesías) por concepto; admiten medios meses. */
  cortesiaRenta: z.coerce.number().min(0).default(0),
  cortesiaAdmin: z.coerce.number().min(0).default(0),
  cortesiaMtto: z.coerce.number().min(0).default(0),
  cortesiaVig: z.coerce.number().min(0).default(0),
});
export type CrearPlanRentaDto = z.infer<typeof crearPlanRentaSchema>;

/** Campos editables manualmente por partida del detalle (doble clic en v1). */
export const CAMPOS_EDITABLES = ['pm2', 'constM2', 'INPC', 'ptsINPC'] as const;

/**
 * Editar un campo de la corrida a partir de un año (RPC
 * `arrepdpdetalle_actualizar_campo_manual`). Solo si el plan está vigente.
 */
export const editarCampoSchema = z.object({
  anioDesde: z.coerce.number().int(),
  concepto: z.string().trim().min(1, 'Falta el concepto.').max(120),
  campo: z.enum(CAMPOS_EDITABLES),
  valor: z.coerce.number(),
});
export type EditarCampoDto = z.infer<typeof editarCampoSchema>;

/** Conceptos predefinidos del KVA/adecuación (1/2) o texto libre. */
export const conceptoFinanciadoSchema = z.object({
  concepto: z.string().trim().min(1, 'El concepto es obligatorio.').max(120),
  monto: z.coerce.number().positive('El monto debe ser mayor a 0.'),
  mesInicio: z.coerce.number().int().min(0),
  periodo: z.coerce.number().int().positive('El periodo debe ser mayor a 0.'),
  /** Si se divide (prorratea) entre los meses del periodo. */
  dividir: z.coerce.boolean().default(true),
});
export type ConceptoFinanciadoDto = z.infer<typeof conceptoFinanciadoSchema>;

/**
 * Renovar un plan: crea un plan de renovación que sucede al actual (la
 * `fecInicio` la calcula la BD = fin del actual + 1 día). Los valores se precargan
 * con los del último mes del plan anterior y el usuario puede ajustarlos.
 */
export const renovarPlanSchema = z.object({
  plazo: z.coerce.number().int().positive('El plazo debe ser mayor a 0.'),
  m2Construccion: z.coerce.number().positive('La construcción (m²) debe ser mayor a 0.'),
  deposito: z.coerce.number().min(0).default(0),
  precioM2: z.coerce.number().min(0).default(0),
  pm2Admin: z.coerce.number().min(0).default(0),
  pm2Mtto: z.coerce.number().min(0).default(0),
  pm2Vig: z.coerce.number().min(0).default(0),
  inpcPlus: z.coerce.number().min(0).default(0),
  moneda: z.enum(['MXN', 'USD']).default('MXN'),
  cortesiaRenta: z.coerce.number().min(0).default(0),
  cortesiaAdmin: z.coerce.number().min(0).default(0),
  cortesiaMtto: z.coerce.number().min(0).default(0),
  cortesiaVig: z.coerce.number().min(0).default(0),
});
export type RenovarPlanDto = z.infer<typeof renovarPlanSchema>;

/**
 * Cancelación anticipada de un plan: termina el contrato antes de su `fecFin`.
 * A partir de la partida de corte (inclusive) se dejan de cobrar los meses
 * (baja lógica); la nave se libera. El backend revalida que el plan esté activo
 * y vigente y que el corte no caiga en/antes de un mes ya pagado.
 * (RPC `v2_arrepdp_cancelar_anticipado`.)
 */
export const cancelarAnticipadoSchema = z.object({
  /** Primera partida (mes) que YA NO se cobra; se conservan las anteriores. */
  numPartidaCorte: z.coerce.number().int().positive('La partida de corte debe ser mayor a 0.'),
  motivo: z.string().trim().min(1, 'El motivo es obligatorio.').max(400),
});
export type CancelarAnticipadoDto = z.infer<typeof cancelarAnticipadoSchema>;

/** Vincular una nave a un arrendatario (Config → Propiedades). */
export const vincularNaveArreSchema = z.object({
  idArrendador: z.string().trim().min(1, 'Falta el arrendatario.'),
  idNave: z.string().trim().min(1, 'Falta la nave.'),
  idParque: z.string().trim().optional().or(z.literal('')),
});
export type VincularNaveArreDto = z.infer<typeof vincularNaveArreSchema>;

/**
 * Liberar una nave arrendada (Config → Propiedades). El `motivo` es opcional pero
 * recomendado: alimenta la trazabilidad de la nave (se guarda en `motivoBaja` y lo
 * audita `trg_auditoria`). El actor y la fecha los toma la auditoría del JWT.
 */
export const liberarNaveArreSchema = z.object({
  motivo: z.string().trim().max(400).optional().default(''),
});
export type LiberarNaveArreDto = z.infer<typeof liberarNaveArreSchema>;

/** Metadatos de un documento del arrendatario (bucket `Documentos`). */
export const docArreSchema = z.object({
  idInversionista: z.string().trim().min(1, 'Falta el arrendatario.'),
  titulo: z.string().trim().min(1, 'El título es obligatorio.').max(160),
  descripcion: z.string().trim().max(400).optional().default(''),
});
export type DocArreDto = z.infer<typeof docArreSchema>;

/**
 * Aplicar un depósito bancario a una o más partidas del detalle (cobranza). El
 * backend valida importe ≥ suma de partidas y delega en
 * `aplicar_pago_arrendatario` (transaccional). Replica el modal del dashboard v1.
 */
export const aplicarPagoSchema = z.object({
  idmov: z.string().trim().min(1, 'Falta el movimiento bancario.'),
  idsDetalle: z.array(z.string().trim().min(1)).min(1, 'Selecciona al menos una partida.'),
  fecPago: FECHA,
});
export type AplicarPagoDto = z.infer<typeof aplicarPagoSchema>;

/** Desaplicar (revertir) un pago, identificado por su `uidPago`. */
export const desaplicarPagoSchema = z.object({
  uidPago: z.string().trim().min(1, 'Falta el identificador del pago.'),
  motivo: z.string().trim().max(500).optional(),
});
export type DesaplicarPagoDto = z.infer<typeof desaplicarPagoSchema>;

/** Quitar la sugerencia (mapeo ordenante↔arrendatario) de `arre_ordenante`. */
export const quitarSugerenciaSchema = z.object({
  idArrePdp: z.string().trim().min(1, 'Falta el plan del arrendatario.'),
  ordenante: z.string().trim().min(1, 'Falta el ordenante.'),
});
export type QuitarSugerenciaDto = z.infer<typeof quitarSugerenciaSchema>;

/** Agregar un concepto libre (penalización/interés) a la partida (mes/nave) de referencia. */
export const agregarConceptoPartidaSchema = z.object({
  /** idArrePdpDet de una partida existente de esa nave-mes (para copiar el contexto). */
  idArrePdpDet: z.string().trim().min(1, 'Falta la partida de referencia.'),
  concepto: z.string().trim().min(1, 'El concepto es obligatorio.').max(120),
  monto: z.coerce.number().positive('El monto debe ser mayor a 0.'),
});
export type AgregarConceptoPartidaDto = z.infer<typeof agregarConceptoPartidaSchema>;
