import { useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { parquesApi, SITUACIONES, type NaveItem } from './parques.api';
import { ApiRequestError } from '@/lib/api';

interface Props {
  idNave: string;
  nomParque?: string | null;
  onClose: () => void;
  onGuardada: () => void;
}

const inputCls =
  'mt-1 block w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30 disabled:bg-gray-100';

/**
 * Editor de una nave. Carga el detalle COMPLETO por id (para no perder campos
 * que algunas vistas no exponen, como precio/fecEntrega). "Vendida" no es
 * asignable aquí (esa transición es del módulo Propietarios).
 */
export function EditarNaveModal({ idNave, nomParque, onClose, onGuardada }: Props) {
  const [tab, setTab] = useState<'datos' | 'historial'>('datos');
  const { data: nave, isLoading } = useQuery({
    queryKey: ['nave', idNave],
    queryFn: () => parquesApi.nave(idNave),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl"
      >
        <div className="flex gap-1 border-b px-5 pt-4">
          <TabBtn activo={tab === 'datos'} onClick={() => setTab('datos')}>
            Datos
          </TabBtn>
          <TabBtn activo={tab === 'historial'} onClick={() => setTab('historial')}>
            Historial
          </TabBtn>
        </div>
        <div className="overflow-y-auto p-5">
          {isLoading || !nave ? (
            <p className="py-8 text-center text-sm text-gray-400">Cargando nave…</p>
          ) : tab === 'datos' ? (
            <Formulario
              nave={nave}
              nomParque={nomParque}
              onClose={onClose}
              onGuardada={onGuardada}
            />
          ) : (
            <HistorialNave idNave={idNave} />
          )}
        </div>
      </div>
    </div>
  );
}

function TabBtn({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
        activo
          ? 'border-b-2 border-[#1f2a4d] text-[#1f2a4d]'
          : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

/** Pestaña de trazabilidad: línea de tiempo de la nave (reconstruida de la auditoría). */
function HistorialNave({ idNave }: { idNave: string }) {
  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ['nave-historial', idNave],
    queryFn: () => parquesApi.historialNave(idNave),
  });

  if (isLoading)
    return (
      <p className="py-8 text-center text-sm text-gray-400">Cargando historial…</p>
    );
  if (eventos.length === 0)
    return (
      <p className="py-8 text-center text-sm text-gray-400">
        Sin movimientos registrados para esta nave.
      </p>
    );

  return (
    <ol className="relative ml-1 space-y-4 border-l-2 border-gray-100 pl-5">
      {eventos.map((e, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-[#1f2a4d]" />
          <div className="flex flex-col gap-x-2 sm:flex-row sm:items-baseline sm:justify-between">
            <span className="text-sm font-medium text-gray-800">{e.evento}</span>
            <span className="shrink-0 text-xs text-gray-400">{fmtFecha(e.fecha)}</span>
          </div>
          {e.detalle && <p className="text-xs text-gray-600">{e.detalle}</p>}
          {e.motivo && (
            <p className="text-xs italic text-gray-500">Motivo: {e.motivo}</p>
          )}
          <p className="text-[11px] text-gray-400">por {e.actor}</p>
        </li>
      ))}
    </ol>
  );
}

function fmtFecha(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Formulario({
  nave,
  nomParque,
  onClose,
  onGuardada,
}: {
  nave: NaveItem;
  nomParque?: string | null;
  onClose: () => void;
  onGuardada: () => void;
}) {
  const esVendida = nave.situacion === 'Vendida';
  const [situacion, setSituacion] = useState(
    SITUACIONES.includes(nave.situacion as (typeof SITUACIONES)[number])
      ? (nave.situacion as string)
      : 'Disponible',
  );
  const [numNaveName, setNumNaveName] = useState(
    nave.numNaveNAME ?? String(nave.numNave ?? ''),
  );
  const [mza, setMza] = useState(String(nave.mza ?? 0));
  const [lote, setLote] = useState(String(nave.lote ?? 0));
  const [terreno, setTerreno] = useState(String(nave.terreno ?? 0));
  const [construccion, setConstruccion] = useState(String(nave.construccion ?? 0));
  const [precio, setPrecio] = useState(String(nave.precio ?? 0));
  const [fecEntrega, setFecEntrega] = useState(nave.fecEntrega ?? '');
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: () =>
      parquesApi.editarNave(nave.idNave, {
        situacion,
        numNaveName: numNaveName.trim(),
        mza: Number(mza) || 0,
        lote: Number(lote) || 0,
        terreno: Number(terreno) || 0,
        construccion: Number(construccion) || 0,
        precio: Number(precio) || 0,
        fecEntrega: fecEntrega.trim() === '' ? null : fecEntrega,
      }),
    onSuccess: onGuardada,
    onError: (e) =>
      setError(e instanceof ApiRequestError ? e.message : 'No se pudo guardar.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (esVendida) {
      setError('Una nave vendida solo se modifica desde Propietarios.');
      return;
    }
    if (numNaveName.trim() === '') {
      setError('La etiqueta de la nave es obligatoria.');
      return;
    }
    guardar.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-gray-800">
          Nave {nave.numNaveNAME ?? nave.numNave}
        </h2>
        {nomParque && <span className="text-xs text-gray-400">{nomParque}</span>}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {esVendida && (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Esta nave está <strong>Vendida</strong>; su situación solo se cambia
          desde el módulo Propietarios.
        </div>
      )}

      <label className="block text-xs text-gray-600">
        Etiqueta de la nave
        <input
          value={numNaveName}
          onChange={(e) => setNumNaveName(e.target.value)}
          placeholder="Ej. 1, GYM, Coworking…"
          disabled={esVendida}
          className={inputCls}
        />
      </label>

      <label className="block text-xs text-gray-600">
        Situación
        <select
          value={esVendida ? 'Vendida' : situacion}
          disabled={esVendida}
          onChange={(e) => setSituacion(e.target.value)}
          className={inputCls}
        >
          {esVendida && <option value="Vendida">Vendida</option>}
          {SITUACIONES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-xs text-gray-600">
          Manzana
          <input
            type="number"
            value={mza}
            onChange={(e) => setMza(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="block text-xs text-gray-600">
          Lote
          <input
            type="number"
            value={lote}
            onChange={(e) => setLote(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="block text-xs text-gray-600">
          Terreno (m²)
          <input
            type="number"
            step="0.01"
            value={terreno}
            onChange={(e) => setTerreno(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="block text-xs text-gray-600">
          Construcción (m²)
          <input
            type="number"
            step="0.01"
            value={construccion}
            onChange={(e) => setConstruccion(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="block text-xs text-gray-600">
          Precio
          <input
            type="number"
            step="0.01"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="block text-xs text-gray-600">
          Fecha de entrega
          <input
            type="date"
            value={fecEntrega}
            onChange={(e) => setFecEntrega(e.target.value)}
            className={inputCls}
          />
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={guardar.isPending || esVendida}
          className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#172039] disabled:opacity-50"
        >
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}
