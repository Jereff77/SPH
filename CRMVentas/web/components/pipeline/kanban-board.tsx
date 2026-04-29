'use client'

import { useState, useCallback } from 'react'
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCorners,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/lib/stores/auth.store'
import { KanbanColumn } from './kanban-column'
import { LeadCard } from './lead-card'
import { LeadSheet } from './lead-sheet'
import type { KanbanLead } from '@/lib/queries/kanban'
import type { CrmEtapa } from '@/lib/types'

interface KanbanBoardProps {
  etapas: CrmEtapa[]
  initialLeads: KanbanLead[]
}

export function KanbanBoard({ etapas, initialLeads }: KanbanBoardProps) {
  const { user } = useAuthStore()
  const [leads, setLeads] = useState<KanbanLead[]>(initialLeads)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [selectedLead, setSelectedLead] = useState<KanbanLead | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const getLeadsByEtapa = useCallback(
    (idEtapa: number) => leads.filter(l => l.idEtapa === idEtapa),
    [leads]
  )

  const activeLead = activeId ? leads.find(l => l.id === activeId) ?? null : null

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over || !user) return

    const leadId = String(active.id)
    const lead = leads.find(l => l.id === leadId)
    if (!lead) return

    // Determinar la etapa destino
    const overIdStr = String(over.id)
    let targetEtapaId: number

    // over.id puede ser el id de una columna (etapa) o de otro lead
    const isColumn = etapas.some(e => String(e.id) === overIdStr)
    if (isColumn) {
      targetEtapaId = parseInt(overIdStr)
    } else {
      const overLead = leads.find(l => l.id === overIdStr)
      if (!overLead) return
      targetEtapaId = overLead.idEtapa
    }

    if (lead.idEtapa === targetEtapaId) return

    const targetEtapa = etapas.find(e => e.id === targetEtapaId)
    if (!targetEtapa) return

    // Optimistic update
    const prevLeads = leads
    setLeads(prev => prev.map(l =>
      l.id === leadId
        ? { ...l, idEtapa: targetEtapaId, Etapa: targetEtapa.titulo }
        : l
    ))

    // RPC en Supabase
    const supabase = createClient()
    const { data, error } = await supabase.rpc('crm_leads_cambiar_etapa', {
      p_idlead: leadId,
      p_id_etapa_nueva: targetEtapaId,
      p_uidr: user.uid,
    })

    if (error || data?.exito === false) {
      setLeads(prevLeads)
      toast.error('No se pudo cambiar la etapa. Intenta de nuevo.')
    } else {
      toast.success(`Movido a "${targetEtapa.titulo}"`)
    }
  }

  function handleLeadClick(lead: KanbanLead) {
    setSelectedLead(lead)
    setSheetOpen(true)
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 h-full overflow-x-auto pb-4">
          {etapas.map(etapa => (
            <KanbanColumn
              key={etapa.id}
              etapa={etapa}
              leads={getLeadsByEtapa(etapa.id)}
              onLeadClick={handleLeadClick}
            />
          ))}
        </div>

        <DragOverlay>
          {activeLead && (
            <div className="rotate-2 scale-105">
              <LeadCard lead={activeLead} onClick={() => {}} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <LeadSheet
        lead={selectedLead}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </>
  )
}
