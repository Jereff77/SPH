import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { fallaBd } from '../../common/utils/db-error.js';
import { rutaSegura, type ArchivoValidado } from '../../common/utils/archivo-seguro.js';
import type {
  AcometidaDto,
  CrearAsignacionDto,
  DevolucionDto,
  EditarAsignacionDto,
} from './kvas.schemas.js';

/** Bucket PRIVADO de los documentos de devolución (se sirve con URL firmada). */
const BUCKET_KVA = 'kvaDocs';
/** Vigencia de la URL firmada del documento (1 hora). */
const FIRMA_SEGUNDOS = 3600;

export interface AsignacionKva {
  idKvas: string;
  idParque: string;
  idNave: string;
  /** Etiqueta visible de la nave (`numNaveNAME`), resuelta aparte. */
  nave: string | null;
  numNave: number | null;
  nivel: string;
  figura: string;
  etapa: string;
  cantKvas: number;
  cantDevuelta: number;
  /** Lo que sigue consumiendo del parque (ver `kva_consumo` en BD). */
  pendiente: number;
  contratoCfe: string | null;
  fechaContratoCfe: string | null;
  status: boolean;
  fc: string;
}

export interface ResumenParqueKva {
  idParque: string;
  nomParque: string | null;
  idAcometida: string | null;
  kvasMt: number;
  kvasBt: number;
  kvasMtDisponibles: number;
  kvasBtDisponibles: number;
  kvasMtUtilizados: number;
  kvasBtUtilizados: number;
}

export interface Acometida {
  idAcometida: string;
  nombre: string;
  tensionKv: number | null;
  capacidadMt: number;
  capacidadBt: number;
  folioCfe: string | null;
  notas: string | null;
  /** Suma de lo repartido a sus parques (para detectar reparto excedido). */
  repartidoMt: number;
  repartidoBt: number;
  parques: ResumenParqueKva[];
}

/**
 * Administración de KVA's (capacidad eléctrica).
 *
 * Modelo (ver `base-conocimiento/PLAN-administracion-kvas.md`):
 * la ACOMETIDA es lo contratado con CFE y alimenta a uno o varios PARQUES;
 * cada parque reparte su capacidad entre sus NAVES en dos bolsas independientes
 * (MT = media, BT = baja).
 *
 * ⛔ El saldo (`kvas*Disponibles`) NO se toca desde aquí: lo recalcula la BD
 * (`kva_recalcular_disponibles`) en cada cambio de `kvasAsignados` o
 * `kvaDevoluciones`. Escribir el saldo a mano lo desincronizaría.
 *
 * Los disponibles pueden ser NEGATIVOS: es un sobregiro real y debe verse.
 */
@Injectable()
export class KvasService {
  private readonly logger = new Logger(KvasService.name);

  constructor(private readonly supabase: SupabaseService) {}

  private readonly ASIG_COLS =
    'idKvas, idParque, idNave, nivel, figura, etapa, cantKvas, cantDevuelta, contratoCfe, fechaContratoCfe, status, fc';

  // ===================== Resumen =====================

  /** Acometidas con sus parques, y los parques sin acometida asignada. */
  async resumen(): Promise<{ acometidas: Acometida[]; sinAcometida: ResumenParqueKva[] }> {
    const [{ data: acom, error: errA }, { data: parques, error: errP }] =
      await Promise.all([
        this.supabase.admin
          .from('kvaAcometidas')
          .select('idAcometida, nombre, tensionKv, capacidadMt, capacidadBt, folioCfe, notas')
          .eq('status', true)
          .order('nombre')
          .range(0, 999),
        this.supabase.admin
          .from('parques')
          .select(
            'idParque, nomParque, idAcometida, kvasMt, kvasBt, kvasMtDisponibles, kvasBtDisponibles, kvasMtUtilizados, kvasBtUtilizados',
          )
          .eq('status', true)
          .eq('esTicket', false)
          .order('nomParque')
          .range(0, 999),
      ]);
    if (errA) fallaBd(this.logger, 'kvas.resumen.acometidas', errA);
    if (errP) fallaBd(this.logger, 'kvas.resumen.parques', errP);

    const porAcometida = new Map<string, ResumenParqueKva[]>();
    const sinAcometida: ResumenParqueKva[] = [];
    for (const p of parques ?? []) {
      const fila: ResumenParqueKva = {
        idParque: p.idParque,
        nomParque: p.nomParque,
        idAcometida: p.idAcometida,
        kvasMt: Number(p.kvasMt ?? 0),
        kvasBt: Number(p.kvasBt ?? 0),
        kvasMtDisponibles: Number(p.kvasMtDisponibles ?? 0),
        kvasBtDisponibles: Number(p.kvasBtDisponibles ?? 0),
        kvasMtUtilizados: Number(p.kvasMtUtilizados ?? 0),
        kvasBtUtilizados: Number(p.kvasBtUtilizados ?? 0),
      };
      if (!p.idAcometida) sinAcometida.push(fila);
      else porAcometida.set(p.idAcometida, [...(porAcometida.get(p.idAcometida) ?? []), fila]);
    }

    const acometidas: Acometida[] = (acom ?? []).map((a) => {
      const suyos = porAcometida.get(a.idAcometida) ?? [];
      return {
        idAcometida: a.idAcometida,
        nombre: a.nombre,
        tensionKv: a.tensionKv === null ? null : Number(a.tensionKv),
        capacidadMt: Number(a.capacidadMt ?? 0),
        capacidadBt: Number(a.capacidadBt ?? 0),
        folioCfe: a.folioCfe,
        notas: a.notas,
        repartidoMt: suyos.reduce((s, p) => s + p.kvasMt, 0),
        repartidoBt: suyos.reduce((s, p) => s + p.kvasBt, 0),
        parques: suyos,
      };
    });

    return { acometidas, sinAcometida };
  }

  // ===================== Asignaciones =====================

  /** Asignaciones de un parque (incluye las canceladas, para el histórico). */
  async porParque(idParque: string): Promise<AsignacionKva[]> {
    const { data, error } = await this.supabase.admin
      .from('kvasAsignados')
      .select(this.ASIG_COLS)
      .eq('idParque', idParque)
      .order('fc', { ascending: false })
      .range(0, 4999);
    if (error) fallaBd(this.logger, 'kvas.porParque', error);
    return this.enriquecerConNaves(data ?? []);
  }

  /** Asignaciones de una nave concreta. */
  async porNave(idNave: string): Promise<AsignacionKva[]> {
    const { data, error } = await this.supabase.admin
      .from('kvasAsignados')
      .select(this.ASIG_COLS)
      .eq('idNave', idNave)
      .order('fc', { ascending: false })
      .range(0, 999);
    if (error) fallaBd(this.logger, 'kvas.porNave', error);
    return this.enriquecerConNaves(data ?? []);
  }

  /** Añade la etiqueta y el número de la nave a cada asignación. */
  private async enriquecerConNaves(
    filas: {
      idKvas: string;
      idParque: string;
      idNave: string;
      nivel: string;
      figura: string;
      etapa: string;
      cantKvas: number;
      cantDevuelta: number;
      contratoCfe: string | null;
      fechaContratoCfe: string | null;
      status: boolean;
      fc: string;
    }[],
  ): Promise<AsignacionKva[]> {
    const ids = [...new Set(filas.map((f) => f.idNave))];
    const naves = new Map<string, { nombre: string | null; num: number | null }>();
    if (ids.length > 0) {
      const { data, error } = await this.supabase.admin
        .from('naves')
        .select('idNave, numNaveNAME, numNave')
        .in('idNave', ids);
      if (error) fallaBd(this.logger, 'kvas.enriquecerConNaves', error);
      for (const n of data ?? [])
        naves.set(n.idNave, { nombre: n.numNaveNAME, num: n.numNave });
    }
    return filas.map((f) => ({
      ...f,
      cantKvas: Number(f.cantKvas ?? 0),
      cantDevuelta: Number(f.cantDevuelta ?? 0),
      pendiente: Number(f.cantKvas ?? 0) - Number(f.cantDevuelta ?? 0),
      nave: naves.get(f.idNave)?.nombre ?? null,
      numNave: naves.get(f.idNave)?.num ?? null,
    }));
  }

  /**
   * Crea una asignación. El parque NO se recibe del cliente: se toma de la nave,
   * para que no se pueda descontar capacidad de un parque ajeno.
   */
  async crear(dto: CrearAsignacionDto, actorUid: string): Promise<{ idKvas: string }> {
    const idParque = await this.parqueDeNave(dto.idNave);
    this.validarVinculo(dto.figura, dto.idPropiedad, dto.idNavArrend);

    const { data, error } = await this.supabase
      .comoActor(actorUid)
      .from('kvasAsignados')
      .insert({
        idNave: dto.idNave,
        idParque,
        nivel: dto.nivel,
        figura: dto.figura,
        etapa: dto.etapa,
        cantKvas: dto.cantKvas,
        contratoCfe: dto.contratoCfe ?? null,
        fechaContratoCfe: dto.fechaContratoCfe ?? null,
        idPropiedad: dto.idPropiedad ?? null,
        idNavArrend: dto.idNavArrend ?? null,
        uidr: actorUid,
      })
      .select('idKvas')
      .single();
    if (error) fallaBd(this.logger, 'kvas.crear', error);
    return { idKvas: data!.idKvas };
  }

  /** Edita una asignación viva. Las canceladas no se editan (histórico). */
  async editar(
    idKvas: string,
    dto: EditarAsignacionDto,
    actorUid: string,
  ): Promise<void> {
    const actual = await this.obtener(idKvas);
    if (!actual.status)
      throw new ConflictException('La asignación está cancelada y no se puede editar.');
    if (dto.cantKvas < Number(actual.cantDevuelta))
      throw new BadRequestException(
        `No puedes dejar la asignación en ${dto.cantKvas} KVA: ya hay ${actual.cantDevuelta} devueltos y acreditados.`,
      );
    this.validarVinculo(dto.figura, dto.idPropiedad, dto.idNavArrend);

    const { error } = await this.supabase
      .comoActor(actorUid)
      .from('kvasAsignados')
      .update({
        nivel: dto.nivel,
        figura: dto.figura,
        etapa: dto.etapa,
        cantKvas: dto.cantKvas,
        contratoCfe: dto.contratoCfe ?? null,
        fechaContratoCfe: dto.fechaContratoCfe ?? null,
        idPropiedad: dto.idPropiedad ?? null,
        idNavArrend: dto.idNavArrend ?? null,
      })
      .eq('idKvas', idKvas);
    if (error) fallaBd(this.logger, 'kvas.editar', error);
  }

  /**
   * Cancela una asignación (BAJA LÓGICA con motivo, como el resto del sistema).
   *
   * ⚠️ Cancelar NO devuelve los KVA vendidos al parque: una VENTA solo regresa
   * al pool con una devolución acreditada (`kvaDevoluciones`). En RENTA sí
   * regresan, porque el vínculo terminó.
   */
  async cancelar(idKvas: string, motivo: string, actorUid: string): Promise<void> {
    const actual = await this.obtener(idKvas);
    if (!actual.status)
      throw new ConflictException('La asignación ya estaba cancelada.');

    const { error } = await this.supabase
      .comoActor(actorUid)
      .from('kvasAsignados')
      .update({ status: false, motivoBaja: motivo })
      .eq('idKvas', idKvas);
    if (error) fallaBd(this.logger, 'kvas.cancelar', error);
  }

  // ===================== Devoluciones =====================

  /**
   * Registra la devolución de KVA VENDIDOS con su documento probatorio. Es lo
   * que libera el candado de la nave.
   */
  async registrarDevolucion(
    idKvas: string,
    dto: DevolucionDto,
    archivo: ArchivoValidado,
    actorUid: string,
  ): Promise<{ idDevolucion: string }> {
    const asig = await this.obtener(idKvas);
    if (asig.figura !== 'VENTA')
      throw new BadRequestException(
        'Solo se documenta la devolución de KVA vendidos; los rentados regresan al cerrar el contrato.',
      );
    const pendiente = Number(asig.cantKvas) - Number(asig.cantDevuelta);
    if (dto.cantidad > pendiente)
      throw new BadRequestException(
        `Solo quedan ${pendiente} KVA por devolver en esta asignación.`,
      );

    const ruta = rutaSegura([asig.idParque, idKvas], archivo.ext);
    const { error: errUp } = await this.supabase.admin.storage
      .from(BUCKET_KVA)
      .upload(ruta, archivo.buffer, {
        contentType: archivo.contentType,
        upsert: false,
      });
    if (errUp) fallaBd(this.logger, 'kvas.devolucion.upload', errUp, 'No se pudo subir el documento.');

    const { data, error } = await this.supabase
      .comoActor(actorUid)
      .from('kvaDevoluciones')
      .insert({
        idKvas,
        cantidad: dto.cantidad,
        fechaDevolucion: dto.fechaDevolucion,
        documento: dto.documento,
        urldoc: ruta, // se guarda la RUTA; la URL se firma al leer
        observaciones: dto.observaciones ?? null,
        uidr: actorUid,
      })
      .select('idDevolucion')
      .single();
    if (error) {
      // El archivo ya se subió: se limpia para no dejar huérfanos en el bucket.
      await this.supabase.admin.storage.from(BUCKET_KVA).remove([ruta]);
      fallaBd(this.logger, 'kvas.devolucion.insert', error);
    }
    return { idDevolucion: data!.idDevolucion };
  }

  /** Devoluciones de una asignación, con el documento en URL firmada. */
  async devolucionesDe(idKvas: string) {
    const { data, error } = await this.supabase.admin
      .from('kvaDevoluciones')
      .select('idDevolucion, cantidad, fechaDevolucion, documento, urldoc, observaciones, status, fc')
      .eq('idKvas', idKvas)
      .order('fechaDevolucion', { ascending: false })
      .range(0, 499);
    if (error) fallaBd(this.logger, 'kvas.devolucionesDe', error);

    return Promise.all(
      (data ?? []).map(async (d) => ({
        ...d,
        cantidad: Number(d.cantidad ?? 0),
        urldoc: await this.firmar(d.urldoc),
      })),
    );
  }

  /** URL temporal del documento. El bucket es privado: nunca se expone directo. */
  private async firmar(ruta: string | null): Promise<string | null> {
    if (!ruta) return null;
    const { data } = await this.supabase.admin.storage
      .from(BUCKET_KVA)
      .createSignedUrl(ruta, FIRMA_SEGUNDOS);
    return data?.signedUrl ?? null;
  }

  // ===================== Candado de liberación de nave =====================

  /**
   * KVA VENDIDOS de una nave que todavía no acreditan su devolución al parque.
   *
   * Regla de negocio: al dejar la nave, los KVA vendidos deben regresar al
   * parque y eso se acredita con documento (`kvaDevoluciones`). Mientras quede
   * pendiente, la nave NO se libera. Los RENTADOS no cuentan: regresan solos al
   * cerrar el vínculo.
   *
   * ⚠️ Mira las asignaciones VIVAS y las CANCELADAS: cancelar una venta no
   * devuelve el KVA, así que cancelarla no puede ser la puerta trasera para
   * saltarse el candado.
   */
  async pendientesPorDevolver(
    idNave: string,
  ): Promise<{ nivel: 'MT' | 'BT'; pendiente: number }[]> {
    const { data, error } = await this.supabase.admin
      .from('kvasAsignados')
      .select('nivel, cantKvas, cantDevuelta')
      .eq('idNave', idNave)
      .eq('figura', 'VENTA')
      .range(0, 999);
    if (error) fallaBd(this.logger, 'kvas.pendientesPorDevolver', error);

    const acc = new Map<'MT' | 'BT', number>();
    for (const f of data ?? []) {
      const pend = Number(f.cantKvas ?? 0) - Number(f.cantDevuelta ?? 0);
      if (pend <= 0) continue;
      const nivel = f.nivel as 'MT' | 'BT';
      acc.set(nivel, (acc.get(nivel) ?? 0) + pend);
    }
    return [...acc.entries()].map(([nivel, pendiente]) => ({ nivel, pendiente }));
  }

  /**
   * Lanza 409 con un mensaje de negocio si la nave tiene KVA vendidos sin
   * acreditar. Lo usan `liberarNave` (renta) y `desvincularNave` (venta).
   */
  async exigirKvasDevueltos(idNave: string | null | undefined): Promise<void> {
    if (!idNave) return;
    const pendientes = await this.pendientesPorDevolver(idNave);
    if (pendientes.length === 0) return;

    const detalle = pendientes
      .map((p) => `${p.pendiente} de ${p.nivel === 'MT' ? 'media' : 'baja'} tensión`)
      .join(' y ');
    throw new ConflictException(
      `No se puede liberar la nave: faltan KVA por regresar al parque (${detalle}). ` +
        'Registra la devolución con su documento en Parques → KVA\'s.',
    );
  }

  // ===================== Acometidas =====================

  async crearAcometida(dto: AcometidaDto, actorUid: string): Promise<{ idAcometida: string }> {
    const { data, error } = await this.supabase
      .comoActor(actorUid)
      .from('kvaAcometidas')
      .insert({
        nombre: dto.nombre,
        tensionKv: dto.tensionKv ?? null,
        capacidadMt: dto.capacidadMt,
        capacidadBt: dto.capacidadBt,
        folioCfe: dto.folioCfe ?? null,
        notas: dto.notas ?? null,
        uidr: actorUid,
      })
      .select('idAcometida')
      .single();
    if (error) fallaBd(this.logger, 'kvas.crearAcometida', error);
    return { idAcometida: data!.idAcometida };
  }

  async editarAcometida(
    idAcometida: string,
    dto: AcometidaDto,
    actorUid: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .comoActor(actorUid)
      .from('kvaAcometidas')
      .update({
        nombre: dto.nombre,
        tensionKv: dto.tensionKv ?? null,
        capacidadMt: dto.capacidadMt,
        capacidadBt: dto.capacidadBt,
        folioCfe: dto.folioCfe ?? null,
        notas: dto.notas ?? null,
      })
      .eq('idAcometida', idAcometida);
    if (error) fallaBd(this.logger, 'kvas.editarAcometida', error);
  }

  /** Cuelga (o descuelga, con `null`) un parque de una acometida. */
  async asignarAcometida(
    idParque: string,
    idAcometida: string | null,
    actorUid: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .comoActor(actorUid)
      .from('parques')
      .update({ idAcometida })
      .eq('idParque', idParque);
    if (error) fallaBd(this.logger, 'kvas.asignarAcometida', error);
  }

  // ===================== Helpers =====================

  private async obtener(idKvas: string) {
    const { data, error } = await this.supabase.admin
      .from('kvasAsignados')
      .select('idKvas, idParque, idNave, nivel, figura, cantKvas, cantDevuelta, status')
      .eq('idKvas', idKvas)
      .maybeSingle();
    if (error) fallaBd(this.logger, 'kvas.obtener', error);
    if (!data) throw new NotFoundException('Asignación de KVA no encontrada.');
    return data;
  }

  /** El parque sale de la nave, no del cliente (evita descontar de otro parque). */
  private async parqueDeNave(idNave: string): Promise<string> {
    const { data, error } = await this.supabase.admin
      .from('naves')
      .select('idNave, idParque, status')
      .eq('idNave', idNave)
      .maybeSingle();
    if (error) fallaBd(this.logger, 'kvas.parqueDeNave', error);
    if (!data || data.status === false)
      throw new NotFoundException('La nave no existe o está dada de baja.');
    if (!data.idParque)
      throw new BadRequestException('La nave no pertenece a ningún parque.');
    return data.idParque;
  }

  /** VENTA exige el vínculo de propiedad; RENTA el de arrendamiento. */
  private validarVinculo(
    figura: string,
    idPropiedad?: string | null,
    idNavArrend?: string | null,
  ): void {
    if (figura === 'VENTA' && idNavArrend)
      throw new BadRequestException(
        'Una asignación de venta no puede ligarse a un vínculo de renta.',
      );
    if (figura === 'RENTA' && idPropiedad)
      throw new BadRequestException(
        'Una asignación de renta no puede ligarse a un vínculo de venta.',
      );
  }
}
