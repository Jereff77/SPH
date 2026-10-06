import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ventasApi, type EscrituraRow } from './ventas.api';
import { ApiRequestError } from '@/lib/api';
import { useSort } from '@/components/tabla/useSort';
import { SortableTh, THEAD_STICKY, THEAD_TR } from '@/components/tabla/SortableTh';
import { FiltroColumnaOpciones } from '@/components/tabla/FiltroColumnaOpciones';
import { InputFecha } from '@/components/InputFecha';
import { configuracionApi } from '@/features/configuraciones/configuracion.api';

/** Valores distintos de una columna (sin vacíos), ordenados es-MX. */
function opcionesCol(
  filas: EscrituraRow[],
  sel: (f: EscrituraRow) => string | null | undefined,
): string[] {
  return [...new Set(filas.map((f) => sel(f) ?? '').filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'es', { numeric: true }),
  );
}

/** Etiqueta del estatus de escrituración. */
const estatusLabel = (escriturada: boolean): string => (escriturada ? 'Escriturada' : 'Pendiente');

/** Interruptor de estatus Escriturada / Pendiente. */
function SwitchEstatus({
  escriturada,
  onToggle,
  disabled,
}: {
  escriturada: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      role="switch"
      aria-checked={escriturada}
      title={`Marcar como ${escriturada ? 'Pendiente' : 'Escriturada'}`}
      className="inline-flex items-center gap-2 disabled:opacity-50"
    >
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition ${
          escriturada ? 'bg-[#1a7f4b]' : 'bg-gray-300'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
            escriturada ? 'left-[18px]' : 'left-0.5'
          }`}
        />
      </span>
      <span className={`text-xs font-medium ${escriturada ? 'text-[#1a7f4b]' : 'text-gray-500'}`}>
        {estatusLabel(escriturada)}
      </span>
    </button>
  );
}

/** Tarjeta de resumen. */
function Tarjeta({
  titulo,
  valor,
  color,
  detalle,
  children,
}: {
  titulo: string;
  valor: number;
  color: string;
  detalle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-sm font-medium text-gray-500">{titulo}</div>
      <div className={`mt-1 text-3xl font-bold tracking-tight ${color}`}>{valor}</div>
      {detalle && <div className="mt-1 text-xs text-gray-500">{detalle}</div>}
      {children}
    </div>
  );
}

const pct = (parte: number, total: number): number =>
  total === 0 ? 0 : Math.round((parte / total) * 100);

/**
 * Ventas → Escrituras (clave 630). Seguimiento de la escrituración por propiedad:
 * una fila por nave vendida con plan de pagos. Permite ver de un vistazo cuántas
 * naves faltan por escriturar, marcar el **estatus** (switch Escriturada/Pendiente)
 * y capturar la **fecha de escrituración**. Para marcar Escriturada la fecha es
 * obligatoria. Excluye el parque de Tickets.
 */
export function EscriturasPage() {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState('');
  const [parqueSel, setParqueSel] = useState<Set<string>>(new Set());
  const [naveSel, setNaveSel] = useState<Set<string>>(new Set());
  const [invSel, setInvSel] = useState<Set<string>>(new Set());
  const [estatusSel, setEstatusSel] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);
  // Se incrementa para restablecer los campos de fecha cuando un cambio se rechaza.
  const [reinicio, setReinicio] = useState(0);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['ventas-escrituras'],
    queryFn: () => ventasApi.escrituras(),
  });
  const filas = useMemo(() => data?.filas ?? [], [data]);

  const { data: logos } = useQuery({
    queryKey: ['logos'],
    queryFn: () => configuracionApi.getLogos(),
    staleTime: 30 * 60 * 1000,
  });

  const onErr = (e: unknown) => {
    setError(e instanceof ApiRequestError ? e.message : 'No se pudo guardar el cambio.');
    setReinicio((n) => n + 1);
  };
  const onOk = () => {
    setError(null);
    void queryClient.invalidateQueries({ queryKey: ['ventas-escrituras'] });
  };

  const mFecha = useMutation({
    mutationFn: ({ id, fecha }: { id: string; fecha: string | null }) =>
      ventasApi.actualizarFechaEscrituracion(id, fecha),
    onSuccess: onOk,
    onError: onErr,
  });
  const mEstatus = useMutation({
    mutationFn: ({ id, escriturada }: { id: string; escriturada: boolean }) =>
      ventasApi.actualizarEstatusEscritura(id, escriturada),
    onSuccess: onOk,
    onError: onErr,
  });
  const guardando = mFecha.isPending || mEstatus.isPending;

  // Opciones distintas para los filtros de columna (multi-selección — regla 7c).
  const optParque = useMemo(() => opcionesCol(filas, (f) => f.parque), [filas]);
  const optNave = useMemo(() => opcionesCol(filas, (f) => f.numNave), [filas]);
  const optInv = useMemo(() => opcionesCol(filas, (f) => f.inversionista), [filas]);
  const optEstatus = ['Escriturada', 'Pendiente'];

  // Buscador global (parque / nave / inversionista) + filtros de columna.
  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return filas.filter((f) => {
      if (
        q &&
        !(
          (f.parque ?? '').toLowerCase().includes(q) ||
          (f.numNave ?? '').toLowerCase().includes(q) ||
          (f.inversionista ?? '').toLowerCase().includes(q)
        )
      )
        return false;
      if (parqueSel.size > 0 && !parqueSel.has(f.parque ?? '')) return false;
      if (naveSel.size > 0 && !naveSel.has(f.numNave ?? '')) return false;
      if (invSel.size > 0 && !invSel.has(f.inversionista ?? '')) return false;
      if (estatusSel.size > 0 && !estatusSel.has(estatusLabel(f.escriturada))) return false;
      return true;
    });
  }, [filas, busca, parqueSel, naveSel, invSel, estatusSel]);

  const { ordenados, sortKey, dir, toggle } = useSort<EscrituraRow>(
    filtradas,
    {
      parque: (f) => f.parque,
      numNave: (f) => f.numNave,
      inversionista: (f) => f.inversionista,
      estatus: (f) => (f.escriturada ? 1 : 0),
      fechaEscrituracion: (f) => f.fechaEscrituracion,
    },
    { key: 'parque', dir: 'asc' },
  );

  // Las tarjetas se adaptan a los filtros: cuentan lo que se ve.
  const escrituradas = useMemo(() => filtradas.filter((f) => f.escriturada).length, [filtradas]);
  const pendientes = filtradas.length - escrituradas;
  const avance = pct(escrituradas, filtradas.length);

  function alternarEstatus(f: EscrituraRow) {
    if (guardando) return;
    if (!f.escriturada && !f.fechaEscrituracion) {
      setError(
        `Captura primero la fecha de escrituración de la nave ${f.numNave ?? ''} para marcarla como Escriturada.`,
      );
      return;
    }
    setError(null);
    mEstatus.mutate({ id: f.idPdp, escriturada: !f.escriturada });
  }

  function cambiarFecha(f: EscrituraRow, iso: string) {
    if (guardando) return;
    const nueva = iso || null;
    if (nueva === (f.fechaEscrituracion ?? null)) return;
    if (!nueva && f.escriturada) {
      setError('Una nave Escriturada necesita fecha. Cámbiala a Pendiente para quitarla.');
      setReinicio((n) => n + 1);
      return;
    }
    setError(null);
    mFecha.mutate({ id: f.idPdp, fecha: nueva });
  }

  // Exporta a Excel lo que se ve (respeta búsqueda, filtros de columna y orden).
  async function exportar() {
    setExportando(true);
    try {
      const mod = await import('./escrituras-export');
      await mod.exportarEscriturasExcel({
        archivo: 'Escrituras',
        titulo: 'Escrituras — Fechas de escrituración',
        generado: new Date().toLocaleString('es-MX'),
        logoUrl: logos?.claro?.url ?? null,
        filas: ordenados,
      });
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'No se pudo exportar.');
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-800">Escrituras</h1>
          <p className="text-sm text-gray-500">
            Naves con plan de pagos · fecha prevista de escrituración
          </p>
        </div>
        <button
          type="button"
          onClick={() => { void exportar(); }}
          disabled={exportando || ordenados.length === 0}
          title="Exportar lo que se ve a Excel"
          className="rounded-lg bg-[#1a7f4b] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {exportando ? 'Generando…' : 'Exportar Excel'}
        </button>
      </div>

      {/* Resumen por estatus, adaptado a los filtros. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tarjeta titulo="Naves con plan" valor={filtradas.length} color="text-[#1f2a4d]" />
        <Tarjeta
          titulo="Escrituradas"
          valor={escrituradas}
          color="text-[#1a7f4b]"
          detalle={`${avance} % de avance`}
        />
        <Tarjeta
          titulo="Faltan por escriturar"
          valor={pendientes}
          color="text-amber-600"
          detalle={`${filtradas.length === 0 ? 0 : 100 - avance} % pendiente`}
        >
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
            <div className="h-full rounded-full bg-[#1a7f4b]" style={{ width: `${avance}%` }} />
          </div>
        </Tarjeta>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por parque, nave o inversionista…"
          className="w-full max-w-sm rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
        />
        <span className="text-sm text-gray-500">{filtradas.length} naves</span>
      </div>

      {(error || isError) && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error ?? 'No se pudieron cargar las escrituras.'}
        </div>
      )}

      <div className="max-h-[calc(100vh-22rem)] overflow-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full min-w-[820px] text-sm">
          <thead className={THEAD_STICKY}>
            <tr className={THEAD_TR}>
              <SortableTh
                campo="parque" sortKey={sortKey} dir={dir} onSort={toggle}
                filtro={<FiltroColumnaOpciones etiqueta="Parque" opciones={optParque} seleccion={parqueSel} onChange={setParqueSel} />}
              >
                Parque
              </SortableTh>
              <SortableTh
                campo="numNave" sortKey={sortKey} dir={dir} onSort={toggle}
                filtro={<FiltroColumnaOpciones etiqueta="Nave" opciones={optNave} seleccion={naveSel} onChange={setNaveSel} />}
              >
                Nave
              </SortableTh>
              <SortableTh
                campo="inversionista" sortKey={sortKey} dir={dir} onSort={toggle}
                filtro={<FiltroColumnaOpciones etiqueta="Inversionista" opciones={optInv} seleccion={invSel} onChange={setInvSel} />}
              >
                Inversionista
              </SortableTh>
              <SortableTh
                campo="estatus" sortKey={sortKey} dir={dir} onSort={toggle}
                filtro={<FiltroColumnaOpciones etiqueta="Estatus" opciones={optEstatus} seleccion={estatusSel} onChange={setEstatusSel} />}
              >
                Estatus
              </SortableTh>
              <SortableTh campo="fechaEscrituracion" sortKey={sortKey} dir={dir} onSort={toggle}>
                Fecha de escrituración
              </SortableTh>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">Cargando…</td>
              </tr>
            )}
            {!isLoading && ordenados.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  Sin naves para mostrar.
                </td>
              </tr>
            )}
            {ordenados.map((f) => (
              <tr key={f.idPdp} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-gray-700">{f.parque ?? '—'}</td>
                <td className="px-4 py-2 font-semibold text-gray-700">{f.numNave ?? '—'}</td>
                <td className="px-4 py-2 text-gray-700">{f.inversionista ?? '—'}</td>
                <td className="px-4 py-2">
                  <SwitchEstatus
                    escriturada={f.escriturada}
                    onToggle={() => alternarEstatus(f)}
                    disabled={guardando}
                  />
                </td>
                <td className="px-4 py-2">
                  <div className="w-40">
                    <InputFecha
                      key={`${f.idPdp}-${reinicio}`}
                      value={f.fechaEscrituracion ?? ''}
                      onChange={(iso) => cambiarFecha(f, iso)}
                      disabled={guardando}
                      className={`w-full rounded-md border px-2.5 py-1.5 text-sm tabular-nums outline-none focus:ring-2 focus:ring-[#3f5b87]/30 ${
                        f.fechaEscrituracion ? 'border-gray-200' : 'border-[#3f5b87]'
                      }`}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        El estatus y la fecha se guardan al instante. Para marcar una nave como Escriturada, captura
        primero su fecha.
      </p>
    </div>
  );
}
