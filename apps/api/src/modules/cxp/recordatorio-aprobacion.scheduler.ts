import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { InvitacionesMailer } from '../invitaciones/invitaciones.mailer.js';
import { RegistroCronService } from '../../common/cron/registro-cron.service.js';
import { TAREA_CXP_RECORDATORIO_APROBACION } from '../../common/cron/cron.tareas.js';
import type { Env } from '../../common/config/env.validation.js';

/** Resultado de una corrida (queda como `detalle` en la bitácora de cron). */
interface ResultadoRecordatorio {
  habilitado: boolean;
  aprobadores: number;
  enviados: number;
}

/** Una solicitud pendiente, tal como se muestra en el correo y se guarda en la bitácora. */
interface SolicitudPendiente {
  idCxp: string;
  proveedor: string;
  total: number;
  moneda: string;
  folio: string;
}

const moneda = (n: number, divisa = 'MXN') =>
  (n ?? 0).toLocaleString('es-MX', {
    style: 'currency',
    currency: divisa || 'MXN',
  });

const escapar = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Recordatorio diario a los aprobadores de Cuentas por Pagar. Cada día a las
 * ~07:00 (MX) revisa si la **aprobación está habilitada hoy** (RPC
 * `cxp_puede_autorizar`); de estarlo, agrupa las solicitudes en estado *Enviado*
 * (`idEstado = 2`) por su aprobador asignado (`uidGerente`) y le envía a cada uno
 * un correo con la lista de pendientes. Reemplaza el flujo de n8n de los miércoles.
 *
 * El envío usa la **cuenta SMTP dedicada de invitaciones** (`InvitacionesMailer`,
 * vars `SMTP_INVITACIONES_*`), NO el buzón de facturas. Cada correo (incluidos los
 * fallidos) se registra en `mail_recordatorios_aprobacion` para consultarse en
 * Configuraciones → Soporte.
 */
@Injectable()
export class RecordatorioAprobacionScheduler {
  private readonly logger = new Logger(RecordatorioAprobacionScheduler.name);
  private corriendo = false;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly mailer: InvitacionesMailer,
    private readonly registro: RegistroCronService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // Diario ~07:00 hora de México (13:00 UTC; México es UTC−6 todo el año).
  @Cron('0 13 * * *', { name: TAREA_CXP_RECORDATORIO_APROBACION })
  async avisar(): Promise<void> {
    await this.ejecutar('programada');
  }

  /**
   * Corre la tarea registrando la ejecución en la bitácora de cron. Reutilizable
   * por el disparo manual desde la pantalla Cron (`ejecutadoPor` = uid del usuario).
   */
  async ejecutar(
    origen: 'programada' | 'manual',
    ejecutadoPor?: string | null,
  ): Promise<ResultadoRecordatorio> {
    if (this.corriendo) return { habilitado: false, aprobadores: 0, enviados: 0 };
    this.corriendo = true;
    try {
      return await this.registro.ejecutarYRegistrar(
        TAREA_CXP_RECORDATORIO_APROBACION,
        origen,
        () => this.enviarRecordatorios(),
        ejecutadoPor,
      );
    } catch (e) {
      this.logger.warn(`Recordatorio de aprobación: ${(e as Error).message}`);
      if (origen === 'manual') throw e;
      return { habilitado: false, aprobadores: 0, enviados: 0 };
    } finally {
      this.corriendo = false;
    }
  }

  /** Ejecutable también de forma manual (pruebas / disparo puntual). */
  async enviarRecordatorios(): Promise<ResultadoRecordatorio> {
    // 1) ¿La aprobación está habilitada hoy? (misma RPC que usa la pantalla de aprobar).
    const { data: puede, error: puedeErr } =
      await this.supabase.admin.rpc('cxp_puede_autorizar');
    if (puedeErr) {
      this.logger.error(`No se pudo verificar la habilitación: ${puedeErr.message}`);
      return { habilitado: false, aprobadores: 0, enviados: 0 };
    }
    if (puede !== true) {
      this.logger.log('Aprobación CxP no habilitada hoy; no se envían recordatorios.');
      return { habilitado: false, aprobadores: 0, enviados: 0 };
    }

    // 2) Solicitudes pendientes de aprobación (Enviado = 2), con su aprobador.
    const { data: filas, error } = await this.supabase.admin
      .from('cxp')
      .select('idCxp, uidGerente, nombreProveedor, total, moneda, folio')
      .eq('status', true)
      .eq('idEstado', 2);
    if (error) {
      this.logger.error(`No se pudieron leer las solicitudes pendientes: ${error.message}`);
      return { habilitado: true, aprobadores: 0, enviados: 0 };
    }

    // 3) Agrupar por aprobador asignado (uidGerente). Se omiten las solicitudes
    //    SIN aprobador: el centinela del esquema es '-' (patrón NULLIF(TRIM(x),'-'))
    //    además de null/vacío. Incluir '-' rompería la consulta a catUsers (no es un
    //    UUID válido) y dejaría sin correo a todos.
    const porGerente = new Map<string, SolicitudPendiente[]>();
    let sinAprobador = 0;
    for (const f of filas ?? []) {
      const uid = f.uidGerente?.trim();
      if (!uid || uid === '-') {
        sinAprobador++;
        continue;
      }
      const arr = porGerente.get(uid) ?? [];
      arr.push({
        idCxp: f.idCxp,
        proveedor: f.nombreProveedor ?? 'Proveedor',
        total: f.total ?? 0,
        moneda: f.moneda ?? 'MXN',
        folio: f.folio ?? '',
      });
      porGerente.set(uid, arr);
    }
    if (sinAprobador > 0)
      this.logger.warn(
        `${sinAprobador} solicitud(es) pendientes sin aprobador asignado; no se notifican.`,
      );
    if (porGerente.size === 0) return { habilitado: true, aprobadores: 0, enviados: 0 };

    // 4) Cuenta de envío disponible (SMTP dedicado de invitaciones).
    if (!this.mailer.disponible) {
      this.logger.warn(
        'SMTP dedicado (SMTP_INVITACIONES_*) no configurado; no se envían recordatorios.',
      );
      return { habilitado: true, aprobadores: porGerente.size, enviados: 0 };
    }

    // Correos, nombres y estado (activo) de los aprobadores.
    const uids = [...porGerente.keys()];
    const datos = new Map<
      string,
      { email: string | null; nombre: string; activo: boolean }
    >();
    const { data: users, error: usersErr } = await this.supabase.admin
      .from('catUsers')
      .select('uid, email, nomCompleto, nombre, status')
      .in('uid', uids);
    if (usersErr)
      this.logger.error(`No se pudieron resolver los aprobadores: ${usersErr.message}`);
    for (const u of users ?? [])
      datos.set(u.uid, {
        email: u.email,
        nombre: u.nomCompleto ?? u.nombre ?? u.email ?? u.uid,
        activo: u.status === true,
      });

    const baseUrl = (this.config.get('APP_WEB_URL', { infer: true }) ?? '').replace(
      /\/$/,
      '',
    );
    const enlace = `${baseUrl}/cxp/aprobar`;

    // 5) Un correo por aprobador ACTIVO con pendientes.
    let enviados = 0;
    for (const [uid, solicitudes] of porGerente) {
      const info = datos.get(uid);
      // Omitir aprobadores inactivos (status=false) o que ya no existen: aunque
      // tengan solicitudes asignadas, no deben recibir el recordatorio.
      if (!info || !info.activo) {
        this.logger.warn(
          `Aprobador ${uid} inactivo o inexistente; se omite (${solicitudes.length} pendiente(s)).`,
        );
        continue;
      }
      const email = info.email;
      const nombre = info.nombre;
      if (!email) {
        this.logger.warn(`Aprobador ${uid} sin correo registrado; se omite.`);
        continue;
      }
      const n = solicitudes.length;
      const asunto = `Tienes ${n} solicitud(es) de pago por aprobar`;
      const html = this.plantilla(nombre, solicitudes, enlace);

      const ok = await this.mailer.enviarHtml(email, asunto, html);
      if (ok) enviados++;

      // 6) Bitácora de correos (incluye los fallidos).
      await this.registrarEnvio({ uid, email, nombre, solicitudes, asunto, html, ok });
    }

    this.logger.log(
      `Recordatorios de aprobación: ${enviados}/${porGerente.size} enviados.`,
    );
    return { habilitado: true, aprobadores: porGerente.size, enviados };
  }

  /** Inserta un renglón en `mail_recordatorios_aprobacion`. Nunca lanza. */
  private async registrarEnvio(p: {
    uid: string;
    email: string;
    nombre: string;
    solicitudes: SolicitudPendiente[];
    asunto: string;
    html: string;
    ok: boolean;
  }): Promise<void> {
    const { error } = await this.supabase.admin
      // Tabla nueva de v2; hasta regenerar @erp/types se accede sin tipar.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from('mail_recordatorios_aprobacion' as any)
      .insert({
        uid_aprobador: p.uid,
        email: p.email,
        nombre: p.nombre,
        num_pendientes: p.solicitudes.length,
        asunto: p.asunto,
        html: p.html,
        solicitudes: p.solicitudes,
        estado: p.ok ? 'enviado' : 'fallido',
        error: p.ok ? null : 'El envío SMTP devolvió false (ver logs del servidor).',
      });
    if (error)
      this.logger.warn(
        `No se pudo registrar el recordatorio a ${p.email}: ${error.message}`,
      );
  }

  /** Plantilla HTML del correo (estilo inline, consistente con invitaciones). */
  private plantilla(
    nombre: string,
    solicitudes: SolicitudPendiente[],
    enlace: string,
  ): string {
    const n = solicitudes.length;
    const filas = solicitudes
      .map(
        (s) => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;color:#374151">${escapar(s.proveedor)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap;color:#374151">${moneda(s.total, s.moneda)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:12px;color:#6b7280">${escapar(s.folio)}</td>
      </tr>`,
      )
      .join('');

    return `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1f2a4d">
  <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:28px">
    <p style="font-size:16px;margin:0 0 12px">Hola ${escapar(nombre)},</p>
    <p style="font-size:14px;line-height:1.6;color:#374151;margin:0 0 16px">
      Tienes <strong>${n} solicitud(es) de pago</strong> pendientes de tu aprobación
      en <strong>Cuentas por Pagar</strong>. La aprobación está habilitada hoy.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 20px;font-size:13px">
      <thead>
        <tr style="background:#1f2a4d;color:#ffffff">
          <th style="padding:8px 10px;text-align:left">Proveedor</th>
          <th style="padding:8px 10px;text-align:right">Monto</th>
          <th style="padding:8px 10px;text-align:left">Folio</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>
    <p style="text-align:center;margin:0 0 8px">
      <a href="${escapar(enlace)}"
         style="display:inline-block;background:#1f2a4d;color:#ffffff;text-decoration:none;
                padding:12px 28px;border-radius:8px;font-size:15px;font-weight:bold">
        Revisar solicitudes
      </a>
    </p>
    <p style="font-size:12px;word-break:break-all;color:#3f5b87;margin:0">
      ${escapar(enlace)}
    </p>
  </div>
  <p style="text-align:center;font-size:11px;color:#9ca3af;margin:18px 0">
    SPH Bienes Raíces — Mensaje automático, no respondas a este correo.
  </p>
</div>`.trim();
  }
}
