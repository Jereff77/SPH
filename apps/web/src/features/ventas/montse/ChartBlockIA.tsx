import { useRef, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  type ChartOptions,
} from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';
import type { GraficoIA } from './montse.api';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Tooltip, Legend);

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

function fmt(v: number, formato?: string) {
  if (formato === 'moneda')
    return v.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
  if (formato === 'porcentaje') return `${v.toFixed(1)}%`;
  return v.toLocaleString('es-MX');
}
const compact = (v: number) =>
  Math.abs(v) >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : Math.abs(v) >= 1_000 ? `${(v / 1_000).toFixed(0)}K` : String(v);

/** Renderiza el gráfico que adjunta la IA (bar/pie/line) con Chart.js. */
export function ChartBlockIA({ grafico }: { grafico: GraficoIA }) {
  const ref = useRef<HTMLDivElement>(null);
  const [copiado, setCopiado] = useState(false);

  const data = {
    labels: grafico.labels,
    datasets: [
      {
        label: grafico.titulo || 'Valor',
        data: grafico.datos,
        backgroundColor: grafico.tipo === 'line' ? '#3b82f6' : grafico.labels.map((_, i) => COLORS[i % COLORS.length]),
        borderColor: grafico.tipo === 'line' ? '#3b82f6' : undefined,
        borderWidth: grafico.tipo === 'line' ? 2 : 0,
        borderRadius: grafico.tipo === 'bar' ? 4 : 0,
        tension: 0.3,
        pointRadius: 3,
        maxBarThickness: 48,
      },
    ],
  };

  const opcionesXY: ChartOptions<'bar' | 'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (c) => `  ${fmt(Number(c.parsed.y ?? c.parsed), grafico.formato)}` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10 } } },
      y: { grid: { color: '#eef2f7' }, border: { display: false }, ticks: { color: '#94a3b8', font: { size: 10 }, callback: (v) => compact(Number(v)) } },
    },
  };
  const opcionesPie: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
      tooltip: { callbacks: { label: (c) => `  ${c.label}: ${fmt(Number(c.parsed), grafico.formato)}` } },
    },
  };

  async function copiar() {
    if (!ref.current) return;
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(ref.current, { backgroundColor: '#ffffff', pixelRatio: 2 });
      const blob = await fetch(dataUrl).then((r) => r.blob());
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* noop */
    }
  }

  return (
    <div className="mt-3">
      <div ref={ref} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {grafico.titulo && (
          <h4 className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">
            {grafico.titulo}
          </h4>
        )}
        <div className="h-[260px]">
          {grafico.tipo === 'pie' ? (
            <Pie data={data} options={opcionesPie} />
          ) : grafico.tipo === 'line' ? (
            <Line data={data} options={opcionesXY as ChartOptions<'line'>} />
          ) : (
            <Bar data={data} options={opcionesXY as ChartOptions<'bar'>} />
          )}
        </div>
      </div>
      <div className="mt-1 flex justify-end">
        <button
          onClick={copiar}
          title="Copiar gráfico como imagen"
          className={`rounded border p-1.5 transition-colors ${copiado ? 'border-green-200 bg-green-50 text-green-600' : 'border-slate-200 bg-white text-slate-400 hover:text-slate-600'}`}
        >
          {copiado ? '✓' : '🗎'}
        </button>
      </div>
    </div>
  );
}
