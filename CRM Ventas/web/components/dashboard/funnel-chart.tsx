'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { EtapaStat } from '@/lib/queries/dashboard'

const COLORS = [
  '#8DBD33', // verde SPH
  '#38357A', // morado SPH
  '#6FAE18', // verde oscuro
  '#5249A8', // morado claro
  '#B0D46A', // verde pálido
  '#888481', // gris SPH
  '#6E8C20', // verde oliva
  '#A39FA0', // gris claro
]

interface FunnelChartProps {
  data: EtapaStat[]
}

export function FunnelChart({ data }: FunnelChartProps) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Leads por etapa</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 0, bottom: 0 }}>
          <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="etapa"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={130}
          />
          <Tooltip
            formatter={(v) => [v, 'Leads']}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Bar dataKey="total" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
