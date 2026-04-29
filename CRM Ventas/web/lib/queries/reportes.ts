import { createClient } from '@/lib/supabase/server'
export type { WidgetConfig, CrmReporte, CrmWidget, WidgetData } from './reportes-types'
import type { WidgetConfig, CrmReporte, CrmWidget, WidgetData } from './reportes-types'

// ── Queries de reportes ────────────────────────────────────────

export async function getReportesDashboard(): Promise<CrmReporte[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('crm_reportes')
    .select('id, uid_creador, nombre, descripcion, es_publico, fc')
    .order('fc', { ascending: false })

  if (!data?.length) return []

  const uids = [...new Set(data.map(r => r.uid_creador))]
  const { data: users } = await supabase.from('catUsers').select('uid, nombre').in('uid', uids)
  const userMap: Record<string, string> = {}
  for (const u of users ?? []) userMap[u.uid] = u.nombre

  return data.map(r => ({ ...r, nomCreador: userMap[r.uid_creador] ?? '' }))
}

export async function getReporteById(id: string): Promise<{ reporte: CrmReporte; widgets: CrmWidget[] } | null> {
  const supabase = await createClient()

  const [{ data: reporte }, { data: widgets }] = await Promise.all([
    supabase.from('crm_reportes').select('id, uid_creador, nombre, descripcion, es_publico, fc').eq('id', id).single(),
    supabase.from('crm_reporte_widgets').select('id, id_reporte, titulo, tipo, metrica, config, orden, ancho').eq('id_reporte', id).order('orden'),
  ])

  if (!reporte) return null

  const { data: user } = await supabase.from('catUsers').select('nombre').eq('uid', reporte.uid_creador).single()

  return {
    reporte: { ...reporte, nomCreador: user?.nombre ?? '' },
    widgets: (widgets ?? []) as CrmWidget[],
  }
}

// ── Motor de datos por configuración ──────────────────────────

export async function getWidgetData(metrica: string, config: WidgetConfig): Promise<WidgetData> {
  const supabase = await createClient()
  const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

  // ── KPI ───────────────────────────────────────────────────
  if (metrica === 'kpi') {
    if (config.kpi === 'valor_pipeline') {
      const { data } = await supabase.from('leads').select('valor').eq('status', true)
      const total = (data ?? []).reduce((s, r) => s + ((r.valor as number) ?? 0), 0)
      const fmt = total >= 1_000_000 ? `$${(total/1_000_000).toFixed(1)}M` : `$${(total/1_000).toFixed(0)}K`
      return { labels: [], values: [], kpiValue: fmt, kpiLabel: 'valor del pipeline' }
    }
    if (config.kpi === 'tasa_conversion') {
      const { data } = await supabase.from('leads').select('Etapa').eq('status', true)
      const leads = data ?? []
      const ganados = leads.filter(l => (l.Etapa as string)?.toLowerCase().includes('contrato') || (l.Etapa as string)?.toLowerCase().includes('ganado')).length
      const tasa = leads.length > 0 ? Math.round((ganados / leads.length) * 1000) / 10 : 0
      return { labels: [], values: [], kpiValue: `${tasa}%`, kpiLabel: 'tasa de conversión' }
    }
    // kpi_leads_activos (default)
    const { count } = await supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', true)
    return { labels: [], values: [], kpiValue: count ?? 0, kpiLabel: 'leads activos' }
  }

  // ── Línea temporal ─────────────────────────────────────────
  if (metrica === 'line') {
    const since = sixMonthsAgo()
    let q = supabase.from('leads').select('fc, valor').eq('status', true).gte('fc', since)
    if (config.uidRC) q = q.eq('uidRC', config.uidRC) as typeof q
    const { data } = await q

    const grouped: Record<string, number> = {}
    for (const r of data ?? []) {
      const d = new Date(r.fc as string)
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
      const val = config.linea_metrica === 'valor_mensual' ? ((r.valor as number) ?? 0) : 1
      grouped[key] = (grouped[key] ?? 0) + val
    }
    const sorted = Object.entries(grouped).sort(([a],[b]) => a.localeCompare(b))
    return {
      labels: sorted.map(([k]) => { const [,m] = k.split('-'); return MESES[parseInt(m)-1] }),
      values: sorted.map(([,v]) => Math.round(v)),
    }
  }

  // ── Dinámico: leads agrupados por dimensión ────────────────
  if (config.fuente === 'leads' && config.dimension) {
    let q = supabase.from('leads').select(`${config.dimension}, valor`).eq('status', true)
    if (config.uidRC)      q = q.eq('uidRC', config.uidRC) as typeof q
    if (config.fechaInicio) q = q.gte('fc', config.fechaInicio) as typeof q
    if (config.fechaFin)    q = q.lte('fc', config.fechaFin) as typeof q
    const { data } = await q

    if (config.metrica_tipo === 'avg_valor') {
      const acc: Record<string, { sum: number; count: number }> = {}
      for (const r of data ?? []) {
        const k = (r[config.dimension as keyof typeof r] as string) ?? 'Sin valor'
        if (!acc[k]) acc[k] = { sum: 0, count: 0 }
        acc[k].sum += (r.valor as number) ?? 0
        acc[k].count++
      }
      const entries = Object.entries(acc).map(([k, v]) => [k, Math.round(v.sum / v.count)] as [string, number])
        .sort(([,a],[,b]) => b - a).slice(0, 12)
      return { labels: entries.map(([k]) => k), values: entries.map(([,v]) => v) }
    }

    const grouped: Record<string, number> = {}
    for (const r of data ?? []) {
      const k = (r[config.dimension as keyof typeof r] as string) ?? 'Sin valor'
      const val = config.metrica_tipo === 'sum_valor' ? ((r.valor as number) ?? 0) : 1
      grouped[k] = (grouped[k] ?? 0) + val
    }
    const entries = Object.entries(grouped).sort(([,a],[,b]) => b - a).slice(0, 12)
    return { labels: entries.map(([k]) => k), values: entries.map(([,v]) => Math.round(v)) }
  }

  // ── Dinámico: actividades agrupadas por dimensión ──────────
  if (config.fuente === 'actividades' && config.dimension) {
    let q = supabase.from('activity_history').select(config.dimension)
    if (config.fechaInicio) q = q.gte('activity_date', config.fechaInicio) as typeof q
    if (config.fechaFin)    q = q.lte('activity_date', config.fechaFin) as typeof q
    if (config.uidRC)       q = q.eq('uidr', config.uidRC) as typeof q
    const { data } = await q

    const grouped: Record<string, number> = {}
    for (const r of data ?? []) {
      const k = (r[config.dimension as keyof typeof r] as string) ?? 'Otro'
      grouped[k] = (grouped[k] ?? 0) + 1
    }
    const entries = Object.entries(grouped).sort(([,a],[,b]) => b - a).slice(0, 12)
    return { labels: entries.map(([k]) => k), values: entries.map(([,v]) => v) }
  }

  return { labels: [], values: [] }
}

// ── Helpers ────────────────────────────────────────────────────

function sixMonthsAgo(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 5)
  d.setDate(1)
  return d.toISOString()
}
