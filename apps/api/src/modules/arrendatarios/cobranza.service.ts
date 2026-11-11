import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { fallaBd } from '../../common/utils/db-error.js';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import type { AplicarPagoDto } from './arrendatarios.schemas.js';
import { monedaDeposito, monedaValida } from './moneda.util.js';
import {
  aMicro,
  deMicro,
  esConceptoDeposito,
  excepcionConCodigo,
  navePorPlan as navePorPlanDe,
  num,
  rpcSinTipar,
  type RpcPaquete,
} from './deposito.util.js';
import { TraspasosDepositoService } from './traspasos-deposito.service.js';
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
  if (esConceptoDeposito(concepto)) return 0;
  return Math.round((cantidad || 0) * tasa * 100) / 100;
}

/**
 * Códigos de `arre_aplicar_pago_atomico` → HTTP + texto escrito a mano (regla 4b: jamás se
 * reenvía el `mensaje` de la RPC). Los textos repiten los de las validaciones previas en TS.
 * `null` = imprevisto (ERROR_INTERNO, SIN_ACTOR o desconocido) → log + genérico.
 */
export function respuestaDeCodigoPago(
  codigo: string,
  d: Record<string, unknown> = {},
): { status: 400 | 404 | 409; mensaje: string } | null {
  switch (codigo) {
    case 'PARTIDA_CAMBIO':
      return {
        status: 409,
        mensaje: 'La partida cambió mientras aplicabas el pago; recarga la pantalla e inténtalo de nuevo.',
      };
    case 'DEPOSITO_TRASPASADO':
      return {
        status: 409,
        mensaje:
          'Un depósito de garantía seleccionado ya fue traspasado a otro contrato y no se puede cobrar. Recarga la pantalla.',
      };
    case 'OCUPADO':
      return {
        status: 409,
        mensaje: 'Otro usuario está aplicando pagos a estas partidas. Espera unos segundos e inténtalo de nuevo.',
      };
    case 'PARTIDA_PAGADA':
      return { status: 400, mensaje: 'Alguna partida seleccionada ya estaba pagada.' };
    case 'PARTIDA_NO_ENCONTRADA':
      return { status: 400, mensaje: 'Alguna partida seleccionada no existe.' };
    case 'MOV_NO_ENCONTRADO':
      return { status: 404, mensaje: 'Movimiento bancario no encontrado.' };
    case 'MOV_AGOTADO':
      return { status: 400, mensaje: 'El depósito ya fue aplicado por completo (sin saldo disponible).' };
    case 'MOV_SIN_SALDO':
      return { status: 400, mensaje: 'El depósito ya no tiene saldo disponible.' };
    case 'SIN_MONTO':
      return { status: 400, mensaje: 'Selecciona al menos una partida con monto.' };
    case 'SALDO_INSUFICIENTE':
      return {
        status: 400,
        mensaje: `El total seleccionado (${num(d.total).toFixed(2)}) excede el saldo disponible del depósito (${num(d.saldo).toFixed(2)}) por más del margen permitido (${num(d.tolerancia).toFixed(2)}).`,
      };
    case 'PARAMETRO_INVALIDO':
      return { status: 400, mensaje: 'Los datos de la aplicación del pago no son válidos.' };
    default:
      return null;
  }
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

  constructor(
    private readonly supabase: SupabaseService,
    /** Traspaso de depósito: lo traspasado por partida (D6 en `pagos()`). */
    private readonly traspasos: TraspasosDepositoService,
  ) {}

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

    const filas = filtradas
      .filter((r) => !r.parque || !ticket.has(r.parque))
      .map((r) => {
        const base = Number(r.monto) || 0;
        const iva = ivaDePartida(base, r.concepto, tasa);
        return { ...r, base, iva, monto: base + iva };
      });
    return this.ocultarTraspasado(filas);
  }

  /**
   * D6/D16 — la cobranza oculta lo ya traspasado (capa API; no se toca el RPC
   * `pagos_arrendatarios`). Solo para la partida de depósito (`num_partida = 0` y concepto
   * «Depósito Garantía») de un plan que EMITIÓ traspasos: `monto = max(0, cantidad − Σ
   * emitido)` y la fila se omite si queda en 0 (ya no se ofrece cobrarla en *Aplicar pago*
   * ni cuenta en el dashboard). SOLO si el depósito está POR COBRAR (sin `fec_pago`): uno ya
   * pagado sigue contando como «Cobrado» tal cual. Al destino que RECIBIÓ traspasos se le añade
   * `traspasoRecibido` (D16: «Depósito (complemento; $X traspasados)»); su `monto` ya viene
   * rebajado de la BD. Con 0 traspasos las filas se devuelven EXACTAMENTE como antes (y si
   * no hay filas de depósito ni se consulta la tabla).
   */
  private async ocultarTraspasado<
    T extends {
      id_detalle: string;
      num_partida: number;
      concepto: string;
      fec_pago?: string | null;
      base: number;
      iva: number;
      monto: number;
    },
  >(filas: T[]): Promise<Array<T & { traspasoRecibido?: number }>> {
    const esDeposito = (r: T): boolean =>
      Number(r.num_partida) === 0 && esConceptoDeposito(r.concepto);
    if (!filas.some(esDeposito)) return filas;
    const { emitido, recibido } = await this.traspasos.traspasosPorPartida();
    if (emitido.size === 0 && recibido.size === 0) return filas;

    const out: Array<T & { traspasoRecibido?: number }> = [];
    for (const r of filas) {
      if (!esDeposito(r)) {
        out.push(r);
        continue;
      }
      const emi = aMicro(emitido.get(r.id_detalle));
      const rec = aMicro(recibido.get(r.id_detalle));
      let fila: T & { traspasoRecibido?: number } = r;
      // D6 solo aplica a lo POR COBRAR: un depósito de origen ya pagado no se oculta ni se rebaja.
      if (emi > 0 && !r.fec_pago) {
        const resto = aMicro(r.base) - emi;
        if (resto <= 0) continue; // todo el depósito se traspasó: no se cobra, no aparece
        const base = deMicro(resto);
        fila = { ...r, base, iva: 0, monto: base };
      }
      if (rec > 0) fila = { ...fila, traspasoRecibido: deMicro(rec) };
      out.push(fila);
    }
    return out;
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
   * Contratos **vigentes** (`vigente=true`, `arrePdpVigente≠'No'`) sin contrato firmado
   * (`contratoFirmado=false`), con su vínculo a la nave activo. Excluye Tickets y
   * arrendatarios de prueba. Mismo formato de fila que los vencidos (sin `dias_vencido`).
   */
  async contratosSinFirma() {
    const [{ data: planes, error }, ticket] = await Promise.all([
      this.supabase.admin
        .from('arrePdp')
        .select('idArrePdp, idNavArrend, idArrendador, fecFin, Moneda')
        .eq('vigente', true)
        .eq('contratoFirmado', false)
        .neq('arrePdpVigente', 'No')
        .order('fecFin', { ascending: true })
        .limit(1000),
      this.nombresParquesTicket(),
    ]);
    if (error) throw new InternalServerErrorException(error.message);
    if (!planes?.length) return [];

    const idsNav = [...new Set(planes.map((p) => p.idNavArrend).filter((x) => x != null))];
    const idsArr = [...new Set(planes.map((p) => p.idArrendador).filter((x) => x != null))];
    const [{ data: props, error: e1 }, { data: invs, error: e2 }] = await Promise.all([
      this.supabase.admin
        .from('arrenPropiedades')
        .select('idNavArrend, idNave, status')
        .in('idNavArrend', idsNav),
      this.supabase.admin
        .from('inversionista')
        .select('idInversionista, razonsocial, nombre, pruebas')
        .in('idInversionista', idsArr),
    ]);
    if (e1) throw new InternalServerErrorException(e1.message);
    if (e2) throw new InternalServerErrorException(e2.message);

    const idsNave = [...new Set((props ?? []).map((p) => p.idNave).filter((x) => x != null))];
    const { data: naves, error: e3 } = await this.supabase.admin
      .from('naves')
      .select('idNave, numNave, numNaveNAME, idParque')
      .in('idNave', idsNave);
    if (e3) throw new InternalServerErrorException(e3.message);
    const idsParque = [...new Set((naves ?? []).map((n) => n.idParque).filter((x) => x != null))];
    const { data: parques, error: e4 } = await this.supabase.admin
      .from('parques')
      .select('idParque, nomParque')
      .in('idParque', idsParque);
    if (e4) throw new InternalServerErrorException(e4.message);

    const propPor = new Map((props ?? []).map((p) => [p.idNavArrend, p]));
    const navePor = new Map((naves ?? []).map((n) => [n.idNave, n]));
    const parquePor = new Map((parques ?? []).map((p) => [p.idParque, p.nomParque]));
    const invPor = new Map((invs ?? []).map((i) => [i.idInversionista, i]));

    return planes
      .map((pl) => {
        const prop = propPor.get(pl.idNavArrend);
        const nave = prop ? navePor.get(prop.idNave) : undefined;
        const inv = invPor.get(pl.idArrendador);
        return {
          activo: prop?.status === true,
          prueba: inv?.pruebas === true,
          nave: (nave?.numNaveNAME || (nave?.numNave != null ? String(nave.numNave) : null)) ?? 'N/A',
          parque: (nave?.idParque != null ? parquePor.get(nave.idParque) : null) ?? 'N/A',
          razon_social: inv?.razonsocial?.trim() || inv?.nombre || 'N/A',
          fec_fin: pl.fecFin,
          moneda: monedaValida(pl.Moneda) ?? 'MXN',
        };
      })
      .filter((r) => r.activo && !r.prueba && !ticket.has(r.parque ?? ''))
      .map(({ activo: _a, prueba: _p, ...fila }) => fila);
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
   * Las validaciones de moneda y tolerancia se hacen aquí (mismos mensajes de siempre) y
   * la escritura es UNA llamada atómica a `arre_aplicar_pago_atomico` (traspaso de depósito,
   * D9): marca `arrePdpDetalle`, registra `arre_pagos` y deja `movbancarios.aplicado` en
   * `true` solo cuando el depósito se agota — todo o nada, con las partidas y el movimiento
   * bloqueados. Si alguna partida cambió desde que se leyó → 409 `PARTIDA_CAMBIO`.
   */
  async aplicarPago(
    dto: AplicarPagoDto,
    actorUid: string,
  ): Promise<{ importe: number; aplicado: number; saldoAFavor: number; agotado: boolean }> {
    // Movimiento: debe existir y conservar saldo (aplicado=true ⇒ ya agotado).
    const { data: mov, error: movErr } = await this.supabase.admin
      .from('movbancarios')
      .select('idmov, importe, aplicado, ordenante, moneda')
      .eq('idmov', dto.idmov)
      .maybeSingle();
    if (movErr) this.fallaPago('aplicarPago.mov', movErr);
    if (!mov) throw excepcionConCodigo(404, 'Movimiento bancario no encontrado.', 'MOV_NO_ENCONTRADO');
    if (mov.aplicado)
      throw excepcionConCodigo(400, 'El depósito ya fue aplicado por completo (sin saldo disponible).', 'MOV_AGOTADO');

    const importe = Number(mov.importe) || 0;
    const aplicadoPrevio = (await this.aplicadoPorDeposito([dto.idmov])).get(dto.idmov) ?? 0;
    const saldo = Math.round((importe - aplicadoPrevio) * 100) / 100;
    if (saldo <= 0.005)
      throw excepcionConCodigo(400, 'El depósito ya no tiene saldo disponible.', 'MOV_SIN_SALDO');

    // Partidas seleccionadas (cantidad **con IVA**): deben existir y estar pendientes.
    const tasa = await this.tasaIva();
    const { data: partidas, error: parErr } = await this.supabase.admin
      .from('arrePdpDetalle')
      .select('idArrePdpDet, cantidad, concepto, idArrePdp, fecPago, moneda')
      .in('idArrePdpDet', dto.idsDetalle);
    if (parErr) this.fallaPago('aplicarPago.partidas', parErr);
    if (!partidas || partidas.length !== dto.idsDetalle.length)
      throw excepcionConCodigo(400, 'Alguna partida seleccionada no existe.', 'PARTIDA_NO_ENCONTRADA');
    if (partidas.some((p) => p.fecPago))
      throw excepcionConCodigo(400, 'Alguna partida seleccionada ya estaba pagada.', 'PARTIDA_PAGADA');

    // Moneda: es OBLIGATORIA en el depósito y en las partidas/plan, y deben coincidir (sin
    // tipo de cambio no se mezclan). Nunca se omite en silencio: si falta, se dice la causa.
    // Datos heredados: 'MNX' (typo) = MXN; partida con moneda vacía/'null' usa la de su plan.
    const monedaMov = monedaDeposito(mov.moneda);
    if (!monedaMov)
      throw excepcionConCodigo(
        400,
        `El depósito no tiene una moneda válida (dice «${(mov.moneda ?? '').trim() || 'vacía'}»; debe ser MXN o USD). ` +
          'Corrige la moneda del movimiento bancario antes de aplicar el pago.',
        'MOV_MONEDA_INVALIDA',
      );

    const idsPlan = [...new Set(partidas.map((p) => p.idArrePdp).filter((x): x is string => !!x))];
    const { data: planes, error: plErr } = await this.supabase.admin
      .from('arrePdp')
      .select('idArrePdp, Moneda')
      .in('idArrePdp', idsPlan);
    if (plErr) this.fallaPago('aplicarPago.planes', plErr);
    const monedaPlan = new Map((planes ?? []).map((pl) => [pl.idArrePdp, monedaValida(pl.Moneda)]));

    const sinMoneda = partidas.find(
      (p) => !(monedaValida(p.moneda) ?? monedaPlan.get(p.idArrePdp ?? '')),
    );
    if (sinMoneda)
      throw excepcionConCodigo(
        400,
        `La partida «${sinMoneda.concepto ?? 'sin concepto'}» no tiene moneda válida ni su plan tampoco ` +
          '(debe ser MXN o USD). Defínela en Planes de Renta → columna Moneda antes de aplicar el pago.',
        'PARTIDA_SIN_MONEDA',
      );

    const distinta = partidas.find(
      (p) => (monedaValida(p.moneda) ?? monedaPlan.get(p.idArrePdp ?? '')) !== monedaMov,
    );
    if (distinta)
      throw excepcionConCodigo(
        400,
        `El depósito es ${monedaMov} y la partida «${distinta.concepto ?? 'sin concepto'}» está en ${
          monedaValida(distinta.moneda) ?? monedaPlan.get(distinta.idArrePdp ?? '')
        }: no se puede aplicar sin tipo de cambio.`,
        'MONEDA_DISTINTA',
      );

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
      throw excepcionConCodigo(400, 'Selecciona al menos una partida con monto.', 'SIN_MONTO');
    // Regla: el total seleccionado puede exceder el saldo del depósito hasta el
    // **margen de tolerancia** (configurable; absorbe diferencias de redondeo de
    // centavos). Más allá del margen, se rechaza.
    const tolerancia = await this.toleranciaPago();
    if (total - saldo > tolerancia + 0.0001)
      throw excepcionConCodigo(
        400,
        `El total seleccionado (${total.toFixed(2)}) excede el saldo disponible del depósito (${saldo.toFixed(2)}) por más del margen permitido (${tolerancia.toFixed(2)}).`,
        'SALDO_INSUFICIENTE',
      );

    // UNA sola llamada transaccional (D9): `arre_aplicar_pago_atomico` bloquea las partidas
    // y el movimiento, verifica que las cantidades siguen como se leyeron (si no,
    // `PARTIDA_CAMBIO` y NO se consume saldo), rechaza depósitos ya traspasados, marca las
    // partidas, registra `arre_pagos` (uidPago agrupa esta aplicación) y deja el depósito
    // agotado o con saldo a favor — todo o nada. Sustituye a las tres escrituras sueltas
    // (aplicar_pago_arrendatario + insert arre_pagos + update movbancarios).
    const db = this.supabase.comoActor(actorUid);
    const uidPago = randomUUID();
    const { data: rpcData, error } = await rpcSinTipar(db, 'arre_aplicar_pago_atomico', {
      p_idmov: dto.idmov,
      p_lineas: partidas.map((p) => ({
        idArrePdpDet: p.idArrePdpDet,
        cantidadEsperada: Number(p.cantidad) || 0,
        monto: montoPorDet.get(p.idArrePdpDet) ?? 0,
      })),
      p_fec_pago: dto.fecPago,
      p_uid_pago: uidPago,
      p_tolerancia: tolerancia,
    });
    if (error) {
      this.logger.error(`Error aplicando pago arrendatario (${dto.idmov}): ${error.message}`);
      throw excepcionConCodigo(500, 'No se pudo aplicar el pago.', 'ERROR_INTERNO');
    }
    const res = rpcData as RpcPaquete | null;
    if (res?.exito !== true) throw this.rechazoPago(res, dto.idmov);

    const idArrePdp = partidas.find((p) => p.idArrePdp)?.idArrePdp ?? null;
    const idArrendador = await this.idArrendadorDePlan(db, idArrePdp);

    // Saldo a favor: el remanente real (saldo − total). Si la diferencia cae
    // **dentro de la tolerancia** (remanente o exceso de centavos), el depósito se
    // da por **AGOTADO** (se absorbe la diferencia, sin saldo a favor residual).
    // Solo si el remanente supera la tolerancia queda disponible. La función lo decide
    // bajo candado; si no devolviera la cifra, se usa la calculada aquí (misma regla).
    const d = res.detalles ?? {};
    const remanente = Math.round((saldo - total) * 100) / 100;
    const agotado = typeof d.agotado === 'boolean' ? d.agotado : remanente <= tolerancia + 0.0001;
    const saldoAFavor = d.saldoAFavor != null ? num(d.saldoAFavor) : agotado ? 0 : remanente;
    const aplicado = d.aplicado != null ? num(d.aplicado) : total;

    await this.registrarActividad(db, {
      comentario: `Se aplicó ${aplicado.toFixed(2)} del depósito ${dto.idmov} (importe ${importe.toFixed(2)}) a ${dto.idsDetalle.length} partida(s). Saldo a favor restante: ${Math.max(0, saldoAFavor).toFixed(2)}.`,
      actorUid,
    });

    await this.aprenderOrdenante(db, idArrendador, mov.ordenante, importe);

    return { importe, aplicado, saldoAFavor: Math.max(0, saldoAFavor), agotado };
  }

  /** Código de `arre_aplicar_pago_atomico` → excepción HTTP con texto a mano (nunca el `mensaje` de la RPC). */
  private rechazoPago(res: RpcPaquete | null, idmov: string): Error {
    const codigo = res?.codigo ?? 'ERROR_INTERNO';
    const r = respuestaDeCodigoPago(codigo, res?.detalles ?? {});
    if (r) return excepcionConCodigo(r.status, r.mensaje, codigo);
    const det = res?.detalles ?? {};
    this.logger.error(
      `Error aplicando pago arrendatario (${idmov}): ${codigo}${det.sqlstate ? ` [${String(det.sqlstate)}]` : ''}${det.detalle ? ` — ${String(det.detalle)}` : ''}`,
    );
    return excepcionConCodigo(500, 'No se pudo aplicar el pago.', 'ERROR_INTERNO');
  }

  /** Falla de lectura dentro de `aplicarPago`: el detalle al log y al cliente un 500 genérico con código (regla 4b). */
  private fallaPago(contexto: string, error: { message: string }): never {
    return fallaBd(this.logger, contexto, error, 'No se pudo aplicar el pago.', 'ERROR_INTERNO');
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

  /**
   * Mapa idArrePdp → {nave, parque} (arrePdp→arrenPropiedades→naves→parques). La lógica vive en
   * `deposito.util.ts` (archivo hoja) para reutilizarla en el traspaso de depósito sin ciclos.
   */
  navePorPlan(idArrePdps: string[]): Promise<Map<string, { nave: string | null; parque: string | null }>> {
    return navePorPlanDe(this.supabase, idArrePdps);
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

    // Guarda D13: el pago del depósito de un ORIGEN con traspaso emitido aplicado no se desaplica
    // (la partida volvería a «sin pagar», D6 la ocultaría y ya no se podría cobrar, dejando al destino
    // con crédito sin respaldo). El pago del complemento de un DESTINO sí se puede desaplicar.
    await this.traspasos.exigirDepositosSinEmision(idsDetalle);

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
