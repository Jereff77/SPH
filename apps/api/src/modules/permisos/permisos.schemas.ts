import { z } from 'zod';

/** Toggle de acceso de un permiso para un usuario. */
export const accesoSchema = z.object({ acceso: z.boolean() });
export type AccesoDto = z.infer<typeof accesoSchema>;

/** Aplicar una plantilla a un usuario. */
export const aplicarPlantillaSchema = z.object({
  uid: z.string().uuid(),
  idPlantilla: z.string().uuid(),
  reemplazarTodos: z.boolean().optional().default(false),
});
export type AplicarPlantillaDto = z.infer<typeof aplicarPlantillaSchema>;

/** Crear una plantilla a partir de los permisos de un usuario. */
export const crearPlantillaSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(120),
  descripcion: z.string().trim().max(500).optional().default(''),
  uidOrigen: z.string().uuid(),
  categoria: z.string().trim().min(1).max(60),
  esPublica: z.boolean().optional().default(true),
});
export type CrearPlantillaDto = z.infer<typeof crearPlantillaSchema>;
