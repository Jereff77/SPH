import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';

export interface RegistroAuditoria {
  id: number;
  fc: string;
  origen: number; // 1=v1, 2=v2, 3=directo en BD
  entidad: string;
  id_entidad: string | null;
  accion: string; // INSERT | UPDATE | DELETE | LEGACY
  cambios: unknown; // { campo: { antes, despues } }
  comentario: string | null; // texto legible (registros legacy de v1)
}

/**
 * Consulta de la bitácora de auditoría (`auditoria`). Solo lectura; el llenado
 * lo hacen los triggers de la BD (fn_auditoria) tanto para v1 como para v2.
 */
@Injectable()
export class AuditoriaService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Historial de acciones REALIZADAS por un usuario (uid actor), descendente. */
  async historialDeUsuario(
    uid: string,
    limit = 50,
    offset = 0,
  ): Promise<RegistroAuditoria[]> {
    const tope = Math.min(Math.max(limit, 1), 200);
    const { data, error } = await this.supabase.admin
      .from('auditoria')
      .select('id, fc, origen, entidad, id_entidad, accion, cambios, comentario')
      .eq('uid', uid)
      .order('fc', { ascending: false })
      .range(offset, offset + tope - 1);
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as RegistroAuditoria[];
  }
}
