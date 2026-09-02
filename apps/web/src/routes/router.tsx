import { createBrowserRouter } from 'react-router-dom';
import { LoginPage } from '@/features/auth/LoginPage';
import { RecuperarPage } from '@/features/auth/RecuperarPage';
import { RestablecerPage } from '@/features/auth/RestablecerPage';
import { RegistroPage } from '@/features/registro/RegistroPage';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { SistemaPage } from '@/features/configuraciones/SistemaPage';
import { UsuariosPage } from '@/features/usuarios/UsuariosPage';
import { ParametrosPage } from '@/features/parametros/ParametrosPage';
import { PermisosPage } from '@/features/permisos/PermisosPage';
import { CambiarContrasenaPage } from '@/features/auth/CambiarContrasenaPage';
import { ChangelogPage } from '@/features/changelog/ChangelogPage';
import { ParquesPage } from '@/features/parques/ParquesPage';
import { DisponibilidadPage } from '@/features/parques/DisponibilidadPage';
import KvasPage from '@/features/parques/KvasPage';
import { ProveedoresPage } from '@/features/cxp/ProveedoresPage';
import { BancosPage } from '@/features/cxp/BancosPage';
import { SolicitudesPage } from '@/features/cxp/SolicitudesPage';
import { PpdPage } from '@/features/cxp/PpdPage';
import { PendientesPage } from '@/features/cxp/PendientesPage';
import { PagarSolicitudesPage } from '@/features/cxp/PagarSolicitudesPage';
import { AprobarSolicitudesPage } from '@/features/cxp/AprobarSolicitudesPage';
import { CorreoPage } from '@/features/correo/CorreoPage';
import { lazy, Suspense } from 'react';
import { DashboardVentasPage } from '@/features/ventas/DashboardVentasPage';
import { PlanesPage } from '@/features/ventas/PlanesPage';
import { EscriturasPage } from '@/features/ventas/EscriturasPage';

// El Dashboard gráfico carga Chart.js (pesado): se separa en su propio chunk.
const DashboardGraficoPage = lazy(() =>
  import('@/features/ventas/DashboardGraficoPage').then((m) => ({
    default: m.DashboardGraficoPage,
  })),
);
// Reportes carga Chart.js + jsPDF: también en su propio chunk.
const ReportesPage = lazy(() =>
  import('@/features/ventas/ReportesPage').then((m) => ({ default: m.ReportesPage })),
);
// Reportes de Arrendatarios (jsPDF): chunk propio.
const ReportesArrePage = lazy(() =>
  import('@/features/arrendatarios/ReportesArrePage').then((m) => ({
    default: m.ReportesArrePage,
  })),
);
// Soporte a Inquilinos (Arrendatarios): bandeja de incidentes por correo. Chunk propio.
const SoporteInquilinosPage = lazy(() =>
  import('@/features/soporte-inquilinos/SoporteInquilinosPage').then((m) => ({
    default: m.SoporteInquilinosPage,
  })),
);
// Responsables de parque (Arrendatarios, permiso 212): destinatarios del correo de incrementos INPC.
const ResponsablesPage = lazy(() =>
  import('@/features/arrendatarios/ResponsablesPage').then((m) => ({
    default: m.ResponsablesPage,
  })),
);
// Cron (Configuraciones → Cron, solo soporte): chunk propio.
const CronPage = lazy(() =>
  import('@/features/cron/CronPage').then((m) => ({ default: m.CronPage })),
);
// Pendientes (Configuraciones → Pendientes, solo soporte): tablero de trabajo
// del proyecto. Chunk propio.
// ⚠️ Se llama «Tablero» y no «Pendientes» a secas porque CxP ya tiene su propia
// PendientesPage (solicitudes pendientes de gestionar): son cosas distintas.
const TableroPendientesPage = lazy(() =>
  import('@/features/pendientes/TableroPendientesPage').then((m) => ({
    default: m.TableroPendientesPage,
  })),
);
// Soporte (Configuraciones → Soporte, solo soporte): auditoría + tickets. Chunk propio.
const SoporteAdminPage = lazy(() =>
  import('@/features/soporte-admin/SoporteAdminPage').then((m) => ({
    default: m.SoporteAdminPage,
  })),
);
// CxP → Reportes (jsPDF + ExcelJS lazy): chunk propio.
const ReportesCxpPage = lazy(() => import('@/features/cxp/ReportesCxpPage'));
const cargando = <div className="p-6 text-sm text-gray-400">Cargando…</div>;
import { ClientesPage } from '@/features/clientes/ClientesPage';
import { DashboardCobranzaPage } from '@/features/arrendatarios/DashboardCobranzaPage';
import { ArrendatariosPage } from '@/features/arrendatarios/ArrendatariosPage';
import { DashboardPage as FideDashboardPage } from '@/features/fideicomiso/DashboardPage';
import { KardexPage } from '@/features/fideicomiso/KardexPage';
import { DispersionesPage } from '@/features/fideicomiso/DispersionesPage';
import { ContabilidadPage } from '@/features/fideicomiso/ContabilidadPage';
import { AportacionesPage } from '@/features/fideicomiso/AportacionesPage';
import { Home } from './Home';

/**
 * Rutas públicas: /login, /recuperar (solicitar enlace), /restablecer (fijar la
 * nueva contraseña con el token del correo) y /registro (alta por invitación).
 * Rutas protegidas: cuelgan de ProtectedRoute (exige sesión) y se renderizan
 * dentro del AppShell (landing con header + sidebar). Los módulos del ERP se
 * añadirán aquí como hijos, idealmente con lazy loading.
 */
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/recuperar', element: <RecuperarPage /> },
  { path: '/restablecer', element: <RestablecerPage /> },
  { path: '/registro', element: <RegistroPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <Home /> },
          { path: '/clientes', element: <ClientesPage /> },
          { path: '/ventas', element: <DashboardVentasPage /> },
          {
            path: '/ventas/dashboard',
            element: (
              <Suspense fallback={cargando}>
                <DashboardGraficoPage />
              </Suspense>
            ),
          },
          { path: '/ventas/planes', element: <PlanesPage /> },
          {
            path: '/ventas/reportes',
            element: (
              <Suspense fallback={cargando}>
                <ReportesPage />
              </Suspense>
            ),
          },
          { path: '/ventas/escrituras', element: <EscriturasPage /> },
          { path: '/arrendatarios', element: <DashboardCobranzaPage /> },
          { path: '/arrendatarios/planes', element: <ArrendatariosPage /> },
          {
            path: '/arrendatarios/reportes',
            element: (
              <Suspense fallback={cargando}>
                <ReportesArrePage />
              </Suspense>
            ),
          },
          {
            path: '/arrendatarios/responsables',
            element: (
              <Suspense fallback={cargando}>
                <ResponsablesPage />
              </Suspense>
            ),
          },
          {
            path: '/arrendatarios/soporte',
            element: (
              <Suspense fallback={cargando}>
                <SoporteInquilinosPage />
              </Suspense>
            ),
          },
          { path: '/fideicomiso/dashboard', element: <FideDashboardPage /> },
          { path: '/fideicomiso/aportaciones', element: <AportacionesPage /> },
          { path: '/fideicomiso/adhesiones', element: <FideDashboardPage /> },
          { path: '/fideicomiso/contabilidad', element: <ContabilidadPage /> },
          { path: '/fideicomiso/dispersiones', element: <DispersionesPage /> },
          { path: '/fideicomiso/reportes', element: <KardexPage /> },
          { path: '/parques', element: <ParquesPage /> },
          { path: '/parques/disponibilidad', element: <DisponibilidadPage /> },
          { path: '/parques/kvas', element: <KvasPage /> },
          { path: '/cxp/pagar', element: <PagarSolicitudesPage /> },
          { path: '/cxp/aprobar', element: <AprobarSolicitudesPage /> },
          { path: '/cxp/solicitudes', element: <SolicitudesPage /> },
          { path: '/cxp/ppd', element: <PpdPage /> },
          { path: '/cxp/pendientes', element: <PendientesPage /> },
          { path: '/cxp/proveedores', element: <ProveedoresPage /> },
          { path: '/cxp/bancos', element: <BancosPage /> },
          {
            path: '/cxp/reportes',
            element: (
              <Suspense fallback={cargando}>
                <ReportesCxpPage />
              </Suspense>
            ),
          },
          { path: '/correo', element: <CorreoPage /> },
          { path: '/configuraciones/usuarios', element: <UsuariosPage /> },
          { path: '/configuraciones/parametros', element: <ParametrosPage /> },
          { path: '/configuraciones/permisos', element: <PermisosPage /> },
          { path: '/configuraciones/sistema', element: <SistemaPage /> },
          {
            path: '/configuraciones/cambiar-contrasena',
            element: <CambiarContrasenaPage />,
          },
          { path: '/configuraciones/novedades', element: <ChangelogPage /> },
          {
            path: '/configuraciones/cron',
            element: (
              <Suspense fallback={cargando}>
                <CronPage />
              </Suspense>
            ),
          },
          {
            path: '/configuraciones/pendientes',
            element: (
              <Suspense fallback={cargando}>
                <TableroPendientesPage />
              </Suspense>
            ),
          },
          {
            path: '/configuraciones/soporte',
            element: (
              <Suspense fallback={cargando}>
                <SoporteAdminPage />
              </Suspense>
            ),
          },
        ],
      },
    ],
  },
]);
