import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { mapearErrorCxp } from '../../common/filters/cxp-error-mapper.js';
import { firmarDocumentos } from './documentos.util.js';

const BUCKET_CFDI = 'CFDIproveedores';

const ID_ALFABETO =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * CxP > "Aprobar Solicitudes" (clave 430). Bandeja del aprobador: ve SOLO las
 * solicitudes que le fueron asignadas (`uidGerente = él`) y puede Regresar,
 * Rechazar o Aprobar. La aprobación valida presupuesto vía la RPC
 * `cxp_autorizar_solicitud_pago` (reutilizada de v1). Reemplaza la pantalla v1
 * `solicitudes_aprobar` con consultas tipadas y el `autorizo` tomado del JWT
 * (no del cliente, corrigiendo el riesgo de suplantación de v1).
 */
@Injectable()
export class AprobacionService {
  private readonly logger = new Logger(AprobacionService.name);

  constructor(private readonly supabase: SupabaseService) {}

  private generarId(n = 10): string {
    const bytes = randomBytes(n);
    let id = '';
    for (let i = 0; i < n; i++) id += ID_ALFABETO[bytes[i]! % ID_ALFABETO.length];
    return id;
  }

  private readonly COLS =
    'idCxp, folio, nomCFDI, fecCFDI, idEstado, estado, idProveedor, nombreProveedor, concepto, ultimoComentario, subtotal, total, idCategoria, urlCFDI, urlXLM, uidr, autorizadoFP';

  /**
   * Solicitudes asignadas al aprobador, por estado (default Enviado=2). `verComo`
   * (solo soporte) permite ver la bandeja de otro usuario sin actuar por él.
   */
  async listar(actorUid: string, idEstado = 2, verComo?: string) {
    const uid = await this.supabase.uidEfectivo(actorUid, verComo);
    const { data, error } = await this.supabase.admin
      .from('cxp')
      .select(this.COLS)
      .eq('status', true)
      .eq('uidGerente', uid)
      .eq('idEstado', idEstado)
      .order('fc', { ascending: false });
    if (error) throw new InternalServerErrorException(error.message);
    const filas = data ?? [];

    const [cuentas, nombres, firmadas] = await Promise.all([
      this.resolverCuentas(filas.map((r) => r.idCategoria)),
      this.resolverUsuarios(filas.map((r) => r.uidr)),
      firmarDocumentos(
        this.supabase.admin,
        filas.flatMap((r) => [r.urlCFDI, r.urlXLM]),
        BUCKET_CFDI,
      ),
    ]);
    return filas.map((r) => ({
      ...r,
      urlCFDI: r.urlCFDI ? (firmadas.get(r.urlCFDI) ?? null) : null,
      urlXLM: r.urlXLM ? (firmadas.get(r.urlXLM) ?? null) : null,
      cuenta: cuentas.get(r.idCategoria)?.cuenta ?? null,
      seccion: cuentas.get(r.idCategoria)?.seccion ?? null,
      justificacion: r.ultimoComentario ?? null,
      solicitadoPor: r.uidr ? (nombres.get(r.uidr) ?? null) : null,
    }));
  }

  /**
   * Cantidad de solicitudes pendientes de aprobación asignadas al aprobador
   * (mismo filtro que `listar` con Enviado=2: `status`, `uidGerente`, `idEstado`).
   * Alimenta el badge del menú; usa un COUNT sin traer filas (head:true). Respeta
   * "Ver como" para coincidir con la bandeja cuando soporte suplanta a un usuario.
   */
  async contarPendientes(actorUid: string, verComo?: string): Promise<number> {
    const uid = await this.supabase.uidEfectivo(actorUid, verComo);
    const { count, error } = await this.supabase.admin
      .from('cxp')
      .select('idCxp', { count: 'exact', head: true })
      .eq('status', true)
      .eq('uidGerente', uid)
      .eq('idEstado', 2);
    if (error) throw new InternalServerErrorException(error.message);
    return count ?? 0;
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
        u.nombre && u.apellidos
          ? `${u.nombre} ${u.apellidos}`
          : (u.nomCompleto ?? u.nombre ?? u.uid),
      );
    return mapa;
  }

  /** Lee la solicitud y valida que sea del aprobador (`uidEsperado`) y esté procesable. */
  private async solicitudDelAprobador(idCxp: string, uidEsperado: string) {
    const { data, error } = await this.supabase.admin
      .from('cxp')
      .select('idCxp, uidGerente, idEstado, idCategoria, subtotal')
      .eq('idCxp', idCxp)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException('Solicitud no encontrada.');
    if (data.uidGerente !== uidEsperado)
      throw new ForbiddenException('La solicitud no está asignada a este aprobador.');
    if ((data.idEstado ?? 0) >= 3)
      throw new BadRequestException(
        'La solicitud ya fue procesada (rechazada/aprobada).',
      );
    return data;
  }

  /** uid configurado como aprobador "fuera de presupuesto" (SPHConfiguraciones). */
  private async uidAprobadorFP(): Promise<string | null> {
    const { data } = await this.supabase.admin
      .from('SPHConfiguraciones')
      .select('valor')
      .eq('parametro', 'Aprobar fuera de presupuesto')
      .eq('status', true)
      .maybeSingle();
    return data?.valor ?? null;
  }

  /** Resumen de presupuesto de una categoría (vista v_resumenPresupuesto). */
  private async resumenPresupuesto(idCategoria: string) {
    const { data } = await this.supabase.admin
      .from('v_resumenPresupuesto')
      .select(
        'presupuestable, status, presupuesto_acumulado, subtotal_gastado, subtotal_comprometido, total_gastado_comprometido, dentro_presupuesto, avance_total',
      )
      .eq('idCategoria', idCategoria)
      .maybeSingle();
    return data;
  }

  /** Datos de presupuesto para el modal de aprobación (respeta "Ver como"). */
  async presupuesto(idCxp: string, actorUid: string, verComo?: string) {
    const uid = await this.supabase.uidEfectivo(actorUid, verComo);
    const sol = await this.solicitudDelAprobador(idCxp, uid);
    const pres = await this.resumenPresupuesto(sol.idCategoria);
    const uidFP = await this.uidAprobadorFP();

    const subtotal = sol.subtotal ?? 0;
    const totalGastadoComprometido = pres?.total_gastado_comprometido ?? 0;
    const presupuestoAcumulado = pres?.presupuesto_acumulado ?? 0;
    const presupuestable = pres?.presupuestable ?? false;
    const gasto = totalGastadoComprometido + subtotal;
    const fuera = presupuestable && gasto > presupuestoAcumulado;
    const esAprobadorFP = !!uidFP && uidFP === uid;

    return {
      idCategoria: sol.idCategoria,
      subtotal,
      presupuestable,
      presupuestoAcumulado,
      subtotalGastado: pres?.subtotal_gastado ?? 0,
      subtotalComprometido: pres?.subtotal_comprometido ?? 0,
      totalGastadoComprometido,
      avanceTotal: pres?.avance_total ?? 0,
      dentroPresupuesto: pres?.dentro_presupuesto ?? true,
      gasto,
      fuera,
      esAprobadorFP,
      puedeReasignar: fuera && !esAprobadorFP,
      hayAprobadorFP: !!uidFP,
    };
  }

  private async comentar(idCxp: string, comentario: string, actorUid: string) {
    if (!comentario) return;
    await this.supabase.comoActor(actorUid).from('cxpComentarios').insert({
      idCxpComentarios: this.generarId(10),
      idCxP: idCxp,
      status: true,
      uidr: actorUid,
      tipo: 1,
      comentario,
    });
  }

  /** Regresar al solicitante (idEstado→1) con motivo. */
  async regresar(idCxp: string, comentario: string, actorUid: string): Promise<void> {
    await this.solicitudDelAprobador(idCxp, actorUid);
    const db = this.supabase.comoActor(actorUid);
    const { error } = await db
      .from('cxp')
      .update({ idEstado: 1, ultimoComentario: comentario })
      .eq('idCxp', idCxp);
    if (error) {
      mapearErrorCxp(error); // traduce errores de trigger CxP a 403/400 claros
      throw new InternalServerErrorException('No se pudo regresar la solicitud.');
    }
    await this.comentar(idCxp, comentario, actorUid);
  }

  /** Rechazar (idEstado→3) con motivo (la factura debe refacturarse). */
  async rechazar(idCxp: string, comentario: string, actorUid: string): Promise<void> {
    await this.solicitudDelAprobador(idCxp, actorUid);
    const db = this.supabase.comoActor(actorUid);
    // `autorizo` = el aprobador real (del JWT). Imprescindible: el trigger de BD
    // `cxp_trigger_validar_fecha` valida el permiso 430 contra COALESCE(autorizo, uidr);
    // sin enviarlo, validaría al SOLICITANTE y lanzaría CXP_ESTADO_NO_AUTORIZADO (→500).
    // Además deja registrado QUIÉN rechazó.
    const { error } = await db
      .from('cxp')
      .update({ idEstado: 3, ultimoComentario: comentario, autorizo: actorUid })
      .eq('idCxp', idCxp);
    if (error) {
      mapearErrorCxp(error); // traduce errores de trigger CxP a 403/400 claros
      throw new InternalServerErrorException('No se pudo rechazar la solicitud.');
    }
    await this.comentar(idCxp, comentario, actorUid);
  }

  /**
   * Aprobar (idEstado→4) validando presupuesto vía RPC. El `autorizo` se toma del
   * JWT (actorUid). Marca `autorizadoFP=true` si se aprobó fuera de presupuesto.
   * Devuelve { autorizado, mensaje } de la RPC (el front muestra el mensaje).
   */
  async aprobar(
    idCxp: string,
    comentario: string,
    actorUid: string,
  ): Promise<{ autorizado: boolean; mensaje: string }> {
    const sol = await this.solicitudDelAprobador(idCxp, actorUid);

    // Estado presupuestal ANTES de aprobar (para marcar autorizadoFP).
    const pres = await this.resumenPresupuesto(sol.idCategoria);
    const presupuestable = pres?.presupuestable ?? false;
    const fuera =
      presupuestable &&
      (pres?.total_gastado_comprometido ?? 0) + (sol.subtotal ?? 0) >
        (pres?.presupuesto_acumulado ?? 0);

    // ¿El periodo permite autorizar hoy?
    const { data: puede, error: puedeErr } = await this.supabase.admin.rpc(
      'cxp_puede_autorizar',
    );
    if (puedeErr) throw new InternalServerErrorException(puedeErr.message);
    if (puede === false) {
      throw new BadRequestException(
        'Las autorizaciones no están habilitadas hoy (revisa Fechas CxP).',
      );
    }

    // RPC de autorización (valida presupuesto; omite si el actor es el aprobador FP).
    const db = this.supabase.comoActor(actorUid);
    const { data, error } = await db.rpc('cxp_autorizar_solicitud_pago', {
      p_idcxp: idCxp,
      p_ultimocomentario: comentario,
      p_autorizo: actorUid,
    });
    if (error) {
      this.logger.error(`Error en RPC autorizar ${idCxp}: ${error.message}`);
      throw new InternalServerErrorException('No se pudo procesar la autorización.');
    }
    const fila = Array.isArray(data) ? data[0] : data;
    const autorizado = fila?.autorizado === true;
    const mensaje = fila?.mensaje ?? '';

    if (autorizado) {
      await this.comentar(idCxp, comentario, actorUid);
      // Registrar si se autorizó fuera de presupuesto.
      const { error: fpErr } = await db
        .from('cxp')
        .update({ autorizadoFP: fuera })
        .eq('idCxp', idCxp);
      if (fpErr) this.logger.warn(`No se pudo marcar autorizadoFP: ${fpErr.message}`);
    }

    return { autorizado, mensaje };
  }

  /** Reasigna la solicitud al aprobador autorizado a aprobar fuera de presupuesto. */
  async reasignarFueraPresupuesto(idCxp: string, actorUid: string): Promise<void> {
    await this.solicitudDelAprobador(idCxp, actorUid);
    const uidFP = await this.uidAprobadorFP();
    if (!uidFP)
      throw new BadRequestException(
        'No hay un aprobador de "fuera de presupuesto" configurado.',
      );
    if (uidFP === actorUid)
      throw new BadRequestException(
        'Ya eres el aprobador de fuera de presupuesto; aprueba directamente.',
      );
    const db = this.supabase.comoActor(actorUid);
    const { error } = await db
      .from('cxp')
      .update({ uidGerente: uidFP })
      .eq('idCxp', idCxp);
    if (error)
      throw new InternalServerErrorException('No se pudo reasignar la solicitud.');
    await this.comentar(idCxp, 'Se solicitó aprobación fuera de presupuesto.', actorUid);
  }
}
