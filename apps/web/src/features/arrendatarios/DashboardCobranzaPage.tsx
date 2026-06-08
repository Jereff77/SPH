import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  arrendatariosApi,
  MESES,
  moneda,
  fechaCorta,
  type PagoArreRow,
} from './arrendatarios.api';
import { AplicarPagoModal } from './AplicarPagoModal';
import { useArrendatariosRealtime } from './useArrendatariosRealtime';
import { SortableTh, THEAD_TR } from '@/components/tabla/SortableTh';
import { useSort, type Accessors } from '@/components/tabla/useSort';

const THEAD_DASHBOARD =
  '[&>tr>th]:sticky [&>tr>th]:top-14 [&>tr>th]:z-10 [&>tr>th]:bg-[#1f2a4d]';

/** ¿La partida está pendiente (sin fecha de pago)? */
const pendiente = (r: PagoArreRow): boolean => !r.fec_pago;

const ACCESSORS: Accessors<PagoArreRow> = {
  fecha: (r) => r.fecha,
  nave: (r) => r.nave,
  cliente: (r) => r.razon_social,
  parque: (r) => r.parque,
  concepto: (r) => r.concepto,
  monto: (r) => r.monto,
  divisa: (r) => r.divisa,
  fec_pago: (r) => r.fec_pago,
};

interface TotalDivisa {
  total: number;
  cobrado: number;
  pendiente: number;
}

export function DashboardCobranzaPage() {
  const queryClient = useQueryClient();
  const ahora = new Date();
  const [anio, setAnio] = useState(ahora.getFullYear());
  const [mes, setMes] = useState(ahora.getMonth() + 1);
  const [parque, setParque] = useState('');
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [aplicar, setAplicar] = useState(false);

  const { data: filtros } = useQuery({
    queryKey: ['arre-cob-filtros'],
    queryFn: () => arrendatariosApi.filtrosCobranza(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: filas = [], isLoading } = useQuery({
    queryKey: ['arre-cob-pagos', anio, mes, parque, soloPendientes],
    queryFn: () =>
      arrendatariosApi.cobranza({
        anio,
        mes,
        parque: parque || undefined,
        soloPendientes,
      }),
  });

  const { data: porVencer = [] } = useQuery({
    queryKey: ['arre-cob-porvencer'],
    queryFn: () => arrendatariosApi.contratosPorVencer(),
    staleTime: 5 * 60 * 1000,
  });
  const { data: vencidos = [] } = useQuery({
    queryKey: ['arre-cob-vencidos'],
    queryFn: () => arrendatariosApi.contratosVencidos(),
    staleTime: 5 * 60 * 1000,
  });

  const onCambio = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['arre-cob-pagos'] });
  }, [queryClient]);
  useArrendatariosRealtime(onCambio);

  const { ordenados, sortKey, dir, toggle } = useSort(filas, ACCESSORS, {
    key: 'fecha',
    dir: 'asc',
  });

  // Totales SEPARADOS por divisa (nunca se mezclan MXN y USD).
  const totales = useMemo(() => {
    const map = new Map<string, TotalDivisa>();
    for (const r of filas) {
      const d = r.divisa || 'MXN';
      const cur = map.get(d) ?? { total: 0, cobrado: 0, pendiente: 0 };
      const m = r.monto ?? 0;
      cur.total += m;
      if (r.fec_pago) cur.cobrado += m;
      else cur.pendiente += m;
      map.set(d, cur);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filas]);

  const anios = filtros?.anios?.length ? filtros.anios : [anio];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-gray-800">Arrendatarios · Cobranza</h1>
        <button
          type="button"
          onClick={() => setAplicar(true)}
          className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a376a]"
        >
          Aplicar pago
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-gray-600">
          Año
          <select
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
            className="mt-1 block rounded border px-2 py-1.5 text-sm"
          >
            {anios.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-600">
          Mes
          <select
            value={mes}
            onChange={(e) => setMes(Number(e.target.value))}
            className="mt-1 block rounded border px-2 py-1.5 text-sm"
          >
            {MESES.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-600">
          Parque
          <select
            value={parque}
            onChange={(e) => setParque(e.target.value)}
            className="mt-1 block rounded border px-2 py-1.5 text-sm"
          >
            <option value="">Todos</option>
            {(filtros?.parques ?? []).map((p) => (
              <option key={p.idParque} value={p.nomParque ?? p.idParque}>
                {p.nomParque ?? p.idParque}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setSoloPendientes((s) => !s)}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
            soloPendientes
              ? 'border-[#1f2a4d] bg-[#1f2a4d] text-white'
              : 'border-gray-300 text-gray-600 hover:bg-gray-100'
          }`}
        >
          Solo pendientes
        </button>
      </div>

      {/* Totales por divisa */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {totales.length === 0 ? (
          <div className="rounded-xl border bg-white p-4 text-sm text-gray-400">
            Sin movimientos en el periodo.
          </div>
        ) : (
          totales.map(([divisa, t]) => (
            <div key={divisa} className="rounded-xl border bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Cobranza {divisa}
              </p>
              <div className="mt-2 space-y-1 text-sm">
                <Linea label="Objetivo" valor={moneda(t.total, divisa)} />
                <Linea label="Cobrado" valor={moneda(t.cobrado, divisa)} clase="text-green-600" />
                <Linea label="Pendiente" valor={moneda(t.pendiente, divisa)} clase="text-red-600" />
              </div>
            </div>
          ))
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Tabla de pagos */}
        <div className="rounded-xl border bg-white">
          <table className="min-w-full border-collapse text-sm">
            <thead className={THEAD_DASHBOARD}>
              <tr className={THEAD_TR}>
                <SortableTh campo="fecha" sortKey={sortKey} dir={dir} onSort={toggle}>
                  Fecha
                </SortableTh>
                <SortableTh campo="nave" sortKey={sortKey} dir={dir} onSort={toggle}>
                  Nave
                </SortableTh>
                <SortableTh campo="cliente" sortKey={sortKey} dir={dir} onSort={toggle}>
                  Arrendatario
                </SortableTh>
                <SortableTh campo="parque" sortKey={sortKey} dir={dir} onSort={toggle}>
                  Parque
                </SortableTh>
                <SortableTh campo="concepto" sortKey={sortKey} dir={dir} onSort={toggle}>
                  Concepto
                </SortableTh>
                <SortableTh campo="monto" sortKey={sortKey} dir={dir} onSort={toggle} align="right">
                  Monto
                </SortableTh>
                <SortableTh campo="divisa" sortKey={sortKey} dir={dir} onSort={toggle} align="center">
                  Divisa
                </SortableTh>
                <SortableTh campo="fec_pago" sortKey={sortKey} dir={dir} onSort={toggle}>
                  Pago
                </SortableTh>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    Cargando…
                  </td>
                </tr>
              ) : ordenados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    Sin partidas para el periodo seleccionado.
                  </td>
                </tr>
              ) : (
                ordenados.map((r) => (
                  <tr
                    key={r.id_detalle}
                    className={pendiente(r) ? 'bg-[#FFE9E9] hover:bg-[#FFDCDC]' : 'hover:bg-gray-50'}
                  >
                    <td className="px-4 py-2 whitespace-nowrap">{fechaCorta(r.fecha)}</td>
                    <td className="px-4 py-2">{r.nave ?? '—'}</td>
                    <td className="px-4 py-2">{r.razon_social ?? '—'}</td>
                    <td className="px-4 py-2">{r.parque ?? '—'}</td>
                    <td className="px-4 py-2">{r.concepto ?? '—'}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{moneda(r.monto, r.divisa ?? 'MXN')}</td>
                    <td className="px-4 py-2 text-center">{r.divisa ?? 'MXN'}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {r.fec_pago ? (
                        fechaCorta(r.fec_pago)
                      ) : (
                        <span className="text-red-500">Pendiente</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Vencimientos */}
        <div className="space-y-4">
          <Vencimientos
            titulo="Por vencer"
            vacio="Sin contratos por vencer."
            filas={porVencer.map((c) => ({
              nave: c.nave,
              razon: c.razon_social,
              fecha: c.fec_fin,
              extra: null,
            }))}
          />
          <Vencimientos
            titulo="Vencidos sin renovación"
            vacio="Sin contratos vencidos."
            rojo
            filas={vencidos.map((c) => ({
              nave: c.nave,
              razon: c.razon_social,
              fecha: c.fec_fin,
              extra: c.dias_vencido != null ? `${c.dias_vencido} días` : null,
            }))}
          />
        </div>
      </div>

      {aplicar && <AplicarPagoModal onClose={() => setAplicar(false)} onAplicado={onCambio} />}
    </div>
  );
}

function Linea({ label, valor, clase }: { label: string; valor: string; clase?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={`tabular-nums font-medium ${clase ?? 'text-gray-800'}`}>{valor}</span>
    </div>
  );
}

function Vencimientos({
  titulo,
  vacio,
  filas,
  rojo,
}: {
  titulo: string;
  vacio: string;
  filas: { nave: string | null; razon: string | null; fecha: string | null; extra: string | null }[];
  rojo?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-white">
      <div className={`rounded-t-xl px-4 py-2 text-sm font-semibold text-white ${rojo ? 'bg-red-500' : 'bg-[#1f2a4d]'}`}>
        {titulo} ({filas.length})
      </div>
      <div className="max-h-72 divide-y overflow-auto">
        {filas.length === 0 ? (
          <p className="px-4 py-4 text-center text-xs text-gray-400">{vacio}</p>
        ) : (
          filas.map((f, i) => (
            <div key={`${f.nave}-${i}`} className="px-4 py-2 text-xs">
              <p className="font-medium text-gray-700">{f.nave ?? '—'}</p>
              <p className="text-gray-400">{f.razon ?? '—'}</p>
              <p className="flex justify-between text-gray-500">
                <span>{fechaCorta(f.fecha)}</span>
                {f.extra && <span className={rojo ? 'text-red-500' : ''}>{f.extra}</span>}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
