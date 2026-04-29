'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Pencil, Eye, Trash2, Plus, Globe, Lock,
  SlidersHorizontal, X, Filter,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  FILTROS_CATALOGO,
  type CrmReporte, type CrmWidget, type FiltroKey,
  type ActiveFilters, type FiltroCatalogs, type FiltroOption,
} from '@/lib/queries/reportes-types'
import { saveFiltrosDisponibles } from '@/app/actions/reportes'
import { WidgetCard } from './widget-card'
import { WidgetConfigurator } from './widget-configurator'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'

interface Props {
  reporte: CrmReporte
  widgets: CrmWidget[]
  isOwner: boolean
  catalogs: FiltroCatalogs
}

const ALL_FILTRO_KEYS = Object.keys(FILTROS_CATALOGO) as FiltroKey[]

export function DashboardView({ reporte, widgets: initialWidgets, isOwner, catalogs }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editMode, setEditMode] = useState(false)
  const [widgets, setWidgets] = useState(initialWidgets)
  const [esPublico, setEsPublico] = useState(reporte.es_publico)
  const [filtrosDisponibles, setFiltrosDisponibles] = useState<FiltroKey[]>(
    (reporte.filtros_disponibles ?? []) as FiltroKey[]
  )
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({})
  const [showFilterPanel, setShowFilterPanel] = useState(false)

  const hasFilters    = filtrosDisponibles.length > 0
  const hasActiveFilters = Object.values(activeFilters).some(Boolean)

  function refresh() {
    startTransition(() => router.refresh())
  }

  function setFilter(field: keyof ActiveFilters, value: string) {
    setActiveFilters(f => ({ ...f, [field]: value || undefined }))
  }

  function clearFilters() {
    setActiveFilters({})
  }

  async function togglePublico() {
    const supabase = createClient()
    const next = !esPublico
    const { error } = await supabase.from('crm_reportes').update({ es_publico: next }).eq('id', reporte.id)
    if (error) { toast.error('No se pudo actualizar.'); return }
    setEsPublico(next)
    toast.success(next ? 'Dashboard ahora es público.' : 'Dashboard ahora es privado.')
  }

  async function deleteWidget(widgetId: string) {
    const supabase = createClient()
    const { error } = await supabase.from('crm_reporte_widgets').delete().eq('id', widgetId)
    if (error) { toast.error('No se pudo eliminar.'); return }
    setWidgets(ws => ws.filter(w => w.id !== widgetId))
    toast.success('Widget eliminado.')
  }

  async function moveWidget(widgetId: string, direction: 'up' | 'down') {
    const idx = widgets.findIndex(w => w.id === widgetId)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= widgets.length) return
    const next = [...widgets]
    ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
    setWidgets(next)
    const supabase = createClient()
    await Promise.all([
      supabase.from('crm_reporte_widgets').update({ orden: idx }).eq('id', next[idx].id),
      supabase.from('crm_reporte_widgets').update({ orden: swapIdx }).eq('id', next[swapIdx].id),
    ])
  }

  async function deleteDashboard() {
    if (!confirm(`¿Eliminar "${reporte.nombre}"? Esta acción no se puede deshacer.`)) return
    const supabase = createClient()
    const { error } = await supabase.from('crm_reportes').delete().eq('id', reporte.id)
    if (error) { toast.error('No se pudo eliminar.'); return }
    toast.success('Dashboard eliminado.')
    router.push('/reportes')
  }

  async function toggleFiltro(key: FiltroKey) {
    const next = filtrosDisponibles.includes(key)
      ? filtrosDisponibles.filter(k => k !== key)
      : [...filtrosDisponibles, key]
    setFiltrosDisponibles(next)
    // Al quitar un filtro, limpiar su valor activo
    if (filtrosDisponibles.includes(key)) {
      setActiveFilters(f => {
        const copy = { ...f }
        if (key === 'fecha_rango')    { delete copy.fechaInicio; delete copy.fechaFin }
        if (key === 'rc')             delete copy.uidRC
        if (key === 'etapa')          delete copy.etapa
        if (key === 'origen')         delete copy.origen
        if (key === 'tipo_cliente')   delete copy.tipoCliente
        if (key === 'tipo_operacion') delete copy.tipoOperacion
        return copy
      })
    }
    await saveFiltrosDisponibles(reporte.id, next)
  }

  const sel = 'h-8 rounded-md border border-input bg-card px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent'

  return (
    <div className="space-y-4">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-foreground">{reporte.nombre}</h2>
            <Badge variant="outline" className="text-[10px] gap-1">
              {esPublico ? <><Globe className="w-2.5 h-2.5" />Público</> : <><Lock className="w-2.5 h-2.5" />Privado</>}
            </Badge>
          </div>
          {reporte.descripcion && <p className="text-sm text-muted-foreground mt-0.5">{reporte.descripcion}</p>}
          {!isOwner && reporte.nomCreador && <p className="text-xs text-muted-foreground mt-0.5">Por {reporte.nomCreador}</p>}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {hasFilters && !editMode && (
            <Button size="sm" variant={showFilterPanel ? 'default' : 'outline'}
              onClick={() => setShowFilterPanel(s => !s)}>
              <Filter className="w-4 h-4 mr-1.5" />
              Filtros
              {hasActiveFilters && <span className="ml-1.5 w-4 h-4 rounded-full bg-accent text-white text-[9px] flex items-center justify-center">!</span>}
            </Button>
          )}
          {isOwner && (
            <>
              <Button size="sm" variant="outline" onClick={togglePublico} disabled={isPending}>
                {esPublico ? <><Lock className="w-4 h-4 mr-1" />Hacer privado</> : <><Globe className="w-4 h-4 mr-1" />Hacer público</>}
              </Button>
              <Button size="sm" variant={editMode ? 'default' : 'outline'} onClick={() => { setEditMode(e => !e); setShowFilterPanel(false) }}>
                {editMode ? <><Eye className="w-4 h-4 mr-1.5" />Ver</> : <><Pencil className="w-4 h-4 mr-1.5" />Editar</>}
              </Button>
              {editMode && (
                <Button size="sm" variant="destructive" onClick={deleteDashboard}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Barra de filtros (vista) ────────────────────────── */}
      {showFilterPanel && hasFilters && !editMode && (
        <div className="rounded-xl border bg-card p-3 flex flex-wrap items-end gap-3">
          {filtrosDisponibles.includes('fecha_rango') && (
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Desde</Label>
              <input type="date" className={sel} value={activeFilters.fechaInicio ?? ''}
                onChange={e => setFilter('fechaInicio', e.target.value)} />
              <Label className="text-xs text-muted-foreground">hasta</Label>
              <input type="date" className={sel} value={activeFilters.fechaFin ?? ''}
                onChange={e => setFilter('fechaFin', e.target.value)} />
            </div>
          )}

          {filtrosDisponibles.includes('rc') && catalogs.rcs.length > 0 && (
            <SelectFiltro
              label="RC" options={catalogs.rcs}
              value={activeFilters.uidRC ?? ''}
              onChange={v => setFilter('uidRC', v)} />
          )}
          {filtrosDisponibles.includes('etapa') && catalogs.etapas.length > 0 && (
            <SelectFiltro
              label="Etapa" options={catalogs.etapas}
              value={activeFilters.etapa ?? ''}
              onChange={v => setFilter('etapa', v)} />
          )}
          {filtrosDisponibles.includes('origen') && catalogs.origenes.length > 0 && (
            <SelectFiltro
              label="Origen" options={catalogs.origenes}
              value={activeFilters.origen ?? ''}
              onChange={v => setFilter('origen', v)} />
          )}
          {filtrosDisponibles.includes('tipo_cliente') && catalogs.tiposCliente.length > 0 && (
            <SelectFiltro
              label="Tipo cliente" options={catalogs.tiposCliente}
              value={activeFilters.tipoCliente ?? ''}
              onChange={v => setFilter('tipoCliente', v)} />
          )}
          {filtrosDisponibles.includes('tipo_operacion') && catalogs.tiposOperacion.length > 0 && (
            <SelectFiltro
              label="Tipo operación" options={catalogs.tiposOperacion}
              value={activeFilters.tipoOperacion ?? ''}
              onChange={v => setFilter('tipoOperacion', v)} />
          )}

          {hasActiveFilters && (
            <button onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors ml-auto">
              <X className="w-3.5 h-3.5" />Limpiar
            </button>
          )}
        </div>
      )}

      {/* ── Panel de configuración de filtros (edición) ────── */}
      {editMode && isOwner && (
        <div className="rounded-xl border border-dashed bg-muted/20 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">Filtros disponibles en este dashboard</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Los filtros activos afectan a todos los widgets simultáneamente cuando el usuario los aplica.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ALL_FILTRO_KEYS.map(key => {
              const info = FILTROS_CATALOGO[key]
              const active = filtrosDisponibles.includes(key)
              return (
                <button key={key} onClick={() => toggleFiltro(key)}
                  className={cn(
                    'flex flex-col items-start gap-0.5 rounded-lg border p-2.5 text-left transition-all',
                    active
                      ? 'border-accent bg-accent/5 text-foreground'
                      : 'border-border bg-card text-muted-foreground hover:border-accent/50'
                  )}>
                  <div className="flex items-center gap-1.5 w-full">
                    <div className={cn('w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center',
                      active ? 'border-accent bg-accent' : 'border-muted-foreground'
                    )}>
                      {active && <span className="text-white text-[8px] font-bold">✓</span>}
                    </div>
                    <span className="text-xs font-medium">{info.label}</span>
                  </div>
                  <p className="text-[10px] leading-tight ml-5">{info.descripcion}</p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Grid de widgets ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {widgets.map((widget, i) => (
          <WidgetCard
            key={widget.id}
            widget={widget}
            globalFilters={activeFilters}
            editMode={editMode}
            isFirst={i === 0}
            isLast={i === widgets.length - 1}
            idReporte={reporte.id}
            onDelete={deleteWidget}
            onMove={moveWidget}
            onSaved={refresh}
          />
        ))}

        {editMode && isOwner && (
          <div className="col-span-1 rounded-xl border-2 border-dashed border-border flex items-center justify-center min-h-[180px]">
            <WidgetConfigurator
              idReporte={reporte.id}
              onSaved={refresh}
              trigger={
                <button className="flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground transition-colors py-8">
                  <Plus className="w-8 h-8" />
                  <span className="text-xs font-medium">Agregar widget</span>
                </button>
              }
            />
          </div>
        )}

        {widgets.length === 0 && !editMode && (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-center gap-2">
            <p className="text-sm text-muted-foreground">Este dashboard no tiene widgets todavía.</p>
            {isOwner && (
              <Button size="sm" variant="outline" onClick={() => setEditMode(true)}>
                <Pencil className="w-4 h-4 mr-1.5" />Editar para agregar widgets
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Componente auxiliar de select ──────────────────────────────

function SelectFiltro({ label, options, value, onChange }: {
  label: string
  options: FiltroOption[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Label className="text-xs text-muted-foreground whitespace-nowrap">{label}</Label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-8 rounded-md border border-input bg-card px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
      >
        <option value="">Todos</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
