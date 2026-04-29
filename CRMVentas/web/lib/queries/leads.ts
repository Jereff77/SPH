import { createClient } from '@/lib/supabase/server'

export interface LeadRow {
  id: string
  nombreLead: string
  telefono?: string
  correo?: string
  Etapa: string
  idEtapa: number
  nomRC: string
  uidRC?: string
  Origen: string
  tipoOperacion?: string
  tipoCliente?: string
  valor: number
  fc: string
  ultimaActividad?: string
  diasSinActividad: number
  heatLevel: number
}

export interface LeadsFilters {
  search?: string
  idEtapa?: number
  uidRC?: string
  Origen?: string
  tipoOperacion?: string
  page?: number
  pageSize?: number
}

export async function getLeads(filters: LeadsFilters = {}): Promise<{ leads: LeadRow[]; total: number }> {
  const supabase = await createClient()
  const { search, idEtapa, uidRC, Origen, tipoOperacion, page = 1, pageSize = 50 } = filters
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('leads')
    .select('id, nombreLead, telefono, correo, Etapa, idEtapa, nomRC, uidRC, Origen, tipoOperacion, tipoCliente, valor, fc', { count: 'exact' })
    .eq('status', true)
    .order('fc', { ascending: false })
    .range(from, to)

  if (search) {
    query = query.or(`nombreLead.ilike.%${search}%,telefono.ilike.%${search}%,correo.ilike.%${search}%`)
  }
  if (idEtapa) query = query.eq('idEtapa', idEtapa)
  if (uidRC)   query = query.eq('uidRC', uidRC)
  if (Origen)  query = query.eq('Origen', Origen)
  if (tipoOperacion) query = query.eq('tipoOperacion', tipoOperacion)

  const { data: leads, count } = await query
  if (!leads?.length) return { leads: [], total: count ?? 0 }

  // Última actividad por lead
  const { data: actividades } = await supabase
    .from('activity_history')
    .select('lead_id, activity_date, heat_level')
    .in('lead_id', leads.map(l => l.id))
    .order('activity_date', { ascending: false })

  const ultimaAct: Record<string, { fecha: string; heat: number }> = {}
  for (const act of actividades ?? []) {
    if (act.lead_id && !(act.lead_id in ultimaAct)) {
      ultimaAct[act.lead_id] = { fecha: act.activity_date, heat: act.heat_level ?? 1 }
    }
  }

  const hoy = new Date()
  return {
    total: count ?? 0,
    leads: leads.map(l => {
      const act = ultimaAct[l.id]
      const diasSinActividad = act?.fecha
        ? Math.floor((hoy.getTime() - new Date(act.fecha).getTime()) / 86400000)
        : 999
      return {
        ...l,
        valor: l.valor ?? 0,
        ultimaActividad: act?.fecha,
        diasSinActividad,
        heatLevel: act?.heat ?? 1,
      }
    }),
  }
}

export async function getLeadsFilterOptions() {
  const supabase = await createClient()

  const [{ data: etapas }, { data: origenes }, { data: rcs }] = await Promise.all([
    supabase.from('crm_Etapas').select('id, titulo').eq('status', true).order('orden'),
    supabase.from('leads').select('Origen').eq('status', true),
    supabase.from('leads').select('uidRC, nomRC').eq('status', true).not('uidRC', 'is', null),
  ])

  const origenesUnicos = [...new Set((origenes ?? []).map(o => o.Origen).filter(Boolean))]
    .sort()

  const rcsMap = new Map<string, string>()
  for (const r of rcs ?? []) {
    if (r.uidRC && r.nomRC) rcsMap.set(r.uidRC, r.nomRC)
  }
  const rcsList = [...rcsMap.entries()]
    .map(([uidRC, nomRC]) => ({ uidRC, nomRC }))
    .sort((a, b) => a.nomRC.localeCompare(b.nomRC))

  return { etapas: etapas ?? [], origenes: origenesUnicos, rcs: rcsList }
}
