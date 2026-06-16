import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { SolicitudesService } from './solicitudes.service.js';
import { BloqueoService } from './bloqueo.service.js';
import { parsearComplementoPago, validarRepContra } from './cfdi.js';
import { firmarDocumentos } from './documentos.util.js';
import type { NuevaFacturaPpdDto, NuevaParcialPpdDto } from './ppd.schemas.js';

const BUCKET_CFDI = 'CFDIproveedores';
/** Bucket privado para los XML/PDF de los Complementos de Pago (REP). */
const BUCKET_REP = 'complementospago';
const ID_ALFABETO =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Saldo de una factura PPD: total de la factura, lo solicitado (en proceso),
 * lo pagado y lo disponible para nuevas solicitudes. */
export interface SaldoPpd {
  total: number;
  solicitado: number; // Σ parciales NO rechazadas (todo lo comprometido)
  pagado: number; // Σ montoAplicado de parciales pagadas (idEstado 6/7)
  disponible: number; // total − solicitado
}

/**
 * CxP > Solicitudes de Pago PPD (clave 420). Maneja las facturas con método de
 * pago PPD (Pago en Parcialidades o Diferido): una factura grande se paga en
 * abonos. El control vive en dos tablas EXISTENTES (autorizado por el cliente):
 *  - `cxp_ppd`: el maestro de la factura (una fila por CFDI PPD).
 *  - `cxp`: cada solicitud parcial (un abono), ligada por `idCxpPPD`; fluye por
 *    los flujos normales de Aprobar (430) y Pagar (400).
 *
 * Regla de control: no se puede solicitar más de lo DISPONIBLE
 * (`total − Σ parciales no rechazadas`). El cálculo es server-side y
 * parametrizado (sin el SQL crudo de v1).
 */
@Injectable()
export class PpdService {
  private readonly logger = new Logger(PpdService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly solicitudes: SolicitudesService,
    private readonly bloqueo: BloqueoService,
  ) {}

  private generarId(n = 15): string {
    const bytes = randomBytes(n);
    let id = '';
    for (let i = 0; i < n; i++) id += ID_ALFABETO[bytes[i]! % ID_ALFABETO.length];
    return id;
  }

  // ===================== Saldo / estado de cuenta =====================

  /** Calcula el saldo de una factura PPD a partir de sus parcialidades. */
  async saldoDe(idCxpPPD: string): Promise<SaldoPpd> {
    const { data: m } = await this.supabase.admin
      .from('cxp_ppd')
      .select('total')
      .eq('idCxpPPD', idCxpPPD)
      .maybeSingle();
    const total = m?.total ?? 0;
    const { data: ps, error } = await this.supabase.admin
      .from('cxp')
      .select('total, montoAplicado, idEstado')
      .eq('idCxpPPD', idCxpPPD)
      .eq('status', true);
    if (error) throw new InternalServerErrorException(error.message);

    let solicitado = 0;
    let pagado = 0;
    for (const p of ps ?? []) {
      if (p.idEstado === 3) continue; // rechazada: libera su monto
      solicitado += p.total ?? 0;
      if (p.idEstado === 6 || p.idEstado === 7) pagado += p.montoAplicado ?? 0;
    }
    return {
      total,
      solicitado: round2(solicitado),
      pagado: round2(pagado),
      disponible: round2(total - solicitado),
    };
  }

  /** Estado de cuenta: todas las facturas PPD con sus saldos. */
  async listar() {
    const { data: maestros, error } = await this.supabase.admin
      .from('cxp_ppd')
      .select(
        'idCxpPPD, folio, idProveedor, nombreProveedor, nomCFDI, concepto, total, subtotal, fecCFDI, fecInicio, fecSolicitud, idCategoria',
      )
      .eq('status', true)
      .order('fecInicio', { ascending: false });
    if (error) throw new InternalServerErrorException(error.message);
    const lista = maestros ?? [];
    if (lista.length === 0) return [];

    const ids = lista.map((m) => m.idCxpPPD);
    const { data: parciales, error: pErr } = await this.supabase.admin
      .from('cxp')
      .select('idCxpPPD, total, montoAplicado, idEstado, moneda')
      .in('idCxpPPD', ids)
      .eq('status', true);
    if (pErr) throw new InternalServerErrorException(pErr.message);

    const agg = new Map<
      string,
      { solicitado: number; pagado: number; num: number; moneda: string }
    >();
    for (const p of parciales ?? []) {
      if (!p.idCxpPPD) continue;
      const a =
        agg.get(p.idCxpPPD) ?? { solicitado: 0, pagado: 0, num: 0, moneda: 'MXN' };
      a.moneda = p.moneda ?? a.moneda;
      if (p.idEstado !== 3) {
        a.solicitado += p.total ?? 0;
        a.num += 1;
        if (p.idEstado === 6 || p.idEstado === 7) a.pagado += p.montoAplicado ?? 0;
      }
      agg.set(p.idCxpPPD, a);
    }

    return lista.map((m) => {
      const a = agg.get(m.idCxpPPD) ?? {
        solicitado: 0,
        pagado: 0,
        num: 0,
        moneda: 'MXN',
      };
      const total = m.total ?? 0;
      return {
        ...m,
        moneda: a.moneda,
        solicitado: round2(a.solicitado),
        pagado: round2(a.pagado),
        disponible: round2(total - a.solicitado),
        numParcialidades: a.num,
        avance: total > 0 ? Math.round((a.pagado / total) * 100) : 0,
      };
    });
  }

  /** Detalle de una factura PPD: maestro + saldo + parcialidades (con estado). */
  async detalle(idCxpPPD: string) {
    const { data: m, error } = await this.supabase.admin
      .from('cxp_ppd')
      .select(
        'idCxpPPD, folio, idProveedor, nombreProveedor, nomCFDI, concepto, total, subtotal, fecCFDI, fecInicio, fecSolicitud, idCategoria, urlCFDI, urlXLM, status',
      )
      .eq('idCxpPPD', idCxpPPD)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!m || m.status === false)
      throw new NotFoundException('Factura PPD no encontrada.');

    const { data: parciales, error: pErr } = await this.supabase.admin
      .from('cxp')
      .select(
        'idCxp, total, montoAplicado, idEstado, estado, moneda, fecSolicitud, fecPago, idCategoria, ultimoComentario, nomGerente, uuidComplemento, fecComplemento, urlComplementoXml, urlComplementoPdf, complementoExento, complementoExentoMotivo, complementoExentoPor, fecComplementoExento',
      )
      .eq('idCxpPPD', idCxpPPD)
      .eq('status', true)
      .order('fc', { ascending: true });
    if (pErr) throw new InternalServerErrorException(pErr.message);

    const cuentas = await this.resolverCuentas([
      m.idCategoria,
      ...(parciales ?? []).map((p) => p.idCategoria),
    ]);
    const dispensadores = await this.resolverUsuarios(
      (parciales ?? []).map((p) => p.complementoExentoPor),
    );
    const saldo = await this.saldoDe(idCxpPPD);

    const parcialidades = await Promise.all(
      (parciales ?? []).map(async (p) => {
        const pagada = p.idEstado === 6 || p.idEstado === 7;
        const tieneRep = !!p.uuidComplemento;
        return {
          ...p,
          categoria: cuentas.get(p.idCategoria)?.cuenta ?? null,
          clasificacion: cuentas.get(p.idCategoria)?.seccion ?? null,
          // Estado del complemento (REP). Una parcialidad dispensada NO está pendiente.
          repPendiente: pagada && !tieneRep && !p.complementoExento,
          diasDesdePago: pagada ? this.diasDesde(p.fecPago) : null,
          urlComplementoXml: await this.urlFirmadaRep(p.urlComplementoXml),
          urlComplementoPdf: await this.urlFirmadaRep(p.urlComplementoPdf),
          dispensadoPorNombre: p.complementoExentoPor
            ? (dispensadores.get(p.complementoExentoPor) ?? null)
            : null,
        };
      }),
    );

    const firmadas = await firmarDocumentos(
      this.supabase.admin,
      [m.urlCFDI, m.urlXLM],
      BUCKET_CFDI,
    );

    return {
      maestro: {
        ...m,
        urlCFDI: m.urlCFDI ? (firmadas.get(m.urlCFDI) ?? null) : null,
        urlXLM: m.urlXLM ? (firmadas.get(m.urlXLM) ?? null) : null,
        categoria: cuentas.get(m.idCategoria)?.cuenta ?? null,
        clasificacion: cuentas.get(m.idCategoria)?.seccion ?? null,
      },
      saldo,
      parcialidades,
    };
  }

  /** Días naturales transcurridos desde una fecha ISO hasta hoy (null si no hay). */
  private diasDesde(iso: string | null): number | null {
    if (!iso) return null;
    const f = new Date(iso).getTime();
    if (Number.isNaN(f)) return null;
    return Math.floor((Date.now() - f) / 86_400_000);
  }

  /** Genera una URL firmada (1 h) para un archivo del bucket privado de REP. */
  private async urlFirmadaRep(path: string | null): Promise<string | null> {
    if (!path) return null;
    const { data } = await this.supabase.admin.storage
      .from(BUCKET_REP)
      .createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
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

  /** Nombre legible de usuarios por uid (para "dispensado por"). */
  private async resolverUsuarios(ids: (string | null)[]) {
    const unicos = [...new Set(ids.filter((x): x is string => !!x))];
    const mapa = new Map<string, string>();
    if (unicos.length === 0) return mapa;
    const { data } = await this.supabase.admin
      .from('catUsers')
      .select('uid, nomCompleto, nombre, apellidos')
      .in('uid', unicos);
    for (const u of data ?? [])
      mapa.set(
        u.uid,
        u.apellidos && u.nombre
          ? `${u.nombre} ${u.apellidos}`
          : (u.nomCompleto ?? u.nombre ?? u.uid),
      );
    return mapa;
  }

  // ===================== Alta =====================

  /** Analiza el CFDI PPD (XML + PDF). Si la factura ya está registrada, devuelve
   * su saldo para que el usuario solicite otro pago en lugar de duplicarla. */
  async analizar(xml: Buffer, pdf: Buffer | null) {
    const { cfdi, proveedor } = await this.solicitudes.validarCfdi(
      xml.toString('utf8'),
      pdf,
      { metodoPago: 'PPD', exigirMesActual: false, verificarDuplicado: false },
    );
    const { data: existente } = await this.supabase.admin
      .from('cxp_ppd')
      .select('idCxpPPD')
      .eq('status', true)
      .eq('folio', cfdi.uuid!)
      .maybeSingle();
    const saldo = existente ? await this.saldoDe(existente.idCxpPPD) : null;
    return {
      proveedor,
      yaRegistrada: !!existente,
      idCxpPPD: existente?.idCxpPPD ?? null,
      saldo,
      cfdi: {
        uuid: cfdi.uuid,
        folio: cfdi.folio,
        fechaCFDI: cfdi.fechaCFDI,
        emisorRfc: cfdi.emisorRfc,
        emisorNombre: cfdi.emisorNombre,
        receptorRfc: cfdi.receptorRfc,
        moneda: cfdi.moneda,
        metodoPago: cfdi.metodoPago,
        subtotal: cfdi.subtotal,
        total: cfdi.total,
        conceptoResumen: cfdi.conceptoResumen,
        conceptos: cfdi.conceptos,
        impuestos: cfdi.impuestos,
      },
    };
  }

  /** Sube XML + PDF del CFDI al bucket y devuelve sus URLs públicas. */
  private async subirArchivosCfdi(
    xml: Buffer,
    pdf: Buffer,
    rfc: string,
    uuid: string,
  ): Promise<{ urlXml: string; urlPdf: string }> {
    const subir = async (path: string, buf: Buffer, contentType: string) => {
      const { error } = await this.supabase.admin.storage
        .from(BUCKET_CFDI)
        .upload(path, buf, { contentType, upsert: true });
      if (error) {
        this.logger.error(`Error subiendo ${path}: ${error.message}`);
        throw new InternalServerErrorException(
          'No se pudieron subir los archivos del CFDI.',
        );
      }
      return this.supabase.admin.storage.from(BUCKET_CFDI).getPublicUrl(path).data
        .publicUrl;
    };
    const urlPdf = await subir(`${rfc}/${uuid}.pdf`, pdf, 'application/pdf');
    const urlXml = await subir(`${rfc}/${uuid}.xml`, xml, 'application/xml');
    return { urlXml, urlPdf };
  }

  /** Inserta una solicitud parcial (fila `cxp`) ligada al maestro + comentario. */
  private async insertarParcial(
    ctx: {
      idCxpPPD: string;
      folio: string;
      idProveedor: string;
      nombreProveedor: string | null;
      nomCFDI: string;
      concepto: string | null;
      moneda: string;
      fecCFDI: string | null;
      urlXLM: string | null;
      urlCFDI: string | null;
    },
    p: { idCategoria: string; justificacion: string; monto: number; uidGerente: string },
    actorUid: string,
  ): Promise<{ idCxp: string }> {
    const idCxp = this.generarId(15);
    const hoy = new Date().toISOString().split('T')[0]!;
    const db = this.supabase.comoActor(actorUid);

    const { error } = await db.from('cxp').insert({
      idCxp,
      uidr: actorUid,
      status: true,
      idProveedor: ctx.idProveedor,
      tipoProveedor: 1,
      nombreProveedor: ctx.nombreProveedor,
      fecCFDI: ctx.fecCFDI,
      fecSolicitud: hoy,
      folio: ctx.folio,
      idFolioDif: ctx.folio,
      idCxpPPD: ctx.idCxpPPD,
      idCategoria: p.idCategoria,
      concepto: ctx.concepto,
      subtotal: null,
      total: p.monto,
      montoAplicado: 0,
      urlXLM: ctx.urlXLM,
      urlCFDI: ctx.urlCFDI,
      ultimoComentario: p.justificacion,
      nomCFDI: ctx.nomCFDI,
      idEstado: 2, // nace Enviado → directo a la bandeja del aprobador
      moneda: ctx.moneda,
      tipoOperacion: 1,
      esUrgente: false,
      diferido: true,
      tdc: false,
      uidGerente: p.uidGerente,
    });
    if (error) {
      this.logger.error(`Error creando parcial PPD: ${error.message}`);
      throw new InternalServerErrorException('No se pudo crear la solicitud parcial.');
    }
    await db.from('cxpComentarios').insert({
      idCxpComentarios: this.generarId(10),
      idCxP: idCxp,
      status: true,
      uidr: actorUid,
      tipo: 1,
      comentario: p.justificacion,
    });
    return { idCxp };
  }

  /** Recalcula `cxp_ppd.numPagos` = nº de parcialidades no rechazadas. */
  private async actualizarContador(idCxpPPD: string, db = this.supabase.admin) {
    const { count } = await this.supabase.admin
      .from('cxp')
      .select('idCxp', { count: 'exact', head: true })
      .eq('idCxpPPD', idCxpPPD)
      .eq('status', true)
      .neq('idEstado', 3);
    await db
      .from('cxp_ppd')
      .update({ numPagos: count ?? 0 })
      .eq('idCxpPPD', idCxpPPD);
  }

  /** Primera vez: registra la factura PPD (maestro) + su primera parcialidad. */
  async crearConFactura(
    xml: Buffer,
    pdf: Buffer,
    dto: NuevaFacturaPpdDto,
    actorUid: string,
  ): Promise<{ idCxpPPD: string; idCxp: string }> {
    const { cfdi, proveedor } = await this.solicitudes.validarCfdi(
      xml.toString('utf8'),
      pdf,
      { metodoPago: 'PPD', exigirMesActual: false, verificarDuplicado: false },
    );
    await this.bloqueo.verificar(actorUid, proveedor.idProveedor);
    const uuid = cfdi.uuid!;

    // No duplicar el maestro: si ya existe, debe abonarse con "Solicitar otro pago".
    const { data: existente } = await this.supabase.admin
      .from('cxp_ppd')
      .select('idCxpPPD')
      .eq('status', true)
      .eq('folio', uuid)
      .maybeSingle();
    if (existente)
      throw new BadRequestException(
        'Esta factura PPD ya está registrada. Use "Solicitar otro pago" para abonar.',
      );

    if (dto.monto > cfdi.total + 0.01)
      throw new BadRequestException(
        `El monto solicitado (${dto.monto.toFixed(2)}) no puede exceder el total de la factura (${cfdi.total.toFixed(2)}).`,
      );

    // Aprobador (falla antes de subir archivos si la categoría no tiene responsable).
    const uidGerente = await this.solicitudes.responsableDeCategoria(dto.idCategoria);
    const { urlXml, urlPdf } = await this.subirArchivosCfdi(
      xml,
      pdf,
      cfdi.emisorRfc || 'sin-rfc',
      uuid,
    );

    const idCxpPPD = this.generarId(15);
    const hoy = new Date().toISOString().split('T')[0]!;
    const db = this.supabase.comoActor(actorUid);

    const { error: mErr } = await db.from('cxp_ppd').insert({
      idCxpPPD,
      uidr: actorUid,
      idProveedor: proveedor.idProveedor,
      tipoProveedor: 1,
      folio: uuid,
      urlXLM: urlXml,
      urlCFDI: urlPdf,
      numPagos: 1,
      fecInicio: hoy,
      total: cfdi.total,
      subtotal: cfdi.subtotal,
      montoAplicado: 0,
      nombreProveedor: proveedor.razonSocial,
      nomCFDI: cfdi.emisorNombre,
      concepto: cfdi.conceptoResumen,
      fecCFDI: cfdi.fechaCFDI,
      fecSolicitud: hoy,
      idCategoria: dto.idCategoria,
      status: true,
    });
    if (mErr) {
      this.logger.error(`Error creando maestro PPD: ${mErr.message}`);
      throw new InternalServerErrorException('No se pudo registrar la factura PPD.');
    }

    try {
      const { idCxp } = await this.insertarParcial(
        {
          idCxpPPD,
          folio: uuid,
          idProveedor: proveedor.idProveedor,
          nombreProveedor: proveedor.razonSocial,
          nomCFDI: cfdi.emisorNombre,
          concepto: cfdi.conceptoResumen,
          moneda: cfdi.moneda,
          fecCFDI: cfdi.fechaCFDI,
          urlXLM: urlXml,
          urlCFDI: urlPdf,
        },
        {
          idCategoria: dto.idCategoria,
          justificacion: dto.justificacion,
          monto: dto.monto,
          uidGerente,
        },
        actorUid,
      );
      return { idCxpPPD, idCxp };
    } catch (e) {
      // Rollback lógico: no dejar el maestro huérfano si falla la parcialidad.
      const { error: delErr } = await db
        .from('cxp_ppd')
        .delete()
        .eq('idCxpPPD', idCxpPPD);
      if (delErr)
        this.logger.error(`No se pudo revertir el maestro PPD: ${delErr.message}`);
      throw e;
    }
  }

  /** Siguientes: nueva solicitud parcial sobre una factura PPD ya registrada. */
  async nuevaParcial(
    idCxpPPD: string,
    dto: NuevaParcialPpdDto,
    actorUid: string,
  ): Promise<{ idCxp: string }> {
    const { data: m, error } = await this.supabase.admin
      .from('cxp_ppd')
      .select(
        'idCxpPPD, folio, idProveedor, nombreProveedor, nomCFDI, concepto, fecCFDI, urlXLM, urlCFDI, status',
      )
      .eq('idCxpPPD', idCxpPPD)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!m || m.status === false)
      throw new NotFoundException('Factura PPD no encontrada.');
    if (!m.idProveedor)
      throw new BadRequestException('La factura PPD no tiene proveedor asociado.');
    await this.bloqueo.verificar(actorUid, m.idProveedor);

    const saldo = await this.saldoDe(idCxpPPD);
    if (dto.monto > saldo.disponible + 0.01)
      throw new BadRequestException(
        `El monto solicitado (${dto.monto.toFixed(2)}) excede el disponible de la factura (${saldo.disponible.toFixed(2)}).`,
      );

    const uidGerente = await this.solicitudes.responsableDeCategoria(dto.idCategoria);
    const { data: ref } = await this.supabase.admin
      .from('cxp')
      .select('moneda')
      .eq('idCxpPPD', idCxpPPD)
      .eq('status', true)
      .limit(1)
      .maybeSingle();

    const res = await this.insertarParcial(
      {
        idCxpPPD,
        folio: m.folio,
        idProveedor: m.idProveedor,
        nombreProveedor: m.nombreProveedor,
        nomCFDI: m.nomCFDI,
        concepto: m.concepto,
        moneda: ref?.moneda ?? 'MXN',
        fecCFDI: m.fecCFDI,
        urlXLM: m.urlXLM,
        urlCFDI: m.urlCFDI,
      },
      {
        idCategoria: dto.idCategoria,
        justificacion: dto.justificacion,
        monto: dto.monto,
        uidGerente,
      },
      actorUid,
    );
    await this.actualizarContador(idCxpPPD, this.supabase.comoActor(actorUid));
    return res;
  }

  // ===================== Complemento de Pago (REP) =====================

  /**
   * Sube y registra el Complemento de Pago (REP) de una parcialidad PPD ya
   * pagada. Valida que el XML sea un comprobante tipo "P" que referencie el UUID
   * de la factura y cuyo importe coincida con el pago. Guarda los archivos en el
   * bucket privado `complementospago` y registra sus rutas + el UUID del REP en
   * la fila `cxp`. El PDF es opcional (respaldo).
   */
  async subirComplemento(
    idCxp: string,
    xml: Buffer,
    pdf: Buffer | null,
    actorUid: string,
  ): Promise<{ uuid: string }> {
    const { data: sol, error } = await this.supabase.admin
      .from('cxp')
      .select(
        'idCxp, idCxpPPD, idProveedor, idEstado, status, total, montoAplicado, uuidComplemento',
      )
      .eq('idCxp', idCxp)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!sol || sol.status === false)
      throw new NotFoundException('Solicitud no encontrada.');
    if (!sol.idCxpPPD)
      throw new BadRequestException('La solicitud no es una parcialidad PPD.');
    if (sol.idEstado !== 6 && sol.idEstado !== 7)
      throw new BadRequestException(
        'Solo se puede subir el complemento de una parcialidad ya pagada.',
      );
    if (sol.uuidComplemento)
      throw new BadRequestException(
        'Esta parcialidad ya tiene un complemento de pago registrado.',
      );

    // Folio (UUID) de la factura PPD y RFC del proveedor.
    const { data: maestro } = await this.supabase.admin
      .from('cxp_ppd')
      .select('folio')
      .eq('idCxpPPD', sol.idCxpPPD)
      .maybeSingle();
    if (!maestro?.folio)
      throw new InternalServerErrorException('No se encontró la factura PPD asociada.');
    const { data: prov } = await this.supabase.admin
      .from('catProveedores')
      .select('rfc')
      .eq('idProveedor', sol.idProveedor)
      .maybeSingle();
    const receptores = await this.solicitudes.rfcReceptoresAutorizados();

    // Parsear y validar el REP.
    let rep;
    try {
      rep = parsearComplementoPago(xml.toString('utf8'));
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    if (!rep.uuid)
      throw new BadRequestException('El complemento no tiene folio fiscal (UUID).');
    const errores = validarRepContra(rep, {
      folioFactura: maestro.folio,
      montoEsperado: sol.montoAplicado || sol.total,
      rfcProveedor: prov?.rfc ?? null,
      receptoresAutorizados: receptores,
    });
    if (errores.length > 0) throw new BadRequestException(errores.join(' '));

    // UUID del REP no duplicado.
    const { data: dup } = await this.supabase.admin
      .from('cxp')
      .select('idCxp')
      .eq('uuidComplemento', rep.uuid)
      .limit(1);
    if (dup && dup.length > 0)
      throw new BadRequestException(
        'Ese complemento de pago ya fue registrado en otra solicitud.',
      );

    // Subir archivos al bucket privado (se guardan las RUTAS, no URLs públicas).
    const carpeta = rep.emisorRfc || 'sin-rfc';
    const pathXml = `${carpeta}/${rep.uuid}.xml`;
    const subir = async (path: string, buf: Buffer, contentType: string) => {
      const { error: upErr } = await this.supabase.admin.storage
        .from(BUCKET_REP)
        .upload(path, buf, { contentType, upsert: true });
      if (upErr) {
        this.logger.error(`Error subiendo REP ${path}: ${upErr.message}`);
        throw new InternalServerErrorException(
          'No se pudo subir el archivo del complemento.',
        );
      }
    };
    await subir(pathXml, xml, 'application/xml');
    let pathPdf: string | null = null;
    if (pdf) {
      pathPdf = `${carpeta}/${rep.uuid}.pdf`;
      await subir(pathPdf, pdf, 'application/pdf');
    }

    const db = this.supabase.comoActor(actorUid);
    const { error: updErr } = await db
      .from('cxp')
      .update({
        urlComplementoXml: pathXml,
        urlComplementoPdf: pathPdf,
        uuidComplemento: rep.uuid,
        fecComplemento: new Date().toISOString(),
      })
      .eq('idCxp', idCxp);
    if (updErr) {
      this.logger.error(`Error registrando complemento en ${idCxp}: ${updErr.message}`);
      throw new InternalServerErrorException(
        'No se pudo registrar el complemento de pago.',
      );
    }
    await db.from('cxpComentarios').insert({
      idCxpComentarios: this.generarId(10),
      idCxP: idCxp,
      status: true,
      uidr: actorUid,
      tipo: 1,
      comentario: `Complemento de pago (REP) registrado: ${rep.uuid}.`,
    });

    return { uuid: rep.uuid };
  }

  /**
   * Dispensa de complemento por EXCEPCIÓN (permiso 403). Marca una parcialidad
   * PPD pagada como exenta de complemento (p. ej. proveedor de única vez que no
   * emitirá el REP), con un motivo obligatorio. Levanta el candado (nivel 1 y 2)
   * para esa parcialidad sin afectar las demás. Queda auditado (quién/cuándo/por qué).
   */
  async dispensarComplemento(
    idCxp: string,
    motivo: string,
    actorUid: string,
  ): Promise<{ ok: true }> {
    const { data: sol, error } = await this.supabase.admin
      .from('cxp')
      .select('idCxp, idCxpPPD, idEstado, status, uuidComplemento, complementoExento')
      .eq('idCxp', idCxp)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!sol || sol.status === false)
      throw new NotFoundException('Solicitud no encontrada.');
    if (!sol.idCxpPPD)
      throw new BadRequestException('La solicitud no es una parcialidad PPD.');
    if (sol.idEstado !== 6 && sol.idEstado !== 7)
      throw new BadRequestException(
        'Solo se puede dispensar el complemento de una parcialidad ya pagada.',
      );
    if (sol.uuidComplemento)
      throw new BadRequestException(
        'Esta parcialidad ya tiene un complemento registrado; no requiere dispensa.',
      );
    if (sol.complementoExento)
      throw new BadRequestException('Esta parcialidad ya está dispensada.');

    const db = this.supabase.comoActor(actorUid);
    const { error: updErr } = await db
      .from('cxp')
      .update({
        complementoExento: true,
        complementoExentoMotivo: motivo,
        complementoExentoPor: actorUid,
        fecComplementoExento: new Date().toISOString(),
      })
      .eq('idCxp', idCxp);
    if (updErr) {
      this.logger.error(`Error dispensando complemento ${idCxp}: ${updErr.message}`);
      throw new InternalServerErrorException(
        'No se pudo dispensar el complemento de pago.',
      );
    }
    await db.from('cxpComentarios').insert({
      idCxpComentarios: this.generarId(10),
      idCxP: idCxp,
      status: true,
      uidr: actorUid,
      tipo: 1,
      comentario: `Complemento de pago DISPENSADO por excepción. Motivo: ${motivo}`,
    });

    return { ok: true };
  }
}
