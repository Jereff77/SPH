import { createBrowserRouter } from 'react-router-dom';
import { LoginPage } from '@/features/auth/LoginPage';
import { RecuperarPage } from '@/features/auth/RecuperarPage';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { SistemaPage } from '@/features/configuraciones/SistemaPage';
import { UsuariosPage } from '@/features/usuarios/UsuariosPage';
import { ParametrosPage } from '@/features/parametros/ParametrosPage';
import { PermisosPage } from '@/features/permisos/PermisosPage';
import { CambiarContrasenaPage } from '@/features/auth/CambiarContrasenaPage';
import { ParquesPage } from '@/features/parques/ParquesPage';
import { DisponibilidadPage } from '@/features/parques/DisponibilidadPage';
import { ProveedoresPage } from '@/features/cxp/ProveedoresPage';
import { BancosPage } from '@/features/cxp/BancosPage';
import { SolicitudesPage } from '@/features/cxp/SolicitudesPage';
import { PendientesPage } from '@/features/cxp/PendientesPage';
import { PagarSolicitudesPage } from '@/features/cxp/PagarSolicitudesPage';
import { AprobarSolicitudesPage } from '@/features/cxp/AprobarSolicitudesPage';
import { CorreoPage } from '@/features/correo/CorreoPage';
import { DashboardVentasPage } from '@/features/ventas/DashboardVentasPage';
import { PlanesPage } from '@/features/ventas/PlanesPage';
import { ClientesPage } from '@/features/clientes/ClientesPage';
import { Home } from './Home';

/**
 * Rutas públicas: /login y /recuperar.
 * Rutas protegidas: cuelgan de ProtectedRoute (exige sesión) y se renderizan
 * dentro del AppShell (landing con header + sidebar). Los módulos del ERP se
 * añadirán aquí como hijos, idealmente con lazy loading.
 */
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/recuperar', element: <RecuperarPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <Home /> },
          { path: '/clientes', element: <ClientesPage /> },
          { path: '/ventas', element: <DashboardVentasPage /> },
          { path: '/ventas/planes', element: <PlanesPage /> },
          { path: '/parques', element: <ParquesPage /> },
          { path: '/parques/disponibilidad', element: <DisponibilidadPage /> },
          { path: '/cxp/pagar', element: <PagarSolicitudesPage /> },
          { path: '/cxp/aprobar', element: <AprobarSolicitudesPage /> },
          { path: '/cxp/solicitudes', element: <SolicitudesPage /> },
          { path: '/cxp/pendientes', element: <PendientesPage /> },
          { path: '/cxp/proveedores', element: <ProveedoresPage /> },
          { path: '/cxp/bancos', element: <BancosPage /> },
          { path: '/correo', element: <CorreoPage /> },
          { path: '/configuraciones/usuarios', element: <UsuariosPage /> },
          { path: '/configuraciones/parametros', element: <ParametrosPage /> },
          { path: '/configuraciones/permisos', element: <PermisosPage /> },
          { path: '/configuraciones/sistema', element: <SistemaPage /> },
          {
            path: '/configuraciones/cambiar-contrasena',
            element: <CambiarContrasenaPage />,
          },
        ],
      },
    ],
  },
]);
