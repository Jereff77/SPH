import type { CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  configuracionApi,
  LOGO_DEFAULT,
  type FondoLogo,
} from '@/features/configuraciones/configuracion.api';
import { urlImagenSegura } from '@/lib/safeUrl';

/**
 * Logotipo del sistema. Hay dos variantes:
 *  - fondo "claro": para login/contenido (letras oscuras).
 *  - fondo "oscuro": para el sidebar (letras claras).
 * Aplica las dimensiones configuradas (px); si no hay, usa las por defecto.
 * `mini` lo reduce a un cuadro pequeño (sidebar colapsado).
 */
export function Logo({
  fondo = 'claro',
  mini = false,
  className = '',
}: {
  fondo?: FondoLogo;
  mini?: boolean;
  className?: string;
}) {
  const { data } = useQuery({
    queryKey: ['logos'],
    queryFn: () => configuracionApi.getLogos(),
    staleTime: 5 * 60 * 1000,
  });

  const logo = fondo === 'oscuro' ? data?.oscuro : data?.claro;
  const def = LOGO_DEFAULT[fondo];
  const logoUrl = urlImagenSegura(logo?.url);

  if (logoUrl) {
    if (mini) {
      return (
        <img
          src={logoUrl}
          alt="Logotipo"
          className={`h-9 w-9 object-contain ${className}`}
        />
      );
    }
    // Respeta las dimensiones configuradas. Si una es "auto" (null), se deja en
    // auto para mantener la proporción (no se fuerza el valor por defecto).
    const tieneAncho = logo?.ancho != null;
    const tieneAlto = logo?.alto != null;
    const style: CSSProperties = { maxWidth: '100%' };
    if (!tieneAncho && !tieneAlto) {
      style.width = def.ancho;
      style.height = 'auto';
    } else {
      style.width = tieneAncho ? logo!.ancho! : 'auto';
      style.height = tieneAlto ? logo!.alto! : 'auto';
    }
    return (
      <img
        src={logoUrl}
        alt="Logotipo"
        style={style}
        className={`object-contain ${className}`}
      />
    );
  }

  // Placeholder (sin logo configurado).
  return (
    <div
      style={mini ? undefined : { width: def.ancho, height: def.alto, maxWidth: '100%' }}
      className={`flex items-center justify-center rounded-md border-2 border-dashed border-gray-300 text-gray-400 ${
        mini ? 'h-9 w-9' : ''
      } ${className}`}
      aria-label="Espacio para el logo"
    >
      <span className="text-xs font-semibold tracking-[0.3em]">LOGO</span>
    </div>
  );
}
