import { ReportesArreService } from './reportes-arre.service.js';
import { TraspasosDepositoService } from './traspasos-deposito.service.js';
import { crearSupabaseFalso, type Fila } from './supabase-falso.testing-spec.js';

/**
 * Estado de cuenta (D14): el renglón 0 explica el traspaso en la columna Nota que ya existe y
 * la cabecera suma «Traspasado» / «Depósito por cobrar». Con 0 traspasos la respuesta es la
 * de siempre (sin campos nuevos).
 */

const UID = '11111111-1111-4111-8111-111111111111';
const CLAVE = '22222222-2222-4222-8222-222222222222';

const plan = (id: string, nav: string, ini: string, fin: string, deposito: number): Fila => ({
  idArrePdp: id, idNavArrend: nav, idArrendador: 'TOK', fecInicio: ini, fecFin: fin, plazo: 12, deposito,
  precioM2: 62.5, construccionM2: 1150, pm2Admin: 4, pm2Mtto: 3.5, pm2Vig: 2, INPCPlus: 0, Moneda: 'MXN',
  arrePdpVigente: 'Si', canceladoAnticipado: false, status: true,
});

const partida = (id: string, planId: string, num: number, concepto: string, cantidad: number, extra: Fila = {}): Fila => ({
  idArrePdpDet: id, idArrePdp: planId, numPartida: num, anio: num === 0 ? 0 : 1, ciclo: null, concepto,
  fecha: '2026-10-17', pm2: cantidad, constM2: 1, INPC: 0, inpcTotal: 0, cantidad, cantidadAplicada: 0,
  fecPago: null, moneda: 'MXN', status: true, ...extra,
});

const fila = (id: string, origen: string, destino: string, detO: string, detD: string, monto: number, extra: Fila = {}): Fila => ({
  id, seq: Number(id.slice(1)), idArrePdpOrigen: origen, idArrePdpDestino: destino, idDetOrigen: detO, idDetDestino: detD,
  moneda: 'MXN', monto, marcoPagada: false, fecTraspaso: '2026-10-20', nota: 'Contrato SPH-2025-12', estado: 'aplicado',
  claveIdempotencia: CLAVE, uid: UID, fc: '2026-10-20T18:41:00Z', revertidoPor: null, fecReversion: null, motivoReversion: null, ...extra,
});

const base = (traspasos: Fila[]): Record<string, Fila[]> => ({
  arrePdp: [
    plan('PDP_2026', 'NAV12', '2026-10-17', '2027-10-16', 500645.02),
    plan('PDP_A_2025', 'NAV12', '2025-10-17', '2026-10-16', 237002.955),
    plan('PDP_B_2025', 'NAV13', '2025-10-17', '2026-10-16', 237002.955),
  ],
  arrenPropiedades: [
    { idNavArrend: 'NAV12', idNave: 'N12', idParque: 'PQ', status: true },
    { idNavArrend: 'NAV13', idNave: 'N13', idParque: 'PQ', status: true },
  ],
  naves: [
    { idNave: 'N12', numNave: 12, numNaveNAME: '12', idParque: 'PQ' },
    { idNave: 'N13', numNave: 13, numNaveNAME: '13', idParque: 'PQ' },
  ],
  parques: [{ idParque: 'PQ', nomParque: 'Ocupar 2' }],
  inversionista: [{ idInversionista: 'TOK', razonsocial: 'DEUMEX TRADING SA DE CV' }],
  arrePdpDetalle: [
    partida('D26', 'PDP_2026', 0, 'Depósito Garantía', 26639.11),
    partida('R26', 'PDP_2026', 1, 'Renta', 71875),
    partida('DA', 'PDP_A_2025', 0, 'Depósito Garantía', 237002.955),
    partida('RA', 'PDP_A_2025', 1, 'Renta', 70000),
  ],
  arre_traspasos_deposito: traspasos,
});

function servicio(traspasos: Fila[]) {
  const f = crearSupabaseFalso({ tablas: base(traspasos) });
  return { svc: new ReportesArreService(f.supabase, new TraspasosDepositoService(f.supabase)), ...f };
}

describe('ReportesArreService.estadoCuentaCorrida (D14)', () => {
  it('con 0 traspasos: nota del depósito como siempre y SIN campos nuevos', async () => {
    const { svc } = servicio([]);
    const r = await svc.estadoCuentaCorrida('PDP_2026');
    const p0 = r.partidas.find((p) => p.numPartida === 0)!;
    expect(p0.nota).toBe('26639.11 Depósito Garantía');
    expect(p0.otros).toBe(26639.11);
    expect(p0.total).toBe(26639.11);
    expect('traspasado' in p0).toBe(false);
    expect('depositoTraspasado' in r.cabecera).toBe(false);
    expect('depositoPorCobrar' in r.cabecera).toBe(false);
    expect(r.cabecera.deposito).toBe(500645.02);
  });

  it('destino Deumex: nota «Traspaso $474,005.91 (2 contratos)» y cabecera Traspasado / Por cobrar', async () => {
    const { svc } = servicio([
      fila('f1', 'PDP_A_2025', 'PDP_2026', 'DA', 'D26', 237002.955),
      fila('f2', 'PDP_B_2025', 'PDP_2026', 'DB', 'D26', 237002.955),
    ]);
    const r = await svc.estadoCuentaCorrida('PDP_2026');
    const p0 = r.partidas.find((p) => p.numPartida === 0)!;
    expect(p0.nota).toBe('Traspaso $474,005.91 (2 contratos)');
    expect(p0.total).toBe(26639.11); // el renglón conserva su monto (= complemento)
    expect(p0.traspasado).toBeUndefined();
    expect(r.cabecera.depositoTraspasado).toBe(474005.91);
    expect(r.cabecera.depositoPorCobrar).toBe(26639.11);
    expect(r.cabecera.deposito).toBe(500645.02);
    // los demás renglones no cambian
    expect(r.partidas.find((p) => p.numPartida === 1)!.nota).toBe('');
  });

  it('origen: nota «Traspasado → Nave 12 · 2026», marcado traspasado y sin por cobrar', async () => {
    const { svc } = servicio([fila('f1', 'PDP_A_2025', 'PDP_2026', 'DA', 'D26', 237002.955)]);
    const r = await svc.estadoCuentaCorrida('PDP_A_2025');
    const p0 = r.partidas.find((p) => p.numPartida === 0)!;
    expect(p0.nota).toBe('Traspasado → Nave 12 · 2026');
    expect(p0.traspasado).toBe(true);
    expect(r.cabecera.depositoTraspasado).toBe(237002.955);
    expect(r.cabecera.depositoPorCobrar).toBe(0);
  });

  it('un traspaso revertido no deja rastro en el estado de cuenta', async () => {
    const { svc } = servicio([fila('f1', 'PDP_A_2025', 'PDP_2026', 'DA', 'D26', 237002.955, { estado: 'revertido' })]);
    const r = await svc.estadoCuentaCorrida('PDP_2026');
    expect(r.partidas.find((p) => p.numPartida === 0)!.nota).toBe('26639.11 Depósito Garantía');
    expect('depositoTraspasado' in r.cabecera).toBe(false);
  });
});
