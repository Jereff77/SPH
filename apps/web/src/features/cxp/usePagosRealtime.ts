import { useCxpRealtime } from './useCxpRealtime';

/** Realtime de la pantalla de pagos (envuelve useCxpRealtime). */
export function usePagosRealtime(onCambio: () => void): void {
  useCxpRealtime('/cxp/pagos/stream', onCambio);
}
