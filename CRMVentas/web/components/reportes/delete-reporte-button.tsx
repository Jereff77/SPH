'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog'

interface Props {
  idReporte: string
  nombre: string
}

export function DeleteReporteButton({ idReporte, nombre }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from('crm_reportes').delete().eq('id', idReporte)
    if (error) {
      toast.error('No se pudo eliminar el dashboard.')
      setDeleting(false)
      return
    }
    toast.success('Dashboard eliminado.')
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(true) }}
        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        title="Eliminar dashboard"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>¿Eliminar dashboard?</DialogTitle>
            <DialogDescription>
              Se eliminará <strong className="text-foreground">"{nombre}"</strong> y todos
              sus widgets de forma permanente. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" disabled={deleting} />}>
              Cancelar
            </DialogClose>
            <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
              {deleting ? 'Eliminando...' : 'Sí, eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
