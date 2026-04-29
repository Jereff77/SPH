'use client'

import { useEffect, useState, useTransition } from 'react'
import { Pencil, Trash2, ChevronUp, ChevronDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CrmWidget, WidgetData, ActiveFilters } from '@/lib/queries/reportes-types'
import { fetchWidgetData } from '@/app/actions/reportes'
import { WidgetRenderer } from './widget-renderer'
import { WidgetConfigurator } from './widget-configurator'

const ANCHO_CLASS: Record<string, string> = {
  full:  'col-span-1 sm:col-span-2 xl:col-span-3',
  half:  'col-span-1',
  third: 'col-span-1',
}

interface Props {
  widget: CrmWidget
  globalFilters: ActiveFilters
  editMode: boolean
  isFirst: boolean
  isLast: boolean
  idReporte: string
  onDelete: (id: string) => void
  onMove: (id: string, dir: 'up' | 'down') => void
  onSaved: () => void
}

export function WidgetCard({
  widget, globalFilters, editMode,
  isFirst, isLast, idReporte,
  onDelete, onMove, onSaved,
}: Props) {
  const [data, setData] = useState<WidgetData>({ labels: [], values: [] })
  const [loading, startTransition] = useTransition()

  useEffect(() => {
    startTransition(async () => {
      const result = await fetchWidgetData(widget.metrica, widget.config, globalFilters)
      setData(result)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    widget.id,
    widget.metrica,
    JSON.stringify(widget.config),
    JSON.stringify(globalFilters),
  ])

  return (
    <div className={cn(
      'rounded-xl border bg-card p-4 flex flex-col gap-2 transition-opacity',
      ANCHO_CLASS[widget.ancho] ?? ANCHO_CLASS.half,
      loading && 'opacity-60',
    )}>
      {/* Cabecera */}
      <div className="flex items-center justify-between gap-2 min-h-[24px]">
        <p className="text-xs font-semibold text-foreground truncate">{widget.titulo}</p>
        <div className="flex items-center gap-1 shrink-0">
          {loading && <Loader2 className="w-3 h-3 text-muted-foreground animate-spin" />}
          {editMode && (
            <>
              <button onClick={() => onMove(widget.id, 'up')} disabled={isFirst}
                className="p-0.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-30">
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => onMove(widget.id, 'down')} disabled={isLast}
                className="p-0.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-30">
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              <WidgetConfigurator
                idReporte={idReporte}
                widget={widget}
                onSaved={onSaved}
                trigger={
                  <button className="p-0.5 rounded text-muted-foreground hover:text-foreground">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                }
              />
              <button onClick={() => onDelete(widget.id)}
                className="p-0.5 rounded text-muted-foreground hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Gráfica */}
      <div className="flex-1">
        <WidgetRenderer widget={widget} data={data} />
      </div>
    </div>
  )
}
