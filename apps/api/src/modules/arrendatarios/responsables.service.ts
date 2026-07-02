import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { fallaBd } from '../../common/utils/db-error.js';

/** Parámetro de SPHConfiguraciones con el uid de la gerencia de Arrendatarios. */
const PARAM_GERENTE = 'ARRE_INPC_GERENTE_UID';

/**
 * Arrendatarios · Responsables de parque (tabla `parque_responsables`, N por
 * parque) + gerente del módulo (SPHConfiguraciones). Son los destinatarios del
 * correo de incrementos INPC: cada responsable recibe los planes de sus
 * parques; la gerente recibe TODOS y cubre los parques sin responsable.
 * Solo usuarios ACTIVOS y CON CORREO son asignables (validado server-side).
 */
@Injectable()
export class ResponsablesService {
  private readonly logger = new Logger(ResponsablesService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /** Valida que el uid corresponde a un usuario activo con correo utilizable. */
  private async validarUsuario(uid: string) {
    const { data, error } = await this.supabase.admin
      .from('catUsers')
      .select('uid, nomCompleto, email, status')
      .eq('uid', uid)
      .maybeSingle();
    if (error) throw fallaBd(this.logger, 'responsables.validarUsuario', error);
    if (!data) throw new NotFoundException('El usuario no existe.');
    if (!data.status)
      throw new BadRequestException('El usuario está dado de baja; no puede ser responsable.');
    if (!data.email?.trim())
      throw new BadRequestException('El usuario no tiene correo registrado; no puede recibir notificaciones.');
    return data;
  }

  /** Panorama completo: parques con sus responsables + gerente actual. */
  async listar() {
    const [parquesQ, respQ, gerenteQ] = await Promise.all([
      this.supabase.admin
        .from('parques')
        .select('idParque, nomParque')
        .eq('status', true)
        .eq('esTicket', false)
        .order('nomParque', { ascending: true }),
      this.supabase.admin
        .from('parque_responsables')
        .select('id, idParque, uid, fc'),
      this.supabase.admin
        .from('SPHConfiguraciones')
        .select('valor')
        .eq('parametro', PARAM_GERENTE)
        .eq('status', true)
        .maybeSingle(),
    ]);
    if (parquesQ.error) throw fallaBd(this.logger, 'responsables.listar.parques', parquesQ.error);
    if (respQ.error) throw fallaBd(this.logger, 'responsables.listar.resp', respQ.error);
    if (gerenteQ.error) throw fallaBd(this.logger, 'responsables.listar.gerente', gerenteQ.error);

    const responsables = respQ.data ?? [];
    const gerenteUid = gerenteQ.data?.valor?.trim() || null;
    const uids = [...new Set([...responsables.map((r) => r.uid), gerenteUid].filter(Boolean))] as string[];
    const { data: users, error: usersErr } = uids.length
      ? await this.supabase.admin
          .from('catUsers')
          .select('uid, nomCompleto, email, status')
          .in('uid', uids)
      : { data: [], error: null };
    if (usersErr) throw fallaBd(this.logger, 'responsables.listar.users', usersErr);
    const porUid = new Map((users ?? []).map((u) => [u.uid, u]));

    const parques = (parquesQ.data ?? []).map((p) => ({
      idParque: p.idParque,
      nomParque: p.nomParque ?? '—',
      responsables: responsables
        .filter((r) => r.idParque === p.idParque)
        .map((r) => {
          const u = porUid.get(r.uid);
          return {
            id: r.id,
            uid: r.uid,
            nombre: u?.nomCompleto ?? r.uid,
            email: u?.email ?? null,
            // Un responsable puede quedar inválido DESPUÉS de asignado
            // (baja o correo borrado): la UI lo resalta para reemplazarlo.
            valido: Boolean(u?.status && u?.email?.trim()),
          };
        }),
    }));

    const gerenteUser = gerenteUid ? porUid.get(gerenteUid) : null;
    return {
      parques,
      gerente: gerenteUid
        ? {
            uid: gerenteUid,
            nombre: gerenteUser?.nomCompleto ?? gerenteUid,
            email: gerenteUser?.email ?? null,
            valido: Boolean(gerenteUser?.status && gerenteUser?.email?.trim()),
          }
        : null,
      parquesSinResponsable: parques.filter((p) => !p.responsables.some((r) => r.valido)).length,
    };
  }

  /** Usuarios elegibles para el selector (activos, con correo). */
  async usuariosElegibles() {
    const { data, error } = await this.supabase.admin
      .from('catUsers')
      .select('uid, nomCompleto, email')
      .eq('status', true)
      .neq('email', '')
      .not('email', 'is', null)
      .order('nomCompleto', { ascending: true, nullsFirst: false });
    if (error) throw fallaBd(this.logger, 'responsables.elegibles', error);
    return data ?? [];
  }

  /** Asigna un responsable a un parque. */
  async agregar(idParque: string, uid: string, actorUid: string) {
    const { data: parque, error: pErr } = await this.supabase.admin
      .from('parques')
      .select('idParque, status')
      .eq('idParque', idParque)
      .maybeSingle();
    if (pErr) throw fallaBd(this.logger, 'responsables.agregar.parque', pErr);
    if (!parque || !parque.status) throw new NotFoundException('El parque no existe o está inactivo.');
    await this.validarUsuario(uid);

    const { data, error } = await this.supabase
      .comoActor(actorUid)
      .from('parque_responsables')
      .insert({ idParque, uid, uidr: actorUid })
      .select('id')
      .single();
    if (error) {
      if (error.code === '23505')
        throw new ConflictException('Ese usuario ya es responsable de este parque.');
      fallaBd(this.logger, 'responsables.agregar', error);
    }
    return { ok: true as const, id: data!.id };
  }

  /** Quita un responsable (DELETE físico; queda rastro en `auditoria`). */
  async quitar(id: string, actorUid: string) {
    const { data, error } = await this.supabase
      .comoActor(actorUid)
      .from('parque_responsables')
      .delete()
      .eq('id', id)
      .select('id');
    if (error) throw fallaBd(this.logger, 'responsables.quitar', error);
    if (!data?.length) throw new NotFoundException('La asignación no existe.');
    return { ok: true as const };
  }

  /** Define (o limpia con uid vacío) la gerente del módulo. */
  async setGerente(uid: string | null, actorUid: string) {
    if (uid?.trim()) await this.validarUsuario(uid.trim());
    const { data, error } = await this.supabase
      .comoActor(actorUid)
      .from('SPHConfiguraciones')
      .update({ valor: uid?.trim() ?? '' })
      .eq('parametro', PARAM_GERENTE)
      .select('idConfig');
    if (error) throw fallaBd(this.logger, 'responsables.gerente', error);
    if (!data?.length)
      throw new NotFoundException('Falta la configuración ARRE_INPC_GERENTE_UID en el sistema.');
    return { ok: true as const };
  }
}
