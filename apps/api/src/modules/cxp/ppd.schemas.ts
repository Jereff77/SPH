import { z } from 'zod';

/**
 * Esquemas del módulo CxP > Solicitudes de Pago PPD (facturas de Pago en
 * Parcialidades o Diferido). El XML solo se sube al crear la factura (primera
 * parcialidad); las parcialidades siguientes solo capturan el monto.
 */

const idCategoria = z.string().trim().min(1, 'La clasificación es obligatoria.');
const justificacion = z
  .string()
  .trim()
  .min(20, 'La justificación debe tener al menos 20 caracteres.')
  .max(100, 'La justificación no debe exceder 100 caracteres.');
const monto = z.coerce
  .number({ invalid_type_error: 'El monto debe ser numérico.' })
  .positive('El monto debe ser mayor a 0.');

/** Alta de la factura PPD + su primera parcialidad (multipart: xml + pdf). */
export const nuevaFacturaPpdSchema = z.object({
  idCategoria,
  justificacion,
  monto, // monto de la PRIMERA solicitud de pago (parcialidad)
});
export type NuevaFacturaPpdDto = z.infer<typeof nuevaFacturaPpdSchema>;

/** Nueva solicitud parcial sobre una factura PPD ya registrada (sin XML). */
export const nuevaParcialPpdSchema = z.object({
  idCategoria,
  justificacion,
  monto,
});
export type NuevaParcialPpdDto = z.infer<typeof nuevaParcialPpdSchema>;
