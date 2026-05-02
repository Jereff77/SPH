'use client'

import Link from 'next/link'
import { Phone, Mail, ExternalLink, Building2 } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { KanbanLead } from '@/lib/queries/kanban'

const heatLabel: Record<number, { label: string; class: string }> = {
  1: { label: 'Frío',      class: 'bg-[var(--heat-frio)]/10 text-[var(--heat-frio)] border-[var(--heat-frio)]/30' },
  2: { label: 'Tibio',     class: 'bg-[var(--heat-tibio)]/10 text-[var(--heat-tibio)] border-[var(--heat-tibio)]/30' },
  3: { label: 'Caliente',  class: 'bg-[var(--heat-caliente)]/10 text-[var(--heat-caliente)] border-[var(--heat-caliente)]/30' },
}

interface LeadSheetProps {
  lead: KanbanLead | null
  open: boolean
  onClose: () => void
}

export function LeadSheet({ lead, open, onClose }: LeadSheetProps) {
  if (!lead) return null
  const heat = heatLabel[lead.heatLevel] ?? heatLabel[1]

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-80 sm:w-96">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-start justify-between gap-2">
            <SheetTitle className="text-base leading-tight">{lead.nombreLead}</SheetTitle>
            <Badge variant="outline" className={heat.class}>{heat.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{lead.Etapa}</p>
        </SheetHeader>

        <div className="py-4 space-y-4">
          {/* Contacto */}
          <div className="space-y-2">
            {lead.telefono && (
              <a
                href={`tel:${lead.telefono}`}
                className="flex items-center gap-2 text-sm text-foreground hover:text-accent transition-colors"
              >
                <Phone className="w-4 h-4 text-muted-foreground" />
                {lead.telefono}
              </a>
            )}
          </div>

          {/* Datos */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="w-4 h-4 shrink-0" />
              <span>{lead.Origen}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">RC</span>
              <span className="font-medium text-right truncate max-w-48">{lead.nomRC}</span>
            </div>
            {lead.tipoOperacion && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tipo</span>
                <span>{lead.tipoOperacion}</span>
              </div>
            )}
            {lead.valor > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor</span>
                <span className="font-semibold text-accent">
                  ${lead.valor.toLocaleString('es-MX')}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">En esta etapa</span>
              <span>{lead.diasEnEtapa} días</span>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex flex-col gap-2 pt-2 border-t">
            {lead.telefono && (
              <a href={`https://wa.me/52${lead.telefono.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Mail className="w-4 h-4 mr-2" />
                  Abrir WhatsApp
                </Button>
              </a>
            )}
            <Link href={`/leads/${lead.id}`} onClick={onClose}>
              <Button size="sm" className="w-full justify-start">
                <ExternalLink className="w-4 h-4 mr-2" />
                Ver detalle completo
              </Button>
            </Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
