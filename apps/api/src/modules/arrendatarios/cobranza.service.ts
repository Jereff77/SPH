import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import type { AplicarPagoDto } from './arrendatarios.schemas.js';
import { parsearEstadoCuentaBanBajio } from './estado-cuenta.parser.js';
import type { TablesInsert } from '@erp/types';

type Db = ReturnType<SupabaseService['comoActor']>;

export interface FiltrosCobranza {
  anios: number[];
  parques: { idParque: string; nomParque: string | null }[];
}

/** Cuenta destino (Grupo SPH en BanBajío) que se graba en los movimientos importados. */
const CTA_DESTINO_SPH = '********8480-CUENTA CONECTA BANBAJÍO-1';

/** Resultado de importar un estado de cuenta (resumen para la UI). */
export interface ImportarEstadoCuentaResultado {
  /** Renglones "SPEI Recibido" leídos del archivo (antes de deduplicar). */
  leidos: number;
  /** SPEI Recibido únicos (por rastreo) detectados en el archivo. */
  totalSpei: number;
  /** Movimientos efectivamente insertados (no existían en `movbancarios`). */
  nuevos: number;
  /** SPEI del archivo que ya estaban registrados (no se reinsertan). */
  yaExistian: number;
  /** Suma de importes de los movimientos nuevos. */
  montoNuevos: number;
  /** Detalle de los nuevos (para mostrar en el modal de resultado). */
  filas: {
    fecOperacion: string | null;
    ordenante: string | null;
    bancoEmisor: string | null;
    cancepto: string | null;
    importe: number;
    rastreo: string | null;
  }[];
}

/** Entrada del registro de movimientos: una aplicación de pago agrupada por `uidPago`. */
export interface MovimientoPago {
  uidPago: string;
  idmov: string;
  idArrendador: string | null;
  fecPago: string;
  uid: string | null;
  estado: string;
  aplicadoEn: string;
  desaplicadoPor: string | null;
  desaplicadoEn: string | null;
  motivo: string | null;
  monto: number;
  partidas: number;
  ordenante?: string | null;
  razonSocial?: string | null;
  /** Periodos (yyyy-MM) de las partidas a las que se aplicó el depósito. */
  periodos?: string[];
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

/** Normaliza el nombre del ordenante para el mapeo aprendido (mismo criterio que el
 * parser del estado de cuenta): mayúsculas, sin puntos/comas, espacios colapsados. */
function normalizarOrdenante(s: string | null | undefined): string {
  return (s ?? '').replace(/[.,]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
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
  /** Caché breve de la tolerancia de centavos (SPHConfiguraciones). */
  private toleranciaCache: { valor: number; ts: number } | null = null;

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
   * Margen de tolerancia (en pesos) al aplicar pagos: permite que el total
   * seleccionado difiera del saldo del depósito hasta este monto, para absorber
   * diferencias de redondeo de centavos. Configurable en `SPHConfiguraciones`
   * (parámetro `ARRE_TOLERANCIA_PAGO`); default 0.05. Se cachea 5 min.
   */
  private async toleranciaPago(): Promise<number> {
    const ahora = Date.now();
    if (this.toleranciaCache && ahora - this.toleranciaCache.ts < 5 * 60 * 1000)
      return this.toleranciaCache.valor;
    const { data } = await this.supabase.admin
      .from('SPHConfiguraciones')
      .select('valor')
      .eq('parametro', 'ARRE_TOLERANCIA_PAGO')
      .eq('status', true)
      .maybeSingle();
    const valor = Number(data?.valor);
    const tol = Number.isFinite(valor) && valor >= 0 ? valor : 0.05;
    this.toleranciaCache = { valor: tol, ts: ahora };
    return tol;
  }

  /** Tolerancia de centavos vigente (para el modal de aplicación). */
  async toleranciaConfig(): Promise<{ tolerancia: number }> {
    return { tolerancia: await this.toleranciaPago() };
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
   *
   * Soporte multi-selección (regla 7c): se reciben `anios[]` y `meses[]`.
   * - Si no hay años seleccionados, se usa el año actual por defecto.
   * - Se llama la RPC una vez por año (en paralelo con `Promise.all`), pasando
   *   `p_mes = null` para traer todos los meses de ese año, y se concatenan resultados.
   * - Luego se filtra en memoria por los meses seleccionados (si los hay).
   */
  async pagos(p: {
    anios?: number[];
    meses?: number[];
    parque?: string;
    arrendatario?: string;
    soloPendientes?: boolean;
  }) {
    const anioActual = new Date().getFullYear();
    const anios = p.anios?.length ? p.anios : [anioActual];

    const [resultados, ticket, tasa] = await Promise.all([
      Promise.all(
        anios.map((anio) =>
          this.supabase.admin.rpc('pagos_arrendatarios', {
            p_anio: anio,
            p_mes: null,
            p_parque: p.parque,
            p_arrendatario: p.arrendatario,
            p_solo_pendientes: p.soloPendientes ?? false,
          }),
        ),
      ),
      this.nombresParquesTicket(),
      this.tasaIva(),
    ]);

    // Verificar errores y concatenar filas de todos los años.
    const filasCrudas = resultados.flatMap(({ data, error }) => {
      if (error) throw new InternalServerErrorException(error.message);
      return data ?? [];
    });

    // Filtrar en memoria por meses si se especificaron.
    const meses = p.meses?.length ? new Set(p.meses) : null;
    const filtradas = meses
      ? filasCrudas.filter((r) => {
          const fechaStr: string | null = (r as { fecha?: string | null }).fecha ?? null;
          if (!fechaStr) return false;
          const numMes = Number(fechaStr.slice(5, 7));
          return meses.has(numMes);
        })
      : filasCrudas;

    return filtradas
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

  /**
   * Depósitos bancarios **recibidos** sin aplicar (`idtipo=2`: "Instrucción de
   * depósito a tu cuenta" + "SPEI Recibido"), para el modal de aplicar pago. Se
   * lee directo de `movbancarios` (no la RPC de v1) para poder acotar a `idtipo=2`
   * y devolver también el concepto. El nombre del ordenante **no** se usa como
   * filtro obligatorio (suele no coincidir con el arrendatario); la búsqueda es
   * opcional y aplica a ordenante **o** concepto. Mes/año opcionales. Orden por
   * fecha desc; tope de 1000 para acotar el volumen.
   *
   * Si se pasa `idArrePdp`, cada depósito trae `sugerido=true` cuando su ordenante
   * ya pagó antes a ese arrendatario (mapeo aprendido en `arre_ordenante`).
   */
  async depositosSinAplicar(busqueda?: string, anio?: number, mes?: number, idArrePdp?: string) {
    // Ordenantes que ya pagaron a este arrendatario (para marcar "sugerido").
    const sugeridos = await this.ordenantesSugeridos(idArrePdp);

    let q = this.supabase.admin
      .from('movbancarios')
      .select('idmov, fecOperacion, ordenante, importe, rastreo, moneda, cancepto')
      .eq('aplicado', false)
      .eq('idtipo', 2);
    if (busqueda) {
      const t = busqueda.replace(/[%,()]/g, ' ').trim();
      if (t) q = q.or(`ordenante.ilike.%${t}%,cancepto.ilike.%${t}%`);
    }
    if (anio) q = q.eq('numAnio', anio);
    if (mes) q = q.eq('numMes', mes);
    const { data, error } = await q
      .order('fecOperacion', { ascending: false, nullsFirst: false })
      .limit(1000);
    if (error) throw new InternalServerErrorException(error.message);
    const filas = data ?? [];
    // Saldo disponible por depósito (importe − lo ya aplicado en arre_pagos): un
    // depósito puede aplicarse parcialmente y conservar saldo a favor disponible.
    const aplicadoPorMov = await this.aplicadoPorDeposito(filas.map((m) => m.idmov));
    return filas.map((m) => {
      const importe = Number(m.importe) || 0;
      const aplicado = aplicadoPorMov.get(m.idmov) ?? 0;
      return {
        idmov: m.idmov,
        fec_operacion: m.fecOperacion,
        ordenante: m.ordenante ?? '',
        importe,
        aplicado: Math.round(aplicado * 100) / 100,
        saldoDisponible: Math.round((importe - aplicado) * 100) / 100,
        rastreo: m.rastreo ?? '',
        moneda: m.moneda ?? 'MXN',
        concepto: m.cancepto ?? '',
        sugerido: sugeridos ? sugeridos.has(normalizarOrdenante(m.ordenante)) : false,
      };
    });
  }

  /** Suma aplicada (arre_pagos con estado='aplicado') por depósito (`idmov`). */
  private async aplicadoPorDeposito(idmovs: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    const unicos = [...new Set(idmovs.filter(Boolean))];
    if (unicos.length === 0) return map;
    for (const grupo of this.chunk(unicos, 200)) {
      const { data, error } = await this.supabase.admin
        .from('arre_pagos')
        .select('idmov, monto')
        .eq('estado', 'aplicado')
        .in('idmov', grupo);
      if (error) throw new InternalServerErrorException(error.message);
      for (const r of data ?? []) {
        if (!r.idmov) continue;
        map.set(r.idmov, (map.get(r.idmov) ?? 0) + (Number(r.monto) || 0));
      }
    }
    return map;
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  /** Set de ordenantes (normalizados) que ya pagaron al arrendatario del plan dado;
   * `null` si no hay plan/arrendatario. Usa el mapeo aprendido `arre_ordenante`. */
  private async ordenantesSugeridos(idArrePdp?: string): Promise<Set<string> | null> {
    if (!idArrePdp) return null;
    const { data: plan } = await this.supabase.admin
      .from('arrePdp')
      .select('idArrendador')
      .eq('idArrePdp', idArrePdp)
      .maybeSingle();
    const idArr = plan?.idArrendador;
    if (!idArr) return null;
    const { data: maps } = await this.supabase.admin
      .from('arre_ordenante')
      .select('ordenante')
      .eq('idArrendador', idArr);
    return new Set((maps ?? []).map((m) => m.ordenante));
  }

  /**
   * Aplica (parte de) un depósito a una o más partidas COMPLETAS del arrendatario.
   *
   * **Saldo a favor por depósito (casos 1 y 2):** el depósito ya NO es "todo o
   * nada". El total seleccionado debe ser **≤ el saldo disponible** del depósito
   * (`importe − lo ya aplicado`); si es menor, el remanente queda como **saldo a
   * favor del mismo depósito**, disponible para aplicarlo después a otras partidas
   * (de cualquier mes: adelantos o atrasos). Cada partida se paga **completa**.
   *
   * Implementación SIN tocar la BD: reutiliza la RPC `aplicar_pago_arrendatario`
   * (que marca `arrePdpDetalle` + `movbancarios.aplicado=true`) y, si tras la
   * aplicación el depósito conserva saldo, lo **vuelve a dejar disponible**
   * (`aplicado=false`) desde el backend. El depósito solo queda `aplicado=true`
   * cuando se agota.
   */
  async aplicarPago(
    dto: AplicarPagoDto,
    actorUid: string,
  ): Promise<{ importe: number; aplicado: number; saldoAFavor: number; agotado: boolean }> {
    // Movimiento: debe existir y conservar saldo (aplicado=true ⇒ ya agotado).
    const { data: mov, error: movErr } = await this.supabase.admin
      .from('movbancarios')
      .select('idmov, importe, aplicado, ordenante')
      .eq('idmov', dto.idmov)
      .maybeSingle();
    if (movErr) throw new InternalServerErrorException(movErr.message);
    if (!mov) throw new NotFoundException('Movimiento bancario no encontrado.');
    if (mov.aplicado)
      throw new BadRequestException('El depósito ya fue aplicado por completo (sin saldo disponible).');

    const importe = Number(mov.importe) || 0;
    const aplicadoPrevio = (await this.aplicadoPorDeposito([dto.idmov])).get(dto.idmov) ?? 0;
    const saldo = Math.round((importe - aplicadoPrevio) * 100) / 100;
    if (saldo <= 0.005)
      throw new BadRequestException('El depósito ya no tiene saldo disponible.');

    // Partidas seleccionadas (cantidad **con IVA**): deben existir y estar pendientes.
    const tasa = await this.tasaIva();
    const { data: partidas, error: parErr } = await this.supabase.admin
      .from('arrePdpDetalle')
      .select('idArrePdpDet, cantidad, concepto, idArrePdp, fecPago')
      .in('idArrePdpDet', dto.idsDetalle);
    if (parErr) throw new InternalServerErrorException(parErr.message);
    if (!partidas || partidas.length !== dto.idsDetalle.length)
      throw new BadRequestException('Alguna partida seleccionada no existe.');
    if (partidas.some((p) => p.fecPago))
      throw new BadRequestException('Alguna partida seleccionada ya estaba pagada.');

    // Monto (con IVA) por partida; se guarda por idArrePdpDet para arre_pagos.
    const montoPorDet = new Map<string, number>();
    const total =
      Math.round(
        partidas.reduce((s, p) => {
          const base = Number(p.cantidad) || 0;
          const m = Math.round((base + ivaDePartida(base, p.concepto, tasa)) * 100) / 100;
          montoPorDet.set(p.idArrePdpDet, m);
          return s + m;
        }, 0) * 100,
      ) / 100;

    if (total <= 0.005)
      throw new BadRequestException('Selecciona al menos una partida con monto.');
    // Regla: el total seleccionado puede exceder el saldo del depósito hasta el
    // **margen de tolerancia** (configurable; absorbe diferencias de redondeo de
    // centavos). Más allá del margen, se rechaza.
    const tolerancia = await this.toleranciaPago();
    if (total - saldo > tolerancia + 0.0001)
      throw new BadRequestException(
        `El total seleccionado (${total.toFixed(2)}) excede el saldo disponible del depósito (${saldo.toFixed(2)}) por más del margen permitido (${tolerancia.toFixed(2)}).`,
      );

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

    const idArrePdp = partidas.find((p) => p.idArrePdp)?.idArrePdp ?? null;
    const idArrendador = await this.idArrendadorDePlan(db, idArrePdp);

    // Registro del pago en `arre_pagos` (1 fila por partida; `uidPago` agrupa esta
    // aplicación). Es la fuente de verdad del saldo aplicado del depósito.
    const uidPago = randomUUID();
    try {
      const filas: TablesInsert<'arre_pagos'>[] = partidas.map((p) => ({
        idArrePdpDet: p.idArrePdpDet,
        idArrePdp: p.idArrePdp ?? null,
        idArrendador,
        idmov: dto.idmov,
        uidPago,
        monto: montoPorDet.get(p.idArrePdpDet) ?? 0,
        fecPago: dto.fecPago,
        uid: actorUid,
        estado: 'aplicado',
      }));
      const { error: pagErr } = await db.from('arre_pagos').insert(filas);
      if (pagErr) this.logger.warn(`No se pudo registrar en arre_pagos: ${pagErr.message}`);
    } catch (e) {
      this.logger.warn(`No se pudo registrar en arre_pagos: ${(e as Error).message}`);
    }

    // Saldo a favor: el remanente real (saldo − total). Si la diferencia cae
    // **dentro de la tolerancia** (remanente o exceso de centavos), el depósito se
    // da por **AGOTADO** (se absorbe la diferencia, sin saldo a favor residual).
    // Solo si el remanente supera la tolerancia se deja el depósito disponible.
    const remanente = Math.round((saldo - total) * 100) / 100;
    const agotado = remanente <= tolerancia + 0.0001;
    const saldoAFavor = agotado ? 0 : remanente;
    if (!agotado) {
      const { error: updErr } = await db
        .from('movbancarios')
        .update({ aplicado: false })
        .eq('idmov', dto.idmov);
      if (updErr) this.logger.warn(`No se pudo dejar el depósito disponible: ${updErr.message}`);
    }

    await this.registrarActividad(db, {
      comentario: `Se aplicó ${total.toFixed(2)} del depósito ${dto.idmov} (importe ${importe.toFixed(2)}) a ${dto.idsDetalle.length} partida(s). Saldo a favor restante: ${Math.max(0, saldoAFavor).toFixed(2)}.`,
      actorUid,
    });

    await this.aprenderOrdenante(db, idArrendador, mov.ordenante, importe);

    return { importe, aplicado: total, saldoAFavor: Math.max(0, saldoAFavor), agotado };
  }

  /**
   * TODAS las partidas pendientes (sin `fecPago`) de un arrendatario, de
   * **cualquier mes/año** y de todas sus naves activas, para el modal de aplicar
   * pago (permite pagar meses **adelantados** o **atrasados**). El monto va **con
   * IVA** (cuadra con el depósito). Reutiliza `pagos()` (IVA + exclusión de
   * Tickets) sobre todo el rango de años y filtra por la razón social exacta.
   */
  async partidasPendientesArrendatario(razonSocial: string) {
    const rs = (razonSocial ?? '').trim();
    if (!rs) return [];
    const { anios } = await this.filtros();
    const filas = await this.pagos({ anios, arrendatario: rs, soloPendientes: true });
    return filas.filter((r) => (r.razon_social ?? '') === rs);
  }

  /**
   * Agrega un **concepto libre** (p. ej. penalización/intereses) a la **misma
   * partida (mes/nave)** de una partida de referencia: crea una fila nueva en
   * `arrePdpDetalle` copiando el contexto del mes (idArrePdp/numPartida/fecha/
   * año/ciclo/moneda) con el `concepto` y `monto` indicados. Como NO se llenan
   * `pm2`/`constM2` (quedan 0), el trigger de IVA deja `iva = 0`: el monto
   * capturado es el total exacto a pagar. Queda pendiente (`fecPago` null) y
   * seleccionable como cualquier otra partida. La inserción se audita (trigger).
   */
  async agregarConcepto(
    idArrePdpDetRef: string,
    concepto: string,
    monto: number,
    actorUid: string,
  ): Promise<{ ok: true; idArrePdpDet: string }> {
    const conc = (concepto ?? '').trim();
    if (!conc) throw new BadRequestException('El concepto es obligatorio.');
    if (!(monto > 0)) throw new BadRequestException('El monto debe ser mayor a 0.');

    const { data: ref, error } = await this.supabase.admin
      .from('arrePdpDetalle')
      .select('idArrePdp, tipoOperacion, numPartida, fecha, anio, ciclo, moneda')
      .eq('idArrePdpDet', idArrePdpDetRef)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!ref || !ref.idArrePdp)
      throw new NotFoundException('Partida de referencia no encontrada.');

    // `cantidad` es una columna GENERADA (= pm2 × constM2) y el trigger calcula
    // `iva` = pm2 × constM2 × tasa. Para que el monto se comporte **exactamente
    // igual** que una partida normal y el **total (cantidad + IVA)** sea el
    // capturado, se reparte el monto: la **base** va en `pm2` (con `constM2 = 1`),
    // de modo que `cantidad` = base y el IVA la completa hasta el monto capturado.
    const tasa = await this.tasaIva();
    const base = Math.round((monto / (1 + tasa)) * 100) / 100;
    const nuevoId = `${ref.idArrePdp}_EX_${String(ref.numPartida ?? 0).padStart(3, '0')}_${randomUUID().slice(0, 8)}`;
    const db = this.supabase.comoActor(actorUid);
    const fila: TablesInsert<'arrePdpDetalle'> = {
      idArrePdpDet: nuevoId,
      uidc: actorUid,
      idArrePdp: ref.idArrePdp,
      tipoOperacion: ref.tipoOperacion ?? 1,
      numPartida: ref.numPartida ?? null,
      concepto: conc,
      fecha: ref.fecha ?? null,
      anio: ref.anio ?? 0,
      ciclo: ref.ciclo ?? null,
      moneda: ref.moneda ?? 'MXN',
      pm2: base,
      constM2: 1,
      fecPago: null,
      // Cargo extraordinario: EXENTO del incremento anual por INPC (el flujo
      // de incrementos solo toca filas con aplicaInpc=true).
      aplicaInpc: false,
    };
    const { error: insErr } = await db.from('arrePdpDetalle').insert(fila);
    if (insErr) {
      this.logger.error(`Error agregando concepto a partida: ${insErr.message}`);
      throw new InternalServerErrorException('No se pudo agregar el concepto.');
    }
    await this.registrarActividad(db, {
      comentario: `Agregó el concepto "${conc}" (${monto.toFixed(2)}) a la partida ${ref.numPartida ?? '?'} del plan ${ref.idArrePdp}.`,
      actorUid,
    });
    return { ok: true, idArrePdpDet: nuevoId };
  }

  /**
   * Detalle de una aplicación de pago (`uidPago`): a qué **nave / concepto / mes**
   * se aplicó y **cuánto** a cada uno. Alimenta la trazabilidad del Registro de
   * movimientos (saber a qué naves se repartió un depósito).
   */
  async detalleAplicacion(uidPago: string) {
    const { data: filas, error } = await this.supabase.admin
      .from('arre_pagos')
      .select('idArrePdpDet, monto')
      .eq('uidPago', uidPago);
    if (error) throw new InternalServerErrorException(error.message);
    const ids = (filas ?? []).map((f) => f.idArrePdpDet).filter((x): x is string => !!x);
    if (ids.length === 0) return [];
    const montoPorDet = new Map((filas ?? []).map((f) => [f.idArrePdpDet, Number(f.monto) || 0]));

    const { data: dets } = await this.supabase.admin
      .from('arrePdpDetalle')
      .select('idArrePdpDet, concepto, fecha, numPartida, idArrePdp')
      .in('idArrePdpDet', ids);
    const idArrePdps = [
      ...new Set((dets ?? []).map((d) => d.idArrePdp).filter((x): x is string => !!x)),
    ];
    const navePorPlan = await this.navePorPlan(idArrePdps);

    return (dets ?? [])
      .map((d) => {
        const nv = d.idArrePdp ? navePorPlan.get(d.idArrePdp) : undefined;
        return {
          idArrePdpDet: d.idArrePdpDet,
          concepto: d.concepto ?? null,
          fecha: d.fecha ? String(d.fecha).slice(0, 10) : null,
          numPartida: d.numPartida ?? null,
          nave: nv?.nave ?? null,
          parque: nv?.parque ?? null,
          monto: montoPorDet.get(d.idArrePdpDet) ?? 0,
        };
      })
      .sort(
        (a, b) =>
          (a.nave ?? '').localeCompare(b.nave ?? '', 'es') ||
          (a.fecha ?? '').localeCompare(b.fecha ?? ''),
      );
  }

  /** Mapa idArrePdp → {nave, parque} (arrePdp→arrenPropiedades→naves→parques). */
  private async navePorPlan(
    idArrePdps: string[],
  ): Promise<Map<string, { nave: string | null; parque: string | null }>> {
    const out = new Map<string, { nave: string | null; parque: string | null }>();
    if (idArrePdps.length === 0) return out;
    const { data: planes } = await this.supabase.admin
      .from('arrePdp')
      .select('idArrePdp, idNavArrend')
      .in('idArrePdp', idArrePdps);
    const navArrends = [
      ...new Set((planes ?? []).map((p) => p.idNavArrend).filter((x): x is string => !!x)),
    ];
    const { data: props } = navArrends.length
      ? await this.supabase.admin
          .from('arrenPropiedades')
          .select('idNavArrend, idNave')
          .in('idNavArrend', navArrends)
      : { data: [] as { idNavArrend: string; idNave: string | null }[] };
    const idNaves = [
      ...new Set((props ?? []).map((p) => p.idNave).filter((x): x is string => !!x)),
    ];
    const { data: naves } = idNaves.length
      ? await this.supabase.admin
          .from('naves')
          .select('idNave, numNave, numNaveNAME, idParque')
          .in('idNave', idNaves)
      : { data: [] as { idNave: string; numNave: number | null; numNaveNAME: string | null; idParque: string | null }[] };
    const idParques = [
      ...new Set((naves ?? []).map((n) => n.idParque).filter((x): x is string => !!x)),
    ];
    const { data: parques } = idParques.length
      ? await this.supabase.admin.from('parques').select('idParque, nomParque').in('idParque', idParques)
      : { data: [] as { idParque: string; nomParque: string | null }[] };

    const parqueNom = new Map((parques ?? []).map((p) => [p.idParque, p.nomParque]));
    const naveInfo = new Map(
      (naves ?? []).map((n) => [
        n.idNave,
        {
          nave: n.numNaveNAME ?? (n.numNave != null ? String(n.numNave) : null),
          parque: n.idParque ? parqueNom.get(n.idParque) ?? null : null,
        },
      ]),
    );
    const porNavArrend = new Map(
      (props ?? []).map((p) => [
        p.idNavArrend,
        p.idNave ? naveInfo.get(p.idNave) ?? null : null,
      ]),
    );
    for (const pl of planes ?? []) {
      const nv = pl.idNavArrend ? porNavArrend.get(pl.idNavArrend) : null;
      out.set(pl.idArrePdp, nv ?? { nave: null, parque: null });
    }
    return out;
  }

  /**
   * Desaplica (revierte) un pago previamente aplicado, identificado por su
   * `uidPago` (agrupa las partidas de esa aplicación): vuelve las partidas a
   * pendiente, libera el depósito y marca las filas de `arre_pagos` como
   * 'desaplicado' (conservando el historial: quién/cuándo/motivo).
   */
  async desaplicarPago(
    uidPago: string,
    actorUid: string,
    motivo?: string,
  ): Promise<{ ok: true; partidas: number; idmov: string }> {
    const { data: filas, error } = await this.supabase.admin
      .from('arre_pagos')
      .select('id, idArrePdpDet, idmov')
      .eq('uidPago', uidPago)
      .eq('estado', 'aplicado');
    if (error) throw new InternalServerErrorException(error.message);
    const idmov = filas?.[0]?.idmov;
    if (!filas || filas.length === 0 || !idmov)
      throw new NotFoundException('No se encontró un pago activo con ese identificador.');

    const idsDetalle = filas.map((f) => f.idArrePdpDet);

    const db = this.supabase.comoActor(actorUid);
    const { error: revErr } = await db.rpc('desaplicar_pago_arrendatario', {
      p_idmov: idmov,
      p_ids_detalle: idsDetalle,
    });
    if (revErr) {
      this.logger.error(`Error desaplicando pago (${uidPago}): ${revErr.message}`);
      throw new InternalServerErrorException('No se pudo desaplicar el pago.');
    }

    const { error: updErr } = await db
      .from('arre_pagos')
      .update({
        estado: 'desaplicado',
        desaplicadoPor: actorUid,
        desaplicadoEn: new Date().toISOString(),
        motivoDesaplicacion: motivo ?? null,
      })
      .eq('uidPago', uidPago)
      .eq('estado', 'aplicado');
    if (updErr) this.logger.warn(`No se pudo marcar arre_pagos como desaplicado: ${updErr.message}`);

    await this.registrarActividad(db, {
      comentario: `Se desaplicó el pago ${uidPago} (depósito ${idmov}, ${idsDetalle.length} partida(s))${motivo ? ` — motivo: ${motivo}` : ''}.`,
      actorUid,
    });

    return { ok: true, partidas: idsDetalle.length, idmov };
  }

  /**
   * Historial de pagos (registro de movimientos) agrupado por aplicación
   * (`uidPago`). Una entrada por aplicación con su monto total, nº de partidas,
   * estado (aplicado/desaplicado) y trazas de quién/cuándo. Enriquecido con el
   * ordenante del depósito y la razón social del arrendatario.
   */
  async historialPagos(p: {
    idArrendador?: string;
    idArrePdp?: string;
    anio?: number;
    mes?: number;
    limite?: number;
  }) {
    let q = this.supabase.admin
      .from('arre_pagos')
      .select(
        'uidPago, idmov, idArrePdpDet, idArrendador, idArrePdp, monto, fecPago, uid, estado, aplicadoEn, desaplicadoPor, desaplicadoEn, motivoDesaplicacion',
      )
      .order('aplicadoEn', { ascending: false });
    if (p.idArrendador) q = q.eq('idArrendador', p.idArrendador);
    if (p.idArrePdp) q = q.eq('idArrePdp', p.idArrePdp);
    const { data, error } = await q.limit(5000);
    if (error) throw new InternalServerErrorException(error.message);

    const map = new Map<string, MovimientoPago>();
    const detPorPago = new Map<string, string[]>(); // uidPago → idArrePdpDet[]
    for (const r of data ?? []) {
      let g = map.get(r.uidPago);
      if (!g) {
        g = {
          uidPago: r.uidPago,
          idmov: r.idmov,
          idArrendador: r.idArrendador,
          fecPago: r.fecPago,
          uid: r.uid,
          estado: r.estado,
          aplicadoEn: r.aplicadoEn,
          desaplicadoPor: r.desaplicadoPor,
          desaplicadoEn: r.desaplicadoEn,
          motivo: r.motivoDesaplicacion,
          monto: 0,
          partidas: 0,
          periodos: [],
        };
        map.set(r.uidPago, g);
      }
      g.monto += Number(r.monto) || 0;
      g.partidas += 1;
      if (r.idArrePdpDet) {
        const arr = detPorPago.get(r.uidPago) ?? [];
        arr.push(r.idArrePdpDet);
        detPorPago.set(r.uidPago, arr);
      }
    }
    let grupos = [...map.values()];

    // Periodos (yyyy-MM) de las partidas a las que se aplicó cada pago (mes/año).
    const idsDet = [...new Set(grupos.flatMap((g) => detPorPago.get(g.uidPago) ?? []))];
    const fechaPorDet = new Map<string, string>();
    for (const grupo of this.chunk(idsDet, 200)) {
      const { data: dets } = await this.supabase.admin
        .from('arrePdpDetalle')
        .select('idArrePdpDet, fecha')
        .in('idArrePdpDet', grupo);
      for (const d of dets ?? [])
        if (d.idArrePdpDet && d.fecha) fechaPorDet.set(d.idArrePdpDet, String(d.fecha).slice(0, 7));
    }
    for (const g of grupos) {
      g.periodos = [
        ...new Set(
          (detPorPago.get(g.uidPago) ?? [])
            .map((det) => fechaPorDet.get(det))
            .filter((x): x is string => !!x),
        ),
      ].sort();
    }

    // Filtro por **periodo aplicado** (año/mes de las partidas que tocó el depósito).
    if (p.anio || p.mes) {
      grupos = grupos.filter((g) =>
        (g.periodos ?? []).some((per) => {
          const y = Number(per.slice(0, 4));
          const m = Number(per.slice(5, 7));
          return (!p.anio || y === p.anio) && (!p.mes || m === p.mes);
        }),
      );
    }

    const movs = grupos.slice(0, p.limite ?? 300);

    // Enriquecer con ordenante (movbancarios) y razón social (inversionista).
    const idmovs = [...new Set(movs.map((m) => m.idmov))];
    const idArrs = [...new Set(movs.map((m) => m.idArrendador).filter((x): x is string => !!x))];
    const [{ data: deps }, { data: invs }] = await Promise.all([
      idmovs.length
        ? this.supabase.admin.from('movbancarios').select('idmov, ordenante').in('idmov', idmovs)
        : Promise.resolve({ data: [] as { idmov: string; ordenante: string | null }[] }),
      idArrs.length
        ? this.supabase.admin.from('inversionista').select('idInversionista, razonsocial').in('idInversionista', idArrs)
        : Promise.resolve({ data: [] as { idInversionista: string; razonsocial: string | null }[] }),
    ]);
    const ordPorMov = new Map((deps ?? []).map((d) => [d.idmov, d.ordenante]));
    const rsPorInv = new Map((invs ?? []).map((i) => [i.idInversionista, i.razonsocial]));
    for (const m of movs) {
      m.ordenante = ordPorMov.get(m.idmov) ?? null;
      m.razonSocial = m.idArrendador ? rsPorInv.get(m.idArrendador) ?? null : null;
    }
    return movs;
  }

  /**
   * Registra/incrementa el mapeo `(arrendatario ↔ ordenante)` en `arre_ordenante`
   * tras aplicar un pago, para sugerir el depósito correcto en futuras aplicaciones.
   * Tolerante a fallos (solo loguea): nunca debe romper la aplicación del pago.
   */
  /** idArrendador (inversionista) del plan; null si no se encuentra. */
  private async idArrendadorDePlan(db: Db, idArrePdp: string | null): Promise<string | null> {
    if (!idArrePdp) return null;
    const { data } = await db
      .from('arrePdp')
      .select('idArrendador')
      .eq('idArrePdp', idArrePdp)
      .maybeSingle();
    return data?.idArrendador ?? null;
  }

  private async aprenderOrdenante(
    db: Db,
    idArrendador: string | null,
    ordenante: string | null,
    importe: number,
  ): Promise<void> {
    const ordNorm = normalizarOrdenante(ordenante);
    const idArr = idArrendador;
    if (!idArr || !ordNorm) return;
    try {
      const { data: ex } = await db
        .from('arre_ordenante')
        .select('id, veces')
        .eq('idArrendador', idArr)
        .eq('ordenante', ordNorm)
        .maybeSingle();
      if (ex) {
        await db
          .from('arre_ordenante')
          .update({
            veces: (ex.veces ?? 0) + 1,
            ultimaVez: new Date().toISOString(),
            ultimoImporte: importe,
          })
          .eq('id', ex.id);
      } else {
        await db
          .from('arre_ordenante')
          .insert({ idArrendador: idArr, ordenante: ordNorm, ultimoImporte: importe });
      }
    } catch (e) {
      this.logger.warn(`No se pudo registrar el mapeo de ordenante: ${(e as Error).message}`);
    }
  }

  /**
   * Quita la **sugerencia** (mapeo aprendido en `arre_ordenante`) entre el
   * ordenante de un depósito y el arrendatario del plan dado. Útil cuando un pago
   * se aplicó por error a otro arrendatario: tras desaplicarlo, se retira la
   * sugerencia errónea con un click en la ⭐. Si se quita por error, vuelve a
   * aprenderse automáticamente al aplicar un pago de ese ordenante.
   */
  async quitarSugerencia(
    idArrePdp: string,
    ordenante: string,
    actorUid: string,
  ): Promise<{ ok: true }> {
    const ordNorm = normalizarOrdenante(ordenante);
    if (!ordNorm) throw new BadRequestException('Falta el ordenante.');
    const db = this.supabase.comoActor(actorUid);
    const idArrendador = await this.idArrendadorDePlan(db, idArrePdp);
    if (!idArrendador) throw new NotFoundException('No se encontró el arrendatario del plan.');
    const { error } = await db
      .from('arre_ordenante')
      .delete()
      .eq('idArrendador', idArrendador)
      .eq('ordenante', ordNorm);
    if (error) throw new InternalServerErrorException(error.message);
    await this.registrarActividad(db, {
      comentario: `Quitó la sugerencia del ordenante "${ordNorm}" para el arrendatario ${idArrendador}.`,
      actorUid,
    });
    return { ok: true };
  }

  /**
   * Importa un estado de cuenta de **BanBajío** (.xlsx) y registra en
   * `movbancarios` los **SPEI Recibido** que aún no existan (anti-duplicado por
   * `rastreo`, vía `upsert ... ignoreDuplicates`). Los movimientos quedan como
   * depósitos (`tipo='Depósito'`, `asunto='SPEI Recibido'`, `manual=true`,
   * `aplicado=false`) listos para aplicarse a las rentas. Las columnas
   * `numAnio`/`numMes`/`idtipo`/`idUnico` son GENERADAS en la BD: no se insertan.
   * Toda la escritura queda auditada (`comoActor`).
   */
  async importarEstadoCuenta(
    buffer: Buffer,
    actorUid: string,
  ): Promise<ImportarEstadoCuentaResultado> {
    const { speis, leidos } = await parsearEstadoCuentaBanBajio(buffer);
    if (speis.length === 0) {
      return { leidos, totalSpei: 0, nuevos: 0, yaExistian: 0, montoNuevos: 0, filas: [] };
    }

    const filas: TablesInsert<'movbancarios'>[] = speis.map((s) => ({
      idmov: randomUUID(),
      asunto: 'SPEI Recibido',
      fecOperacion: s.fecha,
      horaOperacion: s.hora,
      ordenante: s.ordenante,
      ctaDestino: CTA_DESTINO_SPH,
      bancoEmisor: s.institucion,
      importe: s.importe,
      cancepto: s.concepto,
      referencia: s.referencia,
      rastreo: s.rastreo,
      tipo: 'Depósito',
      aplicado: false,
      manual: true,
      Operacion: 'Transferencia Interbancaria SPEI',
      moneda: 'MXN',
    }));

    const db = this.supabase.comoActor(actorUid);
    // ignoreDuplicates → INSERT ... ON CONFLICT (rastreo) DO NOTHING; el .select()
    // devuelve SOLO las filas insertadas (las que ya existían se omiten).
    const { data: insertadas, error } = await db
      .from('movbancarios')
      .upsert(filas, { onConflict: 'rastreo', ignoreDuplicates: true })
      .select('rastreo, importe, ordenante, fecOperacion, cancepto, bancoEmisor');
    if (error) {
      this.logger.error(`Error importando estado de cuenta: ${error.message}`);
      throw new InternalServerErrorException('No se pudieron registrar los movimientos.');
    }

    const nuevos = insertadas?.length ?? 0;
    const montoNuevos = (insertadas ?? []).reduce((acc, r) => acc + (Number(r.importe) || 0), 0);

    await this.registrarActividad(db, {
      comentario: `Importó estado de cuenta (BanBajío): ${nuevos} SPEI recibido(s) nuevo(s) de ${speis.length} en el archivo (${montoNuevos.toFixed(2)} MXN).`,
      actorUid,
    });

    return {
      leidos,
      totalSpei: speis.length,
      nuevos,
      yaExistian: speis.length - nuevos,
      montoNuevos,
      filas: (insertadas ?? []).map((r) => ({
        fecOperacion: r.fecOperacion,
        ordenante: r.ordenante,
        bancoEmisor: r.bancoEmisor,
        cancepto: r.cancepto,
        importe: Number(r.importe) || 0,
        rastreo: r.rastreo,
      })),
    };
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
