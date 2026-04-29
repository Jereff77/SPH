'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/lib/stores/auth.store'
import { getUserRole, getUserName } from '@/lib/supabase/get-user-role'

// Hidrata el store de Zustand con el rol del usuario si aún no está cargado.
// Se monta en el layout del CRM para que cualquier sesión preexistente también tenga su rol.
export function SessionHydrator() {
  const { user, setUser } = useAuthStore()

  useEffect(() => {
    if (user?.role) return // ya está hidratado

    async function hydrate() {
      const supabase = createClient()
      const { data: { user: sbUser } } = await supabase.auth.getUser()
      if (!sbUser) return

      const [role, nombre] = await Promise.all([
        getUserRole(supabase, sbUser.id),
        getUserName(supabase, sbUser.id),
      ])

      setUser({ uid: sbUser.id, email: sbUser.email!, nombre, role })
    }

    hydrate()
  }, [user, setUser])

  return null
}
