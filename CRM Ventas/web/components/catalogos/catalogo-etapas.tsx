'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Pencil, ToggleLeft, ToggleRight, GripVertical } from 'lucide-react'
import {
  DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface Etapa {
  id: number
  titulo: string
  bkColor: string
  txtColor: string
  orden: number
  status: boolean
}

interface EtapaRowProps {
  etapa: Etapa
  onEdit: (e: Etapa) => void
  onToggle: (e: Etapa) => void
}

function EtapaRow({ etapa, onEdit, onToggle }: EtapaRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: etapa.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn('hover:bg-muted/20 transition-colors', !etapa.status && 'opacity-50')}
    >
      <td className="px-3 py-3 w-8">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
          <GripVertical className="w-4 h-4" />
        </button>
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground w-10">{etapa.orden}</td>
      <td className="px-3 py-3 font-medium text-foreground">{etapa.titulo}</td>
      <td className="px-3 py-3">
        <span
          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
          style={{ backgroundColor: etapa.bkColor, color: etapa.txtColor }}
        >
          {etapa.titulo}
        </span>
      </td>
      <td className="px-3 py-3">
        <Badge variant={etapa.status ? 'default' : 'outline'} className={cn('text-xs', etapa.status ? 'bg-[var(--stage-ganado)] text-white' : '')}>
          {etapa.status ? 'Activa' : 'Inactiva'}
        </Badge>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(etapa)}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onToggle(etapa)}>
            {etapa.status
              ? <ToggleRight className="w-3.5 h-3.5 text-[var(--stage-ganado)]" />
              : <ToggleLeft className="w-3.5 h-3.5 text-muted-foreground" />
            }
          </Button>
        </div>
      </td>
    </tr>
  )
}

export function CatalogoEtapas({ items: initialItems }: { items: Etapa[] }) {
  const router = useRouter()
  const [etapas, setEtapas] = useState([...initialItems].sort((a, b) => a.orden - b.orden))
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<Etapa | null>(null)
  const [form, setForm] = useState({ titulo: '', bkColor: '#43A047', txtColor: '#ffffff' })
  const [saving, setSaving] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIdx = etapas.findIndex(e => e.id === active.id)
    const newIdx = etapas.findIndex(e => e.id === over.id)
    const reordenadas = arrayMove(etapas, oldIdx, newIdx).map((e, i) => ({ ...e, orden: i }))
    setEtapas(reordenadas)

    // Guardar nuevo orden en BD
    const supabase = createClient()
    await Promise.all(
      reordenadas.map(e => supabase.from('crm_Etapas').update({ orden: e.orden }).eq('id', e.id))
    )
    toast.success('Orden actualizado.')
    router.refresh()
  }

  function abrirNuevo() {
    setEditando(null)
    setForm({ titulo: '', bkColor: '#43A047', txtColor: '#ffffff' })
    setModalOpen(true)
  }

  function abrirEditar(etapa: Etapa) {
    setEditando(etapa)
    setForm({ titulo: etapa.titulo, bkColor: etapa.bkColor, txtColor: etapa.txtColor })
    setModalOpen(true)
  }

  async function handleGuardar() {
    if (!form.titulo.trim()) { toast.error('El título es requerido.'); return }
    setSaving(true)
    const supabase = createClient()
    const payload = { titulo: form.titulo.trim(), bkColor: form.bkColor, txtColor: form.txtColor }

    if (editando) {
      const { error } = await supabase.from('crm_Etapas').update(payload).eq('id', editando.id)
      if (error) { toast.error('Error al guardar.'); setSaving(false); return }
      setEtapas(prev => prev.map(e => e.id === editando.id ? { ...e, ...payload } : e))
      toast.success('Etapa actualizada.')
    } else {
      const nuevoOrden = etapas.length
      const { data, error } = await supabase
        .from('crm_Etapas')
        .insert({ ...payload, orden: nuevoOrden, status: true })
        .select()
        .single()
      if (error) { toast.error('Error al crear.'); setSaving(false); return }
      setEtapas(prev => [...prev, data as Etapa])
      toast.success('Etapa creada.')
    }

    setSaving(false)
    setModalOpen(false)
    router.refresh()
  }

  async function toggleStatus(etapa: Etapa) {
    const supabase = createClient()
    const { error } = await supabase.from('crm_Etapas').update({ status: !etapa.status }).eq('id', etapa.id)
    if (error) { toast.error('No se pudo cambiar el estado.'); return }
    setEtapas(prev => prev.map(e => e.id === etapa.id ? { ...e, status: !e.status } : e))
    toast.success(etapa.status ? 'Etapa desactivada.' : 'Etapa activada.')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{etapas.length} etapas · Arrastra para reordenar</p>
        <Button size="sm" onClick={abrirNuevo}>
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Nueva etapa
        </Button>
      </div>

      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-3 py-2.5 w-8"></th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground w-10">#</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Nombre</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Vista previa</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Estado</th>
              <th className="px-3 py-2.5 w-20"></th>
            </tr>
          </thead>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={etapas.map(e => e.id)} strategy={verticalListSortingStrategy}>
              <tbody className="divide-y divide-border">
                {etapas.map(etapa => (
                  <EtapaRow key={etapa.id} etapa={etapa} onEdit={abrirEditar} onToggle={toggleStatus} />
                ))}
              </tbody>
            </SortableContext>
          </DndContext>
        </table>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar etapa' : 'Nueva etapa'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre de la etapa</Label>
              <Input
                value={form.titulo}
                onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                placeholder="Ej: Negociación"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Color de fondo</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.bkColor} onChange={e => setForm(f => ({ ...f, bkColor: e.target.value }))}
                    className="w-8 h-8 rounded cursor-pointer border border-input" />
                  <Input value={form.bkColor} onChange={e => setForm(f => ({ ...f, bkColor: e.target.value }))} className="font-mono text-xs" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Color de texto</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.txtColor} onChange={e => setForm(f => ({ ...f, txtColor: e.target.value }))}
                    className="w-8 h-8 rounded cursor-pointer border border-input" />
                  <Input value={form.txtColor} onChange={e => setForm(f => ({ ...f, txtColor: e.target.value }))} className="font-mono text-xs" />
                </div>
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Vista previa</Label>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: form.bkColor, color: form.txtColor }}>
                    {form.titulo || 'Ejemplo de etapa'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button className="flex-1" onClick={handleGuardar} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </Button>
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
