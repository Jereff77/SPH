import { NavLink } from 'react-router-dom'
import { LayoutDashboard, QrCode } from 'lucide-react'

export function BottomNav() {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50">
      <div className="flex justify-around items-center h-20 pb-2">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `relative flex flex-col items-center justify-center w-full h-full transition-colors ${
              isActive ? 'text-sph-primary' : 'text-gray-400 hover:text-gray-600'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <div className="absolute -top-6 bg-white p-2 rounded-full border-t-4 border-sph-primary shadow-sm transform transition-transform">
                   <LayoutDashboard className="w-8 h-8 text-sph-primary fill-current/10" />
                </div>
              )}
              {!isActive && <LayoutDashboard className="w-6 h-6" />}
              <span className={`text-xs font-medium mt-1 ${isActive ? 'translate-y-4' : ''}`}>Dashboard</span>
            </>
          )}
        </NavLink>

        <NavLink
          to="/generate"
          className={({ isActive }) =>
            `relative flex flex-col items-center justify-center w-full h-full transition-colors ${
              isActive ? 'text-sph-primary' : 'text-gray-400 hover:text-gray-600'
            }`
          }
        >
           {({ isActive }) => (
            <>
              {isActive && (
                <div className="absolute -top-6 bg-white p-2 rounded-full border-t-4 border-sph-primary shadow-sm transform transition-transform">
                   <QrCode className="w-8 h-8 text-sph-primary fill-current/10" />
                </div>
              )}
              {!isActive && <QrCode className="w-6 h-6" />}
              <span className={`text-xs font-medium mt-1 ${isActive ? 'translate-y-4' : ''}`}>Generar QR</span>
            </>
          )}
        </NavLink>
      </div>
    </div>
  )
}
