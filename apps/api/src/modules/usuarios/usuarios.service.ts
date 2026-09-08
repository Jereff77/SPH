import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { fallaBd } from '../../common/utils/db-error.js';

export interface UsuarioListado {
  uid: string;
  nombre: string | null;
  apellidos: string | null;
  nomCompleto: string | null;
  email: string | null;
  telefono: string | null;
  status: boolean;
  isSupport: boolean;
  esRC: boolean;
}

/** Centinela de id en crm_responsableComercial (RC "ASIGNAR, SIN"). */
const RC_ID_CENTINELA = 9999;

/**
 * Gestión de usuarios sobre las tablas EXISTENTES y COMPARTIDAS con el sistema
 * Flutter: catUsers (status/isSupport) y crm_responsableComercial (RC). Las
 * escrituras afectan a ambos sistemas (consistencia) — autorizado por el cliente.
 */
@Injectable()
export class UsuariosService {
  private readonly logger = new Logger(UsuariosService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /** Lista los usuarios con su estado y marca de RC. (Solo lectura.) */
  async listar(): Promise<UsuarioListado[]> {
    const { data: usuarios, error } = await this.supabase.admin
      .from('catUsers')
      .select(
        'uid, nombre, apellidos, nomCompleto, email, telefono, status, isSupport',
      )
      .order('apellidos', { ascending: true });

    if (error) {
      throw new InternalServerErrorException(
        `No se pudieron leer los usuarios: ${error.message}`,
      );
    }

    const { data: rcs, error: errRc } = await this.supabase.admin
      .from('crm_responsableComercial')
      .select('uid');
    if (errRc) {
      throw new InternalServerErrorException(
        `No se pudieron leer los responsables comerciales: ${errRc.message}`,
      );
    }
    const setRC = new Set((rcs ?? []).map((r) => r.uid));

    return (usuarios ?? []).map((u) => ({
      uid: u.uid,
      nombre: u.nombre,
      apellidos: u.apellidos,
      nomCompleto: u.nomCompleto,
      email: u.email,
      telefono: u.telefono,
      status: u.status,
      isSupport: u.isSupport,
      esRC: setRC.has(u.uid),
    }));
  }

  /**
   * Activa/desactiva un usuario.
   *
   * ⛔ Escribe con `comoActor`, no con `admin`: dar de baja a alguien es de lo
   * más sensible que se hace aquí y la auditoría debe registrar quién lo hizo
   * (regla 6). El mensaje al cliente no lleva el detalle de la BD (regla 4b).
   */
  async setStatus(uid: string, status: boolean, actorUid: string): Promise<void> {
    const { error } = await this.supabase
      .comoActor(actorUid)
      .from('catUsers')
      .update({ status })
      .eq('uid', uid);
    if (error)
      fallaBd(this.logger, 'usuarios.setStatus', error, 'No se pudo actualizar el estado.');
  }

  /**
   * Designa/retira a un usuario como soporte. Solo un usuario de soporte puede
   * hacerlo (se valida que el actor tenga isSupport=true, no se confía en el cliente).
   */
  async setSoporte(
    actorUid: string,
    targetUid: string,
    isSupport: boolean,
  ): Promise<void> {
    await this.exigirSoporte(actorUid);
    const { error } = await this.supabase
      .comoActor(actorUid)
      .from('catUsers')
      .update({ isSupport })
      .eq('uid', targetUid);
    if (error)
      fallaBd(this.logger, 'usuarios.setSoporte', error, 'No se pudo actualizar soporte.');
  }

  /** Marca/desmarca a un usuario como responsable comercial. */
  async setRC(uid: string, esRC: boolean, actorUid: string): Promise<void> {
    if (esRC) {
      const { data: existe } = await this.supabase.admin
        .from('crm_responsableComercial')
        .select('uid')
        .eq('uid', uid)
        .limit(1);
      if (existe && existe.length > 0) return; // ya es RC

      const nuevoId = await this.siguienteIdRC();
      const { error } = await this.supabase
        .comoActor(actorUid)
        .from('crm_responsableComercial')
        .insert({ uid, id: nuevoId });
      if (error)
        fallaBd(this.logger, 'usuarios.setRC.alta', error, 'No se pudo marcar como RC.');
    } else {
      const { error } = await this.supabase
        .comoActor(actorUid)
        .from('crm_responsableComercial')
        .delete()
        .eq('uid', uid);
      if (error)
        fallaBd(this.logger, 'usuarios.setRC.baja', error, 'No se pudo quitar el RC.');
    }
  }

  private async exigirSoporte(uid: string): Promise<void> {
    const { data } = await this.supabase.admin
      .from('catUsers')
      .select('isSupport')
      .eq('uid', uid)
      .maybeSingle();
    if (data?.isSupport !== true) {
      throw new ForbiddenException(
        'Solo un usuario de soporte puede designar soporte.',
      );
    }
  }

  /** Próximo id para un nuevo RC (max de los ids normales + 1, ignora el centinela). */
  private async siguienteIdRC(): Promise<number> {
    const { data } = await this.supabase.admin
      .from('crm_responsableComercial')
      .select('id')
      .lt('id', RC_ID_CENTINELA)
      .order('id', { ascending: false })
      .limit(1);
    const max = data?.[0]?.id ?? 0;
    return max + 1;
  }
}
