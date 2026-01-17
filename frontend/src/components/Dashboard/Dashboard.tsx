import { useEffect } from 'react';
import { useAuth, useApi } from '../../hooks';
import { StatusCard, StatsCard, ControlButtons } from './';

export function Dashboard() {
  const { isAdmin } = useAuth();
  const {
    status,
    loading,
    error,
    fetchStatus,
    startProcessor,
    stopProcessor,
    restartProcessor,
  } = useApi();

  useEffect(() => {
    const interval = setInterval(() => {
      fetchStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchStatus]);

  const formatUptime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const RunningIcon = () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  const StoppedIcon = () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  const ClockIcon = () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  const UptimeIcon = () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );

  const LastRunIcon = () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  if (loading.status && !status) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Cargando estado del sistema...</p>
        </div>
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-error-500/10 border border-error-500 rounded-lg p-6 max-w-md">
          <p className="text-error-500 text-center">{error}</p>
        </div>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  const processorType = status.processor.running ? 'success' : 'error';
  const activityType = status.activity.within_schedule ? 'success' : 'warning';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 mt-1">Monitoreo del sistema de procesamiento</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`h-3 w-3 rounded-full ${status.processor.running ? 'bg-success-500 animate-pulse' : 'bg-error-500'}`}></div>
          <span className="text-sm text-slate-400">
            {status.processor.running ? 'En línea' : 'Desconectado'}
          </span>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusCard
          title="Estado del Procesador"
          value={status.processor.running ? 'Running' : 'Stopped'}
          type={processorType}
          icon={status.processor.running ? <RunningIcon /> : <StoppedIcon />}
        />

        <StatusCard
          title="Actividad en Horario"
          value={status.activity.within_schedule}
          type={activityType}
          icon={<ClockIcon />}
        />

        <StatusCard
          title="Uptime del Sistema"
          value={formatUptime(status.processor.uptime)}
          icon={<UptimeIcon />}
        />

        <StatusCard
          title="Última Ejecución"
          value={status.stats.last_run ? new Date(status.stats.last_run).toLocaleString() : 'Nunca'}
          icon={<LastRunIcon />}
        />
      </div>

      {/* Stats Cards */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">Estadísticas</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatsCard
            title="Facturas Procesadas"
            value={status.stats.invoices_processed}
            color="blue"
          />

          <StatsCard
            title="Depósitos Procesados"
            value={status.stats.deposits_processed}
            color="green"
          />

          <StatsCard
            title="Errores"
            value={status.stats.errors}
            color="amber"
          />
        </div>
      </div>

      {/* Control Buttons - Admin Only */}
      {isAdmin && (
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Control del Procesador</h2>
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <p className="text-slate-400 mb-4">
              Controle el estado del procesador de facturas. Tenga en cuenta que detener el procesador interrumpirá el procesamiento automático de correos electrónicos.
            </p>
            <ControlButtons
              isRunning={status.processor.running}
              onStart={startProcessor}
              onStop={stopProcessor}
              onRestart={restartProcessor}
            />
          </div>
        </div>
      )}
    </div>
  );
}
