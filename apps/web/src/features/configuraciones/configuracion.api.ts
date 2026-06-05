import { api } from '@/lib/api';

interface DominiosResponse {
  dominios: string[];
}

export type FondoLogo = 'claro' | 'oscuro';

export interface LogoConfig {
  url: string | null;
  ancho: number | null;
  alto: number | null;
}

/** Dimensiones por defecto (px) cuando no hay configuración. */
export const LOGO_DEFAULT: Record<FondoLogo, { ancho: number; alto: number }> = {
  claro: { ancho: 220, alto: 90 },
  oscuro: { ancho: 160, alto: 50 },
};

/** Llamadas al backend para la configuración del sistema. */
export const configuracionApi = {
  getDominios: () => api.get<DominiosResponse>('/configuracion/dominios'),
  agregarDominio: (dominio: string) =>
    api.post<DominiosResponse>('/configuracion/dominios', { dominio }),
  quitarDominio: (dominio: string) =>
    api.delete<DominiosResponse>(
      `/configuracion/dominios/${encodeURIComponent(dominio)}`,
    ),

  getCorreos: () =>
    api.get<{ correos: string[] }>('/configuracion/correos'),
  agregarCorreo: (correo: string) =>
    api.post<{ correos: string[] }>('/configuracion/correos', { correo }),
  quitarCorreo: (correo: string) =>
    api.delete<{ correos: string[] }>(
      `/configuracion/correos/${encodeURIComponent(correo)}`,
    ),

  /** Público: logotipos + favicon (login/registro y todas las pantallas). */
  getLogos: () =>
    api.get<{ claro: LogoConfig; oscuro: LogoConfig; favicon: string | null }>(
      '/configuracion/logos',
    ),

  /** Sube el favicon (admin). */
  subirFavicon: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.postForm<{ url: string }>('/configuracion/favicon', form);
  },

  /** Sube el archivo de un logotipo (admin). */
  subirLogo: (file: File, fondo: FondoLogo) => {
    const form = new FormData();
    form.append('file', file);
    return api.postForm<{ logo: LogoConfig }>(
      `/configuracion/logo/${fondo}`,
      form,
    );
  },

  /** Actualiza las dimensiones de un logotipo (px o null = automático). */
  setDimensionesLogo: (
    fondo: FondoLogo,
    ancho: number | null,
    alto: number | null,
  ) =>
    api.patch<{ logo: LogoConfig }>(`/configuracion/logo/${fondo}/dimensiones`, {
      ancho,
      alto,
    }),
};
