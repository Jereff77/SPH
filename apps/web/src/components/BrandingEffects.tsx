import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { configuracionApi } from '@/features/configuraciones/configuracion.api';
import { urlImagenSegura } from '@/lib/safeUrl';

/**
 * Aplica el favicon configurado al documento. Componente sin render; se monta
 * una vez en la raíz de la app.
 */
export function BrandingEffects() {
  const { data } = useQuery({
    queryKey: ['logos'],
    queryFn: () => configuracionApi.getLogos(),
    staleTime: 5 * 60 * 1000,
  });

  const faviconUrl = urlImagenSegura(data?.favicon);

  useEffect(() => {
    if (!faviconUrl) return;
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = faviconUrl;
  }, [faviconUrl]);

  return null;
}
