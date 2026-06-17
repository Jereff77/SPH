import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { parquesApi, type DisponibilidadItem } from './parques.api';
import { EditarNaveModal } from './EditarNaveModal';
import { situacionBadge } from './situacion';
import { useAuth } from '@/features/auth/useAuth';
import { FiltroColumnaOpciones } from '@/components/tabla/FiltroColumnaOpciones';

const fmt = (n: number) => n.toLocaleString('es-MX');

export function DisponibilidadPage() {
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  // La edición de naves es capacidad del módulo Parques (clave 700).
  const puedeEditar = tienePermiso(700);

  const [idParque, setIdParque] = useState('');
  const [filtro, setFiltro] = useState('');
  const [situacionSel, setSituacionSel] = useState<Set<string>>(new Set());
  const [naveEdit, setNaveEdit] = useState<DisponibilidadItem | null>(null);

  const { data: parques = [] } = useQuery({
    queryKey: ['parques'],
    queryFn: () => parquesApi.listar(),
  });

  useEffect(() => {
    const primero = parques[0];
    if (!idParque && primero) setIdParque(primero.idParque);
  }, [parques, idParque]);

  const { data: naves = [], isLoading } = useQuery({
    queryKey: ['disponibilidad', idParque],
    queryFn: () => parquesApi.disponibilidad(idParque),
    enabled: !!idParque,
  });

  const optSituacion = useMemo(
    () =>
      [...new Set(naves.map((n) => n.situacion ?? '').filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'es', { numeric: true }),
      ),
    [naves],
  );

  const filtradas = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    return naves.filter((n) => {
      if (situacionSel.size > 0 && !situacionSel.has(n.situacion ?? '')) return false;
      if (!q) return true;
      return (
        (n.numNaveNAME ?? '').toLowerCase().includes(q) ||
        (n.situacion ?? '').toLowerCase().includes(q) ||
        (n.nombre ?? '').toLowerCase().includes(q)
      );
    });
  }, [naves, filtro, situacionSel]);

  const refrescar = () =>
    queryClient.invalidateQueries({ queryKey: ['disponibilidad', idParque] });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={idParque}
          onChange={(e) => setIdParque(e.target.value)}
          className="w-72 max-w-full rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
        >
          <option value="">Selecciona un parque…</option>
          {parques.map((p) => (
            <option key={p.idParque} value={p.idParque}>
              {p.nomParque}
            </option>
          ))}
        </select>
        <input
          type="search"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Filtrar por nave, situación u ocupante…"
          className="w-72 max-w-full rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
        />
        <button
          onClick={refrescar}
          title="Refrescar"
          className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          ↻
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="px-3 py-2">Nave</th>
              <th className="px-3 py-2">
                <div className="relative inline-flex items-center gap-1">
                  Situación
                  <FiltroColumnaOpciones
                    etiqueta="Situación"
                    opciones={optSituacion}
                    seleccion={situacionSel}
                    onChange={setSituacionSel}
                  />
                </div>
              </th>
              <th className="px-3 py-2 text-center">Mza</th>
              <th className="px-3 py-2 text-center">Lote</th>
              <th className="px-3 py-2 text-right">Terreno</th>
              <th className="px-3 py-2 text-right">Construcción</th>
              <th className="px-3 py-2">Ocupante</th>
              {puedeEditar && <th className="px-3 py-2 text-center">Editar</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && (
              <tr>
                <td
                  colSpan={puedeEditar ? 8 : 7}
                  className="px-4 py-6 text-center text-gray-400"
                >
                  Cargando…
                </td>
              </tr>
            )}
            {!isLoading && filtradas.length === 0 && (
              <tr>
                <td
                  colSpan={puedeEditar ? 8 : 7}
                  className="px-4 py-6 text-center text-gray-400"
                >
                  {idParque ? 'Sin naves.' : 'Selecciona un parque.'}
                </td>
              </tr>
            )}
            {filtradas.map((n) => (
              <tr key={n.idNave} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium text-gray-700">
                  {n.numNaveNAME ?? n.numNave}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${situacionBadge(n.situacion)}`}
                  >
                    {n.situacion ?? '—'}
                  </span>
                </td>
                <td className="px-3 py-2 text-center text-gray-600">{n.mza}</td>
                <td className="px-3 py-2 text-center text-gray-600">{n.lote}</td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                  {fmt(n.terreno)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                  {fmt(n.construccion)}
                </td>
                <td className="px-3 py-2 text-gray-500">{n.nombre ?? '—'}</td>
                {puedeEditar && (
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => setNaveEdit(n)}
                      title="Editar nave"
                      className="text-[#3f5b87] hover:text-[#1f2a4d]"
                    >
                      ✎
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {naveEdit && (
        <EditarNaveModal
          idNave={naveEdit.idNave}
          nomParque={naveEdit.nomParque}
          onClose={() => setNaveEdit(null)}
          onGuardada={() => {
            setNaveEdit(null);
            void refrescar();
          }}
        />
      )}
    </div>
  );
}
