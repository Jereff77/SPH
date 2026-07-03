import { useQuery } from '@tanstack/react-query';
import { aprobarApi } from './aprobar.api';

/**
 * Conteo de solicitudes CxP pendientes de aprobación del usuario actual, para el
 * badge del menú lateral. Solo se consulta si el usuario puede aprobar (permiso
 * 430); refresca por polling cada minuto y al reenfocar la ventana. Devuelve 0
 * mientras carga o si el usuario no tiene el permiso.
 */
export function useConteoAprobacionesCxp(puedeAprobar: boolean): number {
  const { data } = useQuery({
    queryKey: ['cxp', 'aprobaciones', 'conteo'],
    queryFn: () => aprobarApi.conteoPendientes(),
    enabled: puedeAprobar,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
  return data?.total ?? 0;
}
