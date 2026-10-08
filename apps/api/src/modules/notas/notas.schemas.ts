import { z } from 'zod';

/** Ubicación de las notas (qué entidad de qué pantalla). */
export const refNotaSchema = z.object({
  modulo: z.string().trim().min(1).max(60),
  pantalla: z.string().trim().min(1).max(60),
  entidadTipo: z.string().trim().min(1).max(60),
  entidadId: z.string().trim().min(1).max(100),
});
export type RefNotaDto = z.infer<typeof refNotaSchema>;

export const crearNotaSchema = refNotaSchema.extend({
  texto: z.string().trim().min(1, 'Escribe la nota.').max(2000, 'La nota es demasiado larga (máx. 2000).'),
});
export type CrearNotaDto = z.infer<typeof crearNotaSchema>;
