import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fideicomisoApi, type PagoFila } from './fideicomiso.api';
import { ApiRequestError } from '@/lib/api';

function fechaHora(iso: string): string {
  if (!iso) return '';
  const [f, h = ''] = iso.split('T');
  const p = (f ?? '').split('-');
  const hora = h.slice(0, 5);
  return p.length === 3 ? `${Number(p[2])}/${Number(p[1])}/${p[0]} ${hora}`.trim() : iso;
}

const inicial = (nombre: string | null): string =>
  (nombre?.trim()?.charAt(0) ?? '?').toUpperCase();

/**
 * Comentarios (bitácora) de una partida (icono 💬). Réplica de `Comentarios` de
 * v1: lista los comentarios de `v_comentarios` (con el nombre del usuario y la
 * fecha) y permite agregar uno nuevo. Todo vía backend.
 */
export function ComentariosAportacionModal({
  partida,
  onClose,
}: {
  partida: PagoFila;
  onClose: () => void;
}) {
  const idPdpDet = partida.idPdpDet ?? '';
  const { data: comentarios = [], isLoading, refetch } = useQuery({
    queryKey: ['fide-comentarios', idPdpDet],
    queryFn: () => fideicomisoApi.comentarios(idPdpDet),
    enabled: !!idPdpDet,
  });
  const [texto, setTexto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function agregar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!texto.trim()) return;
    setGuardando(true);
    try {
      await fideicomisoApi.agregarComentario(idPdpDet, texto.trim());
      setTexto('');
      await refetch();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'No se pudo agregar el comentario.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b bg-[#1f2a4d] px-5 py-3 text-white">
          <div>
            <h2 className="text-base font-semibold">Comentarios</h2>
            <p className="text-xs text-white/70">
              {partida.nomDescriptivo ?? '—'} · Pago #{partida.numPago ?? '—'}
            </p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white" aria-label="Cerrar">✕</button>
        </div>

        <div className="flex-1 space-y-3 overflow-auto p-4">
          {isLoading ? (
            <p className="text-sm text-gray-400">Cargando…</p>
          ) : comentarios.length === 0 ? (
            <p className="text-sm text-gray-400">Sin comentarios.</p>
          ) : (
            comentarios.map((c, i) => (
              <div key={`${c.fc}-${i}`} className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1f2a4d]/10 text-sm font-semibold text-[#1f2a4d]">
                  {inicial(c.usuario)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium text-gray-700">{c.usuario ?? '—'}</span>
                    <span className="shrink-0 text-[11px] text-gray-400">{fechaHora(c.fc)}</span>
                  </div>
                  <p className="text-sm text-gray-600">{c.comentario}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <form onSubmit={agregar} className="space-y-2 border-t p-4">
          {error && <p className="text-xs text-red-600">{error}</p>}
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Nuevo comentario…"
            rows={2}
            maxLength={200}
            className="w-full rounded border px-2 py-1.5 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose}
              className="rounded-lg border px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100">Cerrar</button>
            <button type="submit" disabled={guardando || !texto.trim()}
              className="rounded-lg bg-[#1f2a4d] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#2a376a] disabled:opacity-50">
              {guardando ? 'Guardando…' : 'Agregar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
