import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import {
  TIPOS_CAMBIO,
  type CambioChangelog,
  type ChangelogResponse,
  type TipoCambio,
  type VersionChangelog,
} from './changelog.types.js';

/** Forma cruda de una fila de `v2_changelog` tal como llega de Supabase. */
interface FilaChangelog {
  version: string;
  fecha: string;
  titulo: string | null;
  cambios: unknown;
  publicada: boolean;
}

const TIPOS_VALIDOS = new Set<string>(TIPOS_CAMBIO);

/**
 * Changelog del sistema (Configuraciones → Novedades).
 *
 * Lee la tabla NUEVA de v2 `v2_changelog` (objeto propio; no toca nada del sistema
 * viejo). Solo lectura desde la app: el registro de versiones lo hace el agente que
 * desarrolla, proponiendo el INSERT/UPDATE para que el usuario lo aplique (regla 1).
 */
@Injectable()
export class ChangelogService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Devuelve las versiones publicadas, ordenadas de la más reciente a la más
   * antigua por SemVer, y la versión actual del sistema.
   */
  async listar(): Promise<ChangelogResponse> {
    const { data, error } = await this.supabase.admin
      // La tabla es nueva; hasta regenerar @erp/types se accede sin tipar.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from('v2_changelog' as any)
      .select('version, fecha, titulo, cambios, publicada')
      .eq('publicada', true);

    if (error) {
      throw new InternalServerErrorException(
        `No se pudo leer el changelog: ${error.message}`,
      );
    }

    const filas = (data ?? []) as unknown as FilaChangelog[];
    const versiones: VersionChangelog[] = filas
      .map((f) => ({
        version: f.version,
        fecha: f.fecha,
        titulo: f.titulo,
        cambios: this.normalizarCambios(f.cambios),
      }))
      .sort((a, b) => this.compararSemverDesc(a.version, b.version));

    return {
      versionActual: versiones[0]?.version ?? null,
      versiones,
    };
  }

  /** Filtra y tipa los cambios guardados en JSONB, descartando lo malformado. */
  private normalizarCambios(valor: unknown): CambioChangelog[] {
    if (!Array.isArray(valor)) return [];
    return valor
      .filter(
        (c): c is { tipo: string; descripcion: string } =>
          !!c &&
          typeof c === 'object' &&
          typeof (c as { tipo?: unknown }).tipo === 'string' &&
          typeof (c as { descripcion?: unknown }).descripcion === 'string',
      )
      .filter((c) => TIPOS_VALIDOS.has(c.tipo))
      .map((c) => ({ tipo: c.tipo as TipoCambio, descripcion: c.descripcion }));
  }

  /** Comparador SemVer descendente (2.10.0 va antes que 2.9.0). */
  private compararSemverDesc(a: string, b: string): number {
    const [aMaj, aMin, aPat] = this.partesSemver(a);
    const [bMaj, bMin, bPat] = this.partesSemver(b);
    return bMaj - aMaj || bMin - aMin || bPat - aPat;
  }

  private partesSemver(v: string): [number, number, number] {
    const [maj = 0, min = 0, pat = 0] = v
      .split('.')
      .map((n) => Number.parseInt(n, 10) || 0);
    return [maj, min, pat];
  }
}
