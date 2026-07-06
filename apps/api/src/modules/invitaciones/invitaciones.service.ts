import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { ConfiguracionService } from '../configuracion/configuracion.service.js';
import { InvitacionesMailer } from './invitaciones.mailer.js';
import type { Env } from '../../common/config/env.validation.js';
import type { AceptarDto, InvitarDto } from './invitaciones.schemas.js';

/** Perfil base con el que nace un usuario invitado (los permisos reales se
 *  asignan luego en Configuraciones → Permisos sobre segModulosUsuarios). */
const PERFIL_BASE = 5; // 'Ventas' en la tabla perfil

export interface InvitacionListado {
  id: string;
  email: string;
  nombre: string | null;
  apellidos: string | null;
  estado: 'pendiente' | 'aceptada' | 'cancelada';
  vigente: boolean; // pendiente y no expirada
  agregadoACorreos: boolean;
  fecExpira: string;
  fecAcepta: string | null;
  creadoEn: string;
}

@Injectable()
export class InvitacionesService {
  private readonly logger = new Logger(InvitacionesService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly configuracion: ConfiguracionService,
    private readonly mailer: InvitacionesMailer,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // ---------------------------------------------------------------------------
  // Alta de invitación (usuario con acceso al módulo Usuarios).
  // ---------------------------------------------------------------------------
  async invitar(
    actorUid: string,
    dto: InvitarDto,
  ): Promise<{ id: string; email: string; enviado: boolean; agregadoACorreos: boolean }> {
    if (!this.mailer.disponible) {
      throw new BadRequestException(
        'El servidor no tiene configurada la cuenta SMTP de invitaciones (SMTP_INVITACIONES_*).',
      );
    }
    const email = dto.email.trim().toLowerCase();

    // 1) ¿Ya existe un usuario con ese correo?
    const { data: existeUsuario, error: errU } = await this.supabase.admin
      .from('catUsers')
      .select('uid')
      .ilike('email', email)
      .limit(1);
    if (errU) {
      throw new InternalServerErrorException(
        `No se pudo verificar el correo: ${errU.message}`,
      );
    }
    if (existeUsuario && existeUsuario.length > 0) {
      throw new ConflictException('Ya existe un usuario con ese correo.');
    }

    // 2) Invitaciones previas para ese correo.
    const ahoraIso = new Date().toISOString();
    const { data: previas } = await this.supabase.admin
      .from('v2_invitaciones')
      .select('id, estado, fecExpira, agregadoACorreos')
      .ilike('email', email)
      .eq('estado', 'pendiente');

    for (const inv of previas ?? []) {
      if (inv.fecExpira > ahoraIso) {
        // Solo puede haber UNA invitación activa por correo.
        throw new ConflictException(
          'Ya existe una invitación activa para ese correo. Cancélala antes de enviar otra.',
        );
      }
      // Pendiente expirada -> se reemplaza: se cancela y se revierte su efecto
      // sobre CORREOS_AUTORIZADOS para no dejar el correo "huérfano".
      await this.cancelarFila(inv.id, inv.agregadoACorreos, email, actorUid);
    }

    // 3) ¿El dominio del correo está autorizado? Si no, se agrega el correo a
    //    CORREOS_AUTORIZADOS automáticamente (requisito del flujo).
    const dominio = email.split('@')[1] ?? '';
    const [dominios, correos] = await Promise.all([
      this.configuracion.obtenerDominios(),
      this.configuracion.obtenerCorreos(),
    ]);
    const yaAutorizado = dominios.includes(dominio) || correos.includes(email);
    let agregadoACorreos = false;
    if (!yaAutorizado) {
      await this.configuracion.guardarCorreos([...correos, email]);
      agregadoACorreos = true;
    }

    // 4) Token (en BD solo el hash; el token crudo solo viaja en el correo).
    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hash(token);
    const dias = this.config.get('INVITACION_VIGENCIA_DIAS', { infer: true });
    const fecExpira = new Date(Date.now() + dias * 86_400_000).toISOString();

    const { data, error } = await this.supabase
      .comoActor(actorUid)
      .from('v2_invitaciones')
      .insert({
        email,
        nombre: dto.nombre,
        apellidos: dto.apellidos,
        idPerfil: PERFIL_BASE,
        tokenHash,
        invitadoPor: actorUid,
        agregadoACorreos,
        fecExpira,
      })
      .select('id')
      .single();

    if (error || !data) {
      // Rollback del correo si lo habíamos agregado.
      if (agregadoACorreos) {
        await this.quitarCorreo(email).catch(() => undefined);
      }
      throw new InternalServerErrorException(
        `No se pudo crear la invitación: ${error?.message ?? 'desconocido'}`,
      );
    }

    // 5) Enviar el correo.
    const enviado = await this.enviarCorreo(email, dto.nombre, token, dias);

    return { id: data.id, email, enviado, agregadoACorreos };
  }

  /** Reenvía el correo de una invitación pendiente y vigente (genera token nuevo). */
  async reenviar(actorUid: string, id: string): Promise<{ enviado: boolean }> {
    if (!this.mailer.disponible) {
      throw new BadRequestException(
        'El servidor no tiene configurada la cuenta SMTP de invitaciones (SMTP_INVITACIONES_*).',
      );
    }
    const { inv, token, dias } = await this.regenerarToken(actorUid, id, 'reenviar');
    const enviado = await this.enviarCorreo(inv.email, inv.nombre ?? '', token, dias);
    return { enviado };
  }

  /**
   * Genera un enlace nuevo para copiar/compartir manualmente (WhatsApp, etc.),
   * SIN enviar el correo. Invalida cualquier link anterior (mismo token único
   * por invitación), igual que `reenviar`.
   */
  async generarLink(actorUid: string, id: string): Promise<{ link: string }> {
    const { token } = await this.regenerarToken(actorUid, id, 'copiar el link');
    return { link: this.construirLink(token) };
  }

  /** Valida la invitación pendiente y le asigna un token nuevo (uso interno de reenviar/generarLink). */
  private async regenerarToken(
    actorUid: string,
    id: string,
    accion: string,
  ): Promise<{ inv: { email: string; nombre: string | null }; token: string; dias: number }> {
    const { data: inv } = await this.supabase.admin
      .from('v2_invitaciones')
      .select('id, email, nombre, estado, fecExpira')
      .eq('id', id)
      .maybeSingle();
    if (!inv) throw new NotFoundException('Invitación no encontrada.');
    if (inv.estado !== 'pendiente') {
      throw new BadRequestException(`Solo se puede ${accion} de invitaciones pendientes.`);
    }

    const token = randomBytes(32).toString('base64url');
    const dias = this.config.get('INVITACION_VIGENCIA_DIAS', { infer: true });
    const fecExpira = new Date(Date.now() + dias * 86_400_000).toISOString();
    const { error } = await this.supabase
      .comoActor(actorUid)
      .from('v2_invitaciones')
      .update({ tokenHash: this.hash(token), fecExpira, fum: new Date().toISOString(), fumUser: actorUid })
      .eq('id', id);
    if (error) {
      throw new InternalServerErrorException(`No se pudo ${accion}: ${error.message}`);
    }

    return { inv: { email: inv.email, nombre: inv.nombre }, token, dias };
  }

  // ---------------------------------------------------------------------------
  // Listado y cancelación (módulo Usuarios).
  // ---------------------------------------------------------------------------
  async listar(): Promise<InvitacionListado[]> {
    const { data, error } = await this.supabase.admin
      .from('v2_invitaciones')
      .select(
        'id, email, nombre, apellidos, estado, agregadoACorreos, fecExpira, fecAcepta, creadoEn',
      )
      .order('creadoEn', { ascending: false });
    if (error) {
      throw new InternalServerErrorException(
        `No se pudieron leer las invitaciones: ${error.message}`,
      );
    }
    const ahoraIso = new Date().toISOString();
    return (data ?? []).map((r) => ({
      id: r.id,
      email: r.email,
      nombre: r.nombre,
      apellidos: r.apellidos,
      estado: r.estado as InvitacionListado['estado'],
      vigente: r.estado === 'pendiente' && r.fecExpira > ahoraIso,
      agregadoACorreos: r.agregadoACorreos,
      fecExpira: r.fecExpira,
      fecAcepta: r.fecAcepta,
      creadoEn: r.creadoEn,
    }));
  }

  /** Cancela una invitación pendiente y revierte el correo si este flujo lo agregó. */
  async cancelar(actorUid: string, id: string): Promise<void> {
    const { data: inv } = await this.supabase.admin
      .from('v2_invitaciones')
      .select('id, email, estado, agregadoACorreos')
      .eq('id', id)
      .maybeSingle();
    if (!inv) throw new NotFoundException('Invitación no encontrada.');
    if (inv.estado !== 'pendiente') {
      throw new BadRequestException('Solo se pueden cancelar invitaciones pendientes.');
    }
    await this.cancelarFila(inv.id, inv.agregadoACorreos, inv.email, actorUid);
  }

  // ---------------------------------------------------------------------------
  // Endpoints públicos: validar token y aceptar (registro).
  // ---------------------------------------------------------------------------
  async validarToken(token: string): Promise<{
    email: string;
    nombre: string | null;
    apellidos: string | null;
  }> {
    const inv = await this.buscarPorToken(token);
    return { email: inv.email, nombre: inv.nombre, apellidos: inv.apellidos };
  }

  /**
   * Crea el usuario (Supabase Auth + catUsers) y marca la invitación como
   * aceptada. El correo se toma de la invitación, NUNCA del cliente.
   */
  async aceptar(dto: AceptarDto): Promise<{ ok: true }> {
    const inv = await this.buscarPorToken(dto.token);
    const email = inv.email;

    // 1) Crear el usuario en Supabase Auth (correo ya confirmado).
    const { data: creado, error: errAuth } =
      await this.supabase.admin.auth.admin.createUser({
        email,
        password: dto.password,
        email_confirm: true,
      });
    if (errAuth || !creado?.user) {
      const msg = errAuth?.message ?? '';
      if (/already.*registered|already been registered|exists/i.test(msg)) {
        throw new ConflictException(
          'Ya existe una cuenta para este correo. Usa «¿Olvidaste tu contraseña?» para acceder.',
        );
      }
      throw new InternalServerErrorException(
        `No se pudo crear la cuenta: ${msg || 'error desconocido'}`,
      );
    }
    const uid = creado.user.id;

    // 2) Perfil en catUsers (upsert por si un trigger ya creó la fila base).
    const nomCompleto = `${dto.nombre} ${dto.apellidos}`.trim();
    const { error: errPerfil } = await this.supabase
      .comoActor(uid)
      .from('catUsers')
      .upsert(
        {
          uid,
          email,
          nombre: dto.nombre,
          apellidos: dto.apellidos,
          nomCompleto,
          telefono: dto.telefono ?? null,
          idPerfil: inv.idPerfil ?? PERFIL_BASE,
          status: true,
        },
        { onConflict: 'uid' },
      );
    if (errPerfil) {
      // Si falla el perfil, eliminamos el usuario de Auth para no dejarlo huérfano.
      await this.supabase.admin.auth.admin.deleteUser(uid).catch(() => undefined);
      throw new InternalServerErrorException(
        `No se pudo crear el perfil: ${errPerfil.message}`,
      );
    }

    // 3) Marcar la invitación como aceptada.
    const { error: errInv } = await this.supabase
      .comoActor(uid)
      .from('v2_invitaciones')
      .update({
        estado: 'aceptada',
        fecAcepta: new Date().toISOString(),
        uidCreado: uid,
      })
      .eq('id', inv.id);
    if (errInv) {
      this.logger.error(
        `Usuario creado pero no se actualizó la invitación ${inv.id}: ${errInv.message}`,
      );
    }

    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Auxiliares.
  // ---------------------------------------------------------------------------
  private async buscarPorToken(token: string): Promise<{
    id: string;
    email: string;
    nombre: string | null;
    apellidos: string | null;
    idPerfil: number;
  }> {
    const { data: inv } = await this.supabase.admin
      .from('v2_invitaciones')
      .select('id, email, nombre, apellidos, idPerfil, estado, fecExpira')
      .eq('tokenHash', this.hash(token))
      .maybeSingle();
    if (!inv || inv.estado !== 'pendiente') {
      throw new BadRequestException('La invitación no es válida o ya fue utilizada.');
    }
    if (inv.fecExpira <= new Date().toISOString()) {
      throw new BadRequestException('La invitación ha expirado. Solicita una nueva.');
    }
    return {
      id: inv.id,
      email: inv.email,
      nombre: inv.nombre,
      apellidos: inv.apellidos,
      idPerfil: inv.idPerfil,
    };
  }

  private async cancelarFila(
    id: string,
    agregadoACorreos: boolean,
    email: string,
    actorUid: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .comoActor(actorUid)
      .from('v2_invitaciones')
      .update({ estado: 'cancelada', fum: new Date().toISOString(), fumUser: actorUid })
      .eq('id', id);
    if (error) {
      throw new InternalServerErrorException(
        `No se pudo cancelar la invitación: ${error.message}`,
      );
    }
    if (agregadoACorreos) {
      await this.quitarCorreo(email).catch((e) =>
        this.logger.warn(`No se pudo revertir el correo ${email}: ${(e as Error).message}`),
      );
    }
  }

  /** Quita un correo de CORREOS_AUTORIZADOS (revierte el alta automática). */
  private async quitarCorreo(email: string): Promise<void> {
    const correos = await this.configuracion.obtenerCorreos();
    const filtrados = correos.filter((c) => c !== email.toLowerCase());
    if (filtrados.length !== correos.length) {
      await this.configuracion.guardarCorreos(filtrados);
    }
  }

  private construirLink(token: string): string {
    const base =
      this.config.get('APP_WEB_URL', { infer: true }) ??
      this.config.get('CORS_ORIGIN', { infer: true }) ??
      'http://localhost:5173';
    return `${base.replace(/\/$/, '')}/registro?token=${encodeURIComponent(token)}`;
  }

  private async enviarCorreo(
    email: string,
    nombre: string,
    token: string,
    dias: number,
  ): Promise<boolean> {
    const link = this.construirLink(token);
    let logoUrl: string | null = null;
    try {
      const logos = await this.configuracion.obtenerLogos();
      logoUrl = logos.claro.url ?? logos.oscuro.url ?? null;
    } catch {
      /* el logo es opcional */
    }
    return this.mailer.enviar(email, nombre, link, logoUrl, dias);
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
