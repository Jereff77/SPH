import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  type ChartOptions,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { Tabs, type TabDef } from '@/components/Tabs';
import { SearchSelect } from '@/components/SearchSelect';
import { useSort } from '@/components/tabla/useSort';
import { SortableTh, THEAD_STICKY, THEAD_TR } from '@/components/tabla/SortableTh';
import {
  reportesApi,
  type EstadoCuentaRow,
  type VencidoRow,
  type ResumenParqueRow,
  type EvolucionRow,
  type FiltrosReporte,
} from './reportes.api';
import { exportarCSV, exportarJSON, exportarPDF } from './reportes-export';
import { MontseChat } from './montse/MontseChat';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const COLORS_CHART = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#f97316', '#06b6d4', '#84cc16'];

const moneda = (n: number | null | undefined): string =>
  (n ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const fechaCorta = (iso: string | null): string => {
  if (!iso) return '—';
  const p = (iso.split('T')[0] ?? iso).split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
};
const pct = (a: string | number | null | undefined): string =>
  `${((Number(a) || 0) * 100).toFixed(1)}%`;
const numStr = (a: string | number | null | undefined): number => Number(a) || 0;

const TABS: TabDef[] = [
  { id: 'edo', label: 'Estado de Cuenta' },
  { id: 'venc', label: 'Vencidos' },
  { id: 'montse', label: 'Montse AI' },
];

export function ReportesPage() {
  const [tab, setTab] = useState('edo');
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight text-gray-800">Ventas · Reportes</h1>
      <Tabs tabs={TABS} activo={tab} onChange={setTab} />
      <div className="pt-2">
        {tab === 'edo' && <EstadoCuentaTab />}
        {tab === 'venc' && <VencidosTab />}
        {tab === 'montse' && <MontseChat />}
      </div>
    </div>
  );
}

// ----------------------------- Barra de filtros -----------------------------

function FiltrosBar({
  sinA3,
  onAplicar,
}: {
  sinA3: boolean;
  onAplicar: (f: FiltrosReporte) => void;
}) {
  const [anio, setAnio] = useState<number | ''>('');
  const [mes, setMes] = useState<number | ''>('');
  const [razonsocial, setRazon] = useState('');
  const [parque, setParque] = useState('');
  const [propiedad, setPropiedad] = useState('');

  // Combinaciones únicas para la cascada bidireccional (una sola carga, cacheada).
  const { data: combos = [] } = useQuery({
    queryKey: ['rep-combos', sinA3],
    queryFn: () => reportesApi.combos(sinA3),
    staleTime: 10 * 60 * 1000,
  });

  /** ¿El combo cumple los filtros indicados (los omitidos no restringen)? */
  const cumple = (
    c: { razonsocial: string; parque: string; propiedad: string; anio: string },
    f: { r?: string; p?: string; prop?: string; a?: number | '' },
  ) =>
    (!f.r || c.razonsocial === f.r) &&
    (!f.p || c.parque === f.p) &&
    (!f.prop || c.propiedad === f.prop) &&
    (!f.a || c.anio === String(f.a));

  const uniq = (arr: string[]) =>
    [...new Set(arr.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));

  // Cada lista excluye su propio filtro → cascada bidireccional.
  const razones = useMemo(
    () => uniq(combos.filter((c) => cumple(c, { p: parque, prop: propiedad, a: anio })).map((c) => c.razonsocial)),
    [combos, parque, propiedad, anio],
  );
  const parques = useMemo(
    () => uniq(combos.filter((c) => cumple(c, { r: razonsocial, prop: propiedad, a: anio })).map((c) => c.parque)),
    [combos, razonsocial, propiedad, anio],
  );
  const propiedades = useMemo(
    () => uniq(combos.filter((c) => cumple(c, { r: razonsocial, p: parque, a: anio })).map((c) => c.propiedad)),
    [combos, razonsocial, parque, anio],
  );
  const anios = useMemo(
    () =>
      [...new Set(combos.filter((c) => cumple(c, { r: razonsocial, p: parque, prop: propiedad })).map((c) => c.anio).filter(Boolean))].sort(
        (a, b) => Number(b) - Number(a),
      ),
    [combos, razonsocial, parque, propiedad],
  );

  // Limpia una selección si deja de ser compatible con el resto.
  useEffect(() => { if (razonsocial && !razones.includes(razonsocial)) setRazon(''); }, [razones, razonsocial]);
  useEffect(() => { if (parque && !parques.includes(parque)) setParque(''); }, [parques, parque]);
  useEffect(() => { if (propiedad && !propiedades.includes(propiedad)) setPropiedad(''); }, [propiedades, propiedad]);
  useEffect(() => { if (anio !== '' && !anios.includes(String(anio))) setAnio(''); }, [anios, anio]);

  const opts = (arr: string[]) => arr.map((v) => ({ value: v, label: v }));

  function aplicar() {
    onAplicar({ anio, mes, razonsocial, parque, propiedad });
  }
  function limpiar() {
    setAnio('');
    setMes('');
    setRazon('');
    setParque('');
    setPropiedad('');
    onAplicar({});
  }

  const selCls = 'rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30';

  return (
    <div className="grid grid-cols-1 gap-2 rounded-xl border bg-white p-3 shadow-sm sm:grid-cols-3 lg:grid-cols-6">
      <select value={anio} onChange={(e) => setAnio(e.target.value ? Number(e.target.value) : '')} className={selCls}>
        <option value="">Todos los años</option>
        {anios.map((a) => (
          <option key={a} value={a}>{a}</option>
        ))}
      </select>
      <select value={mes} onChange={(e) => setMes(e.target.value ? Number(e.target.value) : '')} className={selCls}>
        <option value="">Todos los meses</option>
        {MESES.map((m, i) => (
          <option key={m} value={i + 1}>{m}</option>
        ))}
      </select>
      <SearchSelect value={razonsocial} onChange={setRazon} options={opts(razones)} placeholder="Razón social…" />
      <SearchSelect value={parque} onChange={setParque} options={opts(parques)} placeholder="Parque…" />
      <SearchSelect value={propiedad} onChange={setPropiedad} options={opts(propiedades)} placeholder="Propiedad…" />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={aplicar}
          className="flex-1 rounded-lg bg-[#1f2a4d] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#2a376a]"
        >
          Aplicar
        </button>
        <button
          type="button"
          onClick={limpiar}
          className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-200"
        >
          Limpiar
        </button>
      </div>
    </div>
  );
}

function BotonesExport({ onCsv, onJson, onPdf }: { onCsv: () => void; onJson: () => void; onPdf: () => void }) {
  return (
    <div className="flex gap-1.5">
      <button type="button" onClick={onCsv} title="Exportar CSV"
        className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700">CSV</button>
      <button type="button" onClick={onJson} title="Exportar JSON"
        className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700">JSON</button>
      <button type="button" onClick={onPdf} title="Exportar PDF"
        className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700">PDF</button>
    </div>
  );
}

function Tarjeta({ icono, label, valor, color }: { icono: string; label: string; valor: string; color: string }) {
  return (
    <div className="rounded-xl border-l-4 bg-white p-4 shadow-sm" style={{ borderLeftColor: color }}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
        <span aria-hidden>{icono}</span>
        {label}
      </div>
      <div className="mt-1 text-right text-2xl font-bold text-gray-900">{valor}</div>
    </div>
  );
}

// ----------------------------- Estado de Cuenta -----------------------------

function EstadoCuentaTab() {
  const [filtros, setFiltros] = useState<FiltrosReporte>({});
  const { data = [], isLoading, isFetching } = useQuery({
    queryKey: ['rep-edo', filtros],
    queryFn: () => reportesApi.edoCuenta(filtros),
  });

  const totales = useMemo(() => {
    return data.reduce(
      (acc, r) => {
        acc.monto += r.suma_monto ?? 0;
        acc.pagos += r.suma_pago_monto ?? 0;
        acc.balance += r.balance ?? 0;
        if (r.pago_vencido && r.suma_monto) acc.vencidos += r.suma_monto;
        return acc;
      },
      { monto: 0, pagos: 0, balance: 0, vencidos: 0 },
    );
  }, [data]);

  const { ordenados, sortKey, dir, toggle } = useSort<EstadoCuentaRow>(
    data,
    {
      razonsocial: (r) => r.razonsocial,
      nompropiedad: (r) => r.nompropiedad,
      numPago: (r) => r.numPago,
      fecha: (r) => r.fecha,
      suma_monto: (r) => r.suma_monto,
      suma_pago_monto: (r) => r.suma_pago_monto,
      balance: (r) => r.balance,
      dias_vencimiento: (r) => r.dias_vencimiento,
      tipoPago: (r) => r.tipoPago,
    },
    { key: 'razonsocial', dir: 'asc' },
  );

  const COLS = ['Razón Social', 'Propiedad', '# Pago', 'Fecha', 'Monto', 'Fec. Pago', 'Pagos', 'Balance', 'Vencido', 'Días', 'Tipo Pago', 'Avance'];
  const aFilas = () =>
    ordenados.map((r) => [
      r.razonsocial, r.nompropiedad, r.numPago, fechaCorta(r.fecha), r.suma_monto, fechaCorta(r.pago_fecha),
      r.suma_pago_monto, r.balance, r.pago_vencido ? 'Sí' : 'No', r.dias_vencimiento, r.tipoPago, pct(r.avance),
    ]);

  return (
    <div className="space-y-3">
      <FiltrosBar sinA3={false} onAplicar={setFiltros} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Tarjeta icono="🎯" label="Monto" valor={moneda(totales.monto)} color="#ef4444" />
        <Tarjeta icono="💰" label="Pagos" valor={moneda(totales.pagos)} color="#10b981" />
        <Tarjeta icono="⚖️" label="Balance" valor={moneda(totales.balance)} color="#3b82f6" />
        <Tarjeta icono="⚠️" label="Montos vencidos" valor={moneda(totales.vencidos)} color="#f59e0b" />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{data.length} registros{isFetching ? ' · actualizando…' : ''}</span>
        <BotonesExport
          onCsv={() => exportarCSV('estado-de-cuenta', COLS, aFilas())}
          onJson={() => exportarJSON('estado-de-cuenta', data)}
          onPdf={() => exportarPDF('Estado de Cuenta', COLS, aFilas())}
        />
      </div>

      <div className="max-h-[calc(100vh-22rem)] overflow-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className={THEAD_STICKY}>
            <tr className={THEAD_TR}>
              <SortableTh campo="razonsocial" sortKey={sortKey} dir={dir} onSort={toggle}>Razón Social</SortableTh>
              <SortableTh campo="nompropiedad" sortKey={sortKey} dir={dir} onSort={toggle}>Propiedad</SortableTh>
              <SortableTh campo="numPago" sortKey={sortKey} dir={dir} onSort={toggle} align="right"># Pago</SortableTh>
              <SortableTh campo="fecha" sortKey={sortKey} dir={dir} onSort={toggle} align="center">Fecha</SortableTh>
              <SortableTh campo="suma_monto" sortKey={sortKey} dir={dir} onSort={toggle} align="right">Monto</SortableTh>
              <SortableTh align="center">Fec. Pago</SortableTh>
              <SortableTh campo="suma_pago_monto" sortKey={sortKey} dir={dir} onSort={toggle} align="right">Pagos</SortableTh>
              <SortableTh campo="balance" sortKey={sortKey} dir={dir} onSort={toggle} align="right">Balance</SortableTh>
              <SortableTh align="center">Vencido</SortableTh>
              <SortableTh campo="dias_vencimiento" sortKey={sortKey} dir={dir} onSort={toggle} align="right">Días</SortableTh>
              <SortableTh campo="tipoPago" sortKey={sortKey} dir={dir} onSort={toggle}>Tipo Pago</SortableTh>
              <SortableTh align="right">Avance</SortableTh>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={12} className="px-4 py-8 text-center text-gray-400">Cargando…</td></tr>
            ) : ordenados.length === 0 ? (
              <tr><td colSpan={12} className="px-4 py-8 text-center text-gray-400">Sin registros. Ajusta los filtros y pulsa Aplicar.</td></tr>
            ) : (
              ordenados.map((r, i) => (
                <tr key={`${r.razonsocial}-${i}`} className={r.pago_vencido ? 'bg-red-50' : 'hover:bg-gray-50'}>
                  <td className="px-3 py-2">{r.razonsocial ?? '—'}</td>
                  <td className="px-3 py-2">{r.nompropiedad ?? '—'}</td>
                  <td className="px-3 py-2 text-right">{r.numPago ?? '—'}</td>
                  <td className="px-3 py-2 text-center whitespace-nowrap">{fechaCorta(r.fecha)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{moneda(r.suma_monto)}</td>
                  <td className="px-3 py-2 text-center whitespace-nowrap">{fechaCorta(r.pago_fecha)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{moneda(r.suma_pago_monto)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-medium ${(r.balance ?? 0) < 0 ? 'text-red-600' : (r.balance ?? 0) > 0 ? 'text-green-600' : ''}`}>{moneda(r.balance)}</td>
                  <td className="px-3 py-2 text-center">{r.pago_vencido ? '❌' : '✅'}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${(r.dias_vencimiento ?? 0) > 0 ? 'font-bold text-red-600' : 'text-gray-500'}`}>{r.dias_vencimiento ?? 0}</td>
                  <td className="px-3 py-2">{r.tipoPago ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{pct(r.avance)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ----------------------------- Vencidos -----------------------------

function VencidosTab() {
  const [filtros, setFiltros] = useState<FiltrosReporte>({});
  const { data: filas = [], isLoading } = useQuery({
    queryKey: ['rep-venc', filtros],
    queryFn: () => reportesApi.vencidos(filtros),
  });
  const { data: resumen = [] } = useQuery({
    queryKey: ['rep-venc-res', filtros],
    queryFn: () => reportesApi.vencidosResumen(filtros),
  });
  const { data: evolucion = [] } = useQuery({
    queryKey: ['rep-venc-evo', filtros.razonsocial, filtros.parque],
    queryFn: () => reportesApi.vencidosEvolucion(filtros.razonsocial, filtros.parque),
  });

  const tot = useMemo(() => {
    const total = filas.reduce((s, r) => s + (r.saldo_vencido ?? 0), 0);
    const parques = new Set(filas.map((r) => r.nomParque)).size;
    const prom = filas.length ? filas.reduce((s, r) => s + (r.dias_vencimiento ?? 0), 0) / filas.length : 0;
    return { total, registros: filas.length, parques, prom };
  }, [filas]);

  const { ordenados, sortKey, dir, toggle } = useSort<VencidoRow>(
    filas,
    {
      tipoPago: (r) => r.tipoPago,
      nompropiedad: (r) => r.nompropiedad,
      razonsocial: (r) => r.razonsocial,
      numPago: (r) => r.numPago,
      fecha: (r) => r.fecha,
      saldo_vencido: (r) => r.saldo_vencido,
      dias_vencimiento: (r) => r.dias_vencimiento,
      nomParque: (r) => r.nomParque,
    },
    { key: 'saldo_vencido', dir: 'desc' },
  );

  const COLS = ['Tipo Pago', 'Propiedad', 'Razón Social', '# Pago', 'Fecha', 'Saldo', 'Días', 'Parque'];
  const aFilas = () =>
    ordenados.map((r) => [
      r.tipoPago, r.nompropiedad, r.razonsocial, r.numPago, fechaCorta(r.fecha), r.saldo_vencido, r.dias_vencimiento, r.nomParque,
    ]);

  // Gráfico de evolución: barras apiladas por año, una serie por parque.
  const chart = useMemo(() => buildEvolucion(evolucion), [evolucion]);

  return (
    <div className="space-y-3">
      <FiltrosBar sinA3 onAplicar={setFiltros} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Tarjeta icono="⚠️" label="Total saldos vencidos" valor={moneda(tot.total)} color="#dc2626" />
        <Tarjeta icono="📊" label="Registros vencidos" valor={String(tot.registros)} color="#f59e0b" />
        <Tarjeta icono="🏭" label="Parques afectados" valor={String(tot.parques)} color="#3b82f6" />
        <Tarjeta icono="⏰" label="Promedio días venc." valor={tot.prom.toFixed(0)} color="#8b5cf6" />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Evolución */}
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Evolución de saldos vencidos (por año / parque)</h3>
          <div className="h-[280px]">
            {chart.labels.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-gray-400">Sin datos</div>
            ) : (
              <Bar data={chart} options={chartOptions} />
            )}
          </div>
        </div>
        {/* Resumen por parque */}
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="border-b bg-[#dc2626] px-4 py-2.5">
            <h3 className="text-sm font-semibold text-white">Resumen por parque</h3>
          </div>
          <div className="max-h-[280px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#dc2626] text-left text-xs font-semibold uppercase text-white">
                <tr>
                  <th className="px-3 py-2">Parque</th>
                  <th className="px-3 py-2 text-right">Saldo Vencido</th>
                  <th className="px-3 py-2 text-center">Reg.</th>
                  <th className="px-3 py-2">% del Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {resumen.map((r: ResumenParqueRow, i) => {
                  const p = numStr(r.porcentaje_del_total);
                  return (
                    <tr key={`${r.parque}-${i}`} className="hover:bg-red-50">
                      <td className="px-3 py-2 font-medium text-gray-700">{r.parque ?? '—'}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-[#dc2626]">{moneda(r.total_saldo_vencido)}</td>
                      <td className="px-3 py-2 text-center text-gray-500">{r.cantidad_registros ?? 0}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded bg-gray-100">
                            <div className="h-full rounded" style={{ width: `${Math.min(100, p)}%`, background: 'linear-gradient(135deg,#dc2626,#ef4444)' }} />
                          </div>
                          <span className="w-12 text-right text-xs tabular-nums text-gray-600">{p.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {resumen.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400">Sin datos</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{filas.length} registros vencidos</span>
        <BotonesExport
          onCsv={() => exportarCSV('vencidos', COLS, aFilas())}
          onJson={() => exportarJSON('vencidos', filas)}
          onPdf={() => exportarPDF('Vencidos', COLS, aFilas())}
        />
      </div>

      <div className="max-h-[calc(100vh-22rem)] overflow-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-sm">
          <thead className={THEAD_STICKY}>
            <tr className={THEAD_TR}>
              <SortableTh campo="tipoPago" sortKey={sortKey} dir={dir} onSort={toggle}>Tipo Pago</SortableTh>
              <SortableTh campo="nompropiedad" sortKey={sortKey} dir={dir} onSort={toggle}>Propiedad</SortableTh>
              <SortableTh campo="razonsocial" sortKey={sortKey} dir={dir} onSort={toggle}>Nombre o Razón Social</SortableTh>
              <SortableTh campo="numPago" sortKey={sortKey} dir={dir} onSort={toggle} align="right"># Pago</SortableTh>
              <SortableTh campo="fecha" sortKey={sortKey} dir={dir} onSort={toggle} align="center">Fecha</SortableTh>
              <SortableTh campo="saldo_vencido" sortKey={sortKey} dir={dir} onSort={toggle} align="right">Saldo</SortableTh>
              <SortableTh campo="dias_vencimiento" sortKey={sortKey} dir={dir} onSort={toggle} align="right">Días</SortableTh>
              <SortableTh campo="nomParque" sortKey={sortKey} dir={dir} onSort={toggle}>Parque</SortableTh>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Cargando…</td></tr>
            ) : ordenados.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Sin saldos vencidos para los filtros.</td></tr>
            ) : (
              ordenados.map((r, i) => {
                const d = r.dias_vencimiento ?? 0;
                return (
                  <tr key={`${r.razonsocial}-${i}`} className={d > 0 ? 'border-l-2 border-l-[#dc2626] bg-red-50' : 'hover:bg-gray-50'}>
                    <td className="px-3 py-2">{r.tipoPago ?? '—'}</td>
                    <td className="px-3 py-2">{r.nompropiedad ?? '—'}</td>
                    <td className="px-3 py-2">{r.razonsocial ?? '—'}</td>
                    <td className="px-3 py-2 text-right">{r.numPago ?? '—'}</td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">{fechaCorta(r.fecha)}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-[#dc2626]">{moneda(r.saldo_vencido)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${d > 30 ? 'font-bold text-[#dc2626]' : 'text-gray-600'}`}>{d}</td>
                    <td className="px-3 py-2">{r.nomParque ?? '—'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const chartOptions: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'rectRounded', boxWidth: 10, padding: 12, font: { size: 10 } } },
    tooltip: {
      backgroundColor: '#1f2a4d',
      cornerRadius: 8,
      callbacks: {
        label: (ctx) => `  ${ctx.dataset.label}: ${(ctx.parsed.y ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })}`,
      },
    },
  },
  scales: {
    x: { stacked: true, grid: { display: false }, ticks: { color: '#64748b' } },
    y: {
      stacked: true,
      grid: { color: '#eef2f7' },
      border: { display: false },
      ticks: { color: '#94a3b8', callback: (v) => Number(v).toLocaleString('es-MX', { notation: 'compact' }) },
    },
  },
};

function buildEvolucion(evol: EvolucionRow[]) {
  const anios = [...new Set(evol.map((e) => String(e.anio)))].sort();
  const parques = [...new Set(evol.map((e) => e.parque ?? '—'))];
  const datasets = parques.map((pq, idx) => ({
    label: pq,
    data: anios.map((a) =>
      evol
        .filter((e) => String(e.anio) === a && (e.parque ?? '—') === pq)
        .reduce((s, e) => s + (e.total_saldo_vencido ?? 0), 0),
    ),
    backgroundColor: COLORS_CHART[idx % COLORS_CHART.length],
    borderRadius: 4,
    maxBarThickness: 40,
  }));
  return { labels: anios, datasets };
}
