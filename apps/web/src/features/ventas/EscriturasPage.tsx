import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ventasApi, type EscrituraRow } from './ventas.api';
import { ApiRequestError } from '@/lib/api';
import { useSort } from '@/components/tabla/useSort';
import { SortableTh, THEAD_STICKY, THEAD_TR } from '@/components/tabla/SortableTh';
import { FiltroColumnaOpciones } from '@/components/tabla/FiltroColumnaOpciones';
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

const moneda = (n: number | null | undefined): string =>
  (n ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

/** Etiqueta del estatus de escrituración. */
const estatusLabel = (escriturada: boolean): string => (escriturada ? 'Escriturada' : 'Pendiente');

function BotonConfirmar({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title="Confirmar cambio"
      aria-label="Confirmar"
      className="rounded bg-[#90BF32]/20 px-1.5 py-0.5 text-sm font-bold text-[#3f5b1a] hover:bg-[#90BF32]/40 disabled:opacity-50"
    >
      ✓
    </button>
  );
}

function BotonCancelar({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Cancelar"
      aria-label="Cancelar"
      className="rounded bg-gray-100 px-1.5 py-0.5 text-sm font-bold text-gray-500 hover:bg-gray-200"
    >
      ✕
    </button>
  );
}

/** Interruptor de estatus Escriturada / Pendiente (gestión manual). */
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
      <span
        className={`text-xs font-medium ${escriturada ? 'text-[#1a7f4b]' : 'text-gray-500'}`}
      >
        {estatusLabel(escriturada)}
      </span>
    </button>
  );
}

/** Tarjeta de conteo (resumen). */
function TarjetaConteo({
  titulo,
  valor,
  color,
}: {
  titulo: string;
  valor: number;
  color: string;
}) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-sm font-medium text-gray-500">{titulo}</div>
      <div className={`mt-1 text-3xl font-bold tracking-tight ${color}`}>{valor}</div>
    </div>
  );
}

function fechaCorta(iso: string | null): string {
  if (!iso) return '—';
  const p = (iso.split('T')[0] ?? iso).split('-');
  if (p.length < 3) return iso;
  return `${p[2]}/${p[1]}/${p[0]}`;
}

/**
 * Ventas → Escrituras (clave 630). Gestión operativa de la escrituración:
 * lista las parcialidades con `tipoPago='Escrituracion'`, con filtros por
 * **parque**, **nave**, inversionista y **estatus**; permite marcar el estatus
 * (switch Escriturada/Pendiente), capturar la **fecha de escrituración** y
 * editar el **monto** (inline). Excluye el parque de Tickets.
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

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['ventas-escrituras'] });
  const onErr = (e: unknown) =>
    setError(e instanceof ApiRequestError ? e.message : 'No se pudo guardar el cambio.');
  const onOk = () => {
    setError(null);
    invalidar();
  };

  const mFecha = useMutation({
    mutationFn: ({ id, fecha }: { id: string; fecha: string | null }) =>
      ventasApi.actualizarFechaEscrituracion(id, fecha),
    onSuccess: onOk,
    onError: onErr,
  });
  const mMonto = useMutation({
    mutationFn: ({ id, monto }: { id: string; monto: number }) =>
      ventasApi.actualizarMontoEscritura(id, monto),
    onSuccess: onOk,
    onError: onErr,
  });
  const mEstatus = useMutation({
    mutationFn: ({ id, escriturada }: { id: string; escriturada: boolean }) =>
      ventasApi.actualizarEstatusEscritura(id, escriturada),
    onSuccess: onOk,
    onError: onErr,
  });
  const guardando = mFecha.isPending || mMonto.isPending || mEstatus.isPending;

  // Opciones distintas para los filtros de columna (multi-selección — regla 7c).
  const optParque = useMemo(() => opcionesCol(filas, (f) => f.parque), [filas]);
  const optNave = useMemo(() => opcionesCol(filas, (f) => f.numNave), [filas]);
  const optInv = useMemo(() => opcionesCol(filas, (f) => f.inversionista), [filas]);
  const optEstatus = ['Escriturada', 'Pendiente'];

  // Buscador global (nave / inversionista / no. de pago) + filtros de columna.
  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return filas.filter((f) => {
      if (
        q &&
        !(
          (f.nave ?? '').toLowerCase().includes(q) ||
          (f.inversionista ?? '').toLowerCase().includes(q) ||
          String(f.numPago ?? '').includes(q)
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
      numPago: (f) => f.numPago,
      inversionista: (f) => f.inversionista,
      estatus: (f) => (f.escriturada ? 1 : 0),
      fechaEscrituracion: (f) => f.fechaEscrituracion,
      monto: (f) => f.monto,
    },
    { key: 'parque', dir: 'asc' },
  );

  const totalMostrado = useMemo(
    () => filtradas.reduce((s, f) => s + (f.monto ?? 0), 0),
    [filtradas],
  );
  // Las tarjetas de resumen se adaptan a los filtros: cuentan lo que se ve.
  const escrituradas = useMemo(() => filtradas.filter((f) => f.escriturada).length, [filtradas]);
  const pendientes = filtradas.length - escrituradas;

  // Edición controlada: doble clic para habilitar una celda; ✓ (o Enter)
  // confirma el cambio, ✕ (o Esc) lo cancela. Evita cambios accidentales.
  const [edit, setEdit] = useState<{
    id: string;
    campo: 'fecha' | 'monto';
    valor: string;
  } | null>(null);

  function abrir(f: EscrituraRow, campo: 'fecha' | 'monto') {
    if (guardando) return;
    setError(null);
    setEdit({
      id: f.idPdpDet,
      campo,
      valor: campo === 'fecha' ? (f.fechaEscrituracion ?? '') : String(f.monto ?? ''),
    });
  }
  function cancelar() {
    setEdit(null);
  }
  function confirmar(f: EscrituraRow) {
    if (!edit) return;
    if (edit.campo === 'fecha') {
      const actual = f.fechaEscrituracion ?? '';
      if (edit.valor !== actual) {
        mFecha.mutate({ id: f.idPdpDet, fecha: edit.valor || null });
      }
    } else {
      const n = Number(edit.valor);
      if (!Number.isFinite(n) || n <= 0) {
        setError('El monto debe ser un número mayor a 0.');
        return;
      }
      if (n !== f.monto) mMonto.mutate({ id: f.idPdpDet, monto: n });
    }
    setEdit(null);
  }

  function alternarEstatus(f: EscrituraRow) {
    if (guardando) return;
    setError(null);
    mEstatus.mutate({ id: f.idPdpDet, escriturada: !f.escriturada });
  }

  // Exporta a Excel lo que se ve (respeta búsqueda, filtros de columna y orden).
  async function exportar() {
    setExportando(true);
    try {
      const mod = await import('./escrituras-export');
      await mod.exportarEscriturasExcel({
        archivo: 'Escrituras_Fechas_de_escrituracion',
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
        <h1 className="text-2xl font-bold tracking-tight text-gray-800">
          Fechas de escrituración
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {filtradas.length} registros · Total{' '}
            <strong className="text-gray-700">{moneda(totalMostrado)}</strong>
          </span>
          <button
            type="button"
            onClick={() => { void exportar(); }}
            disabled={exportando || ordenados.length === 0}
            className="rounded-lg bg-[#1a7f4b] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {exportando ? 'Generando…' : '📊 Excel'}
          </button>
        </div>
      </div>

      {/* Tarjetas de resumen (conteo por estatus, adaptado a los filtros). */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TarjetaConteo titulo="Total" valor={filtradas.length} color="text-[#1f2a4d]" />
        <TarjetaConteo titulo="Escrituradas" valor={escrituradas} color="text-[#1a7f4b]" />
        <TarjetaConteo titulo="Pendientes" valor={pendientes} color="text-amber-600" />
      </div>

      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nave, inversionista o número de pago…"
        className="w-full max-w-md rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
      />

      {(error || isError) && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error ?? 'No se pudieron cargar las escrituras.'}
        </div>
      )}

      <div className="max-h-[calc(100vh-22rem)] overflow-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full min-w-[980px] text-sm">
          <thead className={THEAD_STICKY}>
            <tr className={THEAD_TR}>
              <SortableTh>Tipo Pago</SortableTh>
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
              <SortableTh campo="numPago" sortKey={sortKey} dir={dir} onSort={toggle} align="center">
                No. de pago
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
              <SortableTh campo="fechaEscrituracion" sortKey={sortKey} dir={dir} onSort={toggle} align="center">
                Fecha de escrituración
              </SortableTh>
              <SortableTh campo="monto" sortKey={sortKey} dir={dir} onSort={toggle} align="right">
                Monto
              </SortableTh>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-gray-400">Cargando…</td>
              </tr>
            )}
            {!isLoading && ordenados.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-gray-400">
                  Sin registros de escrituración.
                </td>
              </tr>
            )}
            {ordenados.map((f) => (
              <tr key={f.idPdpDet} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-gray-600">{f.tipoPago ?? '—'}</td>
                <td className="px-4 py-2 text-gray-700">{f.parque ?? '—'}</td>
                <td className="px-4 py-2 font-medium text-gray-700">{f.numNave ?? '—'}</td>
                <td className="px-4 py-2 text-center text-gray-600">{f.numPago ?? '—'}</td>
                <td className="px-4 py-2 text-gray-700">{f.inversionista ?? '—'}</td>
                <td className="px-4 py-2">
                  <SwitchEstatus
                    escriturada={f.escriturada}
                    onToggle={() => alternarEstatus(f)}
                    disabled={guardando}
                  />
                </td>
                <td className="px-4 py-2 text-center">
                  {edit?.id === f.idPdpDet && edit.campo === 'fecha' ? (
                    <div className="flex items-center justify-center gap-1">
                      <input
                        type="date"
                        autoFocus
                        value={edit.valor}
                        onChange={(e) => setEdit({ ...edit, valor: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') confirmar(f);
                          if (e.key === 'Escape') cancelar();
                        }}
                        className="rounded border border-[#3f5b87] px-1 py-0.5 text-sm focus:outline-none"
                      />
                      <BotonConfirmar onClick={() => confirmar(f)} disabled={guardando} />
                      <BotonCancelar onClick={cancelar} />
                    </div>
                  ) : (
                    <span
                      onDoubleClick={() => abrir(f, 'fecha')}
                      title="Doble clic para editar la fecha de escrituración"
                      className="cursor-pointer rounded px-1 py-0.5 hover:bg-gray-100"
                    >
                      {fechaCorta(f.fechaEscrituracion)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  {edit?.id === f.idPdpDet && edit.campo === 'monto' ? (
                    <div className="flex items-center justify-end gap-1">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        autoFocus
                        value={edit.valor}
                        onChange={(e) => setEdit({ ...edit, valor: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') confirmar(f);
                          if (e.key === 'Escape') cancelar();
                        }}
                        className="w-28 rounded border border-[#3f5b87] px-1 py-0.5 text-right text-sm tabular-nums focus:outline-none"
                      />
                      <BotonConfirmar onClick={() => confirmar(f)} disabled={guardando} />
                      <BotonCancelar onClick={cancelar} />
                    </div>
                  ) : (
                    <span
                      onDoubleClick={() => abrir(f, 'monto')}
                      title="Doble clic para editar el monto"
                      className="cursor-pointer rounded px-1 py-0.5 tabular-nums hover:bg-gray-100"
                    >
                      {moneda(f.monto)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          {ordenados.length > 0 && (
            <tfoot>
              <tr className="sticky bottom-0 bg-gray-100 font-semibold text-gray-800">
                <td className="px-4 py-2" colSpan={7}>
                  Total ({filtradas.length})
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{moneda(totalMostrado)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="text-xs text-gray-400">
        Marca el <strong>estatus</strong> con el interruptor. Para editar la fecha de escrituración o el
        monto: <strong>doble clic</strong>, ajusta el valor y confirma con
        <span className="mx-1 rounded bg-[#90BF32]/20 px-1 font-bold text-[#3f5b1a]">✓</span>
        (o Enter). Cancela con ✕ o Esc.
      </p>
    </div>
  );
}
