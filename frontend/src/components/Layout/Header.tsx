import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks';

export function Header() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <NavLink to="/dashboard" className="flex items-center gap-2">
              <div className="bg-primary-500 p-2 rounded-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <span className="text-xl font-bold text-white">SPH Facturas</span>
            </NavLink>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? 'bg-primary-500 text-white'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`
              }
            >
              Dashboard
            </NavLink>

            <NavLink
              to="/logs"
              className={({ isActive }) =>
                `px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? 'bg-primary-500 text-white'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`
              }
            >
              Logs
            </NavLink>

            {isAdmin && (
              <NavLink
                to="/config"
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                    isActive
                      ? 'bg-primary-500 text-white'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`
                }
              >
                Configuración
              </NavLink>
            )}
          </nav>

          {/* User Menu */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-white">{user?.email}</p>
              <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
            </div>

            <div className="h-8 w-px bg-slate-700"></div>

            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors duration-200"
              title="Cerrar sesión"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <nav className="md:hidden py-3 border-t border-slate-700">
          <div className="flex gap-1">
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `flex-1 px-3 py-2 rounded-lg text-sm font-medium text-center transition-colors duration-200 ${
                  isActive
                    ? 'bg-primary-500 text-white'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`
              }
            >
              Dashboard
            </NavLink>

            <NavLink
              to="/logs"
              className={({ isActive }) =>
                `flex-1 px-3 py-2 rounded-lg text-sm font-medium text-center transition-colors duration-200 ${
                  isActive
                    ? 'bg-primary-500 text-white'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`
              }
            >
              Logs
            </NavLink>

            {isAdmin && (
              <NavLink
                to="/config"
                className={({ isActive }) =>
                  `flex-1 px-3 py-2 rounded-lg text-sm font-medium text-center transition-colors duration-200 ${
                    isActive
                      ? 'bg-primary-500 text-white'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`
                }
              >
                Config
              </NavLink>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
