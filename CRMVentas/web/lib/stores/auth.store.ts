import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthUser, UserRole } from '@/lib/types'

interface AuthStore {
  user: AuthUser | null
  setUser: (user: AuthUser | null) => void
  isRole: (role: UserRole) => boolean
  isAdmin: () => boolean
  isGerente: () => boolean
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      setUser: (user) => set({ user }),
      isRole: (role) => get().user?.role === role,
      isAdmin: () => get().user?.role === 'admin',
      isGerente: () => get().user?.role === 'gerente' || get().user?.role === 'admin',
    }),
    { name: 'sph-auth' }
  )
)
