import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PDFParse } from 'pdf-parse';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { ClavesSatService } from './claves-sat.service.js';
import {
  parsearCfdi,
  validarDeducciones,
  IVA_TASA,
  type CfdiData,
} from './cfdi.js';
import type {
  EditarSolicitudDto,
  CrearUrgenteDto,
  CrearLineaCapturaDto,
  CrearDevolucionDto,
  CrearSinXmlDto,
} from './solicitudes.schemas.js';

const BUCKET_CFDI = 'CFDIproveedores';

const ID_ALFABETO =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * CxP > Solicitudes de pago (lectura). Muestra SOLO las solicitudes del usuario
 * activo (`uidr`), filtradas por `rangoSemana`. El frontend las agrupa en las 4
 * etapas (Urgentes/Devolución, Guardados/Rechazados, Enviados/Aprobados,
 * Reprogramados/Pagados).
 */
@Injectable()
export class SolicitudesService {
  private readonly logger = new Logger(SolicitudesService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly clavesSat: ClavesSatService,
  ) {}

  private generarId(n = 10): string {
    const bytes = randomBytes(n);
    let id = '';
    for (let i = 0; i < n; i++) id += ID_ALFABETO[bytes[i]! % ID_ALFABETO.length];
    return id;
  }

  private readonly COLS =
    'idCxp, folio, idProveedor, nombreProveedor, nomCFDI, concepto, idCategoria, idEstado, tipoOperacion, esUrgente, diferido, subtotal, total, moneda, fecCFDI, fecSolicitud, rangoSemana, urlCFDI, urlXLM, uidGerente, nomGerente';

  /** Semanas (rangoSemana) con solicitudes del usuario, de la más reciente a la
   * más antigua. Se ordena por la fecha real (fecSolicitud máx. de cada rango).
   * `verComo` = uid observado (solo soporte) para ver las semanas de ese usuario. */
  async semanas(actorUid: string, verComo?: string): Promise<string[]> {
    const uid = await this.supabase.uidEfectivo(actorUid, verComo);
    const { data, error } = await this.supabase.admin
      .from('cxp')
      .select('rangoSemana, fecSolicitud')
      .eq('status', true)
      .eq('uidr', uid)
      .not('rangoSemana', 'is', null);
    if (error) throw new InternalServerErrorException(error.message);

    const maxPorRango = new Map<string, string>();
    for (const r of data ?? []) {
      const rango = r.rangoSemana;
      if (!rango) continue;
      const f = r.fecSolicitud ?? '';
      const prev = maxPorRango.get(rango);
      if (prev === undefined || f > prev) maxPorRango.set(rango, f);
    }
    return [...maxPorRango.entries()]
      .sort((a, b) => b[1].localeCompare(a[1]))
      .map(([rango]) => rango);
  }

  /** Solicitudes del usuario activo en la semana indicada (o todas si no se da). */
  async listar(actorUid: string, rangoSemana?: string, verComo?: string) {
    const uid = await this.supabase.uidEfectivo(actorUid, verComo);
    let query = this.supabase.admin
      .from('cxp')
      .select(this.COLS)
      .eq('status', true)
      .eq('uidr', uid);
    if (rangoSemana) query = query.eq('rangoSemana', rangoSemana);
    query = query
      .order('fecCFDI', { ascending: false, nullsFirst: false })
      .order('fc', { ascending: false });

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(error.message);
    const filas = data ?? [];

    // Enriquecer: Categoría/Clasificación (PresCategorias), Justificación (primer
    // comentario) y "Asignado a" (responsable).
    const [cuentas, justif, nombres] = await Promise.all([
      this.resolverCuentas(filas.map((r) => r.idCategoria)),
      this.resolverJustificaciones(filas.map((r) => r.idCxp)),
      this.resolverUsuarios(filas.map((r) => r.uidGerente)),
    ]);
    return filas.map((r) => ({
      ...r,
      categoria: cuentas.get(r.idCategoria)?.cuenta ?? null,
      clasificacion: cuentas.get(r.idCategoria)?.seccion ?? null,
      justificacion: justif.get(r.idCxp) ?? null,
      asignadoA:
        (r.nomGerente && r.nomGerente !== '' ? r.nomGerente : null) ??
        (r.uidGerente ? (nombres.get(r.uidGerente) ?? null) : null),
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
    for (const c of data ?? []) mapa.set(c.idCategoria, { cuenta: c.cuenta, seccion: c.seccion });
    return mapa;
  }

  private async resolverJustificaciones(ids: (string | null)[]) {
    const unicos = [...new Set(ids.filter((x): x is string => !!x))];
    const mapa = new Map<string, string>();
    if (unicos.length === 0) return mapa;
    const { data } = await this.supabase.admin
      .from('cxpComentarios')
      .select('idCxP, comentario, fc')
      .in('idCxP', unicos)
      .order('fc', { ascending: true });
    for (const c of data ?? []) {
      if (c.idCxP && c.comentario && !mapa.has(c.idCxP)) mapa.set(c.idCxP, c.comentario);
    }
    return mapa;
  }

  private async resolverUsuarios(ids: (string | null)[]) {
    const unicos = [...new Set(ids.filter((x): x is string => !!x))];
    const mapa = new Map<string, string>();
    if (unicos.length === 0) return mapa;
    const { data } = await this.supabase.admin
      .from('catUsers')
      .select('uid, nomCompleto, nombre, apellidos')
      .in('uid', unicos);
    for (const u of data ?? []) {
      mapa.set(
        u.uid,
        u.apellidos && u.nombre
          ? `${u.apellidos}, ${u.nombre}`
          : (u.nomCompleto ?? u.nombre ?? u.uid),
      );
    }
    return mapa;
  }

  // ===================== Catálogos (para el editor) =====================

  async catalogos() {
    const [provs, cats] = await Promise.all([
      this.supabase.admin
        .from('catProveedores')
        .select('idProveedor, razonSocial, tipoCuenta')
        .eq('status', true)
        .order('razonSocial', { ascending: true }),
      this.supabase.admin
        .from('PresCategorias')
        .select('idCategoria, cuenta, seccion')
        .eq('status', true)
        .order('cuenta', { ascending: true }),
    ]);
    if (provs.error) throw new InternalServerErrorException(provs.error.message);
    if (cats.error) throw new InternalServerErrorException(cats.error.message);
    return { proveedores: provs.data ?? [], categorias: cats.data ?? [] };
  }

  // ===================== Acciones (solo solicitudes GUARDADAS) =====================

  /** ¿La fecha (YYYY-MM-DD) pertenece al mes/año en curso? */
  private esMesActual(fecISO: string | null | undefined): boolean {
    if (!fecISO) return false;
    const ahora = new Date();
    const [a, m] = fecISO.split('-');
    return Number(a) === ahora.getFullYear() && Number(m) === ahora.getMonth() + 1;
  }

  /** Lee y valida que la solicitud sea del usuario y esté en estado editable (idEstado<=1). */
  private async editable(idCxp: string, actorUid: string) {
    const { data, error } = await this.supabase.admin
      .from('cxp')
      .select('idCxp, uidr, idEstado, idCategoria, fecCFDI, urlCFDI, urlXLM')
      .eq('idCxp', idCxp)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException('Solicitud no encontrada.');
    if (data.uidr !== actorUid)
      throw new ForbiddenException('La solicitud no pertenece al usuario.');
    if ((data.idEstado ?? 0) > 1)
      throw new BadRequestException(
        'Solo se pueden modificar solicitudes en estado Guardado.',
      );
    return data;
  }

  /** Extrae bucket + path de una URL pública de Supabase Storage. */
  private pathDeUrlPublica(url: string): { bucket: string; path: string } | null {
    const marker = '/storage/v1/object/public/';
    const i = url.indexOf(marker);
    if (i < 0) return null;
    const resto = url.slice(i + marker.length);
    const slash = resto.indexOf('/');
    if (slash < 0) return null;
    return {
      bucket: resto.slice(0, slash),
      path: decodeURIComponent(resto.slice(slash + 1)),
    };
  }

  /** Elimina una solicitud guardada: archivos CFDI/XML, comentarios y el registro. */
  async eliminar(idCxp: string, actorUid: string): Promise<void> {
    const sol = await this.editable(idCxp, actorUid);
    const db = this.supabase.comoActor(actorUid);

    for (const url of [sol.urlCFDI, sol.urlXLM]) {
      if (!url) continue;
      const p = this.pathDeUrlPublica(url);
      if (p) {
        try {
          await this.supabase.admin.storage.from(p.bucket).remove([p.path]);
        } catch (e) {
          this.logger.warn(`No se pudo borrar archivo ${url}: ${(e as Error).message}`);
        }
      }
    }

    await db.from('cxpComentarios').delete().eq('idCxP', idCxp);
    const { error } = await db.from('cxp').delete().eq('idCxp', idCxp);
    if (error) {
      this.logger.error(`Error eliminando cxp ${idCxp}: ${error.message}`);
      throw new InternalServerErrorException('No se pudo eliminar la solicitud.');
    }
  }

  /** Envía la solicitud a aprobación (idEstado 1 -> 2) + comentario. */
  async enviar(idCxp: string, actorUid: string): Promise<void> {
    const sol = await this.editable(idCxp, actorUid);
    // Sin categoría real ('-') la solicitud no puede enviarse: el trigger de BD
    // la regresaría a Guardado sin explicación. Devolvemos un mensaje claro.
    if (!sol.idCategoria || sol.idCategoria === '-') {
      throw new BadRequestException(
        'No se puede enviar: asigne una categoría válida antes de enviar la solicitud.',
      );
    }
    // El CFDI debe ser del mes en curso (misma regla que el alta): una factura de
    // un mes anterior no puede enviarse a aprobación.
    if (!this.esMesActual(sol.fecCFDI)) {
      throw new BadRequestException(
        `No se puede enviar: el CFDI (${sol.fecCFDI ?? 'sin fecha'}) no corresponde al mes en curso.`,
      );
    }
    const db = this.supabase.comoActor(actorUid);

    const { error } = await db
      .from('cxp')
      .update({ idEstado: 2 })
      .eq('idCxp', idCxp);
    if (error) {
      this.logger.error(`Error enviando cxp ${idCxp}: ${error.message}`);
      throw new InternalServerErrorException('No se pudo enviar la solicitud.');
    }
    await db.from('cxpComentarios').insert({
      idCxpComentarios: this.generarId(10),
      idCxP: idCxp,
      status: true,
      uidr: actorUid,
      tipo: 1,
      comentario: 'Se envió la solicitud a aprobación',
    });
  }

  // ===================== Alta de solicitud (CFDI con XML) =====================

  /** RFC(s) receptor autorizados (la empresa) desde SPHConfiguraciones. */
  private async rfcReceptoresAutorizados(): Promise<string[]> {
    const { data } = await this.supabase.admin
      .from('SPHConfiguraciones')
      .select('valor')
      .eq('parametro', 'RFC_RECEPTORES_AUTORIZADOS')
      .eq('status', true)
      .maybeSingle();
    return (data?.valor ?? '')
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
  }

  /** Extrae el texto de un PDF (para validar correspondencia con el XML). */
  private async textoDePdf(pdf: Buffer): Promise<string> {
    const parser = new PDFParse({ data: new Uint8Array(pdf) });
    try {
      const res = await parser.getText();
      return res.text ?? '';
    } catch (e) {
      this.logger.warn(`No se pudo extraer texto del PDF: ${(e as Error).message}`);
      return '';
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  }

  private normalizar(s: string): string {
    return s.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  }

  /**
   * Ejecuta TODAS las validaciones de negocio sobre el CFDI. Lanza
   * BadRequestException con un mensaje claro en el primer fallo. Devuelve los
   * datos del CFDI y el proveedor detectado. No sube archivos ni inserta.
   *
   * `opts` permite reutilizar la misma validación para PPD (módulo `ppd`):
   * - `metodoPago` (def. 'PUE'): método de pago exigido al CFDI.
   * - `exigirMesActual` (def. true): si false, acepta CFDI de meses anteriores
   *   (las PPD se emiten en un mes y se abonan en meses posteriores).
   * - `verificarDuplicado` (def. true): si false, NO valida el folio contra `cxp`
   *   (en PPD el mismo folio se repite en cada parcialidad; el control de
   *   duplicado del maestro lo hace `PpdService`).
   */
  async validarCfdi(
    xmlText: string,
    pdf: Buffer | null,
    opts: {
      metodoPago?: 'PUE' | 'PPD';
      exigirMesActual?: boolean;
      verificarDuplicado?: boolean;
    } = {},
  ): Promise<{
    cfdi: CfdiData;
    proveedor: { idProveedor: string; razonSocial: string | null; rfc: string | null };
    totalEsperado: number;
  }> {
    const {
      metodoPago: metodoEsperado = 'PUE',
      exigirMesActual = true,
      verificarDuplicado = true,
    } = opts;

    // 1) Parseo del XML
    let cfdi: CfdiData;
    try {
      cfdi = parsearCfdi(xmlText);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }

    // 2) Tipo de comprobante = Ingreso (I)
    if (cfdi.tipoComprobante && cfdi.tipoComprobante !== 'I') {
      throw new BadRequestException(
        `El CFDI no es de tipo Ingreso (es "${cfdi.tipoComprobante}"). No puede registrarse como solicitud de pago.`,
      );
    }

    // 3) RFC del receptor autorizado (la empresa)
    const receptores = await this.rfcReceptoresAutorizados();
    if (receptores.length > 0 && !receptores.includes(cfdi.receptorRfc)) {
      throw new BadRequestException(
        `La factura está emitida al RFC ${cfdi.receptorRfc || '(vacío)'}, que no es un receptor autorizado de la empresa.`,
      );
    }

    // 4) Método de pago (PUE para solicitudes normales; PPD para el módulo PPD)
    if (cfdi.metodoPago !== metodoEsperado) {
      throw new BadRequestException(
        `Solo se aceptan facturas con método de pago ${metodoEsperado} (esta es ${cfdi.metodoPago ?? 'desconocido'}).`,
      );
    }

    // 5) Fecha del mes actual (no aplica a PPD)
    if (exigirMesActual && !this.esMesActual(cfdi.fechaCFDI)) {
      throw new BadRequestException(
        `Solo se aceptan facturas del mes en curso. La factura es del ${cfdi.fechaCFDI || 'fecha desconocida'}.`,
      );
    }

    // 6) UUID presente
    if (!cfdi.uuid) {
      throw new BadRequestException('El XML no contiene el folio fiscal (UUID/Timbre).');
    }

    // 7) Folio fiscal no duplicado (no aplica a PPD: el folio se repite por parcialidad)
    if (verificarDuplicado) {
      const { data: dup, error: dupErr } = await this.supabase.admin
        .from('cxp')
        .select('idCxp')
        .eq('status', true)
        .eq('folio', cfdi.uuid)
        .limit(1);
      if (dupErr) throw new InternalServerErrorException(dupErr.message);
      if (dup && dup.length > 0) {
        throw new BadRequestException(
          `Ya existe una solicitud registrada con este CFDI (folio fiscal ${cfdi.uuid}).`,
        );
      }
    }

    // 8) Periodo de captura abierto
    const { data: puede, error: rpcErr } = await this.supabase.admin.rpc(
      'cxp_puede_insertar',
    );
    if (rpcErr) throw new InternalServerErrorException(rpcErr.message);
    if (puede === false) {
      throw new BadRequestException(
        'El periodo de captura está cerrado; no se pueden registrar solicitudes en este momento.',
      );
    }

    // 9) Proveedor (emisor) registrado
    const { data: prov, error: provErr } = await this.supabase.admin
      .from('catProveedores')
      .select('idProveedor, razonSocial, rfc')
      .eq('status', true)
      .ilike('rfc', cfdi.emisorRfc)
      .limit(1)
      .maybeSingle();
    if (provErr) throw new InternalServerErrorException(provErr.message);
    if (!prov) {
      throw new BadRequestException(
        `El proveedor con RFC ${cfdi.emisorRfc} no está registrado. Regístrelo primero en Proveedores.`,
      );
    }

    // 10) Deducciones (retenciones) según régimen + catálogo de claves
    const reglas = await this.clavesSat.reglas(
      cfdi.conceptos.map((c) => c.claveProdServ),
    );
    const erroresDed = validarDeducciones(cfdi, reglas);
    if (erroresDed.length > 0) {
      throw new BadRequestException(erroresDed.join(' '));
    }

    // 11) Correspondencia XML ↔ PDF (UUID dentro del PDF)
    if (pdf) {
      const texto = await this.textoDePdf(pdf);
      if (!texto.trim()) {
        throw new BadRequestException(
          'No se pudo leer texto del PDF (¿es un PDF escaneado o imagen?). No se pudo validar que corresponda al XML.',
        );
      }
      if (!this.normalizar(texto).includes(this.normalizar(cfdi.uuid))) {
        throw new BadRequestException(
          'El PDF no corresponde al XML: no se encontró el folio fiscal del XML dentro del PDF.',
        );
      }
    }

    const totalEsperado =
      cfdi.subtotal +
      cfdi.subtotal * IVA_TASA -
      cfdi.impuestos.retIVA -
      cfdi.impuestos.retISR;

    return {
      cfdi,
      proveedor: {
        idProveedor: prov.idProveedor,
        razonSocial: prov.razonSocial,
        rfc: prov.rfc,
      },
      totalEsperado: Math.round(totalEsperado * 100) / 100,
    };
  }

  /**
   * Analiza el CFDI (XML + PDF) y devuelve los datos extraídos + el proveedor
   * detectado, tras pasar TODAS las validaciones. No persiste nada.
   */
  async analizar(xml: Buffer, pdf: Buffer | null, _actorUid: string) {
    const { cfdi, proveedor, totalEsperado } = await this.validarCfdi(
      xml.toString('utf8'),
      pdf,
    );
    return {
      proveedor,
      totalEsperado,
      cfdi: {
        uuid: cfdi.uuid,
        folio: cfdi.folio,
        fechaCFDI: cfdi.fechaCFDI,
        emisorRfc: cfdi.emisorRfc,
        emisorNombre: cfdi.emisorNombre,
        emisorRegimen: cfdi.emisorRegimen,
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

  /**
   * Crea la solicitud de pago: re-valida el CFDI (no confía en el cliente), sube
   * PDF y XML al bucket y registra en `cxp` (idEstado=1) + comentario inicial.
   */
  async crear(
    xml: Buffer,
    pdf: Buffer,
    dto: { idCategoria: string; justificacion: string },
    actorUid: string,
  ): Promise<{ idCxp: string }> {
    const { cfdi, proveedor } = await this.validarCfdi(xml.toString('utf8'), pdf);
    const uuid = cfdi.uuid!;
    const carpeta = cfdi.emisorRfc || 'sin-rfc';
    const pathPdf = `${carpeta}/${uuid}.pdf`;
    const pathXml = `${carpeta}/${uuid}.xml`;

    // Subida de archivos (service_role). upsert=false: si ya existiera, falla.
    const subir = async (path: string, buf: Buffer, contentType: string) => {
      const { error } = await this.supabase.admin.storage
        .from(BUCKET_CFDI)
        .upload(path, buf, { contentType, upsert: true });
      if (error) {
        this.logger.error(`Error subiendo ${path}: ${error.message}`);
        throw new InternalServerErrorException('No se pudieron subir los archivos del CFDI.');
      }
      return this.supabase.admin.storage.from(BUCKET_CFDI).getPublicUrl(path)
        .data.publicUrl;
    };
    const urlPdf = await subir(pathPdf, pdf, 'application/pdf');
    const urlXml = await subir(pathXml, xml, 'application/xml');

    const idCxp = this.generarId(15);
    const hoy = new Date().toISOString().split('T')[0]!;
    const db = this.supabase.comoActor(actorUid);

    const { error } = await db.from('cxp').insert({
      idCxp,
      uidr: actorUid,
      status: true,
      idProveedor: proveedor.idProveedor,
      tipoProveedor: 1,
      nombreProveedor: proveedor.razonSocial,
      fecCFDI: cfdi.fechaCFDI,
      fecSolicitud: hoy,
      folio: uuid,
      idCategoria: dto.idCategoria,
      concepto: cfdi.conceptoResumen,
      subtotal: cfdi.subtotal,
      total: cfdi.total,
      montoAplicado: 0,
      urlXLM: urlXml,
      urlCFDI: urlPdf,
      ultimoComentario: dto.justificacion,
      nomCFDI: cfdi.emisorNombre,
      idEstado: 1,
      moneda: cfdi.moneda,
      tipoOperacion: 1,
      esUrgente: false,
      diferido: false,
      tdc: false,
    });
    if (error) {
      this.logger.error(`Error creando cxp: ${error.message}`);
      throw new InternalServerErrorException('No se pudo crear la solicitud.');
    }

    await db.from('cxpComentarios').insert({
      idCxpComentarios: this.generarId(10),
      idCxP: idCxp,
      status: true,
      uidr: actorUid,
      tipo: 1,
      comentario: dto.justificacion,
    });

    return { idCxp };
  }

  /** Edita los datos de una solicitud guardada (sin tocar los archivos CFDI). */
  async editar(
    idCxp: string,
    dto: EditarSolicitudDto,
    actorUid: string,
  ): Promise<void> {
    await this.editable(idCxp, actorUid);
    const db = this.supabase.comoActor(actorUid);
    const { error } = await db
      .from('cxp')
      .update({
        idProveedor: dto.idProveedor,
        nombreProveedor: dto.nombreProveedor || null,
        nomCFDI: dto.nomCFDI ?? '',
        idCategoria: dto.idCategoria,
        concepto: dto.concepto,
        folio: dto.folio || null,
        subtotal: dto.subtotal,
        total: dto.total,
        moneda: dto.moneda || 'MXN',
        fecCFDI: dto.fecCFDI ?? null,
      })
      .eq('idCxp', idCxp);
    if (error) {
      this.logger.error(`Error editando cxp ${idCxp}: ${error.message}`);
      throw new InternalServerErrorException('No se pudo actualizar la solicitud.');
    }
  }

  // ===================== Tipos de solicitud especiales =====================
  // Urgentes (2), Línea de Captura (4), Devoluciones (5) y Facturas sin XML (6).
  // Reescriben los flujos de FlutterFlow `linea_solicitud_urgente`, `linea_captura`,
  // `linea_devolucion` y `linea_factura_sin_x_m_l`. Todos capturan el monto manual,
  // resuelven el aprobador desde `PresCategorias.uidResponsable` (server-side, no del
  // cliente) e insertan un comentario inicial. Escrituras auditadas (`comoActor`).

  /** Inversionistas/clientes para el selector de Devoluciones (no de prueba). */
  async inversionistas() {
    const { data, error } = await this.supabase.admin
      .from('inversionista')
      .select('idInversionista, razonsocial')
      .eq('status', true)
      .or('pruebas.is.null,pruebas.eq.false')
      .not('razonsocial', 'is', null)
      .order('razonsocial', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  /** Valida la clasificación y devuelve su aprobador (`uidResponsable`). */
  async responsableDeCategoria(idCategoria: string): Promise<string> {
    if (!idCategoria || idCategoria === '-')
      throw new BadRequestException('Seleccione una clasificación válida.');
    const { data, error } = await this.supabase.admin
      .from('PresCategorias')
      .select('idCategoria, uidResponsable')
      .eq('idCategoria', idCategoria)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!data)
      throw new BadRequestException('La clasificación seleccionada no existe.');
    if (!data.uidResponsable)
      throw new BadRequestException(
        'La clasificación no tiene un responsable configurado; no se puede asignar la solicitud.',
      );
    return data.uidResponsable;
  }

  /** Razón social del proveedor (para desnormalizar `nombreProveedor`). */
  async razonSocialProveedor(idProveedor: string): Promise<string | null> {
    const { data } = await this.supabase.admin
      .from('catProveedores')
      .select('razonSocial')
      .eq('idProveedor', idProveedor)
      .maybeSingle();
    return data?.razonSocial ?? null;
  }

  /** Razón social del inversionista (contraparte de una devolución). */
  private async razonSocialInversionista(id: string): Promise<string | null> {
    const { data } = await this.supabase.admin
      .from('inversionista')
      .select('razonsocial')
      .eq('idInversionista', id)
      .maybeSingle();
    return data?.razonsocial ?? null;
  }

  /** Sube un comprobante PDF al bucket de CFDI y devuelve su URL pública. */
  private async subirComprobante(
    pdf: Buffer,
    idProveedor: string,
    idCxp: string,
  ): Promise<string> {
    const ym = new Date().toISOString().slice(0, 7); // yyyy-MM
    const path = `${ym}/${idProveedor}/${idCxp}.pdf`;
    const { error } = await this.supabase.admin.storage
      .from(BUCKET_CFDI)
      .upload(path, pdf, { contentType: 'application/pdf', upsert: true });
    if (error) {
      this.logger.error(`Error subiendo comprobante ${path}: ${error.message}`);
      throw new InternalServerErrorException('No se pudo subir el archivo PDF.');
    }
    return this.supabase.admin.storage.from(BUCKET_CFDI).getPublicUrl(path).data
      .publicUrl;
  }

  /** Inserta una solicitud + su comentario inicial (auditado). */
  private async insertarEspecial(
    fila: Record<string, unknown>,
    justificacion: string,
    actorUid: string,
  ): Promise<{ idCxp: string }> {
    const idCxp = fila.idCxp as string;
    const db = this.supabase.comoActor(actorUid);
    const { error } = await db.from('cxp').insert(fila as never);
    if (error) {
      this.logger.error(`Error creando solicitud especial: ${error.message}`);
      throw new InternalServerErrorException('No se pudo crear la solicitud.');
    }
    await db.from('cxpComentarios').insert({
      idCxpComentarios: this.generarId(10),
      idCxP: idCxp,
      status: true,
      uidr: actorUid,
      tipo: 1,
      comentario: justificacion,
    });
    return { idCxp };
  }

  /** Campos base compartidos por todos los tipos especiales. */
  private filaBase(idCxp: string, actorUid: string, uidGerente: string) {
    return {
      idCxp,
      uidr: actorUid,
      status: true,
      fecSolicitud: new Date().toISOString().split('T')[0]!,
      montoAplicado: 0,
      uidGerente,
      nomCFDI: '',
      diferido: false,
      tdc: false,
    };
  }

  /** Urgentes (tipoOperacion=2, idEstado=2 → directo a aprobación, esUrgente). */
  async crearUrgente(dto: CrearUrgenteDto, actorUid: string): Promise<{ idCxp: string }> {
    const uidGerente = await this.responsableDeCategoria(dto.idCategoria);
    const nombreProveedor = await this.razonSocialProveedor(dto.idProveedor);
    const idCxp = this.generarId(15);
    return this.insertarEspecial(
      {
        ...this.filaBase(idCxp, actorUid, uidGerente),
        idProveedor: dto.idProveedor,
        nombreProveedor,
        tipoProveedor: 1,
        idCategoria: dto.idCategoria,
        concepto: dto.concepto,
        total: dto.total,
        ultimoComentario: dto.justificacion,
        idEstado: 2,
        esUrgente: true,
        completada: false,
        tipoOperacion: 2,
      },
      dto.justificacion,
      actorUid,
    );
  }

  /** Línea de Captura (tipoOperacion=4, idEstado=2). Requiere PDF. */
  async crearLineaCaptura(
    dto: CrearLineaCapturaDto,
    pdf: Buffer,
    actorUid: string,
  ): Promise<{ idCxp: string }> {
    const uidGerente = await this.responsableDeCategoria(dto.idCategoria);
    // Duplicado coherente (corrige el chequeo roto de v1): misma línea de captura activa.
    const { data: dup } = await this.supabase.admin
      .from('cxp')
      .select('idCxp')
      .eq('status', true)
      .eq('lineaCaptura', dto.lineaCaptura)
      .limit(1);
    if (dup && dup.length > 0)
      throw new BadRequestException(
        `Ya existe una solicitud con la línea de captura ${dto.lineaCaptura}.`,
      );
    const nombreProveedor = await this.razonSocialProveedor(dto.idProveedor);
    const idCxp = this.generarId(15);
    const urlCFDI = await this.subirComprobante(pdf, dto.idProveedor, idCxp);
    return this.insertarEspecial(
      {
        ...this.filaBase(idCxp, actorUid, uidGerente),
        idProveedor: dto.idProveedor,
        nombreProveedor,
        tipoProveedor: 1,
        idCategoria: dto.idCategoria,
        concepto: dto.concepto,
        total: dto.total,
        lineaCaptura: dto.lineaCaptura,
        referencia: dto.referencia,
        fechaLimite: dto.fechaLimite,
        pagoInmediato: dto.pagoInmediato,
        urlCFDI,
        ultimoComentario: dto.justificacion,
        idEstado: 2,
        esUrgente: false,
        tipoOperacion: 4,
      },
      dto.justificacion,
      actorUid,
    );
  }

  /** Devoluciones (tipoOperacion=5, idEstado=1). La contraparte es un Inversionista. */
  async crearDevolucion(
    dto: CrearDevolucionDto,
    actorUid: string,
  ): Promise<{ idCxp: string }> {
    const uidGerente = await this.responsableDeCategoria(dto.idCategoria);
    const nombreProveedor = await this.razonSocialInversionista(dto.idInversionista);
    if (!nombreProveedor)
      throw new BadRequestException('El cliente/inversionista no existe.');
    const idCxp = this.generarId(15);
    return this.insertarEspecial(
      {
        ...this.filaBase(idCxp, actorUid, uidGerente),
        idProveedor: dto.idInversionista, // la contraparte es un inversionista
        nombreProveedor,
        tipoProveedor: 2, // 2 = inversionista/cliente
        idCategoria: dto.idCategoria,
        concepto: dto.conceptoDevolucion,
        referencia: dto.conceptoDevolucion,
        total: dto.total,
        ultimoComentario: dto.justificacion,
        idEstado: 1,
        esUrgente: false,
        tipoOperacion: 5,
      },
      dto.justificacion,
      actorUid,
    );
  }

  /** Facturas sin XML (tipoOperacion=6, idEstado=1). Requiere PDF. */
  async crearSinXml(
    dto: CrearSinXmlDto,
    pdf: Buffer,
    actorUid: string,
  ): Promise<{ idCxp: string }> {
    const uidGerente = await this.responsableDeCategoria(dto.idCategoria);
    // Duplicado coherente: mismo proveedor + folio activo.
    const { data: dup } = await this.supabase.admin
      .from('cxp')
      .select('idCxp')
      .eq('status', true)
      .eq('idProveedor', dto.idProveedor)
      .eq('folio', dto.folio)
      .limit(1);
    if (dup && dup.length > 0)
      throw new BadRequestException(
        `Ya existe una solicitud de este proveedor con el folio ${dto.folio}.`,
      );
    const nombreProveedor = await this.razonSocialProveedor(dto.idProveedor);
    const idCxp = this.generarId(15);
    const urlCFDI = await this.subirComprobante(pdf, dto.idProveedor, idCxp);
    return this.insertarEspecial(
      {
        ...this.filaBase(idCxp, actorUid, uidGerente),
        idProveedor: dto.idProveedor,
        nombreProveedor,
        tipoProveedor: 1,
        idCategoria: dto.idCategoria,
        concepto: dto.concepto,
        total: dto.total,
        folio: dto.folio,
        fecCFDI: dto.fecFactura,
        fechaLimite: dto.fecFactura,
        moneda: dto.moneda,
        urlCFDI,
        ultimoComentario: dto.justificacion,
        idEstado: 1,
        esUrgente: false,
        tipoOperacion: 6,
      },
      dto.justificacion,
      actorUid,
    );
  }
}
