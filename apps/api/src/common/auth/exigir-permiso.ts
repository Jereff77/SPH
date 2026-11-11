import { ForbiddenException, type Logger } from '@nestjs/common';
import type { SupabaseService } from '../supabase/supabase.service.js';

/**
 * Regla de RBAC server-side (la misma que aplica `PermisoGuard`), extraída para
 * poder exigir un permiso **dentro de un servicio** cuando el decorador
 * `@RequierePermiso` no alcanza (p. ej. «23 y 25» en Renovar: el guard solo sabe
 * «cualquiera de»).
 *
 * - Soporte (`catUsers.isSupport`) pasa siempre.
 * - Si no, basta con tener acceso concedido a UNA de las `claves` (any-of) en
 *   `segModulosUsuarios`.
 * - Error al verificar → 403 genérico (y el detalle solo al log); sin acceso → 403
 *   «Acceso denegado (permiso X o Y)».
 *
 * `uid` debe venir del JWT verificado (`@CurrentUser`), nunca del cliente.
 * `PermisoGuard` delega aquí: hay UNA sola implementación de la regla.
 *
 * `codigo` (opcional): código de negocio estable que se añade al cuerpo del 403 (lo propaga el
 * filtro global) para que el cliente no adivine por el texto. `PermisoGuard` no lo pasa, así que
 * sus respuestas no cambian.
 */
export async function exigirPermiso(
  supabase: SupabaseService,
  logger: Logger,
  uid: string,
  claves: number[],
  codigo?: string,
): Promise<void> {
  const prohibido = (message: string): ForbiddenException =>
    new ForbiddenException(codigo ? { message, codigo } : message);

  // Soporte (super-admin) tiene acceso total: evita el bloqueo de quien
  // administra el sistema y el "catch-22" de no poder darse permisos.
  const { data: perfil } = await supabase.admin
    .from('catUsers')
    .select('isSupport')
    .eq('uid', uid)
    .maybeSingle();
  if (perfil?.isSupport === true) return;

  // any-of: basta con tener acceso a UNA de las claves declaradas.
  const { data, error } = await supabase.admin
    .from('segModulosUsuarios')
    .select('acceso')
    .eq('uid', uid)
    .in('clave', claves)
    .eq('acceso', true)
    .limit(1);

  if (error) {
    logger.error(`Error verificando permiso ${claves.join('/')} para ${uid}: ${error.message}`);
    throw prohibido('No se pudo verificar el permiso.');
  }

  if (!data || data.length === 0) {
    throw prohibido(`Acceso denegado (permiso ${claves.join(' o ')}).`);
  }
}
