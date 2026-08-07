import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/Badge';
import { useAuth } from '@/features/auth/useAuth';
import { ApiRequestError } from '@/lib/api';
import { ETIQUETA_ETAPA, kvasApi, type AsignacionKva } from './kvas.api';
import { AsignacionKvaModal } from './AsignacionKvaModal';
import { DevolucionKvaModal } from './DevolucionKvaModal';
import { DocumentosNave } from './DocumentosNave';

const fmt = (n: number) => n.toLocaleString('es-MX', { maximumFractionDigits: 2 });

interface Props {
  idParque: string;
  idNave: string;
  nave: string;
  ocupante: string | null;
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
  onCambio,
  onClose,
}: {
  idParque: string;
  idNave: string;
  nave: string;
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

  const vivas = (data ?? []).filter((a) => a.status);

  return (
    <>
      <div className="min-h-0 flex-1 overflow-auto px-5 py-3">
        {error && (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

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
                    <Badge color={a.figura === 'VENTA' ? 'ambar' : 'azul'}>
                      {a.figura === 'VENTA' ? 'Vendido' : 'Rentado'}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {ETIQUETA_ETAPA[a.etapa]}
                    </span>
                  </div>
                  <div className="flex gap-2 text-xs">
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
