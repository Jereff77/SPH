import { z } from 'zod';
import { normalizarRfc, rfcFormatoValido, esRfcGenerico } from './rfc.util.js';

/** Tipos de cliente (chips) que filtran el listado. */
export const TIPOS_CLIENTE = [
  'inversionistas',
  'arrendatarios',
  'ticket',
  'usuarioFinal',
  'papelera',
] as const;
export type TipoCliente = (typeof TIPOS_CLIENTE)[number];

const FECHA = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (yyyy-MM-dd).');

/** Alta/edición de un cliente (tabla `inversionista`). */
export const clienteSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio.').max(120),
  apellido1: z.string().trim().max(120).optional().default(''),
  apellido2: z.string().trim().max(120).optional().default(''),
  telefono: z.string().trim().max(40).optional().default(''),
  correo: z.string().trim().max(160).optional().or(z.literal('')),
  // RFC obligatorio (regla v2), con formato válido y SIN genéricos. Se normaliza
  // (mayúsculas, sin separadores) antes de guardar. La BD sigue permisiva para no
  // romper registros viejos; al editarlos habrá que capturar un RFC correcto.
  RFC: z
    .string()
    .trim()
    .min(1, 'El RFC es obligatorio.')
    .max(20)
    .transform((v) => normalizarRfc(v))
    .refine((v) => v.length > 0, 'El RFC es obligatorio.')
    .refine(rfcFormatoValido, 'RFC con formato inválido.')
    .refine(
      (v) => !esRfcGenerico(v),
      'El RFC genérico no está permitido. Captura el RFC real del cliente.',
    ),
  CURP: z.string().trim().max(30).optional().default(''),
  idContpac: z.string().trim().max(60).optional().default(''),
  razonsocial: z.string().trim().max(200).optional().or(z.literal('')),
  personalidad: z.string().trim().max(60).optional().or(z.literal('')),
  fecNacimiento: FECHA.optional().or(z.literal('')),
  // Banderas de tipo (un cliente puede ser de varios tipos).
  inversionista: z.boolean().optional().default(false),
  arrendatario: z.boolean().optional().default(false),
  ticket: z.boolean().optional().default(false),
  usuarioFinal: z.boolean().optional().default(false),
  // Confirmación explícita del usuario para registrar pese a un RFC con la MISMA
  // base pero distinta homoclave (posible homónimo real). No se persiste.
  permitirSimilar: z.boolean().optional().default(false),
});
export type ClienteDto = z.infer<typeof clienteSchema>;
