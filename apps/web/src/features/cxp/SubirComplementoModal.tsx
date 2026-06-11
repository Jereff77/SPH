import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ppdApi, type ParcialidadPpd } from './ppd.api';
import { ApiRequestError } from '@/lib/api';

const moneda = (n: number, mon = 'MXN') =>
  n.toLocaleString('es-MX', { style: 'currency', currency: mon });

/**
 * Sube el Complemento de Pago (REP) de una parcialidad PPD ya pagada. El backend
 * valida que el XML sea un comprobante tipo "P" que referencie la factura y cuyo
 * importe coincida con el del pago. El PDF es opcional (respaldo).
 */
export function SubirComplementoModal({
  parcial,
  onClose,
  onSubido,
}: {
  parcial: ParcialidadPpd;
  onClose: () => void;
  onSubido: () => void;
}) {
  const [xml, setXml] = useState<File | null>(null);
  const [pdf, setPdf] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const xmlRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  const mSubir = useMutation({
    mutationFn: () => ppdApi.subirComplemento(parcial.idCxp, xml!, pdf),
    onSuccess: onSubido,
    onError: (e) =>
      setError(e instanceof ApiRequestError ? e.message : 'No se pudo subir el complemento.'),
  });

  const puede = !!xml && !mSubir.isPending;
  const fileBtn =
    'flex-1 cursor-pointer rounded-lg border border-dashed px-3 py-3 text-center text-sm transition hover:bg-gray-50';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-lg flex-col rounded-xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-lg font-semibold text-gray-800">Subir complemento de pago</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <div className="rounded-lg border bg-gray-50 p-3 text-sm text-gray-600">
            Pago de la parcialidad:{' '}
            <strong>{moneda(parcial.montoAplicado || parcial.total, parcial.moneda)}</strong>. Suba
            el <strong>XML</strong> del Complemento de Pago (REP) que el proveedor emitió por este
            pago. El sistema valida que corresponda a esta factura y monto.
          </div>

          <div className="flex gap-3">
            <label className={fileBtn}>
              <input
                ref={xmlRef}
                type="file"
                accept=".xml,text/xml,application/xml"
                className="hidden"
                onChange={(e) => {
                  setXml(e.target.files?.[0] ?? null);
                  setError(null);
                }}
              />
              <span className="block font-medium text-[#1f2a4d]">XML (obligatorio)</span>
              <span className="block truncate text-xs text-gray-500">
                {xml ? xml.name : 'Seleccionar archivo .xml'}
              </span>
            </label>
            <label className={fileBtn}>
              <input
                ref={pdfRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => setPdf(e.target.files?.[0] ?? null)}
              />
              <span className="block font-medium text-[#1f2a4d]">PDF (opcional)</span>
              <span className="block truncate text-xs text-gray-500">
                {pdf ? pdf.name : 'Seleccionar archivo .pdf'}
              </span>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={() => mSubir.mutate()}
            disabled={!puede}
            className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#172039] disabled:opacity-40"
          >
            {mSubir.isPending ? 'Subiendo…' : 'Subir complemento'}
          </button>
        </div>
      </div>
    </div>
  );
}
