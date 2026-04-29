import { Users, DollarSign, TrendingUp, Clock } from 'lucide-react'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { FunnelChart } from '@/components/dashboard/funnel-chart'
import { OrigenChart } from '@/components/dashboard/origen-chart'
import { TendenciaChart } from '@/components/dashboard/tendencia-chart'
import { LeadsSinActividad } from '@/components/dashboard/leads-sin-actividad'
import {
  getDashboardStats, getEtapaStats, getOrigenStats,
  getTendenciaMensual, getLeadsSinActividad,
} from '@/lib/queries/dashboard'

function formatValor(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}

export default async function DashboardPage() {
  const [stats, etapas, origenes, tendencia, sinActividad] = await Promise.all([
    getDashboardStats(),
    getEtapaStats(),
    getOrigenStats(),
    getTendenciaMensual(),
    getLeadsSinActividad(7),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Panel</h2>
        <p className="text-sm text-muted-foreground">Resumen del pipeline comercial</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          title="Leads activos"
          value={stats.totalLeads.toLocaleString('es-MX')}
          icon={Users}
          accent
        />
        <KpiCard
          title="Valor pipeline"
          value={formatValor(stats.valorPipeline)}
          subtitle="Total acumulado"
          icon={DollarSign}
          accent
        />
        <KpiCard
          title="Tasa de conversión"
          value={`${stats.tasaConversion}%`}
          subtitle="Contratos firmados"
          icon={TrendingUp}
        />
        <KpiCard
          title="Pendientes aprobar"
          value={stats.pendientesAprobacion.toString()}
          subtitle="Leads web sin revisar"
          icon={Clock}
          alert={stats.pendientesAprobacion > 0}
        />
      </div>

      {/* Gráficas fila 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FunnelChart data={etapas} />
        <OrigenChart data={origenes} />
      </div>

      {/* Gráficas fila 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TendenciaChart data={tendencia} />
        <LeadsSinActividad leads={sinActividad} />
      </div>
    </div>
  )
}
