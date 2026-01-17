import { useState } from 'react';

interface ControlButtonsProps {
  isRunning: boolean;
  onStart: () => Promise<any>;
  onStop: () => Promise<any>;
  onRestart: () => Promise<any>;
}

export function ControlButtons({ isRunning, onStart, onStop, onRestart }: ControlButtonsProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleAction = async (action: () => Promise<any>, actionName: string) => {
    setActionLoading(actionName);
    try {
      await action();
    } catch (error) {
      console.error(`Error performing ${actionName}:`, error);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="flex gap-3 flex-wrap">
      {!isRunning ? (
        <button
          onClick={() => handleAction(onStart, 'start')}
          disabled={actionLoading !== null}
          className="px-6 py-2.5 bg-success-500 hover:bg-success-600 text-white font-medium rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-success-500 focus:ring-offset-2 focus:ring-offset-slate-800 flex items-center gap-2"
        >
          {actionLoading === 'start' ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Iniciando...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Iniciar
            </>
          )}
        </button>
      ) : (
        <button
          onClick={() => handleAction(onStop, 'stop')}
          disabled={actionLoading !== null}
          className="px-6 py-2.5 bg-error-500 hover:bg-error-600 text-white font-medium rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-error-500 focus:ring-offset-2 focus:ring-offset-slate-800 flex items-center gap-2"
        >
          {actionLoading === 'stop' ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Deteniendo...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
              Detener
            </>
          )}
        </button>
      )}

      <button
        onClick={() => handleAction(onRestart, 'restart')}
        disabled={actionLoading !== null}
        className="px-6 py-2.5 bg-warning-500 hover:bg-warning-600 text-white font-medium rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-warning-500 focus:ring-offset-2 focus:ring-offset-slate-800 flex items-center gap-2"
      >
        {actionLoading === 'restart' ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            Reiniciando...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reiniciar
          </>
        )}
      </button>
    </div>
  );
}
