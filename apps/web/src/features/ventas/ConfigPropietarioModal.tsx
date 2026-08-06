import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ventasApi,
  hoyMexico,
  nombreInversionista,
  TIPOS_PAGO,
  type CabeceraPdp,
  type InversionistaInput,
  type InversionistaOpt,
  type PagoVentaRow,
  type PropiedadRow,
  type TipoPago,
} from './ventas.api';
import { Tabs, type TabDef } from '@/components/Tabs';
import { InputFecha } from '@/components/InputFecha';

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
      <div className="max-h-[92vh] w-full max-w-6xl overflow-auto rounded-2xl bg-white shadow-xl">
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
    // El motivo alimenta la trazabilidad de la nave (historial). Cancelar el prompt
    // (null) aborta; dejarlo vacío desvincula sin motivo. La propiedad NO se borra:
    // se da de baja (status=false) conservando su histórico.
    const motivo = window.prompt(
      `Vas a desvincular ${etiqueta} del propietario.\n\nMotivo de la desvinculación (para el historial de la nave):`,
      '',
    );
    if (motivo === null) return;
    setError(null);
    setBorrando(p.idPropiedad);
    try {
      await ventasApi.desvincularNave(p.idPropiedad, motivo.trim());
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
                    {(p.tienenPdp || p.idPdp) && <Chip texto="PDP" />}
                    {p.tieneRgPdp && <Chip texto="Rta. G." />}
                    {p.tieneRaPdp && <Chip texto="Rta. A." />}
                    {/* Desvincular: solo si la nave NO tiene plan de pagos (ni la
                        bandera ni idPdp; la bandera no es fiable en datos de v1). */}
                    {!p.tienenPdp && !p.idPdp && (
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
                  {/* Columna: número de nave (numNaveNAME) + situación. */}
                  <div className="flex w-24 shrink-0 flex-col items-center justify-center text-center">
                    <span className="text-3xl font-bold leading-none text-[#1f2a4d]">
                      {p.nave?.numNaveNAME ?? '—'}
                    </span>
                    <span className="mt-1 text-xs text-gray-500">Nave</span>
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
                    {/* KVAs asignados a la nave (tabla kvasAsignados), por nivel de tensión. */}
                    <CampoNave
                      label="KVAs Media:"
                      valor={p.kvas?.mt ? fmtNum(p.kvas.mt) : '-'}
                    />
                    <CampoNave
                      label="KVAs Baja:"
                      valor={p.kvas?.bt ? fmtNum(p.kvas.bt) : '-'}
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

// ----------------------------- Plan de Pagos (crear + previsualizar) -----------------------------

const monedaMXN = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const fechaCortaV = (iso: string | null): string => {
  if (!iso) return '—';
  const p = (iso.split('T')[0] ?? iso).split('-');
  return p.length === 3 ? `${Number(p[2])}/${Number(p[1])}/${p[0]}` : iso;
};

/**
 * Tab "Plan de Pagos" (Configuración del PDP) — réplica del layout de 2 columnas de
 * Arrendatarios: a la izquierda el formulario (Generales si la propiedad no tiene plan;
 * cabecera + Activar/Desactivar si ya lo tiene) y a la derecha la **Previsualización** de
 * la corrida (parcialidades), que funciona incluso con el plan recién creado e inactivo.
 */
function PlanPagosTab({ id, onCambio }: { id: string; onCambio: () => void }) {
  const { data: props = [] } = useQuery({
    queryKey: ['ventas-propiedades', id],
    queryFn: () => ventasApi.propiedades(id),
  });

  const [idPropiedad, setIdPropiedad] = useState('');
  // El plan recién creado nace inactivo; `creado` muestra la previsualización
  // mientras la corrida se refresca (anti-carrera).
  const [creado, setCreado] = useState(false);
  const propSel = props.find((p) => p.idPropiedad === idPropiedad) ?? null;

  // Corrida real de la propiedad (parcialidades de `pdpDetalle`). Es la MISMA
  // fuente que la pestaña principal de Planes, por eso detecta planes que la
  // bandera `propiedades.tienenPdp` no refleja (desincronizada en datos de v1).
  const { data: corrida = [], isLoading: cargandoCorrida } = useQuery({
    queryKey: ['ventas-plan', idPropiedad],
    queryFn: () => ventasApi.plan(idPropiedad),
    enabled: !!idPropiedad,
  });

  // "Con plan" = hay corrida, o la propiedad ya tiene un PDP vinculado (idPdp),
  // o se acaba de crear. NO se confía solo en `tienenPdp` (no es fiable en v1).
  const conPlan = corrida.length > 0 || !!propSel?.idPdp || creado;
  // El plan solo se edita cuando está INACTIVO (activo = congelado, como v1).
  const activo = propSel?.pdpActivo === true;
  const editable = conPlan && !activo;
  // Total del plan (pdp.monto, viene en cada fila como `montototal`) y suma de partidas.
  const totalPlan = corrida.find((r) => r.montototal != null)?.montototal ?? 0;
  const sumaPartidas = corrida.reduce((s, r) => s + (r.monto ?? 0), 0);

  return (
    <div className="space-y-3">
      <label className="block text-xs text-gray-600">
        Propiedad / Nave
        <select
          value={idPropiedad}
          onChange={(e) => {
            setIdPropiedad(e.target.value);
            setCreado(false);
          }}
          className="mt-1 block w-full rounded border px-2 py-1.5 text-sm sm:w-96"
        >
          <option value="">Selecciona una propiedad…</option>
          {props.map((p) => (
            <option key={p.idPropiedad} value={p.idPropiedad}>
              {p.nomDescriptivo ?? p.nave?.numNaveNAME ?? p.idPropiedad}
              {p.tienenPdp || p.idPdp ? ' (con plan)' : ''}
            </option>
          ))}
        </select>
      </label>

      {!propSel ? (
        <p className="py-4 text-center text-sm text-gray-400">
          Selecciona una propiedad para crear o administrar su plan de pagos.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Columna izquierda: formulario (crear) o acciones (plan existente). */}
          <div className="space-y-4">
            {conPlan ? (
              <PlanCabeceraAccionesVenta
                key={propSel.idPropiedad}
                prop={propSel}
                idInversionista={id}
                activo={activo}
                editable={editable}
                totalPlan={totalPlan}
                sumaPartidas={sumaPartidas}
                onCambio={onCambio}
                onEliminado={() => {
                  // Sin el reset, `creado=true` seguiría forzando la vista "con plan"
                  // si el plan se creó y eliminó en la misma apertura del modal.
                  setCreado(false);
                  onCambio();
                }}
              />
            ) : (
              <GeneralesVentaForm
                key={propSel.idPropiedad}
                prop={propSel}
                idInversionista={id}
                onCreado={() => {
                  setCreado(true);
                  onCambio();
                }}
              />
            )}
          </div>

          {/* Columna derecha: previsualización (editable si el plan está inactivo). */}
          <PreviewCorridaVenta
            key={propSel.idPropiedad}
            idPropiedad={idPropiedad}
            idInversionista={id}
            data={corrida}
            isLoading={cargandoCorrida}
            mostrar={conPlan}
            editable={editable}
            totalPlan={totalPlan}
            sumaPartidas={sumaPartidas}
            onCambio={onCambio}
          />
        </div>
      )}
    </div>
  );
}

// ----------------------------- Generales (crear) -----------------------------

function GeneralesVentaForm({
  prop,
  idInversionista,
  onCreado,
}: {
  prop: PropiedadRow;
  idInversionista: string;
  onCreado: () => void;
}) {
  const queryClient = useQueryClient();
  const [terreno, setTerreno] = useState('');
  const [obra, setObra] = useState('');
  const [cantPagos, setCantPagos] = useState(1);
  const [fechaPrimerPago, setFechaPrimerPago] = useState(hoyMexico());
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // montoTotal = terreno + obra*1.16 (IVA 16% solo a la obra), como v1.
  const montoTotal = (Number(terreno) || 0) + (Number(obra) || 0) * 1.16;
  const ivaObra = (Number(obra) || 0) * 0.16;
  const porParcialidad =
    cantPagos > 0 ? Math.round((montoTotal / cantPagos) * 100) / 100 : 0;

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    if (!prop.idNave) {
      setError('La propiedad no tiene una nave asociada.');
      return;
    }
    setGuardando(true);
    try {
      await ventasApi.crearPlanPagos({
        idPropiedad: prop.idPropiedad,
        idNave: prop.idNave,
        idInversionista,
        terreno: Number(terreno) || 0,
        obra: Number(obra) || 0,
        cantPagos,
        fechaPrimerPago,
      });
      setMsg('Plan de pagos creado correctamente.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ventas-propiedades', idInversionista] }),
        queryClient.invalidateQueries({ queryKey: ['ventas-plan', prop.idPropiedad] }),
      ]);
      onCreado();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el plan.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={crear} className="space-y-3 rounded-lg border bg-gray-50 p-4">
      <p className="border-l-4 border-[#1f2a4d] bg-[#1f2a4d]/10 px-2 py-1.5 text-sm font-semibold text-[#1f2a4d]">
        Generales · {prop.nomDescriptivo ?? prop.nave?.numNaveNAME ?? 'Nave'}
      </p>

      <div className="grid grid-cols-2 gap-3">
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
          Obra (+ IVA {monedaMXN(ivaObra)})
          <input
            type="number"
            step="0.01"
            value={obra}
            onChange={(e) => setObra(e.target.value)}
            className="mt-1 block w-full rounded border px-2 py-1.5 text-right text-sm"
            placeholder="0.00"
          />
        </label>
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
          <InputFecha
            value={fechaPrimerPago}
            onChange={(iso) => setFechaPrimerPago(iso)}
            className="mt-1 block w-full rounded border px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="text-xs text-gray-600">
          TOTAL
          <div className="mt-1 rounded border bg-white px-2 py-1.5 text-right text-sm font-semibold">
            {monedaMXN(montoTotal)}
          </div>
        </div>
        <div className="text-xs text-gray-600">
          Por parcialidad
          <div className="mt-1 rounded border bg-white px-2 py-1.5 text-right text-sm">
            {monedaMXN(porParcialidad)}
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

// ----------------------------- Acciones del plan existente -----------------------------

function PlanCabeceraAccionesVenta({
  prop,
  idInversionista,
  activo,
  editable,
  totalPlan,
  sumaPartidas,
  onCambio,
  onEliminado,
}: {
  prop: PropiedadRow;
  idInversionista: string;
  activo: boolean;
  editable: boolean;
  totalPlan: number;
  sumaPartidas: number;
  onCambio: () => void;
  onEliminado: () => void;
}) {
  const queryClient = useQueryClient();
  const [accion, setAccion] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cabecera del PDP (Terreno/Obra) para editar los montos del plan.
  const { data: cab } = useQuery({
    queryKey: ['ventas-pdp-cab', prop.idPropiedad],
    queryFn: () => ventasApi.cabeceraPdp(prop.idPropiedad),
    enabled: !!prop.idPropiedad,
  });

  const refrescar = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['ventas-propiedades', idInversionista] }),
      queryClient.invalidateQueries({ queryKey: ['ventas-plan', prop.idPropiedad] }),
      queryClient.invalidateQueries({ queryKey: ['ventas-pdp-cab', prop.idPropiedad] }),
    ]);

  const diferencia = sumaPartidas - totalPlan;
  const descuadre = Math.abs(diferencia) > 0.05;

  async function toggle() {
    setAccion(true);
    setError(null);
    try {
      await ventasApi.setActivoPlan(prop.idPropiedad, !activo);
      await refrescar();
      onCambio();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el estado del plan.');
    } finally {
      setAccion(false);
    }
  }

  async function eliminarPlan() {
    if (
      !window.confirm(
        'Vas a eliminar el plan de pagos COMPLETO (todas sus parcialidades). ' +
          'Solo procede si ninguna parcialidad tiene pagos. La propiedad quedará libre ' +
          'para desvincular la nave o crear un plan nuevo. ¿Continuar?',
      )
    )
      return;
    setAccion(true);
    setError(null);
    try {
      await ventasApi.eliminarPlan(prop.idPropiedad);
      await refrescar();
      onEliminado();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el plan de pagos.');
    } finally {
      setAccion(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-white text-sm">
      <p className="border-l-4 border-sky-500 bg-sky-50 px-3 py-2 font-semibold text-sky-800">
        Plan de Pagos · {prop.nomDescriptivo ?? prop.nave?.numNaveNAME ?? 'Nave'}
      </p>
      <div className="space-y-3 p-4">
        <p className="text-xs text-gray-500">
          Estado: <span className="font-semibold">{activo ? 'Activo' : 'Inactivo'}</span>
        </p>

        {/* Montos del plan (Terreno/Obra/Total): editables solo si el plan está inactivo. */}
        {editable && cab ? (
          <MontosPlanForm
            idPropiedad={prop.idPropiedad}
            cab={cab}
            onGuardado={() => {
              void refrescar();
              onCambio();
            }}
          />
        ) : (
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
            <div>
              Total del plan
              <div className="mt-0.5 rounded border bg-gray-50 px-2 py-1 text-right font-semibold">
                {monedaMXN(totalPlan)}
              </div>
            </div>
            <div>
              Suma partidas
              <div className="mt-0.5 rounded border bg-gray-50 px-2 py-1 text-right font-semibold">
                {monedaMXN(sumaPartidas)}
              </div>
            </div>
          </div>
        )}

        {/* Cuadre suma de partidas vs total del plan (regla para activar). */}
        {descuadre ? (
          <p className="rounded bg-red-50 px-2 py-1 text-[11px] text-red-700">
            La suma de las partidas ({monedaMXN(sumaPartidas)}) no coincide con el total del plan
            ({monedaMXN(totalPlan)}). Diferencia {monedaMXN(diferencia)}. Ajústalas para poder activar.
          </p>
        ) : (
          <p className="rounded bg-green-50 px-2 py-1 text-[11px] text-green-700">
            La suma de las partidas cuadra con el total del plan (±$0.05).
          </p>
        )}

        {/* Activar / Desactivar */}
        <div className="flex flex-wrap items-center gap-2">
          {activo ? (
            <button
              type="button"
              disabled={accion}
              onClick={toggle}
              className="rounded-lg border border-amber-500 px-3 py-1.5 text-xs font-medium text-amber-600 hover:bg-amber-50 disabled:opacity-50"
            >
              {accion ? 'Guardando…' : 'Desactivar (permite editar)'}
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={accion || descuadre}
                onClick={toggle}
                title={descuadre ? 'La suma de las partidas debe cuadrar con el total del plan' : undefined}
                className="rounded-lg border border-green-600 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
              >
                {accion ? 'Guardando…' : 'Activar'}
              </button>
              {/* Eliminar el plan completo: solo con el plan desactivado; el backend
                  además exige que ningún pago (ni cancelado) referencie el plan. */}
              <button
                type="button"
                disabled={accion}
                onClick={() => void eliminarPlan()}
                title="Elimina el plan y sus parcialidades (solo si ninguna tiene pagos). La propiedad queda libre."
                className="rounded-lg border border-red-500 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {accion ? 'Guardando…' : 'Eliminar plan'}
              </button>
            </>
          )}
        </div>

        <p className="text-[11px] text-gray-500">
          {activo
            ? 'Plan activo: entra a la cobranza del Dashboard y queda congelado (no editable).'
            : 'Plan inactivo: puedes editar montos, fechas y partidas. Actívalo cuando cuadre.'}
        </p>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}

// ----------------------------- Editar Terreno/Obra del plan -----------------------------

function MontosPlanForm({
  idPropiedad,
  cab,
  onGuardado,
}: {
  idPropiedad: string;
  cab: CabeceraPdp;
  onGuardado: () => void;
}) {
  const [terreno, setTerreno] = useState(String(cab.montoterreno ?? ''));
  const [obra, setObra] = useState(String(cab.montoobra ?? ''));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = (Number(terreno) || 0) + (Number(obra) || 0) * 1.16;
  const ivaObra = (Number(obra) || 0) * 0.16;
  const cambiado = (Number(terreno) || 0) !== cab.montoterreno || (Number(obra) || 0) !== cab.montoobra;

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      await ventasApi.editarMontosPlan(idPropiedad, Number(terreno) || 0, Number(obra) || 0);
      onGuardado();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron guardar los montos.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border bg-gray-50 p-3">
      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
        <label>
          Terreno
          <input
            type="number"
            step="0.01"
            value={terreno}
            onChange={(e) => setTerreno(e.target.value)}
            className="mt-0.5 block w-full rounded border px-2 py-1 text-right text-sm"
            placeholder="0.00"
          />
        </label>
        <label>
          Obra (+ IVA {monedaMXN(ivaObra)})
          <input
            type="number"
            step="0.01"
            value={obra}
            onChange={(e) => setObra(e.target.value)}
            className="mt-0.5 block w-full rounded border px-2 py-1 text-right text-sm"
            placeholder="0.00"
          />
        </label>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-600">
          Total: <span className="font-semibold">{monedaMXN(total)}</span>
        </span>
        <button
          type="button"
          disabled={guardando || !cambiado}
          onClick={guardar}
          className="rounded border border-[#1f2a4d] px-2 py-1 text-xs font-medium text-[#1f2a4d] hover:bg-[#1f2a4d] hover:text-white disabled:opacity-40"
        >
          {guardando ? 'Guardando…' : 'Guardar montos'}
        </button>
      </div>
      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </div>
  );
}

// ----------------------------- Previsualización de la corrida (editable si inactivo) -----------------------------

/** Botones ✓/✕ para confirmar o cancelar la edición de una celda. */
function ControlesCelda({
  ocupado,
  onConfirmar,
  onCancelar,
}: {
  ocupado: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onConfirmar}
        disabled={ocupado}
        title="Confirmar"
        aria-label="Confirmar"
        className="rounded bg-[#90BF32]/20 px-1 text-sm font-bold text-[#3f5b1a] hover:bg-[#90BF32]/40 disabled:opacity-50"
      >
        ✓
      </button>
      <button
        type="button"
        onClick={onCancelar}
        title="Cancelar"
        aria-label="Cancelar"
        className="rounded bg-gray-100 px-1 text-sm font-bold text-gray-500 hover:bg-gray-200"
      >
        ✕
      </button>
    </>
  );
}

function PreviewCorridaVenta({
  idPropiedad,
  idInversionista,
  data,
  isLoading,
  mostrar,
  editable,
  totalPlan,
  sumaPartidas,
  onCambio,
}: {
  idPropiedad: string;
  idInversionista: string;
  data: PagoVentaRow[];
  isLoading: boolean;
  mostrar: boolean;
  editable: boolean;
  totalPlan: number;
  sumaPartidas: number;
  onCambio: () => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [edit, setEdit] = useState<
    { id: string; campo: 'monto' | 'fecha' | 'tipo'; valor: string } | null
  >(null);

  const total = data.reduce((s, r) => s + (r.monto ?? 0), 0);
  const descuadre = Math.abs(sumaPartidas - totalPlan) > 0.05;
  const colSpanFull = editable ? 5 : 4;

  const refrescar = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['ventas-plan', idPropiedad] }),
      queryClient.invalidateQueries({ queryKey: ['ventas-pdp-cab', idPropiedad] }),
      queryClient.invalidateQueries({ queryKey: ['ventas-propiedades', idInversionista] }),
    ]);

  async function ejecutar(fn: () => Promise<unknown>): Promise<boolean> {
    setOcupado(true);
    setError(null);
    try {
      await fn();
      await refrescar();
      onCambio();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function guardarCelda(r: PagoVentaRow) {
    if (!edit) return;
    let fn: () => Promise<unknown>;
    if (edit.campo === 'monto') {
      const monto = Number(edit.valor);
      if (!Number.isFinite(monto) || monto < 0) {
        setError('Monto inválido.');
        return;
      }
      if (monto === (r.monto ?? 0)) {
        setEdit(null);
        return;
      }
      fn = () => ventasApi.editarMontoPartida(r.idPdpDet, monto);
    } else if (edit.campo === 'fecha') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(edit.valor)) {
        setError('Captura una fecha válida.');
        return;
      }
      if (edit.valor === (r.fecha ?? '').slice(0, 10)) {
        setEdit(null);
        return;
      }
      fn = () => ventasApi.editarFechaPartida(r.idPdpDet, edit.valor);
    } else {
      if (edit.valor === r.tipoPago) {
        setEdit(null);
        return;
      }
      fn = () => ventasApi.actualizarTipoPago(r.idPdpDet, edit.valor as TipoPago);
    }
    if (await ejecutar(fn)) setEdit(null);
  }

  async function eliminar(idPdpDet: string) {
    if (!window.confirm('¿Eliminar esta parcialidad? Esta acción no se puede deshacer.')) return;
    await ejecutar(() => ventasApi.eliminarPartida(idPdpDet));
  }

  return (
    <div className="rounded-lg border bg-white">
      <div className="flex items-center justify-between border-b border-l-4 border-l-[#1f2a4d] bg-[#1f2a4d]/5 px-3 py-2">
        <p className="text-sm font-semibold text-[#1f2a4d]">Previsualización</p>
        <div className="flex items-center gap-2">
          {editable && (
            <button
              type="button"
              disabled={ocupado}
              onClick={() => void ejecutar(() => ventasApi.agregarPartida(idPropiedad))}
              className="rounded border border-[#1f2a4d] px-2 py-0.5 text-xs font-medium text-[#1f2a4d] hover:bg-[#1f2a4d] hover:text-white disabled:opacity-40"
            >
              + Agregar partida
            </button>
          )}
          {mostrar && idPropiedad && (
            <button
              type="button"
              onClick={() => void refrescar()}
              title="Refrescar"
              className="text-xs text-[#3f5b87] hover:text-[#1f2a4d]"
            >
              ↻
            </button>
          )}
        </div>
      </div>

      {error && <p className="px-3 py-1.5 text-[11px] text-red-600">{error}</p>}

      {!mostrar ? (
        <p className="px-3 py-10 text-center text-sm text-gray-400">
          Crea el plan para ver la previsualización de la corrida.
        </p>
      ) : (
        <>
          {editable && (
            <p className="px-3 pt-2 text-[11px] text-gray-400">
              Doble clic en Tipo de pago, Fecha o Monto para editar.
            </p>
          )}
          <div className="overflow-auto" style={{ maxHeight: '60vh' }}>
            <table className="min-w-full border-collapse text-xs">
              <thead className="[&>tr>th]:sticky [&>tr>th]:top-0 [&>tr>th]:z-10 [&>tr>th]:bg-[#1f2a4d]">
                <tr className="text-left font-semibold uppercase tracking-wide text-white">
                  <th className="px-2 py-2 text-center">#</th>
                  <th className="px-2 py-2 text-left">Tipo pago</th>
                  <th className="px-2 py-2 text-left">Fecha</th>
                  <th className="px-2 py-2 text-right">Monto</th>
                  {editable && <th className="px-2 py-2 text-center">Opc.</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr>
                    <td colSpan={colSpanFull} className="px-3 py-8 text-center text-gray-400">
                      Cargando…
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={colSpanFull} className="px-3 py-8 text-center text-gray-400">
                      El plan no tiene parcialidades.
                    </td>
                  </tr>
                ) : (
                  data.map((d, i) => {
                    const enEdic = edit?.id === d.idPdpDet;
                    return (
                      <tr
                        key={d.idPdpDet}
                        className={`${i % 2 === 1 ? 'bg-[#eef3f9]' : 'bg-white'} hover:bg-blue-50`}
                      >
                        <td className="px-2 py-1 text-center">{d.numPago ?? '—'}</td>

                        {/* Tipo de pago */}
                        <td className="px-2 py-1">
                          {enEdic && edit.campo === 'tipo' ? (
                            <div className="flex items-center gap-1">
                              <select
                                autoFocus
                                value={edit.valor}
                                disabled={ocupado}
                                onChange={(e) =>
                                  setEdit({ id: d.idPdpDet, campo: 'tipo', valor: e.target.value })
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') void guardarCelda(d);
                                  if (e.key === 'Escape') setEdit(null);
                                }}
                                className="rounded border border-[#3f5b87] px-1 py-0.5 text-xs focus:outline-none"
                              >
                                {TIPOS_PAGO.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                              <ControlesCelda
                                ocupado={ocupado}
                                onConfirmar={() => void guardarCelda(d)}
                                onCancelar={() => setEdit(null)}
                              />
                            </div>
                          ) : (
                            <span
                              onDoubleClick={
                                editable
                                  ? () =>
                                      setEdit({
                                        id: d.idPdpDet,
                                        campo: 'tipo',
                                        valor: (TIPOS_PAGO.includes(d.tipoPago as TipoPago)
                                          ? d.tipoPago
                                          : 'Parcialidad') as string,
                                      })
                                  : undefined
                              }
                              className={editable ? 'cursor-pointer rounded px-1 hover:bg-gray-100' : ''}
                              title={editable ? 'Doble clic para editar' : undefined}
                            >
                              {d.tipoPago ?? '—'}
                            </span>
                          )}
                        </td>

                        {/* Fecha */}
                        <td className="px-2 py-1 whitespace-nowrap">
                          {enEdic && edit.campo === 'fecha' ? (
                            <div className="flex items-center gap-1">
                              <InputFecha
                                value={edit.valor}
                                onChange={(iso) =>
                                  setEdit({ id: d.idPdpDet, campo: 'fecha', valor: iso })
                                }
                                className="w-28 rounded border border-[#3f5b87] px-1 py-0.5 text-xs"
                              />
                              <ControlesCelda
                                ocupado={ocupado}
                                onConfirmar={() => void guardarCelda(d)}
                                onCancelar={() => setEdit(null)}
                              />
                            </div>
                          ) : (
                            <span
                              onDoubleClick={
                                editable
                                  ? () =>
                                      setEdit({
                                        id: d.idPdpDet,
                                        campo: 'fecha',
                                        valor: (d.fecha ?? '').slice(0, 10),
                                      })
                                  : undefined
                              }
                              className={editable ? 'cursor-pointer rounded px-1 hover:bg-gray-100' : ''}
                              title={editable ? 'Doble clic para editar' : undefined}
                            >
                              {fechaCortaV(d.fecha)}
                            </span>
                          )}
                        </td>

                        {/* Monto */}
                        <td className="px-2 py-1 text-right font-medium tabular-nums">
                          {enEdic && edit.campo === 'monto' ? (
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="number"
                                step="0.01"
                                autoFocus
                                value={edit.valor}
                                disabled={ocupado}
                                onChange={(e) =>
                                  setEdit({ id: d.idPdpDet, campo: 'monto', valor: e.target.value })
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') void guardarCelda(d);
                                  if (e.key === 'Escape') setEdit(null);
                                }}
                                className="w-28 rounded border border-[#3f5b87] px-1 py-0.5 text-right text-xs focus:outline-none"
                              />
                              <ControlesCelda
                                ocupado={ocupado}
                                onConfirmar={() => void guardarCelda(d)}
                                onCancelar={() => setEdit(null)}
                              />
                            </div>
                          ) : (
                            <span
                              onDoubleClick={
                                editable
                                  ? () =>
                                      setEdit({
                                        id: d.idPdpDet,
                                        campo: 'monto',
                                        valor: String(d.monto ?? 0),
                                      })
                                  : undefined
                              }
                              className={editable ? 'cursor-pointer rounded px-1 hover:bg-gray-100' : ''}
                              title={editable ? 'Doble clic para editar' : undefined}
                            >
                              {monedaMXN(d.monto)}
                            </span>
                          )}
                        </td>

                        {/* Opciones: eliminar parcialidad. Con una sola partida se
                            deshabilita: el plan debe conservar al menos una (el
                            backend también lo rechaza); para quitar el plan completo
                            está «Eliminar plan». */}
                        {editable && (
                          <td className="px-2 py-1 text-center">
                            <button
                              type="button"
                              disabled={ocupado || data.length <= 1}
                              onClick={() => void eliminar(d.idPdpDet)}
                              title={
                                data.length <= 1
                                  ? 'El plan debe conservar al menos una parcialidad. Para quitar el plan completo usa «Eliminar plan».'
                                  : 'Eliminar parcialidad'
                              }
                              aria-label="Eliminar parcialidad"
                              className="rounded p-0.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                            >
                              🗑
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
              {!isLoading && data.length > 0 && (
                <tfoot className="[&>tr>td]:sticky [&>tr>td]:bottom-0 [&>tr>td]:bg-[#5b6b8c]">
                  <tr className={`font-semibold ${descuadre ? 'text-amber-200' : 'text-white'}`}>
                    <td className="px-2 py-1.5" colSpan={3}>
                      Total{descuadre ? ' (no cuadra con el plan)' : ''}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{monedaMXN(total)}</td>
                    {editable && <td />}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </div>
  );
}
