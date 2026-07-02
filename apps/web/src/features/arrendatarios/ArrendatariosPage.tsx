import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  arrendatariosApi,
  nombreArrendatario,
  moneda,
  num,
  fechaCorta,
  type ArrendatarioOpt,
  type ArrePdpVigente,
  type PlanRenta,
  type ResumenPartida,
} from './arrendatarios.api';
import { DetallePartida } from './DetallePartida';
import { ConfigArrendatarioModal } from './ConfigArrendatarioModal';
import { ConsultaInpcModal } from './ConsultaInpcModal';
import { RenovarPlanModal } from './RenovarPlanModal';
import { CancelarAnticipadoModal } from './CancelarAnticipadoModal';
import { incrementosApi } from './incrementos.api';
import { IncrementosBitacoraModal } from './IncrementosBitacora';
import { useAuth } from '@/features/auth/useAuth';
import { SearchSelect } from '@/components/SearchSelect';
import { THEAD_STICKY, THEAD_TR } from '@/components/tabla/SortableTh';
import { IconGear } from '@/components/icons';

/** Color del badge según el estado de vigencia del plan. */
const BADGE_VIGENCIA: Record<ArrePdpVigente, string> = {
  Si: 'bg-green-100 text-green-700',
  '3 Meses': 'bg-amber-100 text-amber-700',
  '2 Meses': 'bg-orange-100 text-orange-700',
  '1 Mes': 'bg-red-100 text-red-700',
  No: 'bg-gray-200 text-gray-500',
};

export function ArrendatariosPage() {
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const [idArrendador, setIdArrendador] = useState('');
  const [idNavArrend, setIdNavArrend] = useState('');
  const [idArrePdp, setIdArrePdp] = useState('');
  const [config, setConfig] = useState<ArrendatarioOpt | null>(null);
  const [verInpc, setVerInpc] = useState(false);
  const [liberando, setLiberando] = useState(false);
  const [renovarDe, setRenovarDe] = useState<string | null>(null);
  const [cancelarDe, setCancelarDe] = useState<string | null>(null);

  const { data: arrendatarios = [] } = useQuery({
    queryKey: ['arre-lista'],
    queryFn: () => arrendatariosApi.lista(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: propiedades = [] } = useQuery({
    queryKey: ['arre-propiedades', idArrendador],
    queryFn: () => arrendatariosApi.propiedades(idArrendador),
    enabled: !!idArrendador,
  });

  const { data: planes = [] } = useQuery({
    queryKey: ['arre-planes', idNavArrend, idArrendador],
    queryFn: () => arrendatariosApi.planes(idNavArrend, idArrendador),
    enabled: !!idNavArrend && !!idArrendador,
  });

  const arreSel = useMemo(
    () => arrendatarios.find((a) => a.idInversionista === idArrendador) ?? null,
    [arrendatarios, idArrendador],
  );

  const opciones = useMemo(
    () => arrendatarios.map((a) => ({ value: a.idInversionista, label: nombreArrendatario(a) })),
    [arrendatarios],
  );

  const planSel = planes.find((p) => p.idArrePdp === idArrePdp) ?? null;
  const propSel = propiedades.find((p) => p.idNavArrend === idNavArrend) ?? null;

  // En esta pantalla solo se muestran planes **activos** (el vinculado con
  // pdpActivo) o **finalizados** (vencidos, arrePdpVigente='No'). Los planes "en
  // diseño" (creados pero aún no activados y todavía vigentes) se gestionan en
  // Configuración y no se listan aquí.
  const esPlanActivo = (p: PlanRenta) =>
    !!propSel?.pdpActivo && p.idArrePdp === propSel?.idArrendadoPdp;
  const planesVisibles = useMemo(
    () => planes.filter((p) => p.arrePdpVigente === 'No' || esPlanActivo(p)),
    [planes, propSel],
  );

  // Se puede liberar la nave si todos sus planes están vencidos ('No') y ninguno
  // está activo. El backend revalida esta condición.
  const liberable =
    planes.length > 0 && planes.every((p) => p.arrePdpVigente === 'No') && !propSel?.pdpActivo;

  // Plan renovable: alguno por vencer (≤3 meses) o vencido que aún NO tenga una
  // renovación (otro plan que inicie después de su fin). El backend revalida.
  const planRenovable = useMemo(() => {
    const renovables: ArrePdpVigente[] = ['3 Meses', '2 Meses', '1 Mes', 'No'];
    for (const p of planes) {
      if (!p.arrePdpVigente || !renovables.includes(p.arrePdpVigente) || !p.fecFin) continue;
      const yaRenovado = planes.some(
        (o) => o.idArrePdp !== p.idArrePdp && !!o.fecInicio && o.fecInicio > p.fecFin!,
      );
      if (!yaRenovado) return p;
    }
    return null;
  }, [planes]);

  // Plan activo (vinculado y vigente): único candidato a cancelación anticipada.
  const planActivo = useMemo(
    () =>
      planes.find((p) => !!propSel?.pdpActivo && p.idArrePdp === propSel?.idArrendadoPdp) ?? null,
    [planes, propSel],
  );
  const cancelable = !!planActivo && planActivo.arrePdpVigente !== 'No';

  async function liberar() {
    if (
      !window.confirm(
        '¿Liberar esta nave? Quedará disponible para rentar de nuevo. El historial de contratos se conserva.',
      )
    )
      return;
    setLiberando(true);
    try {
      await arrendatariosApi.liberarNave(idNavArrend);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['arre-propiedades', idArrendador] }),
        queryClient.invalidateQueries({ queryKey: ['arre-planes'] }),
      ]);
      setIdNavArrend('');
      setIdArrePdp('');
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'No se pudo liberar la nave.');
    } finally {
      setLiberando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-gray-800">Arrendatarios · Planes de Renta</h1>
        <button
          type="button"
          onClick={() => setVerInpc(true)}
          className="rounded-lg border border-[#1f2a4d] px-3 py-2 text-sm font-medium text-[#1f2a4d] hover:bg-[#1f2a4d] hover:text-white"
        >
          Consulta INPC
        </button>
      </div>

      {/* Selectores */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-gray-600">
          Arrendatario
          <SearchSelect
            value={idArrendador}
            onChange={(v) => {
              setIdArrendador(v);
              setIdNavArrend('');
              setIdArrePdp('');
            }}
            options={opciones}
            placeholder="Selecciona…"
            className="mt-1 w-72"
          />
        </label>

        {arreSel && tienePermiso(25) && (
          <button
            type="button"
            onClick={() => setConfig(arreSel)}
            title="Configuración del arrendatario"
            className="flex items-center gap-1.5 rounded-lg border border-[#1f2a4d] px-3 py-2 text-sm font-medium text-[#1f2a4d] hover:bg-[#1f2a4d] hover:text-white"
          >
            <IconGear width={16} height={16} /> Configuración
          </button>
        )}

        {idArrendador && (
          <label className="text-xs text-gray-600">
            Propiedad / Nave
            <select
              value={idNavArrend}
              onChange={(e) => {
                setIdNavArrend(e.target.value);
                setIdArrePdp('');
              }}
              className="mt-1 block w-72 rounded border px-2 py-1.5 text-sm"
            >
              <option value="">Selecciona…</option>
              {propiedades.map((p) => (
                <option key={p.idNavArrend} value={p.idNavArrend}>
                  {p.nomDescriptivo ?? p.numNaveNAME ?? p.idNavArrend}
                </option>
              ))}
            </select>
          </label>
        )}

        {planSel && (
          <div className="ml-auto self-center">
            <EstadoContratoBox vigencia={planSel.arrePdpVigente} />
          </div>
        )}
      </div>

      {/* Historial de planes */}
      {idNavArrend && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-600">Planes de esta propiedad</h2>
            <div className="flex gap-2">
              {planRenovable && tienePermiso(23) && (
                <button
                  type="button"
                  onClick={() => setRenovarDe(planRenovable.idArrePdp)}
                  title="El plan está por vencer: registra su renovación"
                  className="rounded-lg border border-sky-500 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-50"
                >
                  🔄 Renovar
                </button>
              )}
              {cancelable && tienePermiso(22) && (
                <button
                  type="button"
                  onClick={() => setCancelarDe(planActivo!.idArrePdp)}
                  title="Termina el contrato anticipadamente desde un mes elegido"
                  className="rounded-lg border border-red-500 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  🛑 Cancelación anticipada
                </button>
              )}
              {liberable && tienePermiso(24) && (
                <button
                  type="button"
                  onClick={liberar}
                  disabled={liberando}
                  title="Todos los planes están vencidos: libera la nave para volver a rentarla"
                  className="rounded-lg border border-amber-500 px-3 py-1.5 text-xs font-medium text-amber-600 hover:bg-amber-50 disabled:opacity-50"
                >
                  {liberando ? 'Liberando…' : '🔓 Liberar nave'}
                </button>
              )}
            </div>
          </div>
          {planesVisibles.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-white p-6 text-center text-sm text-gray-400">
              Esta propiedad no tiene planes activos ni finalizados. Los planes en diseño se ven en Configuración.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {planesVisibles.map((p) => (
                <PlanChip
                  key={p.idArrePdp}
                  plan={p}
                  activo={p.idArrePdp === idArrePdp}
                  onClick={() => setIdArrePdp(p.idArrePdp)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Corrida del plan seleccionado */}
      {planSel && <CorridaPlan plan={planSel} />}

      {config && (
        <ConfigArrendatarioModal arrendatario={config} onClose={() => setConfig(null)} />
      )}
      {verInpc && <ConsultaInpcModal onClose={() => setVerInpc(false)} />}
      {renovarDe && (
        <RenovarPlanModal
          idArrePdp={renovarDe}
          nombre={`${arreSel ? nombreArrendatario(arreSel) : ''} · ${propSel?.nomDescriptivo ?? ''}`}
          onClose={() => setRenovarDe(null)}
          onRenovado={() => {
            void queryClient.invalidateQueries({ queryKey: ['arre-planes'] });
            void queryClient.invalidateQueries({ queryKey: ['arre-propiedades', idArrendador] });
          }}
        />
      )}
      {cancelarDe && (
        <CancelarAnticipadoModal
          idArrePdp={cancelarDe}
          nombre={`${arreSel ? nombreArrendatario(arreSel) : ''} · ${propSel?.nomDescriptivo ?? ''}`}
          onClose={() => setCancelarDe(null)}
          onCancelado={() => {
            // La nave se liberó: se limpia la selección y se refrescan listas.
            void queryClient.invalidateQueries({ queryKey: ['arre-planes'] });
            void queryClient.invalidateQueries({ queryKey: ['arre-propiedades', idArrendador] });
            setIdNavArrend('');
            setIdArrePdp('');
          }}
        />
      )}
    </div>
  );
}

function PlanChip({
  plan,
  activo,
  onClick,
}: {
  plan: PlanRenta;
  activo: boolean;
  onClick: () => void;
}) {
  const badge = plan.arrePdpVigente ? BADGE_VIGENCIA[plan.arrePdpVigente] : 'bg-gray-100 text-gray-500';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
        activo ? 'border-[#1f2a4d] bg-[#1f2a4d]/5' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="font-medium text-gray-700">
          {fechaCorta(plan.fecInicio)} → {fechaCorta(plan.fecFin)}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge}`}>
          {plan.arrePdpVigente ?? '—'}
        </span>
      </div>
      <div className="mt-0.5 text-[11px] text-gray-400">
        Plazo {plan.plazo ?? '—'} m · {plan.Moneda ?? 'MXN'}
      </div>
    </button>
  );
}

/**
 * Recuadro grande del estado del contrato según el **plan seleccionado**:
 * verde "VIGENTE" si está vigente, ámbar "POR VENCER" si está por vencer
 * (3/2/1 meses) y gris "NO VIGENTE" si ya venció ('No').
 */
function EstadoContratoBox({ vigencia }: { vigencia: ArrePdpVigente | null }) {
  const vencido = vigencia == null || vigencia === 'No';
  const porVencer = vigencia === '3 Meses' || vigencia === '2 Meses' || vigencia === '1 Mes';
  const estado = vencido ? 'NO VIGENTE' : porVencer ? 'POR VENCER' : 'VIGENTE';
  const cls = vencido
    ? 'border-gray-300 text-gray-500'
    : porVencer
      ? 'border-amber-400 text-amber-600'
      : 'border-green-400 text-green-600';
  return (
    <div
      className={`flex min-w-[12rem] flex-col items-center justify-center rounded-xl border-2 bg-white px-8 py-2.5 text-center ${cls}`}
      title="Estado de vigencia del plan seleccionado"
    >
      <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
        Estado del contrato
      </span>
      <span className="text-2xl font-extrabold uppercase tracking-wide">{estado}</span>
    </div>
  );
}

function CorridaPlan({ plan }: { plan: PlanRenta }) {
  const modificable = plan.arrePdpVigente !== 'No';
  const divisa = plan.Moneda ?? 'MXN';
  const { data = [], isLoading } = useQuery({
    queryKey: ['arre-resumen', plan.idArrePdp],
    queryFn: () => arrendatariosApi.resumen(plan.idArrePdp),
  });
  const [abierta, setAbierta] = useState<number | null>(null);
  // Incrementos INPC del plan (bitácora arre_incrementos, legible con clave 20)
  const [verIncrementos, setVerIncrementos] = useState(false);
  const { data: incrementos = [] } = useQuery({
    queryKey: ['incrementos-bitacora', plan.idArrePdp, ''],
    queryFn: () => incrementosApi.bitacora({ idArrePdp: plan.idArrePdp }),
  });
  const aplicados = incrementos.filter((i) => i.estado === 'aplicado');
  const ultimo = aplicados[0];

  if (!isLoading && data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-white p-6 text-center text-sm text-gray-400">
        El plan no está activo o no tiene corrida. Actívalo en Configuración para verla.
      </div>
    );
  }

  return (
    <>
      {incrementos.length > 0 && (
        <div className="mb-2 flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-xs text-green-800">
          <span>
            ✅ {aplicados.length} incremento(s) INPC aplicado(s)
            {ultimo && (
              <>
                {' · '}último: año {ultimo.anioAplicado} con{' '}
                {ultimo.idInpc === 'MANUAL'
                  ? 'edición manual'
                  : `${(Number(ultimo.inpcAplicado) + Number(ultimo.ptsAplicados)).toFixed(2)}%`}{' '}
                el {fechaCorta(ultimo.fc)}
                {ultimo.desactualizado && (
                  <strong className="ml-1 text-amber-700">
                    ⚠️ aplicado con un INPC distinto al vigente
                  </strong>
                )}
              </>
            )}
          </span>
          <button
            onClick={() => setVerIncrementos(true)}
            className="shrink-0 font-medium text-[#3f5b87] hover:underline"
          >
            Historial
          </button>
        </div>
      )}
      {verIncrementos && (
        <IncrementosBitacoraModal
          filtro={{ idArrePdp: plan.idArrePdp }}
          titulo="Historial de incrementos INPC del plan"
          onClose={() => setVerIncrementos(false)}
        />
      )}
    <div className="overflow-auto rounded-xl border bg-white" style={{ maxHeight: '60vh' }}>
      <table className="min-w-full border-collapse text-sm">
        <thead className={THEAD_STICKY}>
          <tr className={THEAD_TR}>
            <th className="px-3 py-3 text-center">#</th>
            <th className="px-3 py-3 text-center">Ciclo</th>
            <th className="px-3 py-3 text-center">Año</th>
            <th className="px-3 py-3 text-left">Fecha</th>
            <th className="px-3 py-3 text-right">$ × m²</th>
            <th className="px-3 py-3 text-right">const m²</th>
            <th className="px-3 py-3 text-right">INPC</th>
            <th className="px-3 py-3 text-right">Monto</th>
            <th className="px-3 py-3 text-center" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {isLoading ? (
            <tr>
              <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                Cargando…
              </td>
            </tr>
          ) : (
            data.map((r: ResumenPartida) => {
              const open = abierta === r.numPartida;
              return (
                <PartidaFila
                  key={`${r.numPartida}-${r.anio}`}
                  fila={r}
                  divisa={divisa}
                  abierta={open}
                  modificable={modificable}
                  idArrePdp={plan.idArrePdp}
                  onToggle={() => setAbierta(open ? null : r.numPartida)}
                />
              );
            })
          )}
        </tbody>
      </table>
    </div>
    </>
  );
}

function PartidaFila({
  fila,
  divisa,
  abierta,
  modificable,
  idArrePdp,
  onToggle,
}: {
  fila: ResumenPartida;
  divisa: string;
  abierta: boolean;
  modificable: boolean;
  idArrePdp: string;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-3 py-2 text-center">{fila.numPartida}</td>
        <td className="px-3 py-2 text-center">{fila.ciclo}</td>
        <td className="px-3 py-2 text-center">{fila.anio}</td>
        <td className="px-3 py-2 whitespace-nowrap">{fechaCorta(fila.fecha)}</td>
        <td className="px-3 py-2 text-right tabular-nums">{num(fila.pm2)}</td>
        <td className="px-3 py-2 text-right tabular-nums">{num(fila.constM2)}</td>
        <td className="px-3 py-2 text-right tabular-nums">{num(fila.totalINPC)}</td>
        <td className="px-3 py-2 text-right tabular-nums font-medium">
          {moneda(fila.total_cantidad, divisa)}
        </td>
        <td className="px-3 py-2 text-center">
          <button
            type="button"
            onClick={onToggle}
            className="text-[#3f5b87] hover:text-[#1f2a4d]"
            aria-label={abierta ? 'Cerrar detalle' : 'Ver detalle'}
          >
            {abierta ? '▲' : '▼'}
          </button>
        </td>
      </tr>
      {abierta && (
        <tr>
          <td colSpan={9} className="bg-gray-50 px-4 py-3">
            <DetallePartida
              idArrePdp={idArrePdp}
              numPartida={fila.numPartida}
              divisa={divisa}
              modificable={modificable}
            />
          </td>
        </tr>
      )}
    </>
  );
}
