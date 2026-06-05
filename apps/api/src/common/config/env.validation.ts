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
