import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  arrendatariosApi,
  hoyMexico,
  moneda,
  fechaCorta,
  type DepositoSinAplicar,
  type PagoArreRow,
} from './arrendatarios.api';

/**
 * Modal de aplicación de pago: elige un depósito sin aplicar y las partidas
 * pendientes a cubrir. Valida importe vs total seleccionado (Exacto/Sobrante/
 * Insuficiente) y aplica vía `aplicar_pago_arrendatario` (transaccional en el
 * backend). Reemplaza el modal del WebView de v1 (sin cliente Supabase).
 */
export function AplicarPagoModal({
  onClose,
  onAplicado,
}: {
  onClose: () => void;
  onAplicado: () => void;
}) {
  const [busca, setBusca] = useState('');
  const [deposito, setDeposito] = useState<DepositoSinAplicar | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [fecPago, setFecPago] = useState(hoyMexico());
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [aplicando, setAplicando] = useState(false);

  const { data: depositos = [], isLoading: cargandoDep } = useQuery({
    queryKey: ['arre-depositos', busca],
    queryFn: () => arrendatariosApi.depositosSinAplicar(busca || undefined),
  });

  // Partidas pendientes (todas; se filtran por divisa del depósito al seleccionar).
  const { data: pendientes = [], isLoading: cargandoPend } = useQuery({
    queryKey: ['arre-pendientes-aplicar'],
    queryFn: () => arrendatariosApi.cobranza({ soloPendientes: true }),
    enabled: !!deposito,
  });

  const divisaDep = deposito?.moneda || 'MXN';
  // Solo partidas de la misma divisa que el depósito (no se mezclan MXN/USD).
  const candidatas = useMemo(
    () => pendientes.filter((p) => (p.divisa || 'MXN') === divisaDep),
    [pendientes, divisaDep],
  );

  const totalSel = useMemo(
    () => candidatas.filter((p) => sel.has(p.id_detalle)).reduce((s, p) => s + (p.monto ?? 0), 0),
    [candidatas, sel],
  );

  const importe = deposito?.importe ?? 0;
  const estado: 'Exacto' | 'Sobrante' | 'Insuficiente' | null =
    !deposito || sel.size === 0
      ? null
      : importe + 0.005 < totalSel
        ? 'Insuficiente'
        : Math.abs(importe - totalSel) <= 0.005
          ? 'Exacto'
          : 'Sobrante';

  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  function elegirDeposito(d: DepositoSinAplicar) {
    setDeposito(d);
    setSel(new Set());
    setError(null);
    setMsg(null);
  }

  async function aplicar() {
    if (!deposito || sel.size === 0) return;
    if (estado === 'Insuficiente') {
      setError('El depósito es insuficiente para las partidas seleccionadas.');
      return;
    }
    setError(null);
    setAplicando(true);
    try {
      const r = await arrendatariosApi.aplicarPago({
        idmov: deposito.idmov,
        idsDetalle: [...sel],
        fecPago,
      });
      setMsg(`Pago aplicado (${r.estado}). Importe ${moneda(r.importe, divisaDep)} / total ${moneda(r.total, divisaDep)}.`);
      setDeposito(null);
      setSel(new Set());
      onAplicado();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo aplicar el pago.');
    } finally {
      setAplicando(false);
    }
  }

  const colorEstado =
    estado === 'Insuficiente'
      ? 'text-red-600'
      : estado === 'Sobrante'
        ? 'text-amber-600'
        : 'text-green-600';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between bg-[#1f2a4d] px-5 py-3 text-white">
          <h2 className="text-base font-semibold">Aplicar pago de renta</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white" aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-4 overflow-auto p-5 lg:grid-cols-2">
          {/* Depósitos sin aplicar */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">1. Depósito bancario</h3>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por ordenante / rastreo…"
              className="w-full rounded border px-2 py-1.5 text-sm"
            />
            <div className="max-h-72 divide-y overflow-auto rounded-lg border">
              {cargandoDep ? (
                <p className="px-3 py-4 text-center text-xs text-gray-400">Cargando…</p>
              ) : depositos.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-gray-400">Sin depósitos por aplicar.</p>
              ) : (
                depositos.map((d) => (
                  <button
                    key={d.idmov}
                    type="button"
                    onClick={() => elegirDeposito(d)}
                    className={`block w-full px-3 py-2 text-left text-xs hover:bg-gray-50 ${
                      deposito?.idmov === d.idmov ? 'bg-[#1f2a4d]/5' : ''
                    }`}
                  >
                    <div className="flex justify-between font-medium text-gray-700">
                      <span>{d.ordenante ?? '—'}</span>
                      <span className="tabular-nums">{moneda(d.importe, d.moneda ?? 'MXN')}</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>{fechaCorta(d.fec_operacion)}</span>
                      <span>{d.rastreo ?? ''} · {d.moneda ?? 'MXN'}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Partidas pendientes */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">2. Partidas a cubrir</h3>
            {!deposito ? (
              <p className="rounded-lg border border-dashed px-3 py-8 text-center text-xs text-gray-400">
                Selecciona primero un depósito.
              </p>
            ) : cargandoPend ? (
              <p className="px-3 py-4 text-center text-xs text-gray-400">Cargando partidas…</p>
            ) : candidatas.length === 0 ? (
              <p className="rounded-lg border border-dashed px-3 py-8 text-center text-xs text-gray-400">
                Sin partidas pendientes en {divisaDep}.
              </p>
            ) : (
              <div className="max-h-72 divide-y overflow-auto rounded-lg border">
                {candidatas.map((p: PagoArreRow) => (
                  <label
                    key={p.id_detalle}
                    className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={sel.has(p.id_detalle)}
                      onChange={() => toggle(p.id_detalle)}
                      className="h-4 w-4"
                    />
                    <div className="flex-1">
                      <div className="flex justify-between font-medium text-gray-700">
                        <span>
                          {p.nave ?? '—'} · {p.concepto ?? '—'}
                        </span>
                        <span className="tabular-nums">{moneda(p.monto, p.divisa ?? 'MXN')}</span>
                      </div>
                      <div className="text-gray-400">
                        {p.razon_social ?? '—'} · {fechaCorta(p.fecha)}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Resumen / acciones */}
        <div className="border-t px-5 py-3">
          {deposito && (
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
              <div className="flex items-center gap-4">
                <span className="text-gray-500">
                  Importe: <span className="font-medium text-gray-800">{moneda(importe, divisaDep)}</span>
                </span>
                <span className="text-gray-500">
                  Seleccionado: <span className="font-medium text-gray-800">{moneda(totalSel, divisaDep)}</span>
                </span>
                {estado && (
                  <span className={`font-semibold ${colorEstado}`}>
                    {estado}
                    {estado === 'Sobrante' && ` (+${moneda(importe - totalSel, divisaDep)})`}
                  </span>
                )}
              </div>
              <label className="text-xs text-gray-600">
                Fecha de pago
                <input
                  type="date"
                  value={fecPago}
                  onChange={(e) => setFecPago(e.target.value)}
                  className="ml-2 rounded border px-2 py-1 text-sm"
                />
              </label>
            </div>
          )}
          {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
          {msg && <p className="mb-2 text-xs text-green-700">{msg}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={aplicar}
              disabled={aplicando || !deposito || sel.size === 0 || estado === 'Insuficiente'}
              className="rounded-lg bg-[#1f2a4d] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#2a376a] disabled:opacity-50"
            >
              {aplicando ? 'Aplicando…' : 'Aplicar pago'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
