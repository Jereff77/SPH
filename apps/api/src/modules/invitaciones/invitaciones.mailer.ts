import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { Env } from '../../common/config/env.validation.js';

/**
 * Envío del correo de invitación mediante una cuenta SMTP DEDICADA (variables de
 * entorno `SMTP_INVITACIONES_*`), independiente del buzón de facturas. Si no está
 * configurada, `disponible` es false y el service lo informa al usuario.
 */
@Injectable()
export class InvitacionesMailer {
  private readonly logger = new Logger(InvitacionesMailer.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  /** ¿Hay una cuenta SMTP configurada para enviar invitaciones? */
  get disponible(): boolean {
    return Boolean(this.config.get('SMTP_INVITACIONES_HOST', { infer: true }));
  }

  private get remitente(): string {
    return (
      this.config.get('SMTP_INVITACIONES_FROM', { infer: true }) ||
      this.config.get('SMTP_INVITACIONES_USER', { infer: true })
    );
  }

  private transporter() {
    const host = this.config.get('SMTP_INVITACIONES_HOST', { infer: true });
    const port = this.config.get('SMTP_INVITACIONES_PORT', { infer: true });
    const user = this.config.get('SMTP_INVITACIONES_USER', { infer: true });
    const pass = this.config.get('SMTP_INVITACIONES_PASS', { infer: true });
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user ? { user, pass } : undefined,
      // ⛔ TIMEOUTS OBLIGATORIOS. Sin ellos, un SMTP que no responde deja la
      // petición colgada para siempre. Importa sobre todo en los schedulers:
      // el de compromisos de KVA corre CADA HORA y se protege con un flag
      // `corriendo` — un solo cuelgue bloquearía todas las corridas siguientes
      // de forma permanente, no solo la de ese momento.
      connectionTimeout: 10_000, // abrir el socket
      greetingTimeout: 10_000, // saludo del servidor
      socketTimeout: 20_000, // inactividad durante el envío
    });
  }

  /**
   * Envía la invitación con el link de registro. Devuelve true si se envió. No
   * lanza si falla el envío SMTP (registra el error y devuelve false): la
   * invitación ya quedó creada y se puede reenviar.
   */
  async enviar(
    para: string,
    nombre: string,
    link: string,
    logoUrl: string | null,
    vigenciaDias: number,
  ): Promise<boolean> {
    if (!this.disponible) return false;
    try {
      await this.transporter().sendMail({
        from: this.remitente,
        to: para,
        subject: 'Invitación para registrarte en el ERP SPH Bienes Raíces',
        html: this.plantilla(nombre, link, logoUrl, vigenciaDias),
      });
      return true;
    } catch (e) {
      this.logger.error(`SMTP invitación a ${para}: ${(e as Error).message}`);
      return false;
    }
  }

  /**
   * Envío genérico de un correo HTML por la MISMA cuenta SMTP dedicada
   * (`SMTP_INVITACIONES_*`). Reutilizable por otros flujos de notificación
   * (p. ej. el recordatorio de aprobación de CxP) sin duplicar la configuración.
   * No lanza: si no está configurada o falla el SMTP, loguea y devuelve `false`.
   */
  async enviarHtml(
    para: string | string[],
    asunto: string,
    html: string,
  ): Promise<boolean> {
    if (!this.disponible) return false;
    try {
      await this.transporter().sendMail({
        from: this.remitente,
        to: para,
        subject: asunto,
        html,
      });
      return true;
    } catch (e) {
      const destino = Array.isArray(para) ? para.join(', ') : para;
      this.logger.error(`SMTP dedicado a ${destino}: ${(e as Error).message}`);
      return false;
    }
  }

  private plantilla(
    nombre: string,
    link: string,
    logoUrl: string | null,
    vigenciaDias: number,
  ): string {
    const saludo = nombre ? `Hola ${this.escapar(nombre)},` : 'Hola,';
    const logo = logoUrl
      ? `<img src="${this.escapar(logoUrl)}" alt="SPH" style="max-height:48px;margin-bottom:16px" />`
      : '';
    return `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1f2a4d">
  <div style="text-align:center;padding:24px 0">${logo}</div>
  <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:28px">
    <p style="font-size:16px;margin:0 0 12px">${saludo}</p>
    <p style="font-size:14px;line-height:1.6;color:#374151;margin:0 0 20px">
      Has sido invitado a registrarte en la plataforma <strong>ERP SPH Bienes Raíces</strong>.
      Para completar tu registro y definir tu contraseña, haz clic en el siguiente botón:
    </p>
    <p style="text-align:center;margin:0 0 20px">
      <a href="${this.escapar(link)}"
         style="display:inline-block;background:#1f2a4d;color:#ffffff;text-decoration:none;
                padding:12px 28px;border-radius:8px;font-size:15px;font-weight:bold">
        Completar mi registro
      </a>
    </p>
    <p style="font-size:13px;line-height:1.6;color:#6b7280;margin:0 0 6px">
      Si el botón no funciona, copia y pega esta dirección en tu navegador:
    </p>
    <p style="font-size:12px;word-break:break-all;color:#3f5b87;margin:0 0 18px">
      ${this.escapar(link)}
    </p>
    <p style="font-size:12px;color:#9ca3af;margin:0">
      Esta invitación vence en ${vigenciaDias} día(s). Si no esperabas este correo, puedes ignorarlo.
    </p>
  </div>
  <p style="text-align:center;font-size:11px;color:#9ca3af;margin:18px 0">
    SPH Bienes Raíces — Mensaje automático, no respondas a este correo.
  </p>
</div>`.trim();
  }

  private escapar(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
