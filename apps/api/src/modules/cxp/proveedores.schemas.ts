import { z } from 'zod';

// Tipos de cuenta y personalidad fiscal (catálogo simple; el front ofrece estas
// opciones pero se valida de forma laxa para no romper datos existentes de v1).
export const TIPOS_CUENTA = ['CLABE', 'Cuenta', 'Tarjeta'] as const;
export const PERSONALIDADES = ['Fisica', 'Moral'] as const;

export const crearProveedorSchema = z.object({
  razonSocial: z.string().trim().min(1, 'La razón social es obligatoria.').max(200),
  rfc: z
    .string()
    .trim()
    .toUpperCase()
    .min(12, 'El RFC debe tener 12 o 13 caracteres.')
    .max(13),
  nombre: z.string().trim().max(150).optional().default(''),
  apellidos: z.string().trim().max(150).optional().default(''),
  email: z.string().trim().max(150).optional().default(''),
  telefono: z.string().trim().max(30).optional().default(''),
  nombreBanco: z.string().trim().min(1, 'El banco es obligatorio.').max(100),
  tipoCuenta: z.string().trim().min(1, 'El tipo de cuenta es obligatorio.').max(50),
  noCuenta: z.string().trim().max(40).optional().default(''),
  personalidad: z.enum(PERSONALIDADES).optional(),
  claveRegimen: z.coerce.number().int().optional(),
  tipoIdentificacion: z.coerce.number().int().optional(),
  numIdentificacion: z.string().trim().max(60).optional().default(''),
});

export const editarProveedorSchema = crearProveedorSchema;

export const statusProveedorSchema = z.object({
  status: z.boolean(),
});

export type CrearProveedorDto = z.infer<typeof crearProveedorSchema>;
export type EditarProveedorDto = z.infer<typeof editarProveedorSchema>;
export type StatusProveedorDto = z.infer<typeof statusProveedorSchema>;
