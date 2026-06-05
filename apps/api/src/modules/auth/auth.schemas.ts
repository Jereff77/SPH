import { z } from 'zod';

const RE_USUARIO = /^[a-zA-Z0-9._-]+$/;
const RE_EMAIL = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Credenciales de inicio de sesión. El campo `usuario` acepta:
 *  - el nombre de usuario corto (p. ej. "jereff") → el backend resuelve el correo
 *    contra los dominios autorizados;
 *  - o el correo completo (p. ej. "jereff@aceleremos.com") → útil cuando un mismo
 *    nombre de usuario existe en más de un dominio.
 */
export const loginSchema = z.object({
  usuario: z
    .string()
    .trim()
    .min(1, 'El usuario es obligatorio')
    .max(120)
    .refine(
      (v) => RE_USUARIO.test(v) || RE_EMAIL.test(v),
      'Ingresa tu usuario o tu correo',
    ),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});
export type LoginDto = z.infer<typeof loginSchema>;

/** Cambio de la propia contraseña: verifica la actual y exige una nueva segura. */
export const cambiarContrasenaSchema = z.object({
  actual: z.string().min(1, 'La contraseña actual es obligatoria'),
  nueva: z
    .string()
    .min(8, 'La nueva contraseña debe tener al menos 8 caracteres')
    .max(72),
});
export type CambiarContrasenaDto = z.infer<typeof cambiarContrasenaSchema>;
