import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { fallaBd } from '../../common/utils/db-error.js';
import {
  diasHasta,
  fechaCorteISO,
  inicioMesMxISO,
  leerRepConfig,
  nivelRepPendiente,
  partesMx,
  type RepConfig,
  type RepNivel,
} from './rep-fechas.js';

/** Una parcialidad PPD pagada cuyo Complemento de Pago (REP) sigue pendiente. */
export interface RepPendiente {
  idCxp: string;
  idProveedor: string | null;
  nombreProveedor: string;
  folio: string;
  monto: number;
  fecPago: string;
  /** uid del usuario que solicitó el pago. */
  uidr: string | null;
  /** uid del gerente que autorizó. */
  autorizo: string | null;
  nivel: RepNivel;
  /** Días naturales para el bloqueo del proveedor (0 = hoy, negativo = vencido). */
  diasBloqueoProveedor: number;
  /** Días naturales para el bloqueo del usuario que pagó. */
  diasBloqueoUsuario: number;
}

interface FiltroPendientes {
  /** Solo las parcialidades donde el uid es solicitante o autorizador. */
  uid?: string;
  /** Solo las del mes anterior (universo de los avisos por correo). */
  soloMesAnterior?: boolean;
}

/** Tamaño de página de la lectura (PostgREST corta en 1000 sin `.range()`). */
const PAGINA = 500;

/**
 * Fuente ÚNICA de las parcialidades PPD con REP pendiente. La consumen el
 * scheduler de avisos y el panel del landing.
 *
 * ⛔ El predicado es **idéntico** al de `BloqueoService` a propósito: lo que se
 * avisa y lo que bloquea tienen que ser exactamente lo mismo. Si divergen, el
 * sistema avisaría de algo que no bloquea (ruido) o bloquearía sin haber
 * avisado (el reclamo que originó este módulo).
 */
@Injectable()
export class RepPendientesService {
  private readonly logger = new Logger(RepPendientesService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async config(): Promise<RepConfig> {
    return leerRepConfig(this.supabase.admin);
  }

  async listar(
    filtro: FiltroPendientes = {},
    cfg?: RepConfig,
    hoy: Date = new Date(),
  ): Promise<RepPendiente[]> {
    const conf = cfg ?? (await this.config());
    const filas: RepPendiente[] = [];

    for (let desde = 0; ; desde += PAGINA) {
      let q = this.supabase.admin
        .from('cxp')
        .select(
          'idCxp, idProveedor, nombreProveedor, folio, total, montoAplicado, fecPago, uidr, autorizo',
        )
        .eq('status', true)
        .eq('diferido', true)
        .in('idEstado', [6, 7])
        .is('uuidComplemento', null)
        .eq('complementoExento', false) // las dispensadas no bloquean ni avisan
        .not('fecPago', 'is', null);

      if (filtro.soloMesAnterior) {
        const { anio, mes } = partesMx(hoy);
        q = q
          .gte('fecPago', inicioMesMxISO(anio, mes - 1))
          .lt('fecPago', inicioMesMxISO(anio, mes));
      }
      if (filtro.uid) {
        q = q.or(`uidr.eq.${filtro.uid},autorizo.eq.${filtro.uid}`);
      }

      const { data, error } = await q
        .order('fecPago', { ascending: true })
        .range(desde, desde + PAGINA - 1);
      if (error) fallaBd(this.logger, 'cxp.rep-pendientes.listar', error);

      const lote = data ?? [];
      for (const p of lote) {
        const fecPago = p.fecPago!;
        filas.push({
          idCxp: String(p.idCxp),
          idProveedor: p.idProveedor ?? null,
          nombreProveedor: p.nombreProveedor ?? 'Proveedor sin nombre',
          folio: p.folio ?? '',
          monto: Number(p.montoAplicado || p.total || 0),
          fecPago,
          uidr: p.uidr ?? null,
          autorizo: p.autorizo ?? null,
          nivel: nivelRepPendiente(fecPago, hoy, conf),
          diasBloqueoProveedor: diasHasta(
            fechaCorteISO(fecPago, conf.diaBloqueoProveedor),
            hoy,
          ),
          diasBloqueoUsuario: diasHasta(
            fechaCorteISO(fecPago, conf.diaBloqueoUsuario),
            hoy,
          ),
        });
      }
      if (lote.length < PAGINA) break;
    }

    return filas;
  }

  /** Agrupa por una clave (proveedor / solicitante / gerente), descartando nulos. */
  agrupar(
    filas: RepPendiente[],
    clave: (p: RepPendiente) => string | null,
  ): Map<string, RepPendiente[]> {
    const mapa = new Map<string, RepPendiente[]>();
    for (const p of filas) {
      const k = clave(p);
      if (!k) continue;
      const lista = mapa.get(k);
      if (lista) lista.push(p);
      else mapa.set(k, [p]);
    }
    return mapa;
  }
}
