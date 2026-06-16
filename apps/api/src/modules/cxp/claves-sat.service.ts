import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import type { TablesInsert, TablesUpdate } from '@erp/types';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import type {
  ClaveSatDto,
  EditarClaveSatDto,
  ImportarClavesSatDto,
} from './claves-sat.schemas.js';

/** Resultado de un lote de importación masiva. */
export interface ResultadoImportacion {
  recibidas: number; // filas que llegaron en este lote
  creadas: number; // claves nuevas insertadas
  actualizadas: number; // claves existentes sobrescritas
  duplicadasEnArchivo: number; // filas repetidas dentro del mismo lote (gana la última)
}

export interface ReglaRetencion {
  retieneIVA: boolean;
  retieneISR: boolean;
}

/**
 * Catálogo `catClavesProdServ`: claves Producto/Servicio del SAT con sus reglas
 * de retención (IVA/ISR). Se administra desde Configuraciones → Parámetros y lo
 * consume el parser de CFDI para validar las deducciones de cada solicitud.
 */
@Injectable()
export class ClavesSatService {
  private readonly logger = new Logger(ClavesSatService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async listar() {
    const { data, error } = await this.supabase.admin
      .from('catClavesProdServ')
      .select('idClave, claveProdServ, descripcion, retieneIVA, retieneISR, status, fc')
      .order('claveProdServ', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async crear(dto: ClaveSatDto, uid: string): Promise<{ idClave: string }> {
    const fila: TablesInsert<'catClavesProdServ'> = {
      claveProdServ: dto.claveProdServ,
      descripcion: dto.descripcion || null,
      retieneIVA: dto.retieneIVA,
      retieneISR: dto.retieneISR,
      status: true,
      uidr: uid,
    };
    const { data, error } = await this.supabase
      .comoActor(uid)
      .from('catClavesProdServ')
      .insert(fila)
      .select('idClave')
      .single();
    if (error) {
      if (error.code === '23505')
        throw new ConflictException(`La clave ${dto.claveProdServ} ya está registrada.`);
      this.logger.error(`Error creando clave SAT: ${error.message}`);
      throw new InternalServerErrorException('No se pudo crear la clave.');
    }
    return { idClave: data.idClave };
  }

  async editar(
    idClave: string,
    dto: EditarClaveSatDto,
    uid: string,
  ): Promise<void> {
    const cambios: TablesUpdate<'catClavesProdServ'> = {};
    if (dto.claveProdServ !== undefined) cambios.claveProdServ = dto.claveProdServ;
    if (dto.descripcion !== undefined) cambios.descripcion = dto.descripcion || null;
    if (dto.retieneIVA !== undefined) cambios.retieneIVA = dto.retieneIVA;
    if (dto.retieneISR !== undefined) cambios.retieneISR = dto.retieneISR;
    const { error } = await this.supabase
      .comoActor(uid)
      .from('catClavesProdServ')
      .update(cambios)
      .eq('idClave', idClave);
    if (error) {
      if (error.code === '23505')
        throw new ConflictException('Esa clave ya está registrada.');
      this.logger.error(`Error editando clave SAT ${idClave}: ${error.message}`);
      throw new InternalServerErrorException('No se pudo actualizar la clave.');
    }
  }

  async setStatus(idClave: string, status: boolean, uid: string): Promise<void> {
    const { error } = await this.supabase
      .comoActor(uid)
      .from('catClavesProdServ')
      .update({ status })
      .eq('idClave', idClave);
    if (error) {
      this.logger.error(`Error status clave SAT ${idClave}: ${error.message}`);
      throw new InternalServerErrorException('No se pudo cambiar el estado.');
    }
  }

  /**
   * Importa un lote de claves (upsert por `claveProdServ`). Las claves del
   * archivo quedan ACTIVAS (status=true); las existentes se sobrescriben en
   * descripción y retenciones. Devuelve el conteo de creadas/actualizadas para
   * el resumen. Se procesa por lotes desde el front (chunks), por eso recibe un
   * subconjunto cada vez.
   */
  async importar(dto: ImportarClavesSatDto, uid: string): Promise<ResultadoImportacion> {
    const recibidas = dto.filas.length;

    // Deduplicar dentro del lote por claveProdServ (gana la última ocurrencia).
    const porClave = new Map<string, ClaveSatDto>();
    for (const f of dto.filas) porClave.set(f.claveProdServ, f);
    const unicas = [...porClave.values()];
    const claves = unicas.map((f) => f.claveProdServ);

    // ¿Cuáles ya existen? (para contar creadas vs actualizadas).
    const { data: existentes, error: errSel } = await this.supabase.admin
      .from('catClavesProdServ')
      .select('claveProdServ')
      .in('claveProdServ', claves);
    if (errSel) throw new InternalServerErrorException(errSel.message);
    const yaExisten = new Set((existentes ?? []).map((r) => r.claveProdServ));

    const filas: TablesInsert<'catClavesProdServ'>[] = unicas.map((f) => ({
      claveProdServ: f.claveProdServ,
      descripcion: f.descripcion || null,
      retieneIVA: f.retieneIVA,
      retieneISR: f.retieneISR,
      status: true,
      uidr: uid,
    }));

    const { error } = await this.supabase
      .comoActor(uid)
      .from('catClavesProdServ')
      .upsert(filas, { onConflict: 'claveProdServ' });
    if (error) {
      this.logger.error(`Error importando claves SAT: ${error.message}`);
      throw new InternalServerErrorException('No se pudo importar el lote de claves.');
    }

    const actualizadas = unicas.filter((f) => yaExisten.has(f.claveProdServ)).length;
    return {
      recibidas,
      creadas: unicas.length - actualizadas,
      actualizadas,
      duplicadasEnArchivo: recibidas - unicas.length,
    };
  }

  /**
   * Devuelve, para las claves dadas, su regla de retención. Solo claves ACTIVAS.
   * Las claves no encontradas no aparecen en el mapa (el parser las rechaza).
   */
  async reglas(claves: string[]): Promise<Map<string, ReglaRetencion>> {
    const unicas = [...new Set(claves.filter((c) => !!c))];
    const mapa = new Map<string, ReglaRetencion>();
    if (unicas.length === 0) return mapa;
    const { data, error } = await this.supabase.admin
      .from('catClavesProdServ')
      .select('claveProdServ, retieneIVA, retieneISR')
      .eq('status', true)
      .in('claveProdServ', unicas);
    if (error) throw new InternalServerErrorException(error.message);
    for (const c of data ?? [])
      mapa.set(c.claveProdServ, {
        retieneIVA: c.retieneIVA,
        retieneISR: c.retieneISR,
      });
    return mapa;
  }
}
