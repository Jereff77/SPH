import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { InvitacionesMailer } from '../invitaciones/invitaciones.mailer.js';

/** Parámetro de SPHConfiguraciones con el uid de la gerencia de Arrendatarios. */
const PARAM_GERENTE = 'ARRE_INPC_GERENTE_UID';

interface FilaCorreo {
  idIncremento: string;
  idParque: string;
  empresa: string;
  parque: string;
  nave: string;
  moneda: string;
  aniversario: string;
  montoActual: number;
  montoNuevo: number;
  pct: number;
}

/**
 * Notificación por correo de los incrementos INPC aplicados. Un solo correo
 * por RESPONSABLE DE PARQUE (con los planes de sus parques) y uno a la
 * GERENTE con TODOS (cubre además los parques sin responsable). Usa la cuenta
 * SMTP dedicada del sistema (`InvitacionesMailer.enviarHtml`, patrón del
 * recordatorio de aprobación CxP). **Best-effort**: si el SMTP falla, los
 * incrementos NO se revierten; queda trazado en `arre_incrementos`
 * (`correoNotificado`/`fecNotificacion`) y se puede reenviar.
 */
@Injectable()
export class IncrementosNotificadorService {
  private readonly logger = new Logger(IncrementosNotificadorService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly mailer: InvitacionesMailer,
  ) {}

  /**
   * Notifica un lote de incrementos aplicados. Devuelve el resumen de envíos
   * (para el informe de la UI). Nunca lanza.
   */
  async notificar(idsIncrementos: string[], opciones?: { esCorreccion?: boolean }) {
    const resumen = { correosEnviados: 0, destinatarios: [] as string[], sinSmtp: false };
    try {
      if (!idsIncrementos.length) return resumen;
      if (!this.mailer.disponible) {
        this.logger.warn('SMTP dedicado no configurado; incrementos sin notificar.');
        return { ...resumen, sinSmtp: true };
      }

      const filas = await this.cargarFilas(idsIncrementos);
      if (!filas.length) return resumen;

      const { porDestinatario, todosLosCorreos } = await this.resolverDestinatarios(filas);
      const esCorreccion = opciones?.esCorreccion ?? false;

      for (const [correo, datos] of porDestinatario) {
        const ok = await this.mailer.enviarHtml(
          correo,
          this.asunto(datos.filas, esCorreccion),
          this.plantilla(datos.nombre, datos.filas, datos.esGerente, esCorreccion),
        );
        if (ok) {
          resumen.correosEnviados++;
          resumen.destinatarios.push(correo);
        }
      }

      // Trazabilidad en la bitácora (a quién se avisó y cuándo)
      if (resumen.correosEnviados > 0) {
        const { error } = await this.supabase.admin
          .from('arre_incrementos')
          .update({
            correoNotificado: resumen.destinatarios,
            fecNotificacion: new Date().toISOString(),
          })
          .in('id', idsIncrementos);
        if (error) this.logger.error(`Trazado de notificación falló: ${error.message}`);
      }
      void todosLosCorreos;
      return resumen;
    } catch (e) {
      this.logger.error(`Notificación de incrementos falló: ${(e as Error).message}`);
      return resumen;
    }
  }

  // ------------------------------ internos ------------------------------

  private async cargarFilas(ids: string[]): Promise<FilaCorreo[]> {
    const { data: incs, error } = await this.supabase.admin
      .from('arre_incrementos')
      .select('id, idArrePdp, inpcAplicado, ptsAplicados, detalle')
      .in('id', ids);
    if (error || !incs?.length) {
      if (error) this.logger.error(`Carga de incrementos falló: ${error.message}`);
      return [];
    }

    const idsPlan = [...new Set(incs.map((i) => i.idArrePdp))];
    const { data: planes, error: pErr } = await this.supabase.admin
      .from('arrePdp')
      .select('idArrePdp, idArrendador, idNavArrend')
      .in('idArrePdp', idsPlan);
    if (pErr || !planes) return [];

    const idsNav = [...new Set(planes.map((p) => p.idNavArrend))];
    const idsArr = [...new Set(planes.map((p) => p.idArrendador))];
    const [propsQ, invQ] = await Promise.all([
      this.supabase.admin
        .from('arrenPropiedades')
        .select('idNavArrend, idParque, idNave')
        .in('idNavArrend', idsNav)
        .eq('status', true),
      this.supabase.admin
        .from('inversionista')
        .select('idInversionista, razonsocial')
        .in('idInversionista', idsArr),
    ]);
    const props = new Map((propsQ.data ?? []).map((r) => [r.idNavArrend, r]));
    const empresas = new Map((invQ.data ?? []).map((r) => [r.idInversionista, r.razonsocial ?? '—']));

    const idsParque = [...new Set([...props.values()].map((r) => r.idParque).filter(Boolean))] as string[];
    const idsNave = [...new Set([...props.values()].map((r) => r.idNave).filter(Boolean))] as string[];
    const [parquesQ, navesQ] = await Promise.all([
      idsParque.length
        ? this.supabase.admin.from('parques').select('idParque, nomParque').in('idParque', idsParque)
        : Promise.resolve({ data: [] } as const),
      idsNave.length
        ? this.supabase.admin.from('naves').select('idNave, numNave, numNaveNAME').in('idNave', idsNave)
        : Promise.resolve({ data: [] } as const),
    ]);
    const parques = new Map((parquesQ.data ?? []).map((r) => [r.idParque, r.nomParque ?? '—']));
    const naves = new Map(
      (navesQ.data ?? []).map((r) => [r.idNave, r.numNaveNAME ?? String(r.numNave ?? '—')]),
    );
    const porPlan = new Map(planes.map((p) => [p.idArrePdp, p]));

    return incs.flatMap((inc) => {
      const plan = porPlan.get(inc.idArrePdp);
      const prop = plan ? props.get(plan.idNavArrend) : undefined;
      if (!plan || !prop?.idParque) return [];
      const det = (inc.detalle ?? {}) as {
        montoActual?: number;
        montoNuevo?: number;
        moneda?: string;
        aniversario?: string;
      };
      return [
        {
          idIncremento: inc.id,
          idParque: prop.idParque,
          empresa: empresas.get(plan.idArrendador) ?? '—',
          parque: parques.get(prop.idParque) ?? '—',
          nave: prop.idNave ? (naves.get(prop.idNave) ?? '—') : '—',
          moneda: det.moneda ?? 'MXN',
          aniversario: det.aniversario ?? '',
          montoActual: Number(det.montoActual ?? 0),
          montoNuevo: Number(det.montoNuevo ?? 0),
          pct: Number(inc.inpcAplicado) + Number(inc.ptsAplicados),
        },
      ];
    });
  }

  private async resolverDestinatarios(filas: FilaCorreo[]) {
    const idsParque = [...new Set(filas.map((f) => f.idParque))];
    const [respQ, gerQ] = await Promise.all([
      this.supabase.admin
        .from('parque_responsables')
        .select('idParque, uid')
        .in('idParque', idsParque),
      this.supabase.admin
        .from('SPHConfiguraciones')
        .select('valor')
        .eq('parametro', PARAM_GERENTE)
        .eq('status', true)
        .maybeSingle(),
    ]);
    const responsables = respQ.data ?? [];
    const gerenteUid = gerQ.data?.valor?.trim() || null;

    const uids = [...new Set([...responsables.map((r) => r.uid), gerenteUid].filter(Boolean))] as string[];
    const { data: users } = uids.length
      ? await this.supabase.admin
          .from('catUsers')
          .select('uid, nomCompleto, email, status')
          .in('uid', uids)
          .eq('status', true)
      : { data: [] as Array<{ uid: string; nomCompleto: string | null; email: string | null; status: boolean }> };
    const porUid = new Map((users ?? []).filter((u) => u.email?.trim()).map((u) => [u.uid, u]));

    /** correo → {nombre, filas, esGerente} — un solo correo por persona. */
    const porDestinatario = new Map<string, { nombre: string; filas: FilaCorreo[]; esGerente: boolean }>();

    // Responsables: los planes de SUS parques
    for (const r of responsables) {
      const u = porUid.get(r.uid);
      if (!u?.email) continue;
      const suyas = filas.filter((f) => f.idParque === r.idParque);
      if (!suyas.length) continue;
      const clave = u.email.trim().toLowerCase();
      const actual = porDestinatario.get(clave);
      if (actual) {
        const idsYa = new Set(actual.filas.map((f) => f.idIncremento));
        actual.filas.push(...suyas.filter((f) => !idsYa.has(f.idIncremento)));
      } else {
        porDestinatario.set(clave, { nombre: u.nomCompleto ?? '', filas: [...suyas], esGerente: false });
      }
    }

    // Gerente: TODO (y si además es responsable, prevalece el correo completo)
    if (gerenteUid) {
      const g = porUid.get(gerenteUid);
      if (g?.email) {
        porDestinatario.set(g.email.trim().toLowerCase(), {
          nombre: g.nomCompleto ?? '',
          filas,
          esGerente: true,
        });
      }
    }

    return { porDestinatario, todosLosCorreos: [...porDestinatario.keys()] };
  }

  private asunto(filas: FilaCorreo[], esCorreccion: boolean): string {
    const n = filas.length;
    return esCorreccion
      ? `Corrección de incremento de renta — ${n} plan(es) re-aplicado(s)`
      : `Incrementos de renta aplicados — ${n} plan(es)`;
  }

  private plantilla(
    nombre: string,
    filas: FilaCorreo[],
    esGerente: boolean,
    esCorreccion: boolean,
  ): string {
    const saludo = nombre ? `Hola ${esc(nombre)},` : 'Hola,';
    const intro = esCorreccion
      ? 'Se <strong>corrigió y re-aplicó</strong> el incremento anual de renta de los siguientes planes'
      : 'Se aplicó el incremento anual de renta (INPC + puntos de contrato) a los siguientes planes';
    const alcance = esGerente ? ' (resumen completo de todos los parques)' : ' de tus parques';
    const filasHtml = filas
      .map(
        (f) => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${esc(f.empresa)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${esc(f.parque)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center">${esc(f.nave)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center">${esc(f.moneda)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right">${dinero(f.montoActual, f.moneda)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center">${f.pct.toFixed(2)}%</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right"><strong>${dinero(f.montoNuevo, f.moneda)}</strong></td>
      </tr>`,
      )
      .join('');
    return `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:720px;margin:0 auto;color:#1f2a4d">
  <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:28px">
    <p style="font-size:16px;margin:0 0 12px">${saludo}</p>
    <p style="font-size:14px;line-height:1.6;color:#374151;margin:0 0 18px">
      ${intro}${alcance}. Montos mensuales <em>sin IVA</em>:
    </p>
    <table style="border-collapse:collapse;width:100%;font-size:13px">
      <thead>
        <tr style="background:#1f2a4d;color:#ffffff">
          <th style="padding:8px 10px;text-align:left">Arrendatario</th>
          <th style="padding:8px 10px;text-align:left">Parque</th>
          <th style="padding:8px 10px">Nave</th>
          <th style="padding:8px 10px">Moneda</th>
          <th style="padding:8px 10px;text-align:right">Renta anterior</th>
          <th style="padding:8px 10px">% aplicado</th>
          <th style="padding:8px 10px;text-align:right">Renta nueva</th>
        </tr>
      </thead>
      <tbody>${filasHtml}</tbody>
    </table>
    <p style="font-size:12px;color:#6b7280;margin:18px 0 0">
      El detalle por concepto y la bitácora completa están en el ERP:
      Arrendatarios → Planes de Renta y Configuraciones → Parámetros → INPC.
    </p>
  </div>
  <p style="text-align:center;font-size:11px;color:#9ca3af;margin:18px 0">
    SPH Bienes Raíces — Mensaje automático, no respondas a este correo.
  </p>
</div>`.trim();
  }
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function dinero(n: number, moneda = 'MXN'): string {
  try {
    return n.toLocaleString('es-MX', { style: 'currency', currency: moneda });
  } catch {
    // Moneda no ISO en datos heredados → formato numérico con etiqueta
    return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${moneda}`;
  }
}
