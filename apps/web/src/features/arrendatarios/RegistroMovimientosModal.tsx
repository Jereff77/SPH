import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { arrendatariosApi, num, fechaCorta, type MovimientoPago } from './arrendatarios.api';

/** Fecha + hora corta (dd/mm/aaaa hh:mm) a partir de un ISO. */
function fechaHora(iso: string | null): string {
  if (!iso) return '—';
  const d = fechaCorta(iso);
  const t = iso.includes('T') ? iso.split('T')[1]?.slice(0, 5) : '';
  return t ? `${d} ${t}` : d;
}

/**
 * Registro de movimientos de cobranza: historial de pagos **aplicados** y
 * **desaplicados** (tabla `arre_pagos`, agrupado por aplicación). Permite
 * **desaplicar** (revertir) un pago aplicado por error.
 */
export function RegistroMovimientosModal({
  onClose,
  onCambio,
}: {
  onClose: () => void;
  onCambio: () => void;
}) {
  const queryClient = useQueryClient();
  const [confirmar, setConfirmar] = useState<MovimientoPago | null>(null);
  const [motivo, setMotivo] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: movs = [], isLoading } = useQuery({
    queryKey: ['arre-historial-pagos'],
    queryFn: () => arrendatariosApi.historialPagos({ limite: 300 }),
  });

  async function desaplicar() {
    if (!confirmar) return;
    setProcesando(true);
    setError(null);
    try {
      await arrendatariosApi.desaplicarPago(confirmar.uidPago, motivo.trim() || undefined);
      setConfirmar(null);
      setMotivo('');
      void queryClient.invalidateQueries({ queryKey: ['arre-historial-pagos'] });
      void queryClient.invalidateQueries({ queryKey: ['arre-depositos'] });
      onCambio();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo desaplicar el pago.');
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between bg-[#1f2a4d] px-5 py-3 text-white">
          <h2 className="text-base font-semibold">Registro de movimientos (pagos)</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white" aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className="overflow-auto p-4">
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-500 [&>th]:px-3 [&>th]:py-2">
                <th>Fecha pago</th>
                <th>Ordenante (depósito)</th>
                <th>Arrendatario</th>
                <th className="text-right">Monto</th>
                <th className="text-center">Part.</th>
                <th>Estado</th>
                <th>Aplicado</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                    Cargando…
                  </td>
                </tr>
              ) : movs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                    Aún no hay pagos registrados.
                  </td>
                </tr>
              ) : (
                movs.map((m) => {
                  const aplicado = m.estado === 'aplicado';
                  return (
                    <tr key={m.uidPago} className={aplicado ? '' : 'bg-gray-50 text-gray-400'}>
                      <td className="whitespace-nowrap px-3 py-1.5">{fechaCorta(m.fecPago)}</td>
                      <td className="px-3 py-1.5">{m.ordenante ?? '—'}</td>
                      <td className="px-3 py-1.5">{m.razonSocial ?? '—'}</td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-right font-semibold tabular-nums">
                        {num(m.monto)}
                      </td>
                      <td className="px-3 py-1.5 text-center">{m.partidas}</td>
                      <td className="px-3 py-1.5">
                        {aplicado ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                            Aplicado
                          </span>
                        ) : (
                          <span
                            className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-600"
                            title={m.motivo ? `Motivo: ${m.motivo}` : undefined}
                          >
                            Desaplicado
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-gray-500">
                        {fechaHora(m.aplicadoEn)}
                        {!aplicado && (
                          <span className="block text-[10px] text-gray-400">
                            ✗ {fechaHora(m.desaplicadoEn)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {aplicado && (
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmar(m);
                              setMotivo('');
                              setError(null);
                            }}
                            className="rounded border border-red-300 px-2 py-0.5 text-[11px] font-medium text-red-600 hover:bg-red-50"
                          >
                            Desaplicar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end border-t px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#1f2a4d] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#2a376a]"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* Confirmación de desaplicar */}
      {confirmar && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-[#1f2a4d]">Desaplicar pago</h3>
            <p className="mt-1 text-sm text-gray-600">
              Las {confirmar.partidas} partida(s) volverán a <b>pendiente</b> y el depósito (
              {num(confirmar.monto)}) quedará <b>disponible</b> de nuevo. Esta acción queda registrada.
            </p>
            <label className="mt-3 block text-xs font-semibold text-gray-500">Motivo (opcional)</label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              placeholder="Ej. depósito aplicado por error a la nave incorrecta"
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            />
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmar(null)}
                disabled={procesando}
                className="rounded-lg border px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={desaplicar}
                disabled={procesando}
                className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:bg-gray-300"
              >
                {procesando ? 'Desaplicando…' : 'Desaplicar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
