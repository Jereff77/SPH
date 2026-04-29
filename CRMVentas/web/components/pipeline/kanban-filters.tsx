'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface RC { uidRC: string; nomRC: string }

interface KanbanFiltersProps {
  rcs: RC[]
  selectedRC: string
  selectedTipo: string
}

const TIPOS = ['Renta', 'Venta', 'Compra', 'Permuta']

export function KanbanFilters({ rcs, selectedRC, selectedTipo }: KanbanFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const setParam = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.replace(`${pathname}?${params.toString()}`)
  }, [router, pathname, searchParams])

  const hasFilters = selectedRC || selectedTipo

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Filtro RC */}
      <select
        value={selectedRC}
        onChange={e => setParam('rc', e.target.value)}
        className="h-8 rounded-md border border-input bg-card px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
      >
        <option value="">Todos los asesores</option>
        {rcs.map(rc => (
          <option key={rc.uidRC} value={rc.uidRC}>{rc.nomRC}</option>
        ))}
      </select>

      {/* Filtro tipo operación */}
      <select
        value={selectedTipo}
        onChange={e => setParam('tipo', e.target.value)}
        className="h-8 rounded-md border border-input bg-card px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
      >
        <option value="">Todos los tipos</option>
        {TIPOS.map(t => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>

      {/* Limpiar */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-muted-foreground"
          onClick={() => { setParam('rc', ''); setParam('tipo', '') }}
        >
          <X className="w-3.5 h-3.5 mr-1" />
          Limpiar
        </Button>
      )}
    </div>
  )
}
