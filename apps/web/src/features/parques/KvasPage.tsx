import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/Badge';
import { useAuth } from '@/features/auth/useAuth';
import { ApiRequestError } from '@/lib/api';
import {
  ETIQUETA_ETAPA,
  ETIQUETA_NIVEL,
  kvasApi,
  type AsignacionKva,
  type EtapaKva,
  type FiguraKva,
  type NivelKva,
  type ResumenParqueKva,
} from './kvas.api';
import { AsignacionKvaModal } from './AsignacionKvaModal';
import { DevolucionKvaModal } from './DevolucionKvaModal';

const fmt = (n: number) =>
  n.toLocaleString('es-MX', { maximumFractionDigits: 2 });

/**
 * Parques → KVA's. Tablero de capacidad eléctrica: qué tiene contratado cada
 * acometida con CFE, cómo se reparte entre parques y a qué naves se asignó,
 * distinguiendo lo VENDIDO de lo RENTADO.
 *
 * Un disponible NEGATIVO se pinta en rojo: es un sobregiro real (el control
 * operativo ya trae casos), no un error de cálculo.
 */
export default function KvasPage() {
  const { tienePermiso } = useAuth();
  const puedeAsignar = tienePermiso(721);
  const puedeDevolver = tienePermiso(722);
  const qc = useQueryClient();

  const [idParque, setIdParque] = useState<string | null>(null);
  const [fNivel, setFNivel] = useState<NivelKva | 'TODOS'>('TODOS');
  const [fFigura, setFFigura] = useState<FiguraKva | 'TODOS'>('TODOS');
  const [fEtapa, setFEtapa] = useState<EtapaKva | 'TODOS'>('TODOS');
  const [verCanceladas, setVerCanceladas] = useState(false);
  const [asignando, setAsignando] = useState<AsignacionKva | 'nueva' | null>(null);
  const [devolviendo, setDevolviendo] = useState<AsignacionKva | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: resumen, isLoading } = useQuery({
    queryKey: ['kvas', 'resumen'],
    queryFn: kvasApi.resumen,
  });

  const parques = useMemo<ResumenParqueKva[]>(() => {
    if (!resumen) return [];
    return [...resumen.acometidas.flatMap((a) => a.parques), ...resumen.sinAcometida];
  }, [resumen]);

  const parqueActivo = parques.find((p) => p.idParque === idParque) ?? parques[0] ?? null;

  const { data: asignaciones } = useQuery({
    queryKey: ['kvas', 'parque', parqueActivo?.idParque],
    queryFn: () => kvasApi.porParque(parqueActivo!.idParque),
    enabled: !!parqueActivo,
  });

  const filtradas = useMemo(() => {
    return (asignaciones ?? []).filter(
      (a) =>
        (verCanceladas || a.status) &&
        (fNivel === 'TODOS' || a.nivel === fNivel) &&
        (fFigura === 'TODOS' || a.figura === fFigura) &&
        (fEtapa === 'TODOS' || a.etapa === fEtapa),
    );
  }, [asignaciones, fNivel, fFigura, fEtapa, verCanceladas]);

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

  function refrescar() {
    return Promise.all([
      qc.invalidateQueries({ queryKey: ['kvas', 'resumen'] }),
      qc.invalidateQueries({ queryKey: ['kvas', 'parque'] }),
    ]);
  }

  const acometidaDelParque = resumen?.acometidas.find(
    (a) => a.idAcometida === parqueActivo?.idAcometida,
  );

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">KVA's</h1>
          <p className="text-xs text-gray-500">
            Capacidad eléctrica contratada con CFE y su reparto entre naves.
          </p>
        </div>
        {puedeAsignar && parqueActivo && (
          <button
            onClick={() => setAsignando('nueva')}
            className="rounded-lg bg-[#1f2a4d] px-3 py-1.5 text-sm text-white hover:bg-[#172039]"
          >
            + Asignar KVA
          </button>
        )}
      </header>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-400">Cargando…</p>
      ) : parques.length === 0 ? (
        <p className="text-sm text-gray-400">No hay parques con capacidad capturada.</p>
      ) : (
        <>
          {/* Selector de parque */}
          <div className="flex flex-wrap gap-2">
            {parques.map((p) => (
              <button
                key={p.idParque}
                onClick={() => setIdParque(p.idParque)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  p.idParque === parqueActivo?.idParque
                    ? 'border-[#1f2a4d] bg-[#1f2a4d] text-white'
                    : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {p.nomParque ?? p.idParque}
              </button>
            ))}
          </div>

          {/* Acometida (la fuente contratada con CFE) */}
          {acometidaDelParque && (
            <div className="rounded-xl border bg-[#1f2a4d]/5 px-4 py-3 text-sm">
              <p className="font-medium text-gray-700">
                Acometida: {acometidaDelParque.nombre}
                {acometidaDelParque.tensionKv ? ` · ${acometidaDelParque.tensionKv} kV` : ''}
                {acometidaDelParque.folioCfe ? ` · CFE ${acometidaDelParque.folioCfe}` : ''}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Contratado {fmt(acometidaDelParque.capacidadMt)} media /{' '}
                {fmt(acometidaDelParque.capacidadBt)} baja · repartido a parques{' '}
                {fmt(acometidaDelParque.repartidoMt)} / {fmt(acometidaDelParque.repartidoBt)}
                {(acometidaDelParque.repartidoMt > acometidaDelParque.capacidadMt ||
                  acometidaDelParque.repartidoBt > acometidaDelParque.capacidadBt) && (
                  <span className="ml-2 font-semibold text-red-600">
                    ⚠️ El reparto excede lo contratado
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Capacidad del parque */}
          {parqueActivo && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TarjetaKva
                titulo="Totales"
                mt={parqueActivo.kvasMt}
                bt={parqueActivo.kvasBt}
              />
              <TarjetaKva
                titulo="Disponibles"
                mt={parqueActivo.kvasMtDisponibles}
                bt={parqueActivo.kvasBtDisponibles}
              />
              <TarjetaKva
                titulo="Utilizados"
                mt={parqueActivo.kvasMtUtilizados}
                bt={parqueActivo.kvasBtUtilizados}
              />
            </div>
          )}

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Selector
              valor={fNivel}
              onChange={(v) => setFNivel(v as NivelKva | 'TODOS')}
              opciones={[
                ['TODOS', 'Todos los niveles'],
                ['MT', 'Media tensión'],
                ['BT', 'Baja tensión'],
              ]}
            />
            <Selector
              valor={fFigura}
              onChange={(v) => setFFigura(v as FiguraKva | 'TODOS')}
              opciones={[
                ['TODOS', 'Venta y renta'],
                ['VENTA', 'Vendidos'],
                ['RENTA', 'Rentados'],
              ]}
            />
            <Selector
              valor={fEtapa}
              onChange={(v) => setFEtapa(v as EtapaKva | 'TODOS')}
              opciones={[
                ['TODOS', 'Todas las etapas'],
                ['POR_ASIGNAR', 'Por asignar'],
                ['COMPROMETIDO', 'Comprometidos'],
                ['ASIGNADO', 'Asignados (con CFE)'],
              ]}
            />
            <label className="flex items-center gap-1 text-gray-600">
              <input
                type="checkbox"
                checked={verCanceladas}
                onChange={(e) => setVerCanceladas(e.target.checked)}
              />
              Ver canceladas
            </label>
            <span className="ml-auto text-gray-400">{filtradas.length} registros</span>
          </div>

          {/* Tabla de asignaciones */}
          <div className="min-h-0 flex-1 overflow-auto rounded-xl border bg-white">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="sticky top-0 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">Nave</th>
                  <th className="px-3 py-2">Nivel</th>
                  <th className="px-3 py-2">Figura</th>
                  <th className="px-3 py-2">Etapa</th>
                  <th className="px-3 py-2 text-right">KVA</th>
                  <th className="px-3 py-2 text-right">Devueltos</th>
                  <th className="px-3 py-2">Contrato CFE</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtradas.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-gray-400">
                      Sin asignaciones para este filtro.
                    </td>
                  </tr>
                )}
                {filtradas.map((a) => (
                  <tr
                    key={a.idKvas}
                    className={`border-t ${a.status ? '' : 'bg-gray-50 text-gray-400'}`}
                  >
                    <td className="px-3 py-2">
                      {a.nave ?? a.idNave}
                      {!a.status && <span className="ml-2 text-xs">(cancelada)</span>}
                    </td>
                    <td className="px-3 py-2">{ETIQUETA_NIVEL[a.nivel]}</td>
                    <td className="px-3 py-2">
                      <Badge color={a.figura === 'VENTA' ? 'ambar' : 'azul'}>
                        {a.figura === 'VENTA' ? 'Vendido' : 'Rentado'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">{ETIQUETA_ETAPA[a.etapa]}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(a.cantKvas)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {a.figura === 'VENTA' ? (
                        <span className={a.pendiente > 0 ? 'text-amber-600' : 'text-green-700'}>
                          {fmt(a.cantDevuelta)} / {fmt(a.cantKvas)}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {a.contratoCfe ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-2 text-xs">
                        {puedeDevolver && a.figura === 'VENTA' && a.pendiente > 0 && (
                          <button
                            onClick={() => setDevolviendo(a)}
                            className="rounded border border-amber-300 px-2 py-0.5 text-amber-700 hover:bg-amber-50"
                          >
                            Devolución
                          </button>
                        )}
                        {puedeAsignar && a.status && (
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {asignando && parqueActivo && (
        <AsignacionKvaModal
          idParque={parqueActivo.idParque}
          asignacion={asignando === 'nueva' ? null : asignando}
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
    </div>
  );
}

function TarjetaKva({ titulo, mt, bt }: { titulo: string; mt: number; bt: number }) {
  const color = (v: number) => (v < 0 ? 'text-red-600' : 'text-[#1f2a4d]');
  return (
    <article className="rounded-xl border bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-gray-500">KVA's {titulo}</p>
      <div className="mt-3 flex justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">Media</p>
          <p className={`text-xl font-bold ${color(mt)}`}>{fmt(mt)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-gray-400">Baja</p>
          <p className={`text-xl font-bold ${color(bt)}`}>{fmt(bt)}</p>
        </div>
      </div>
    </article>
  );
}

function Selector({
  valor,
  onChange,
  opciones,
}: {
  valor: string;
  onChange: (v: string) => void;
  opciones: [string, string][];
}) {
  return (
    <select
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border px-2 py-1 text-xs text-gray-700"
    >
      {opciones.map(([v, t]) => (
        <option key={v} value={v}>
          {t}
        </option>
      ))}
    </select>
  );
}
