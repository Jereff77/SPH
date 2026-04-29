'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Paperclip, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/lib/stores/auth.store'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { ActivityDoc } from '@/lib/types'

const TIPOS = [
  'Llamada', 'Correo', 'WhatsApp', 'Reunión',
  'Visita', 'Agendar', 'Otro',
]

interface ActivityFormProps {
  leadId: string
}

export function ActivityForm({ leadId }: ActivityFormProps) {
  const router = useRouter()
  const { user } = useAuthStore()
  const [isPending, startTransition] = useTransition()
  const [uploading, setUploading] = useState(false)
  const [tipo, setTipo] = useState('Llamada')
  const [nota, setNota] = useState('')
  const [fechaAgenda, setFechaAgenda] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
    setFiles(prev => [...prev, ...selected])
    // reset input para permitir agregar el mismo archivo de nuevo
    e.target.value = ''
  }

  function removeFile(index: number) {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return

    const supabase = createClient()
    setUploading(true)

    // Subir archivos al bucket privado crmDocs/{leadId}/
    const docs: ActivityDoc[] = []
    for (const file of files) {
      const path = `${leadId}/${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('crmDocs')
        .upload(path, file)

      if (uploadError) {
        toast.error(`No se pudo subir "${file.name}".`)
        setUploading(false)
        return
      }
      docs.push({ name: file.name, path })
    }

    setUploading(false)

    const { error } = await supabase.from('activity_history').insert({
      lead_id: leadId,
      type: tipo,
      message: nota || null,
      activity_date: new Date().toISOString(),
      fechaAgenda: fechaAgenda ? new Date(fechaAgenda).toISOString() : null,
      uidr: user.uid,
      docs: docs.length > 0 ? docs : null,
    })

    if (error) {
      toast.error('No se pudo guardar la actividad.')
      return
    }

    toast.success('Actividad registrada.')
    setNota('')
    setFechaAgenda('')
    setFiles([])
    startTransition(() => router.refresh())
  }

  const isBusy = isPending || uploading

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 rounded-xl border bg-muted/20">
      <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Nueva actividad</p>

      <div className="flex flex-col sm:flex-row gap-2">
        {/* Tipo */}
        <div className="w-full sm:flex-1 space-y-1">
          <Label className="text-xs">Tipo</Label>
          <select
            value={tipo}
            onChange={e => setTipo(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-card px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Fecha agenda (opcional) */}
        <div className="w-full sm:min-w-44 space-y-1">
          <Label className="text-xs">Fecha agenda (opcional)</Label>
          <input
            type="datetime-local"
            value={fechaAgenda}
            onChange={e => setFechaAgenda(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-card px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </div>

      {/* Nota */}
      <div className="space-y-1">
        <Label className="text-xs">Nota</Label>
        <textarea
          value={nota}
          onChange={e => setNota(e.target.value)}
          placeholder="Describe la actividad..."
          rows={2}
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent resize-none"
        />
      </div>

      {/* Adjuntos */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Label className="text-xs">Documentos (opcional)</Label>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 text-xs text-accent hover:underline"
          >
            <Paperclip className="w-3 h-3" />
            Adjuntar
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFilesChange}
          />
        </div>

        {files.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {files.map((file, i) => (
              <span
                key={i}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs text-foreground"
              >
                <Paperclip className="w-3 h-3 text-muted-foreground" />
                {file.name}
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="text-muted-foreground hover:text-destructive ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <Button type="submit" size="sm" disabled={isBusy} className="w-full sm:w-auto">
        {uploading ? 'Subiendo archivos...' : isPending ? 'Guardando...' : 'Guardar actividad'}
      </Button>
    </form>
  )
}
