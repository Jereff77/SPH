import { useEffect, useRef } from 'react';
import { API_BASE_URL, getAccessToken } from '@/lib/api';

/**
 * Suscripción en vivo a los cambios de CxP vía SSE (Server-Sent Events). El
 * backend escucha Supabase Realtime sobre `cxp` y emite un evento por cada
 * cambio; aquí se invoca `onCambio` (típicamente para invalidar la query y
 * refrescar la tabla). Reconecta automáticamente ante errores.
 */
export function usePagosRealtime(onCambio: () => void): void {
  const ref = useRef(onCambio);
  ref.current = onCambio;

  useEffect(() => {
    let es: EventSource | null = null;
    let cerrado = false;
    let reintento: ReturnType<typeof setTimeout> | null = null;

    const conectar = () => {
      const token = getAccessToken();
      if (!token) {
        reintento = setTimeout(conectar, 3000);
        return;
      }
      const url = `${API_BASE_URL}/api/cxp/pagos/stream?token=${encodeURIComponent(token)}`;
      es = new EventSource(url);
      es.onmessage = (ev) => {
        try {
          const d = JSON.parse(ev.data) as { tipo?: string };
          if (d.tipo === 'cambio') ref.current();
        } catch {
          /* ignorar mensajes no-JSON */
        }
      };
      es.onerror = () => {
        es?.close();
        es = null;
        if (!cerrado) reintento = setTimeout(conectar, 5000);
      };
    };

    conectar();
    return () => {
      cerrado = true;
      es?.close();
      if (reintento) clearTimeout(reintento);
    };
  }, []);
}
