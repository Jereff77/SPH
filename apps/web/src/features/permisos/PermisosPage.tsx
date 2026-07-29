import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { permisosApi, type PermisoUsuario } from './permisos.api';
import { Toggle } from '@/components/Toggle';
import {
  SortableTh,
  THEAD_STICKY,
  THEAD_TR,
} from '@/components/tabla/SortableTh';
import { useSort, type Accessors } from '@/components/tabla/useSort';
import { SearchSelect } from '@/components/SearchSelect';
import { ApiRequestError } from '@/lib/api';

const ACCESSORS_PERM: Accessors<PermisoUsuario> = {
  modulo: (p) => p.modulo,
  seccion: (p) => p.seccion,
  area: (p) => p.area,
  clave: (p) => p.clave ?? 0,
  acceso: (p) => p.acceso,
};

const CATEGORIAS = [
  'General',
  'Ventas',
  'Administración',
  'Soporte',
  'Operaciones',
  'Finanzas',
];

export function PermisosPage() {
  const queryClient = useQueryClient();
  const [uid, setUid] = useState('');
  const [moduloFiltro, setModuloFiltro] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);

  const { data: usuarios = [] } = useQuery({
    queryKey: ['permisos-usuarios'],
    queryFn: () => permisosApi.listarUsuarios(),
  });
  const { data: plantillas = [] } = useQuery({
    queryKey: ['permisos-plantillas'],
    queryFn: () => permisosApi.listarPlantillas(),
  });

  const permKey = ['permisos', uid];
  const { data: permisos = [], isLoading } = useQuery({
    queryKey: permKey,
    queryFn: () => permisosApi.obtenerPermisos(uid),
    enabled: !!uid,
  });

  const onError = (e: unknown) =>
    setError(e instanceof ApiRequestError ? e.message : 'Ocurrió un error.');

  const toggle = useMutation({
    mutationFn: ({ idsegModulos, acceso }: { idsegModulos: string; acceso: boolean }) =>
      permisosApi.setAcceso(uid, idsegModulos, acceso),
    onMutate: async ({ idsegModulos, acceso }) => {
      setError(null);
      await queryClient.cancelQueries({ queryKey: permKey });
      const prev = queryClient.getQueryData<PermisoUsuario[]>(permKey);
      queryClient.setQueryData<PermisoUsuario[]>(permKey, (old) =>
        old?.map((p) =>
          p.idsegModulos === idsegModulos ? { ...p, acceso } : p,
        ),
      );
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(permKey, ctx.prev);
      onError(e);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: permKey }),
  });

  const opcionesUsuarios = useMemo(
    () => usuarios.map((u) => ({ value: u.uid, label: u.nombre })),
    [usuarios],
  );

  /**
   * Descarga la matriz completa usuarios × permisos en Excel. Pide los datos al
   * backend (hereda la clave 220 de esta pantalla) y arma el archivo en el
   * navegador con ExcelJS por carga diferida, igual que Contabilidad y Kardex:
   * así el generador no entra al bundle inicial de quien nunca lo usa.
   */
  async function descargarMatriz() {
    setError(null);
    setExportando(true);
    try {
      const datos = await permisosApi.matriz();
      const hoy = new Date().toISOString().slice(0, 10);
      const mod = await import('./permisos-export');
      await mod.exportarMatrizPermisosExcel(datos, `Matriz-Usuarios-Permisos-${hoy}`);
    } catch (e) {
      onError(e);
    } finally {
      setExportando(false);
    }
  }

  const modulos = useMemo(
    () => [...new Set(permisos.map((p) => p.modulo))].sort(),
    [permisos],
  );
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const lista = permisos.filter((p) => {
      if (moduloFiltro && p.modulo !== moduloFiltro) return false;
      if (!q) return true;
      return (
        p.modulo.toLowerCase().includes(q) ||
        p.seccion.toLowerCase().includes(q) ||
        (p.area ?? '').toLowerCase().includes(q) ||
        String(p.clave ?? '').includes(q)
      );
    });
    // Orden base agradable (módulo → sección → clave); useSort puede reordenar.
    return [...lista].sort(
      (a, b) =>
        a.modulo.localeCompare(b.modulo) ||
        a.seccion.localeCompare(b.seccion) ||
        (a.clave ?? 0) - (b.clave ?? 0),
    );
  }, [permisos, moduloFiltro, busqueda]);

  const { ordenados, sortKey, dir, toggle: ordenar } = useSort(
    visibles,
    ACCESSORS_PERM,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-800">
            Permisos
          </h1>
          <p className="text-sm text-gray-500">
            Asigna accesos por usuario y gestiona plantillas de permisos.
          </p>
        </div>
        {/* Reporte de TODOS los usuarios: no depende del usuario seleccionado. */}
        <button
          type="button"
          onClick={() => void descargarMatriz()}
          disabled={exportando}
          title="Descarga la matriz de todos los usuarios contra todos los permisos, con la descripción de cada uno"
          className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {exportando ? 'Generando…' : '📊 Descargar matriz (Excel)'}
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Selector de usuario */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-gray-600">
          Usuario
          <SearchSelect
            value={uid}
            onChange={setUid}
            options={opcionesUsuarios}
            placeholder="Selecciona un usuario…"
            className="mt-1 w-72"
          />
        </label>
        {uid && modulos.length > 0 && (
          <label className="text-xs text-gray-600">
            Filtrar módulo
            <select
              value={moduloFiltro}
              onChange={(e) => setModuloFiltro(e.target.value)}
              className="mt-1 block w-56 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
            >
              <option value="">Todos</option>
              {modulos.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        )}
        {uid && (
          <label className="text-xs text-gray-600">
            Buscar
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Módulo, sección, área o clave…"
              className="mt-1 block w-64 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
            />
          </label>
        )}
      </div>

      {!uid && (
        <p className="text-sm text-gray-400">
          Selecciona un usuario para ver y editar sus permisos.
        </p>
      )}

      {uid && (
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Tabla de permisos */}
          <div className="lg:col-span-2">
            <div className="max-h-[60vh] overflow-auto rounded-xl border bg-white">
              <table className="w-full min-w-[520px] text-sm">
                <thead className={THEAD_STICKY}>
                  <tr className={THEAD_TR}>
                    <SortableTh campo="modulo" sortKey={sortKey} dir={dir} onSort={ordenar}>
                      Módulo
                    </SortableTh>
                    <SortableTh campo="seccion" sortKey={sortKey} dir={dir} onSort={ordenar}>
                      Sección
                    </SortableTh>
                    <SortableTh campo="area" sortKey={sortKey} dir={dir} onSort={ordenar}>
                      Área / Acción
                    </SortableTh>
                    <SortableTh
                      campo="clave"
                      sortKey={sortKey}
                      dir={dir}
                      onSort={ordenar}
                      align="center"
                    >
                      Clave
                    </SortableTh>
                    <SortableTh
                      campo="acceso"
                      sortKey={sortKey}
                      dir={dir}
                      onSort={ordenar}
                      align="center"
                    >
                      Acceso
                    </SortableTh>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {isLoading && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                        Cargando permisos…
                      </td>
                    </tr>
                  )}
                  {ordenados.map((p) => (
                    <tr key={p.idsegModulos} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-700">
                        {p.modulo}
                      </td>
                      <td className="px-4 py-2 text-gray-600">{p.seccion}</td>
                      <td className="px-4 py-2 text-gray-500">{p.area}</td>
                      <td className="px-4 py-2 text-center font-mono text-xs text-gray-500">
                        {p.clave ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <Toggle
                          checked={p.acceso}
                          disabled={toggle.isPending}
                          onChange={(acceso) =>
                            toggle.mutate({ idsegModulos: p.idsegModulos, acceso })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Plantillas */}
          <div className="space-y-4">
            <AplicarPlantilla
              uid={uid}
              plantillas={plantillas}
              onDone={() =>
                queryClient.invalidateQueries({ queryKey: permKey })
              }
              onError={onError}
            />
            <CrearPlantilla uidOrigen={uid} onError={onError} />
          </div>
        </div>
      )}
    </div>
  );
}

function AplicarPlantilla({
  uid,
  plantillas,
  onDone,
  onError,
}: {
  uid: string;
  plantillas: { idPlantilla: string; nombrePlantilla: string }[];
  onDone: () => void;
  onError: (e: unknown) => void;
}) {
  const [idPlantilla, setIdPlantilla] = useState('');
  const [reemplazar, setReemplazar] = useState(false);

  const aplicar = useMutation({
    mutationFn: () =>
      permisosApi.aplicarPlantilla(uid, idPlantilla, reemplazar),
    onSuccess: onDone,
    onError,
  });

  return (
    <section className="rounded-xl border bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-800">Aplicar plantilla</h2>
      <select
        value={idPlantilla}
        onChange={(e) => setIdPlantilla(e.target.value)}
        className="mt-2 block w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
      >
        <option value="">Selecciona una plantilla…</option>
        {plantillas.map((p) => (
          <option key={p.idPlantilla} value={p.idPlantilla}>
            {p.nombrePlantilla}
          </option>
        ))}
      </select>
      <label className="mt-2 flex items-center gap-2 text-xs text-gray-600">
        <input
          type="checkbox"
          checked={reemplazar}
          onChange={(e) => setReemplazar(e.target.checked)}
        />
        Reemplazar todos los permisos actuales
      </label>
      <button
        onClick={() => aplicar.mutate()}
        disabled={!idPlantilla || aplicar.isPending}
        className="mt-3 w-full rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#172039] disabled:opacity-50"
      >
        {aplicar.isPending ? 'Aplicando…' : 'Aplicar al usuario'}
      </button>
    </section>
  );
}

function CrearPlantilla({
  uidOrigen,
  onError,
}: {
  uidOrigen: string;
  onError: (e: unknown) => void;
}) {
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoria, setCategoria] = useState('General');

  const crear = useMutation({
    mutationFn: () =>
      permisosApi.crearPlantilla({
        nombre,
        descripcion,
        uidOrigen,
        categoria,
        esPublica: true,
      }),
    onSuccess: () => {
      setNombre('');
      setDescripcion('');
      void queryClient.invalidateQueries({ queryKey: ['permisos-plantillas'] });
    },
    onError,
  });

  return (
    <section className="rounded-xl border bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-800">
        Crear plantilla desde este usuario
      </h2>
      <p className="mt-0.5 text-xs text-gray-500">
        Guarda los permisos actuales del usuario como una plantilla reutilizable.
      </p>
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Nombre de la plantilla"
        className="mt-2 block w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
      />
      <input
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        placeholder="Descripción (opcional)"
        className="mt-2 block w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
      />
      <select
        value={categoria}
        onChange={(e) => setCategoria(e.target.value)}
        className="mt-2 block w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
      >
        {CATEGORIAS.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <button
        onClick={() => crear.mutate()}
        disabled={!nombre.trim() || crear.isPending}
        className="mt-3 w-full rounded-lg border border-[#1f2a4d] px-4 py-2 text-sm font-medium text-[#1f2a4d] hover:bg-gray-50 disabled:opacity-50"
      >
        {crear.isPending ? 'Guardando…' : 'Guardar plantilla'}
      </button>
    </section>
  );
}
