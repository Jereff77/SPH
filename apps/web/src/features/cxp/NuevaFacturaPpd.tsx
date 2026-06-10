import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ppdApi, type AnalisisPpd } from './ppd.api';
import { solicitudesApi, type Catalogos } from './solicitudes.api';
import { SearchSelect, type OpcionSelect } from '@/components/SearchSelect';
import { ApiRequestError } from '@/lib/api';

const moneda = (n: number, mon = 'MXN') =>
  n.toLocaleString('es-MX', { style: 'currency', currency: mon });

const fecha = (iso: string): string => {
  const p = iso.split('-');
  return p.length === 3 ? `${Number(p[2])}/${Number(p[1])}/${p[0]}` : iso;
};

/**
 * Alta de una factura PPD (Pago en Parcialidades o Diferido) + su PRIMERA
 * solicitud de pago (dosificación). Flujo:
 * 1) Sube XML + PDF del CFDI PPD y pulsa "Analizar".
 * 2) El backend valida (PPD, receptor, proveedor, retenciones…) y devuelve el
 *    total de la factura. Si ya estaba registrada, avisa para usar "Solicitar otro pago".
 * 3) El usuario captura el monto del PRIMER pago (≤ total), Categoría y justificación.
 * 4) "Registrar" crea la factura y su primera parcialidad (Enviada a aprobación).
 */
export function NuevaFacturaPpd({
  onClose,
  onCreada,
}: {
  onClose: () => void;
  onCreada: () => void;
}) {
  const [xml, setXml] = useState<File | null>(null);
  const [pdf, setPdf] = useState<File | null>(null);
  const [analisis, setAnalisis] = useState<AnalisisPpd | null>(null);
  const [idCategoria, setIdCategoria] = useState('');
  const [justificacion, setJustificacion] = useState('');
  const [monto, setMonto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const xmlRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

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

  const mAnalizar = useMutation({
    mutationFn: () => ppdApi.analizar(xml!, pdf!),
    onSuccess: (data) => {
      setError(null);
      setAnalisis(data);
      // Pre-cargar el monto con el total (el usuario lo ajusta para dosificar).
      if (!data.yaRegistrada) setMonto(String(data.cfdi.total));
    },
    onError: (e) => {
      setAnalisis(null);
      setError(e instanceof ApiRequestError ? e.message : 'No se pudo analizar el CFDI.');
    },
  });

  const mCrear = useMutation({
    mutationFn: () =>
      ppdApi.crear(xml!, pdf!, {
        idCategoria,
        justificacion,
        monto: Number(monto),
      }),
    onSuccess: onCreada,
    onError: (e) =>
      setError(e instanceof ApiRequestError ? e.message : 'No se pudo registrar la factura.'),
  });

  const total = analisis?.cfdi.total ?? 0;
  const mon = analisis?.cfdi.moneda ?? 'MXN';
  const montoNum = Number(monto);
  const montoOk = montoNum > 0 && montoNum <= total + 0.01;
  const justOk = justificacion.trim().length >= 20 && justificacion.trim().length <= 100;
  const puedeAnalizar = !!xml && !!pdf && !mAnalizar.isPending;
  const puedeCrear =
    !!analisis &&
    !analisis.yaRegistrada &&
    !!idCategoria &&
    montoOk &&
    justOk &&
    !mCrear.isPending;

  const reanalizar = () => {
    setAnalisis(null);
    setError(null);
    setMonto('');
  };

  const fileBtn =
    'flex-1 cursor-pointer rounded-lg border border-dashed px-3 py-3 text-center text-sm transition hover:bg-gray-50';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-lg font-semibold text-gray-800">Nueva factura PPD</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          {/* Paso 1: archivos */}
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
              1. Archivos del CFDI (PPD)
            </p>
            <div className="flex gap-3">
              <label className={fileBtn}>
                <input
                  ref={xmlRef}
                  type="file"
                  accept=".xml,text/xml,application/xml"
                  className="hidden"
                  onChange={(e) => {
                    setXml(e.target.files?.[0] ?? null);
                    reanalizar();
                  }}
                />
                <span className="block font-medium text-[#1f2a4d]">XML</span>
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
                  onChange={(e) => {
                    setPdf(e.target.files?.[0] ?? null);
                    reanalizar();
                  }}
                />
                <span className="block font-medium text-[#1f2a4d]">PDF</span>
                <span className="block truncate text-xs text-gray-500">
                  {pdf ? pdf.name : 'Seleccionar archivo .pdf'}
                </span>
              </label>
            </div>
            {!analisis && (
              <button
                onClick={() => mAnalizar.mutate()}
                disabled={!puedeAnalizar}
                className="mt-3 w-full rounded-lg bg-[#3f5b87] px-4 py-2 text-sm font-medium text-white hover:bg-[#1f2a4d] disabled:opacity-40"
              >
                {mAnalizar.isPending ? 'Analizando…' : 'Analizar CFDI'}
              </button>
            )}
          </div>

          {/* Si ya estaba registrada, avisar */}
          {analisis?.yaRegistrada && (
            <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Esta factura PPD ya está registrada
              {analisis.saldo
                ? ` (disponible ${moneda(analisis.saldo.disponible, mon)}).`
                : '.'}{' '}
              Ciérrelo y use <strong>“Solicitar otro pago”</strong> desde el estado de cuenta.
            </div>
          )}

          {/* Paso 2: datos + monto del primer pago */}
          {analisis && !analisis.yaRegistrada && (
            <>
              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    2. Datos del CFDI
                  </p>
                  <button onClick={reanalizar} className="text-xs text-[#3f5b87] hover:underline">
                    Cambiar archivos
                  </button>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  <Dato label="Proveedor" valor={analisis.proveedor.razonSocial ?? '—'} />
                  <Dato label="RFC emisor" valor={analisis.cfdi.emisorRfc} />
                  <Dato label="Folio fiscal" valor={analisis.cfdi.uuid ?? '—'} mono />
                  <Dato label="Fecha CFDI" valor={fecha(analisis.cfdi.fechaCFDI)} />
                  <Dato label="Método pago" valor={analisis.cfdi.metodoPago ?? '—'} />
                  <Dato label="Total factura" valor={moneda(total, mon)} />
                </dl>
              </div>

              {/* Paso 3: captura */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  3. Primer pago, clasificación y justificación
                </p>
                <label className="block text-xs text-gray-600">
                  Monto de este pago{' '}
                  <span className={montoOk || !monto ? 'text-gray-400' : 'text-red-500'}>
                    (máx. {moneda(total, mon)})
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
                      Quedará disponible {moneda(total - montoNum, mon)} para futuros pagos.
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
            </>
          )}
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
            {mCrear.isPending ? 'Registrando…' : 'Registrar factura'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Dato({ label, valor, mono }: { label: string; valor: string; mono?: boolean }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className={`truncate text-gray-700 ${mono ? 'font-mono text-xs' : ''}`} title={valor}>
        {valor}
      </dd>
    </div>
  );
}
