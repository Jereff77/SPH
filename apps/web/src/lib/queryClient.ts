import { QueryClient } from '@tanstack/react-query';

/**
 * Cliente de TanStack Query. Cache + reintentos + estados de carga/error dan la
 * "fluidez y estabilidad" buscada (a diferencia de v1, que recargaba datasets
 * completos vía SQL crudo). Ajustar staleTime por dominio según volatilidad.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
