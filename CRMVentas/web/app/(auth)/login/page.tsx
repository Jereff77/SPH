'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getUserRole, getUserName } from '@/lib/supabase/get-user-role'
import { useAuthStore } from '@/lib/stores/auth.store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  const router = useRouter()
  const setUser = useAuthStore(s => s.setUser)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError || !data.user) {
      setError('Credenciales incorrectas. Verifica tu correo y contraseña.')
      setLoading(false)
      return
    }

    const uid = data.user.id
    const [role, nombre] = await Promise.all([
      getUserRole(supabase, uid),
      getUserName(supabase, uid),
    ])

    setUser({ uid, email: data.user.email!, nombre, role })

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-3">
          <img
            src="/brand/logo2.png"
            alt="SPH Bienes Raíces"
            className="h-32 w-auto mx-auto object-contain"
          />
          <p className="text-sm text-muted-foreground">CRM Ventas</p>
        </div>

        <Card className="border-border shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Iniciar sesión</CardTitle>
            <CardDescription>Ingresa tus credenciales para continuar</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="correo@sphestate.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Ingresando...' : 'Ingresar'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Solo personal autorizado. Contacta al administrador para acceso.
        </p>
      </div>
    </div>
  )
}
