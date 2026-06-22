import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fideicomisoApi, type KardexFila } from './fideicomiso.api';
import { SearchSelect, type OpcionSelect } from '@/components/SearchSelect';
import { MultiSearchSelect } from '@/components/MultiSearchSelect';
import { useSort } from '@/components/tabla/useSort';
import { SortableTh, THEAD_STICKY, THEAD_TR } from '@/components/tabla/SortableTh';
import { configuracionApi } from '@/features/configuraciones/configuracion.api';
import { moneda, numero, porcentaje, fechaCorta } from './format';

const VERDE = '#90BF32';
const NARANJA = '#E8943A';

/**
 * Gráfico de dona "Estado de Pagos" (réplica del `_DonutPainter` de v1): dos
 * arcos desde -π/2, grosor = radio×0.42. Verde=pagados, naranja=pendientes.
 */
function DonutEstado({ pagados, pendientes }: { pagados: number; pendientes: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const total = pagados + pendientes;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const size = 180;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;
    const radio = size / 2 - 6;
    const grosor = radio * 0.42;
    const inicio = -Math.PI / 2;

    if (total === 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, radio - grosor / 2, 0, 2 * Math.PI);
      ctx.lineWidth = grosor;
      ctx.strokeStyle = '#e5e7eb';
      ctx.stroke();
      return;
    }

    const barridoPag = 2 * Math.PI * (pagados / total);
    const barridoPen = 2 * Math.PI * (pendientes / total);
    const r = radio - grosor / 2;

    ctx.lineWidth = grosor;
    ctx.lineCap = 'butt';
    // Pagados (verde)
    ctx.beginPath();
    ctx.arc(cx, cy, r, inicio, inicio + barridoPag);
    ctx.strokeStyle = VERDE;
    ctx.stroke();
    // Pendientes (naranja)
    ctx.beginPath();
    ctx.arc(cx, cy, r, inicio + barridoPag, inicio + barridoPag + barridoPen);
    ctx.strokeStyle = NARANJA;
    ctx.stroke();
  }, [pagados, pendientes, total]);

  return (
    <div className="relative" style={{ width: 180, height: 180 }}>
      <canvas ref={ref} style={{ width: 180, height: 180 }} />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-gray-800">{total}</span>
        <span className="text-xs uppercase tracking-wide text-gray-400">Total</span>
      </div>
    </div>
  );
}

function Tarjeta({ titulo, valor, className = '' }: { titulo: string; valor: string; className?: string }) {
  return (
    <div className={`rounded-xl border bg-white px-4 py-3 shadow-sm ${className}`}>
      <p className="text-xs uppercase tracking-wide text-gray-400">{titulo}</p>
      <p className="mt-1 text-lg font-semibold text-gray-800">{valor}</p>
    </div>
  );
}

/** Fórmula mostrada en v1: ((monto × rend%) / 365) × días. */
function formula(f: KardexFila): string {
  return `((${numero(f.monto, 0)} × ${numero(f.rend, 0)}%) / 365) × ${f.dias ?? 0} días`;
}

/**
 * Fideicomiso → Kardex (clave 530). Réplica del reporte `fide_reportes` de v1.
 * Los cálculos (estado Pagado, totales solo de pagados, rendimiento promedio)
 * los hace el backend; aquí solo se presentan.
 */
export function KardexPage() {
  const [inv, setInv] = useState('');
  const [propsSel, setPropsSel] = useState<string[]>([]);
  const [modo, setModo] = useState<'pasados' | 'todos'>('pasados');

  const { data: invs = [] } = useQuery({
    queryKey: ['fide-kardex-invs'],
    queryFn: () => fideicomisoApi.kardexInversionistas(),
    staleTime: 5 * 60 * 1000,
  });

  const opciones: OpcionSelect[] = useMemo(
    () => invs.map((i) => ({ value: i.nombreInversionista, label: i.nombreInversionista })),
    [invs],
  );

  const { data: props = [] } = useQuery({
    queryKey: ['fide-kardex-props', inv],
    queryFn: () => fideicomisoApi.kardexPropiedades(inv),
    enabled: !!inv,
  });
  const opcionesProp: OpcionSelect[] = useMemo(
    () => props.map((p) => ({ value: p.idPropiedad, label: p.label })),
    [props],
  );

  const { data, isLoading, isError } = useQuery({
    queryKey: ['fide-kardex', inv, propsSel],
    queryFn: () => fideicomisoApi.kardex(inv, propsSel.length > 0 ? propsSel : undefined),
    enabled: !!inv,
  });

  const { data: logos } = useQuery({
    queryKey: ['logos'],
    queryFn: () => configuracionApi.getLogos(),
    staleTime: 30 * 60 * 1000,
  });

  const hoyMX = useMemo(
    () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()),
    [],
  );
  const filas = useMemo(() => data?.filas ?? [], [data]);
  const mostrados = useMemo(
    () => (modo === 'pasados' ? filas.filter((f) => !!f.fecfin && f.fecfin.slice(0, 10) <= hoyMX) : filas),
    [filas, modo, hoyMX],
  );
  const totalesMostrados = useMemo(
    () =>
      mostrados.reduce(
        (a, f) => {
          a.calculo += f.calculo ?? 0;
          a.comsph += f.comsph ?? 0;
          a.retencionIsr += f.retencionIsr ?? 0;
          a.dispersion += f.dispersion ?? 0;
          return a;
        },
        { calculo: 0, comsph: 0, retencionIsr: 0, dispersion: 0 },
      ),
    [mostrados],
  );
  const { ordenados, sortKey, dir, toggle } = useSort<KardexFila>(
    mostrados,
    {
      numMov: (f) => f.numMov,
      monto: (f) => f.monto,
      fecini: (f) => f.fecini,
      fecfin: (f) => f.fecfin,
      dias: (f) => f.dias,
      calculo: (f) => f.calculo,
      comsph: (f) => f.comsph,
      retencionIsr: (f) => f.retencionIsr,
      dispersion: (f) => f.dispersion,
      estado: (f) => (f.pagado ? 1 : 0),
    },
    { key: 'fecfin', dir: 'asc' },
  );

  const propLabel =
    propsSel.length === 0
      ? 'Todas'
      : propsSel.length === 1
        ? (opcionesProp.find((p) => p.value === propsSel[0])?.label ?? propsSel[0])
        : `${propsSel.length} propiedades`;
  const modoLabel = modo === 'pasados' ? 'Solo los que ya pasaron' : 'Todos los meses (con cálculos)';

  async function exportar(tipo: 'pdf' | 'excel') {
    const opts = {
      archivo: `Kardex - ${inv}`,
      titulo: 'Kardex de Dispersiones',
      subLineas: [`Inversionista: ${inv}`, `Propiedad: ${propLabel}`, `Mostrar: ${modoLabel}`],
      generado: new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeStyle: 'short' }).format(new Date()),
      logoUrl: logos?.claro?.url ?? null,
      filas: ordenados,
      totales: totalesMostrados,
      totalesEtiqueta: `TOTALES (${ordenados.length} · ${modo === 'pasados' ? 'ya pasados' : 'todos los meses'})`,
    };
    // Carga diferida (jsPDF/ExcelJS solo cuando se exporta; no infla el bundle).
    const m = await import('./kardex-export');
    if (tipo === 'pdf') await m.exportarKardexPDF(opts);
    else await m.exportarKardexExcel(opts);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-gray-800">
          Reportes — Kardex de Dispersiones
        </h1>
        {inv && data && ordenados.length > 0 && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { void exportar('excel'); }}
              className="rounded-lg bg-[#1a7f4b] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
            >
              📊 Excel
            </button>
            <button
              type="button"
              onClick={() => { void exportar('pdf'); }}
              className="rounded-lg bg-[#b3261e] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
            >
              📄 PDF
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500">Inversionista</label>
          <SearchSelect
            value={inv}
            onChange={(v) => { setInv(v); setPropsSel([]); }}
            options={opciones}
            placeholder="Selecciona un inversionista…"
            className="mt-1 w-[360px]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500">Propiedad</label>
          <MultiSearchSelect
            values={propsSel}
            onChange={setPropsSel}
            options={opcionesProp}
            placeholder={inv ? 'Todas las propiedades' : 'Elige un inversionista'}
            disabled={!inv}
            className="mt-1 w-[300px]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500">Mostrar</label>
          <select
            value={modo}
            onChange={(e) => setModo(e.target.value as 'pasados' | 'todos')}
            className="mt-1 rounded-lg border px-3 py-2 text-sm"
          >
            <option value="pasados">Solo los que ya pasaron</option>
            <option value="todos">Todos los meses (con cálculos)</option>
          </select>
        </div>
      </div>

      {isError && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          No se pudo cargar el Kardex.
        </div>
      )}

      {!inv && (
        <p className="rounded-lg border border-dashed bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">
          Selecciona un inversionista para ver su Kardex.
        </p>
      )}

      {inv && data && (
        <>
          {/* Resumen: dona + KPIs (izquierda) e info del inversionista (derecha) */}
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
              <div className="flex items-center gap-5">
                <DonutEstado pagados={data.kpis.pagados} pendientes={data.kpis.pendientes} />
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="inline-block h-3 w-3 rounded-sm" style={{ background: VERDE }} />
                    <span className="text-gray-600">Pagos realizados:</span>
                    <strong className="text-gray-800">{data.kpis.pagados}</strong>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="inline-block h-3 w-3 rounded-sm" style={{ background: NARANJA }} />
                    <span className="text-gray-600">Pagos pendientes:</span>
                    <strong className="text-gray-800">{data.kpis.pendientes}</strong>
                  </div>
                  <div className="text-sm text-gray-500">
                    Total de registros: <strong className="text-gray-700">{data.kpis.total}</strong>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Tarjeta titulo="Personalidad" valor={data.info.personalidad ?? '—'} className="w-56" />
                <Tarjeta titulo="Rendimiento Promedio" valor={porcentaje(data.info.rendimientoPromedio)} className="w-56" />
              </div>
            </div>
          </div>

          {/* Tabla */}
          <div className="max-h-[calc(100vh-26rem)] overflow-auto rounded-xl border bg-white shadow-sm">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className={THEAD_STICKY}>
                <tr className={THEAD_TR}>
                  <SortableTh campo="numMov" sortKey={sortKey} dir={dir} onSort={toggle} align="center">
                    Mov
                  </SortableTh>
                  <SortableTh campo="monto" sortKey={sortKey} dir={dir} onSort={toggle} align="right">
                    Monto
                  </SortableTh>
                  <SortableTh campo="fecini" sortKey={sortKey} dir={dir} onSort={toggle} align="center">
                    Fec. Ini
                  </SortableTh>
                  <SortableTh campo="fecfin" sortKey={sortKey} dir={dir} onSort={toggle} align="center">
                    Fecha
                  </SortableTh>
                  <SortableTh campo="dias" sortKey={sortKey} dir={dir} onSort={toggle} align="center">
                    Días
                  </SortableTh>
                  <SortableTh campo="calculo" sortKey={sortKey} dir={dir} onSort={toggle} align="right">
                    Cálculo
                  </SortableTh>
                  <SortableTh campo="comsph" sortKey={sortKey} dir={dir} onSort={toggle} align="right">
                    Com SPH
                  </SortableTh>
                  <SortableTh campo="retencionIsr" sortKey={sortKey} dir={dir} onSort={toggle} align="right">
                    Retención
                  </SortableTh>
                  <SortableTh campo="dispersion" sortKey={sortKey} dir={dir} onSort={toggle} align="right">
                    Dispersión
                  </SortableTh>
                  <SortableTh campo="estado" sortKey={sortKey} dir={dir} onSort={toggle} align="center">
                    Estado
                  </SortableTh>
                  <SortableTh>Fórmula</SortableTh>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading && (
                  <tr>
                    <td colSpan={11} className="px-4 py-6 text-center text-gray-400">
                      Cargando…
                    </td>
                  </tr>
                )}
                {!isLoading && ordenados.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-6 text-center text-gray-400">
                      Sin dispersiones para este inversionista.
                    </td>
                  </tr>
                )}
                {ordenados.map((f) => (
                  <tr key={f.idFidePdpD} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-center text-gray-600">{f.numMov ?? '—'}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{moneda(f.monto)}</td>
                    <td className="px-4 py-2 text-center text-gray-600">{fechaCorta(f.fecini)}</td>
                    <td className="px-4 py-2 text-center text-gray-600">{fechaCorta(f.fecfin)}</td>
                    <td className="px-4 py-2 text-center text-gray-600">{f.dias ?? '—'}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{moneda(f.calculo)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{moneda(f.comsph)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{moneda(f.retencionIsr)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{moneda(f.dispersion)}</td>
                    <td className="px-4 py-2 text-center">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          f.pagado
                            ? 'bg-[#90BF32]/15 text-[#3f5b1a]'
                            : 'bg-[#E8943A]/15 text-[#9a5a16]'
                        }`}
                      >
                        {f.pagado ? 'Pagado' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">{formula(f)}</td>
                  </tr>
                ))}
              </tbody>
              {ordenados.length > 0 && (
                <tfoot>
                  <tr className="sticky bottom-0 bg-[#1f2a4d] font-semibold text-white">
                    <td className="px-4 py-2" colSpan={5}>
                      TOTALES ({ordenados.length} · {modo === 'pasados' ? 'ya pasados' : 'todos los meses'})
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{moneda(totalesMostrados.calculo)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{moneda(totalesMostrados.comsph)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{moneda(totalesMostrados.retencionIsr)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{moneda(totalesMostrados.dispersion)}</td>
                    <td className="px-4 py-2" colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </div>
  );
}
