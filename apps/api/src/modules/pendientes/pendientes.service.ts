import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { fallaBd } from '../../common/utils/db-error.js';
import type {
  CambiarEstadoDto,
  GuardarPendienteDto,
} from './pendientes.schemas.js';
import {
  ESTADOS_ABIERTOS,
  ESTADOS_CERRADOS,
  PESO_URGENCIA,
  type EstadoPendiente,
  type Pendiente,
  type ResumenPendientes,
} from './pendientes.types.js';

/** Tabla nueva de v2; hasta regenerar `@erp/types` se accede sin tipar. */
const TABLA = 'dev_pendientes';

const COLUMNAS =
  'id, titulo, descripcion, notas, origen, tipo, urgencia, estado, modulo, version_resuelto, resuelto_at, fc, fm, creadoPor';

/**
 * Tablero de pendientes: el destino ÚNICO del trabajo pendiente del proyecto.
 *
 * Todas las escrituras van por `comoActor(uid)` para que la auditoría
 * (`trg_auditoria`) registre el QUIÉN real tomado del JWT (regla 6), nunca el
 * service_role anónimo.
 */
@Injectable()
export class TableroPendientesService {
  private readonly logger = new Logger(TableroPendientesService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Sella o limpia `resuelto_at` según el estado destino.
   *
   * Vive en UN solo lugar y lo reusan `guardar` y `cambiarEstado`: si al reabrir
   * un pendiente se quedara el sello, seguiría contando como resuelto en
   * cualquier corte de "qué cerramos este mes".
   */
  private selloResuelto(estado: EstadoPendiente): { resuelto_at: string | null } {
    return {
      resuelto_at: ESTADOS_CERRADOS.includes(estado)
        ? new Date().toISOString()
        : null,
    };
  }

  /**
   * Listado completo. **Sin paginación a propósito:** es el backlog de UN
   * producto (decenas de filas) y el filtrado por columna del front necesita
   * tenerlas todas en memoria. El `.range()` explícito está para no depender del
   * tope por defecto de PostgREST.
   */
  async listar(incluirCerrados: boolean): Promise<{
    filas: Pendiente[];
    resumen: ResumenPendientes;
  }> {
    let q = this.supabase.admin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from(TABLA as any)
      .select(COLUMNAS)
      .range(0, 4999);

    // `.in()` con la lista de abiertos en vez de `not.in`: la sintaxis de
    // PostgREST para negar una lista es fácil de escribir mal y falla en silencio
    // (devolvería TODO, incluido lo cerrado).
    if (!incluirCerrados) q = q.in('estado', ESTADOS_ABIERTOS);

    const { data, error } = await q;
    if (error) fallaBd(this.logger, 'pendientes.listar', error);

    const filas = ((data ?? []) as unknown as Pendiente[]).sort((a, b) => {
      // Primero lo abierto, dentro por urgencia (P0 arriba), luego lo más reciente.
      const ca = ESTADOS_CERRADOS.includes(a.estado) ? 1 : 0;
      const cb = ESTADOS_CERRADOS.includes(b.estado) ? 1 : 0;
      if (ca !== cb) return ca - cb;
      const ua = PESO_URGENCIA[a.urgencia] ?? 9;
      const ub = PESO_URGENCIA[b.urgencia] ?? 9;
      if (ua !== ub) return ua - ub;
      return b.id - a.id;
    });

    const abiertas = filas.filter((f) => !ESTADOS_CERRADOS.includes(f.estado));

    return {
      filas,
      resumen: {
        abiertos: abiertas.length,
        p0: abiertas.filter((f) => f.urgencia === 'p0').length,
        p1: abiertas.filter((f) => f.urgencia === 'p1').length,
        enCurso: abiertas.filter((f) => f.estado === 'en_curso').length,
        bloqueados: abiertas.filter((f) => f.estado === 'bloqueado').length,
      },
    };
  }

  /** Alta y edición: el mismo diálogo del front, el mismo endpoint. */
  async guardar(dto: GuardarPendienteDto, actorUid: string): Promise<Pendiente> {
    const fila = {
      titulo: dto.titulo,
      descripcion: dto.descripcion ?? null,
      notas: dto.notas ?? null,
      origen: dto.origen ?? null,
      modulo: dto.modulo ?? null,
      version_resuelto: dto.versionResuelto ?? null,
      tipo: dto.tipo,
      urgencia: dto.urgencia,
      estado: dto.estado,
      ...this.selloResuelto(dto.estado),
    };

    if (dto.id) {
      const { data, error } = await this.supabase
        .comoActor(actorUid)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from(TABLA as any)
        .update(fila)
        .eq('id', dto.id)
        .select(COLUMNAS)
        .maybeSingle();
      if (error) fallaBd(this.logger, 'pendientes.actualizar', error);
      if (!data) throw new NotFoundException('El pendiente ya no existe.');
      return data as unknown as Pendiente;
    }

    const { data, error } = await this.supabase
      .comoActor(actorUid)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from(TABLA as any)
      .insert({ ...fila, creadoPor: actorUid })
      .select(COLUMNAS)
      .single();
    if (error) fallaBd(this.logger, 'pendientes.crear', error);
    return data as unknown as Pendiente;
  }

  /** Atajo desde la fila del listado (sin abrir el diálogo). */
  async cambiarEstado(
    id: number,
    dto: CambiarEstadoDto,
    actorUid: string,
  ): Promise<Pendiente> {
    const { data, error } = await this.supabase
      .comoActor(actorUid)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from(TABLA as any)
      .update({ estado: dto.estado, ...this.selloResuelto(dto.estado) })
      .eq('id', id)
      .select(COLUMNAS)
      .maybeSingle();
    if (error) fallaBd(this.logger, 'pendientes.cambiarEstado', error);
    if (!data) throw new NotFoundException('El pendiente ya no existe.');
    return data as unknown as Pendiente;
  }

  /**
   * Borrado real. La pantalla propone «Descartado» antes de llegar aquí: marcar
   * conserva el registro, borrar lo pierde. El `trg_auditoria` guarda la fila
   * completa, así que el borrado sigue siendo reconstruible desde `auditoria`.
   */
  async borrar(id: number, actorUid: string): Promise<{ ok: true }> {
    const { error } = await this.supabase
      .comoActor(actorUid)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from(TABLA as any)
      .delete()
      .eq('id', id);
    if (error) fallaBd(this.logger, 'pendientes.borrar', error);
    return { ok: true };
  }
}
