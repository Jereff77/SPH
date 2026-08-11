import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { InvitacionesMailer } from '../invitaciones/invitaciones.mailer.js';
import { RegistroCronService } from '../../common/cron/registro-cron.service.js';
import { TAREA_KVAS_COMPROMISOS } from '../../common/cron/cron.tareas.js';
import type { Env } from '../../common/config/env.validation.js';

/** Horas antes del vencimiento en que sale el segundo aviso. */
const HORAS_AVISO_FINAL = 4;
/** Días antes del vencimiento en que sale el primer aviso. */
const DIAS_AVISO_PREVIO = 3;

/** Resultado de una corrida (queda como `detalle` en la bitácora de cron). */
interface ResultadoCompromisos {
  avisosPrevios: number;
  avisosFinales: number;
  liberados: number;
  kvasLiberados: number;
  parquesTocados: number;
}

/** Un compromiso, con todo lo que el correo necesita decir. */
interface Compromiso {
  idKvas: string;
  idParque: string;
  idNave: string;
  nave: string;
  parque: string;
  nivel: string;
  cantKvas: number;
  vence: string;
  uidr: string | null;
}

const escapar = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const fmt = (n: number) => n.toLocaleString('es-MX', { maximumFractionDigits: 2 });

const cuando = (iso: string) =>
  new Date(iso).toLocaleString('es-MX', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Mexico_City',
  });

const nivelTexto = (n: string) => (n === 'MT' ? 'media' : 'baja');

/**
 * Ciclo de vida de los KVA **comprometidos** (apartados para una negociación).
 *
 * Un compromiso dura 10 días y es renovable. Mientras vive, descuenta del
 * disponible del parque, así que dejarlo eterno sería apartar capacidad que
 * nadie va a usar. Este proceso lo cierra, avisando tres veces:
 *
 *   1. A **3 días** del vencimiento — «tu apartado vence el …»
 *   2. A **4 horas** — «en 4 horas se eliminará el apartado»
 *   3. Al **liberarlo** — «se liberaron los N KVA que tenías apartados»
 *
 * Cada aviso sale **una sola vez** (`avisoPrevio` / `avisoFinal` lo marcan). Al
 * renovar, ambas marcas se limpian y el ciclo empieza de nuevo.
 *
 * ⏰ Corre **cada hora**, no a diario: con granularidad de día es imposible
 * acertarle a la ventana de 4 horas.
 *
 * ⛔ Al vencer **BORRA** la fila (decisión de Jereff: «para que la suma nos dé
 * correcto»). No se pierde el rastro: `trg_auditoria` registra el DELETE con la
 * fila completa, así que se puede responder quién apartó qué y no lo concretó.
 */
@Injectable()
export class KvasCompromisosScheduler {
  private readonly logger = new Logger(KvasCompromisosScheduler.name);
  private corriendo = false;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly mailer: InvitacionesMailer,
    private readonly registro: RegistroCronService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Al minuto 5 de cada hora (fuera del pico de los schedulers en punto). */
  @Cron('5 * * * *', { name: TAREA_KVAS_COMPROMISOS })
  async revisar(): Promise<void> {
    await this.ejecutar('programada');
  }

  private static vacio(): ResultadoCompromisos {
    return {
      avisosPrevios: 0,
      avisosFinales: 0,
      liberados: 0,
      kvasLiberados: 0,
      parquesTocados: 0,
    };
  }

  /** Corre la tarea registrándola en la bitácora de cron (o desde la pantalla Cron). */
  async ejecutar(
    origen: 'programada' | 'manual',
    ejecutadoPor?: string | null,
  ): Promise<ResultadoCompromisos> {
    if (this.corriendo) return KvasCompromisosScheduler.vacio();
    this.corriendo = true;
    try {
      return await this.registro.ejecutarYRegistrar(
        TAREA_KVAS_COMPROMISOS,
        origen,
        () => this.procesar(),
        ejecutadoPor,
      );
    } catch (e) {
      this.logger.warn(`Compromisos de KVA: ${(e as Error).message}`);
      if (origen === 'manual') throw e;
      return KvasCompromisosScheduler.vacio();
    } finally {
      this.corriendo = false;
    }
  }

  async procesar(): Promise<ResultadoCompromisos> {
    const res = KvasCompromisosScheduler.vacio();

    const { data, error } = await this.supabase.admin
      .from('kvasAsignados')
      .select(
        'idKvas, idParque, idNave, nivel, cantKvas, venceCompromiso, avisoPrevio, avisoFinal, uidr',
      )
      .eq('etapa', 'COMPROMETIDO')
      .eq('status', true)
      .range(0, 4999);
    if (error) {
      this.logger.error(`No se pudieron leer los compromisos: ${error.message}`);
      return res;
    }
    const filas = (data ?? []).filter((f) => f.venceCompromiso);
    if (filas.length === 0) return res;

    const ahora = Date.now();
    const umbralPrevio = ahora + DIAS_AVISO_PREVIO * 86_400_000;
    const umbralFinal = ahora + HORAS_AVISO_FINAL * 3_600_000;

    const vencidos = filas.filter((f) => new Date(f.venceCompromiso!).getTime() <= ahora);
    const porAvisarFinal = filas.filter(
      (f) =>
        !f.avisoFinal &&
        new Date(f.venceCompromiso!).getTime() > ahora &&
        new Date(f.venceCompromiso!).getTime() <= umbralFinal,
    );
    const porAvisarPrevio = filas.filter(
      (f) =>
        !f.avisoPrevio &&
        new Date(f.venceCompromiso!).getTime() > umbralFinal &&
        new Date(f.venceCompromiso!).getTime() <= umbralPrevio,
    );

    if (vencidos.length === 0 && porAvisarFinal.length === 0 && porAvisarPrevio.length === 0)
      return res;

    // Etiquetas de nave/parque y correos, en dos consultas (nada de N+1).
    const ctx = await this.contexto([...vencidos, ...porAvisarFinal, ...porAvisarPrevio]);

    // ---- Aviso 1: faltan 3 días ----
    for (const f of porAvisarPrevio) {
      const c = ctx.compromiso(f);
      const ok = await this.avisar(c, ctx.correo(f.uidr), 'previo');
      if (ok) {
        res.avisosPrevios++;
        await this.marcar(f.idKvas, 'avisoPrevio');
      }
    }

    // ---- Aviso 2: faltan 4 horas ----
    for (const f of porAvisarFinal) {
      const c = ctx.compromiso(f);
      const ok = await this.avisar(c, ctx.correo(f.uidr), 'final');
      if (ok) {
        res.avisosFinales++;
        await this.marcar(f.idKvas, 'avisoFinal');
      }
    }

    // ---- Liberación: borrar y avisar ----
    // Se aísla por parque: un parque que falle no aborta el resto.
    const parques = new Set<string>();
    for (const f of vencidos) {
      const c = ctx.compromiso(f);
      const { error: errDel } = await this.supabase.admin
        .from('kvasAsignados')
        .delete()
        .eq('idKvas', f.idKvas);
      if (errDel) {
        this.logger.error(
          `No se pudo liberar el compromiso ${f.idKvas}: ${errDel.message}`,
        );
        continue;
      }
      res.liberados++;
      res.kvasLiberados += Number(f.cantKvas ?? 0);
      parques.add(f.idParque);
      // El correo va DESPUÉS del borrado: solo se avisa lo que de verdad pasó.
      await this.avisar(c, ctx.correo(f.uidr), 'liberado');
    }

    // El saldo NO se recalcula desde aquí: el trigger `trg_kvasasignados_recalcular`
    // es AFTER DELETE FOR EACH ROW, así que cada borrado ya devolvió sus KVA al
    // parque. Llamarlo otra vez sería duplicar trabajo y, peor, abrir una segunda
    // ruta para escribir el saldo — que es justo lo que el diseño prohíbe.
    res.parquesTocados = parques.size;

    this.logger.log(
      `Compromisos: ${res.avisosPrevios} aviso(s) previo(s), ${res.avisosFinales} final(es), ` +
        `${res.liberados} liberado(s) (${fmt(res.kvasLiberados)} KVA).`,
    );
    return res;
  }

  /** Resuelve nave, parque y correo del responsable en dos consultas. */
  private async contexto(
    filas: { idNave: string; idParque: string; uidr: string | null }[],
  ) {
    const idsNave = [...new Set(filas.map((f) => f.idNave))];
    const idsParque = [...new Set(filas.map((f) => f.idParque))];
    const uids = [...new Set(filas.map((f) => f.uidr).filter((u): u is string => !!u))];

    const [naves, parques, users] = await Promise.all([
      idsNave.length
        ? this.supabase.admin.from('naves').select('idNave, numNaveNAME').in('idNave', idsNave)
        : Promise.resolve({ data: [] as { idNave: string; numNaveNAME: string | null }[] }),
      idsParque.length
        ? this.supabase.admin
            .from('parques')
            .select('idParque, nomParque')
            .in('idParque', idsParque)
        : Promise.resolve({
            data: [] as { idParque: string; nomParque: string | null }[],
          }),
      uids.length
        ? this.supabase.admin
            .from('catUsers')
            .select('uid, email, nomCompleto, nombre, status')
            .in('uid', uids)
        : Promise.resolve({ data: [] as never[] }),
    ]);

    const mapNave = new Map((naves.data ?? []).map((n) => [n.idNave, n.numNaveNAME ?? '']));
    const mapParque = new Map(
      (parques.data ?? []).map((p) => [p.idParque, p.nomParque ?? '']),
    );
    const mapUser = new Map(
      (users.data ?? []).map((u) => [
        u.uid,
        {
          email: u.status === true ? u.email : null,
          nombre: u.nomCompleto ?? u.nombre ?? u.email ?? u.uid,
        },
      ]),
    );

    return {
      compromiso: (f: {
        idKvas: string;
        idParque: string;
        idNave: string;
        nivel: string;
        cantKvas: number;
        venceCompromiso: string | null;
        uidr: string | null;
      }): Compromiso => ({
        idKvas: f.idKvas,
        idParque: f.idParque,
        idNave: f.idNave,
        nave: mapNave.get(f.idNave) ?? f.idNave,
        parque: mapParque.get(f.idParque) ?? '',
        nivel: f.nivel,
        cantKvas: Number(f.cantKvas ?? 0),
        vence: f.venceCompromiso ?? '',
        uidr: f.uidr,
      }),
      correo: (uid: string | null) => (uid ? (mapUser.get(uid) ?? null) : null),
    };
  }

  private async marcar(idKvas: string, campo: 'avisoPrevio' | 'avisoFinal') {
    const ahora = new Date().toISOString();
    const { error } = await this.supabase.admin
      .from('kvasAsignados')
      .update(campo === 'avisoPrevio' ? { avisoPrevio: ahora } : { avisoFinal: ahora })
      .eq('idKvas', idKvas);
    if (error)
      this.logger.warn(`No se pudo marcar ${campo} de ${idKvas}: ${error.message}`);
  }

  /** Envía uno de los tres avisos. Devuelve si salió. Nunca lanza. */
  private async avisar(
    c: Compromiso,
    destino: { email: string | null; nombre: string } | null,
    tipo: 'previo' | 'final' | 'liberado',
  ): Promise<boolean> {
    if (!this.mailer.disponible) {
      this.logger.warn('SMTP (SMTP_INVITACIONES_*) no configurado; no se avisa.');
      return false;
    }
    if (!destino?.email) {
      // Sin destinatario NO se bloquea la liberación: el apartado igual caduca.
      this.logger.warn(
        `Compromiso ${c.idKvas}: sin correo del responsable; se omite el aviso «${tipo}».`,
      );
      return false;
    }

    const cant = `${fmt(c.cantKvas)} KVA de ${nivelTexto(c.nivel)}`;
    const asunto =
      tipo === 'previo'
        ? `Tu apartado de ${cant} en la nave ${c.nave} vence pronto`
        : tipo === 'final'
          ? `En ${HORAS_AVISO_FINAL} horas se eliminará tu apartado en la nave ${c.nave}`
          : `Se liberaron los ${cant} que tenías apartados en la nave ${c.nave}`;

    const html = this.plantilla(c, destino.nombre, tipo);
    try {
      return await this.mailer.enviarHtml(destino.email, asunto, html);
    } catch (e) {
      this.logger.error(`Fallo al avisar ${c.idKvas}: ${(e as Error).message}`);
      return false;
    }
  }

  /** Plantilla HTML, con el mismo estilo inline del resto del ERP. */
  private plantilla(
    c: Compromiso,
    nombre: string,
    tipo: 'previo' | 'final' | 'liberado',
  ): string {
    const baseUrl = (this.config.get('APP_WEB_URL', { infer: true }) ?? '').replace(
      /\/$/,
      '',
    );
    const enlace = `${baseUrl}/parques/kvas`;
    const cant = `${fmt(c.cantKvas)} KVA de ${nivelTexto(c.nivel)}`;
    const acento = tipo === 'liberado' ? '#6b7280' : tipo === 'final' ? '#b45309' : '#1f2a4d';

    const cuerpo =
      tipo === 'previo'
        ? `Tienes <strong>${cant}</strong> apartados en la <strong>nave ${escapar(c.nave)}</strong>
           de ${escapar(c.parque)}. El apartado <strong>vence el ${escapar(cuando(c.vence))}</strong>.
           Si la negociación sigue en pie, renuévalo; si no, los KVA volverán al parque.`
        : tipo === 'final'
          ? `Quedan menos de <strong>${HORAS_AVISO_FINAL} horas</strong> para que se elimine tu apartado
             de <strong>${cant}</strong> en la <strong>nave ${escapar(c.nave)}</strong>
             de ${escapar(c.parque)}. Vence el ${escapar(cuando(c.vence))}.
             Es el último aviso: después, los KVA se liberan automáticamente.`
          : `Se liberaron los <strong>${cant}</strong> que tenías apartados en la
             <strong>nave ${escapar(c.nave)}</strong> de ${escapar(c.parque)}: el apartado
             venció y volvió al parque. Si la negociación sigue viva, vuelve a apartarlos.`;

    const boton = tipo === 'liberado' ? 'Ver KVA del parque' : 'Renovar el apartado';

    return `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1f2a4d">
  <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:28px">
    <p style="font-size:16px;margin:0 0 12px">Hola ${escapar(nombre)},</p>
    <p style="font-size:14px;line-height:1.6;color:#374151;margin:0 0 20px">${cuerpo}</p>
    <p style="text-align:center;margin:0 0 8px">
      <a href="${escapar(enlace)}"
         style="display:inline-block;background:${acento};color:#ffffff;text-decoration:none;
                padding:12px 28px;border-radius:8px;font-size:15px;font-weight:bold">
        ${boton}
      </a>
    </p>
    <p style="font-size:12px;word-break:break-all;color:#3f5b87;margin:0">${escapar(enlace)}</p>
  </div>
  <p style="text-align:center;font-size:11px;color:#9ca3af;margin:18px 0">
    SPH Bienes Raíces — Mensaje automático, no respondas a este correo.
  </p>
</div>`.trim();
  }
}
