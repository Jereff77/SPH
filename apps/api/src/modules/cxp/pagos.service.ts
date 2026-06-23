import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PDFParse } from 'pdf-parse';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { parsearComprobante } from './comprobantes.parser.js';
import { firmarDocumento, firmarDocumentos } from './documentos.util.js';
import type { RegistrarPagoDto } from './pagos.schemas.js';

const ID_ALFABETO =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

const BUCKET_COMPROBANTES = 'cxp';
const BUCKET_CFDI = 'CFDIproveedores';

/** Estados de pago realizado (para "Mostrar pagos realizados"). */
const ESTADOS_PAGADOS = [6, 7];

/**
 * Detecta el error de PostgreSQL `unique_violation` (23505) sobre la clave de
 * rastreo de `movbancarios`. Sirve para devolver un 409 con un mensaje claro
 * ("ya existe un pago con esa clave de rastreo") en vez de un 500 genérico que
 * el filtro global enmascara como "Error interno del servidor".
 */
function esRastreoDuplicado(err: {
  code?: string;
  message?: string;
  details?: string;
}): boolean {
  const txt = `${err.message ?? ''} ${err.details ?? ''}`.toLowerCase();
  return err.code === '23505' && (txt.includes('rastreo') || txt.includes('movbancarios'));
}

/** Datos extraídos del comprobante por el webhook (mapeados a nuestros campos). */
export interface DatosComprobante {
  fecOperacion: string; // yyyy-MM-dd
  horaOperacion: string; // HH:mm
  ordenante: string;
  ctaDestino: string;
  bcoDestino: string;
  beneficiario: string;
  importe: number;
  concepto: string;
  referencia: string;
  autorizacion: string;
  claveRastreo: string;
}

export interface FiltrosPagos {
  /** Multi-selección de años. Array vacío/undefined = usa default (año actual). */
  anio?: number[];
  /** Multi-selección de meses (1-12). Array vacío/undefined = usa default (mes actual). */
  mes?: number[];
  numSem?: number;
  idEstado?: number;
  idProveedor?: string;
  cuenta?: string;
  seccion?: string;
  incluirPagados?: boolean;
}

/**
 * CxP > "Pagar solicitudes" (clave 400). Vista de tesorería: lista las
 * solicitudes (por defecto Aprobadas, idEstado=4) con todos sus datos y permite
 * registrar el pago / conciliación bancaria. Reemplaza la pantalla v1
 * `solicitudes_cx_p` (que usaba SQL interpolado inseguro) con consultas tipadas.
 */
@Injectable()
export class PagosService {
  private readonly logger = new Logger(PagosService.name);

  constructor(private readonly supabase: SupabaseService) {}

  private generarId(n = 12): string {
    const bytes = randomBytes(n);
    let id = '';
    for (let i = 0; i < n; i++) id += ID_ALFABETO[bytes[i]! % ID_ALFABETO.length];
    return id;
  }

  private readonly COLS =
    'idCxp, folio, idProveedor, nombreProveedor, nomCFDI, fecCFDI, fecSolicitud, fecAutorizacion, rangoSemana, idEstado, estado, idCategoria, concepto, subtotal, total, montoAplicado, urlCFDI, urlXLM, idMovBancarios, uidr, autorizo, numAnio, numMes, numSem, moneda, tdc, completada, ultimoComentario';

  /** Resuelve qué idCategoria corresponden a una cuenta/sección (para filtrar). */
  private async idCategoriasDe(cuenta?: string, seccion?: string): Promise<string[]> {
    let q = this.supabase.admin.from('PresCategorias').select('idCategoria');
    if (cuenta) q = q.eq('cuenta', cuenta);
    if (seccion) q = q.eq('seccion', seccion);
    const { data } = await q;
    return (data ?? []).map((c) => c.idCategoria);
  }

  async listar(filtros: FiltrosPagos) {
    const ahora = new Date();
    // Arrays: si están vacíos, usar el default (año/mes actual).
    const anios = filtros.anio?.length ? filtros.anio : [ahora.getFullYear()];
    const meses = filtros.mes?.length ? filtros.mes : [ahora.getMonth() + 1];

    // Estado: explícito → ese; si no, Aprobado (4); con incluirPagados, agrega 6/7.
    let estados: number[];
    if (filtros.idEstado != null) estados = [filtros.idEstado];
    else if (filtros.incluirPagados) estados = [4, ...ESTADOS_PAGADOS];
    else estados = [4];

    let query = this.supabase.admin
      .from('cxp')
      .select(this.COLS)
      .eq('status', true)
      .in('numAnio', anios)
      .in('numMes', meses)
      .in('idEstado', estados);

    if (filtros.numSem != null) query = query.eq('numSem', filtros.numSem);
    if (filtros.idProveedor) query = query.eq('idProveedor', filtros.idProveedor);
    if (filtros.cuenta || filtros.seccion) {
      const ids = await this.idCategoriasDe(filtros.cuenta, filtros.seccion);
      if (ids.length === 0) return { filas: [], totales: this.totalesVacios() };
      query = query.in('idCategoria', ids);
    }
    query = query.order('numSem', { ascending: false }).order('fecSolicitud', {
      ascending: false,
    });

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(error.message);
    const filas = data ?? [];

    // Enriquecer: cuenta/sección, solicitó (uidr) y autorizó (autorizo).
    const cuentasMap = await this.resolverCuentas(filas.map((r) => r.idCategoria));
    const uids = [
      ...filas.map((r) => r.uidr),
      ...filas.map((r) => r.autorizo),
    ].filter((x): x is string => !!x);
    const nombres = await this.resolverUsuarios(uids);
    const conResp = await this.resolverRespuestaGerente(
      filas.map((r) => ({ idCxp: r.idCxp, uidr: r.uidr })),
    );

    const enriquecidas = filas.map((r) => ({
      ...r,
      cuenta: cuentasMap.get(r.idCategoria)?.cuenta ?? null,
      seccion: cuentasMap.get(r.idCategoria)?.seccion ?? null,
      justificacion: r.ultimoComentario ?? null,
      solicitoNombre: r.uidr ? (nombres.get(r.uidr) ?? null) : null,
      autorizoNombre: r.autorizo ? (nombres.get(r.autorizo) ?? null) : null,
      tieneRespuestaGerente: conResp.has(r.idCxp),
    }));

    // Firmar los documentos (buckets privados de CxP): URL firmada al vuelo.
    const firmadas = await firmarDocumentos(
      this.supabase.admin,
      enriquecidas.flatMap((r) => [r.urlCFDI, r.urlXLM]),
      BUCKET_CFDI,
    );
    for (const r of enriquecidas) {
      r.urlCFDI = r.urlCFDI ? (firmadas.get(r.urlCFDI) ?? null) : null;
      r.urlXLM = r.urlXLM ? (firmadas.get(r.urlXLM) ?? null) : null;
    }

    const totales = enriquecidas.reduce(
      (acc, r) => {
        acc.subtotal += r.subtotal ?? 0;
        acc.total += r.total ?? 0;
        acc.montoAplicado += r.montoAplicado ?? 0;
        return acc;
      },
      this.totalesVacios(),
    );

    return { filas: enriquecidas, totales };
  }

  private totalesVacios() {
    return { subtotal: 0, total: 0, montoAplicado: 0 };
  }

  private async resolverCuentas(ids: (string | null)[]) {
    const unicos = [...new Set(ids.filter((x): x is string => !!x))];
    const mapa = new Map<string, { cuenta: string | null; seccion: string | null }>();
    if (unicos.length === 0) return mapa;
    const { data } = await this.supabase.admin
      .from('PresCategorias')
      .select('idCategoria, cuenta, seccion')
      .in('idCategoria', unicos);
    for (const c of data ?? [])
      mapa.set(c.idCategoria, { cuenta: c.cuenta, seccion: c.seccion });
    return mapa;
  }

  private async resolverUsuarios(ids: string[]) {
    const unicos = [...new Set(ids)];
    const mapa = new Map<string, string>();
    if (unicos.length === 0) return mapa;
    const { data } = await this.supabase.admin
      .from('catUsers')
      .select('uid, nomCompleto, nombre, apellidos')
      .in('uid', unicos);
    for (const u of data ?? [])
      mapa.set(
        u.uid,
        u.nombre && u.apellidos
          ? `${u.nombre} ${u.apellidos}`
          : (u.nomCompleto ?? u.nombre ?? u.uid),
      );
    return mapa;
  }

  /**
   * Conjunto de solicitudes con al menos un comentario de alguien distinto al
   * solicitante de esa solicitud (= respuesta del aprobador: rechazo/regreso/nota
   * al aprobar). Para resaltar el icono 💬 del listado.
   */
  private async resolverRespuestaGerente(
    filas: { idCxp: string; uidr: string | null }[],
  ): Promise<Set<string>> {
    const ids = [...new Set(filas.map((f) => f.idCxp))];
    const solicitante = new Map(filas.map((f) => [f.idCxp, f.uidr]));
    const conResp = new Set<string>();
    if (ids.length === 0) return conResp;
    const { data } = await this.supabase.admin
      .from('cxpComentarios')
      .select('idCxP, uidr')
      .eq('status', true)
      .in('idCxP', ids);
    for (const c of data ?? []) {
      if (c.idCxP && c.uidr && c.uidr !== solicitante.get(c.idCxP))
        conResp.add(c.idCxP);
    }
    return conResp;
  }

  /**
   * Hilo de comentarios de una solicitud (icono 💬). Vista de tesorería (clave 400):
   * NO valida pertenencia (ve solicitudes de todos). Marca `esSolicitante` para que
   * el front distinga los mensajes del aprobador (rechazo/regreso).
   */
  async comentarios(idCxp: string) {
    const { data: sol, error: errSol } = await this.supabase.admin
      .from('cxp')
      .select('idCxp, uidr')
      .eq('idCxp', idCxp)
      .maybeSingle();
    if (errSol) throw new InternalServerErrorException(errSol.message);
    if (!sol) throw new NotFoundException('Solicitud no encontrada.');

    const { data, error } = await this.supabase.admin
      .from('cxpComentarios')
      .select('idCxpComentarios, comentario, fc, uidr')
      .eq('idCxP', idCxp)
      .eq('status', true)
      .order('fc', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    const filas = data ?? [];
    const nombres = await this.resolverUsuarios(
      filas.map((c) => c.uidr).filter((x): x is string => !!x),
    );
    return filas.map((c) => ({
      idCxpComentarios: c.idCxpComentarios,
      comentario: c.comentario,
      fc: c.fc,
      autor: c.uidr ? (nombres.get(c.uidr) ?? null) : null,
      esSolicitante: c.uidr === sol.uidr,
    }));
  }

  /** Opciones para los filtros: años, proveedores y categorías. */
  async filtros() {
    const [anios, provs, cats] = await Promise.all([
      this.supabase.admin
        .from('cxp')
        .select('numAnio')
        .eq('status', true)
        .not('numAnio', 'is', null),
      this.supabase.admin
        .from('catProveedores')
        .select('idProveedor, razonSocial')
        .eq('status', true)
        .order('razonSocial', { ascending: true }),
      this.supabase.admin
        .from('PresCategorias')
        .select('idCategoria, cuenta, seccion')
        .eq('status', true)
        .order('cuenta', { ascending: true }),
    ]);
    const aniosUnicos = [
      ...new Set((anios.data ?? []).map((a) => a.numAnio).filter((x): x is number => !!x)),
    ].sort((a, b) => b - a);
    return {
      anios: aniosUnicos,
      proveedores: provs.data ?? [],
      categorias: cats.data ?? [],
    };
  }

  // ===================== Registro de pago / conciliación =====================

  /** Lee la solicitud y valida que se pueda pagar (Aprobada y sin pago previo). */
  private async pagable(idCxp: string) {
    const { data, error } = await this.supabase.admin
      .from('cxp')
      .select('idCxp, status, idEstado, total, folio, montoAplicado, idMovBancarios, numAnio, numMes, idCxpPPD')
      .eq('idCxp', idCxp)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!data || data.status === false)
      throw new NotFoundException('Solicitud no encontrada.');
    if (data.idEstado === 6 || data.idEstado === 7 || data.idMovBancarios)
      throw new BadRequestException('La solicitud ya tiene un pago aplicado.');
    if (data.idEstado !== 4)
      throw new BadRequestException(
        'Solo se pueden pagar solicitudes en estado Aprobado.',
      );
    return data;
  }

  /**
   * Si la solicitud pertenece a una factura PPD, recalcula y persiste el
   * `montoAplicado` del maestro (`cxp_ppd`) = Σ de lo pagado por sus
   * parcialidades (idEstado 6/7). Mantiene el saldo del maestro coherente con v1
   * tras pagar/asignar/desaplicar. No-op si la solicitud no es PPD.
   */
  private async sincronizarMaestroPpd(
    idCxpPPD: string | null | undefined,
    db: ReturnType<SupabaseService['comoActor']>,
  ): Promise<void> {
    if (!idCxpPPD) return;
    const { data, error } = await this.supabase.admin
      .from('cxp')
      .select('montoAplicado, idEstado')
      .eq('idCxpPPD', idCxpPPD)
      .eq('status', true);
    if (error) {
      this.logger.error(`No se pudo recalcular el saldo PPD: ${error.message}`);
      return;
    }
    const pagado = (data ?? [])
      .filter((r) => r.idEstado === 6 || r.idEstado === 7)
      .reduce((s, r) => s + (r.montoAplicado ?? 0), 0);
    const { error: upErr } = await db
      .from('cxp_ppd')
      .update({ montoAplicado: Math.round(pagado * 100) / 100 })
      .eq('idCxpPPD', idCxpPPD);
    if (upErr)
      this.logger.error(`No se pudo actualizar el maestro PPD: ${upErr.message}`);
  }

  /** Registra un pago manual: inserta el movimiento bancario y aplica el pago. */
  async registrarPago(
    idCxp: string,
    dto: RegistrarPagoDto,
    comprobante: { buffer: Buffer; ext: string; contentType: string } | null,
    actorUid: string,
  ): Promise<{ idmov: string }> {
    const sol = await this.pagable(idCxp);
    // El importe del pago debe coincidir con el total de la solicitud.
    if (Math.abs(dto.importe - (sol.total ?? 0)) > 0.01) {
      throw new BadRequestException(
        `El importe del pago (${dto.importe.toFixed(2)}) no coincide con el total a pagar (${(sol.total ?? 0).toFixed(2)}).`,
      );
    }
    const db = this.supabase.comoActor(actorUid);
    const idmov = this.generarId(16);
    const rastreo = dto.claveRastreo || this.generarId(20);

    // Comprobante: si ya viene una URL (Opción B, subido al analizar), se usa;
    // si llega un archivo (captura manual), se sube ahora.
    let imgComp: string | null = dto.urlComprobante || null;
    if (!imgComp && comprobante) {
      const path = `private/${sol.numAnio ?? 'sa'}/${idmov}.${comprobante.ext}`;
      const { error: upErr } = await this.supabase.admin.storage
        .from(BUCKET_COMPROBANTES)
        .upload(path, comprobante.buffer, {
          contentType: comprobante.contentType,
          upsert: true,
        });
      if (upErr) {
        this.logger.error(`Error subiendo comprobante: ${upErr.message}`);
        throw new InternalServerErrorException('No se pudo subir el comprobante.');
      }
      imgComp = this.supabase.admin.storage
        .from(BUCKET_COMPROBANTES)
        .getPublicUrl(path).data.publicUrl;
    }

    const { error: movErr } = await db.from('movbancarios').insert({
      idmov,
      rastreo,
      tipo: 'Transferencias',
      Operacion: 'CARGA MANUAL',
      asunto: 'CARGA MANUAL',
      manual: true,
      aplicado: true,
      importe: dto.importe,
      fecOperacion: dto.fecOperacion,
      horaOperacion: dto.horaOperacion || null,
      ordenante: dto.ordenante || null,
      ctaDestino: dto.ctaDestino || null,
      bcoDestino: dto.bcoDestino || null,
      beneficiario: dto.beneficiario || null,
      cancepto: dto.concepto || null,
      referencia: dto.referencia || null,
      autorizacion: dto.autorizacion || null,
      imgComp,
      folioCFDI: sol.folio,
      // `numAnio` y `numMes` son columnas GENERADAS en `movbancarios`
      // (EXTRACT year/month de `fecOperacion`): NO se pueden insertar — Postgres
      // las calcula solo. Insertarlas provocaba un 500 ("cannot insert a
      // non-DEFAULT value into column numAnio") al aplicar el pago.
    });
    if (movErr) {
      this.logger.error(`Error insertando movbancario: ${movErr.message}`);
      // 23505 = unique_violation. La clave de rastreo es ÚNICA: si ya existe, el
      // pago muy probablemente ya fue registrado. Devolvemos 409 con mensaje claro
      // (un 500 lo enmascararía como "Error interno del servidor").
      if (esRastreoDuplicado(movErr)) {
        throw new ConflictException(
          `Ya existe un movimiento bancario con la clave de rastreo "${rastreo}". ` +
            `Es muy probable que este pago ya se haya registrado. Verifícalo en los ` +
            `movimientos bancarios antes de volver a aplicarlo; si fuera un pago ` +
            `distinto, usa una clave de rastreo diferente.`,
        );
      }
      throw new InternalServerErrorException('No se pudo registrar el movimiento bancario.');
    }

    const completada = dto.importe >= (sol.total ?? 0);
    const { error: cxpErr } = await db
      .from('cxp')
      .update({
        montoAplicado: dto.importe,
        idEstado: 6,
        pagador: actorUid,
        fecPago: new Date().toISOString(),
        idMovBancarios: idmov,
        completada,
      })
      .eq('idCxp', idCxp);
    if (cxpErr) {
      this.logger.error(`Error aplicando pago a cxp ${idCxp}: ${cxpErr.message}`);
      // Compensación (atomicidad manual): el movimiento ya se insertó (paso 1); si
      // la factura no se pudo ligar (paso 2), revertimos el INSERT para NO dejar un
      // movimiento bancario huérfano — que además bloquearía el reintento por la
      // restricción única de `rastreo`.
      const { error: rollbackErr } = await db
        .from('movbancarios')
        .delete()
        .eq('idmov', idmov);
      if (rollbackErr)
        this.logger.error(
          `No se pudo revertir el movimiento huérfano ${idmov} tras fallar el pago: ${rollbackErr.message}`,
        );
      throw new InternalServerErrorException('No se pudo aplicar el pago a la solicitud.');
    }
    await this.sincronizarMaestroPpd(sol.idCxpPPD, db);

    await db.from('cxpComentarios').insert({
      idCxpComentarios: this.generarId(10),
      idCxP: idCxp,
      status: true,
      uidr: actorUid,
      tipo: 1,
      comentario: `Pago aplicado por ${dto.importe.toFixed(2)} ${'MXN'} (ref. ${dto.referencia || 'N/D'})`,
    });

    return { idmov };
  }

  // ---------- Opción A: asignar un movimiento bancario existente ----------

  private readonly MOV_COLS =
    'idmov, importe, fecOperacion, beneficiario, ordenante, bcoDestino, ctaDestino, referencia, cancepto, rastreo, imgComp, tipo';
  /** Tipo de los movimientos importados del banco (estado de cuenta SPEI). */
  private readonly TIPO_TRANSFER = 'Transferencia SPEI';

  /**
   * Movimientos bancarios candidatos para PAGAR esta solicitud. Replica la
   * consulta de v1 (`arrastrar_pago`):
   *   (beneficiario ILIKE '%nombreProveedor%' OR importe = total)
   *   AND aplicado = false AND tipo = 'Transferencia SPEI'
   * El OR por importe cubre cuando el nombre del beneficiario viene truncado.
   */
  async movimientos(idCxp: string) {
    const { data: sol, error } = await this.supabase.admin
      .from('cxp')
      .select('idCxp, nombreProveedor, total')
      .eq('idCxp', idCxp)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!sol) throw new NotFoundException('Solicitud no encontrada.');

    const base = () =>
      this.supabase.admin
        .from('movbancarios')
        .select(this.MOV_COLS)
        .eq('aplicado', false)
        .eq('tipo', this.TIPO_TRANSFER);

    const nombre = (sol.nombreProveedor ?? '').trim();
    const total = sol.total ?? 0;

    const [porNombre, porImporte] = await Promise.all([
      nombre
        ? base().ilike('beneficiario', `%${nombre}%`).limit(200)
        : Promise.resolve({ data: [], error: null }),
      total > 0
        ? base().eq('importe', total).limit(200)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (porNombre.error) throw new InternalServerErrorException(porNombre.error.message);
    if (porImporte.error) throw new InternalServerErrorException(porImporte.error.message);

    // Unir ambos resultados sin duplicar (por idmov).
    const mapa = new Map<string, (typeof porNombre.data)[number]>();
    for (const m of [...(porNombre.data ?? []), ...(porImporte.data ?? [])]) {
      if (!mapa.has(m.idmov)) mapa.set(m.idmov, m);
    }
    const movs = [...mapa.values()].sort((a, b) =>
      (b.fecOperacion ?? '').localeCompare(a.fecOperacion ?? ''),
    );
    const firmadas = await firmarDocumentos(
      this.supabase.admin,
      movs.map((m) => m.imgComp),
      BUCKET_COMPROBANTES,
    );
    return movs.map((m) => ({
      ...m,
      imgComp: m.imgComp ? (firmadas.get(m.imgComp) ?? null) : null,
    }));
  }

  /** Asigna un movimiento bancario existente a la solicitud (lo aplica). */
  async asignarMovimiento(
    idCxp: string,
    idmov: string,
    actorUid: string,
  ): Promise<void> {
    const sol = await this.pagable(idCxp);
    const { data: mov, error: movErr } = await this.supabase.admin
      .from('movbancarios')
      .select('idmov, importe, aplicado')
      .eq('idmov', idmov)
      .maybeSingle();
    if (movErr) throw new InternalServerErrorException(movErr.message);
    if (!mov) throw new NotFoundException('Movimiento bancario no encontrado.');
    if (mov.aplicado)
      throw new BadRequestException('Ese movimiento ya está aplicado a otra solicitud.');

    const importe = mov.importe ?? 0;
    const db = this.supabase.comoActor(actorUid);
    await db
      .from('movbancarios')
      .update({ aplicado: true, folioCFDI: sol.folio })
      .eq('idmov', idmov);
    const { error: cxpErr } = await db
      .from('cxp')
      .update({
        montoAplicado: importe,
        idEstado: 6,
        pagador: actorUid,
        fecPago: new Date().toISOString(),
        idMovBancarios: idmov,
        completada: importe >= (sol.total ?? 0),
      })
      .eq('idCxp', idCxp);
    if (cxpErr) {
      this.logger.error(`Error asignando mov a cxp ${idCxp}: ${cxpErr.message}`);
      throw new InternalServerErrorException('No se pudo asignar el movimiento.');
    }
    await this.sincronizarMaestroPpd(sol.idCxpPPD, db);
    await db.from('cxpComentarios').insert({
      idCxpComentarios: this.generarId(10),
      idCxP: idCxp,
      status: true,
      uidr: actorUid,
      tipo: 1,
      comentario: `Se aplicó pago por ${importe.toFixed(2)} (movimiento ${idmov}).`,
    });
  }

  // ---------- Opción B: leer el comprobante PDF con el webhook N8N ----------

  private parseImporte(v: unknown): number {
    if (v === null || v === undefined) return 0;
    const s = String(v).replace(/[^0-9.,-]/g, '');
    // Si hay coma y punto, la coma es separador de miles.
    const norm = s.includes(',') && s.includes('.') ? s.replace(/,/g, '') : s.replace(',', '.');
    const n = parseFloat(norm);
    return Number.isFinite(n) ? n : 0;
  }

  private parseFecha(v: unknown): string {
    const s = String(v ?? '').trim();
    if (!s) return '';
    // yyyy-MM-dd
    let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    // dd/MM/yyyy o dd-MM-yyyy
    m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(s);
    if (m) return `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
    return '';
  }

  private parseHora(v: unknown): string {
    const m = /(\d{1,2}):(\d{2})/.exec(String(v ?? ''));
    return m ? `${m[1]!.padStart(2, '0')}:${m[2]}` : '';
  }

  /** Extrae el texto de un PDF (igual patrón que solicitudes.service). */
  private async textoDePdf(pdf: Buffer): Promise<string> {
    const parser = new PDFParse({ data: new Uint8Array(pdf) });
    try {
      const res = await parser.getText();
      return res.text ?? '';
    } catch (e) {
      this.logger.warn(`No se pudo extraer texto del comprobante: ${(e as Error).message}`);
      return '';
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  }

  /**
   * Sube el comprobante PDF al bucket y extrae sus datos. Primero intenta un
   * parser determinista local (sin red ni IA); si el formato no se reconoce,
   * cae al fallback de IA (edge `comprobante-extraer`). Devuelve los datos
   * mapeados + la URL del PDF (para registrar el pago sin re-subirlo).
   */
  async analizarComprobante(
    idCxp: string,
    pdf: Buffer,
    actorUid: string,
  ): Promise<{ datos: DatosComprobante; urlComprobante: string }> {
    const { data: sol, error } = await this.supabase.admin
      .from('cxp')
      .select('idCxp, idProveedor, status, idEstado')
      .eq('idCxp', idCxp)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!sol || sol.status === false)
      throw new NotFoundException('Solicitud no encontrada.');

    // Subir el PDF (bucket público para que N8N pueda leerlo).
    const idmov = this.generarId(16);
    const path = `private/${sol.idProveedor ?? 'sin'}/${idmov}.pdf`;
    const { error: upErr } = await this.supabase
      .comoActor(actorUid)
      .storage.from(BUCKET_COMPROBANTES)
      .upload(path, pdf, { contentType: 'application/pdf', upsert: true });
    if (upErr) {
      this.logger.error(`Error subiendo comprobante: ${upErr.message}`);
      throw new InternalServerErrorException('No se pudo subir el comprobante.');
    }
    const urlComprobante = this.supabase.admin.storage
      .from(BUCKET_COMPROBANTES)
      .getPublicUrl(path).data.publicUrl;

    // 1º: parser determinista local (sin red, sin IA). Cubre los formatos
    // conocidos (p.ej. BanBajío). Si reconoce el formato y obtiene los campos
    // clave, devolvemos sin llamar a ningún servicio externo.
    const texto = await this.textoDePdf(pdf);
    const local = parsearComprobante(texto);
    if (local) {
      this.logger.log(`Comprobante leído localmente (formato: ${local.tipo}).`);
      return { datos: local.datos, urlComprobante };
    }
    this.logger.warn(
      'Formato de comprobante no reconocido por el parser local; usando fallback de IA.',
    );

    // Fallback: leer el comprobante con IA (edge `comprobante-extraer`, que
    // custodia el secreto OPENROUTER_API_KEY). Le pasamos el TEXTO ya extraído
    // (nunca el PDF ni una URL pública), así no se expone el documento.
    let o: Record<string, unknown>;
    try {
      const { data, error: edgeErr } = await this.supabase.admin.functions.invoke<{
        datos?: Record<string, unknown>;
      }>('comprobante-extraer', { body: { texto } });
      if (edgeErr) throw edgeErr;
      o = data?.datos ?? {};
    } catch (e) {
      this.logger.error(`Fallback de IA del comprobante falló: ${(e as Error).message}`);
      throw new InternalServerErrorException(
        'No se pudo leer el comprobante automáticamente. Capture los datos manualmente.',
      );
    }

    const str = (k: string) => (o[k] === null || o[k] === undefined ? '' : String(o[k]).trim());
    const datos: DatosComprobante = {
      fecOperacion: this.parseFecha(o['FechadeOperacion']),
      horaOperacion: this.parseHora(o['HoradeOperacion']),
      ordenante: str('NombredelOrdenante'),
      ctaDestino: str('CuentaDestino'),
      bcoDestino: str('BancoDestino'),
      beneficiario: str('NombreBeneficiario'),
      importe: this.parseImporte(o['Importe']),
      concepto: str('ConceptodePago'),
      referencia: str('Referencia'),
      autorizacion: str('NoAutorizacion'),
      claveRastreo: str('ClaveRastreo'),
    };
    return { datos, urlComprobante };
  }

  /** Devuelve el movimiento bancario asociado a una solicitud (para el modal). */
  async verTransferencia(idCxp: string) {
    const { data: sol, error } = await this.supabase.admin
      .from('cxp')
      .select('idCxp, idMovBancarios')
      .eq('idCxp', idCxp)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!sol?.idMovBancarios)
      throw new NotFoundException('La solicitud no tiene pago aplicado.');
    const { data: mov } = await this.supabase.admin
      .from('movbancarios')
      .select(
        'idmov, importe, fecOperacion, horaOperacion, ordenante, ctaDestino, bcoDestino, beneficiario, cancepto, referencia, autorizacion, rastreo, imgComp, manual',
      )
      .eq('idmov', sol.idMovBancarios)
      .maybeSingle();
    if (!mov) return null;
    return {
      ...mov,
      imgComp: await firmarDocumento(this.supabase.admin, mov.imgComp, BUCKET_COMPROBANTES),
    };
  }

  /** Desaplica el pago (permiso 401): revierte la solicitud a Aprobado (4). */
  async desaplicarPago(idCxp: string, actorUid: string): Promise<void> {
    const { data: sol, error } = await this.supabase.admin
      .from('cxp')
      .select('idCxp, idMovBancarios, idEstado, idCxpPPD')
      .eq('idCxp', idCxp)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!sol) throw new NotFoundException('Solicitud no encontrada.');
    if (!sol.idMovBancarios && sol.idEstado !== 6 && sol.idEstado !== 7)
      throw new BadRequestException('La solicitud no tiene un pago aplicado.');

    const db = this.supabase.comoActor(actorUid);
    if (sol.idMovBancarios) {
      await db
        .from('movbancarios')
        .update({ aplicado: false, folioCFDI: null })
        .eq('idmov', sol.idMovBancarios);
    }
    const { error: cxpErr } = await db
      .from('cxp')
      .update({
        montoAplicado: 0,
        idEstado: 4,
        pagador: null,
        fecPago: null,
        idMovBancarios: null,
        completada: false,
      })
      .eq('idCxp', idCxp);
    if (cxpErr) {
      this.logger.error(`Error desaplicando pago ${idCxp}: ${cxpErr.message}`);
      throw new InternalServerErrorException('No se pudo desaplicar el pago.');
    }
    await this.sincronizarMaestroPpd(sol.idCxpPPD, db);
    await db.from('cxpComentarios').insert({
      idCxpComentarios: this.generarId(10),
      idCxP: idCxp,
      status: true,
      uidr: actorUid,
      tipo: 1,
      comentario: 'Se desaplicó el pago de la solicitud.',
    });
  }

  /** Batch (permiso 402): marca como "Aprobado sin pago aplicado" el mes/año. */
  async aprobadosSinPago(mes: number, anio: number, actorUid: string) {
    const { data, error } = await this.supabase
      .comoActor(actorUid)
      .rpc('cxp_aprobados_sin_pago_aplicado', {
        p_num_mes: mes,
        p_num_anio: anio,
      });
    if (error) {
      this.logger.error(`Error en aprobados-sin-pago: ${error.message}`);
      throw new InternalServerErrorException(error.message);
    }
    return data;
  }
}
