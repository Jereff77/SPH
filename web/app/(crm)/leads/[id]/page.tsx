import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Phone, Mail, ChevronLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ActivityTree } from '@/components/actividades/activity-tree'
import { ActivityForm } from '@/components/actividades/activity-form'
import { EtapaProgress } from '@/components/leads/etapa-progress'
import { DeleteLeadButton } from '@/components/leads/delete-lead-button'
import { getLeadDetail, getLeadActivities } from '@/lib/queries/lead-detail'
import { getEtapas } from '@/lib/queries/kanban'
import { createClient } from '@/lib/supabase/server'

const heatConfig: Record<number, { label: string; class: string }> = {
  1: { label: 'Frío',     class: 'bg-[var(--heat-frio)]/10 text-[var(--heat-frio)] border-[var(--heat-frio)]/30' },
  2: { label: 'Tibio',    class: 'bg-[var(--heat-tibio)]/10 text-[var(--heat-tibio)] border-[var(--heat-tibio)]/30' },
  3: { label: 'Caliente', class: 'bg-[var(--heat-caliente)]/10 text-[var(--heat-caliente)] border-[var(--heat-caliente)]/30' },
}

interface PageProps { params: Promise<{ id: string }> }

export default async function LeadDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const [lead, activities, etapas, permDelete] = await Promise.all([
    getLeadDetail(id),
    getLeadActivities(id),
    getEtapas(),
    authUser
      ? supabase.from('segModulosUsuarios').select('clave')
          .eq('uid', authUser.id).eq('clave', 327).eq('acceso', true).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  if (!lead) notFound()
  const canDelete = !!permDelete.data

  const heat = heatConfig[lead.heatLevel] ?? heatConfig[1]

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <Link href="/leads" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="w-4 h-4" />
        Volver a leads
      </Link>

      {/* Header */}
      <div className="rounded-xl border bg-card p-4 sm:p-5 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{lead.nombreLead}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{lead.nomRC}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={heat.class}>{heat.label}</Badge>
            {canDelete && (
              <DeleteLeadButton leadId={lead.id} leadNombre={lead.nombreLead} />
            )}
          </div>
        </div>

        {/* Contacto */}
        <div className="flex flex-wrap gap-4 text-sm">
          {lead.telefono && (
            <a href={`tel:${lead.telefono}`} className="flex items-center gap-1.5 text-foreground hover:text-accent transition-colors">
              <Phone className="w-4 h-4 text-muted-foreground" />
              {lead.telefono}
            </a>
          )}
          {lead.correo && (
            <a href={`mailto:${lead.correo}`} className="flex items-center gap-1.5 text-foreground hover:text-accent transition-colors">
              <Mail className="w-4 h-4 text-muted-foreground" />
              {lead.correo}
            </a>
          )}
        </div>

        {/* Progreso de etapa */}
        <EtapaProgress etapas={etapas} currentId={lead.idEtapa} leadId={lead.id} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Col izquierda — datos + actividades */}
        <div className="lg:col-span-2 space-y-4">
          {/* Datos del lead */}
          <div className="rounded-xl border bg-card p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Información</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                ['Origen',        lead.Origen],
                ['Tipo operación',lead.tipoOperacion],
                ['Tipo cliente',  lead.tipoCliente],
                ['Tipo venta',    lead.tipoVenta],
                ['Valor',         lead.valor > 0 ? `$${lead.valor.toLocaleString('es-MX')}` : '—'],
                ['Etapa actual',  lead.Etapa],
              ].map(([k, v]) => v && (
                <div key={k} className="flex flex-col">
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="font-medium text-foreground">{v}</dd>
                </div>
              ))}
            </dl>

            {lead.mensaje && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-1">Necesidad / Mensaje</p>
                <p className="text-sm text-foreground leading-relaxed">{lead.mensaje}</p>
              </div>
            )}
          </div>

          {/* Formulario de actividad inline */}
          <ActivityForm leadId={lead.id} />

          {/* Árbol de historial */}
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Historial</h3>
              <span className="text-xs text-muted-foreground">{activities.length} actividades</span>
            </div>
            <ActivityTree activities={activities} />
          </div>
        </div>

        {/* Col derecha — naves presentadas (placeholder por ahora) */}
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Naves presentadas</h3>
            <p className="text-xs text-muted-foreground py-4 text-center">
              Sin naves registradas aún.
            </p>
            <button className="w-full text-xs text-accent hover:underline text-center">
              + Agregar nave
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
