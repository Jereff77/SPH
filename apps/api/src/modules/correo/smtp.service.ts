import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import type { Credenciales } from './cuentas.service.js';

export interface CorreoOriginal {
  fromEmail: string | null;
  toEmail: string | null;
  subject: string | null;
  messageId: string | null;
  conversationId: string | null;
}

export interface AdjuntoSalida {
  filename: string;
  content: Buffer;
  contentType: string;
}

/**
 * Envío de respuestas por SMTP (nodemailer). Tras enviar, registra el correo
 * como `sent` en `correo_mensajes` (mismo hilo). Reemplaza el flujo N8N de envío.
 */
@Injectable()
export class SmtpService {
  private readonly logger = new Logger(SmtpService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Envía un correo de notificación (sin hilo ni registro en `correo_mensajes`).
   * Reutilizable por procesos internos (p. ej. avisos de complementos PPD). No
   * lanza si falla: registra el error y devuelve false (un fallo de correo no
   * debe tumbar el job que lo invoca).
   */
  async enviarNotificacion(
    cred: Credenciales,
    para: string[],
    subject: string,
    html: string,
  ): Promise<boolean> {
    const destinatarios = [...new Set(para.filter(Boolean))];
    if (destinatarios.length === 0) return false;
    const transporter = nodemailer.createTransport({
      host: cred.smtpHost,
      port: cred.smtpPort,
      secure: cred.smtpPort === 465,
      auth: { user: cred.usuario, pass: cred.password },
    });
    try {
      await transporter.sendMail({
        from: cred.email,
        to: destinatarios.join(', '),
        subject,
        html,
      });
      return true;
    } catch (e) {
      this.logger.error(`SMTP notificación ${cred.email}: ${(e as Error).message}`);
      return false;
    }
  }

  /**
   * Responde un correo del hilo y lo registra como `sent`. Si se pasa `firmaHtml`,
   * el correo se envía en **HTML** (cuerpo del usuario + firma corporativa) además
   * del texto plano; sin `firmaHtml` el comportamiento es el original (solo texto),
   * para no alterar a los consumidores existentes (CxP/PPD).
   */
  async responder(
    cred: Credenciales,
    original: CorreoOriginal,
    body: string,
    adjuntos: AdjuntoSalida[] = [],
    firmaHtml?: string,
    opciones?: { para?: string[]; cc?: string[] },
  ): Promise<void> {
    // Destinatarios: si se pasan explícitos, mandan; si no, el remitente original.
    const paraLista = (opciones?.para ?? []).filter(Boolean);
    const para = paraLista.length > 0 ? paraLista.join(', ') : original.fromEmail;
    if (!para) throw new InternalServerErrorException('No hay destinatario para la respuesta.');
    const ccLista = (opciones?.cc ?? []).filter(Boolean);
    const cc = ccLista.length > 0 ? ccLista.join(', ') : undefined;

    const asuntoBase = original.subject ?? '';
    const subject = /^re:/i.test(asuntoBase) ? asuntoBase : `Re: ${asuntoBase}`;
    const conversationId = original.conversationId ?? original.messageId;

    // Si hay firma, se arma el HTML (cuerpo del usuario escapado + nl2br + firma).
    const bodyHtml = firmaHtml
      ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#374151">` +
        `${this.textoAHtml(body)}</div>${firmaHtml}`
      : null;

    const transporter = nodemailer.createTransport({
      host: cred.smtpHost,
      port: cred.smtpPort,
      secure: cred.smtpPort === 465,
      auth: { user: cred.usuario, pass: cred.password },
    });

    let info;
    try {
      info = await transporter.sendMail({
        from: cred.email,
        to: para,
        cc,
        subject,
        text: body,
        html: bodyHtml ?? undefined,
        inReplyTo: original.messageId ?? undefined,
        references: [original.conversationId, original.messageId]
          .filter(Boolean)
          .join(' '),
        attachments: adjuntos.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
      });
    } catch (e) {
      this.logger.error(`SMTP enviar ${cred.email}: ${(e as Error).message}`);
      throw new InternalServerErrorException('No se pudo enviar el correo.');
    }

    // Registrar el enviado en el hilo.
    await this.supabase.admin.from('correo_mensajes').insert({
      idCuenta: cred.id,
      messageId: info.messageId ?? null,
      conversationId,
      fromEmail: cred.email,
      toEmail: para,
      cc: cc ?? null,
      subject,
      bodyText: body,
      bodyHtml,
      fecha: new Date().toISOString(),
      tipo: 'sent',
      folder: 'INBOX.Sent',
      leido: true,
      tieneAdjuntos: adjuntos.length > 0,
    });
  }

  /** Escapa el texto plano y convierte saltos de línea en <br> para el HTML del correo. */
  private textoAHtml(texto: string): string {
    const escapado = (texto ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return escapado.replace(/\r?\n/g, '<br>');
  }
}
