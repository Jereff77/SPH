'use client'

import { useRef, useState, useCallback } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import esLocale from '@fullcalendar/core/locales/es'
import type { EventClickArg } from '@fullcalendar/core'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Phone, ExternalLink, Calendar } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { CalendarEventRaw } from '@/lib/queries/calendario'

interface SelectedEvent {
  event: CalendarEventRaw
  date: Date
}

interface CalendarViewProps {
  events: CalendarEventRaw[]
  rcs: { uid: string; nombre: string }[]
  currentUidRC: string
}

export function CalendarView({ events, rcs, currentUidRC }: CalendarViewProps) {
  const calendarRef = useRef<FullCalendar>(null)
  const [selectedEvent, setSelectedEvent] = useState<SelectedEvent | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const fcEvents = events.map(e => ({
    id: e.id,
    title: e.leadNombre,
    start: e.start,
    backgroundColor: e.color,
    borderColor: e.color,
    textColor: '#fff',
    extendedProps: e,
  }))

  function handleEventClick(info: EventClickArg) {
    const raw = info.event.extendedProps as CalendarEventRaw
    setSelectedEvent({ event: raw, date: info.event.start ?? new Date() })
    setSheetOpen(true)
  }

  return (
    <>
      <div className="rounded-xl border bg-card p-4 fullcalendar-sph">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale={esLocale}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          events={fcEvents}
          eventClick={handleEventClick}
          height="calc(100vh - 220px)"
          eventContent={renderEventContent}
        />
      </div>

      <Sheet open={sheetOpen} onOpenChange={v => !v && setSheetOpen(false)}>
        <SheetContent className="w-80 sm:w-96">
          {selectedEvent && (
            <>
              <SheetHeader className="pb-4 border-b">
                <SheetTitle className="text-base">{selectedEvent.event.leadNombre}</SheetTitle>
                <Badge
                  variant="outline"
                  className="w-fit text-xs"
                  style={{
                    backgroundColor: selectedEvent.event.color + '20',
                    color: selectedEvent.event.color,
                    borderColor: selectedEvent.event.color + '50',
                  }}
                >
                  {selectedEvent.event.type}
                </Badge>
              </SheetHeader>

              <div className="py-4 space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>{format(selectedEvent.date, "EEEE d 'de' MMMM, HH:mm", { locale: es })}</span>
                </div>

                {selectedEvent.event.rcName && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">RC: </span>
                    <span className="font-medium">{selectedEvent.event.rcName}</span>
                  </div>
                )}

                <div className="flex flex-col gap-2 pt-2 border-t">
                  <Link href={`/leads/${selectedEvent.event.leadId}`} onClick={() => setSheetOpen(false)}>
                    <Button size="sm" className="w-full justify-start">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Ver detalle del lead
                    </Button>
                  </Link>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}

function renderEventContent(info: { event: { title: string; extendedProps: CalendarEventRaw } }) {
  return (
    <div className="px-1 py-0.5 overflow-hidden">
      <p className="text-xs font-medium truncate leading-tight">{info.event.title}</p>
      <p className="text-xs opacity-80 truncate">{info.event.extendedProps.type}</p>
    </div>
  )
}
