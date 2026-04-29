import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getReporteById } from '@/lib/queries/reportes'
import { fetchFiltroCatalogs } from '@/app/actions/reportes'
import { DashboardView } from '@/components/reportes/dashboard-view'

interface PageProps { params: Promise<{ id: string }> }

export default async function ReportePage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const result = await getReporteById(id)
  if (!result) notFound()

  const { reporte, widgets } = result
  const isOwner = reporte.uid_creador === user?.id

  // Cargar siempre todos los catálogos para que estén listos
  // sin importar qué filtros active el dueño después
  const catalogs = await fetchFiltroCatalogs(['rc', 'etapa', 'origen', 'tipo_cliente', 'tipo_operacion'])

  return (
    <DashboardView
      reporte={reporte}
      widgets={widgets}
      isOwner={isOwner}
      catalogs={catalogs}
    />
  )
}
