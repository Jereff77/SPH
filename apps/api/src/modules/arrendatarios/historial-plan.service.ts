import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { fallaBd } from '../../common/utils/db-error.js';
import type { CambioNota } from '../notas/notas.config.js';

export type TipoEventoHistorial =
  | 'plan_creado'
  | 'contrato'
  | 'cancelacion'
  | 'activacion'
  | 'liberacion'
  | 'inpc'
  | 'pago_aplicado'
  | 'pago_desaplicado'
  | 'cambio_manual';

/** Un renglón del Historial del plan (ya redactado: nunca JSON crudo de auditoría). */
export interface EventoHistorial {
  id: string;
  /** ISO. */
  fecha: string;
  tipo: TipoEventoHistorial;
  titulo: string;
  detalle: string | null;
  /** Solo `cambio_manual`: detalle desplegable de cada cambio. */
  cambios?: CambioNota[];
  autor: string | null;
  /** `montse` = aviso de MontseAI; `auditoria` = reconstruido de las tablas de trazabilidad. */
  origen: 'montse' | 'auditoria';
}

/** Tope de eventos devueltos (los más recientes). */
const LIMITE_EVENTOS = 300;
/** Margen antes del primer aviso de MontseAI: la auditoría se escribe segundos ANTES que su aviso. */
const MARGEN_CORTE_MS = 2 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Fila = Record<string, unknown>;
type Cambio = { antes?: unknown; despues?: unknown } | undefined;

const fmtFecha = (s: unknown): string => {
  const t = typeof s === 'string' ? s.slice(0, 10) : '';
  const [y, m, d] = t.split('-');
  return y && m && d ? `${d}/${m}/${y}` : '—';
};
const fmtDinero = (n: number): string =>
  `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const cambiosDe = (f: Fila): Record<string, Cambio> => (f.cambios ?? {}) as Record<string, Cambio>;

/**
 * Historial (solo lectura) de un plan de renta — pestaña «Historial» del panel de notas.
 *
 * Une: (1) avisos de MontseAI (`notasEntidad` tipo sistema) y (2) eventos reconstruidos
 * de `auditoria`, `arre_incrementos` y `arre_pagos`. Regla anti-duplicado: desde el
 * primer aviso de MontseAI, los eventos que ella ya avisa (contrato, cancelación,
 * activación, liberación, INPC) salen SOLO de su aviso; de las tablas de trazabilidad
 * se toman los anteriores a ese momento y los tipos que MontseAI no cubre (creación, pagos).
 * No se muestran los cambios de `arrePdpVigente` (los hace el cron diario) ni la corrida.
 */
@Injectable()
export class HistorialPlanService {
  private readonly logger = new Logger(HistorialPlanService.name);
  /** Instante del primer aviso de MontseAI en toda la plataforma (inmutable una vez conocido). */
  private corteMs: number | null = null;

  constructor(private readonly supabase: SupabaseService) {}

  /** Tablas nuevas o sin tipar: cliente sin tipar, localizado aquí (solo lectura). */
  private get db(): SupabaseClient {
    return this.supabase.admin as unknown as SupabaseClient;
  }

  /** Momento a partir del cual MontseAI cubre sus eventos (∞ si aún no ha avisado nada). */
  private async corte(): Promise<number> {
    if (this.corteMs !== null) return this.corteMs;
    const { data, error } = await this.db
      .from('notasEntidad')
      .select('fc')
      .eq('tipo', 'sistema')
      .order('fc', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) fallaBd(this.logger, 'historial.corte', error);
    if (!data) return Number.POSITIVE_INFINITY;
    this.corteMs = new Date((data as Fila).fc as string).getTime() - MARGEN_CORTE_MS;
    return this.corteMs;
  }

  async historial(idArrePdp: string): Promise<EventoHistorial[]> {
    const { data: plan, error: planErr } = await this.supabase.admin
      .from('arrePdp')
      .select('idArrePdp, idNavArrend, Moneda, fecInicio, fecFin, plazo')
      .eq('idArrePdp', idArrePdp)
      .maybeSingle();
    if (planErr) fallaBd(this.logger, 'historial.plan', planErr);
    if (!plan) throw new NotFoundException('Plan no encontrado.');

    const corte = await this.corte();
    const moneda = plan.Moneda ?? 'MXN';
    const db = this.db;

    // Cota superior para los eventos que MontseAI ya cubre (contrato, cancelación, liberación, INPC).
    const corteIso = Number.isFinite(corte) ? new Date(corte).toISOString() : null;
    let qPlanUpd = db
      .from('auditoria')
      .select('id, accion, uid, fc, cambios')
      .eq('entidad', 'arrePdp')
      .eq('id_entidad', idArrePdp)
      .eq('accion', 'UPDATE')
      // Solo los UPDATE que interesan: la vigencia diaria (arrePdpVigente) del cron NO entra.
      .or('cambios->contratoFirmado.not.is.null,cambios->canceladoAnticipado.not.is.null');
    if (corteIso) qPlanUpd = qPlanUpd.lt('fc', corteIso);

    const [audPlanIns, audPlan, audProp, incs, pagos, avisos, hermanos] = await Promise.all([
      // «Plan creado» va aparte (lo más viejo): ningún tope de filas lo puede dejar fuera.
      db
        .from('auditoria')
        .select('id, accion, uid, fc, cambios')
        .eq('entidad', 'arrePdp')
        .eq('id_entidad', idArrePdp)
        .eq('accion', 'INSERT')
        .order('fc', { ascending: true })
        .limit(1),
      qPlanUpd.order('fc', { ascending: false }).limit(500),
      db
        .from('auditoria')
        .select('id, accion, uid, fc, cambios, nuevo:registro_nuevo->>idArrePdp, ant:registro_anterior->>idArrePdp')
        .eq('entidad', 'arrenPropiedades')
        .eq('id_entidad', plan.idNavArrend ?? '')
        .eq('accion', 'UPDATE')
        .or('cambios->pdpActivo.not.is.null,cambios->status.not.is.null')
        .order('fc', { ascending: false })
        .limit(500),
      db
        .from('arre_incrementos')
        .select('id, anioAplicado, idInpc, inpcAplicado, ptsAplicados, estado, origen, fc, uidr, revertidoPor, fecReversion, motivoReversion, detalle')
        .eq('idArrePdp', idArrePdp),
      db
        .from('arre_pagos')
        .select('idmov, idArrePdpDet, monto, fecPago, uid, estado, aplicadoEn, desaplicadoPor, desaplicadoEn, motivoDesaplicacion')
        .eq('idArrePdp', idArrePdp),
      db
        .from('notasEntidad')
        .select('id, evento, texto, detalle, uid, fc, fa')
        .eq('modulo', 'arrendatarios')
        .eq('pantalla', 'planes-renta')
        .eq('entidadTipo', 'arrePdp')
        .eq('entidadId', idArrePdp)
        .eq('tipo', 'sistema')
        .order('fc', { ascending: false })
        .limit(LIMITE_EVENTOS),
      this.supabase.admin
        .from('arrePdp')
        .select('idArrePdp, fecFin')
        .eq('idNavArrend', plan.idNavArrend ?? '')
        .eq('status', true),
    ]);
    for (const [ctx, r] of [
      ['audPlanIns', audPlanIns],
      ['audPlan', audPlan],
      ['audProp', audProp],
      ['incrementos', incs],
      ['pagos', pagos],
      ['avisos', avisos],
      ['hermanos', hermanos],
    ] as const) {
      if (r.error) fallaBd(this.logger, `historial.${ctx}`, r.error);
    }

    // ¿Es el último plan de su nave? (la liberación de la nave se atribuye solo a él)
    const maxFin = (hermanos.data ?? []).reduce((m, p) => (p.fecFin && p.fecFin > m ? p.fecFin : m), '');
    const esUltimo = !maxFin || !plan.fecFin || plan.fecFin >= maxFin;

    // numPartida de las partidas pagadas (para «parcialidad #n»)
    const filasPago = (pagos.data ?? []) as Fila[];
    const numPartida = new Map<string, number>();
    if (filasPago.length) {
      // Por plan (no `.in` con cientos de ids: rebasaría la URL de PostgREST).
      const { data: dets, error: dErr } = await this.supabase.admin
        .from('arrePdpDetalle')
        .select('idArrePdpDet, numPartida')
        .eq('idArrePdp', idArrePdp);
      if (dErr) fallaBd(this.logger, 'historial.partidas', dErr);
      for (const d of dets ?? []) if (d.numPartida != null) numPartida.set(d.idArrePdpDet, d.numPartida);
    }

    const ev: Array<EventoHistorial & { uid: string | null }> = [];
    const push = (e: Omit<EventoHistorial, 'autor'> & { uid: string | null }) => ev.push({ ...e, autor: null });
    const antesDeMontse = (iso: string) => new Date(iso).getTime() < corte;

    // 1) auditoría de la cabecera del plan
    for (const f of (audPlanIns.data ?? []) as Fila[]) {
      push({
        id: `aud-${f.id as string}`, fecha: f.fc as string, uid: (f.uid as string | null) ?? null, origen: 'auditoria',
        tipo: 'plan_creado', titulo: 'Plan creado',
        detalle: `Vigencia ${fmtFecha(plan.fecInicio)} → ${fmtFecha(plan.fecFin)} · plazo de ${plan.plazo ?? '—'} meses`,
      });
    }
    for (const f of (audPlan.data ?? []) as Fila[]) {
      const fecha = f.fc as string;
      const uid = (f.uid as string | null) ?? null;
      const id = `aud-${f.id as string}`;
      if (!antesDeMontse(fecha)) continue;
      const c = cambiosDe(f);
      if (c.canceladoAnticipado?.despues === true) {
        const motivo = c.motivoCancelacion?.despues;
        push({
          id, fecha, uid, origen: 'auditoria', tipo: 'cancelacion', titulo: 'Cancelación anticipada',
          detalle: `Corte desde ${fmtFecha(c.fecCancelacion?.despues)}${typeof motivo === 'string' && motivo ? ` · Motivo: ${motivo}` : ''}`,
        });
      } else if (c.contratoFirmado) {
        const marcado = c.contratoFirmado.despues === true;
        push({
          id, fecha, uid, origen: 'auditoria', tipo: 'contrato',
          titulo: marcado ? 'Contrato firmado marcado' : 'Contrato firmado desmarcado',
          detalle: marcado ? 'Se vinculó el documento del contrato' : 'Se quitó el documento vinculado',
        });
      }
    }

    // 2) auditoría de la propiedad arrendada (activación / liberación de la nave)
    for (const f of (audProp.data ?? []) as Fila[]) {
      const fecha = f.fc as string;
      const uid = (f.uid as string | null) ?? null;
      const id = `aud-${f.id as string}`;
      const c = cambiosDe(f);
      const liberando = c.status?.antes === true && c.status?.despues === false;
      // Activar/desactivar: MontseAI no lo avisa como evento propio → siempre de la auditoría.
      // (Si la misma fila es una liberación, el desactivado es parte de ella: no se repite.)
      if (c.pdpActivo && !liberando) {
        const activa = c.pdpActivo.despues === true;
        const delPlan = (activa ? f.nuevo : f.ant) === idArrePdp;
        if (delPlan)
          push({
            id, fecha, uid, origen: 'auditoria', tipo: 'activacion',
            titulo: activa ? 'Plan activado' : 'Plan desactivado',
            detalle: activa ? 'La corrida queda congelada para consulta y cobranza' : 'El plan vuelve a ser editable',
          });
      }
      // Liberación: solo antes del primer aviso de MontseAI (después la avisa ella). Se atribuye al plan
      // que tenía la nave en esa fila; si ya se había soltado (idArrePdp nulo), al último plan de la nave.
      if (liberando && antesDeMontse(fecha) && (f.ant === idArrePdp || (!f.ant && esUltimo))) {
        const motivo = c.motivoBaja?.despues;
        push({
          id: `${id}-lib`, fecha, uid, origen: 'auditoria', tipo: 'liberacion', titulo: 'Nave liberada',
          detalle: typeof motivo === 'string' && motivo ? `Motivo: ${motivo}` : 'Queda disponible para rentar de nuevo',
        });
      }
    }

    // 3) bitácora de incrementos INPC (aplicados / revertidos antes de MontseAI)
    for (const i of (incs.data ?? []) as Fila[]) {
      const manual = i.idInpc === 'MANUAL';
      const anio = i.anioAplicado as number;
      if (antesDeMontse(i.fc as string)) {
        const pct = Number(i.inpcAplicado ?? 0) + Number(i.ptsAplicados ?? 0);
        const d = (i.detalle ?? {}) as { montoActual?: number; montoNuevo?: number; moneda?: string };
        const monto =
          d.montoActual != null && d.montoNuevo != null
            ? ` · monto mensual ${fmtDinero(d.montoActual)} → ${fmtDinero(d.montoNuevo)} ${d.moneda ?? moneda}`
            : '';
        push({
          id: `inc-${i.id as string}`, fecha: i.fc as string, uid: (i.uidr as string | null) ?? null, origen: 'auditoria',
          tipo: 'inpc',
          titulo: manual ? `Edición manual del INPC (año ${anio})` : 'Incremento INPC aplicado',
          detalle: manual ? null : `Año ${anio} · +${pct.toFixed(2)} %${monto}`,
        });
      }
      if (i.estado === 'revertido' && i.fecReversion && antesDeMontse(i.fecReversion as string)) {
        push({
          id: `inc-rev-${i.id as string}`, fecha: i.fecReversion as string, uid: (i.revertidoPor as string | null) ?? null,
          origen: 'auditoria', tipo: 'inpc', titulo: `Incremento INPC del año ${anio} revertido`,
          detalle: i.motivoReversion ? `Motivo: ${i.motivoReversion as string}` : null,
        });
      }
    }

    // 4) pagos aplicados / desaplicados (MontseAI no los cubre → siempre de la bitácora de pagos)
    const grupos = new Map<string, { filas: Fila[]; desaplicado: boolean }>();
    for (const p of filasPago) {
      if (p.aplicadoEn) {
        const k = `a|${p.idmov as string}|${p.aplicadoEn as string}`;
        (grupos.get(k) ?? grupos.set(k, { filas: [], desaplicado: false }).get(k)!).filas.push(p);
      }
      if (p.estado === 'desaplicado' && p.desaplicadoEn) {
        const k = `d|${p.idmov as string}|${p.desaplicadoEn as string}`;
        (grupos.get(k) ?? grupos.set(k, { filas: [], desaplicado: true }).get(k)!).filas.push(p);
      }
    }
    for (const [k, g] of grupos) {
      const f0 = g.filas[0]!;
      const partidas = [...new Set(g.filas.map((p) => numPartida.get(p.idArrePdpDet as string)).filter((n): n is number => n != null))].sort((a, b) => a - b);
      const parc = partidas.length ? `parcialidad${partidas.length > 1 ? 'es' : ''} ${partidas.map((n) => `#${n}`).join(', ')}` : `${g.filas.length} partida(s)`;
      const total = g.filas.reduce((s, p) => s + Number(p.monto ?? 0), 0);
      if (!g.desaplicado) {
        push({
          id: `pago-${k}`, fecha: f0.aplicadoEn as string, uid: (f0.uid as string | null) ?? null, origen: 'auditoria',
          tipo: 'pago_aplicado', titulo: 'Pago aplicado',
          detalle: `${fmtDinero(total)} ${moneda} · ${parc} · depósito del ${fmtFecha(f0.fecPago)}`,
        });
      } else {
        const motivo = f0.motivoDesaplicacion;
        push({
          id: `pago-${k}`, fecha: f0.desaplicadoEn as string, uid: (f0.desaplicadoPor as string | null) ?? null, origen: 'auditoria',
          tipo: 'pago_desaplicado', titulo: 'Pago desaplicado',
          detalle: `${fmtDinero(total)} ${moneda} · ${parc}${typeof motivo === 'string' && motivo ? ` · Motivo: ${motivo}` : ''}`,
        });
      }
    }

    // 5) avisos de MontseAI (desde su primer aviso)
    for (const a of (avisos.data ?? []) as Fila[]) {
      const d = (a.detalle ?? {}) as { cambios?: CambioNota[]; revertido?: boolean; origen?: string; contratoFirmado?: boolean; anio?: number };
      const texto = a.texto as string;
      const base = { id: `montse-${a.id as string}`, fecha: (a.fa as string) ?? (a.fc as string), uid: (a.uid as string | null) ?? null, origen: 'montse' as const };
      switch (a.evento) {
        case 'cambio_manual':
          push({ ...base, tipo: 'cambio_manual', titulo: texto, detalle: null, cambios: Array.isArray(d.cambios) ? d.cambios : [] });
          break;
        case 'inpc':
          push({
            ...base, tipo: 'inpc', detalle: texto,
            titulo: d.revertido ? `Incremento INPC del año ${d.anio ?? ''} revertido`.replace('  ', ' ') : d.origen === 'reaplicacion' ? 'Incremento INPC re-aplicado' : 'Incremento INPC aplicado',
          });
          break;
        case 'contrato':
          push({ ...base, tipo: 'contrato', titulo: d.contratoFirmado ? 'Contrato firmado marcado' : 'Contrato firmado desmarcado', detalle: texto.split(': ').slice(1).join(': ') || null });
          break;
        case 'cancelacion':
          push({ ...base, tipo: 'cancelacion', titulo: 'Cancelación anticipada', detalle: texto });
          break;
        case 'liberacion':
          push({ ...base, tipo: 'liberacion', titulo: 'Nave liberada', detalle: texto });
          break;
        default:
          break;
      }
    }

    ev.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    const recientes = ev.slice(0, LIMITE_EVENTOS);

    // nombres de quienes actuaron
    const uids = [...new Set(recientes.map((e) => e.uid).filter((u): u is string => !!u && UUID_RE.test(u)))];
    const nombres = new Map<string, string>();
    if (uids.length) {
      const { data: us, error: uErr } = await this.supabase.admin
        .from('catUsers')
        .select('uid, nomCompleto, nombre, apellidos')
        .in('uid', uids);
      if (uErr) fallaBd(this.logger, 'historial.autores', uErr);
      for (const u of us ?? [])
        nombres.set(u.uid, u.nomCompleto?.trim() || [u.nombre, u.apellidos].filter(Boolean).join(' ').trim() || 'Usuario');
    }
    return recientes.map(({ uid, ...e }) => ({ ...e, autor: uid ? (nombres.get(uid) ?? null) : null }));
  }
}
