import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import type { TablesInsert, TablesUpdate } from '@erp/types';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import type { BancoDto } from './bancos.schemas.js';

/**
 * Catálogo de bancos (CxP > Bancos). Tabla EXISTENTE `catBancos` (`id` es
 * autoincremental). Escrituras autorizadas, auditadas con el usuario real.
 */
@Injectable()
export class BancosService {
  private readonly logger = new Logger(BancosService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async listar() {
    const { data, error } = await this.supabase.admin
      .from('catBancos')
      .select('id, nombre, codigo, tipo, created_at')
      .order('nombre', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async crear(dto: BancoDto, uid: string): Promise<{ id: number }> {
    // `id` es autoincremental (secuencia): no se envía.
    const fila: TablesInsert<'catBancos'> = {
      nombre: dto.nombre,
      codigo: dto.codigo,
      tipo: dto.tipo || null,
    };
    const { data, error } = await this.supabase
      .comoActor(uid)
      .from('catBancos')
      .insert(fila)
      .select('id')
      .single();
    if (error) {
      this.logger.error(`Error creando banco: ${error.message}`);
      throw new InternalServerErrorException('No se pudo crear el banco.');
    }
    return { id: data.id };
  }

  async editar(id: number, dto: BancoDto, uid: string): Promise<void> {
    const cambios: TablesUpdate<'catBancos'> = {
      nombre: dto.nombre,
      codigo: dto.codigo,
      tipo: dto.tipo || null,
    };
    const { error } = await this.supabase
      .comoActor(uid)
      .from('catBancos')
      .update(cambios)
      .eq('id', id);
    if (error) {
      this.logger.error(`Error editando banco ${id}: ${error.message}`);
      throw new InternalServerErrorException('No se pudo actualizar el banco.');
    }
  }
}
