'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ClipboardList } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/lib/stores/auth.store'
import { getLeadFormCatalogs, type LeadFormCatalogs } from '@/lib/queries/lead-form'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet'

const EMPTY: LeadFormCatalogs = {
  origenes: [], tiposCliente: [], tiposOperacion: [],
  tiposVenta: [], etapas: [], campanias: [], rcs: [],
}

interface Form {
  nombreLead: string
  telefono: string
  correo: string
  idOrigen: string
  idTipoCliente: string
  idTipoOperacion: string
  idTipoVenta: string
  idEtapa: string
  uidRC: string
  valor: string
  mensaje: string
  superficie: string
  KVAs: string
  ubicacion: string
  personaFisica: boolean
}

const INIT: Form = {
  nombreLead: '', telefono: '', correo: '',
  idOrigen: '', idTipoCliente: '', idTipoOperacion: '',
  idTipoVenta: '', idEtapa: '', uidRC: '',
  valor: '', mensaje: '',
  superficie: '', KVAs: '', ubicacion: '',
  personaFisica: true,
}

export function NuevoPreLeadSheet() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [cats, setCats] = useState<LeadFormCatalogs>(EMPTY)
  const [form, setForm] = useState<Form>(INIT)
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({})
  const loaded = useRef(false)

  useEffect(() => {
    if (open && !loaded.current) {
      loaded.current = true
      getLeadFormCatalogs().then(setCats)
    }
  }, [open])

  function set(field: keyof Form, value: string | boolean) {
    setForm(f => ({ ...f, [field]: value }))
    setErrors(e => ({ ...e, [field]: '' }))
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof Form, string>> = {}
    if (!form.nombreLead.trim()) errs.nombreLead = 'Requerido'
    if (!form.idOrigen)          errs.idOrigen   = 'Requerido'
    if (!form.idTipoCliente)     errs.idTipoCliente = 'Requerido'
    if (!form.superficie.trim()) errs.superficie = 'Requerido'
    if (!form.KVAs.trim())       errs.KVAs       = 'Requerido'
    if (!form.ubicacion.trim())  errs.ubicacion  = 'Requerido'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate() || !user) return

    const etapa      = cats.etapas.find(e => String(e.id) === form.idEtapa) ?? cats.etapas[0]
    const origen     = cats.origenes.find(o => String(o.id) === form.idOrigen)
    const tCliente   = cats.tiposCliente.find(t => String(t.id) === form.idTipoCliente)
    const tOperacion = cats.tiposOperacion.find(t => String(t.id) === form.idTipoOperacion)
    const tVenta     = cats.tiposVenta.find(t => String(t.id) === form.idTipoVenta)
    const rc         = cats.rcs.find(r => r.uid === form.uidRC)

    const supabase = createClient()
    const { error } = await supabase.from('leads_porAprobar').insert({
      nombreLead:      form.nombreLead.trim(),
      telefono:        form.telefono || null,
      correo:          form.correo || null,
      idOrigen:        form.idOrigen ? Number(form.idOrigen) : null,
      Origen:          origen?.titulo ?? null,
      idTipoCliente:   form.idTipoCliente ? Number(form.idTipoCliente) : null,
      tipoCliente:     tCliente?.titulo ?? null,
      idTipoOperacion: form.idTipoOperacion ? Number(form.idTipoOperacion) : null,
      tipoOperacion:   tOperacion?.titulo ?? null,
      idTipoVenta:     form.idTipoVenta ? Number(form.idTipoVenta) : null,
      tipoVenta:       tVenta?.titulo ?? null,
      idEtapa:         etapa?.id ?? null,
      Etapa:           etapa?.titulo ?? null,
      uidRC:           form.uidRC || null,
      nomRC:           rc?.nombre ?? user.nombre ?? 'Sin asignar',
      valor:           form.valor ? parseFloat(form.valor) : null,
      mensaje:         form.mensaje || null,
      superficie:      form.superficie.trim(),
      KVAs:            form.KVAs.trim(),
      ubicacion:       form.ubicacion.trim(),
      personaFisica:   form.personaFisica,
      uidr:            user.uid,
      status:          true,
      aprobado:        false,
    })

    if (error) {
      toast.error('No se pudo registrar el prelead.')
      return
    }

    toast.success('Prelead registrado. Queda pendiente de aprobación.')
    setForm(INIT)
    setOpen(false)
    startTransition(() => router.refresh())
  }

  const sel = 'w-full h-8 rounded-md border border-input bg-card px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent'
  const inp = 'w-full h-8 rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent'
  const err = 'border-destructive focus:ring-destructive'

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <ClipboardList className="w-4 h-4 mr-1.5" />
        Nuevo prelead
      </Button>

      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Nuevo prelead</SheetTitle>
          <SheetDescription>Quedará pendiente de aprobación antes de entrar al pipeline.</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 pb-4">

          {/* Contacto */}
          <section className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contacto</p>

            <div className="space-y-1">
              <Label className="text-xs">Nombre <span className="text-destructive">*</span></Label>
              <input className={`${inp} ${errors.nombreLead ? err : ''}`}
                value={form.nombreLead} onChange={e => set('nombreLead', e.target.value)}
                placeholder="Nombre completo" />
              {errors.nombreLead && <p className="text-xs text-destructive">{errors.nombreLead}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Teléfono</Label>
                <input className={inp} value={form.telefono}
                  onChange={e => set('telefono', e.target.value)} placeholder="10 dígitos" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Correo</Label>
                <input className={inp} type="email" value={form.correo}
                  onChange={e => set('correo', e.target.value)} placeholder="email@dominio.com" />
              </div>
            </div>

            {/* Tipo persona */}
            <div className="flex items-center gap-3">
              <Label className="text-xs">Tipo de persona</Label>
              <div className="flex gap-1 rounded-md border border-input overflow-hidden text-xs">
                <button type="button"
                  onClick={() => set('personaFisica', true)}
                  className={`px-3 py-1 transition-colors ${form.personaFisica ? 'bg-accent text-white' : 'bg-card text-muted-foreground hover:bg-muted'}`}>
                  Física
                </button>
                <button type="button"
                  onClick={() => set('personaFisica', false)}
                  className={`px-3 py-1 transition-colors ${!form.personaFisica ? 'bg-accent text-white' : 'bg-card text-muted-foreground hover:bg-muted'}`}>
                  Moral
                </button>
              </div>
            </div>
          </section>

          {/* Requerimiento (campos exclusivos del prelead) */}
          <section className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Requerimiento</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Superficie <span className="text-destructive">*</span></Label>
                <input className={`${inp} ${errors.superficie ? err : ''}`}
                  value={form.superficie} onChange={e => set('superficie', e.target.value)}
                  placeholder="ej. 500 m²" />
                {errors.superficie && <p className="text-xs text-destructive">{errors.superficie}</p>}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">KVAs <span className="text-destructive">*</span></Label>
                <input className={`${inp} ${errors.KVAs ? err : ''}`}
                  value={form.KVAs} onChange={e => set('KVAs', e.target.value)}
                  placeholder="ej. 300 KVA" />
                {errors.KVAs && <p className="text-xs text-destructive">{errors.KVAs}</p>}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Ubicación preferida <span className="text-destructive">*</span></Label>
              <input className={`${inp} ${errors.ubicacion ? err : ''}`}
                value={form.ubicacion} onChange={e => set('ubicacion', e.target.value)}
                placeholder="ej. Monterrey, Nuevo León" />
              {errors.ubicacion && <p className="text-xs text-destructive">{errors.ubicacion}</p>}
            </div>
          </section>

          {/* Clasificación */}
          <section className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Clasificación</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Origen <span className="text-destructive">*</span></Label>
                <select className={`${sel} ${errors.idOrigen ? err : ''}`}
                  value={form.idOrigen} onChange={e => set('idOrigen', e.target.value)}>
                  <option value="">— Seleccionar —</option>
                  {cats.origenes.map(o => <option key={o.id} value={o.id}>{o.titulo}</option>)}
                </select>
                {errors.idOrigen && <p className="text-xs text-destructive">{errors.idOrigen}</p>}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Tipo cliente <span className="text-destructive">*</span></Label>
                <select className={`${sel} ${errors.idTipoCliente ? err : ''}`}
                  value={form.idTipoCliente} onChange={e => set('idTipoCliente', e.target.value)}>
                  <option value="">— Seleccionar —</option>
                  {cats.tiposCliente.map(t => <option key={t.id} value={t.id}>{t.titulo}</option>)}
                </select>
                {errors.idTipoCliente && <p className="text-xs text-destructive">{errors.idTipoCliente}</p>}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Tipo operación</Label>
                <select className={sel} value={form.idTipoOperacion}
                  onChange={e => set('idTipoOperacion', e.target.value)}>
                  <option value="">— Ninguno —</option>
                  {cats.tiposOperacion.map(t => <option key={t.id} value={t.id}>{t.titulo}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Tipo venta</Label>
                <select className={sel} value={form.idTipoVenta}
                  onChange={e => set('idTipoVenta', e.target.value)}>
                  <option value="">— Ninguno —</option>
                  {cats.tiposVenta.map(t => <option key={t.id} value={t.id}>{t.titulo}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* Pipeline */}
          <section className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Asignación</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Etapa inicial</Label>
                <select className={sel} value={form.idEtapa}
                  onChange={e => set('idEtapa', e.target.value)}>
                  <option value="">— Primera activa —</option>
                  {cats.etapas.map(e => <option key={e.id} value={e.id}>{e.titulo}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">RC asignado</Label>
                <select className={sel} value={form.uidRC}
                  onChange={e => set('uidRC', e.target.value)}>
                  <option value="">— Sin asignar —</option>
                  {cats.rcs.map(r => <option key={r.uid} value={r.uid}>{r.nombre}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Valor estimado ($)</Label>
                <input className={inp} type="number" min="0" step="0.01"
                  value={form.valor} onChange={e => set('valor', e.target.value)} placeholder="0.00" />
              </div>
            </div>
          </section>

          {/* Mensaje */}
          <div className="space-y-1">
            <Label className="text-xs">Necesidad / Mensaje</Label>
            <textarea rows={3} className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent resize-none"
              value={form.mensaje} onChange={e => set('mensaje', e.target.value)}
              placeholder="Describe lo que busca el prospecto..." />
          </div>

          <SheetFooter>
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? 'Registrando...' : 'Enviar a aprobación'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
