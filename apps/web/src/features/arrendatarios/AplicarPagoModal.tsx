import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  arrendatariosApi,
  hoyMexico,
  num,
  fechaCorta,
  MESES,
  type DepositoSinAplicar,
  type PagoArreRow,
} from './arrendatarios.api';

/** Nave dentro de un mes (agrupa sus conceptos). */
interface NaveMes {
  clave: string; // yyyy-MM|nave
  nave: string;
  parque: string;
  partidas: PagoArreRow[];
  total: number;
}

/** Grupo de partidas pendientes de un mismo mes (yyyy-MM), dividido por nave. */
interface GrupoMes {
  clave: string; // yyyy-MM
  etiqueta: string; // "Mayo 2026"
  estadoMes: 'Atrasado' | 'Mes actual' | 'Adelantado';
  naves: NaveMes[];
  total: number;
}

/**
 * Modal de aplicación de pago **con saldo a favor por depósito** (casos 1 y 2).
 * Izquierda: depósitos sin aplicar (con su **saldo disponible**). Derecha: todas
 * las partidas pendientes del arrendatario, agrupadas por **mes → nave** (los
 * conceptos quedan **comprimidos**; se despliegan con ▸ si hace falta). La
 * selección puede hacerse por mes, por nave o por concepto. El total seleccionado
 * debe ser ≤ el saldo disponible del depósito; el remanente queda como saldo a
 * favor del propio depósito para aplicarlo después.
 */
export function AplicarPagoModal({
  razonSocial,
  anio,
  mes,
  onClose,
  onAplicado,
}: {
  razonSocial: string;
  anio: number;
  mes: number;
  onClose: () => void;
  onAplicado: () => void;
}) {
  const [busca, setBusca] = useState('');
  const [mesF, setMesF] = useState<number>(mes);
  const [anioF, setAnioF] = useState<number>(anio);
  const [depositoSelId, setDepositoSelId] = useState<string | null>(null);
  const [selDet, setSelDet] = useState<Set<string>>(new Set());
  const [navesAbiertas, setNavesAbiertas] = useState<Set<string>>(new Set());
  // Año de las partidas pendientes a mostrar (default: año en curso). 0 = todos.
  const [anioPart, setAnioPart] = useState<number>(new Date().getFullYear());
  const [error, setError] = useState<string | null>(null);
  const [aplicando, setAplicando] = useState(false);
  // Form "agregar concepto": clave de la nave-mes donde se está capturando.
  const [agregandoEn, setAgregandoEn] = useState<string | null>(null);
  const [nuevoConcepto, setNuevoConcepto] = useState('');
  const [nuevoMonto, setNuevoMonto] = useState('');
  const [guardandoConcepto, setGuardandoConcepto] = useState(false);
  const queryClient = useQueryClient();

  const aniosOpc = useMemo(() => {
    const arr: number[] = [];
    for (let a = anio + 1; a >= 2024; a--) arr.push(a);
    return arr;
  }, [anio]);

  // Todas las partidas pendientes del arrendatario (cualquier mes: adelantos/atrasos).
  const { data: partidas = [], isLoading: cargandoPart } = useQuery({
    queryKey: ['arre-partidas-pend', razonSocial],
    queryFn: () => arrendatariosApi.partidasPendientes(razonSocial),
  });

  // Plan del arrendatario (para que el backend marque los depósitos "sugeridos").
  const idArrePdp = useMemo(
    () => partidas.find((p) => p.id_arrepdp)?.id_arrepdp ?? undefined,
    [partidas],
  );

  const { data: depositos = [], isLoading: cargandoDep } = useQuery({
    queryKey: ['arre-depositos', busca, anioF, mesF, idArrePdp],
    queryFn: () =>
      arrendatariosApi.depositosSinAplicar(
        busca || undefined,
        anioF || undefined,
        mesF || undefined,
        idArrePdp,
      ),
  });

  // Margen de tolerancia de centavos (configurable en SPHConfiguraciones).
  const { data: tolData } = useQuery({
    queryKey: ['arre-tolerancia-pago'],
    queryFn: () => arrendatariosApi.toleranciaPago(),
    staleTime: 10 * 60 * 1000,
  });
  const tolerancia = tolData?.tolerancia ?? 0.05;

  const sugeridos = useMemo(() => depositos.filter((d) => d.sugerido), [depositos]);
  const otros = useMemo(() => depositos.filter((d) => !d.sugerido), [depositos]);

  // El depósito seleccionado se DERIVA de la lista (por idmov), no se guarda el
  // objeto: así su saldo disponible se actualiza solo cuando la lista se refresca
  // tras aplicar/desaplicar (evita ver el importe completo de un caché viejo).
  const deposito = useMemo(
    () => depositos.find((d) => d.idmov === depositoSelId) ?? null,
    [depositos, depositoSelId],
  );

  // Partidas agrupadas por mes → nave, en orden cronológico, con etiqueta de adelanto/atraso.
  const grupos = useMemo<GrupoMes[]>(() => {
    const mesHoy = hoyMexico().slice(0, 7);
    const map = new Map<string, GrupoMes>();
    for (const p of partidas) {
      const claveMes = (p.fecha ?? '').slice(0, 7);
      if (!claveMes) continue;
      let g = map.get(claveMes);
      if (!g) {
        const y = Number(claveMes.slice(0, 4));
        const m = Number(claveMes.slice(5, 7));
        g = {
          clave: claveMes,
          etiqueta: `${MESES[m - 1] ?? claveMes} ${y}`,
          estadoMes:
            claveMes < mesHoy ? 'Atrasado' : claveMes > mesHoy ? 'Adelantado' : 'Mes actual',
          naves: [],
          total: 0,
        };
        map.set(claveMes, g);
      }
      const naveNom = p.nave ?? '—';
      const claveNave = `${claveMes}|${naveNom}`;
      let nv = g.naves.find((n) => n.clave === claveNave);
      if (!nv) {
        nv = { clave: claveNave, nave: naveNom, parque: p.parque ?? '', partidas: [], total: 0 };
        g.naves.push(nv);
      }
      nv.partidas.push(p);
      nv.total += p.monto ?? 0;
      g.total += p.monto ?? 0;
    }
    const arr = [...map.values()].sort((a, b) => a.clave.localeCompare(b.clave));
    for (const g of arr)
      g.naves.sort((a, b) => a.nave.localeCompare(b.nave, 'es', { numeric: true }));
    return arr;
  }, [partidas]);

  // Años con partidas pendientes (+ el año en curso), para el selector.
  const aniosPart = useMemo(() => {
    const set = new Set<number>(
      partidas.map((p) => Number((p.fecha ?? '').slice(0, 4))).filter((a) => a > 0),
    );
    set.add(new Date().getFullYear());
    return [...set].sort((a, b) => b - a);
  }, [partidas]);

  // Grupos visibles según el año seleccionado (0 = todos).
  const gruposVisibles = useMemo(
    () => (anioPart ? grupos.filter((g) => Number(g.clave.slice(0, 4)) === anioPart) : grupos),
    [grupos, anioPart],
  );

  const totalSel = useMemo(
    () => partidas.filter((p) => selDet.has(p.id_detalle)).reduce((s, p) => s + (p.monto ?? 0), 0),
    [partidas, selDet],
  );

  const saldoDisp = deposito?.saldoDisponible ?? deposito?.importe ?? 0;
  const dif = saldoDisp - totalSel;
  // El total puede exceder el saldo hasta el margen de tolerancia (centavos por redondeo).
  const excede = !!deposito && totalSel - saldoDisp > tolerancia + 0.0001;
  const aplicable = !!deposito && totalSel > 0.005 && !excede;
  // El saldo a favor solo cuenta si el remanente supera la tolerancia; si es menor,
  // se absorbe como diferencia de centavos al aplicar.
  const saldoAFavor = dif > tolerancia ? Math.round(dif * 100) / 100 : 0;

  const toggleDet = (id: string) =>
    setSelDet((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  /** Selecciona/deselecciona en bloque un conjunto de partidas (nave o mes). */
  const toggleBloque = (lista: PagoArreRow[]) =>
    setSelDet((s) => {
      const n = new Set(s);
      const todas = lista.every((p) => n.has(p.id_detalle));
      for (const p of lista) {
        if (todas) n.delete(p.id_detalle);
        else n.add(p.id_detalle);
      }
      return n;
    });

  const toggleNaveAbierta = (clave: string) =>
    setNavesAbiertas((s) => {
      const n = new Set(s);
      if (n.has(clave)) n.delete(clave);
      else n.add(clave);
      return n;
    });

  /** Quita la sugerencia (⭐) de un ordenante para este arrendatario (un click). */
  async function quitarSugerencia(ordenante: string) {
    if (!idArrePdp || !ordenante) return;
    try {
      await arrendatariosApi.quitarSugerencia(idArrePdp, ordenante);
      void queryClient.invalidateQueries({ queryKey: ['arre-depositos'] });
    } catch {
      /* si falla, no se bloquea el flujo (se puede reintentar) */
    }
  }

  /** Agrega un concepto libre a la nave-mes (penalización/interés). */
  async function guardarConcepto(nv: NaveMes) {
    const refId = nv.partidas[0]?.id_detalle;
    const monto = Number(nuevoMonto);
    if (!refId || !nuevoConcepto.trim() || !(monto > 0)) {
      setError('Captura un concepto y un monto mayor a 0.');
      return;
    }
    setError(null);
    setGuardandoConcepto(true);
    try {
      await arrendatariosApi.agregarConceptoPartida(refId, nuevoConcepto.trim(), monto);
      setAgregandoEn(null);
      setNuevoConcepto('');
      setNuevoMonto('');
      await queryClient.invalidateQueries({ queryKey: ['arre-partidas-pend'] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo agregar el concepto.');
    } finally {
      setGuardandoConcepto(false);
    }
  }

  async function aplicar() {
    if (!deposito || !aplicable) return;
    const idsDetalle = [...selDet];
    if (idsDetalle.length === 0) {
      setError('Selecciona al menos una partida.');
      return;
    }
    setError(null);
    setAplicando(true);
    try {
      await arrendatariosApi.aplicarPago({
        idmov: deposito.idmov,
        idsDetalle,
        fecPago: deposito.fec_operacion ?? hoyMexico(),
      });
      // Refrescar depósitos (saldo) y partidas pendientes para el próximo uso.
      void queryClient.invalidateQueries({ queryKey: ['arre-depositos'] });
      void queryClient.invalidateQueries({ queryKey: ['arre-partidas-pend'] });
      onAplicado();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo aplicar el pago.');
    } finally {
      setAplicando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between bg-[#1f2a4d] px-5 py-3 text-white">
          <h2 className="text-base font-semibold">Aplicar pago — {razonSocial}</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white" aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-0 overflow-hidden md:grid-cols-2">
          {/* Depósitos bancarios */}
          <div className="flex flex-col gap-2 overflow-auto p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Depósito bancario
              </span>
              <span className="text-[10px] text-gray-400">{depositos.length} con saldo</span>
            </div>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por ordenante o concepto…"
              className="w-full rounded border px-2 py-1.5 text-sm"
            />
            <div className="flex items-center gap-1.5">
              <select
                value={mesF}
                onChange={(e) => setMesF(Number(e.target.value))}
                className="flex-1 rounded border px-2 py-1 text-xs text-[#1f2a4d]"
                title="Mes del depósito"
              >
                <option value={0}>Todos los meses</option>
                {MESES.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                value={anioF}
                onChange={(e) => setAnioF(Number(e.target.value))}
                className="rounded border px-2 py-1 text-xs text-[#1f2a4d]"
                title="Año del depósito"
              >
                <option value={0}>Todos</option>
                {aniosOpc.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              {cargandoDep ? (
                <p className="px-2 py-4 text-center text-xs text-gray-400">Buscando…</p>
              ) : depositos.length === 0 ? (
                <p className="px-2 py-4 text-center text-xs text-gray-400">
                  Sin depósitos para el filtro. Prueba "Todos los meses" o ajusta la búsqueda.
                </p>
              ) : (
                <>
                  {sugeridos.length > 0 && (
                    <>
                      <div className="flex items-center gap-1 px-1 pt-1 text-[10px] font-bold uppercase tracking-wide text-amber-600">
                        <span>⭐ Sugeridos</span>
                        <span className="rounded-full bg-amber-100 px-1.5 text-amber-700">
                          {sugeridos.length}
                        </span>
                      </div>
                      {sugeridos.map((d) => (
                        <DepositoItem
                          key={d.idmov}
                          d={d}
                          sel={deposito?.idmov === d.idmov}
                          onClick={() => setDepositoSelId(d.idmov)}
                          onQuitarSugerencia={() => quitarSugerencia(d.ordenante ?? '')}
                        />
                      ))}
                      {otros.length > 0 && (
                        <div className="px-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                          Todos los demás
                        </div>
                      )}
                    </>
                  )}
                  {otros.map((d) => (
                    <DepositoItem
                      key={d.idmov}
                      d={d}
                      sel={deposito?.idmov === d.idmov}
                      onClick={() => setDepositoSelId(d.idmov)}
                    />
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Partidas pendientes por mes → nave (conceptos comprimidos) */}
          <div className="flex flex-col gap-2 overflow-auto border-t p-4 md:border-l md:border-t-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Partidas pendientes{' '}
                <span className="font-normal normal-case text-gray-400">(con IVA)</span>
              </span>
              <select
                value={anioPart}
                onChange={(e) => {
                  setAnioPart(Number(e.target.value));
                  setSelDet(new Set());
                }}
                className="rounded border px-2 py-1 text-xs text-[#1f2a4d]"
                title="Año de las partidas pendientes"
              >
                <option value={0}>Todos los años</option>
                {aniosPart.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            {cargandoPart ? (
              <p className="px-2 py-4 text-center text-xs text-gray-400">Cargando…</p>
            ) : gruposVisibles.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-gray-400">
                {partidas.length > 0
                  ? `Sin partidas pendientes en ${anioPart}. Cambia el año o elige "Todos los años".`
                  : 'Sin partidas pendientes.'}
              </p>
            ) : (
              gruposVisibles.map((g) => {
                const todasMes = g.naves.every((nv) => esSel(nv.partidas, selDet) === 'todas');
                const algunasMes = g.naves.some((nv) => esSel(nv.partidas, selDet) !== 'ninguna');
                return (
                  <div key={g.clave} className="rounded-lg border border-gray-200">
                    {/* Encabezado del mes */}
                    <div className="flex items-center justify-between gap-2 rounded-t-lg bg-gray-50 px-3 py-1.5">
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={todasMes}
                          ref={(el) => {
                            if (el) el.indeterminate = algunasMes && !todasMes;
                          }}
                          onChange={() => toggleBloque(g.naves.flatMap((nv) => nv.partidas))}
                          className="h-4 w-4 accent-amber-500"
                          title="Seleccionar todo el mes"
                        />
                        <span className="text-xs font-bold text-[#1f2a4d]">{g.etiqueta}</span>
                        <EtiquetaMes estado={g.estadoMes} />
                      </span>
                      <span className="text-xs font-bold text-red-600">{num(g.total)}</span>
                    </div>
                    {/* Naves (comprimidas) */}
                    <div className="divide-y">
                      {g.naves.map((nv) => {
                        const abierta = navesAbiertas.has(nv.clave);
                        const sel = esSel(nv.partidas, selDet);
                        return (
                          <div key={nv.clave}>
                            <div className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50">
                              <input
                                type="checkbox"
                                checked={sel === 'todas'}
                                ref={(el) => {
                                  if (el) el.indeterminate = sel === 'algunas';
                                }}
                                onChange={() => toggleBloque(nv.partidas)}
                                className="h-4 w-4 accent-amber-500"
                                title="Seleccionar toda la nave"
                              />
                              <button
                                type="button"
                                onClick={() => toggleNaveAbierta(nv.clave)}
                                className="flex flex-1 items-center justify-between gap-2 text-left"
                                title={abierta ? 'Ocultar conceptos' : 'Ver conceptos'}
                              >
                                <span className="flex items-center gap-1.5">
                                  <span className="w-3 text-gray-400">{abierta ? '▾' : '▸'}</span>
                                  <span className="font-bold text-[#1f2a4d]">{nv.nave}</span>
                                  <span className="text-gray-400">{nv.parque}</span>
                                  <span className="text-[10px] text-gray-400">
                                    ({nv.partidas.length})
                                  </span>
                                </span>
                                <span className="tabular-nums font-semibold text-red-600">
                                  {num(nv.total)}
                                </span>
                              </button>
                            </div>
                            {/* Conceptos desplegados */}
                            {abierta && (
                              <div className="divide-y border-t bg-gray-50/60">
                                {nv.partidas.map((p) => (
                                  <label
                                    key={p.id_detalle}
                                    className="flex cursor-pointer items-center gap-2 py-1 pl-9 pr-3 text-xs hover:bg-gray-100"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selDet.has(p.id_detalle)}
                                      onChange={() => toggleDet(p.id_detalle)}
                                      className="h-4 w-4 accent-amber-500"
                                    />
                                    <span className="flex-1 text-gray-600">{p.concepto ?? '—'}</span>
                                    <span className="tabular-nums text-gray-600">{num(p.monto)}</span>
                                  </label>
                                ))}
                                {/* Agregar un concepto libre (penalización/interés) a esta nave-mes */}
                                {agregandoEn === nv.clave ? (
                                  <div className="flex items-center gap-1.5 py-1 pl-9 pr-3">
                                    <input
                                      value={nuevoConcepto}
                                      onChange={(e) => setNuevoConcepto(e.target.value)}
                                      placeholder="Concepto (ej. Penalización)"
                                      className="flex-1 rounded border px-2 py-1 text-xs"
                                      autoFocus
                                    />
                                    <input
                                      type="number"
                                      value={nuevoMonto}
                                      onChange={(e) => setNuevoMonto(e.target.value)}
                                      placeholder="Monto"
                                      className="w-24 rounded border px-2 py-1 text-right text-xs"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => guardarConcepto(nv)}
                                      disabled={guardandoConcepto}
                                      className="rounded bg-[#1f2a4d] px-2 py-1 text-xs font-medium text-white hover:bg-[#2a376a] disabled:bg-gray-300"
                                    >
                                      {guardandoConcepto ? '…' : 'Agregar'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setAgregandoEn(null)}
                                      className="px-1 text-xs text-gray-400 hover:text-gray-600"
                                      aria-label="Cancelar"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAgregandoEn(nv.clave);
                                      setNuevoConcepto('');
                                      setNuevoMonto('');
                                      setError(null);
                                    }}
                                    className="flex w-full items-center gap-1 py-1 pl-9 pr-3 text-left text-xs font-medium text-[#3f5b87] hover:bg-gray-100"
                                  >
                                    + Agregar concepto
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Resumen */}
        <div className="flex flex-wrap items-center gap-6 border-t bg-gray-50 px-5 py-3 text-sm">
          <div>
            <span className="block text-[10px] uppercase text-gray-400">Saldo del depósito</span>
            <span className="font-bold text-[#1f2a4d]">{deposito ? num(saldoDisp) : '—'}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase text-gray-400">Seleccionado</span>
            <span className="font-bold text-[#1f2a4d]">{totalSel > 0 ? num(totalSel) : '—'}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase text-gray-400">
              {excede ? 'Excede' : 'Saldo a favor'}
            </span>
            <span className={`font-bold ${excede ? 'text-red-600' : 'text-green-600'}`}>
              {!deposito || totalSel === 0
                ? '—'
                : excede
                  ? num(totalSel - saldoDisp)
                  : num(saldoAFavor)}
            </span>
          </div>
        </div>

        {error && (
          <div className="px-5 pb-1">
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t px-5 py-3">
          <p className="text-[11px] text-gray-400">
            El total seleccionado no puede exceder el saldo del depósito. Lo que sobre queda como
            saldo a favor del mismo depósito.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={aplicar}
              disabled={aplicando || !aplicable}
              title={
                excede ? 'El total seleccionado excede el saldo disponible del depósito.' : undefined
              }
              className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {aplicando ? 'Aplicando…' : 'Aplicar pago'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Estado de selección de un bloque de partidas: ninguna / algunas / todas. */
function esSel(lista: PagoArreRow[], sel: Set<string>): 'ninguna' | 'algunas' | 'todas' {
  let n = 0;
  for (const p of lista) if (sel.has(p.id_detalle)) n++;
  return n === 0 ? 'ninguna' : n === lista.length ? 'todas' : 'algunas';
}

/** Pastilla de estado del mes (atrasado/actual/adelantado). */
function EtiquetaMes({ estado }: { estado: GrupoMes['estadoMes'] }) {
  const cls =
    estado === 'Atrasado'
      ? 'bg-red-100 text-red-700'
      : estado === 'Adelantado'
        ? 'bg-blue-100 text-blue-700'
        : 'bg-gray-200 text-gray-600';
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase ${cls}`}>
      {estado}
    </span>
  );
}

/** Tarjeta de un depósito bancario en la lista de selección. */
function DepositoItem({
  d,
  sel,
  onClick,
  onQuitarSugerencia,
}: {
  d: DepositoSinAplicar;
  sel: boolean;
  onClick: () => void;
  onQuitarSugerencia?: () => void;
}) {
  const importe = d.importe ?? 0;
  const saldo = d.saldoDisponible ?? importe;
  const parcial = saldo < importe - 0.005;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`cursor-pointer rounded-lg border px-3 py-2 text-left text-xs transition ${
        sel ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:bg-gray-50'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-gray-700">
          {d.sugerido && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onQuitarSugerencia?.();
              }}
              title="Quitar de sugeridos (con un click). Se vuelve a aprender al aplicar un pago de este ordenante."
              className="mr-1 text-amber-500 hover:text-amber-700"
            >
              ⭐
            </button>
          )}
          {d.ordenante ?? '—'}
        </span>
        <span className="whitespace-nowrap text-right">
          <span className="font-bold text-[#1f2a4d]">{num(saldo)}</span>{' '}
          <span className="text-[10px] opacity-60">{d.moneda ?? 'MXN'}</span>
          {parcial && (
            <span className="block text-[10px] font-normal text-amber-600">
              saldo a favor (de {num(importe)})
            </span>
          )}
        </span>
      </div>
      {d.concepto && <div className="truncate text-gray-500">{d.concepto}</div>}
      <div className="text-gray-400">
        {fechaCorta(d.fec_operacion)} · {d.rastreo ?? ''}
      </div>
    </div>
  );
}
