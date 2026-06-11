import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';

/** Días tras la aplicación del pago en que, sin complemento (REP), el usuario
 * queda bloqueado para crear cualquier solicitud de pago. */
export const DIAS_BLOQUEO_REP = 15;

/**
 * Candado de Complemento de Pago (REP) para CxP. Antes de permitir crear una
 * solicitud de pago (de cualquier tipo) se verifican dos niveles, derivados de
 * los datos (no hay flag persistente; el bloqueo se levanta solo al subir el REP):
 *  - Nivel 1 (proveedor): si el proveedor tiene una parcialidad PPD pagada sin su
 *    REP, no se admite NINGUNA solicitud de ese proveedor.
 *  - Nivel 2 (usuario): si una parcialidad PPD pagada por el usuario lleva >15
 *    días sin REP, el usuario no puede crear NINGUNA solicitud (de cualquier
 *    proveedor) hasta subirlo.
 * Los usuarios de soporte (`catUsers.isSupport`) se saltan el candado.
 */
@Injectable()
export class BloqueoService {
  constructor(private readonly supabase: SupabaseService) {}

  private async esSoporte(uid: string): Promise<boolean> {
    const { data } = await this.supabase.admin
      .from('catUsers')
      .select('isSupport')
      .eq('uid', uid)
      .maybeSingle();
    return data?.isSupport === true;
  }

  /** Nivel 1: ¿el proveedor tiene alguna parcialidad PPD pagada sin REP? */
  private async proveedorConRepPendiente(idProveedor: string): Promise<boolean> {
    const { data, error } = await this.supabase.admin
      .from('cxp')
      .select('idCxp')
      .eq('status', true)
      .eq('diferido', true)
      .eq('idProveedor', idProveedor)
      .in('idEstado', [6, 7])
      .is('uuidComplemento', null)
      .eq('complementoExento', false) // las dispensadas no bloquean
      .limit(1);
    if (error) throw new InternalServerErrorException(error.message);
    return (data?.length ?? 0) > 0;
  }

  /** Nivel 2: ¿el usuario tiene una parcialidad PPD pagada hace >15 días sin REP? */
  private async usuarioConRepVencido(uidr: string): Promise<boolean> {
    const limite = new Date(
      Date.now() - DIAS_BLOQUEO_REP * 86_400_000,
    ).toISOString();
    const { data, error } = await this.supabase.admin
      .from('cxp')
      .select('idCxp')
      .eq('status', true)
      .eq('diferido', true)
      .eq('uidr', uidr)
      .in('idEstado', [6, 7])
      .is('uuidComplemento', null)
      .eq('complementoExento', false) // las dispensadas no bloquean
      .not('fecPago', 'is', null)
      .lte('fecPago', limite)
      .limit(1);
    if (error) throw new InternalServerErrorException(error.message);
    return (data?.length ?? 0) > 0;
  }

  /**
   * Verifica los candados antes de crear una solicitud de pago. Lanza
   * ForbiddenException (403) con un mensaje claro si procede el bloqueo.
   * `idProveedor` puede ser null (p. ej. devoluciones a inversionista): en ese
   * caso solo aplica el nivel 2.
   */
  async verificar(uidr: string, idProveedor: string | null): Promise<void> {
    if (await this.esSoporte(uidr)) return;

    if (await this.usuarioConRepVencido(uidr)) {
      throw new ForbiddenException(
        'Tiene un complemento de pago (REP) vencido: pasaron más de 15 días de un pago PPD sin subir su complemento. ' +
          'Súbalo en “Solicitudes de Pago PPD” para poder crear nuevas solicitudes de pago.',
      );
    }

    if (idProveedor && (await this.proveedorConRepPendiente(idProveedor))) {
      throw new ForbiddenException(
        'Este proveedor tiene un complemento de pago (REP) pendiente de un pago anterior. ' +
          'Súbalo en “Solicitudes de Pago PPD” antes de generar otra solicitud de pago para este proveedor.',
      );
    }
  }
}
