import { useQuery } from '@tanstack/react-query';
import { changelogApi } from './changelog.api';

/**
 * Carga el changelog del backend. Lo usan tanto la página de Novedades como el
 * Sidebar (para mostrar la versión actual del sistema). Cache compartida por la
 * misma queryKey.
 */
export function useChangelog() {
  return useQuery({
    queryKey: ['changelog'],
    queryFn: changelogApi.listar,
    staleTime: 5 * 60_000, // 5 min: cambia poco
  });
}
