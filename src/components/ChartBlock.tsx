import { useRef, useState } from 'react'
import {
  BarChart, Bar, PieChart, Pie, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts'
import type { GraficoData } from '../types'

interface Props {
  grafico: GraficoData
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16']

function fmtValue(value: number, formato?: string) {
  if (formato === 'moneda') {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(value)
  }
  if (formato === 'porcentaje') return `${value.toFixed(1)}%`
  return new Intl.NumberFormat('es-MX').format(value)
}

const CustomTooltip = ({ active, payload, label, formato }: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
  formato?: string
}) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-md text-xs">
      {label && <p className="font-semibold text-slate-700 mb-1">{label}</p>}
      <p className="text-blue-600 font-medium">{fmtValue(payload[0].value, formato)}</p>
    </div>
  )
}

const RADIAN = Math.PI / 180
const renderPieLabel = ({ cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 }: {
  cx?: number; cy?: number; midAngle?: number; innerRadius?: number; outerRadius?: number; percent?: number
}) => {
  if (percent < 0.04) return null
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

export function ChartBlock({ grafico }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  const handleCopyImage = async () => {
    if (!containerRef.current) return
    try {
      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(containerRef.current, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      })
      const blob = await fetch(dataUrl).then(r => r.blob())
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      console.error('Error copiando gráfico')
    }
  }

  const chartData = grafico.labels.map((label, i) => ({
    name: label,
    valor: grafico.datos[i] ?? 0,
  }))

  const tickFormatter = (v: number) => {
    if (grafico.formato === 'moneda') {
      if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
      if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
      return `$${v}`
    }
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
    if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}K`
    return String(v)
  }

  return (
    <div className="mt-3">
      <div
        ref={containerRef}
        className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm"
      >
        {grafico.titulo && (
          <h4 className="text-xs font-semibold text-slate-600 mb-3 text-center uppercase tracking-wide">
            {grafico.titulo}
          </h4>
        )}

        <ResponsiveContainer width="100%" height={260}>
          {grafico.tipo === 'pie' ? (
            <PieChart>
              <Pie
                data={chartData}
                dataKey="valor"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                labelLine={false}
                label={renderPieLabel}
              >
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip formato={grafico.formato} />} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: '11px' }}
                formatter={(value: string) => <span className="text-slate-600">{value}</span>}
              />
            </PieChart>
          ) : grafico.tipo === 'line' ? (
            <LineChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={tickFormatter} width={64} />
              <Tooltip content={<CustomTooltip formato={grafico.formato} />} />
              <Line type="monotone" dataKey="valor" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: '#3b82f6' }} activeDot={{ r: 5 }} />
            </LineChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={tickFormatter} width={64} />
              <Tooltip content={<CustomTooltip formato={grafico.formato} />} />
              <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Botón copiar gráfico (solo icono + tooltip) */}
      <div className="flex justify-end mt-1">
        <button
          onClick={handleCopyImage}
          title="Copiar gráfico como imagen"
          className={`p-1.5 rounded transition-colors border ${
            copied
              ? 'bg-green-50 border-green-200 text-green-600'
              : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300'
          }`}
        >
          {copied ? (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
