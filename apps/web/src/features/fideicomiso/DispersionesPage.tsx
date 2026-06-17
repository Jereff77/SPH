import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fideicomisoApi, type DispersionResumen } from './fideicomiso.api';
import { useSort } from '@/components/tabla/useSort';
import { SortableTh, THEAD_STICKY, THEAD_TR } from '@/components/tabla/SortableTh';
import { FiltroColumnaOpciones } from '@/components/tabla/FiltroColumnaOpciones';
import { moneda, fechaCorta } from './format';
import { DesgloseModal } from './DesgloseModal';

const MESES_LARGO = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** "Junio 2026" a partir de una fecha ISO 'yyyy-MM-dd' (la fecha fin del periodo). */
function mesAnio(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m] = iso.slice(0, 10).split('-');
  const mi = Number(m) - 1;
  return `${MESES_LARGO[mi] ?? ''} ${y}`.trim();
}

/**
 * Fideicomiso → Dispersión (clave 530). Réplica del WebView de v1: por fideicomiso
 * + periodo, resumen por adherente con **filtros por columna estilo Excel**
 * (nombre, personalidad, adhesión) y el toggle "fin de promoción" junto al periodo.
 * Clic en el nombre → **Desglose Detallado** (con export PNG/CSV). NOTA: el RPC trae
 * los campos invertidos — `rfc_inversionista` es el NOMBRE y `nombre_inversionista` el RFC.
 */
export function DispersionesPage() {
  const [idFide, setIdFide] = useState('');
  const [noDisp, setNoDisp] = useState('');

  // Filtros de columna (estilo Excel, multi-selección: una o varias opciones)
  const [nombreSel, setNombreSel] = useState<Set<string>>(new Set());
  const [persSel, setPersSel] = useState<Set<string>>(new Set());
  const [adhesionSel, setAdhesionSel] = useState<Set<string>>(new Set());
  const [soloFinProm, setSoloFinProm] = useState(false);

  const [desglose, setDesglose] = useState<DispersionResumen | null>(null);

  const { data: opciones } = useQuery({
    queryKey: ['fide-disp-opciones'],
    queryFn: () => fideicomisoApi.dispersionesOpciones(),
    staleTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (!opciones) return;
    if (!idFide && opciones.fideicomisos[0]) setIdFide(opciones.fideicomisos[0].idFide);
    const ultimo = opciones.periodos.at(-1);
    if (!noDisp && ultimo) setNoDisp(ultimo.noDispersion);
  }, [opciones, idFide, noDisp]);

  const { data: resumen = [], isLoading } = useQuery({
    queryKey: ['fide-disp-resumen', idFide, noDisp],
    queryFn: () => fideicomisoApi.dispersionResumen(idFide, noDisp),
    enabled: !!idFide && !!noDisp,
  });

  // Al cambiar de fideicomiso/periodo se limpian los filtros (evita selecciones
  // "fantasma" de valores que ya no están en el nuevo conjunto de datos).
  useEffect(() => {
    setNombreSel(new Set());
    setPersSel(new Set());
    setAdhesionSel(new Set());
  }, [idFide, noDisp]);

  const periodo = useMemo(() => opciones?.periodos.find((p) => p.noDispersion === noDisp), [opciones, noDisp]);
  const fideTitulo = useMemo(
    () => opciones?.fideicomisos.find((f) => f.idFide === idFide)?.titulo ?? 'Fideicomiso',
    [opciones, idFide],
  );
  const periodoLabel = mesAnio(periodo?.fecFin);

  // Nombre real = rfc_inversionista (campos invertidos en el RPC).
  const nombreDe = (r: DispersionResumen) => r.rfc_inversionista || r.nombre_inversionista || 'Sin Nombre';

  // Valores distintos presentes (para los filtros de columna multi-selección).
  const nombres = useMemo(
    () => [...new Set(resumen.map(nombreDe))].sort((a, b) => a.localeCompare(b, 'es')),
    [resumen],
  );
  const personalidades = useMemo(
    () => [...new Set(resumen.map((r) => r.tipo_persona).filter((x): x is string => !!x))].sort(),
    [resumen],
  );
  const adhesiones = useMemo(
    () =>
      [...new Set(resumen.map((r) => r.no_adhesion ?? '').filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'es', { numeric: true }),
      ),
    [resumen],
  );

  const filtrado = useMemo(() => {
    return resumen.filter((r) => {
      if (nombreSel.size > 0 && !nombreSel.has(nombreDe(r))) return false;
      if (persSel.size > 0 && !persSel.has(r.tipo_persona ?? '')) return false;
      if (adhesionSel.size > 0 && !adhesionSel.has(r.no_adhesion ?? '')) return false;
      if (soloFinProm && !((r.dias_promocion ?? 0) > 0 && (r.dias_normal ?? 0) > 0)) return false;
      return true;
    });
  }, [resumen, nombreSel, persSel, adhesionSel, soloFinProm]);

  const { ordenados, sortKey, dir, toggle } = useSort<DispersionResumen>(
    filtrado,
    {
      nombre: (r) => nombreDe(r),
      personalidad: (r) => r.tipo_persona,
      no_adhesion: (r) => r.no_adhesion,
      monto_total_pagos: (r) => r.monto_total_pagos,
      rendimiento_bruto_total: (r) => r.rendimiento_bruto_total,
      retencion_isr_total: (r) => r.retencion_isr_total,
      dispersion_neta_total: (r) => r.dispersion_neta_total,
    },
    { key: 'no_adhesion', dir: 'asc' },
  );

  const tot = useMemo(
    () =>
      filtrado.reduce(
        (a, r) => {
          a.monto += r.monto_total_pagos ?? 0;
          a.renta += r.rendimiento_bruto_total ?? 0;
          a.isr += r.retencion_isr_total ?? 0;
          a.disp += r.dispersion_neta_total ?? 0;
          return a;
        },
        { monto: 0, renta: 0, isr: 0, disp: 0 },
      ),
    [filtrado],
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight text-gray-800">Dispersiones a Inversionistas</h1>

      {/* Selectores + toggle fin de promoción */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500">Fideicomiso</label>
          <select value={idFide} onChange={(e) => setIdFide(e.target.value)} className="mt-1 rounded-lg border px-3 py-1.5 text-sm">
            {(opciones?.fideicomisos ?? []).map((f) => (
              <option key={f.idFide} value={f.idFide}>{f.titulo ?? f.idFide}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500">Dispersión</label>
          <select value={noDisp} onChange={(e) => setNoDisp(e.target.value)} className="mt-1 rounded-lg border px-3 py-1.5 text-sm">
            {(opciones?.periodos ?? []).map((p) => (
              <option key={p.noDispersion} value={p.noDispersion}>
                {p.noDispersion} · {mesAnio(p.fecFin)} ({fechaCorta(p.fecInicio)} – {fechaCorta(p.fecFin)})
              </option>
            ))}
          </select>
        </div>
        <label className="mb-0.5 inline-flex items-center gap-2 rounded-lg border border-[#3f5b87]/40 px-3 py-2 text-sm text-gray-700">
          <input type="checkbox" checked={soloFinProm} onChange={(e) => setSoloFinProm(e.target.checked)} />
          Solo con fin de promoción en este periodo
        </label>
        <span className="mb-2 text-xs text-gray-400">Mostrando {filtrado.length} de {resumen.length} adherentes</span>
      </div>

      {/* Tabla con filtros por columna (estilo Excel) */}
      <div className="max-h-[calc(100vh-18rem)] overflow-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-sm">
          <thead className={THEAD_STICKY}>
            <tr className={THEAD_TR}>
              <SortableTh
                campo="nombre" sortKey={sortKey} dir={dir} onSort={toggle}
                filtro={
                  <FiltroColumnaOpciones
                    etiqueta="Nombre" opciones={nombres}
                    seleccion={nombreSel} onChange={setNombreSel}
                  />
                }
              >
                Nombre
              </SortableTh>
              <SortableTh
                campo="personalidad" sortKey={sortKey} dir={dir} onSort={toggle} align="center"
                filtro={
                  <FiltroColumnaOpciones
                    etiqueta="Personalidad" opciones={personalidades}
                    seleccion={persSel} onChange={setPersSel}
                  />
                }
              >
                Personalidad
              </SortableTh>
              <SortableTh
                campo="no_adhesion" sortKey={sortKey} dir={dir} onSort={toggle} align="center"
                filtro={
                  <FiltroColumnaOpciones
                    etiqueta="Adhesión" opciones={adhesiones}
                    seleccion={adhesionSel} onChange={setAdhesionSel}
                  />
                }
              >
                Adhesión
              </SortableTh>
              <SortableTh campo="monto_total_pagos" sortKey={sortKey} dir={dir} onSort={toggle} align="right">Monto Inversión</SortableTh>
              <SortableTh campo="rendimiento_bruto_total" sortKey={sortKey} dir={dir} onSort={toggle} align="right">Renta del Trimestre</SortableTh>
              <SortableTh campo="retencion_isr_total" sortKey={sortKey} dir={dir} onSort={toggle} align="right">Retención ISR</SortableTh>
              <SortableTh campo="dispersion_neta_total" sortKey={sortKey} dir={dir} onSort={toggle} align="right">Dispersión Trimestral</SortableTh>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">Cargando…</td></tr>
            )}
            {!isLoading && ordenados.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">Sin dispersiones para este periodo.</td></tr>
            )}
            {ordenados.map((r) => {
              const fisica = (r.tipo_persona ?? '').toLowerCase() === 'fisica';
              return (
                <tr key={r.no_adhesion} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <button onClick={() => setDesglose(r)} className="font-medium text-[#3f5b87] underline-offset-2 hover:underline">
                      {nombreDe(r)}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${fisica ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                      {r.tipo_persona ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-center text-gray-600">{r.no_adhesion}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{moneda(r.monto_total_pagos)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{moneda(r.rendimiento_bruto_total)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{moneda(r.retencion_isr_total)}</td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums text-[#3f5b1a]">{moneda(r.dispersion_neta_total)}</td>
                </tr>
              );
            })}
          </tbody>
          {ordenados.length > 0 && (
            <tfoot>
              <tr className="sticky bottom-0 bg-[#1f2a4d] font-semibold text-white">
                <td className="px-4 py-2" colSpan={3}>TOTALES ({ordenados.length})</td>
                <td className="px-4 py-2 text-right tabular-nums">{moneda(tot.monto)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{moneda(tot.renta)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{moneda(tot.isr)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{moneda(tot.disp)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {desglose && (
        <DesgloseModal
          idFide={idFide}
          noAdhesion={desglose.no_adhesion}
          noDispersion={noDisp}
          razonSocial={nombreDe(desglose)}
          fideicomisoTitulo={fideTitulo}
          periodoLabel={periodoLabel}
          onClose={() => setDesglose(null)}
        />
      )}
    </div>
  );
}
