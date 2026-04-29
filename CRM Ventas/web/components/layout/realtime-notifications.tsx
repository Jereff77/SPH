'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/lib/stores/auth.store'
import { useRouter } from 'next/navigation'

export function RealtimeNotifications() {
  const { user } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!user) return
    const supabase = createClient()

    // Canal de notificaciones CRM
    const channel = supabase
      .channel('crm_notifications')
      .on('broadcast', { event: 'lead_asignado' }, ({ payload }) => {
        if (payload?.uidRC === user.uid) {
          toast.info(`Nuevo lead asignado: ${payload?.nombreLead ?? 'Lead'}`, {
            action: payload?.leadId
              ? { label: 'Ver', onClick: () => router.push(`/leads/${payload.leadId}`) }
              : undefined,
          })
        }
      })
      .on('broadcast', { event: 'lead_por_aprobar' }, () => {
        if (user.role === 'admin') {
          toast.warning('Nuevo lead pendiente de aprobación', {
            action: { label: 'Revisar', onClick: () => router.push('/aprobar') },
          })
          router.refresh() // refresca badge del sidebar
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, router])

  return null
}
