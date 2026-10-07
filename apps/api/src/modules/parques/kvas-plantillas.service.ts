import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { fallaBd } from '../../common/utils/db-error.js';
import { clavesPermitidas } from './kvas-plantillas.campos.js';
import {
  clavesUsadas,
  contenidoSchema,
  type RestaurarVersionDto,
  type ContenidoPlantilla,
  type CrearPlantillaDto,
  type GuardarPlantillaDto,
  type TipoPlantilla,
} from './kvas-plantillas.schemas.js';

export interface PlantillaResumen {
  idPlantilla: string;
  tipo: TipoPlantilla;
  nombre: string;
  descripcion: string | null;
  versionActual: number;
  status: boolean;
  fc: string;
  fum: string | null;
}

export interface PlantillaDetalle {
  idPlantilla: string;
  tipo: TipoPlantilla;
  nombre: string;
  descripcion: string | null;
  status: boolean;
  versionActual: number;
  contenido: ContenidoPlantilla;
  nota: string | null;
  fcVersion: string;
}

export interface VersionResumen {
  version: number;
  nota: string | null;
  fc: string;
  /** Nombre legible de quien guardó la versión; `null` si no se puede resolver (nunca uuid ni correo). */
  autor: string | null;
}

export interface VersionDetalle extends VersionResumen {
  contenido: ContenidoPlantilla;
}

interface ErrorPg {
  code?: string;
  message?: string;
  details?: string | null;
}

const MAX_LISTA = 200;
const SUFIJO_COPIA = ' (copia)';

/**
 * Plantillas de documentos de KVA's (versión light): crear, guardar (versión nueva),
 * duplicar y dar de baja. Toda escritura pasa por las funciones kva_plantilla_* con
 * `comoActor(uid)` (el actor sale del JWT verificado) y el texto ya llega saneado por Zod.
 *
 * Las tablas nuevas aún no están en `@erp/types`; se usa un cliente sin tipar.
 */
@Injectable()
export class KvasPlantillasService {
  private readonly logger = new Logger(KvasPlantillasService.name);

  constructor(private readonly supabase: SupabaseService) {}

  private lector(): SupabaseClient {
    return this.supabase.admin as unknown as SupabaseClient;
  }

  private actor(uid: string): SupabaseClient {
    return this.supabase.comoActor(uid) as unknown as SupabaseClient;
  }

  // ---------- Lectura ----------

  /** Ver plantillas dadas de baja: solo soporte o quien tenga 730/731 (no basta 721). */
  async exigirVerBajas(uid: string): Promise<void> {
    const { data: perfil } = await this.lector()
      .from('catUsers')
      .select('isSupport')
      .eq('uid', uid)
      .maybeSingle();
    if (perfil?.isSupport === true) return;
    const { data, error } = await this.lector()
      .from('segModulosUsuarios')
      .select('acceso')
      .eq('uid', uid)
      .in('clave', [730, 731])
      .eq('acceso', true)
      .limit(1);
    if (error) fallaBd(this.logger, 'plantillas.exigirVerBajas', error);
    if (!data?.length)
      throw new ForbiddenException('Acceso denegado (permiso 730 o 731) para ver plantillas dadas de baja.');
  }

  async listar(incluirBajas: boolean): Promise<PlantillaResumen[]> {
    let q = this.lector()
      .from('kvaPlantillas')
      .select('idPlantilla, tipo, nombre, descripcion, versionActual, status, fc, fum')
      .order('tipo', { ascending: true })
      .order('nombre', { ascending: true })
      .limit(MAX_LISTA);
    if (!incluirBajas) q = q.eq('status', true);
    const { data, error } = await q;
    if (error) fallaBd(this.logger, 'plantillas.listar', error);
    return (data ?? []) as PlantillaResumen[];
  }

  async obtener(idPlantilla: string): Promise<PlantillaDetalle> {
    const { data: cab, error } = await this.lector()
      .from('kvaPlantillas')
      .select('idPlantilla, tipo, nombre, descripcion, status, versionActual')
      .eq('idPlantilla', idPlantilla)
      .maybeSingle();
    if (error) fallaBd(this.logger, 'plantillas.obtener', error);
    if (!cab) throw new NotFoundException('La plantilla no existe.');

    const { data: ver, error: e2 } = await this.lector()
      .from('kvaPlantillaVersiones')
      .select('contenido, nota, fc')
      .eq('idPlantilla', idPlantilla)
      .eq('version', cab.versionActual)
      .maybeSingle();
    if (e2) fallaBd(this.logger, 'plantillas.obtener.version', e2);
    if (!ver) fallaBd(this.logger, 'plantillas.obtener.version', 'versión vigente sin fila');

    return {
      idPlantilla: cab.idPlantilla,
      tipo: cab.tipo,
      nombre: cab.nombre,
      descripcion: cab.descripcion,
      status: cab.status,
      versionActual: cab.versionActual,
      contenido: ver!.contenido as ContenidoPlantilla,
      nota: ver!.nota,
      fcVersion: ver!.fc,
    };
  }

  /** Nombres legibles por uid (patrón de cxp/aprobacion): sin uuid ni correo como respaldo. */
  private async nombresDe(uids: (string | null)[]): Promise<Map<string, string>> {
    const unicos = [...new Set(uids.filter((x): x is string => !!x))];
    const mapa = new Map<string, string>();
    if (!unicos.length) return mapa;
    const { data, error } = await this.lector()
      .from('catUsers')
      .select('uid, nomCompleto, nombre, apellidos')
      .in('uid', unicos);
    // H-5: sin nombres el historial sigue funcionando (autor = null), pero queda rastro.
    if (error) this.logger.warn(`No se pudieron resolver los autores del historial: ${error.message}`);
    for (const u of (data ?? []) as {
      uid: string;
      nomCompleto: string | null;
      nombre: string | null;
      apellidos: string | null;
    }[]) {
      const n =
        (u.nombre && u.apellidos ? `${u.nombre} ${u.apellidos}` : null) || u.nomCompleto || u.nombre;
      if (n?.trim()) mapa.set(u.uid, n.trim());
    }
    return mapa;
  }

  private async exigirExiste(idPlantilla: string): Promise<void> {
    const { data, error } = await this.lector()
      .from('kvaPlantillas')
      .select('idPlantilla')
      .eq('idPlantilla', idPlantilla)
      .maybeSingle();
    if (error) fallaBd(this.logger, 'plantillas.existe', error);
    if (!data) throw new NotFoundException('La plantilla no existe.');
  }

  /** Historial (sin contenido), de la más reciente a la más antigua. */
  async versiones(idPlantilla: string): Promise<VersionResumen[]> {
    await this.exigirExiste(idPlantilla);
    const { data, error } = await this.lector()
      .from('kvaPlantillaVersiones')
      .select('version, nota, fc, uidr')
      .eq('idPlantilla', idPlantilla)
      .order('version', { ascending: false })
      .limit(MAX_LISTA);
    if (error) fallaBd(this.logger, 'plantillas.versiones', error);
    const filas = (data ?? []) as { version: number; nota: string | null; fc: string; uidr: string | null }[];
    const nombres = await this.nombresDe(filas.map((f) => f.uidr));
    return filas.map((f) => ({
      version: f.version,
      nota: f.nota,
      fc: f.fc,
      autor: f.uidr ? (nombres.get(f.uidr) ?? null) : null,
    }));
  }

  async version(idPlantilla: string, n: number): Promise<VersionDetalle> {
    await this.exigirExiste(idPlantilla);
    const { data, error } = await this.lector()
      .from('kvaPlantillaVersiones')
      .select('version, nota, fc, uidr, contenido')
      .eq('idPlantilla', idPlantilla)
      .eq('version', n)
      .maybeSingle();
    if (error) fallaBd(this.logger, 'plantillas.version', error);
    if (!data) throw new NotFoundException('La versión no existe.');
    const nombres = await this.nombresDe([data.uidr]);
    return {
      version: data.version,
      nota: data.nota,
      fc: data.fc,
      autor: data.uidr ? (nombres.get(data.uidr) ?? null) : null,
      contenido: data.contenido as ContenidoPlantilla,
    };
  }

  /**
   * Restaura una versión anterior creando una versión NUEVA (nunca sobrescribe). El contenido
   * leído de la BD se RE-VALIDA con el esquema actual y el catálogo del tipo (defensa en
   * profundidad) y se guarda por la misma vía que `PUT` (mismos 404/409).
   */
  async restaurar(
    idPlantilla: string,
    dto: RestaurarVersionDto,
    actorUid: string,
  ): Promise<{ version: number }> {
    const { data: cab, error } = await this.lector()
      .from('kvaPlantillas')
      .select('status')
      .eq('idPlantilla', idPlantilla)
      .maybeSingle();
    if (error) fallaBd(this.logger, 'plantillas.restaurar.cab', error);
    if (!cab) throw new NotFoundException('La plantilla no existe.');
    if (!cab.status)
      throw new ConflictException({
        message: { codigo: 'PLANTILLA_DE_BAJA', mensaje: 'La plantilla está dada de baja.' },
      });
    const elegida = await this.version(idPlantilla, dto.version);
    const valido = contenidoSchema.safeParse(elegida.contenido);
    if (!valido.success)
      throw new UnprocessableEntityException({
        message: {
          codigo: 'VERSION_NO_RESTAURABLE',
          mensaje: 'Esa versión ya no cumple las reglas vigentes de contenido y no se puede restaurar.',
        },
      });
    return this.guardar(
      idPlantilla,
      {
        contenido: valido.data,
        versionBase: dto.versionBase,
        nota: dto.nota?.trim() ? dto.nota : `Restaurada desde la versión ${dto.version}`,
      },
      actorUid,
    );
  }

  // ---------- Escritura ----------

  /** 400 `CAMPO_FUERA_DE_CATALOGO` si el contenido usa un campo que el tipo no admite. */
  private exigirCamposDelCatalogo(tipo: TipoPlantilla, contenido: ContenidoPlantilla): void {
    const fuera = clavesUsadas(contenido).filter((c) => !clavesPermitidas(tipo, [c]));
    if (fuera.length)
      throw new BadRequestException({
        message: {
          codigo: 'CAMPO_FUERA_DE_CATALOGO',
          mensaje:
            tipo === 'DEVOLUCION'
              ? 'Este tipo de plantilla aún no admite campos automáticos.'
              : 'La plantilla usa un campo automático que no existe para este tipo.',
        },
      });
  }

  async crear(dto: CrearPlantillaDto, actorUid: string): Promise<{ idPlantilla: string; version: 1 }> {
    this.exigirCamposDelCatalogo(dto.tipo, dto.contenido);
    const { data, error } = await this.actor(actorUid).rpc('kva_plantilla_crear', {
      p_tipo: dto.tipo,
      p_nombre: dto.nombre,
      p_descripcion: dto.descripcion ?? null,
      p_contenido: dto.contenido,
      p_nota: dto.nota ?? null,
    });
    if (error) this.traducir(error, 'plantillas.crear');
    return { idPlantilla: data as string, version: 1 };
  }

  async guardar(
    idPlantilla: string,
    dto: GuardarPlantillaDto,
    actorUid: string,
  ): Promise<{ version: number }> {
    // El tipo sale de la BD (el cliente no lo manda).
    const { data: cab, error: errTipo } = await this.lector()
      .from('kvaPlantillas')
      .select('tipo')
      .eq('idPlantilla', idPlantilla)
      .maybeSingle();
    if (errTipo) fallaBd(this.logger, 'plantillas.guardar.tipo', errTipo);
    if (!cab) throw new NotFoundException('La plantilla no existe.');
    this.exigirCamposDelCatalogo(cab.tipo as TipoPlantilla, dto.contenido);
    const { data, error } = await this.actor(actorUid).rpc('kva_plantilla_guardar', {
      p_id: idPlantilla,
      p_base: dto.versionBase,
      p_nombre: dto.nombre ?? null,
      // null = conservar; '' = vaciar (la función lo normaliza a NULL).
      p_descripcion: dto.descripcion === undefined ? null : (dto.descripcion ?? ''),
      p_contenido: dto.contenido,
      p_nota: dto.nota ?? null,
    });
    if (error) {
      if (error.code === 'KV409' && error.message === 'VERSION_DESACTUALIZADA') {
        const vigente = await this.obtener(idPlantilla);
        throw new ConflictException({
          message: {
            codigo: 'VERSION_DESACTUALIZADA',
            mensaje: 'Otra persona guardó una versión más reciente de esta plantilla.',
            versionActual: vigente.versionActual,
            contenido: vigente.contenido,
          },
        });
      }
      this.traducir(error, 'plantillas.guardar');
    }
    return { version: data as number };
  }

  /** Copia de la versión vigente como plantilla nueva (versión 1), «<nombre> (copia)». */
  async duplicar(idPlantilla: string, actorUid: string): Promise<{ idPlantilla: string }> {
    const origen = await this.obtener(idPlantilla);
    const base = origen.nombre.slice(0, 120 - SUFIJO_COPIA.length - 3);
    for (let n = 1; n <= 20; n++) {
      const nombre = base + (n === 1 ? SUFIJO_COPIA : ` (copia ${n})`);
      const { data, error } = await this.actor(actorUid).rpc('kva_plantilla_crear', {
        p_tipo: origen.tipo,
        p_nombre: nombre,
        p_descripcion: origen.descripcion,
        p_contenido: origen.contenido,
        p_nota: `Copia de «${origen.nombre}» (versión ${origen.versionActual})`.slice(0, 200),
      });
      if (!error) return { idPlantilla: data as string };
      if (!(error.code === 'KV409' && error.message === 'NOMBRE_DUPLICADO'))
        this.traducir(error, 'plantillas.duplicar');
    }
    throw new ConflictException({
      message: { codigo: 'NOMBRE_DUPLICADO', mensaje: 'Ya existen demasiadas copias con ese nombre.' },
    });
  }

  async baja(idPlantilla: string, motivo: string, actorUid: string): Promise<{ ok: true }> {
    const { error } = await this.actor(actorUid).rpc('kva_plantilla_baja', {
      p_id: idPlantilla,
      p_motivo: motivo,
    });
    if (error) this.traducir(error, 'plantillas.baja');
    return { ok: true };
  }

  // ---------- Errores ----------

  /** Traduce los SQLSTATE propios (KVxxx) a respuestas HTTP; el resto es 500 sin filtrar. */
  private traducir(error: ErrorPg, contexto: string): never {
    switch (error.message) {
      case 'NOMBRE_DUPLICADO':
        throw new ConflictException({
          message: {
            codigo: 'NOMBRE_DUPLICADO',
            mensaje: 'Ya existe una plantilla vigente de ese tipo con ese nombre.',
          },
        });
      case 'PLANTILLA_DE_BAJA':
        throw new ConflictException({
          message: { codigo: 'PLANTILLA_DE_BAJA', mensaje: 'La plantilla está dada de baja.' },
        });
      case 'PLANTILLA_NO_EXISTE':
        throw new NotFoundException('La plantilla no existe.');
      case 'SIN_ACTOR':
        throw new BadRequestException('No se pudo identificar al usuario.');
      default:
        return fallaBd(this.logger, contexto, error);
    }
  }
}
