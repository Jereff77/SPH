import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  parquesApi,
  type ParqueListado,
  type NaveItem,
} from './parques.api';
import { ParqueModal } from './ParqueModal';
import { EditarNaveModal } from './EditarNaveModal';
import { AgregarNavesModal } from './AgregarNavesModal';
import { situacionCeja } from './situacion';
import { useSort, type Accessors } from '@/components/tabla/useSort';
import { useAuth } from '@/features/auth/useAuth';

const ACCESSORS_PARQUES: Accessors<ParqueListado> = {
  nombre: (p) => p.nomParque,
  naves: (p) => p.naves,
};

const ACCESSORS_NAVES: Accessors<NaveItem> = {
  nave: (n) => n.numNave ?? 0,
  situacion: (n) => n.situacion,
  inversionista: (n) => n.razonsocial,
  arrendatario: (n) => n.nomArrendador ?? null,
  terreno: (n) => n.terreno,
  construccion: (n) => n.construccion,
  precio: (n) => n.precio,
};

const ORDEN_NAVES: { campo: string; etiqueta: string }[] = [
  { campo: 'nave', etiqueta: 'Nave' },
  { campo: 'situacion', etiqueta: 'Situación' },
  { campo: 'inversionista', etiqueta: 'Inversionista' },
  { campo: 'arrendatario', etiqueta: 'Arrendatario' },
  { campo: 'terreno', etiqueta: 'Terreno' },
  { campo: 'construccion', etiqueta: 'Construcción' },
  { campo: 'precio', etiqueta: 'Precio' },
];

const fmt = (n: number) => n.toLocaleString('es-MX');
const moneda = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

/** Formatea una fecha ISO (yyyy-MM-dd) a d/M/yyyy; vacío -> "—". */
function fecha(iso: string | null): string {
  if (!iso) return '—';
  const soloFecha = iso.split('T')[0] ?? iso;
  const [y, m, d] = soloFecha.split('-');
  if (!y || !m || !d) return iso;
  return `${Number(d)}/${Number(m)}/${y}`;
}

export function ParquesPage() {
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const puedeAgregarParque = tienePermiso(701); // Agregar Parques
  const puedeAgregarNaves = tienePermiso(702); // Agregar Naves
  const [seleccionado, setSeleccionado] = useState<ParqueListado | null>(null);
  const [editandoParque, setEditandoParque] = useState<ParqueListado | null>(null);
  const [alta, setAlta] = useState(false);
  const [naveEdit, setNaveEdit] = useState<NaveItem | null>(null);
  const [agregarNaves, setAgregarNaves] = useState(false);
  const [filtro, setFiltro] = useState('');
  const [soloDisponibles, setSoloDisponibles] = useState(false);
  const [soloSinRentar, setSoloSinRentar] = useState(false);

  const { data: parques = [], isLoading } = useQuery({
    queryKey: ['parques'],
    queryFn: () => parquesApi.listar(),
  });

  // Selecciona el primer parque automáticamente.
  useEffect(() => {
    const primero = parques[0];
    if (!seleccionado && primero) setSeleccionado(primero);
  }, [parques, seleccionado]);

  const idSel = seleccionado?.idParque;

  const { data: kvas } = useQuery({
    queryKey: ['parque-kvas', idSel],
    queryFn: () => parquesApi.kvas(idSel!),
    enabled: !!idSel,
  });
  const { data: naves = [], isLoading: cargandoNaves } = useQuery({
    queryKey: ['parque-naves', idSel],
    queryFn: () => parquesApi.naves(idSel!),
    enabled: !!idSel,
  });

  // Filtros combinables: texto (nave/inversionista/arrendatario) + "solo
  // disponibles" (situación) + "sin rentar" (sin arrendatario asignado).
  const navesFiltradas = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    return naves.filter((n) => {
      if (soloDisponibles && n.situacion !== 'Disponible') return false;
      const sinRentar = !n.idArrendador || n.idArrendador === '';
      if (soloSinRentar && !sinRentar) return false;
      if (!q) return true;
      return (
        (n.numNaveNAME ?? String(n.numNave ?? '')).toLowerCase().includes(q) ||
        (n.razonsocial ?? '').toLowerCase().includes(q) ||
        (n.nomArrendador ?? '').toLowerCase().includes(q)
      );
    });
  }, [naves, filtro, soloDisponibles, soloSinRentar]);

  // Orden de la lista de parques y de las naves (regla de diseño 7).
  const {
    ordenados: parquesOrd,
    sortKey: pKey,
    dir: pDir,
    toggle: pToggle,
  } = useSort(parques, ACCESSORS_PARQUES, { key: 'nombre' });
  const {
    ordenados: navesOrd,
    sortKey: nKey,
    dir: nDir,
    setSort: nSetSort,
  } = useSort(navesFiltradas, ACCESSORS_NAVES, { key: 'nave' });

  const refrescarParques = () =>
    queryClient.invalidateQueries({ queryKey: ['parques'] });
  const refrescarNaves = () =>
    queryClient.invalidateQueries({ queryKey: ['parque-naves', idSel] });

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4 lg:flex-row">
      {/* Panel izquierdo: lista de parques */}
      <aside className="flex w-full flex-col rounded-xl border bg-white lg:w-80">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-base font-semibold text-gray-800">Parques</h2>
          {puedeAgregarParque && (
            <button
              onClick={() => setAlta(true)}
              title="Nuevo parque"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1f2a4d] text-lg leading-none text-white hover:bg-[#172039]"
            >
              +
            </button>
          )}
        </div>
        <div className="flex items-center justify-between bg-[#1f2a4d] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white">
          <button
            onClick={() => pToggle('nombre')}
            className="inline-flex items-center gap-1 hover:text-white/80"
          >
            Nombre
            <span className="text-[10px] opacity-70">
              {pKey === 'nombre' ? (pDir === 'asc' ? '▲' : '▼') : '↕'}
            </span>
          </button>
          <button
            onClick={() => pToggle('naves')}
            className="inline-flex items-center gap-1 hover:text-white/80"
          >
            Naves
            <span className="text-[10px] opacity-70">
              {pKey === 'naves' ? (pDir === 'asc' ? '▲' : '▼') : '↕'}
            </span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <p className="px-4 py-6 text-center text-sm text-gray-400">Cargando…</p>
          )}
          {parquesOrd.map((p) => {
            const activo = p.idParque === idSel;
            return (
              <button
                key={p.idParque}
                onClick={() => setSeleccionado(p)}
                onDoubleClick={() => setEditandoParque(p)}
                title="Doble clic para editar"
                className={`flex w-full items-center justify-between border-b px-4 py-2.5 text-left text-sm hover:bg-gray-50 ${
                  activo ? 'bg-[#90BF32]/15 font-medium' : ''
                }`}
              >
                <span className="truncate pr-2 text-gray-700">{p.nomParque}</span>
                <span className="tabular-nums text-gray-500">{fmt(p.naves)}</span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Panel derecho: KVA's del parque + tarjetas de naves */}
      <section className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <TarjetaKva
            titulo="KVA's Totales"
            alta={kvas?.kvasAlta ?? 0}
            media={kvas?.kvasMedia ?? 0}
          />
          <TarjetaKva
            titulo="KVA's Disponibles"
            alta={kvas?.kvasAltaDisponibles ?? 0}
            media={kvas?.kvasMediaDisponibles ?? 0}
          />
          <TarjetaKva
            titulo="KVA's Utilizados"
            alta={kvas?.kvasAltaUtilizados ?? 0}
            media={kvas?.kvasMediaUtilizados ?? 0}
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-lg bg-[#90BF32] px-4 py-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">
                Naves {seleccionado ? `· ${seleccionado.nomParque}` : ''}
              </h3>
              {seleccionado && puedeAgregarNaves && (
                <button
                  onClick={() => setAgregarNaves(true)}
                  title="Agregar naves a este parque"
                  className="rounded-full border border-white/60 bg-white/15 px-2.5 py-0.5 text-xs font-medium text-white hover:bg-white/25"
                >
                  + Agregar naves
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <FiltroChip
                activo={soloDisponibles}
                onClick={() => setSoloDisponibles((v) => !v)}
              >
                Disponibles
              </FiltroChip>
              <FiltroChip
                activo={soloSinRentar}
                onClick={() => setSoloSinRentar((v) => !v)}
              >
                Sin rentar
              </FiltroChip>
              <input
                type="search"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Filtrar por nave, inversionista o arrendatario…"
                className="w-72 max-w-full rounded-md border border-white/40 bg-white/90 px-3 py-1 text-sm outline-none placeholder:text-gray-500 focus:bg-white focus:ring-2 focus:ring-white/60"
              />
              <span className="text-xs text-white/80">Ordenar:</span>
              <select
                value={nKey ?? 'nave'}
                onChange={(e) => nSetSort(e.target.value, nDir)}
                className="rounded-md border border-white/40 bg-white/90 px-2 py-1 text-sm outline-none"
              >
                {ORDEN_NAVES.map((o) => (
                  <option key={o.campo} value={o.campo}>
                    {o.etiqueta}
                  </option>
                ))}
              </select>
              <button
                onClick={() =>
                  nSetSort(nKey ?? 'nave', nDir === 'asc' ? 'desc' : 'asc')
                }
                title="Cambiar dirección de orden"
                className="rounded-md border border-white/40 bg-white/15 px-2 py-1 text-sm text-white hover:bg-white/25"
              >
                {nDir === 'asc' ? '▲' : '▼'}
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
            {cargandoNaves && (
              <p className="py-6 text-center text-sm text-gray-400">Cargando…</p>
            )}
            {!cargandoNaves && naves.length === 0 && (
              <p className="py-6 text-center text-sm text-gray-400">Sin naves.</p>
            )}
            {!cargandoNaves && naves.length > 0 && navesFiltradas.length === 0 && (
              <p className="py-6 text-center text-sm text-gray-400">
                Sin coincidencias.
              </p>
            )}
            {navesOrd.map((n) => (
              <NaveCard
                key={n.idNave}
                nave={n}
                nomParque={seleccionado?.nomParque}
                onEditar={() => setNaveEdit(n)}
              />
            ))}
          </div>
        </div>
      </section>

      {alta && (
        <ParqueModal
          onClose={() => setAlta(false)}
          onListo={() => {
            setAlta(false);
            void refrescarParques();
          }}
        />
      )}
      {editandoParque && (
        <ParqueModal
          parque={editandoParque}
          onClose={() => setEditandoParque(null)}
          onListo={() => {
            setEditandoParque(null);
            void refrescarParques();
            void queryClient.invalidateQueries({ queryKey: ['parque-kvas', idSel] });
          }}
        />
      )}
      {naveEdit && (
        <EditarNaveModal
          idNave={naveEdit.idNave}
          nomParque={seleccionado?.nomParque}
          onClose={() => setNaveEdit(null)}
          onGuardada={() => {
            setNaveEdit(null);
            void refrescarNaves();
          }}
        />
      )}
      {agregarNaves && seleccionado && (
        <AgregarNavesModal
          idParque={seleccionado.idParque}
          nomParque={seleccionado.nomParque}
          onClose={() => setAgregarNaves(false)}
          onListo={() => {
            setAgregarNaves(false);
            void refrescarNaves();
            void refrescarParques();
          }}
        />
      )}
    </div>
  );
}

/** Tarjeta de una nave: dueño, arrendador, número y datos físicos. */
function NaveCard({
  nave,
  nomParque,
  onEditar,
}: {
  nave: NaveItem;
  nomParque?: string | null;
  onEditar: () => void;
}) {
  const etiqueta = nave.numNaveNAME ?? String(nave.numNave ?? '');
  // La etiqueta es personalizable (GYM, Coworking…): el tamaño se adapta para
  // que las largas no se desborden sobre los campos.
  const tamEtiqueta =
    etiqueta.length <= 3
      ? 'text-4xl'
      : etiqueta.length <= 6
        ? 'text-2xl'
        : 'text-base';

  return (
    <article className="flex overflow-hidden rounded-lg border bg-white shadow-sm">
      {/* Ceja de color según situación */}
      <div
        className={`flex w-9 shrink-0 items-center justify-center ${situacionCeja(nave.situacion)}`}
      >
        <span className="rotate-180 text-[11px] font-semibold uppercase tracking-wider text-white [writing-mode:vertical-rl]">
          {nave.situacion ?? '—'}
        </span>
      </div>

      <div className="min-w-0 flex-1 p-4">
        <p className="text-sm text-gray-600">
          Inversionista:{' '}
          <span className="font-semibold text-gray-800">
            {nave.razonsocial && nave.razonsocial !== '' ? nave.razonsocial : '—'}
          </span>
        </p>
        <p className="text-sm text-gray-600">
          Arrendatario:{' '}
          <span className="font-semibold text-gray-800">
            {nave.nomArrendador && nave.nomArrendador !== ''
              ? nave.nomArrendador
              : '—'}
          </span>
        </p>

        <div className="mt-2 flex flex-wrap gap-4">
          {/* Etiqueta de la nave + editar */}
          <div className="flex w-24 shrink-0 flex-col items-center justify-center text-center">
            <span
              className={`${tamEtiqueta} max-w-full break-words font-bold leading-tight text-[#1f2a4d]`}
              title={etiqueta}
            >
              {etiqueta}
            </span>
            <span className="mt-1 flex items-center gap-1 text-sm text-gray-500">
              Nave
              <button
                onClick={onEditar}
                title="Editar nave"
                className="text-[#3f5b87] hover:text-[#1f2a4d]"
              >
                ✎
              </button>
            </span>
            {nomParque && (
              <span className="mt-1 text-xs font-medium text-gray-400">
                {nomParque}
              </span>
            )}
          </div>

          {/* Datos físicos */}
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
            <Campo label="Mza" value={String(nave.mza ?? 0)} />
            <Campo label="Lote" value={String(nave.lote ?? 0)} />
            <Campo label="Terreno" value={fmt(nave.terreno ?? 0)} />
            <Campo label="Const." value={fmt(nave.construccion ?? 0)} />
            <Campo label="Precio" value={moneda(nave.precio ?? 0)} />
            <Campo label="Fecha estimada" value={fecha(nave.fecEntrega)} />
          </div>
        </div>
      </div>
    </article>
  );
}

/** Chip de filtro toggle (estilo pastilla sobre la barra verde). */
function FiltroChip({
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
      aria-pressed={activo}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        activo
          ? 'border-white bg-white text-[#3f5b87]'
          : 'border-white/50 bg-white/15 text-white hover:bg-white/25'
      }`}
    >
      {children}
    </button>
  );
}

function Campo({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-gray-100 py-0.5">
      <span className="text-xs text-gray-400">{label}:</span>
      <span className="truncate text-sm font-medium text-gray-700">{value}</span>
    </div>
  );
}

function TarjetaKva({
  titulo,
  alta,
  media,
}: {
  titulo: string;
  alta: number;
  media: number;
}) {
  return (
    <article className="rounded-xl border bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{titulo}</p>
      <div className="mt-3 flex justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">Alta</p>
          <p className="text-xl font-bold text-[#1f2a4d]">{fmt(alta)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-gray-400">Media</p>
          <p className="text-xl font-bold text-[#1f2a4d]">{fmt(media)}</p>
        </div>
      </div>
    </article>
  );
}
