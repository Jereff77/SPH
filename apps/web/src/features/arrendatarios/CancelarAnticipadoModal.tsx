import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { arrendatariosApi, fechaCorta, moneda } from './arrendatarios.api';

/**
 * Modal de **cancelación anticipada** de un plan: el usuario elige a partir de
 * qué mes (partida) se deja de cobrar; los meses anteriores se conservan. La nave
 * se libera al confirmar. No se pueden cancelar meses ya pagados (la precarga
 * indica la primera partida cancelable). Acción irreversible.
 */
export function CancelarAnticipadoModal({
  idArrePdp,
  nombre,
  onClose,
  onCancelado,
}: {
  idArrePdp: string;
  nombre: string;
  onClose: () => void;
  onCancelado: () => void;
}) {
  const { data: pre, isLoading } = useQuery({
    queryKey: ['arre-cancelacion-precarga', idArrePdp],
    queryFn: () => arrendatariosApi.cancelacionPrecarga(idArrePdp),
  });

  const [corte, setCorte] = useState<number | ''>('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Partidas que se pueden cancelar (desde la primera cancelable).
  const cancelables = useMemo(
    () => (pre?.partidas ?? []).filter((p) => p.numPartida >= (pre?.primerCancelable ?? 1)),
    [pre],
  );

  // Selección inicial: la primera cancelable.
  useEffect(() => {
    if (corte === '' && cancelables.length > 0) setCorte(cancelables[0]!.numPartida);
  }, [cancelables, corte]);

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (corte === '') {
      setError('Selecciona el mes a partir del cual cancelar.');
      return;
    }
    if (!motivo.trim()) {
      setError('El motivo es obligatorio.');
      return;
    }
    setGuardando(true);
    try {
      await arrendatariosApi.cancelarAnticipado(idArrePdp, {
        numPartidaCorte: Number(corte),
        motivo: motivo.trim(),
      });
      onCancelado();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cancelar el contrato.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between bg-[#1f2a4d] px-5 py-3 text-white">
          <h2 className="text-base font-semibold">Cancelación anticipada · {nombre}</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white" aria-label="Cerrar">
            ✕
          </button>
        </div>

        {isLoading || !pre ? (
          <p className="px-5 py-10 text-center text-sm text-gray-400">Cargando datos del plan…</p>
        ) : cancelables.length === 0 ? (
          <div className="space-y-4 p-5">
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              No hay meses cancelables: todos los meses del plan ya están pagados o no hay partidas
              posteriores al último pago.
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              >
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={registrar} className="space-y-4 p-5">
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              Se cancelarán los meses <b>desde la partida seleccionada</b> (los meses anteriores se
              conservan). La <b>nave se liberará</b> y quedará disponible. <b>Esta acción no se puede
              deshacer.</b>
            </p>

            <label className="block text-xs text-gray-600">
              Cancelar a partir de
              <select
                value={corte}
                onChange={(e) => setCorte(e.target.value ? Number(e.target.value) : '')}
                className="mt-1 block w-full rounded border px-2 py-1.5 text-sm"
              >
                {cancelables.map((p) => (
                  <option key={p.numPartida} value={p.numPartida}>
                    Partida {p.numPartida} · {fechaCorta(p.fecha)} · {moneda(p.monto)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs text-gray-600">
              Motivo de la cancelación <span className="text-red-500">*</span>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={3}
                maxLength={400}
                placeholder="Describe el motivo de la cancelación…"
                className="mt-1 block w-full rounded border px-2 py-1.5 text-sm"
              />
            </label>

            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {guardando ? 'Cancelando…' : 'Cancelar contrato'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
