import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ppdApi, type ParcialidadPpd } from './ppd.api';
import { ApiRequestError } from '@/lib/api';

const moneda = (n: number, mon = 'MXN') =>
  n.toLocaleString('es-MX', { style: 'currency', currency: mon });

/**
 * Dispensa de complemento por EXCEPCIÓN (permiso 403). Para casos en que el
 * complemento (REP) nunca llegará — p. ej. un proveedor de única vez que no lo
 * emitirá — y, sin esta salida, el usuario quedaría bloqueado permanentemente.
 * Exige un motivo y queda registrado quién lo autorizó.
 */
export function DispensarComplementoModal({
  parcial,
  onClose,
  onDispensado,
}: {
  parcial: ParcialidadPpd;
  onClose: () => void;
  onDispensado: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mDispensar = useMutation({
    mutationFn: () => ppdApi.dispensarComplemento(parcial.idCxp, motivo.trim()),
    onSuccess: onDispensado,
    onError: (e) =>
      setError(e instanceof ApiRequestError ? e.message : 'No se pudo dispensar el complemento.'),
  });

  const ok = motivo.trim().length >= 10 && motivo.trim().length <= 300;
  const puede = ok && !mDispensar.isPending;

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
          <h2 className="text-lg font-semibold text-gray-800">Dispensar complemento (excepción)</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Vas a marcar esta parcialidad (pago de{' '}
            <strong>{moneda(parcial.montoAplicado || parcial.total, parcial.moneda)}</strong>) como{' '}
            <strong>exenta de complemento de pago</strong>. Úsalo solo cuando el REP no se podrá
            obtener (p. ej. proveedor de única vez). Quedará registrado quién y por qué.
          </div>

          <label className="block text-xs text-gray-600">
            Motivo de la excepción{' '}
            <span className={ok || !motivo ? 'text-gray-400' : 'text-red-500'}>
              ({motivo.trim().length}/300, mín. 10)
            </span>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              maxLength={300}
              placeholder="Ej.: Proveedor de única vez; no emitirá el complemento. Autoriza…"
              className="mt-1 block w-full resize-none rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={() => mDispensar.mutate()}
            disabled={!puede}
            className="rounded-lg bg-[#b45309] px-4 py-2 text-sm font-medium text-white hover:bg-[#92400e] disabled:opacity-40"
          >
            {mDispensar.isPending ? 'Dispensando…' : 'Dispensar'}
          </button>
        </div>
      </div>
    </div>
  );
}
