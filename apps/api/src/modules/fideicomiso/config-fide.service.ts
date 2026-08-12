import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { fallaBd } from '../../common/utils/db-error.js';
import type {
  CondicionesDto,
  CrearPdpDto,
  NaveTicketDto,
} from './fideicomiso.schemas.js';

const ID_ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
type Db = ReturnType<SupabaseService['comoActor']>;

/**
 * Fideicomiso → Configuración del propietario (engrane ⚙️ de Aportaciones, clave
 * 510). Réplica COMPLETA de `config_propietario_fide` de v1: selección de
 * propiedad del inversionista, condiciones del fideicomiso (`fideCondiciones`),
 * alta de naves/propiedades-ticket, y el Plan de Pagos (PDP) — generación
 * (Único/Enganche/Parcialidad), edición de partidas, recálculo por enganche,
 * activar/desactivar y eliminar. Todo server-side y auditado (`comoActor`).
 * Los datos del inversionista y los documentos se reutilizan de `PlanesService`.
 */
@Injectable()
export class ConfigFideService {
  private readonly logger = new Logger(ConfigFideService.name);

  constructor(private readonly supabase: SupabaseService) {}

  private generarId(n = 15): string {
    const bytes = randomBytes(n);
    let id = '';
    for (let i = 0; i < n; i++) id += ID_ALFABETO[bytes[i]! % ID_ALFABETO.length];
    return id;
  }

  /** Suma 1 mes a una fecha ISO 'yyyy-MM-dd' (conserva el día, lo acota a fin de mes). */
  private siguienteMes(iso: string): string {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number) as [number, number, number];
    const base = new Date(Date.UTC(y, m - 1, 1));
    base.setUTCMonth(base.getUTCMonth() + 1);
    const ultimoDia = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
    const dia = Math.min(d, ultimoDia);
    const mm = String(base.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dia).padStart(2, '0');
    return `${base.getUTCFullYear()}-${mm}-${dd}`;
  }

  /** Id del fideicomiso activo (hay uno solo: "Innovación SPH"). */
  private async idFideActivo(): Promise<string> {
    const { data } = await this.supabase.admin
      .from('fideicomiso')
      .select('idFide, Status')
      .order('Status', { ascending: false })
      .limit(1);
    return data?.[0]?.idFide ?? 'jsRw4C6FswY20O';
  }

  // ----------------------------- Selección -----------------------------

  /** Propiedades del inversionista (para el selector cboPropiedades). */
  async propiedadesDeInversionista(idInversionista: string) {
    const { data, error } = await this.supabase.admin
      .from('v_propiedades')
      .select('idPropiedad, nomDescriptivo, idNave, idInversionista, tienenPdp, pdpActivo, idPdp')
      .eq('idInversionista', idInversionista)
      .order('nomDescriptivo', { ascending: true, nullsFirst: false });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  /** Propiedades-ticket del inversionista (header DatTickets) con el usuario creador. */
  async propiedadesFide(idInversionista: string) {
    const { data, error } = await this.supabase.admin
      .from('v_propiedadesfide')
      .select(
        'idPropiedad, idInversionista, nominversionista, idNave, nomDescriptivo, fc, idUser, tienenPdp, pdpActivo, totalpdp, totalpagos, avance_porcentaje',
      )
      .eq('idInversionista', idInversionista)
      .order('nomDescriptivo', { ascending: true, nullsFirst: false });
    if (error) throw new InternalServerErrorException(error.message);
    const filas = data ?? [];

    // Resolver el nombre del usuario creador (idUser → catUsers.nomCompleto).
    const uids = [...new Set(filas.map((f) => f.idUser).filter((x): x is string => !!x))];
    const nombres = new Map<string, string | null>();
    if (uids.length > 0) {
      const { data: users } = await this.supabase.admin
        .from('catUsers')
        .select('uid, nomCompleto')
        .in('uid', uids);
      for (const u of users ?? []) nombres.set(u.uid, u.nomCompleto);
    }
    return filas.map((f) => ({
      ...f,
      creadoPor: f.idUser ? (nombres.get(f.idUser) ?? null) : null,
    }));
  }

  // --------------------------- Condiciones ---------------------------

  /** Condiciones del fideicomiso de una propiedad (`fideCondiciones`) o null. */
  async condiciones(idPropiedad: string) {
    const { data, error } = await this.supabase.admin
      .from('fideCondiciones')
      .select('idfideCond, idFide, idPropiedad, noAdhesion, PM, Medio, Apartado, rendimiento, comentarios, "Prom9%", promoAnios')
      .eq('idPropiedad', idPropiedad)
      .limit(1);
    if (error) fallaBd(this.logger, 'fideicomiso.config.condiciones', error);
    return data?.[0] ?? null;
  }

  /** Alta o edición de las condiciones (INSERT si no hay idfideCond, UPDATE si sí). */
  async guardarCondiciones(dto: CondicionesDto, actorUid: string): Promise<{ ok: true }> {
    const db = this.supabase.comoActor(actorUid);
    const noAdhesion = dto.noAdhesion.toUpperCase();
    const idFide = await this.idFideActivo();

    // ⛔ Una adhesión pertenece a UN solo inversionista: no permitir reutilizar un
    // número ya asignado a la propiedad de OTRO inversionista. Las RPCs de
    // Dispersión agrupan por `noAdhesion` (1 adhesión = 1 inversionista); compartir
    // número mezcla las aportaciones de dos personas en el mismo desglose.
    await this.validarAdhesionUnica(noAdhesion, dto.idPropiedad, idFide, dto.idfideCond);

    if (dto.idfideCond) {
      // ⛔ La promoción del 9% es INMUTABLE una vez asignada: no se quita ni se
      // cambia su duración desde el sistema (los ajustes especiales se hacen por
      // update manual autorizado en BD). El candado REAL vive en el trigger
      // `trg_fidecondiciones_promo_inmutable`; esto solo adelanta un mensaje
      // legible en vez de dejar salir el error del motor.
      const { data: actual, error: eActual } = await this.supabase.admin
        .from('fideCondiciones')
        .select('"Prom9%"')
        .eq('idfideCond', dto.idfideCond)
        .maybeSingle();
      if (eActual) fallaBd(this.logger, 'fideicomiso.config.condicionActual', eActual);
      const promoAsignada = actual?.['Prom9%'] === true;
      if (promoAsignada && dto.prom9 === false) {
        throw new BadRequestException(
          'La promoción ya está asignada a esta adhesión y no puede modificarse desde el sistema.',
        );
      }

      // `promoAnios` NUNCA se escribe desde la API (solo ajuste autorizado en BD),
      // y `Prom9%` solo viaja si el cliente lo mandó (undefined = no cambiar).
      const { error } = await db
        .from('fideCondiciones')
        .update({
          noAdhesion,
          Medio: dto.medio,
          Apartado: dto.apartado,
          PM: dto.pm,
          comentarios: dto.comentarios ?? '',
          rendimiento: dto.rendimiento,
          ...(dto.prom9 !== undefined && !promoAsignada ? { 'Prom9%': dto.prom9 } : {}),
        })
        .eq('idfideCond', dto.idfideCond)
        .eq('idPropiedad', dto.idPropiedad);
      if (error) fallaBd(this.logger, 'fideicomiso.config.guardarCondiciones.update', error);
    } else {
      const { error } = await db.from('fideCondiciones').insert({
        idfideCond: this.generarId(15),
        idPropiedad: dto.idPropiedad,
        noAdhesion,
        Medio: dto.medio,
        Apartado: dto.apartado,
        rendimiento: dto.rendimiento,
        PM: dto.pm,
        comentarios: dto.comentarios ?? '',
        uid: actorUid,
        idFide,
        // El alta nace SIEMPRE en 1 año: `promoAnios` toma el DEFAULT de la columna.
        'Prom9%': dto.prom9 ?? false,
      });
      if (error) fallaBd(this.logger, 'fideicomiso.config.guardarCondiciones.insert', error);
    }
    return { ok: true };
  }

  /**
   * Verifica que el número de adhesión NO esté asignado a una propiedad de otro
   * inversionista dentro del mismo fideicomiso. Es legítimo que un mismo
   * inversionista tenga varias propiedades/tickets bajo el mismo número (p. ej.
   * adhesión "B" con 9 tickets de un solo inversionista); lo que se bloquea es
   * que DOS inversionistas distintos compartan número (rompe el desglose de
   * Dispersiones, que agrupa por `noAdhesion`).
   */
  private async validarAdhesionUnica(
    noAdhesion: string,
    idPropiedad: string,
    idFide: string,
    idfideCondActual?: string,
  ): Promise<void> {
    // Inversionista de la propiedad que se está configurando.
    const { data: propActual, error: pErr } = await this.supabase.admin
      .from('propiedades')
      .select('idInversionista')
      .eq('idPropiedad', idPropiedad)
      .maybeSingle();
    if (pErr) fallaBd(this.logger, 'fideicomiso.config.validarAdhesion.propiedad', pErr);
    const idInvActual = propActual?.idInversionista ?? null;
    if (!idInvActual) return; // sin inversionista no hay con quién comparar

    // Otras condiciones con el mismo número de adhesión en el fideicomiso.
    const { data: existentes, error: cErr } = await this.supabase.admin
      .from('fideCondiciones')
      .select('idfideCond, idPropiedad')
      .eq('idFide', idFide)
      .eq('noAdhesion', noAdhesion);
    if (cErr) fallaBd(this.logger, 'fideicomiso.config.validarAdhesion.condiciones', cErr);

    const otras = (existentes ?? []).filter(
      (e) => e.idfideCond !== idfideCondActual && e.idPropiedad !== idPropiedad,
    );
    if (otras.length === 0) return;

    // Inversionistas dueños de esas otras propiedades.
    const idsProp = [...new Set(otras.map((e) => e.idPropiedad).filter((x): x is string => !!x))];
    const { data: props } = await this.supabase.admin
      .from('propiedades')
      .select('idPropiedad, idInversionista')
      .in('idPropiedad', idsProp);
    const conflicto = (props ?? []).find(
      (p) => p.idInversionista && p.idInversionista !== idInvActual,
    );
    if (!conflicto) return; // las otras propiedades son del MISMO inversionista → permitido

    // Nombre del inversionista en conflicto, para un mensaje claro.
    const { data: inv } = await this.supabase.admin
      .from('inversionista')
      .select('razonsocial, nombre, apellido1')
      .eq('idInversionista', conflicto.idInversionista!)
      .maybeSingle();
    const nombre =
      (inv?.razonsocial?.trim()
        ? inv.razonsocial
        : [inv?.nombre, inv?.apellido1].filter(Boolean).join(' ')) || 'otro inversionista';

    throw new BadRequestException(
      `El número de adhesión "${noAdhesion}" ya está asignado a ${nombre}. ` +
        'Cada adhesión pertenece a un solo inversionista.',
    );
  }

  // --------------------------- Naves / Propiedades ---------------------------

  /** Parques de tipo ticket (para el combo de la pestaña Propiedades). */
  async parquesTicket() {
    const { data, error } = await this.supabase.admin
      .from('parques')
      .select('idParque, nomParque')
      .eq('status', true)
      .eq('esTicket', true)
      .order('nomParque', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  /** Crea una nave-ticket y su propiedad (vincula al inversionista). */
  async crearNaveProp(dto: NaveTicketDto, actorUid: string): Promise<{ idPropiedad: string }> {
    const db = this.supabase.comoActor(actorUid);

    const { data: parque } = await this.supabase.admin
      .from('parques')
      .select('nomParque')
      .eq('idParque', dto.idParque)
      .maybeSingle();

    const idNave = this.generarId(12);
    const numNaveNAME = `${dto.nave}${dto.id}`;
    const { error: navErr } = await db.from('naves').insert({
      idUser: actorUid,
      idNave,
      idParque: dto.idParque,
      situacion: 'Vendida',
      numNave: 1,
      numNaveNAME,
      esTicket: true,
      terreno: 0,
      construccion: 0,
      precio: 0,
    });
    if (navErr) throw new InternalServerErrorException(navErr.message);

    const idPropiedad = this.generarId(12);
    const { error: propErr } = await db.from('propiedades').insert({
      idUser: actorUid,
      idPropiedad,
      idInversionista: dto.idInversionista,
      idNave,
      tienenPdp: false,
      pdpActivo: false,
      nomDescriptivo: `${parque?.nomParque ?? ''} - ${numNaveNAME}`,
      idParque: dto.idParque,
      PActual: true,
      esTicket: true,
    });
    if (propErr) throw new InternalServerErrorException(propErr.message);

    return { idPropiedad };
  }

  /** Elimina una propiedad/ticket (RPC transaccional existente). */
  async eliminarPropiedad(idPropiedad: string, actorUid: string): Promise<{ ok: true }> {
    const { error } = await this.supabase
      .comoActor(actorUid)
      .rpc('propiedades_eliminar_propiedad', { p_id_propiedad: idPropiedad });
    // Esta es la ruta por la que saldría el mensaje del trigger de inmutabilidad
    // (la FK a "fideCondiciones" es ON DELETE CASCADE): nunca al cliente en crudo.
    if (error) fallaBd(this.logger, 'fideicomiso.config.eliminarPropiedad', error);
    return { ok: true };
  }

  // ------------------------------- PDP -------------------------------

  /** Datos del PDP de una propiedad: cabecera, detalle y totales. */
  async pdp(idPropiedad: string) {
    const { data: prop, error: pErr } = await this.supabase.admin
      .from('propiedades')
      .select('idPropiedad, idPdp, idNave, idInversionista, tienenPdp, pdpActivo')
      .eq('idPropiedad', idPropiedad)
      .maybeSingle();
    if (pErr) throw new InternalServerErrorException(pErr.message);
    if (!prop) throw new NotFoundException('Propiedad no encontrada.');

    if (!prop.tienenPdp || !prop.idPdp) {
      return { propiedad: prop, pdp: null, detalle: [], totales: null };
    }

    const [pdpRes, detRes, totRes] = await Promise.all([
      this.supabase.admin.from('pdp').select('idPdp, monto, cantpagos, pdpactivo, Editable').eq('idPdp', prop.idPdp).maybeSingle(),
      this.supabase.admin
        .from('pdpDetalle')
        .select('idPdpDet, idPdp, numPago, fecha, monto, tipoPago')
        .eq('idPropiedad', idPropiedad)
        .order('numPago', { ascending: true }),
      this.supabase.admin
        .from('v_totales')
        .select('idPdp, monto, monto_completo, montos_son_iguales, diferencia_monto')
        .eq('idPdp', prop.idPdp)
        .maybeSingle(),
    ]);
    if (pdpRes.error) throw new InternalServerErrorException(pdpRes.error.message);
    if (detRes.error) throw new InternalServerErrorException(detRes.error.message);
    if (totRes.error) throw new InternalServerErrorException(totRes.error.message);

    return {
      propiedad: prop,
      pdp: pdpRes.data,
      detalle: detRes.data ?? [],
      totales: totRes.data ?? null,
    };
  }

  /**
   * Genera el Plan de Pagos de un ticket: 1 pago 'Único' si cantPagos==1; si no,
   * el primero 'Enganche' y el resto 'Parcialidad' (monto=valTicket/cantPagos,
   * fechas +1 mes). Marca la propiedad con `tienenPdp=true` e `idPdp`.
   */
  async crearPdp(dto: CrearPdpDto, actorUid: string): Promise<{ idPdp: string }> {
    const { data: prop, error: pErr } = await this.supabase.admin
      .from('propiedades')
      .select('idPropiedad, idNave, idInversionista, tienenPdp')
      .eq('idPropiedad', dto.idPropiedad)
      .maybeSingle();
    if (pErr) throw new InternalServerErrorException(pErr.message);
    if (!prop) throw new NotFoundException('Propiedad no encontrada.');
    if (prop.tienenPdp) throw new BadRequestException('La propiedad ya tiene un plan de pagos.');

    const db = this.supabase.comoActor(actorUid);
    const idPdp = `tkt-${this.generarId(9)}`;

    const { error: pdpErr } = await db.from('pdp').insert({
      uid: actorUid,
      idPdp,
      idPropiedad: dto.idPropiedad,
      pdpactivo: false,
      montoterreno: 0,
      montoobra: 0,
      monto: dto.valTicket,
      cantpagos: dto.cantPagos,
      Editable: false,
    });
    if (pdpErr) throw new InternalServerErrorException(pdpErr.message);

    const detalles: Array<Record<string, unknown>> = [];
    if (dto.cantPagos === 1) {
      detalles.push({
        uid: actorUid,
        idPdpDet: this.generarId(15),
        idPdp,
        numPago: 1,
        fecha: dto.fecha,
        monto: dto.valTicket,
        idPropiedad: dto.idPropiedad,
        idNave: prop.idNave,
        idInversionista: prop.idInversionista,
        tipoPago: 'Unico',
      });
    } else {
      const montoParcial = Math.round((dto.valTicket / dto.cantPagos) * 100) / 100;
      let fecha = dto.fecha;
      for (let i = 0; i < dto.cantPagos; i++) {
        if (i > 0) fecha = this.siguienteMes(fecha);
        detalles.push({
          uid: actorUid,
          idPdpDet: this.generarId(15),
          idPdp,
          numPago: i + 1,
          fecha,
          monto: montoParcial,
          idPropiedad: dto.idPropiedad,
          idNave: prop.idNave,
          idInversionista: prop.idInversionista,
          tipoPago: i === 0 ? 'Enganche' : 'Parcialidad',
        });
      }
    }

    const { error: detErr } = await db.from('pdpDetalle').insert(detalles as never);
    if (detErr) throw new InternalServerErrorException(detErr.message);

    const { error: upErr } = await db
      .from('propiedades')
      .update({ tienenPdp: true, idPdp })
      .eq('idPropiedad', dto.idPropiedad);
    if (upErr) throw new InternalServerErrorException(upErr.message);

    return { idPdp };
  }

  /** Edita el monto de una partida (`pdpDetalle.monto`), auditado en `actividad`. */
  async editarMonto(idPdpDet: string, monto: number, actorUid: string): Promise<{ ok: true }> {
    const anterior = await this.cargarPartida(idPdpDet);
    const db = this.supabase.comoActor(actorUid);
    const { error } = await db.from('pdpDetalle').update({ monto }).eq('idPdpDet', idPdpDet);
    if (error) throw new InternalServerErrorException(error.message);
    await this.actividad(db, {
      pantalla: 'editMonto',
      nomwidget: 'Modificar Monto',
      comentario: `Se actualiza monto de ${anterior.monto ?? 0} a ${monto} | idPdpDet${idPdpDet}`,
      actorUid,
    });
    return { ok: true };
  }

  /** Edita el tipo de pago de una partida (`pdpDetalle.tipoPago`), auditado. */
  async editarTipo(idPdpDet: string, tipoPago: string, actorUid: string): Promise<{ ok: true }> {
    const anterior = await this.cargarPartida(idPdpDet);
    const db = this.supabase.comoActor(actorUid);
    const { error } = await db.from('pdpDetalle').update({ tipoPago }).eq('idPdpDet', idPdpDet);
    if (error) throw new InternalServerErrorException(error.message);
    await this.actividad(db, {
      pantalla: 'editTipoPago',
      nomwidget: 'ok',
      comentario: `Se actualiza tipo de Pago de ${anterior.tipoPago ?? '-'} a ${tipoPago} | idPdpDetalle ${idPdpDet}`,
      actorUid,
    });
    return { ok: true };
  }

  /** Recalcula las parcialidades cuando se edita el enganche (RPC existente). */
  async recalcularEnganche(idPdp: string, actorUid: string): Promise<{ ok: true }> {
    const { error } = await this.supabase
      .comoActor(actorUid)
      .rpc('pdpdetalle_reevaluar_monto_por_enganche', { id_pdpp: idPdp });
    if (error) throw new InternalServerErrorException(error.message);
    return { ok: true };
  }

  /** Activa el PDP (`propiedades.pdpActivo=true`). Solo si los totales cuadran. */
  async activarPdp(idPropiedad: string, actorUid: string): Promise<{ ok: true }> {
    const { data: prop } = await this.supabase.admin
      .from('propiedades')
      .select('idPdp')
      .eq('idPropiedad', idPropiedad)
      .maybeSingle();
    if (prop?.idPdp) {
      const { data: tot } = await this.supabase.admin
        .from('v_totales')
        .select('montos_son_iguales')
        .eq('idPdp', prop.idPdp)
        .maybeSingle();
      if (tot && tot.montos_son_iguales === false)
        throw new BadRequestException('Los totales del plan no cuadran con el valor del ticket.');
    }
    const { error } = await this.supabase
      .comoActor(actorUid)
      .from('propiedades')
      .update({ pdpActivo: true })
      .eq('idPropiedad', idPropiedad);
    if (error) throw new InternalServerErrorException(error.message);
    return { ok: true };
  }

  /** Desactiva el PDP (`propiedades.pdpActivo=false`). */
  async desactivarPdp(idPropiedad: string, actorUid: string): Promise<{ ok: true }> {
    const { error } = await this.supabase
      .comoActor(actorUid)
      .from('propiedades')
      .update({ pdpActivo: false })
      .eq('idPropiedad', idPropiedad);
    if (error) throw new InternalServerErrorException(error.message);
    return { ok: true };
  }

  /** Elimina el PDP (DELETE `pdp`) y libera la propiedad (`tienenPdp=false`). */
  async eliminarPdp(idPropiedad: string, idPdp: string, actorUid: string): Promise<{ ok: true }> {
    const db = this.supabase.comoActor(actorUid);
    const { error: delErr } = await db
      .from('pdp')
      .delete()
      .eq('idPropiedad', idPropiedad)
      .eq('idPdp', idPdp);
    if (delErr) throw new InternalServerErrorException(delErr.message);
    const { error: upErr } = await db
      .from('propiedades')
      .update({ tienenPdp: false })
      .eq('idPropiedad', idPropiedad);
    if (upErr) throw new InternalServerErrorException(upErr.message);
    return { ok: true };
  }

  // ------------------------------ Privados ------------------------------

  private async cargarPartida(idPdpDet: string) {
    const { data, error } = await this.supabase.admin
      .from('pdpDetalle')
      .select('idPdpDet, monto, tipoPago')
      .eq('idPdpDet', idPdpDet)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException('Partida no encontrada.');
    return data;
  }

  private async actividad(
    db: Db,
    a: { pantalla: string; nomwidget: string; comentario: string; actorUid: string },
  ): Promise<void> {
    const { error } = await db.from('actividad').insert({
      uid: a.actorUid,
      entorno: 3,
      logeado: true,
      pantalla: a.pantalla,
      widget: 'Button',
      nomwidget: a.nomwidget,
      comentario: a.comentario,
      version: 'erp-v2',
    });
    if (error) this.logger.warn(`No se pudo registrar actividad: ${error.message}`);
  }
}
