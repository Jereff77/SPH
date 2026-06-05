import { z } from 'zod';

export const bancoSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio.').max(120),
  codigo: z.string().trim().min(1, 'El código es obligatorio.').max(20),
  tipo: z.string().trim().max(60).optional().default(''),
});

export type BancoDto = z.infer<typeof bancoSchema>;
