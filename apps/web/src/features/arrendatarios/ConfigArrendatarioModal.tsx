import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  arrendatariosApi,
  nombreArrendatario,
  type ArrendatarioOpt,
} from './arrendatarios.api';
import { PlanPagoForm } from './PlanPagoForm';
import { Tabs, type TabDef } from '@/components/Tabs';

const SUBTABS: TabDef[] = [
  { id: 'datos', label: 'Datos Generales' },
  { id: 'docs', label: 'Documentos' },
  { id: 'propiedades', label: 'Propiedades' },
  { id: 'plan', label: 'Plan de Pagos' },
];

const esUrl = (u: string | null): u is string => !!u && /^https?:\/\//.test(u);

/**
 * Configuración (⚙) del arrendatario — 4 sub-pestañas: Datos Generales (solo
 * lectura; el alta/edición vive en Clientes), Documentos, Propiedades y Plan de
 * Pagos. Reemplaza `ConfigArrendatariosWidget` de v1.
 */
export function ConfigArrendatarioModal({
  arrendatario,
  onClose,
}: {
  arrendatario: ArrendatarioOpt;
  onClose: () => void;
}) {
  const [sub, setSub] = useState('datos');
  const id = arrendatario.idInversionista;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b bg-[#1f2a4d] px-5 py-3 text-white">
          <h2 className="text-base font-semibold">
            Configuración · {nombreArrendatario(arrendatario)}
          </h2>
          <button onClick={onClose} className="text-white/80 hover:text-white" aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="p-5">
          <Tabs tabs={SUBTABS} activo={sub} onChange={setSub} />
          <div className="pt-4">
            {sub === 'datos' && <DatosGeneralesTab id={id} />}
            {sub === 'docs' && <DocumentosTab id={id} />}
            {sub === 'propiedades' && (
              <PropiedadesTab id={id} nombre={nombreArrendatario(arrendatario)} />
            )}
            {sub === 'plan' && <PlanPagoForm idArrendador={id} onCambio={() => undefined} />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------- Datos Generales (solo lectura) -----------------------------

function DatosGeneralesTab({ id }: { id: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['arre-datos', id],
    queryFn: () => arrendatariosApi.datos(id),
  });
  if (isLoading || !data) return <p className="text-sm text-gray-400">Cargando…</p>;

  const campo = (label: string, valor: string | null) => (
    <div>
      <span className="text-xs text-gray-500">{label}</span>
      <p className="rounded border bg-gray-50 px-2 py-1.5 text-sm text-gray-800">{valor || '—'}</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">
        Solo lectura. El alta/edición del padrón se realiza en el módulo Clientes.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {campo('Personalidad', data.personalidad)}
        {campo('Nombre', data.nombre)}
        {campo('Razón social', data.razonsocial)}
        {campo('Apellido 1', data.apellido1)}
        {campo('Apellido 2', data.apellido2)}
        {campo('Fecha de nacimiento', data.fecNacimiento)}
        {campo('Teléfono', data.telefono)}
        {campo('Correo', data.correo)}
        {campo('RFC', data.RFC)}
        {campo('CURP', data.CURP)}
      </div>
    </div>
  );
}

// ----------------------------- Documentos -----------------------------

function DocumentosTab({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['arre-docs', id],
    queryFn: () => arrendatariosApi.docs(id),
  });
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['arre-docs', id] });

  async function subir(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!archivo || !titulo.trim()) {
      setError('Captura un título y selecciona un archivo.');
      return;
    }
    setSubiendo(true);
    try {
      await arrendatariosApi.subirDoc(id, titulo.trim(), descripcion.trim(), archivo);
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
    await arrendatariosApi.eliminarDoc(idDoc);
    await refrescar();
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={subir}
        className="grid grid-cols-1 gap-3 rounded-lg border bg-gray-50 p-4 sm:grid-cols-4"
      >
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
        <input type="file" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} className="text-xs" />
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
                      <a href={d.urldoc} target="_blank" rel="noreferrer" className="text-[#3f5b87] underline">
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

function PropiedadesTab({ id, nombre }: { id: string; nombre: string }) {
  const queryClient = useQueryClient();
  const { data: props = [], isLoading } = useQuery({
    queryKey: ['arre-propiedades', id],
    queryFn: () => arrendatariosApi.propiedades(id),
  });
  const { data: parques = [] } = useQuery({
    queryKey: ['arre-parques'],
    queryFn: () => arrendatariosApi.parques(),
  });
  const [idParque, setIdParque] = useState('');
  const { data: naves = [] } = useQuery({
    queryKey: ['arre-naves-disp', idParque],
    queryFn: () => arrendatariosApi.navesDisponibles(idParque),
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
      await arrendatariosApi.vincularNave({
        idArrendador: id,
        idNave,
        idParque: nave?.idParque ?? undefined,
      });
      setIdNave('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['arre-propiedades', id] }),
        queryClient.invalidateQueries({ queryKey: ['arre-naves-disp', idParque] }),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo vincular la nave.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={vincular}
        className="grid grid-cols-1 gap-3 rounded-lg border bg-gray-50 p-4 sm:grid-cols-3"
      >
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
          <option value="">{idParque ? 'Selecciona una nave…' : 'Primero el parque'}</option>
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
        <p className="py-6 text-center text-sm text-gray-400">Sin propiedades arrendadas.</p>
      ) : (
        <div className="space-y-2">
          {props.map((p) => (
            <div
              key={p.idNavArrend}
              className="flex items-center justify-between rounded-lg border bg-white px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-[#3f5b87]">
                  {p.nomDescriptivo ?? p.numNaveNAME ?? p.idNavArrend}
                </p>
                <p className="text-xs text-gray-400">
                  {nombre} · {p.nomParque ?? '—'}
                </p>
              </div>
              <div className="flex gap-1.5">
                {p.tienePdp && (
                  <span className="rounded-full bg-[#1f2a4d]/10 px-2 py-0.5 text-[11px] font-medium text-[#1f2a4d]">
                    PDP
                  </span>
                )}
                {p.pdpActivo && (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">
                    Activo
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
