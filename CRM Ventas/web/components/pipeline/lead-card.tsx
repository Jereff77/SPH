'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Phone, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { KanbanLead } from '@/lib/queries/kanban'

const heatBorder: Record<number, string> = {
  1: 'border-l-[var(--heat-frio)]',
  2: 'border-l-[var(--heat-tibio)]',
  3: 'border-l-[var(--heat-caliente)]',
}

const heatDot: Record<number, string> = {
  1: 'bg-[var(--heat-frio)]',
  2: 'bg-[var(--heat-tibio)]',
  3: 'bg-[var(--heat-caliente)]',
}

function formatValor(v: number) {
  if (v === 0) return null
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  return `$${(v / 1_000).toFixed(0)}K`
}

interface LeadCardProps {
  lead: KanbanLead
  onClick: (lead: KanbanLead) => void
}

export function LeadCard({ lead, onClick }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: { lead },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const valor = formatValor(lead.valor)

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={cn(
        'bg-card rounded-lg border border-l-4 p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow select-none',
        heatBorder[lead.heatLevel] ?? 'border-l-border'
      )}
    >
      {/* Drag handle + nombre */}
      <div
        {...listeners}
        className="flex items-start gap-2 mb-2"
        onClick={e => { e.stopPropagation(); onClick(lead) }}
      >
        <div className={cn('w-2 h-2 rounded-full mt-1 shrink-0', heatDot[lead.heatLevel] ?? 'bg-border')} />
        <p className="text-sm font-medium text-foreground leading-tight line-clamp-1 flex-1">
          {lead.nombreLead}
        </p>
      </div>

      {/* Info */}
      <div
        className="space-y-1 pl-4"
        onClick={() => onClick(lead)}
      >
        {lead.telefono && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Phone className="w-3 h-3" />
            <span>{lead.telefono}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground truncate">{lead.nomRC}</span>
          <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            <Clock className="w-3 h-3" />
            <span>{lead.diasEnEtapa}d</span>
          </div>
        </div>

        {valor && (
          <p className="text-xs font-semibold text-accent">{valor}</p>
        )}
      </div>
    </div>
  )
}
