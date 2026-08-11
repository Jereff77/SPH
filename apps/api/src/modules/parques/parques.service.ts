import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { TablesInsert, TablesUpdate } from '@erp/types';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { fallaBd } from '../../common/utils/db-error.js';
import type {
  CrearParqueDto,
  DotacionNaveDto,
  EditarParqueDto,
  EditarNaveDto,
  AgregarNavesDto,
} from './parques.schemas.js';

const ID_ALFABETO =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * La restricción «Σ dotación ≤ capacidad» vive en un trigger de la BD, porque
 * hay cuatro caminos que pueden violarla y basta que uno olvide validar. Cuando
 * salta, su mensaje ya trae los números («Sobran 5.00 KVA»), así que se devuelve
 * como **409 de negocio** en vez de un 500 opaco.
 *
 * Solo se reconoce por el texto de la propia excepción: no se filtra SQL ni
 * detalle interno al cliente.
 */
function traducirErrorDotacion(error: { message?: string }, fallback: string): Error {
  const msg = error?.message ?? '';
  if (/La dotacion de (baja|media)/i.test(msg)) {
    // El RAISE viene sin acentos desde plpgsql; se reponen para la UI.
    return new ConflictException(
      msg.replace('dotacion', 'dotación').replace('capacidad', 'capacidad').trim(),
    );
  }
  return new InternalServerErrorException(fallback);
}

/** Forma de un UUID (para filtrar `auditoria.uid` text antes de cruzar con `catUsers.uid` uuid). */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ParqueListado {
  idParque: string;
  nomParque: string | null;
  direccion: string | null;
  /** Capacidad en MEDIA tensión (antes `kvasAlta`). */
  kvasMt: number;
  /** Capacidad en BAJA tensión (antes `kvasMedia`). */
  kvasBt: number;
  /** KVA que se dan por defecto a cada nave NUEVA de este parque. */
  dotacionMtNave: number;
  dotacionBtNave: number;
  naves: number; // conteo REAL de naves activas del parque
}

/**
 * Capacidad eléctrica de un parque. `Mt` = media tensión, `Bt` = baja tensión.
 * Los *Disponibles* pueden ser NEGATIVOS: un sobregiro es real (el control
 * operativo ya trae -283 en Spartek) y ocultarlo detrás de un 0 haría creer
 * que el parque quedó justo.
 */
export interface ResumenKvas {
  kvasMt: number;
  kvasBt: number;
  kvasMtDisponibles: number;
  kvasBtDisponibles: number;
  kvasMtUtilizados: number;
  kvasBtUtilizados: number;
}

/**
 * Un evento de la trayectoria de una nave (línea de tiempo). Se RECONSTRUYE desde
 * la tabla `auditoria` (llenada por triggers, con el actor del JWT no falsificable),
 * no de una bitácora paralela. Solo campos mostrables — nunca el jsonb crudo.
 */
export interface EventoHistorialNave {
  /** Timestamp del evento (`auditoria.fc`). */
  fecha: string;
  /** Dimensión de la nave a la que pertenece (renta ahora; venta en Fase B). */
  dimension: 'renta' | 'venta';
  /** Etiqueta legible (p. ej. "Liberada de renta"). */
  evento: string;
  /** Contexto: arrendatario, vigencia… (o null). */
  detalle: string | null;
  /** El "por qué" cuando aplica (motivo de baja/cancelación). */
  motivo: string | null;
  /** Quién lo hizo: nombre del actor (del JWT); o el origen si no hay uid. */
  actor: string;
}

/** Fila cruda de auditoría usada internamente por el traductor de eventos. */
interface AudRow {
  fc: string;
  uid: string | null;
  origen: number | null;
  entidad: string;
  accion: string;
  cambios: unknown;
  registro_nuevo: unknown;
  registro_anterior: unknown;
}

/**
 * Módulo Parques. Opera sobre tablas EXISTENTES y COMPARTIDAS con Flutter
 * (escrituras AUTORIZADAS por el cliente): `parques`, `naves`. Lecturas también
 * desde las vistas `v_naves` y `v_disponibilidad`. Las columnas kvas*Utilizados
 * son GENERATED en la BD (no se insertan); los IDs (text) se generan aquí.
 */
@Injectable()
export class ParquesService {
  private readonly logger = new Logger(ParquesService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /** Genera un id alfanumérico de 12 caracteres (equivalente server-side del
   * randomString(12) que v1 generaba en el cliente). */
  private generarId(): string {
    const bytes = randomBytes(12);
    let id = '';
    for (let i = 0; i < 12; i++) {
      id += ID_ALFABETO[bytes[i]! % ID_ALFABETO.length];
    }
    return id;
  }

  // ===================== Parques =====================

  /** Lista de parques activos con el conteo REAL de naves por parque. */
  async listarParques(): Promise<ParqueListado[]> {
    const { data: parques, error } = await this.supabase.admin
      .from('parques')
      .select(
        'idParque, nomParque, direccion, kvasMt, kvasBt, dotacionMtNave, dotacionBtNave',
      )
      .eq('status', true)
      .eq('esTicket', false)
      .order('nomParque', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);

    // Conteo real de naves por parque (corrige la desincronización del campo
    // `parques.naves` heredada de v1).
    const { data: naves, error: errNaves } = await this.supabase.admin
      .from('naves')
      .select('idParque')
      .eq('status', true)
      .eq('esTicket', false);
    if (errNaves) throw new InternalServerErrorException(errNaves.message);

    const conteo = new Map<string, number>();
    for (const n of naves ?? []) {
      if (n.idParque) conteo.set(n.idParque, (conteo.get(n.idParque) ?? 0) + 1);
    }

    return (parques ?? []).map((p) => ({
      idParque: p.idParque,
      nomParque: p.nomParque,
      direccion: p.direccion,
      kvasMt: p.kvasMt,
      kvasBt: p.kvasBt,
      dotacionMtNave: Number(p.dotacionMtNave ?? 0),
      dotacionBtNave: Number(p.dotacionBtNave ?? 0),
      naves: conteo.get(p.idParque) ?? 0,
    }));
  }

  /** Resumen de capacidad eléctrica (KVA's) de un parque. */
  async obtenerKvas(idParque: string): Promise<ResumenKvas> {
    const { data, error } = await this.supabase.admin
      .from('parques')
      .select(
        'kvasMt, kvasBt, kvasMtDisponibles, kvasBtDisponibles, kvasMtUtilizados, kvasBtUtilizados',
      )
      .eq('idParque', idParque)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException('Parque no encontrado.');
    return {
      kvasMt: data.kvasMt,
      kvasBt: data.kvasBt,
      kvasMtDisponibles: data.kvasMtDisponibles,
      kvasBtDisponibles: data.kvasBtDisponibles,
      kvasMtUtilizados: data.kvasMtUtilizados ?? 0,
      kvasBtUtilizados: data.kvasBtUtilizados ?? 0,
    };
  }

  // Columnas de v_naves expuestas al frontend (detalle completo de una nave).
  // `razonsocial` = nombre del DUEÑO (inversionista de la propiedad).
  // `idArrendador` = inversionista que renta la nave (su nombre se resuelve aparte).
  private readonly NAVE_COLS =
    'idNave, idParque, numNave, numNaveNAME, situacion, mza, lote, terreno, construccion, precio, fecEntrega, razonsocial, nomDescriptivo, idArrendador, tienePdp, pdpActivo, fum';

  /**
   * Naves de un parque (vista v_naves) enriquecidas con el NOMBRE del arrendador.
   * En la BD el arrendador es también un registro de `inversionista`
   * (arrenPropiedades.idArrendador -> inversionista.razonsocial), por eso la
   * vista solo trae el id y aquí resolvemos el nombre con una consulta extra.
   */
  async listarNavesDeParque(idParque: string) {
    const { data, error } = await this.supabase.admin
      .from('v_naves')
      .select(this.NAVE_COLS)
      .eq('idParque', idParque)
      .order('numNave', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    const naves = data ?? [];

    const nombres = await this.resolverArrendadores(
      naves.map((n) => n.idArrendador),
    );

    return naves.map((n) => ({
      ...n,
      nomArrendador:
        n.idArrendador && n.idArrendador !== ''
          ? (nombres.get(n.idArrendador) ?? null)
          : null,
    }));
  }

  /** Mapa idArrendador -> razonsocial (desde la tabla inversionista). */
  private async resolverArrendadores(
    ids: (string | null)[],
  ): Promise<Map<string, string>> {
    const unicos = [...new Set(ids.filter((x): x is string => !!x && x !== ''))];
    const mapa = new Map<string, string>();
    if (unicos.length === 0) return mapa;

    const { data, error } = await this.supabase.admin
      .from('inversionista')
      .select('idInversionista, razonsocial')
      .in('idInversionista', unicos);
    if (error) {
      this.logger.error(`Error resolviendo arrendadores: ${error.message}`);
      return mapa;
    }
    for (const a of data ?? []) {
      if (a.razonsocial) mapa.set(a.idInversionista, a.razonsocial);
    }
    return mapa;
  }

  /** Detalle completo de una nave (para el editor; evita sobreescribir campos
   * que la vista de disponibilidad no expone, como precio/fecEntrega). */
  async obtenerNave(idNave: string) {
    const { data, error } = await this.supabase.admin
      .from('v_naves')
      .select(this.NAVE_COLS)
      .eq('idNave', idNave)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException('Nave no encontrada.');
    return data;
  }

  // ===================== Historial / trazabilidad de la nave =====================

  /**
   * Trayectoria de una nave (línea de tiempo) RECONSTRUIDA desde la tabla
   * `auditoria` — que ya registra cada INSERT/UPDATE/DELETE con el actor del JWT
   * (no falsificable), la fecha y el diff. NO se usa una bitácora paralela (eso
   * duplicaría la auditoría). Cubre las dos dimensiones de la nave:
   *  - RENTA: `arrenPropiedades` (por `idNave`) + `arrePdp` (por `idNavArrend`).
   *  - VENTA: `propiedades` (por `idNave`) + `pdp`/`raPdp`/`rgPdp` (por `idPropiedad`).
   *  - `naves` (la nave física).
   * Se traduce cada registro crudo a un evento legible y NO se devuelve el jsonb
   * (puede traer datos sensibles).
   */
  async historialDeNave(idNave: string): Promise<EventoHistorialNave[]> {
    const admin = this.supabase.admin;

    // --- RENTA: vínculos (arrendatario) + planes de la nave ---
    const { data: vinculos, error: vErr } = await admin
      .from('arrenPropiedades')
      .select('idNavArrend, idArrendador')
      .eq('idNave', idNave);
    if (vErr) {
      this.logger.error(`historialDeNave vínculos ${idNave}: ${vErr.message}`);
      throw new InternalServerErrorException('No se pudo cargar el historial de la nave.');
    }
    const idNavArrends = [...new Set((vinculos ?? []).map((v) => v.idNavArrend))];
    let idArrePdps: string[] = [];
    if (idNavArrends.length) {
      const { data: planes, error: pErr } = await admin
        .from('arrePdp')
        .select('idArrePdp')
        .in('idNavArrend', idNavArrends);
      if (pErr) {
        this.logger.error(`historialDeNave planes renta ${idNave}: ${pErr.message}`);
        throw new InternalServerErrorException('No se pudo cargar el historial de la nave.');
      }
      idArrePdps = [...new Set((planes ?? []).map((p) => p.idArrePdp))];
    }

    // --- VENTA: propiedades (inversionista) + planes (pdp/raPdp/rgPdp) de la nave ---
    const { data: props, error: prErr } = await admin
      .from('propiedades')
      .select('idPropiedad, idInversionista')
      .eq('idNave', idNave);
    if (prErr) {
      this.logger.error(`historialDeNave propiedades ${idNave}: ${prErr.message}`);
      throw new InternalServerErrorException('No se pudo cargar el historial de la nave.');
    }
    const idPropiedads = [...new Set((props ?? []).map((p) => p.idPropiedad))];
    let idPdps: string[] = [];
    let idRtaAs: string[] = [];
    let idRtaGs: string[] = [];
    if (idPropiedads.length) {
      const [pdpQ, raQ, rgQ] = await Promise.all([
        admin.from('pdp').select('idPdp').in('idPropiedad', idPropiedads),
        admin.from('raPdp').select('idRtaA').in('idPropiedad', idPropiedads),
        admin.from('rgPdp').select('idRtaG').in('idPropiedad', idPropiedads),
      ]);
      for (const q of [pdpQ, raQ, rgQ])
        if (q.error) {
          this.logger.error(`historialDeNave planes venta ${idNave}: ${q.error.message}`);
          throw new InternalServerErrorException('No se pudo cargar el historial de la nave.');
        }
      idPdps = [...new Set((pdpQ.data ?? []).map((x) => x.idPdp))];
      idRtaAs = [...new Set((raQ.data ?? []).map((x) => x.idRtaA))];
      idRtaGs = [...new Set((rgQ.data ?? []).map((x) => x.idRtaG))];
    }

    // --- Registros de auditoría que tocan la nave (todas las fuentes), en paralelo ---
    const [rNaves, rArren, rArrePdp, rProp, rPdp, rRa, rRg] = await Promise.all([
      this.audDe('naves', [idNave]),
      this.audDe('arrenPropiedades', idNavArrends),
      this.audDe('arrePdp', idArrePdps),
      this.audDe('propiedades', idPropiedads),
      this.audDe('pdp', idPdps),
      this.audDe('raPdp', idRtaAs),
      this.audDe('rgPdp', idRtaGs),
    ]);
    const registros = [...rNaves, ...rArren, ...rArrePdp, ...rProp, ...rPdp, ...rRa, ...rRg];

    // --- Resolver actores (uid → nombre). `auditoria.uid` es text y `catUsers.uid` es
    //     uuid: un uid legacy sin forma de UUID haría fallar el cast del filtro y perdería
    //     TODOS los actores. Se filtran antes y se revisa el error (degrada al fallback). ---
    const uids = [
      ...new Set(
        registros.map((r) => r.uid).filter((x): x is string => !!x && UUID_RE.test(x)),
      ),
    ];
    const nombrePorUid = new Map<string, string>();
    if (uids.length) {
      const { data: us, error: uErr } = await admin
        .from('catUsers')
        .select('uid, nomCompleto')
        .in('uid', uids);
      if (uErr) this.logger.warn(`historialDeNave actores ${idNave}: ${uErr.message}`);
      for (const u of us ?? []) if (u.nomCompleto) nombrePorUid.set(u.uid, u.nomCompleto);
    }

    // --- Resolver clientes: arrendatarios (por idNavArrend) e inversionistas (por
    //     idPropiedad). `resolverArrendadores` sirve para cualquier idInversionista. ---
    const nombreCliente = await this.resolverArrendadores([
      ...(vinculos ?? []).map((v) => v.idArrendador),
      ...(props ?? []).map((p) => p.idInversionista),
    ]);
    const clientePorNavArrend = new Map<string, string | null>(
      (vinculos ?? []).map((v) => [v.idNavArrend, nombreCliente.get(v.idArrendador) ?? null]),
    );
    const clientePorPropiedad = new Map<string, string | null>(
      (props ?? []).map((p) => [p.idPropiedad, nombreCliente.get(p.idInversionista) ?? null]),
    );

    // --- Traducir + ordenar (más reciente primero) ---
    const eventos = registros
      .map((r) =>
        this.traducirEventoNave(r, clientePorNavArrend, clientePorPropiedad, nombrePorUid),
      )
      .filter((e): e is EventoHistorialNave => e !== null);
    eventos.sort((a, b) => b.fecha.localeCompare(a.fecha));
    return eventos;
  }

  /** Lee de `auditoria` los registros de una entidad para una lista de ids (solo lectura). */
  private async audDe(entidad: string, ids: string[]): Promise<AudRow[]> {
    if (!ids.length) return [];
    const { data, error } = await this.supabase.admin
      .from('auditoria')
      .select('fc, uid, origen, entidad, accion, cambios, registro_nuevo, registro_anterior')
      .eq('entidad', entidad)
      .in('id_entidad', ids);
    if (error) {
      this.logger.error(`historialDeNave auditoria ${entidad}: ${error.message}`);
      throw new InternalServerErrorException('No se pudo cargar el historial de la nave.');
    }
    return (data ?? []) as unknown as AudRow[];
  }

  /** Traduce un registro crudo de auditoría a un evento de negocio; null = ruido. */
  private traducirEventoNave(
    r: AudRow,
    clientePorNavArrend: Map<string, string | null>,
    clientePorPropiedad: Map<string, string | null>,
    nombrePorUid: Map<string, string>,
  ): EventoHistorialNave | null {
    const actor = r.uid
      ? (nombrePorUid.get(r.uid) ?? `Usuario ${r.uid.slice(0, 8)}`)
      : r.origen === 1
        ? 'Sistema (v1)'
        : 'Cambio directo en BD';
    const cambios = (r.cambios ?? {}) as Record<
      string,
      { antes: unknown; despues: unknown }
    >;
    const nuevo = (r.registro_nuevo ?? {}) as Record<string, unknown>;
    const anterior = (r.registro_anterior ?? {}) as Record<string, unknown>;
    const evt = (
      dimension: 'renta' | 'venta',
      evento: string,
      detalle: string | null = null,
      motivo: string | null = null,
    ): EventoHistorialNave => ({ fecha: r.fc, dimension, actor, evento, detalle, motivo });

    // ---------- La nave física ----------
    if (r.entidad === 'naves') {
      if (r.accion === 'INSERT') return evt('venta', 'Nave creada');
      if (r.accion === 'UPDATE' && cambios.situacion)
        return evt(
          'venta',
          'Cambio de situación',
          `${String(cambios.situacion.antes)} → ${String(cambios.situacion.despues)}`,
        );
      return null;
    }

    // ---------- RENTA ----------
    if (r.entidad === 'arrenPropiedades') {
      const idNavArrend = (nuevo.idNavArrend ?? anterior.idNavArrend) as string | undefined;
      const cliente = idNavArrend ? (clientePorNavArrend.get(idNavArrend) ?? null) : null;
      if (r.accion === 'INSERT') return evt('renta', 'Vinculada a renta', cliente);
      if (r.accion === 'DELETE') return evt('renta', 'Vínculo de renta eliminado', cliente);
      if (r.accion === 'UPDATE' && cambios.status) {
        if (cambios.status.despues === false)
          return evt('renta', 'Liberada de renta', cliente, (nuevo.motivoBaja as string) ?? null);
        if (cambios.status.despues === true)
          return evt('renta', 'Re-vinculada a renta', cliente);
      }
      return null;
    }
    if (r.entidad === 'arrePdp') {
      if (r.accion === 'INSERT') {
        const vig = nuevo.arrePdpVigente as string | undefined;
        return evt('renta', 'Plan de renta creado', vig ? `vigencia: ${vig}` : null);
      }
      if (r.accion === 'DELETE') return evt('renta', 'Plan de renta eliminado');
      if (r.accion === 'UPDATE') {
        if (cambios.canceladoAnticipado?.despues === true)
          return evt('renta', 'Plan cancelado anticipadamente', null, (nuevo.motivoCancelacion as string) ?? null);
        if (cambios.arrePdpVigente?.despues === 'No')
          return evt('renta', 'Plan de renta finalizado');
      }
      return null;
    }

    // ---------- VENTA ----------
    if (r.entidad === 'propiedades') {
      const idProp = (nuevo.idPropiedad ?? anterior.idPropiedad) as string | undefined;
      const cliente = idProp ? (clientePorPropiedad.get(idProp) ?? null) : null;
      if (r.accion === 'INSERT') return evt('venta', 'Vinculada a venta', cliente);
      if (r.accion === 'DELETE') return evt('venta', 'Vínculo de venta eliminado', cliente);
      if (r.accion === 'UPDATE' && cambios.status) {
        if (cambios.status.despues === false)
          return evt('venta', 'Desvinculada de venta', cliente, (nuevo.motivoBaja as string) ?? null);
        if (cambios.status.despues === true)
          return evt('venta', 'Re-vinculada a venta', cliente);
      }
      return null;
    }
    if (r.entidad === 'pdp') {
      if (r.accion === 'INSERT') return evt('venta', 'Plan de pagos creado');
      if (r.accion === 'DELETE') return evt('venta', 'Plan de pagos eliminado');
      return null;
    }
    if (r.entidad === 'raPdp') {
      if (r.accion === 'INSERT') return evt('venta', 'Renta Administrada creada');
      if (r.accion === 'DELETE') return evt('venta', 'Renta Administrada eliminada');
      return null;
    }
    if (r.entidad === 'rgPdp') {
      if (r.accion === 'INSERT') return evt('venta', 'Renta Garantizada creada');
      if (r.accion === 'DELETE') return evt('venta', 'Renta Garantizada eliminada');
      return null;
    }

    return null;
  }

  /**
   * Crea un parque y genera sus naves en una operación atómica desde el punto de
   * vista del usuario: si la generación de naves falla, se elimina el parque
   * (compensación), de modo que nunca queda un parque a medias.
   */
  async crearParque(dto: CrearParqueDto, uid: string): Promise<{ idParque: string }> {
    const db = this.supabase.comoActor(uid); // escrituras auditadas con el actor
    const idParque = this.generarId();

    const parque: TablesInsert<'parques'> = {
      idParque,
      idUser: uid,
      nomParque: dto.nomParque,
      direccion: dto.direccion,
      naves: dto.naves, // cantidad REAL (corrige el bug de v1 que guardaba KVA's)
      kvasMt: dto.kvasMt,
      kvasBt: dto.kvasBt,
      dotacionMtNave: dto.dotacionMtNave,
      dotacionBtNave: dto.dotacionBtNave,
    };
    const { error: errParque } = await db.from('parques').insert(parque);
    if (errParque) {
      this.logger.error(`Error creando parque: ${errParque.message}`);
      throw new InternalServerErrorException('No se pudo crear el parque.');
    }

    // Generación por lote (un solo insert; PostgREST lo ejecuta atómicamente).
    // ⚠️ Un solo insert también es lo que hace barata la validación de dotación:
    // el trigger es FOR EACH STATEMENT, así que valida una vez, no una por nave.
    const lote = this.construirLoteNaves(idParque, uid, 0, dto.naves, {
      mt: dto.dotacionMtNave,
      bt: dto.dotacionBtNave,
    });
    const { error: errNaves } = await db.from('naves').insert(lote);
    if (errNaves) {
      // Compensación: deshacer el parque para no dejarlo sin naves.
      await db.from('parques').delete().eq('idParque', idParque);
      this.logger.error(`Error generando naves: ${errNaves.message}`);
      // La BD rechaza si `naves × dotación > capacidad`: es un error de negocio,
      // no una falla del servidor, y el mensaje ya viene con los números.
      throw traducirErrorDotacion(
        errNaves,
        'No se pudieron generar las naves; se canceló la creación del parque.',
      );
    }

    return { idParque };
  }

  /**
   * Cambia la dotación de UNA nave: los KVA que le tocan por disposición del
   * parque. Exige permiso 721 (KVA), no 702 (naves) — por eso va en su propio
   * endpoint y no mezclado con el editor de naves.
   *
   * ⛔ Dos validaciones, cada una en su lugar:
   *   - Aquí: no puede quedar por debajo de lo ya entregado a clientes en esa
   *     nave (el dato lo tiene el servicio).
   *   - En la BD: la suma del parque/pool no puede exceder la capacidad (el
   *     trigger, que es el único punto que nadie puede esquivar).
   */
  async editarDotacionNave(
    idNave: string,
    dto: DotacionNaveDto,
    uid: string,
  ): Promise<void> {
    const { data: nave, error: errNave } = await this.supabase.admin
      .from('naves')
      .select('idNave, numNaveNAME')
      .eq('idNave', idNave)
      .maybeSingle();
    if (errNave) fallaBd(this.logger, 'parques.editarDotacionNave.nave', errNave);
    if (!nave) throw new NotFoundException('La nave no existe.');

    const { data: asig, error: errAsig } = await this.supabase.admin
      .from('kvasAsignados')
      .select('nivel, cantKvas, cantDevuelta, figura')
      .eq('idNave', idNave)
      .eq('status', true)
      .range(0, 999);
    if (errAsig) fallaBd(this.logger, 'parques.editarDotacionNave.asignaciones', errAsig);

    const entregado = (nivel: 'MT' | 'BT') =>
      (asig ?? [])
        .filter((a) => a.nivel === nivel)
        .reduce((s, a) => s + Number(a.cantKvas ?? 0) - Number(a.cantDevuelta ?? 0), 0);

    for (const [nivel, nuevo, etiqueta] of [
      ['MT', dto.dotacionMt, 'media'],
      ['BT', dto.dotacionBt, 'baja'],
    ] as const) {
      const ya = entregado(nivel);
      if (nuevo < ya)
        throw new BadRequestException(
          `La nave ya tiene ${ya} KVA de ${etiqueta} entregados a clientes: su dotación no puede quedar en ${nuevo}.`,
        );
    }

    const { error } = await this.supabase
      .comoActor(uid)
      .from('naves')
      .update({ dotacionMt: dto.dotacionMt, dotacionBt: dto.dotacionBt })
      .eq('idNave', idNave);
    if (error)
      throw traducirErrorDotacion(error, 'No se pudo actualizar la dotación de la nave.');
  }

  /** Edita los datos editables del parque (domicilio + KVA's). */
  async editarParque(
    idParque: string,
    dto: EditarParqueDto,
    uid: string,
  ): Promise<void> {
    const cambios: TablesUpdate<'parques'> = {
      idUser: uid,
      direccion: dto.direccion,
      kvasMt: dto.kvasMt,
      kvasBt: dto.kvasBt,
      // Solo afecta a las naves FUTURAS; no re-aplica a las existentes.
      dotacionMtNave: dto.dotacionMtNave,
      dotacionBtNave: dto.dotacionBtNave,
    };
    const { error } = await this.supabase
      .comoActor(uid)
      .from('parques')
      .update(cambios)
      .eq('idParque', idParque);
    if (error) {
      this.logger.error(`Error editando parque ${idParque}: ${error.message}`);
      // Bajar la capacidad por debajo de lo ya dotado lo rechaza el trigger.
      throw traducirErrorDotacion(error, 'No se pudo actualizar el parque.');
    }
  }

  /** Construye un lote de naves "Disponible" con numNave consecutivo a partir
   * de `desde` (exclusivo): desde+1, desde+2, … La etiqueta inicial es el número. */
  private construirLoteNaves(
    idParque: string,
    uid: string,
    desde: number,
    cantidad: number,
    dotacion: { mt: number; bt: number } = { mt: 0, bt: 0 },
  ): TablesInsert<'naves'>[] {
    return Array.from({ length: cantidad }, (_unused, i) => {
      const num = desde + i + 1;
      return {
        idNave: this.generarId(),
        idParque,
        idUser: uid,
        situacion: 'Disponible',
        numNave: num,
        numNaveNAME: String(num),
        terreno: 0,
        construccion: 0,
        precio: 0,
        dotacionMt: dotacion.mt,
        dotacionBt: dotacion.bt,
      };
    });
  }

  /**
   * Agrega naves a un parque YA existente. El consecutivo continúa desde el
   * mayor numNave actual del parque. Actualiza el contador `parques.naves`.
   */
  async agregarNaves(
    idParque: string,
    dto: AgregarNavesDto,
    uid: string,
  ): Promise<{ creadas: number }> {
    const { data: parque, error: errP } = await this.supabase.admin
      .from('parques')
      .select('idParque, naves, dotacionMtNave, dotacionBtNave')
      .eq('idParque', idParque)
      .maybeSingle();
    if (errP) throw new InternalServerErrorException(errP.message);
    if (!parque) throw new NotFoundException('Parque no encontrado.');

    // Mayor numNave actual (para continuar el consecutivo).
    const { data: maxRow } = await this.supabase.admin
      .from('naves')
      .select('numNave')
      .eq('idParque', idParque)
      .order('numNave', { ascending: false })
      .limit(1)
      .maybeSingle();
    const desde = maxRow?.numNave ?? 0;

    const db = this.supabase.comoActor(uid); // escrituras auditadas con el actor
    // Las naves nuevas nacen con la dotación por defecto del parque.
    const lote = this.construirLoteNaves(idParque, uid, desde, dto.cantidad, {
      mt: Number(parque.dotacionMtNave ?? 0),
      bt: Number(parque.dotacionBtNave ?? 0),
    });
    const { error } = await db.from('naves').insert(lote);
    if (error) {
      this.logger.error(`Error agregando naves: ${error.message}`);
      throw traducirErrorDotacion(error, 'No se pudieron agregar las naves.');
    }

    // Mantener el contador informativo del parque al día.
    await db
      .from('parques')
      .update({ naves: (parque.naves ?? 0) + dto.cantidad })
      .eq('idParque', idParque);

    return { creadas: dto.cantidad };
  }

  // ===================== Naves =====================

  /** Edita una nave. Rechaza "Vendida" (esa transición es del módulo Propietarios). */
  async editarNave(
    idNave: string,
    dto: EditarNaveDto,
    uid: string,
  ): Promise<void> {
    // Defensa server-side adicional al enum del schema.
    if ((dto.situacion as string) === 'Vendida') {
      throw new BadRequestException(
        'La situación "Vendida" solo se asigna desde Propietarios.',
      );
    }
    const cambios: TablesUpdate<'naves'> = {
      situacion: dto.situacion,
      numNaveNAME: dto.numNaveName,
      mza: dto.mza,
      lote: dto.lote,
      terreno: dto.terreno,
      construccion: dto.construccion,
      precio: dto.precio,
      fecEntrega: dto.fecEntrega ?? null,
      fum: new Date().toISOString(),
      fumUser: uid,
    };
    const { error } = await this.supabase
      .comoActor(uid)
      .from('naves')
      .update(cambios)
      .eq('idNave', idNave);
    if (error) {
      this.logger.error(`Error editando nave ${idNave}: ${error.message}`);
      throw new InternalServerErrorException('No se pudo actualizar la nave.');
    }
  }

  // ===================== Disponibilidad =====================

  /** Tablero de disponibilidad de un parque (vista v_disponibilidad). */
  async listarDisponibilidad(idParque: string) {
    const { data, error } = await this.supabase.admin
      .from('v_disponibilidad')
      .select(
        'idNave, idParque, nomParque, numNave, numNaveNAME, situacion, mza, lote, terreno, construccion, idPropiedad, idInversionista, nombre',
      )
      .eq('idParque', idParque)
      .order('numNave', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }
}
