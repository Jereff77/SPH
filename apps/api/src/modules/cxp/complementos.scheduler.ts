import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { SmtpService } from '../correo/smtp.service.js';
import { CuentasService, type Credenciales } from '../correo/cuentas.service.js';
import {
  correoUtilizable,
  leerRepConfig,
  partesMx,
  tareasDelDia,
  type RepConfig,
} from './rep-fechas.js';
import {
  RepPendientesService,
  type RepPendiente,
} from './rep-pendientes.service.js';
import { RegistroCronService } from '../../common/cron/registro-cron.service.js';
import { TAREA_CXP_COMPLEMENTOS } from '../../common/cron/cron.tareas.js';
import type { Env } from '../../common/config/env.validation.js';

/** Parámetro de `SPHConfiguraciones` con la cuenta remitente de estos avisos. */
const PARAM_CUENTA_REMITENTE = 'PPD_REP_CUENTA_REMITENTE';

/** Tipos de aviso (coinciden con el CHECK de `mail_avisos_rep`). */
type TipoAviso = 'proveedor' | 'solicitante' | 'gerente' | 'solicitante_bloqueo';

/** Resultado de una corrida (queda como `detalle` en la bitácora de cron). */
interface ResultadoAvisos {
  proveedores: number;
  solicitantes: number;
  gerentes: number;
  omitidos: number;
  pendientes: number;
}

interface Persona {
  email: string | null;
  nombre: string;
}

const moneda = (n: number): string =>
  (n ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const fechaMx = (iso: string): string => {
  const { anio, mes, dia } = partesMx(new Date(iso));
  return `${String(dia).padStart(2, '0')}/${String(mes + 1).padStart(2, '0')}/${anio}`;
};

const escapar = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Avisos de Complemento de Pago (REP) pendientes.
 *
 * ⛔ REGLAS DE NEGOCIO (Jereff, 2026-08-26) — nacen de un reclamo real: el
 * 16-ago-2026 un gerente recibió **19 correos en un día** (de solo 6 proveedores)
 * y **81 en la ventana**, porque la versión anterior mandaba un correo por cada
 * parcialidad. Ahora:
 *
 *  1. **Máximo UN correo al día** por persona sobre este tema. El candado real no
 *     vive aquí sino en el índice único de `mail_avisos_rep` (hay evidencia de dos
 *     instancias del API corriendo el cron a horas distintas; un flag en memoria
 *     no cruza procesos).
 *  2. Cada correo lleva **la lista completa** de lo pendiente de esa persona: si un
 *     proveedor debe 6 REP, es un correo con 6 renglones, no 6 correos.
 *  3. El calendario se ancla al **plazo del proveedor** (día 6 por defecto; el SAT
 *     le da hasta el 5 del mes siguiente para emitir el REP):
 *       · **Proveedor**  → uno diario los últimos 5 días (días 1 al 5).
 *       · **Solicitante** → uno diario en esa misma ventana, y además la víspera de
 *                          que se le bloquee el sistema (día 20).
 *       · **Gerente**    → UNO solo, la víspera del corte del proveedor (día 5).
 *     Los días salen de `RepConfig` (`SPHConfiguraciones`): nada hardcodeado.
 *
 * Todo envío —y todo NO envío— queda registrado en `mail_avisos_rep`.
 */
@Injectable()
export class ComplementosScheduler {
  private readonly logger = new Logger(ComplementosScheduler.name);
  private corriendo = false;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly smtp: SmtpService,
    private readonly cuentas: CuentasService,
    private readonly pendientes: RepPendientesService,
    private readonly registro: RegistroCronService,
    private readonly config: ConfigService<Env, true>,
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
  ): Promise<ResultadoAvisos> {
    if (this.corriendo) return this.vacio();
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
      return this.vacio();
    } finally {
      this.corriendo = false;
    }
  }

  private vacio(): ResultadoAvisos {
    return {
      proveedores: 0,
      solicitantes: 0,
      gerentes: 0,
      omitidos: 0,
      pendientes: 0,
    };
  }

  /** Ejecutable también de forma manual (pruebas / disparo puntual). */
  async enviarAvisos(hoy: Date = new Date()): Promise<ResultadoAvisos> {
    const cfg = await leerRepConfig(this.supabase.admin);
    const tareas = tareasDelDia(cfg, hoy);
    if (
      !tareas.proveedores &&
      !tareas.solicitantes &&
      !tareas.gerentes &&
      !tareas.solicitantesBloqueo
    ) {
      return this.vacio(); // fuera de calendario: no hay nada que avisar hoy
    }

    // Universo: parcialidades pagadas el MES ANTERIOR aún sin REP.
    const lista = await this.pendientes.listar({ soloMesAnterior: true }, cfg, hoy);
    const res = this.vacio();
    res.pendientes = lista.length;
    if (lista.length === 0) return res;

    const cred = await this.cuentaRemitente();
    if (!cred) {
      this.logger.warn('No hay cuenta de correo activa para enviar los avisos.');
      return res;
    }

    const dia = this.diaMx(hoy);
    const [usuarios, proveedores] = await Promise.all([
      this.cargarUsuarios(lista),
      this.cargarProveedores(lista),
    ]);

    // Proveedores a los que NO se les pudo avisar: se reportan al gerente y se
    // registran, en vez de fallar en silencio.
    const sinCorreo: string[] = [];

    // --- 1) Proveedores (externos) -------------------------------------------
    if (tareas.proveedores) {
      for (const [idProveedor, filas] of this.pendientes.agrupar(
        lista,
        (p) => p.idProveedor,
      )) {
        const prov = proveedores.get(idProveedor);
        const nombre = prov?.nombre ?? filas[0]!.nombreProveedor;
        if (!correoUtilizable(prov?.email)) {
          sinCorreo.push(nombre);
          await this.registrarOmitido(dia, idProveedor, nombre, filas);
          res.omitidos++;
          continue;
        }
        const asunto = `Complemento de pago (REP) pendiente — ${filas.length} pago(s) recibidos`;
        const ok = await this.enviar({
          dia,
          tipo: 'proveedor',
          destinatario: prov!.email!.trim(),
          idProveedor,
          asunto,
          html: this.plantillaProveedor(nombre, filas, cfg),
          filas,
          cred,
          replyTo: cred.email,
        });
        if (ok) res.proveedores++;
      }
    }

    // --- 2) Solicitantes (aviso diario de la ventana) -------------------------
    if (tareas.solicitantes) {
      res.solicitantes += await this.avisarInternos(
        'solicitante',
        this.pendientes.agrupar(lista, (p) => p.uidr),
        usuarios,
        cfg,
        dia,
        cred,
        false,
      );
    }

    // --- 3) Solicitantes (víspera de su bloqueo del sistema) ------------------
    if (tareas.solicitantesBloqueo) {
      res.solicitantes += await this.avisarInternos(
        'solicitante_bloqueo',
        this.pendientes.agrupar(lista, (p) => p.uidr),
        usuarios,
        cfg,
        dia,
        cred,
        true,
      );
    }

    // --- 4) Gerentes (uno solo, la víspera del corte del proveedor) -----------
    if (tareas.gerentes) {
      for (const [uid, filas] of this.pendientes.agrupar(
        lista,
        (p) => p.autorizo,
      )) {
        const g = usuarios.get(uid);
        if (!correoUtilizable(g?.email)) continue;
        const asunto = `Complementos de pago pendientes — ${filas.length} en tus autorizaciones`;
        const ok = await this.enviar({
          dia,
          tipo: 'gerente',
          destinatario: g!.email!.trim(),
          uid,
          asunto,
          html: this.plantillaGerente(g!.nombre, filas, usuarios, cfg, sinCorreo),
          filas,
          cred,
        });
        if (ok) res.gerentes++;
      }
    }

    this.logger.log(
      `Avisos REP: ${res.proveedores} proveedor(es), ${res.solicitantes} solicitante(s), ` +
        `${res.gerentes} gerente(s), ${res.omitidos} sin correo · ${res.pendientes} parcialidades.`,
    );
    return res;
  }

  // ==========================================================================
  // Envío + bitácora
  // ==========================================================================

  private diaMx(hoy: Date): string {
    const { anio, mes, dia } = partesMx(hoy);
    return `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  }

  private async avisarInternos(
    tipo: TipoAviso,
    porUid: Map<string, RepPendiente[]>,
    usuarios: Map<string, Persona>,
    cfg: RepConfig,
    dia: string,
    cred: Credenciales,
    esBloqueo: boolean,
  ): Promise<number> {
    let n = 0;
    for (const [uid, filas] of porUid) {
      const u = usuarios.get(uid);
      if (!correoUtilizable(u?.email)) continue;
      const asunto = esBloqueo
        ? 'Mañana se bloqueará tu acceso a solicitudes de pago (complementos pendientes)'
        : `Complementos de pago pendientes — ${filas.length} pago(s) sin REP`;
      const ok = await this.enviar({
        dia,
        tipo,
        destinatario: u!.email!.trim(),
        uid,
        asunto,
        html: this.plantillaInterno(u!.nombre, filas, cfg, esBloqueo),
        filas,
        cred,
      });
      if (ok) n++;
    }
    return n;
  }

  /**
   * Envía UN correo a UN destinatario y lo registra.
   *
   * El renglón se **reserva antes** de enviar (`estado='en_curso'`): si otra
   * instancia del cron ya lo apartó hoy, el INSERT choca contra el índice único
   * y esta salta el envío. Es lo que garantiza la regla "máximo uno al día"
   * entre procesos distintos.
   */
  private async enviar(p: {
    dia: string;
    tipo: TipoAviso;
    destinatario: string;
    uid?: string;
    idProveedor?: string;
    asunto: string;
    html: string;
    filas: RepPendiente[];
    cred: Credenciales;
    replyTo?: string;
  }): Promise<boolean> {
    const id = await this.reservar(p);
    if (id == null) return false; // ya se le envió hoy

    const r = await this.smtp.enviarNotificacionDetalle(
      p.cred,
      [p.destinatario],
      p.asunto,
      p.html,
      p.replyTo,
    );
    await this.cerrar(id, r.ok ? 'enviado' : 'fallido', r.ok ? null : r.error);
    return r.ok;
  }

  /** Aparta el cupo del día. Devuelve el id, o null si ya estaba tomado. */
  private async reservar(p: {
    dia: string;
    tipo: TipoAviso;
    destinatario: string;
    uid?: string;
    idProveedor?: string;
    asunto: string;
    html: string;
    filas: RepPendiente[];
  }): Promise<number | null> {
    const { data, error } = await this.supabase.admin
      // Tabla nueva de v2; hasta regenerar @erp/types se accede sin tipar.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from('mail_avisos_rep' as any)
      .insert({
        fecha_mx: p.dia,
        tipo: p.tipo,
        destinatario: p.destinatario,
        uid: p.uid ?? null,
        id_proveedor: p.idProveedor ?? null,
        num_pendientes: p.filas.length,
        asunto: p.asunto,
        html: p.html,
        detalle: p.filas.map((f) => ({
          idCxp: f.idCxp,
          folio: f.folio,
          proveedor: f.nombreProveedor,
          monto: f.monto,
          fecPago: f.fecPago,
        })),
        estado: 'en_curso',
      })
      .select('id')
      .single();

    if (error) {
      // 23505 = ya hay un aviso de este tipo para este destinatario hoy.
      if ((error as { code?: string }).code !== '23505')
        this.logger.warn(
          `No se pudo reservar el aviso a ${p.destinatario}: ${error.message}`,
        );
      return null;
    }
    return (data as unknown as { id: number }).id;
  }

  private async cerrar(
    id: number,
    estado: 'enviado' | 'fallido',
    error: string | null,
  ): Promise<void> {
    const { error: e } = await this.supabase.admin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from('mail_avisos_rep' as any)
      .update({ estado, error })
      .eq('id', id);
    if (e) this.logger.warn(`No se pudo cerrar el aviso ${id}: ${e.message}`);
  }

  /** Deja constancia de un proveedor al que no se le pudo avisar. */
  private async registrarOmitido(
    dia: string,
    idProveedor: string,
    nombre: string,
    filas: RepPendiente[],
  ): Promise<void> {
    const { error } = await this.supabase.admin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from('mail_avisos_rep' as any)
      .insert({
        fecha_mx: dia,
        tipo: 'proveedor',
        destinatario: `sin-correo:${idProveedor}`,
        id_proveedor: idProveedor,
        num_pendientes: filas.length,
        asunto: `Sin correo registrado — ${nombre}`,
        html: '',
        detalle: filas.map((f) => ({
          idCxp: f.idCxp,
          folio: f.folio,
          monto: f.monto,
        })),
        estado: 'omitido_sin_correo',
        error: 'El proveedor no tiene un correo utilizable en catProveedores.',
      });
    if (error && (error as { code?: string }).code !== '23505')
      this.logger.warn(`No se pudo registrar el omitido ${nombre}: ${error.message}`);
  }

  // ==========================================================================
  // Datos de apoyo
  // ==========================================================================

  /**
   * Cuenta desde la que salen los avisos. Con dos cuentas activas, `[0]` sin
   * `ORDER BY` hacía que el remitente cambiara solo entre días — inaceptable al
   * escribirle a proveedores externos. Se toma la del parámetro
   * `PPD_REP_CUENTA_REMITENTE`; si no está o no coincide, la primera por `id`.
   */
  private async cuentaRemitente(): Promise<Credenciales | null> {
    const activas = await this.cuentas.activas();
    if (activas.length === 0) return null;
    const orden = [...activas].sort((a, b) => a.id.localeCompare(b.id));

    const { data } = await this.supabase.admin
      .from('SPHConfiguraciones')
      .select('valor')
      .eq('parametro', PARAM_CUENTA_REMITENTE)
      .eq('status', true)
      .maybeSingle();
    const preferida = (data?.valor ?? '').trim().toLowerCase();
    return (
      orden.find((c) => c.email.trim().toLowerCase() === preferida) ?? orden[0]!
    );
  }

  private async cargarUsuarios(
    lista: RepPendiente[],
  ): Promise<Map<string, Persona>> {
    const uids = [
      ...new Set(
        lista.flatMap((p) => [p.uidr, p.autorizo]).filter((x): x is string => !!x),
      ),
    ];
    const mapa = new Map<string, Persona>();
    if (uids.length === 0) return mapa;
    const { data, error } = await this.supabase.admin
      .from('catUsers')
      .select('uid, email, nomCompleto, nombre')
      .in('uid', uids);
    if (error) {
      this.logger.error(`No se pudieron leer los usuarios: ${error.message}`);
      return mapa;
    }
    for (const u of data ?? [])
      mapa.set(u.uid, {
        email: u.email,
        nombre: u.nomCompleto ?? u.nombre ?? u.email ?? 'Usuario',
      });
    return mapa;
  }

  private async cargarProveedores(
    lista: RepPendiente[],
  ): Promise<Map<string, Persona>> {
    const ids = [
      ...new Set(lista.map((p) => p.idProveedor).filter((x): x is string => !!x)),
    ];
    const mapa = new Map<string, Persona>();
    if (ids.length === 0) return mapa;
    const { data, error } = await this.supabase.admin
      .from('catProveedores')
      .select('idProveedor, razonSocial, email')
      .in('idProveedor', ids);
    if (error) {
      this.logger.error(`No se pudieron leer los proveedores: ${error.message}`);
      return mapa;
    }
    for (const p of data ?? [])
      mapa.set(p.idProveedor, {
        email: p.email,
        nombre: p.razonSocial ?? 'Proveedor',
      });
    return mapa;
  }

  // ==========================================================================
  // Plantillas
  // ==========================================================================

  private enlace(): string {
    const base = (this.config.get('APP_WEB_URL', { infer: true }) ?? '').replace(
      /\/+$/,
      '',
    );
    return base ? `${base}/cxp/ppd` : '';
  }

  private filasHtml(
    filas: RepPendiente[],
    columnas: 'proveedor' | 'folio',
  ): string {
    return filas
      .map(
        (f) => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;color:#374151">${escapar(
          columnas === 'proveedor' ? f.nombreProveedor : f.folio,
        )}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:12px;color:#6b7280">${escapar(
          columnas === 'proveedor' ? f.folio : fechaMx(f.fecPago),
        )}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap;color:#374151">${moneda(
          f.monto,
        )}</td>
      </tr>`,
      )
      .join('');
  }

  private marco(cuerpo: string, pie: string): string {
    return `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;color:#1f2a4d">
  <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:28px">
    ${cuerpo}
  </div>
  <p style="text-align:center;font-size:11px;color:#9ca3af;margin:18px 0">${pie}</p>
</div>`.trim();
  }

  private boton(texto: string): string {
    const url = this.enlace();
    if (!url) return '';
    return `
    <p style="text-align:center;margin:20px 0 8px">
      <a href="${escapar(url)}"
         style="display:inline-block;background:#1f2a4d;color:#ffffff;text-decoration:none;
                padding:12px 28px;border-radius:8px;font-size:15px;font-weight:bold">${escapar(texto)}</a>
    </p>`;
  }

  /**
   * Correo al PROVEEDOR. ⛔ Solo lleva información suya: sus folios, montos y
   * fechas. Nada de nombres de empleados, ni de otros proveedores.
   */
  private plantillaProveedor(
    nombre: string,
    filas: RepPendiente[],
    cfg: RepConfig,
  ): string {
    const total = filas.reduce((s, f) => s + f.monto, 0);
    const cuerpo = `
    <p style="font-size:16px;margin:0 0 12px">Estimado proveedor <strong>${escapar(nombre)}</strong>:</p>
    <p style="font-size:14px;line-height:1.6;color:#374151;margin:0 0 16px">
      Recibimos de su parte facturas con método de pago <strong>PPD</strong> que ya fueron
      pagadas, y de las cuales <strong>aún no contamos con su Complemento de Pago (REP)</strong>.
      El plazo para emitirlo vence el <strong>día ${cfg.diaBloqueoProveedor - 1}</strong> de este mes.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 16px;font-size:13px">
      <thead>
        <tr style="background:#1f2a4d;color:#ffffff">
          <th style="padding:8px 10px;text-align:left">Folio</th>
          <th style="padding:8px 10px;text-align:left">Fecha de pago</th>
          <th style="padding:8px 10px;text-align:right">Monto</th>
        </tr>
      </thead>
      <tbody>${this.filasHtml(filas, 'folio')}</tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="padding:8px 10px;text-align:right;font-weight:bold">Total</td>
          <td style="padding:8px 10px;text-align:right;font-weight:bold;white-space:nowrap">${moneda(total)}</td>
        </tr>
      </tfoot>
    </table>
    <p style="font-size:14px;line-height:1.6;color:#374151;margin:0 0 8px">
      Le pedimos <strong>responder este correo</strong> adjuntando el XML y PDF del complemento
      de pago correspondiente.
    </p>
    <p style="font-size:13px;line-height:1.6;color:#b91c1c;margin:12px 0 0">
      De no recibirlo dentro del plazo, no podremos procesar nuevas solicitudes de pago
      a su nombre hasta regularizarlo.
    </p>`;
    return this.marco(cuerpo, 'SPH Bienes Raíces — Cuentas por Pagar.');
  }

  /** Correo al SOLICITANTE: sus proveedores pendientes, consolidados. */
  private plantillaInterno(
    nombre: string,
    filas: RepPendiente[],
    cfg: RepConfig,
    esBloqueo: boolean,
  ): string {
    const total = filas.reduce((s, f) => s + f.monto, 0);
    const proveedores = new Set(filas.map((f) => f.nombreProveedor)).size;
    const intro = esBloqueo
      ? `<p style="font-size:14px;line-height:1.6;color:#374151;margin:0 0 16px">
           <strong style="color:#b91c1c">Mañana (día ${cfg.diaBloqueoUsuario}) quedarás bloqueado</strong>
           para crear solicitudes de pago de cualquier tipo, porque estos pagos que
           gestionaste siguen sin su Complemento de Pago (REP).
         </p>`
      : `<p style="font-size:14px;line-height:1.6;color:#374151;margin:0 0 16px">
           Tienes <strong>${filas.length} pago(s)</strong> de <strong>${proveedores} proveedor(es)</strong>
           sin su Complemento de Pago (REP). El plazo del proveedor vence el
           <strong>día ${cfg.diaBloqueoProveedor - 1}</strong>; después de esa fecha no se le podrán
           generar nuevas solicitudes de pago.
         </p>`;
    const cuerpo = `
    <p style="font-size:16px;margin:0 0 12px">Hola ${escapar(nombre)},</p>
    ${intro}
    <table style="width:100%;border-collapse:collapse;margin:0 0 8px;font-size:13px">
      <thead>
        <tr style="background:#1f2a4d;color:#ffffff">
          <th style="padding:8px 10px;text-align:left">Proveedor</th>
          <th style="padding:8px 10px;text-align:left">Folio</th>
          <th style="padding:8px 10px;text-align:right">Monto</th>
        </tr>
      </thead>
      <tbody>${this.filasHtml(filas, 'proveedor')}</tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="padding:8px 10px;text-align:right;font-weight:bold">Total</td>
          <td style="padding:8px 10px;text-align:right;font-weight:bold;white-space:nowrap">${moneda(total)}</td>
        </tr>
      </tfoot>
    </table>
    ${this.boton('Subir complementos')}`;
    return this.marco(
      cuerpo,
      'SPH Bienes Raíces — Mensaje automático, no respondas a este correo.',
    );
  }

  /** Correo ÚNICO al GERENTE: todo lo que autorizó, más lo que no se pudo avisar. */
  private plantillaGerente(
    nombre: string,
    filas: RepPendiente[],
    usuarios: Map<string, Persona>,
    cfg: RepConfig,
    sinCorreo: string[],
  ): string {
    const total = filas.reduce((s, f) => s + f.monto, 0);
    const proveedores = new Set(filas.map((f) => f.nombreProveedor)).size;
    const porSolicitante = new Map<string, number>();
    for (const f of filas) {
      const n = f.uidr ? (usuarios.get(f.uidr)?.nombre ?? 'Sin asignar') : 'Sin asignar';
      porSolicitante.set(n, (porSolicitante.get(n) ?? 0) + 1);
    }
    const resumen = [...porSolicitante.entries()]
      .map(([n, c]) => `${escapar(n)} (${c})`)
      .join(' · ');

    const aviso =
      sinCorreo.length > 0
        ? `<p style="font-size:13px;line-height:1.6;color:#b45309;background:#fffbeb;
                     border:1px solid #fde68a;border-radius:8px;padding:12px;margin:0 0 16px">
             <strong>No se pudo avisar a ${sinCorreo.length} proveedor(es)</strong> por no tener
             correo registrado: ${escapar(sinCorreo.join(', '))}. Hay que capturarlo en su ficha
             para que reciban el aviso.
           </p>`
        : '';

    const cuerpo = `
    <p style="font-size:16px;margin:0 0 12px">Hola ${escapar(nombre)},</p>
    <p style="font-size:14px;line-height:1.6;color:#374151;margin:0 0 16px">
      <strong>Mañana (día ${cfg.diaBloqueoProveedor})</strong> vence el plazo del Complemento de
      Pago (REP) de <strong>${filas.length} pago(s)</strong> que autorizaste, de
      <strong>${proveedores} proveedor(es)</strong>. Los proveedores que no lo emitan quedarán
      bloqueados para nuevas solicitudes.
    </p>
    ${aviso}
    <table style="width:100%;border-collapse:collapse;margin:0 0 8px;font-size:13px">
      <thead>
        <tr style="background:#1f2a4d;color:#ffffff">
          <th style="padding:8px 10px;text-align:left">Proveedor</th>
          <th style="padding:8px 10px;text-align:left">Folio</th>
          <th style="padding:8px 10px;text-align:right">Monto</th>
        </tr>
      </thead>
      <tbody>${this.filasHtml(filas, 'proveedor')}</tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="padding:8px 10px;text-align:right;font-weight:bold">Total</td>
          <td style="padding:8px 10px;text-align:right;font-weight:bold;white-space:nowrap">${moneda(total)}</td>
        </tr>
      </tfoot>
    </table>
    <p style="font-size:12px;color:#6b7280;margin:0 0 4px">Solicitado por: ${resumen}</p>
    ${this.boton('Ver en el sistema')}`;
    return this.marco(
      cuerpo,
      'SPH Bienes Raíces — Mensaje automático, no respondas a este correo.',
    );
  }
}
