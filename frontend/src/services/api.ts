import axios from 'axios';
import type {
  LoginRequest,
  LoginResponse,
  SystemStatus,
  SystemConfig,
  ControlResponse,
  LogsResponse,
  User,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar el token de autenticación
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar errores de autenticación
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>('/api/auth/login', credentials);
    return response.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/api/auth/logout');
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get<User>('/api/auth/me');
    return response.data;
  },
};

// Status API
export const statusApi = {
  getStatus: async (): Promise<SystemStatus> => {
    const response = await apiClient.get<SystemStatus>('/api/status');
    return response.data;
  },
};

// Config API
export const configApi = {
  getConfig: async (): Promise<SystemConfig> => {
    const response = await apiClient.get<SystemConfig>('/api/config');
    return response.data;
  },

  updateConfig: async (config: Partial<SystemConfig>): Promise<SystemConfig> => {
    const response = await apiClient.put<SystemConfig>('/api/config', config);
    return response.data;
  },
};

// Control API
export const controlApi = {
  start: async (): Promise<ControlResponse> => {
    const response = await apiClient.post<ControlResponse>('/api/control/start');
    return response.data;
  },

  stop: async (): Promise<ControlResponse> => {
    const response = await apiClient.post<ControlResponse>('/api/control/stop');
    return response.data;
  },

  restart: async (): Promise<ControlResponse> => {
    const response = await apiClient.post<ControlResponse>('/api/control/restart');
    return response.data;
  },
};

// Logs API
export const logsApi = {
  getLogs: async (lines: number = 100, level?: string): Promise<LogsResponse> => {
    const params: Record<string, string | number> = { lines };
    if (level) {
      params.level = level;
    }
    const response = await apiClient.get<LogsResponse>('/api/logs', { params });
    return response.data;
  },
};

export default apiClient;
