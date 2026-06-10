import { z } from 'zod';

const FECHA = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (yyyy-MM-dd).');

/**
 * Registrar un pago contra una parcialidad (`pdpDetalle`). Replica
 * `PagosRealizarWidget`/`RealizarPagoTicketWidget` de v1: tipo de movimiento
 * (1=Terreno, 2=Construcción, 3=Ticket) y operación (1=Pago, 2=Descuento). El
 * backend resuelve idPdp/idPropiedad/numPago a partir del `idPdpDet`.
 */
export const registrarPagoSchema = z.object({
  tipomovimiento: z.coerce.number().int().min(1).max(3),
  tipoOperacion: z.coerce.number().int().min(1).max(2).default(1),
  fecha: FECHA,
  monto: z.coerce.number().positive('El monto debe ser mayor a 0.'),
  /** IVA incluido en el monto (para Ticket); 0 si no aplica. */
  iva: z.coerce.number().min(0).optional().default(0),
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

/** Vincular una nave a un inversionista creando una propiedad (Config, sub-tab 3). */
export const propiedadSchema = z.object({
  idInversionista: z.string().trim().min(1, 'Falta el inversionista.'),
  idNave: z.string().trim().min(1, 'Falta la nave.'),
  nomDescriptivo: z.string().trim().max(160).optional().default(''),
  idParque: z.string().trim().optional().or(z.literal('')),
});
export type PropiedadDto = z.infer<typeof propiedadSchema>;
