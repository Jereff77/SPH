import { InternalServerErrorException } from '@nestjs/common';
import { EscriturasService } from './escrituras.service.js';
import { crearSupabaseFalso, type Fila } from '../arrendatarios/supabase-falso.testing-spec.js';

/**
 * Ventas > Escrituras: el listado muestra TODAS las naves (excepto el parque de Tickets).
 * Las que tienen plan de pagos traen su estatus y fecha; las que no, salen «sin plan»
 * (sin estatus ni fecha) y pasan solas a «Pendiente» cuando se les crea un plan.
 */

const parque = (idParque: string, nomParque: string, esTicket = false): Fila => ({
  idParque, nomParque, status: true, esTicket,
});
const nave = (idNave: string, idParque: string, num: number | string, extra: Fila = {}): Fila => ({
  idNave, idParque, numNave: Number(num), numNaveNAME: String(num), status: true, esTicket: false, ...extra,
});
const propiedad = (idPropiedad: string, idNave: string, idInversionista: string, extra: Fila = {}): Fila => ({
  idPropiedad, idNave, idInversionista, status: true, PActual: true, ...extra,
});
const plan = (idPdp: string, idPropiedad: string, extra: Fila = {}): Fila => ({
  idPdp, idPropiedad, escriturada: false, fechaEscrituracion: null, status: true, esTicket: false, ...extra,
});
const inversionista = (idInversionista: string, razonsocial: string): Fila => ({
  idInversionista, razonsocial, nombre: null, apellido1: null,
});

function servicio(tablas: Record<string, Fila[]>, errores?: Record<string, { message: string }>) {
  const { supabase, ctx } = crearSupabaseFalso({ tablas, errores });
  return { svc: new EscriturasService(supabase), ctx };
}

/** Escenario base: 2 parques normales + 1 de Tickets y naves en todos los estados. */
const base = (): Record<string, Fila[]> => ({
  parques: [parque('PA', 'Acupark II'), parque('PB', 'Actitek'), parque('PT', 'A3 (Tickets)', true)],
  naves: [
    nave('N1', 'PA', 1), // con plan, pendiente
    nave('N2', 'PA', 2), // con plan, escriturada
    nave('N3', 'PB', 3), // sin plan, sin propiedad
    nave('N4', 'PA', 4), // sin plan, con propiedad vigente
    nave('N5', 'PT', 5), // parque de Tickets → fuera
    nave('N6', 'PA', 6, { esTicket: true }), // nave de Tickets → fuera
    nave('N7', 'PA', 7, { status: false }), // nave dada de baja → fuera
  ],
  propiedades: [
    propiedad('P1', 'N1', 'I1'),
    propiedad('P2', 'N2', 'I2'),
    propiedad('P4', 'N4', 'I4'),
  ],
  pdp: [
    plan('D1', 'P1'),
    plan('D2', 'P2', { escriturada: true, fechaEscrituracion: '2026-05-12' }),
  ],
  inversionista: [inversionista('I1', 'UNO SA'), inversionista('I2', 'DOS SA'), inversionista('I4', 'CUATRO SA')],
});

describe('EscriturasService.listar', () => {
  it('lista TODAS las naves del módulo: con plan (pendiente / escriturada) y sin plan, sin Tickets ni bajas', async () => {
    const { svc } = servicio(base());
    const r = await svc.listar();

    expect(r.filas.map((f) => `${f.parque}|${f.numNave}`)).toEqual([
      'Actitek|3', 'Acupark II|1', 'Acupark II|2', 'Acupark II|4',
    ]);
    expect(r).toMatchObject({ total: 4, conPlan: 2, sinPlan: 2, escrituradas: 1, pendientes: 1 });

    const [n3, n1, n2, n4] = r.filas;
    expect(n1).toMatchObject({ idPdp: 'D1', tienePlan: true, escriturada: false, fechaEscrituracion: null, inversionista: 'UNO SA' });
    expect(n2).toMatchObject({ idPdp: 'D2', tienePlan: true, escriturada: true, fechaEscrituracion: '2026-05-12', inversionista: 'DOS SA' });
    // Sin plan: sin idPdp, sin estatus ni fecha.
    expect(n3).toMatchObject({ idPdp: null, tienePlan: false, escriturada: false, fechaEscrituracion: null, inversionista: null });
    expect(n4).toMatchObject({ idPdp: null, tienePlan: false, escriturada: false, fechaEscrituracion: null });
  });

  it('el inversionista de una nave sin plan es el dueño VIGENTE; una propiedad dada de baja no cuenta', async () => {
    const t = base();
    t.naves.push(nave('N8', 'PA', 8), nave('N9', 'PA', 9), nave('N10', 'PA', 10));
    t.propiedades.push(
      propiedad('P8', 'N8', 'I1', { status: false }), // baja
      propiedad('P9', 'N9', 'I2', { PActual: false }), // ya no es la actual
      propiedad('P10', 'N10', 'I4'), // vigente
    );
    const { svc } = servicio(t);
    const r = await svc.listar();
    const por = (n: string) => r.filas.find((f) => f.numNave === n);

    expect(por('4')?.inversionista).toBe('CUATRO SA');
    expect(por('8')?.inversionista).toBeNull();
    expect(por('9')?.inversionista).toBeNull();
    expect(por('10')?.inversionista).toBe('CUATRO SA');
  });

  it('una nave «sin plan» pasa sola a «Pendiente» (sin fecha) cuando se le crea un plan', async () => {
    const antes = await servicio(base()).svc.listar();
    expect(antes.filas.find((f) => f.numNave === '4')).toMatchObject({ tienePlan: false, idPdp: null });
    expect(antes).toMatchObject({ total: 4, conPlan: 2, sinPlan: 2, pendientes: 1 });

    const t = base();
    t.pdp.push(plan('D4', 'P4')); // se crea el plan de la nave 4
    const despues = await servicio(t).svc.listar();
    expect(despues.filas.find((f) => f.numNave === '4')).toMatchObject({
      idPdp: 'D4', tienePlan: true, escriturada: false, fechaEscrituracion: null, inversionista: 'CUATRO SA',
    });
    // El total de naves no cambia; solo se mueve de «sin plan» a «con plan / pendiente».
    expect(despues).toMatchObject({ total: 4, conPlan: 3, sinPlan: 1, escrituradas: 1, pendientes: 2 });
  });

  it('un plan activo se sigue mostrando aunque su nave o su parque no pasen el filtro (comportamiento previo)', async () => {
    const t = base();
    t.naves.push(nave('N11', 'PT', 11, { status: false })); // nave de baja en parque de Tickets
    t.propiedades.push(propiedad('P11', 'N11', 'I1'));
    t.pdp.push(plan('D11', 'P11'));
    const { svc } = servicio(t);
    const r = await svc.listar();

    const f = r.filas.find((x) => x.idPdp === 'D11');
    expect(f).toMatchObject({ tienePlan: true, numNave: '11', parque: 'A3 (Tickets)' });
    expect(r.conPlan).toBe(3);
    // La nave de baja sin plan sigue fuera.
    expect(r.filas.find((x) => x.numNave === '7')).toBeUndefined();
  });

  it('los planes de Tickets (esTicket) o dados de baja no cuentan como plan: la nave sale «sin plan»', async () => {
    const t = base();
    t.pdp = [
      plan('D1', 'P1', { esTicket: true }),
      plan('D2', 'P2', { status: false }),
    ];
    const r = await servicio(t).svc.listar();
    expect(r).toMatchObject({ total: 4, conPlan: 0, sinPlan: 4, escrituradas: 0, pendientes: 0 });
  });

  it('ordena por parque → nave (numérico)', async () => {
    const t = base();
    t.naves = [nave('A', 'PA', 10), nave('B', 'PA', 2), nave('C', 'PA', 1), nave('D', 'PB', 5)];
    t.propiedades = [];
    t.pdp = [];
    const r = await servicio(t).svc.listar();
    expect(r.filas.map((f) => `${f.parque}|${f.numNave}`)).toEqual([
      'Actitek|5', 'Acupark II|1', 'Acupark II|2', 'Acupark II|10',
    ]);
  });

  it('usa el número de nave cuando no hay etiqueta (numNaveNAME)', async () => {
    const t = base();
    t.naves = [nave('A', 'PA', 7, { numNaveNAME: null })];
    t.propiedades = [];
    t.pdp = [];
    const r = await servicio(t).svc.listar();
    expect(r.filas[0].numNave).toBe('7');
  });

  it('lee más de 1000 naves por páginas y resuelve inversionistas por lotes', async () => {
    const naves: Fila[] = [];
    const propiedades: Fila[] = [];
    const pdp: Fila[] = [];
    const invs: Fila[] = [];
    for (let i = 1; i <= 1200; i++) naves.push(nave(`N${String(i).padStart(4, '0')}`, 'PA', i));
    for (let i = 1; i <= 200; i++) {
      const k = String(i).padStart(4, '0');
      propiedades.push(propiedad(`P${k}`, `N${k}`, `I${k}`));
      pdp.push(plan(`D${k}`, `P${k}`));
      invs.push(inversionista(`I${k}`, `INVERSIONISTA ${k}`));
    }
    const { svc, ctx } = servicio({ parques: [parque('PA', 'Acupark II')], naves, propiedades, pdp, inversionista: invs });
    const r = await svc.listar();

    expect(r).toMatchObject({ total: 1200, conPlan: 200, sinPlan: 1000 });
    expect(r.filas.filter((f) => f.tienePlan).every((f) => f.inversionista?.startsWith('INVERSIONISTA'))).toBe(true);
    // 2 páginas de naves (1000 + 200) y 2 lotes de inversionistas (150 + 50).
    expect(ctx.consultas.filter((c) => c === 'naves')).toHaveLength(2);
    expect(ctx.consultas.filter((c) => c === 'inversionista')).toHaveLength(2);
  });

  it('si falla una consulta responde 500 con un mensaje genérico (sin filtrar el error de la BD)', async () => {
    const { svc } = servicio(base(), { naves: { message: 'relation "naves" secreto interno' } });
    const p = svc.listar();
    await expect(p).rejects.toBeInstanceOf(InternalServerErrorException);
    await expect(p).rejects.toThrow('No se pudieron cargar las escrituras.');
  });

  it('nunca escribe: el listado es de solo lectura', async () => {
    const { svc, ctx } = servicio(base());
    await svc.listar();
    expect(ctx.escrituras).toHaveLength(0);
    expect(ctx.rpcs).toHaveLength(0);
  });
});
