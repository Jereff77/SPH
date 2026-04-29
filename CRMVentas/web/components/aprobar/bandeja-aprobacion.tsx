'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  CheckCircle, XCircle, Phone, MapPin, Zap, Square,
  AlertTriangle, ExternalLink, ChevronLeft, ChevronRight,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/lib/stores/auth.store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

export interface LeadPorAprobar {
  id: string
  nombreLead: string
  telefono?: string
  correo?: string
  mensaje?: string
  superficie?: string
  KVAs?: string
  ubicacion?: string
  Origen?: string
  nomRC?: string
  uidr?: string
  fc: string
  tieneSimilar?: boolean
}

interface Similar {
  id: string
  nombreLead: string
  telefono?: string
  correo?: string
  Etapa: string
  nomRC: string
  valor: number
  fc: string
  ultimaActividad?: string
  sim_nombre: number
  dup_telefono: boolean
  dup_correo: boolean
  pct_similitud: number
}

// ── Dialog de motivo de rechazo ────────────────────────────────
interface MotivoDialogProps {
  open: boolean
  onConfirm: (motivo: string) => void
  onCancel: () => void
}

function MotivoDialog({ open, onConfirm, onCancel }: MotivoDialogProps) {
  const [motivo, setMotivo] = useState('')
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card rounded-xl border shadow-xl w-full max-w-sm mx-4 p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Motivo de rechazo</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Indica por qué se rechaza este lead. El registrante recibirá esta explicación por correo.
          </p>
        </div>
        <textarea
          autoFocus
          value={motivo}
          onChange={e => setMotivo(e.target.value)}
          placeholder="Ej: Lead duplicado. Ya existe en el pipeline con el mismo teléfono asignado a otro asesor..."
          rows={4}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent resize-none"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 border-destructive/40 text-destructive bg-transparent hover:bg-destructive/5 border"
            disabled={motivo.trim().length < 10}
            onClick={() => { onConfirm(motivo.trim()); setMotivo('') }}
          >
            Confirmar rechazo
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setMotivo(''); onCancel() }}>
            Cancelar
          </Button>
        </div>
        {motivo.trim().length > 0 && motivo.trim().length < 10 && (
          <p className="text-xs text-destructive">Mínimo 10 caracteres.</p>
        )}
      </div>
    </div>
  )
}

// ── Comparador de similares ────────────────────────────────────
function razonesSimilitud(s: Similar): string {
  const razones: string[] = []
  if (s.dup_telefono) razones.push('Teléfono idéntico')
  if (s.dup_correo)   razones.push('Correo idéntico')
  if (s.sim_nombre > 0.35 && !s.dup_telefono && !s.dup_correo)
    razones.push(`Nombre similar (${Math.round(s.sim_nombre * 100)}%)`)
  return razones.join(' · ') || 'Similitud detectada'
}

interface ComparadorProps {
  leadNuevo: LeadPorAprobar
  similares: Similar[]
  loading: boolean
  open: boolean
  onClose: () => void
  onRechazar: () => void
  onAprobar: () => void
}

function Comparador({ leadNuevo, similares, loading, open, onClose, onRechazar, onAprobar }: ComparadorProps) {
  const [idx, setIdx] = useState(0)
  const similar = similares[idx] ?? null

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader className="pb-3 border-b">
          <SheetTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="w-4 h-4 text-[var(--heat-tibio)]" />
            Verificar posible duplicado
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            Se encontraron <strong>{similares.length}</strong> coincidencia{similares.length !== 1 ? 's' : ''} en el pipeline.
            Compara los datos antes de decidir.
          </p>
        </SheetHeader>

        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Buscando coincidencias...</div>
        ) : (
          <div className="py-4 space-y-4">
            {/* Navegación entre similares */}
            {similares.length > 1 && (
              <div className="flex items-center justify-between gap-2 bg-muted/30 rounded-lg px-3 py-2">
                <button
                  onClick={() => setIdx(i => Math.max(0, i - 1))}
                  disabled={idx === 0}
                  className="p-1 rounded hover:bg-muted disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="text-center">
                  <p className="text-xs font-medium text-foreground">Coincidencia {idx + 1} de {similares.length}</p>
                  {similar && (
                    <p className="text-xs text-[var(--heat-tibio)]">{razonesSimilitud(similar)}</p>
                  )}
                </div>
                <button
                  onClick={() => setIdx(i => Math.min(similares.length - 1, i + 1))}
                  disabled={idx === similares.length - 1}
                  className="p-1 rounded hover:bg-muted disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
            {similares.length === 1 && similar && (
              <div className="text-xs text-center text-[var(--heat-tibio)] font-medium">
                {razonesSimilitud(similar)}
              </div>
            )}

            {/* Comparación lado a lado */}
            <div className="grid grid-cols-2 gap-3">
              {/* Lead nuevo */}
              <div className="rounded-lg border border-[var(--heat-tibio)]/30 bg-[var(--heat-tibio)]/5 p-3 space-y-2">
                <p className="text-xs font-semibold text-[var(--heat-tibio)] uppercase tracking-wide">Lead nuevo (por aprobar)</p>
                <Campo label="Nombre"     valor={leadNuevo.nombreLead} />
                <Campo label="Teléfono"   valor={leadNuevo.telefono} />
                <Campo label="Correo"     valor={leadNuevo.correo} />
                <Campo label="Origen"     valor={leadNuevo.Origen} />
                <Campo label="RC"         valor={leadNuevo.nomRC} />
                <Campo label="Superficie" valor={leadNuevo.superficie ? `${leadNuevo.superficie} m²` : undefined} />
                <Campo label="KVAs"       valor={leadNuevo.KVAs} />
                <Campo label="Ubicación"  valor={leadNuevo.ubicacion} />
                <Campo label="Mensaje"    valor={leadNuevo.mensaje} truncate />
                <Campo label="Recibido"   valor={format(new Date(leadNuevo.fc), "d 'de' MMMM yyyy", { locale: es })} />
              </div>

              {/* Lead existente */}
              <div className="rounded-lg border bg-card p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Lead existente (pipeline)</p>
                  {similar && (
                    <Link href={`/leads/${similar.id}`} target="_blank" className="text-accent hover:text-accent/80">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
                {similar ? (
                  <>
                    <Campo label="Nombre"   valor={similar.nombreLead} />
                    <Campo label="Teléfono" valor={similar.telefono} highlight={similar.dup_telefono} />
                    <Campo label="Correo"   valor={similar.correo} highlight={similar.dup_correo} />
                    <Campo label="RC"       valor={similar.nomRC} />
                    <Campo label="Etapa"    valor={similar.Etapa} highlight />
                    <Campo label="Valor"    valor={similar.valor > 0 ? `$${similar.valor.toLocaleString('es-MX')}` : undefined} />
                    <Campo label="Creado"   valor={format(new Date(similar.fc), "d 'de' MMMM yyyy", { locale: es })} />
                    <Campo
                      label="Última actividad"
                      valor={similar.ultimaActividad
                        ? formatDistanceToNow(new Date(similar.ultimaActividad), { addSuffix: true, locale: es })
                        : 'Sin actividad'}
                    />
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground py-6 text-center">Sin datos.</p>
                )}
              </div>
            </div>

            {/* Acciones */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
              <Button
                variant="outline"
                className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/5"
                onClick={onRechazar}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Es duplicado — Rechazar
              </Button>
              <Button
                className="flex-1 bg-[var(--stage-ganado)] hover:bg-[var(--stage-ganado)]/90 text-white"
                onClick={onAprobar}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Son distintos — Aprobar
              </Button>
              <Button variant="ghost" onClick={onClose} className="sm:w-auto">Cancelar</Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Campo({ label, valor, truncate, highlight }: {
  label: string; valor?: string; truncate?: boolean; highlight?: boolean
}) {
  if (!valor) return null
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('text-xs font-medium text-foreground leading-snug', truncate && 'line-clamp-2', highlight && 'text-accent')}>
        {valor}
      </p>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────

export function BandejaAprobacion({ leads: initialLeads }: { leads: LeadPorAprobar[] }) {
  const { user } = useAuthStore()
  const router = useRouter()
  const [leads, setLeads] = useState(initialLeads)
  const [isPending, startTransition] = useTransition()

  // Comparador
  const [comparadorLead, setComparadorLead] = useState<LeadPorAprobar | null>(null)
  const [similares, setSimilares] = useState<Similar[]>([])
  const [loadingComp, setLoadingComp] = useState(false)

  // Dialog motivo de rechazo
  const [motivoLeadId, setMotivoLeadId] = useState<string | null>(null)
  const [rechazarDesdeComp, setRechazarDesdeComp] = useState(false)

  async function abrirComparador(lead: LeadPorAprobar) {
    setComparadorLead(lead)
    setSimilares([])
    setLoadingComp(true)

    const supabase = createClient()
    const { data } = await supabase.rpc('crm_buscar_similares_lead', {
      p_nombre: lead.nombreLead,
      p_telefono: lead.telefono ?? null,
      p_correo: lead.correo ?? null,
    })

    if (data?.length) {
      // Enriquecer con última actividad
      const ids = data.map((s: Similar) => s.id)
      const { data: acts } = await supabase
        .from('activity_history')
        .select('lead_id, activity_date')
        .in('lead_id', ids)
        .order('activity_date', { ascending: false })

      const ultAct: Record<string, string> = {}
      for (const a of acts ?? []) {
        if (a.lead_id && !ultAct[a.lead_id]) ultAct[a.lead_id] = a.activity_date
      }

      setSimilares(data.map((s: Similar) => ({ ...s, ultimaActividad: ultAct[s.id] })))
    }
    setLoadingComp(false)
  }

  async function enviarNotificacion(leadId: string, tipo: 'aprobado' | 'rechazado', motivo?: string) {
    if (!user) return
    try {
      await fetch('/api/notifications/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, tipo, autorizadorNombre: user.nombre, motivo }),
      })
    } catch { /* notificación no crítica */ }
  }

  async function ejecutarRechazo(id: string, motivo: string) {
    const supabase = createClient()
    const { error } = await supabase
      .from('leads_porAprobar')
      .update({
        status: false,
        uid_autorizador: user?.uid,
        fecha_autorizacion: new Date().toISOString(),
        motivo_rechazo: motivo,
      })
      .eq('id', id)

    if (error) { toast.error('No se pudo rechazar.'); return }

    setLeads(prev => prev.filter(l => l.id !== id))
    setComparadorLead(null)
    toast.success('Lead rechazado.')
    enviarNotificacion(id, 'rechazado', motivo)
  }

  async function ejecutarAprobacion(id: string) {
    const supabase = createClient()

    // Primero actualizar uid_autorizador para trazabilidad
    await supabase
      .from('leads_porAprobar')
      .update({ uid_autorizador: user?.uid, fecha_autorizacion: new Date().toISOString() })
      .eq('id', id)

    const { error } = await supabase.rpc('leads_poraprobar_validar_y_migrar_similitud', {
      p_id_lead_poraprobar: id,
    })

    if (error) {
      // Fallback: aprobación directa
      await supabase.from('leads_porAprobar').update({ aprobado: true, status: false }).eq('id', id)
    }

    setLeads(prev => prev.filter(l => l.id !== id))
    setComparadorLead(null)
    toast.success('Lead aprobado y migrado al pipeline.')
    enviarNotificacion(id, 'aprobado')
    startTransition(() => router.refresh())
  }

  // Iniciar flujo de rechazo (siempre pide motivo)
  function iniciarRechazo(id: string, desdeComp = false) {
    setMotivoLeadId(id)
    setRechazarDesdeComp(desdeComp)
  }

  if (leads.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-12 text-center">
        <CheckCircle className="w-10 h-10 text-[var(--stage-ganado)] mx-auto mb-3" />
        <p className="text-sm font-medium text-foreground">¡Bandeja vacía!</p>
        <p className="text-xs text-muted-foreground mt-1">No hay leads pendientes de aprobación.</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {leads.map(lead => (
          <div
            key={lead.id}
            className={cn('rounded-xl border bg-card p-4 space-y-3 transition-all', lead.tieneSimilar && 'border-[var(--heat-tibio)]/40')}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground leading-tight">{lead.nombreLead}</p>
                {lead.nomRC && <p className="text-xs text-muted-foreground mt-0.5">RC: {lead.nomRC}</p>}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {lead.tieneSimilar && (
                  <button onClick={() => abrirComparador(lead)}>
                    <Badge variant="outline" className="text-xs border-[var(--heat-tibio)]/50 text-[var(--heat-tibio)] cursor-pointer hover:bg-[var(--heat-tibio)]/10 transition-colors gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Posible duplicado
                    </Badge>
                  </button>
                )}
                <span className="text-xs text-muted-foreground">{format(new Date(lead.fc), "d MMM", { locale: es })}</span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs text-muted-foreground">
              {lead.telefono && (
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3 h-3 shrink-0" />
                  <a href={`tel:${lead.telefono}`} className="hover:text-foreground">{lead.telefono}</a>
                </div>
              )}
              {lead.superficie && (
                <div className="flex items-center gap-1.5">
                  <Square className="w-3 h-3 shrink-0" />
                  <span>{lead.superficie} m²</span>
                  {lead.KVAs && <span>· {lead.KVAs} KVAs</span>}
                </div>
              )}
              {lead.ubicacion && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{lead.ubicacion}</span>
                </div>
              )}
              {lead.Origen && (
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3 h-3 shrink-0" />
                  <span>{lead.Origen}</span>
                </div>
              )}
            </div>

            {lead.mensaje && (
              <p className="text-xs text-muted-foreground line-clamp-2 bg-muted/40 rounded-md px-2 py-1.5">{lead.mensaje}</p>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                className="flex-1 h-8 bg-[var(--stage-ganado)] hover:bg-[var(--stage-ganado)]/90 text-white"
                onClick={() => ejecutarAprobacion(lead.id)}
                disabled={isPending}
              >
                <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                Aprobar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-8 border-destructive/40 text-destructive hover:bg-destructive/5"
                onClick={() => iniciarRechazo(lead.id)}
                disabled={isPending}
              >
                <XCircle className="w-3.5 h-3.5 mr-1.5" />
                Rechazar
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Comparador multi-similares */}
      {comparadorLead && (
        <Comparador
          leadNuevo={comparadorLead}
          similares={similares}
          loading={loadingComp}
          open={!!comparadorLead}
          onClose={() => setComparadorLead(null)}
          onRechazar={() => iniciarRechazo(comparadorLead.id, true)}
          onAprobar={() => ejecutarAprobacion(comparadorLead.id)}
        />
      )}

      {/* Dialog motivo de rechazo */}
      <MotivoDialog
        open={!!motivoLeadId}
        onConfirm={async (motivo) => {
          if (!motivoLeadId) return
          await ejecutarRechazo(motivoLeadId, motivo)
          setMotivoLeadId(null)
        }}
        onCancel={() => setMotivoLeadId(null)}
      />
    </>
  )
}
