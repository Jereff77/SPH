import { z } from 'zod';

/** Regresar / Rechazar: el motivo es obligatorio. */
export const motivoSchema = z.object({
  comentario: z
    .string()
    .trim()
    .min(3, 'Indica el motivo (mínimo 3 caracteres).')
    .max(500),
});
export type MotivoDto = z.infer<typeof motivoSchema>;

/** Aprobar: el comentario es opcional. */
export const aprobarSchema = z.object({
  comentario: z.string().trim().max(500).optional().default(''),
});
export type AprobarDto = z.infer<typeof aprobarSchema>;
