import { z } from 'zod';

/**
 * Esquema y validación de variables de entorno del backend.
 * Si falta un secreto crítico (service_role, jwt secret), la app NO arranca:
 * es preferible fallar al inicio que correr sin la frontera de seguridad.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  SUPABASE_URL: z.string().url(),
  // service_role: SOLO servidor. Salta RLS. Nunca exponer.
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  // anon key: usada SOLO server-side para el flujo de auth (login/refresh).
  // No se usa para acceso a datos (eso va con service_role tras autorizar).
  SUPABASE_ANON_KEY: z.string().min(20),
  // Secreto para verificar la firma de los JWT de usuario (HS256).
  SUPABASE_JWT_SECRET: z.string().min(10),

  // Dominios de correo autorizados (separados por coma). El login pide solo el
  // nombre de usuario y el backend resuelve el correo contra estos dominios.
  // Futuro: gestionables desde Configuraciones > Sistema.
  DOMINIOS_AUTORIZADOS: z.string().default('aceleremos.com,gruposph.mx'),

  // Token de la SIE API de Banxico (serie SF43718, tipo de cambio FIX USD/MXN).
  // El backend hace de proxy: el token NUNCA se expone al frontend. Default = el
  // token usado en v1 (FlutterFlow); en producción conviene moverlo a un secreto.
  BANXICO_TOKEN: z
    .string()
    .default(
      '609198f2a446d552c855a74f6fb891908fbf8afb5e6c5cc0eaa17a4bed9546b3',
    ),

  // Clave maestra para cifrar las contraseñas de las cuentas de correo (AES-256-GCM).
  // De aquí se deriva una llave de 32 bytes (sha256). SECRETO; configúrala en producción.
  // Si está vacía, el módulo de Correo no podrá guardar/usar contraseñas.
  EMAIL_ENCRYPTION_KEY: z.string().default(''),

  // URL base del frontend (apps/web). Se usa para construir el link de las
  // invitaciones de registro: {APP_WEB_URL}/registro?token=XXX. Si no se define,
  // cae a CORS_ORIGIN (el origen del frontend ya configurado).
  APP_WEB_URL: z.string().url().optional(),

  // --- Cuenta SMTP dedicada para enviar las invitaciones de registro ---
  // Independiente del buzón de facturas (módulo Correo). Si SMTP_INVITACIONES_HOST
  // está vacío, el envío de invitaciones queda deshabilitado (el backend lo avisa).
  SMTP_INVITACIONES_HOST: z.string().default(''),
  SMTP_INVITACIONES_PORT: z.coerce.number().int().positive().default(587),
  SMTP_INVITACIONES_USER: z.string().default(''),
  SMTP_INVITACIONES_PASS: z.string().default(''),
  // Remitente mostrado (From). Si está vacío, se usa SMTP_INVITACIONES_USER.
  SMTP_INVITACIONES_FROM: z.string().default(''),
  // Días de validez del link de invitación antes de expirar.
  INVITACION_VIGENCIA_DIAS: z.coerce.number().int().positive().default(7),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const detalles = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(
      `Variables de entorno inválidas o faltantes:\n${detalles}\n` +
        'Revisa apps/api/.env (ver apps/api/.env.example).',
    );
  }
  return parsed.data;
}
