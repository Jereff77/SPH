import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { SmtpService } from '../correo/smtp.service.js';
import { CuentasService } from '../correo/cuentas.service.js';
import { DIAS_BLOQUEO_REP } from './bloqueo.service.js';
import { RegistroCronService } from '../../common/cron/registro-cron.service.js';
import { TAREA_CXP_COMPLEMENTOS } from '../../common/cron/cron.tareas.js';

/** A partir de cuántos días sin complemento empieza el aviso diario (faltan 5
 * para el bloqueo de 15 → del día 10 al 14). */
const DIAS_AVISO_DESDE = DIAS_BLOQUEO_REP - 5; // 10

const DIA_MS = 86_400_000;
const moneda = (n: number) =>
  (n ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

/**
 * Aviso diario de Complementos de Pago (REP) pendientes. Cada día, para las
 * parcialidades PPD pagadas hace 10–14 días sin su REP (faltando ≤5 días para el
 * bloqueo de 15), envía un correo al solicitante y al gerente que autorizó,
 * desde la cuenta del buzón de facturas. Reutiliza el SMTP del módulo Correo.
 */
@Injectable()
export class ComplementosScheduler {
  private readonly logger = new Logger(ComplementosScheduler.name);
  private corriendo = false;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly smtp: SmtpService,
    private readonly cuentas: CuentasService,
    private readonly registro: RegistroCronService,
  ) {}

  // Diario ~07:00 hora de México (13:00 UTC).
  @Cron('0 13 * * *', { name: TAREA_CXP_COMPLEMENTOS })
  async avisar(): Promise<void> {
    await this.ejecutar('programada');
  }

  /**
   * Corre la tarea registrando la ejecución en la bitácora. Reutilizable por el
   * disparo manual desde la pantalla Cron (`ejecutadoPor` = uid del usuario).
   */
  async ejecutar(
    origen: 'programada' | 'manual',
    ejecutadoPor?: string | null,
  ): Promise<{ enviados: number; pendientes: number }> {
    if (this.corriendo) return { enviados: 0, pendientes: 0 };
    this.corriendo = true;
    try {
      return await this.registro.ejecutarYRegistrar(
        TAREA_CXP_COMPLEMENTOS,
        origen,
        () => this.enviarAvisos(),
        ejecutadoPor,
      );
    } catch (e) {
      this.logger.warn(`Aviso de complementos: ${(e as Error).message}`);
      if (origen === 'manual') throw e;
      return { enviados: 0, pendientes: 0 };
    } finally {
      this.corriendo = false;
    }
  }

  /** Ejecutable también de forma manual (pruebas / disparo puntual). */
  async enviarAvisos(): Promise<{ enviados: number; pendientes: number }> {
    const ahora = Date.now();
    const desde = new Date(ahora - DIAS_BLOQUEO_REP * DIA_MS).toISOString(); // > hoy-15
    const hasta = new Date(ahora - DIAS_AVISO_DESDE * DIA_MS).toISOString(); // <= hoy-10

    const { data: parciales, error } = await this.supabase.admin
      .from('cxp')
      .select(
        'idCxp, uidr, autorizo, nombreProveedor, total, montoAplicado, fecPago, folio',
      )
      .eq('status', true)
      .eq('diferido', true)
      .in('idEstado', [6, 7])
      .is('uuidComplemento', null)
      .eq('complementoExento', false) // no avisar de las dispensadas
      .not('fecPago', 'is', null)
      .gt('fecPago', desde)
      .lte('fecPago', hasta);
    if (error) {
      this.logger.error(`No se pudieron leer las parcialidades: ${error.message}`);
      return { enviados: 0, pendientes: 0 };
    }
    const lista = parciales ?? [];
    if (lista.length === 0) return { enviados: 0, pendientes: 0 };

    // Cuenta del buzón de facturas (primera cuenta activa).
    const cuentasActivas = await this.cuentas.activas();
    if (cuentasActivas.length === 0) {
      this.logger.warn('No hay cuenta de correo activa para enviar los avisos.');
      return { enviados: 0, pendientes: lista.length };
    }
    const cred = cuentasActivas[0]!;

    // Correos de todos los involucrados.
    const uids = [
      ...new Set(
        lista.flatMap((p) => [p.uidr, p.autorizo]).filter((x): x is string => !!x),
      ),
    ];
    const correos = new Map<string, { email: string | null; nombre: string }>();
    if (uids.length > 0) {
      const { data: users } = await this.supabase.admin
        .from('catUsers')
        .select('uid, email, nomCompleto, nombre')
        .in('uid', uids);
      for (const u of users ?? [])
        correos.set(u.uid, {
          email: u.email,
          nombre: u.nomCompleto ?? u.nombre ?? u.email ?? u.uid,
        });
    }

    let enviados = 0;
    for (const p of lista) {
      const dias = Math.floor((ahora - new Date(p.fecPago!).getTime()) / DIA_MS);
      const restantes = Math.max(0, DIAS_BLOQUEO_REP - dias);
      const sol = p.uidr ? correos.get(p.uidr) : undefined;
      const ger = p.autorizo ? correos.get(p.autorizo) : undefined;
      const destinatarios = [sol?.email, ger?.email].filter(
        (x): x is string => !!x,
      );
      if (destinatarios.length === 0) continue;

      const monto = p.montoAplicado || p.total || 0;
      const subject = `Complemento de pago pendiente — bloqueo en ${restantes} día(s)`;
      const html = `
        <p>Estimado(a) ${sol?.nombre ?? ''}:</p>
        <p>El pago a <strong>${p.nombreProveedor ?? 'proveedor'}</strong> por
        <strong>${moneda(monto)}</strong> (factura PPD <code>${p.folio ?? ''}</code>)
        se aplicó hace <strong>${dias} días</strong> y <strong>aún no se ha registrado su
        Complemento de Pago (REP)</strong>.</p>
        <p>Suba el complemento en <em>Cuentas por Pagar → Solicitudes de Pago PPD</em>
        (botón “Subir complemento” en la parcialidad pagada).</p>
        <p style="color:#b91c1c"><strong>Importante:</strong> si no se sube en
        <strong>${restantes} día(s)</strong>, el sistema bloqueará al solicitante para
        crear nuevas solicitudes de pago de cualquier tipo, hasta regularizarlo.</p>
        <p style="font-size:12px;color:#6b7280">Mensaje automático del sistema SPH.</p>`;

      const ok = await this.smtp.enviarNotificacion(cred, destinatarios, subject, html);
      if (ok) enviados++;
    }

    this.logger.log(
      `Avisos de complementos: ${enviados}/${lista.length} enviados.`,
    );
    return { enviados, pendientes: lista.length };
  }
}
