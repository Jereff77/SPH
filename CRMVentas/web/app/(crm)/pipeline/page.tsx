import { Suspense } from 'react'
import { KanbanBoard } from '@/components/pipeline/kanban-board'
import { KanbanFilters } from '@/components/pipeline/kanban-filters'
import { getEtapas, getKanbanLeads, getRCList } from '@/lib/queries/kanban'

interface PageProps {
  searchParams: Promise<{ rc?: string; tipo?: string }>
}

export default async function PipelinePage({ searchParams }: PageProps) {
  const params = await searchParams
  const selectedRC = params.rc ?? ''
  const selectedTipo = params.tipo ?? ''

  const [etapas, leads, rcs] = await Promise.all([
    getEtapas(),
    getKanbanLeads({ uidRC: selectedRC || undefined, tipoOperacion: selectedTipo || undefined }),
    getRCList(),
  ])

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Pipeline</h2>
          <p className="text-sm text-muted-foreground">{leads.length} leads cargados</p>
        </div>
        <Suspense>
          <KanbanFilters
            rcs={rcs as { uidRC: string; nomRC: string }[]}
            selectedRC={selectedRC}
            selectedTipo={selectedTipo}
          />
        </Suspense>
      </div>

      {/* Kanban — ocupa el resto del alto disponible */}
      <div className="flex-1 overflow-hidden">
        <KanbanBoard etapas={etapas} initialLeads={leads} />
      </div>
    </div>
  )
}
