import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ventasApi,
  hoyMexico,
  TIPO_MOVIMIENTO,
  type PagoRealizado,
  type PagoVentaRow,
  type RegistrarPagoVentaInput,
} from './ventas.api';

const moneda = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const fechaCorta = (iso: string | null): string => {
  if (!iso) return '—';
  const p = (iso.split('T')[0] ?? iso).split('-');
  return p.length === 3 ? `${Number(p[2])}/${Number(p[1])}/${p[0]}` : iso;
};

const esUrl = (u: string | null): u is string => !!u && /^https?:\/\//.test(u);

/** Etiqueta de la operación del pago (1=Pago, 2=Descuento, 3=Devolución). */
const OPERACION: Record<number, string> = { 1: 'Pago', 2: 'Descuento', 3: 'Devolución' };

/**
 * Detalle de pagos de una parcialidad (`pagos` por idPdpDet) + formulario para
 * agregar un pago (replica `PagosDetalle`/`PagosRealizar` de v1). Permite tipo de
 * movimiento (Terreno/Construcción/Ticket), operación (Pago/Descuento/Devolución)
 * y subir el comprobante PDF. La **Devolución** se registra en negativo (resta del
 * monto pagado del plan).
 */
export function PagoDetalleModal({
  fila,
  onClose,
  onGuardado,
}: {
  fila: PagoVentaRow;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const { data: pagos = [], isLoading, refetch } = useQuery({
    queryKey: ['ventas-pago-detalle', fila.idPdpDet],
    queryFn: () => ventasApi.detallePagos(fila.idPdpDet),
  });

  const [tipomovimiento, setTipomovimiento] = useState(2);
  const [tipoOperacion, setTipoOperacion] = useState(1);
  const [fecha, setFecha] = useState(hoyMexico());
  const [monto, setMonto] = useState('');
  const [iva, setIva] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState<string | null>(null);

  const esTicket = tipomovimiento === 3;
  const esDevolucion = tipoOperacion === 3;

  async function eliminar(idPago: string) {
    if (!window.confirm('¿Deseas eliminar este pago?')) return;
    setError(null);
    setEliminando(idPago);
    try {
      await ventasApi.eliminarPago(idPago);
      await refetch();
      onGuardado();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el pago.');
    } finally {
      setEliminando(null);
    }
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const m = Number(monto);
    if (!Number.isFinite(m) || m <= 0) {
      setError('Captura un monto válido.');
      return;
    }
    const input: RegistrarPagoVentaInput = {
      tipomovimiento,
      tipoOperacion,
      fecha,
      monto: m,
      iva: esTicket && iva ? Number(iva) : 0,
      comprobante: archivo,
    };
    setGuardando(true);
    try {
      await ventasApi.registrarPago(fila.idPdpDet, input);
      setMonto('');
      setIva('');
      setArchivo(null);
      await refetch();
      onGuardado();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el pago.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b bg-[#1f2a4d] px-5 py-3 text-white">
          <div>
            <h2 className="text-base font-semibold">Detalle de pagos</h2>
            <p className="text-xs text-white/70">
              {fila.nomDescriptivo ?? '—'} · Pago #{fila.numPago ?? '—'} ·{' '}
              {moneda(fila.monto)}
            </p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white" aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className="space-y-5 p-5">
          {/* Pagos ya registrados */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-700">Pagos registrados</h3>
            <div className="overflow-hidden rounded-lg border">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Movimiento</th>
                    <th className="px-3 py-2">Operación</th>
                    <th className="px-3 py-2 text-right">Monto</th>
                    <th className="px-3 py-2 text-center">Comp.</th>
                    <th className="px-3 py-2 text-center" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-center text-gray-400">
                        Cargando…
                      </td>
                    </tr>
                  ) : pagos.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-center text-gray-400">
                        Sin pagos registrados.
                      </td>
                    </tr>
                  ) : (
                    pagos.map((p) => (
                      <tr key={p.idPago}>
                        <td className="px-3 py-2">{fechaCorta(p.fecha)}</td>
                        <td className="px-3 py-2">
                          {TIPO_MOVIMIENTO[p.tipomovimiento ?? 0] ?? '—'}
                        </td>
                        <td className="px-3 py-2">{OPERACION[p.tipoOperacion ?? 1] ?? 'Pago'}</td>
                        <td
                          className={`px-3 py-2 text-right tabular-nums ${
                            (p.monto ?? 0) < 0 ? 'font-medium text-red-600' : ''
                          }`}
                        >
                          {moneda(p.monto)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <CeldaComprobante
                            pago={p}
                            onSubido={async () => {
                              await refetch();
                              onGuardado();
                            }}
                            onError={setError}
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => eliminar(p.idPago)}
                            disabled={eliminando === p.idPago}
                            title="Eliminar pago"
                            className="text-red-600 hover:text-red-800 disabled:opacity-40"
                            aria-label="Eliminar pago"
                          >
                            {eliminando === p.idPago ? '…' : '🗑'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Agregar pago */}
          <form onSubmit={guardar} className="space-y-3 rounded-lg border bg-gray-50 p-4">
            <h3 className="text-sm font-semibold text-gray-700">Agregar pago</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <label className="text-xs text-gray-600">
                Movimiento
                <select
                  value={tipomovimiento}
                  onChange={(e) => setTipomovimiento(Number(e.target.value))}
                  className="mt-1 block w-full rounded border px-2 py-1.5 text-sm"
                >
                  <option value={1}>Terreno</option>
                  <option value={2}>Construcción</option>
                  <option value={3}>Ticket</option>
                </select>
              </label>
              <label className="text-xs text-gray-600">
                Operación
                <select
                  value={tipoOperacion}
                  onChange={(e) => setTipoOperacion(Number(e.target.value))}
                  className="mt-1 block w-full rounded border px-2 py-1.5 text-sm"
                >
                  <option value={1}>Pago</option>
                  <option value={2}>Descuento</option>
                  <option value={3}>Devolución</option>
                </select>
              </label>
              <label className="text-xs text-gray-600">
                Fecha
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="mt-1 block w-full rounded border px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs text-gray-600">
                Monto
                <input
                  type="number"
                  step="0.01"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className="mt-1 block w-full rounded border px-2 py-1.5 text-right text-sm"
                  placeholder="0.00"
                />
              </label>
              {esTicket && (
                <label className="text-xs text-gray-600">
                  IVA
                  <input
                    type="number"
                    step="0.01"
                    value={iva}
                    onChange={(e) => setIva(e.target.value)}
                    className="mt-1 block w-full rounded border px-2 py-1.5 text-right text-sm"
                    placeholder="0.00"
                  />
                </label>
              )}
              <label className="text-xs text-gray-600">
                Comprobante (PDF)
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                  className="mt-1 block w-full text-xs"
                />
              </label>
            </div>
            {esDevolucion && (
              <p className="text-xs text-amber-700">
                Captura el importe a devolver en <strong>positivo</strong>; se registrará en
                negativo y se descontará del monto ya pagado del plan.
              </p>
            )}
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              >
                Cerrar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="rounded-lg bg-[#1f2a4d] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#2a376a] disabled:opacity-50"
              >
                {guardando ? 'Guardando…' : esDevolucion ? 'Registrar devolución' : 'Registrar pago'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/**
 * Celda de la columna "Comp.": muestra el enlace "ver" si el pago ya tiene
 * comprobante y un botón para **subir/reemplazar** el PDF de un pago ya
 * registrado (sin borrarlo). Útil cuando la factura no estaba lista al pagar.
 */
function CeldaComprobante({
  pago,
  onSubido,
  onError,
}: {
  pago: PagoRealizado;
  onSubido: () => Promise<void> | void;
  onError: (msg: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const tiene = esUrl(pago.comprobante);

  async function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = ''; // permite volver a elegir el mismo archivo
    if (!file) return;
    setSubiendo(true);
    onError('');
    try {
      await ventasApi.subirComprobantePago(pago.idPago, file);
      await onSubido();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'No se pudo subir el comprobante.');
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div className="flex items-center justify-center gap-2">
      {tiene && (
        <a
          href={pago.comprobante as string}
          target="_blank"
          rel="noreferrer"
          className="text-[#3f5b87] underline"
        >
          ver
        </a>
      )}
      <button
        type="button"
        disabled={subiendo}
        onClick={() => inputRef.current?.click()}
        title={tiene ? 'Reemplazar comprobante' : 'Subir comprobante'}
        className="rounded border border-[#3f5b87] px-1.5 py-0.5 text-[11px] font-medium text-[#3f5b87] hover:bg-[#3f5b87] hover:text-white disabled:opacity-40"
      >
        {subiendo ? '…' : tiene ? 'cambiar' : 'subir'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/*"
        onChange={onSelect}
        className="hidden"
      />
    </div>
  );
}
