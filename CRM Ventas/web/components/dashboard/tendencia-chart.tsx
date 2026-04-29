'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { TendenciaMes } from '@/lib/queries/dashboard'

export function TendenciaChart({ data }: { data: TendenciaMes[] }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Tendencia mensual</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="mes" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(v) => [v, 'Leads']}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Line
            type="monotone"
            dataKey="total"
            stroke="#8DBD33"
            strokeWidth={2.5}
            dot={{ fill: '#8DBD33', r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
