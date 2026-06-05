import { z } from 'zod';

/** Situaciones válidas de una nave. "Vendida" NO se asigna desde aquí (solo
 * desde el módulo Propietarios), por eso no se incluye en el editor de naves. */
export const SITUACIONES_EDITABLES = [
  'Disponible',
  'Apartado',
  'Bloqueado',
] as const;

// Límite de naves por parque al crear (el máximo real en producción ronda 158).
const MAX_NAVES = 300;

export const crearParqueSchema = z.object({
  nomParque: z.string().trim().min(1, 'El nombre es obligatorio.').max(150),
  direccion: z.string().trim().max(300).optional().default(''),
  // Cantidad real de naves a generar (en v2 se corrige el bug de v1 que usaba KVA's).
  naves: z.coerce.number().int().min(1).max(MAX_NAVES),
  kvasAlta: z.coerce.number().int().min(0).default(0),
  kvasMedia: z.coerce.number().int().min(0).default(0),
});

export const editarParqueSchema = z.object({
  direccion: z.string().trim().max(300).optional().default(''),
  kvasAlta: z.coerce.number().int().min(0),
  kvasMedia: z.coerce.number().int().min(0),
});

export const agregarNavesSchema = z.object({
  // Cuántas naves agregar al parque (continúan el consecutivo existente).
  cantidad: z.coerce.number().int().min(1).max(MAX_NAVES),
});

export const editarNaveSchema = z.object({
  situacion: z.enum(SITUACIONES_EDITABLES),
  // Etiqueta visible de la nave (consecutivo por defecto; personalizable:
  // "GYM", "Coworking", "Cafetería", etc.).
  numNaveName: z.string().trim().min(1, 'La etiqueta es obligatoria.').max(60),
  mza: z.coerce.number().int().min(0).default(0),
  lote: z.coerce.number().int().min(0).default(0),
  terreno: z.coerce.number().min(0).default(0),
  construccion: z.coerce.number().min(0).default(0),
  precio: z.coerce.number().min(0).default(0),
  // Fecha de entrega en ISO (yyyy-MM-dd) o null.
  fecEntrega: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (yyyy-MM-dd).')
    .nullable()
    .optional(),
});

export type CrearParqueDto = z.infer<typeof crearParqueSchema>;
export type EditarParqueDto = z.infer<typeof editarParqueSchema>;
export type EditarNaveDto = z.infer<typeof editarNaveSchema>;
export type AgregarNavesDto = z.infer<typeof agregarNavesSchema>;
