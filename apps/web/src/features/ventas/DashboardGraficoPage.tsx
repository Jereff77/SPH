import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  type ChartOptions,
  type TooltipItem,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { ventasApi, type ReporteGrafico } from './ventas.api';
import { useSort } from '@/components/tabla/useSort';
import { SortableTh, THEAD_STICKY, THEAD_TR } from '@/components/tabla/SortableTh';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const COLORS = {
  monto: '#1f2a4d', // azul marino (marca)
  pagos: '#90BF32', // verde (marca)
  balance: '#ef4444', // rojo
};

const MESES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const moneda = (n: number | null | undefined): string =>
  (n ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

/** Formato compacto para KPIs (226M, 1.8M, 142K…). */
const compacto = (n: number | null | undefined): string =>
  (n ?? 0).toLocaleString('es-MX', {
    notation: 'compact',
    maximumFractionDigits: 1,
  });

type Vista = 'mensual' | 'acumulado';
type AtrasoRow = ReporteGrafico['atrasos'][number];

export function DashboardGraficoPage() {
  const [anio, setAnio] = useState<number>(new Date().getFullYear());
  const [vista, setVista] = useState<Vista>('mensual');

  const { data: filtros } = useQuery({
    queryKey: ['ventas-filtros'],
    queryFn: () => ventasApi.filtros(),
  });
  const anios = filtros?.anios ?? [anio];

  const { data, isLoading } = useQuery({
    queryKey: ['ventas-reporte', anio],
    queryFn: () => ventasApi.reporteGrafico(anio),
  });

  const kpis = data?.kpis ?? { monto: 0, pagos: 0, balance: 0 };
  const meses = data?.meses ?? [];
  const atrasos = data?.atrasos ?? [];

  // Serie para el gráfico (mensual o acumulado).
  const serie = useMemo(() => {
    if (vista === 'mensual') return meses;
    let am = 0;
    let ap = 0;
    return meses.map((m) => {
      am += m.monto;
      ap += m.pagos;
      return { mes: m.mes, monto: am, pagos: ap, balance: ap - am };
    });
  }, [meses, vista]);

  const chartData = {
    labels: MESES_CORTO,
    datasets: [
      {
        label: 'Monto',
        data: serie.map((m) => m.monto),
        backgroundColor: COLORS.monto,
        borderRadius: 6,
        borderSkipped: false as const,
        maxBarThickness: 22,
      },
      {
        label: 'Pagos',
        data: serie.map((m) => m.pagos),
        backgroundColor: COLORS.pagos,
        borderRadius: 6,
        borderSkipped: false as const,
        maxBarThickness: 22,
      },
      {
        label: 'Balance',
        data: serie.map((m) => m.balance),
        backgroundColor: COLORS.balance,
        borderRadius: 6,
        borderSkipped: false as const,
        maxBarThickness: 22,
      },
    ],
  };

  const chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        align: 'start',
        labels: { usePointStyle: true, pointStyle: 'rectRounded', boxWidth: 12, padding: 16 },
      },
      tooltip: {
        backgroundColor: '#1f2a4d',
        padding: 12,
        cornerRadius: 8,
        usePointStyle: true,
        callbacks: {
          label: (ctx: TooltipItem<'bar'>) => `  ${ctx.dataset.label}: ${moneda(ctx.parsed.y)}`,
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#64748b' } },
      y: {
        grid: { color: '#eef2f7' },
        border: { display: false },
        ticks: { color: '#94a3b8', callback: (v) => compacto(Number(v)) },
      },
    },
  };

  const { ordenados, sortKey, dir, toggle } = useSort<AtrasoRow>(
    atrasos,
    {
      nave: (a) => a.nave,
      razonsocial: (a) => a.razonsocial,
      montoVencido: (a) => a.montoVencido,
      diasAtraso: (a) => a.diasAtraso,
    },
    { key: 'montoVencido', dir: 'desc' },
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-gray-800">Ventas · Dashboard</h1>
        <select
          value={anio}
          onChange={(e) => setAnio(Number(e.target.value))}
          className="rounded-lg border px-3 py-1.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
        >
          {anios.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi icono="🎯" titulo="Monto" valor={kpis.monto} color="text-[#1f2a4d]" />
        <Kpi icono="🪙" titulo="Pagos" valor={kpis.pagos} color="text-[#5a7d1f]" />
        <Kpi icono="⚖️" titulo="Balance" valor={kpis.balance} color={kpis.balance < 0 ? 'text-red-500' : 'text-[#1f2a4d]'} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Gráfico */}
        <div className="rounded-2xl border bg-white p-4 shadow-sm lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">
              {vista === 'mensual' ? 'Situación mensual' : 'Situación acumulada'} · {anio}
            </h2>
            <div className="inline-flex rounded-lg bg-gray-100 p-0.5 text-xs">
              {(['mensual', 'acumulado'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVista(v)}
                  className={`rounded-md px-3 py-1 font-medium capitalize transition ${
                    vista === v ? 'bg-white text-[#1f2a4d] shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[340px]">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-gray-400">
                Cargando…
              </div>
            ) : (
              <Bar data={chartData} options={chartOptions} />
            )}
          </div>
        </div>

        {/* Naves con atrasos */}
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b bg-[#1f2a4d] px-4 py-2.5">
            <h2 className="text-sm font-semibold text-white">Naves con atrasos</h2>
          </div>
          <div className="max-h-[380px] overflow-auto">
            <table className="w-full text-sm">
              <thead className={THEAD_STICKY}>
                <tr className={THEAD_TR}>
                  <SortableTh campo="nave" sortKey={sortKey} dir={dir} onSort={toggle} className="py-2">
                    Nave / Razón Social
                  </SortableTh>
                  <SortableTh campo="montoVencido" sortKey={sortKey} dir={dir} onSort={toggle} align="right" className="py-2">
                    Vencido
                  </SortableTh>
                  <SortableTh campo="diasAtraso" sortKey={sortKey} dir={dir} onSort={toggle} align="right" className="py-2">
                    Días
                  </SortableTh>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-gray-400">Cargando…</td>
                  </tr>
                ) : ordenados.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-gray-400">Sin atrasos. 🎉</td>
                  </tr>
                ) : (
                  ordenados.map((a, i) => (
                    <tr key={`${a.idNave ?? i}`} className="hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <div className="font-medium text-gray-800">{a.nave ?? '—'}</div>
                        <div className="text-xs text-gray-500">{a.razonsocial ?? '—'}</div>
                      </td>
                      <td className="px-4 py-2 text-right font-semibold tabular-nums text-red-600">
                        {moneda(a.montoVencido)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-gray-600">{a.diasAtraso}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {ordenados.length > 0 && (
                <tfoot>
                  <tr className="sticky bottom-0 bg-gray-100 font-semibold text-gray-800">
                    <td className="px-4 py-2">Total ({ordenados.length})</td>
                    <td className="px-4 py-2 text-right tabular-nums">{moneda(data?.totalVencido)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  icono,
  titulo,
  valor,
  color,
}: {
  icono: string;
  titulo: string;
  valor: number;
  color: string;
}) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
        <span aria-hidden>{icono}</span>
        {titulo}
      </div>
      <div className={`mt-1 text-4xl font-bold tracking-tight ${color}`} title={moneda(valor)}>
        {compacto(valor)}
      </div>
    </div>
  );
}
