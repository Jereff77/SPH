import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  arrendatariosApi,
  hoyMexico,
  num,
  fechaCorta,
  MESES,
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
  // El nombre del ordenante casi nunca coincide con el del arrendatario, así que
  // NO se precarga la búsqueda: se muestran todos los depósitos recibidos sin
  // aplicar, filtrables por mes/año (ajustables aquí) y buscador (ordenante/concepto).
  const [busca, setBusca] = useState('');
  const [mesF, setMesF] = useState<number>(mes);
  const [anioF, setAnioF] = useState<number>(anio);
  const [deposito, setDeposito] = useState<DepositoSinAplicar | null>(null);
  const [selNaves, setSelNaves] = useState<Set<string>>(
    () => new Set(filasPendientes.map((r) => r.nave ?? '')),
  );
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [aplicando, setAplicando] = useState(false);

  const aniosOpc = useMemo(() => {
    const arr: number[] = [];
    for (let a = anio + 1; a >= 2024; a--) arr.push(a);
    return arr;
  }, [anio]);

  // Plan del arrendatario (para que el backend marque los depósitos "sugeridos").
  const idArrePdp = useMemo(
    () => filasPendientes.find((r) => r.id_arrepdp)?.id_arrepdp ?? undefined,
    [filasPendientes],
  );

  const { data: depositos = [], isLoading: cargandoDep } = useQuery({
    queryKey: ['arre-depositos', busca, anioF, mesF, idArrePdp],
    queryFn: () =>
      arrendatariosApi.depositosSinAplicar(
        busca || undefined,
        anioF || undefined,
        mesF || undefined,
        idArrePdp,
      ),
  });

  // Dos listas: ⭐ Sugeridos (ordenante que ya pagó a este arrendatario) y el resto.
  const sugeridos = useMemo(() => depositos.filter((d) => d.sugerido), [depositos]);
  const otros = useMemo(() => depositos.filter((d) => !d.sugerido), [depositos]);

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
    if (!deposito || estado !== 'Exacto' || selNaves.size === 0) return;
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

  // Solo "Exacto" es aplicable: no se permite saldo a favor (Sobrante) ni faltante.
  const colorEstado = estado === 'Exacto' ? 'text-green-600' : 'text-red-600';

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
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Depósito bancario
              </span>
              <span className="text-[10px] text-gray-400">{depositos.length} sin aplicar</span>
            </div>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por ordenante o concepto…"
              className="w-full rounded border px-2 py-1.5 text-sm"
            />
            {/* Filtro de mes/año (el ordenante casi nunca coincide con el arrendatario). */}
            <div className="flex items-center gap-1.5">
              <select
                value={mesF}
                onChange={(e) => setMesF(Number(e.target.value))}
                className="flex-1 rounded border px-2 py-1 text-xs text-[#1f2a4d]"
                title="Mes del depósito"
              >
                <option value={0}>Todos los meses</option>
                {MESES.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                value={anioF}
                onChange={(e) => setAnioF(Number(e.target.value))}
                className="rounded border px-2 py-1 text-xs text-[#1f2a4d]"
                title="Año del depósito"
              >
                <option value={0}>Todos</option>
                {aniosOpc.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              {cargandoDep ? (
                <p className="px-2 py-4 text-center text-xs text-gray-400">Buscando…</p>
              ) : depositos.length === 0 ? (
                <p className="px-2 py-4 text-center text-xs text-gray-400">
                  Sin depósitos para el filtro. Prueba "Todos los meses" o ajusta la búsqueda.
                </p>
              ) : (
                <>
                  {sugeridos.length > 0 && (
                    <>
                      <div className="flex items-center gap-1 px-1 pt-1 text-[10px] font-bold uppercase tracking-wide text-amber-600">
                        <span>⭐ Sugeridos</span>
                        <span className="rounded-full bg-amber-100 px-1.5 text-amber-700">
                          {sugeridos.length}
                        </span>
                      </div>
                      {sugeridos.map((d) => (
                        <DepositoItem
                          key={d.idmov}
                          d={d}
                          sel={deposito?.idmov === d.idmov}
                          onClick={() => setDeposito(d)}
                        />
                      ))}
                      {otros.length > 0 && (
                        <div className="px-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                          Todos los demás
                        </div>
                      )}
                    </>
                  )}
                  {otros.map((d) => (
                    <DepositoItem
                      key={d.idmov}
                      d={d}
                      sel={deposito?.idmov === d.idmov}
                      onClick={() => setDeposito(d)}
                    />
                  ))}
                </>
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
            disabled={aplicando || !deposito || selNaves.size === 0 || estado !== 'Exacto'}
            title={
              deposito && estado && estado !== 'Exacto'
                ? 'El depósito debe cubrir exactamente lo seleccionado (sin saldo a favor ni faltante).'
                : undefined
            }
            className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {aplicando ? 'Aplicando…' : 'Aplicar pago'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Tarjeta de un depósito bancario en la lista de selección. */
function DepositoItem({
  d,
  sel,
  onClick,
}: {
  d: DepositoSinAplicar;
  sel: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
        sel ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:bg-gray-50'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-gray-700">
          {d.sugerido && (
            <span className="mr-1 text-amber-500" title="Ya pagó antes a este arrendatario">
              ⭐
            </span>
          )}
          {d.ordenante ?? '—'}
        </span>
        <span className="whitespace-nowrap font-bold text-[#1f2a4d]">
          {num(d.importe)} <span className="text-[10px] opacity-60">{d.moneda ?? 'MXN'}</span>
        </span>
      </div>
      {d.concepto && <div className="truncate text-gray-500">{d.concepto}</div>}
      <div className="text-gray-400">
        {fechaCorta(d.fec_operacion)} · {d.rastreo ?? ''}
      </div>
    </button>
  );
}
