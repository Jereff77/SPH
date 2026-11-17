import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/types';

/**
 * Recalcula `cxp_ppd.numPagos` = nº de parcialidades NO rechazadas (status=true e
 * idEstado<>3) de una factura PPD.
 *
 * Es una función suelta (no un método de `PpdService`) a propósito: `PpdService` inyecta
 * `SolicitudesService`, así que `SolicitudesService.eliminar()` no puede depender de
 * `PpdService` sin crear una dependencia circular. La usan `PpdService` (nueva parcial),
 * `SolicitudesService` (eliminar) y `AprobacionService` (rechazar).
 *
 * - `lector`: cliente para contar (puede ser `admin`).
 * - `escritor`: cliente con identidad (`comoActor`) para que `cxp_ppd` quede auditado.
 * Devuelve el texto del error si algo falló (y NO lanza: el contador es informativo y
 * nunca debe deshacer ni romper la operación principal), o `null` si todo salió bien.
 */
export async function recontarNumPagosPpd(
  lector: SupabaseClient<Database>,
  escritor: SupabaseClient<Database>,
  idCxpPPD: string,
): Promise<string | null> {
  const { count, error } = await lector
    .from('cxp')
    .select('idCxp', { count: 'exact', head: true })
    .eq('idCxpPPD', idCxpPPD)
    .eq('status', true)
    .neq('idEstado', 3);
  if (error) return error.message;
  const { error: upErr } = await escritor
    .from('cxp_ppd')
    .update({ numPagos: count ?? 0 })
    .eq('idCxpPPD', idCxpPPD);
  return upErr ? upErr.message : null;
}
