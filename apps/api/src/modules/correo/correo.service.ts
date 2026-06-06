import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { CuentasService } from './cuentas.service.js';
import { ImapService } from './imap.service.js';
import { SmtpService, type AdjuntoSalida } from './smtp.service.js';

@Injectable()
export class CorreoService {
  private readonly logger = new Logger(CorreoService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly cuentas: CuentasService,
    private readonly imap: ImapService,
    private readonly smtp: SmtpService,
  ) {}

  /** Bandeja: conversaciones (agrupadas por conversationId) de una cuenta. */
  async bandeja(idCuenta: string) {
    const { data, error } = await this.supabase.admin
      .from('correo_mensajes')
      .select(
        'id, conversationId, fromEmail, subject, fecha, tipo, leido, tieneAdjuntos',
      )
      .eq('idCuenta', idCuenta)
      .order('fecha', { ascending: false, nullsFirst: false })
      .limit(800);
    if (error) throw new InternalServerErrorException(error.message);

    const grupos = new Map<
      string,
      {
        conversationId: string;
        subject: string | null;
        ultimoFrom: string | null;
        ultimaFecha: string | null;
        total: number;
        noLeidos: number;
        tieneAdjuntos: boolean;
      }
    >();
    for (const m of data ?? []) {
      const cid = m.conversationId ?? m.id;
      let g = grupos.get(cid);
      if (!g) {
        g = {
          conversationId: cid,
          subject: m.subject,
          ultimoFrom: m.fromEmail,
          ultimaFecha: m.fecha,
          total: 0,
          noLeidos: 0,
          tieneAdjuntos: false,
        };
        grupos.set(cid, g);
      }
      g.total++;
      if (m.tipo === 'received' && !m.leido) g.noLeidos++;
      if (m.tieneAdjuntos) g.tieneAdjuntos = true;
      if (!g.subject && m.subject) g.subject = m.subject;
    }
    // Ya vienen ordenados por fecha desc; el primero de cada grupo es el más reciente.
    return [...grupos.values()];
  }

  /** Hilo: mensajes de una conversación + adjuntos. Marca recibidos como leídos. */
  async hilo(idCuenta: string, conversationId: string) {
    const { data: mensajes, error } = await this.supabase.admin
      .from('correo_mensajes')
      .select(
        'id, conversationId, fromEmail, toEmail, cc, subject, bodyText, bodyHtml, fecha, tipo, leido, tieneAdjuntos',
      )
      .eq('idCuenta', idCuenta)
      .eq('conversationId', conversationId)
      .order('fecha', { ascending: true, nullsFirst: true });
    if (error) throw new InternalServerErrorException(error.message);
    const filas = mensajes ?? [];

    const ids = filas.map((m) => m.id);
    const adjPorMsg = new Map<string, unknown[]>();
    if (ids.length > 0) {
      const { data: adj } = await this.supabase.admin
        .from('correo_adjuntos')
        .select('id, idMensaje, filename, url, contentType, tamano')
        .in('idMensaje', ids);
      for (const a of adj ?? []) {
        const arr = adjPorMsg.get(a.idMensaje) ?? [];
        arr.push(a);
        adjPorMsg.set(a.idMensaje, arr);
      }
    }

    // Marcar recibidos no leídos como leídos.
    const noLeidos = filas
      .filter((m) => m.tipo === 'received' && !m.leido)
      .map((m) => m.id);
    if (noLeidos.length > 0) {
      await this.supabase.admin
        .from('correo_mensajes')
        .update({ leido: true })
        .in('id', noLeidos);
    }

    return filas.map((m) => ({ ...m, adjuntos: adjPorMsg.get(m.id) ?? [] }));
  }

  /** Sincroniza una cuenta (IMAP). */
  async sincronizar(idCuenta: string): Promise<{ nuevos: number }> {
    const cred = await this.cuentas.credencialesDe(idCuenta);
    return this.imap.sincronizar(cred);
  }

  /** Sincroniza todas las cuentas activas (lo usa el scheduler). */
  async sincronizarTodas(): Promise<void> {
    const cuentas = await this.cuentas.activas();
    for (const cred of cuentas) {
      try {
        await this.imap.sincronizar(cred);
      } catch (e) {
        this.logger.warn(`Sync ${cred.email}: ${(e as Error).message}`);
      }
    }
  }

  /** Responde un correo (SMTP) y lo registra en el hilo. */
  async responder(
    idMensaje: string,
    body: string,
    adjuntos: AdjuntoSalida[],
  ): Promise<void> {
    const { data: original, error } = await this.supabase.admin
      .from('correo_mensajes')
      .select('idCuenta, fromEmail, toEmail, subject, messageId, conversationId')
      .eq('id', idMensaje)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!original) throw new NotFoundException('Correo no encontrado.');
    const cred = await this.cuentas.credencialesDe(original.idCuenta);
    await this.smtp.responder(cred, original, body, adjuntos);
  }
}
