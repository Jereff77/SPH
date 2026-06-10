import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ppdApi, type FacturaPpd } from './ppd.api';
import { solicitudesApi, type Catalogos } from './solicitudes.api';
import { SearchSelect, type OpcionSelect } from '@/components/SearchSelect';
import { ApiRequestError } from '@/lib/api';

const moneda = (n: number, mon = 'MXN') =>
  n.toLocaleString('es-MX', { style: 'currency', currency: mon });

/**
 * Nueva solicitud de pago parcial sobre una factura PPD YA registrada. No se
 * re-sube el CFDI: solo se captura el monto (≤ disponible), la categoría y la
 * justificación. La parcialidad nace Enviada (pasa por aprobación y pago).
 */
export function NuevaParcialPpd({
  factura,
  onClose,
  onCreada,
}: {
  factura: FacturaPpd;
  onClose: () => void;
  onCreada: () => void;
}) {
  const [idCategoria, setIdCategoria] = useState(factura.idCategoria || '');
  const [justificacion, setJustificacion] = useState('');
  const [monto, setMonto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mon = factura.moneda || 'MXN';

  const { data: catalogos } = useQuery<Catalogos>({
    queryKey: ['cxp-sol-catalogos'],
    queryFn: () => solicitudesApi.catalogos(),
    staleTime: 5 * 60 * 1000,
  });
  const opcionesCat: OpcionSelect[] = useMemo(
    () =>
      (catalogos?.categorias ?? []).map((c) => ({
        value: c.idCategoria,
        label: [c.cuenta, c.seccion].filter(Boolean).join(' / ') || c.idCategoria,
      })),
    [catalogos],
  );

  const mCrear = useMutation({
    mutationFn: () =>
      ppdApi.nuevaParcial(factura.idCxpPPD, {
        idCategoria,
        justificacion,
        monto: Number(monto),
      }),
    onSuccess: onCreada,
    onError: (e) =>
      setError(e instanceof ApiRequestError ? e.message : 'No se pudo crear la solicitud.'),
  });

  const montoNum = Number(monto);
  const montoOk = montoNum > 0 && montoNum <= factura.disponible + 0.01;
  const justOk = justificacion.trim().length >= 20 && justificacion.trim().length <= 100;
  const puedeCrear = !!idCategoria && montoOk && justOk && !mCrear.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-lg font-semibold text-gray-800">Solicitar otro pago</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          {/* Resumen de saldo */}
          <div className="rounded-lg border bg-gray-50 p-3 text-sm">
            <p className="font-medium text-gray-800">
              {factura.nombreProveedor ?? factura.nomCFDI}
            </p>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
              <Linea label="Total factura" valor={moneda(factura.total ?? 0, mon)} />
              <Linea label="Solicitado" valor={moneda(factura.solicitado, mon)} />
              <Linea label="Pagado" valor={moneda(factura.pagado, mon)} />
              <Linea label="Disponible" valor={moneda(factura.disponible, mon)} fuerte />
            </dl>
          </div>

          <label className="block text-xs text-gray-600">
            Monto de este pago{' '}
            <span className={montoOk || !monto ? 'text-gray-400' : 'text-red-500'}>
              (máx. {moneda(factura.disponible, mon)})
            </span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0.00"
              className="mt-1 block w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
            />
            {montoOk && (
              <span className="mt-1 block text-[11px] text-gray-500">
                Quedará disponible {moneda(factura.disponible - montoNum, mon)} tras esta solicitud.
              </span>
            )}
          </label>

          <label className="block text-xs text-gray-600">
            Categoría / Clasificación
            <SearchSelect
              value={idCategoria}
              onChange={setIdCategoria}
              options={opcionesCat}
              placeholder="Selecciona…"
              className="mt-1"
            />
          </label>

          <label className="block text-xs text-gray-600">
            Justificación / nota{' '}
            <span className={justOk || !justificacion ? 'text-gray-400' : 'text-red-500'}>
              ({justificacion.trim().length}/100, mín. 20)
            </span>
            <textarea
              value={justificacion}
              onChange={(e) => setJustificacion(e.target.value)}
              rows={2}
              maxLength={100}
              placeholder="Motivo del pago, referencia, etc."
              className="mt-1 block w-full resize-none rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={() => mCrear.mutate()}
            disabled={!puedeCrear}
            className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#172039] disabled:opacity-40"
          >
            {mCrear.isPending ? 'Enviando…' : 'Solicitar pago'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Linea({ label, valor, fuerte }: { label: string; valor: string; fuerte?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-[11px] uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className={fuerte ? 'font-semibold text-[#1f2a4d]' : 'text-gray-700'}>{valor}</dd>
    </div>
  );
}
