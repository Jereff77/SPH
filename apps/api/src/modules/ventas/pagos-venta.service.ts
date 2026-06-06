import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import type { RegistrarPagoDto } from './ventas.schemas.js';

const ID_ALFABETO =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** Bucket de comprobantes de pago de ventas (reutiliza el de CxP). */
const BUCKET_COMPROBANTES = 'cxp';

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

    // Subir el comprobante (si llega) al bucket privado.
    let comprobanteUrl: string | null = null;
    if (comprobante) {
      const path = `private/ventas/${det.idPropiedad ?? 'sp'}/${idPago}.${comprobante.ext}`;
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
      comprobanteUrl = this.supabase.admin.storage
        .from(BUCKET_COMPROBANTES)
        .getPublicUrl(path).data.publicUrl;
    }

    const montosiniva = dto.iva > 0 ? dto.monto - dto.iva : dto.monto;

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
      monto: dto.monto,
      iva: dto.iva > 0 ? dto.iva : null,
      montosiniva,
      comprobante: comprobanteUrl,
    });
    if (insErr) {
      this.logger.error(`Error insertando pago de venta: ${insErr.message}`);
      throw new InternalServerErrorException('No se pudo registrar el pago.');
    }

    return { idPago };
  }
}
