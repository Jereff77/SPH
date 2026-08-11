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
  // Capacidad eléctrica del parque. `Mt` = MEDIA tensión, `Bt` = BAJA tensión
  // (antes se llamaban kvasAlta/kvasMedia: el nombre corría un escalón y no
  // coincidía con el negocio). Admiten decimales: el control real los usa
  // (Acupark II: 732.5 BT / 2620.5 MT).
  kvasMt: z.coerce.number().min(0).default(0),
  kvasBt: z.coerce.number().min(0).default(0),
  // DOTACIÓN: los KVA que le tocan a CADA nave por disposición del parque.
  // Es distinto de la capacidad: la capacidad es del parque, la dotación de la
  // nave. La BD valida que `naves × dotación ≤ capacidad`.
  dotacionMtNave: z.coerce.number().min(0).default(0),
  dotacionBtNave: z.coerce.number().min(0).default(0),
});

export const editarParqueSchema = z.object({
  direccion: z.string().trim().max(300).optional().default(''),
  kvasMt: z.coerce.number().min(0),
  kvasBt: z.coerce.number().min(0),
  // Solo cambia el default de las naves FUTURAS: no re-aplica a las existentes.
  dotacionMtNave: z.coerce.number().min(0).default(0),
  dotacionBtNave: z.coerce.number().min(0).default(0),
});

/** Dotación de UNA nave. Va por endpoint aparte porque exige permiso 721. */
export const dotacionNaveSchema = z.object({
  dotacionMt: z.coerce.number().min(0).max(1_000_000),
  dotacionBt: z.coerce.number().min(0).max(1_000_000),
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

export type DotacionNaveDto = z.infer<typeof dotacionNaveSchema>;
export type CrearParqueDto = z.infer<typeof crearParqueSchema>;
export type EditarParqueDto = z.infer<typeof editarParqueSchema>;
export type EditarNaveDto = z.infer<typeof editarNaveSchema>;
export type AgregarNavesDto = z.infer<typeof agregarNavesSchema>;
