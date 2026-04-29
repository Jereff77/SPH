import { Suspense } from 'react'
import { CalendarView } from '@/components/calendario/calendar-view'
import { getCalendarEvents, getRCsCalendario } from '@/lib/queries/calendario'
import { createClient } from '@/lib/supabase/server'

interface PageProps {
  searchParams: Promise<{ rc?: string }>
}

export default async function CalendarioPage({ searchParams }: PageProps) {
  const params = await searchParams
  const selectedRC = params.rc ?? ''

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [events, rcs] = await Promise.all([
    getCalendarEvents(selectedRC || undefined),
    getRCsCalendario(),
  ])

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Agenda</h2>
          <p className="text-sm text-muted-foreground">{events.length} eventos agendados</p>
        </div>

        {/* Leyenda de colores */}
        <div className="hidden lg:flex items-center gap-3 flex-wrap">
          {[
            { label: 'Llamada',  color: '#3B82F6' },
            { label: 'WhatsApp', color: '#10B981' },
            { label: 'Visita',   color: '#8B5CF6' },
            { label: 'Reunión',  color: '#F59E0B' },
            { label: 'Correo',   color: '#6B7280' },
            { label: 'Agenda',   color: '#EC4899' },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Calendario */}
      <div className="flex-1 min-h-0">
        <Suspense fallback={<div className="rounded-xl border bg-card h-full animate-pulse" />}>
          <CalendarView
            events={events}
            rcs={rcs.map(r => ({ uid: r.uid, nombre: r.nombre }))}
            currentUidRC={selectedRC}
          />
        </Suspense>
      </div>
    </div>
  )
}
