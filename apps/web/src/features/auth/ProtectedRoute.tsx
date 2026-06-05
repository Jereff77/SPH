import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './useAuth';

/** Protege rutas: exige sesión. Mientras restaura la sesión muestra un estado de carga. */
export function ProtectedRoute() {
  const { estado } = useAuth();

  if (estado === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">
        Cargando sesión…
      </div>
    );
  }

  if (estado === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
