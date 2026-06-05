import { z } from 'zod';

export const cambiarResponsableSchema = z.object({
  uidGerente: z.string().trim().min(1, 'Responsable obligatorio.'),
});

export type CambiarResponsableDto = z.infer<typeof cambiarResponsableSchema>;
