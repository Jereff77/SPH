import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invitacionesApi, type Invitacion } from './invitaciones.api';
import { ApiRequestError } from '@/lib/api';

const QKEY = ['invitaciones'];

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX');
}

function EstadoChip({ inv }: { inv: Invitacion }) {
  if (inv.estado === 'aceptada')
    return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Aceptada</span>;
  if (inv.estado === 'cancelada')
    return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">Cancelada</span>;
  if (!inv.vigente)
    return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Expirada</span>;
  return <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Pendiente</span>;
}

/** Lista de invitaciones con acciones de reenviar/cancelar (solo pendientes). */
export function InvitacionesPanel({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: QKEY,
    queryFn: () => invitacionesApi.listar(),
  });

  const refrescar = () => queryClient.invalidateQueries({ queryKey: QKEY });

  const mReenviar = useMutation({
    mutationFn: (id: string) => invitacionesApi.reenviar(id),
    onSuccess: (r) => {
      setError(null);
      setAviso(
        r.enviado
          ? 'Invitación reenviada con un enlace nuevo.'
          : 'Se renovó el enlace, pero no se pudo enviar el correo (revisa SMTP).',
      );
      refrescar();
    },
    onError: (e) =>
      setError(e instanceof ApiRequestError ? e.message : 'No se pudo reenviar.'),
  });

  const mGenerarLink = useMutation({
    mutationFn: (id: string) => invitacionesApi.generarLink(id),
    onSuccess: async (r) => {
      setError(null);
      try {
        await navigator.clipboard.writeText(r.link);
        setAviso('Link copiado al portapapeles. El enlace anterior quedó invalidado.');
      } catch {
        setAviso(`No se pudo copiar automáticamente. Enlace: ${r.link}`);
      }
      refrescar();
    },
    onError: (e) =>
      setError(e instanceof ApiRequestError ? e.message : 'No se pudo generar el link.'),
  });

  const mCancelar = useMutation({
    mutationFn: (id: string) => invitacionesApi.cancelar(id),
    onSuccess: () => {
      setError(null);
      setAviso('Invitación cancelada.');
      refrescar();
    },
    onError: (e) =>
      setError(e instanceof ApiRequestError ? e.message : 'No se pudo cancelar.'),
  });

  const ocupado = mReenviar.isPending || mGenerarLink.isPending || mCancelar.isPending;
  const invitaciones = data ?? [];

  return (
    <div className="w-full shrink-0 rounded-xl border bg-white shadow-sm lg:w-[28rem]">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-bold text-gray-800">Invitaciones</h2>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>

      {(error || aviso) && (
        <div className="px-4 pt-3">
          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
          )}
          {aviso && !error && (
            <div className="rounded-md bg-green-50 px-3 py-2 text-xs text-green-700">{aviso}</div>
          )}
        </div>
      )}

      <div className="max-h-[calc(100vh-14rem)] overflow-auto p-3">
        {isLoading && <p className="px-1 py-4 text-center text-sm text-gray-400">Cargando…</p>}
        {isError && (
          <p className="px-1 py-4 text-center text-sm text-red-600">
            No se pudieron cargar las invitaciones.
          </p>
        )}
        {!isLoading && !isError && invitaciones.length === 0 && (
          <p className="px-1 py-4 text-center text-sm text-gray-400">Sin invitaciones.</p>
        )}
        <ul className="space-y-2">
          {invitaciones.map((inv) => (
            <li key={inv.id} className="rounded-lg border border-gray-100 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800">
                    {[inv.nombre, inv.apellidos].filter(Boolean).join(' ') || inv.email}
                  </p>
                  <p className="truncate text-xs text-gray-500">{inv.email}</p>
                </div>
                <EstadoChip inv={inv} />
              </div>
              <p className="mt-1 text-[11px] text-gray-400">
                Enviada {fechaCorta(inv.creadoEn)} · Vence {fechaCorta(inv.fecExpira)}
              </p>
              {inv.estado === 'pendiente' && (
                <div className="mt-2 flex gap-2">
                  <button
                    disabled={ocupado}
                    onClick={() => mReenviar.mutate(inv.id)}
                    className="rounded-md border border-[#3f5b87] px-2.5 py-1 text-xs font-medium text-[#3f5b87] hover:bg-[#3f5b87]/10 disabled:opacity-50"
                  >
                    Reenviar
                  </button>
                  <button
                    disabled={ocupado}
                    onClick={() => mGenerarLink.mutate(inv.id)}
                    className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                  >
                    Copiar link
                  </button>
                  <button
                    disabled={ocupado}
                    onClick={() => mCancelar.mutate(inv.id)}
                    className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
