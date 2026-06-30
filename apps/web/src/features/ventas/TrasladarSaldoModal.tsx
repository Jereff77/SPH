import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ApiRequestError } from '@/lib/api';
import { hoyMexico, type PagoVentaRow, ventasApi } from './ventas.api';

const moneda = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const fechaCorta = (iso: string | null): string => {
  if (!iso) return '—';
  const p = (iso.split('T')[0] ?? iso).split('-');
  return p.length === 3 ? `${Number(p[2])}/${Number(p[1])}/${p[0]}` : iso;
};

/**
 * Saldo pendiente trasladable de una parcialidad: `monto − pagos`, acotado entre
 * 0 y el propio `monto` (una devolución —pago negativo— no debe permitir trasladar
 * más que el valor de la parcialidad). Coincide con el tope del backend.
 */
function saldoPendiente(r: PagoVentaRow): number {
  const monto = r.monto ?? 0;
  const pend = Math.round((monto - (r.pagos ?? 0)) * 100) / 100;
  return Math.max(0, Math.min(monto, pend));
}

/**
 * Modal de **traslado de saldo** (candado: clave 611). Mueve el saldo pendiente
 * (o parte de él) de la parcialidad `origen` a una parcialidad **futura** del
 * mismo plan que el usuario elige. Conserva el total del plan (el backend no
 * exige desactivarlo) y registra el movimiento en ambas parcialidades.
 *
 * Las validaciones aquí son de conveniencia (UX); la validación REAL es
 * server-side (`PlanesService.trasladarSaldo`).
 */
export function TrasladarSaldoModal({
  origen,
  parcialidades,
  onClose,
  onGuardado,
}: {
  origen: PagoVentaRow;
  /** Todas las parcialidades del plan (para elegir el destino futuro). */
  parcialidades: PagoVentaRow[];
  onClose: () => void;
  onGuardado: () => void;
}) {
  const hoy = hoyMexico();
  const pendiente = saldoPendiente(origen);

  // Destinos válidos: del mismo plan, distintos del origen, con fecha futura y
  // **sin pagos registrados** (no se traslada saldo a una parcialidad que ya
  // recibió un pago/adelanto). La validación real es server-side; esto es UX.
  const destinos = useMemo(
    () =>
      parcialidades
        .filter(
          (p) =>
            p.idPdpDet !== origen.idPdpDet &&
            !!p.fecha &&
            p.fecha > hoy &&
            (p.pagos ?? 0) === 0,
        )
        .sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? '')),
    [parcialidades, origen.idPdpDet, hoy],
  );

  const [idDestino, setIdDestino] = useState<string>(
    // Default: la última mensualidad (la de fecha más lejana).
    destinos.length ? (destinos[destinos.length - 1]!.idPdpDet) : '',
  );
  const [monto, setMonto] = useState<string>(pendiente ? String(pendiente) : '');
  const [error, setError] = useState<string | null>(null);

  const montoNum = Number(monto);
  const montoValido =
    Number.isFinite(montoNum) && montoNum > 0 && montoNum <= pendiente + 0.05;

  const mut = useMutation({
    mutationFn: () =>
      ventasApi.trasladarSaldo({
        idPdpDetOrigen: origen.idPdpDet,
        idPdpDetDestino: idDestino,
        monto: montoNum,
      }),
    onSuccess: () => {
      onGuardado();
      onClose();
    },
    onError: (e: unknown) =>
      setError(
        e instanceof ApiRequestError ? e.message : 'No se pudo trasladar el saldo.',
      ),
  });

  const destinoSel = destinos.find((d) => d.idPdpDet === idDestino) ?? null;

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!idDestino) {
      setError('Selecciona la parcialidad de destino.');
      return;
    }
    if (!montoValido) {
      setError('El monto a trasladar debe ser mayor a 0 y no exceder el saldo pendiente.');
      return;
    }
    mut.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b bg-[#1f2a4d] px-5 py-3 text-white">
          <div>
            <h2 className="text-base font-semibold">Trasladar saldo</h2>
            <p className="text-xs text-white/70">
              {origen.nomDescriptivo ?? '—'} · Parcialidad #{origen.numPago ?? '—'}
            </p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white" aria-label="Cerrar">
            ✕
          </button>
        </div>

        <form onSubmit={enviar} className="space-y-4 p-5">
          {/* Resumen del origen */}
          <div className="rounded-lg border bg-gray-50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Origen (parcialidad #{origen.numPago ?? '—'})</span>
              <span className="font-medium">{fechaCorta(origen.fecha)}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-gray-500">Saldo pendiente</span>
              <span className="font-semibold tabular-nums">{moneda(pendiente)}</span>
            </div>
          </div>

          {destinos.length === 0 ? (
            <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              No hay parcialidades con fecha futura y sin pagos en este plan para recibir el saldo.
            </div>
          ) : pendiente <= 0 ? (
            <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Esta parcialidad no tiene saldo pendiente que trasladar.
            </div>
          ) : (
            <>
              <label className="block text-xs text-gray-600">
                Parcialidad de destino (futura)
                <select
                  value={idDestino}
                  onChange={(e) => setIdDestino(e.target.value)}
                  className="mt-1 block w-full rounded border px-2 py-1.5 text-sm"
                >
                  {destinos.map((d) => (
                    <option key={d.idPdpDet} value={d.idPdpDet}>
                      #{d.numPago ?? '—'} · {fechaCorta(d.fecha)} · {d.tipoPago ?? '—'} ·{' '}
                      {moneda(d.monto)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs text-gray-600">
                Monto a trasladar
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={pendiente}
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className="mt-1 block w-full rounded border px-2 py-1.5 text-sm tabular-nums"
                />
                <span className="mt-1 block text-[11px] text-gray-400">
                  Máximo: {moneda(pendiente)}
                </span>
              </label>

              {/* Vista previa del resultado */}
              {montoValido && destinoSel && (
                <div className="rounded-lg border border-[#1f2a4d]/20 bg-[#1f2a4d]/5 p-3 text-xs text-gray-600">
                  <p>
                    El origen quedará en{' '}
                    <span className="font-semibold tabular-nums">
                      {moneda((origen.monto ?? 0) - montoNum)}
                    </span>{' '}
                    y la parcialidad #{destinoSel.numPago ?? '—'} pasará a{' '}
                    <span className="font-semibold tabular-nums">
                      {moneda((destinoSel.monto ?? 0) + montoNum)}
                    </span>
                    . El total del plan no cambia.
                  </p>
                </div>
              )}
            </>
          )}

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
              disabled={
                mut.isPending || destinos.length === 0 || pendiente <= 0 || !montoValido || !idDestino
              }
              className="rounded-lg bg-[#1f2a4d] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#2a376a] disabled:opacity-50"
            >
              {mut.isPending ? 'Trasladando…' : 'Trasladar saldo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
