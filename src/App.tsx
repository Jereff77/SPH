import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabaseClient'
import type { CatUser } from './types/db'
import { QrCode, LogOut } from 'lucide-react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Dashboard } from './pages/Dashboard'
import { GenerateQR } from './pages/GenerateQR'
import { BottomNav } from './components/BottomNav'

function App() {
  const [session, setSession] = useState<unknown>(null)
  const [currentUser, setCurrentUser] = useState<CatUser | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [profileName, setProfileName] = useState('')
  
  // Login State
  const [email, setEmail] = useState(() => localStorage.getItem('savedEmail') || '')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loading, setLoading] = useState(false)

  const fetchCurrentUser = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from('catUsers')
      .select('*')
      .eq('uid', uid)
      .single()
    
    if (data) {
      setCurrentUser(data)
      // Fetch company name
      if (data.idEmpresa) {
        const { data: empresa } = await supabase
          .from('empresas')
          .select('nombreEmpresa')
          .eq('idEmpresa', data.idEmpresa)
          .maybeSingle()
        
        if (empresa) {
          setCompanyName(empresa.nombreEmpresa || '')
        }
      }
      
      // Fetch profile name
      if (data.idPerfil) {
        const { data: perfil } = await supabase
          .from('catPerfiles')
          .select('nombre')
          .eq('idPerfil', data.idPerfil)
          .maybeSingle()
        
        if (perfil) {
          setProfileName(perfil.nombre)
        }
      }
    }
    if (error) console.error('Error fetching user:', error)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) fetchCurrentUser(session.user.id)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) fetchCurrentUser(session.user.id)
      else setCurrentUser(null)
    })

    return () => subscription.unsubscribe()
  }, [fetchCurrentUser])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setLoginError('')
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setLoginError(error.message)
    } else {
        localStorage.setItem('savedEmail', email)
    }
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setCurrentUser(null)
    setSession(null)
    setCompanyName('')
    setProfileName('')
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-sph-light flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <h1 className="text-2xl font-bold mb-6 flex items-center gap-2 text-sph-primary justify-center">
            <QrCode className="w-8 h-8" /> SPH Control de Accesos
          </h1>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-sph-text mb-1">Correo Electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 bg-sph-light border border-gray-200 rounded-lg outline-none focus:border-sph-primary text-sph-text"
                placeholder="usuario@empresa.com"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-sph-text mb-1">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 bg-sph-light border border-gray-200 rounded-lg outline-none focus:border-sph-primary text-sph-text"
                placeholder="••••••••"
                required
              />
            </div>

            {loginError && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-sph-primary text-white py-3 rounded-lg font-bold hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // Loading state while fetching user details?
  // We can show a spinner if currentUser is null but session exists
  // But let's just render.

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-sph-light pb-24">
        <header className="bg-sph-primary p-4 shadow-lg sticky top-0 z-10">
          <div className="flex justify-between items-center">
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <QrCode className="w-5 h-5 text-white" /> SPH Control de Accesos
            </h1>
            <button onClick={handleLogout} className="text-gray-300 hover:text-white transition">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
          {currentUser && (
            <div className="text-xs text-gray-300 mt-1">
              Operando como: {currentUser.nombre} {currentUser.apellidos} {profileName && `(${profileName})`} {companyName && ` - ${companyName}`}
            </div>
          )}
        </header>

        <main className="p-4">
          <Routes>
            <Route path="/" element={<Dashboard currentUser={currentUser} />} />
            <Route path="/generate" element={<GenerateQR currentUser={currentUser} companyName={companyName} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        
        <BottomNav />
      </div>
    </BrowserRouter>
  )
}

export default App
