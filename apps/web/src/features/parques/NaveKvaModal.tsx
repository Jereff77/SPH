import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/Badge';
import { useAuth } from '@/features/auth/useAuth';
import { ApiRequestError } from '@/lib/api';
import { parquesApi } from './parques.api';
import {
  diasParaVencer,
  esAreaComun,
  ETIQUETA_ETAPA,
  kvasApi,
  type AsignacionKva,
} from './kvas.api';
import { AsignacionKvaModal } from './AsignacionKvaModal';
import { DevolucionKvaModal } from './DevolucionKvaModal';
import { DocumentosNave } from './DocumentosNave';

const fmt = (n: number) => n.toLocaleString('es-MX', { maximumFractionDigits: 2 });

interface Props {
  idParque: string;
  idNave: string;
  nave: string;
  ocupante: string | null;
  /** `true` si el ocupante es arrendatario: entonces solo se le renta. */
  arrendada?: boolean;
  onClose: () => void;
  /** Para refrescar el tablero cuando cambia algo. */
  onCambio: () => void;
}

/**
 * Todo lo de una nave en un solo lugar: sus **KVA** y su **expediente de
 * documentos**. Se abre al hacer clic en el número de nave del tablero, que es
 * como se trabaja en el control operativo (nave por nave, no por parque).
 */
export function NaveKvaModal({
  idParque,
  idNave,
  nave,
  ocupante,
  arrendada = false,
  onClose,
  onCambio,
}: Props) {
  const [pestana, setPestana] = useState<'kva' | 'docs'>('kva');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl"
      >
        <header className="border-b px-5 pt-4">
          <h2 className="text-base font-semibold text-gray-800">Nave {nave}</h2>
          <p className="text-xs text-gray-500">{ocupante ?? 'Sin ocupante registrado'}</p>
          <nav className="mt-3 flex gap-1">
            <Pestana activa={pestana === 'kva'} onClick={() => setPestana('kva')}>
              KVA
            </Pestana>
            <Pestana activa={pestana === 'docs'} onClick={() => setPestana('docs')}>
              Documentos
            </Pestana>
          </nav>
        </header>

        {pestana === 'kva' ? (
          <KvasDeLaNave
            idParque={idParque}
            idNave={idNave}
            nave={nave}
            arrendada={arrendada}
            onCambio={onCambio}
            onClose={onClose}
          />
        ) : (
          <DocumentosNave idNave={idNave} onCambio={onCambio} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

/**
 * Días que le quedan a un compromiso antes de que el cron lo borre.
 * A 3 días o menos se destaca — y no se codifica solo con color: lleva icono
 * y texto, para que se lea igual sin distinguir tonos.
 */
function Vencimiento({ vence }: { vence: string | null }) {
  const dias = diasParaVencer(vence);
  if (dias === null) return null;
  const urge = dias <= 3;
  const texto =
    dias < 0
      ? `venció hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? '' : 's'}`
      : dias === 0
        ? 'vence hoy'
        : `vence en ${dias} día${dias === 1 ? '' : 's'}`;
  return (
    <span className={`ml-2 ${urge ? 'font-medium text-amber-600' : 'text-gray-500'}`}>
      · {urge ? '⏳ ' : ''}
      {texto}
    </span>
  );
}

/**
 * Dotación de la nave: los KVA que le tocan por disposición del parque.
 * Encabeza la pestaña porque es el marco dentro del cual se asigna.
 * Editarla exige permiso **721**, y va contra su propio endpoint.
 */
function DotacionDeLaNave({
  idNave,
  onCambio,
  onError,
}: {
  idNave: string;
  onCambio: () => void;
  onError: (m: string) => void;
}) {
  const { tienePermiso } = useAuth();
  const puedeEditar = tienePermiso(721);
  const qc = useQueryClient();
  const [editando, setEditando] = useState(false);
  const [mt, setMt] = useState('0');
  const [bt, setBt] = useState('0');

  const { data: nave } = useQuery({
    queryKey: ['parques', 'nave', idNave],
    queryFn: () => parquesApi.nave(idNave),
  });

  useEffect(() => {
    if (nave) {
      setMt(String(nave.dotacionMt ?? 0));
      setBt(String(nave.dotacionBt ?? 0));
    }
  }, [nave]);

  const guardar = useMutation({
    mutationFn: () =>
      parquesApi.editarDotacionNave(idNave, {
        dotacionMt: Number(mt) || 0,
        dotacionBt: Number(bt) || 0,
      }),
    onSuccess: async () => {
      setEditando(false);
      await qc.invalidateQueries({ queryKey: ['parques', 'nave', idNave] });
      await qc.invalidateQueries({ queryKey: ['parques'] });
      onCambio();
    },
    // El mensaje del backend ya trae los números («Sobran 5 KVA»).
    onError: (e) =>
      onError(
        e instanceof ApiRequestError ? e.message : 'No se pudo guardar la dotación.',
      ),
  });

  if (!nave) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-gray-50 px-3 py-2">
      <span className="text-xs font-medium text-gray-600">Dotación</span>
      {editando ? (
        <>
          <label className="flex items-center gap-1 text-xs text-gray-600">
            Baja
            <input
              type="number"
              step="0.01"
              value={bt}
              onChange={(e) => setBt(e.target.value)}
              className="w-20 rounded border px-1.5 py-0.5 text-sm tabular-nums"
            />
          </label>
          <label className="flex items-center gap-1 text-xs text-gray-600">
            Media
            <input
              type="number"
              step="0.01"
              value={mt}
              onChange={(e) => setMt(e.target.value)}
              className="w-20 rounded border px-1.5 py-0.5 text-sm tabular-nums"
            />
          </label>
          <div className="ml-auto flex gap-2 text-xs">
            <button
              onClick={() => setEditando(false)}
              className="rounded border px-2 py-0.5 text-gray-600 hover:bg-white"
            >
              Cancelar
            </button>
            <button
              onClick={() => guardar.mutate()}
              disabled={guardar.isPending}
              className="rounded bg-[#1f2a4d] px-2 py-0.5 text-white hover:bg-[#172039] disabled:opacity-50"
            >
              {guardar.isPending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </>
      ) : (
        <>
          <span className="text-sm tabular-nums text-gray-800">
            Baja <strong>{fmt(nave.dotacionBt ?? 0)}</strong>
          </span>
          <span className="text-sm tabular-nums text-gray-800">
            Media <strong>{fmt(nave.dotacionMt ?? 0)}</strong>
          </span>
          {puedeEditar && (
            <button
              onClick={() => setEditando(true)}
              title="Cambiar la dotación de esta nave"
              className="ml-auto rounded border px-2 py-0.5 text-xs text-gray-600 hover:bg-white"
            >
              Editar
            </button>
          )}
        </>
      )}
    </div>
  );
}

function Pestana({
  activa,
  onClick,
  children,
}: {
  activa: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-t-lg border-b-2 px-3 py-1.5 text-sm ${
        activa
          ? 'border-[#1f2a4d] font-medium text-[#1f2a4d]'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

/** Pestaña KVA: asignaciones de la nave, con alta, edición, baja y devolución. */
function KvasDeLaNave({
  idParque,
  idNave,
  nave,
  arrendada,
  onCambio,
  onClose,
}: {
  idParque: string;
  idNave: string;
  nave: string;
  arrendada: boolean;
  onCambio: () => void;
  onClose: () => void;
}) {
  const { tienePermiso } = useAuth();
  const puedeAsignar = tienePermiso(721);
  const puedeDevolver = tienePermiso(722);
  const qc = useQueryClient();

  const [asignando, setAsignando] = useState<AsignacionKva | 'nueva' | null>(null);
  const [devolviendo, setDevolviendo] = useState<AsignacionKva | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['kvas', 'nave', idNave],
    queryFn: () => kvasApi.porNave(idNave),
  });

  function refrescar() {
    onCambio();
    return qc.invalidateQueries({ queryKey: ['kvas', 'nave', idNave] });
  }

  const cancelar = useMutation({
    mutationFn: async (a: AsignacionKva) => {
      const motivo = window.prompt('¿Por qué se cancela esta asignación?');
      if (!motivo?.trim()) return;
      await kvasApi.cancelar(a.idKvas, motivo.trim());
    },
    onSuccess: () => void refrescar(),
    onError: (e) =>
      setError(e instanceof ApiRequestError ? e.message : 'No se pudo cancelar.'),
  });

  const renovar = useMutation({
    mutationFn: (idKvas: string) => kvasApi.renovar(idKvas),
    onSuccess: () => void refrescar(),
    onError: (e) =>
      setError(e instanceof ApiRequestError ? e.message : 'No se pudo renovar.'),
  });

  const vivas = (data ?? []).filter((a) => a.status);

  return (
    <>
      <div className="min-h-0 flex-1 overflow-auto px-5 py-3">
        {error && (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <DotacionDeLaNave idNave={idNave} onCambio={refrescar} onError={setError} />

        {isLoading ? (
          <p className="text-sm text-gray-400">Cargando…</p>
        ) : vivas.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-gray-400">
            Esta nave no tiene KVA asignados.
          </p>
        ) : (
          <ul className="space-y-2">
            {vivas.map((a) => (
              <li key={a.idKvas} className="rounded-lg border px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold tabular-nums text-gray-800">
                      {fmt(a.cantKvas)} KVA
                    </span>
                    <span className="text-gray-500">
                      {a.nivel === 'MT' ? 'Media' : 'Baja'}
                    </span>
                    {/* En áreas comunes no se pinta la figura: ver `esAreaComun`. */}
                    {!esAreaComun(nave) && (
                      <Badge color={a.figura === 'VENTA' ? 'ambar' : 'azul'}>
                        {a.figura === 'VENTA' ? 'Vendido' : 'Rentado'}
                      </Badge>
                    )}
                    <span className="text-xs text-gray-500">
                      {ETIQUETA_ETAPA[a.etapa]}
                    </span>
                  </div>
                  <div className="flex gap-2 text-xs">
                    {puedeAsignar && a.etapa === 'COMPROMETIDO' && (
                      <button
                        onClick={() => renovar.mutate(a.idKvas)}
                        disabled={renovar.isPending}
                        title="Reinicia los 10 días de vigencia del apartado"
                        className="rounded border border-[#1f2a4d]/30 px-2 py-0.5 text-[#1f2a4d] hover:bg-gray-50 disabled:opacity-50"
                      >
                        Renovar
                      </button>
                    )}
                    {puedeDevolver && a.figura === 'VENTA' && a.pendiente > 0 && (
                      <button
                        onClick={() => setDevolviendo(a)}
                        className="rounded border border-amber-300 px-2 py-0.5 text-amber-700 hover:bg-amber-50"
                      >
                        Devolución
                      </button>
                    )}
                    {puedeAsignar && (
                      <>
                        <button
                          onClick={() => setAsignando(a)}
                          className="rounded border px-2 py-0.5 text-gray-600 hover:bg-gray-50"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => cancelar.mutate(a)}
                          className="rounded border border-red-200 px-2 py-0.5 text-red-600 hover:bg-red-50"
                        >
                          Cancelar
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {/*
                  No se muestra "lo pendiente por devolver": en una venta activa
                  es SIEMPRE el total, y leerlo como deuda confunde (📌 lo revisa
                  Jereff con el cliente). Solo se informa cuando ya hubo una
                  devolución parcial, que es cuando el dato dice algo.
                */}
                <p className="mt-1 text-[11px] text-gray-400">
                  {a.contratoCfe ? `Contrato CFE ${a.contratoCfe}` : 'Sin contrato de CFE'}
                  {a.figura === 'VENTA' && a.cantDevuelta > 0 && (
                    <span className="ml-2 text-green-700">
                      · {fmt(a.cantDevuelta)} de {fmt(a.cantKvas)} ya devueltos al parque
                    </span>
                  )}
                  <Vencimiento vence={a.venceCompromiso} />
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="flex justify-between gap-2 border-t bg-gray-50 px-5 py-3">
        <button
          onClick={onClose}
          className="rounded-lg border px-3 py-1.5 text-sm text-gray-600 hover:bg-white"
        >
          Cerrar
        </button>
        {puedeAsignar && (
          <button
            onClick={() => setAsignando('nueva')}
            className="rounded-lg bg-[#1f2a4d] px-3 py-1.5 text-sm text-white hover:bg-[#172039]"
          >
            + Asignar KVA
          </button>
        )}
      </footer>

      {asignando && (
        <AsignacionKvaModal
          idParque={idParque}
          asignacion={asignando === 'nueva' ? null : asignando}
          idNaveFijo={idNave}
          naveEtiqueta={nave}
          arrendada={arrendada}
          onClose={() => setAsignando(null)}
          onListo={() => {
            setAsignando(null);
            void refrescar();
          }}
        />
      )}

      {devolviendo && (
        <DevolucionKvaModal
          asignacion={devolviendo}
          onClose={() => setDevolviendo(null)}
          onListo={() => {
            setDevolviendo(null);
            void refrescar();
          }}
        />
      )}
    </>
  );
}
