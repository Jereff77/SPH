import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  arrendatariosApi,
  hoyMexico,
  num,
  fechaCorta,
  type DepositoSinAplicar,
  type PagoArreRow,
} from './arrendatarios.api';

interface NavePendiente {
  nave: string;
  parque: string;
  monto: number;
}

/**
 * Modal de aplicación de pago, abierto **por razón social** (como v1): a la
 * izquierda los depósitos sin aplicar (búsqueda por ordenante, precargada con la
 * razón social), a la derecha las naves con pago pendiente de ese arrendatario
 * (checkbox, marcadas por defecto). Valida importe vs total seleccionado
 * (Exacto/Sobrante/Insuficiente) y aplica vía `aplicar_pago_arrendatario`.
 */
export function AplicarPagoModal({
  razonSocial,
  filasPendientes,
  anio,
  mes,
  onClose,
  onAplicado,
}: {
  razonSocial: string;
  filasPendientes: PagoArreRow[];
  anio: number;
  mes: number;
  onClose: () => void;
  onAplicado: () => void;
}) {
  const [busca, setBusca] = useState(razonSocial);
  const [deposito, setDeposito] = useState<DepositoSinAplicar | null>(null);
  const [selNaves, setSelNaves] = useState<Set<string>>(
    () => new Set(filasPendientes.map((r) => r.nave ?? '')),
  );
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [aplicando, setAplicando] = useState(false);

  const { data: depositos = [], isLoading: cargandoDep } = useQuery({
    queryKey: ['arre-depositos', busca, anio, mes],
    queryFn: () => arrendatariosApi.depositosSinAplicar(busca || undefined, anio, mes),
  });

  // Naves pendientes de esta razón social (agrupadas, suma de monto).
  const naves = useMemo<NavePendiente[]>(() => {
    const map = new Map<string, NavePendiente>();
    for (const r of filasPendientes) {
      const nave = r.nave ?? '—';
      const cur = map.get(nave) ?? { nave, parque: r.parque ?? '', monto: 0 };
      cur.monto += r.monto ?? 0;
      map.set(nave, cur);
    }
    return [...map.values()].sort((a, b) => a.nave.localeCompare(b.nave, 'es'));
  }, [filasPendientes]);

  const totalSel = useMemo(
    () => naves.filter((n) => selNaves.has(n.nave)).reduce((s, n) => s + n.monto, 0),
    [naves, selNaves],
  );

  const importe = deposito?.importe ?? 0;
  const dif = importe - totalSel;
  const estado: 'Exacto' | 'Sobrante' | 'Insuficiente' | null =
    !deposito || totalSel === 0
      ? null
      : dif < -0.005
        ? 'Insuficiente'
        : Math.abs(dif) <= 0.005
          ? 'Exacto'
          : 'Sobrante';

  const toggleNave = (nave: string) =>
    setSelNaves((s) => {
      const n = new Set(s);
      if (n.has(nave)) n.delete(nave);
      else n.add(nave);
      return n;
    });

  async function aplicar() {
    if (!deposito || estado === 'Insuficiente' || selNaves.size === 0) return;
    // ids de todas las partidas pendientes de las naves seleccionadas.
    const idsDetalle = filasPendientes
      .filter((r) => selNaves.has(r.nave ?? ''))
      .map((r) => r.id_detalle);
    if (idsDetalle.length === 0) {
      setError('Sin partidas pendientes para las naves seleccionadas.');
      return;
    }
    setError(null);
    setAplicando(true);
    try {
      const r = await arrendatariosApi.aplicarPago({
        idmov: deposito.idmov,
        idsDetalle,
        fecPago: deposito.fec_operacion ?? hoyMexico(),
      });
      setMsg(`Pago aplicado (${r.estado}). Importe ${num(r.importe)} / total ${num(r.total)}.`);
      onAplicado();
      onClose();
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
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between bg-[#1f2a4d] px-5 py-3 text-white">
          <h2 className="text-base font-semibold">Aplicar pago — {razonSocial}</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white" aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-0 overflow-hidden md:grid-cols-2">
          {/* Depósitos bancarios */}
          <div className="flex flex-col gap-2 overflow-auto p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Depósito bancario
            </div>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nombre del ordenante…"
              className="w-full rounded border px-2 py-1.5 text-sm"
            />
            <div className="flex flex-col gap-1">
              {cargandoDep ? (
                <p className="px-2 py-4 text-center text-xs text-gray-400">Buscando…</p>
              ) : depositos.length === 0 ? (
                <p className="px-2 py-4 text-center text-xs text-gray-400">
                  Sin depósitos sin aplicar.
                </p>
              ) : (
                depositos.map((d) => (
                  <button
                    key={d.idmov}
                    type="button"
                    onClick={() => setDeposito(d)}
                    className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                      deposito?.idmov === d.idmov
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="font-semibold text-gray-700">{d.ordenante ?? '—'}</span>
                      <span className="font-bold text-[#1f2a4d]">{num(d.importe)}</span>
                    </div>
                    <div className="text-gray-400">
                      {fechaCorta(d.fec_operacion)} · {d.rastreo ?? ''} · {d.moneda ?? 'MXN'}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Naves con pago pendiente */}
          <div className="flex flex-col gap-2 overflow-auto border-t p-4 md:border-l md:border-t-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Naves con pago pendiente <span className="font-normal normal-case text-gray-400">(con IVA)</span>
            </div>
            {naves.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-gray-400">Sin partidas pendientes.</p>
            ) : (
              naves.map((n) => (
                <label
                  key={n.nave}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selNaves.has(n.nave)}
                    onChange={() => toggleNave(n.nave)}
                    className="h-4 w-4 accent-amber-500"
                  />
                  <div className="flex-1">
                    <div className="font-bold text-[#1f2a4d]">{n.nave}</div>
                    <div className="text-gray-400">{n.parque}</div>
                  </div>
                  <span className="font-bold text-red-600">{num(n.monto)}</span>
                </label>
              ))
            )}
          </div>
        </div>

        {/* Resumen */}
        <div className="flex flex-wrap items-center gap-6 border-t bg-gray-50 px-5 py-3 text-sm">
          <div>
            <span className="block text-[10px] uppercase text-gray-400">Depósito</span>
            <span className="font-bold text-[#1f2a4d]">{deposito ? num(importe) : '—'}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase text-gray-400">Seleccionado</span>
            <span className="font-bold text-[#1f2a4d]">{totalSel > 0 ? num(totalSel) : '—'}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase text-gray-400">Diferencia</span>
            <span className={`font-bold ${estado ? colorEstado : 'text-gray-400'}`}>
              {estado ? `${estado} ${num(Math.abs(dif))}` : '—'}
            </span>
          </div>
        </div>

        {(error || msg) && (
          <div className="px-5 pb-1">
            {error && <p className="text-xs text-red-600">{error}</p>}
            {msg && <p className="text-xs text-green-700">{msg}</p>}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={aplicar}
            disabled={aplicando || !deposito || selNaves.size === 0 || estado === 'Insuficiente'}
            className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {aplicando ? 'Aplicando…' : 'Aplicar pago'}
          </button>
        </div>
      </div>
    </div>
  );
}
