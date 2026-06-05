import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  setAccessToken,
  setOnSessionExpired,
  setVerComoActivo,
  setVerComoUid,
} from '@/lib/api';
import { authApi } from './auth.api';
import type { PerfilUsuario, PermisoUsuario } from './types';

interface VerComo {
  usuario: PerfilUsuario;
  permisos: PermisoUsuario[];
}

type Estado = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthContextValue {
  estado: Estado;
  /** Usuario EFECTIVO (el impersonado si "Ver como" está activo; si no, el real). */
  usuario: PerfilUsuario | null;
  /** Permisos EFECTIVOS (del usuario impersonado o del real). */
  permisos: PermisoUsuario[];
  login: (usuario: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** ¿El usuario (efectivo) tiene concedida una clave de permiso? (RBAC) */
  tienePermiso: (clave: number) => boolean;
  // ----- "Ver como" (solo soporte, solo lectura) -----
  /** ¿Está activo el modo "Ver como"? */
  verComoActivo: boolean;
  /** Usuario REAL autenticado (el soporte), aunque se esté impersonando. */
  usuarioReal: PerfilUsuario | null;
  /** ¿El usuario REAL es de soporte? (habilita "Ver como"). */
  esSoporte: boolean;
  /** Activa "Ver como" cargando el contexto del usuario objetivo. */
  activarVerComo: (uid: string) => Promise<void>;
  /** Sale del modo "Ver como" y vuelve a la identidad real. */
  salirVerComo: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [estado, setEstado] = useState<Estado>('loading');
  const [usuario, setUsuario] = useState<PerfilUsuario | null>(null);
  const [permisos, setPermisos] = useState<PermisoUsuario[]>([]);
  // Identidad impersonada por soporte (en memoria; nunca se persiste).
  const [verComo, setVerComo] = useState<VerComo | null>(null);

  const aplicarSesion = useCallback(
    (
      accessToken: string,
      user: PerfilUsuario,
      perms: PermisoUsuario[],
    ): void => {
      setAccessToken(accessToken);
      setUsuario(user);
      setPermisos(perms);
      setEstado('authenticated');
    },
    [],
  );

  const limpiarSesion = useCallback((): void => {
    setAccessToken(null);
    setUsuario(null);
    setPermisos([]);
    setVerComo(null);
    setVerComoActivo(false);
    setVerComoUid(null);
    setEstado('unauthenticated');
  }, []);

  // Al cargar la app: intentar restaurar la sesión con la cookie httpOnly.
  useEffect(() => {
    let activo = true;
    setOnSessionExpired(() => {
      if (activo) limpiarSesion();
    });
    authApi
      .refresh()
      .then((r) => {
        if (activo) aplicarSesion(r.accessToken, r.usuario, r.permisos);
      })
      .catch(() => {
        if (activo) limpiarSesion();
      });
    return () => {
      activo = false;
      setOnSessionExpired(null);
    };
  }, [aplicarSesion, limpiarSesion]);

  const login = useCallback(
    async (usuario: string, password: string): Promise<void> => {
      const r = await authApi.login(usuario, password);
      aplicarSesion(r.accessToken, r.usuario, r.permisos);
    },
    [aplicarSesion],
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authApi.logout();
    } finally {
      limpiarSesion();
    }
  }, [limpiarSesion]);

  const tienePermiso = useCallback(
    (clave: number): boolean => {
      // En "Ver como" se refleja EXACTAMENTE lo que vería el usuario objetivo
      // (incluido su propio bypass si ese usuario también fuese soporte).
      if (verComo) {
        return (
          verComo.usuario.isSupport === true ||
          verComo.permisos.some((p) => p.clave === clave && p.acceso === true)
        );
      }
      // Normal: soporte (super-admin) ve/puede todo; si no, según sus permisos.
      return (
        usuario?.isSupport === true ||
        permisos.some((p) => p.clave === clave && p.acceso === true)
      );
    },
    [permisos, usuario, verComo],
  );

  const activarVerComo = useCallback(
    async (uid: string): Promise<void> => {
      const ctx = await authApi.contexto(uid);
      setVerComo({ usuario: ctx.usuario, permisos: ctx.permisos });
      setVerComoActivo(true);
      setVerComoUid(uid); // el backend mostrará los datos de este usuario
      // Refrescar datos dependientes del usuario observado.
      void queryClient.invalidateQueries();
    },
    [queryClient],
  );

  const salirVerComo = useCallback((): void => {
    setVerComo(null);
    setVerComoActivo(false);
    setVerComoUid(null);
    void queryClient.invalidateQueries();
  }, [queryClient]);

  // Identidad efectiva: la impersonada si "Ver como" está activo.
  const usuarioEfectivo = verComo?.usuario ?? usuario;
  const permisosEfectivos = verComo?.permisos ?? permisos;

  const value = useMemo<AuthContextValue>(
    () => ({
      estado,
      usuario: usuarioEfectivo,
      permisos: permisosEfectivos,
      login,
      logout,
      tienePermiso,
      verComoActivo: verComo !== null,
      usuarioReal: usuario,
      esSoporte: usuario?.isSupport === true,
      activarVerComo,
      salirVerComo,
    }),
    [
      estado,
      usuarioEfectivo,
      permisosEfectivos,
      login,
      logout,
      tienePermiso,
      verComo,
      usuario,
      activarVerComo,
      salirVerComo,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
