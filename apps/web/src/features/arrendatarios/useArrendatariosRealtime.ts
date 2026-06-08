import { useCxpRealtime } from '../cxp/useCxpRealtime';

/**
 * Realtime del Dashboard de cobranza de Arrendatarios. Reutiliza el hook genérico
 * de SSE: se conecta a `/arrendatarios/cobranza/stream` y ejecuta `onCambio` ante
 * cada cambio en `arrePdpDetalle`/`movbancarios` (incl. desde v1).
 */
export function useArrendatariosRealtime(onCambio: () => void): void {
  useCxpRealtime('/arrendatarios/cobranza/stream', onCambio);
}
