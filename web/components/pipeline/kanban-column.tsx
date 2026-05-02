'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { cn } from '@/lib/utils'
import { LeadCard } from './lead-card'
import type { KanbanLead } from '@/lib/queries/kanban'
import type { CrmEtapa } from '@/lib/types'

function formatValor(v: number) {
  if (v === 0) return '$0'
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  return `$${(v / 1_000).toFixed(0)}K`
}

interface KanbanColumnProps {
  etapa: CrmEtapa
  leads: KanbanLead[]
  onLeadClick: (lead: KanbanLead) => void
}

export function KanbanColumn({ etapa, leads, onLeadClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: String(etapa.id) })

  const totalValor = leads.reduce((s, l) => s + l.valor, 0)

  return (
    <div className="flex flex-col w-64 shrink-0 h-full">
      {/* Header */}
      <div
        className="rounded-t-lg px-3 py-2.5 mb-2"
        style={{ backgroundColor: etapa.bkColor }}
      >
        <div className="flex items-center justify-between gap-2">
          <h3
            className="text-xs font-semibold truncate"
            style={{ color: etapa.txtColor === '#ffffff' ? '#fff' : '#1a1a1a' }}
          >
            {etapa.titulo}
          </h3>
          <span
            className="text-xs font-bold shrink-0 bg-white/20 rounded-full px-2 py-0.5"
            style={{ color: etapa.txtColor === '#ffffff' ? '#fff' : '#1a1a1a' }}
          >
            {leads.length}
          </span>
        </div>
        <p
          className="text-xs mt-0.5 opacity-80"
          style={{ color: etapa.txtColor === '#ffffff' ? '#fff' : '#1a1a1a' }}
        >
          {formatValor(totalValor)}
        </p>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 overflow-y-auto space-y-2 px-1 pb-2 rounded-b-lg min-h-32 transition-colors',
          isOver && 'bg-accent/5 ring-1 ring-accent/30 ring-inset rounded-lg'
        )}
      >
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map(lead => (
            <LeadCard key={lead.id} lead={lead} onClick={onLeadClick} />
          ))}
        </SortableContext>
        {leads.length === 0 && (
          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
            Sin leads
          </div>
        )}
      </div>
    </div>
  )
}
