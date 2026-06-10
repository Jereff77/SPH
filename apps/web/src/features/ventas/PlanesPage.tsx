import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ventasApi,
  nombreInversionista,
  TIPOS_PAGO,
  type InversionistaOpt,
  type PagoVentaRow,
  type TipoPago,
} from './ventas.api';
import { ApiRequestError } from '@/lib/api';
import { ConfigPropietarioModal } from './ConfigPropietarioModal';
import { PagoDetalleModal } from './PagoDetalleModal';
import { ComentariosModal } from './ComentariosModal';
import { Tabs, type TabDef } from '@/components/Tabs';
import { SearchSelect } from '@/components/SearchSelect';
import { THEAD_STICKY, THEAD_TR } from '@/components/tabla/SortableTh';
import { IconGear } from '@/components/icons';

const moneda = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const num = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fechaCorta = (iso: string | null): string => {
  if (!iso) return '—';
  const p = (iso.split('T')[0] ?? iso).split('-');
  return p.length === 3 ? `${Number(p[2])}/${Number(p[1])}/${p[0]}` : iso;
};

/** Encabezado fijo bajo la barra de la app (scroll del documento, como el Dashboard). */
const THEAD_PLAN =
  '[&>tr>th]:sticky [&>tr>th]:top-14 [&>tr>th]:z-10 [&>tr>th]:bg-[#1f2a4d]';

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

  const opcionesInv = useMemo(
    () =>
      inversionistas.map((i) => ({ value: i.idInversionista, label: nombreInversionista(i) })),
    [inversionistas],
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight text-gray-800">Ventas · Planes</h1>

      {/* Selectores */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-gray-600">
          Inversionista / Propietario
          <SearchSelect
            value={idInversionista}
            onChange={(v) => {
              setIdInversionista(v);
              setIdPropiedad('');
            }}
            options={opcionesInv}
            placeholder="Selecciona…"
            className="mt-1 w-72"
          />
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
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ['ventas-plan', idPropiedad],
    queryFn: () => ventasApi.plan(idPropiedad),
  });
  const [pagarDe, setPagarDe] = useState<PagoVentaRow | null>(null);
  const [comentarDe, setComentarDe] = useState<PagoVentaRow | null>(null);

  const refrescar = () =>
    queryClient.invalidateQueries({ queryKey: ['ventas-plan', idPropiedad] });

  // Edición del tipo de pago (doble clic en la celda → select + confirmar).
  const [editTipo, setEditTipo] = useState<{ id: string; valor: TipoPago } | null>(null);
  const [errorTipo, setErrorTipo] = useState<string | null>(null);
  const mTipo = useMutation({
    mutationFn: ({ id, tipoPago }: { id: string; tipoPago: TipoPago }) =>
      ventasApi.actualizarTipoPago(id, tipoPago),
    onSuccess: () => {
      setErrorTipo(null);
      setEditTipo(null);
      refrescar();
    },
    onError: (e: unknown) =>
      setErrorTipo(e instanceof ApiRequestError ? e.message : 'No se pudo cambiar el tipo de pago.'),
  });
  function confirmarTipo(r: PagoVentaRow) {
    if (!editTipo) return;
    if (editTipo.valor !== r.tipoPago) {
      mTipo.mutate({ id: r.idPdpDet, tipoPago: editTipo.valor });
    } else {
      setEditTipo(null);
    }
  }

  const totales = useMemo(
    () =>
      data.reduce(
        (t, r) => {
          t.monto += r.monto ?? 0;
          t.construccion += r.pagos_construccion ?? 0;
          t.terreno += r.pagos_terreno ?? 0;
          t.pagos += r.pagos ?? 0;
          t.balance += r.balance ?? 0;
          return t;
        },
        { monto: 0, construccion: 0, terreno: 0, pagos: 0, balance: 0 },
      ),
    [data],
  );
  const avanceTotal = totales.monto > 0 ? (totales.pagos * 100) / totales.monto : null;
  const hayDescuento = data.some((r) => (r.descuentos ?? 0) > 0);
  const haySaldoFavor = data.some((r) => (r.balance ?? 0) > 0);

  if (!isLoading && data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-white p-10 text-center text-sm text-gray-400">
        Esta propiedad no tiene plan de pagos.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {errorTipo && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{errorTipo}</div>
      )}
      <div className="rounded-xl border bg-white">
        <table className="min-w-full border-collapse text-sm">
          <thead className={THEAD_PLAN}>
            <tr className={THEAD_TR}>
              <th className="px-3 py-3 text-center">#</th>
              <th className="px-3 py-3 text-left">Tipo pago</th>
              <th className="px-3 py-3 text-left">Fecha</th>
              <th className="px-3 py-3 text-right">Monto</th>
              <th className="px-3 py-3 text-left">Fecha Pago</th>
              <th className="px-3 py-3 text-right">Movimiento</th>
              <th className="px-3 py-3 text-right">Pagos</th>
              <th className="px-3 py-3 text-right">Balance</th>
              <th className="px-3 py-3 text-right">% Avance</th>
              <th className="px-3 py-3 text-center">Opciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                  Cargando…
                </td>
              </tr>
            ) : (
              data.map((r) => {
                const conDescuento = (r.descuentos ?? 0) > 0;
                const saldoFavor = (r.balance ?? 0) > 0;
                return (
                  <tr key={r.idPdpDet} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-center">{r.numPago ?? '—'}</td>
                    <td className="px-3 py-2">
                      {editTipo?.id === r.idPdpDet ? (
                        <div className="flex items-center gap-1">
                          <select
                            autoFocus
                            value={editTipo.valor}
                            disabled={mTipo.isPending}
                            onChange={(e) =>
                              setEditTipo({ id: r.idPdpDet, valor: e.target.value as TipoPago })
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') confirmarTipo(r);
                              if (e.key === 'Escape') setEditTipo(null);
                            }}
                            className="rounded border border-[#3f5b87] px-1 py-0.5 text-sm focus:outline-none"
                          >
                            {TIPOS_PAGO.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => confirmarTipo(r)}
                            disabled={mTipo.isPending}
                            title="Confirmar cambio"
                            aria-label="Confirmar"
                            className="rounded bg-[#90BF32]/20 px-1.5 py-0.5 text-sm font-bold text-[#3f5b1a] hover:bg-[#90BF32]/40 disabled:opacity-50"
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditTipo(null)}
                            title="Cancelar"
                            aria-label="Cancelar"
                            className="rounded bg-gray-100 px-1.5 py-0.5 text-sm font-bold text-gray-500 hover:bg-gray-200"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <span
                          onDoubleClick={() =>
                            setEditTipo({
                              id: r.idPdpDet,
                              valor: (TIPOS_PAGO.includes(r.tipoPago as TipoPago)
                                ? r.tipoPago
                                : 'Parcialidad') as TipoPago,
                            })
                          }
                          title="Doble clic para cambiar el tipo de pago"
                          className="cursor-pointer rounded px-1 py-0.5 hover:bg-gray-100"
                        >
                          {r.tipoPago ?? '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{fechaCorta(r.fecha)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {conDescuento && (
                        <span title="Contiene descuento" className="mr-1">
                          ⚠️
                        </span>
                      )}
                      {moneda(r.monto)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{fechaCorta(r.fecha_pagos)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-baseline justify-end gap-1 leading-tight">
                        <span className="text-[10px] font-semibold text-gray-400">C:</span>
                        <span className="text-[11px] tabular-nums text-gray-600">
                          {num(r.pagos_construccion)}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-end gap-1 leading-tight">
                        <span className="text-[10px] font-semibold text-gray-400">T:</span>
                        <span className="text-[11px] tabular-nums text-gray-600">
                          {num(r.pagos_terreno)}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{moneda(r.pagos)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {saldoFavor ? (
                        <span className="text-green-600">＋{moneda(r.balance)}</span>
                      ) : (
                        moneda(r.balance)
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.porcentaje_avance != null ? `${r.porcentaje_avance}%` : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPagarDe(r)}
                          title="Registrar pago"
                          className="rounded-full bg-[#1f2a4d] px-2 py-1 text-xs font-bold text-white hover:bg-[#2a376a]"
                        >
                          $
                        </button>
                        <button
                          type="button"
                          onClick={() => setComentarDe(r)}
                          title="Comentarios"
                          className="text-[#3f5b87] hover:text-[#1f2a4d]"
                          aria-label="Comentarios"
                        >
                          💬
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {!isLoading && data.length > 0 && (
            <tfoot className="[&>tr>td]:sticky [&>tr>td]:bottom-0 [&>tr>td]:z-10 [&>tr>td]:bg-[#5b6b8c]">
              <tr className="font-semibold text-white">
                <td className="px-3 py-2" colSpan={3}>
                  Totales
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{moneda(totales.monto)}</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-1.5">
                  <div className="flex items-baseline justify-end gap-1 leading-tight">
                    <span className="text-[10px] text-white/70">C:</span>
                    <span className="text-[11px] tabular-nums">{num(totales.construccion)}</span>
                  </div>
                  <div className="flex items-baseline justify-end gap-1 leading-tight">
                    <span className="text-[10px] text-white/70">T:</span>
                    <span className="text-[11px] tabular-nums">{num(totales.terreno)}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{moneda(totales.pagos)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{moneda(totales.balance)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {avanceTotal != null ? `${avanceTotal.toFixed(1)}%` : '—'}
                </td>
                <td className="px-3 py-2" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Leyenda */}
      {(hayDescuento || haySaldoFavor) && (
        <div className="flex flex-wrap gap-4 px-1 text-xs text-gray-500">
          {hayDescuento && <span>⚠️ Contiene descuento</span>}
          {haySaldoFavor && (
            <span>
              <span className="text-green-600">＋</span> Saldo a favor
            </span>
          )}
        </div>
      )}

      {pagarDe && (
        <PagoDetalleModal
          fila={pagarDe}
          onClose={() => setPagarDe(null)}
          onGuardado={refrescar}
        />
      )}
      {comentarDe && (
        <ComentariosModal fila={comentarDe} onClose={() => setComentarDe(null)} />
      )}
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
