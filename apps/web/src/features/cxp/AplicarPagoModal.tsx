import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { pagosApi, type PagoRow, type DatosComprobante } from './pagos.api';
import { ApiRequestError } from '@/lib/api';

const moneda = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
const hoyISO = () => new Date().toISOString().split('T')[0]!;

/** Bancos disponibles para la opción "captura de pantalla". */
const BANCOS_CAPTURA = ['Banbajío', 'Actinver'];

type Metodo = 'menu' | 'banco' | 'comprobante' | 'captura';

/**
 * Aplica un pago a una solicitud Aprobada con TRES caminos:
 *  - "banco": asignar un movimiento de `movbancarios` existente.
 *  - "comprobante": subir el PDF del comprobante; el webhook N8N extrae los
 *    datos y se registra el pago (creando el movimiento).
 *  - "captura": elegir banco (Banbajío/Actinver), capturar el monto y subir una
 *    captura/comprobante (PDF/JPG/PNG); sin lectura automática.
 */
export function AplicarPagoModal({
  solicitud,
  onClose,
  onPagada,
}: {
  solicitud: PagoRow;
  onClose: () => void;
  onPagada: () => void;
}) {
  const [metodo, setMetodo] = useState<Metodo>('menu');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Aplicar pago</h2>
            <p className="text-xs text-gray-500">
              {solicitud.nombreProveedor} · Total {moneda(solicitud.total)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {metodo !== 'menu' && (
              <button
                onClick={() => setMetodo('menu')}
                className="text-xs text-[#3f5b87] hover:underline"
              >
                ← Volver
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {metodo === 'menu' && <Menu onElegir={setMetodo} />}
          {metodo === 'banco' && (
            <OpcionBanco solicitud={solicitud} onPagada={onPagada} />
          )}
          {metodo === 'comprobante' && (
            <OpcionComprobante solicitud={solicitud} onPagada={onPagada} />
          )}
          {metodo === 'captura' && (
            <OpcionCaptura solicitud={solicitud} onPagada={onPagada} />
          )}
        </div>
      </div>
    </div>
  );
}

function Menu({ onElegir }: { onElegir: (m: Metodo) => void }) {
  const card =
    'flex flex-col items-start gap-1 rounded-xl border-2 p-5 text-left transition hover:border-[#3f5b87] hover:bg-gray-50';
  return (
    <div className="grid grid-cols-1 gap-3">
      <button onClick={() => onElegir('banco')} className={card}>
        <span className="text-2xl">🏦</span>
        <span className="font-semibold text-gray-800">Asignar movimiento bancario</span>
        <span className="text-xs text-gray-500">
          Selecciona un movimiento ya cargado en banca y aplícalo a esta solicitud.
        </span>
      </button>
      <button onClick={() => onElegir('comprobante')} className={card}>
        <span className="text-2xl">📄</span>
        <span className="font-semibold text-gray-800">Capturar desde comprobante (automático)</span>
        <span className="text-xs text-gray-500">
          Sube el PDF del comprobante; los datos se leen automáticamente.
        </span>
      </button>
      <button onClick={() => onElegir('captura')} className={card}>
        <span className="text-2xl">📸</span>
        <span className="font-semibold text-gray-800">Captura de pantalla del pago</span>
        <span className="text-xs text-gray-500">
          Elige el banco (Banbajío/Actinver), captura el monto y sube la imagen o PDF del pago.
        </span>
      </button>
    </div>
  );
}

// ----------------------- Opción A: movimiento bancario -----------------------

function OpcionBanco({
  solicitud,
  onPagada,
}: {
  solicitud: PagoRow;
  onPagada: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const { data: movs = [], isLoading } = useQuery({
    queryKey: ['cxp-movimientos', solicitud.idCxp],
    queryFn: () => pagosApi.movimientos(solicitud.idCxp),
  });

  const asignar = useMutation({
    mutationFn: (idmov: string) => pagosApi.asignar(solicitud.idCxp, idmov),
    onSuccess: onPagada,
    onError: (e) =>
      setError(e instanceof ApiRequestError ? e.message : 'No se pudo asignar el pago.'),
  });

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      <p className="text-xs text-gray-500">
        Transferencias SPEI sin aplicar cuyo beneficiario coincide con el proveedor
        o cuyo importe es igual al total de la solicitud.
      </p>
      <div className="max-h-[50vh] space-y-2 overflow-auto">
        {isLoading && <p className="text-sm text-gray-400">Cargando movimientos…</p>}
        {!isLoading && movs.length === 0 && (
          <p className="text-sm text-gray-400">
            No hay transferencias SPEI sin aplicar para este proveedor.
          </p>
        )}
        {movs.map((m) => {
          const difiere = (m.importe ?? 0) !== (solicitud.total ?? 0);
          return (
            <div
              key={m.idmov}
              className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
            >
              <div className="min-w-0">
                <div className="font-medium text-gray-800">
                  {moneda(m.importe)}{' '}
                  {difiere && (
                    <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                      ≠ total
                    </span>
                  )}
                </div>
                <div className="truncate text-xs text-gray-500">
                  {m.fecOperacion ?? '—'} · {m.beneficiario ?? m.ordenante ?? '—'}
                  {m.referencia ? ` · Ref. ${m.referencia}` : ''}
                </div>
              </div>
              <button
                onClick={() => asignar.mutate(m.idmov)}
                disabled={asignar.isPending}
                className="shrink-0 rounded-lg bg-[#1f2a4d] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#172039] disabled:opacity-50"
              >
                Asignar
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ----------------------- Opción B: comprobante PDF (N8N) ---------------------

function OpcionComprobante({
  solicitud,
  onPagada,
}: {
  solicitud: PagoRow;
  onPagada: () => void;
}) {
  const [pdf, setPdf] = useState<File | null>(null);
  const [urlComprobante, setUrlComprobante] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({
    importe: String(solicitud.total ?? ''),
    fecOperacion: hoyISO(),
    horaOperacion: '',
    ordenante: '',
    ctaDestino: '',
    bcoDestino: '',
    beneficiario: solicitud.nombreProveedor ?? '',
    concepto: solicitud.concepto ?? '',
    referencia: '',
    autorizacion: '',
    claveRastreo: '',
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const analizar = useMutation({
    mutationFn: () => pagosApi.analizarComprobante(solicitud.idCxp, pdf!),
    onSuccess: ({ datos, urlComprobante: url }) => {
      setError(null);
      setUrlComprobante(url);
      aplicarDatos(datos);
    },
    onError: (e) =>
      setError(e instanceof ApiRequestError ? e.message : 'No se pudo leer el comprobante.'),
  });

  function aplicarDatos(d: DatosComprobante) {
    setF((p) => ({
      ...p,
      importe: d.importe ? String(d.importe) : p.importe,
      fecOperacion: d.fecOperacion || p.fecOperacion,
      horaOperacion: d.horaOperacion || p.horaOperacion,
      ordenante: d.ordenante || p.ordenante,
      ctaDestino: d.ctaDestino || p.ctaDestino,
      bcoDestino: d.bcoDestino || p.bcoDestino,
      beneficiario: d.beneficiario || p.beneficiario,
      concepto: d.concepto || p.concepto,
      referencia: d.referencia || p.referencia,
      autorizacion: d.autorizacion || p.autorizacion,
      claveRastreo: d.claveRastreo || p.claveRastreo,
    }));
  }

  const registrar = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('importe', f.importe);
      fd.append('fecOperacion', f.fecOperacion);
      if (f.horaOperacion) fd.append('horaOperacion', f.horaOperacion);
      fd.append('ordenante', f.ordenante);
      fd.append('ctaDestino', f.ctaDestino);
      fd.append('bcoDestino', f.bcoDestino);
      fd.append('beneficiario', f.beneficiario);
      fd.append('concepto', f.concepto);
      fd.append('referencia', f.referencia);
      fd.append('autorizacion', f.autorizacion);
      fd.append('claveRastreo', f.claveRastreo);
      if (urlComprobante) fd.append('urlComprobante', urlComprobante);
      return pagosApi.registrar(solicitud.idCxp, fd);
    },
    onSuccess: onPagada,
    onError: (e) =>
      setError(e instanceof ApiRequestError ? e.message : 'No se pudo registrar el pago.'),
  });

  const inputCls =
    'mt-1 block w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30';
  const lbl = 'block text-xs text-gray-600';
  const leido = urlComprobante !== '';
  const total = solicitud.total ?? 0;
  const importeNum = Number(f.importe) || 0;
  const coincideMonto = Math.abs(importeNum - total) <= 0.01;

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="flex items-end gap-2">
        <label className={`${lbl} flex-1`}>
          Comprobante (PDF)
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => {
              setPdf(e.target.files?.[0] ?? null);
              setUrlComprobante('');
            }}
            className="mt-1 block w-full text-xs"
          />
        </label>
        <button
          onClick={() => analizar.mutate()}
          disabled={!pdf || analizar.isPending}
          className="rounded-lg bg-[#3f5b87] px-4 py-2 text-sm font-medium text-white hover:bg-[#1f2a4d] disabled:opacity-40"
        >
          {analizar.isPending ? 'Leyendo…' : 'Leer comprobante'}
        </button>
      </div>

      {leido && coincideMonto && (
        <div className="rounded-md bg-green-50 px-3 py-1.5 text-xs text-green-700">
          Comprobante leído. Revisa los datos y registra el pago.
        </div>
      )}
      {importeNum > 0 && !coincideMonto && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          ⚠️ El importe del comprobante ({moneda(importeNum)}) no coincide con el total
          a pagar ({moneda(total)}). Verifica el comprobante.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className={lbl}>
          Importe pagado *
          <input type="number" step="0.01" value={f.importe} onChange={(e) => set('importe', e.target.value)} className={inputCls} />
        </label>
        <label className={lbl}>
          Fecha de operación *
          <input type="date" value={f.fecOperacion} onChange={(e) => set('fecOperacion', e.target.value)} className={inputCls} />
        </label>
        <label className={lbl}>
          Hora
          <input type="time" value={f.horaOperacion} onChange={(e) => set('horaOperacion', e.target.value)} className={inputCls} />
        </label>
        <label className={lbl}>
          Banco destino
          <input value={f.bcoDestino} onChange={(e) => set('bcoDestino', e.target.value)} className={inputCls} />
        </label>
        <label className={lbl}>
          Cuenta destino
          <input value={f.ctaDestino} onChange={(e) => set('ctaDestino', e.target.value)} className={inputCls} />
        </label>
        <label className={lbl}>
          Ordenante
          <input value={f.ordenante} onChange={(e) => set('ordenante', e.target.value)} className={inputCls} />
        </label>
        <label className={`${lbl} col-span-2`}>
          Beneficiario
          <input value={f.beneficiario} onChange={(e) => set('beneficiario', e.target.value)} className={inputCls} />
        </label>
        <label className={`${lbl} col-span-2`}>
          Concepto del pago
          <input value={f.concepto} onChange={(e) => set('concepto', e.target.value)} className={inputCls} />
        </label>
        <label className={lbl}>
          Referencia
          <input value={f.referencia} onChange={(e) => set('referencia', e.target.value)} className={inputCls} />
        </label>
        <label className={lbl}>
          N.º autorización
          <input value={f.autorizacion} onChange={(e) => set('autorizacion', e.target.value)} className={inputCls} />
        </label>
        <label className={lbl}>
          Clave de rastreo
          <input value={f.claveRastreo} onChange={(e) => set('claveRastreo', e.target.value)} className={inputCls} />
        </label>
      </div>

      <div className="flex justify-end pt-1">
        <button
          onClick={() => registrar.mutate()}
          disabled={registrar.isPending || !coincideMonto}
          title={!coincideMonto ? 'El importe debe coincidir con el total a pagar' : undefined}
          className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#172039] disabled:opacity-50"
        >
          {registrar.isPending ? 'Registrando…' : 'Registrar pago'}
        </button>
      </div>
    </div>
  );
}

// ----------------- Opción C: captura de pantalla del pago -------------------

function OpcionCaptura({
  solicitud,
  onPagada,
}: {
  solicitud: PagoRow;
  onPagada: () => void;
}) {
  const [banco, setBanco] = useState('');
  const [importe, setImporte] = useState(String(solicitud.total ?? ''));
  const [fecha, setFecha] = useState(hoyISO());
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const total = solicitud.total ?? 0;
  const importeNum = Number(importe) || 0;
  const coincide = Math.abs(importeNum - total) <= 0.01;

  const aplicar = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('importe', importe);
      fd.append('fecOperacion', fecha);
      fd.append('bcoDestino', banco);
      fd.append('beneficiario', solicitud.nombreProveedor ?? '');
      fd.append('concepto', solicitud.concepto ?? '');
      if (archivo) fd.append('comprobante', archivo);
      return pagosApi.registrar(solicitud.idCxp, fd);
    },
    onSuccess: onPagada,
    onError: (e) =>
      setError(e instanceof ApiRequestError ? e.message : 'No se pudo aplicar el pago.'),
  });

  const inputCls =
    'mt-1 block w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30';
  const lbl = 'block text-xs text-gray-600';
  const puede = !!banco && coincide && !!archivo && !aplicar.isPending;

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <label className={lbl}>
        Banco *
        <select value={banco} onChange={(e) => setBanco(e.target.value)} className={inputCls}>
          <option value="">Selecciona el banco…</option>
          {BANCOS_CAPTURA.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      </label>

      <label className={lbl}>
        Monto pagado * (debe ser igual al total: {moneda(total)})
        <input
          type="number"
          step="0.01"
          value={importe}
          onChange={(e) => setImporte(e.target.value)}
          className={inputCls}
        />
      </label>
      {importeNum > 0 && !coincide && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          ⚠️ El monto ({moneda(importeNum)}) debe coincidir con el total a pagar ({moneda(total)}).
        </div>
      )}

      <label className={lbl}>
        Fecha del pago
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} />
      </label>

      <label className={lbl}>
        Comprobante / captura de pantalla * (PDF, JPG o PNG)
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
          onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
          className="mt-1 block w-full text-xs"
        />
      </label>

      <div className="flex justify-end pt-1">
        <button
          onClick={() => aplicar.mutate()}
          disabled={!puede}
          title={!puede ? 'Selecciona banco, monto igual al total y el comprobante' : undefined}
          className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#172039] disabled:opacity-50"
        >
          {aplicar.isPending ? 'Aplicando…' : 'Aplicar pago'}
        </button>
      </div>
    </div>
  );
}
