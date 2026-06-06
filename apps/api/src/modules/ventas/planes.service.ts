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

  async inversionistas() {
    const { data, error } = await this.supabase.admin
      .from('inversionista')
      .select('idInversionista, nombre, apellido1, apellido2, razonsocial')
      .eq('status', true)
      .order('nombre', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async propiedadesDe(idInversionista: string) {
    const { data, error } = await this.supabase.admin
      .from('propiedades')
      .select(
        'idPropiedad, idNave, idParque, nomDescriptivo, tienenPdp, idPdp, pdpActivo, esTicket, tieneRgPdp, tieneRaPdp',
      )
      .eq('idInversionista', idInversionista)
      .eq('status', true)
      .order('nomDescriptivo', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    if (!data || data.length === 0) return [];

    // Enriquecer con datos de la nave (lote/mza/numNaveNAME).
    const idsNave = [...new Set(data.map((p) => p.idNave).filter((x): x is string => !!x))];
    const navesMap = new Map<string, { numNaveNAME: string | null; lote: number; mza: number }>();
    if (idsNave.length > 0) {
      const { data: naves } = await this.supabase.admin
        .from('naves')
        .select('idNave, numNaveNAME, lote, mza')
        .in('idNave', idsNave);
      for (const n of naves ?? [])
        navesMap.set(n.idNave, { numNaveNAME: n.numNaveNAME, lote: n.lote, mza: n.mza });
    }
    return data.map((p) => ({ ...p, nave: p.idNave ? (navesMap.get(p.idNave) ?? null) : null }));
  }

  /** Detalle del Plan de Pagos de una propiedad (parcialidades de su PDP). */
  async planDePagos(idPropiedad: string) {
    const { data, error } = await this.supabase.admin
      .from('v_pagos')
      .select('*')
      .eq('idPropiedad', idPropiedad)
      .order('numPago', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
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

  /** Naves disponibles (no arrendadas) de un parque, para vincular. */
  async navesDisponibles(idParque?: string) {
    let q = this.supabase.admin
      .from('naves')
      .select('idNave, idParque, numNaveNAME, lote, mza, terreno, construccion, precio, situacion')
      .eq('status', true);
    if (idParque) q = q.eq('idParque', idParque);
    const { data, error } = await q.order('numNaveNAME', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async vincularNave(dto: PropiedadDto, actorUid: string): Promise<{ idPropiedad: string }> {
    const idPropiedad = this.generarId(15);
    const { error } = await this.supabase.comoActor(actorUid).from('propiedades').insert({
      idPropiedad,
      idInversionista: dto.idInversionista,
      idNave: dto.idNave,
      idParque: dto.idParque || null,
      nomDescriptivo: dto.nomDescriptivo || null,
      tienenPdp: false,
      pdpActivo: false,
      tieneRgPdp: false,
      tieneRaPdp: false,
      rgPdpActivo: false,
      raPdpActivo: false,
      status: true,
    });
    if (error) throw new InternalServerErrorException(error.message);
    return { idPropiedad };
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
    if (prop.tienenPdp && prop.idPdp)
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
}
