import { Fragment, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { arrendatariosApi, num, fechaCorta, MESES, type MovimientoPago } from './arrendatarios.api';
import { FiltroColumnaOpciones } from '@/components/tabla/FiltroColumnaOpciones';
import { exportarCSV } from './csv-export';

/** Fecha + hora corta (dd/mm/aaaa hh:mm) a partir de un ISO. */
function fechaHora(iso: string | null): string {
  if (!iso) return '—';
  const d = fechaCorta(iso);
  const t = iso.includes('T') ? iso.split('T')[1]?.slice(0, 5) : '';
  return t ? `${d} ${t}` : d;
}

/** Mes(es) al que se aplicó el pago, a partir de los periodos (yyyy-MM). */
function periodoMes(periodos: string[] | undefined): string {
  const meses = [...new Set((periodos ?? []).map((p) => Number(p.slice(5, 7))))];
  if (meses.length === 0) return '—';
  if (meses.length === 1) return MESES[(meses[0] ?? 1) - 1] ?? '—';
  return `${meses.length} meses`;
}

/** Año(s) al que se aplicó el pago, a partir de los periodos (yyyy-MM). */
function periodoAnio(periodos: string[] | undefined): string {
  const anios = [...new Set((periodos ?? []).map((p) => p.slice(0, 4)))].sort();
  if (anios.length === 0) return '—';
  return anios.length === 1 ? (anios[0] ?? '—') : `${anios[0]}–${anios[anios.length - 1]}`;
}

const inSet = (v: string, s: Set<string>) => s.size === 0 || s.has(v);

/**
 * Registro de movimientos de cobranza: historial de pagos **aplicados** y
 * **desaplicados** (`arre_pagos`, agrupado por aplicación). Se filtra por **año/mes**
 * (periodo aplicado; default los del tablero) para no crecer sin límite, tiene
 * **filtros por columna** (regla 7c) y es **exportable a Excel (CSV)**. Cada fila se
 * expande (▸) para ver a qué naves/conceptos/meses se aplicó. Permite **desaplicar**.
 */
export function RegistroMovimientosModal({
  onClose,
  onCambio,
  anio,
  mes,
}: {
  onClose: () => void;
  onCambio: () => void;
  anio?: number;
  mes?: number;
}) {
  const queryClient = useQueryClient();
  const [anioF, setAnioF] = useState<number>(anio ?? new Date().getFullYear());
  const [mesF, setMesF] = useState<number>(mes ?? 0);

  // Filtros por columna (regla 7c). Vacío = sin filtro.
  const [fOrd, setFOrd] = useState<Set<string>>(new Set());
  const [fArr, setFArr] = useState<Set<string>>(new Set());
  const [fMes, setFMes] = useState<Set<string>>(new Set());
  const [fAnio, setFAnio] = useState<Set<string>>(new Set());
  const [fEstado, setFEstado] = useState<Set<string>>(new Set());

  const [confirmar, setConfirmar] = useState<MovimientoPago | null>(null);
  const [motivo, setMotivo] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);

  const aniosSelector = useMemo(() => {
    const actual = new Date().getFullYear();
    const arr: number[] = [];
    for (let a = actual + 1; a >= 2018; a--) arr.push(a);
    return arr;
  }, []);

  const { data: movs = [], isLoading } = useQuery({
    queryKey: ['arre-historial-pagos', anioF, mesF],
    queryFn: () =>
      arrendatariosApi.historialPagos({
        anio: anioF || undefined,
        mes: mesF || undefined,
        limite: 500,
      }),
  });

  const valDe = (m: MovimientoPago) => ({
    ord: m.ordenante ?? '',
    arr: m.razonSocial ?? '',
    mes: periodoMes(m.periodos),
    anio: periodoAnio(m.periodos),
    estado: m.estado === 'aplicado' ? 'Aplicado' : 'Desaplicado',
  });

  // Opciones de cada filtro de columna (valores distintos presentes).
  const opc = useMemo(() => {
    const ord = new Set<string>();
    const arr = new Set<string>();
    const me = new Set<string>();
    const an = new Set<string>();
    const es = new Set<string>();
    for (const m of movs) {
      const v = valDe(m);
      ord.add(v.ord);
      arr.add(v.arr);
      me.add(v.mes);
      an.add(v.anio);
      es.add(v.estado);
    }
    const ord2 = [...ord].sort((a, b) => a.localeCompare(b, 'es'));
    return {
      ord: ord2,
      arr: [...arr].sort((a, b) => a.localeCompare(b, 'es')),
      mes: [...me].sort((a, b) => a.localeCompare(b, 'es')),
      anio: [...an].sort((a, b) => b.localeCompare(a)),
      estado: [...es].sort(),
    };
  }, [movs]);

  const filtrados = useMemo(
    () =>
      movs.filter((m) => {
        const v = valDe(m);
        return (
          inSet(v.ord, fOrd) &&
          inSet(v.arr, fArr) &&
          inSet(v.mes, fMes) &&
          inSet(v.anio, fAnio) &&
          inSet(v.estado, fEstado)
        );
      }),
    [movs, fOrd, fArr, fMes, fAnio, fEstado],
  );

  function exportar() {
    const cols = [
      'Fecha de depósito',
      'Ordenante',
      'Arrendatario',
      'Mes aplicado',
      'Año',
      'Monto',
      'Partidas',
      'Estado',
      'Aplicado',
      'Desaplicado',
      'Motivo',
    ];
    const filas = filtrados.map((m) => [
      fechaCorta(m.fecPago),
      m.ordenante ?? '',
      m.razonSocial ?? '',
      periodoMes(m.periodos),
      periodoAnio(m.periodos),
      m.monto,
      m.partidas,
      m.estado === 'aplicado' ? 'Aplicado' : 'Desaplicado',
      fechaHora(m.aplicadoEn),
      m.estado !== 'aplicado' ? fechaHora(m.desaplicadoEn) : '',
      m.motivo ?? '',
    ]);
    exportarCSV('registro-movimientos', cols, filas);
  }

  async function desaplicar() {
    if (!confirmar) return;
    setProcesando(true);
    setError(null);
    try {
      await arrendatariosApi.desaplicarPago(confirmar.uidPago, motivo.trim() || undefined);
      setConfirmar(null);
      setMotivo('');
      void queryClient.invalidateQueries({ queryKey: ['arre-historial-pagos'] });
      void queryClient.invalidateQueries({ queryKey: ['arre-depositos'] });
      onCambio();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo desaplicar el pago.');
    } finally {
      setProcesando(false);
    }
  }

  const selCls = 'rounded border px-2 py-1 text-xs text-[#1f2a4d]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between gap-3 bg-[#1f2a4d] px-5 py-3 text-white">
          <h2 className="text-base font-semibold">Registro de movimientos (pagos)</h2>
          <div className="flex items-center gap-2">
            <select value={anioF} onChange={(e) => setAnioF(Number(e.target.value))} className={selCls} title="Año aplicado">
              <option value={0}>Todos los años</option>
              {aniosSelector.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <select value={mesF} onChange={(e) => setMesF(Number(e.target.value))} className={selCls} title="Mes aplicado">
              <option value={0}>Todos los meses</option>
              {MESES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={exportar}
              disabled={filtrados.length === 0}
              className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:bg-white/30"
              title="Exportar a Excel (CSV)"
            >
              Excel
            </button>
            <button onClick={onClose} className="text-white/80 hover:text-white" aria-label="Cerrar">
              ✕
            </button>
          </div>
        </div>

        <div className="overflow-auto p-4">
          <table className="min-w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#1f2a4d] text-left text-[11px] font-semibold uppercase text-white [&>th]:px-3 [&>th]:py-2">
                <th className="w-6"></th>
                <th>Fecha de depósito</th>
                <th>
                  <span className="flex items-center gap-1">
                    Ordenante
                    <FiltroColumnaOpciones etiqueta="Ordenante" opciones={opc.ord} seleccion={fOrd} onChange={setFOrd} />
                  </span>
                </th>
                <th>
                  <span className="flex items-center gap-1">
                    Arrendatario
                    <FiltroColumnaOpciones etiqueta="Arrendatario" opciones={opc.arr} seleccion={fArr} onChange={setFArr} />
                  </span>
                </th>
                <th>
                  <span className="flex items-center gap-1">
                    Mes aplicado
                    <FiltroColumnaOpciones etiqueta="Mes aplicado" opciones={opc.mes} seleccion={fMes} onChange={setFMes} />
                  </span>
                </th>
                <th className="text-center">
                  <span className="flex items-center justify-center gap-1">
                    Año
                    <FiltroColumnaOpciones etiqueta="Año" opciones={opc.anio} seleccion={fAnio} onChange={setFAnio} />
                  </span>
                </th>
                <th className="text-right">Monto</th>
                <th className="text-center">Part.</th>
                <th>
                  <span className="flex items-center gap-1">
                    Estado
                    <FiltroColumnaOpciones etiqueta="Estado" opciones={opc.estado} seleccion={fEstado} onChange={setFEstado} />
                  </span>
                </th>
                <th>Aplicado</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-gray-400">
                    Cargando…
                  </td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-gray-400">
                    Sin movimientos para el filtro. Ajusta el año/mes o los filtros de columna.
                  </td>
                </tr>
              ) : (
                filtrados.map((m) => {
                  const aplicado = m.estado === 'aplicado';
                  const abierto = expandido === m.uidPago;
                  return (
                    <Fragment key={m.uidPago}>
                      <tr className={aplicado ? '' : 'bg-gray-50 text-gray-400'}>
                        <td className="px-3 py-1.5">
                          <button
                            type="button"
                            onClick={() => setExpandido(abierto ? null : m.uidPago)}
                            className="text-gray-400 hover:text-[#1f2a4d]"
                            title={abierto ? 'Ocultar detalle' : 'Ver a qué naves se aplicó'}
                            aria-label="Ver detalle"
                          >
                            {abierto ? '▾' : '▸'}
                          </button>
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5">{fechaCorta(m.fecPago)}</td>
                        <td className="px-3 py-1.5">{m.ordenante ?? '—'}</td>
                        <td className="px-3 py-1.5">{m.razonSocial ?? '—'}</td>
                        <td className="px-3 py-1.5">{periodoMes(m.periodos)}</td>
                        <td className="px-3 py-1.5 text-center tabular-nums">{periodoAnio(m.periodos)}</td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right font-semibold tabular-nums">
                          {num(m.monto)}
                        </td>
                        <td className="px-3 py-1.5 text-center">{m.partidas}</td>
                        <td className="px-3 py-1.5">
                          {aplicado ? (
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                              Aplicado
                            </span>
                          ) : (
                            <span
                              className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-600"
                              title={m.motivo ? `Motivo: ${m.motivo}` : undefined}
                            >
                              Desaplicado
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-gray-500">
                          {fechaHora(m.aplicadoEn)}
                          {!aplicado && (
                            <span className="block text-[10px] text-gray-400">✗ {fechaHora(m.desaplicadoEn)}</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          {aplicado && (
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmar(m);
                                setMotivo('');
                                setError(null);
                              }}
                              className="rounded border border-red-300 px-2 py-0.5 text-[11px] font-medium text-red-600 hover:bg-red-50"
                            >
                              Desaplicar
                            </button>
                          )}
                        </td>
                      </tr>
                      {abierto && (
                        <tr>
                          <td />
                          <td colSpan={10} className="bg-gray-50 px-3 py-2">
                            <DetalleAplicacion uidPago={m.uidPago} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t px-5 py-3">
          <span className="text-xs text-gray-400">{filtrados.length} movimiento(s)</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#1f2a4d] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#2a376a]"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* Confirmación de desaplicar */}
      {confirmar && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-[#1f2a4d]">Desaplicar pago</h3>
            <p className="mt-1 text-sm text-gray-600">
              Las {confirmar.partidas} partida(s) volverán a <b>pendiente</b> y el depósito (
              {num(confirmar.monto)}) recuperará ese saldo. Esta acción queda registrada.
            </p>
            <label className="mt-3 block text-xs font-semibold text-gray-500">Motivo (opcional)</label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              placeholder="Ej. depósito aplicado por error a la nave incorrecta"
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            />
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmar(null)}
                disabled={procesando}
                className="rounded-lg border px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={desaplicar}
                disabled={procesando}
                className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:bg-gray-300"
              >
                {procesando ? 'Desaplicando…' : 'Desaplicar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Detalle de una aplicación: naves/conceptos/meses a los que se aplicó el depósito. */
function DetalleAplicacion({ uidPago }: { uidPago: string }) {
  const { data: filas = [], isLoading } = useQuery({
    queryKey: ['arre-aplicacion-detalle', uidPago],
    queryFn: () => arrendatariosApi.aplicacionDetalle(uidPago),
  });
  if (isLoading) return <p className="text-[11px] text-gray-400">Cargando detalle…</p>;
  if (filas.length === 0) return <p className="text-[11px] text-gray-400">Sin detalle.</p>;
  return (
    <table className="w-full text-[11px]">
      <thead>
        <tr className="text-left text-gray-400 [&>th]:px-2 [&>th]:py-1">
          <th>Nave</th>
          <th>Parque</th>
          <th>Concepto</th>
          <th>Mes</th>
          <th className="text-right">Monto</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
        {filas.map((f) => (
          <tr key={f.idArrePdpDet} className="[&>td]:px-2 [&>td]:py-1">
            <td className="font-medium text-gray-700">{f.nave ?? '—'}</td>
            <td className="text-gray-500">{f.parque ?? '—'}</td>
            <td className="text-gray-600">{f.concepto ?? '—'}</td>
            <td className="text-gray-500">{fechaCorta(f.fecha)}</td>
            <td className="text-right tabular-nums text-gray-700">{num(f.monto)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
