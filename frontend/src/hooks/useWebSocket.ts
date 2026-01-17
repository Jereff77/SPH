import { useState, useEffect, useCallback, useRef } from 'react';
import { websocketService } from '../services';
import type { WebSocketEvent, SystemStatus } from '../types';

export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [lastLog, setLastLog] = useState<any>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    websocketService.connect();

    const handleEvent = (event: WebSocketEvent) => {
      switch (event.type) {
        case 'status':
          if (event.data.connected !== undefined) {
            setConnected(event.data.connected);
          } else if (event.data.processor) {
            setStatus(event.data);
          }
          break;
        case 'log':
          setLastLog(event.data);
          break;
        case 'error':
          console.error('WebSocket error:', event.data);
          break;
      }
    };

    websocketService.subscribe(handleEvent);

    // Verificar conexión periódicamente
    const checkConnection = () => {
      if (!websocketService.isConnected()) {
        setConnected(false);
        // Intentar reconectar
        reconnectTimeoutRef.current = setTimeout(() => {
          websocketService.connect();
        }, 5000);
      }
    };

    const interval = setInterval(checkConnection, 10000);

    return () => {
      websocketService.unsubscribe(handleEvent);
      clearInterval(interval);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  const refreshStatus = useCallback(async () => {
    // El WebSocket debería actualizar el status automáticamente
    // Este método es para forzar una actualización manual si es necesario
    // Se podría implementar haciendo una petición HTTP adicional
  }, []);

  return {
    connected,
    status,
    lastLog,
    refreshStatus,
  };
}
