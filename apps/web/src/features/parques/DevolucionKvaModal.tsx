import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiRequestError } from '@/lib/api';
import { kvasApi, ETIQUETA_NIVEL, type AsignacionKva } from './kvas.api';

const inputCls =
  'mt-1 w-full rounded-lg border px-2 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#1f2a4d]';

const fmt = (n: number) => n.toLocaleString('es-MX', { maximumFractionDigits: 2 });

interface Props {
  asignacion: AsignacionKva;
  onClose: () => void;
  onListo: () => void;
}

/**
 * Registra la devolución de KVA VENDIDOS al parque.
 *
 * El documento es OBLIGATORIO: es lo que acredita que los KVA regresaron, y sin
 * él la nave no se puede liberar. Admite devolución PARCIAL (nunca más de lo
 * pendiente; el backend lo revalida).
 */
export function DevolucionKvaModal({ asignacion, onClose, onListo }: Props) {
  const pendiente = asignacion.pendiente;
  const [cantidad, setCantidad] = useState(String(pendiente));
  const [fechaDevolucion, setFechaDevolucion] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [documento, setDocumento] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: previas } = useQuery({
    queryKey: ['kvas', 'devoluciones', asignacion.idKvas],
    queryFn: () => kvasApi.devoluciones(asignacion.idKvas),
  });

  const guardar = useMutation({
    mutationFn: async () => {
      // `documento` = folio (texto) · `archivo` = el PDF/imagen probatoria.
      // Van en campos distintos del multipart para que no colisionen.
      const form = new FormData();
      form.append('cantidad', cantidad);
      form.append('fechaDevolucion', fechaDevolucion);
      form.append('documento', documento.trim());
      if (observaciones.trim()) form.append('observaciones', observaciones.trim());
      form.append('archivo', archivo!);
      return kvasApi.registrarDevolucion(asignacion.idKvas, form);
    },
    onSuccess: onListo,
    onError: (e) =>
      setError(e instanceof ApiRequestError ? e.message : 'No se pudo registrar.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const n = Number(cantidad);
    if (!Number.isFinite(n) || n <= 0) return setError('Indica cuántos KVA regresaron.');
    if (n > pendiente) return setError(`Solo quedan ${fmt(pendiente)} KVA por devolver.`);
    if (!documento.trim()) return setError('Captura el folio del documento.');
    if (!archivo) return setError('Adjunta el documento que acredita la devolución.');
    guardar.mutate();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-3 rounded-xl bg-white p-5 shadow-xl"
      >
        <h2 className="text-base font-semibold text-gray-800">
          Devolución de KVA al parque
        </h2>
        <p className="text-xs text-gray-500">
          Nave {asignacion.nave ?? asignacion.idNave} ·{' '}
          {ETIQUETA_NIVEL[asignacion.nivel]} · pendiente{' '}
          <strong>{fmt(pendiente)}</strong> de {fmt(asignacion.cantKvas)} KVA.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs text-gray-600">
            KVA devueltos
            <input
              type="number"
              step="0.01"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block text-xs text-gray-600">
            Fecha de devolución
            <input
              type="date"
              value={fechaDevolucion}
              onChange={(e) => setFechaDevolucion(e.target.value)}
              className={inputCls}
            />
          </label>
        </div>

        <label className="block text-xs text-gray-600">
          Folio / número del documento
          <input
            value={documento}
            onChange={(e) => setDocumento(e.target.value)}
            placeholder="p. ej. baja de contrato CFE"
            className={inputCls}
          />
        </label>

        <label className="block text-xs text-gray-600">
          Documento probatorio (PDF o imagen)
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            className="mt-1 w-full text-xs text-gray-600"
          />
        </label>

        <label className="block text-xs text-gray-600">
          Observaciones
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            rows={2}
            className={inputCls}
          />
        </label>

        {previas && previas.length > 0 && (
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <p className="font-medium">Devoluciones previas</p>
            <ul className="mt-1 space-y-0.5">
              {previas.map((d) => (
                <li key={d.idDevolucion} className="flex justify-between gap-2">
                  <span>
                    {d.fechaDevolucion} · {d.documento}
                  </span>
                  <span className="tabular-nums">{fmt(d.cantidad)} KVA</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardar.isPending}
            className="rounded-lg bg-[#1f2a4d] px-3 py-1.5 text-sm text-white hover:bg-[#172039] disabled:opacity-50"
          >
            {guardar.isPending ? 'Registrando…' : 'Registrar devolución'}
          </button>
        </div>
      </form>
    </div>
  );
}
