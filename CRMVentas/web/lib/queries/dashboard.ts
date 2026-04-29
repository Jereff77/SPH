import { createClient } from '@/lib/supabase/server'

export interface DashboardStats {
  totalLeads: number
  valorPipeline: number
  tasaConversion: number
  pendientesAprobacion: number
}

export interface EtapaStat {
  etapa: string
  total: number
  valor: number
}

export interface OrigenStat {
  origen: string
  total: number
}

export interface TendenciaMes {
  mes: string
  total: number
}

export interface LeadSinActividad {
  id: string
  nombreLead: string
  nomRC: string
  Etapa: string
  diasSinActividad: number
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient()

  const [{ data: leadsData }, { count: pendientes }] = await Promise.all([
    supabase
      .from('leads')
      .select('valor, Etapa')
      .eq('status', true),
    supabase
      .from('leads_porAprobar')
      .select('*', { count: 'exact', head: true })
      .eq('status', true),
  ])

  const leads = leadsData ?? []
  const totalLeads = leads.length
  const valorPipeline = leads.reduce((sum, l) => sum + (l.valor ?? 0), 0)
  const contratosFirmados = leads.filter(l =>
    l.Etapa?.toLowerCase().includes('contrato') || l.Etapa?.toLowerCase().includes('firmado')
  ).length
  const tasaConversion = totalLeads > 0 ? Math.round((contratosFirmados / totalLeads) * 1000) / 10 : 0

  return {
    totalLeads,
    valorPipeline,
    tasaConversion,
    pendientesAprobacion: pendientes ?? 0,
  }
}

export async function getEtapaStats(): Promise<EtapaStat[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('leads')
    .select('Etapa, idEtapa, valor')
    .eq('status', true)

  if (!data) return []

  const grouped = data.reduce<Record<string, EtapaStat>>((acc, lead) => {
    const key = lead.Etapa ?? 'Sin etapa'
    if (!acc[key]) acc[key] = { etapa: key, total: 0, valor: 0 }
    acc[key].total++
    acc[key].valor += lead.valor ?? 0
    return acc
  }, {})

  return Object.values(grouped)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)
}

export async function getOrigenStats(): Promise<OrigenStat[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('leads')
    .select('Origen')
    .eq('status', true)

  if (!data) return []

  const grouped = data.reduce<Record<string, number>>((acc, l) => {
    const key = l.Origen ?? 'Sin origen'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  return Object.entries(grouped)
    .map(([origen, total]) => ({ origen, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 7)
}

export async function getTendenciaMensual(): Promise<TendenciaMes[]> {
  const supabase = await createClient()

  const since = new Date()
  since.setMonth(since.getMonth() - 5)
  since.setDate(1)

  const { data } = await supabase
    .from('leads')
    .select('fc')
    .gte('fc', since.toISOString())
    .eq('status', true)

  if (!data) return []

  const grouped = data.reduce<Record<string, number>>((acc, l) => {
    const d = new Date(l.fc)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, total]) => {
      const [, m] = key.split('-')
      return { mes: meses[parseInt(m) - 1], total }
    })
}

export async function getLeadsSinActividad(dias = 7): Promise<LeadSinActividad[]> {
  const supabase = await createClient()

  const desde = new Date()
  desde.setDate(desde.getDate() - dias)

  // Leads activos
  const { data: leads } = await supabase
    .from('leads')
    .select('id, nombreLead, nomRC, Etapa')
    .eq('status', true)
    .not('Etapa', 'ilike', '%contrato%')
    .not('Etapa', 'ilike', '%perdido%')

  if (!leads?.length) return []

  // Última actividad por lead
  const { data: actividades } = await supabase
    .from('activity_history')
    .select('lead_id, activity_date')
    .in('lead_id', leads.map(l => l.id))
    .order('activity_date', { ascending: false })

  const ultimaActividad: Record<string, Date> = {}
  for (const act of actividades ?? []) {
    if (act.lead_id && act.activity_date && !ultimaActividad[act.lead_id]) {
      ultimaActividad[act.lead_id] = new Date(act.activity_date)
    }
  }

  const hoy = new Date()
  return leads
    .map(lead => {
      const ultima = ultimaActividad[lead.id]
      const diasSin = ultima
        ? Math.floor((hoy.getTime() - ultima.getTime()) / 86400000)
        : 999
      return { ...lead, diasSinActividad: diasSin }
    })
    .filter(l => l.diasSinActividad >= dias)
    .sort((a, b) => b.diasSinActividad - a.diasSinActividad)
    .slice(0, 5)
}
