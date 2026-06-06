import { z } from 'zod';

/** Alta/edición de cuenta de correo. La contraseña es opcional al editar. */
export const cuentaSchema = z.object({
  nombre: z.string().trim().max(120).optional().default(''),
  email: z.string().trim().email('Correo inválido.'),
  imapHost: z.string().trim().min(1).default('imap.hostinger.com'),
  imapPort: z.coerce.number().int().min(1).max(65535).default(993),
  smtpHost: z.string().trim().min(1).default('smtp.hostinger.com'),
  smtpPort: z.coerce.number().int().min(1).max(65535).default(465),
  usuario: z.string().trim().max(200).optional().default(''),
  password: z.string().max(300).optional().default(''),
  activo: z.boolean().optional().default(true),
});
export type CuentaDto = z.infer<typeof cuentaSchema>;

/** Responder un correo. */
export const responderSchema = z.object({
  body: z.string().trim().min(1, 'Escribe la respuesta.').max(20000),
});
export type ResponderDto = z.infer<typeof responderSchema>;
