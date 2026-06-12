import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fideicomisoApi, type PagoFila } from './fideicomiso.api';
import { ApiRequestError } from '@/lib/api';
import { SearchSelect, type OpcionSelect } from '@/components/SearchSelect';
import { useSort } from '@/components/tabla/useSort';
import { SortableTh, THEAD_STICKY, THEAD_TR } from '@/components/tabla/SortableTh';
import { IconGear } from '@/components/icons';
import { moneda, fechaCorta } from './format';
import { AportacionPagoModal } from './AportacionPagoModal';
import { ComentariosAportacionModal } from './ComentariosAportacionModal';
import { ConfigFideModal } from './ConfigFideModal';

/**
 * Fideicomiso → Aportaciones (clave 510). Réplica de `aportaciones_widget` de v1:
 * selector inversionista (+ engrane de configuración) → propiedad-ticket → tabla
 * de la vista `v_pagos` con # / Tipo Pago / Fecha Plan (editable) / Plan de Pagos /
 * Fecha Pago / Pagos / Balance / % Avance / opciones ($ pagos · 💬 comentarios).
 */
export function AportacionesPage() {
  const queryClient = useQueryClient();
  const [inv, setInv] = useState('');
  const [prop, setProp] = useState('');
  const [modalPago, setModalPago] = useState<PagoFila | null>(null);
  const [modalComent, setModalComent] = useState<PagoFila | null>(null);
  const [avisoConfig, setAvisoConfig] = useState(false);
  const [edit, setEdit] = useState<{ id: string; valor: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: invs = [] } = useQuery({
    queryKey: ['fide-aport-invs'],
    queryFn: () => fideicomisoApi.aportacionesInversionistas(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: props = [] } = useQuery({
    queryKey: ['fide-aport-props', inv],
    queryFn: () => fideicomisoApi.aportacionesPropiedades(inv),
    enabled: !!inv,
  });

  const { data: pagos = [], isLoading } = useQuery({
    queryKey: ['fide-aport-pagos', prop],
    queryFn: () => fideicomisoApi.aportacionesPagos(prop),
    enabled: !!prop,
  });

  const optInv: OpcionSelect[] = useMemo(
    () => invs.map((i) => ({ value: i.idInversionista, label: i.etiqueta })),
    [invs],
  );
  const optProp: OpcionSelect[] = useMemo(
    () => props.map((p) => ({ value: p.idPropiedad, label: p.nomDescriptivo ?? p.idPropiedad })),
    [props],
  );

  const { ordenados, sortKey, dir, toggle } = useSort<PagoFila>(
    pagos,
    {
      numPago: (p) => p.numPago,
      tipoPago: (p) => p.tipoPago,
      fecha: (p) => p.fecha,
      monto: (p) => p.monto,
      fecha_pagos: (p) => p.fecha_pagos,
      pagos: (p) => p.pagos,
      balance: (p) => (p.pagos ?? 0) - (p.monto ?? 0),
      avance: (p) => (p.porcentaje_avance != null ? Number(p.porcentaje_avance) : null),
    },
    { key: 'numPago', dir: 'asc' },
  );

  const totales = useMemo(
    () =>
      pagos.reduce(
        (a, p) => {
          a.plan += p.monto ?? 0;
          a.pagos += p.pagos ?? 0;
          a.balance += (p.pagos ?? 0) - (p.monto ?? 0);
          return a;
        },
        { plan: 0, pagos: 0, balance: 0 },
      ),
    [pagos],
  );

  const refetchPagos = () =>
    queryClient.invalidateQueries({ queryKey: ['fide-aport-pagos', prop] });

  const mFecha = useMutation({
    mutationFn: ({ id, fecha }: { id: string; fecha: string }) =>
      fideicomisoApi.editarFechaPartida(id, fecha),
    onSuccess: () => { setError(null); refetchPagos(); },
    onError: (e) => setError(e instanceof ApiRequestError ? e.message : 'No se pudo guardar la fecha.'),
  });

  function abrirEdit(p: PagoFila) {
    if (!p.idPdpDet) return;
    setError(null);
    setEdit({ id: p.idPdpDet, valor: (p.fecha ?? '').slice(0, 10) });
  }
  function confirmarEdit(p: PagoFila) {
    if (!edit) return;
    const val = edit.valor;
    setEdit(null);
    if (val && val !== (p.fecha ?? '').slice(0, 10)) {
      mFecha.mutate({ id: edit.id, fecha: val });
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight text-gray-800">Fideicomiso</h1>

      {/* Toolbar: inversionista + engrane (config) + propiedad + id */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500">Inversionista</label>
          <SearchSelect
            value={inv}
            onChange={(v) => { setInv(v); setProp(''); }}
            options={optInv}
            placeholder="Selecciona inversionista…"
            className="mt-1 w-[320px]"
          />
        </div>
        <button
          type="button"
          onClick={() => setAvisoConfig(true)}
          disabled={!inv}
          title="Configuración del inversionista"
          aria-label="Configuración"
          className="mb-0.5 rounded-lg border p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-40"
        >
          <IconGear width={18} height={18} />
        </button>
        {avisoConfig && inv && (
          <ConfigFideModal idInversionista={inv} onClose={() => setAvisoConfig(false)} />
        )}
        <div>
          <label className="block text-xs font-medium text-gray-500">Propiedad</label>
          <SearchSelect
            value={prop}
            onChange={setProp}
            options={optProp}
            placeholder={inv ? 'Selecciona propiedad…' : 'Elige un inversionista primero'}
            disabled={!inv}
            className="mt-1 w-[320px]"
          />
        </div>
        {prop && <span className="mb-1.5 self-end text-xs text-gray-400">{prop}</span>}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {!prop && (
        <p className="rounded-lg border border-dashed bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">
          Selecciona inversionista y propiedad para ver su plan de pagos.
        </p>
      )}

      {prop && (
        <div className="max-h-[calc(100vh-20rem)] overflow-auto rounded-xl border bg-white shadow-sm">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className={THEAD_STICKY}>
              <tr className={THEAD_TR}>
                <SortableTh align="center">#</SortableTh>
                <SortableTh campo="tipoPago" sortKey={sortKey} dir={dir} onSort={toggle}>Tipo Pago</SortableTh>
                <SortableTh campo="fecha" sortKey={sortKey} dir={dir} onSort={toggle} align="center">Fecha Plan</SortableTh>
                <SortableTh campo="monto" sortKey={sortKey} dir={dir} onSort={toggle} align="right">Plan de Pagos</SortableTh>
                <SortableTh campo="fecha_pagos" sortKey={sortKey} dir={dir} onSort={toggle} align="center">Fecha Pago</SortableTh>
                <SortableTh campo="pagos" sortKey={sortKey} dir={dir} onSort={toggle} align="right">Pagos</SortableTh>
                <SortableTh campo="balance" sortKey={sortKey} dir={dir} onSort={toggle} align="right">Balance</SortableTh>
                <SortableTh campo="avance" sortKey={sortKey} dir={dir} onSort={toggle} align="center">% Avance</SortableTh>
                <SortableTh align="center">opciones</SortableTh>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && (
                <tr><td colSpan={9} className="px-4 py-6 text-center text-gray-400">Cargando…</td></tr>
              )}
              {!isLoading && ordenados.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-6 text-center text-gray-400">Sin plan de pagos.</td></tr>
              )}
              {ordenados.map((p, i) => {
                const balance = (p.pagos ?? 0) - (p.monto ?? 0);
                const enEdicion = edit?.id === p.idPdpDet;
                return (
                  <tr key={p.idPdpDet ?? i} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-center text-gray-500">{i + 1}</td>
                    <td className="px-4 py-2 text-gray-700">{p.tipoPago ?? '-'}</td>
                    <td className="px-4 py-2 text-center">
                      {enEdicion ? (
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="date"
                            autoFocus
                            value={edit.valor}
                            onChange={(e) => setEdit({ ...edit, valor: e.target.value })}
                            onBlur={() => confirmarEdit(p)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') confirmarEdit(p);
                              if (e.key === 'Escape') setEdit(null);
                            }}
                            className="rounded border border-[#3f5b87] px-1 py-0.5 text-sm"
                          />
                        </div>
                      ) : (
                        <span
                          onDoubleClick={() => abrirEdit(p)}
                          title="Doble clic para editar la fecha del plan"
                          className="cursor-pointer rounded px-1 py-0.5 hover:bg-gray-100"
                        >
                          {fechaCorta(p.fecha)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{moneda(p.monto)}</td>
                    <td className="px-4 py-2 text-center text-gray-600">{fechaCorta(p.fecha_pagos)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{moneda(p.pagos)}</td>
                    <td className={`px-4 py-2 text-right tabular-nums ${balance < 0 ? 'text-red-600' : ''}`}>
                      {moneda(balance)}
                    </td>
                    <td className="px-4 py-2 text-center text-gray-600">
                      {p.porcentaje_avance != null
                        ? `${Number(p.porcentaje_avance).toLocaleString('es-MX', { maximumFractionDigits: 2 })}%`
                        : '—'}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => setModalPago(p)}
                          title="Pagos"
                          aria-label="Pagos"
                          className="text-[#1f2a4d] hover:opacity-70"
                        >
                          {/* moneda / $ */}
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm.9 15.4v1.1h-1.6v-1.05c-1.2-.13-2.3-.6-3-1.2l.7-1.45c.7.5 1.7.95 2.7.95.9 0 1.5-.37 1.5-1 0-.6-.5-.9-1.7-1.3-1.6-.55-2.9-1.2-2.9-2.85 0-1.3.93-2.3 2.4-2.55V6.45h1.6v1.05c1 .1 1.8.45 2.4.9l-.68 1.4c-.5-.35-1.3-.8-2.3-.8-1 0-1.4.45-1.4.9 0 .53.55.8 1.9 1.3 1.75.6 2.7 1.35 2.7 2.9 0 1.3-.93 2.4-2.5 2.7Z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => setModalComent(p)}
                          title="Comentarios"
                          aria-label="Comentarios"
                          className="text-[#1f2a4d] hover:opacity-70"
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2Z" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {ordenados.length > 0 && (
              <tfoot>
                <tr className="sticky bottom-0 bg-[#1f2a4d] font-semibold text-white">
                  <td className="px-4 py-2 text-center" colSpan={3}>TOTALES ({ordenados.length})</td>
                  <td className="px-4 py-2 text-right tabular-nums">{moneda(totales.plan)}</td>
                  <td className="px-4 py-2" />
                  <td className="px-4 py-2 text-right tabular-nums">{moneda(totales.pagos)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{moneda(totales.balance)}</td>
                  <td className="px-4 py-2" colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {modalPago && (
        <AportacionPagoModal
          partida={modalPago}
          onClose={() => setModalPago(null)}
          onGuardado={refetchPagos}
        />
      )}
      {modalComent && (
        <ComentariosAportacionModal partida={modalComent} onClose={() => setModalComent(null)} />
      )}

    </div>
  );
}

