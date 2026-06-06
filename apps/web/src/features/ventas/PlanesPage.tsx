import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ventasApi, type InversionistaOpt } from './ventas.api';
import { ConfigPropietarioModal } from './ConfigPropietarioModal';
import { Tabs, type TabDef } from '@/components/Tabs';
import { THEAD_STICKY, THEAD_TR } from '@/components/tabla/SortableTh';
import { IconGear } from '@/components/icons';

const moneda = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const fechaCorta = (iso: string | null): string => {
  if (!iso) return '—';
  const p = (iso.split('T')[0] ?? iso).split('-');
  return p.length === 3 ? `${Number(p[2])}/${Number(p[1])}/${p[0]}` : iso;
};

const nombreInv = (i: InversionistaOpt): string =>
  i.razonsocial?.trim()
    ? i.razonsocial
    : [i.nombre, i.apellido1, i.apellido2].filter(Boolean).join(' ');

const TABS: TabDef[] = [
  { id: 'plan', label: 'Plan de Pagos' },
  { id: 'rg', label: 'Renta Garantizada' },
  { id: 'ra', label: 'Renta Administrada' },
];

export function PlanesPage() {
  const [idInversionista, setIdInversionista] = useState('');
  const [idPropiedad, setIdPropiedad] = useState('');
  const [tab, setTab] = useState('plan');
  const [config, setConfig] = useState<InversionistaOpt | null>(null);

  const { data: inversionistas = [] } = useQuery({
    queryKey: ['ventas-inversionistas'],
    queryFn: () => ventasApi.inversionistas(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: propiedades = [] } = useQuery({
    queryKey: ['ventas-propiedades', idInversionista],
    queryFn: () => ventasApi.propiedades(idInversionista),
    enabled: !!idInversionista,
  });

  const invSel = useMemo(
    () => inversionistas.find((i) => i.idInversionista === idInversionista) ?? null,
    [inversionistas, idInversionista],
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight text-gray-800">Ventas · Planes</h1>

      {/* Selectores */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-gray-600">
          Inversionista / Propietario
          <select
            value={idInversionista}
            onChange={(e) => {
              setIdInversionista(e.target.value);
              setIdPropiedad('');
            }}
            className="mt-1 block w-72 rounded border px-2 py-1.5 text-sm"
          >
            <option value="">Selecciona…</option>
            {inversionistas.map((i) => (
              <option key={i.idInversionista} value={i.idInversionista}>
                {nombreInv(i)}
              </option>
            ))}
          </select>
        </label>

        {invSel && (
          <button
            type="button"
            onClick={() => setConfig(invSel)}
            title="Configuración del propietario"
            className="flex items-center gap-1.5 rounded-lg border border-[#1f2a4d] px-3 py-2 text-sm font-medium text-[#1f2a4d] hover:bg-[#1f2a4d] hover:text-white"
          >
            <IconGear width={16} height={16} /> Configuración
          </button>
        )}

        {idInversionista && (
          <label className="text-xs text-gray-600">
            Propiedad / Nave
            <select
              value={idPropiedad}
              onChange={(e) => setIdPropiedad(e.target.value)}
              className="mt-1 block w-72 rounded border px-2 py-1.5 text-sm"
            >
              <option value="">Selecciona…</option>
              {propiedades.map((p) => (
                <option key={p.idPropiedad} value={p.idPropiedad}>
                  {p.nomDescriptivo ?? p.nave?.numNaveNAME ?? p.idPropiedad}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {idPropiedad ? (
        <>
          <Tabs tabs={TABS} activo={tab} onChange={setTab} />
          {tab === 'plan' && <PlanTab idPropiedad={idPropiedad} />}
          {tab === 'rg' && <RentaGarantizadaTab idPropiedad={idPropiedad} />}
          {tab === 'ra' && <RentaAdministradaTab idPropiedad={idPropiedad} />}
        </>
      ) : (
        <div className="rounded-xl border border-dashed bg-white p-10 text-center text-sm text-gray-400">
          {idInversionista
            ? 'Selecciona una propiedad para ver sus planes, o usa Configuración para crear uno.'
            : 'Selecciona un inversionista para comenzar.'}
        </div>
      )}

      {config && (
        <ConfigPropietarioModal
          inversionista={config}
          onClose={() => setConfig(null)}
          onCambio={() => {
            // refresca propiedades del inversionista activo
          }}
        />
      )}
    </div>
  );
}

function PlanTab({ idPropiedad }: { idPropiedad: string }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['ventas-plan', idPropiedad],
    queryFn: () => ventasApi.plan(idPropiedad),
  });
  return (
    <div className="overflow-auto rounded-xl border bg-white" style={{ maxHeight: '55vh' }}>
      <table className="min-w-full border-collapse text-sm">
        <thead className={THEAD_STICKY}>
          <tr className={THEAD_TR}>
            <th className="px-4 py-3 text-center">Pago</th>
            <th className="px-4 py-3 text-left">Fecha</th>
            <th className="px-4 py-3 text-right">Monto</th>
            <th className="px-4 py-3 text-right">Pagado</th>
            <th className="px-4 py-3 text-right">Balance</th>
            <th className="px-4 py-3 text-left">Tipo</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {isLoading ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                Cargando…
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                Esta propiedad no tiene plan de pagos.
              </td>
            </tr>
          ) : (
            data.map((r) => (
              <tr key={r.idPdpDet} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-center">{r.numPago ?? '—'}</td>
                <td className="px-4 py-2 whitespace-nowrap">{fechaCorta(r.fecha)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{moneda(r.monto)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{moneda(r.pagos)}</td>
                <td className="px-4 py-2 text-right tabular-nums font-medium">
                  {moneda(r.balance)}
                </td>
                <td className="px-4 py-2">{r.tipoPago ?? '—'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function RentaGarantizadaTab({ idPropiedad }: { idPropiedad: string }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['ventas-rg', idPropiedad],
    queryFn: () => ventasApi.rentaGarantizada(idPropiedad),
  });
  return (
    <div className="overflow-auto rounded-xl border bg-white" style={{ maxHeight: '55vh' }}>
      <table className="min-w-full border-collapse text-sm">
        <thead className={THEAD_STICKY}>
          <tr className={THEAD_TR}>
            <th className="px-4 py-3 text-center">Pago</th>
            <th className="px-4 py-3 text-left">Concepto</th>
            <th className="px-4 py-3 text-left">Fecha</th>
            <th className="px-4 py-3 text-right">Subtotal</th>
            <th className="px-4 py-3 text-right">Facturado</th>
            <th className="px-4 py-3 text-right">Cobrado</th>
            <th className="px-4 py-3 text-center">Pagado</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {isLoading ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                Cargando…
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                Esta propiedad no tiene Renta Garantizada.
              </td>
            </tr>
          ) : (
            data.map((r) => (
              <tr key={r.idRGdet} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-center">{r.numPago ?? '—'}</td>
                <td className="px-4 py-2">{r.concepto ?? '—'}</td>
                <td className="px-4 py-2 whitespace-nowrap">{fechaCorta(r.fecha)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{moneda(r.subtotal)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{moneda(r.subtotalFactura)}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {moneda(r.subtotalComprobante)}
                </td>
                <td className="px-4 py-2 text-center">{r.statusPago ? '✓' : '—'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function RentaAdministradaTab({ idPropiedad }: { idPropiedad: string }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['ventas-ra', idPropiedad],
    queryFn: () => ventasApi.rentaAdministrada(idPropiedad),
  });
  return (
    <div className="overflow-auto rounded-xl border bg-white" style={{ maxHeight: '55vh' }}>
      <table className="min-w-full border-collapse text-sm">
        <thead className={THEAD_STICKY}>
          <tr className={THEAD_TR}>
            <th className="px-4 py-3 text-center">Pago</th>
            <th className="px-4 py-3 text-left">Concepto</th>
            <th className="px-4 py-3 text-left">Fecha</th>
            <th className="px-4 py-3 text-right">Subtotal</th>
            <th className="px-4 py-3 text-right">Total</th>
            <th className="px-4 py-3 text-right">Facturado</th>
            <th className="px-4 py-3 text-right">Cobrado</th>
            <th className="px-4 py-3 text-center">Pagado</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {isLoading ? (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                Cargando…
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                Esta propiedad no tiene Renta Administrada.
              </td>
            </tr>
          ) : (
            data.map((r) => (
              <tr key={r.idRAdet} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-center">{r.numPago ?? '—'}</td>
                <td className="px-4 py-2">{r.concepto ?? '—'}</td>
                <td className="px-4 py-2 whitespace-nowrap">{fechaCorta(r.fecha)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{moneda(r.subtotal)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{moneda(r.total)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{moneda(r.subtotalFactura)}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {moneda(r.subtotalComprobante)}
                </td>
                <td className="px-4 py-2 text-center">{r.statusPago ? '✓' : '—'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
