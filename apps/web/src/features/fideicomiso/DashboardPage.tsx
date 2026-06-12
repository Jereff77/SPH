import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fideicomisoApi, type AdhesionFila } from './fideicomiso.api';
import { useSort } from '@/components/tabla/useSort';
import { SortableTh, THEAD_STICKY, THEAD_TR } from '@/components/tabla/SortableTh';
import { moneda, porcentaje, fechaCorta } from './format';

/**
 * Fideicomiso → Dashboard (clave 500) y Adhesiones (clave 520). Réplica fiel de
 * la pantalla `AdhesionesWidget` de v1 (a la que ambos ítems del menú apuntan):
 * la tabla de la vista `v_fideicomiso` con Inversionista, No. Adhesión, PM,
 * Medio, Bloque, $ Apartado, Fecha 1er Pago, Cantidad Partidas, Valor Ticket y
 * Rendimiento. Solo lectura; el front nunca toca Supabase.
 */
export function DashboardPage() {
  const [busca, setBusca] = useState('');

  const { data: filas = [], isLoading, isError } = useQuery({
    queryKey: ['fide-adhesiones'],
    queryFn: () => fideicomisoApi.adhesiones(),
  });

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return filas;
    return filas.filter(
      (f) =>
        (f.razonsocial ?? '').toLowerCase().includes(q) ||
        (f.noAdhesion ?? '').toLowerCase().includes(q) ||
        (f.Medio ?? '').toLowerCase().includes(q) ||
        (f.bloque ?? '').toLowerCase().includes(q),
    );
  }, [filas, busca]);

  const { ordenados, sortKey, dir, toggle } = useSort<AdhesionFila>(
    filtradas,
    {
      razonsocial: (f) => f.razonsocial,
      noAdhesion: (f) => f.noAdhesion,
      PM: (f) => f.PM,
      Medio: (f) => f.Medio,
      bloque: (f) => f.bloque,
      Apartado: (f) => f.Apartado,
      fecha: (f) => f.fecha,
      cantpagos: (f) => f.cantpagos,
      monto: (f) => f.monto,
      rendimiento: (f) => f.rendimiento,
    },
    { key: 'razonsocial', dir: 'asc' },
  );

  const totales = useMemo(
    () =>
      filtradas.reduce(
        (a, f) => {
          a.apartado += f.Apartado ?? 0;
          a.partidas += f.cantpagos ?? 0;
          a.monto += f.monto ?? 0;
          return a;
        },
        { apartado: 0, partidas: 0, monto: 0 },
      ),
    [filtradas],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-gray-800">Fideicomiso</h1>
        <span className="text-sm text-gray-500">{filtradas.length} adhesiones</span>
      </div>

      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por inversionista, adhesión, medio o bloque…"
        className="w-full max-w-md rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
      />

      {isError && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          No se pudo cargar el listado del fideicomiso.
        </div>
      )}

      <div className="max-h-[calc(100vh-16rem)] overflow-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className={THEAD_STICKY}>
            <tr className={THEAD_TR}>
              <SortableTh campo="razonsocial" sortKey={sortKey} dir={dir} onSort={toggle}>
                Inversionista
              </SortableTh>
              <SortableTh campo="noAdhesion" sortKey={sortKey} dir={dir} onSort={toggle} align="center">
                No. Adhesion
              </SortableTh>
              <SortableTh campo="PM" sortKey={sortKey} dir={dir} onSort={toggle} align="center">
                PM
              </SortableTh>
              <SortableTh campo="Medio" sortKey={sortKey} dir={dir} onSort={toggle}>
                Medio
              </SortableTh>
              <SortableTh campo="bloque" sortKey={sortKey} dir={dir} onSort={toggle} align="center">
                Bloque
              </SortableTh>
              <SortableTh campo="Apartado" sortKey={sortKey} dir={dir} onSort={toggle} align="right">
                $ Apartado
              </SortableTh>
              <SortableTh campo="fecha" sortKey={sortKey} dir={dir} onSort={toggle} align="center">
                Fecha 1er Pago
              </SortableTh>
              <SortableTh campo="cantpagos" sortKey={sortKey} dir={dir} onSort={toggle} align="center">
                Cantidad Partidas
              </SortableTh>
              <SortableTh campo="monto" sortKey={sortKey} dir={dir} onSort={toggle} align="right">
                Valor Ticket
              </SortableTh>
              <SortableTh campo="rendimiento" sortKey={sortKey} dir={dir} onSort={toggle} align="right">
                Rendimiento
              </SortableTh>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-gray-400">Cargando…</td>
              </tr>
            )}
            {!isLoading && ordenados.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-gray-400">Sin adhesiones.</td>
              </tr>
            )}
            {ordenados.map((f) => (
              <tr key={`${f.idfide}-${f.idPropiedad}`} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-medium text-gray-700">{f.razonsocial ?? '—'}</td>
                <td className="px-4 py-2 text-center text-gray-600">{f.noAdhesion ?? '—'}</td>
                <td className="px-4 py-2 text-center text-gray-600">{f.PM ?? '—'}</td>
                <td className="px-4 py-2 text-gray-600">{f.Medio ?? '—'}</td>
                <td className="px-4 py-2 text-center text-gray-600">{f.bloque ?? '—'}</td>
                <td className="px-4 py-2 text-right tabular-nums">{moneda(f.Apartado)}</td>
                <td className="px-4 py-2 text-center text-gray-600">{fechaCorta(f.fecha)}</td>
                <td className="px-4 py-2 text-center text-gray-600">{f.cantpagos ?? '—'}</td>
                <td className="px-4 py-2 text-right tabular-nums">{moneda(f.monto)}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {f.rendimiento != null ? porcentaje(f.rendimiento, f.rendimiento % 1 === 0 ? 0 : 1) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          {ordenados.length > 0 && (
            <tfoot>
              <tr className="sticky bottom-0 bg-[#1f2a4d] font-semibold text-white">
                <td className="px-4 py-2" colSpan={5}>TOTALES ({ordenados.length})</td>
                <td className="px-4 py-2 text-right tabular-nums">{moneda(totales.apartado)}</td>
                <td className="px-4 py-2" />
                <td className="px-4 py-2 text-center tabular-nums">{totales.partidas}</td>
                <td className="px-4 py-2 text-right tabular-nums">{moneda(totales.monto)}</td>
                <td className="px-4 py-2" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
