import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ventasApi,
  hoyMexico,
  type InversionistaInput,
  type InversionistaOpt,
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
            Configuración · {inversionista.nombre} {inversionista.apellido1 ?? ''}
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
              <PropiedadesTab id={inversionista.idInversionista} onCambio={onCambio} />
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

function PropiedadesTab({ id, onCambio }: { id: string; onCambio: () => void }) {
  const queryClient = useQueryClient();
  const { data: props = [], isLoading } = useQuery({
    queryKey: ['ventas-propiedades', id],
    queryFn: () => ventasApi.propiedades(id),
  });
  const { data: naves = [] } = useQuery({
    queryKey: ['ventas-naves-disp'],
    queryFn: () => ventasApi.navesDisponibles(),
  });
  const [idNave, setIdNave] = useState('');
  const [nom, setNom] = useState('');
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
      await ventasApi.vincularNave({
        idInversionista: id,
        idNave,
        nomDescriptivo: nom || nave?.numNaveNAME || '',
        idParque: nave?.idParque ?? undefined,
      });
      setIdNave('');
      setNom('');
      await queryClient.invalidateQueries({ queryKey: ['ventas-propiedades', id] });
      onCambio();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo vincular la nave.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={vincular} className="grid grid-cols-1 gap-3 rounded-lg border bg-gray-50 p-4 sm:grid-cols-4">
        <select
          value={idNave}
          onChange={(e) => setIdNave(e.target.value)}
          className="rounded border px-2 py-1.5 text-sm sm:col-span-2"
        >
          <option value="">Selecciona una nave…</option>
          {naves.map((n) => (
            <option key={n.idNave} value={n.idNave}>
              {n.numNaveNAME ?? n.idNave} (Mz {n.mza} Lt {n.lote})
            </option>
          ))}
        </select>
        <input
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder="Nombre descriptivo"
          className="rounded border px-2 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={guardando}
          className="rounded-lg bg-[#1f2a4d] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#2a376a] disabled:opacity-50"
        >
          {guardando ? 'Vinculando…' : 'Vincular nave'}
        </button>
        {error && <p className="text-xs text-red-600 sm:col-span-4">{error}</p>}
      </form>

      <div className="overflow-hidden rounded-lg border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">Propiedad</th>
              <th className="px-3 py-2">Nave</th>
              <th className="px-3 py-2 text-center">PDP</th>
              <th className="px-3 py-2 text-center">Rta. G.</th>
              <th className="px-3 py-2 text-center">Rta. A.</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-gray-400">
                  Cargando…
                </td>
              </tr>
            ) : props.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-gray-400">
                  Sin propiedades.
                </td>
              </tr>
            ) : (
              props.map((p) => (
                <tr key={p.idPropiedad}>
                  <td className="px-3 py-2">{p.nomDescriptivo ?? '—'}</td>
                  <td className="px-3 py-2">
                    {p.nave?.numNaveNAME ?? p.idNave ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-center">{p.tienenPdp ? '✓' : '—'}</td>
                  <td className="px-3 py-2 text-center">{p.tieneRgPdp ? '✓' : '—'}</td>
                  <td className="px-3 py-2 text-center">{p.tieneRaPdp ? '✓' : '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
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
