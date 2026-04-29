'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Pencil, ToggleLeft, ToggleRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export interface CatalogoItem {
  id: number
  titulo: string
  status: boolean
  bkColor?: string
  txtColor?: string
  icono?: string
}

interface CatalogoSimpleProps {
  tabla: string
  items: CatalogoItem[]
  conColores?: boolean
  conIcono?: boolean
  titulo: string
}

export function CatalogoSimple({ tabla, items: initialItems, conColores, conIcono, titulo }: CatalogoSimpleProps) {
  const router = useRouter()
  const [items, setItems] = useState(initialItems)
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<CatalogoItem | null>(null)
  const [form, setForm] = useState({ titulo: '', bkColor: '#C9963A', txtColor: '#ffffff', icono: '' })
  const [saving, setSaving] = useState(false)

  function abrirNuevo() {
    setEditando(null)
    setForm({ titulo: '', bkColor: '#C9963A', txtColor: '#ffffff', icono: '' })
    setModalOpen(true)
  }

  function abrirEditar(item: CatalogoItem) {
    setEditando(item)
    setForm({
      titulo: item.titulo,
      bkColor: item.bkColor ?? '#C9963A',
      txtColor: item.txtColor ?? '#ffffff',
      icono: item.icono ?? '',
    })
    setModalOpen(true)
  }

  async function handleGuardar() {
    if (!form.titulo.trim()) { toast.error('El título es requerido.'); return }
    setSaving(true)
    const supabase = createClient()

    const payload: Record<string, unknown> = { titulo: form.titulo.trim() }
    if (conColores) { payload.bkColor = form.bkColor; payload.txtColor = form.txtColor }
    if (conIcono)   { payload.icono = form.icono }

    if (editando) {
      const { error } = await supabase.from(tabla).update(payload).eq('id', editando.id)
      if (error) { toast.error('Error al guardar.'); setSaving(false); return }
      setItems(prev => prev.map(i => i.id === editando.id ? { ...i, ...payload } as CatalogoItem : i))
      toast.success('Registro actualizado.')
    } else {
      const { data, error } = await supabase.from(tabla).insert({ ...payload, status: true }).select().single()
      if (error) { toast.error('Error al crear.'); setSaving(false); return }
      setItems(prev => [...prev, data as CatalogoItem])
      toast.success('Registro creado.')
    }

    setSaving(false)
    setModalOpen(false)
    router.refresh()
  }

  async function toggleStatus(item: CatalogoItem) {
    const supabase = createClient()
    const { error } = await supabase.from(tabla).update({ status: !item.status }).eq('id', item.id)
    if (error) { toast.error('No se pudo cambiar el estado.'); return }
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: !i.status } : i))
    toast.success(item.status ? 'Desactivado.' : 'Activado.')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{items.length} registros</p>
        <Button size="sm" onClick={abrirNuevo}>
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Nuevo
        </Button>
      </div>

      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Nombre</th>
              {conColores && <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Color</th>}
              {conIcono && <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Ícono</th>}
              <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Estado</th>
              <th className="px-3 py-2.5 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map(item => (
              <tr key={item.id} className={cn('hover:bg-muted/20 transition-colors', !item.status && 'opacity-50')}>
                <td className="px-4 py-3 font-medium text-foreground">{item.titulo}</td>
                {conColores && (
                  <td className="px-3 py-3">
                    <span
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{ backgroundColor: item.bkColor ?? '#C9963A', color: item.txtColor ?? '#fff' }}
                    >
                      {item.titulo}
                    </span>
                  </td>
                )}
                {conIcono && (
                  <td className="px-3 py-3 text-xs text-muted-foreground">{item.icono ?? '—'}</td>
                )}
                <td className="px-3 py-3">
                  <Badge variant={item.status ? 'default' : 'outline'} className={cn('text-xs', item.status ? 'bg-[var(--stage-ganado)] text-white' : '')}>
                    {item.status ? 'Activo' : 'Inactivo'}
                  </Badge>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => abrirEditar(item)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleStatus(item)}>
                      {item.status
                        ? <ToggleRight className="w-3.5 h-3.5 text-[var(--stage-ganado)]" />
                        : <ToggleLeft className="w-3.5 h-3.5 text-muted-foreground" />
                      }
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">Sin registros aún.</div>
        )}
      </div>

      {/* Modal crear/editar */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editando ? `Editar ${titulo}` : `Nuevo ${titulo}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre</Label>
              <Input
                value={form.titulo}
                onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                placeholder="Nombre del registro"
                autoFocus
              />
            </div>

            {conColores && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Color de fondo</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.bkColor}
                      onChange={e => setForm(f => ({ ...f, bkColor: e.target.value }))}
                      className="w-8 h-8 rounded cursor-pointer border border-input"
                    />
                    <Input
                      value={form.bkColor}
                      onChange={e => setForm(f => ({ ...f, bkColor: e.target.value }))}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Color de texto</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.txtColor}
                      onChange={e => setForm(f => ({ ...f, txtColor: e.target.value }))}
                      className="w-8 h-8 rounded cursor-pointer border border-input"
                    />
                    <Input
                      value={form.txtColor}
                      onChange={e => setForm(f => ({ ...f, txtColor: e.target.value }))}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
                {/* Preview */}
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Vista previa</Label>
                  <div className="mt-1.5">
                    <span
                      className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: form.bkColor, color: form.txtColor }}
                    >
                      {form.titulo || 'Ejemplo'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {conIcono && (
              <div className="space-y-1.5">
                <Label className="text-xs">Ícono (nombre Lucide)</Label>
                <Input
                  value={form.icono}
                  onChange={e => setForm(f => ({ ...f, icono: e.target.value }))}
                  placeholder="ej: phone, email, calendar"
                />
              </div>
            )}

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
