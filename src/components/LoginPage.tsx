import { useState, type FormEvent } from 'react'
import { useAuth } from '../hooks/useAuth'

const LS_KEY = 'sph_last_email'

export function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState(() => localStorage.getItem(LS_KEY) ?? '')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      localStorage.setItem(LS_KEY, email)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al iniciar sesión'
      setError(msg.includes('Invalid login') ? 'Correo o contraseña incorrectos.' : msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white">
      {/* ── Lado izquierdo: logo ── */}
      <div className="md:w-1/2 flex items-center justify-center py-12 md:py-0 bg-white border-b md:border-b-0 md:border-r border-gray-100">
        <img src="/logo.jpg" alt="SPH Bienes Raíces" className="w-56 md:w-72 object-contain" />
      </div>

      {/* ── Lado derecho: formulario ── */}
      <div className="md:w-1/2 flex items-center justify-center px-8 py-12">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-light text-[#5b8db8] mb-1">Inicio sesión</h1>
          <p className="text-sm text-gray-500 mb-8">Comencemos llenando el formulario a continuación.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Correo */}
            <div className="float-input">
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Correo"
                required
                autoComplete="email"
              />
              <label htmlFor="email">Correo</label>
            </div>

            {/* Contraseña */}
            <div className="float-input">
              <input
                id="password"
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Contraseña"
                required
                autoComplete="current-password"
                style={{ paddingRight: '2.8rem' }}
              />
              <label htmlFor="password">Contraseña</label>
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showPwd ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#1e2d3d] hover:bg-[#2d3f52] text-white font-semibold rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Iniciando...' : 'Iniciar Sesión'}
            </button>
          </form>

          <p className="mt-6 text-sm text-center text-gray-500">
            ¿Olvidaste tu contraseña?{' '}
            <button
              type="button"
              onClick={() => alert('Contacta al administrador para restablecer tu contraseña.')}
              className="text-[#5b8db8] hover:underline font-medium"
            >
              Recupérala
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
