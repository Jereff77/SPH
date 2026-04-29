'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/lib/stores/auth.store'
import {
  type CrmWidget, type WidgetConfig,
  DIMENSIONES_LEADS, DIMENSIONES_ACTIVIDADES,
  METRICAS_Y_LEADS, METRICAS_Y_ACTIVIDADES,
  LINEA_METRICAS, KPI_OPCIONES,
} from '@/lib/queries/reportes-types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet'

const TIPOS = [
  { value: 'bar',   label: '📊 Barras' },
  { value: 'pie',   label: '🥧 Pastel' },
  { value: 'line',  label: '📈 Línea temporal' },
  { value: 'kpi',   label: '🔢 KPI (número)' },
  { value: 'table', label: '📋 Tabla' },
]

const ANCHOS = [
  { value: 'full',  label: 'Ancho completo' },
  { value: 'half',  label: 'Mitad' },
  { value: 'third', label: 'Un tercio' },
]

interface Props {
  idReporte: string
  widget?: CrmWidget
  trigger?: React.ReactNode
  onSaved: () => void
}

interface RcOption { uid: string; nombre: string }

function defaultConfig(widget?: CrmWidget): WidgetConfig {
  return widget?.config ?? {}
}

export function WidgetConfigurator({ idReporte, widget, trigger, onSaved }: Props) {
  const { user } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rcs, setRcs] = useState<RcOption[]>([])
  const rcsLoaded = useRef(false)

  const [titulo, setTitulo] = useState(widget?.titulo ?? '')
  const [tipo, setTipo] = useState(widget?.tipo ?? 'bar')
  const [ancho, setAncho] = useState(widget?.ancho ?? 'half')
  const [cfg, setCfg] = useState<WidgetConfig>(defaultConfig(widget))

  function set<K extends keyof WidgetConfig>(field: K, value: WidgetConfig[K]) {
    setCfg(c => ({ ...c, [field]: value || undefined }))
  }

  useEffect(() => {
    if (!open || rcsLoaded.current) return
    rcsLoaded.current = true
    createClient().from('catUsers').select('uid, nombre').order('nombre')
      .then(({ data }) => setRcs((data ?? []) as RcOption[]))
  }, [open])

  // Al cambiar tipo, resetear configuración de datos
  function handleTipoChange(newTipo: string) {
    setTipo(newTipo)
    setCfg(c => ({
      fechaInicio: c.fechaInicio,
      fechaFin: c.fechaFin,
      uidRC: c.uidRC,
    }))
  }

  function validate(): string | null {
    if (!titulo.trim()) return 'El título es obligatorio.'
    if ((tipo === 'bar' || tipo === 'pie' || tipo === 'table') && (!cfg.fuente || !cfg.dimension || !cfg.metrica_tipo))
      return 'Selecciona fuente, eje X y métrica.'
    if (tipo === 'line' && !cfg.linea_metrica) return 'Selecciona la métrica de la línea.'
    if (tipo === 'kpi' && !cfg.kpi) return 'Selecciona el indicador KPI.'
    return null
  }

  async function handleSave() {
    const err = validate()
    if (err) { toast.error(err); return }
    setSaving(true)

    const supabase = createClient()
    const payload = {
      titulo: titulo.trim(),
      tipo,
      metrica: tipo === 'kpi' ? 'kpi' : tipo === 'line' ? 'line' : '_dynamic',
      ancho,
      config: cfg,
      id_reporte: idReporte,
      uid_creador: user?.uid,
    }

    const { error } = widget
      ? await supabase.from('crm_reporte_widgets').update(payload).eq('id', widget.id)
      : await supabase.from('crm_reporte_widgets').insert({ ...payload, orden: 999 })

    setSaving(false)
    if (error) { toast.error('No se pudo guardar el widget.'); return }

    toast.success(widget ? 'Widget actualizado.' : 'Widget agregado.')
    setOpen(false)
    onSaved()
  }

  const sel = 'w-full h-8 rounded-md border border-input bg-card px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent'
  const inp = 'w-full h-8 rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent'

  const dimensiones = cfg.fuente === 'actividades' ? DIMENSIONES_ACTIVIDADES : DIMENSIONES_LEADS
  const metricasY   = cfg.fuente === 'actividades' ? METRICAS_Y_ACTIVIDADES  : METRICAS_Y_LEADS

  return (
    <>
      {trigger
        ? <span onClick={() => setOpen(true)} className="cursor-pointer">{trigger}</span>
        : <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            {widget ? 'Configurar widget' : '+ Agregar widget'}
          </Button>
      }

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{widget ? 'Editar widget' : 'Nuevo widget'}</SheetTitle>
            <SheetDescription>Elige el tipo de visualización y configura los datos.</SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-5 px-4 pb-4">

            {/* Nombre y ancho */}
            <div className="space-y-1">
              <Label className="text-xs">Título <span className="text-destructive">*</span></Label>
              <input className={inp} value={titulo} onChange={e => setTitulo(e.target.value)}
                placeholder="ej. Leads por etapa del mes" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Tipo de visualización</Label>
                <select className={sel} value={tipo} onChange={e => handleTipoChange(e.target.value)}>
                  {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ancho</Label>
                <select className={sel} value={ancho} onChange={e => setAncho(e.target.value)}>
                  {ANCHOS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
            </div>

            {/* ── Configuración según tipo ── */}

            {/* bar / pie / table: fuente + X + Y */}
            {(tipo === 'bar' || tipo === 'pie' || tipo === 'table') && (
              <section className="space-y-3 rounded-lg border border-border p-3 bg-muted/20">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Datos</p>

                <div className="space-y-1">
                  <Label className="text-xs">Fuente <span className="text-destructive">*</span></Label>
                  <div className="flex gap-1 rounded-md border border-input overflow-hidden text-xs">
                    {[{v:'leads',l:'Leads'},{v:'actividades',l:'Actividades'}].map(f => (
                      <button key={f.v} type="button"
                        onClick={() => setCfg(c => ({ ...c, fuente: f.v as 'leads'|'actividades', dimension: undefined, metrica_tipo: undefined }))}
                        className={`flex-1 py-1.5 transition-colors ${cfg.fuente === f.v ? 'bg-accent text-white' : 'bg-card text-muted-foreground hover:bg-muted'}`}>
                        {f.l}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Eje X — Agrupar por <span className="text-destructive">*</span></Label>
                  <select className={sel} value={cfg.dimension ?? ''}
                    onChange={e => set('dimension', e.target.value)}>
                    <option value="">— Seleccionar campo —</option>
                    {dimensiones.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Eje Y — Métrica <span className="text-destructive">*</span></Label>
                  <select className={sel} value={cfg.metrica_tipo ?? ''}
                    onChange={e => set('metrica_tipo', e.target.value as WidgetConfig['metrica_tipo'])}>
                    <option value="">— Seleccionar métrica —</option>
                    {metricasY.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
              </section>
            )}

            {/* line: métrica temporal */}
            {tipo === 'line' && (
              <section className="space-y-3 rounded-lg border border-border p-3 bg-muted/20">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Datos temporales</p>
                <p className="text-xs text-muted-foreground">El eje X siempre es el tiempo (últimos 6 meses).</p>
                <div className="space-y-1">
                  <Label className="text-xs">Eje Y — Métrica <span className="text-destructive">*</span></Label>
                  <select className={sel} value={cfg.linea_metrica ?? ''}
                    onChange={e => set('linea_metrica', e.target.value as WidgetConfig['linea_metrica'])}>
                    <option value="">— Seleccionar —</option>
                    {LINEA_METRICAS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
              </section>
            )}

            {/* kpi */}
            {tipo === 'kpi' && (
              <section className="space-y-3 rounded-lg border border-border p-3 bg-muted/20">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Indicador KPI</p>
                <select className={sel} value={cfg.kpi ?? ''}
                  onChange={e => set('kpi', e.target.value as WidgetConfig['kpi'])}>
                  <option value="">— Seleccionar indicador —</option>
                  {KPI_OPCIONES.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
                </select>
              </section>
            )}

            {/* Filtros */}
            <section className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filtros (opcionales)</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Fecha inicio</Label>
                  <input type="date" className={inp}
                    value={cfg.fechaInicio ?? ''}
                    onChange={e => set('fechaInicio', e.target.value || null)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fecha fin</Label>
                  <input type="date" className={inp}
                    value={cfg.fechaFin ?? ''}
                    onChange={e => set('fechaFin', e.target.value || null)} />
                </div>
              </div>

              {tipo !== 'kpi' && (
                <div className="space-y-1">
                  <Label className="text-xs">Responsable comercial</Label>
                  <select className={sel} value={cfg.uidRC ?? ''}
                    onChange={e => set('uidRC', e.target.value || null)}>
                    <option value="">Todos los RCs</option>
                    {rcs.map(r => <option key={r.uid} value={r.uid}>{r.nombre}</option>)}
                  </select>
                </div>
              )}
            </section>

            <SheetFooter>
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? 'Guardando...' : widget ? 'Guardar cambios' : 'Agregar al dashboard'}
              </Button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
