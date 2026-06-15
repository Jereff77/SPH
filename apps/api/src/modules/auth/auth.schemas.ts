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

/**
 * Solicitud de recuperación de contraseña (público). Acepta el nombre de usuario
 * corto o el correo completo, igual que el login: el backend resuelve el correo
 * contra los dominios/correos autorizados y dispara el correo de recuperación de
 * Supabase. La respuesta SIEMPRE es genérica (no revela si el usuario existe).
 */
export const recuperarSchema = z.object({
  usuario: z
    .string()
    .trim()
    .min(1, 'El usuario es obligatorio')
    .max(120)
    .refine(
      (v) => RE_USUARIO.test(v) || RE_EMAIL.test(v),
      'Ingresa tu usuario o tu correo',
    ),
});
export type RecuperarDto = z.infer<typeof recuperarSchema>;

/**
 * Restablecimiento de contraseña (público). `accessToken` es el token de recovery
 * que Supabase entrega en el enlace del correo (el frontend lo lee del fragmento
 * de la URL y lo reenvía; nunca habla con Supabase directamente). El backend lo
 * verifica y, si es válido, fija la nueva contraseña.
 */
export const restablecerSchema = z.object({
  accessToken: z.string().min(10, 'Token de recuperación inválido'),
  nueva: z
    .string()
    .min(8, 'La nueva contraseña debe tener al menos 8 caracteres')
    .max(72),
});
export type RestablecerDto = z.infer<typeof restablecerSchema>;
