import { HistorialPlanService } from './historial-plan.service.js';
import { TraspasosDepositoService } from './traspasos-deposito.service.js';
import { crearSupabaseFalso, type Fila } from './supabase-falso.testing-spec.js';

/**
 * Historial del plan: eventos `traspaso_deposito` y `traspaso_revertido` leídos de
 * `arre_traspasos_deposito` (MontseAI no los cubre). Con 0 traspasos nada cambia.
 */

const UID = '11111111-1111-4111-8111-111111111111';
const UID2 = '44444444-4444-4444-8444-444444444444';
const CLAVE = '22222222-2222-4222-8222-222222222222';

const plan = (id: string, nav: string, ini: string, fin: string): Fila => ({
  idArrePdp: id, idNavArrend: nav, Moneda: 'MXN', fecInicio: ini, fecFin: fin, plazo: 12, status: true,
});

const fila = (id: string, origen: string, destino: string, monto: number, extra: Fila = {}): Fila => ({
  id, seq: Number(id.slice(1)), idArrePdpOrigen: origen, idArrePdpDestino: destino, idDetOrigen: `D${origen}`, idDetDestino: `D${destino}`,
  moneda: 'MXN', monto, marcoPagada: false, fecTraspaso: '2026-10-20', nota: 'Contrato SPH-2025-12', estado: 'aplicado',
  claveIdempotencia: CLAVE, uid: UID, fc: '2026-10-20T18:41:00Z', revertidoPor: null, fecReversion: null, motivoReversion: null, ...extra,
});

const tablas = (traspasos: Fila[]): Record<string, Fila[]> => ({
  arrePdp: [
    plan('PDP_2026', 'NAV12', '2026-10-17', '2027-10-16'),
    plan('PDP_A_2025', 'NAV12', '2025-10-17', '2026-10-16'),
    plan('PDP_B_2025', 'NAV13', '2025-10-17', '2026-10-16'),
  ],
  arrenPropiedades: [
    { idNavArrend: 'NAV12', idNave: 'N12' },
    { idNavArrend: 'NAV13', idNave: 'N13' },
  ],
  naves: [
    { idNave: 'N12', numNave: 12, numNaveNAME: '12', idParque: 'PQ' },
    { idNave: 'N13', numNave: 13, numNaveNAME: '13', idParque: 'PQ' },
  ],
  parques: [{ idParque: 'PQ', nomParque: 'Ocupar 2' }],
  catUsers: [
    { uid: UID, nomCompleto: 'Mónica Echeverry' },
    { uid: UID2, nomCompleto: 'Jereff' },
  ],
  auditoria: [],
  arre_incrementos: [],
  arre_pagos: [],
  notasEntidad: [],
  arrePdpDetalle: [],
  arre_traspasos_deposito: traspasos,
});

function servicio(traspasos: Fila[]) {
  const f = crearSupabaseFalso({ tablas: tablas(traspasos) });
  return { svc: new HistorialPlanService(f.supabase, new TraspasosDepositoService(f.supabase)), ...f };
}

describe('HistorialPlanService (traspasos de depósito)', () => {
  it('sin traspasos no agrega ningún evento', async () => {
    const { svc } = servicio([]);
    const ev = await svc.historial('PDP_2026');
    expect(ev.filter((e) => e.tipo === 'traspaso_deposito' || e.tipo === 'traspaso_revertido')).toHaveLength(0);
  });

  it('destino: UN evento por envío con el total, los orígenes, la nota y el autor', async () => {
    const { svc } = servicio([
      fila('f1', 'PDP_A_2025', 'PDP_2026', 237002.955),
      fila('f2', 'PDP_B_2025', 'PDP_2026', 237002.955, { fc: '2026-10-20T18:41:01Z' }),
    ]);
    const ev = await svc.historial('PDP_2026');
    const t = ev.filter((e) => e.tipo === 'traspaso_deposito');
    expect(t).toHaveLength(1);
    expect(t[0]!.titulo).toBe('Depósito traspasado');
    expect(t[0]!.detalle).toContain('$474,005.91 MXN');
    expect(t[0]!.detalle).toContain('Nave 12 · 17/10/2025 – 16/10/2026');
    expect(t[0]!.detalle).toContain('Nave 13 · 17/10/2025 – 16/10/2026');
    expect(t[0]!.detalle).toContain('Nota: Contrato SPH-2025-12');
    expect(t[0]!.autor).toBe('Mónica Echeverry');
    expect(t[0]!.origen).toBe('auditoria');
  });

  it('origen: evento «traspasado a otro contrato» con el destino', async () => {
    const { svc } = servicio([fila('f1', 'PDP_A_2025', 'PDP_2026', 237002.955)]);
    const ev = await svc.historial('PDP_A_2025');
    const t = ev.filter((e) => e.tipo === 'traspaso_deposito');
    expect(t).toHaveLength(1);
    expect(t[0]!.titulo).toBe('Depósito traspasado a otro contrato');
    expect(t[0]!.detalle).toContain('hacia Nave 12 · 17/10/2026 – 16/10/2027');
  });

  it('reversa: evento propio con motivo, quién y cuándo (además del evento original)', async () => {
    const { svc } = servicio([
      fila('f1', 'PDP_A_2025', 'PDP_2026', 237002.955, {
        estado: 'revertido', revertidoPor: UID2, fecReversion: '2026-10-21T10:00:00Z', motivoReversion: 'Se eligió el contrato equivocado',
      }),
    ]);
    const ev = await svc.historial('PDP_2026');
    const rev = ev.filter((e) => e.tipo === 'traspaso_revertido');
    expect(rev).toHaveLength(1);
    expect(rev[0]!.titulo).toBe('Traspaso revertido');
    expect(rev[0]!.detalle).toContain('Motivo: Se eligió el contrato equivocado');
    expect(rev[0]!.autor).toBe('Jereff');
    expect(ev.filter((e) => e.tipo === 'traspaso_deposito')).toHaveLength(1);
    // más reciente primero: la reversa antecede al traspaso
    expect(ev.findIndex((e) => e.tipo === 'traspaso_revertido')).toBeLessThan(
      ev.findIndex((e) => e.tipo === 'traspaso_deposito'),
    );
  });
});
