import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import type { AplicarPagoDto } from './arrendatarios.schemas.js';

type Db = ReturnType<SupabaseService['comoActor']>;

export interface FiltrosCobranza {
  anios: number[];
  parques: { idParque: string; nomParque: string | null }[];
}

/** Tasa de IVA por defecto si el parámetro no estuviera disponible (16%). */
const TASA_IVA_DEFAULT = 0.16;

/**
 * IVA de una partida de la corrida. Replica EXACTAMENTE la regla del trigger de BD
 * `v2_arrepdpdetalle_calc_iva` (mantener ambos en sincronía): el "Depósito Garantía"
 * no causa IVA; el resto de conceptos lleva `round(cantidad × tasa, 2)`. La tasa sale
 * de `catParametros` (idCorto='iva'). Aplica igual a MXN y USD.
 */
function ivaDePartida(cantidad: number, concepto: string | null, tasa: number): number {
  const c = (concepto ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
  if (/^deposito.*garantia/.test(c)) return 0;
  return Math.round((cantidad || 0) * tasa * 100) / 100;
}

/**
 * Arrendatarios > Dashboard de cobranza (clave 10). Reescribe el WebView/HTML de
 * v1 (que embebía un cliente Supabase + anon key) por endpoints Node que invocan
 * las RPCs existentes con `service_role`. La aplicación de pagos valida el importe
 * server-side (Exacto/Sobrante/Insuficiente) y delega en `aplicar_pago_arrendatario`
 * (transaccional). Reemplaza `dashboard_arren_widget` de v1.
 */
@Injectable()
export class CobranzaService {
  private readonly logger = new Logger(CobranzaService.name);
  /** Caché breve de la tasa de IVA (catParametros) para no consultarla por request. */
  private tasaIvaCache: { valor: number; ts: number } | null = null;

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Tasa de IVA vigente desde `catParametros` (idCorto='iva', status=true). Se cachea
   * 5 min; si el parámetro no existe, cae a {@link TASA_IVA_DEFAULT}. Es la misma fuente
   * que usa el trigger de BD que persiste `arrePdpDetalle.iva`.
   */
  private async tasaIva(): Promise<number> {
    const ahora = Date.now();
    if (this.tasaIvaCache && ahora - this.tasaIvaCache.ts < 5 * 60 * 1000) {
      return this.tasaIvaCache.valor;
    }
    const { data, error } = await this.supabase.admin
      .from('catParametros')
      .select('valor, fechaIni')
      .eq('idCorto', 'iva')
      .eq('status', true)
      .order('fechaIni', { ascending: false })
      .limit(1);
    if (error) this.logger.warn(`No se pudo leer la tasa de IVA: ${error.message}`);
    const valor = Number(data?.[0]?.valor);
    const tasa = Number.isFinite(valor) && valor > 0 ? valor : TASA_IVA_DEFAULT;
    this.tasaIvaCache = { valor: tasa, ts: ahora };
    return tasa;
  }

  /**
   * Años **naturales** y parques para los filtros del tablero. Los años son
   * naturales (no el "ciclo" del contrato que guarda `arrePdpDetalle.anio`) y el
   * rango va del año del **primer `fecInicio`** al año del **último `fecFin`** de
   * los contratos (`arrePdp`), incluyendo el año en curso. Excluye los parques de Tickets.
   */
  async filtros(): Promise<FiltrosCobranza> {
    const [{ data: ini }, { data: fin }, { data: parques, error: parqueErr }] =
      await Promise.all([
        this.supabase.admin
          .from('arrePdp')
          .select('fecInicio')
          .eq('status', true)
          .not('fecInicio', 'is', null)
          .order('fecInicio', { ascending: true })
          .limit(1)
          .maybeSingle(),
        this.supabase.admin
          .from('arrePdp')
          .select('fecFin')
          .eq('status', true)
          .not('fecFin', 'is', null)
          .order('fecFin', { ascending: false })
          .limit(1)
          .maybeSingle(),
        this.supabase.admin
          .from('parques')
          .select('idParque, nomParque')
          .eq('status', true)
          .eq('esTicket', false)
          .order('nomParque', { ascending: true }),
      ]);
    if (parqueErr) throw new InternalServerErrorException(parqueErr.message);

    const actual = new Date().getFullYear();
    const yIni = ini?.fecInicio ? Number(String(ini.fecInicio).slice(0, 4)) : actual;
    const yFin = fin?.fecFin ? Number(String(fin.fecFin).slice(0, 4)) : actual;
    const desde = Math.min(yIni, actual);
    const hasta = Math.max(yFin, actual);
    const anios: number[] = [];
    for (let y = desde; y <= hasta; y++) anios.push(y);

    return { anios, parques: parques ?? [] };
  }

  /** Nombres de los parques de Tickets (esTicket=true), para excluirlos de la cobranza. */
  private async nombresParquesTicket(): Promise<Set<string>> {
    const { data } = await this.supabase.admin
      .from('parques')
      .select('nomParque')
      .eq('esTicket', true);
    return new Set((data ?? []).map((p) => p.nomParque).filter((x): x is string => !!x));
  }

  /**
   * Pagos/partidas del tablero (RPC `pagos_arrendatarios`). Excluye los parques de
   * Tickets. El `monto` se devuelve **con IVA incluido** (la transferencia bancaria
   * lo trae): `monto = cantidad + iva`. Se añaden `base` (sin IVA) e `iva` por si la
   * UI los necesita. El IVA se calcula con la misma regla que el trigger de BD.
   */
  async pagos(p: {
    anio?: number;
    mes?: number;
    parque?: string;
    arrendatario?: string;
    soloPendientes?: boolean;
  }) {
    const [{ data, error }, ticket, tasa] = await Promise.all([
      this.supabase.admin.rpc('pagos_arrendatarios', {
        p_anio: p.anio,
        p_mes: p.mes,
        p_parque: p.parque,
        p_arrendatario: p.arrendatario,
        p_solo_pendientes: p.soloPendientes ?? false,
      }),
      this.nombresParquesTicket(),
      this.tasaIva(),
    ]);
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? [])
      .filter((r) => !r.parque || !ticket.has(r.parque))
      .map((r) => {
        const base = Number(r.monto) || 0;
        const iva = ivaDePartida(base, r.concepto, tasa);
        return { ...r, base, iva, monto: base + iva };
      });
  }

  /** Contratos por vencer en un rango de fechas (RPC `contratos_por_vencer`). Excluye Tickets. */
  async contratosPorVencer(desde?: string, hasta?: string) {
    const [{ data, error }, ticket] = await Promise.all([
      this.supabase.admin.rpc('contratos_por_vencer', {
        p_fecha_desde: desde,
        p_fecha_hasta: hasta,
      }),
      this.nombresParquesTicket(),
    ]);
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []).filter((r) => !r.parque || !ticket.has(r.parque));
  }

  /** Contratos vencidos sin renovación (RPC `contratos_vencidos_sin_renovacion`). Excluye Tickets. */
  async contratosVencidos() {
    const [{ data, error }, ticket] = await Promise.all([
      this.supabase.admin.rpc('contratos_vencidos_sin_renovacion'),
      this.nombresParquesTicket(),
    ]);
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []).filter((r) => !r.parque || !ticket.has(r.parque));
  }

  /** Depósitos bancarios sin aplicar (RPC `movbancarios_sin_aplicar`). */
  async depositosSinAplicar(busqueda?: string, anio?: number, mes?: number) {
    const { data, error } = await this.supabase.admin.rpc('movbancarios_sin_aplicar', {
      p_busqueda: busqueda,
      p_anio: anio,
      p_mes: mes,
    });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  /**
   * Aplica un depósito a una o más partidas. Valida importe ≥ suma seleccionada
   * (Insuficiente → 400; Exacto/Sobrante → ok), impide reaplicar un movimiento ya
   * aplicado y delega en `aplicar_pago_arrendatario`. Registra la actividad.
   */
  async aplicarPago(
    dto: AplicarPagoDto,
    actorUid: string,
  ): Promise<{ estado: 'Exacto' | 'Sobrante'; importe: number; total: number }> {
    // Movimiento: debe existir y no estar aplicado.
    const { data: mov, error: movErr } = await this.supabase.admin
      .from('movbancarios')
      .select('idmov, importe, aplicado')
      .eq('idmov', dto.idmov)
      .maybeSingle();
    if (movErr) throw new InternalServerErrorException(movErr.message);
    if (!mov) throw new NotFoundException('Movimiento bancario no encontrado.');
    if (mov.aplicado) throw new BadRequestException('El depósito ya fue aplicado.');

    // Suma de las partidas seleccionadas (cantidad **con IVA**, igual que la
    // transferencia bancaria), para que la comparación contra el depósito cuadre.
    const tasa = await this.tasaIva();
    const { data: partidas, error: parErr } = await this.supabase.admin
      .from('arrePdpDetalle')
      .select('idArrePdpDet, cantidad, concepto')
      .in('idArrePdpDet', dto.idsDetalle);
    if (parErr) throw new InternalServerErrorException(parErr.message);
    if (!partidas || partidas.length !== dto.idsDetalle.length)
      throw new BadRequestException('Alguna partida seleccionada no existe.');

    const total = partidas.reduce((s, p) => {
      const base = Number(p.cantidad) || 0;
      return s + base + ivaDePartida(base, p.concepto, tasa);
    }, 0);
    const importe = Number(mov.importe) || 0;
    // Tolerancia de centavo para comparaciones de punto flotante.
    if (importe + 0.005 < total)
      throw new BadRequestException(
        `Depósito insuficiente: importe ${importe.toFixed(2)} < total ${total.toFixed(2)}.`,
      );
    const estado: 'Exacto' | 'Sobrante' = Math.abs(importe - total) <= 0.005 ? 'Exacto' : 'Sobrante';

    const db = this.supabase.comoActor(actorUid);
    const { error } = await db.rpc('aplicar_pago_arrendatario', {
      p_idmov: dto.idmov,
      p_ids_detalle: dto.idsDetalle,
      p_fec_pago: dto.fecPago,
    });
    if (error) {
      this.logger.error(`Error aplicando pago arrendatario (${dto.idmov}): ${error.message}`);
      throw new InternalServerErrorException('No se pudo aplicar el pago.');
    }

    await this.registrarActividad(db, {
      comentario: `Se aplicó el depósito ${dto.idmov} (${importe.toFixed(2)}) a ${dto.idsDetalle.length} partida(s) por ${total.toFixed(2)} [${estado}].`,
      actorUid,
    });

    return { estado, importe, total };
  }

  private async registrarActividad(
    db: Db,
    a: { comentario: string; actorUid: string },
  ): Promise<void> {
    const { error } = await db.from('actividad').insert({
      uid: a.actorUid,
      entorno: 3,
      logeado: true,
      pantalla: 'dashboard_arren',
      widget: 'Button',
      nomwidget: 'AplicarPago',
      comentario: a.comentario,
      version: 'erp-v2',
    });
    if (error) this.logger.warn(`No se pudo registrar actividad: ${error.message}`);
  }
}
