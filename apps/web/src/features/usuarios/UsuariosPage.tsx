import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usuariosApi } from './usuarios.api';
import type { Usuario } from './types';
import { HistorialPanel } from './HistorialPanel';
import { InvitarUsuarioModal } from './InvitarUsuarioModal';
import { InvitacionesPanel } from './InvitacionesPanel';
import { Toggle } from '@/components/Toggle';
import { IconHistorial } from '@/components/icons';
import {
  SortableTh,
  THEAD_STICKY,
  THEAD_TR,
} from '@/components/tabla/SortableTh';
import { useSort, type Accessors } from '@/components/tabla/useSort';
import { useAuth } from '@/features/auth/useAuth';
import { ApiRequestError } from '@/lib/api';

const QKEY = ['usuarios'];

function nombreTabla(u: Usuario): string {
  if (u.apellidos && u.nombre) return `${u.apellidos}, ${u.nombre}`;
  return u.nomCompleto ?? u.nombre ?? '—';
}

const ACCESSORS: Accessors<Usuario> = {
  nombre: (u) => nombreTabla(u),
  email: (u) => u.email,
  telefono: (u) => u.telefono,
  status: (u) => u.status,
  esRC: (u) => u.esRC,
  isSupport: (u) => u.isSupport,
};

export function UsuariosPage() {
  const queryClient = useQueryClient();
  const { usuario } = useAuth();
  const puedeGestionarSoporte = usuario?.isSupport === true;
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [historialDe, setHistorialDe] = useState<Usuario | null>(null);
  const [mostrarInvitar, setMostrarInvitar] = useState(false);
  const [mostrarInvitaciones, setMostrarInvitaciones] = useState(false);
  // Columnas de la tabla (para el colSpan de filas de estado).
  const cols = puedeGestionarSoporte ? 9 : 8;

  const { data, isLoading, isError } = useQuery({
    queryKey: QKEY,
    queryFn: () => usuariosApi.listar(),
  });

  /** Mutación con actualización optimista de un campo booleano del usuario. */
  function useToggleCampo(
    campo: 'status' | 'esRC' | 'isSupport',
    fn: (uid: string, valor: boolean) => Promise<unknown>,
  ) {
    return useMutation({
      mutationFn: ({ uid, valor }: { uid: string; valor: boolean }) =>
        fn(uid, valor),
      onMutate: async ({ uid, valor }) => {
        setError(null);
        await queryClient.cancelQueries({ queryKey: QKEY });
        const prev = queryClient.getQueryData<Usuario[]>(QKEY);
        queryClient.setQueryData<Usuario[]>(QKEY, (old) =>
          old?.map((u) => (u.uid === uid ? { ...u, [campo]: valor } : u)),
        );
        return { prev };
      },
      onError: (e, _v, ctx) => {
        if (ctx?.prev) queryClient.setQueryData(QKEY, ctx.prev);
        setError(
          e instanceof ApiRequestError ? e.message : 'No se pudo actualizar.',
        );
      },
      onSettled: () => queryClient.invalidateQueries({ queryKey: QKEY }),
    });
  }

  const mStatus = useToggleCampo('status', usuariosApi.setStatus);
  const mRC = useToggleCampo('esRC', usuariosApi.setRC);
  const mSoporte = useToggleCampo('isSupport', usuariosApi.setSoporte);
  const ocupado = mStatus.isPending || mRC.isPending || mSoporte.isPending;

  const usuarios = useMemo(() => {
    const lista = data ?? [];
    const q = busqueda.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter(
      (u) =>
        nombreTabla(u).toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q),
    );
  }, [data, busqueda]);

  // Orden por columnas (regla de diseño 7).
  const { ordenados, sortKey, dir, toggle } = useSort(usuarios, ACCESSORS, {
    key: 'nombre',
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-gray-800">
          Usuarios
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o correo…"
            className="w-64 max-w-full rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
          />
          <button
            onClick={() => setMostrarInvitaciones((v) => !v)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
              mostrarInvitaciones
                ? 'border-[#1f2a4d] bg-[#1f2a4d] text-white'
                : 'border-gray-300 text-[#3f5b87] hover:bg-gray-50'
            }`}
          >
            Invitaciones
          </button>
          <button
            onClick={() => setMostrarInvitar(true)}
            className="rounded-lg bg-[#1f2a4d] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[#172039]"
          >
            + Invitar usuario
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1 overflow-auto rounded-xl border bg-white shadow-sm max-h-[calc(100vh-12rem)]">
        <table className="w-full min-w-[640px] text-sm">
          <thead className={THEAD_STICKY}>
            <tr className={THEAD_TR}>
              <th className="px-4 py-3">#</th>
              <SortableTh campo="nombre" sortKey={sortKey} dir={dir} onSort={toggle}>
                Nombre
              </SortableTh>
              <SortableTh campo="email" sortKey={sortKey} dir={dir} onSort={toggle}>
                Correo
              </SortableTh>
              <SortableTh
                campo="telefono"
                sortKey={sortKey}
                dir={dir}
                onSort={toggle}
              >
                Teléfono
              </SortableTh>
              <SortableTh
                campo="status"
                sortKey={sortKey}
                dir={dir}
                onSort={toggle}
                align="center"
              >
                Status
              </SortableTh>
              <SortableTh
                campo="esRC"
                sortKey={sortKey}
                dir={dir}
                onSort={toggle}
                align="center"
              >
                esRC
              </SortableTh>
              {puedeGestionarSoporte && (
                <SortableTh
                  campo="isSupport"
                  sortKey={sortKey}
                  dir={dir}
                  onSort={toggle}
                  align="center"
                >
                  esSoporte
                </SortableTh>
              )}
              <SortableTh align="center">Historial</SortableTh>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && (
              <tr>
                <td colSpan={cols} className="px-4 py-6 text-center text-gray-400">
                  Cargando usuarios…
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={cols} className="px-4 py-6 text-center text-red-600">
                  No se pudieron cargar los usuarios.
                </td>
              </tr>
            )}
            {!isLoading &&
              !isError &&
              ordenados.map((u, i) => (
                <tr key={u.uid} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-800">
                    {nombreTabla(u)}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{u.email ?? '—'}</td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {u.telefono ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <Toggle
                      checked={u.status}
                      variant="status"
                      disabled={ocupado}
                      title={u.status ? 'Activo' : 'Inactivo'}
                      onChange={(valor) =>
                        mStatus.mutate({ uid: u.uid, valor })
                      }
                    />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <Toggle
                      checked={u.esRC}
                      disabled={ocupado}
                      title="Responsable comercial"
                      onChange={(valor) => mRC.mutate({ uid: u.uid, valor })}
                    />
                  </td>
                  {puedeGestionarSoporte && (
                    <td className="px-4 py-2.5 text-center">
                      <Toggle
                        checked={u.isSupport}
                        disabled={ocupado}
                        title="Usuario de soporte"
                        onChange={(valor) =>
                          mSoporte.mutate({ uid: u.uid, valor })
                        }
                      />
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-center">
                    <button
                      onClick={() =>
                        setHistorialDe((actual) =>
                          actual?.uid === u.uid ? null : u,
                        )
                      }
                      title="Ver historial de actividad"
                      className={`inline-flex items-center justify-center rounded-md p-1.5 transition ${
                        historialDe?.uid === u.uid
                          ? 'bg-[#1f2a4d] text-white'
                          : 'text-[#3f5b87] hover:bg-gray-100'
                      }`}
                    >
                      <IconHistorial className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            {!isLoading && !isError && usuarios.length === 0 && (
              <tr>
                <td colSpan={cols} className="px-4 py-6 text-center text-gray-400">
                  Sin resultados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>

        {mostrarInvitaciones && (
          <InvitacionesPanel onClose={() => setMostrarInvitaciones(false)} />
        )}

        {historialDe && (
          <HistorialPanel
            uid={historialDe.uid}
            nombre={nombreTabla(historialDe)}
            onClose={() => setHistorialDe(null)}
          />
        )}
      </div>

      {mostrarInvitar && (
        <InvitarUsuarioModal
          onClose={() => setMostrarInvitar(false)}
          onInvitado={() => {
            setMostrarInvitaciones(true);
            queryClient.invalidateQueries({ queryKey: ['invitaciones'] });
          }}
        />
      )}
    </div>
  );
}
