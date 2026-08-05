import { useEffect, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '@/features/auth/useAuth';
import { nombreUsuario } from '@/features/auth/format';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { STORAGE } from '@/lib/constants';
import { IconMenu, IconLogout } from '@/components/icons';
import { Sidebar } from './Sidebar';
import { SoporteWidget } from '@/features/soporte/SoporteWidget';
import { AvisoNuevaVersion } from '@/features/version/AvisoNuevaVersion';

/**
 * Layout principal tras el login (landing). Header + sidebar colapsable.
 * - Escritorio: sidebar fijo que se compacta a solo iconos.
 * - Móvil: sidebar como drawer (overlay) controlado por el botón del header.
 */
export function AppShell() {
  const esMovil = useMediaQuery('(max-width: 767px)');
  const { usuario, logout, verComoActivo, salirVerComo } = useAuth();
  const [colapsado, setColapsado] = useState<boolean>(
    () => localStorage.getItem(STORAGE.sidebarColapsado) === '1',
  );
  const [drawerAbierto, setDrawerAbierto] = useState(false);

  // Panel del Agente de Soporte (columna fija a la derecha que EMPUJA el contenido).
  // Al abrirlo se colapsa el sidebar recordando su estado previo (solo en memoria,
  // sin tocar la preferencia guardada); al cerrarlo se restaura.
  const [soporteAbierto, setSoporteAbierto] = useState(false);
  const colapsadoPrevio = useRef<boolean | null>(null);
  const abrirSoporte = () => {
    if (!esMovil && colapsadoPrevio.current === null) {
      colapsadoPrevio.current = colapsado;
      setColapsado(true);
    }
    setSoporteAbierto(true);
  };
  const cerrarSoporte = () => {
    setSoporteAbierto(false);
    if (colapsadoPrevio.current !== null) {
      setColapsado(colapsadoPrevio.current);
      colapsadoPrevio.current = null;
    }
  };
  const panelSoporte = soporteAbierto && !verComoActivo;

  // Al pasar a escritorio, cerrar el drawer móvil.
  useEffect(() => {
    if (!esMovil) setDrawerAbierto(false);
  }, [esMovil]);

  function toggleSidebar() {
    if (esMovil) {
      setDrawerAbierto((d) => !d);
    } else {
      setColapsado((c) => {
        const nuevo = !c;
        localStorage.setItem(STORAGE.sidebarColapsado, nuevo ? '1' : '0');
        return nuevo;
      });
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Overlay (solo móvil con drawer abierto) */}
      {esMovil && drawerAbierto && (
        <div
          className="fixed inset-0 z-30 bg-black/40"
          onClick={() => setDrawerAbierto(false)}
          aria-hidden
        />
      )}

      {/* Sidebar / Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-[#1f2a4d] text-white transition-all duration-200
          ${drawerAbierto ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
          ${colapsado ? 'md:w-[72px]' : 'md:w-64'}`}
      >
        <Sidebar
          colapsado={colapsado && !esMovil}
          onNavegar={() => setDrawerAbierto(false)}
        />
      </aside>

      {/* Contenido */}
      <div
        className={`flex min-h-screen flex-col transition-all duration-200 ${
          colapsado ? 'md:ml-[72px]' : 'md:ml-64'
        } ${panelSoporte ? 'md:mr-96' : ''}`}
      >
        {/* Header */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-white px-3 md:px-4">
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Alternar menú"
            className="rounded-md p-2 text-gray-600 hover:bg-gray-100"
          >
            <IconMenu />
          </button>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-gray-600 sm:inline">
              {nombreUsuario(usuario)}
            </span>
            <button
              type="button"
              onClick={() => void logout()}
              className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              <IconLogout className="h-4 w-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </header>

        {/* Aviso de nueva versión disponible (compara el bundle vs /version.json; sin BD) */}
        <AvisoNuevaVersion />

        {/* Banner de "Ver como" (soporte, solo lectura) */}
        {verComoActivo && (
          <div className="sticky top-14 z-10 flex items-center justify-between gap-3 bg-amber-400 px-4 py-1.5 text-sm text-amber-950">
            <span>
              👁️ Viendo como{' '}
              <strong>{nombreUsuario(usuario)}</strong> — modo solo lectura
            </span>
            <button
              type="button"
              onClick={salirVerComo}
              className="rounded-md bg-amber-950/10 px-3 py-1 text-xs font-semibold hover:bg-amber-950/20"
            >
              Salir
            </button>
          </div>
        )}

        {/* Páginas */}
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      {/* Agente de IA de Soporte: burbuja + panel lateral fijo derecho (empuja el
          contenido, no lo tapa). Vive FUERA de <main>: la captura de pantalla del
          agente nunca se fotografía a sí misma. Se oculta en modo "Ver como". */}
      {!verComoActivo && (
        <SoporteWidget abierto={panelSoporte} onAbrir={abrirSoporte} onCerrar={cerrarSoporte} />
      )}
    </div>
  );
}
