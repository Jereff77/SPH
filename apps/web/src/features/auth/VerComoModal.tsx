import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usuariosApi } from '@/features/usuarios/usuarios.api';
import type { Usuario } from '@/features/usuarios/types';

interface Props {
  onClose: () => void;
  onElegir: (uid: string) => void | Promise<void>;
}

function nombre(u: Usuario): string {
  if (u.apellidos && u.nombre) return `${u.apellidos}, ${u.nombre}`;
  return u.nomCompleto ?? u.nombre ?? u.email ?? u.uid;
}

/**
 * Selector de usuario para "Ver como" (soporte). Solo elige a quién observar;
 * la app entra en modo solo-lectura con los permisos de ese usuario.
 */
export function VerComoModal({ onClose, onElegir }: Props) {
  const [q, setQ] = useState('');
  const { data = [], isLoading } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => usuariosApi.listar(),
  });

  const filtrados = useMemo(() => {
    const lista = [...data].sort((a, b) => nombre(a).localeCompare(nombre(b)));
    const s = q.trim().toLowerCase();
    if (!s) return lista;
    return lista.filter(
      (u) =>
        nombre(u).toLowerCase().includes(s) ||
        (u.email ?? '').toLowerCase().includes(s),
    );
  }, [data, q]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-xl bg-white p-5 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-gray-800">Ver como…</h2>
        <p className="text-xs text-gray-500">
          Observa la aplicación tal como la ve este usuario (solo lectura; no se
          pueden realizar cambios).
        </p>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar usuario…"
          autoFocus
          className="mt-3 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
        />
        <div className="mt-3 min-h-0 flex-1 divide-y overflow-y-auto rounded-lg border">
          {isLoading && (
            <p className="px-3 py-6 text-center text-sm text-gray-400">
              Cargando…
            </p>
          )}
          {filtrados.map((u) => (
            <button
              key={u.uid}
              onClick={() => void onElegir(u.uid)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50"
            >
              <span className="text-gray-700">{nombre(u)}</span>
              <span className="truncate text-xs text-gray-400">{u.email}</span>
            </button>
          ))}
          {!isLoading && filtrados.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-gray-400">
              Sin resultados.
            </p>
          )}
        </div>
        <div className="mt-3 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
