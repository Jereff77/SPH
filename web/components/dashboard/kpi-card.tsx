import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface KpiCardProps {
  title: string
  value: string
  subtitle?: string
  icon: LucideIcon
  accent?: boolean
  alert?: boolean
}

export function KpiCard({ title, value, subtitle, icon: Icon, accent, alert }: KpiCardProps) {
  return (
    <div className={cn(
      'relative rounded-xl border bg-card p-5 flex items-start gap-4 overflow-hidden',
      accent && 'border-accent/40',
      alert && 'border-destructive/40'
    )}>
      <div className={cn(
        'flex items-center justify-center w-10 h-10 rounded-lg shrink-0',
        accent ? 'bg-accent/10 text-accent' : alert ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
      )}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-bold text-foreground mt-0.5 truncate">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {accent && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
      )}
    </div>
  )
}
