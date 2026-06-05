import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { pagosApi, type PagoRow } from './pagos.api';
import { ApiRequestError } from '@/lib/api';

const moneda = (n: number | null) =>
  (n ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
const esUrl = (u: string | null): u is string => !!u && /^https?:\/\//.test(u);

/**
 * Muestra el movimiento bancario aplicado a una solicitud (conciliación) y, si
 * el usuario tiene permiso (401), permite desaplicar el pago.
 */
export function TransferenciaModal({
  solicitud,
  puedeDesaplicar,
  onClose,
  onDesaplicada,
}: {
  solicitud: PagoRow;
  puedeDesaplicar: boolean;
  onClose: () => void;
  onDesaplicada: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const { data: mov, isLoading } = useQuery({
    queryKey: ['cxp-transferencia', solicitud.idCxp],
    queryFn: () => pagosApi.verTransferencia(solicitud.idCxp),
  });

  const desaplicar = useMutation({
    mutationFn: () => pagosApi.desaplicar(solicitud.idCxp),
    onSuccess: onDesaplicada,
    onError: (e) =>
      setError(e instanceof ApiRequestError ? e.message : 'No se pudo desaplicar el pago.'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-lg font-semibold text-gray-800">Pago / Transferencia</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="space-y-3 px-5 py-4">
          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          {isLoading && <p className="text-sm text-gray-400">Cargando…</p>}
          {!isLoading && !mov && (
            <p className="text-sm text-gray-400">No se encontró el movimiento bancario.</p>
          )}
          {mov && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Dato label="Importe" valor={moneda(mov.importe)} />
              <Dato label="Fecha operación" valor={mov.fecOperacion ?? '—'} />
              <Dato label="Beneficiario" valor={mov.beneficiario ?? '—'} />
              <Dato label="Ordenante" valor={mov.ordenante ?? '—'} />
              <Dato label="Banco destino" valor={mov.bcoDestino ?? '—'} />
              <Dato label="Cuenta destino" valor={mov.ctaDestino ?? '—'} />
              <Dato label="Referencia" valor={mov.referencia ?? '—'} />
              <Dato label="Autorización" valor={mov.autorizacion ?? '—'} />
              <Dato label="Clave rastreo" valor={mov.rastreo ?? '—'} mono />
              <Dato label="Concepto" valor={mov.cancepto ?? '—'} />
            </dl>
          )}
          {mov && esUrl(mov.imgComp) && (
            <a
              href={mov.imgComp}
              target="_blank"
              rel="noreferrer"
              className="inline-block rounded bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
            >
              Ver comprobante
            </a>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">
            Cerrar
          </button>
          {puedeDesaplicar && (
            <button
              onClick={() => {
                if (window.confirm('¿Desaplicar el pago? La solicitud volverá a estado Aprobado.'))
                  desaplicar.mutate();
              }}
              disabled={desaplicar.isPending}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {desaplicar.isPending ? 'Desaplicando…' : 'Desaplicar pago'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Dato({ label, valor, mono }: { label: string; valor: string; mono?: boolean }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className={`text-gray-700 ${mono ? 'font-mono text-xs' : ''}`}>{valor}</dd>
    </div>
  );
}
