import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { TablesInsert, TablesUpdate } from '@erp/types';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import type {
  CrearParqueDto,
  EditarParqueDto,
  EditarNaveDto,
  AgregarNavesDto,
} from './parques.schemas.js';

const ID_ALFABETO =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export interface ParqueListado {
  idParque: string;
  nomParque: string | null;
  direccion: string | null;
  kvasAlta: number;
  kvasMedia: number;
  naves: number; // conteo REAL de naves activas del parque
}

export interface ResumenKvas {
  kvasAlta: number;
  kvasMedia: number;
  kvasAltaDisponibles: number;
  kvasMediaDisponibles: number;
  kvasAltaUtilizados: number;
  kvasMediaUtilizados: number;
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
      .select('idParque, nomParque, direccion, kvasAlta, kvasMedia')
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
      kvasAlta: p.kvasAlta,
      kvasMedia: p.kvasMedia,
      naves: conteo.get(p.idParque) ?? 0,
    }));
  }

  /** Resumen de capacidad eléctrica (KVA's) de un parque. */
  async obtenerKvas(idParque: string): Promise<ResumenKvas> {
    const { data, error } = await this.supabase.admin
      .from('parques')
      .select(
        'kvasAlta, kvasMedia, kvasAltaDisponibles, kvasMediaDisponibles, kvasAltaUtilizados, kvasMediaUtilizados',
      )
      .eq('idParque', idParque)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException('Parque no encontrado.');
    return {
      kvasAlta: data.kvasAlta,
      kvasMedia: data.kvasMedia,
      kvasAltaDisponibles: data.kvasAltaDisponibles,
      kvasMediaDisponibles: data.kvasMediaDisponibles,
      kvasAltaUtilizados: data.kvasAltaUtilizados ?? 0,
      kvasMediaUtilizados: data.kvasMediaUtilizados ?? 0,
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
      naves: dto.naves, // cantidad REAL (corrige el bug de v1 que guardaba KVA's Alta)
      kvasAlta: dto.kvasAlta,
      kvasMedia: dto.kvasMedia,
    };
    const { error: errParque } = await db.from('parques').insert(parque);
    if (errParque) {
      this.logger.error(`Error creando parque: ${errParque.message}`);
      throw new InternalServerErrorException('No se pudo crear el parque.');
    }

    // Generación por lote (un solo insert; PostgREST lo ejecuta atómicamente).
    const lote = this.construirLoteNaves(idParque, uid, 0, dto.naves);
    const { error: errNaves } = await db.from('naves').insert(lote);
    if (errNaves) {
      // Compensación: deshacer el parque para no dejarlo sin naves.
      await db.from('parques').delete().eq('idParque', idParque);
      this.logger.error(`Error generando naves: ${errNaves.message}`);
      throw new InternalServerErrorException(
        'No se pudieron generar las naves; se canceló la creación del parque.',
      );
    }

    return { idParque };
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
      kvasAlta: dto.kvasAlta,
      kvasMedia: dto.kvasMedia,
    };
    const { error } = await this.supabase
      .comoActor(uid)
      .from('parques')
      .update(cambios)
      .eq('idParque', idParque);
    if (error) {
      this.logger.error(`Error editando parque ${idParque}: ${error.message}`);
      throw new InternalServerErrorException('No se pudo actualizar el parque.');
    }
  }

  /** Construye un lote de naves "Disponible" con numNave consecutivo a partir
   * de `desde` (exclusivo): desde+1, desde+2, … La etiqueta inicial es el número. */
  private construirLoteNaves(
    idParque: string,
    uid: string,
    desde: number,
    cantidad: number,
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
      .select('idParque, naves')
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
    const lote = this.construirLoteNaves(idParque, uid, desde, dto.cantidad);
    const { error } = await db.from('naves').insert(lote);
    if (error) {
      this.logger.error(`Error agregando naves: ${error.message}`);
      throw new InternalServerErrorException('No se pudieron agregar las naves.');
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
