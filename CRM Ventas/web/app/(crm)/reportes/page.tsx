import { BarChart2, Globe, Lock } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getReportesDashboard } from '@/lib/queries/reportes'
import { NuevoDashboardSheet } from '@/components/reportes/nuevo-dashboard-sheet'
import { DeleteReporteButton } from '@/components/reportes/delete-reporte-button'
import { Badge } from '@/components/ui/badge'

export default async function ReportesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const reportes = await getReportesDashboard()
  const mios     = reportes.filter(r => r.uid_creador === user?.id)
  const publicos = reportes.filter(r => r.es_publico && r.uid_creador !== user?.id)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Reportes</h2>
          <p className="text-sm text-muted-foreground">Dashboards configurables con datos del CRM</p>
        </div>
        <NuevoDashboardSheet />
      </div>

      {/* Mis dashboards */}
      {mios.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Mis dashboards</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {mios.map(r => <ReporteCard key={r.id} reporte={r} isOwner />)}
          </div>
        </section>
      )}

      {/* Públicos de otros */}
      {publicos.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Compartidos por otros usuarios</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {publicos.map(r => <ReporteCard key={r.id} reporte={r} isOwner={false} />)}
          </div>
        </section>
      )}

      {reportes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <BarChart2 className="w-12 h-12 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Aún no hay dashboards. Crea el primero.</p>
        </div>
      )}
    </div>
  )
}

function ReporteCard({ reporte, isOwner }: {
  reporte: Awaited<ReturnType<typeof getReportesDashboard>>[number]
  isOwner: boolean
}) {
  return (
    <div className="relative group">
      <Link
        href={`/reportes/${reporte.id}`}
        className="flex flex-col gap-2 p-4 rounded-xl border bg-card hover:border-accent/50 hover:shadow-sm transition-all"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
              <BarChart2 className="w-4 h-4 text-accent" />
            </div>
            <p className="text-sm font-medium text-foreground leading-tight line-clamp-2 pr-6">{reporte.nombre}</p>
          </div>
          <Badge variant="outline" className="shrink-0 text-[10px] gap-1">
            {reporte.es_publico
              ? <><Globe className="w-2.5 h-2.5" />Público</>
              : <><Lock className="w-2.5 h-2.5" />Privado</>
            }
          </Badge>
        </div>

        {reporte.descripcion && (
          <p className="text-xs text-muted-foreground line-clamp-2">{reporte.descripcion}</p>
        )}

        <div className="flex items-center justify-between mt-auto pt-1 text-xs text-muted-foreground">
          <span>{isOwner ? 'Tuyo' : reporte.nomCreador}</span>
          <span>{format(new Date(reporte.fc), "d MMM yyyy", { locale: es })}</span>
        </div>
      </Link>

      {/* Botón eliminar — solo para el dueño, flota sobre la tarjeta */}
      {isOwner && (
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <DeleteReporteButton idReporte={reporte.id} nombre={reporte.nombre} />
        </div>
      )}
    </div>
  )
}
