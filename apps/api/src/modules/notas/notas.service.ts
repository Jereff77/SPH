import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { fallaBd } from '../../common/utils/db-error.js';
import {
  NOTAS_ENTIDADES,
  type CambioNota,
  type EntidadNotas,
  type EventoNotas,
  type RefNotas,
} from './notas.config.js';

/** Ventana para agrupar cambios manuales consecutivos del mismo usuario. */
const VENTANA_AGRUPAR_MS = 10 * 60 * 1000;
/** Tope de cambios por aviso agrupado: al alcanzarlo se abre un aviso nuevo. */
const MAX_CAMBIOS_POR_AVISO = 200;
/** Notas devueltas por consulta (las más recientes). */
const LIMITE_LISTADO = 300;

interface NotaRow {
  id: string;
  modulo: string;
  pantalla: string;
  entidadTipo: string;
  entidadId: string;
  tipo: 'usuario' | 'sistema';
  evento: EventoNotas | null;
  texto: string;
  detalle: { cambios?: CambioNota[] } & Record<string, unknown> | null;
  uid: string | null;
  fc: string;
  fa: string;
}

export interface NotaDto {
  id: string;
  tipo: 'usuario' | 'sistema';
  evento: EventoNotas | null;
  texto: string;
  detalle: NotaRow['detalle'];
  /** Persona (autora o quien provocó el cambio); MontseAI firma los avisos. */
  autor: string | null;
  esMia: boolean;
  /** Se puede borrar: nota propia de tipo usuario subida HOY (hora de México). */
  eliminable: boolean;
  fc: string;
  fa: string;
}

/** Fecha (yyyy-MM-dd) en horario de México: define «el mismo día» del borrado. */
const diaMx = (d: Date): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(d);

/**
 * Notas por entidad (chat reutilizable) + avisos automáticos de MontseAI.
 * Tabla `notasEntidad` (solo backend). Ver y escribir exige el permiso del
 * módulo dueño de la entidad (catálogo en `notas.config.ts`).
 */
@Injectable()
export class NotasService {
  private readonly logger = new Logger(NotasService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /** `notasEntidad` es nueva y aún no está en @erp/types: cliente sin tipar, localizado aquí. */
  private tabla(db: unknown) {
    return (db as unknown as SupabaseClient).from('notasEntidad');
  }

  // ----------------------------- Permisos / entidad -----------------------------

  private resolver(ref: Pick<RefNotas, 'modulo' | 'pantalla' | 'entidadTipo'>): EntidadNotas {
    const cfg = NOTAS_ENTIDADES[`${ref.modulo}|${ref.pantalla}|${ref.entidadTipo}`];
    if (!cfg) throw new BadRequestException('Las notas no están habilitadas para esta pantalla.');
    return cfg;
  }

  /** Misma regla que `PermisoGuard`: soporte pasa siempre; si no, la clave debe estar concedida. */
  private async exigirPermiso(uid: string, clave: number): Promise<void> {
    const { data: perfil } = await this.supabase.admin
      .from('catUsers')
      .select('isSupport')
      .eq('uid', uid)
      .maybeSingle();
    if (perfil?.isSupport === true) return;
    const { data, error } = await this.supabase.admin
      .from('segModulosUsuarios')
      .select('acceso')
      .eq('uid', uid)
      .eq('clave', clave)
      .eq('acceso', true)
      .limit(1);
    if (error) fallaBd(this.logger, 'notas.permiso', error);
    if (!data?.length) throw new ForbiddenException(`Acceso denegado (permiso ${clave}).`);
  }

  private async exigirEntidad(cfg: EntidadNotas, entidadId: string): Promise<void> {
    const { count, error } = await (this.supabase.admin as unknown as SupabaseClient)
      .from(cfg.tabla)
      .select(cfg.columna, { count: 'exact', head: true })
      .eq(cfg.columna, entidadId);
    if (error) fallaBd(this.logger, 'notas.entidad', error);
    if (!count) throw new NotFoundException('No se encontró el registro al que pertenecen las notas.');
  }

  // ----------------------------- Lectura / escritura de personas -----------------------------

  async listar(actorUid: string, ref: RefNotas): Promise<NotaDto[]> {
    const cfg = this.resolver(ref);
    await this.exigirPermiso(actorUid, cfg.clave);
    await this.exigirEntidad(cfg, ref.entidadId);

    const { data, error } = await this.tabla(this.supabase.admin)
      .select('*')
      .eq('modulo', ref.modulo)
      .eq('pantalla', ref.pantalla)
      .eq('entidadTipo', ref.entidadTipo)
      .eq('entidadId', ref.entidadId)
      .order('fc', { ascending: false })
      .limit(LIMITE_LISTADO);
    if (error) fallaBd(this.logger, 'notas.listar', error);
    const filas = ((data ?? []) as NotaRow[]).reverse();

    const uids = [...new Set(filas.map((f) => f.uid).filter((u): u is string => !!u))];
    const nombres = new Map<string, string>();
    if (uids.length) {
      const { data: us, error: usErr } = await this.supabase.admin
        .from('catUsers')
        .select('uid, nomCompleto, nombre, apellidos')
        .in('uid', uids);
      if (usErr) fallaBd(this.logger, 'notas.autores', usErr);
      for (const u of us ?? []) {
        nombres.set(
          u.uid,
          u.nomCompleto?.trim() || [u.nombre, u.apellidos].filter(Boolean).join(' ').trim() || 'Usuario',
        );
      }
    }

    const hoy = diaMx(new Date());
    return filas.map((f) => {
      const esMia = !!f.uid && f.uid === actorUid;
      return {
        id: f.id,
        tipo: f.tipo,
        evento: f.evento,
        texto: f.texto,
        detalle: f.detalle,
        autor: f.uid ? (nombres.get(f.uid) ?? 'Usuario') : null,
        esMia,
        eliminable: f.tipo === 'usuario' && esMia && diaMx(new Date(f.fc)) === hoy,
        fc: f.fc,
        fa: f.fa,
      };
    });
  }

  async crear(actorUid: string, ref: RefNotas, texto: string): Promise<{ id: string }> {
    const cfg = this.resolver(ref);
    await this.exigirPermiso(actorUid, cfg.clave);
    await this.exigirEntidad(cfg, ref.entidadId);

    const { data, error } = await this.tabla(this.supabase.comoActor(actorUid))
      .insert({
        modulo: ref.modulo,
        pantalla: ref.pantalla,
        entidadTipo: ref.entidadTipo,
        entidadId: ref.entidadId,
        tipo: 'usuario',
        texto,
        uid: actorUid,
      })
      .select('id')
      .single();
    if (error || !data) fallaBd(this.logger, 'notas.crear', error);
    return { id: (data as { id: string }).id };
  }

  /** Borra una nota PROPIA de tipo usuario, solo el mismo día (hora de México) en que se subió. */
  async eliminar(actorUid: string, idNota: string): Promise<void> {
    const { data, error } = await this.tabla(this.supabase.admin)
      .select('*')
      .eq('id', idNota)
      .maybeSingle();
    if (error) fallaBd(this.logger, 'notas.eliminar.carga', error);
    const nota = data as NotaRow | null;
    if (!nota) throw new NotFoundException('La nota no existe o ya fue eliminada.');

    await this.exigirPermiso(actorUid, this.resolver(nota).clave);

    if (nota.tipo !== 'usuario')
      throw new ForbiddenException('Los avisos de MontseAI no se pueden eliminar.');
    if (nota.uid !== actorUid)
      throw new ForbiddenException('Solo puedes eliminar tus propias notas.');
    if (diaMx(new Date(nota.fc)) !== diaMx(new Date()))
      throw new ForbiddenException('Una nota solo se puede eliminar el mismo día en que la subiste.');

    const { error: delErr } = await this.tabla(this.supabase.comoActor(actorUid))
      .delete()
      .eq('id', idNota)
      .eq('uid', actorUid)
      .eq('tipo', 'usuario');
    if (delErr) fallaBd(this.logger, 'notas.eliminar', delErr);
  }

  // ----------------------------- MontseAI (avisos automáticos) -----------------------------

  /**
   * Aviso de MontseAI (plantilla fija, sin llamar al modelo de IA). BEST-EFFORT:
   * el cambio que lo origina ya ocurrió; si el aviso falla se registra en el log
   * y NUNCA se propaga el error. `actorUid` sale del JWT de quien hizo el cambio.
   */
  async avisar(
    ref: RefNotas,
    a: { evento: Exclude<EventoNotas, 'cambio_manual'>; texto: string; detalle?: Record<string, unknown> },
    actorUid: string,
  ): Promise<void> {
    try {
      const { error } = await this.tabla(this.supabase.comoActor(actorUid)).insert({
        ...ref,
        tipo: 'sistema',
        evento: a.evento,
        texto: a.texto,
        detalle: a.detalle ?? null,
        uid: actorUid,
      });
      if (error) this.logger.warn(`No se pudo registrar el aviso (${a.evento}): ${error.message}`);
    } catch (e) {
      this.logger.warn(`No se pudo registrar el aviso (${a.evento}): ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /**
   * Aviso de «cambio manual al plan», AGRUPADO: si la última nota de la entidad es
   * un aviso de cambio manual del MISMO usuario con menos de 10 min, se anexa el
   * cambio a ese mismo mensaje (se actualiza, no se duplica); si no, se abre uno.
   * Best-effort (igual que `avisar`).
   */
  async avisarCambioManual(ref: RefNotas, cambio: CambioNota, actorUid: string): Promise<void> {
    try {
      const db = this.supabase.comoActor(actorUid);
      const abrirAviso = async () => {
        const { error } = await this.tabla(db).insert({
          ...ref,
          tipo: 'sistema',
          evento: 'cambio_manual',
          texto: textoResumen(1),
          detalle: { cambios: [cambio] },
          uid: actorUid,
        });
        if (error) throw new Error(error.message);
      };

      // Anexo con control optimista: el UPDATE solo aplica si `fa` sigue siendo el
      // que se leyó. Si otro cambio simultáneo se coló, se relee y se reintenta, así
      // ningún cambio pisa a otro. Agotados los intentos se abre un aviso propio.
      for (let intento = 0; intento < 3; intento++) {
        const { data: ult, error: ultErr } = await this.tabla(this.supabase.admin)
          .select('id, tipo, evento, uid, fa, detalle')
          .eq('modulo', ref.modulo)
          .eq('pantalla', ref.pantalla)
          .eq('entidadTipo', ref.entidadTipo)
          .eq('entidadId', ref.entidadId)
          .order('fc', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (ultErr) throw new Error(ultErr.message);

        const u = ult as Pick<NotaRow, 'id' | 'tipo' | 'evento' | 'uid' | 'fa' | 'detalle'> | null;
        const previos = Array.isArray(u?.detalle?.cambios) ? u.detalle.cambios : [];
        const agrupable =
          !!u &&
          u.tipo === 'sistema' &&
          u.evento === 'cambio_manual' &&
          u.uid === actorUid &&
          Date.now() - new Date(u.fa).getTime() < VENTANA_AGRUPAR_MS &&
          previos.length < MAX_CAMBIOS_POR_AVISO; // al llegar al tope se abre un aviso nuevo
        if (!agrupable || !u) return await abrirAviso();

        const cambios = [...previos, cambio];
        const { data: act, error } = await this.tabla(db)
          .update({ texto: textoResumen(cambios.length), detalle: { cambios }, fa: new Date().toISOString() })
          .eq('id', u.id)
          .eq('fa', u.fa)
          .select('id');
        if (error) throw new Error(error.message);
        if ((act as unknown[] | null)?.length) return;
      }
      await abrirAviso();
    } catch (e) {
      this.logger.warn(`No se pudo registrar el aviso de cambio manual: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

const textoResumen = (n: number): string => (n === 1 ? '1 cambio manual' : `${n} cambios manuales`);
