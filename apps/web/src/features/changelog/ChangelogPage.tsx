import { useMemo, useState } from 'react';
import { COLORS } from '@/lib/constants';
import { useChangelog } from './useChangelog';
import type { TipoCambio, VersionChangelog } from './types';

/** dd/mm/aaaa a partir de una fecha ISO «yyyy-mm-dd» (sin desfase de zona). */
function fechaCorta(iso: string): string {
  const [a, m, d] = iso.split('-');
  if (!a || !m || !d) return iso;
  return `${d}/${m}/${a}`;
}

/** Estilo (fondo/texto) del chip por tipo de cambio. */
const ESTILO_TIPO: Record<TipoCambio, string> = {
  Agregado: 'bg-[#8cc63f]/15 text-[#5a8210] ring-1 ring-[#8cc63f]/40',
  Cambiado: 'bg-[#3f5b87]/15 text-[#2c4060] ring-1 ring-[#3f5b87]/40',
  Corregido: 'bg-amber-100 text-amber-700 ring-1 ring-amber-300',
  Eliminado: 'bg-red-100 text-red-700 ring-1 ring-red-300',
  Obsoleto: 'bg-slate-100 text-slate-600 ring-1 ring-slate-300',
  Seguridad: 'bg-purple-100 text-purple-700 ring-1 ring-purple-300',
};

const ORDEN_TIPO: TipoCambio[] = [
  'Agregado',
  'Cambiado',
  'Corregido',
  'Seguridad',
  'Obsoleto',
  'Eliminado',
];

function VersionCard({ v, actual }: { v: VersionChangelog; actual: boolean }) {
  // Agrupa los cambios por tipo, en un orden estable.
  const grupos = useMemo(() => {
    const map = new Map<TipoCambio, string[]>();
    for (const c of v.cambios) {
      const arr = map.get(c.tipo) ?? [];
      arr.push(c.descripcion);
      map.set(c.tipo, arr);
    }
    return ORDEN_TIPO.filter((t) => map.has(t)).map((t) => ({
      tipo: t,
      items: map.get(t)!,
    }));
  }, [v.cambios]);

  return (
    <article className="relative pl-8">
      {/* Punto + línea del timeline */}
      <span
        className="absolute left-0 top-1.5 h-3 w-3 rounded-full ring-4 ring-white"
        style={{ backgroundColor: actual ? COLORS.verde : COLORS.azul }}
      />
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span
          className="rounded-md px-2 py-0.5 text-sm font-bold text-white"
          style={{ backgroundColor: COLORS.navy }}
        >
          v. {v.version}
        </span>
        {actual && (
          <span className="rounded-full bg-[#8cc63f]/20 px-2 py-0.5 text-xs font-semibold text-[#5a8210]">
            Versión actual
          </span>
        )}
        <span className="text-sm text-slate-500">{fechaCorta(v.fecha)}</span>
        {v.titulo && (
          <span className="text-sm font-medium text-slate-700">— {v.titulo}</span>
        )}
      </div>

      <div className="mt-2 space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        {grupos.length === 0 && (
          <p className="text-sm text-slate-400">Sin cambios registrados.</p>
        )}
        {grupos.map((g) => (
          <div key={g.tipo}>
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${ESTILO_TIPO[g.tipo]}`}
            >
              {g.tipo}
            </span>
            <ul className="mt-1.5 ml-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {g.items.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </article>
  );
}

/**
 * Configuraciones → Novedades. Muestra el historial de versiones del sistema
 * (changelog) como una línea de tiempo. Disponible para TODOS los usuarios
 * (sin clave de permiso). Los datos vienen del backend (`GET /api/changelog`).
 */
export function ChangelogPage() {
  const { data, isLoading, isError, error } = useChangelog();
  const [filtro, setFiltro] = useState('');

  const versiones = useMemo(() => {
    const lista = data?.versiones ?? [];
    const q = filtro.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter(
      (v) =>
        v.version.toLowerCase().includes(q) ||
        v.titulo?.toLowerCase().includes(q) ||
        v.cambios.some(
          (c) =>
            c.descripcion.toLowerCase().includes(q) ||
            c.tipo.toLowerCase().includes(q),
        ),
    );
  }, [data, filtro]);

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <header className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold" style={{ color: COLORS.navy }}>
              Novedades
            </h1>
            <p className="text-sm text-slate-500">
              Historial de versiones y cambios del sistema.
            </p>
          </div>
          {data?.versionActual && (
            <span
              className="rounded-lg px-3 py-1.5 text-sm font-bold text-white"
              style={{ backgroundColor: COLORS.navy }}
            >
              Versión actual: v. {data.versionActual}
            </span>
          )}
        </div>

        <input
          type="search"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Buscar en las novedades…"
          className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#3f5b87] focus:ring-2 focus:ring-[#3f5b87]/30"
        />
      </header>

      {isLoading && (
        <p className="text-sm text-slate-500">Cargando novedades…</p>
      )}
      {isError && (
        <p className="text-sm text-red-600">
          No se pudieron cargar las novedades
          {error instanceof Error ? `: ${error.message}` : ''}.
        </p>
      )}

      {!isLoading && !isError && versiones.length === 0 && (
        <p className="text-sm text-slate-500">
          {filtro
            ? 'No hay versiones que coincidan con la búsqueda.'
            : 'Aún no hay versiones registradas.'}
        </p>
      )}

      <div className="relative space-y-8 border-l border-slate-200 pl-0">
        {versiones.map((v) => (
          <VersionCard
            key={v.version}
            v={v}
            actual={v.version === data?.versionActual}
          />
        ))}
      </div>
    </div>
  );
}
