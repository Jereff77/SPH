import { api } from '@/lib/api';

export interface CambioCampo {
  antes: unknown;
  despues: unknown;
}

export interface RegistroAuditoria {
  id: number;
  fc: string;
  origen: number; // 1=v1, 2=v2, 3=directo en BD
  entidad: string;
  id_entidad: string | null;
  accion: string; // INSERT | UPDATE | DELETE | LEGACY
  cambios: Record<string, CambioCampo> | null;
  comentario: string | null; // texto legible (registros legacy de v1)
}

export const auditoriaApi = {
  /** Historial de acciones realizadas por un usuario (descendente). */
  historial: (uid: string, limit = 80) =>
    api.get<RegistroAuditoria[]>(
      `/auditoria?uid=${encodeURIComponent(uid)}&limit=${limit}`,
    ),
};
