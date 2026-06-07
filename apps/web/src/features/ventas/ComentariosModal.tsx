import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ventasApi, type PagoVentaRow } from './ventas.api';

const fechaHora = (iso: string): string => {
  const [f, h = ''] = iso.split('T');
  const p = (f ?? '').split('-');
  const hora = h.slice(0, 5);
  return p.length === 3 ? `${Number(p[2])}/${Number(p[1])}/${p[0]} ${hora}`.trim() : iso;
};

/** Comentarios (bitácora) de una parcialidad + alta de comentarios manuales. */
export function ComentariosModal({
  fila,
  onClose,
}: {
  fila: PagoVentaRow;
  onClose: () => void;
}) {
  const { data: comentarios = [], isLoading, refetch } = useQuery({
    queryKey: ['ventas-comentarios', fila.idPdpDet],
    queryFn: () => ventasApi.comentarios(fila.idPdpDet),
  });
  const [texto, setTexto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!texto.trim()) return;
    setGuardando(true);
    try {
      await ventasApi.agregarComentario(fila.idPdpDet, texto.trim());
      setTexto('');
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar el comentario.');
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
              {fila.nomDescriptivo ?? '—'} · Pago #{fila.numPago ?? '—'}
            </p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white" aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-auto p-4">
          {isLoading ? (
            <p className="text-sm text-gray-400">Cargando…</p>
          ) : comentarios.length === 0 ? (
            <p className="text-sm text-gray-400">Sin comentarios.</p>
          ) : (
            comentarios.map((c) => (
              <div key={c.idComents} className="rounded-lg border bg-gray-50 p-3">
                <p className="text-sm text-gray-800">{c.comentario}</p>
                <p className="mt-1 text-[11px] text-gray-400">
                  {c.origen} · {fechaHora(c.fc)}
                </p>
              </div>
            ))
          )}
        </div>

        <form onSubmit={agregar} className="space-y-2 border-t p-4">
          {error && <p className="text-xs text-red-600">{error}</p>}
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escribe un comentario…"
            rows={2}
            className="w-full rounded border px-2 py-1.5 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
            >
              Cerrar
            </button>
            <button
              type="submit"
              disabled={guardando || !texto.trim()}
              className="rounded-lg bg-[#1f2a4d] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#2a376a] disabled:opacity-50"
            >
              {guardando ? 'Guardando…' : 'Agregar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
