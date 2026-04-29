'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { OrigenStat } from '@/lib/queries/dashboard'

const COLORS = [
  '#8DBD33', // verde SPH
  '#38357A', // morado SPH
  '#6FAE18', // verde oscuro
  '#5249A8', // morado claro
  '#B0D46A', // verde pálido
  '#888481', // gris SPH
  '#A39FA0', // gris claro
]

export function OrigenChart({ data }: { data: OrigenStat[] }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Leads por origen</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ left: 0, right: 8, top: 0, bottom: 24 }}>
          <XAxis
            dataKey="origen"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            angle={-30}
            textAnchor="end"
          />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(v) => [v, 'Leads']}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Bar dataKey="total" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
