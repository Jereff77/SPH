'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/lib/stores/auth.store'
import { cn } from '@/lib/utils'
import type { CrmEtapa } from '@/lib/types'

interface EtapaProgressProps {
  etapas: CrmEtapa[]
  currentId: number
  leadId: string
}

export function EtapaProgress({ etapas, currentId, leadId }: EtapaProgressProps) {
  const { user } = useAuthStore()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const pipeline = etapas.slice().sort((a, b) => a.orden - b.orden)
  const currentIdx = pipeline.findIndex(e => e.id === currentId)

  async function moveToEtapa(etapa: CrmEtapa) {
    if (!user || etapa.id === currentId || isPending) return

    const supabase = createClient()
    const { error } = await supabase.rpc('crm_leads_cambiar_etapa', {
      p_idlead: leadId,
      p_id_etapa_nueva: etapa.id,
      p_uidr: user.uid,
    })

    if (error) { toast.error('No se pudo cambiar la etapa.'); return }

    toast.success(`Etapa actualizada: ${etapa.titulo}`)
    startTransition(() => router.refresh())
  }

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {pipeline.map((etapa, idx) => {
        const isActive = etapa.id === currentId
        const isDone = idx < currentIdx
        return (
          <button
            key={etapa.id}
            onClick={() => moveToEtapa(etapa)}
            disabled={isPending}
            title={etapa.titulo}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap shrink-0',
              isActive
                ? 'text-white shadow-sm'
                : isDone
                  ? 'bg-muted text-muted-foreground hover:opacity-80'
                  : 'bg-muted/40 text-muted-foreground hover:bg-muted',
              isPending && 'opacity-50 cursor-not-allowed'
            )}
            style={isActive ? { backgroundColor: etapa.bkColor } : undefined}
          >
            {isDone && <span className="text-green-500">✓</span>}
            {etapa.titulo}
          </button>
        )
      })}
    </div>
  )
}
