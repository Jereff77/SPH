'use client'

import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useState, useTransition } from 'react'
import { Phone, MessageCircle, ExternalLink, AlertCircle, ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import type { LeadRow } from '@/lib/queries/leads'

const heatColor: Record<number, string> = {
  1: 'bg-[var(--heat-frio)]/10 text-[var(--heat-frio)] border-[var(--heat-frio)]/30',
  2: 'bg-[var(--heat-tibio)]/10 text-[var(--heat-tibio)] border-[var(--heat-tibio)]/30',
  3: 'bg-[var(--heat-caliente)]/10 text-[var(--heat-caliente)] border-[var(--heat-caliente)]/30',
}
const heatLabel: Record<number, string> = { 1: 'Frío', 2: 'Tibio', 3: 'Caliente' }

interface FilterOption { value: string; label: string }
interface FiltersState {
  etapas: { id: number; titulo: string }[]
  origenes: string[]
  rcs: { uidRC: string; nomRC: string }[]
}

interface LeadsTableProps {
  leads: LeadRow[]
  total: number
  page: number
  pageSize: number
  search: string
  filterOptions: FiltersState
  selectedEtapa: string
  selectedRC: string
  selectedOrigen: string
}

export function LeadsTable({
  leads, total, page, pageSize, search,
  filterOptions, selectedEtapa, selectedRC, selectedOrigen,
}: LeadsTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [localSearch, setLocalSearch] = useState(search)

  const setParam = useCallback((updates: Record<string, string>) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      Object.entries(updates).forEach(([k, v]) => {
        if (v) params.set(k, v)
        else params.delete(k)
      })
      params.delete('page')
      router.replace(`${pathname}?${params.toString()}`)
    })
  }, [router, pathname, searchParams])

  const totalPages = Math.ceil(total / pageSize)
  const hasFilters = selectedEtapa || selectedRC || selectedOrigen || search

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    setParam({ search: localSearch })
  }

  function formatValor(v: number) {
    if (v === 0) return '—'
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
    return `$${(v / 1_000).toFixed(0)}K`
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Barra de búsqueda y filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={handleSearchSubmit} className="flex gap-1.5">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar nombre, teléfono, correo..."
              value={localSearch}
              onChange={e => setLocalSearch(e.target.value)}
              className="pl-8 h-8 w-64 text-sm"
            />
          </div>
          <Button type="submit" size="sm" className="h-8">Buscar</Button>
        </form>

        <Select label="Etapa" value={selectedEtapa} onChange={v => setParam({ etapa: v })}
          options={filterOptions.etapas.map(e => ({ value: String(e.id), label: e.titulo }))} />

        <Select label="Asesor" value={selectedRC} onChange={v => setParam({ rc: v })}
          options={filterOptions.rcs.map(r => ({ value: r.uidRC, label: r.nomRC }))} />

        <Select label="Origen" value={selectedOrigen} onChange={v => setParam({ origen: v })}
          options={filterOptions.origenes.map(o => ({ value: o, label: o }))} />

        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground"
            onClick={() => { setLocalSearch(''); setParam({ search: '', etapa: '', rc: '', origen: '' }) }}>
            <X className="w-3.5 h-3.5 mr-1" /> Limpiar
          </Button>
        )}

        <span className="ml-auto text-xs text-muted-foreground">
          {total.toLocaleString('es-MX')} leads
        </span>
      </div>

      {/* Tabla */}
      <div className={cn('rounded-xl border overflow-hidden', isPending && 'opacity-60')}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Lead</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Etapa</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs hidden md:table-cell">RC</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs hidden lg:table-cell">Origen</th>
                <th className="text-right px-3 py-2.5 font-medium text-muted-foreground text-xs">Valor</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs hidden xl:table-cell">Última act.</th>
                <th className="text-center px-3 py-2.5 font-medium text-muted-foreground text-xs">Calor</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {leads.map(lead => (
                <tr key={lead.id} className="hover:bg-muted/30 transition-colors group">
                  {/* Nombre + teléfono */}
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      {lead.diasSinActividad >= 7 && (
                        <AlertCircle className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />
                      )}
                      <div>
                        <Link href={`/leads/${lead.id}`}
                          className="font-medium text-foreground hover:text-accent transition-colors line-clamp-1">
                          {lead.nombreLead}
                        </Link>
                        {lead.telefono && (
                          <p className="text-xs text-muted-foreground">{lead.telefono}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  {/* Etapa */}
                  <td className="px-3 py-3">
                    <span className="text-xs text-foreground">{lead.Etapa}</span>
                  </td>
                  {/* RC */}
                  <td className="px-3 py-3 hidden md:table-cell">
                    <span className="text-xs text-muted-foreground truncate max-w-32 block">{lead.nomRC}</span>
                  </td>
                  {/* Origen */}
                  <td className="px-3 py-3 hidden lg:table-cell">
                    <span className="text-xs text-muted-foreground">{lead.Origen}</span>
                  </td>
                  {/* Valor */}
                  <td className="px-3 py-3 text-right">
                    <span className={cn('text-xs font-medium', lead.valor > 0 && 'text-accent')}>
                      {formatValor(lead.valor)}
                    </span>
                  </td>
                  {/* Última actividad */}
                  <td className="px-3 py-3 hidden xl:table-cell">
                    <span className="text-xs text-muted-foreground">
                      {lead.ultimaActividad
                        ? formatDistanceToNow(new Date(lead.ultimaActividad), { addSuffix: true, locale: es })
                        : 'Sin actividad'}
                    </span>
                  </td>
                  {/* Calor */}
                  <td className="px-3 py-3 text-center">
                    <Badge variant="outline" className={cn('text-xs', heatColor[lead.heatLevel])}>
                      {heatLabel[lead.heatLevel]}
                    </Badge>
                  </td>
                  {/* Acciones */}
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {lead.telefono && (
                        <a href={`tel:${lead.telefono}`} title="Llamar">
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Phone className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                      )}
                      {lead.telefono && (
                        <a href={`https://wa.me/52${lead.telefono.replace(/\D/g, '')}`}
                          target="_blank" rel="noreferrer" title="WhatsApp">
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MessageCircle className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                      )}
                      <Link href={`/leads/${lead.id}`} title="Ver detalle">
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {leads.length === 0 && (
            <div className="py-16 text-center text-muted-foreground text-sm">
              No se encontraron leads con los filtros aplicados.
            </div>
          )}
        </div>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Pág. {page} de {totalPages} — {total.toLocaleString('es-MX')} resultados
          </p>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="h-8"
              disabled={page <= 1}
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString())
                params.set('page', String(page - 1))
                router.replace(`${pathname}?${params.toString()}`)
              }}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8"
              disabled={page >= totalPages}
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString())
                params.set('page', String(page + 1))
                router.replace(`${pathname}?${params.toString()}`)
              }}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// Componente select reutilizable interno
function Select({ label, value, onChange, options }: {
  label: string; value: string
  onChange: (v: string) => void; options: FilterOption[]
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="h-8 rounded-md border border-input bg-card px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
    >
      <option value="">{label}: Todos</option>
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}
