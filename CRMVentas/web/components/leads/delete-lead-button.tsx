'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'

interface DeleteLeadButtonProps {
  leadId: string
  leadNombre: string
}

export function DeleteLeadButton({ leadId, leadNombre }: DeleteLeadButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)

  async function handleDelete() {
    setIsPending(true)
    const supabase = createClient()
    const { data, error } = await supabase.rpc('leads_eliminar_lead', { p_id_lead: leadId })

    if (error || data?.success === false) {
      toast.error(data?.message ?? 'No se pudo eliminar el lead.')
      setIsPending(false)
      return
    }

    toast.success('Lead eliminado correctamente.')
    router.push('/pipeline')
  }

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="w-4 h-4 mr-1.5" />
        Eliminar lead
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>¿Eliminar lead permanentemente?</DialogTitle>
            <DialogDescription>
              Esta acción eliminará a <strong className="text-foreground">{leadNombre}</strong> junto
              con todo su historial de actividades y etapas. Esta operación no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" disabled={isPending} />}>
              Cancelar
            </DialogClose>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={handleDelete}
            >
              {isPending ? 'Eliminando...' : 'Sí, eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
