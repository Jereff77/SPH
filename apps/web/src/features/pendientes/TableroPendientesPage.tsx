import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/useAuth';
import {
  SortableTh,
  THEAD_STICKY,
  THEAD_TR,
} from '@/components/tabla/SortableTh';
import { useSort } from '@/components/tabla/useSort';
import { FiltroColumnaOpciones } from '@/components/tabla/FiltroColumnaOpciones';
import { pendientesApi } from './pendientes.api';
import {
  COLOR_ESTADO,
  COLOR_URGENCIA,
  ESTADOS,
  ESTADOS_CERRADOS,
  TIPOS,
  URGENCIAS,
  type EstadoPendiente,
  type GuardarPendiente,
  type Pendiente,
  type TipoPendiente,
  type UrgenciaPendiente,
} from './types';

const VACIO = '(sin módulo)';

/** Ficha en blanco: solo el título es obligatorio, capturar tiene que ser barato. */
const NUEVO: GuardarPendiente = {
  titulo: '',
  descripcion: '',
  notas: '',
  origen: '',
  modulo: '',
  versionResuelto: '',
  tipo: 'deuda_tecnica',
  urgencia: 'p2',
  estado: 'propuesto',
};

function Chip({ texto, cls }: { texto: string; cls: string }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${cls}`}>
      {texto}
    </span>
  );
}

/** Contador del encabezado. Solo cuenta lo ABIERTO: el tablero es para trabajar. */
function Contador({
  etiqueta,
  valor,
  destacado,
}: {
  etiqueta: string;
  valor: number;
  destacado?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        destacado && valor > 0
          ? 'border-red-200 bg-red-50'
          : 'border-gray-200 bg-white'
      }`}
    >
      <div className="text-2xl font-semibold text-gray-900">{valor}</div>
      <div className="text-xs uppercase tracking-wide text-gray-500">{etiqueta}</div>
    </div>
  );
}

export function TableroPendientesPage() {
  const { esSoporte } = useAuth();
  const qc = useQueryClient();

  const [verCerrados, setVerCerrados] = useState(false);
  const [edicion, setEdicion] = useState<GuardarPendiente | null>(null);
  const [fTipo, setFTipo] = useState<Set<string>>(new Set());
  const [fUrgencia, setFUrgencia] = useState<Set<string>>(new Set());
  const [fEstado, setFEstado] = useState<Set<string>>(new Set());
  const [fModulo, setFModulo] = useState<Set<string>>(new Set());

  const { data, isLoading, error } = useQuery({
    queryKey: ['pendientes', verCerrados],
    queryFn: () => pendientesApi.listar(verCerrados),
    enabled: esSoporte,
  });

  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ['pendientes'] });
  };

  const mGuardar = useMutation({
    mutationFn: (dto: GuardarPendiente) => pendientesApi.guardar(dto),
    onSuccess: () => {
      setEdicion(null);
      invalidar();
    },
  });

  const mEstado = useMutation({
    mutationFn: (p: { id: number; estado: EstadoPendiente }) =>
      pendientesApi.cambiarEstado(p.id, p.estado),
    onSuccess: invalidar,
  });

  const mBorrar = useMutation({
    mutationFn: (id: number) => pendientesApi.borrar(id),
    onSuccess: invalidar,
  });

  const filas = useMemo(() => data?.filas ?? [], [data]);

  const modulos = useMemo(
    () => [...new Set(filas.map((f) => f.modulo?.trim() || VACIO))].sort(),
    [filas],
  );

  const filtradas = useMemo(
    () =>
      filas.filter(
        (f) =>
          (fTipo.size === 0 || fTipo.has(TIPOS[f.tipo])) &&
          (fUrgencia.size === 0 || fUrgencia.has(URGENCIAS[f.urgencia])) &&
          (fEstado.size === 0 || fEstado.has(ESTADOS[f.estado])) &&
          (fModulo.size === 0 || fModulo.has(f.modulo?.trim() || VACIO)),
      ),
    [filas, fTipo, fUrgencia, fEstado, fModulo],
  );

  const { ordenados, sortKey, dir, toggle } = useSort(filtradas, {
    id: (p: Pendiente) => p.id,
    titulo: (p: Pendiente) => p.titulo,
    tipo: (p: Pendiente) => TIPOS[p.tipo],
    urgencia: (p: Pendiente) => p.urgencia,
    estado: (p: Pendiente) => ESTADOS[p.estado],
    modulo: (p: Pendiente) => p.modulo,
  });

  if (!esSoporte) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          Esta sección está restringida al personal de soporte.
        </div>
      </div>
    );
  }

  const r = data?.resumen;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Pendientes</h1>
          <p className="mt-1 text-sm text-gray-500">
            Destino <strong>único</strong> del trabajo pendiente del proyecto: deuda
            técnica, bugs conocidos, mejoras, módulos nuevos, peticiones de negocio y
            decisiones abiertas. Los archivos <code>DEUDA.md</code> quedaron congelados
            como histórico: el estado vigente es el de esta tabla.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEdicion({ ...NUEVO })}
          className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a3a68]"
        >
          + Nuevo pendiente
        </button>
      </header>

      {r && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Contador etiqueta="Abiertos" valor={r.abiertos} />
          <Contador etiqueta="P0 crítica" valor={r.p0} destacado />
          <Contador etiqueta="P1 alta" valor={r.p1} />
          <Contador etiqueta="En curso" valor={r.enCurso} />
          <Contador etiqueta="Bloqueados" valor={r.bloqueados} />
        </div>
      )}

      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={verCerrados}
          onChange={(e) => setVerCerrados(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        Ver terminados y descartados
      </label>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          No se pudo cargar el tablero.
        </div>
      )}

      <div className="overflow-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className={THEAD_STICKY}>
            <tr className={THEAD_TR}>
              <SortableTh campo="id" sortKey={sortKey} dir={dir} onSort={toggle} align="right">
                #
              </SortableTh>
              <SortableTh campo="titulo" sortKey={sortKey} dir={dir} onSort={toggle}>
                Pendiente
              </SortableTh>
              <SortableTh
                campo="tipo"
                sortKey={sortKey}
                dir={dir}
                onSort={toggle}
                filtro={
                  <FiltroColumnaOpciones
                    etiqueta="Tipo"
                    opciones={Object.values(TIPOS)}
                    seleccion={fTipo}
                    onChange={setFTipo}
                  />
                }
              >
                Tipo
              </SortableTh>
              <SortableTh
                campo="urgencia"
                sortKey={sortKey}
                dir={dir}
                onSort={toggle}
                filtro={
                  <FiltroColumnaOpciones
                    etiqueta="Urgencia"
                    opciones={Object.values(URGENCIAS)}
                    seleccion={fUrgencia}
                    onChange={setFUrgencia}
                  />
                }
              >
                Urgencia
              </SortableTh>
              <SortableTh
                campo="estado"
                sortKey={sortKey}
                dir={dir}
                onSort={toggle}
                filtro={
                  <FiltroColumnaOpciones
                    etiqueta="Estado"
                    opciones={Object.values(ESTADOS)}
                    seleccion={fEstado}
                    onChange={setFEstado}
                  />
                }
              >
                Estado
              </SortableTh>
              <SortableTh
                campo="modulo"
                sortKey={sortKey}
                dir={dir}
                onSort={toggle}
                filtro={
                  <FiltroColumnaOpciones
                    etiqueta="Módulo"
                    opciones={modulos}
                    seleccion={fModulo}
                    onChange={setFModulo}
                  />
                }
              >
                Módulo
              </SortableTh>
              <SortableTh align="center">Acciones</SortableTh>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  Cargando…
                </td>
              </tr>
            )}
            {!isLoading && ordenados.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  Sin pendientes que mostrar.
                </td>
              </tr>
            )}
            {ordenados.map((p) => {
              const cerrado = ESTADOS_CERRADOS.includes(p.estado);
              return (
                <tr
                  key={p.id}
                  className={`align-top hover:bg-gray-50 ${cerrado ? 'opacity-60' : ''}`}
                >
                  <td className="px-3 py-2 text-right font-mono text-xs text-gray-500">
                    {p.id}
                  </td>
                  <td className="max-w-xl px-3 py-2">
                    <button
                      type="button"
                      onClick={() =>
                        setEdicion({
                          id: p.id,
                          titulo: p.titulo,
                          descripcion: p.descripcion ?? '',
                          notas: p.notas ?? '',
                          origen: p.origen ?? '',
                          modulo: p.modulo ?? '',
                          versionResuelto: p.version_resuelto ?? '',
                          tipo: p.tipo,
                          urgencia: p.urgencia,
                          estado: p.estado,
                        })
                      }
                      className="text-left font-medium text-[#1f2a4d] hover:underline"
                    >
                      {p.titulo}
                    </button>
                    {p.descripcion && (
                      <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                        {p.descripcion}
                      </p>
                    )}
                    {p.origen && (
                      <p className="mt-1 text-[11px] text-gray-400">📎 {p.origen}</p>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-700">{TIPOS[p.tipo]}</td>
                  <td className="px-3 py-2">
                    <Chip texto={URGENCIAS[p.urgencia]} cls={COLOR_URGENCIA[p.urgencia]} />
                  </td>
                  <td className="px-3 py-2">
                    {/* El estado se cambia desde la propia fila: si mover algo exige
                        abrir un diálogo, nadie lo mueve y el tablero se desactualiza. */}
                    <select
                      value={p.estado}
                      onChange={(e) =>
                        mEstado.mutate({
                          id: p.id,
                          estado: e.target.value as EstadoPendiente,
                        })
                      }
                      className={`rounded border-0 px-2 py-1 text-xs font-medium ${COLOR_ESTADO[p.estado]}`}
                    >
                      {Object.entries(ESTADOS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                    {p.version_resuelto && (
                      <div className="mt-1 text-[11px] text-gray-400">
                        v{p.version_resuelto}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-700">{p.modulo ?? '—'}</td>
                  <td className="px-3 py-2 text-center whitespace-nowrap">
                    <button
                      type="button"
                      title="Eliminar (mejor usa «Descartado»: conserva el registro)"
                      onClick={() => {
                        if (
                          window.confirm(
                            `¿Eliminar el pendiente #${p.id}?\n\n"${p.titulo}"\n\nBorrar pierde el registro. Si solo quieres sacarlo del tablero, cámbialo a «Descartado».`,
                          )
                        )
                          mBorrar.mutate(p.id);
                      }}
                      className="text-gray-400 hover:text-red-600"
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {edicion && (
        <DialogoPendiente
          valor={edicion}
          guardando={mGuardar.isPending}
          error={mGuardar.error ? 'No se pudo guardar.' : null}
          onCancelar={() => setEdicion(null)}
          onGuardar={(v) => mGuardar.mutate(v)}
        />
      )}
    </div>
  );
}

/** Nuevo y Editar comparten diálogo: lo único obligatorio es el título. */
function DialogoPendiente({
  valor,
  guardando,
  error,
  onCancelar,
  onGuardar,
}: {
  valor: GuardarPendiente;
  guardando: boolean;
  error: string | null;
  onCancelar: () => void;
  onGuardar: (v: GuardarPendiente) => void;
}) {
  const [v, setV] = useState<GuardarPendiente>(valor);
  const set = <K extends keyof GuardarPendiente>(k: K, val: GuardarPendiente[K]) =>
    setV((x) => ({ ...x, [k]: val }));

  const campo = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">
          {v.id ? `Pendiente #${v.id}` : 'Nuevo pendiente'}
        </h2>

        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Título <span className="text-red-600">*</span>
            </label>
            <input
              value={v.titulo}
              onChange={(e) => set('titulo', e.target.value)}
              placeholder="El problema afirmado, en lenguaje de negocio"
              className={campo}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Tipo</label>
              <select
                value={v.tipo}
                onChange={(e) => set('tipo', e.target.value as TipoPendiente)}
                className={campo}
              >
                {Object.entries(TIPOS).map(([k, t]) => (
                  <option key={k} value={k}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Urgencia
              </label>
              <select
                value={v.urgencia}
                onChange={(e) => set('urgencia', e.target.value as UrgenciaPendiente)}
                className={campo}
              >
                {Object.entries(URGENCIAS).map(([k, t]) => (
                  <option key={k} value={k}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Estado
              </label>
              <select
                value={v.estado}
                onChange={(e) => set('estado', e.target.value as EstadoPendiente)}
                className={campo}
              >
                {Object.entries(ESTADOS).map(([k, t]) => (
                  <option key={k} value={k}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Módulo
              </label>
              <input
                value={v.modulo ?? ''}
                onChange={(e) => set('modulo', e.target.value)}
                placeholder="cxp, fideicomiso, seguridad-bd…"
                className={campo}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Descripción — el qué y el porqué
            </label>
            <textarea
              value={v.descripcion ?? ''}
              onChange={(e) => set('descripcion', e.target.value)}
              rows={6}
              placeholder="Qué pasa, con evidencia concreta (archivo:línea, tabla, cifras reales). Si se difirió, por qué se difirió."
              className={`${campo} font-mono text-xs`}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Notas — el arreglo propuesto
            </label>
            <textarea
              value={v.notas ?? ''}
              onChange={(e) => set('notas', e.target.value)}
              rows={4}
              placeholder="Cómo se arregla y las trampas al implementarlo."
              className={`${campo} font-mono text-xs`}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Origen (traza al análisis largo)
              </label>
              <input
                value={v.origen ?? ''}
                onChange={(e) => set('origen', e.target.value)}
                placeholder="DEUDA.md P0-1 · Sesión 2026-08-26 · lo pidió…"
                className={campo}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Versión en que se resolvió
              </label>
              <input
                value={v.versionResuelto ?? ''}
                onChange={(e) => set('versionResuelto', e.target.value)}
                placeholder="2.70.0"
                className={campo}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={guardando || v.titulo.trim() === ''}
            onClick={() => onGuardar(v)}
            className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a3a68] disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
