import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  arrendatariosApi,
  hoyMexico,
  fechaCorta,
  type ConceptoInput,
  type CrearPlanRentaInput,
  type PropiedadArrendada,
} from './arrendatarios.api';

/** Conceptos financiados predefinidos de v1 (1/2) + texto libre. */
const CONCEPTOS_PRESET = [
  { value: 'Adecuaciones', label: 'Adecuaciones' },
  { value: 'Otros servicios inmobiliarios', label: 'Otros servicios inmobiliarios' },
  { value: '__libre__', label: 'Otro (texto libre)…' },
];

const planVacio = (): CrearPlanRentaInput => ({
  idArrendador: '',
  fecInicio: hoyMexico(),
  plazo: 12,
  m2Construccion: 0,
  deposito: 0,
  precioM2: 0,
  pm2Admin: 0,
  pm2Mtto: 0,
  pm2Vig: 0,
  inpcPlus: 0,
  moneda: 'MXN',
  cortesiaRenta: 0,
  cortesiaAdmin: 0,
  cortesiaMtto: 0,
  cortesiaVig: 0,
});

/**
 * Tab "Plan de Pagos" de la Config: si la propiedad no tiene plan, muestra el
 * formulario de creación (orquesta las 3 RPCs en el backend); si ya tiene,
 * muestra el plan con acciones (activar/desactivar/eliminar) y la gestión de
 * conceptos financiados. Réplica de `arre_pdp_widget` de v1.
 */
export function PlanPagoForm({
  idArrendador,
  onCambio,
}: {
  idArrendador: string;
  onCambio: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: props = [] } = useQuery({
    queryKey: ['arre-propiedades', idArrendador],
    queryFn: () => arrendatariosApi.propiedades(idArrendador),
  });

  const [idNavArrend, setIdNavArrend] = useState('');
  const propSel = props.find((p) => p.idNavArrend === idNavArrend) ?? null;

  const refrescar = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['arre-propiedades', idArrendador] }),
      queryClient.invalidateQueries({ queryKey: ['arre-planes'] }),
    ]).then(onCambio);

  return (
    <div className="space-y-4">
      <label className="block text-xs text-gray-600">
        Propiedad / Nave
        <select
          value={idNavArrend}
          onChange={(e) => setIdNavArrend(e.target.value)}
          className="mt-1 block w-full rounded border px-2 py-1.5 text-sm sm:w-96"
        >
          <option value="">Selecciona una propiedad…</option>
          {props.map((p) => (
            <option key={p.idNavArrend} value={p.idNavArrend}>
              {p.nomDescriptivo ?? p.numNaveNAME ?? p.idNavArrend}
              {p.tienePdp ? ' (con plan)' : ''}
            </option>
          ))}
        </select>
      </label>

      {!propSel ? (
        <p className="py-4 text-center text-sm text-gray-400">
          Selecciona una propiedad para crear o administrar su plan.
        </p>
      ) : propSel.tienePdp ? (
        <PlanExistente prop={propSel} idArrendador={idArrendador} onCambio={refrescar} />
      ) : (
        <CrearPlan prop={propSel} idArrendador={idArrendador} onCreado={refrescar} />
      )}
    </div>
  );
}

// ----------------------------- Crear plan -----------------------------

function CrearPlan({
  prop,
  idArrendador,
  onCreado,
}: {
  prop: PropiedadArrendada;
  idArrendador: string;
  onCreado: () => void;
}) {
  const [form, setForm] = useState<CrearPlanRentaInput>({ ...planVacio(), idArrendador });
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const set = (k: keyof CrearPlanRentaInput, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    if (form.plazo <= 0 || form.m2Construccion <= 0) {
      setError('El plazo y la construcción (m²) deben ser mayores a 0.');
      return;
    }
    setGuardando(true);
    try {
      const r = await arrendatariosApi.crearPlan(prop.idNavArrend, { ...form, idArrendador });
      setMsg(r.mensaje);
      onCreado();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el plan.');
    } finally {
      setGuardando(false);
    }
  }

  const numField = (
    label: string,
    k: keyof CrearPlanRentaInput,
    step = '0.01',
  ) => (
    <label className="text-xs text-gray-600">
      {label}
      <input
        type="number"
        step={step}
        value={String(form[k] ?? '')}
        onChange={(e) => set(k, e.target.value === '' ? 0 : Number(e.target.value))}
        className="mt-1 block w-full rounded border px-2 py-1.5 text-right text-sm"
      />
    </label>
  );

  return (
    <form onSubmit={crear} className="space-y-4 rounded-lg border bg-gray-50 p-4">
      <p className="text-sm font-medium text-gray-700">
        Nuevo plan para {prop.nomDescriptivo ?? prop.numNaveNAME}
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="text-xs text-gray-600">
          Fecha inicio
          <input
            type="date"
            value={form.fecInicio}
            onChange={(e) => set('fecInicio', e.target.value)}
            className="mt-1 block w-full rounded border px-2 py-1.5 text-sm"
          />
        </label>
        {numField('Plazo (meses)', 'plazo', '1')}
        {numField('Construcción m²', 'm2Construccion')}
        <label className="text-xs text-gray-600">
          Moneda
          <select
            value={form.moneda}
            onChange={(e) => set('moneda', e.target.value)}
            className="mt-1 block w-full rounded border px-2 py-1.5 text-sm"
          >
            <option value="MXN">MXN</option>
            <option value="USD">USD</option>
          </select>
        </label>
        {numField('Depósito', 'deposito')}
        {numField('Precio m² (renta)', 'precioM2')}
        {numField('INPC +', 'inpcPlus')}
      </div>

      <p className="text-xs font-semibold text-gray-500">Precios por m² y cortesías (meses)</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {numField('PM² Admin', 'pm2Admin')}
        {numField('Cortesía Admin', 'cortesiaAdmin', '0.5')}
        {numField('PM² Mtto', 'pm2Mtto')}
        {numField('Cortesía Mtto', 'cortesiaMtto', '0.5')}
        {numField('PM² Vigilancia', 'pm2Vig')}
        {numField('Cortesía Vig.', 'cortesiaVig', '0.5')}
        {numField('Cortesía Renta', 'cortesiaRenta', '0.5')}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {msg && <p className="text-xs text-[#1f2a4d]">{msg}</p>}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={guardando}
          className="rounded-lg bg-[#1f2a4d] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#2a376a] disabled:opacity-50"
        >
          {guardando ? 'Creando…' : 'Crear plan de pago'}
        </button>
      </div>
    </form>
  );
}

// ----------------------------- Plan existente -----------------------------

function PlanExistente({
  prop,
  idArrendador,
  onCambio,
}: {
  prop: PropiedadArrendada;
  idArrendador: string;
  onCambio: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: planes = [] } = useQuery({
    queryKey: ['arre-planes', prop.idNavArrend, idArrendador],
    queryFn: () => arrendatariosApi.planes(prop.idNavArrend, idArrendador),
  });

  // El plan a administrar es el vigente; si no hay, el primero.
  const plan = useMemo(
    () => planes.find((p) => p.arrePdpVigente === 'Si') ?? planes[0] ?? null,
    [planes],
  );

  const [accion, setAccion] = useState<string | null>(null);

  if (!plan) return <p className="py-4 text-center text-sm text-gray-400">Cargando plan…</p>;

  const activo = prop.pdpActivo === true;

  const ejecutar = async (fn: () => Promise<unknown>, etiqueta: string) => {
    setAccion(etiqueta);
    try {
      await fn();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['arre-planes', prop.idNavArrend, idArrendador] }),
        queryClient.invalidateQueries({ queryKey: ['arre-resumen', plan.idArrePdp] }),
      ]);
      onCambio();
    } finally {
      setAccion(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-4 text-sm">
        <p className="font-medium text-gray-700">
          Plan {fechaCorta(plan.fecInicio)} → {fechaCorta(plan.fecFin)} · {plan.Moneda ?? 'MXN'}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Plazo {plan.plazo ?? '—'} meses · Estado:{' '}
          <span className="font-semibold">{activo ? 'Activo' : 'Inactivo'}</span> · Vigencia:{' '}
          {plan.arrePdpVigente ?? '—'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {activo ? (
            <button
              type="button"
              disabled={accion !== null}
              onClick={() =>
                ejecutar(() => arrendatariosApi.desactivar(plan.idArrePdp, prop.idNavArrend), 'desactivar')
              }
              className="rounded-lg border border-amber-500 px-3 py-1.5 text-xs font-medium text-amber-600 hover:bg-amber-50 disabled:opacity-50"
            >
              Desactivar (permite editar)
            </button>
          ) : (
            <button
              type="button"
              disabled={accion !== null}
              onClick={() =>
                ejecutar(() => arrendatariosApi.activar(plan.idArrePdp, prop.idNavArrend), 'activar')
              }
              className="rounded-lg border border-green-600 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
            >
              Activar (congela renta)
            </button>
          )}
          <button
            type="button"
            disabled={accion !== null}
            onClick={() => {
              if (window.confirm('¿Eliminar este plan de pago? Esta acción no se puede deshacer.'))
                void ejecutar(() => arrendatariosApi.eliminarPlan(plan.idArrePdp), 'eliminar');
            }}
            className="rounded-lg border border-red-500 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Eliminar plan
          </button>
        </div>
      </div>

      <ConceptosFinanciados idArrePdp={plan.idArrePdp} onCambio={onCambio} />
    </div>
  );
}

// ----------------------------- Conceptos financiados (KVAs) -----------------------------

function ConceptosFinanciados({
  idArrePdp,
  onCambio,
}: {
  idArrePdp: string;
  onCambio: () => void;
}) {
  const queryClient = useQueryClient();
  const [preset, setPreset] = useState(CONCEPTOS_PRESET[0]!.value);
  const [libre, setLibre] = useState('');
  const [form, setForm] = useState<Omit<ConceptoInput, 'concepto'>>({
    monto: 0,
    mesInicio: 0,
    periodo: 1,
    dividir: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const concepto = preset === '__libre__' ? libre.trim() : preset;

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!concepto) {
      setError('Captura el concepto.');
      return;
    }
    if (form.monto <= 0 || form.periodo <= 0) {
      setError('El monto y el periodo deben ser mayores a 0.');
      return;
    }
    setGuardando(true);
    try {
      await arrendatariosApi.agregarConcepto(idArrePdp, { ...form, concepto });
      setLibre('');
      setForm({ monto: 0, mesInicio: 0, periodo: 1, dividir: true });
      await queryClient.invalidateQueries({ queryKey: ['arre-resumen', idArrePdp] });
      onCambio();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar el concepto.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={agregar} className="space-y-3 rounded-lg border bg-gray-50 p-4">
      <p className="text-xs font-semibold text-gray-500">Agregar concepto financiado (KVAs / adecuaciones)</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="text-xs text-gray-600">
          Concepto
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
            className="mt-1 block w-full rounded border px-2 py-1.5 text-sm"
          >
            {CONCEPTOS_PRESET.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        {preset === '__libre__' && (
          <label className="text-xs text-gray-600">
            Concepto (libre)
            <input
              value={libre}
              onChange={(e) => setLibre(e.target.value)}
              maxLength={120}
              className="mt-1 block w-full rounded border px-2 py-1.5 text-sm"
            />
          </label>
        )}
        <label className="text-xs text-gray-600">
          Monto
          <input
            type="number"
            step="0.01"
            value={String(form.monto || '')}
            onChange={(e) => setForm((f) => ({ ...f, monto: Number(e.target.value) || 0 }))}
            className="mt-1 block w-full rounded border px-2 py-1.5 text-right text-sm"
          />
        </label>
        <label className="text-xs text-gray-600">
          Mes inicio
          <input
            type="number"
            step="1"
            value={String(form.mesInicio)}
            onChange={(e) => setForm((f) => ({ ...f, mesInicio: Number(e.target.value) || 0 }))}
            className="mt-1 block w-full rounded border px-2 py-1.5 text-right text-sm"
          />
        </label>
        <label className="text-xs text-gray-600">
          Periodo (meses)
          <input
            type="number"
            step="1"
            value={String(form.periodo)}
            onChange={(e) => setForm((f) => ({ ...f, periodo: Number(e.target.value) || 1 }))}
            className="mt-1 block w-full rounded border px-2 py-1.5 text-right text-sm"
          />
        </label>
        <label className="flex items-center gap-2 self-end text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.dividir}
            onChange={(e) => setForm((f) => ({ ...f, dividir: e.target.checked }))}
            className="h-4 w-4"
          />
          Prorratear
        </label>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={guardando}
          className="rounded-lg bg-[#1f2a4d] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#2a376a] disabled:opacity-50"
        >
          {guardando ? 'Agregando…' : 'Agregar concepto'}
        </button>
      </div>
    </form>
  );
}
