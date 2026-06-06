import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ventasApi, MESES, type PagoVentaRow, type RentaCombinadaRow } from './ventas.api';
import { TarjetaResumen } from './TarjetaResumen';
import { PagoDetalleModal } from './PagoDetalleModal';
import { useVentasRealtime } from './useVentasRealtime';
import { Tabs, type TabDef } from '@/components/Tabs';
import { SortableTh, THEAD_STICKY, THEAD_TR } from '@/components/tabla/SortableTh';
import { useSort, type Accessors } from '@/components/tabla/useSort';

const moneda = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const fechaCorta = (iso: string | null): string => {
  if (!iso) return '—';
  const p = (iso.split('T')[0] ?? iso).split('-');
  return p.length === 3 ? `${Number(p[2])}/${Number(p[1])}/${p[0]}` : iso;
};

/** ¿La parcialidad está vencida y sin cobrar? (rojo, como v1). */
function vencidaSinPago(r: PagoVentaRow): boolean {
  if ((r.pagos ?? 0) > 0) return false;
  if (!r.fecha) return false;
  const f = new Date(`${r.fecha.split('T')[0]}T00:00:00`);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return f < hoy;
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

const TABS: TabDef[] = [
  { id: 'planes', label: 'Planes de pago' },
  { id: 'rentas', label: 'Renta Garantizada & Administrada' },
];

const TIPOS_RENTA = ['Todos', 'Garantizada', 'Administrada'];

export function DashboardVentasPage() {
  const queryClient = useQueryClient();
  const ahora = new Date();
  const [anio, setAnio] = useState(ahora.getFullYear());
  const [mes, setMes] = useState(ahora.getMonth() + 1);
  const [activo, setActivo] = useState(true);
  const [tab, setTab] = useState('planes');
  const [tipoRenta, setTipoRenta] = useState('Todos');
  const [pagarDe, setPagarDe] = useState<PagoVentaRow | null>(null);

  const { data: filtros } = useQuery({
    queryKey: ['ventas-filtros'],
    queryFn: () => ventasApi.filtros(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: tarjetas } = useQuery({
    queryKey: ['ventas-tarjetas', anio, mes],
    queryFn: () => ventasApi.tarjetas(anio, mes),
  });

  const { data: filas = [], isLoading } = useQuery({
    queryKey: ['ventas-tabla', anio, mes, activo],
    queryFn: () => ventasApi.tabla(anio, mes, activo),
  });

  const { data: rentas = [], isLoading: cargandoRentas } = useQuery({
    queryKey: ['ventas-rentas', anio, mes, tipoRenta],
    queryFn: () => ventasApi.rentas(anio, mes, tipoRenta),
    enabled: tab === 'rentas',
  });

  // Tiempo real: ante cambios en `pagos` (incluso desde v1), refresca.
  const onCambio = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['ventas-tabla'] });
    void queryClient.invalidateQueries({ queryKey: ['ventas-tarjetas'] });
    void queryClient.invalidateQueries({ queryKey: ['ventas-rentas'] });
  }, [queryClient]);
  useVentasRealtime(onCambio);

  const { ordenados, sortKey, dir, toggle } = useSort(filas, ACCESSORS, {
    key: 'fecha',
    dir: 'asc',
  });

  const anios = filtros?.anios?.length ? filtros.anios : [anio];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight text-gray-800">Ventas · Dashboard</h1>

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
        <label className="text-xs text-gray-600">
          Mes
          <select
            value={mes}
            onChange={(e) => setMes(Number(e.target.value))}
            className="mt-1 block rounded border px-2 py-1.5 text-sm"
          >
            {MESES.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </label>
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

      {/* Tarjetas */}
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
          titulo={`${MESES[mes - 1]} ${anio}`}
          lineas={[
            { label: 'Objetivo', valor: tarjetas?.mes.objetivo ?? 0 },
            { label: 'Terreno', valor: tarjetas?.mes.terreno ?? 0 },
            { label: 'Construcción', valor: tarjetas?.mes.construccion ?? 0 },
            { label: 'Ticket', valor: tarjetas?.mes.ticket ?? 0 },
          ]}
        />
        <TarjetaResumen
          titulo="Cobranza real del mes"
          lineas={[
            { label: 'Cobranza', valor: tarjetas?.mes.cobranza ?? 0 },
            { label: 'Descuentos', valor: tarjetas?.mes.descuentos ?? 0 },
            { label: 'Balance', valor: tarjetas?.mes.balance ?? 0, balance: true },
          ]}
        />
      </div>

      <Tabs tabs={TABS} activo={tab} onChange={setTab} />

      {tab === 'planes' ? (
        <div className="overflow-auto rounded-xl border bg-white" style={{ maxHeight: '60vh' }}>
          <table className="min-w-full border-collapse text-sm">
            <thead className={`${THEAD_STICKY}`}>
              <tr className={THEAD_TR}>
                <th className="px-4 py-3" />
                <SortableTh campo="fecha" sortKey={sortKey} dir={dir} onSort={toggle}>
                  Fecha
                </SortableTh>
                <SortableTh campo="propiedad" sortKey={sortKey} dir={dir} onSort={toggle}>
                  Propiedad
                </SortableTh>
                <SortableTh campo="cliente" sortKey={sortKey} dir={dir} onSort={toggle}>
                  Cliente
                </SortableTh>
                <SortableTh campo="parque" sortKey={sortKey} dir={dir} onSort={toggle}>
                  Parque
                </SortableTh>
                <SortableTh campo="numPago" sortKey={sortKey} dir={dir} onSort={toggle} align="center">
                  Pago
                </SortableTh>
                <SortableTh campo="monto" sortKey={sortKey} dir={dir} onSort={toggle} align="right">
                  Monto
                </SortableTh>
                <SortableTh align="right">T</SortableTh>
                <SortableTh align="right">C</SortableTh>
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
                  <td colSpan={11} className="px-4 py-8 text-center text-gray-400">
                    Cargando…
                  </td>
                </tr>
              ) : ordenados.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-gray-400">
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
                      <td className="px-4 py-2 text-right tabular-nums text-gray-500">
                        {moneda(r.pagos_terreno)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-gray-500">
                        {moneda(r.pagos_construccion)}
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
          </table>
        </div>
      ) : (
        <RentasTab
          rentas={rentas}
          cargando={cargandoRentas}
          tipo={tipoRenta}
          onTipo={setTipoRenta}
        />
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
  tipo,
  onTipo,
}: {
  rentas: RentaCombinadaRow[];
  cargando: boolean;
  tipo: string;
  onTipo: (t: string) => void;
}) {
  return (
    <div className="space-y-3">
      <label className="text-xs text-gray-600">
        Tipo de renta
        <select
          value={tipo}
          onChange={(e) => onTipo(e.target.value)}
          className="ml-2 rounded border px-2 py-1.5 text-sm"
        >
          {TIPOS_RENTA.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <div className="overflow-auto rounded-xl border bg-white" style={{ maxHeight: '60vh' }}>
        <table className="min-w-full border-collapse text-sm">
          <thead className={THEAD_STICKY}>
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
    </div>
  );
}
