import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { soporteApi, type EstadoIncidente, type IncidenteResumen } from './soporte-inquilinos.api';
import { DetalleIncidente } from './IncidentesTab';
import { useAuth } from '@/features/auth/useAuth';
import { ApiRequestError } from '@/lib/api';

const COLUMNAS: { estado: EstadoIncidente; color: string }[] = [
  { estado: 'Nuevo', color: 'border-blue-300' },
  { estado: 'En Proceso', color: 'border-amber-300' },
  { estado: 'Resuelto', color: 'border-green-300' },
  { estado: 'Detenido', color: 'border-red-300' },
  { estado: 'Cerrado', color: 'border-gray-300' },
];

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' }) : '';

export function TableroTab() {
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const puedeMover = tienePermiso(33);
  const [sel, setSel] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<EstadoIncidente | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: incidentes = [], isLoading } = useQuery({
    queryKey: ['inc-lista', '', ''],
    queryFn: () => soporteApi.incidentes(),
  });

  const mover = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: EstadoIncidente }) =>
      soporteApi.cambiarEstado(id, estado),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['inc-lista'] });
    },
    onError: (e) =>
      setError(e instanceof ApiRequestError ? e.message : 'No se pudo mover el incidente.'),
  });

  const porEstado = useMemo(() => {
    const m = new Map<EstadoIncidente, IncidenteResumen[]>();
    for (const c of COLUMNAS) m.set(c.estado, []);
    for (const i of incidentes) m.get(i.estado as EstadoIncidente)?.push(i);
    return m;
  }, [incidentes]);

  const soltar = (estado: EstadoIncidente) => {
    setSobre(null);
    const id = arrastrando;
    setArrastrando(null);
    if (!id) return;
    const inc = incidentes.find((x) => x.id === id);
    if (inc && inc.estado !== estado) mover.mutate({ id, estado });
  };

  return (
    <>
      {!puedeMover && (
        <p className="mb-2 text-xs text-gray-400">
          Para mover incidentes entre columnas necesitas el permiso de clasificar (clave 33).
        </p>
      )}
      {error && (
        <div className="mb-2 rounded-md bg-red-50 px-3 py-1.5 text-xs text-red-700">{error}</div>
      )}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {COLUMNAS.map((col) => {
          const items = porEstado.get(col.estado) ?? [];
          const resaltar = puedeMover && sobre === col.estado;
          return (
            <div
              key={col.estado}
              onDragOver={(e) => {
                if (!puedeMover) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (sobre !== col.estado) setSobre(col.estado);
              }}
              onDragLeave={(e) => {
                // Solo limpiar si el cursor salió del contenedor (no hacia un hijo).
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setSobre(null);
              }}
              onDrop={(e) => {
                if (!puedeMover) return;
                e.preventDefault();
                soltar(col.estado);
              }}
              className={`flex w-72 shrink-0 flex-col rounded-xl border bg-gray-50/60 transition ${
                resaltar ? 'ring-2 ring-[#1f2a4d]/40' : ''
              }`}
            >
              <div className={`border-b-2 px-3 py-2 ${col.color}`}>
                <span className="text-sm font-semibold text-gray-700">{col.estado}</span>
                <span className="ml-2 rounded-full bg-white px-2 text-xs text-gray-500">{items.length}</span>
              </div>
              <div className="flex-1 space-y-2 overflow-auto p-2">
                {isLoading && <p className="px-1 py-2 text-xs text-gray-400">Cargando…</p>}
                {!isLoading && items.length === 0 && (
                  <p className="px-1 py-2 text-xs text-gray-300">{resaltar ? 'Soltar aquí…' : '—'}</p>
                )}
                {items.map((i) => (
                  <div
                    key={i.id}
                    draggable={puedeMover}
                    onDragStart={(e) => {
                      setArrastrando(i.id);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', i.id);
                    }}
                    onDragEnd={() => {
                      setArrastrando(null);
                      setSobre(null);
                    }}
                    onClick={() => setSel(i.id)}
                    className={`block w-full rounded-lg border bg-white p-2.5 text-left shadow-sm hover:border-[#3f5b87]/40 ${
                      puedeMover ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                    } ${arrastrando === i.id ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] text-gray-400">{i.folio}</span>
                      {i.estado === 'Detenido' && i.detenidoOrigen === 'auto' && (
                        <span className="text-[9px] text-red-500">auto</span>
                      )}
                    </div>
                    <div className="mt-0.5 line-clamp-2 text-xs font-medium text-gray-800">
                      {i.asunto ?? '(sin asunto)'}
                    </div>
                    <div className="mt-1 truncate text-[11px] text-gray-500">
                      {i.inquilino ?? i.remitente ?? '—'}
                      {i.nave ? ` · ${i.nave}` : ''}
                    </div>
                    {(i.categoria || i.prioridad) && (
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {i.categoria && (
                          <span className="rounded bg-sky-50 px-1.5 text-[10px] text-sky-700">
                            {i.categoria}
                          </span>
                        )}
                        {i.prioridad && (
                          <span
                            className={`rounded px-1.5 text-[10px] ${
                              i.prioridad === 'Alta'
                                ? 'bg-red-50 text-red-700'
                                : i.prioridad === 'Baja'
                                  ? 'bg-gray-100 text-gray-500'
                                  : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {i.prioridad}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-[10px] text-gray-400">{fecha(i.ultimaActividad)}</span>
                      {i.asignado && (
                        <span className="truncate rounded bg-indigo-50 px-1.5 text-[10px] text-indigo-700">
                          👤 {i.asignado}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de detalle */}
      {sel && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSel(null)}
        >
          <div
            className="flex h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-4 py-2">
              <span className="text-sm font-semibold text-gray-700">Incidente</span>
              <button
                onClick={() => setSel(null)}
                className="rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
              >
                ✕ Cerrar
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden p-2">
              <DetalleIncidente id={sel} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
