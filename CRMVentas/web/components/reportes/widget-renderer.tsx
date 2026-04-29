'use client'

import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import type { CrmWidget, WidgetData } from '@/lib/queries/reportes-types'

const PALETTE = [
  '#8DBD33', // verde SPH
  '#38357A', // morado SPH
  '#6FAE18', // verde oscuro
  '#5249A8', // morado claro
  '#B0D46A', // verde pálido
  '#888481', // gris SPH
  '#6E8C20', // verde oliva
  '#A39FA0', // gris claro
  '#2E2B65', // morado muy oscuro
  '#C8E490', // verde muy pálido
]

interface Props {
  widget: CrmWidget
  data: WidgetData
}

export function WidgetRenderer({ widget, data }: Props) {
  const chartData = data.labels.map((label, i) => ({ name: label, value: data.values[i] ?? 0 }))

  if (widget.tipo === 'kpi') {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[120px] gap-1 py-6">
        <span className="text-4xl font-bold text-foreground">{data.kpiValue ?? '—'}</span>
        <span className="text-sm text-muted-foreground">{data.kpiLabel ?? widget.titulo}</span>
      </div>
    )
  }

  if (widget.tipo === 'table') {
    return (
      <div className="overflow-auto max-h-64">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">Categoría</th>
              <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">Valor</th>
            </tr>
          </thead>
          <tbody>
            {data.labels.map((label, i) => (
              <tr key={label} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="py-1.5 px-2 text-foreground truncate max-w-[180px]">{label}</td>
                <td className="py-1.5 px-2 text-right font-medium">{data.values[i]?.toLocaleString('es-MX')}</td>
              </tr>
            ))}
            {data.labels.length === 0 && (
              <tr><td colSpan={2} className="py-4 text-center text-muted-foreground">Sin datos</td></tr>
            )}
          </tbody>
        </table>
      </div>
    )
  }

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[160px] text-sm text-muted-foreground">
        Sin datos disponibles
      </div>
    )
  }

  if (widget.tipo === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => v.toLocaleString('es-MX')} />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  if (widget.tipo === 'line') {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
            formatter={(v: number) => v.toLocaleString('es-MX')}
          />
          <Line type="monotone" dataKey="value" stroke="#8DBD33" strokeWidth={2.5} dot={{ r: 3, fill: '#8DBD33' }} activeDot={{ r: 5, fill: '#38357A' }} />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  // default: bar
  const isHorizontal = widget.config?.orientacion === 'horizontal' || data.labels.length > 6
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart
        data={chartData}
        layout={isHorizontal ? 'vertical' : 'horizontal'}
        margin={{ top: 4, right: 8, left: isHorizontal ? 80 : -16, bottom: isHorizontal ? 0 : 20 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={!isHorizontal} vertical={isHorizontal} stroke="var(--border)" />
        {isHorizontal ? (
          <>
            <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={76} />
            <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
          </>
        ) : (
          <>
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--muted-foreground)', angle: -25, textAnchor: 'end' }} axisLine={false} tickLine={false} height={40} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
          </>
        )}
        <Tooltip
          contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
          formatter={(v: number) => v.toLocaleString('es-MX')}
        />
        <Bar dataKey="value" radius={[4,4,0,0]}>
          {chartData.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
