import { z } from 'zod';

/**
 * Catálogo de claves Producto/Servicio del SAT (CxP). Cada clave indica si la
 * operación retiene IVA y/o ISR; el parser de CFDI lo usa para validar que las
 * retenciones del XML correspondan al régimen del emisor (612, 626, 606).
 */
export const claveSatSchema = z.object({
  claveProdServ: z
    .string()
    .trim()
    .min(1, 'La clave es obligatoria.')
    .max(20, 'Clave demasiado larga.'),
  descripcion: z.string().trim().max(300).optional().default(''),
  retieneIVA: z.boolean(),
  retieneISR: z.boolean(),
});

export type ClaveSatDto = z.infer<typeof claveSatSchema>;

export const editarClaveSatSchema = claveSatSchema.partial().extend({
  retieneIVA: z.boolean().optional(),
  retieneISR: z.boolean().optional(),
});

export type EditarClaveSatDto = z.infer<typeof editarClaveSatSchema>;

export const statusClaveSatSchema = z.object({ status: z.boolean() });
export type StatusClaveSatDto = z.infer<typeof statusClaveSatSchema>;
