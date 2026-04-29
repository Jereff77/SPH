'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Phone, Mail, MessageCircle, MapPin, Users, Calendar,
  UserPlus, CheckCircle, Edit, Headphones, MoreHorizontal,
  ChevronDown, ChevronUp, ArrowRight,
  FileText, FileImage, FileSpreadsheet, FileArchive, FileCode, File,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ActivityHistory, ActivityDoc } from '@/lib/types'

// ── Tarjeta de archivo ─────────────────────────────────────────
const EXT_CONFIG: Record<string, { icon: React.ElementType; bg: string; badge: string; text: string }> = {
  pdf:  { icon: FileText,        bg: '#FEE2E2', badge: '#EF4444', text: 'PDF'  },
  doc:  { icon: FileText,        bg: '#DBEAFE', badge: '#3B82F6', text: 'DOC'  },
  docx: { icon: FileText,        bg: '#DBEAFE', badge: '#3B82F6', text: 'DOC'  },
  xls:  { icon: FileSpreadsheet, bg: '#D1FAE5', badge: '#10B981', text: 'XLS'  },
  xlsx: { icon: FileSpreadsheet, bg: '#D1FAE5', badge: '#10B981', text: 'XLSX' },
  csv:  { icon: FileSpreadsheet, bg: '#D1FAE5', badge: '#10B981', text: 'CSV'  },
  ppt:  { icon: FileText,        bg: '#FFEDD5', badge: '#F97316', text: 'PPT'  },
  pptx: { icon: FileText,        bg: '#FFEDD5', badge: '#F97316', text: 'PPT'  },
  jpg:  { icon: FileImage,       bg: '#EDE9FE', badge: '#8B5CF6', text: 'IMG'  },
  jpeg: { icon: FileImage,       bg: '#EDE9FE', badge: '#8B5CF6', text: 'IMG'  },
  png:  { icon: FileImage,       bg: '#EDE9FE', badge: '#8B5CF6', text: 'PNG'  },
  gif:  { icon: FileImage,       bg: '#EDE9FE', badge: '#8B5CF6', text: 'GIF'  },
  webp: { icon: FileImage,       bg: '#EDE9FE', badge: '#8B5CF6', text: 'IMG'  },
  svg:  { icon: FileImage,       bg: '#EDE9FE', badge: '#8B5CF6', text: 'SVG'  },
  zip:  { icon: FileArchive,     bg: '#FEF3C7', badge: '#F59E0B', text: 'ZIP'  },
  rar:  { icon: FileArchive,     bg: '#FEF3C7', badge: '#F59E0B', text: 'RAR'  },
  json: { icon: FileCode,        bg: '#F0FDF4', badge: '#22C55E', text: 'JSON' },
  xml:  { icon: FileCode,        bg: '#F0FDF4', badge: '#22C55E', text: 'XML'  },
}

function getExtConfig(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return EXT_CONFIG[ext] ?? { icon: File, bg: '#F3F4F6', badge: '#6B7280', text: ext.toUpperCase() || 'FILE' }
}

function FileCard({ doc }: { doc: ActivityDoc }) {
  const cfg = getExtConfig(doc.name)
  const Icon = cfg.icon
  const nameWithoutExt = doc.name.replace(/\.[^/.]+$/, '')

  return (
    <a
      href={doc.url}
      target="_blank"
      rel="noopener noreferrer"
      title={doc.name}
      className="group flex flex-col w-[88px] rounded-lg border border-border bg-card overflow-hidden hover:border-accent/50 hover:shadow-sm transition-all"
    >
      {/* Zona del ícono */}
      <div
        className="flex flex-col items-center justify-center gap-1 pt-3 pb-2 px-2"
        style={{ backgroundColor: cfg.bg }}
      >
        <Icon className="w-7 h-7" style={{ color: cfg.badge }} />
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded"
          style={{ backgroundColor: cfg.badge, color: '#fff' }}
        >
          {cfg.text}
        </span>
      </div>
      {/* Nombre del archivo */}
      <div className="px-1.5 py-1.5 text-center">
        <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2 break-all group-hover:text-foreground transition-colors">
          {nameWithoutExt}
        </p>
      </div>
    </a>
  )
}

const typeConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  'Llamada':          { icon: Phone,         color: 'var(--act-llamada)',   label: 'Llamada' },
  'Correo':           { icon: Mail,          color: 'var(--act-correo)',    label: 'Correo' },
  'WhatsApp':         { icon: MessageCircle, color: 'var(--act-whatsapp)', label: 'WhatsApp' },
  'Reunión':          { icon: Users,         color: 'var(--act-reunion)',   label: 'Reunión' },
  'Visita':           { icon: MapPin,        color: 'var(--act-visita)',    label: 'Visita' },
  'Agendar':          { icon: Calendar,      color: 'var(--act-agendar)',   label: 'Agendado' },
  'Asignación':       { icon: UserPlus,      color: '#6B7280',              label: 'Asignación' },
  'Aprobación':       { icon: CheckCircle,   color: 'var(--stage-ganado)',  label: 'Aprobación' },
  'Actualizar Datos': { icon: Edit,          color: '#6B7280',              label: 'Actualización' },
  'Callpicker':       { icon: Headphones,    color: 'var(--act-llamada)',   label: 'Callpicker' },
  'Cambio Etapa':     { icon: ArrowRight,    color: 'var(--sph-accent)',    label: 'Cambio de etapa' },
  'Otro':             { icon: MoreHorizontal,color: '#6B7280',              label: 'Otro' },
}

function getConfig(type?: string) {
  return typeConfig[type ?? ''] ?? { icon: MoreHorizontal, color: '#6B7280', label: type ?? 'Actividad' }
}

interface ActivityNodeProps {
  activity: ActivityHistory
  isLast: boolean
}

function ActivityNode({ activity, isLast }: ActivityNodeProps) {
  const [expanded, setExpanded] = useState(false)
  const cfg = getConfig(activity.type ?? undefined)
  const Icon = cfg.icon
  const date = activity.activity_date ? new Date(activity.activity_date) : null
  const hasDetail = (activity.message?.length ?? 0) > 80 || activity.fechaAgenda

  return (
    <div className="flex gap-3">
      {/* Línea + ícono */}
      <div className="flex flex-col items-center">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 border-background"
          style={{ backgroundColor: cfg.color + '20', borderColor: cfg.color + '40' }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
        </div>
        {!isLast && <div className="w-px flex-1 bg-border mt-1 mb-1" />}
      </div>

      {/* Contenido */}
      <div className={cn('flex-1 pb-4', isLast && 'pb-0')}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-xs font-semibold text-foreground">{cfg.label}</span>
            {activity.nomRC && (
              <span className="text-xs text-muted-foreground ml-1.5">· {activity.nomRC}</span>
            )}
          </div>
          {date && (
            <span className="text-xs text-muted-foreground shrink-0">
              {format(date, "d MMM, HH:mm", { locale: es })}
            </span>
          )}
        </div>

        {activity.message && (
          <p className={cn(
            'text-xs text-muted-foreground mt-1 leading-relaxed',
            !expanded && 'line-clamp-2'
          )}>
            {activity.message}
          </p>
        )}

        {activity.fechaAgenda && (
          <div className="flex items-center gap-1 mt-1 text-xs text-accent">
            <Calendar className="w-3 h-3" />
            <span>Agenda: {format(new Date(activity.fechaAgenda), "d 'de' MMMM, HH:mm", { locale: es })}</span>
          </div>
        )}

        {activity.docs && activity.docs.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {activity.docs.map((doc, i) => (
              <FileCard key={i} doc={doc} />
            ))}
          </div>
        )}

        {hasDetail && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground mt-1 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? 'Menos' : 'Ver más'}
          </button>
        )}
      </div>
    </div>
  )
}

export function ActivityTree({ activities }: { activities: ActivityHistory[] }) {
  if (activities.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Sin actividades registradas aún.
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {activities.map((act, i) => (
        <ActivityNode
          key={act.id}
          activity={act}
          isLast={i === activities.length - 1}
        />
      ))}
    </div>
  )
}
