import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';

/** Un pago registrado contra una partida (`pagos`). */
export interface PagoRegistrado {
  idPago: string;
  fecha: string | null;
  tipoOperacion: number | null;
  monto: number | null;
  tipomovimiento: number | null;
  comprobante: string | null;
}

/** Un comentario (bitácora) de una partida (vista `v_comentarios`, con el nombre). */
export interface ComentarioPartida {
  fc: string;
  usuario: string | null;
  comentario: string | null;
  idPago: string | null;
}

/**
 * Fideicomiso → Aportaciones (clave 510): operaciones de la pantalla de pagos por
 * partida (icono $ y 💬). Lecturas de `pagos`/`v_comentarios` y alta de comentarios
 * (auditada). El alta/eliminación de pagos se delega en `PagosVentaService` (mismo
 * comportamiento que Ventas), y la edición de fecha de la partida en
 * `EscriturasService` — ambos reutilizados como providers del módulo.
 */
@Injectable()
export class AportacionesService {
  private readonly logger = new Logger(AportacionesService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /** Pagos activos de una partida, ordenados por fecha (como `PagosDetalle` de v1). */
  async pagosDetalle(idPdpDet: string): Promise<PagoRegistrado[]> {
    const { data, error } = await this.supabase.admin
      .from('pagos')
      .select('idPago, fecha, tipoOperacion, monto, tipomovimiento, comprobante')
      .eq('idPdpDet', idPdpDet)
      .eq('status', true)
      .order('fecha', { ascending: true, nullsFirst: false });
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []).map((p) => ({
      idPago: p.idPago,
      fecha: p.fecha,
      tipoOperacion: p.tipoOperacion,
      monto: p.monto,
      tipomovimiento: p.tipomovimiento,
      comprobante: p.comprobante,
    }));
  }

  /** Comentarios de una partida (vista `v_comentarios`), del más antiguo al más nuevo. */
  async comentarios(idPdpDet: string): Promise<ComentarioPartida[]> {
    const { data, error } = await this.supabase.admin
      .from('v_comentarios')
      .select('fc, usuario, comentario, idPago')
      .eq('idPdpDet', idPdpDet)
      .order('fc', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []).map((c) => ({
      fc: c.fc ?? '',
      usuario: c.usuario,
      comentario: c.comentario,
      idPago: c.idPago,
    }));
  }

  /** Agrega un comentario manual a la partida (auditado por `trg_auditoria`). */
  async agregarComentario(
    idPdpDet: string,
    comentario: string,
    actorUid: string,
  ): Promise<{ ok: true }> {
    const db = this.supabase.comoActor(actorUid);
    const { error } = await db
      .from('comentarios')
      .insert({ idPdpDet, comentario, uid: actorUid });
    if (error) {
      this.logger.error(`Error agregando comentario: ${error.message}`);
      throw new InternalServerErrorException('No se pudo agregar el comentario.');
    }
    return { ok: true };
  }
}
