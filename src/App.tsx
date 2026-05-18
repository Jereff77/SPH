import { useAuth } from './hooks/useAuth'
import { LoginPage } from './components/LoginPage'
import { MainLayout } from './components/MainLayout'

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <img src="/logo.jpg" alt="SPH" className="w-24 object-contain opacity-60" />
          <div className="flex gap-1">
            {[0, 150, 300].map(d => (
              <span key={d} className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return user ? <MainLayout user={user} /> : <LoginPage />
}
