import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { fallaBd } from '../../common/utils/db-error.js';
import { IncrementosNotificadorService } from './incrementos-notificador.service.js';
import type { Json } from '@erp/types';

/** Tolerancia para comparar pm2 (los valores traen hasta 8 decimales). */
const EPSILON_PM2 = 0.0001;
/** Desfase de meses por defecto si falta la configuración. */
const DESFASE_DEFAULT = 3;
/** Sentinela de `idInpc` cuando el registro nace de una edición manual. */
export const ID_INPC_MANUAL = 'MANUAL';

export interface ConceptoPreview {
  concepto: string;
  pm2Base: number;
  pts: number;
  pm2Nuevo: number;
  montoActual: number;
  montoNuevo: number;
}

export interface PlanPreview {
  idArrePdp: string;
  empresa: string;
  parque: string;
  idParque: string;
  nave: string;
  moneda: string;
  aniversario: string; // yyyy-mm-dd
  anioObjetivo: number;
  incrementoPct: number; // inpc + pts predominantes del plan
  montoActual: number;
  montoNuevo: number;
  conceptos: ConceptoPreview[];
  estatus: 'aplicable' | 'omitido' | 'manual';
  motivo?: string;
  /** Si ya está aplicado: id de la fila de bitácora y valor con el que se aplicó. */
  idIncremento?: string;
  inpcAplicadoPrevio?: number;
  /** Aplicado con un INPC distinto al vigente ⇒ ofrecible "revertir y re-aplicar". */
  requiereReaplicacion?: boolean;
  /** Manual SOLO por aniversario pasado (sin pagos ni otros bloqueos): una
   *  re-aplicación por corrección confirmada puede promoverlo a aplicable. */
  soloTardio?: boolean;
}

export interface PreviewIncrementos {
  inpc: { id: string; anio: number; mes: number; valor: number };
  desfaseMeses: number;
  mesAplicacion: { anio: number; mes: number };
  aplicables: PlanPreview[];
  omitidos: PlanPreview[];
  manuales: PlanPreview[];
}

interface FilaDetalle {
  idArrePdp: string;
  numPartida: number | null;
  anio: number;
  concepto: string | null;
  pm2: number;
  constM2: number;
  ptsINPC: number;
  INPC: number;
  cantidad: number | null;
  fecPago: string | null;
  cantidadAplicada: number | null;
  aplicaInpc: boolean;
}

/** Forma del jsonb que devuelve la RPC `arrepdp_aplicar_incremento_inpc`. */
interface RpcAplicar {
  exito: boolean;
  codigo: string;
  mensaje?: string;
  anio?: number;
  conceptos?: Json;
  previo?: Json;
  filasActualizadas?: number;
  partidasPagadas?: number;
}

/**
 * Arrendatarios · Incrementos de renta por INPC (permiso 212 — quien captura el
 * INPC en Parámetros dispara el flujo). Vista previa → confirmación → aplicación
 * vía RPC `arrepdp_aplicar_incremento_inpc` (atómica por plan, por rango de
 * partidas, solo filas `aplicaInpc=true`) → registro en `arre_incrementos`
 * (candado único anti doble aplicación + snapshot para reversión). Diseño:
 * `base-conocimiento/PLAN-incrementos-inpc-automaticos.md`.
 */
@Injectable()
export class IncrementosService {
  private readonly logger = new Logger(IncrementosService.name);
  private cacheDesfase: { valor: number; expira: number } | null = null;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly notificador: IncrementosNotificadorService,
  ) {}

  /** Desfase de meses configurado (SPHConfiguraciones, caché 5 min). */
  async desfaseMeses(): Promise<number> {
    if (this.cacheDesfase && this.cacheDesfase.expira > Date.now()) {
      return this.cacheDesfase.valor;
    }
    const { data, error } = await this.supabase.admin
      .from('SPHConfiguraciones')
      .select('valor')
      .eq('parametro', 'ARRE_INPC_DESFASE_MESES')
      .eq('status', true)
      .maybeSingle();
    if (error) throw fallaBd(this.logger, 'incrementos.desfase', error);
    const n = Number(data?.valor);
    const valor = Number.isInteger(n) && n >= 1 && n <= 11 ? n : DESFASE_DEFAULT;
    this.cacheDesfase = { valor, expira: Date.now() + 5 * 60 * 1000 };
    return valor;
  }

  // ============================ Vista previa ============================

  /**
   * Clasifica los planes que corresponden a un INPC capturado:
   * `aplicables` (recibirían el incremento tal cual), `omitidos` (ya tienen
   * registro en la bitácora para ese año) y `manuales` (el automático no debe
   * decidir: aniversario pasado, dinero cobrado en el año, o montos ya
   * modificados sin bitácora — p. ej. aplicaciones parciales previas).
   */
  async preview(idInpc: string): Promise<PreviewIncrementos> {
    // 1) Registro oficial de INPC
    const { data: inpc, error: inpcErr } = await this.supabase.admin
      .from('inpc')
      .select('id, anio, mes, inpc')
      .eq('id', idInpc)
      .maybeSingle();
    if (inpcErr) throw fallaBd(this.logger, 'incrementos.preview.inpc', inpcErr);
    if (!inpc) throw new NotFoundException('El registro de INPC no existe.');

    // 2) Mes de aplicación = mes del INPC + desfase (con salto de año)
    const desfase = await this.desfaseMeses();
    const idx = inpc.mes - 1 + desfase;
    const mesAplic = (idx % 12) + 1;
    const anioAplic = inpc.anio + Math.floor(idx / 12);

    // 3) Planes vigentes con aniversario en ese mes (universo pequeño: se
    //    filtra en memoria; extract(month) no existe en el query builder)
    const { data: planes, error: planErr } = await this.supabase.admin
      .from('arrePdp')
      .select('idArrePdp, idArrendador, idNavArrend, fecInicio, fecFin, plazo, INPCPlus, Moneda')
      .eq('status', true)
      .eq('vigente', true);
    if (planErr) throw fallaBd(this.logger, 'incrementos.preview.planes', planErr);

    const candidatos = (planes ?? []).filter((p) => {
      if (!p.fecInicio) return false;
      const ini = new Date(`${p.fecInicio}T00:00:00`);
      return ini.getMonth() + 1 === mesAplic && ini.getFullYear() < anioAplic;
    });

    const vacio: PreviewIncrementos = {
      inpc: { id: inpc.id, anio: inpc.anio, mes: inpc.mes, valor: Number(inpc.inpc) },
      desfaseMeses: desfase,
      mesAplicacion: { anio: anioAplic, mes: mesAplic },
      aplicables: [],
      omitidos: [],
      manuales: [],
    };
    if (!candidatos.length) return vacio;

    // 4) Contexto: activos, parque/nave, empresa y bitácora existente
    const idsNav = [...new Set(candidatos.map((p) => p.idNavArrend))];
    const idsPlan = candidatos.map((p) => p.idArrePdp);
    const idsArr = [...new Set(candidatos.map((p) => p.idArrendador))];

    const [propsQ, invQ, bitacoraQ] = await Promise.all([
      this.supabase.admin
        .from('arrenPropiedades')
        .select('idNavArrend, idParque, idNave, pdpActivo')
        .in('idNavArrend', idsNav)
        .eq('status', true),
      this.supabase.admin
        .from('inversionista')
        .select('idInversionista, razonsocial')
        .in('idInversionista', idsArr),
      this.supabase.admin
        .from('arre_incrementos')
        .select('id, idArrePdp, anioAplicado, origen, fc, inpcAplicado, detalle')
        .in('idArrePdp', idsPlan)
        .eq('estado', 'aplicado'),
    ]);
    if (propsQ.error) throw fallaBd(this.logger, 'incrementos.preview.props', propsQ.error);
    if (invQ.error) throw fallaBd(this.logger, 'incrementos.preview.inv', invQ.error);
    if (bitacoraQ.error) throw fallaBd(this.logger, 'incrementos.preview.bitacora', bitacoraQ.error);

    const props = new Map((propsQ.data ?? []).map((r) => [r.idNavArrend, r]));
    const empresas = new Map((invQ.data ?? []).map((r) => [r.idInversionista, r.razonsocial ?? '—']));
    const yaAplicados = new Map(
      (bitacoraQ.data ?? []).map((r) => [`${r.idArrePdp}|${r.anioAplicado}`, r]),
    );

    const idsParque = [...new Set([...props.values()].map((r) => r.idParque).filter(Boolean))] as string[];
    const idsNave = [...new Set([...props.values()].map((r) => r.idNave).filter(Boolean))] as string[];
    const [parquesQ, navesQ] = await Promise.all([
      idsParque.length
        ? this.supabase.admin.from('parques').select('idParque, nomParque').in('idParque', idsParque)
        : Promise.resolve({ data: [], error: null } as const),
      idsNave.length
        ? this.supabase.admin.from('naves').select('idNave, numNave, numNaveNAME').in('idNave', idsNave)
        : Promise.resolve({ data: [], error: null } as const),
    ]);
    if (parquesQ.error) throw fallaBd(this.logger, 'incrementos.preview.parques', parquesQ.error);
    if (navesQ.error) throw fallaBd(this.logger, 'incrementos.preview.naves', navesQ.error);
    const parques = new Map((parquesQ.data ?? []).map((r) => [r.idParque, r.nomParque ?? '—']));
    const naves = new Map(
      (navesQ.data ?? []).map((r) => [r.idNave, r.numNaveNAME ?? String(r.numNave ?? '—')]),
    );

    // 5) Clasificación por plan (corrida de 2 años alrededor del aniversario)
    const hoy = new Date();
    const resultado = await Promise.all(
      candidatos.map(async (p) => {
        const prop = props.get(p.idNavArrend);
        const ini = new Date(`${p.fecInicio}T00:00:00`);
        const anioObjetivo = anioAplic - ini.getFullYear() + 1;
        const aniversario = new Date(anioAplic, mesAplic - 1, ini.getDate());
        const base: Omit<PlanPreview, 'estatus'> = {
          idArrePdp: p.idArrePdp,
          empresa: empresas.get(p.idArrendador) ?? '—',
          idParque: prop?.idParque ?? '',
          parque: prop?.idParque ? (parques.get(prop.idParque) ?? '—') : '—',
          nave: prop?.idNave ? (naves.get(prop.idNave) ?? '—') : '—',
          moneda: p.Moneda ?? 'MXN',
          aniversario: aniversario.toISOString().slice(0, 10),
          anioObjetivo,
          incrementoPct: 0,
          montoActual: 0,
          montoNuevo: 0,
          conceptos: [],
        };

        if (!prop?.pdpActivo) {
          return { ...base, estatus: 'manual' as const, motivo: 'El plan no está activo (pdpActivo=false).' };
        }
        if (anioObjetivo < 2) {
          return { ...base, estatus: 'omitido' as const, motivo: 'El aniversario cae en el año 1 (base).' };
        }
        if (p.fecFin && new Date(`${p.fecFin}T00:00:00`) <= aniversario) {
          return {
            ...base,
            estatus: 'omitido' as const,
            motivo: 'El contrato termina en o antes del aniversario; no inicia año nuevo.',
          };
        }
        const previoAplicado = yaAplicados.get(`${p.idArrePdp}|${anioObjetivo}`);
        if (previoAplicado) {
          // Reserva incompleta (proceso interrumpido entre reserva y RPC):
          // bloquea el candado sin haber modificado la corrida; se libera con
          // "Revertir" desde la bitácora y se vuelve a aplicar.
          const det = (previoAplicado.detalle ?? {}) as { estado?: string; previo?: unknown[] };
          if (det.estado === 'en_proceso') {
            return {
              ...base,
              estatus: 'omitido' as const,
              idIncremento: previoAplicado.id,
              motivo:
                'Tiene una RESERVA INCOMPLETA (proceso interrumpido): libérala desde la bitácora con "Revertir" y vuelve a aplicar.',
            };
          }
          const valorPrevio = Number(previoAplicado.inpcAplicado);
          const difiere = valorPrevio !== Number(inpc.inpc);
          // Las ediciones manuales no tienen snapshot ⇒ no re-aplicables en automático
          const reaplicable = difiere && previoAplicado.origen !== 'manual';
          return {
            ...base,
            estatus: 'omitido' as const,
            idIncremento: previoAplicado.id,
            inpcAplicadoPrevio: valorPrevio,
            ...(reaplicable ? { requiereReaplicacion: true } : {}),
            motivo: difiere
              ? `Aplicado con INPC ${valorPrevio} pero el valor vigente es ${Number(inpc.inpc)}${reaplicable ? ' — puede revertirse y re-aplicarse' : ' (edición manual: corregir desde la corrida)'}.`
              : `Ya tiene incremento aplicado para el año ${anioObjetivo} (origen: ${previoAplicado.origen}).`,
          };
        }

        // Corrida del año anterior + año objetivo (por rango de partidas)
        const ranIni = (anioObjetivo - 2) * 12 + 1;
        const ranFin = anioObjetivo * 12;
        const { data: filas, error: filasErr } = await this.supabase.admin
          .from('arrePdpDetalle')
          .select(
            'idArrePdp, numPartida, anio, concepto, pm2, constM2, ptsINPC, INPC, cantidad, fecPago, cantidadAplicada, aplicaInpc',
          )
          .eq('idArrePdp', p.idArrePdp)
          .eq('status', true)
          .gte('numPartida', ranIni)
          .lte('numPartida', ranFin);
        if (filasErr) throw fallaBd(this.logger, 'incrementos.preview.detalle', filasErr);
        const todas = (filas ?? []) as FilaDetalle[];
        const finPrev = (anioObjetivo - 1) * 12;
        const delAnioObj = todas.filter((f) => (f.numPartida ?? 0) > finPrev && f.aplicaInpc);
        const delAnioPrev = todas.filter((f) => (f.numPartida ?? 0) <= finPrev);

        if (!delAnioObj.length) {
          return {
            ...base,
            estatus: 'omitido' as const,
            motivo: `El plan no tiene partidas incrementables para el año ${anioObjetivo}.`,
          };
        }

        const pagadas = delAnioObj.filter(
          (f) => f.fecPago !== null || (f.cantidadAplicada ?? 0) > 0,
        ).length;
        if (pagadas > 0) {
          return {
            ...base,
            estatus: 'manual' as const,
            motivo: `El año ${anioObjetivo} ya tiene ${pagadas} partida(s) con pago aplicado (captura tardía).`,
          };
        }

        // Cálculo por concepto (misma matemática que la RPC)
        const conceptos: ConceptoPreview[] = [];
        let sospechoso: string | undefined;
        const porConcepto = new Map<string, FilaDetalle[]>();
        for (const f of delAnioObj) {
          const k = f.concepto ?? '';
          if (!porConcepto.has(k)) porConcepto.set(k, []);
          porConcepto.get(k)!.push(f);
        }
        for (const [concepto, filasObj] of [...porConcepto.entries()].sort()) {
          const prevConcepto = delAnioPrev
            .filter((f) => f.concepto === concepto && f.pm2 > 0)
            .sort((a, b) => (b.numPartida ?? 0) - (a.numPartida ?? 0));
          const baseFila = prevConcepto[0];
          if (!baseFila) continue; // sin base en el año anterior (financiado nuevo/terminado)
          const pts = Math.max(...filasObj.map((f) => Number(f.ptsINPC) || 0), 0);
          const pm2Base = Number(baseFila.pm2);
          const pm2Nuevo = pm2Base * (1 + (Number(inpc.inpc) + pts) / 100);
          const filaObj = filasObj.find((f) => f.pm2 > 0) ?? filasObj[0]!;
          const constM2 = Number(filaObj.constM2) || 0;
          conceptos.push({
            concepto,
            pm2Base,
            pts,
            pm2Nuevo,
            montoActual: Number(baseFila.cantidad ?? pm2Base * Number(baseFila.constM2)),
            montoNuevo: pm2Nuevo * constM2,
          });
          // Año objetivo con pm2 ya distinto a la base y sin bitácora → sospechoso
          const pm2Obj = Number(filaObj.pm2);
          if (pm2Obj > 0 && Math.abs(pm2Obj - pm2Base) > EPSILON_PM2) {
            sospechoso = `El concepto "${concepto}" del año ${anioObjetivo} ya muestra un monto distinto al año anterior sin registro en la bitácora (posible aplicación manual previa o parcial).`;
          }
        }
        if (!conceptos.length) {
          return {
            ...base,
            estatus: 'omitido' as const,
            motivo: 'Ningún concepto del año objetivo tiene base en el año anterior.',
          };
        }

        const montoActual = conceptos.reduce((s, c) => s + c.montoActual, 0);
        const montoNuevo = conceptos.reduce((s, c) => s + c.montoNuevo, 0);
        const ptsPredominantes = conceptos
          .map((c) => c.pts)
          .sort((a, b) => conceptos.filter((x) => x.pts === b).length - conceptos.filter((x) => x.pts === a).length)[0] ?? 0;
        const enriquecido = {
          ...base,
          incrementoPct: Number(inpc.inpc) + ptsPredominantes,
          montoActual,
          montoNuevo,
          conceptos,
        };

        if (sospechoso) return { ...enriquecido, estatus: 'manual' as const, motivo: sospechoso };
        // Corte a MES COMPLETO (decisión 2026-07-02): un aniversario del mes en
        // curso aplica aunque el día ya haya pasado (muchos contratos inician
        // los días 1-9 y el INPC se captura ~día 10). Solo va a manual si el
        // MES del aniversario ya quedó atrás. El dinero cobrado se protege
        // antes (TIENE_PAGOS se evalúa arriba).
        const mesCorriente = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const mesAniversario = new Date(anioAplic, mesAplic - 1, 1);
        if (mesAniversario < mesCorriente) {
          return {
            ...enriquecido,
            estatus: 'manual' as const,
            soloTardio: true,
            motivo: 'El mes del aniversario ya quedó atrás (captura tardía); decide manualmente.',
          };
        }
        return { ...enriquecido, estatus: 'aplicable' as const };
      }),
    );

    return {
      ...vacio,
      aplicables: resultado.filter((r) => r.estatus === 'aplicable'),
      omitidos: resultado.filter((r) => r.estatus === 'omitido'),
      manuales: resultado.filter((r) => r.estatus === 'manual'),
    };
  }

  // ============================ Aplicación ============================

  /**
   * Aplica los incrementos a los planes seleccionados (⊆ aplicables del
   * preview recalculado server-side). Por plan: reserva el candado en
   * `arre_incrementos` (único parcial ⇒ imposible duplicar) → RPC atómica →
   * guarda el snapshot. Si la RPC falla, la reserva se elimina.
   */
  async aplicar(
    idInpc: string,
    planesSeleccionados: string[],
    actorUid: string,
    origen: 'automatico' | 'reaplicacion' = 'automatico',
    opciones?: {
      /** Promueve a aplicables los manuales SOLO-por-tardío. Únicamente lo usa
       *  `reaplicar` (corrección confirmada): tras revertir, el aniversario ya
       *  pasó pero no hay pagos (lo garantiza la reversión) — sin esto, la
       *  corrección dejaría el plan revertido SIN re-aplicar. */
      incluirTardios?: boolean;
    },
  ) {
    const prev = await this.preview(idInpc);
    const desfase = prev.desfaseMeses;
    const candidatos = opciones?.incluirTardios
      ? [...prev.aplicables, ...prev.manuales.filter((m) => m.soloTardio)]
      : prev.aplicables;
    const seleccion = new Set(planesSeleccionados);
    const aplicables = candidatos.filter((p) => seleccion.has(p.idArrePdp));
    const rechazados = planesSeleccionados.filter(
      (id) => !candidatos.some((p) => p.idArrePdp === id),
    );

    const db = this.supabase.comoActor(actorUid);
    const aplicados: Array<{ idArrePdp: string; empresa: string; montoActual: number; montoNuevo: number; idIncremento: string }> = [];
    const fallidos: Array<{ idArrePdp: string; empresa: string; motivo: string }> = [];

    for (const plan of aplicables) {
      // 1) Reserva del candado (única escritura que puede chocar con otra sesión)
      const { data: reserva, error: resErr } = await db
        .from('arre_incrementos')
        .insert({
          idArrePdp: plan.idArrePdp,
          anioAplicado: plan.anioObjetivo,
          idInpc,
          inpcAplicado: prev.inpc.valor,
          ptsAplicados: plan.incrementoPct - prev.inpc.valor,
          desfaseMeses: desfase,
          detalle: { estado: 'en_proceso' } as Json,
          origen,
          uidr: actorUid,
        })
        .select('id')
        .single();
      if (resErr || !reserva) {
        const choque = resErr?.code === '23505';
        fallidos.push({
          idArrePdp: plan.idArrePdp,
          empresa: plan.empresa,
          motivo: choque
            ? 'Otro usuario aplicó el incremento de este plan al mismo tiempo.'
            : 'No se pudo reservar el registro en la bitácora.',
        });
        if (!choque) this.logger.error(`Reserva falló (${plan.idArrePdp}): ${resErr?.message}`);
        continue;
      }

      // 2) RPC atómica
      const { data: rpcData, error: rpcErr } = await db.rpc('arrepdp_aplicar_incremento_inpc', {
        p_id_arre_pdp: plan.idArrePdp,
        p_anio: plan.anioObjetivo,
        p_inpc: prev.inpc.valor,
        p_id_inpc: idInpc,
      });
      const res = rpcData as unknown as RpcAplicar | null;

      if (rpcErr || !res?.exito) {
        // Compensación: liberar la reserva
        await db.from('arre_incrementos').delete().eq('id', reserva.id);
        // Regla 4b: el mensaje de un ERROR_INTERNO de la RPC trae SQLERRM →
        // se loguea server-side y al cliente va un texto genérico. Los demás
        // códigos (TIENE_PAGOS, PLAN_NO_VIGENTE, …) son mensajes redactados.
        let motivo: string;
        if (rpcErr) {
          this.logger.error(`RPC aplicar falló (${plan.idArrePdp}): ${rpcErr.message}`);
          motivo = 'Error interno al aplicar.';
        } else if (!res || res.codigo === 'ERROR_INTERNO') {
          this.logger.error(`RPC aplicar ERROR_INTERNO (${plan.idArrePdp}): ${res?.mensaje ?? 'sin detalle'}`);
          motivo = 'Error interno al aplicar el incremento.';
        } else {
          motivo = res.mensaje ?? 'La aplicación fue rechazada.';
        }
        fallidos.push({ idArrePdp: plan.idArrePdp, empresa: plan.empresa, motivo });
        continue;
      }

      // 3) Snapshot definitivo en la bitácora
      const detalle = {
        conceptos: res.conceptos ?? [],
        previo: res.previo ?? [],
        filasActualizadas: res.filasActualizadas ?? 0,
        montoActual: plan.montoActual,
        montoNuevo: plan.montoNuevo,
        moneda: plan.moneda,
        aniversario: plan.aniversario,
      } as Json;
      const { error: updErr } = await db
        .from('arre_incrementos')
        .update({ detalle })
        .eq('id', reserva.id);
      if (updErr) this.logger.error(`Snapshot no guardado (${reserva.id}): ${updErr.message}`);

      aplicados.push({
        idArrePdp: plan.idArrePdp,
        empresa: plan.empresa,
        montoActual: plan.montoActual,
        montoNuevo: plan.montoNuevo,
        idIncremento: reserva.id,
      });
    }

    // Correo a responsables de parque + gerente (best-effort: no revierte nada)
    const notificacion = await this.notificador.notificar(
      aplicados.map((a) => a.idIncremento),
      { esCorreccion: origen === 'reaplicacion' },
    );

    return {
      inpc: prev.inpc,
      mesAplicacion: prev.mesAplicacion,
      aplicados,
      fallidos,
      rechazados,
      omitidos: prev.omitidos.map((p) => ({ idArrePdp: p.idArrePdp, empresa: p.empresa, motivo: p.motivo })),
      manuales: prev.manuales.map((p) => ({ idArrePdp: p.idArrePdp, empresa: p.empresa, motivo: p.motivo })),
      notificacion,
    };
  }

  /**
   * Corrección de un INPC ya aplicado: revierte con el snapshot y re-aplica
   * con el valor VIGENTE del catálogo (`origen='reaplicacion'`, correo de
   * corrección). Hereda todas las protecciones: si tras revertir el plan cae
   * en un caso manual (p. ej. aniversario ya pasado), la re-aplicación se
   * reporta como fallida/manual y el usuario decide.
   */
  async reaplicar(idIncremento: string, actorUid: string) {
    const { data: fila, error } = await this.supabase.admin
      .from('arre_incrementos')
      .select('id, idArrePdp, anioAplicado, idInpc, estado, origen')
      .eq('id', idIncremento)
      .maybeSingle();
    if (error) throw fallaBd(this.logger, 'incrementos.reaplicar.carga', error);
    if (!fila) throw new NotFoundException('El registro de incremento no existe.');
    if (fila.estado !== 'aplicado')
      throw new ConflictException('Este incremento ya fue revertido; usa Aplicar desde la vista previa.');
    if (fila.idInpc === ID_INPC_MANUAL)
      throw new BadRequestException(
        'Este registro nació de una edición manual; corrígelo desde la corrida (doble clic).',
      );

    await this.revertir(idIncremento, 'Re-aplicación por corrección del INPC', actorUid);
    // incluirTardios: la corrección típica ocurre después del aniversario; el
    // usuario ya la confirmó y la reversión garantizó que no hay pagos, así
    // que se re-aplica aunque el aniversario haya pasado (sin esto el plan
    // quedaría revertido con la renta vieja, silenciosamente).
    return this.aplicar(fila.idInpc, [fila.idArrePdp], actorUid, 'reaplicacion', {
      incluirTardios: true,
    });
  }

  /** Reenvía el correo de notificación de un incremento aplicado. */
  async reenviarCorreo(idIncremento: string) {
    const { data, error } = await this.supabase.admin
      .from('arre_incrementos')
      .select('id, estado')
      .eq('id', idIncremento)
      .maybeSingle();
    if (error) throw fallaBd(this.logger, 'incrementos.reenviar', error);
    if (!data) throw new NotFoundException('El registro de incremento no existe.');
    if (data.estado !== 'aplicado')
      throw new BadRequestException('Solo se notifica un incremento aplicado (este está revertido).');
    const notificacion = await this.notificador.notificar([idIncremento]);
    return { ok: true as const, notificacion };
  }

  // ============================ Reversión ============================

  /**
   * Revierte un incremento aplicado restaurando el snapshot `previo`
   * (RPC `arrepdp_revertir_incremento_inpc`, atómica). Rechaza si el año
   * revertido ya tiene pagos (decisión manual) o si el registro no tiene
   * snapshot (ediciones manuales registradas sin `previo`).
   */
  async revertir(idIncremento: string, motivo: string, actorUid: string) {
    const { data: fila, error } = await this.supabase.admin
      .from('arre_incrementos')
      .select('id, idArrePdp, anioAplicado, estado, detalle, origen')
      .eq('id', idIncremento)
      .maybeSingle();
    if (error) throw fallaBd(this.logger, 'incrementos.revertir.carga', error);
    if (!fila) throw new NotFoundException('El registro de incremento no existe.');
    if (fila.estado !== 'aplicado')
      throw new ConflictException('Este incremento ya fue revertido.');

    const detalle = (fila.detalle ?? {}) as { previo?: unknown[]; estado?: string };
    const db = this.supabase.comoActor(actorUid);

    // Reserva huérfana (proceso interrumpido entre la reserva y la RPC): la
    // corrida no se modificó — se LIBERA el candado sin restaurar nada.
    if (detalle.estado === 'en_proceso') {
      const { error: libErr } = await db
        .from('arre_incrementos')
        .update({
          estado: 'revertido',
          revertidoPor: actorUid,
          fecReversion: new Date().toISOString(),
          motivoReversion: `${motivo} (liberación de reserva incompleta; la corrida no se había modificado)`,
        })
        .eq('id', idIncremento);
      if (libErr) throw fallaBd(this.logger, 'incrementos.revertir.libera', libErr);
      return { ok: true as const, filasRestauradas: 0 };
    }

    if (!Array.isArray(detalle.previo) || !detalle.previo.length) {
      throw new BadRequestException(
        'Este registro no tiene snapshot para revertir automáticamente; corrige el plan desde la corrida (doble clic).',
      );
    }

    const { data: rpcData, error: rpcErr } = await db.rpc('arrepdp_revertir_incremento_inpc', {
      p_id_arre_pdp: fila.idArrePdp,
      p_anio: fila.anioAplicado,
      p_previo: detalle.previo as unknown as Json,
    });
    if (rpcErr) {
      this.logger.error(`RPC revertir falló (${idIncremento}): ${rpcErr.message}`);
      throw new InternalServerErrorException('No se pudo revertir el incremento.');
    }
    const res = rpcData as unknown as RpcAplicar | null;
    if (!res?.exito) {
      // Regla 4b: ERROR_INTERNO trae SQLERRM → log server-side, genérico al cliente
      if (!res || res.codigo === 'ERROR_INTERNO') {
        this.logger.error(`RPC revertir ERROR_INTERNO (${idIncremento}): ${res?.mensaje ?? 'sin detalle'}`);
        throw new InternalServerErrorException('No se pudo revertir el incremento.');
      }
      throw new BadRequestException(res.mensaje ?? 'La reversión fue rechazada.');
    }

    const { error: updErr } = await db
      .from('arre_incrementos')
      .update({
        estado: 'revertido',
        revertidoPor: actorUid,
        fecReversion: new Date().toISOString(),
        motivoReversion: motivo,
      })
      .eq('id', idIncremento);
    if (updErr) throw fallaBd(this.logger, 'incrementos.revertir.marca', updErr);

    return { ok: true as const, filasRestauradas: res.filasActualizadas ?? 0 };
  }

  // ============================ Bitácora ============================

  /** Bitácora de incrementos, filtrable por plan o por captura de INPC. */
  async bitacora(filtros: { idArrePdp?: string; idInpc?: string }) {
    let q = this.supabase.admin
      .from('arre_incrementos')
      .select(
        'id, idArrePdp, anioAplicado, idInpc, inpcAplicado, ptsAplicados, desfaseMeses, detalle, origen, estado, correoNotificado, fecNotificacion, revertidoPor, fecReversion, motivoReversion, uidr, fc',
      )
      .order('fc', { ascending: false })
      .limit(300);
    if (filtros.idArrePdp) q = q.eq('idArrePdp', filtros.idArrePdp);
    if (filtros.idInpc) q = q.eq('idInpc', filtros.idInpc);
    const { data, error } = await q;
    if (error) throw fallaBd(this.logger, 'incrementos.bitacora', error);
    const filas = data ?? [];

    // Enriquecer con actor, valor vigente del INPC (badge "valor distinto") y
    // empresa/parque/nave del plan (vista por captura)
    const uids = [...new Set(filas.flatMap((f) => [f.uidr, f.revertidoPor]).filter(Boolean))] as string[];
    const idsInpc = [...new Set(filas.map((f) => f.idInpc).filter((x) => x !== ID_INPC_MANUAL))];
    const idsPlan = [...new Set(filas.map((f) => f.idArrePdp))];
    const [usersQ, inpcQ, planesQ] = await Promise.all([
      uids.length
        ? this.supabase.admin.from('catUsers').select('uid, nomCompleto').in('uid', uids)
        : Promise.resolve({ data: [], error: null } as const),
      idsInpc.length
        ? this.supabase.admin.from('inpc').select('id, anio, mes, inpc').in('id', idsInpc)
        : Promise.resolve({ data: [], error: null } as const),
      idsPlan.length
        ? this.supabase.admin
            .from('arrePdp')
            .select('idArrePdp, idArrendador, idNavArrend')
            .in('idArrePdp', idsPlan)
        : Promise.resolve({ data: [], error: null } as const),
    ]);
    const nombres = new Map((usersQ.data ?? []).map((u) => [u.uid, u.nomCompleto ?? u.uid]));
    const vigentes = new Map((inpcQ.data ?? []).map((i) => [i.id, i]));
    const planes = planesQ.data ?? [];

    const idsNav = [...new Set(planes.map((p) => p.idNavArrend))];
    const idsArr = [...new Set(planes.map((p) => p.idArrendador))];
    const [propsQ, invQ] = await Promise.all([
      idsNav.length
        ? this.supabase.admin
            .from('arrenPropiedades')
            .select('idNavArrend, idParque, idNave')
            .in('idNavArrend', idsNav)
            .eq('status', true)
        : Promise.resolve({ data: [] } as const),
      idsArr.length
        ? this.supabase.admin
            .from('inversionista')
            .select('idInversionista, razonsocial')
            .in('idInversionista', idsArr)
        : Promise.resolve({ data: [] } as const),
    ]);
    const props = new Map((propsQ.data ?? []).map((r) => [r.idNavArrend, r]));
    const empresas = new Map((invQ.data ?? []).map((r) => [r.idInversionista, r.razonsocial ?? '—']));
    const idsParque = [...new Set([...props.values()].map((r) => r.idParque).filter(Boolean))] as string[];
    const idsNave = [...new Set([...props.values()].map((r) => r.idNave).filter(Boolean))] as string[];
    const [parquesQ, navesQ] = await Promise.all([
      idsParque.length
        ? this.supabase.admin.from('parques').select('idParque, nomParque').in('idParque', idsParque)
        : Promise.resolve({ data: [] } as const),
      idsNave.length
        ? this.supabase.admin.from('naves').select('idNave, numNave, numNaveNAME').in('idNave', idsNave)
        : Promise.resolve({ data: [] } as const),
    ]);
    const parquesM = new Map((parquesQ.data ?? []).map((r) => [r.idParque, r.nomParque ?? '—']));
    const navesM = new Map(
      (navesQ.data ?? []).map((r) => [r.idNave, r.numNaveNAME ?? String(r.numNave ?? '—')]),
    );
    const porPlan = new Map(planes.map((p) => [p.idArrePdp, p]));

    return filas.map((f) => {
      const vigente = vigentes.get(f.idInpc);
      const plan = porPlan.get(f.idArrePdp);
      const prop = plan ? props.get(plan.idNavArrend) : undefined;
      return {
        ...f,
        empresa: plan ? (empresas.get(plan.idArrendador) ?? '—') : '—',
        parque: prop?.idParque ? (parquesM.get(prop.idParque) ?? '—') : '—',
        nave: prop?.idNave ? (navesM.get(prop.idNave) ?? '—') : '—',
        aplicadoPor: nombres.get(f.uidr) ?? f.uidr,
        revertidoPorNombre: f.revertidoPor ? (nombres.get(f.revertidoPor) ?? f.revertidoPor) : null,
        inpcVigente: vigente ? Number(vigente.inpc) : null,
        inpcPeriodo: vigente ? `${String(vigente.mes).padStart(2, '0')}/${vigente.anio}` : null,
        desactualizado:
          f.estado === 'aplicado' && vigente != null && Number(vigente.inpc) !== Number(f.inpcAplicado),
      };
    });
  }

  /**
   * Registra en la bitácora una edición MANUAL del INPC hecha desde la corrida
   * (doble clic). No aplica el candado duro: si ya existe una fila 'aplicado'
   * para ese plan+año, anexa la edición a su detalle (trazabilidad) en vez de
   * insertar. Sin snapshot `previo` ⇒ no reversible automáticamente.
   */
  async registrarManual(params: {
    idArrePdp: string;
    anio: number;
    campo: string;
    concepto: string;
    valor: number;
    actorUid: string;
  }) {
    if (params.anio < 2) return; // el año 1 no es un incremento
    const db = this.supabase.comoActor(params.actorUid);
    const evento = {
      tipo: 'edicion_manual',
      campo: params.campo,
      concepto: params.concepto,
      valor: params.valor,
      fecha: new Date().toISOString(),
      actor: params.actorUid,
    };

    const { data: existente, error: exErr } = await this.supabase.admin
      .from('arre_incrementos')
      .select('id, detalle')
      .eq('idArrePdp', params.idArrePdp)
      .eq('anioAplicado', params.anio)
      .eq('estado', 'aplicado')
      .maybeSingle();
    if (exErr) {
      this.logger.error(`registrarManual consulta falló: ${exErr.message}`);
      return; // la edición manual ya ocurrió; el registro es best-effort
    }

    if (existente) {
      const detalle = (existente.detalle ?? {}) as Record<string, unknown>;
      const ediciones = Array.isArray(detalle.edicionesManuales) ? detalle.edicionesManuales : [];
      const { error } = await db
        .from('arre_incrementos')
        .update({ detalle: { ...detalle, edicionesManuales: [...ediciones, evento] } as Json })
        .eq('id', existente.id);
      if (error) this.logger.error(`registrarManual anexo falló: ${error.message}`);
      return;
    }

    const inpcAplicado = params.campo === 'INPC' ? params.valor : 0;
    const { error } = await db.from('arre_incrementos').insert({
      idArrePdp: params.idArrePdp,
      anioAplicado: params.anio,
      idInpc: ID_INPC_MANUAL,
      inpcAplicado,
      ptsAplicados: params.campo === 'ptsINPC' ? params.valor : 0,
      detalle: { edicionesManuales: [evento] } as Json,
      origen: 'manual',
      uidr: params.actorUid,
    });
    if (error && error.code !== '23505') {
      this.logger.error(`registrarManual insert falló: ${error.message}`);
    }
  }
}
