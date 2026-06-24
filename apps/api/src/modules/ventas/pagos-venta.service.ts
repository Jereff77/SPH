import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { firmarDocumento } from '../cxp/documentos.util.js';
import type { RegistrarPagoDto } from './ventas.schemas.js';

const ID_ALFABETO =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Bucket de comprobantes de pago de ventas: **`cxp` (PRIVADO)**. Son documentos
 * fiscales: NO se exponen con URL pública. Se guarda el **path** y la lectura
 * (`detallePagos`) genera una **URL firmada temporal** (helper `firmarDocumentos`,
 * patrón de CxP). El histórico de v1 (bucket público `comprobantes`) se firma igual
 * por compatibilidad, sin migrar datos.
 */
const BUCKET_COMPROBANTES = 'cxp';

const TIPO_MOVIMIENTO: Record<number, string> = {
  1: 'Terreno',
  2: 'Construcción',
  3: 'Ticket',
};

const TIPO_OPERACION: Record<number, string> = {
  1: 'Pago',
  2: 'Descuento',
  3: 'Devolución',
};

/** Operación de Devolución: el monto se guarda en negativo (resta del pagado). */
const OPERACION_DEVOLUCION = 3;

const fmt = (n: number | null | undefined) => (n ?? 0).toFixed(2);

type Db = ReturnType<SupabaseService['comoActor']>;

/**
 * Ventas > Dashboard (clave 600): registro de un pago contra una parcialidad
 * (`pdpDetalle`). Inserta en `pagos` con identidad del actor (auditoría). El
 * recálculo de `pdp.montoPagado` lo realiza el trigger existente
 * `pagos_actualizar_montopagado_pdp`. Reemplaza `PagosRealizarWidget` de v1.
 */
@Injectable()
export class PagosVentaService {
  private readonly logger = new Logger(PagosVentaService.name);

  constructor(private readonly supabase: SupabaseService) {}

  private generarId(n = 15): string {
    const bytes = randomBytes(n);
    let id = '';
    for (let i = 0; i < n; i++) id += ID_ALFABETO[bytes[i]! % ID_ALFABETO.length];
    return id;
  }

  async registrarPago(
    idPdpDet: string,
    dto: RegistrarPagoDto,
    comprobante: { buffer: Buffer; ext: string; contentType: string } | null,
    actorUid: string,
  ): Promise<{ idPago: string }> {
    // Resolver el contexto de la parcialidad (idPdp, idPropiedad, numPago).
    const { data: det, error: detErr } = await this.supabase.admin
      .from('pdpDetalle')
      .select('idPdpDet, idPdp, idPropiedad, numPago, status')
      .eq('idPdpDet', idPdpDet)
      .maybeSingle();
    if (detErr) throw new InternalServerErrorException(detErr.message);
    if (!det || det.status === false)
      throw new NotFoundException('Parcialidad no encontrada.');

    if (dto.iva > dto.monto)
      throw new BadRequestException('El IVA no puede ser mayor que el monto.');

    const db = this.supabase.comoActor(actorUid);
    const idPago = this.generarId(15);

    // Subir el comprobante (si llega) al bucket privado y guardar el PATH
    // (no una URL pública: la lectura genera una URL firmada temporal).
    let comprobantePath: string | null = null;
    if (comprobante) {
      const path = `ventas/${det.idPropiedad ?? 'sp'}/${idPago}.${comprobante.ext}`;
      const { error: upErr } = await this.supabase.admin.storage
        .from(BUCKET_COMPROBANTES)
        .upload(path, comprobante.buffer, {
          contentType: comprobante.contentType,
          upsert: true,
        });
      if (upErr) {
        this.logger.error(`Error subiendo comprobante de venta: ${upErr.message}`);
        throw new InternalServerErrorException('No se pudo subir el comprobante.');
      }
      comprobantePath = path;
    }

    // Una Devolución (operación 3) regresa dinero al cliente: se persiste con
    // monto/iva/montosiniva en NEGATIVO. Como todos los consumidores del saldo
    // (trigger pdp.montoPagado, FIFO de vencidos y agregados del dashboard) hacen
    // SUM(monto), el signo negativo lo descuenta del pagado sin tocar la BD.
    // El SIGNO lo decide SIEMPRE la operación, NUNCA el signo que capture el
    // usuario: se toma la MAGNITUD (Math.abs) y se aplica -1 si es Devolución.
    // Así, aun si llegara un monto negativo, una Devolución no puede "voltear" a
    // positivo (−1 × −X = +X) y sumar por error.
    const esDevolucion = dto.tipoOperacion === OPERACION_DEVOLUCION;
    const signo = esDevolucion ? -1 : 1;
    const montoMag = Math.abs(dto.monto);
    const ivaMag = Math.abs(dto.iva);
    const montoFirmado = signo * montoMag;
    const ivaFirmado = ivaMag > 0 ? signo * ivaMag : null;
    const montosiniva = signo * (ivaMag > 0 ? montoMag - ivaMag : montoMag);

    const { error: insErr } = await db.from('pagos').insert({
      idPago,
      uid: actorUid,
      status: true,
      idPdpDet,
      idPdp: det.idPdp,
      idPropiedad: det.idPropiedad,
      numPago: det.numPago,
      tipomovimiento: dto.tipomovimiento,
      tipoOperacion: dto.tipoOperacion,
      fecha: dto.fecha,
      monto: montoFirmado,
      iva: ivaFirmado,
      montosiniva,
      comprobante: comprobantePath,
    });
    if (insErr) {
      this.logger.error(`Error insertando pago de venta: ${insErr.message}`);
      throw new InternalServerErrorException('No se pudo registrar el pago.');
    }

    // Registrar el movimiento (actividad + comentario), como v1.
    const operacionTxt = TIPO_OPERACION[dto.tipoOperacion] ?? 'Pago';
    const comentario = `Se registró ${operacionTxt} Tipo de pago: ${TIPO_MOVIMIENTO[dto.tipomovimiento] ?? dto.tipomovimiento}, Monto: ${fmt(montoFirmado)}, IVA: ${fmt(ivaFirmado ?? 0)}`;
    await this.registrarActividad(db, {
      pantalla: 'RealizarPago',
      widget: 'Button',
      nomwidget: 'Registrar',
      comentario,
      actorUid,
    });
    await this.registrarComentario(db, { idPago, idPdpDet, comentario, actorUid });

    return { idPago };
  }

  /**
   * Adjunta (o reemplaza) el comprobante PDF de un pago **ya registrado**, sin
   * borrarlo ni volverlo a crear. Útil cuando la factura no estaba lista al
   * registrar el pago. Sube al mismo bucket/ruta que `registrarPago`
   * (`private/ventas/{idPropiedad}/{idPago}.{ext}`, upsert) y actualiza
   * `pagos.comprobante`. Auditado vía `comoActor` + `actividad`/`comentarios`.
   */
  async subirComprobante(
    idPago: string,
    comprobante: { buffer: Buffer; ext: string; contentType: string },
    actorUid: string,
  ): Promise<{ comprobante: string }> {
    const { data: pago, error } = await this.supabase.admin
      .from('pagos')
      .select('idPago, idPdpDet, idPropiedad, status')
      .eq('idPago', idPago)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!pago || pago.status === false) throw new NotFoundException('Pago no encontrado.');

    const path = `ventas/${pago.idPropiedad ?? 'sp'}/${idPago}.${comprobante.ext}`;
    const { error: upErr } = await this.supabase.admin.storage
      .from(BUCKET_COMPROBANTES)
      .upload(path, comprobante.buffer, {
        contentType: comprobante.contentType,
        upsert: true,
      });
    if (upErr) {
      this.logger.error(`Error subiendo comprobante de venta: ${upErr.message}`);
      throw new InternalServerErrorException('No se pudo subir el comprobante.');
    }

    const db = this.supabase.comoActor(actorUid);
    // Se guarda el PATH (no una URL pública): la lectura genera la URL firmada.
    const { error: updErr } = await db
      .from('pagos')
      .update({ comprobante: path })
      .eq('idPago', idPago);
    if (updErr) {
      this.logger.error(`Error actualizando comprobante del pago ${idPago}: ${updErr.message}`);
      throw new InternalServerErrorException('No se pudo guardar el comprobante en el pago.');
    }

    const comentario = `Se adjuntó comprobante al pago id:${idPago}`;
    await this.registrarActividad(db, {
      pantalla: 'detallePagos',
      widget: 'Button',
      nomwidget: 'SubirComprobante',
      comentario,
      actorUid,
    });
    await this.registrarComentario(db, { idPago, idPdpDet: pago.idPdpDet, comentario, actorUid });

    // URL firmada temporal (conveniencia; el front igual refresca la lista al subir).
    const firmada = await firmarDocumento(this.supabase.admin, path, BUCKET_COMPROBANTES);
    return { comprobante: firmada ?? path };
  }

  /**
   * Elimina un pago (borrado físico, como v1) y registra el movimiento en
   * `actividad` y `comentarios`. La auditoría (trg_auditoria) y el recálculo de
   * `pdp.montoPagado` se disparan solos por el DELETE. Reemplaza el borrado de
   * `PagosDetalleWidget` de v1.
   */
  async eliminarPago(idPago: string, actorUid: string): Promise<void> {
    const { data: pago, error } = await this.supabase.admin
      .from('pagos')
      .select('idPago, idPdpDet, monto, fecha, status')
      .eq('idPago', idPago)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!pago) throw new NotFoundException('Pago no encontrado.');

    const db = this.supabase.comoActor(actorUid);
    const comentario = `Se elimina pago con id:${pago.idPago}, Monto:${fmt(pago.monto)}, Fecha: ${pago.fecha ?? '-'}`;

    // Registrar el movimiento ANTES del borrado (para no perder el idPdpDet).
    await this.registrarComentario(db, {
      idPago: pago.idPago,
      idPdpDet: pago.idPdpDet,
      comentario,
      actorUid,
    });
    await this.registrarActividad(db, {
      pantalla: 'detallePagos',
      widget: 'icon',
      nomwidget: 'Eliminar',
      comentario,
      actorUid,
    });

    const { error: delErr } = await db.from('pagos').delete().eq('idPago', idPago);
    if (delErr) {
      this.logger.error(`Error eliminando pago ${idPago}: ${delErr.message}`);
      throw new InternalServerErrorException('No se pudo eliminar el pago.');
    }
  }

  /** Inserta un registro en la bitácora de actividad (entorno 3 = web/servidor). */
  private async registrarActividad(
    db: Db,
    a: {
      pantalla: string;
      widget: string;
      nomwidget: string;
      comentario: string;
      actorUid: string;
    },
  ): Promise<void> {
    const { error } = await db.from('actividad').insert({
      uid: a.actorUid,
      entorno: 3,
      logeado: true,
      pantalla: a.pantalla,
      widget: a.widget,
      nomwidget: a.nomwidget,
      comentario: a.comentario,
      version: 'erp-v2',
    });
    if (error) this.logger.warn(`No se pudo registrar actividad: ${error.message}`);
  }

  /** Inserta un comentario ligado al pago/parcialidad (origen 'Ventas' por defecto). */
  private async registrarComentario(
    db: Db,
    c: { idPago: string; idPdpDet: string | null; comentario: string; actorUid: string },
  ): Promise<void> {
    const { error } = await db.from('comentarios').insert({
      idPago: c.idPago,
      idPdpDet: c.idPdpDet,
      comentario: c.comentario,
      uid: c.actorUid,
    });
    if (error) this.logger.warn(`No se pudo registrar comentario: ${error.message}`);
  }
}
