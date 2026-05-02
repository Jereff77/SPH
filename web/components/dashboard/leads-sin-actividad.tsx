import Link from 'next/link'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { LeadSinActividad } from '@/lib/queries/dashboard'

export function LeadsSinActividad({ leads }: { leads: LeadSinActividad[] }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-4 h-4 text-destructive" />
        <h3 className="text-sm font-semibold text-foreground">Sin actividad +7 días</h3>
        <Badge variant="destructive" className="ml-auto text-xs">{leads.length}</Badge>
      </div>

      {leads.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          ¡Todo al día! Sin leads pendientes.
        </p>
      ) : (
        <ul className="space-y-2">
          {leads.map(lead => (
            <li key={lead.id}>
              <Link
                href={`/leads/${lead.id}`}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{lead.nombreLead}</p>
                  <p className="text-xs text-muted-foreground truncate">{lead.nomRC} · {lead.Etapa}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-xs text-destructive border-destructive/40">
                    {lead.diasSinActividad}d
                  </Badge>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
