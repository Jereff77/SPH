'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { BarChart2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/lib/stores/auth.store'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet'

export function NuevoDashboardSheet() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [esPublico, setEsPublico] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim() || !user) return
    setSaving(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('crm_reportes')
      .insert({ nombre: nombre.trim(), descripcion: descripcion || null, es_publico: esPublico, uid_creador: user.uid })
      .select('id')
      .single()

    if (error || !data) {
      toast.error('No se pudo crear el dashboard.')
      setSaving(false)
      return
    }

    toast.success('Dashboard creado.')
    router.push(`/reportes/${data.id}`)
  }

  const inp = 'w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent'

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <BarChart2 className="w-4 h-4 mr-1.5" />
        Nuevo dashboard
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Nuevo dashboard</SheetTitle>
            <SheetDescription>Crea un dashboard personalizado con los widgets que necesites.</SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 pb-4">
            <div className="space-y-1">
              <Label className="text-xs">Nombre <span className="text-destructive">*</span></Label>
              <input
                className={inp}
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="ej. Reporte semanal de pipeline"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Descripción (opcional)</Label>
              <textarea
                className={`${inp} resize-none`}
                rows={2}
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                placeholder="Para qué sirve este dashboard..."
              />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Label className="text-xs">Visibilidad</Label>
              <div className="flex gap-1 rounded-md border border-input overflow-hidden text-xs">
                <button type="button"
                  onClick={() => setEsPublico(false)}
                  className={`px-3 py-1.5 transition-colors ${!esPublico ? 'bg-accent text-white' : 'bg-card text-muted-foreground hover:bg-muted'}`}>
                  Privado
                </button>
                <button type="button"
                  onClick={() => setEsPublico(true)}
                  className={`px-3 py-1.5 transition-colors ${esPublico ? 'bg-accent text-white' : 'bg-card text-muted-foreground hover:bg-muted'}`}>
                  Público
                </button>
              </div>
              <span className="text-xs text-muted-foreground">
                {esPublico ? 'Todos pueden verlo' : 'Solo tú puedes verlo'}
              </span>
            </div>

            <SheetFooter className="pt-2">
              <Button type="submit" disabled={saving || !nombre.trim()} className="w-full">
                {saving ? 'Creando...' : 'Crear dashboard'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  )
}
