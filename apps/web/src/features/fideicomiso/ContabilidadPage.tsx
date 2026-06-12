import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fideicomisoApi, MESES, type PivoteFila } from './fideicomiso.api';
import { ApiRequestError } from '@/lib/api';

/** Índice 0-based de un mes corto ('Ene'..'Dic') tolerando `string`. */
const idxMes = (m: string) => (MESES as readonly string[]).indexOf(m);

/* ────────────────────────── helpers ────────────────────────── */

const NOMBRE_MES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const TOLERANCIA = 0.8;

/** Formato igual al de v1: 0 → "0", resto es-MX con 2 decimales. */
function fmt(v: number | null | undefined): string {
  const n = Number(v) || 0;
  if (n === 0) return '0';
  return new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function anioActualMX(): number {
  return Number(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City',
      year: 'numeric',
    }).format(new Date()),
  );
}

/** Clave única de una fila del pivote. */
const rowKey = (f: PivoteFila) =>
  `${f.tipo}|${f.concepto}|${f.subconcepto || '-'}|${f.descripcion || '-'}`;

const mesValor = (f: PivoteFila, m: string) => Number((f as unknown as Record<string, number>)[m]) || 0;

type CampoTexto = 'tipo' | 'concepto' | 'desc';

/* ────────────────────────── página ────────────────────────── */

/**
 * Fideicomiso → Contabilidad (clave 540). Réplica FIEL de la pantalla
 * `fide_contabilidad` de v1 (WebView), reconstruida de forma segura: todo el
 * acceso a datos pasa por el backend. Incluye edición inline de celdas, toggle
 * de IVA, notas, fila de Saldo Banco (conciliación), filtros por columna,
 * subtotales/gran total y los modales de "Nuevo" y "+ Catálogo".
 */
export function ContabilidadPage() {
  const queryClient = useQueryClient();
  const anioBase = anioActualMX();
  const anios = useMemo(() => Array.from({ length: 6 }, (_, i) => anioBase - 3 + i), [anioBase]);
  const [anio, setAnio] = useState(anioBase);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  function notify(msg: string) {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2800);
  }

  const detalleQ = useQuery({
    queryKey: ['fide-conta-pivote', anio],
    queryFn: () => fideicomisoApi.contabilidadPivote(anio),
  });
  const totalesQ = useQuery({
    queryKey: ['fide-conta-totales', anio],
    queryFn: () => fideicomisoApi.contabilidadTotales(anio),
  });
  const saldosQ = useQuery({
    queryKey: ['fide-conta-saldos', anio],
    queryFn: () => fideicomisoApi.contabilidadSaldos(anio),
  });

  const detalle = useMemo(() => detalleQ.data ?? [], [detalleQ.data]);
  const totales = useMemo(() => totalesQ.data ?? [], [totalesQ.data]);
  const cargando = detalleQ.isLoading || totalesQ.isLoading;

  const recargar = () => {
    queryClient.invalidateQueries({ queryKey: ['fide-conta-pivote', anio] });
    queryClient.invalidateQueries({ queryKey: ['fide-conta-totales', anio] });
    queryClient.invalidateQueries({ queryKey: ['fide-conta-saldos', anio] });
  };

  /* Gran total por mes (para conciliar Saldo Banco). */
  const granTotal = useMemo(() => {
    const g = totales.find((t) => (t.tipo ?? '').toUpperCase().includes('GRAN'));
    return g ?? null;
  }, [totales]);

  /* Saldos por mes (nombre corto → saldo). */
  const saldos = useMemo(() => {
    const m: Record<string, number> = {};
    (saldosQ.data ?? []).forEach((s) => { m[MESES[s.mes - 1]!] = s.saldo; });
    return m;
  }, [saldosQ.data]);

  /* ── filtros ── */
  const [textFilters, setTextFilters] = useState<Partial<Record<CampoTexto, Set<string>>>>({});
  const [numFilter, setNumFilter] = useState<{ mes: string; valores: Set<string> } | null>(null);

  const textoDe = (f: PivoteFila, campo: CampoTexto) =>
    campo === 'tipo' ? f.tipo : campo === 'concepto' ? f.concepto : (f.descripcion || '');

  const filtrado = useMemo(() => {
    return detalle.filter((f) => {
      if (numFilter) {
        const v = mesValor(f, numFilter.mes);
        const cat = v === 0 ? '(cero)' : v > 0 ? 'positivos' : 'negativos';
        if (!numFilter.valores.has(cat)) return false;
      }
      for (const campo of ['tipo', 'concepto', 'desc'] as CampoTexto[]) {
        const set = textFilters[campo];
        if (set && set.size > 0 && !set.has(textoDe(f, campo))) return false;
      }
      return true;
    });
  }, [detalle, numFilter, textFilters]);

  /* Agrupado por tipo (en orden de aparición), numerado. */
  const grupos = useMemo(() => {
    const orden: string[] = [];
    const map = new Map<string, PivoteFila[]>();
    filtrado.forEach((f) => {
      if (!map.has(f.tipo)) { map.set(f.tipo, []); orden.push(f.tipo); }
      map.get(f.tipo)!.push(f);
    });
    return orden.map((t) => ({ tipo: t, filas: map.get(t)! }));
  }, [filtrado]);

  /* ── edición inline ── */
  const [edit, setEdit] = useState<{ key: string; mes: string; valor: string } | null>(null);
  const mEditar = useMutation({
    mutationFn: (v: { f: PivoteFila; mes: string; monto: number }) =>
      fideicomisoApi.editarCelda({
        anio,
        mes: idxMes(v.mes) + 1,
        tipo: v.f.tipo,
        concepto: v.f.concepto,
        subconcepto: v.f.subconcepto || '-',
        descripcion: v.f.descripcion || '-',
        monto: v.monto,
      }),
    onSuccess: () => { notify('✓ Guardado'); recargar(); },
    onError: (e) => notify('Error: ' + (e instanceof ApiRequestError ? e.message : '')),
  });

  function confirmarEdit(f: PivoteFila) {
    if (!edit) return;
    const cleaned = edit.valor.replace(/,/g, '').trim();
    const n = Number(cleaned);
    const mes = edit.mes;
    setEdit(null);
    if (cleaned === '' || !Number.isFinite(n)) return;
    if (n === mesValor(f, mes)) return;
    mEditar.mutate({ f, mes, monto: n });
  }

  /* ── toggle IVA ── */
  const mIva = useMutation({
    mutationFn: (v: { f: PivoteFila; mes: string }) =>
      fideicomisoApi.toggleIvaCelda({
        anio,
        mes: idxMes(v.mes) + 1,
        tipo: v.f.tipo,
        concepto: v.f.concepto,
        subconcepto: v.f.subconcepto || '-',
        descripcion: v.f.descripcion || '-',
        aplicaIVA: !v.f.aplicaIVA,
      }),
    onSuccess: (r) => { notify(r.aplicaIVA ? '● IVA activado ✓' : '○ IVA desactivado ✓'); recargar(); },
    onError: (e) => notify(e instanceof ApiRequestError ? e.message : 'Error'),
  });

  /* ── saldo banco ── */
  const mSaldo = useMutation({
    mutationFn: (v: { mes: number; saldo: number | null }) =>
      v.saldo === null
        ? fideicomisoApi.eliminarSaldo(anio, v.mes)
        : fideicomisoApi.guardarSaldo({ anio, mes: v.mes, saldo: v.saldo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fide-conta-saldos', anio] }),
    onError: (e) => notify('Error: ' + (e instanceof ApiRequestError ? e.message : '')),
  });

  /* ── notas tooltip ── */
  const [nota, setNota] = useState<{ texto: string; x: number; y: number } | null>(null);

  /* ── modales ── */
  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalCat, setModalCat] = useState(false);

  return (
    <div className="fide-conta space-y-3">
      <style>{CSS}</style>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-gray-800">Contabilidad</h1>
        <div className="flex items-end gap-2">
          <select
            value={anio}
            onChange={(e) => { setAnio(Number(e.target.value)); setNumFilter(null); setTextFilters({}); }}
            className="year-select"
          >
            {anios.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <button className="btn-nuevo btn-nuevo-cat" onClick={() => setModalCat(true)}>+ Catálogo</button>
          <button className="btn-nuevo" onClick={() => setModalNuevo(true)}>Nuevo</button>
        </div>
      </div>

      {cargando ? (
        <div className="loading"><span className="spinner" />Cargando…</div>
      ) : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th className="c0" />
                <ThTexto label="Tipo" campo="tipo" filas={detalle} get={(f) => f.tipo}
                  filtros={textFilters} setFiltros={setTextFilters} />
                <ThTexto label="Concepto" campo="concepto" filas={detalle} get={(f) => f.concepto}
                  filtros={textFilters} setFiltros={setTextFilters} />
                <ThTexto label="Descripción" campo="desc" filas={detalle} get={(f) => f.descripcion || ''}
                  filtros={textFilters} setFiltros={setTextFilters} colClass="c3" />
                {MESES.map((m) => (
                  <ThNum key={m} mes={m} filas={detalle} numFilter={numFilter} setNumFilter={setNumFilter} />
                ))}
                <th className="th-sub">SubTotal</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                let i = 0;
                const out: ReactNode[] = [];
                grupos.forEach((g) => {
                  g.filas.forEach((f) => {
                    const idx = i;
                    const desc = f.descripcion && f.descripcion !== '-' ? f.descripcion : '';
                    out.push(
                      <tr key={rowKey(f)} className={idx % 2 === 0 ? 'row-even' : 'row-odd'}>
                        <td className="c0">{idx + 1}</td>
                        <td className="c1">{f.tipo}</td>
                        <td className="c2">{f.concepto}</td>
                        <td className="c3" title={desc}>{desc}</td>
                        {MESES.map((m) => {
                          const enEdicion = edit?.key === rowKey(f) && edit.mes === m;
                          const val = mesValor(f, m);
                          const notaTxt = f.notas?.[m] || '';
                          return (
                            <td
                              key={m}
                              className={`num editable${val < 0 ? ' neg' : ''}${enEdicion ? ' editing' : ''}`}
                              onClick={() => { if (!enEdicion) setEdit({ key: rowKey(f), mes: m, valor: val !== 0 ? String(val) : '' }); }}
                            >
                              {notaTxt && (
                                <span
                                  className="note-tri"
                                  onMouseEnter={(e) => setNota({ texto: notaTxt, x: e.clientX, y: e.clientY })}
                                  onMouseLeave={() => setNota(null)}
                                />
                              )}
                              {enEdicion ? (
                                <input
                                  className="cell-input"
                                  type="number"
                                  step="0.01"
                                  autoFocus
                                  value={edit.valor}
                                  onChange={(e) => setEdit({ ...edit, valor: e.target.value })}
                                  onBlur={() => confirmarEdit(f)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); confirmarEdit(f); }
                                    if (e.key === 'Escape') setEdit(null);
                                  }}
                                />
                              ) : (
                                <span className="cell-inner">
                                  {fmt(val)}
                                  <IvaDot
                                    on={f.aplicaIVA === true}
                                    onClick={(e) => { e.stopPropagation(); mIva.mutate({ f, mes: m }); }}
                                  />
                                </span>
                              )}
                            </td>
                          );
                        })}
                        <td className={`num td-sub${(f.Total ?? 0) < 0 ? ' neg' : ''}`}>
                          <span className="cell-inner">
                            {fmt(f.Total)}
                            {f.aplicaIVA && (f.Total ?? 0) !== 0 && <span className="iva-dot" style={{ pointerEvents: 'none' }} />}
                          </span>
                        </td>
                      </tr>,
                    );
                    i++;
                  });
                });
                if (out.length === 0) {
                  out.push(
                    <tr key="vacio"><td colSpan={17} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Sin movimientos registrados en {anio}.
                    </td></tr>,
                  );
                }
                return out;
              })()}

              {/* Totales */}
              {totales.map((t, k) => {
                const isGran = (t.tipo ?? '').toUpperCase().includes('GRAN');
                return (
                  <tr key={`tot-${k}`} className={isGran ? 'tr-gran' : 'tr-total'}>
                    <td className="c0" />
                    <td colSpan={3} style={{ padding: '6px 10px' }}>{t.tipo}</td>
                    {MESES.map((m) => (
                      <td key={m} className={`num${mesValor(t, m) < 0 ? ' neg' : ''}`}>{fmt(mesValor(t, m))}</td>
                    ))}
                    <td className={`num td-sub${(t.Total ?? 0) < 0 ? ' neg' : ''}`}>{fmt(t.Total)}</td>
                  </tr>
                );
              })}

              {/* Saldo Banco */}
              <SaldoRow
                saldos={saldos}
                granTotal={granTotal}
                onGuardar={(mes, saldo) => mSaldo.mutate({ mes, saldo })}
              />
            </tbody>
          </table>
        </div>
      )}

      {/* Leyenda IVA */}
      {!cargando && detalle.length > 0 && (
        <div className="leyenda visible">
          <span className="leyenda-item"><span className="iva-dot" style={{ pointerEvents: 'none' }} /> Aplica IVA</span>
          <span className="leyenda-sep">|</span>
          <span className="leyenda-item"><span className="iva-dot-off" style={{ pointerEvents: 'none', opacity: 0.45 }} /> Sin IVA</span>
          <span className="leyenda-sep">·</span>
          <span>Clic en el punto para activar / desactivar · doble valor: clic en la celda para editar</span>
        </div>
      )}

      {nota && (
        <div className="note-tooltip visible" style={{ left: Math.min(nota.x + 12, window.innerWidth - 240), top: nota.y + 14 }}>
          {nota.texto}
        </div>
      )}

      {toast && <div className="toast show">{toast}</div>}

      {modalNuevo && (
        <ModalNuevo anio={anio} onClose={() => setModalNuevo(false)} onHecho={() => { recargar(); }} notify={notify} />
      )}
      {modalCat && <ModalCatalogo onClose={() => setModalCat(false)} notify={notify} />}
    </div>
  );
}

/* ────────────────────────── encabezados con filtro ────────────────────────── */

function FilterPopover({ children }: { children: ReactNode }) {
  return <div className="fdrop open" style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4 }}>{children}</div>;
}

function ThTexto({
  label, campo, filas, get, filtros, setFiltros, colClass,
}: {
  label: string; campo: CampoTexto; filas: PivoteFila[];
  get: (f: PivoteFila) => string;
  filtros: Partial<Record<CampoTexto, Set<string>>>;
  setFiltros: Dispatch<SetStateAction<Partial<Record<CampoTexto, Set<string>>>>>;
  colClass?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const valores = useMemo(
    () => [...new Set(filas.map(get).filter((v) => v !== undefined))].sort((a, b) => a.localeCompare(b, 'es')),
    [filas, get],
  );
  const activos = filtros[campo];
  const [sel, setSel] = useState<Set<string>>(new Set());
  useEffect(() => { if (abierto) setSel(activos ? new Set(activos) : new Set(valores)); }, [abierto]); // eslint-disable-line

  const cls = colClass ?? (campo === 'tipo' ? 'c1' : 'c2');
  return (
    <th className={cls} style={{ position: 'sticky', zIndex: 4 }}>
      <div className="th-wrap left" style={{ position: 'relative' }}>
        {label}
        <button className={`filter-btn${activos && activos.size ? ' active' : ''}`} onClick={() => setAbierto((v) => !v)}>▼</button>
        {abierto && (
          <FilterPopover>
            <div className="fdrop-head">Filtrar — {label}</div>
            <div className="fdrop-opts">
              <label className="fdrop-opt">
                <input type="checkbox" checked={sel.size === valores.length}
                  onChange={(e) => setSel(e.target.checked ? new Set(valores) : new Set())} /> Todos
              </label>
              {valores.map((v) => (
                <label key={v} className="fdrop-opt">
                  <input type="checkbox" checked={sel.has(v)}
                    onChange={(e) => setSel((s) => { const n = new Set(s); if (e.target.checked) n.add(v); else n.delete(v); return n; })} />
                  {v || '(sin valor)'}
                </label>
              ))}
            </div>
            <div className="fdrop-foot">
              <button onClick={() => { setFiltros((f) => { const n = { ...f }; delete n[campo]; return n; }); setAbierto(false); }}>Limpiar</button>
              <button className="apply" onClick={() => {
                setFiltros((f) => {
                  const n = { ...f };
                  if (sel.size === 0 || sel.size === valores.length) delete n[campo];
                  else n[campo] = new Set(sel);
                  return n;
                });
                setAbierto(false);
              }}>Aplicar</button>
            </div>
          </FilterPopover>
        )}
      </div>
    </th>
  );
}

function ThNum({
  mes, filas, numFilter, setNumFilter,
}: {
  mes: string; filas: PivoteFila[];
  numFilter: { mes: string; valores: Set<string> } | null;
  setNumFilter: (v: { mes: string; valores: Set<string> } | null) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const opciones = useMemo(() => {
    const s = new Set<string>();
    filas.forEach((f) => { const v = mesValor(f, mes); s.add(v === 0 ? '(cero)' : v > 0 ? 'positivos' : 'negativos'); });
    return ['(cero)', 'positivos', 'negativos'].filter((o) => s.has(o));
  }, [filas, mes]);
  const activo = numFilter && numFilter.mes === mes;
  const [sel, setSel] = useState<Set<string>>(new Set());
  useEffect(() => { if (abierto) setSel(activo ? new Set(numFilter!.valores) : new Set(opciones)); }, [abierto]); // eslint-disable-line

  return (
    <th data-mes={mes}>
      <div className="th-wrap" style={{ position: 'relative' }}>
        {mes}
        <button className={`filter-btn${activo ? ' active' : ''}`} onClick={() => setAbierto((v) => !v)}>▼</button>
        {abierto && (
          <FilterPopover>
            <div className="fdrop-head">Filtrar — {mes}</div>
            <div className="fdrop-opts">
              <label className="fdrop-opt">
                <input type="checkbox" checked={sel.size === opciones.length}
                  onChange={(e) => setSel(e.target.checked ? new Set(opciones) : new Set())} /> Todos
              </label>
              {opciones.map((o) => (
                <label key={o} className="fdrop-opt">
                  <input type="checkbox" checked={sel.has(o)}
                    onChange={(e) => setSel((s) => { const n = new Set(s); if (e.target.checked) n.add(o); else n.delete(o); return n; })} /> {o}
                </label>
              ))}
            </div>
            <div className="fdrop-foot">
              <button onClick={() => { setNumFilter(null); setAbierto(false); }}>Limpiar</button>
              <button className="apply" onClick={() => {
                if (sel.size === 0 || sel.size === opciones.length) setNumFilter(null);
                else setNumFilter({ mes, valores: new Set(sel) });
                setAbierto(false);
              }}>Aplicar</button>
            </div>
          </FilterPopover>
        )}
      </div>
    </th>
  );
}

function IvaDot({ on, onClick }: { on: boolean; onClick: (e: ReactMouseEvent) => void }) {
  return (
    <span
      className={on ? 'iva-dot' : 'iva-dot-off'}
      title={on ? 'Aplica IVA — clic para quitar' : 'Sin IVA — clic para activar'}
      onClick={onClick}
    />
  );
}

/* ────────────────────────── Saldo Banco ────────────────────────── */

function SaldoRow({
  saldos, granTotal, onGuardar,
}: {
  saldos: Record<string, number>;
  granTotal: PivoteFila | null;
  onGuardar: (mes: number, saldo: number | null) => void;
}) {
  const [foco, setFoco] = useState<string | null>(null);
  const [valor, setValor] = useState('');

  function abrir(m: string) {
    setFoco(m);
    setValor(saldos[m] !== undefined ? String(saldos[m]) : '');
  }
  function guardar(m: string) {
    const mesNum = idxMes(m) + 1;
    const cleaned = valor.replace(/,/g, '').trim();
    setFoco(null);
    if (cleaned === '') {
      if (saldos[m] !== undefined) onGuardar(mesNum, null);
      return;
    }
    const n = Number(cleaned);
    if (!Number.isFinite(n)) return;
    if (n !== saldos[m]) onGuardar(mesNum, n);
  }

  return (
    <tr className="saldo-row">
      <td className="c0" />
      <td className="c1" colSpan={3}>Saldo estado de cuenta</td>
      {MESES.map((m) => {
        const saldo = saldos[m];
        const gran = granTotal ? mesValor(granTotal, m) : 0;
        let cls = 'saldo-empty';
        let diff = '';
        if (saldo !== undefined) {
          const d = gran - saldo;
          if (Math.abs(d) <= TOLERANCIA) { cls = 'saldo-ok'; diff = '✓ cuadrado'; }
          else { cls = 'saldo-err'; diff = `${d > 0 ? '+' : ''}${fmt(d)}`; }
        }
        return (
          <td key={m} className={cls}>
            <div className="saldo-cell">
              <input
                className="saldo-input"
                inputMode="decimal"
                placeholder="—"
                value={foco === m ? valor : (saldo !== undefined ? fmt(saldo) : '')}
                onFocus={() => abrir(m)}
                onChange={(e) => setValor(e.target.value)}
                onBlur={() => guardar(m)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Tab') (e.target as HTMLInputElement).blur(); }}
              />
              <span className="saldo-diff">{diff}</span>
            </div>
          </td>
        );
      })}
      <td className="td-sub" style={{ background: 'var(--subtotal-bg)' }} />
    </tr>
  );
}

/* ────────────────────────── Modal: Nuevo movimiento ────────────────────────── */

function distintos(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v && v !== '-'))].sort((a, b) => a.localeCompare(b, 'es'));
}

function ModalNuevo({
  anio, onClose, onHecho, notify,
}: {
  anio: number; onClose: () => void; onHecho: () => void; notify: (m: string) => void;
}) {
  const { data: conceptos = [] } = useQuery({
    queryKey: ['fide-conta-conceptos'],
    queryFn: () => fideicomisoApi.contabilidadConceptos(),
    staleTime: 10 * 60 * 1000,
  });

  const [anioF, setAnioF] = useState(String(anio));
  const [mes, setMes] = useState('');
  const [tipo, setTipo] = useState('');
  const [concepto, setConcepto] = useState('');
  const [sub, setSub] = useState('');
  const [desc, setDesc] = useState('');
  const [notas, setNotas] = useState('');
  const [iva, setIva] = useState(false);
  const [monto, setMonto] = useState('');

  const tipos = useMemo(() => distintos(conceptos.map((c) => c.tipo)), [conceptos]);
  const cs = useMemo(() => distintos(conceptos.filter((c) => c.tipo === tipo).map((c) => c.concepto)), [conceptos, tipo]);
  const subs = useMemo(() => distintos(conceptos.filter((c) => c.tipo === tipo && c.concepto === concepto).map((c) => c.subconcepto)), [conceptos, tipo, concepto]);
  const descs = useMemo(
    () => distintos(conceptos.filter((c) => c.tipo === tipo && c.concepto === concepto && (c.subconcepto || '-') === (sub || '-')).map((c) => c.descripcion)),
    [conceptos, tipo, concepto, sub],
  );

  const m = useMutation({
    mutationFn: (reemplazar: boolean) =>
      fideicomisoApi.crearMovimiento({
        anio: Number(anioF),
        mes: Number(mes),
        tipo, concepto,
        subconcepto: sub || '-',
        descripcion: desc || '-',
        monto: Number(monto),
        aplicaIVA: iva,
        notas: notas.trim() || undefined,
        reemplazar,
      }),
    onSuccess: (r) => { notify(r.reemplazado ? 'Registro reemplazado ✓' : 'Movimiento registrado ✓'); onHecho(); onClose(); },
    onError: (e) => {
      if (e instanceof ApiRequestError && e.status === 409) {
        const body = e.body as { montoExistente?: number; fc?: string } | undefined;
        const ok = window.confirm(
          `Ya existe un registro con estos datos.\n` +
          `Monto actual: $${(body?.montoExistente ?? 0).toLocaleString('es-MX')}\n` +
          (body?.fc ? `Fecha: ${new Date(body.fc).toLocaleDateString('es-MX')}\n` : '') +
          `\n¿Deseas reemplazarlo con el nuevo monto de $${Number(monto).toLocaleString('es-MX')}?`,
        );
        if (ok) m.mutate(true);
        return;
      }
      notify('Error: ' + (e instanceof ApiRequestError ? e.message : ''));
    },
  });

  function submit() {
    if (!anioF || !mes || !tipo || !concepto || monto === '' || !Number.isFinite(Number(monto))) {
      notify('Completa todos los campos requeridos');
      return;
    }
    m.mutate(false);
  }

  return (
    <div className="modal-bg open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="modal-head-title">fideContabilidad</span>
            <span className="modal-badge">Row</span>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="m-row">
            <select className="m-select" value={anioF} onChange={(e) => setAnioF(e.target.value)}>
              {[anio - 1, anio, anio + 1, anio - 3, anio - 2].filter((v, i, a) => a.indexOf(v) === i).sort().map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <select className="m-select" value={mes} onChange={(e) => setMes(e.target.value)}>
              <option value="">Mes</option>
              {NOMBRE_MES.map((nm, i) => <option key={nm} value={i + 1}>{nm}</option>)}
            </select>
          </div>
          <Campo label="Tipo">
            <select className="m-select-wide" value={tipo} onChange={(e) => { setTipo(e.target.value); setConcepto(''); setSub(''); setDesc(''); }}>
              <option value="">Tipo</option>
              {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Campo>
          <Campo label="Concepto">
            <select className="m-select-wide" value={concepto} disabled={!tipo} onChange={(e) => { setConcepto(e.target.value); setSub(''); setDesc(''); }}>
              <option value="">Concepto</option>
              {cs.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Campo>
          <Campo label="subConcepto">
            <select className="m-select-wide" value={sub} disabled={!concepto || subs.length === 0} onChange={(e) => { setSub(e.target.value); setDesc(''); }}>
              <option value="">subConcepto</option>
              {subs.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Campo>
          <Campo label="Descripcion">
            <select className="m-select-wide" value={desc} disabled={!concepto || descs.length === 0} onChange={(e) => setDesc(e.target.value)}>
              <option value="">Descripcion</option>
              {descs.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </Campo>
          <Campo label="Notas">
            <textarea rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Comentario opcional…"
              style={{ flex: 1, border: '1.5px solid var(--border)', borderRadius: 8, padding: '7px 10px', fontFamily: 'inherit', fontSize: 12, resize: 'none', background: 'var(--white)', color: 'var(--text)', outline: 'none' }} />
          </Campo>
          <Campo label="Aplica IVA">
            <div style={{ flex: 1, display: 'flex', gap: 16, padding: '6px 0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                <input type="radio" name="m-iva" checked={iva} onChange={() => setIva(true)} /> Sí
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                <input type="radio" name="m-iva" checked={!iva} onChange={() => setIva(false)} /> No
              </label>
            </div>
          </Campo>
          <Campo label="Monto">
            <input className="m-monto-input" type="number" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="Monto"
              style={{ flex: 1, border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontFamily: 'inherit', fontSize: 13, fontWeight: 500, textAlign: 'right', background: 'var(--white)', color: 'var(--text)', outline: 'none' }} />
          </Campo>
        </div>
        <div className="modal-footer">
          <button className="btn-agregar" disabled={m.isPending} onClick={submit}>{m.isPending ? 'Guardando…' : 'Agregar'}</button>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────── Modal: Catálogo ────────────────────────── */

function ModalCatalogo({ onClose, notify }: { onClose: () => void; notify: (m: string) => void }) {
  const queryClient = useQueryClient();
  const { data: conceptos = [] } = useQuery({
    queryKey: ['fide-conta-conceptos'],
    queryFn: () => fideicomisoApi.contabilidadConceptos(),
    staleTime: 10 * 60 * 1000,
  });
  const tipos = useMemo(() => distintos(conceptos.map((c) => c.tipo)), [conceptos]);

  const [tipo, setTipo] = useState('');
  const [concepto, setConcepto] = useState('');
  const [sub, setSub] = useState('');
  const [desc, setDesc] = useState('');
  const [iva, setIva] = useState(false);
  const [ordenTipo, setOrdenTipo] = useState('99');
  const [ordenConcepto, setOrdenConcepto] = useState('99');

  const m = useMutation({
    mutationFn: () =>
      fideicomisoApi.crearConcepto({
        tipo: tipo.trim(),
        concepto: concepto.trim(),
        subconcepto: sub.trim() || undefined,
        descripcion: desc.trim() || undefined,
        aplicaIVA: iva,
        ordenTipo: Number(ordenTipo) || 99,
        ordenConcepto: Number(ordenConcepto) || 99,
      }),
    onSuccess: () => {
      notify('Concepto agregado al catálogo ✓');
      queryClient.invalidateQueries({ queryKey: ['fide-conta-conceptos'] });
      onClose();
    },
    onError: (e) => notify(e instanceof ApiRequestError ? e.message : 'Error'),
  });

  function submit() {
    if (!tipo.trim() || !concepto.trim()) { notify('Tipo y Concepto son obligatorios'); return; }
    m.mutate();
  }

  return (
    <div className="modal-bg open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ width: 380 }}>
        <div className="modal-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="modal-head-title">fideContaConceptos</span>
            <span className="modal-badge" style={{ background: '#1a6b4a' }}>Nuevo</span>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <datalist id="cat-tipos-list">{tipos.map((t) => <option key={t} value={t} />)}</datalist>
          <Campo label="Tipo">
            <input className="m-select-wide" list="cat-tipos-list" value={tipo} onChange={(e) => setTipo(e.target.value)} placeholder="Selecciona o escribe nuevo tipo"
              style={{ padding: '9px 12px' }} />
          </Campo>
          <Campo label="Concepto">
            <input className="m-select-wide" value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Nombre del concepto" style={{ padding: '9px 12px' }} />
          </Campo>
          <Campo label="SubConcepto">
            <input className="m-select-wide" value={sub} onChange={(e) => setSub(e.target.value)} placeholder="Opcional" style={{ padding: '9px 12px' }} />
          </Campo>
          <Campo label="Descripción">
            <input className="m-select-wide" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Opcional" style={{ padding: '9px 12px' }} />
          </Campo>
          <Campo label="Aplica IVA">
            <div style={{ flex: 1, display: 'flex', gap: 16, padding: '6px 0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                <input type="radio" name="cat-iva" checked={iva} onChange={() => setIva(true)} /> Sí
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                <input type="radio" name="cat-iva" checked={!iva} onChange={() => setIva(false)} /> No
              </label>
            </div>
          </Campo>
          <div className="m-field" style={{ gap: 8 }}>
            <span className="m-label">Orden tipo</span>
            <input type="number" min={0} max={999} value={ordenTipo} onChange={(e) => setOrdenTipo(e.target.value)}
              style={{ width: 70, padding: '7px 10px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 12, textAlign: 'center', outline: 'none' }} />
            <span className="m-label" style={{ marginLeft: 8 }}>Orden concepto</span>
            <input type="number" min={0} max={999} value={ordenConcepto} onChange={(e) => setOrdenConcepto(e.target.value)}
              style={{ width: 70, padding: '7px 10px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 12, textAlign: 'center', outline: 'none' }} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-agregar" disabled={m.isPending} onClick={submit}>{m.isPending ? 'Guardando…' : 'Agregar al catálogo'}</button>
        </div>
      </div>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="m-field">
      <span className="m-label">{label} —</span>
      {children}
    </div>
  );
}

/* ────────────────────────── estilos (portados de v1) ────────────────────────── */

const CSS = `
.fide-conta{
  --bg:#e0e1e5;--white:#fff;--row-alt:#d4d5da;--header-dark:#1f2a4d;--header-dark2:#3a3f5c;
  --subtotal-bg:#c8c9ce;--border:#b8b9be;--text:#1a1a2e;--text-muted:#6b6c7e;--neg:#c0392b;
  font-size:13px;color:var(--text);
}
.fide-conta .year-select{font-size:13px;border:1.5px solid var(--header-dark);border-radius:8px;padding:6px 14px;background:#fff;color:var(--text);outline:none;cursor:pointer;min-width:90px;}
.fide-conta .btn-nuevo{font-size:13px;font-weight:600;background:var(--header-dark);color:#fff;border:none;border-radius:8px;padding:7px 20px;cursor:pointer;}
.fide-conta .btn-nuevo:hover{opacity:.87;}
.fide-conta .btn-nuevo-cat{background:transparent;color:var(--header-dark);border:1.5px solid var(--header-dark);}
.fide-conta .btn-nuevo-cat:hover{background:var(--row-alt);}
.fide-conta .tbl-wrap{overflow:auto;max-height:calc(100vh - 14rem);border:1px solid var(--border);border-radius:8px;background:var(--bg);}
.fide-conta table{border-collapse:separate;border-spacing:0;width:100%;font-size:12px;}
.fide-conta th,.fide-conta td{border:1px solid var(--border);white-space:nowrap;padding:0;}
.fide-conta .c0{position:sticky;left:0;z-index:3;width:36px;min-width:36px;}
.fide-conta .c1{position:sticky;left:36px;z-index:3;min-width:150px;max-width:170px;}
.fide-conta .c2{position:sticky;left:186px;z-index:3;min-width:160px;max-width:180px;}
.fide-conta .c3{position:sticky;left:346px;z-index:3;min-width:160px;max-width:200px;border-right:2px solid var(--border)!important;}
.fide-conta thead th{position:sticky;top:0;z-index:5;background:var(--bg);font-size:11px;font-weight:600;color:var(--text);padding:7px 10px;text-align:center;border-bottom:1px solid var(--border);}
.fide-conta thead th.c1,.fide-conta thead th.c2,.fide-conta thead th.c3{text-align:left;z-index:6;}
.fide-conta thead th.th-sub{background:var(--subtotal-bg);border-left:2px solid var(--border)!important;}
.fide-conta tr.row-even td{background:var(--white);}
.fide-conta tr.row-odd td{background:var(--row-alt);}
.fide-conta td.c0{color:var(--text-muted);font-size:10px;text-align:center;padding:5px 4px;}
.fide-conta td.c1{font-size:11px;padding:5px 10px;color:var(--text-muted);}
.fide-conta td.c2{font-size:11px;font-weight:500;padding:5px 10px;color:var(--text);}
.fide-conta td.c3{font-size:10px;padding:5px 10px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;}
.fide-conta td.num{text-align:right;padding:5px 10px;font-variant-numeric:tabular-nums;position:relative;}
.fide-conta td.neg{color:var(--neg);}
.fide-conta td.num.editable:hover{background:#d0d8ff!important;cursor:cell;}
.fide-conta td.num.editing{background:#fff8e1!important;outline:2px solid var(--header-dark);padding:0;}
.fide-conta .cell-input{width:100%;border:none;outline:none;background:transparent;font-family:inherit;font-size:12px;font-weight:500;text-align:right;padding:5px 10px;font-variant-numeric:tabular-nums;color:var(--text);}
.fide-conta td.td-sub{background:var(--subtotal-bg)!important;font-weight:600;border-left:2px solid var(--border)!important;}
.fide-conta td.num .cell-inner{display:flex;align-items:center;justify-content:flex-end;gap:4px;}
.fide-conta tr.tr-total td{background:var(--row-alt);font-weight:600;font-size:11px;padding:6px 10px;}
.fide-conta tr.tr-total td.td-sub{background:var(--subtotal-bg)!important;}
.fide-conta tr.tr-gran td{background:var(--header-dark)!important;color:#fff!important;font-weight:600;font-size:11px;padding:6px 10px;}
.fide-conta tr.tr-gran td.neg{color:#ffb3ad!important;}
.fide-conta tr.tr-gran td.td-sub{background:var(--header-dark2)!important;}
.fide-conta .iva-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#e67e22;flex-shrink:0;cursor:pointer;}
.fide-conta .iva-dot:hover{transform:scale(1.3);opacity:.8;}
.fide-conta .iva-dot-off{display:inline-block;width:5px;height:5px;border-radius:50%;background:#444;flex-shrink:0;cursor:pointer;opacity:.25;}
.fide-conta .iva-dot-off:hover{opacity:.55;transform:scale(1.25);}
.fide-conta .note-tri{position:absolute;top:0;right:0;width:0;height:0;border-style:solid;border-width:0 7px 7px 0;border-color:transparent #e74c3c transparent transparent;cursor:pointer;}
.note-tooltip{display:none;position:fixed;z-index:400;background:#fffbe6;border:1px solid #e6c800;border-radius:6px;padding:8px 10px;font-size:11px;color:#333;max-width:240px;line-height:1.5;box-shadow:2px 2px 8px rgba(0,0,0,.15);white-space:pre-wrap;pointer-events:none;}
.note-tooltip.visible{display:block;}
.fide-conta tr.saldo-row td{background:var(--bg)!important;border-top:2px solid var(--header-dark);padding:0;}
.fide-conta tr.saldo-row td.c1{padding:6px 10px;font-size:11px;font-weight:600;color:var(--text);}
.fide-conta .saldo-cell{display:flex;flex-direction:column;align-items:flex-end;padding:4px 8px;min-height:36px;}
.fide-conta .saldo-input{width:100%;border:none;background:transparent;font-family:inherit;font-size:12px;font-weight:500;text-align:right;color:var(--text);outline:none;font-variant-numeric:tabular-nums;padding:2px 0;cursor:pointer;}
.fide-conta .saldo-diff{font-size:10px;font-variant-numeric:tabular-nums;color:var(--text-muted);line-height:1.2;}
.fide-conta td.saldo-ok{background:#e8f5ee!important;border:1.5px solid #1a6b4a!important;}
.fide-conta td.saldo-err{background:#fdf0ee!important;border:2px solid var(--neg)!important;}
.fide-conta td.saldo-ok .saldo-diff{color:#1a6b4a;font-weight:600;}
.fide-conta td.saldo-err .saldo-diff{color:var(--neg);font-weight:600;}
.fide-conta td.saldo-empty{background:var(--bg)!important;}
.fide-conta .th-wrap{display:flex;align-items:center;justify-content:center;gap:3px;}
.fide-conta .th-wrap.left{justify-content:flex-start;}
.fide-conta .filter-btn{background:none;border:none;cursor:pointer;padding:1px 2px;color:var(--text-muted);font-size:9px;line-height:1;border-radius:3px;opacity:.5;}
.fide-conta .filter-btn:hover{opacity:1;background:var(--border);}
.fide-conta .filter-btn.active{opacity:1;color:var(--header-dark);background:var(--subtotal-bg);}
.fdrop{background:var(--white,#fff);border:1px solid #b8b9be;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,.13);min-width:170px;overflow:hidden;font-size:12px;color:#1a1a2e;text-align:left;}
.fdrop-head{padding:8px 10px 6px;border-bottom:1px solid #b8b9be;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#6b6c7e;}
.fdrop-opts{max-height:200px;overflow-y:auto;}
.fdrop-opt{display:flex;align-items:center;gap:7px;padding:6px 10px;cursor:pointer;border-bottom:.5px solid #e3e3e6;font-weight:400;}
.fdrop-opt:hover{background:#d4d5da;}
.fdrop-foot{padding:6px 10px;border-top:1px solid #b8b9be;display:flex;gap:6px;}
.fdrop-foot button{flex:1;font-size:11px;font-weight:500;padding:4px 0;border-radius:5px;cursor:pointer;border:1px solid #b8b9be;background:#e0e1e5;color:#1a1a2e;}
.fdrop-foot button.apply{background:#1f2a4d;color:#fff;border-color:#1f2a4d;}
.fide-conta .leyenda{display:flex;font-size:11px;color:var(--text-muted);align-items:center;gap:16px;flex-wrap:wrap;}
.fide-conta .loading{padding:28px;text-align:center;font-size:12px;color:#6b6c7e;}
.fide-conta .spinner{display:inline-block;width:13px;height:13px;border:2px solid #b8b9be;border-top-color:#1a1a2e;border-radius:50%;animation:fide-spin .6s linear infinite;vertical-align:middle;margin-right:6px;}
@keyframes fide-spin{to{transform:rotate(360deg);}}
.modal-bg{position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;}
.modal{background:#fff;border-radius:12px;width:340px;max-width:95vw;box-shadow:0 8px 32px rgba(0,0,0,.18);overflow:hidden;--border:#b8b9be;--white:#fff;--text:#1a1a2e;--text-muted:#6b6c7e;--bg:#e0e1e5;--header-dark:#1f2a4d;}
.modal-head{background:#1f2a4d;color:#fff;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;}
.modal-head-title{font-size:12px;font-weight:600;}
.modal-badge{background:#e74c3c;color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;}
.modal-close{background:none;border:none;color:#fff;font-size:18px;cursor:pointer;line-height:1;padding:0 2px;opacity:.8;}
.modal-close:hover{opacity:1;}
.modal-body{padding:14px;}
.m-row{display:flex;gap:8px;margin-bottom:12px;}
.m-select{flex:1;font-size:12px;border:1.5px solid #b8b9be;border-radius:8px;padding:7px 10px;background:#fff;color:#1a1a2e;outline:none;cursor:pointer;}
.m-select-wide{width:100%;font-size:12px;border:1.5px solid #b8b9be;border-radius:8px;padding:9px 12px;background:#fff;color:#1a1a2e;outline:none;}
.m-select-wide:disabled{background:#f0f0f3;color:#6b6c7e;cursor:not-allowed;}
.m-field{display:flex;align-items:center;gap:8px;margin-bottom:10px;}
.m-label{min-width:90px;font-size:11px;font-weight:500;color:#6b6c7e;background:#e0e1e5;border-radius:6px;padding:5px 8px;text-align:center;white-space:nowrap;}
.modal-footer{padding:10px 14px 14px;display:flex;justify-content:flex-end;}
.btn-agregar{font-size:13px;font-weight:600;background:#1f2a4d;color:#fff;border:none;border-radius:8px;padding:9px 28px;cursor:pointer;}
.btn-agregar:hover{opacity:.87;}
.btn-agregar:disabled{opacity:.4;cursor:not-allowed;}
.toast{position:fixed;bottom:20px;right:20px;z-index:200;background:#1f2a4d;color:#fff;font-size:12px;padding:10px 18px;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.2);}
`;
