import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ventasApi,
  hoyMexico,
  nombreInversionista,
  type InversionistaInput,
  type InversionistaOpt,
  type PropiedadRow,
} from './ventas.api';
import { Tabs, type TabDef } from '@/components/Tabs';

const SUBTABS: TabDef[] = [
  { id: 'datos', label: 'Datos Generales' },
  { id: 'docs', label: 'Documentos' },
  { id: 'propiedades', label: 'Propiedades' },
  { id: 'plan', label: 'Plan de Pagos' },
];

const esUrl = (u: string | null): u is string => !!u && /^https?:\/\//.test(u);

/**
 * Configuración (⚙) del propietario — 4 sub-pestañas (Datos Generales,
 * Documentos, Propiedades, Plan de Pagos). Renta Garantizada/Administrada quedan
 * fuera de esta etapa. Reemplaza `ConfigPropietarioWidget` de v1.
 */
export function ConfigPropietarioModal({
  inversionista,
  onClose,
  onCambio,
}: {
  inversionista: InversionistaOpt;
  onClose: () => void;
  onCambio: () => void;
}) {
  const [sub, setSub] = useState('datos');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b bg-[#1f2a4d] px-5 py-3 text-white">
          <h2 className="text-base font-semibold">
            Configuración · {nombreInversionista(inversionista)}
          </h2>
          <button onClick={onClose} className="text-white/80 hover:text-white" aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="p-5">
          <Tabs tabs={SUBTABS} activo={sub} onChange={setSub} />
          <div className="pt-4">
            {sub === 'datos' && (
              <DatosGeneralesTab id={inversionista.idInversionista} onCambio={onCambio} />
            )}
            {sub === 'docs' && <DocumentosTab id={inversionista.idInversionista} />}
            {sub === 'propiedades' && (
              <PropiedadesTab
                id={inversionista.idInversionista}
                nombre={nombreInversionista(inversionista)}
                onCambio={onCambio}
              />
            )}
            {sub === 'plan' && (
              <PlanPagosTab id={inversionista.idInversionista} onCambio={onCambio} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------- Datos Generales -----------------------------

function DatosGeneralesTab({ id, onCambio }: { id: string; onCambio: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['ventas-inversionista', id],
    queryFn: () => ventasApi.getInversionista(id),
  });
  const [form, setForm] = useState<InversionistaInput | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const f = form ?? (data ? {
    nombre: data.nombre,
    apellido1: data.apellido1 ?? '',
    apellido2: data.apellido2 ?? '',
    fecNacimiento: data.fecNacimiento ?? '',
    telefono: data.telefono ?? '',
    correo: data.correo ?? '',
    RFC: data.RFC ?? '',
    CURP: data.CURP ?? '',
    razonsocial: data.razonsocial ?? '',
    personalidad: data.personalidad ?? '',
    NomComercial: data.NomComercial ?? '',
    tipoCliente: data.tipoCliente ?? '',
  } : null);

  if (isLoading || !f) return <p className="text-sm text-gray-400">Cargando…</p>;

  const set = (k: keyof InversionistaInput, v: string) =>
    setForm({ ...(f as InversionistaInput), [k]: v });

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setGuardando(true);
    try {
      await ventasApi.actualizarInversionista(id, f as InversionistaInput);
      setMsg('Datos guardados.');
      onCambio();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  const campo = (label: string, k: keyof InversionistaInput, type = 'text') => (
    <label className="text-xs text-gray-600">
      {label}
      <input
        type={type}
        value={(f as InversionistaInput)[k] ?? ''}
        onChange={(e) => set(k, e.target.value)}
        className="mt-1 block w-full rounded border px-2 py-1.5 text-sm"
      />
    </label>
  );

  return (
    <form onSubmit={guardar} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {campo('Nombre', 'nombre')}
        {campo('Apellido 1', 'apellido1')}
        {campo('Apellido 2', 'apellido2')}
        {campo('Fecha de nacimiento', 'fecNacimiento', 'date')}
        {campo('Teléfono', 'telefono')}
        {campo('Correo', 'correo', 'email')}
        {campo('RFC', 'RFC')}
        {campo('CURP', 'CURP')}
        {campo('Razón social', 'razonsocial')}
        {campo('Personalidad', 'personalidad')}
        {campo('Nombre comercial', 'NomComercial')}
        {campo('Tipo de cliente', 'tipoCliente')}
      </div>
      {msg && <p className="text-xs text-[#1f2a4d]">{msg}</p>}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={guardando}
          className="rounded-lg bg-[#1f2a4d] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#2a376a] disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}

// ----------------------------- Documentos -----------------------------

function DocumentosTab({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['ventas-docs', id],
    queryFn: () => ventasApi.docs(id),
  });
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refrescar = () =>
    queryClient.invalidateQueries({ queryKey: ['ventas-docs', id] });

  async function subir(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!archivo || !titulo.trim()) {
      setError('Captura un título y selecciona un archivo.');
      return;
    }
    setSubiendo(true);
    try {
      await ventasApi.subirDoc(id, titulo.trim(), descripcion.trim(), archivo);
      setTitulo('');
      setDescripcion('');
      setArchivo(null);
      await refrescar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir el documento.');
    } finally {
      setSubiendo(false);
    }
  }

  async function eliminar(idDoc: string) {
    await ventasApi.eliminarDoc(idDoc);
    await refrescar();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={subir} className="grid grid-cols-1 gap-3 rounded-lg border bg-gray-50 p-4 sm:grid-cols-4">
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Título"
          className="rounded border px-2 py-1.5 text-sm"
        />
        <input
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Descripción"
          className="rounded border px-2 py-1.5 text-sm sm:col-span-2"
        />
        <input
          type="file"
          onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
          className="text-xs"
        />
        {error && <p className="text-xs text-red-600 sm:col-span-4">{error}</p>}
        <div className="sm:col-span-4">
          <button
            type="submit"
            disabled={subiendo}
            className="rounded-lg bg-[#1f2a4d] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#2a376a] disabled:opacity-50"
          >
            {subiendo ? 'Subiendo…' : 'Agregar documento'}
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-lg border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">Título</th>
              <th className="px-3 py-2">Descripción</th>
              <th className="px-3 py-2 text-center">Archivo</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-gray-400">
                  Cargando…
                </td>
              </tr>
            ) : docs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-gray-400">
                  Sin documentos.
                </td>
              </tr>
            ) : (
              docs.map((d) => (
                <tr key={d.idDocumento}>
                  <td className="px-3 py-2">{d.titulo ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-500">{d.descripcion ?? '—'}</td>
                  <td className="px-3 py-2 text-center">
                    {esUrl(d.urldoc) ? (
                      <a
                        href={d.urldoc}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#3f5b87] underline"
                      >
                        ver
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => eliminar(d.idDocumento)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ----------------------------- Propiedades -----------------------------

/** Número con separador de miles y hasta 3 decimales (m², etc.). */
const fmtNum = (n: number | null | undefined): string =>
  n == null ? '-' : n.toLocaleString('es-MX', { maximumFractionDigits: 3 });

/** Fecha ISO → dd/MM/aaaa (o '-' si no hay). */
const fmtFecha = (iso: string | null | undefined): string => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/** Campo etiqueta + valor en caja gris, como en las tarjetas de v1. */
function CampoNave({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-xs font-medium text-gray-600">{label}</span>
      <span className="flex-1 rounded bg-gray-100 px-2 py-1 text-right text-sm text-gray-800">
        {valor}
      </span>
    </div>
  );
}

function PropiedadesTab({
  id,
  nombre,
  onCambio,
}: {
  id: string;
  nombre: string;
  onCambio: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: props = [], isLoading } = useQuery({
    queryKey: ['ventas-propiedades', id],
    queryFn: () => ventasApi.propiedades(id),
  });
  const { data: parques = [] } = useQuery({
    queryKey: ['ventas-parques'],
    queryFn: () => ventasApi.parques(),
  });
  const [idParque, setIdParque] = useState('');
  const { data: naves = [] } = useQuery({
    queryKey: ['ventas-naves-disp', idParque],
    queryFn: () => ventasApi.navesDisponibles(idParque),
    enabled: !!idParque,
  });
  const [idNave, setIdNave] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function vincular(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!idNave) {
      setError('Selecciona una nave.');
      return;
    }
    setGuardando(true);
    try {
      const nave = naves.find((n) => n.idNave === idNave);
      // El nombre descriptivo lo arma el backend ("{parque} - {nave}"); aquí
      // solo enviamos nave y parque.
      await ventasApi.vincularNave({
        idInversionista: id,
        idNave,
        idParque: nave?.idParque ?? undefined,
      });
      setIdNave('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ventas-propiedades', id] }),
        // Refrescar naves disponibles: la recién vinculada ya no debe aparecer.
        queryClient.invalidateQueries({ queryKey: ['ventas-naves-disp', idParque] }),
      ]);
      onCambio();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo vincular la nave.');
    } finally {
      setGuardando(false);
    }
  }

  const [borrando, setBorrando] = useState<string | null>(null);

  async function desvincular(p: PropiedadRow) {
    const etiqueta = p.nomDescriptivo ?? p.nave?.numNaveNAME ?? 'esta nave';
    if (!window.confirm(`¿Desvincular ${etiqueta} del propietario?`)) return;
    setError(null);
    setBorrando(p.idPropiedad);
    try {
      await ventasApi.desvincularNave(p.idPropiedad);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ventas-propiedades', id] }),
        // La nave vuelve a estar disponible para vincular.
        queryClient.invalidateQueries({ queryKey: ['ventas-naves-disp', idParque] }),
      ]);
      onCambio();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo desvincular la nave.');
    } finally {
      setBorrando(null);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={vincular} className="grid grid-cols-1 gap-3 rounded-lg border bg-gray-50 p-4 sm:grid-cols-3">
        <select
          value={idParque}
          onChange={(e) => {
            setIdParque(e.target.value);
            setIdNave('');
          }}
          className="rounded border px-2 py-1.5 text-sm"
        >
          <option value="">Selecciona un parque…</option>
          {parques.map((p) => (
            <option key={p.idParque} value={p.idParque}>
              {p.nomParque ?? p.idParque}
            </option>
          ))}
        </select>
        <select
          value={idNave}
          onChange={(e) => setIdNave(e.target.value)}
          disabled={!idParque}
          className="rounded border px-2 py-1.5 text-sm disabled:opacity-50"
        >
          <option value="">
            {idParque ? 'Selecciona una nave…' : 'Primero el parque'}
          </option>
          {naves.map((n) => (
            <option key={n.idNave} value={n.idNave}>
              {n.numNaveNAME ?? n.idNave} (Mz {n.mza} Lt {n.lote})
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={guardando || !idNave}
          className="rounded-lg bg-[#1f2a4d] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#2a376a] disabled:opacity-50"
        >
          {guardando ? 'Vinculando…' : 'Vincular nave'}
        </button>
        {error && <p className="text-xs text-red-600 sm:col-span-3">{error}</p>}
      </form>

      {isLoading ? (
        <p className="py-6 text-center text-sm text-gray-400">Cargando…</p>
      ) : props.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">Sin propiedades vinculadas.</p>
      ) : (
        <div className="space-y-3">
          {props.map((p) => {
            // El color de la franja indica la disponibilidad de la nave:
            // rosa = Vendida, verde = Disponible, gris = otra/desconocida.
            const sit = p.nave?.situacion;
            const franja =
              sit === 'Vendida'
                ? 'border-l-pink-400'
                : sit === 'Disponible'
                  ? 'border-l-green-500'
                  : 'border-l-gray-300';
            const colorSit =
              sit === 'Vendida'
                ? 'text-pink-500'
                : sit === 'Disponible'
                  ? 'text-green-600'
                  : 'text-gray-400';
            return (
              <div
                key={p.idPropiedad}
                className={`overflow-hidden rounded-xl border border-l-4 ${franja} bg-white shadow-sm`}
              >
                {/* Encabezado: inversionista + indicadores */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
                  <p className="text-sm">
                    <span className="text-gray-500">Inversionista: </span>
                    <span className="font-semibold text-[#3f5b87]">{nombre}</span>
                  </p>
                  <div className="flex items-center gap-1.5">
                    {p.tienenPdp && <Chip texto="PDP" />}
                    {p.tieneRgPdp && <Chip texto="Rta. G." />}
                    {p.tieneRaPdp && <Chip texto="Rta. A." />}
                    {/* Desvincular: solo si la nave NO tiene plan de pagos. */}
                    {!p.tienenPdp && (
                      <button
                        type="button"
                        onClick={() => desvincular(p)}
                        disabled={borrando === p.idPropiedad}
                        title="Desvincular nave del propietario"
                        aria-label="Desvincular nave"
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        {borrando === p.idPropiedad ? '…' : '🗑'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex gap-4 p-4">
                  {/* Columna: número grande + nombre + situación de la nave */}
                  <div className="flex w-24 shrink-0 flex-col items-center justify-center text-center">
                    <span className="text-4xl font-bold leading-none text-[#1f2a4d]">
                      {p.nave?.numNave ?? '—'}
                    </span>
                    <span className="mt-1 text-xs text-gray-500">Nave</span>
                    <span className="text-sm font-semibold text-[#3f5b87]">
                      {p.nave?.numNaveNAME ?? '—'}
                    </span>
                    {sit && (
                      <span className={`mt-0.5 text-[11px] font-medium ${colorSit}`}>{sit}</span>
                    )}
                    {p.nomParque && (
                      <span className="mt-1 text-[11px] text-gray-400">{p.nomParque}</span>
                    )}
                  </div>

                  {/* Grilla de datos de la nave */}
                  <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
                    <CampoNave label="Mza:" valor={p.nave?.mza ?? '-'} />
                    <CampoNave label="Lote:" valor={p.nave?.lote ?? '-'} />
                    <CampoNave label="Terreno:" valor={fmtNum(p.nave?.terreno)} />
                    <CampoNave label="Const.:" valor={fmtNum(p.nave?.construccion)} />
                    <CampoNave label="Precio:" valor={fmtNum(p.nave?.precio)} />
                    <CampoNave label="Fecha estimada:" valor={fmtFecha(p.nave?.fecEntrega)} />
                    {/* KVAs asignados a la nave (tabla kvasAsignados). */}
                    <CampoNave
                      label="KVAs Alta:"
                      valor={p.kvas?.alta ? fmtNum(p.kvas.alta) : '-'}
                    />
                    <CampoNave
                      label="KVAs Media:"
                      valor={p.kvas?.media ? fmtNum(p.kvas.media) : '-'}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Indicador pequeño (PDP / Rta. G. / Rta. A.) para las tarjetas de propiedad. */
function Chip({ texto }: { texto: string }) {
  return (
    <span className="rounded-full bg-[#1f2a4d]/10 px-2 py-0.5 text-[11px] font-medium text-[#1f2a4d]">
      {texto}
    </span>
  );
}

// ----------------------------- Plan de Pagos (crear) -----------------------------

function PlanPagosTab({ id, onCambio }: { id: string; onCambio: () => void }) {
  const queryClient = useQueryClient();
  const { data: props = [] } = useQuery({
    queryKey: ['ventas-propiedades', id],
    queryFn: () => ventasApi.propiedades(id),
  });

  const [idPropiedad, setIdPropiedad] = useState('');
  const [terreno, setTerreno] = useState('');
  const [obra, setObra] = useState('');
  const [cantPagos, setCantPagos] = useState(1);
  const [fechaPrimerPago, setFechaPrimerPago] = useState(hoyMexico());
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const propSel = props.find((p) => p.idPropiedad === idPropiedad);
  const sinPlan = props.filter((p) => !p.tienenPdp);
  const montoTotal = (Number(terreno) || 0) + (Number(obra) || 0) * 1.16;
  const ivaObra = (Number(obra) || 0) * 0.16;

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    if (!idPropiedad || !propSel?.idNave) {
      setError('Selecciona una propiedad con nave.');
      return;
    }
    setGuardando(true);
    try {
      await ventasApi.crearPlanPagos({
        idPropiedad,
        idNave: propSel.idNave,
        idInversionista: id,
        terreno: Number(terreno) || 0,
        obra: Number(obra) || 0,
        cantPagos,
        fechaPrimerPago,
      });
      setMsg('Plan de pagos creado correctamente.');
      setTerreno('');
      setObra('');
      setCantPagos(1);
      setIdPropiedad('');
      await queryClient.invalidateQueries({ queryKey: ['ventas-propiedades', id] });
      onCambio();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el plan.');
    } finally {
      setGuardando(false);
    }
  }

  const moneda = (n: number) =>
    n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

  return (
    <form onSubmit={crear} className="space-y-4">
      <label className="block text-xs text-gray-600">
        Propiedad (sin plan)
        <select
          value={idPropiedad}
          onChange={(e) => setIdPropiedad(e.target.value)}
          className="mt-1 block w-full rounded border px-2 py-1.5 text-sm"
        >
          <option value="">Selecciona una propiedad…</option>
          {sinPlan.map((p) => (
            <option key={p.idPropiedad} value={p.idPropiedad}>
              {p.nomDescriptivo ?? p.idPropiedad}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="text-xs text-gray-600">
          Terreno
          <input
            type="number"
            step="0.01"
            value={terreno}
            onChange={(e) => setTerreno(e.target.value)}
            className="mt-1 block w-full rounded border px-2 py-1.5 text-right text-sm"
            placeholder="0.00"
          />
        </label>
        <label className="text-xs text-gray-600">
          Obra (+ IVA {moneda(ivaObra)})
          <input
            type="number"
            step="0.01"
            value={obra}
            onChange={(e) => setObra(e.target.value)}
            className="mt-1 block w-full rounded border px-2 py-1.5 text-right text-sm"
            placeholder="0.00"
          />
        </label>
        <div className="text-xs text-gray-600">
          TOTAL
          <div className="mt-1 rounded border bg-gray-50 px-2 py-1.5 text-right text-sm font-semibold">
            {moneda(montoTotal)}
          </div>
        </div>
        <label className="text-xs text-gray-600">
          Cantidad de pagos
          <select
            value={cantPagos}
            onChange={(e) => setCantPagos(Number(e.target.value))}
            className="mt-1 block w-full rounded border px-2 py-1.5 text-sm"
          >
            {Array.from({ length: 100 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-600">
          Fecha del 1er pago
          <input
            type="date"
            value={fechaPrimerPago}
            onChange={(e) => setFechaPrimerPago(e.target.value)}
            className="mt-1 block w-full rounded border px-2 py-1.5 text-sm"
          />
        </label>
        <div className="text-xs text-gray-600">
          Por parcialidad
          <div className="mt-1 rounded border bg-gray-50 px-2 py-1.5 text-right text-sm">
            {moneda(cantPagos > 0 ? Math.round((montoTotal / cantPagos) * 100) / 100 : 0)}
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {msg && <p className="text-xs text-[#1f2a4d]">{msg}</p>}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={guardando}
          className="rounded-lg bg-[#1f2a4d] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#2a376a] disabled:opacity-50"
        >
          {guardando ? 'Creando…' : 'Crear plan de pagos'}
        </button>
      </div>
    </form>
  );
}
