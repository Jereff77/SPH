'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, Wifi, Save } from 'lucide-react'

interface SmtpForm {
  host: string
  port: string
  user: string
  pass: string
  from: string
}

const DEFAULT: SmtpForm = { host: 'smtp.gmail.com', port: '587', user: '', pass: '', from: '' }

export default function ConfiguracionPage() {
  const [form, setForm] = useState<SmtpForm>(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('crm_config')
        .select('valor')
        .eq('id', 'smtp_notif')
        .single()

      if (data?.valor) {
        try {
          const parsed = JSON.parse(data.valor)
          setForm({ ...DEFAULT, ...parsed, port: String(parsed.port ?? 587) })
        } catch {}
      }
      setLoading(false)
    }
    load()
  }, [])

  function handleChange(key: keyof SmtpForm, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleTest() {
    setTesting(true)
    try {
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, port: parseInt(form.port) }),
      })
      const data = await res.json()
      if (data.ok) toast.success('✅ Conexión SMTP exitosa.')
      else toast.error(`Error: ${data.error}`)
    } catch {
      toast.error('No se pudo conectar al servidor SMTP.')
    }
    setTesting(false)
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const valor = JSON.stringify({ ...form, port: parseInt(form.port) })

    const { error } = await supabase
      .from('crm_config')
      .upsert({ id: 'smtp_notif', valor, fum: new Date().toISOString() })

    if (error) toast.error('No se pudo guardar la configuración.')
    else toast.success('Configuración guardada correctamente.')
    setSaving(false)
  }

  if (loading) return <div className="text-sm text-muted-foreground">Cargando...</div>

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Configuración</h2>
        <p className="text-sm text-muted-foreground">Cuenta de correo para notificaciones automáticas del CRM</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Mail className="w-4 h-4 text-accent" />
            Correo de notificaciones (SMTP)
          </CardTitle>
          <CardDescription className="text-xs">
            Esta cuenta se usa para notificar a los asesores cuando un lead es aprobado o rechazado.
            Es distinta del correo personal de cada asesor para contactar clientes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Servidor SMTP (Host)</Label>
              <Input
                placeholder="smtp.gmail.com"
                value={form.host}
                onChange={e => handleChange('host', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Puerto</Label>
              <Input
                placeholder="587"
                value={form.port}
                onChange={e => handleChange('port', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email de la cuenta</Label>
              <Input
                type="email"
                placeholder="notificaciones@sphestate.com"
                value={form.user}
                onChange={e => handleChange('user', e.target.value)}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Contraseña / App Password</Label>
              <Input
                type="password"
                placeholder="••••••••••••••••"
                value={form.pass}
                onChange={e => handleChange('pass', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Para Gmail: genera una "Contraseña de aplicación" en myaccount.google.com → Seguridad.
              </p>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Nombre remitente (From)</Label>
              <Input
                placeholder="SPH CRM Ventas &lt;notificaciones@sphestate.com&gt;"
                value={form.from}
                onChange={e => handleChange('from', e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={testing || !form.host || !form.user || !form.pass}
            >
              <Wifi className="w-3.5 h-3.5 mr-1.5" />
              {testing ? 'Probando...' : 'Probar conexión'}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="w-3.5 h-3.5 mr-1.5" />
              {saving ? 'Guardando...' : 'Guardar configuración'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
