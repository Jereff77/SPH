import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { pagosApi, type PagoRow } from './pagos.api';
import { ApiRequestError } from '@/lib/api';

const hoyISO = () => new Date().toISOString().split('T')[0]!;
const moneda = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

/**
 * Registra un pago (carga manual del movimiento bancario) contra una solicitud
 * Aprobada. Captura los datos del comprobante + el archivo, y al guardar el
 * backend inserta el movimiento y aplica el pago (idEstado→Pagado).
 */
export function RegistrarPagoModal({
  solicitud,
  onClose,
  onPagada,
}: {
  solicitud: PagoRow;
  onClose: () => void;
  onPagada: () => void;
}) {
  const [importe, setImporte] = useState(String(solicitud.total ?? ''));
  const [fecOperacion, setFecOperacion] = useState(hoyISO());
  const [horaOperacion, setHoraOperacion] = useState('');
  const [ordenante, setOrdenante] = useState('');
  const [ctaDestino, setCtaDestino] = useState('');
  const [bcoDestino, setBcoDestino] = useState('');
  const [beneficiario, setBeneficiario] = useState(solicitud.nombreProveedor ?? '');
  const [concepto, setConcepto] = useState(solicitud.concepto ?? '');
  const [referencia, setReferencia] = useState('');
  const [autorizacion, setAutorizacion] = useState('');
  const [claveRastreo, setClaveRastreo] = useState('');
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('importe', importe);
      fd.append('fecOperacion', fecOperacion);
      if (horaOperacion) fd.append('horaOperacion', horaOperacion);
      fd.append('ordenante', ordenante);
      fd.append('ctaDestino', ctaDestino);
      fd.append('bcoDestino', bcoDestino);
      fd.append('beneficiario', beneficiario);
      fd.append('concepto', concepto);
      fd.append('referencia', referencia);
      fd.append('autorizacion', autorizacion);
      fd.append('claveRastreo', claveRastreo);
      if (comprobante) fd.append('comprobante', comprobante);
      return pagosApi.registrar(solicitud.idCxp, fd);
    },
    onSuccess: onPagada,
    onError: (e) =>
      setError(e instanceof ApiRequestError ? e.message : 'No se pudo registrar el pago.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (Number(importe) > 0 && fecOperacion) guardar.mutate();
  }

  const inputCls =
    'mt-1 block w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30';
  const lbl = 'block text-xs text-gray-600';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-xl flex-col rounded-xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-lg font-semibold text-gray-800">Registrar pago</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="space-y-3 overflow-y-auto px-5 py-4">
          <div className="rounded-lg bg-gray-50 p-3 text-sm">
            <div className="font-medium text-gray-800">{solicitud.nombreProveedor ?? '—'}</div>
            <div className="text-gray-500">
              Total de la factura: <span className="font-semibold">{moneda(solicitud.total ?? 0)}</span>
              {solicitud.folio && <span className="ml-2 font-mono text-xs">· {solicitud.folio}</span>}
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className={lbl}>
              Importe pagado *
              <input type="number" step="0.01" value={importe} onChange={(e) => setImporte(e.target.value)} className={inputCls} />
            </label>
            <label className={lbl}>
              Fecha de operación *
              <input type="date" value={fecOperacion} onChange={(e) => setFecOperacion(e.target.value)} className={inputCls} />
            </label>
            <label className={lbl}>
              Hora de operación
              <input type="time" value={horaOperacion} onChange={(e) => setHoraOperacion(e.target.value)} className={inputCls} />
            </label>
            <label className={lbl}>
              Banco destino
              <input value={bcoDestino} onChange={(e) => setBcoDestino(e.target.value)} className={inputCls} />
            </label>
            <label className={lbl}>
              Cuenta destino
              <input value={ctaDestino} onChange={(e) => setCtaDestino(e.target.value)} className={inputCls} />
            </label>
            <label className={lbl}>
              Ordenante
              <input value={ordenante} onChange={(e) => setOrdenante(e.target.value)} className={inputCls} />
            </label>
            <label className={`${lbl} col-span-2`}>
              Beneficiario
              <input value={beneficiario} onChange={(e) => setBeneficiario(e.target.value)} className={inputCls} />
            </label>
            <label className={`${lbl} col-span-2`}>
              Concepto del pago
              <input value={concepto} onChange={(e) => setConcepto(e.target.value)} className={inputCls} />
            </label>
            <label className={lbl}>
              Referencia
              <input value={referencia} onChange={(e) => setReferencia(e.target.value)} className={inputCls} />
            </label>
            <label className={lbl}>
              N.º autorización
              <input value={autorizacion} onChange={(e) => setAutorizacion(e.target.value)} className={inputCls} />
            </label>
            <label className={lbl}>
              Clave de rastreo
              <input value={claveRastreo} onChange={(e) => setClaveRastreo(e.target.value)} className={inputCls} />
            </label>
            <label className={lbl}>
              Comprobante (PDF/imagen)
              <input
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => setComprobante(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-xs"
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardar.isPending || !(Number(importe) > 0)}
            className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#172039] disabled:opacity-50"
          >
            {guardar.isPending ? 'Registrando…' : 'Registrar pago'}
          </button>
        </div>
      </form>
    </div>
  );
}
