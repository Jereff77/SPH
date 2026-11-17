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
// Importe en pesos: máximo 2 decimales (el subtotal se reparte en centavos enteros).
const monto = z.coerce
  .number({ invalid_type_error: 'El monto debe ser numérico.' })
  .positive('El monto debe ser mayor a 0.')
  .refine((m) => Math.abs(m * 100 - Math.round(m * 100)) < 1e-6, {
    message: 'El monto admite como máximo 2 decimales (centavos).',
  });

/** Alta de la factura PPD + su primera parcialidad (multipart: xml + pdf). */
export const nuevaFacturaPpdSchema = z.object({
  idCategoria,
  justificacion,
  monto, // monto de la PRIMERA solicitud de pago (parcialidad)
});
export type NuevaFacturaPpdDto = z.infer<typeof nuevaFacturaPpdSchema>;

/**
 * Nueva solicitud parcial sobre una factura PPD ya registrada (sin XML). La cuenta se pide
 * una sola vez, al subir la factura: aquí se ignora (si un cliente viejo la manda) y el
 * servidor usa la de la factura.
 */
export const nuevaParcialPpdSchema = z.object({
  idCategoria: idCategoria.optional(),
  justificacion,
  monto,
});
export type NuevaParcialPpdDto = z.infer<typeof nuevaParcialPpdSchema>;

/** Dispensa de complemento (REP) por excepción: requiere un motivo. */
export const dispensarComplementoSchema = z.object({
  motivo: z
    .string()
    .trim()
    .min(10, 'El motivo debe tener al menos 10 caracteres.')
    .max(300, 'El motivo no debe exceder 300 caracteres.'),
});
export type DispensarComplementoDto = z.infer<typeof dispensarComplementoSchema>;
