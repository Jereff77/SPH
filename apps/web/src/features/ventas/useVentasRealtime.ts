import { useCxpRealtime } from '../cxp/useCxpRealtime';

/**
 * Realtime del Dashboard de Ventas. Reutiliza el hook genérico de SSE: se conecta
 * a `/ventas/dashboard/stream` y ejecuta `onCambio` ante cada cambio en `pagos`.
 */
export function useVentasRealtime(onCambio: () => void): void {
  useCxpRealtime('/ventas/dashboard/stream', onCambio);
}
