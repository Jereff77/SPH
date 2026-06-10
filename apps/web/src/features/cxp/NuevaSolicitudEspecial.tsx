import { useState, type ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  solicitudesApi,
  type Catalogos,
  type CatalogoInversionista,
} from './solicitudes.api';
import { ApiRequestError } from '@/lib/api';
import { SearchSelect, type OpcionSelect } from '@/components/SearchSelect';
import { InputFecha } from '@/components/InputFecha';

/**
 * Alta de los 4 tipos de solicitud "especiales" (sin CFDI con XML):
 * Urgentes, Línea de Captura, Devoluciones y Facturas sin XML. Reescriben los
 * flujos de FlutterFlow `linea_solicitud_urgente`/`linea_captura`/
 * `linea_devolucion`/`linea_factura_sin_x_m_l`. Todos capturan el monto manual,
 * la clasificación (el responsable lo resuelve el backend) y una justificación.
 */

const inputCls =
  'mt-1 block w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30';

const MIN_JUST = 20;
const MAX_JUST = 100;
const justOk = (j: string) =>
  j.trim().length >= MIN_JUST && j.trim().length <= MAX_JUST;

interface Props {
  onClose: () => void;
  onCreada: () => void;
}

// ---------- Piezas compartidas ----------

function ModalShell({
  titulo,
  onClose,
  onSubmit,
  enviando,
  puedeCrear,
  error,
  children,
}: {
  titulo: string;
  onClose: () => void;
  onSubmit: () => void;
  enviando: boolean;
  puedeCrear: boolean;
  error: string | null;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-xl flex-col rounded-xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-lg font-semibold text-gray-800">{titulo}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>
        <div className="space-y-3.5 overflow-y-auto px-5 py-4">
          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          {children}
        </div>
        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={onSubmit}
            disabled={!puedeCrear || enviando}
            className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#172039] disabled:opacity-40"
          >
            {enviando ? 'Creando…' : 'Crear solicitud'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Campo({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <label className="block text-xs text-gray-600">
      {label} {hint}
      {children}
    </label>
  );
}

function CampoJustificacion({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const ok = justOk(value);
  return (
    <Campo
      label="Justificación / nota"
      hint={
        <span className={ok || !value ? 'text-gray-400' : 'text-red-500'}>
          ({value.trim().length}/{MAX_JUST}, mín. {MIN_JUST})
        </span>
      }
    >
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        maxLength={MAX_JUST}
        placeholder="Motivo del pago, referencia, etc."
        className={`${inputCls} resize-none`}
      />
    </Campo>
  );
}

function CampoMonto({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Campo label="Monto">
      <input
        type="number"
        min={0}
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0.00"
        className={inputCls}
      />
    </Campo>
  );
}

function useCatalogos() {
  return useQuery<Catalogos>({
    queryKey: ['cxp-sol-catalogos'],
    queryFn: () => solicitudesApi.catalogos(),
    staleTime: 5 * 60 * 1000,
  });
}

const opcsProveedores = (cat?: Catalogos): OpcionSelect[] =>
  (cat?.proveedores ?? []).map((p) => ({
    value: p.idProveedor,
    label: p.razonSocial,
  }));

const opcsCategorias = (cat?: Catalogos): OpcionSelect[] =>
  (cat?.categorias ?? []).map((c) => ({
    value: c.idCategoria,
    label: [c.cuenta, c.seccion].filter(Boolean).join(' / ') || c.idCategoria,
  }));

const msgError = (e: unknown, fallback: string) =>
  e instanceof ApiRequestError ? e.message : fallback;

// ---------- 1. URGENTES ----------

export function NuevaUrgente({ onClose, onCreada }: Props) {
  const { data: cat } = useCatalogos();
  const [idProveedor, setIdProveedor] = useState('');
  const [idCategoria, setIdCategoria] = useState('');
  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState('');
  const [justificacion, setJustificacion] = useState('');
  const [error, setError] = useState<string | null>(null);

  const total = Number(monto);
  const puedeCrear =
    !!idProveedor && !!idCategoria && concepto.trim() !== '' && total > 0 && justOk(justificacion);

  const m = useMutation({
    mutationFn: () =>
      solicitudesApi.crearUrgente({
        idProveedor,
        idCategoria,
        concepto: concepto.trim(),
        total,
        justificacion: justificacion.trim(),
      }),
    onSuccess: onCreada,
    onError: (e) => setError(msgError(e, 'No se pudo crear la solicitud urgente.')),
  });

  return (
    <ModalShell
      titulo="Nueva solicitud urgente"
      onClose={onClose}
      onSubmit={() => m.mutate()}
      enviando={m.isPending}
      puedeCrear={puedeCrear}
      error={error}
    >
      <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
        Las solicitudes urgentes se envían <b>directo a aprobación</b> (no pasan por
        Guardado).
      </p>
      <Campo label="Proveedor">
        <SearchSelect
          value={idProveedor}
          onChange={setIdProveedor}
          options={opcsProveedores(cat)}
          placeholder="Selecciona proveedor…"
          className="mt-1"
        />
      </Campo>
      <Campo label="Concepto">
        <input
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
          className={inputCls}
          placeholder="Concepto del pago"
        />
      </Campo>
      <CampoMonto value={monto} onChange={setMonto} />
      <Campo label="Categoría / Clasificación">
        <SearchSelect
          value={idCategoria}
          onChange={setIdCategoria}
          options={opcsCategorias(cat)}
          placeholder="Selecciona clasificación…"
          className="mt-1"
        />
      </Campo>
      <CampoJustificacion value={justificacion} onChange={setJustificacion} />
    </ModalShell>
  );
}

// ---------- 2. LÍNEA DE CAPTURA ----------

export function NuevaLineaCaptura({ onClose, onCreada }: Props) {
  const { data: cat } = useCatalogos();
  const [idProveedor, setIdProveedor] = useState('');
  const [idCategoria, setIdCategoria] = useState('');
  const [concepto, setConcepto] = useState('');
  const [lineaCaptura, setLineaCaptura] = useState('');
  const [referencia, setReferencia] = useState('');
  const [fechaLimite, setFechaLimite] = useState('');
  const [monto, setMonto] = useState('');
  const [pagoInmediato, setPagoInmediato] = useState(false);
  const [justificacion, setJustificacion] = useState('');
  const [pdf, setPdf] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const total = Number(monto);
  const puedeCrear =
    !!idProveedor &&
    !!idCategoria &&
    concepto.trim() !== '' &&
    lineaCaptura.trim() !== '' &&
    referencia.trim() !== '' &&
    fechaLimite !== '' &&
    total > 0 &&
    !!pdf &&
    justOk(justificacion);

  const m = useMutation({
    mutationFn: () =>
      solicitudesApi.crearLineaCaptura(pdf!, {
        idProveedor,
        idCategoria,
        concepto: concepto.trim(),
        lineaCaptura: lineaCaptura.trim(),
        referencia: referencia.trim(),
        fechaLimite,
        total,
        pagoInmediato,
        justificacion: justificacion.trim(),
      }),
    onSuccess: onCreada,
    onError: (e) => setError(msgError(e, 'No se pudo crear la línea de captura.')),
  });

  return (
    <ModalShell
      titulo="Nueva línea de captura"
      onClose={onClose}
      onSubmit={() => m.mutate()}
      enviando={m.isPending}
      puedeCrear={puedeCrear}
      error={error}
    >
      <Campo label="Proveedor">
        <SearchSelect
          value={idProveedor}
          onChange={setIdProveedor}
          options={opcsProveedores(cat)}
          placeholder="Selecciona proveedor…"
          className="mt-1"
        />
      </Campo>
      <Campo label="Concepto">
        <input
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
          className={inputCls}
          placeholder="Concepto del pago"
        />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Línea de captura">
          <input
            value={lineaCaptura}
            onChange={(e) => setLineaCaptura(e.target.value)}
            className={inputCls}
            placeholder="Línea de captura"
          />
        </Campo>
        <Campo label="Referencia">
          <input
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            className={inputCls}
            placeholder="Referencia"
          />
        </Campo>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Fecha límite">
          <InputFecha value={fechaLimite} onChange={setFechaLimite} className={inputCls} />
        </Campo>
        <CampoMonto value={monto} onChange={setMonto} />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={pagoInmediato}
          onChange={(e) => setPagoInmediato(e.target.checked)}
        />
        ¿Se requiere pago inmediato?
      </label>
      <Campo label="Categoría / Clasificación">
        <SearchSelect
          value={idCategoria}
          onChange={setIdCategoria}
          options={opcsCategorias(cat)}
          placeholder="Selecciona clasificación…"
          className="mt-1"
        />
      </Campo>
      <CampoComprobante pdf={pdf} onChange={setPdf} />
      <CampoJustificacion value={justificacion} onChange={setJustificacion} />
    </ModalShell>
  );
}

// ---------- 3. DEVOLUCIONES ----------

export function NuevaDevolucion({ onClose, onCreada }: Props) {
  const { data: cat } = useCatalogos();
  const { data: inversionistas = [] } = useQuery<CatalogoInversionista[]>({
    queryKey: ['cxp-sol-inversionistas'],
    queryFn: () => solicitudesApi.inversionistas(),
    staleTime: 5 * 60 * 1000,
  });
  const [idInversionista, setIdInversionista] = useState('');
  const [idCategoria, setIdCategoria] = useState('');
  const [conceptoDevolucion, setConceptoDevolucion] = useState('');
  const [monto, setMonto] = useState('');
  const [justificacion, setJustificacion] = useState('');
  const [error, setError] = useState<string | null>(null);

  const total = Number(monto);
  const puedeCrear =
    !!idInversionista &&
    !!idCategoria &&
    conceptoDevolucion.trim() !== '' &&
    total > 0 &&
    justOk(justificacion);

  const opcsInv: OpcionSelect[] = inversionistas.map((i) => ({
    value: i.idInversionista,
    label: i.razonsocial ?? i.idInversionista,
  }));

  const m = useMutation({
    mutationFn: () =>
      solicitudesApi.crearDevolucion({
        idInversionista,
        idCategoria,
        conceptoDevolucion: conceptoDevolucion.trim(),
        total,
        justificacion: justificacion.trim(),
      }),
    onSuccess: onCreada,
    onError: (e) => setError(msgError(e, 'No se pudo crear la devolución.')),
  });

  return (
    <ModalShell
      titulo="Nueva devolución"
      onClose={onClose}
      onSubmit={() => m.mutate()}
      enviando={m.isPending}
      puedeCrear={puedeCrear}
      error={error}
    >
      <Campo label="Cliente o Inversionista">
        <SearchSelect
          value={idInversionista}
          onChange={setIdInversionista}
          options={opcsInv}
          placeholder="Selecciona cliente…"
          className="mt-1"
        />
      </Campo>
      <Campo label="Concepto de devolución">
        <input
          value={conceptoDevolucion}
          onChange={(e) => setConceptoDevolucion(e.target.value)}
          className={inputCls}
          placeholder="Motivo de la devolución"
        />
      </Campo>
      <CampoMonto value={monto} onChange={setMonto} />
      <Campo label="Categoría / Clasificación">
        <SearchSelect
          value={idCategoria}
          onChange={setIdCategoria}
          options={opcsCategorias(cat)}
          placeholder="Selecciona clasificación…"
          className="mt-1"
        />
      </Campo>
      <CampoJustificacion value={justificacion} onChange={setJustificacion} />
    </ModalShell>
  );
}

// ---------- 4. FACTURAS SIN XML ----------

const MONEDAS = ['MXN', 'USD', 'EUR'];

export function NuevaSinXml({ onClose, onCreada }: Props) {
  const { data: cat } = useCatalogos();
  const [idProveedor, setIdProveedor] = useState('');
  const [idCategoria, setIdCategoria] = useState('');
  const [concepto, setConcepto] = useState('');
  const [folio, setFolio] = useState('');
  const [fecFactura, setFecFactura] = useState('');
  const [monto, setMonto] = useState('');
  const [moneda, setMoneda] = useState('MXN');
  const [justificacion, setJustificacion] = useState('');
  const [pdf, setPdf] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const total = Number(monto);
  const puedeCrear =
    !!idProveedor &&
    !!idCategoria &&
    concepto.trim() !== '' &&
    folio.trim() !== '' &&
    fecFactura !== '' &&
    total > 0 &&
    !!pdf &&
    justOk(justificacion);

  const m = useMutation({
    mutationFn: () =>
      solicitudesApi.crearSinXml(pdf!, {
        idProveedor,
        idCategoria,
        concepto: concepto.trim(),
        folio: folio.trim(),
        fecFactura,
        total,
        moneda,
        justificacion: justificacion.trim(),
      }),
    onSuccess: onCreada,
    onError: (e) => setError(msgError(e, 'No se pudo crear la factura sin XML.')),
  });

  return (
    <ModalShell
      titulo="Nueva factura sin XML"
      onClose={onClose}
      onSubmit={() => m.mutate()}
      enviando={m.isPending}
      puedeCrear={puedeCrear}
      error={error}
    >
      <Campo label="Proveedor">
        <SearchSelect
          value={idProveedor}
          onChange={setIdProveedor}
          options={opcsProveedores(cat)}
          placeholder="Selecciona proveedor…"
          className="mt-1"
        />
      </Campo>
      <Campo label="Concepto">
        <input
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
          className={inputCls}
          placeholder="Concepto del pago"
        />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Folio / Referencia">
          <input
            value={folio}
            onChange={(e) => setFolio(e.target.value)}
            className={inputCls}
            placeholder="Folio de la factura"
          />
        </Campo>
        <Campo label="Fecha de factura">
          <InputFecha value={fecFactura} onChange={setFecFactura} className={inputCls} />
        </Campo>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <CampoMonto value={monto} onChange={setMonto} />
        <Campo label="Divisa">
          <select
            value={moneda}
            onChange={(e) => setMoneda(e.target.value)}
            className={inputCls}
          >
            {MONEDAS.map((mo) => (
              <option key={mo} value={mo}>
                {mo}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      <Campo label="Categoría / Clasificación">
        <SearchSelect
          value={idCategoria}
          onChange={setIdCategoria}
          options={opcsCategorias(cat)}
          placeholder="Selecciona clasificación…"
          className="mt-1"
        />
      </Campo>
      <CampoComprobante pdf={pdf} onChange={setPdf} />
      <CampoJustificacion value={justificacion} onChange={setJustificacion} />
    </ModalShell>
  );
}

// ---------- Selector de PDF compartido (Línea de Captura / Sin XML) ----------

function CampoComprobante({
  pdf,
  onChange,
}: {
  pdf: File | null;
  onChange: (f: File | null) => void;
}) {
  return (
    <Campo label="Comprobante (PDF)">
      <label className="mt-1 flex cursor-pointer items-center justify-between rounded-lg border border-dashed px-3 py-2.5 text-sm transition hover:bg-gray-50">
        <span className="truncate text-gray-600">
          {pdf ? pdf.name : 'Seleccionar archivo .pdf'}
        </span>
        <span className="ml-2 shrink-0 rounded bg-[#1f2a4d] px-2 py-0.5 text-xs text-white">
          Examinar
        </span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
      </label>
    </Campo>
  );
}
