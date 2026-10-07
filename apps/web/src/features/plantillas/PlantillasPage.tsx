import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/Badge';
import { Modal } from '@/components/ui/Modal';
import { SortableTh, THEAD_STICKY, THEAD_TR } from '@/components/tabla/SortableTh';
import { useSort } from '@/components/tabla/useSort';
import { useAuth } from '@/features/auth/useAuth';
import { ApiRequestError } from '@/lib/api';
import {
  ETIQUETA_TIPO,
  formatearFecha,
  plantillasApi,
  type PlantillaResumen,
  type TipoPlantilla,
} from './plantillas.api';
import { IconBaja, IconDuplicar, IconLapiz, IconLupa } from './iconos';

const MOTIVO_MIN = 20;

/** Parques → Plantillas: listado de machotes de documentos de KVA's. */
export default function PlantillasPage() {
  const { tienePermiso } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const puedeVer = tienePermiso(730) || tienePermiso(731) || tienePermiso(721);
  const puedeEditar = tienePermiso(731);
  const puedeVerBajas = tienePermiso(730) || tienePermiso(731);

  const [busqueda, setBusqueda] = useState('');
  const [tipo, setTipo] = useState<'' | TipoPlantilla>('');
  const [estado, setEstado] = useState<'activas' | 'bajas' | 'todas'>('activas');
  const [nueva, setNueva] = useState(false);
  const [aBaja, setABaja] = useState<PlantillaResumen | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['plantillas', 'lista', puedeVerBajas],
    queryFn: () => plantillasApi.listar(puedeVerBajas),
    enabled: puedeVer,
  });

  const duplicar = useMutation({
    mutationFn: (id: string) => plantillasApi.duplicar(id),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['plantillas'] });
      navigate(`/parques/plantillas/${r.idPlantilla}`);
    },
    onError: (e) =>
      setErrorAccion(e instanceof ApiRequestError ? e.message : 'No se pudo duplicar la plantilla.'),
  });

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (data ?? []).filter(
      (p) =>
        (!q || p.nombre.toLowerCase().includes(q)) &&
        (!tipo || p.tipo === tipo) &&
        (estado === 'todas' || (estado === 'activas' ? p.status : !p.status)),
    );
  }, [data, busqueda, tipo, estado]);

  const accessors = useMemo(
    () => ({
      nombre: (p: PlantillaResumen) => p.nombre,
      tipo: (p: PlantillaResumen) => ETIQUETA_TIPO[p.tipo],
      version: (p: PlantillaResumen) => p.versionActual,
      actualizada: (p: PlantillaResumen) => new Date(p.fum ?? p.fc).getTime(),
      estado: (p: PlantillaResumen) => p.status,
    }),
    [],
  );
  const { ordenados, sortKey, dir, toggle } = useSort(filtradas, accessors, {
    key: 'actualizada',
    dir: 'desc',
  });

  if (!puedeVer) {
    return (
      <div className="p-6 text-sm text-gray-500">No tienes permiso para ver las plantillas.</div>
    );
  }

  const hayFiltros = busqueda !== '' || tipo !== '' || estado !== 'activas';
  const sinNada = !isLoading && !error && (data?.length ?? 0) === 0;

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto bg-gray-50 p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">Plantillas</h1>
          <p className="text-xs text-gray-500">
            Machotes de documentos para Parques · KVA&apos;s. Se eligen al asignar KVA&apos;s.
          </p>
        </div>
        {puedeEditar && (
          <button
            type="button"
            onClick={() => setNueva(true)}
            className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a3869]"
          >
            + Nueva plantilla
          </button>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative">
          <span className="sr-only">Buscar por nombre</span>
          <IconLupa className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" width={16} height={16} />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre"
            className="w-64 rounded-lg border border-gray-300 bg-white py-2 pl-8 pr-3 text-sm outline-none focus:border-[#1f2a4d]"
          />
        </label>
        <label className="text-sm text-gray-600">
          <span className="sr-only">Tipo</span>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as '' | TipoPlantilla)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1f2a4d]"
          >
            <option value="">Tipo: todos</option>
            <option value="ASIGNACION_CARGA">Asignación de carga</option>
            <option value="DEVOLUCION">Devolución</option>
          </select>
        </label>
        <label className="text-sm text-gray-600">
          <span className="sr-only">Estado</span>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value as 'activas' | 'bajas' | 'todas')}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1f2a4d]"
          >
            <option value="activas">Estado: activas</option>
            <option value="bajas">Estado: dadas de baja</option>
            <option value="todas">Estado: todas</option>
          </select>
        </label>
        {hayFiltros && (
          <button
            type="button"
            onClick={() => {
              setBusqueda('');
              setTipo('');
              setEstado('activas');
            }}
            className="text-sm text-[#1f2a4d] underline"
          >
            Quitar filtros
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>No pudimos cargar las plantillas. Reintenta.</span>
          <button type="button" onClick={() => void refetch()} className="rounded border border-red-300 px-2 py-1 text-xs">
            Reintentar
          </button>
        </div>
      )}
      {errorAccion && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorAccion}
        </p>
      )}

      <div className="scrollbar-hide max-h-[calc(100vh-14rem)] overflow-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className={THEAD_STICKY}>
            <tr className={THEAD_TR}>
              <SortableTh campo="nombre" sortKey={sortKey} dir={dir} onSort={toggle} className="px-4 py-2.5">Nombre</SortableTh>
              <SortableTh campo="tipo" sortKey={sortKey} dir={dir} onSort={toggle} className="px-4 py-2.5">Tipo</SortableTh>
              <SortableTh campo="version" sortKey={sortKey} dir={dir} onSort={toggle} className="px-4 py-2.5">Versión</SortableTh>
              <SortableTh campo="actualizada" sortKey={sortKey} dir={dir} onSort={toggle} className="px-4 py-2.5">Actualizada</SortableTh>
              <SortableTh campo="estado" sortKey={sortKey} dir={dir} onSort={toggle} className="px-4 py-2.5">Estado</SortableTh>
              <th className="px-4 py-2.5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td colSpan={6} className="px-4 py-3">
                    <div className="h-4 animate-pulse rounded bg-gray-100" />
                  </td>
                </tr>
              ))}
            {ordenados.map((p) => (
              <tr
                key={p.idPlantilla}
                onClick={() => navigate(`/parques/plantillas/${p.idPlantilla}`)}
                className="cursor-pointer border-t border-gray-100 hover:bg-gray-50"
              >
                <td className="px-4 py-3 font-medium text-gray-800">{p.nombre}</td>
                <td className="px-4 py-3">
                  <Badge color="azul">{ETIQUETA_TIPO[p.tipo]}</Badge>
                </td>
                <td className="px-4 py-3 tabular-nums text-gray-700">v{p.versionActual}</td>
                <td className="px-4 py-3 tabular-nums text-gray-600">{formatearFecha(p.fum ?? p.fc)}</td>
                <td className="px-4 py-3">
                  <Badge color={p.status ? 'verde' : 'gris'}>{p.status ? 'Activa' : 'Baja'}</Badge>
                </td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-1">
                    {puedeEditar && p.status && (
                      <BotonIcono titulo="Editar" onClick={() => navigate(`/parques/plantillas/${p.idPlantilla}`)}>
                        <IconLapiz />
                      </BotonIcono>
                    )}
                    {puedeEditar && (
                      <BotonIcono
                        titulo="Duplicar"
                        deshabilitado={duplicar.isPending}
                        onClick={() => {
                          setErrorAccion(null);
                          duplicar.mutate(p.idPlantilla);
                        }}
                      >
                        <IconDuplicar />
                      </BotonIcono>
                    )}
                    {puedeEditar && p.status && (
                      <BotonIcono titulo="Dar de baja" peligro onClick={() => setABaja(p)}>
                        <IconBaja />
                      </BotonIcono>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sinNada && (
          <div className="px-4 py-10 text-center text-sm text-gray-500">
            <p>Aún no hay plantillas.</p>
            {!puedeEditar && <p className="mt-1">Pide a quien administre que cree la primera.</p>}
          </div>
        )}
        {!isLoading && !error && !sinNada && ordenados.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-gray-500">
            Ninguna plantilla coincide con los filtros.
          </div>
        )}
      </div>

      <NuevaPlantillaModal abierto={nueva} onCerrar={() => setNueva(false)} />
      <BajaModal plantilla={aBaja} onCerrar={() => setABaja(null)} />
    </div>
  );
}

function BotonIcono({
  titulo,
  onClick,
  children,
  peligro,
  deshabilitado,
}: {
  titulo: string;
  onClick: () => void;
  children: React.ReactNode;
  peligro?: boolean;
  deshabilitado?: boolean;
}) {
  return (
    <span className="group relative">
      <button
        type="button"
        aria-label={titulo}
        disabled={deshabilitado}
        onClick={onClick}
        className={`rounded-md p-1.5 text-gray-500 disabled:opacity-40 ${
          peligro ? 'hover:bg-red-50 hover:text-red-600' : 'hover:bg-gray-100 hover:text-[#1f2a4d]'
        }`}
      >
        {children}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute -top-7 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded bg-gray-800 px-2 py-0.5 text-[11px] text-white opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
      >
        {titulo}
      </span>
    </span>
  );
}

function NuevaPlantillaModal({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const navigate = useNavigate();
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<TipoPlantilla>('ASIGNACION_CARGA');
  const [error, setError] = useState('');

  function continuar() {
    if (!nombre.trim()) {
      setError('Escribe un nombre para la plantilla.');
      return;
    }
    onCerrar();
    navigate(`/parques/plantillas/nueva?tipo=${tipo}&nombre=${encodeURIComponent(nombre.trim())}`);
    setNombre('');
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Nueva plantilla"
      ancho="sm"
      pie={
        <>
          <button type="button" onClick={onCerrar} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm">
            Cancelar
          </button>
          <button type="button" onClick={continuar} className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white">
            Continuar
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Nombre
          <input
            value={nombre}
            maxLength={120}
            onChange={(e) => {
              setNombre(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && continuar()}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#1f2a4d]"
          />
          {error && <span className="text-xs text-red-600">{error}</span>}
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Tipo
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoPlantilla)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#1f2a4d]"
          >
            <option value="ASIGNACION_CARGA">Asignación de carga</option>
            <option value="DEVOLUCION">Devolución</option>
          </select>
        </label>
      </div>
    </Modal>
  );
}

function BajaModal({ plantilla, onCerrar }: { plantilla: PlantillaResumen | null; onCerrar: () => void }) {
  const qc = useQueryClient();
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');

  const baja = useMutation({
    mutationFn: () => plantillasApi.baja(plantilla!.idPlantilla, motivo.trim()),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['plantillas'] });
      setMotivo('');
      setError('');
      onCerrar();
    },
    onError: (e) => setError(e instanceof ApiRequestError ? e.message : 'No se pudo dar de baja.'),
  });

  const valido = motivo.trim().length >= MOTIVO_MIN;

  return (
    <Modal
      abierto={!!plantilla}
      onCerrar={onCerrar}
      titulo="Dar de baja la plantilla"
      ancho="sm"
      bloqueado={baja.isPending}
      pie={
        <>
          <button type="button" onClick={onCerrar} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm">
            Cancelar
          </button>
          <button
            type="button"
            disabled={!valido || baja.isPending}
            onClick={() => baja.mutate()}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {baja.isPending ? 'Dando de baja…' : 'Dar de baja'}
          </button>
        </>
      }
    >
      <p className="mb-3 text-sm text-gray-600">
        «{plantilla?.nombre}» dejará de ofrecerse al generar documentos. Se conserva su historial.
      </p>
      <label className="flex flex-col gap-1 text-sm text-gray-700">
        Motivo (obligatorio)
        <textarea
          rows={3}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#1f2a4d]"
        />
        <span className={`text-xs ${valido ? 'text-gray-400' : 'text-gray-500'}`}>
          {motivo.trim().length}/{MOTIVO_MIN} caracteres mínimo
        </span>
      </label>
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
    </Modal>
  );
}
