import { createClient } from '@/lib/supabase/server'
import type { CrmEtapa } from '@/lib/types'

export interface KanbanLead {
  id: string
  nombreLead: string
  telefono?: string
  nomRC: string
  uidRC?: string
  Etapa: string
  idEtapa: number
  valor: number
  Origen: string
  tipoOperacion?: string
  inmobiliaria?: string
  heatLevel: number   // 1=frío 2=tibio 3=caliente — desde última actividad
  diasEnEtapa: number
  fc: string
}

export interface KanbanColumn {
  etapa: CrmEtapa
  leads: KanbanLead[]
  totalLeads: number
  totalValor: number
}

export interface KanbanFilters {
  uidRC?: string
  idOrigen?: number
  tipoOperacion?: string
}

// Etapas de pipeline activo (excluye estados terminales para vista principal)
const ETAPAS_PIPELINE = [15, 8, 5, 3, 1, 2, 4, 6, 19, 20, 21, 23]

export async function getEtapas(): Promise<CrmEtapa[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('crm_Etapas')
    .select('id, titulo, orden, bkColor, txtColor, status')
    .eq('status', true)
    .order('orden')
  return (data ?? []) as CrmEtapa[]
}

export async function getKanbanLeads(filters?: KanbanFilters): Promise<KanbanLead[]> {
  const supabase = await createClient()

  let query = supabase
    .from('leads')
    .select('id, nombreLead, telefono, nomRC, uidRC, Etapa, idEtapa, valor, Origen, tipoOperacion, fc')
    .eq('status', true)
    .in('idEtapa', ETAPAS_PIPELINE)
    .order('fc', { ascending: false })
    .limit(500)

  if (filters?.uidRC) query = query.eq('uidRC', filters.uidRC)
  if (filters?.tipoOperacion) query = query.eq('tipoOperacion', filters.tipoOperacion)

  const { data: leads } = await query
  if (!leads?.length) return []

  // Última actividad con heat_level por lead (batch)
  const { data: actividades } = await supabase
    .from('activity_history')
    .select('lead_id, heat_level, activity_date')
    .in('lead_id', leads.map(l => l.id))
    .order('activity_date', { ascending: false })

  const ultimaAct: Record<string, number> = {}
  for (const act of actividades ?? []) {
    if (act.lead_id && !(act.lead_id in ultimaAct)) {
      ultimaAct[act.lead_id] = act.heat_level ?? 1
    }
  }

  const hoy = new Date()
  return leads.map(lead => {
    const diasEnEtapa = lead.fc
      ? Math.floor((hoy.getTime() - new Date(lead.fc).getTime()) / 86400000)
      : 0
    return {
      ...lead,
      valor: lead.valor ?? 0,
      heatLevel: ultimaAct[lead.id] ?? 1,
      diasEnEtapa,
    }
  })
}

export async function getRCList() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('leads')
    .select('uidRC, nomRC')
    .eq('status', true)
    .not('uidRC', 'is', null)

  const seen = new Set<string>()
  return (data ?? []).filter(r => {
    if (!r.uidRC || seen.has(r.uidRC)) return false
    seen.add(r.uidRC)
    return true
  }).sort((a, b) => (a.nomRC ?? '').localeCompare(b.nomRC ?? ''))
}
