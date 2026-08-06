import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { KvasService } from '../parques/kvas.service.js';
import type {
  CrearPlanPagosDto,
  DocDto,
  InversionistaDto,
  PropiedadDto,
  TrasladarSaldoDto,
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
  private readonly logger = new Logger(PlanesService.name);

  constructor(
    private readonly supabase: SupabaseService,
    /** Candado de KVA al desvincular la nave (ver `desvincularNave`). */
    private readonly kvas: KvasService,
  ) {}

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

    // KVAs asignados por nave (tabla kvasAsignados), separados por nivel de
    // tensión: `mt` = media, `bt` = baja.
    //
    // 🐛 Corregido 2026-08-03: antes se leía el smallint `tipoTension` con el
    // mapeo 1=Alta/2=Media, INVERTIDO respecto al trigger de la BD (que
    // descontaba tipoTension=2 de la capacidad de media tensión). La pantalla
    // mostraba como "Media" lo que el parque había descontado de la otra bolsa.
    // Ahora se lee la columna `nivel` ('MT'/'BT'), que tiene catálogo (CHECK) y
    // es la misma fuente que usa el motor de saldo.
    const kvasMap = new Map<string, { mt: number; bt: number }>();
    if (idsNave.length > 0) {
      const { data: kvas } = await this.supabase.admin
        .from('kvasAsignados')
        .select('idNave, nivel, cantKvas')
        .in('idNave', idsNave)
        .eq('status', true);
      for (const k of kvas ?? []) {
        const acc = kvasMap.get(k.idNave) ?? { mt: 0, bt: 0 };
        if (k.nivel === 'MT') acc.mt += k.cantKvas ?? 0;
        else if (k.nivel === 'BT') acc.bt += k.cantKvas ?? 0;
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
      kvas: p.idNave ? (kvasMap.get(p.idNave) ?? { mt: 0, bt: 0 }) : null,
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
   * Desvincula una nave de un inversionista por **BAJA LÓGICA** (conserva el histórico y la
   * trazabilidad, como `liberarNave` en Arrendatarios): marca `propiedades.status=false`
   * — NO borra — y regresa la nave a 'Disponible'. El `pdp`/`pagos` y demás planes quedan
   * intactos, para el historial de la nave y para los cálculos financieros a inversionistas.
   *
   * Guarda de **negocio** (ya sin riesgo de FK, porque no hay DELETE): solo se impide si hay
   * un plan de venta **ACTIVO** (`pdpActivo`) o una Renta Garantizada/Administrada **ACTIVA**
   * (`rgPdpActivo`/`raPdpActivo`). Los planes saldados/históricos NO bloquean (se conservan
   * por el `status=false`). Reemplaza la guarda estricta previa (que bloqueaba por cualquier
   * plan/pago para evitar el FK del DELETE, ya innecesaria).
   *
   * El `motivo` es el "por qué" de negocio: se guarda en `propiedades.motivoBaja` (lo audita
   * `trg_auditoria` con el actor del JWT). El actor y la fecha viven en la tabla `auditoria`.
   */
  async desvincularNave(
    idPropiedad: string,
    actorUid: string,
    motivo?: string,
  ): Promise<{ ok: true }> {
    const { data: prop, error: propErr } = await this.supabase.admin
      .from('propiedades')
      .select('idPropiedad, idNave, pdpActivo, rgPdpActivo, raPdpActivo')
      .eq('idPropiedad', idPropiedad)
      .maybeSingle();
    if (propErr) throw new InternalServerErrorException(propErr.message);
    if (!prop) throw new NotFoundException('Propiedad no encontrada.');

    // Guarda de negocio: solo se impide desvincular si hay un plan de venta ACTIVO o una
    // Renta Garantizada/Administrada ACTIVA. Los planes saldados/históricos se conservan
    // con la propiedad status=false.
    //   - `pdpActivo` (bandera) es fiable para el plan de pagos de venta.
    //   - Para RG/RA se consultan las TABLAS REALES por `rentaActiva=true`: las banderas
    //     `rgPdpActivo`/`raPdpActivo` pueden estar desincronizadas (hay propiedades con
    //     `raPdp.rentaActiva=true` y la bandera en false) — y una RA/RG es ingreso del
    //     inversionista, así que no se confía solo en la bandera.
    if (prop.pdpActivo)
      throw new BadRequestException(
        'No se puede desvincular: la nave tiene un plan de pagos (venta) activo.',
      );
    const [rgActiva, raActiva] = await Promise.all([
      this.supabase.admin
        .from('rgPdp')
        .select('idRtaG', { count: 'exact', head: true })
        .eq('idPropiedad', idPropiedad)
        .eq('rentaActiva', true),
      this.supabase.admin
        .from('raPdp')
        .select('idRtaA', { count: 'exact', head: true })
        .eq('idPropiedad', idPropiedad)
        .eq('rentaActiva', true),
    ]);
    if (rgActiva.error) throw new InternalServerErrorException(rgActiva.error.message);
    if (raActiva.error) throw new InternalServerErrorException(raActiva.error.message);
    if ((rgActiva.count ?? 0) > 0)
      throw new BadRequestException(
        'No se puede desvincular: la nave tiene una Renta Garantizada activa.',
      );
    if ((raActiva.count ?? 0) > 0)
      throw new BadRequestException(
        'No se puede desvincular: la nave tiene una Renta Administrada activa.',
      );

    // Candado de KVA: los KVA VENDIDOS deben regresar al parque y acreditarse
    // con documento antes de soltar la nave (regla de negocio 2026-08-03).
    await this.kvas.exigirKvasDevueltos(prop.idNave);

    const motivoBaja = motivo?.trim() || null;
    const actor = this.supabase.comoActor(actorUid);
    // BAJA LÓGICA — no DELETE: conserva la fila y todo su histórico (espejo de `liberarNave`,
    // que pone `idArrePdp=null` y baja sus banderas). El `pdp`/`pagos` NO se tocan.
    const { error: upErr } = await actor
      .from('propiedades')
      .update({
        status: false,
        tienenPdp: false,
        pdpActivo: false,
        idPdp: null,
        tieneRgPdp: false,
        tieneRaPdp: false,
        rgPdpActivo: false,
        raPdpActivo: false,
        motivoBaja,
      })
      .eq('idPropiedad', idPropiedad);
    if (upErr) throw new InternalServerErrorException(upErr.message);

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

    await this.registrarActividadPlan(
      actorUid,
      `Se desvinculó la propiedad ${idPropiedad} (nave ${prop.idNave ?? '-'}); queda disponible.${
        motivoBaja ? ` Motivo: ${motivoBaja}` : ''
      }`,
    );

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
    // `.not('idPdp', 'is', null)` + conteo de filas: cierra la carrera con
    // `eliminar_plan_pagos` (si el plan se elimina entre la validación y este
    // UPDATE, el WHERE re-evaluado ya no matchea y se evita dejar la propiedad
    // atascada con pdpActivo=true e idPdp=null — estado sin salida en la UI).
    const { data: upRows, error: upPropErr } = await db
      .from('propiedades')
      .update({ pdpActivo: activo })
      .eq('idPropiedad', idPropiedad)
      .not('idPdp', 'is', null)
      .select('idPropiedad');
    if (upPropErr) throw new InternalServerErrorException(upPropErr.message);
    if (!upRows || upRows.length === 0)
      throw new BadRequestException(
        'La propiedad ya no tiene un plan de pagos (pudo eliminarse en este momento). Refresca la pantalla.',
      );

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
   *
   * Candado 2026-08-05: SIEMPRE debe quedar al menos una parcialidad. Nace de un
   * patrón de uso real: usuarios que borran todas las partidas creyendo que así
   * eliminan el plan, dejando un plan "cascarón" ($0.00, 0 partidas) que bloquea
   * desvincular la nave o crear un PDP nuevo. Para deshacerse del plan completo
   * existe la acción explícita «Eliminar plan» (`eliminarPlanPagos`).
   */
  async eliminarPartida(idPdpDet: string, actorUid: string): Promise<{ ok: true }> {
    const det = await this.partidaEditable(idPdpDet);

    if (det.idPdp) {
      const { count: vivas, error: vivasErr } = await this.supabase.admin
        .from('pdpDetalle')
        .select('idPdpDet', { count: 'exact', head: true })
        .eq('idPdp', det.idPdp)
        .eq('status', true);
      if (vivasErr) throw new InternalServerErrorException(vivasErr.message);
      if ((vivas ?? 0) <= 1)
        throw new BadRequestException(
          'No se puede eliminar la última parcialidad: el plan debe conservar al menos una. ' +
            'Si quieres deshacerte del plan completo, usa «Eliminar plan» (con el plan desactivado).',
        );
    }

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

  /**
   * Elimina el Plan de Pagos COMPLETO de una propiedad (2026-08-05). Solo procede si
   * el plan está **desactivado** y **ningún pago** (vivo o cancelado) referencia el
   * plan ni sus partidas — un pago cancelado es histórico que se conserva y además la
   * FK de `pagos` (NO ACTION) bloquearía el borrado. Libera la propiedad
   * (`idPdp=null`, banderas abajo) para poder desvincular la nave o crear un PDP nuevo.
   *
   * La operación corre en la RPC **transaccional** `eliminar_plan_pagos`: bloquea la
   * propiedad (`FOR UPDATE`), revalida las guardas con la fila bloqueada y aplica
   * UPDATE propiedades + DELETE pdp (el CASCADE de `pdpDetalle.idPdp` borra las
   * partidas) en una sola transacción — imposible quedar a medias. Se invoca con
   * `comoActor` para que `trg_auditoria` (que cubre DELETE en `pdp`/`pdpDetalle`/
   * `propiedades`) registre al actor real del JWT.
   */
  async eliminarPlanPagos(idPropiedad: string, actorUid: string): Promise<{ ok: true }> {
    // Prevalidación con mensajes claros (la RPC revalida de forma autoritativa).
    const prop = await this.asegurarPlanInactivo(idPropiedad);

    const db = this.supabase.comoActor(actorUid);
    const { error } = await db.rpc('eliminar_plan_pagos', {
      p_id_propiedad: idPropiedad,
    });
    if (error) {
      const MAP_ERR: Record<string, string> = {
        PROPIEDAD_NO_ENCONTRADA: 'Propiedad no encontrada.',
        SIN_PLAN: 'La propiedad no tiene un plan de pagos.',
        PLAN_ACTIVO: 'El plan está activo. Desactívalo antes de eliminarlo.',
        CON_PAGOS:
          'No se puede eliminar: el plan tiene pagos registrados (incluidos cancelados). ' +
          'Ese historial financiero se conserva.',
      };
      const code = Object.keys(MAP_ERR).find((k) => error.message.includes(k));
      if (code) throw new BadRequestException(MAP_ERR[code]);
      this.logger.error(`eliminarPlanPagos: error en RPC eliminar_plan_pagos: ${error.message}`);
      throw new InternalServerErrorException('No se pudo eliminar el plan de pagos.');
    }

    await this.registrarActividadPlan(
      actorUid,
      `Se elimina el plan de pagos completo (sin pagos registrados) | idPdp${prop.idPdp} | idPropiedad ${idPropiedad}. La propiedad queda libre para desvincular o crear un nuevo plan.`,
    );
    return { ok: true };
  }

  // ----------------------------- Trasladar saldo (clave 611) -----------------------------

  /** "Hoy" en horario de México (yyyy-MM-dd), igual que `SaldosVencidosService`. */
  private hoyMx(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
  }

  /**
   * Traslada `monto` de la parcialidad de **origen** a una parcialidad **futura**
   * de **destino** del **mismo** plan (clave 611). Resta del origen y suma al
   * destino, **conservando el total del plan** (`Σ parcialidades = pdp.monto`):
   * por eso —a diferencia de la edición de partidas— **NO exige desactivar el
   * plan** (un plan activo está congelado para edición libre, pero este traslado
   * es una operación controlada que no altera la suma del contrato).
   *
   * Efecto en cobranza: el saldo vencido del origen baja y reaparece en una
   * parcialidad futura (que aún no vence), por lo que el adeudo "a hoy" se limpia
   * sin eliminar ningún registro (`SaldosVencidosService` lo recalcula solo).
   *
   * **Trazabilidad (regla §1.6):** registra el movimiento en AMBAS parcialidades
   * (un comentario en el origen y otro en el destino) + una entrada en
   * `actividad`, todo vía `comoActor` (auditoría server-side no falsificable).
   *
   * Validaciones: origen ≠ destino; ambas vivas y del mismo plan; destino con
   * fecha **futura**; `monto > 0` y ≤ saldo pendiente del origen (no deja el monto
   * por debajo de lo ya pagado en esa parcialidad).
   *
   * ⚠️ **Atomicidad:** se aplican dos UPDATE secuenciales (patrón del módulo, p.
   * ej. `vincularNave`); si el segundo falla, se **revierte** el primero. En el
   * caso extremo de un fallo irrecuperable entre ambos, la inconsistencia es
   * detectable (la suma dejaría de cuadrar con `pdp.monto` y el plan no podría
   * reactivarse) y queda registrada en el log.
   */
  async trasladarSaldo(dto: TrasladarSaldoDto, actorUid: string): Promise<{
    ok: true;
    origen: { idPdpDet: string; monto: number };
    destino: { idPdpDet: string; monto: number };
  }> {
    const { idPdpDetOrigen, idPdpDetDestino, monto } = dto;
    if (idPdpDetOrigen === idPdpDetDestino)
      throw new BadRequestException('El origen y el destino deben ser parcialidades distintas.');
    if (!(monto > 0))
      throw new BadRequestException('El monto a trasladar debe ser mayor a 0.');

    // Leer ambas parcialidades en una sola consulta.
    const { data: rows, error } = await this.supabase.admin
      .from('pdpDetalle')
      .select('idPdpDet, idPdp, idPropiedad, numPago, fecha, monto, tipoPago, status')
      .in('idPdpDet', [idPdpDetOrigen, idPdpDetDestino]);
    if (error) throw new InternalServerErrorException(error.message);
    const origen = (rows ?? []).find((r) => r.idPdpDet === idPdpDetOrigen);
    const destino = (rows ?? []).find((r) => r.idPdpDet === idPdpDetDestino);
    if (!origen || origen.status === false)
      throw new NotFoundException('Parcialidad de origen no encontrada.');
    if (!destino || destino.status === false)
      throw new NotFoundException('Parcialidad de destino no encontrada.');

    // Mismo plan (el saldo nunca cruza a otro plan).
    if (!origen.idPdp || !destino.idPdp || origen.idPdp !== destino.idPdp)
      throw new BadRequestException(
        'Solo se puede trasladar saldo entre parcialidades del mismo plan.',
      );

    // El destino debe ser una parcialidad FUTURA (su fecha aún no venció). Esta
    // validación —y todas las financieras (mismo plan, tope, no-negativo)— las
    // revalida la RPC transaccional de forma autoritativa con la fila bloqueada;
    // aquí se comprueba temprano solo para devolver un mensaje claro.
    const hoy = this.hoyMx();
    if (!destino.fecha || destino.fecha <= hoy)
      throw new BadRequestException(
        'La parcialidad de destino debe tener una fecha futura (posterior a hoy).',
      );

    const montoOrigen = origen.monto ?? 0;
    const montoDestino = destino.monto ?? 0;
    const db = this.supabase.comoActor(actorUid);

    // El traslado se hace en una RPC **transaccional** (`trasladar_saldo_pdp`):
    // bloquea ambas parcialidades (`SELECT … FOR UPDATE`), revalida saldo/tope/
    // plan/fecha y aplica los dos UPDATE en una sola transacción. Esto garantiza
    // atomicidad (no quedar descuadrado ante un fallo entre updates) y aislamiento
    // (sin lost-update por traslados o pagos concurrentes) — imposible con dos
    // updates sueltos vía supabase-js. Se invoca con `comoActor` para que la
    // auditoría server-side de `pdpDetalle` capture al actor real.
    const { data: res, error: rpcErr } = await db.rpc('trasladar_saldo_pdp', {
      p_origen: idPdpDetOrigen,
      p_destino: idPdpDetDestino,
      p_monto: monto,
    });
    if (rpcErr) {
      const MAP_ERR: Record<string, string> = {
        ORIGEN_IGUAL_DESTINO: 'El origen y el destino deben ser parcialidades distintas.',
        MONTO_INVALIDO: 'El monto a trasladar debe ser mayor a 0.',
        ORIGEN_NO_ENCONTRADO: 'Parcialidad de origen no encontrada.',
        DESTINO_NO_ENCONTRADO: 'Parcialidad de destino no encontrada.',
        PLANES_DISTINTOS: 'Solo se puede trasladar saldo entre parcialidades del mismo plan.',
        DESTINO_NO_FUTURO: 'La parcialidad de destino debe tener una fecha futura (posterior a hoy).',
        DESTINO_CON_PAGOS: 'No se puede trasladar a una parcialidad de destino que ya tiene pagos registrados.',
        SIN_SALDO: 'La parcialidad de origen no tiene saldo pendiente para trasladar.',
        EXCEDE_TOPE: 'El monto a trasladar excede el máximo permitido para esta parcialidad.',
        ORIGEN_NEGATIVO: 'El traslado dejaría la parcialidad de origen en monto negativo.',
      };
      const code = Object.keys(MAP_ERR).find((k) => rpcErr.message.includes(k));
      if (code) throw new BadRequestException(MAP_ERR[code]);
      this.logger.error(`trasladarSaldo: error en RPC trasladar_saldo_pdp: ${rpcErr.message}`);
      throw new InternalServerErrorException('No se pudo trasladar el saldo.');
    }
    const fila = (Array.isArray(res) ? res[0] : res) as
      | { nuevo_origen: number | null; nuevo_destino: number | null }
      | undefined;
    const nuevoOrigen = Math.round(Number(fila?.nuevo_origen ?? montoOrigen - monto) * 100) / 100;
    const nuevoDestino = Math.round(Number(fila?.nuevo_destino ?? montoDestino + monto) * 100) / 100;

    // Trazabilidad: comentario en ORIGEN y en DESTINO + actividad (idPago = NULL,
    // no es un pago; la columna comentarios.idPago acepta NULL). NO son críticos
    // para la integridad financiera (la RPC ya commiteó el traslado atómicamente);
    // si fallan, solo se pierde el registro descriptivo (se loguea).
    const f = (n: number | null | undefined) => (n ?? 0).toFixed(2);
    const comOrigen =
      `Se trasladó saldo de $${f(monto)} de esta parcialidad (#${origen.numPago ?? '-'}, ${origen.fecha ?? '-'}) ` +
      `a la parcialidad #${destino.numPago ?? '-'} (${destino.fecha}). Monto: ${f(montoOrigen)} → ${f(nuevoOrigen)}.`;
    const comDestino =
      `Se recibió saldo de $${f(monto)} trasladado desde la parcialidad #${origen.numPago ?? '-'} (${origen.fecha ?? '-'}). ` +
      `Monto: ${f(montoDestino)} → ${f(nuevoDestino)}.`;
    const { error: cOErr } = await db
      .from('comentarios')
      .insert({ idPdpDet: idPdpDetOrigen, comentario: comOrigen, uid: actorUid });
    if (cOErr) this.logger.warn(`trasladarSaldo: no se registró el comentario de origen: ${cOErr.message}`);
    const { error: cDErr } = await db
      .from('comentarios')
      .insert({ idPdpDet: idPdpDetDestino, comentario: comDestino, uid: actorUid });
    if (cDErr) this.logger.warn(`trasladarSaldo: no se registró el comentario de destino: ${cDErr.message}`);

    await this.registrarActividadPlan(
      actorUid,
      `Traslado de saldo $${f(monto)} | origen idPdpDet${idPdpDetOrigen} (#${origen.numPago ?? '-'}) → ` +
        `destino idPdpDet${idPdpDetDestino} (#${destino.numPago ?? '-'}) | idPdp${origen.idPdp}`,
    );

    return {
      ok: true,
      origen: { idPdpDet: idPdpDetOrigen, monto: nuevoOrigen },
      destino: { idPdpDet: idPdpDetDestino, monto: nuevoDestino },
    };
  }
}
