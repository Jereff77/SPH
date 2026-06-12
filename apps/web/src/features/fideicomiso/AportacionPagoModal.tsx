import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fideicomisoApi,
  hoyMexico,
  TIPO_MOVIMIENTO,
  type PagoFila,
  type RegistrarPagoInput,
} from './fideicomiso.api';
import { ApiRequestError } from '@/lib/api';
import { moneda, fechaCorta } from './format';

const esUrl = (u: string | null): u is string => !!u && /^https?:\/\//.test(u);

/**
 * Detalle de pagos de una partida del fideicomiso (icono $). Réplica de
 * `PagosDetalle` + `RealizarPagoTicket` de v1: lista los pagos registrados (con
 * comprobante / eliminar) y permite **agregar un pago de ticket** (tipomovimiento=3)
 * con fecha, monto, IVA opcional y comprobante (PDF/imagen). Todo vía backend.
 */
export function AportacionPagoModal({
  partida,
  onClose,
  onGuardado,
}: {
  partida: PagoFila;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const idPdpDet = partida.idPdpDet ?? '';
  const { data: pagos = [], isLoading, refetch } = useQuery({
    queryKey: ['fide-pago-detalle', idPdpDet],
    queryFn: () => fideicomisoApi.pagosDetalle(idPdpDet),
    enabled: !!idPdpDet,
  });

  const [tipoOperacion, setTipoOperacion] = useState(1);
  const [fecha, setFecha] = useState(hoyMexico());
  const [monto, setMonto] = useState('');
  const [iva, setIva] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState<string | null>(null);

  async function eliminar(idPago: string) {
    if (!window.confirm('¿Deseas eliminar este pago?')) return;
    setError(null);
    setEliminando(idPago);
    try {
      await fideicomisoApi.eliminarPago(idPago);
      await refetch();
      onGuardado();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'No se pudo eliminar el pago.');
    } finally {
      setEliminando(null);
    }
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const m = Number(monto);
    if (!Number.isFinite(m) || m <= 0) {
      setError('Captura un monto válido.');
      return;
    }
    const input: RegistrarPagoInput = {
      tipoOperacion,
      fecha,
      monto: m,
      iva: iva ? Number(iva) : 0,
      comprobante: archivo,
    };
    setGuardando(true);
    try {
      await fideicomisoApi.registrarPago(idPdpDet, input);
      setMonto('');
      setIva('');
      setArchivo(null);
      await refetch();
      onGuardado();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'No se pudo registrar el pago.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b bg-[#1f2a4d] px-5 py-3 text-white">
          <div>
            <h2 className="text-base font-semibold">Detalle de pagos</h2>
            <p className="text-xs text-white/70">
              {partida.nomDescriptivo ?? '—'} · Pago #{partida.numPago ?? '—'} · {moneda(partida.monto)}
            </p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white" aria-label="Cerrar">✕</button>
        </div>

        <div className="space-y-5 p-5">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-700">Pagos registrados</h3>
            <div className="overflow-hidden rounded-lg border">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Operación</th>
                    <th className="px-3 py-2">Tipo Pago</th>
                    <th className="px-3 py-2 text-right">Monto</th>
                    <th className="px-3 py-2 text-center">Comp.</th>
                    <th className="px-3 py-2 text-center" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {isLoading ? (
                    <tr><td colSpan={6} className="px-3 py-4 text-center text-gray-400">Cargando…</td></tr>
                  ) : pagos.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-4 text-center text-gray-400">Sin pagos registrados.</td></tr>
                  ) : (
                    pagos.map((p) => (
                      <tr key={p.idPago}>
                        <td className="px-3 py-2">{fechaCorta(p.fecha)}</td>
                        <td className="px-3 py-2">{p.tipoOperacion === 2 ? 'Descuento' : 'Pago'}</td>
                        <td className="px-3 py-2">{TIPO_MOVIMIENTO[p.tipomovimiento ?? 0] ?? '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{moneda(p.monto)}</td>
                        <td className="px-3 py-2 text-center">
                          {esUrl(p.comprobante) ? (
                            <a href={p.comprobante} target="_blank" rel="noreferrer" className="text-[#3f5b87] underline">ver</a>
                          ) : ('—')}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => eliminar(p.idPago)}
                            disabled={eliminando === p.idPago}
                            title="Eliminar pago"
                            className="text-red-600 hover:text-red-800 disabled:opacity-40"
                            aria-label="Eliminar pago"
                          >
                            {eliminando === p.idPago ? '…' : '🗑'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <form onSubmit={guardar} className="space-y-3 rounded-lg border bg-gray-50 p-4">
            <h3 className="text-sm font-semibold text-gray-700">Agregar pago (ticket)</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <label className="text-xs text-gray-600">
                Operación
                <select value={tipoOperacion} onChange={(e) => setTipoOperacion(Number(e.target.value))}
                  className="mt-1 block w-full rounded border px-2 py-1.5 text-sm">
                  <option value={1}>Pago</option>
                  <option value={2}>Descuento</option>
                </select>
              </label>
              <label className="text-xs text-gray-600">
                Fecha
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
                  className="mt-1 block w-full rounded border px-2 py-1.5 text-sm" />
              </label>
              <label className="text-xs text-gray-600">
                Monto
                <input type="number" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)}
                  className="mt-1 block w-full rounded border px-2 py-1.5 text-right text-sm" placeholder="0.00" />
              </label>
              <label className="text-xs text-gray-600">
                IVA (opcional)
                <input type="number" step="0.01" value={iva} onChange={(e) => setIva(e.target.value)}
                  className="mt-1 block w-full rounded border px-2 py-1.5 text-right text-sm" placeholder="0.00" />
              </label>
              <label className="text-xs text-gray-600 sm:col-span-2">
                Comprobante (PDF/imagen)
                <input type="file" accept="application/pdf,image/*"
                  onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-xs" />
              </label>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose}
                className="rounded-lg border px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100">Cerrar</button>
              <button type="submit" disabled={guardando}
                className="rounded-lg bg-[#1f2a4d] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#2a376a] disabled:opacity-50">
                {guardando ? 'Guardando…' : 'Registrar pago'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
