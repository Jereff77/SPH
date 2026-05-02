'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Columns3, Users, Calendar,
  CheckSquare, Settings, Mail, BookOpen, BarChart2,
  ChevronLeft, ChevronRight, ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { useUiStore } from '@/lib/stores/ui.store'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
}

const mainItems: NavItem[] = [
  { href: '/dashboard',  label: 'Panel',    icon: LayoutDashboard },
  { href: '/pipeline',   label: 'Pipeline', icon: Columns3 },
  { href: '/leads',      label: 'Leads',    icon: Users },
  { href: '/calendario', label: 'Agenda',   icon: Calendar },
  { href: '/aprobar',    label: 'Aprobar',  icon: CheckSquare },
  { href: '/reportes',   label: 'Reportes', icon: BarChart2 },
]

const configItems: NavItem[] = [
  { href: '/catalogos',               label: 'Catálogos', icon: BookOpen },
  { href: '/catalogos/configuracion', label: 'Correo',    icon: Mail },
]

interface SidebarProps {
  pendingCount?: number
  isAdmin?: boolean
  canConfig?: boolean
}

export function Sidebar({ pendingCount = 0, isAdmin = false, canConfig = false }: SidebarProps) {
  const pathname = usePathname()
  const { mobileSidebarOpen, closeMobileSidebar } = useUiStore()
  const [collapsed, setCollapsed] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)

  const isInConfig = pathname.startsWith('/catalogos')

  useEffect(() => {
    const saved = localStorage.getItem('sph-sidebar-collapsed')
    if (saved) setCollapsed(saved === 'true')
  }, [])

  // Cerrar sidebar mobile al cambiar de ruta
  useEffect(() => {
    closeMobileSidebar()
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isInConfig) setConfigOpen(true)
  }, [isInConfig])

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sph-sidebar-collapsed', String(next))
  }

  // En mobile siempre expandido (sin colapso), en desktop respeta el estado
  const isCollapsed = collapsed

  const navLinkClass = (active: boolean, sub = false) => cn(
    'flex items-center gap-3 px-2 py-2.5 rounded-md text-sm transition-colors w-full',
    isCollapsed ? 'md:justify-center' : '',
    sub && !isCollapsed && 'ml-3 text-xs',
    active
      ? 'bg-sidebar-accent text-accent font-medium'
      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
  )

  function NavLink({ item, sub = false }: { item: NavItem; sub?: boolean }) {
    const isActive = item.href === '/catalogos'
      ? pathname === '/catalogos'
      : pathname.startsWith(item.href)
    const hasBadge = item.href === '/aprobar' && pendingCount > 0
    const Icon = item.icon

    const inner = (
      <Link href={item.href} className={navLinkClass(isActive, sub)}>
        <div className="relative shrink-0">
          <Icon className={cn(sub ? 'w-4 h-4' : 'w-5 h-5')} />
          {hasBadge && isCollapsed && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-accent" />
          )}
        </div>
        {/* En mobile siempre visible, en desktop respeta collapsed */}
        <span className={cn('flex-1 truncate', isCollapsed && 'md:hidden')}>
          {item.label}
        </span>
        {hasBadge && !isCollapsed && (
          <Badge className="bg-accent text-accent-foreground text-xs px-1.5 py-0 h-5">
            {pendingCount > 99 ? '99+' : pendingCount}
          </Badge>
        )}
      </Link>
    )

    if (isCollapsed) {
      return (
        <Tooltip>
          <TooltipTrigger render={inner} />
          <TooltipContent side="right">
            {item.label}{hasBadge ? ` (${pendingCount})` : ''}
          </TooltipContent>
        </Tooltip>
      )
    }

    return inner
  }

  return (
    <aside className={cn(
      'flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300',
      // Mobile: drawer fijo, se desliza con transform
      'fixed inset-y-0 left-0 z-50',
      mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full',
      // Desktop: relativo, siempre visible
      'md:relative md:z-auto md:translate-x-0',
      // Ancho: fijo en mobile, variable en desktop
      'w-64',
      isCollapsed && 'md:w-16',
    )}>
      {/* Logo */}
      <div className={cn(
        'flex items-center h-20 px-3 border-b border-sidebar-border shrink-0',
        isCollapsed ? 'md:justify-center' : 'gap-2'
      )}>
        {isCollapsed ? (
          <>
            <img src="/brand/logo.png" alt="SPH" className="hidden md:block h-8 w-8 object-contain" />
            <img src="/brand/logo.png" alt="SPH Bienes Raíces" style={{ width: '220px' }} className="md:hidden h-auto object-contain" />
          </>
        ) : (
          <img
            src="/brand/logo.png"
            alt="SPH Bienes Raíces"
            style={{ width: '220px' }}
            className="h-auto object-contain"
          />
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {mainItems.map(item => (
          <NavLink key={item.href} item={item} />
        ))}

        {canConfig && (
          <div className="pt-1">
            {isCollapsed ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      onClick={() => setConfigOpen(o => !o)}
                      className={cn(navLinkClass(isInConfig), 'w-full md:justify-center')}
                    >
                      <Settings className="w-5 h-5 shrink-0" />
                      <span className="flex-1 truncate md:hidden">Configuraciones</span>
                    </button>
                  }
                />
                <TooltipContent side="right">Configuraciones</TooltipContent>
              </Tooltip>
            ) : (
              <>
                <button
                  onClick={() => setConfigOpen(o => !o)}
                  className={cn(
                    'flex items-center gap-3 w-full px-2 py-2.5 rounded-md text-sm transition-colors',
                    isInConfig
                      ? 'text-accent font-medium'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                  )}
                >
                  <Settings className="w-5 h-5 shrink-0" />
                  <span className="flex-1 truncate text-left">Configuraciones</span>
                  <ChevronDown className={cn(
                    'w-3.5 h-3.5 shrink-0 transition-transform duration-200',
                    configOpen && 'rotate-180'
                  )} />
                </button>
                {configOpen && (
                  <div className="space-y-0.5 mt-0.5">
                    {configItems.map(item => (
                      <NavLink key={item.href} item={item} sub />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </nav>

      {/* Toggle collapse — solo en desktop */}
      <button
        onClick={toggleCollapsed}
        className="hidden md:flex absolute -right-3 top-16 items-center justify-center w-6 h-6 rounded-full bg-sidebar-border border border-sidebar-border text-sidebar-foreground hover:bg-accent hover:text-accent-foreground transition-colors z-10"
      >
        {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </aside>
  )
}
