import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ventasApi,
  hoyMexico,
  MESES,
  type PagoVentaRow,
  type RentaCombinadaRow,
} from './ventas.api';
import { TarjetaResumen } from './TarjetaResumen';
import { PagoDetalleModal } from './PagoDetalleModal';
import { useVentasRealtime } from './useVentasRealtime';
import { Tabs, type TabDef } from '@/components/Tabs';
import { SortableTh, THEAD_TR } from '@/components/tabla/SortableTh';
import { FiltroColumnaOpciones } from '@/components/tabla/FiltroColumnaOpciones';
import { MultiSearchSelect } from '@/components/MultiSearchSelect';
import { useSort, type Accessors } from '@/components/tabla/useSort';

/**
 * Encabezado fijo del Dashboard: pega bajo el header de la app (top-14) usando el
 * scroll del documento (sin scroll interno → un solo scrollbar en la pantalla).
 */
const THEAD_DASHBOARD =
  '[&>tr>th]:sticky [&>tr>th]:top-14 [&>tr>th]:z-10 [&>tr>th]:bg-[#1f2a4d]';

const moneda = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

/** Número sin símbolo (para las cifras apiladas C/T/F y A/D, como v1). */
const num = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Celda apilada con etiqueta + valor (estilo v1: "C: 0.00"). */
function LineaApilada({ etiqueta, valor }: { etiqueta: string; valor: number | null | undefined }) {
  return (
    <div className="flex items-baseline justify-end gap-1 leading-tight">
      <span className="text-[10px] font-semibold text-gray-400">{etiqueta}</span>
      <span className="text-[11px] tabular-nums text-gray-600">{num(valor)}</span>
    </div>
  );
}

const fechaCorta = (iso: string | null): string => {
  if (!iso) return '—';
  const p = (iso.split('T')[0] ?? iso).split('-');
  return p.length === 3 ? `${Number(p[2])}/${Number(p[1])}/${p[0]}` : iso;
};

/** ¿La parcialidad está vencida y sin cobrar? (rojo, como v1). Compara fechas en MX. */
function vencidaSinPago(r: PagoVentaRow): boolean {
  if ((r.pagos ?? 0) > 0) return false;
  if (!r.fecha) return false;
  const vence = r.fecha.split('T')[0] ?? r.fecha;
  return vence < hoyMexico();
}

const ACCESSORS: Accessors<PagoVentaRow> = {
  fecha: (r) => r.fecha,
  propiedad: (r) => r.nomDescriptivo,
  cliente: (r) => r.razonsocial,
  parque: (r) => r.nomParque,
  numPago: (r) => r.numPago,
  monto: (r) => r.monto,
  pagos: (r) => r.pagos,
  balance: (r) => r.balance,
};

/** Valores distintos de una columna (sin vacíos), ordenados es-MX. */
function opcionesCol(
  filas: PagoVentaRow[],
  sel: (r: PagoVentaRow) => string | null | undefined,
): string[] {
  return [...new Set(filas.map((r) => sel(r) ?? '').filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'es', { numeric: true }),
  );
}

const TABS: TabDef[] = [
  { id: 'planes', label: 'Planes de pago' },
  { id: 'rg', label: 'Renta Garantizada' },
  { id: 'ra', label: 'Renta Administrada' },
];

const TODOS_MESES = Array.from({ length: 12 }, (_, i) => i + 1);
const OPCIONES_MESES = MESES.map((m, i) => ({ value: String(i + 1), label: m }));

export function DashboardVentasPage() {
  const queryClient = useQueryClient();
  const ahora = new Date();
  const [anio, setAnio] = useState(ahora.getFullYear());
  // Uno o varios meses (1-12). Vacío = todo el año.
  const [meses, setMeses] = useState<number[]>([ahora.getMonth() + 1]);
  const [activo, setActivo] = useState(true);
  const [tab, setTab] = useState('planes');
  const [pagarDe, setPagarDe] = useState<PagoVentaRow | null>(null);

  // Meses efectivos para consultar: vacío se interpreta como todo el año.
  const mesesEfectivos = useMemo(
    () => (meses.length ? [...meses].sort((a, b) => a - b) : TODOS_MESES),
    [meses],
  );
  const mesesKey = mesesEfectivos.join(',');
  const etiquetaMeses =
    mesesEfectivos.length >= 12
      ? 'todo el año'
      : mesesEfectivos.length === 1
        ? MESES[mesesEfectivos[0]! - 1]
        : `${mesesEfectivos.length} meses`;

  // Filtros de columna (multi-selección — regla de diseño 7c)
  const [propSel, setPropSel] = useState<Set<string>>(new Set());
  const [cliSel, setCliSel] = useState<Set<string>>(new Set());
  const [parqueSel, setParqueSel] = useState<Set<string>>(new Set());
  // Al cambiar de periodo cambian los datos: se limpian los filtros.
  useEffect(() => {
    setPropSel(new Set());
    setCliSel(new Set());
    setParqueSel(new Set());
  }, [anio, mesesKey, activo]);

  // Cada pestaña de renta filtra v_rentasCombinadas por su tipo_renta.
  const tipoRenta = tab === 'rg' ? 'Garantizada' : tab === 'ra' ? 'Administrada' : '';

  const { data: filtros } = useQuery({
    queryKey: ['ventas-filtros'],
    queryFn: () => ventasApi.filtros(),
    staleTime: 5 * 60 * 1000,
  });

  // Si el año por defecto (año en curso) no está entre los disponibles, usar el más reciente.
  useEffect(() => {
    if (filtros?.anios?.length && !filtros.anios.includes(anio)) setAnio(filtros.anios[0]!);
  }, [filtros, anio]);

  const { data: tarjetas } = useQuery({
    queryKey: ['ventas-tarjetas', anio, mesesKey, activo],
    queryFn: () => ventasApi.tarjetas(anio, mesesEfectivos, activo),
  });

  const { data: filas = [], isLoading } = useQuery({
    queryKey: ['ventas-tabla', anio, mesesKey, activo],
    queryFn: () => ventasApi.tabla(anio, mesesEfectivos, activo),
  });

  const { data: rentas = [], isLoading: cargandoRentas } = useQuery({
    queryKey: ['ventas-rentas', anio, mesesKey, tipoRenta],
    queryFn: () => ventasApi.rentas(anio, mesesEfectivos, tipoRenta),
    enabled: tab === 'rg' || tab === 'ra',
  });

  // Tiempo real: ante cambios en `pagos` (incluso desde v1), refresca.
  const onCambio = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['ventas-tabla'] });
    void queryClient.invalidateQueries({ queryKey: ['ventas-tarjetas'] });
    void queryClient.invalidateQueries({ queryKey: ['ventas-rentas'] });
  }, [queryClient]);
  useVentasRealtime(onCambio);

  // Opciones distintas para los filtros de columna.
  const optProp = useMemo(() => opcionesCol(filas, (r) => r.nomDescriptivo), [filas]);
  const optCli = useMemo(() => opcionesCol(filas, (r) => r.razonsocial), [filas]);
  const optParque = useMemo(() => opcionesCol(filas, (r) => r.nomParque), [filas]);

  const filtradas = useMemo(
    () =>
      filas.filter((r) => {
        if (propSel.size > 0 && !propSel.has(r.nomDescriptivo ?? '')) return false;
        if (cliSel.size > 0 && !cliSel.has(r.razonsocial ?? '')) return false;
        if (parqueSel.size > 0 && !parqueSel.has(r.nomParque ?? '')) return false;
        return true;
      }),
    [filas, propSel, cliSel, parqueSel],
  );

  const { ordenados, sortKey, dir, toggle } = useSort(filtradas, ACCESSORS, {
    key: 'fecha',
    dir: 'asc',
  });

  // Totales del pie: suma de las filas mostradas (siempre cuadra con la tabla).
  const totales = useMemo(
    () =>
      filtradas.reduce(
        (t, r) => {
          t.monto += r.monto ?? 0;
          t.construccion += r.pagos_construccion ?? 0;
          t.terreno += r.pagos_terreno ?? 0;
          t.ticket += r.pagos_ticket ?? 0;
          t.pagos += r.pagos ?? 0;
          t.descuentos += r.descuentos ?? 0;
          t.balance += r.balance ?? 0;
          return t;
        },
        {
          monto: 0,
          construccion: 0,
          terreno: 0,
          ticket: 0,
          pagos: 0,
          descuentos: 0,
          balance: 0,
        },
      ),
    [filtradas],
  );

  const anios = filtros?.anios?.length ? filtros.anios : [anio];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight text-gray-800">Ventas · Gestión de Cobranza</h1>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-gray-600">
          Año
          <select
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
            className="mt-1 block rounded border px-2 py-1.5 text-sm"
          >
            {anios.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <div className="text-xs text-gray-600">
          <span className="block">Mes</span>
          <MultiSearchSelect
            values={meses.map(String)}
            onChange={(vals) => setMeses(vals.map(Number).sort((a, b) => a - b))}
            options={OPCIONES_MESES}
            placeholder="Todo el año"
            ordenarAlfabetico={false}
            className="mt-1 w-44 text-gray-800"
          />
        </div>
        <div className="flex gap-1">
          {[
            { v: true, label: 'Activo' },
            { v: false, label: 'Inactivo' },
          ].map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => setActivo(c.v)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                activo === c.v
                  ? 'border-[#1f2a4d] bg-[#1f2a4d] text-white'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tarjetas: las 3 muestran objetivo / cobranza / balance. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <TarjetaResumen
          titulo={`Planes de pago ${anio}`}
          lineas={[
            { label: 'Objetivo', valor: tarjetas?.anual.objetivo ?? 0 },
            { label: 'Cobranza', valor: tarjetas?.anual.cobranza ?? 0 },
            { label: 'Balance', valor: tarjetas?.anual.balance ?? 0, balance: true },
          ]}
        />
        <TarjetaResumen
          titulo={`Planes de pago ${etiquetaMeses} ${anio}`}
          lineas={[
            { label: 'Objetivo', valor: tarjetas?.mes.objetivo ?? 0 },
            { label: 'Cobranza', valor: tarjetas?.mes.cobranza ?? 0 },
            { label: 'Balance', valor: tarjetas?.mes.balance ?? 0, balance: true },
          ]}
        />
        <TarjetaResumen
          titulo={`Cobranza real ${etiquetaMeses} ${anio}`}
          lineas={[
            { label: 'Objetivo', valor: tarjetas?.mesReal.objetivo ?? 0 },
            { label: 'Cobranza', valor: tarjetas?.mesReal.cobranza ?? 0 },
            { label: 'Balance', valor: tarjetas?.mesReal.balance ?? 0, balance: true },
          ]}
        />
      </div>

      <Tabs tabs={TABS} activo={tab} onChange={setTab} />

      {tab === 'planes' ? (
        <div className="rounded-xl border bg-white">
          <table className="min-w-full border-collapse text-sm">
            <thead className={THEAD_DASHBOARD}>
              <tr className={THEAD_TR}>
                <th className="px-4 py-3" />
                <SortableTh campo="fecha" sortKey={sortKey} dir={dir} onSort={toggle}>
                  Fecha
                </SortableTh>
                <SortableTh
                  campo="propiedad" sortKey={sortKey} dir={dir} onSort={toggle}
                  filtro={<FiltroColumnaOpciones etiqueta="Propiedad" opciones={optProp} seleccion={propSel} onChange={setPropSel} />}
                >
                  Propiedad
                </SortableTh>
                <SortableTh
                  campo="cliente" sortKey={sortKey} dir={dir} onSort={toggle}
                  filtro={<FiltroColumnaOpciones etiqueta="Cliente" opciones={optCli} seleccion={cliSel} onChange={setCliSel} />}
                >
                  Cliente
                </SortableTh>
                <SortableTh
                  campo="parque" sortKey={sortKey} dir={dir} onSort={toggle}
                  filtro={<FiltroColumnaOpciones etiqueta="Parque" opciones={optParque} seleccion={parqueSel} onChange={setParqueSel} />}
                >
                  Parque
                </SortableTh>
                <SortableTh campo="numPago" sortKey={sortKey} dir={dir} onSort={toggle} align="center">
                  Pago
                </SortableTh>
                <SortableTh campo="monto" sortKey={sortKey} dir={dir} onSort={toggle} align="right">
                  Monto
                </SortableTh>
                <SortableTh align="right">C / T</SortableTh>
                <SortableTh campo="pagos" sortKey={sortKey} dir={dir} onSort={toggle} align="right">
                  Pagado
                </SortableTh>
                <SortableTh campo="balance" sortKey={sortKey} dir={dir} onSort={toggle} align="right">
                  Balance
                </SortableTh>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                    Cargando…
                  </td>
                </tr>
              ) : ordenados.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                    Sin parcialidades para el periodo seleccionado.
                  </td>
                </tr>
              ) : (
                ordenados.map((r) => {
                  const rojo = vencidaSinPago(r);
                  const amarillo = !rojo && r.tipoPago === 'Ticket';
                  const bg = rojo
                    ? 'bg-[#FFC2C2]'
                    : amarillo
                      ? 'bg-[#FFFEC4]'
                      : 'hover:bg-gray-50';
                  return (
                    <tr key={r.idPdpDet} className={bg}>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => setPagarDe(r)}
                          title="Agregar pago"
                          className="rounded-full bg-[#1f2a4d] px-2.5 py-1 text-xs font-bold text-white hover:bg-[#2a376a]"
                        >
                          $
                        </button>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">{fechaCorta(r.fecha)}</td>
                      <td className="px-4 py-2">{r.nomDescriptivo ?? '—'}</td>
                      <td className="px-4 py-2">{r.razonsocial ?? '—'}</td>
                      <td className="px-4 py-2">{r.nomParque ?? '—'}</td>
                      <td className="px-4 py-2 text-center">{r.numPago ?? '—'}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{moneda(r.monto)}</td>
                      <td className="px-4 py-2">
                        <LineaApilada etiqueta="C:" valor={r.pagos_construccion} />
                        <LineaApilada etiqueta="T:" valor={r.pagos_terreno} />
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{moneda(r.pagos)}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium">
                        {moneda(r.balance)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {ordenados.length > 0 && (
              <tfoot className="[&>tr>td]:sticky [&>tr>td]:bottom-0 [&>tr>td]:z-10 [&>tr>td]:bg-[#5b6b8c]">
                <tr className="font-semibold text-white">
                  <td className="px-4 py-2" colSpan={6}>
                    Totales
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{moneda(totales.monto)}</td>
                  <td className="px-4 py-1.5">
                    <div className="flex items-baseline justify-end gap-1 leading-tight">
                      <span className="text-[10px] text-white/70">C:</span>
                      <span className="text-[11px] tabular-nums">{num(totales.construccion)}</span>
                    </div>
                    <div className="flex items-baseline justify-end gap-1 leading-tight">
                      <span className="text-[10px] text-white/70">T:</span>
                      <span className="text-[11px] tabular-nums">{num(totales.terreno)}</span>
                    </div>
                    <div className="flex items-baseline justify-end gap-1 leading-tight">
                      <span className="text-[10px] text-white/70">F:</span>
                      <span className="text-[11px] tabular-nums">{num(totales.ticket)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-1.5">
                    <div className="text-right text-sm tabular-nums">{moneda(totales.pagos)}</div>
                    <div className="flex items-baseline justify-end gap-1 leading-tight">
                      <span className="text-[10px] text-white/70">A:</span>
                      <span className="text-[11px] tabular-nums">
                        {num(totales.pagos - totales.descuentos)}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-end gap-1 leading-tight">
                      <span className="text-[10px] text-white/70">D:</span>
                      <span className="text-[11px] tabular-nums">{num(totales.descuentos)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{moneda(totales.balance)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      ) : (
        <RentasTab rentas={rentas} cargando={cargandoRentas} />
      )}

      {pagarDe && (
        <PagoDetalleModal
          fila={pagarDe}
          onClose={() => setPagarDe(null)}
          onGuardado={onCambio}
        />
      )}
    </div>
  );
}

function RentasTab({
  rentas,
  cargando,
}: {
  rentas: RentaCombinadaRow[];
  cargando: boolean;
}) {
  return (
    <div className="rounded-xl border bg-white">
      <table className="min-w-full border-collapse text-sm">
        <thead className={THEAD_DASHBOARD}>
          <tr className={THEAD_TR}>
            <th className="px-4 py-3 text-left">Propiedad</th>
            <th className="px-4 py-3 text-left">Cliente</th>
            <th className="px-4 py-3 text-left">Tipo</th>
            <th className="px-4 py-3 text-right">Monto</th>
            <th className="px-4 py-3 text-right">Facturado</th>
            <th className="px-4 py-3 text-right">Cobrado</th>
            <th className="px-4 py-3 text-right">Balance mes</th>
            <th className="px-4 py-3 text-left">Pago</th>
          </tr>
        </thead>
          <tbody className="divide-y">
            {cargando ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  Cargando…
                </td>
              </tr>
            ) : rentas.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  Sin rentas para el periodo seleccionado.
                </td>
              </tr>
            ) : (
              rentas.map((r, i) => (
                <tr key={`${r.idPropiedad}-${r.numPago}-${i}`} className="hover:bg-gray-50">
                  <td className="px-4 py-2">{r.nomDescriptivo ?? '—'}</td>
                  <td className="px-4 py-2">{r.razonsocial ?? '—'}</td>
                  <td className="px-4 py-2">{r.tipo_renta ?? '—'}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{moneda(r.monto)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{moneda(r.subtotalFactura)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {moneda(r.subtotalComprobante)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">
                    {moneda(r.balanceMes)}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">{fechaCorta(r.fechaPago)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
    </div>
  );
}
