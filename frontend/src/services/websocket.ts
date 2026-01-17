import { io, Socket } from 'socket.io-client';
import type { WebSocketEvent } from '../types';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:8000';

export type WebSocketCallback = (event: WebSocketEvent) => void;

class WebSocketService {
  private socket: Socket | null = null;
  private callbacks: Set<WebSocketCallback> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect() {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: this.reconnectDelay,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.socket.on('connect', () => {
      console.log('WebSocket conectado');
      this.reconnectAttempts = 0;
      this.notifyCallbacks({
        type: 'status',
        data: { connected: true },
      });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket desconectado:', reason);
      this.notifyCallbacks({
        type: 'status',
        data: { connected: false, reason },
      });
    });

    this.socket.on('connect_error', (error) => {
      console.error('Error de conexión WebSocket:', error);
      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.notifyCallbacks({
          type: 'error',
          data: { message: 'No se pudo conectar al servidor' },
        });
      }
    });

    this.socket.on('status_update', (data) => {
      this.notifyCallbacks({
        type: 'status',
        data,
      });
    });

    this.socket.on('log_entry', (data) => {
      this.notifyCallbacks({
        type: 'log',
        data,
      });
    });

    this.socket.on('error', (data) => {
      this.notifyCallbacks({
        type: 'error',
        data,
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  subscribe(callback: WebSocketCallback) {
    this.callbacks.add(callback);
  }

  unsubscribe(callback: WebSocketCallback) {
    this.callbacks.delete(callback);
  }

  private notifyCallbacks(event: WebSocketEvent) {
    this.callbacks.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error en callback de WebSocket:', error);
      }
    });
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const websocketService = new WebSocketService();
