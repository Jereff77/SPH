import { useState, useEffect, useCallback } from 'react';
import { statusApi, configApi, controlApi, logsApi } from '../services';
import type { SystemStatus, SystemConfig, LogEntry } from '../types';

export function useApi() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState({
    status: false,
    config: false,
    logs: false,
  });
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading((prev) => ({ ...prev, status: true }));
    setError(null);
    try {
      const data = await statusApi.getStatus();
      setStatus(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al obtener el estado');
      console.error('Error fetching status:', err);
    } finally {
      setLoading((prev) => ({ ...prev, status: false }));
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    setLoading((prev) => ({ ...prev, config: true }));
    setError(null);
    try {
      const data = await configApi.getConfig();
      setConfig(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al obtener la configuración');
      console.error('Error fetching config:', err);
    } finally {
      setLoading((prev) => ({ ...prev, config: false }));
    }
  }, []);

  const updateConfig = useCallback(async (newConfig: Partial<SystemConfig>) => {
    setError(null);
    try {
      const data = await configApi.updateConfig(newConfig);
      setConfig(data);
      return { success: true };
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Error al actualizar la configuración';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, []);

  const fetchLogs = useCallback(async (lines: number = 100, level?: string) => {
    setLoading((prev) => ({ ...prev, logs: true }));
    setError(null);
    try {
      const data = await logsApi.getLogs(lines, level);
      setLogs(data.logs);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al obtener los logs');
      console.error('Error fetching logs:', err);
    } finally {
      setLoading((prev) => ({ ...prev, logs: false }));
    }
  }, []);

  const startProcessor = useCallback(async () => {
    setError(null);
    try {
      const result = await controlApi.start();
      if (result.status === 'success') {
        await fetchStatus();
      }
      return result;
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Error al iniciar el procesador';
      setError(errorMessage);
      return { status: 'error', message: errorMessage };
    }
  }, [fetchStatus]);

  const stopProcessor = useCallback(async () => {
    setError(null);
    try {
      const result = await controlApi.stop();
      if (result.status === 'success') {
        await fetchStatus();
      }
      return result;
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Error al detener el procesador';
      setError(errorMessage);
      return { status: 'error', message: errorMessage };
    }
  }, [fetchStatus]);

  const restartProcessor = useCallback(async () => {
    setError(null);
    try {
      const result = await controlApi.restart();
      if (result.status === 'success') {
        await fetchStatus();
      }
      return result;
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Error al reiniciar el procesador';
      setError(errorMessage);
      return { status: 'error', message: errorMessage };
    }
  }, [fetchStatus]);

  useEffect(() => {
    fetchStatus();
    fetchConfig();
  }, [fetchStatus, fetchConfig]);

  return {
    status,
    config,
    logs,
    loading,
    error,
    fetchStatus,
    fetchConfig,
    updateConfig,
    fetchLogs,
    startProcessor,
    stopProcessor,
    restartProcessor,
  };
}
