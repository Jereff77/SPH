'use server'

import { createClient } from '@/lib/supabase/server'
import type { WidgetConfig, WidgetData, ActiveFilters, FiltroKey, FiltroCatalogs } from '@/lib/queries/reportes-types'

// ── Datos de un widget con filtros globales aplicados ──────────

export async function fetchWidgetData(
  metrica: string,
  widgetConfig: WidgetConfig,
  globalFilters?: ActiveFilters,
): Promise<WidgetData> {
  const supabase = await createClient()

  // Filtros efectivos: widget + globales (globales tienen prioridad)
  const cfg: WidgetConfig = {
    ...widgetConfig,
    ...(globalFilters?.fechaInicio   && { fechaInicio:   globalFilters.fechaInicio }),
    ...(globalFilters?.fechaFin      && { fechaFin:      globalFilters.fechaFin }),
    ...(globalFilters?.uidRC         && { uidRC:         globalFilters.uidRC }),
  }

  const gf = globalFilters ?? {}
  const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

  // ── KPI ────────────────────────────────────────────────────
  if (metrica === 'kpi') {
    if (cfg.kpi === 'valor_pipeline') {
      const { data } = await supabase.from('leads').select('valor').eq('status', true)
      const total = (data ?? []).reduce((s, r) => s + ((r.valor as number) ?? 0), 0)
      const fmt = total >= 1_000_000 ? `$${(total/1_000_000).toFixed(1)}M` : `$${(total/1_000).toFixed(0)}K`
      return { labels: [], values: [], kpiValue: fmt, kpiLabel: 'valor del pipeline' }
    }
    if (cfg.kpi === 'tasa_conversion') {
      const { data } = await supabase.from('leads').select('Etapa').eq('status', true)
      const leads = data ?? []
      const ganados = leads.filter(l =>
        (l.Etapa as string)?.toLowerCase().includes('contrato') ||
        (l.Etapa as string)?.toLowerCase().includes('ganado')
      ).length
      const tasa = leads.length > 0 ? Math.round((ganados / leads.length) * 1000) / 10 : 0
      return { labels: [], values: [], kpiValue: `${tasa}%`, kpiLabel: 'tasa de conversión' }
    }
    const { count } = await supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', true)
    return { labels: [], values: [], kpiValue: count ?? 0, kpiLabel: 'leads activos' }
  }

  // ── Línea temporal ─────────────────────────────────────────
  if (metrica === 'line') {
    const since = sixMonthsAgo()
    let q = supabase.from('leads').select('fc, valor').eq('status', true).gte('fc', since)
    if (cfg.uidRC) q = q.eq('uidRC', cfg.uidRC) as typeof q
    const { data } = await q
    const grouped: Record<string, number> = {}
    for (const r of data ?? []) {
      const d = new Date(r.fc as string)
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
      const val = cfg.linea_metrica === 'valor_mensual' ? ((r.valor as number) ?? 0) : 1
      grouped[key] = (grouped[key] ?? 0) + val
    }
    const sorted = Object.entries(grouped).sort(([a],[b]) => a.localeCompare(b))
    return {
      labels: sorted.map(([k]) => { const [,m] = k.split('-'); return MESES[parseInt(m)-1] }),
      values: sorted.map(([,v]) => Math.round(v)),
    }
  }

  // ── Dinámico: leads ────────────────────────────────────────
  if (cfg.fuente === 'leads' && cfg.dimension) {
    let q = supabase.from('leads').select(`${cfg.dimension}, valor`).eq('status', true)
    if (cfg.uidRC)          q = q.eq('uidRC', cfg.uidRC) as typeof q
    if (cfg.fechaInicio)    q = q.gte('fc', cfg.fechaInicio) as typeof q
    if (cfg.fechaFin)       q = q.lte('fc', cfg.fechaFin) as typeof q
    if (gf.etapa)           q = q.eq('Etapa', gf.etapa) as typeof q
    if (gf.origen)          q = q.eq('Origen', gf.origen) as typeof q
    if (gf.tipoCliente)     q = q.eq('tipoCliente', gf.tipoCliente) as typeof q
    if (gf.tipoOperacion)   q = q.eq('tipoOperacion', gf.tipoOperacion) as typeof q
    const { data } = await q

    if (cfg.metrica_tipo === 'avg_valor') {
      const acc: Record<string, { sum: number; count: number }> = {}
      for (const r of data ?? []) {
        const k = (r[cfg.dimension as keyof typeof r] as string) ?? 'Sin valor'
        if (!acc[k]) acc[k] = { sum: 0, count: 0 }
        acc[k].sum   += (r.valor as number) ?? 0
        acc[k].count += 1
      }
      const entries = Object.entries(acc)
        .map(([k, v]) => [k, Math.round(v.sum / v.count)] as [string, number])
        .sort(([,a],[,b]) => b - a).slice(0, 12)
      return { labels: entries.map(([k]) => k), values: entries.map(([,v]) => v) }
    }

    const grouped: Record<string, number> = {}
    for (const r of data ?? []) {
      const k = (r[cfg.dimension as keyof typeof r] as string) ?? 'Sin valor'
      const val = cfg.metrica_tipo === 'sum_valor' ? ((r.valor as number) ?? 0) : 1
      grouped[k] = (grouped[k] ?? 0) + val
    }
    const entries = Object.entries(grouped).sort(([,a],[,b]) => b - a).slice(0, 12)
    return { labels: entries.map(([k]) => k), values: entries.map(([,v]) => Math.round(v)) }
  }

  // ── Dinámico: actividades ──────────────────────────────────
  if (cfg.fuente === 'actividades' && cfg.dimension) {
    let q = supabase.from('activity_history').select(cfg.dimension)
    if (cfg.fechaInicio) q = q.gte('activity_date', cfg.fechaInicio) as typeof q
    if (cfg.fechaFin)    q = q.lte('activity_date', cfg.fechaFin) as typeof q
    if (cfg.uidRC)       q = q.eq('uidr', cfg.uidRC) as typeof q
    const { data } = await q
    const grouped: Record<string, number> = {}
    for (const r of data ?? []) {
      const k = (r[cfg.dimension as keyof typeof r] as string) ?? 'Otro'
      grouped[k] = (grouped[k] ?? 0) + 1
    }
    const entries = Object.entries(grouped).sort(([,a],[,b]) => b - a).slice(0, 12)
    return { labels: entries.map(([k]) => k), values: entries.map(([,v]) => v) }
  }

  return { labels: [], values: [] }
}

// ── Catálogos para la barra de filtros ────────────────────────

export async function fetchFiltroCatalogs(filtros: FiltroKey[]): Promise<FiltroCatalogs> {
  const supabase = await createClient()
  const needs = (k: FiltroKey) => filtros.includes(k)

  const [rcs, etapas, origenes, tiposCliente, tiposOperacion] = await Promise.all([
    needs('rc')
      ? supabase.from('catUsers').select('uid, nombre').order('nombre')
      : Promise.resolve({ data: [] }),
    needs('etapa')
      ? supabase.from('crm_Etapas').select('id, titulo').eq('status', true).order('orden')
      : Promise.resolve({ data: [] }),
    needs('origen')
      ? supabase.from('crm_Origen').select('titulo').eq('status', true).order('titulo')
      : Promise.resolve({ data: [] }),
    needs('tipo_cliente')
      ? supabase.from('crm_tipoCliente').select('titulo').eq('status', true).order('titulo')
      : Promise.resolve({ data: [] }),
    needs('tipo_operacion')
      ? supabase.from('crm_tipoOperaciones').select('titulo').eq('status', true).order('titulo')
      : Promise.resolve({ data: [] }),
  ])

  return {
    rcs:            (rcs.data ?? []).map((r: any) => ({ value: r.uid,    label: r.nombre })),
    etapas:         (etapas.data ?? []).map((e: any) => ({ value: e.titulo, label: e.titulo })),
    origenes:       (origenes.data ?? []).map((o: any) => ({ value: o.titulo, label: o.titulo })),
    tiposCliente:   (tiposCliente.data ?? []).map((t: any) => ({ value: t.titulo, label: t.titulo })),
    tiposOperacion: (tiposOperacion.data ?? []).map((t: any) => ({ value: t.titulo, label: t.titulo })),
  }
}

// ── Guardar filtros disponibles del reporte ───────────────────

export async function saveFiltrosDisponibles(idReporte: string, filtros: FiltroKey[]): Promise<void> {
  const supabase = await createClient()
  await supabase.from('crm_reportes').update({ filtros_disponibles: filtros }).eq('id', idReporte)
}

// ── Helper ─────────────────────────────────────────────────────

function sixMonthsAgo(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 5)
  d.setDate(1)
  return d.toISOString()
}
