import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { mapearErrorCxp } from '../../common/filters/cxp-error-mapper.js';
import { SolicitudesService } from './solicitudes.service.js';
import { BloqueoService } from './bloqueo.service.js';
import { baseGastoCfdi, parsearComplementoPago, validarRepContra } from './cfdi.js';
import { firmarDocumentos } from './documentos.util.js';
import { recontarNumPagosPpd } from './ppd-contador.js';
import { folioDeParcial, hoyMexicoISO, patronFoliosDeFactura } from './ppd-folio.js';
import {
  leerRepConfig,
  nivelRepPendiente,
  SEVERIDAD_REP,
  type RepNivel,
} from './rep-fechas.js';
import type { NuevaFacturaPpdDto, NuevaParcialPpdDto } from './ppd.schemas.js';

const BUCKET_CFDI = 'CFDIproveedores';
/** Bucket privado para los XML/PDF de los Complementos de Pago (REP). */
const BUCKET_REP = 'complementospago';
const ID_ALFABETO =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Intentos máximos para asignar el folio de una parcialidad ante colisiones concurrentes. */
const MAX_INTENTOS_FOLIO = 3;

/**
 * ¿El error de Postgres es la violación del índice único del folio (`cxp_folio_key`)?
 * (23505 = unique_violation). Otras restricciones únicas de `cxp` NO deben reintentarse.
 */
function esFolioDuplicado(err: { code?: string; message?: string; details?: string }): boolean {
  const texto = `${err.message ?? ''} ${err.details ?? ''}`.toLowerCase();
  return err.code === '23505' && texto.includes('cxp_folio_key');
}

/** Saldo de una factura PPD: total de la factura, lo solicitado (en proceso),
 * lo pagado y lo disponible para nuevas solicitudes. */
export interface SaldoPpd {
  total: number;
  solicitado: number; // Σ parciales NO rechazadas (todo lo comprometido)
  pagado: number; // Σ montoAplicado de parciales pagadas (idEstado 6/7)
  disponible: number; // total − solicitado
  subtotalFactura: number; // base del gasto de la factura (maestro `cxp_ppd.subtotal`)
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

  /**
   * ¿El usuario puede ver TODAS las facturas PPD (no solo las suyas)? Lo pueden
   * los que tienen acceso a **Pagar solicitudes** (clave 400) y los de soporte
   * (super-admin). El resto solo ve las facturas PPD que ellos solicitaron
   * (`cxp_ppd.uidr = uid`). Misma lógica de RBAC que `PermisoGuard`.
   */
  private async puedeVerTodas(uid: string): Promise<boolean> {
    const { data: perfil } = await this.supabase.admin
      .from('catUsers')
      .select('isSupport')
      .eq('uid', uid)
      .maybeSingle();
    if (perfil?.isSupport === true) return true;
    const { data } = await this.supabase.admin
      .from('segModulosUsuarios')
      .select('acceso')
      .eq('uid', uid)
      .eq('clave', 400)
      .eq('acceso', true)
      .limit(1);
    return !!data && data.length > 0;
  }

  // ===================== Saldo / estado de cuenta =====================

  /**
   * Calcula el saldo de una factura PPD a partir de sus parcialidades. El saldo en
   * pesos sale de la MISMA lectura (maestro + parciales). El subtotal de cada pago NO se
   * calcula aquí: lo asigna la base de datos al pagarse (trigger `cxp_ppd_subtotal_al_pagar`).
   */
  async saldoDe(idCxpPPD: string): Promise<SaldoPpd> {
    const { data: m } = await this.supabase.admin
      .from('cxp_ppd')
      .select('total, subtotal')
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
      subtotalFactura: m?.subtotal ?? 0,
    };
  }

  /**
   * Estado de cuenta de las facturas PPD con sus saldos. Cada usuario ve **solo
   * sus** facturas (`uidr = actorUid`); los usuarios con acceso a *Pagar
   * solicitudes* (clave 400) o soporte ven **todas**.
   */
  async listar(actorUid: string) {
    const verTodas = await this.puedeVerTodas(actorUid);
    let query = this.supabase.admin
      .from('cxp_ppd')
      .select(
        'idCxpPPD, folio, idProveedor, nombreProveedor, nomCFDI, concepto, total, subtotal, fecCFDI, fecInicio, fecSolicitud, idCategoria, uidr',
      )
      .eq('status', true);
    if (!verTodas) query = query.eq('uidr', actorUid);
    const { data: maestros, error } = await query.order('fecInicio', {
      ascending: false,
    });
    if (error) throw new InternalServerErrorException(error.message);
    const lista = maestros ?? [];
    if (lista.length === 0) return [];

    const ids = lista.map((m) => m.idCxpPPD);
    const { data: parciales, error: pErr } = await this.supabase.admin
      .from('cxp')
      .select(
        'idCxpPPD, total, montoAplicado, idEstado, moneda, uuidComplemento, complementoExento, fecPago',
      )
      .in('idCxpPPD', ids)
      .eq('status', true);
    if (pErr) throw new InternalServerErrorException(pErr.message);

    // Nombre de quien solicitó cada PPD. `uidr` ya se usaba para filtrar la
    // visibilidad; aquí además se resuelve a nombre para mostrarlo en pantalla.
    // Una sola consulta para toda la lista (mismo helper que el detalle).
    const solicitantes = await this.resolverUsuarios(lista.map((m) => m.uidr));

    // Plazos del REP (configurables) y "hoy" para evaluar el nivel por fechas.
    const cfg = await leerRepConfig(this.supabase.admin);
    const hoy = new Date();

    const agg = new Map<
      string,
      {
        solicitado: number;
        pagado: number;
        num: number;
        moneda: string;
        repNivel: RepNivel; // nivel "peor" entre las parcialidades de la factura
      }
    >();
    for (const p of parciales ?? []) {
      if (!p.idCxpPPD) continue;
      const a =
        agg.get(p.idCxpPPD) ?? {
          solicitado: 0,
          pagado: 0,
          num: 0,
          moneda: 'MXN',
          repNivel: 'ninguno' as RepNivel,
        };
      a.moneda = p.moneda ?? a.moneda;
      if (p.idEstado !== 3) {
        a.solicitado += p.total ?? 0;
        a.num += 1;
        if (p.idEstado === 6 || p.idEstado === 7) a.pagado += p.montoAplicado ?? 0;
      }
      // Complemento (REP) pendiente: parcialidad pagada, sin REP y no dispensada.
      if (
        (p.idEstado === 6 || p.idEstado === 7) &&
        !p.uuidComplemento &&
        !p.complementoExento
      ) {
        const nivel = nivelRepPendiente(p.fecPago, hoy, cfg);
        if (SEVERIDAD_REP[nivel] > SEVERIDAD_REP[a.repNivel]) a.repNivel = nivel;
      }
      agg.set(p.idCxpPPD, a);
    }

    return lista.map((m) => {
      const a = agg.get(m.idCxpPPD) ?? {
        solicitado: 0,
        pagado: 0,
        num: 0,
        moneda: 'MXN',
        repNivel: 'ninguno' as RepNivel,
      };
      const total = m.total ?? 0;
      return {
        ...m,
        solicitante: m.uidr ? (solicitantes.get(m.uidr) ?? null) : null,
        moneda: a.moneda,
        solicitado: round2(a.solicitado),
        pagado: round2(a.pagado),
        disponible: round2(total - a.solicitado),
        numParcialidades: a.num,
        avance: total > 0 ? Math.round((a.pagado / total) * 100) : 0,
        repNivel: a.repNivel,
      };
    });
  }

  /**
   * Detalle de una factura PPD: maestro + saldo + parcialidades (con estado).
   * Respeta la visibilidad: si el usuario no puede ver todas (clave 400/soporte)
   * y la factura no es suya (`uidr`), se rechaza con 403.
   */
  async detalle(idCxpPPD: string, actorUid: string) {
    const { data: m, error } = await this.supabase.admin
      .from('cxp_ppd')
      .select(
        'idCxpPPD, folio, idProveedor, nombreProveedor, nomCFDI, concepto, total, subtotal, fecCFDI, fecInicio, fecSolicitud, idCategoria, urlCFDI, urlXLM, status, uidr',
      )
      .eq('idCxpPPD', idCxpPPD)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!m || m.status === false)
      throw new NotFoundException('Factura PPD no encontrada.');
    if (!(await this.puedeVerTodas(actorUid)) && m.uidr !== actorUid)
      throw new ForbiddenException('La factura PPD no pertenece al usuario.');

    const { data: parciales, error: pErr } = await this.supabase.admin
      .from('cxp')
      .select(
        'idCxp, uidr, total, montoAplicado, idEstado, estado, moneda, fecSolicitud, fecPago, idCategoria, ultimoComentario, nomGerente, uuidComplemento, fecComplemento, urlComplementoXml, urlComplementoPdf, complementoExento, complementoExentoMotivo, complementoExentoPor, fecComplementoExento',
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
    const conResp = await this.respuestaGerenteParciales(
      (parciales ?? []).map((p) => ({ idCxp: p.idCxp, uidr: p.uidr })),
    );
    const saldo = await this.saldoDe(idCxpPPD);

    // Plazos del REP (configurables) y "hoy" para evaluar el nivel por fechas.
    const cfg = await leerRepConfig(this.supabase.admin);
    const hoy = new Date();

    const parcialidades = await Promise.all(
      (parciales ?? []).map(async (p) => {
        const pagada = p.idEstado === 6 || p.idEstado === 7;
        const tieneRep = !!p.uuidComplemento;
        const repPendiente = pagada && !tieneRep && !p.complementoExento;
        return {
          ...p,
          categoria: cuentas.get(p.idCategoria)?.cuenta ?? null,
          clasificacion: cuentas.get(p.idCategoria)?.seccion ?? null,
          // Estado del complemento (REP). Una parcialidad dispensada NO está pendiente.
          repPendiente,
          // Nivel por fechas: 'pendiente' (ámbar) / 'vencido_proveedor' (rosado) /
          // 'vencido_usuario' (rojo). 'ninguno' si no hay pendiente.
          repNivel: repPendiente
            ? nivelRepPendiente(p.fecPago, hoy, cfg)
            : ('ninguno' as RepNivel),
          diasDesdePago: pagada ? this.diasDesde(p.fecPago) : null,
          urlComplementoXml: await this.urlFirmadaRep(p.urlComplementoXml),
          urlComplementoPdf: await this.urlFirmadaRep(p.urlComplementoPdf),
          dispensadoPorNombre: p.complementoExentoPor
            ? (dispensadores.get(p.complementoExentoPor) ?? null)
            : null,
          tieneRespuestaGerente: conResp.has(p.idCxp),
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

  /**
   * Conjunto de parcialidades con al menos un comentario de alguien distinto a su
   * solicitante (= respuesta del aprobador: rechazo/regreso/nota). Para resaltar
   * el icono 💬 en el detalle.
   */
  private async respuestaGerenteParciales(
    parciales: { idCxp: string; uidr: string | null }[],
  ): Promise<Set<string>> {
    const ids = [...new Set(parciales.map((p) => p.idCxp))];
    const solicitante = new Map(parciales.map((p) => [p.idCxp, p.uidr]));
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
   * Hilo de comentarios de una parcialidad PPD (icono 💬 del detalle). Respeta la
   * visibilidad: el solicitante de la parcialidad, o quien pueda ver todas (clave
   * 400/soporte). Marca `esSolicitante` para distinguir las respuestas del aprobador.
   */
  async comentariosParcial(idCxp: string, actorUid: string) {
    const { data: sol, error: errSol } = await this.supabase.admin
      .from('cxp')
      .select('idCxp, uidr')
      .eq('idCxp', idCxp)
      .maybeSingle();
    if (errSol) throw new InternalServerErrorException(errSol.message);
    if (!sol) throw new NotFoundException('Solicitud no encontrada.');
    if (!(await this.puedeVerTodas(actorUid)) && sol.uidr !== actorUid)
      throw new ForbiddenException('La solicitud no pertenece al usuario.');

    const { data, error } = await this.supabase.admin
      .from('cxpComentarios')
      .select('idCxpComentarios, comentario, fc, uidr')
      .eq('idCxP', idCxp)
      .eq('status', true)
      .order('fc', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    const filas = data ?? [];
    const nombres = await this.resolverUsuarios(filas.map((c) => c.uidr));
    return filas.map((c) => ({
      idCxpComentarios: c.idCxpComentarios,
      comentario: c.comentario,
      fc: c.fc,
      autor: c.uidr ? (nombres.get(c.uidr) ?? null) : null,
      esSolicitante: c.uidr === sol.uidr,
    }));
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
        descuento: cfdi.descuento,
        base: baseGastoCfdi(cfdi), // SubTotal − Descuento: lo que se guarda como subtotal
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

  /**
   * Folios que ya ocupan el índice único `cxp_folio_key` para una factura: el UUID y todos
   * los `<UUID>-…`, de TODAS las filas `cxp` (también rechazadas y `status=false`, que
   * siguen ocupando el índice). Por eso NO filtra por `status` (a diferencia de `saldoDe`).
   */
  private async foliosUsados(uuidFactura: string): Promise<string[]> {
    const { data, error } = await this.supabase.admin
      .from('cxp')
      .select('folio')
      .like('folio', patronFoliosDeFactura(uuidFactura));
    if (error) {
      this.logger.error(`Error leyendo los folios de la factura PPD: ${error.message}`);
      throw new InternalServerErrorException('No se pudo crear la solicitud parcial.');
    }
    return (data ?? []).map((r) => r.folio).filter((f): f is string => !!f);
  }

  /**
   * Inserta una solicitud parcial (fila `cxp`) ligada al maestro + comentario.
   * Folio (convención v1, ver `folioDeParcial`): la 1.ª parcialidad conserva el UUID de la
   * factura; de la 2.ª en adelante lleva `<UUID>-ddmmaaaa` (+ consecutivo si ya existe).
   * `idFolioDif` lleva SIEMPRE el UUID de la factura. Si dos peticiones eligen el mismo
   * folio a la vez, la 2.ª recibe 23505 de `cxp_folio_key`: se relee y se reintenta.
   */
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
    p: {
      idCategoria: string;
      justificacion: string;
      monto: number;
      uidGerente: string;
    },
    actorUid: string,
  ): Promise<{ idCxp: string }> {
    const idCxp = this.generarId(15);
    const hoy = hoyMexicoISO(); // hora de México (D4), no UTC
    const db = this.supabase.comoActor(actorUid);

    for (let intento = 1; ; intento++) {
      const folio = folioDeParcial(ctx.folio, hoy, await this.foliosUsados(ctx.folio));
      const { error } = await db.from('cxp').insert({
        idCxp,
        uidr: actorUid,
        status: true,
        idProveedor: ctx.idProveedor,
        tipoProveedor: 1,
        nombreProveedor: ctx.nombreProveedor,
        fecCFDI: ctx.fecCFDI,
        fecSolicitud: hoy,
        folio,
        idFolioDif: ctx.folio, // el UUID real de la factura, siempre
        idCxpPPD: ctx.idCxpPPD,
        idCategoria: p.idCategoria,
        concepto: ctx.concepto,
        // Sin subtotal hasta que se pague: el apartado lo hace la factura y la BD asigna el subtotal al pagar.
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
      if (!error) break;

      // Otra petición tomó el mismo folio entre la lectura y el insert: releer y reintentar.
      if (esFolioDuplicado(error)) {
        if (intento < MAX_INTENTOS_FOLIO) {
          this.logger.warn(
            `Folio ${folio} ya ocupado (intento ${intento}/${MAX_INTENTOS_FOLIO}); se relee y se reintenta.`,
          );
          continue;
        }
        this.logger.error(`No se pudo asignar un folio libre a la parcial PPD: ${error.message}`);
        throw new ConflictException(
          'Se registraron otros pagos de esta factura al mismo tiempo y no se pudo asignar el folio. Intente de nuevo.',
        );
      }
      mapearErrorCxp(error); // traduce errores de trigger CxP (p. ej. periodo cerrado) a 400/403 claros
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

  /** Recalcula `cxp_ppd.numPagos` = nº de parcialidades no rechazadas (helper compartido). */
  private async actualizarContador(idCxpPPD: string, db = this.supabase.admin) {
    const err = await recontarNumPagosPpd(this.supabase.admin, db, idCxpPPD);
    if (err) this.logger.warn(`No se pudo recontar numPagos de ${idCxpPPD}: ${err}`);
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

    // El folio es ÚNICO en `cxp` (índice cxp_folio_key): la factura pudo haberse
    // registrado antes como solicitud normal (PUE) o como parcialidad de otra PPD.
    // Detectarlo aquí evita el "Error interno del servidor" (violación de unicidad)
    // y da un mensaje claro al usuario.
    const { data: enCxp } = await this.supabase.admin
      .from('cxp')
      .select('idCxp, estado, fecSolicitud, idCxpPPD')
      .eq('folio', uuid)
      .limit(1)
      .maybeSingle();
    if (enCxp) {
      const estado = enCxp.estado ? ` con estado "${enCxp.estado}"` : '';
      const desde = enCxp.fecSolicitud ? ` desde el ${enCxp.fecSolicitud}` : '';
      const comoPpd = enCxp.idCxpPPD
        ? ' Ya forma parte de una factura PPD.'
        : ' Se registró como una solicitud de pago normal.';
      throw new BadRequestException(
        `Esta factura (folio ${uuid}) ya está registrada en CxP${estado}${desde}.` +
          `${comoPpd} No puede registrarse de nuevo.`,
      );
    }

    if (dto.monto > cfdi.total + 0.01)
      throw new BadRequestException(
        `El monto solicitado (${dto.monto.toFixed(2)}) no puede exceder el total de la factura (${cfdi.total.toFixed(2)}).`,
      );

    // Base del gasto = SubTotal − Descuento (las retenciones no restan). Es la cifra del maestro:
    // la factura aparta esa base completa al aprobarse el primer pago. Se calcula ANTES de subir
    // archivos: si no da una base positiva, no debe quedar nada a medias.
    const base = baseGastoCfdi(cfdi);
    if (!(base > 0))
      throw new BadRequestException(
        'No se puede calcular la base de la factura (SubTotal menos Descuento). Revise el CFDI.',
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
    const hoy = hoyMexicoISO(); // hora de México (D4), no UTC
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
      subtotal: base,
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
        'idCxpPPD, folio, idProveedor, nombreProveedor, nomCFDI, concepto, fecCFDI, urlXLM, urlCFDI, status, uidr, idCategoria',
      )
      .eq('idCxpPPD', idCxpPPD)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!m || m.status === false)
      throw new NotFoundException('Factura PPD no encontrada.');
    // La cuenta se pide una sola vez, al subir la factura: todo pago nuevo usa la de la factura
    // (se ignora lo que mande el cliente). Así el presupuesto de una factura no se reparte entre cuentas.
    const idCategoria = m.idCategoria;
    if (!idCategoria)
      throw new BadRequestException('La factura PPD no tiene cuenta asignada. Avise a soporte.');
    // Solo el dueño de la factura PPD (o quien puede ver todas: clave 400/soporte)
    // puede agregar parcialidades sobre ella.
    if (!(await this.puedeVerTodas(actorUid)) && m.uidr !== actorUid)
      throw new ForbiddenException('La factura PPD no pertenece al usuario.');
    if (!m.idProveedor)
      throw new BadRequestException('La factura PPD no tiene proveedor asociado.');
    await this.bloqueo.verificar(actorUid, m.idProveedor);

    // Periodo de captura abierto (Fechas CxP): el trigger de la BD rechaza el INSERT en días
    // no habilitados. Se avisa ANTES de calcular nada, con un 400 claro (igual que el alta).
    if (!(await this.solicitudes.puedeInsertar()).habilitado)
      throw new BadRequestException(
        'El periodo de captura está cerrado; no se pueden registrar solicitudes en este momento.',
      );

    const saldo = await this.saldoDe(idCxpPPD);
    if (dto.monto > saldo.disponible + 0.01)
      throw new BadRequestException(
        `El monto solicitado (${dto.monto.toFixed(2)}) excede el disponible de la factura (${saldo.disponible.toFixed(2)}).`,
      );

    // Una factura sin base registrada (heredada cuyo XML aún no se leyó) no puede apartar presupuesto:
    // se rechaza en lugar de dejar un pago que el presupuesto no ve.
    if (!(saldo.subtotalFactura > 0))
      throw new BadRequestException(
        'La factura PPD no tiene su subtotal registrado. Avise a soporte para completarlo antes de solicitar un pago.',
      );

    const uidGerente = await this.solicitudes.responsableDeCategoria(idCategoria);
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
        idCategoria,
        justificacion: dto.justificacion,
        monto: dto.monto,
        uidGerente,
      },
      actorUid,
    );

    // Verificación posterior (concurrencia): dos peticiones simultáneas pueden haber leído
    // el mismo saldo e insertar entre las dos más de lo disponible. Se relee el saldo con
    // la fila ya insertada; si se pasó, se deshace ESTA parcial (fila + su comentario).
    // Si las dos pasaron a la vez, se deshacen ambas y cada una recibe 409: es seguro y
    // el usuario solo reintenta.
    const db = this.supabase.comoActor(actorUid);
    const despues = await this.saldoDe(idCxpPPD);
    if (despues.disponible < -0.01) {
      const { error: cErr } = await db.from('cxpComentarios').delete().eq('idCxP', res.idCxp);
      const { error: xErr } = await db.from('cxp').delete().eq('idCxp', res.idCxp);
      if (cErr || xErr) {
        this.logger.error(
          `No se pudo deshacer la parcial ${res.idCxp} que excedió el saldo: ${(xErr ?? cErr)?.message}`,
        );
        throw new InternalServerErrorException('No se pudo registrar la solicitud parcial.');
      }
      await this.actualizarContador(idCxpPPD, db);
      throw new ConflictException(
        'Otro pago de esta factura se registró al mismo tiempo y ya no alcanza el saldo disponible. Revise el saldo e intente de nuevo.',
      );
    }

    await this.actualizarContador(idCxpPPD, db);
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
    // El PDF (opcional) debe ser del mismo complemento que el XML.
    if (pdf) await this.solicitudes.verificarPdfCorrespondeXml(pdf, rep.uuid);

    // Un mismo REP puede amparar 2 o más parcialidades de LA MISMA factura (D3, Jereff
    // 2026-11-02): el UUID del REP se acepta repetido solo entre filas con el mismo
    // `idCxpPPD`. Los importes de las parcialidades que ya lo usan se descuentan de los
    // DoctoRelacionado del REP (`montosYaCubiertos`): cada documento ampara una sola vez.
    const { data: usos, error: usosErr } = await this.supabase.admin
      .from('cxp')
      .select('idCxp, idCxpPPD, total, montoAplicado')
      .eq('uuidComplemento', rep.uuid);
    if (usosErr) throw new InternalServerErrorException(usosErr.message);
    const mismaFactura = (usos ?? []).filter((u) => u.idCxpPPD === sol.idCxpPPD);
    const deOtraFactura = (usos ?? []).filter((u) => u.idCxpPPD !== sol.idCxpPPD);

    const errores = validarRepContra(rep, {
      folioFactura: maestro.folio,
      montoEsperado: sol.montoAplicado || sol.total,
      rfcProveedor: prov?.rfc ?? null,
      receptoresAutorizados: receptores,
      montosYaCubiertos: mismaFactura.map((u) => u.montoAplicado || u.total || 0),
    });
    if (errores.length > 0) throw new BadRequestException(errores.join(' '));

    // UUID del REP no duplicado en OTRA factura (en la misma factura se permite, ver arriba).
    if (deOtraFactura.length > 0)
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
    // UPDATE condicionado: solo escribe si la parcialidad aún no tiene complemento (evita que
    // dos subidas simultáneas pisen la misma fila).
    const { data: upd, error: updErr } = await db
      .from('cxp')
      .update({
        urlComplementoXml: pathXml,
        urlComplementoPdf: pathPdf,
        uuidComplemento: rep.uuid,
        fecComplemento: new Date().toISOString(),
      })
      .eq('idCxp', idCxp)
      .is('uuidComplemento', null)
      .select('idCxp');
    if (updErr) {
      this.logger.error(`Error registrando complemento en ${idCxp}: ${updErr.message}`);
      throw new InternalServerErrorException(
        'No se pudo registrar el complemento de pago.',
      );
    }
    if (!upd || upd.length === 0)
      throw new ConflictException(
        'Esta parcialidad ya tiene un complemento de pago registrado.',
      );

    // Re-verificación tras escribir (carrera entre parcialidades que suben el MISMO REP a la vez):
    // con todos los usos ya escritos, se vuelve a validar. Si no cabe, se deshace y se responde 409.
    const { data: usos2 } = await this.supabase.admin
      .from('cxp')
      .select('idCxp, idCxpPPD, total, montoAplicado')
      .eq('uuidComplemento', rep.uuid);
    const otros = (usos2 ?? []).filter((u) => u.idCxp !== idCxp);
    const errores2 = otros.some((u) => u.idCxpPPD !== sol.idCxpPPD)
      ? ['Ese complemento de pago ya fue registrado en otra solicitud.']
      : validarRepContra(rep, {
          folioFactura: maestro.folio,
          montoEsperado: sol.montoAplicado || sol.total,
          rfcProveedor: prov?.rfc ?? null,
          receptoresAutorizados: receptores,
          montosYaCubiertos: otros.map((u) => u.montoAplicado || u.total || 0),
        });
    if (errores2.length > 0) {
      // Los archivos no se borran: la ruta `${rfc}/${uuid}` la comparten las parcialidades del REP.
      await db
        .from('cxp')
        .update({
          urlComplementoXml: null,
          urlComplementoPdf: null,
          uuidComplemento: null,
          fecComplemento: null,
        })
        .eq('idCxp', idCxp);
      throw new ConflictException(
        'Este complemento se registró al mismo tiempo en otra parcialidad. Revise y vuelva a intentar.',
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
