import { z } from 'zod';

/** Alta de invitación (la hace un usuario con acceso al módulo Usuarios). */
export const invitarSchema = z.object({
  email: z.string().trim().toLowerCase().email('Correo inválido.').max(160),
  nombre: z.string().trim().min(1, 'El nombre es obligatorio.').max(120),
  apellidos: z.string().trim().min(1, 'Los apellidos son obligatorios.').max(120),
});
export type InvitarDto = z.infer<typeof invitarSchema>;

/**
 * Aceptación de la invitación (endpoint PÚBLICO). El correo NO se acepta del
 * cliente: se toma de la invitación asociada al token (no falsificable).
 */
export const aceptarSchema = z.object({
  token: z.string().trim().min(20, 'Token inválido.').max(200),
  nombre: z.string().trim().min(1, 'El nombre es obligatorio.').max(120),
  apellidos: z.string().trim().min(1, 'Los apellidos son obligatorios.').max(120),
  telefono: z
    .string()
    .trim()
    .max(30)
    .optional()
    .transform((v) => (v ? v : undefined)),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres.')
    .max(72, 'La contraseña es demasiado larga.'),
});
export type AceptarDto = z.infer<typeof aceptarSchema>;
