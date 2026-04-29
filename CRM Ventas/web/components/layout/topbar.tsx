'use client'

import { useRouter } from 'next/navigation'
import { LogOut, Menu } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuthStore } from '@/lib/stores/auth.store'
import { useUiStore } from '@/lib/stores/ui.store'
import { createClient } from '@/lib/supabase/client'

const roleLabel: Record<string, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  rc: 'Responsable Comercial',
}

interface TopbarProps {
  title?: string
}

export function Topbar({ title }: TopbarProps) {
  const router = useRouter()
  const { user, setUser } = useAuthStore()
  const { toggleMobileSidebar } = useUiStore()

  const initials = user?.nombre
    ? user.nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U'

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
    router.push('/login')
  }

  return (
    <header className="flex items-center justify-between h-14 px-6 bg-card border-b border-border shrink-0">
      <div className="flex items-center gap-2">
        {/* Hamburger — solo en mobile */}
        <button
          onClick={toggleMobileSidebar}
          className="md:hidden p-1.5 rounded-md text-foreground hover:bg-muted transition-colors"
          aria-label="Abrir menú"
        >
          <Menu className="w-5 h-5" />
        </button>
        {title && (
          <h1 className="text-sm font-semibold text-foreground">{title}</h1>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted transition-colors outline-none">
          <Avatar className="w-7 h-7">
            <AvatarFallback className="text-xs bg-accent text-accent-foreground font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="text-left hidden sm:block">
            <p className="text-sm font-medium text-foreground leading-tight">{user?.nombre ?? 'Usuario'}</p>
            <p className="text-xs text-muted-foreground leading-tight">{roleLabel[user?.role ?? 'rc']}</p>
          </div>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-52">
          {/* Info del usuario — div simple para evitar MenuGroupLabel context */}
          <div className="px-2 py-2 border-b border-border mb-1">
            <p className="text-sm font-medium text-foreground truncate">{user?.nombre}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{roleLabel[user?.role ?? 'rc']}</p>
          </div>
          <DropdownMenuItem onClick={handleSignOut} variant="destructive">
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
