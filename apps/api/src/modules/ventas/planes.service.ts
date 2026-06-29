import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import type {
  CrearPlanPagosDto,
  DocDto,
  InversionistaDto,
  PropiedadDto,
} from './ventas.schemas.js';

const ID_ALFABETO =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** Bucket de documentos del inversionista (existente). */
const BUCKET_DOCS = 'Documentos';

/**
 * Tolerancia (en pesos) al activar un PDP: la suma de las parcialidades puede
 * diferir del total del plan hasta este margen (absorbe redondeos de centavos),
 * como en v1. Más allá, no se permite activar.
 */
const TOLERANCIA_PDP = 0.05;

/**
 * Ventas > Planes (clave 610). Selector inversionista/propiedad, lectura de los
 * 3 planes (Plan de Pagos, Renta Garantizada/Administrada) y Configuración (⚙)
 * de Datos Generales, Documentos, Propiedades y creación del Plan de Pagos.
 * Reemplaza `PropietariosWidget`/`ConfigPropietarioWidget` de v1.
 */
@Injectable()
export class PlanesService {
  constructor(private readonly supabase: SupabaseService) {}

  private generarId(n: number): string {
    const bytes = randomBytes(n);
    let id = '';
    for (let i = 0; i < n; i++) id += ID_ALFABETO[bytes[i]! % ID_ALFABETO.length];
    return id;
  }

  /** Suma 1 mes conservando el día (salto de año en diciembre). Como v1 `siguienteMes`. */
  private siguienteMes(fecha: Date): Date {
    let anio = fecha.getUTCFullYear();
    let mes = fecha.getUTCMonth(); // 0-11
    if (mes === 11) {
      anio++;
      mes = 0;
    } else {
      mes++;
    }
    return new Date(Date.UTC(anio, mes, fecha.getUTCDate()));
  }

  private aISO(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  // ----------------------------- Selectores / lectura -----------------------------

  /**
   * Inversionistas para el selector de Planes: los marcados como `inversionista`
   * (no de prueba) que tengan al menos una propiedad con `propiedades.pdpActivo=true`
   * (la bandera vigente es la de `propiedades`, no la de `pdp`). Ordenados por
   * razón social. Se **excluye el parque de Tickets** (`propiedades.esTicket=false`):
   * un inversionista que solo tenga propiedades de tickets no aparece en Ventas.
   */
  async inversionistas() {
    // Lista TODOS los inversionistas reales (con o sin propiedad/plan activo) para
    // permitir el ALTA del primer plan desde el selector de Planes. Antes exigía un
    // JOIN !inner a propiedades con pdpActivo=true, lo que dejaba fuera a los
    // inversionistas nuevos (sin nave vinculada o sin plan aún) y hacía imposible
    // crearles el primer plan desde aquí. El filtro por pdpActivo/esTicket aplica a
    // Dashboard/Reportes, NO a este selector operativo de gestión de planes.
    const { data, error } = await this.supabase.admin
      .from('inversionista')
      .select('idInversionista, nombre, apellido1, apellido2, razonsocial')
      .eq('status', true)
      .eq('inversionista', true)
      .eq('pruebas', false)
      .order('razonsocial', { ascending: true, nullsFirst: false });
    if (error) throw new InternalServerErrorException(error.message);

    return (data ?? []).map((r) => ({
      idInversionista: r.idInversionista,
      nombre: r.nombre,
      apellido1: r.apellido1,
      apellido2: r.apellido2,
      razonsocial: r.razonsocial,
    }));
  }

  async propiedadesDe(idInversionista: string) {
    const { data, error } = await this.supabase.admin
      .from('propiedades')
      .select(
        'idPropiedad, idNave, idParque, nomDescriptivo, tienenPdp, idPdp, pdpActivo, esTicket, tieneRgPdp, tieneRaPdp',
      )
      .eq('idInversionista', idInversionista)
      .eq('status', true)
      // El parque de Tickets no es venta: se excluye del módulo de Ventas.
      .eq('esTicket', false)
      .order('nomDescriptivo', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    if (!data || data.length === 0) return [];

    // Enriquecer con datos de la nave (para las tarjetas estilo v1).
    const idsNave = [...new Set(data.map((p) => p.idNave).filter((x): x is string => !!x))];
    const navesMap = new Map<
      string,
      {
        numNave: number | null;
        numNaveNAME: string | null;
        lote: number | null;
        mza: number | null;
        terreno: number | null;
        construccion: number | null;
        precio: number | null;
        fecEntrega: string | null;
        situacion: string | null;
      }
    >();
    if (idsNave.length > 0) {
      const { data: naves } = await this.supabase.admin
        .from('naves')
        .select(
          'idNave, numNave, numNaveNAME, lote, mza, terreno, construccion, precio, fecEntrega, situacion',
        )
        .in('idNave', idsNave);
      for (const n of naves ?? [])
        navesMap.set(n.idNave, {
          numNave: n.numNave,
          numNaveNAME: n.numNaveNAME,
          lote: n.lote,
          mza: n.mza,
          terreno: n.terreno,
          construccion: n.construccion,
          precio: n.precio,
          fecEntrega: n.fecEntrega,
          situacion: n.situacion,
        });
    }

    // KVAs asignados por nave (tabla kvasAsignados). Se separan por tipo de
    // tensión: tipoTension=1 → Alta, tipoTension=2 → Media (convención
    // eléctrica estándar). Se suma cantKvas de los registros activos.
    // TODO (por confirmar): no hay catálogo de tipoTension en BD; este mapeo
    // (1=Alta, 2=Media) es un supuesto acordado provisionalmente. Validar con
    // el negocio y, si aplica, contemplar un tercer valor (p. ej. 3=Baja).
    const kvasMap = new Map<string, { alta: number; media: number }>();
    if (idsNave.length > 0) {
      const { data: kvas } = await this.supabase.admin
        .from('kvasAsignados')
        .select('idNave, tipoTension, cantKvas')
        .in('idNave', idsNave)
        .eq('status', true);
      for (const k of kvas ?? []) {
        const acc = kvasMap.get(k.idNave) ?? { alta: 0, media: 0 };
        if (k.tipoTension === 1) acc.alta += k.cantKvas ?? 0;
        else if (k.tipoTension === 2) acc.media += k.cantKvas ?? 0;
        kvasMap.set(k.idNave, acc);
      }
    }

    // Enriquecer con el nombre del parque.
    const idsParque = [...new Set(data.map((p) => p.idParque).filter((x): x is string => !!x))];
    const parquesMap = new Map<string, string | null>();
    if (idsParque.length > 0) {
      const { data: parques } = await this.supabase.admin
        .from('parques')
        .select('idParque, nomParque')
        .in('idParque', idsParque);
      for (const p of parques ?? []) parquesMap.set(p.idParque, p.nomParque);
    }

    return data.map((p) => ({
      ...p,
      nave: p.idNave ? (navesMap.get(p.idNave) ?? null) : null,
      kvas: p.idNave ? (kvasMap.get(p.idNave) ?? { alta: 0, media: 0 }) : null,
      nomParque: p.idParque ? (parquesMap.get(p.idParque) ?? null) : null,
    }));
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  /**
   * Detalle del Plan de Pagos de una propiedad (parcialidades de su PDP),
   * calculado a mano (sin vista). Incluye, por parcialidad: pagos por movimiento
   * (terreno/construcción/ticket), descuentos, total pagado, balance, última
   * fecha de pago, acumulado y % de avance (acumulado/monto del plan).
   */
  async planDePagos(idPropiedad: string) {
    const [{ data: parc, error }, { data: prop }] = await Promise.all([
      this.supabase.admin
        .from('pdpDetalle')
        .select('idPdpDet, idPdp, numPago, fecha, monto, idPropiedad, tipoPago')
        .eq('idPropiedad', idPropiedad)
        .order('idPdp', { ascending: true })
        .order('numPago', { ascending: true }),
      this.supabase.admin
        .from('propiedades')
        .select('nomDescriptivo, idNave')
        .eq('idPropiedad', idPropiedad)
        .maybeSingle(),
    ]);
    if (error) throw new InternalServerErrorException(error.message);
    if (!parc || parc.length === 0) return [];

    // Pagos agregados por parcialidad (+ última fecha de pago).
    const ids = parc.map((p) => p.idPdpDet);
    const agg = new Map<
      string,
      {
        terreno: number;
        construccion: number;
        ticket: number;
        pagos: number;
        descuentos: number;
        fechaPago: string | null;
      }
    >();
    for (const grupo of this.chunk(ids, 150)) {
      const { data: pagos, error: pagErr } = await this.supabase.admin
        .from('pagos')
        .select('idPdpDet, tipomovimiento, tipoOperacion, monto, fecha')
        .in('idPdpDet', grupo);
      if (pagErr) throw new InternalServerErrorException(pagErr.message);
      for (const p of pagos ?? []) {
        if (!p.idPdpDet) continue;
        const cur =
          agg.get(p.idPdpDet) ??
          { terreno: 0, construccion: 0, ticket: 0, pagos: 0, descuentos: 0, fechaPago: null };
        const m = p.monto ?? 0;
        cur.pagos += m;
        if (p.tipomovimiento === 1) cur.terreno += m;
        else if (p.tipomovimiento === 2) cur.construccion += m;
        else if (p.tipomovimiento === 3) cur.ticket += m;
        if (p.tipoOperacion === 2) cur.descuentos += m;
        if (p.fecha && (!cur.fechaPago || p.fecha > cur.fechaPago)) cur.fechaPago = p.fecha;
        agg.set(p.idPdpDet, cur);
      }
    }

    // Monto total del plan (pdp.monto) por idPdp.
    const idPdps = [...new Set(parc.map((p) => p.idPdp).filter((x): x is string => !!x))];
    const montoTotal = new Map<string, number | null>();
    for (const grupo of this.chunk(idPdps, 150)) {
      const { data: pdps } = await this.supabase.admin
        .from('pdp')
        .select('idPdp, monto')
        .in('idPdp', grupo);
      for (const r of pdps ?? []) montoTotal.set(r.idPdp, r.monto);
    }

    // Acumulado y % avance por plan (orden ya viene por idPdp, numPago).
    const acumPorPdp = new Map<string, number>();
    return parc.map((pd) => {
      const ag =
        agg.get(pd.idPdpDet) ??
        { terreno: 0, construccion: 0, ticket: 0, pagos: 0, descuentos: 0, fechaPago: null };
      const mt = pd.idPdp ? (montoTotal.get(pd.idPdp) ?? null) : null;
      const prev = pd.idPdp ? (acumPorPdp.get(pd.idPdp) ?? 0) : 0;
      const acum = prev + ag.pagos;
      if (pd.idPdp) acumPorPdp.set(pd.idPdp, acum);
      const fecha = pd.fecha ?? null;
      return {
        idPdpDet: pd.idPdpDet,
        idPdp: pd.idPdp,
        numPago: pd.numPago,
        fecha,
        mes: fecha ? Number(fecha.slice(5, 7)) : null,
        anio: fecha ? Number(fecha.slice(0, 4)) : null,
        monto: pd.monto,
        montototal: mt,
        idPropiedad: pd.idPropiedad,
        nomParque: null,
        idNave: prop?.idNave ?? null,
        idInversionista: null,
        pagos_terreno: ag.terreno,
        pagos_construccion: ag.construccion,
        pagos_ticket: ag.ticket,
        descuentos: ag.descuentos,
        pagos: ag.pagos,
        balance: ag.pagos - (pd.monto ?? 0),
        pagos_acumulados: acum,
        porcentaje_avance:
          mt && mt !== 0 ? Math.round((acum * 100) / mt * 100) / 100 : null,
        tipoPago: pd.tipoPago,
        fecha_pagos: ag.fechaPago,
        razonsocial: null,
        pdpActivo: null,
        nomDescriptivo: prop?.nomDescriptivo ?? null,
        ultimoPago: null,
      };
    });
  }

  /** Comentarios de una parcialidad (bitácora del pago/plan). */
  async comentariosDe(idPdpDet: string) {
    const { data, error } = await this.supabase.admin
      .from('comentarios')
      .select('idComents, comentario, uid, origen, fc, idPago')
      .eq('idPdpDet', idPdpDet)
      .eq('status', true)
      .order('fc', { ascending: false });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  /** Agrega un comentario manual a una parcialidad. */
  async agregarComentario(
    idPdpDet: string,
    comentario: string,
    actorUid: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .comoActor(actorUid)
      .from('comentarios')
      .insert({ idPdpDet, comentario, uid: actorUid });
    if (error) throw new InternalServerErrorException(error.message);
  }

  async rentaGarantizada(idPropiedad: string) {
    const { data: rg } = await this.supabase.admin
      .from('rgPdp')
      .select('idRtaG')
      .eq('idPropiedad', idPropiedad)
      .eq('status', true)
      .maybeSingle();
    if (!rg) return [];
    const { data, error } = await this.supabase.admin
      .from('rgPdpDetalle')
      .select('*')
      .eq('idRtaG', rg.idRtaG)
      .order('numPago', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async rentaAdministrada(idPropiedad: string) {
    const { data: ra } = await this.supabase.admin
      .from('raPdp')
      .select('idRtaA')
      .eq('idPropiedad', idPropiedad)
      .maybeSingle();
    if (!ra) return [];
    const { data, error } = await this.supabase.admin
      .from('raPdpDetalle')
      .select('*')
      .eq('idRtaA', ra.idRtaA)
      .order('numPago', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  // ----------------------------- Config: Datos Generales -----------------------------

  async getInversionista(idInversionista: string) {
    const { data, error } = await this.supabase.admin
      .from('inversionista')
      .select('*')
      .eq('idInversionista', idInversionista)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException('Inversionista no encontrado.');
    return data;
  }

  async actualizarInversionista(
    idInversionista: string,
    dto: InversionistaDto,
    actorUid: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .comoActor(actorUid)
      .from('inversionista')
      .update({
        nombre: dto.nombre,
        apellido1: dto.apellido1,
        apellido2: dto.apellido2,
        fecNacimiento: dto.fecNacimiento || null,
        telefono: dto.telefono,
        correo: dto.correo || null,
        RFC: dto.RFC,
        CURP: dto.CURP,
        razonsocial: dto.razonsocial || null,
        personalidad: dto.personalidad || null,
        NomComercial: dto.NomComercial,
        tipoCliente: dto.tipoCliente,
      })
      .eq('idInversionista', idInversionista);
    if (error) throw new InternalServerErrorException(error.message);
  }

  // ----------------------------- Config: Documentos -----------------------------

  async listarDocs(idInversionista: string) {
    const { data, error } = await this.supabase.admin
      .from('inversionista_docs')
      .select('idDocumento, titulo, descripcion, urldoc')
      .eq('idInversionista', idInversionista)
      .eq('status', true)
      .order('fc', { ascending: false });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async subirDoc(
    dto: DocDto,
    archivo: { buffer: Buffer; ext: string; contentType: string },
    actorUid: string,
  ): Promise<{ idDocumento: string }> {
    const idDocumento = this.generarId(15);
    const path = `${dto.idInversionista}/${idDocumento}.${archivo.ext}`;
    const { error: upErr } = await this.supabase.admin.storage
      .from(BUCKET_DOCS)
      .upload(path, archivo.buffer, {
        contentType: archivo.contentType,
        upsert: true,
      });
    if (upErr) throw new InternalServerErrorException(`No se pudo subir el documento: ${upErr.message}`);
    const urldoc = this.supabase.admin.storage.from(BUCKET_DOCS).getPublicUrl(path).data.publicUrl;

    const { error } = await this.supabase.comoActor(actorUid).from('inversionista_docs').insert({
      idDocumento,
      idInversionista: dto.idInversionista,
      titulo: dto.titulo,
      descripcion: dto.descripcion,
      urldoc,
      status: true,
    });
    if (error) throw new InternalServerErrorException(error.message);
    return { idDocumento };
  }

  async eliminarDoc(idDocumento: string, actorUid: string): Promise<void> {
    const { error } = await this.supabase
      .comoActor(actorUid)
      .from('inversionista_docs')
      .update({ status: false })
      .eq('idDocumento', idDocumento);
    if (error) throw new InternalServerErrorException(error.message);
  }

  // ----------------------------- Config: Propiedades -----------------------------

  /**
   * Parques para el selector de vinculación de naves. Excluye los de tipo
   * Tickets (esTicket=true, p. ej. "A3 (Tickets)"), igual que en v1.
   */
  async parquesDisponibles() {
    const { data, error } = await this.supabase.admin
      .from('parques')
      .select('idParque, nomParque')
      .eq('status', true)
      .eq('esTicket', false)
      .order('nomParque', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  /**
   * Naves disponibles de un parque para vincular. La disponibilidad vive en
   * `naves.situacion`: solo se muestran las que están en 'Disponible' (al
   * asignarse pasan a 'Vendida' y dejan de listarse). Réplica de v1
   * (config_propietario): status=true, idParque y situacion='Disponible',
   * ordenadas por número de nave.
   */
  async navesDisponibles(idParque?: string) {
    let q = this.supabase.admin
      .from('naves')
      .select('idNave, idParque, numNaveNAME, lote, mza, terreno, construccion, precio, situacion')
      .eq('status', true)
      .eq('situacion', 'Disponible');
    if (idParque) q = q.eq('idParque', idParque);
    const { data, error } = await q.order('numNave', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async vincularNave(dto: PropiedadDto, actorUid: string): Promise<{ idPropiedad: string }> {
    // La nave debe existir y seguir 'Disponible' (una nave solo se vincula una vez).
    const { data: nave, error: naveErr } = await this.supabase.admin
      .from('naves')
      .select('idNave, idParque, numNaveNAME, situacion')
      .eq('idNave', dto.idNave)
      .maybeSingle();
    if (naveErr) throw new InternalServerErrorException(naveErr.message);
    if (!nave) throw new NotFoundException('Nave no encontrada.');
    if (nave.situacion !== 'Disponible')
      throw new BadRequestException('La nave ya no está disponible.');

    // Nombre descriptivo derivado como en v1: "{nomParque} - {numNaveNAME}".
    const idParque = dto.idParque || nave.idParque || null;
    let nomParque: string | null = null;
    if (idParque) {
      const { data: parque } = await this.supabase.admin
        .from('parques')
        .select('nomParque')
        .eq('idParque', idParque)
        .maybeSingle();
      nomParque = parque?.nomParque ?? null;
    }
    const nomDescriptivo =
      [nomParque, nave.numNaveNAME].filter(Boolean).join(' - ') || null;

    const actor = this.supabase.comoActor(actorUid);
    const idPropiedad = this.generarId(15);
    const { error } = await actor.from('propiedades').insert({
      idPropiedad,
      idUser: actorUid,
      idInversionista: dto.idInversionista,
      idNave: dto.idNave,
      idParque,
      nomDescriptivo,
      tienenPdp: false,
      pdpActivo: false,
      tieneRgPdp: false,
      tieneRaPdp: false,
      rgPdpActivo: false,
      raPdpActivo: false,
      status: true,
    });
    if (error) throw new InternalServerErrorException(error.message);

    // Marcar la nave como 'Vendida' (deja de estar disponible para vincular).
    const { error: naveUpdErr } = await actor
      .from('naves')
      .update({
        situacion: 'Vendida',
        fumUser: actorUid,
        fum: new Date().toISOString(),
      })
      .eq('idNave', dto.idNave);
    if (naveUpdErr) throw new InternalServerErrorException(naveUpdErr.message);

    return { idPropiedad };
  }

  /**
   * Desvincula una nave de un inversionista (elimina la propiedad) y regresa la
   * nave a 'Disponible'. Réplica de v1 (dat_naves): NO se permite si la
   * propiedad tiene un plan de pagos (se valida por `idPdp`, el vínculo real).
   */
  async desvincularNave(idPropiedad: string, actorUid: string): Promise<{ ok: true }> {
    const { data: prop, error: propErr } = await this.supabase.admin
      .from('propiedades')
      .select('idPropiedad, idNave, tienenPdp, idPdp')
      .eq('idPropiedad', idPropiedad)
      .maybeSingle();
    if (propErr) throw new InternalServerErrorException(propErr.message);
    if (!prop) throw new NotFoundException('Propiedad no encontrada.');
    // El vínculo real es `idPdp` (la bandera `tienenPdp` está desincronizada en datos
    // de v1). Bloquear por `idPdp` evita desvincular una nave que sí tiene plan, lo que
    // dejaría huérfanos el `pdp` y sus parcialidades (con sus pagos).
    if (prop.tienenPdp || prop.idPdp)
      throw new BadRequestException(
        'No se puede desvincular: la nave tiene un plan de pagos activo.',
      );

    const actor = this.supabase.comoActor(actorUid);
    const { error: delErr } = await actor
      .from('propiedades')
      .delete()
      .eq('idPropiedad', idPropiedad);
    if (delErr) throw new InternalServerErrorException(delErr.message);

    // Regresar la nave a 'Disponible' para que pueda volver a vincularse.
    if (prop.idNave) {
      const { error: naveErr } = await actor
        .from('naves')
        .update({
          situacion: 'Disponible',
          fumUser: actorUid,
          fum: new Date().toISOString(),
        })
        .eq('idNave', prop.idNave);
      if (naveErr) throw new InternalServerErrorException(naveErr.message);
    }

    return { ok: true };
  }

  /**
   * Cambia el tipo de pago de una parcialidad (`pdpDetalle.tipoPago`). Réplica
   * de `editar_tipo_pago` de v1: registra el cambio en `actividad` (auditoría).
   */
  async actualizarTipoPago(
    idPdpDet: string,
    tipoPago: string,
    actorUid: string,
  ): Promise<{ ok: true }> {
    const { data: det, error: e0 } = await this.supabase.admin
      .from('pdpDetalle')
      .select('idPdpDet, tipoPago, status')
      .eq('idPdpDet', idPdpDet)
      .maybeSingle();
    if (e0) throw new InternalServerErrorException(e0.message);
    if (!det || det.status === false)
      throw new NotFoundException('Parcialidad no encontrada.');

    const db = this.supabase.comoActor(actorUid);
    const { error } = await db
      .from('pdpDetalle')
      .update({ tipoPago })
      .eq('idPdpDet', idPdpDet);
    if (error) throw new InternalServerErrorException(error.message);

    // Bitácora de actividad (secundaria; no interrumpe el cambio si falla).
    await db.from('actividad').insert({
      uid: actorUid,
      entorno: 3,
      logeado: true,
      pantalla: 'Planes',
      widget: 'select',
      nomwidget: 'Modificar Tipo de Pago',
      comentario: `Se actualiza tipo de Pago de ${det.tipoPago ?? '-'} a ${tipoPago} | idPdpDet${idPdpDet}`,
      version: 'erp-v2',
    });

    return { ok: true };
  }

  // ----------------------------- Config: Crear Plan de Pagos -----------------------------

  /**
   * Crea un PDP y sus N parcialidades mensuales. Replica `PdpNvoWidget` de v1:
   * montoTotal = terreno + obra*1.16; cada parcialidad = round(montoTotal/N, 2).
   */
  async crearPlanPagos(dto: CrearPlanPagosDto, actorUid: string): Promise<{ idPdp: string }> {
    // Validar que la propiedad exista y no tenga ya un PDP activo.
    const { data: prop, error: propErr } = await this.supabase.admin
      .from('propiedades')
      .select('idPropiedad, tienenPdp, idPdp')
      .eq('idPropiedad', dto.idPropiedad)
      .maybeSingle();
    if (propErr) throw new InternalServerErrorException(propErr.message);
    if (!prop) throw new NotFoundException('Propiedad no encontrada.');
    // El vínculo real es `idPdp` (la bandera `tienenPdp` está desincronizada en
    // datos heredados de v1: hay propiedades con plan e idPdp pero tienenPdp=false).
    // Guardar por `idPdp` evita crear un segundo PDP duplicado en esos casos.
    if (prop.idPdp)
      throw new BadRequestException('La propiedad ya tiene un plan de pagos.');

    const montoTotal = dto.terreno + dto.obra * 1.16;
    const db = this.supabase.comoActor(actorUid);
    const idPdp = this.generarId(12);

    const { error: pdpErr } = await db.from('pdp').insert({
      idPdp,
      uid: actorUid,
      status: true,
      idPropiedad: dto.idPropiedad,
      pdpactivo: false,
      montoterreno: dto.terreno,
      montoobra: dto.obra,
      monto: montoTotal,
      frecuencia: 'Mensual',
      cantpagos: dto.cantPagos,
      idvendedor: dto.idVendedor || null,
    });
    if (pdpErr) throw new InternalServerErrorException(`No se pudo crear el PDP: ${pdpErr.message}`);

    // Parcialidades: misma cantidad en todas (round(total/N, 2)), como v1.
    const cuota = Math.round((montoTotal / dto.cantPagos) * 100) / 100;
    const [y, m, d] = dto.fechaPrimerPago.split('-').map((s) => Number(s));
    let fecha = new Date(Date.UTC(y!, m! - 1, d!));

    const detalles = [];
    for (let i = 1; i <= dto.cantPagos; i++) {
      if (i > 1) fecha = this.siguienteMes(fecha);
      detalles.push({
        idPdpDet: this.generarId(15),
        uid: actorUid,
        status: true,
        idPdp,
        numPago: i,
        fecha: this.aISO(fecha),
        monto: cuota,
        idPropiedad: dto.idPropiedad,
        idNave: dto.idNave,
        idInversionista: dto.idInversionista,
        idVendedor: dto.idVendedor || null,
      });
    }
    const { error: detErr } = await db.from('pdpDetalle').insert(detalles);
    if (detErr) throw new InternalServerErrorException(`No se pudieron crear las parcialidades: ${detErr.message}`);

    const { error: updErr } = await db
      .from('propiedades')
      .update({ idPdp, tienenPdp: true, pdpActivo: false })
      .eq('idPropiedad', dto.idPropiedad);
    if (updErr) throw new InternalServerErrorException(updErr.message);

    return { idPdp };
  }

  // ----------------------------- Config: Activar/Desactivar Plan de Pagos -----------------------------

  /**
   * Activa o desactiva el Plan de Pagos de una propiedad. La bandera vigente del
   * módulo es `propiedades.pdpActivo` (la que define el universo del Dashboard y de
   * Planes); al activar, el plan entra a cobranza, al desactivar se libera. **NO se
   * toca `pdp.pdpactivo`**: en producción está en `false` para TODOS los planes (no se
   * mantiene en v2; la verdad operativa vive en `propiedades.pdpActivo`). Es el mismo
   * patrón que Arrendatarios (toca solo su bandera de `arrenPropiedades`). No existía
   * como acción en v2 (el plan nacía inactivo sin forma de activarlo). Auditado.
   */
  async setActivoPlan(
    idPropiedad: string,
    activo: boolean,
    actorUid: string,
  ): Promise<{ ok: true }> {
    const { data: prop, error: propErr } = await this.supabase.admin
      .from('propiedades')
      .select('idPropiedad, idPdp')
      .eq('idPropiedad', idPropiedad)
      .maybeSingle();
    if (propErr) throw new InternalServerErrorException(propErr.message);
    if (!prop) throw new NotFoundException('Propiedad no encontrada.');
    // El vínculo real es `idPdp` (la bandera `tienenPdp` no es confiable en datos de
    // v1: puede estar en false con un plan ya vinculado). Validar por `idPdp`.
    if (!prop.idPdp)
      throw new BadRequestException('La propiedad no tiene un plan de pagos.');

    // Al ACTIVAR, la suma de las parcialidades debe cuadrar con el total del plan
    // (tolerancia ±TOLERANCIA_PDP), como v1. Al desactivar no se valida.
    if (activo) {
      const [{ data: pdpRow, error: pErr }, { data: dets, error: dErr }] = await Promise.all([
        this.supabase.admin.from('pdp').select('monto').eq('idPdp', prop.idPdp).maybeSingle(),
        this.supabase.admin
          .from('pdpDetalle')
          .select('monto')
          .eq('idPdp', prop.idPdp)
          .eq('status', true),
      ]);
      if (pErr) throw new InternalServerErrorException(pErr.message);
      if (dErr) throw new InternalServerErrorException(dErr.message);
      const total = pdpRow?.monto ?? 0;
      const suma = (dets ?? []).reduce((s, d) => s + (d.monto ?? 0), 0);
      if (Math.abs(suma - total) > TOLERANCIA_PDP)
        throw new BadRequestException(
          `No se puede activar: la suma de las parcialidades (${suma.toFixed(2)}) no coincide ` +
            `con el total del plan (${total.toFixed(2)}). Ajusta los montos antes de activar.`,
        );
    }

    const db = this.supabase.comoActor(actorUid);
    const { error: upPropErr } = await db
      .from('propiedades')
      .update({ pdpActivo: activo })
      .eq('idPropiedad', idPropiedad);
    if (upPropErr) throw new InternalServerErrorException(upPropErr.message);

    // Bitácora de actividad (secundaria; no interrumpe el cambio si falla).
    await db.from('actividad').insert({
      uid: actorUid,
      entorno: 3,
      logeado: true,
      pantalla: 'Planes',
      widget: 'Button',
      nomwidget: activo ? 'Activar PDP' : 'Desactivar PDP',
      comentario: `Se ${activo ? 'activó' : 'desactivó'} el plan de pagos de la propiedad ${idPropiedad} (idPdp ${prop.idPdp}).`,
      version: 'erp-v2',
    });

    return { ok: true };
  }

  // ----------------------------- Config: Edición del PDP (solo plan inactivo) -----------------------------

  /**
   * Cabecera del PDP de una propiedad (montos editables + estado). Devuelve null si
   * la propiedad no tiene plan. Se usa para mostrar/editar Terreno/Obra/Total.
   */
  async cabeceraPdp(idPropiedad: string) {
    const { data: prop, error } = await this.supabase.admin
      .from('propiedades')
      .select('idPdp, pdpActivo')
      .eq('idPropiedad', idPropiedad)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!prop?.idPdp) return null;
    const { data: pdp, error: pdpErr } = await this.supabase.admin
      .from('pdp')
      .select('idPdp, montoterreno, montoobra, monto, cantpagos')
      .eq('idPdp', prop.idPdp)
      .maybeSingle();
    if (pdpErr) throw new InternalServerErrorException(pdpErr.message);
    if (!pdp) return null;
    return {
      idPdp: pdp.idPdp,
      montoterreno: pdp.montoterreno ?? 0,
      montoobra: pdp.montoobra ?? 0,
      monto: pdp.monto ?? 0,
      cantpagos: pdp.cantpagos ?? 0,
      pdpActivo: prop.pdpActivo === true,
    };
  }

  /**
   * Verifica que la propiedad tenga plan e **inactivo** (editable). Devuelve la
   * propiedad (con `idPdp`). Un plan activo está "congelado": no se edita (como v1).
   */
  private async asegurarPlanInactivo(idPropiedad: string | null) {
    if (!idPropiedad) throw new BadRequestException('Falta la propiedad.');
    const { data: prop, error } = await this.supabase.admin
      .from('propiedades')
      .select('idPropiedad, idPdp, pdpActivo')
      .eq('idPropiedad', idPropiedad)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!prop) throw new NotFoundException('Propiedad no encontrada.');
    if (!prop.idPdp) throw new BadRequestException('La propiedad no tiene un plan de pagos.');
    if (prop.pdpActivo === true)
      throw new BadRequestException('El plan está activo. Desactívalo para poder editarlo.');
    return prop as { idPropiedad: string; idPdp: string; pdpActivo: boolean | null };
  }

  /** Lee una parcialidad y valida que su plan esté inactivo. Devuelve la parcialidad. */
  private async partidaEditable(idPdpDet: string) {
    const { data: det, error } = await this.supabase.admin
      .from('pdpDetalle')
      .select('idPdpDet, idPdp, idPropiedad, status')
      .eq('idPdpDet', idPdpDet)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!det || det.status === false) throw new NotFoundException('Parcialidad no encontrada.');
    await this.asegurarPlanInactivo(det.idPropiedad);
    return det;
  }

  /** Bitácora de actividad de la edición del plan (secundaria; no interrumpe si falla). */
  private async registrarActividadPlan(actorUid: string, comentario: string): Promise<void> {
    await this.supabase.comoActor(actorUid).from('actividad').insert({
      uid: actorUid,
      entorno: 3,
      logeado: true,
      pantalla: 'Planes',
      widget: 'config',
      nomwidget: 'Plan de Pagos',
      comentario,
      version: 'erp-v2',
    });
  }

  /** Edita Terreno/Obra del plan y recalcula el total (= terreno + obra*1.16). */
  async editarMontosPlan(
    idPropiedad: string,
    terreno: number,
    obra: number,
    actorUid: string,
  ): Promise<{ ok: true; monto: number }> {
    const prop = await this.asegurarPlanInactivo(idPropiedad);
    const monto = terreno + obra * 1.16;
    const { error } = await this.supabase
      .comoActor(actorUid)
      .from('pdp')
      .update({ montoterreno: terreno, montoobra: obra, monto })
      .eq('idPdp', prop.idPdp);
    if (error) throw new InternalServerErrorException(error.message);
    await this.registrarActividadPlan(
      actorUid,
      `Se actualizan montos del plan (terreno ${terreno}, obra ${obra}) | idPdp${prop.idPdp}`,
    );
    return { ok: true, monto };
  }

  /** Edita el monto de una parcialidad (solo plan inactivo). */
  async editarMontoPartida(
    idPdpDet: string,
    monto: number,
    actorUid: string,
  ): Promise<{ ok: true }> {
    await this.partidaEditable(idPdpDet);
    const { error } = await this.supabase
      .comoActor(actorUid)
      .from('pdpDetalle')
      .update({ monto })
      .eq('idPdpDet', idPdpDet);
    if (error) throw new InternalServerErrorException(error.message);
    await this.registrarActividadPlan(actorUid, `Se actualiza monto de parcialidad a ${monto} | idPdpDet${idPdpDet}`);
    return { ok: true };
  }

  /** Edita la fecha de una parcialidad (solo plan inactivo). */
  async editarFechaPartida(
    idPdpDet: string,
    fecha: string,
    actorUid: string,
  ): Promise<{ ok: true }> {
    await this.partidaEditable(idPdpDet);
    const { error } = await this.supabase
      .comoActor(actorUid)
      .from('pdpDetalle')
      .update({ fecha })
      .eq('idPdpDet', idPdpDet);
    if (error) throw new InternalServerErrorException(error.message);
    await this.registrarActividadPlan(actorUid, `Se actualiza fecha de parcialidad a ${fecha} | idPdpDet${idPdpDet}`);
    return { ok: true };
  }

  /**
   * Agrega una parcialidad al final del plan (solo inactivo): `numPago` = última+1,
   * `fecha` = mes siguiente a la última, `monto` = 0 (el usuario lo ajusta),
   * `tipoPago` = 'Parcialidad'. Incrementa `pdp.cantpagos`.
   */
  async agregarPartida(idPropiedad: string, actorUid: string): Promise<{ idPdpDet: string }> {
    const prop = await this.asegurarPlanInactivo(idPropiedad);
    const { data: dets, error } = await this.supabase.admin
      .from('pdpDetalle')
      .select('numPago, fecha, idNave, idInversionista, idVendedor')
      .eq('idPdp', prop.idPdp)
      .eq('status', true)
      .order('numPago', { ascending: false })
      .limit(1);
    if (error) throw new InternalServerErrorException(error.message);
    const ultima = dets?.[0];
    const numPago = (ultima?.numPago ?? 0) + 1;
    let fecha: string;
    if (ultima?.fecha) {
      const [y, m, d] = ultima.fecha.slice(0, 10).split('-').map(Number);
      fecha = this.aISO(this.siguienteMes(new Date(Date.UTC(y!, m! - 1, d!))));
    } else {
      fecha = new Date().toISOString().slice(0, 10);
    }

    const db = this.supabase.comoActor(actorUid);
    const idPdpDet = this.generarId(15);
    const { error: insErr } = await db.from('pdpDetalle').insert({
      idPdpDet,
      uid: actorUid,
      status: true,
      idPdp: prop.idPdp,
      numPago,
      fecha,
      monto: 0,
      tipoPago: 'Parcialidad',
      idPropiedad,
      idNave: ultima?.idNave ?? null,
      idInversionista: ultima?.idInversionista ?? null,
      idVendedor: ultima?.idVendedor ?? null,
    });
    if (insErr) throw new InternalServerErrorException(insErr.message);

    // Incrementar cantpagos del PDP.
    const { data: pdpRow } = await this.supabase.admin
      .from('pdp')
      .select('cantpagos')
      .eq('idPdp', prop.idPdp)
      .maybeSingle();
    await db
      .from('pdp')
      .update({ cantpagos: (pdpRow?.cantpagos ?? numPago - 1) + 1 })
      .eq('idPdp', prop.idPdp);

    await this.registrarActividadPlan(actorUid, `Se agrega parcialidad ${numPago} | idPdp${prop.idPdp}`);
    return { idPdpDet };
  }

  /**
   * Elimina una parcialidad (solo plan inactivo y sin pagos registrados, como v1).
   * Decrementa `pdp.cantpagos`.
   */
  async eliminarPartida(idPdpDet: string, actorUid: string): Promise<{ ok: true }> {
    const det = await this.partidaEditable(idPdpDet);

    const { count, error: pagErr } = await this.supabase.admin
      .from('pagos')
      .select('idPago', { count: 'exact', head: true })
      .eq('idPdpDet', idPdpDet);
    if (pagErr) throw new InternalServerErrorException(pagErr.message);
    if ((count ?? 0) > 0)
      throw new BadRequestException('No se puede eliminar: la parcialidad tiene pagos registrados.');

    const db = this.supabase.comoActor(actorUid);
    const { error } = await db.from('pdpDetalle').delete().eq('idPdpDet', idPdpDet);
    if (error) throw new InternalServerErrorException(error.message);

    if (det.idPdp) {
      const { data: pdpRow } = await this.supabase.admin
        .from('pdp')
        .select('cantpagos')
        .eq('idPdp', det.idPdp)
        .maybeSingle();
      await db
        .from('pdp')
        .update({ cantpagos: Math.max(1, (pdpRow?.cantpagos ?? 1) - 1) })
        .eq('idPdp', det.idPdp);
    }

    await this.registrarActividadPlan(actorUid, `Se elimina parcialidad | idPdpDet${idPdpDet}`);
    return { ok: true };
  }
}
