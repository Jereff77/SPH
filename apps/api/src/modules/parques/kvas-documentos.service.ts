import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { fallaBd } from '../../common/utils/db-error.js';
import { KvasPlantillasService } from './kvas-plantillas.service.js';
import { clavesUsadas, type ContenidoPlantilla } from './kvas-plantillas.schemas.js';
import { clavesPermitidas } from './kvas-plantillas.campos.js';
import type { VistaPreviaDto } from './kvas-documentos.schemas.js';
import {
  compararEtiqueta,
  resolverCampos,
  resolverTodo,
  type Advertencia,
  type CamposResueltos,
  type NaveSeleccionada,
  type NodoDoc,
} from './kvas-redaccion.js';

export interface EmpresaElegible {
  idInversionista: string;
  razonsocial: string;
  totalNaves: number;
}

export interface NaveElegible {
  idNave: string;
  numNave: string;
  idParque: string;
  nomParque: string;
  rol: 'INVERSIONISTA' | 'ARRENDATARIO' | 'AMBOS';
  dotacionBt: number | null;
  dotacionMt: number | null;
}

export interface VistaPreviaRespuesta {
  contenido: {
    encabezado: unknown;
    cuerpo: unknown;
    pie: unknown;
    logoAncho?: number;
  };
  advertencias: Advertencia[];
  resueltos: CamposResueltos;
}

interface FilaElegible {
  idInversionista: string;
  idNave: string;
  rol: NaveElegible['rol'];
}

interface FilaNave {
  idNave: string;
  numNave: number | null;
  numNaveNAME: string | null;
  idParque: string;
  dotacionBt: number | null;
  dotacionMt: number | null;
}

const TROZO = 100;

const aNumero = (v: unknown): number | null =>
  v === null || v === undefined ? null : Number.isFinite(Number(v)) ? Number(v) : null;

/**
 * Generar documento de KVA's · Fase 2 (SOLO LECTURA: no escribe en la BD).
 * El candado de pertenencia usa `kva_naves_elegibles` (por `rpc`, parámetros, nunca SQL
 * concatenado); la plantilla se lee de la BD (el cliente solo manda `idPlantilla`).
 */
@Injectable()
export class KvasDocumentosService {
  private readonly logger = new Logger(KvasDocumentosService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly plantillas: KvasPlantillasService,
  ) {}

  private db(): SupabaseClient {
    return this.supabase.admin as unknown as SupabaseClient;
  }

  private async elegibles(idInversionista?: string): Promise<FilaElegible[]> {
    const q = idInversionista
      ? this.db().rpc('kva_naves_elegibles', { p_id_inversionista: idInversionista })
      : this.db().rpc('kva_naves_elegibles');
    const { data, error } = await q.range(0, 9999);
    if (error) fallaBd(this.logger, 'kvasDocumentos.elegibles', error);
    return (data ?? []) as FilaElegible[];
  }

  private async nombresEmpresas(ids: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    for (let i = 0; i < ids.length; i += TROZO) {
      const { data, error } = await this.db()
        .from('inversionista')
        .select('idInversionista, razonsocial, NomComercial, nombre')
        .in('idInversionista', ids.slice(i, i + TROZO));
      if (error) fallaBd(this.logger, 'kvasDocumentos.empresas.nombres', error);
      for (const t of (data ?? []) as {
        idInversionista: string;
        razonsocial: string | null;
        NomComercial: string | null;
        nombre: string | null;
      }[]) {
        const nombre = t.razonsocial?.trim() || t.NomComercial?.trim() || t.nombre?.trim();
        if (nombre) out.set(t.idInversionista, nombre);
      }
    }
    return out;
  }

  private async datosNaves(ids: string[]): Promise<{
    naves: Map<string, FilaNave>;
    parques: Map<string, string>;
  }> {
    const naves = new Map<string, FilaNave>();
    for (let i = 0; i < ids.length; i += TROZO) {
      const { data, error } = await this.db()
        .from('naves')
        .select('idNave, numNave, numNaveNAME, idParque, dotacionBt, dotacionMt')
        .in('idNave', ids.slice(i, i + TROZO));
      if (error) fallaBd(this.logger, 'kvasDocumentos.naves', error);
      for (const n of (data ?? []) as FilaNave[]) naves.set(n.idNave, n);
    }
    const idsParque = [...new Set([...naves.values()].map((n) => n.idParque))];
    const parques = new Map<string, string>();
    for (let i = 0; i < idsParque.length; i += TROZO) {
      const { data, error } = await this.db()
        .from('parques')
        .select('idParque, nomParque')
        .in('idParque', idsParque.slice(i, i + TROZO));
      if (error) fallaBd(this.logger, 'kvasDocumentos.parques', error);
      for (const p of (data ?? []) as { idParque: string; nomParque: string }[])
        parques.set(p.idParque, p.nomParque);
    }
    return { naves, parques };
  }

  private etiqueta(n: FilaNave): string {
    return n.numNaveNAME?.trim() || (n.numNave !== null ? String(n.numNave) : n.idNave);
  }

  // ---------- Lectura ----------

  async empresas(): Promise<EmpresaElegible[]> {
    const filas = await this.elegibles();
    const cuenta = new Map<string, number>();
    for (const f of filas) cuenta.set(f.idInversionista, (cuenta.get(f.idInversionista) ?? 0) + 1);
    const nombres = await this.nombresEmpresas([...cuenta.keys()]);
    return [...cuenta.entries()]
      .filter(([id]) => nombres.has(id))
      .map(([id, total]) => ({ idInversionista: id, razonsocial: nombres.get(id)!, totalNaves: total }))
      .sort((a, b) => a.razonsocial.localeCompare(b.razonsocial, 'es', { sensitivity: 'base' }));
  }

  async navesDeEmpresa(idInversionista: string): Promise<NaveElegible[]> {
    const filas = await this.elegibles(idInversionista);
    if (!filas.length) throw new NotFoundException('La empresa no existe o no tiene naves elegibles.');
    const { naves, parques } = await this.datosNaves(filas.map((f) => f.idNave));
    const out: NaveElegible[] = [];
    for (const f of filas) {
      const n = naves.get(f.idNave);
      if (!n) continue;
      out.push({
        idNave: n.idNave,
        numNave: this.etiqueta(n),
        idParque: n.idParque,
        nomParque: parques.get(n.idParque) ?? n.idParque,
        rol: f.rol,
        dotacionBt: aNumero(n.dotacionBt),
        dotacionMt: aNumero(n.dotacionMt),
      });
    }
    return out.sort(
      (a, b) =>
        a.nomParque.localeCompare(b.nomParque, 'es', { sensitivity: 'base' }) ||
        a.idParque.localeCompare(b.idParque) ||
        compararEtiqueta(a.numNave, b.numNave) ||
        a.idNave.localeCompare(b.idNave),
    );
  }

  // ---------- Vista previa ----------

  async vistaPrevia(dto: VistaPreviaDto): Promise<VistaPreviaRespuesta> {
    // 1) Plantilla: de la BD (404 si no existe); de baja → 409.
    const plantilla = await this.plantillas.obtener(dto.idPlantilla);
    if (!plantilla.status)
      throw new ConflictException({
        message: { codigo: 'PLANTILLA_DE_BAJA', mensaje: 'La plantilla está dada de baja.' },
      });
    const contenido: ContenidoPlantilla = plantilla.contenido;
    if (!clavesPermitidas(plantilla.tipo, clavesUsadas(contenido)))
      throw new UnprocessableEntityException({
        message: {
          codigo: 'PLANTILLA_SIN_CAMPOS',
          mensaje: 'Esta plantilla trae campos que su tipo no admite.',
        },
      });

    // 2) Empresa (404) y candado: TODAS las naves deben pertenecer a la empresa.
    const nombres = await this.nombresEmpresas([dto.idInversionista]);
    const empresa = nombres.get(dto.idInversionista);
    if (!empresa) throw new NotFoundException('La empresa no existe.');
    const elegibles = new Set((await this.elegibles(dto.idInversionista)).map((f) => f.idNave));
    if (dto.naves.some((n) => !elegibles.has(n.idNave)))
      throw new UnprocessableEntityException({
        message: {
          codigo: 'NAVE_NO_ELEGIBLE',
          mensaje: 'Una o más naves no pertenecen a la empresa seleccionada.',
        },
      });

    // 3) Datos reales de las naves (el cliente no manda números ni parques).
    const { naves: filas, parques } = await this.datosNaves(dto.naves.map((n) => n.idNave));
    const seleccion: NaveSeleccionada[] = [];
    for (const n of dto.naves) {
      const f = filas.get(n.idNave);
      if (!f)
        throw new UnprocessableEntityException({
          message: {
            codigo: 'NAVE_NO_ELEGIBLE',
            mensaje: 'Una o más naves no pertenecen a la empresa seleccionada.',
          },
        });
      seleccion.push({
        idNave: f.idNave,
        numNave: this.etiqueta(f),
        idParque: f.idParque,
        nomParque: parques.get(f.idParque) ?? f.idParque,
        kvas: n.kvas,
        dotacionBt: aNumero(f.dotacionBt),
        dotacionMt: aNumero(f.dotacionMt),
      });
    }

    // 4) Redacción y sustitución de campos.
    const { resueltos, advertencias } = resolverTodo(empresa, seleccion);
    const mapa: Record<string, string> = { ...resueltos };
    const resolver = (z: unknown): unknown => resolverCampos(z as NodoDoc, mapa);
    const salida: VistaPreviaRespuesta['contenido'] = {
      encabezado: resolver(contenido.encabezado),
      cuerpo: resolver(contenido.cuerpo),
      pie: resolver(contenido.pie),
    };
    if (contenido.logoAncho !== undefined) salida.logoAncho = contenido.logoAncho;
    return { contenido: salida, advertencias, resueltos };
  }
}
