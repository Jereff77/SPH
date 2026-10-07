import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { fallaBd } from '../../common/utils/db-error.js';
import type {
  ContenidoPlantilla,
  CrearPlantillaDto,
  GuardarPlantillaDto,
  TipoPlantilla,
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

  // ---------- Escritura ----------

  async crear(dto: CrearPlantillaDto, actorUid: string): Promise<{ idPlantilla: string; version: 1 }> {
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
