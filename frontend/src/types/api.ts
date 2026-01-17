// Tipos para la API del sistema de procesamiento de facturas

export type WebSocketEvent = {
  type: 'status' | 'log' | 'error';
  data: any;
};

export interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface SystemStatus {
  processor: {
    running: boolean;
    uptime: number;
  };
  activity: {
    within_schedule: boolean;
  };
  stats: {
    invoices_processed: number;
    deposits_processed: number;
    errors: number;
    last_run: string | null;
  };
  timestamp: string;
}

export interface SystemConfig {
  polling_interval: number;
  polling_interval_idle: number;
  schedule_enabled: boolean;
  schedule_start_time: string;
  schedule_end_time: string;
  schedule_days: number[];
}

export interface ControlResponse {
  status: 'success' | 'error';
  message: string;
}

export interface LogEntry {
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  message: string;
  module?: string;
}

export interface LogsResponse {
  logs: LogEntry[];
  total_lines: number;
}
