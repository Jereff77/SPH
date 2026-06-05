import { z } from 'zod';

/** Registro de un pago manual (movimiento bancario) contra una solicitud. */
export const registrarPagoSchema = z.object({
  importe: z.coerce.number().positive('El importe debe ser mayor a 0.'),
  fecOperacion: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha de operación inválida (yyyy-MM-dd).'),
  horaOperacion: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Hora inválida (HH:mm).')
    .optional()
    .or(z.literal('')),
  ordenante: z.string().trim().max(200).optional().default(''),
  ctaDestino: z.string().trim().max(100).optional().default(''),
  bcoDestino: z.string().trim().max(100).optional().default(''),
  beneficiario: z.string().trim().max(200).optional().default(''),
  concepto: z.string().trim().max(300).optional().default(''),
  referencia: z.string().trim().max(100).optional().default(''),
  autorizacion: z.string().trim().max(100).optional().default(''),
  claveRastreo: z.string().trim().max(100).optional().default(''),
  /** URL del comprobante ya subido (Opción B, tras analizar con N8N). */
  urlComprobante: z.string().trim().url().optional().or(z.literal('')),
});

export type RegistrarPagoDto = z.infer<typeof registrarPagoSchema>;

/** Asignar un movimiento bancario existente a la solicitud (Opción A). */
export const asignarMovimientoSchema = z.object({
  idmov: z.string().trim().min(1, 'Seleccione un movimiento bancario.'),
});
export type AsignarMovimientoDto = z.infer<typeof asignarMovimientoSchema>;

/** Batch "Aprobados sin pago aplicado" del mes/año. */
export const aprobadosSinPagoSchema = z.object({
  mes: z.coerce.number().int().min(1).max(12),
  anio: z.coerce.number().int().min(2000).max(2100),
});
export type AprobadosSinPagoDto = z.infer<typeof aprobadosSinPagoSchema>;
