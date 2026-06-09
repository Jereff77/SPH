import { api } from '@/lib/api';
import type { ChangelogResponse } from './types';

export const changelogApi = {
  /** Versiones publicadas + versión actual del sistema. */
  listar: () => api.get<ChangelogResponse>('/changelog'),
};
