import { z } from 'zod';

const RE_DOMINIO = /^(?=.{1,253}$)([a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,}$/;

/** Validación de un dominio de correo (sin la @). */
export const dominioSchema = z.object({
  dominio: z
    .string()
    .trim()
    .toLowerCase()
    .regex(RE_DOMINIO, 'Dominio inválido (ej. empresa.com)'),
});
export type DominioDto = z.infer<typeof dominioSchema>;

/** Validación de un correo específico autorizado (excepción de dominio). */
export const correoSchema = z.object({
  correo: z.string().trim().toLowerCase().email('Correo inválido'),
});
export type CorreoDto = z.infer<typeof correoSchema>;

/** Dimensiones (px) de un logotipo. null = automático. */
export const dimensionesLogoSchema = z.object({
  ancho: z.number().int().min(8).max(2000).nullable(),
  alto: z.number().int().min(8).max(2000).nullable(),
});
export type DimensionesLogoDto = z.infer<typeof dimensionesLogoSchema>;
