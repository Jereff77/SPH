import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  arrendatariosApi,
  hoyMexico,
  fechaCorta,
  moneda,
  num,
  type ConceptoInput,
  type CrearPlanRentaInput,
  type DetallePartida,
  type PlanRenta,
  type PropiedadArrendada,
} from './arrendatarios.api';
import { InputFecha } from '@/components/InputFecha';

/** Conceptos financiados predefinidos de v1 (1/2) + texto libre. */
const CONCEPTOS_PRESET = [
  { value: 'Adecuaciones', label: 'Adecuaciones' },
  { value: 'Otros servicios inmobiliarios', label: 'Otros servicios inmobiliarios' },
  { value: '__libre__', label: 'Otro (texto libre)…' },
];

/** Conceptos base del plan (no son cargos KVA): no se pueden eliminar de la corrida. */
const CONCEPTOS_BASE = ['Renta', 'Administración', 'Mantenimiento', 'Vigilancia', 'Deposito Garantia'];

/** Un concepto es un cargo KVA (eliminable) si NO empieza con un concepto base. */
const esCargoKva = (concepto: string): boolean =>
  !CONCEPTOS_BASE.some((b) => concepto.trim().startsWith(b));

/** Resalta los meses de cortesía (gracia) en la previsualización, como v1. */
const filaGracia = (g: DetallePartida['tieneMesGratis']): string =>
  g === 'Si' ? 'bg-[#FCF3C6]' : g === 'Medio' ? 'bg-[#FCF8E0]' : '';

/**
 * Tab "Plan de Pagos" (Configuración del PDP) — réplica del layout de 2 columnas de v1:
 * izquierda el formulario (Generales si no hay plan; Acciones + Cargos + Conceptos si ya hay),
 * derecha la **Previsualización** de la corrida (lee el detalle, sirve para planes inactivos).
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

  // id del plan recién creado (anti-carrera mientras refresca la lista de planes).
  const [idCreado, setIdCreado] = useState<string | null>(null);

  // "Con plan" solo si la propiedad TIENE un plan vinculado o se acaba de crear uno.
  // (No basta con que exista un arrePdp histórico con ese idNavArrend.)
  const conPlan = !!propSel?.tienePdp || !!idCreado;

  const { data: planes = [] } = useQuery({
    queryKey: ['arre-planes', idNavArrend, idArrendador],
    queryFn: () => arrendatariosApi.planes(idNavArrend, idArrendador),
    enabled: conPlan && !!idNavArrend && !!idArrendador,
  });

  // El plan a previsualizar/administrar es el VINCULADO a la propiedad
  // (`arrenPropiedades.idArrePdp` → `idArrendadoPdp`), o el recién creado. NO un
  // arrePdp histórico cualquiera con ese idNavArrend.
  const idArrePdp = idCreado ?? (propSel?.tienePdp ? (propSel.idArrendadoPdp ?? null) : null);
  const plan = useMemo(
    () =>
      planes.find((p) => p.idArrePdp === idArrePdp) ??
      planes.find((p) => p.arrePdpVigente === 'Si') ??
      planes[0] ??
      null,
    [planes, idArrePdp],
  );

  const refrescarTrasCrear = (idNuevo: string) => {
    setIdCreado(idNuevo);
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ['arre-propiedades', idArrendador] }),
      queryClient.invalidateQueries({ queryKey: ['arre-planes', idNavArrend, idArrendador] }),
    ]);
    onCambio();
  };

  return (
    <div className="space-y-3">
      <label className="block text-xs text-gray-600">
        Propiedad / Nave
        <select
          value={idNavArrend}
          onChange={(e) => {
            setIdNavArrend(e.target.value);
            setIdCreado(null);
          }}
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
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Columna izquierda: formulario */}
          <div className="space-y-4">
            {conPlan ? (
              <>
                {plan && (
                  <PlanCabeceraAcciones
                    plan={plan}
                    prop={propSel}
                    idArrendador={idArrendador}
                    onCambio={onCambio}
                  />
                )}
                {idArrePdp && (
                  <>
                    <CargosForm
                      idArrePdp={idArrePdp}
                      plazo={plan?.plazo ?? 12}
                      onCambio={onCambio}
                    />
                    <ConceptosList idArrePdp={idArrePdp} onCambio={onCambio} />
                  </>
                )}
              </>
            ) : (
              <GeneralesForm
                prop={propSel}
                idArrendador={idArrendador}
                onCreado={refrescarTrasCrear}
              />
            )}
          </div>

          {/* Columna derecha: previsualización */}
          <PreviewCorrida idArrePdp={idArrePdp} divisaPlan={plan?.Moneda ?? 'MXN'} />
        </div>
      )}
    </div>
  );
}

// ----------------------------- Generales (crear) -----------------------------

function GeneralesForm({
  prop,
  idArrendador,
  onCreado,
}: {
  prop: PropiedadArrendada;
  idArrendador: string;
  onCreado: (idArrePdp: string) => void;
}) {
  // Estado como cadenas para que los campos vacíos muestren placeholder (no un "0"
  // que el usuario tenga que borrar). Se convierte a número solo al crear.
  type FormStr = Record<
    | 'plazo' | 'm2Construccion' | 'inpcPlus' | 'deposito' | 'precioM2'
    | 'pm2Admin' | 'pm2Mtto' | 'pm2Vig'
    | 'cortesiaRenta' | 'cortesiaAdmin' | 'cortesiaMtto' | 'cortesiaVig',
    string
  > & { fecInicio: string; moneda: 'MXN' | 'USD' };

  const [form, setForm] = useState<FormStr>({
    fecInicio: hoyMexico(),
    moneda: 'MXN',
    plazo: '12',
    m2Construccion: '',
    inpcPlus: '',
    deposito: '',
    precioM2: '',
    pm2Admin: '',
    pm2Mtto: '',
    pm2Vig: '',
    cortesiaRenta: '',
    cortesiaAdmin: '',
    cortesiaMtto: '',
    cortesiaVig: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const set = (k: keyof FormStr, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const n = (s: string) => Number(s) || 0;

  // Subtotales en vivo (pm2 * m2 construcción) y Total Mes.
  const m2 = n(form.m2Construccion);
  const subRenta = n(form.precioM2) * m2;
  const subAdmin = n(form.pm2Admin) * m2;
  const subMtto = n(form.pm2Mtto) * m2;
  const subVig = n(form.pm2Vig) * m2;
  const totalMes = subRenta + subAdmin + subMtto + subVig;

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    if (n(form.plazo) <= 0 || m2 <= 0) {
      setError('El plazo y la construcción (m²) deben ser mayores a 0.');
      return;
    }
    setGuardando(true);
    try {
      const dto: CrearPlanRentaInput = {
        idArrendador,
        fecInicio: form.fecInicio,
        plazo: n(form.plazo),
        m2Construccion: m2,
        deposito: n(form.deposito),
        precioM2: n(form.precioM2),
        pm2Admin: n(form.pm2Admin),
        pm2Mtto: n(form.pm2Mtto),
        pm2Vig: n(form.pm2Vig),
        inpcPlus: n(form.inpcPlus),
        moneda: form.moneda,
        cortesiaRenta: n(form.cortesiaRenta),
        cortesiaAdmin: n(form.cortesiaAdmin),
        cortesiaMtto: n(form.cortesiaMtto),
        cortesiaVig: n(form.cortesiaVig),
      };
      const r = await arrendatariosApi.crearPlan(prop.idNavArrend, dto);
      setMsg(r.mensaje);
      onCreado(r.idArrePdp);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el plan.');
    } finally {
      setGuardando(false);
    }
  }

  const numField = (label: string, k: keyof FormStr, step = '0.01') => (
    <label className="text-xs text-gray-600">
      {label}
      <input
        type="number"
        step={step}
        value={form[k]}
        placeholder="0"
        onChange={(e) => set(k, e.target.value)}
        className="mt-1 block w-full rounded border px-2 py-1.5 text-right text-sm"
      />
    </label>
  );

  /** Bloque de un concepto: $ x m2 / SubTotal (vivo) / meses de gracia. */
  const concepto = (
    label: string,
    kPm2: keyof FormStr,
    kCort: keyof FormStr,
    subtotal: number,
  ) => (
    <div className="grid grid-cols-12 items-end gap-2 border-t pt-2">
      <span className="col-span-3 text-xs font-medium text-gray-600">{label}</span>
      <label className="col-span-3 text-[11px] text-gray-500">
        $ x m²
        <input
          type="number"
          step="0.01"
          value={form[kPm2]}
          placeholder="0"
          onChange={(e) => set(kPm2, e.target.value)}
          className="mt-0.5 block w-full rounded border px-2 py-1 text-right text-sm"
        />
      </label>
      <div className="col-span-4 text-[11px] text-gray-500">
        SubTotal
        <div className="mt-0.5 rounded border bg-gray-50 px-2 py-1 text-right text-sm font-medium">
          {moneda(subtotal, form.moneda)}
        </div>
      </div>
      <label className="col-span-2 text-[11px] text-gray-500">
        Gracia
        <input
          type="number"
          step="0.5"
          min={0}
          max={6}
          value={form[kCort]}
          placeholder="0"
          onChange={(e) => set(kCort, e.target.value)}
          className="mt-0.5 block w-full rounded border px-1 py-1 text-right text-sm"
        />
      </label>
    </div>
  );

  return (
    <form onSubmit={crear} className="space-y-3 rounded-lg border bg-gray-50 p-4">
      <p className="border-l-4 border-[#1f2a4d] bg-[#1f2a4d]/10 px-2 py-1.5 text-sm font-semibold text-[#1f2a4d]">
        Generales · {prop.nomDescriptivo ?? prop.numNaveNAME}
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="text-xs text-gray-600">
          Fecha inicio
          <InputFecha
            value={form.fecInicio}
            onChange={(iso) => set('fecInicio', iso)}
            className="mt-1 block w-full rounded border px-2 py-1.5 text-sm"
          />
        </label>
        {numField('Plazo (meses)', 'plazo', '1')}
        {numField('m² construcción', 'm2Construccion')}
        {numField('INPC adicional (%)', 'inpcPlus')}
        {numField('Depósito garantía', 'deposito')}
        <label className="text-xs text-gray-600">
          Moneda
          <select
            value={form.moneda}
            onChange={(e) => set('moneda', e.target.value as 'MXN' | 'USD')}
            className="mt-1 block w-full rounded border px-2 py-1.5 text-sm"
          >
            <option value="MXN">MXN</option>
            <option value="USD">USD</option>
          </select>
        </label>
      </div>

      <div className="space-y-1">
        {concepto('Renta base', 'precioM2', 'cortesiaRenta', subRenta)}
        {concepto('Administración', 'pm2Admin', 'cortesiaAdmin', subAdmin)}
        {concepto('Mantenimiento', 'pm2Mtto', 'cortesiaMtto', subMtto)}
        {concepto('Vigilancia', 'pm2Vig', 'cortesiaVig', subVig)}
      </div>

      <div className="flex items-center justify-between border-t pt-2">
        <span className="text-sm font-semibold text-gray-700">Total Mes</span>
        <span className="rounded bg-[#1f2a4d] px-3 py-1 text-sm font-bold text-white tabular-nums">
          {moneda(totalMes, form.moneda)}
        </span>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {msg && <p className="text-xs text-[#1f2a4d]">{msg}</p>}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={guardando}
          className="rounded-lg bg-[#1f2a4d] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#2a376a] disabled:opacity-50"
        >
          {guardando ? 'Creando…' : 'Crear'}
        </button>
      </div>
    </form>
  );
}

// ----------------------------- Acciones del plan existente -----------------------------

function PlanCabeceraAcciones({
  plan,
  prop,
  idArrendador,
  onCambio,
}: {
  plan: PlanRenta;
  prop: PropiedadArrendada;
  idArrendador: string;
  onCambio: () => void;
}) {
  const queryClient = useQueryClient();
  const [accion, setAccion] = useState<string | null>(null);
  const activo = prop.pdpActivo === true;

  const ejecutar = async (fn: () => Promise<unknown>, etiqueta: string) => {
    setAccion(etiqueta);
    try {
      await fn();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['arre-planes', prop.idNavArrend, idArrendador] }),
        queryClient.invalidateQueries({ queryKey: ['arre-propiedades', idArrendador] }),
        queryClient.invalidateQueries({ queryKey: ['arre-detalle', plan.idArrePdp] }),
      ]);
      onCambio();
    } finally {
      setAccion(null);
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border bg-white text-sm">
      <p className="border-l-4 border-sky-500 bg-sky-50 px-3 py-2 font-semibold text-sky-800">
        Plan {fechaCorta(plan.fecInicio)} → {fechaCorta(plan.fecFin)} · {plan.Moneda ?? 'MXN'}
      </p>
      <div className="p-4">
      <p className="text-xs text-gray-500">
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
      {activo && (
        <p className="mt-2 text-[11px] text-amber-600">
          Plan activo: la renta base y el periodo quedan congelados. Desactiva para editar.
        </p>
      )}
      </div>
    </div>
  );
}

// ----------------------------- Cargos (conceptos financiados) -----------------------------

function CargosForm({
  idArrePdp,
  plazo,
  onCambio,
}: {
  idArrePdp: string;
  plazo: number;
  onCambio: () => void;
}) {
  const queryClient = useQueryClient();
  const [preset, setPreset] = useState(CONCEPTOS_PRESET[0]!.value);
  const [libre, setLibre] = useState('');
  const [form, setForm] = useState<Omit<ConceptoInput, 'concepto'>>({
    monto: 0,
    mesInicio: 4,
    periodo: 1,
    dividir: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const concepto = preset === '__libre__' ? libre.trim() : preset;
  const opcionesMes = Array.from({ length: Math.max(1, plazo) }, (_, i) => i + 1);

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
      setForm({ monto: 0, mesInicio: 4, periodo: 1, dividir: true });
      await queryClient.invalidateQueries({ queryKey: ['arre-detalle', idArrePdp] });
      onCambio();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar el concepto.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={agregar} className="space-y-3 rounded-lg border bg-gray-50 p-4">
      <p className="border-l-4 border-amber-500 bg-amber-50 px-2 py-1.5 text-xs font-semibold text-amber-700">
        Cargos (conceptos financiados / KVAs)
      </p>
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
          Monto a financiar
          <input
            type="number"
            step="0.01"
            value={form.monto || ''}
            placeholder="0"
            onChange={(e) => setForm((f) => ({ ...f, monto: Number(e.target.value) || 0 }))}
            className="mt-1 block w-full rounded border px-2 py-1.5 text-right text-sm"
          />
        </label>
        <label className="text-xs text-gray-600">
          Mes inicio
          <select
            value={form.mesInicio}
            onChange={(e) => setForm((f) => ({ ...f, mesInicio: Number(e.target.value) }))}
            className="mt-1 block w-full rounded border px-2 py-1.5 text-sm"
          >
            {opcionesMes.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-600">
          Periodo (meses)
          <select
            value={form.periodo}
            onChange={(e) => setForm((f) => ({ ...f, periodo: Number(e.target.value) }))}
            className="mt-1 block w-full rounded border px-2 py-1.5 text-sm"
          >
            {opcionesMes.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 self-end text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.dividir}
            onChange={(e) => setForm((f) => ({ ...f, dividir: e.target.checked }))}
            className="h-4 w-4"
          />
          Dividir
        </label>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={guardando}
          className="rounded-lg bg-[#1f2a4d] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#2a376a] disabled:opacity-50"
        >
          {guardando ? 'Agregando…' : 'Agregar'}
        </button>
      </div>
    </form>
  );
}

// ----------------------------- Lista de conceptos -----------------------------

function ConceptosList({ idArrePdp, onCambio }: { idArrePdp: string; onCambio: () => void }) {
  const queryClient = useQueryClient();
  const { data: detalle = [] } = useQuery({
    queryKey: ['arre-detalle', idArrePdp],
    queryFn: () => arrendatariosApi.detalle(idArrePdp),
  });
  const [borrando, setBorrando] = useState<string | null>(null);

  // Agrupar por concepto (suma de cantidad).
  const conceptos = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of detalle) {
      const c = d.concepto ?? 'Sin concepto';
      map.set(c, (map.get(c) ?? 0) + (d.cantidad ?? 0));
    }
    return [...map.entries()].map(([concepto, total]) => ({ concepto, total }));
  }, [detalle]);

  async function eliminar(concepto: string) {
    if (!window.confirm(`¿Eliminar el cargo "${concepto}" del plan?`)) return;
    setBorrando(concepto);
    try {
      await arrendatariosApi.eliminarConcepto(idArrePdp, concepto);
      await queryClient.invalidateQueries({ queryKey: ['arre-detalle', idArrePdp] });
      onCambio();
    } finally {
      setBorrando(null);
    }
  }

  if (conceptos.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-lg border bg-white">
      <p className="border-l-4 border-emerald-500 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
        Conceptos
      </p>
      <table className="min-w-full text-sm">
        <tbody className="divide-y">
          {conceptos.map((c) => (
            <tr key={c.concepto}>
              <td className="px-3 py-1.5">{c.concepto}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{num(c.total)}</td>
              <td className="px-3 py-1.5 text-right">
                {esCargoKva(c.concepto) ? (
                  <button
                    type="button"
                    disabled={borrando !== null}
                    onClick={() => eliminar(c.concepto)}
                    className="text-xs text-red-600 hover:underline disabled:opacity-50"
                  >
                    Eliminar
                  </button>
                ) : (
                  <span className="text-[11px] text-gray-300">base</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ----------------------------- Previsualización de la corrida -----------------------------

function PreviewCorrida({
  idArrePdp,
  divisaPlan,
}: {
  idArrePdp: string | null;
  divisaPlan: string;
}) {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ['arre-detalle', idArrePdp],
    queryFn: () => arrendatariosApi.detalle(idArrePdp as string),
    enabled: !!idArrePdp,
  });

  return (
    <div className="rounded-lg border bg-white">
      <div className="flex items-center justify-between border-b border-l-4 border-l-[#1f2a4d] bg-[#1f2a4d]/5 px-3 py-2">
        <p className="text-sm font-semibold text-[#1f2a4d]">Previsualización</p>
        {idArrePdp && (
          <button
            type="button"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['arre-detalle', idArrePdp] })}
            title="Refrescar"
            className="text-xs text-[#3f5b87] hover:text-[#1f2a4d]"
          >
            ↻
          </button>
        )}
      </div>
      {!idArrePdp ? (
        <p className="px-3 py-10 text-center text-sm text-gray-400">
          Crea el plan para ver la previsualización de la corrida.
        </p>
      ) : (
        <div className="overflow-auto" style={{ maxHeight: '60vh' }}>
          <table className="min-w-full border-collapse text-xs">
            <thead className="[&>tr>th]:sticky [&>tr>th]:top-0 [&>tr>th]:z-10 [&>tr>th]:bg-[#1f2a4d]">
              <tr className="text-left font-semibold uppercase tracking-wide text-white">
                <th className="px-2 py-2 text-center">#</th>
                <th className="px-2 py-2 text-center">Año</th>
                <th className="px-2 py-2 text-left">Concepto</th>
                <th className="px-2 py-2 text-left">Fecha</th>
                <th className="px-2 py-2 text-right">Param</th>
                <th className="px-2 py-2 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                    Cargando…
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                    El plan no tiene corrida.
                  </td>
                </tr>
              ) : (
                data.map((d) => {
                  // Bloques intercalados por partida (cada mes = un bloque) para leer
                  // mejor; las cortesías (gracia) tienen prioridad de color (amarillo).
                  const grac = filaGracia(d.tieneMesGratis);
                  const bloque = (d.numPartida ?? 0) % 2 === 1 ? 'bg-[#eef3f9]' : 'bg-white';
                  return (
                  <tr key={d.idArrePdpDet} className={`${grac || bloque} hover:bg-blue-50`}>
                    <td className="px-2 py-1 text-center">{d.numPartida ?? '—'}</td>
                    <td className="px-2 py-1 text-center">{d.anio ?? '—'}</td>
                    <td className="px-2 py-1">{d.concepto ?? '—'}</td>
                    <td className="px-2 py-1 whitespace-nowrap">{fechaCorta(d.fecha)}</td>
                    <td className="px-2 py-1 text-right">
                      <div className="flex items-baseline justify-end gap-1 leading-tight">
                        <span className="text-[10px] text-gray-400">$m²</span>
                        <span className="tabular-nums">{num(d.pm2)}</span>
                      </div>
                      <div className="flex items-baseline justify-end gap-1 leading-tight">
                        <span className="text-[10px] text-gray-400">m²</span>
                        <span className="tabular-nums">{num(d.constM2)}</span>
                      </div>
                    </td>
                    <td className="px-2 py-1 text-right font-medium tabular-nums">
                      {moneda(d.cantidad, d.moneda ?? divisaPlan)}
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
