import { useRef, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { IconChevron } from '@/components/icons';
import { useAuth } from '@/features/auth/useAuth';
import { VerComoModal } from '@/features/auth/VerComoModal';
import { nombreUsuario } from '@/features/auth/format';
import { APP_VERSION } from '@/lib/constants';
import { useConteoAprobacionesCxp } from '@/features/cxp/useConteoAprobaciones';
import { MENU, type BadgeMenu } from './menu';

/** Círculo con un contador (pendientes). No se renderiza si n <= 0. */
function Contador({
  n,
  className = '',
}: {
  n: number;
  className?: string;
}) {
  if (n <= 0) return null;
  return (
    <span
      title={`${n} solicitud(es) pendiente(s) por aprobar`}
      className={`inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white ${className}`}
    >
      {n > 99 ? '99+' : n}
    </span>
  );
}

/** Grupo del menú al que pertenece una ruta (null en el landing/otras). */
function grupoDeRuta(pathname: string): string | null {
  for (const g of MENU) {
    if (g.to && (pathname === g.to || pathname.startsWith(`${g.to}/`))) return g.id;
    if (
      g.items.some(
        (it) => pathname === it.to || pathname.startsWith(`${it.to}/`),
      )
    ) {
      return g.id;
    }
  }
  return null;
}

interface SidebarProps {
  colapsado: boolean;
  /** Se llama al navegar (para cerrar el drawer en móvil). */
  onNavegar?: () => void;
}

export function Sidebar({ colapsado, onNavegar }: SidebarProps) {
  const { usuario, tienePermiso, esSoporte, activarVerComo } = useAuth();
  const { pathname } = useLocation();
  // Contadores dinámicos del menú (círculos). Cada uno se resuelve a un número;
  // el hook solo consulta si el usuario tiene el permiso correspondiente.
  const badges: Record<BadgeMenu, number> = {
    cxpAprobaciones: useConteoAprobacionesCxp(tienePermiso(430)),
  };
  // La versión mostrada es SIEMPRE la del bundle realmente cargado (`APP_VERSION`),
  // NO un dato leído de la BD: así solo cambia cuando el usuario carga un bundle
  // nuevo (deploy + recarga). El changelog (BD) se usa solo en Novedades.
  const version = APP_VERSION;
  // Al cargar/recargar: abre el grupo de la ruta actual (ninguno en el landing).
  const [grupoAbierto, setGrupoAbierto] = useState<string | null>(() =>
    grupoDeRuta(pathname),
  );
  const [verComoOpen, setVerComoOpen] = useState(false);
  // Long-press sobre el logo (solo soporte) abre "Ver como".
  const timerRef = useRef<number | null>(null);
  const disparadoRef = useRef(false);

  const cancelarLongPress = (): void => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };
  const onLogoPointerDown = (): void => {
    if (!esSoporte) return;
    disparadoRef.current = false;
    timerRef.current = window.setTimeout(() => {
      disparadoRef.current = true;
      setVerComoOpen(true);
    }, 600);
  };
  const onLogoClick = (e: React.MouseEvent): void => {
    cancelarLongPress();
    if (disparadoRef.current) {
      // Fue long-press: no navegar a inicio.
      e.preventDefault();
      disparadoRef.current = false;
      return;
    }
    onNavegar?.();
  };

  // Grupos directos (enlace): visibles según su propia clave.
  // Grupos con submenú: solo si tienen al menos un ítem permitido.
  const grupos = MENU.map((g) => ({
    ...g,
    items: g.items.filter(
      (it) =>
        (it.clave === undefined || tienePermiso(it.clave)) &&
        (!it.soloSoporte || esSoporte),
    ),
  })).filter((g) =>
    g.to ? g.clave === undefined || tienePermiso(g.clave) : g.items.length > 0,
  );

  return (
    <div className="flex h-full flex-col">
      {/* Cabecera: espacio para el logo + usuario + versión */}
      <div className="border-b border-white/10 p-3">
        <Link
          to="/"
          onClick={onLogoClick}
          onPointerDown={onLogoPointerDown}
          onPointerUp={cancelarLongPress}
          onPointerLeave={cancelarLongPress}
          title={
            esSoporte
              ? 'Ir al inicio (mantén presionado para «Ver como»)'
              : 'Ir al inicio'
          }
          className="block select-none rounded-md transition hover:opacity-80"
        >
          <Logo
            fondo="oscuro"
            mini={colapsado}
            className={
              colapsado
                ? 'mx-auto !border-white/30 !text-white/50'
                : 'mx-auto !border-white/30 !text-white/50'
            }
          />
        </Link>
        {!colapsado && (
          <div className="mt-3">
            <p className="truncate text-sm font-semibold text-white">
              {nombreUsuario(usuario)}
            </p>
            <Link
              to="/configuraciones/novedades"
              onClick={onNavegar}
              title="Ver novedades del sistema"
              className="text-xs font-medium text-[#8cc63f] transition hover:underline"
            >
              {version}
            </Link>
          </div>
        )}
      </div>

      {/* Menú */}
      <nav className="scrollbar-hide flex-1 overflow-y-auto p-2">
        {grupos.map((grupo) => {
          const abierto = grupoAbierto === grupo.id;

          // Grupo directo: NavLink sin submenú.
          if (grupo.to) {
            return (
              <div key={grupo.id} className="mb-1">
                <NavLink
                  to={grupo.to}
                  onClick={onNavegar}
                  title={grupo.label}
                  className={({ isActive }) =>
                    `flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition ${
                      colapsado ? 'justify-center' : ''
                    } ${
                      isActive
                        ? 'bg-white/15 text-white'
                        : 'text-white/90 hover:bg-white/10'
                    }`
                  }
                >
                  <grupo.Icon className="h-5 w-5 shrink-0" />
                  {!colapsado && <span className="flex-1 text-left">{grupo.label}</span>}
                </NavLink>
              </div>
            );
          }

          // Suma de los contadores de los ítems del grupo: se muestra en la
          // cabecera para que el aviso sea visible aunque el submenú esté cerrado
          // (o el menú colapsado), sin tener que expandir el grupo.
          const totalGrupo = grupo.items.reduce(
            (s, it) => s + (it.badge ? badges[it.badge] : 0),
            0,
          );

          return (
            <div key={grupo.id} className="mb-1">
              <button
                type="button"
                title={grupo.label}
                onClick={() =>
                  setGrupoAbierto((a) => (a === grupo.id ? null : grupo.id))
                }
                className={`relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10 ${
                  colapsado ? 'justify-center' : ''
                }`}
              >
                <grupo.Icon className="h-5 w-5 shrink-0" />
                {!colapsado && (
                  <>
                    <span className="flex-1 text-left">{grupo.label}</span>
                    <Contador n={totalGrupo} />
                    <IconChevron
                      className={`h-4 w-4 transition-transform ${abierto ? 'rotate-180' : ''}`}
                    />
                  </>
                )}
                {colapsado && (
                  <Contador
                    n={totalGrupo}
                    className="absolute right-0.5 top-0.5 !min-w-[1rem] !px-1 !text-[10px]"
                  />
                )}
              </button>

              {!colapsado && abierto && (
                <div className="mt-1 ml-4 space-y-1 border-l border-white/10 pl-3">
                  {grupo.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end
                      onClick={onNavegar}
                      className={({ isActive }) =>
                        `flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition ${
                          isActive
                            ? 'bg-white/15 font-medium text-white'
                            : 'text-white/75 hover:bg-white/10 hover:text-white'
                        }`
                      }
                    >
                      <span className="flex-1">{item.label}</span>
                      {item.badge && <Contador n={badges[item.badge]} />}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {verComoOpen && (
        <VerComoModal
          onClose={() => setVerComoOpen(false)}
          onElegir={async (uid) => {
            await activarVerComo(uid);
            setVerComoOpen(false);
            onNavegar?.();
          }}
        />
      )}
    </div>
  );
}
