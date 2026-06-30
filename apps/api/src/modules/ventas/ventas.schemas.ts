import { z } from 'zod';

const FECHA = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (yyyy-MM-dd).');

/**
 * Registrar un pago contra una parcialidad (`pdpDetalle`). Replica
 * `PagosRealizarWidget`/`RealizarPagoTicketWidget` de v1: tipo de movimiento
 * (1=Terreno, 2=Construcción, 3=Ticket) y operación (1=Pago, 2=Descuento,
 * 3=Devolución). El backend resuelve idPdp/idPropiedad/numPago a partir del
 * `idPdpDet`. La **Devolución** se persiste con `monto`/`iva`/`montosiniva` en
 * **negativo** (resta del pagado), ver `PagosVentaService.registrarPago`.
 */
export const registrarPagoSchema = z.object({
  tipomovimiento: z.coerce.number().int().min(1).max(3),
  tipoOperacion: z.coerce.number().int().min(1).max(3).default(1),
  fecha: FECHA,
  // El signo lo decide la OPERACIÓN (el servicio toma la magnitud con Math.abs);
  // aquí solo se valida que NO sea cero. Una Devolución capturada en negativo o
  // en positivo termina igual: persistida en negativo.
  monto: z.coerce.number().refine((n) => n !== 0, 'El monto debe ser distinto de 0.'),
  /** IVA incluido en el monto (para Ticket); 0 si no aplica. Se usa su magnitud. */
  iva: z.coerce.number().optional().default(0),
});
export type RegistrarPagoDto = z.infer<typeof registrarPagoSchema>;

/**
 * Crear un Plan de Pagos (PDP) para una propiedad. Replica `PdpNvoWidget`:
 * montoTotal = terreno + obra*1.16; N parcialidades mensuales iguales.
 */
export const crearPlanPagosSchema = z.object({
  idPropiedad: z.string().trim().min(1, 'Falta la propiedad.'),
  idNave: z.string().trim().min(1, 'Falta la nave.'),
  idInversionista: z.string().trim().min(1, 'Falta el inversionista.'),
  terreno: z.coerce.number().min(0).default(0),
  obra: z.coerce.number().min(0).default(0),
  cantPagos: z.coerce.number().int().min(1).max(100),
  fechaPrimerPago: FECHA,
  idVendedor: z.string().trim().min(1).optional().or(z.literal('')),
});
export type CrearPlanPagosDto = z.infer<typeof crearPlanPagosSchema>;

/**
 * Activar/desactivar el Plan de Pagos de una propiedad (clave 610). Al activar
 * (`propiedades.pdpActivo=true`) el plan entra al universo de cobranza/dashboard;
 * al desactivar se libera. La bandera vigente es **`propiedades.pdpActivo`**: el
 * control originalmente vivía en `pdp.pdpactivo`, pero se migró a propiedades y
 * `pdp.pdpactivo` quedó como **remanente** (no se escribe).
 */
export const activoPlanSchema = z.object({
  activo: z.boolean(),
});
export type ActivoPlanDto = z.infer<typeof activoPlanSchema>;

/**
 * Editar Terreno/Obra del PDP existente (recalcula el total = terreno + obra*1.16).
 * Solo permitido con el plan **inactivo** (se valida en el servicio).
 */
export const montosPlanSchema = z.object({
  terreno: z.coerce.number().min(0).default(0),
  obra: z.coerce.number().min(0).default(0),
});
export type MontosPlanDto = z.infer<typeof montosPlanSchema>;

/** Editar el monto de una parcialidad del PDP (solo plan inactivo). */
export const partidaMontoSchema = z.object({
  monto: z.coerce.number().min(0, 'El monto no puede ser negativo.'),
});
export type PartidaMontoDto = z.infer<typeof partidaMontoSchema>;

/** Editar la fecha de una parcialidad del PDP (solo plan inactivo). */
export const partidaFechaSchema = z.object({ fecha: FECHA });
export type PartidaFechaDto = z.infer<typeof partidaFechaSchema>;

/**
 * Trasladar saldo entre dos parcialidades del **mismo** plan (clave **611**):
 * resta `monto` de la parcialidad de **origen** y lo suma a una parcialidad
 * **futura** de **destino** que el usuario elige. Conserva el total del plan
 * (`Σ parcialidades = pdp.monto`), por lo que NO exige desactivar el plan. Sirve
 * para "limpiar" adeudos menores que aparecen vencidos, trasladándolos a la
 * última mensualidad sin eliminar registros. Ver `PlanesService.trasladarSaldo`.
 */
export const trasladarSaldoSchema = z.object({
  idPdpDetOrigen: z.string().trim().min(1, 'Falta la parcialidad de origen.'),
  idPdpDetDestino: z.string().trim().min(1, 'Falta la parcialidad de destino.'),
  monto: z.coerce.number().positive('El monto a trasladar debe ser mayor a 0.'),
});
export type TrasladarSaldoDto = z.infer<typeof trasladarSaldoSchema>;

/** Edición de los datos generales del inversionista (Config, sub-tab 1). */
export const inversionistaSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio.').max(120),
  apellido1: z.string().trim().max(120).optional().default(''),
  apellido2: z.string().trim().max(120).optional().default(''),
  fecNacimiento: FECHA.optional().or(z.literal('')),
  telefono: z.string().trim().max(40).optional().default(''),
  correo: z.string().trim().max(160).optional().or(z.literal('')),
  RFC: z.string().trim().max(20).optional().default(''),
  CURP: z.string().trim().max(20).optional().default(''),
  razonsocial: z.string().trim().max(200).optional().or(z.literal('')),
  personalidad: z.string().trim().max(60).optional().or(z.literal('')),
  NomComercial: z.string().trim().max(200).optional().default(''),
  tipoCliente: z.string().trim().max(60).optional().default(''),
});
export type InversionistaDto = z.infer<typeof inversionistaSchema>;

/** Metadatos de un documento del inversionista (Config, sub-tab 2). */
export const docSchema = z.object({
  idInversionista: z.string().trim().min(1, 'Falta el inversionista.'),
  titulo: z.string().trim().min(1, 'El título es obligatorio.').max(160),
  descripcion: z.string().trim().max(400).optional().default(''),
});
export type DocDto = z.infer<typeof docSchema>;

/** Agregar un comentario manual a una parcialidad. */
export const comentarioSchema = z.object({
  comentario: z.string().trim().min(1, 'El comentario no puede estar vacío.').max(1000),
});
export type ComentarioDto = z.infer<typeof comentarioSchema>;

/**
 * Cambiar el tipo de pago de una parcialidad (`pdpDetalle.tipoPago`) desde el
 * Plan de Pagos (clave 610). Réplica de `editar_tipo_pago` de v1 (producto=PDP):
 * Anticipo / Parcialidad / Escrituracion.
 */
export const tipoPagoSchema = z.object({
  tipoPago: z.enum(['Anticipo', 'Parcialidad', 'Escrituracion']),
});
export type TipoPagoDto = z.infer<typeof tipoPagoSchema>;

/**
 * Escrituras (clave 630): edición de la fecha de una parcialidad de
 * escrituración (`pdpDetalle.fecha`). Réplica del calendario de v1.
 */
export const escrituraFechaSchema = z.object({ fecha: FECHA });
export type EscrituraFechaDto = z.infer<typeof escrituraFechaSchema>;

/** Escrituras (clave 630): edición del monto (`pdpDetalle.monto`). */
export const escrituraMontoSchema = z.object({
  monto: z.coerce.number().positive('El monto debe ser mayor a 0.'),
});
export type EscrituraMontoDto = z.infer<typeof escrituraMontoSchema>;

/**
 * Escrituras (clave 630): estatus manual de escrituración
 * (`pdpDetalle.escriturada`). `true` = Escriturada, `false` = Pendiente.
 */
export const escrituraEstatusSchema = z.object({ escriturada: z.coerce.boolean() });
export type EscrituraEstatusDto = z.infer<typeof escrituraEstatusSchema>;

/**
 * Escrituras (clave 630): fecha real de escrituración
 * (`pdpDetalle.fechaEscrituracion`). `null` limpia la fecha.
 */
export const escrituraFechaRealSchema = z.object({
  fecha: FECHA.nullable(),
});
export type EscrituraFechaRealDto = z.infer<typeof escrituraFechaRealSchema>;

/** Vincular una nave a un inversionista creando una propiedad (Config, sub-tab 3). */
export const propiedadSchema = z.object({
  idInversionista: z.string().trim().min(1, 'Falta el inversionista.'),
  idNave: z.string().trim().min(1, 'Falta la nave.'),
  nomDescriptivo: z.string().trim().max(160).optional().default(''),
  idParque: z.string().trim().optional().or(z.literal('')),
});
export type PropiedadDto = z.infer<typeof propiedadSchema>;
