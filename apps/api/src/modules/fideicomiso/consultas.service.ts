import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';

export interface InversionistaTicketOpt {
  idInversionista: string;
  etiqueta: string;
}

export interface PropiedadTicketOpt {
  idPropiedad: string;
  nomDescriptivo: string | null;
}

/**
 * Fideicomiso → Aportaciones (clave 510) y Adhesiones (clave 520). Consultas de
 * solo lectura. En v1, `adhesiones` NO validaba permisos (hueco de seguridad);
 * en v2 ambas exigen su clave server-side. Lee vistas/tablas existentes.
 */
@Injectable()
export class ConsultasService {
  constructor(private readonly supabase: SupabaseService) {}

  // ---------------------------- Aportaciones (510) ----------------------------

  /**
   * Inversionistas con ticket para el selector: `status=true`, `ticket=true` y
   * que **no estén en la papelera** (`pruebas=false`), por razón social.
   * (Papelera = `pruebas=true`; sin este filtro se colaban los archivados.)
   */
  async inversionistasTicket(): Promise<InversionistaTicketOpt[]> {
    const { data, error } = await this.supabase.admin
      .from('inversionista')
      .select('idInversionista, razonsocial, nombre, apellido1, apellido2')
      .eq('status', true)
      .eq('ticket', true)
      .eq('pruebas', false)
      .order('razonsocial', { ascending: true, nullsFirst: false });
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []).map((i) => ({
      idInversionista: i.idInversionista,
      etiqueta:
        (i.razonsocial?.trim()
          ? i.razonsocial
          : [i.nombre, i.apellido1, i.apellido2].filter(Boolean).join(' ')) ||
        i.idInversionista,
    }));
  }

  /** Propiedades-ticket activas de un inversionista. */
  async propiedadesTicket(
    idInversionista: string,
  ): Promise<PropiedadTicketOpt[]> {
    const { data, error } = await this.supabase.admin
      .from('propiedades')
      .select('idPropiedad, nomDescriptivo')
      .eq('idInversionista', idInversionista)
      .eq('esTicket', true)
      .eq('pdpActivo', true);
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []).map((p) => ({
      idPropiedad: p.idPropiedad,
      nomDescriptivo: p.nomDescriptivo,
    }));
  }

  /** Pagos de una propiedad (vista `v_pagos`), ordenados por número de pago. */
  async pagos(idPropiedad: string) {
    const { data, error } = await this.supabase.admin
      .from('v_pagos')
      .select(
        'idPdpDet, numPago, fecha, fecha_pagos, monto, pagos, balance, porcentaje_avance, tipoPago, nomDescriptivo, nomParque, razonsocial, ultimoPago',
      )
      .eq('idPropiedad', idPropiedad)
      .order('numPago', { ascending: true, nullsFirst: false });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  // ----------------------------- Adhesiones (520) -----------------------------

  /** Listado de adhesiones/fideicomisos (vista `v_fideicomiso`). */
  async adhesiones() {
    const { data, error } = await this.supabase.admin
      .from('v_fideicomiso')
      .select(
        'idfide, idPropiedad, idInversionista, noAdhesion, razonsocial, nomDescriptivo, bloque, monto, cantpagos, fecha, rendimiento, Apartado, Medio, PM, comentarios',
      );
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []).sort((a, b) =>
      (a.noAdhesion ?? '').localeCompare(b.noAdhesion ?? '', 'es', {
        numeric: true,
      }),
    );
  }
}
